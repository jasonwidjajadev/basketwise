// Package harrisfarm crawls harrisfarm.com.au's public Shopify product feed.
//
// No API key, no cookies, no anti-bot. Everything (price, size, description,
// images, occasional barcode) is in the listing feed — there is no separate
// detail endpoint — so, like ALDI, this store only ever runs a listing crawl.
package harrisfarm

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"

	"basketwise/scraper/internal/crawl"
)

const (
	Base     = "https://www.harrisfarm.com.au"
	PageSize = 250 // Shopify's max products.json page size
)

// Store implements crawl.Store for Harris Farm Markets.
type Store struct{}

func New() *Store { return &Store{} }

func (s *Store) Name() string { return "harrisfarm" }

// Warmup is a no-op: the feed needs no session.
func (s *Store) Warmup(ctx context.Context, e *crawl.Engine) error { return nil }

func (s *Store) FlushBatches(e *crawl.Engine) {}

// Categories: Shopify's /products.json paginates the whole catalogue with no
// category filter and no total count, so there is exactly one synthetic
// "catalogue" category; ListItem walks pages until one comes back empty.
func (s *Store) Categories(ctx context.Context, e *crawl.Engine) ([]crawl.Category, error) {
	return []crawl.Category{{ID: "all", Name: "Catalogue", Path: "/", Slug: "all"}}, nil
}

func (s *Store) ListItem(cat crawl.Category, page int) crawl.Item {
	return &listItem{s: s, cat: cat, page: page}
}

// DetailItem is a no-op: see the package doc and aldi.detailItem for why this
// must never call e.OnDetail. main.go keeps the detail phase off for this store.
func (s *Store) DetailItem(id, _ string) crawl.Item { return &detailItem{id: id} }

// ---------- listing ----------

type variant struct {
	ID             int64            `json:"id"`
	SKU            string           `json:"sku"`
	Barcode        crawl.FlexString `json:"barcode"`
	Price          crawl.FlexString `json:"price"`
	CompareAtPrice crawl.FlexString `json:"compare_at_price"`
	Grams          crawl.FlexInt    `json:"grams"`
	Title          string           `json:"title"`
	Available      bool             `json:"available"`
}

type shopifyProduct struct {
	ID          int64     `json:"id"`
	Title       string    `json:"title"`
	Vendor      string    `json:"vendor"`
	ProductType string    `json:"product_type"`
	Handle      string    `json:"handle"`
	BodyHTML    string    `json:"body_html"`
	Variants    []variant `json:"variants"`
	Images      []struct {
		Src string `json:"src"`
	} `json:"images"`
}

func dollarsToCents(s string) int64 {
	f, err := strconv.ParseFloat(strings.TrimSpace(s), 64)
	if err != nil {
		return 0
	}
	return crawl.Cents(f)
}

func (sp *shopifyProduct) toProduct(raw json.RawMessage) *crawl.Product {
	id := strconv.FormatInt(sp.ID, 10)
	var v variant
	if len(sp.Variants) > 0 {
		v = sp.Variants[0]
		if v.SKU != "" {
			id = v.SKU
		}
	}
	p := &crawl.Product{
		Store: "harrisfarm", ID: id, Name: sp.Title, Brand: sp.Vendor, Description: stripHTML(sp.BodyHTML),
		PriceCents:   dollarsToCents(v.Price.String()),
		WasCents:     dollarsToCents(v.CompareAtPrice.String()),
		Available:    v.Available,
		InStock:      v.Available,
		Category:     sp.ProductType,
		CategoryPath: sp.ProductType,
		Barcode:      v.Barcode.String(),
		ListingJSON:  raw,
	}
	if p.WasCents > 0 && p.WasCents <= p.PriceCents {
		p.WasCents = 0
	}
	if p.WasCents > p.PriceCents {
		p.SaveCents = p.WasCents - p.PriceCents
	}
	if int(v.Grams) > 0 {
		p.Size = fmt.Sprintf("%dg", int(v.Grams))
	} else if v.Title != "" && v.Title != "Default Title" {
		p.Size = v.Title
	}
	for _, img := range sp.Images {
		if img.Src != "" {
			p.ImageURLs = append(p.ImageURLs, img.Src)
		}
	}
	p.URL = "/products/" + sp.Handle
	return p
}

// stripHTML does a minimal tag strip for the Shopify body_html description —
// good enough for a plain-text description field, not full HTML sanitisation.
func stripHTML(s string) string {
	var b strings.Builder
	inTag := false
	for _, r := range s {
		switch {
		case r == '<':
			inTag = true
		case r == '>':
			inTag = false
		case !inTag:
			b.WriteRune(r)
		}
	}
	return strings.TrimSpace(strings.Join(strings.Fields(b.String()), " "))
}

type listItem struct {
	s    *Store
	cat  crawl.Category
	page int
}

func (it *listItem) Kind() string { return "list" }

func (it *listItem) Do(ctx context.Context, e *crawl.Engine) error {
	url := fmt.Sprintf("%s/products.json?limit=%d&page=%d", Base, PageSize, it.page)
	res, err := e.Fetch(ctx, crawl.SimpleRequest{Method: "GET", URL: url, Headers: map[string]string{"Accept": "application/json"}}, true)
	if err != nil {
		return err
	}
	var page struct {
		Products []json.RawMessage `json:"products"`
	}
	if err := json.Unmarshal(res.Body, &page); err != nil {
		return &crawl.FetchError{Kind: crawl.KindBody, URL: url, Msg: err.Error()}
	}
	prods := make([]*crawl.Product, 0, len(page.Products))
	for _, raw := range page.Products {
		var sp shopifyProduct
		if err := json.Unmarshal(raw, &sp); err != nil || sp.ID == 0 {
			continue
		}
		prods = append(prods, sp.toProduct(raw))
	}
	newN := e.OnListingPage(it.cat, it.page, prods, nil)
	if len(prods) == 0 || newN < 0 {
		e.Sink.Category(&it.cat, true) // end of catalogue: no more pages
		return nil
	}
	// Shopify gives no total count, so keep walking one page at a time.
	if e.MaxPages == 0 || it.page < e.MaxPages {
		e.Enqueue(it.s.ListItem(it.cat, it.page+1))
	} else {
		e.Sink.Category(&it.cat, true) // hit -max-pages cap for this test run
	}
	return nil
}

// ---------- detail (no-op) ----------

type detailItem struct{ id string }

func (it *detailItem) Kind() string { return "detail" }

func (it *detailItem) Do(ctx context.Context, e *crawl.Engine) error { return nil }
