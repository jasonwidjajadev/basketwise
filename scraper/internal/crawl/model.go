package crawl

import (
	"encoding/json"
	"fmt"
	"strconv"
)

// NutrientRow is the normalised nutrition row shared by both stores.
type NutrientRow struct {
	Name       string `json:"name"`
	PerServing string `json:"per_serving,omitempty"`
	Per100     string `json:"per_100,omitempty"`
	DI         string `json:"di,omitempty"`
}

// Nutrition is the normalised nutrition panel.
type Nutrition struct {
	ServingSize     string        `json:"serving_size,omitempty"`
	ServingsPerPack string        `json:"servings_per_pack,omitempty"`
	Rows            []NutrientRow `json:"rows"`
}

// Product is the store-agnostic row written to SQLite.
type Product struct {
	Store, ID                                       string
	Name, Brand, Size, Description, LongDescription string
	PriceCents, WasCents, SaveCents, UnitPriceCents int64
	UnitMeasure, UnitPriceStr                       string
	InStock, Available, IsWeighted, IsMarket        bool
	RetailLimit, PromoLimit                         int
	Barcode, Dept, Category, Aisle, CategoryPath    string
	ImageURLs                                       []string
	Ingredients, Allergens, AllergensMay, Dietary   string
	Nutrition                                       *Nutrition
	CountryOfOrigin                                 string
	HealthStar, RatingAvg                           float64
	RatingCount                                     int
	URL                                             string
	ListingJSON, DetailJSON                         []byte // raw JSON (uncompressed)
	HasDetail                                       bool
	Deprecated                                      bool
}

// ContentHash covers the listing-visible fields that matter for "unchanged" detection.
func (p *Product) ContentHash() uint64 {
	return HashFields(p.Name, p.Brand, p.Size, strconv.FormatInt(p.PriceCents, 10), strconv.FormatInt(p.WasCents, 10),
		strconv.FormatBool(p.InStock), strconv.FormatBool(p.Available), p.UnitPriceStr, strconv.Itoa(p.RetailLimit), strconv.Itoa(p.PromoLimit))
}

func (p *Product) imageJSON() string {
	if len(p.ImageURLs) == 0 {
		return ""
	}
	b, _ := json.Marshal(p.ImageURLs)
	return string(b)
}

func (p *Product) nutritionJSON() string {
	if p.Nutrition == nil || len(p.Nutrition.Rows) == 0 {
		return ""
	}
	b, _ := json.Marshal(p.Nutrition)
	return string(b)
}

// Cents converts a float dollar amount to integer cents safely.
func Cents(f float64) int64 { return int64(f*100 + 0.5) }

// Category is a crawlable listing node.
type Category struct {
	ID    string // node id / seoToken
	Name  string
	Path  string // "/pantry/baking" style
	Slug  string // url slug
	Total int    // known product count, 0 if unknown
}

func (c Category) String() string { return fmt.Sprintf("%s(%s)", c.Path, c.ID) }
