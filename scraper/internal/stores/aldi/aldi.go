// Package aldi crawls api.aldi.com.au's product-search API for ALDI Australia.
//
// ALDI needs no API key, no cookies and has no anti-bot protection — the whole
// catalogue lives in one JSON listing endpoint with no per-product detail
// endpoint, so this store only ever runs a listing crawl (nutrition/ingredients
// exist on the ~500KB HTML product pages but are intentionally out of scope).
package aldi

import (
	"context"
	"encoding/json"
	"fmt"
	"regexp"
	"strconv"
	"strings"

	"basketwise/scraper/internal/crawl"
)

const (
	Base = "https://www.aldi.com.au"
	API  = "https://api.aldi.com.au"
	// PageSize must be one of {12,16,24,30,32,48,60} — the API rejects any other value.
	PageSize    = 60
	ServiceType = "walk-in" // national in-store range; delivery/pickup need a servicePoint
)

// topCategoryRe matches only TOP-LEVEL nav links: href="/products/{slug}/k/{id}".
// The [a-z0-9-]+ slug class excludes "/", so a subcategory link like
// href="/products/baby/baby-food/k/1111111236" cannot match — the extra path
// segment breaks it before "/k/" — which is exactly what keeps this to the ~12
// top-level departments instead of ~120 nav entries including every subcategory.
var topCategoryRe = regexp.MustCompile(`href="/products/([a-z0-9-]+)/k/(\d+)"`)

// Store implements crawl.Store for ALDI.
type Store struct{}

func New() *Store { return &Store{} }

func (s *Store) Name() string { return "aldi" }

// Warmup is a no-op: the API needs no session/cookies/key.
func (s *Store) Warmup(ctx context.Context, e *crawl.Engine) error { return nil }

func (s *Store) FlushBatches(e *crawl.Engine) {}

// Categories reads the top-level department links straight off the homepage
// nav — href="/products/{slug}/k/{categoryKey}" — which gives every category
// key in one request with no redirect-following needed.
func (s *Store) Categories(ctx context.Context, e *crawl.Engine) ([]crawl.Category, error) {
	res, err := e.FetchNoRate(ctx, crawl.SimpleRequest{Method: "GET", URL: Base + "/"}, false)
	if err != nil {
		return nil, err
	}
	seen := map[string]bool{}
	var out []crawl.Category
	for _, m := range topCategoryRe.FindAllSubmatch(res.Body, -1) {
		slug, key := string(m[1]), string(m[2])
		if seen[key] {
			continue
		}
		seen[key] = true
		out = append(out, crawl.Category{ID: key, Slug: slug, Name: slug, Path: "/" + slug})
	}
	if len(out) == 0 {
		return nil, fmt.Errorf("no top-level /products/{slug}/k/{id} links found on homepage (%d bytes)", len(res.Body))
	}
	return out, nil
}

func (s *Store) ListItem(cat crawl.Category, page int) crawl.Item {
	return &listItem{s: s, cat: cat, page: page}
}

// DetailItem is a no-op: ALDI has no per-product detail endpoint. It stamps
// detail_fetched_at (via a COALESCE-only upsert) so -phase detail doesn't retry
// forever, without touching any already-stored field.
func (s *Store) DetailItem(id, _ string) crawl.Item { return &detailItem{id: id} }

// ---------- listing ----------

type searchProduct struct {
	SKU          string `json:"sku"`
	Name         string `json:"name"`
	BrandName    string `json:"brandName"`
	SellingSize  string `json:"sellingSize"`
	QuantityUnit string `json:"quantityUnit"`
	NotForSale   bool   `json:"notForSale"`
	Discontinued bool   `json:"discontinued"`
	URLSlugText  string `json:"urlSlugText"`
	Price        struct {
		Amount            crawl.FlexInt    `json:"amount"`     // cents
		Comparison        crawl.FlexInt    `json:"comparison"` // unit price, cents
		ComparisonDisplay string           `json:"comparisonDisplay"`
		WasPriceDisplay   crawl.FlexString `json:"wasPriceDisplay"`
		SavingsDisplay    crawl.FlexString `json:"savingsDisplay"`
	} `json:"price"`
	Categories []struct {
		ID          string `json:"id"`
		Name        string `json:"name"`
		URLSlugText string `json:"urlSlugText"`
	} `json:"categories"`
	Assets []struct {
		URL string `json:"url"`
	} `json:"assets"`
}

var priceDollarsRe = regexp.MustCompile(`[\d.]+`)

func parseDollarsToCents(s string) int64 {
	m := priceDollarsRe.FindString(s)
	if m == "" {
		return 0
	}
	f, _ := strconv.ParseFloat(m, 64)
	return crawl.Cents(f)
}

func (sp *searchProduct) toProduct(raw json.RawMessage) *crawl.Product {
	p := &crawl.Product{
		Store: "aldi", ID: sp.SKU, Name: sp.Name, Brand: sp.BrandName, Size: sp.SellingSize,
		PriceCents:     int64(sp.Price.Amount),
		UnitPriceCents: int64(sp.Price.Comparison),
		UnitPriceStr:   sp.Price.ComparisonDisplay,
		UnitMeasure:    sp.QuantityUnit,
		Available:      !sp.NotForSale,
		InStock:        !sp.NotForSale,
		Deprecated:     sp.Discontinued,
		ListingJSON:    raw,
	}
	p.WasCents = parseDollarsToCents(sp.Price.WasPriceDisplay.String())
	p.SaveCents = parseDollarsToCents(sp.Price.SavingsDisplay.String())
	if p.WasCents > 0 && p.WasCents <= p.PriceCents {
		p.WasCents = 0
	}
	if p.SaveCents == 0 && p.WasCents > p.PriceCents {
		p.SaveCents = p.WasCents - p.PriceCents
	}
	for _, a := range sp.Assets {
		if a.URL != "" {
			p.ImageURLs = append(p.ImageURLs, strings.ReplaceAll(a.URL, "{width}", "500"))
		}
	}
	if len(sp.Categories) > 0 {
		last := sp.Categories[len(sp.Categories)-1]
		p.Category = last.Name
		p.Dept = sp.Categories[0].Name
		names := make([]string, len(sp.Categories))
		for i, c := range sp.Categories {
			names[i] = c.Name
		}
		p.CategoryPath = strings.Join(names, " > ")
	}
	slug := sp.URLSlugText
	if slug == "" {
		slug = sp.SKU
	}
	p.URL = "/product/" + slug + "-" + sp.SKU
	return p
}

type listItem struct {
	s    *Store
	cat  crawl.Category
	page int
}

func (it *listItem) Kind() string { return "list" }

func (it *listItem) Do(ctx context.Context, e *crawl.Engine) error {
	offset := (it.page - 1) * PageSize
	url := fmt.Sprintf("%s/v3/product-search?currency=AUD&serviceType=%s&categoryKey=%s&limit=%d&offset=%d", API, ServiceType, it.cat.ID, PageSize, offset)
	res, err := e.Fetch(ctx, crawl.SimpleRequest{Method: "GET", URL: url, Headers: map[string]string{"Accept": "application/json", "Referer": Base + "/products/" + it.cat.Slug}}, true)
	if err != nil {
		return err
	}
	var page struct {
		Meta struct {
			Pagination struct {
				TotalCount int `json:"totalCount"`
			} `json:"pagination"`
		} `json:"meta"`
		Data []json.RawMessage `json:"data"`
	}
	if err := json.Unmarshal(res.Body, &page); err != nil {
		return &crawl.FetchError{Kind: crawl.KindBody, URL: url, Msg: err.Error()}
	}
	prods := make([]*crawl.Product, 0, len(page.Data))
	for _, raw := range page.Data {
		var sp searchProduct
		if err := json.Unmarshal(raw, &sp); err != nil || sp.SKU == "" {
			continue
		}
		prods = append(prods, sp.toProduct(raw))
	}
	newN := e.OnListingPage(it.cat, it.page, prods, nil)
	if it.page == 1 {
		e.EnqueuePages(it.cat, page.Meta.Pagination.TotalCount, PageSize)
	} else if len(prods) == 0 || newN < 0 {
		return nil // end of category
	}
	return nil
}

// ---------- detail (no-op) ----------
//
// ALDI has no per-product detail endpoint. DetailItem must exist to satisfy
// crawl.Store, but its Do is a true no-op: it must NOT call e.OnDetail, because
// that would upsert an empty Product and the detail-upsert SQL does not
// COALESCE every column (e.g. in_stock/available/is_market are always
// overwritten from the incoming row), which would clobber real listing data
// with zero values. main.go keeps DoDetail off for this store and skipping a
// -phase detail run, so in practice this is never invoked; it stays inert if
// it ever is.

type detailItem struct{ id string }

func (it *detailItem) Kind() string { return "detail" }

func (it *detailItem) Do(ctx context.Context, e *crawl.Engine) error { return nil }
