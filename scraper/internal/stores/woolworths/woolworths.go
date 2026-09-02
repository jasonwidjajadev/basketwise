// Package woolworths crawls www.woolworths.com.au via its UI JSON APIs.
package woolworths

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"sync"

	"basketwise/scraper/internal/crawl"
)

const (
	Base          = "https://www.woolworths.com.au"
	PageSize      = 36
	MegaThreshold = 9000 // categories bigger than this are crawled via their leaves
	MegaLeafPages = 100  // a leaf that is itself "mega" is paged only this far (marketplace long tail)
	RatingBatch   = 50
)

// Store implements crawl.Store for Woolworths.
type Store struct {
	nodes     map[string]*node // nodeId -> node
	dead      sync.Map
	ratingMu  sync.Mutex
	ratingQ   []string
	NoRatings bool
}

func New() *Store { return &Store{nodes: map[string]*node{}} }

func (s *Store) Name() string { return "woolworths" }

type node struct {
	NodeID       string  `json:"NodeId"`
	Description  string  `json:"Description"`
	URLName      string  `json:"UrlFriendlyName"`
	ProductCount int     `json:"ProductCount"`
	Children     []*node `json:"Children"`
	path         string
}

func (s *Store) Warmup(ctx context.Context, e *crawl.Engine) error {
	_, err := e.Fetch(ctx, crawl.SimpleRequest{Method: "GET", URL: Base + "/shop/browse/fruit-veg"}, false)
	return err
}

func (s *Store) jsonHeaders(referer string) map[string]string {
	return map[string]string{"Accept": "application/json, text/plain, */*", "Content-Type": "application/json", "Referer": Base + referer}
}

func (s *Store) Categories(ctx context.Context, e *crawl.Engine) ([]crawl.Category, error) {
	res, err := e.Fetch(ctx, crawl.SimpleRequest{Method: "GET", URL: Base + "/apis/ui/PiesCategoriesWithSpecials", Headers: s.jsonHeaders("/shop/browse/fruit-veg")}, true)
	if err != nil {
		return nil, err
	}
	var tree struct {
		Categories []*node `json:"Categories"`
	}
	if err := json.Unmarshal(res.Body, &tree); err != nil {
		return nil, err
	}
	var out []crawl.Category
	var walk func(n *node, path string)
	walk = func(n *node, path string) {
		n.path = path + "/" + n.URLName
		s.nodes[n.NodeID] = n
		for _, c := range n.Children {
			walk(c, n.path)
		}
	}
	for _, n := range tree.Categories {
		if n.NodeID == "specialsgroup" || strings.HasPrefix(n.NodeID, "specials") {
			continue
		}
		walk(n, "")
		out = append(out, crawl.Category{ID: n.NodeID, Name: n.Description, Path: n.path, Slug: n.URLName, Total: n.ProductCount})
	}
	return out, nil
}

func (s *Store) leaves(id string) []crawl.Category {
	n, ok := s.nodes[id]
	if !ok {
		return nil
	}
	var out []crawl.Category
	var walk func(n *node)
	walk = func(n *node) {
		if len(n.Children) == 0 {
			out = append(out, crawl.Category{ID: n.NodeID, Name: n.Description, Path: n.path, Slug: n.URLName, Total: n.ProductCount})
			return
		}
		for _, c := range n.Children {
			walk(c)
		}
	}
	walk(n)
	return out
}

func (s *Store) ListItem(cat crawl.Category, page int) crawl.Item {
	return &listItem{s: s, cat: cat, page: page}
}
func (s *Store) DetailItem(id, _ string) crawl.Item { return &detailItem{s: s, id: id} }

func (s *Store) FlushBatches(e *crawl.Engine) {
	if s.NoRatings {
		return
	}
	s.ratingMu.Lock()
	ids := s.ratingQ
	s.ratingQ = nil
	s.ratingMu.Unlock()
	for len(ids) > 0 {
		n := RatingBatch
		if len(ids) < n {
			n = len(ids)
		}
		e.Enqueue(&ratingItem{s: s, ids: ids[:n]})
		ids = ids[n:]
	}
}

func (s *Store) queueRating(e *crawl.Engine, id string) {
	if s.NoRatings {
		return
	}
	s.ratingMu.Lock()
	s.ratingQ = append(s.ratingQ, id)
	var batch []string
	if len(s.ratingQ) >= RatingBatch {
		batch = s.ratingQ
		s.ratingQ = nil
	}
	s.ratingMu.Unlock()
	if batch != nil {
		e.Enqueue(&ratingItem{s: s, ids: batch})
	}
}

// ---------- product JSON ----------

type attrs struct {
	Ingredients      crawl.FlexString `json:"ingredients"`
	AllergenContains crawl.FlexString `json:"allergencontains"`
	AllergenMaybe    crawl.FlexString `json:"allergenmaybepresent"`
	Lifestyle        crawl.FlexString `json:"lifestyleanddietarystatement"`
	HealthStar       crawl.FlexString `json:"healthstarrating"`
	CountryOfOrigin  crawl.FlexString `json:"countryoforigin"`
	PiesDept         crawl.FlexString `json:"piesdepartmentnamesjson"`
	PiesCat          crawl.FlexString `json:"piescategorynamesjson"`
	PiesSub          crawl.FlexString `json:"piessubcategorynamesjson"`
	SapDept          crawl.FlexString `json:"sapdepartmentname"`
	SapCat           crawl.FlexString `json:"sapcategoryname"`
	SapSub           crawl.FlexString `json:"sapsubcategoryname"`
	Description      crawl.FlexString `json:"description"`
}

type product struct {
	Stockcode         int64            `json:"Stockcode"`
	Barcode           crawl.FlexString `json:"Barcode"`
	Name              string           `json:"Name"`
	DisplayName       string           `json:"DisplayName"`
	Brand             crawl.FlexString `json:"Brand"`
	Description       crawl.FlexString `json:"Description"`
	FullDescription   crawl.FlexString `json:"FullDescription"`
	Price             crawl.FlexFloat  `json:"Price"`
	WasPrice          crawl.FlexFloat  `json:"WasPrice"`
	SavingsAmount     crawl.FlexFloat  `json:"SavingsAmount"`
	CupPrice          crawl.FlexFloat  `json:"CupPrice"`
	CupMeasure        crawl.FlexString `json:"CupMeasure"`
	CupString         crawl.FlexString `json:"CupString"`
	PackageSize       crawl.FlexString `json:"PackageSize"`
	Unit              crawl.FlexString `json:"Unit"`
	UnitWeightInGrams crawl.FlexFloat  `json:"UnitWeightInGrams"`
	IsInStock         bool             `json:"IsInStock"`
	IsAvailable       bool             `json:"IsAvailable"`
	IsMarketProduct   bool             `json:"IsMarketProduct"`
	ProductLimit      crawl.FlexInt    `json:"ProductLimit"`
	SupplyLimit       crawl.FlexInt    `json:"SupplyLimit"`
	LargeImageFile    crawl.FlexString `json:"LargeImageFile"`
	URLFriendlyName   crawl.FlexString `json:"UrlFriendlyName"`
	Attrs             *attrs           `json:"AdditionalAttributes"`
	DetailsImagePaths []string         `json:"DetailsImagePaths"`
}

func (wp *product) toProduct(raw json.RawMessage) *crawl.Product {
	id := strconv.FormatInt(wp.Stockcode, 10)
	name := wp.DisplayName
	if name == "" {
		name = wp.Name
	}
	p := &crawl.Product{Store: "woolworths", ID: id, Name: name, Brand: wp.Brand.String(), Size: wp.PackageSize.String(), Description: wp.Description.String(),
		PriceCents: crawl.Cents(float64(wp.Price)), WasCents: crawl.Cents(float64(wp.WasPrice)), SaveCents: crawl.Cents(float64(wp.SavingsAmount)),
		UnitPriceCents: crawl.Cents(float64(wp.CupPrice)), UnitMeasure: wp.CupMeasure.String(), UnitPriceStr: wp.CupString.String(),
		InStock: wp.IsInStock, Available: wp.IsAvailable, IsMarket: wp.IsMarketProduct, IsWeighted: strings.EqualFold(wp.Unit.String(), "kg"),
		RetailLimit: int(wp.ProductLimit), PromoLimit: int(wp.SupplyLimit), Barcode: wp.Barcode.String(), ListingJSON: raw}
	if p.WasCents == p.PriceCents {
		p.WasCents = 0
	}
	if p.SaveCents == 0 && p.WasCents > p.PriceCents {
		p.SaveCents = p.WasCents - p.PriceCents
	}
	if p.Barcode == "0" {
		p.Barcode = ""
	}
	if wp.LargeImageFile != "" {
		p.ImageURLs = []string{wp.LargeImageFile.String()}
	}
	if a := wp.Attrs; a != nil {
		p.Dept, p.Category, p.Aisle = crawl.FirstJSONString(a.PiesDept.String()), crawl.FirstJSONString(a.PiesCat.String()), crawl.FirstJSONString(a.PiesSub.String())
		if p.Dept == "" {
			p.Dept, p.Category, p.Aisle = a.SapDept.String(), a.SapCat.String(), a.SapSub.String()
		}
		p.CategoryPath = strings.Trim(p.Dept+" > "+p.Category+" > "+p.Aisle, " >")
		p.Ingredients, p.Allergens, p.AllergensMay, p.Dietary = a.Ingredients.String(), a.AllergenContains.String(), a.AllergenMaybe.String(), a.Lifestyle.String()
		p.HealthStar = a.HealthStar.Float()
		p.CountryOfOrigin = a.CountryOfOrigin.String()
		if p.Description == "" {
			p.Description = a.Description.String()
		}
	}
	p.URL = "/shop/productdetails/" + id + "/" + wp.URLFriendlyName.String()
	return p
}

// ---------- listing ----------

type listItem struct {
	s    *Store
	cat  crawl.Category
	page int
}

func (it *listItem) Kind() string { return "list" }

func (it *listItem) body() []byte {
	fo, _ := json.Marshal(map[string]string{"name": it.cat.Name})
	b, _ := json.Marshal(map[string]any{
		"categoryId": it.cat.ID, "pageNumber": it.page, "pageSize": PageSize, "sortType": "TraderRelevance",
		"url": "/shop/browse" + it.cat.Path, "location": "/shop/browse" + it.cat.Path, "formatObject": string(fo),
		"isSpecial": false, "isBundle": false, "isMobile": false, "filters": []any{}, "token": "", "gpBoost": 0,
		"isHideUnavailableProducts": false, "isRegisteredRewardCardPromotion": false, "enableAdReRanking": false,
		"groupEdmVariants": true, "categoryVersion": "v2",
	})
	return b
}

func (it *listItem) Do(ctx context.Context, e *crawl.Engine) error {
	if _, dead := it.s.dead.Load(it.cat.ID); dead {
		return nil
	}
	res, err := e.Fetch(ctx, crawl.SimpleRequest{Method: "POST", URL: Base + "/apis/ui/browse/category", Body: it.body(), Headers: it.s.jsonHeaders("/shop/browse" + it.cat.Path)}, true)
	if err != nil {
		return err
	}
	var page struct {
		Bundles []struct {
			Products []json.RawMessage `json:"Products"`
		} `json:"Bundles"`
		TotalRecordCount int  `json:"TotalRecordCount"`
		Success          bool `json:"Success"`
	}
	if err := json.Unmarshal(res.Body, &page); err != nil {
		return &crawl.FetchError{Kind: crawl.KindBody, URL: "/apis/ui/browse/category", Msg: err.Error()}
	}
	var prods []*crawl.Product
	for _, b := range page.Bundles {
		for _, raw := range b.Products {
			var wp product
			if err := json.Unmarshal(raw, &wp); err != nil || wp.Stockcode == 0 {
				continue
			}
			prods = append(prods, wp.toProduct(raw))
		}
	}
	newN := e.OnListingPage(it.cat, it.page, prods, nil)
	if it.page == 1 {
		if page.TotalRecordCount > MegaThreshold && len(it.s.leaves(it.cat.ID)) > 1 {
			// too big to page through: crawl leaves instead
			leaves := it.s.leaves(it.cat.ID)
			e.Log.Info("mega category → leaves", "cat", it.cat.Path, "total", page.TotalRecordCount, "leaves", len(leaves))
			for _, l := range leaves {
				if l.ID == it.cat.ID {
					continue
				}
				l := l
				e.Sink.Category(&l, false)
				e.Enqueue(it.s.ListItem(l, 1))
			}
			c := it.cat
			c.Total = page.TotalRecordCount
			e.Sink.Category(&c, true)
			return nil
		}
		total := page.TotalRecordCount
		if total > MegaThreshold {
			total = MegaLeafPages * PageSize
		}
		e.EnqueuePages(it.cat, total, PageSize)
	} else if len(prods) == 0 || newN < 0 {
		it.s.dead.Store(it.cat.ID, struct{}{})
	}
	return nil
}

// ---------- detail ----------

type detailItem struct {
	s  *Store
	id string
}

func (it *detailItem) Kind() string { return "detail" }

type detailPage struct {
	Product                *product `json:"Product"`
	NutritionalInformation []struct {
		Name            string            `json:"Name"`
		Values          map[string]string `json:"Values"`
		ServingSize     crawl.FlexString  `json:"ServingSize"`
		ServingsPerPack crawl.FlexString  `json:"ServingsPerPack"`
	} `json:"NutritionalInformation"`
	DetailsImagePaths []string `json:"DetailsImagePaths"`
	Tga               *struct {
		ProductWarnings     crawl.FlexString `json:"ProductWarnings"`
		Directions          crawl.FlexString `json:"Directions"`
		StorageInstructions crawl.FlexString `json:"StorageInstructions"`
	} `json:"TgaAttributes"`
	Cool *struct {
		CountryOfOrigin crawl.FlexString `json:"CountryOfOrigin"`
		AltText         crawl.FlexString `json:"AltText"`
	} `json:"CountryOfOriginLabel"`
	PrimaryCategory *struct {
		Department crawl.FlexString `json:"Department"`
		Aisle      crawl.FlexString `json:"Aisle"`
	} `json:"PrimaryCategory"`
}

func (it *detailItem) Do(ctx context.Context, e *crawl.Engine) error {
	u := fmt.Sprintf("%s/apis/ui/product/detail/%s?isMobile=false&useVariant=true", Base, it.id)
	res, err := e.Fetch(ctx, crawl.SimpleRequest{Method: "GET", URL: u, Headers: map[string]string{"Accept": "application/json", "Referer": Base + "/shop/productdetails/" + it.id}}, true)
	if err != nil {
		if fe, ok := err.(*crawl.FetchError); ok && fe.Status == 404 {
			e.OnDeprecated(it.id)
			return nil
		}
		return err
	}
	var dp detailPage
	if err := json.Unmarshal(res.Body, &dp); err != nil {
		return fmt.Errorf("detail decode %s: %w", it.id, err)
	}
	if dp.Product == nil || dp.Product.Stockcode == 0 {
		e.OnDeprecated(it.id)
		return nil
	}
	p := dp.Product.toProduct(nil)
	p.DetailJSON = res.Body
	p.HasDetail = true
	p.LongDescription = dp.Product.FullDescription.String()
	if len(dp.DetailsImagePaths) > 0 {
		p.ImageURLs = dp.DetailsImagePaths
	}
	if dp.Cool != nil && dp.Cool.AltText != "" {
		p.CountryOfOrigin = dp.Cool.AltText.String()
	} else if dp.Cool != nil && dp.Cool.CountryOfOrigin != "" {
		p.CountryOfOrigin = dp.Cool.CountryOfOrigin.String()
	}
	if dp.PrimaryCategory != nil && p.Dept == "" {
		p.Dept, p.Aisle = dp.PrimaryCategory.Department.String(), dp.PrimaryCategory.Aisle.String()
		p.CategoryPath = p.Dept + " > " + p.Aisle
	}
	if len(dp.NutritionalInformation) > 0 {
		nut := &crawl.Nutrition{ServingSize: dp.NutritionalInformation[0].ServingSize.String(), ServingsPerPack: dp.NutritionalInformation[0].ServingsPerPack.String()}
		for _, r := range dp.NutritionalInformation {
			row := crawl.NutrientRow{Name: strings.TrimSpace(r.Name)}
			for k, v := range r.Values {
				lk := strings.ToLower(k)
				switch {
				case strings.Contains(lk, "100"):
					row.Per100 = v
				case strings.Contains(lk, "serv"):
					row.PerServing = v
				}
			}
			nut.Rows = append(nut.Rows, row)
		}
		p.Nutrition = nut
	}
	e.OnDetail(p)
	it.s.queueRating(e, it.id)
	return nil
}

// ---------- ratings (GraphQL batch) ----------

type ratingItem struct {
	s   *Store
	ids []string
}

func (it *ratingItem) Kind() string { return "rating" }

func (it *ratingItem) Do(ctx context.Context, e *crawl.Engine) error {
	body, _ := json.Marshal(map[string]any{
		"query":     "query productTile($ids:[ID!]!){products(ids:$ids){id rating{average ratingCount}}}",
		"variables": map[string]any{"ids": it.ids},
	})
	res, err := e.Fetch(ctx, crawl.SimpleRequest{Method: "POST", URL: Base + "/graphql", Body: body, Headers: it.s.jsonHeaders("/shop/browse/fruit-veg")}, true)
	if err != nil {
		return err
	}
	var out struct {
		Data struct {
			Products []*struct {
				ID     crawl.FlexString `json:"id"`
				Rating *struct {
					Average     crawl.FlexFloat `json:"average"`
					RatingCount crawl.FlexInt   `json:"ratingCount"`
				} `json:"rating"`
			} `json:"products"`
		} `json:"data"`
	}
	if err := json.Unmarshal(res.Body, &out); err != nil {
		return &crawl.FetchError{Kind: crawl.KindBody, URL: "/graphql", Msg: err.Error()}
	}
	for i, pr := range out.Data.Products {
		if pr == nil || pr.Rating == nil || pr.Rating.RatingCount == 0 {
			continue
		}
		id := pr.ID.String()
		if id == "" && i < len(it.ids) {
			id = it.ids[i]
		}
		e.Sink.Rating(id, float64(pr.Rating.Average), int(pr.Rating.RatingCount))
	}
	return nil
}
