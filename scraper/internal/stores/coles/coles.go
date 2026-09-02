// Package coles crawls www.coles.com.au via its Next.js data endpoints.
package coles

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"strings"
	"sync"
	"sync/atomic"

	"basketwise/scraper/internal/crawl"
)

const (
	Base     = "https://www.coles.com.au"
	PageSize = 48
	ImageCDN = "https://productimages.coles.com.au/productimages"
	ShopCDN  = "https://shop.coles.com.au"
)

var buildRe = regexp.MustCompile(`"buildId":"([^"]+)"`)
var wsRe = regexp.MustCompile(`\s+`)
var nextDataRe = regexp.MustCompile(`(?s)<script id="__NEXT_DATA__" type="application/json">(.*?)</script>`)

// Store implements crawl.Store for Coles.
type Store struct {
	buildID atomic.Value // string
	Leaves  bool         // crawl leaf categories instead of top-level
	dead    sync.Map     // category id -> struct{} once paging is exhausted/garbage
	refresh sync.Mutex
}

func New() *Store { s := &Store{}; s.buildID.Store(""); return s }

func (s *Store) Name() string { return "coles" }

func (s *Store) build() string { return s.buildID.Load().(string) }

// BuildCache is where the last known build id is persisted (lets JSON crawling
// proceed even when the HTML page serves an anti-bot interstitial).
var BuildCache = "data/coles_build.txt"

// Warmup resolves the Next.js build id. The Coles JSON endpoints work without a
// warmed cookie jar, and the /browse HTML page intermittently serves an Imperva
// interstitial, so we verify a cached build id via JSON first and only scrape the
// HTML (via FetchNoRate, so its interstitials don't throttle the JSON crawl) when
// the cached id is missing or stale.
func (s *Store) Warmup(ctx context.Context, e *crawl.Engine) error {
	if s.build() == "" {
		if b, rerr := os.ReadFile(BuildCache); rerr == nil && strings.TrimSpace(string(b)) != "" {
			s.buildID.Store(strings.TrimSpace(string(b)))
		}
	}
	// A plain HTML GET sets the Imperva session cookies (incap_ses_*, visid_incap_*,
	// nlbi_*) even when it returns the interstitial. The product-detail JSON endpoint
	// requires those cookies, so always do this once (rate-free; its interstitial is
	// not a throttle signal). We then resolve the build id from JSON if we can.
	res, err := e.FetchNoRate(ctx, crawl.SimpleRequest{Method: "GET", URL: Base + "/browse"}, false)
	if err == nil {
		if m := buildRe.FindSubmatch(res.Body); m != nil {
			old := s.build()
			s.buildID.Store(string(m[1]))
			_ = os.WriteFile(BuildCache, m[1], 0o644)
			if old != string(m[1]) {
				e.Emit.Event("coles", "build_id", string(m[1]))
			}
			return nil
		}
	}
	if s.build() != "" && s.verifyBuild(ctx, e) == nil {
		return nil
	}
	if err != nil {
		return err
	}
	res, err = e.FetchNoRate(ctx, crawl.SimpleRequest{Method: "GET", URL: Base + "/browse"}, false)
	if err != nil {
		return err
	}
	m := buildRe.FindSubmatch(res.Body)
	if m == nil {
		return fmt.Errorf("build id not found in /browse html (%d bytes)", len(res.Body))
	}
	old := s.build()
	s.buildID.Store(string(m[1]))
	_ = os.WriteFile(BuildCache, m[1], 0o644)
	if old != string(m[1]) {
		e.Emit.Event("coles", "build_id", string(m[1]))
	}
	return nil
}

// verifyBuild checks the cached build id still answers JSON (no rate accounting).
func (s *Store) verifyBuild(ctx context.Context, e *crawl.Engine) error {
	_, err := e.FetchNoRate(ctx, s.dataReq(fmt.Sprintf("%s/_next/data/%s/en/browse.json", Base, s.build()), "/browse"), true)
	return err
}

// refreshBuild re-reads the build id once (called on 404 of a _next/data URL).
func (s *Store) refreshBuild(ctx context.Context, e *crawl.Engine, seen string) bool {
	s.refresh.Lock()
	defer s.refresh.Unlock()
	if s.build() != seen {
		return true // someone else already refreshed
	}
	if err := s.Warmup(ctx, e); err != nil {
		e.Log.Warn("build refresh failed", "err", err)
		return false
	}
	return s.build() != seen
}

type catNode struct {
	SeoToken     string    `json:"seoToken"`
	Name         string    `json:"name"`
	ProductCount int       `json:"productCount"`
	Children     []catNode `json:"catalogGroupView"`
}

func (s *Store) Categories(ctx context.Context, e *crawl.Engine) ([]crawl.Category, error) {
	res, err := e.Fetch(ctx, s.dataReq(fmt.Sprintf("%s/_next/data/%s/en/browse.json", Base, s.build()), "/browse"), true)
	if err != nil {
		return nil, err
	}
	var tree struct {
		PageProps struct {
			All struct {
				Roots []catNode `json:"catalogGroupView"`
			} `json:"allProductCategories"`
		} `json:"pageProps"`
	}
	if err := json.Unmarshal(res.Body, &tree); err != nil {
		return nil, err
	}
	var out []crawl.Category
	var walk func(n catNode, path string)
	walk = func(n catNode, path string) {
		p := path + "/" + n.SeoToken
		if !s.Leaves || len(n.Children) == 0 {
			out = append(out, crawl.Category{ID: n.SeoToken, Name: n.Name, Path: p, Slug: n.SeoToken, Total: n.ProductCount})
		}
		if s.Leaves {
			for _, c := range n.Children {
				walk(c, p)
			}
		}
	}
	for _, r := range tree.PageProps.All.Roots {
		walk(r, "")
	}
	return out, nil
}

func (s *Store) dataReq(u, referer string) crawl.Request {
	return crawl.SimpleRequest{Method: "GET", URL: u, Headers: map[string]string{
		"Accept": "application/json", "x-nextjs-data": "1", "Referer": Base + referer,
	}}
}

func (s *Store) ListItem(cat crawl.Category, page int) crawl.Item {
	return &listItem{s: s, cat: cat, page: page}
}
func (s *Store) DetailItem(id, slug string) crawl.Item { return &detailItem{s: s, id: id, slug: slug} }
func (s *Store) FlushBatches(e *crawl.Engine)          {}

// ---------- listing ----------

type listItem struct {
	s    *Store
	cat  crawl.Category
	page int
}

func (it *listItem) Kind() string { return "list" }

type pricing struct {
	Now        crawl.FlexFloat `json:"now"`
	Was        crawl.FlexFloat `json:"was"`
	SaveAmount crawl.FlexFloat `json:"saveAmount"`
	Comparable string          `json:"comparable"`
	PromoType  string          `json:"promotionType"`
	Unit       struct {
		Quantity          crawl.FlexFloat `json:"quantity"`
		OfMeasureQuantity crawl.FlexFloat `json:"ofMeasureQuantity"`
		OfMeasureUnits    string          `json:"ofMeasureUnits"`
		Price             crawl.FlexFloat `json:"price"`
		IsWeighted        bool            `json:"isWeighted"`
	} `json:"unit"`
}

type listProduct struct {
	Type              string `json:"_type"`
	ID                int64  `json:"id"`
	Name              string `json:"name"`
	Brand             string `json:"brand"`
	Description       string `json:"description"`
	Size              string `json:"size"`
	Availability      bool   `json:"availability"`
	AvailableQuantity int    `json:"availableQuantity"`
	ImageUris         []struct {
		URI string `json:"uri"`
	} `json:"imageUris"`
	Pricing      *pricing `json:"pricing"`
	Restrictions struct {
		RetailLimit      crawl.FlexInt `json:"retailLimit"`
		PromotionalLimit crawl.FlexInt `json:"promotionalLimit"`
	} `json:"restrictions"`
	OnlineHeirs []struct {
		Aisle       string `json:"aisle"`
		Category    string `json:"category"`
		SubCategory string `json:"subCategory"`
	} `json:"onlineHeirs"`
}

func (lp *listProduct) toProduct(raw json.RawMessage) *crawl.Product {
	p := &crawl.Product{Store: "coles", ID: fmt.Sprint(lp.ID), Name: lp.Name, Brand: lp.Brand, Size: lp.Size, Description: lp.Description,
		Available: lp.Availability, InStock: lp.Availability, RetailLimit: int(lp.Restrictions.RetailLimit), PromoLimit: int(lp.Restrictions.PromotionalLimit)}
	if pr := lp.Pricing; pr != nil {
		p.PriceCents = crawl.Cents(float64(pr.Now))
		p.WasCents = crawl.Cents(float64(pr.Was))
		p.SaveCents = crawl.Cents(float64(pr.SaveAmount))
		if p.SaveCents == 0 && p.WasCents > p.PriceCents {
			p.SaveCents = p.WasCents - p.PriceCents
		}
		p.UnitPriceCents = crawl.Cents(float64(pr.Unit.Price))
		p.UnitPriceStr = pr.Comparable
		if pr.Unit.OfMeasureUnits != "" {
			p.UnitMeasure = strings.TrimSuffix(fmt.Sprintf("%g", float64(pr.Unit.OfMeasureQuantity)), ".0") + pr.Unit.OfMeasureUnits
		}
		p.IsWeighted = pr.Unit.IsWeighted
	}
	for _, im := range lp.ImageUris {
		if im.URI != "" {
			p.ImageURLs = append(p.ImageURLs, ImageCDN+im.URI)
		}
	}
	if len(lp.OnlineHeirs) > 0 {
		h := lp.OnlineHeirs[0]
		p.Dept, p.Category, p.Aisle = h.SubCategory, h.Category, h.Aisle
		p.CategoryPath = h.SubCategory + " > " + h.Category + " > " + h.Aisle
	}
	p.URL = "/product/" + Slug(lp.Brand, lp.Name, lp.Size, p.ID)
	p.ListingJSON = raw
	return p
}

// Slug builds the canonical Coles product slug: lowercase "brand name size" with
// whitespace runs turned into dashes (punctuation such as . ' + is kept), then "-id".
func Slug(brand, name, size, id string) string {
	s := strings.ToLower(strings.TrimSpace(strings.Join([]string{brand, name, size}, " ")))
	s = wsRe.ReplaceAllString(s, "-")
	s = strings.Trim(s, "-")
	if s == "" {
		return "x-" + id
	}
	return s + "-" + id
}

func (it *listItem) Do(ctx context.Context, e *crawl.Engine) error {
	if _, dead := it.s.dead.Load(it.cat.ID); dead {
		return nil
	}
	build := it.s.build()
	u := fmt.Sprintf("%s/_next/data/%s/en/browse/%s.json?slug=%s&page=%d", Base, build, it.cat.Slug, url.QueryEscape(it.cat.Slug), it.page)
	res, err := e.Fetch(ctx, it.s.dataReq(u, "/browse/"+it.cat.Slug), true)
	if err != nil {
		if fe, ok := err.(*crawl.FetchError); ok && fe.Status == 404 {
			it.s.refreshBuild(ctx, e, build)
		}
		return err
	}
	var page struct {
		PageProps struct {
			SearchResults struct {
				NoOfResults int               `json:"noOfResults"`
				PageSize    int               `json:"pageSize"`
				Results     []json.RawMessage `json:"results"`
			} `json:"searchResults"`
		} `json:"pageProps"`
	}
	if err := json.Unmarshal(res.Body, &page); err != nil {
		return &crawl.FetchError{Kind: crawl.KindBody, URL: u, Msg: err.Error()}
	}
	sr := page.PageProps.SearchResults
	prods := make([]*crawl.Product, 0, len(sr.Results))
	slugs := make([]string, 0, len(sr.Results))
	for _, raw := range sr.Results {
		var lp listProduct
		if err := json.Unmarshal(raw, &lp); err != nil || lp.Type != "PRODUCT" || lp.ID == 0 {
			continue
		}
		p := lp.toProduct(raw)
		prods = append(prods, p)
		slugs = append(slugs, strings.TrimPrefix(p.URL, "/product/"))
	}
	newN := e.OnListingPage(it.cat, it.page, prods, slugs)
	if it.page == 1 {
		ps := sr.PageSize
		if ps <= 0 {
			ps = PageSize
		}
		e.EnqueuePages(it.cat, sr.NoOfResults, ps)
	} else if len(prods) == 0 || newN < 0 {
		it.s.dead.Store(it.cat.ID, struct{}{})
	}
	return nil
}

// ---------- detail ----------

type detailItem struct {
	s        *Store
	id       string
	slug     string
	resolved bool
}

func (it *detailItem) Kind() string { return "detail" }

type detailProduct struct {
	listProduct
	LongDescription string `json:"longDescription"`
	Gtin            string `json:"gtin"`
	CountryOfOrigin *struct {
		Country   string `json:"country"`
		Statement string `json:"statement"`
	} `json:"countryOfOrigin"`
	Nutrition *struct {
		ServingsPerPackage string `json:"servingsPerPackage"`
		ServingSize        string `json:"servingSize"`
		Breakdown          []struct {
			Title     string `json:"title"`
			Nutrients []struct {
				Nutrient        string `json:"nutrient"`
				Value           string `json:"value"`
				DailyIntakeInfo string `json:"dailyIntakeInfo"`
			} `json:"nutrients"`
		} `json:"breakdown"`
	} `json:"nutrition"`
	AdditionalInfo []struct {
		Title       string `json:"title"`
		Description string `json:"description"`
	} `json:"additionalInfo"`
	Images []struct {
		Full struct {
			Path string `json:"path"`
		} `json:"full"`
	} `json:"images"`
	Lifestyle []string `json:"lifestyle"`
}

func (it *detailItem) Do(ctx context.Context, e *crawl.Engine) error {
	slug := it.slug
	if slug == "" {
		slug = "x-" + it.id
	}
	build := it.s.build()
	u := fmt.Sprintf("%s/_next/data/%s/en/product/%s.json?slug=%s", Base, build, url.PathEscape(slug), url.QueryEscape(slug))
	res, err := e.Fetch(ctx, it.s.dataReq(u, "/product/"+url.PathEscape(slug)), true)
	if err != nil {
		if fe, ok := err.(*crawl.FetchError); ok && fe.Status == 404 {
			if it.s.refreshBuild(ctx, e, build) {
				return err // build changed: retry
			}
			return it.resolveAndRetry(ctx, e)
		}
		return err
	}
	var page struct {
		PageProps struct {
			Product json.RawMessage `json:"product"`
		} `json:"pageProps"`
	}
	if err := json.Unmarshal(res.Body, &page); err != nil {
		return &crawl.FetchError{Kind: crawl.KindBody, URL: u, Msg: err.Error()}
	}
	raw := page.PageProps.Product
	if len(raw) == 0 || string(raw) == "null" {
		return it.resolveAndRetry(ctx, e)
	}
	return it.fromRaw(raw, slug, e)
}

// fromRaw parses a pageProps.product blob and persists it.
func (it *detailItem) fromRaw(raw json.RawMessage, slug string, e *crawl.Engine) error {
	var dp detailProduct
	if err := json.Unmarshal(raw, &dp); err != nil {
		return fmt.Errorf("detail decode %s: %w", it.id, err)
	}
	p := dp.listProduct.toProduct(nil)
	p.ListingJSON = nil
	p.DetailJSON = raw
	p.HasDetail = true
	p.URL = "/product/" + slug
	p.LongDescription = dp.LongDescription
	p.Barcode = dp.Gtin
	if dp.CountryOfOrigin != nil {
		p.CountryOfOrigin = dp.CountryOfOrigin.Statement
		if p.CountryOfOrigin == "" {
			p.CountryOfOrigin = dp.CountryOfOrigin.Country
		}
	}
	p.ImageURLs = p.ImageURLs[:0]
	for _, im := range dp.Images {
		if im.Full.Path != "" {
			p.ImageURLs = append(p.ImageURLs, ShopCDN+im.Full.Path)
		}
	}
	if len(p.ImageURLs) == 0 {
		for _, im := range dp.ImageUris {
			p.ImageURLs = append(p.ImageURLs, ImageCDN+im.URI)
		}
	}
	for _, ai := range dp.AdditionalInfo {
		switch strings.ToLower(ai.Title) {
		case "ingredients":
			p.Ingredients = ai.Description
		case "allergen", "allergens":
			p.Allergens = ai.Description
		case "dietary":
			p.Dietary = ai.Description
		}
	}
	if p.Dietary == "" && len(dp.Lifestyle) > 0 {
		p.Dietary = strings.Join(dp.Lifestyle, ", ")
	}
	if n := dp.Nutrition; n != nil {
		nut := &crawl.Nutrition{ServingSize: n.ServingSize, ServingsPerPack: n.ServingsPerPackage}
		idx := map[string]int{}
		for _, bd := range n.Breakdown {
			per100 := strings.Contains(strings.ToLower(bd.Title), "100")
			for _, nu := range bd.Nutrients {
				i, ok := idx[nu.Nutrient]
				if !ok {
					idx[nu.Nutrient] = len(nut.Rows)
					nut.Rows = append(nut.Rows, crawl.NutrientRow{Name: nu.Nutrient})
					i = len(nut.Rows) - 1
				}
				if per100 {
					nut.Rows[i].Per100 = nu.Value
				} else {
					nut.Rows[i].PerServing = nu.Value
					nut.Rows[i].DI = strings.Trim(nu.DailyIntakeInfo, "()")
				}
			}
		}
		p.Nutrition = nut
	}
	e.OnDetail(p)
	return nil
}

// resolveAndRetry asks the site for the canonical slug via the 308 redirect of
// /product/x-{id}. If the page answers 200 instead, the SSR __NEXT_DATA__ blob
// already contains pageProps.product and is parsed directly.
func (it *detailItem) resolveAndRetry(ctx context.Context, e *crawl.Engine) error {
	if it.resolved {
		e.OnDeprecated(it.id)
		return nil
	}
	it.resolved = true
	// The /product/x-{id} HTML page intermittently serves an Imperva interstitial;
	// that is not a signal that the JSON API is overloaded, so use FetchNoRate and,
	// on any non-clean response, leave the product for a later detail pass rather
	// than backing off the JSON crawl or wrongly deprecating a live product.
	res, err := e.FetchNoRate(ctx, crawl.SimpleRequest{Method: http.MethodGet, URL: Base + "/product/x-" + it.id}, false)
	if err != nil {
		if fe, ok := err.(*crawl.FetchError); ok && fe.Status == 404 {
			e.OnDeprecated(it.id)
		}
		return nil // skip; retried next detail pass
	}
	if loc := res.Header.Get("Location"); res.Status >= 300 && res.Status < 400 && loc != "" {
		slug := strings.TrimPrefix(strings.TrimPrefix(loc, Base), "/product/")
		if un, err := url.PathUnescape(slug); err == nil {
			slug = un
		}
		it.slug = slug
		return it.Do(ctx, e)
	}
	if res.Status == 200 {
		if m := nextDataRe.FindSubmatch(res.Body); m != nil {
			var nd struct {
				Props struct {
					PageProps struct {
						Product json.RawMessage `json:"product"`
					} `json:"pageProps"`
				} `json:"props"`
			}
			if json.Unmarshal(m[1], &nd) == nil && len(nd.Props.PageProps.Product) > 2 {
				return it.fromRaw(nd.Props.PageProps.Product, "x-"+it.id, e)
			}
		}
	}
	return nil // interstitial or unparseable; leave for a later pass
}
