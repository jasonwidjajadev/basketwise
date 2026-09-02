package aldi

import "testing"

func TestParseDollarsToCents(t *testing.T) {
	cases := []struct {
		in   string
		want int64
	}{
		{"", 0},
		{"$6.50", 650},
		{"save $1.00", 100},
		{"$0.79", 79},
		{"$24.95 per 1 kg", 2495},
	}
	for _, c := range cases {
		if got := parseDollarsToCents(c.in); got != c.want {
			t.Errorf("parseDollarsToCents(%q) = %d, want %d", c.in, got, c.want)
		}
	}
}

func TestTopCategoryRe(t *testing.T) {
	html := []byte(`
		<a href="/products/baby/baby-food/k/1111111236">Baby Food</a>
		<a href="/products/baby/k/1030000000">Baby</a>
		<a href="/products/dairy-eggs-fridge/cheese/k/1111111163">Cheese</a>
		<a href="/products/dairy-eggs-fridge/k/960000000">Dairy, Eggs &amp; Fridge</a>
	`)
	got := topCategoryRe.FindAllSubmatch(html, -1)
	want := map[string]string{"baby": "1030000000", "dairy-eggs-fridge": "960000000"}
	if len(got) != len(want) {
		t.Fatalf("matched %d top-level categories, want %d (subcategories must not match): %v", len(got), len(want), got)
	}
	for _, m := range got {
		slug, key := string(m[1]), string(m[2])
		if want[slug] != key {
			t.Errorf("slug %q resolved to key %q, want %q", slug, key, want[slug])
		}
	}
}

func TestSearchProductToProduct(t *testing.T) {
	sp := searchProduct{
		SKU: "000000000000281811", Name: "Triple Cream Brie Cheese 200g", BrandName: "EMPORIUM SELECTION",
		SellingSize: "0.2 kg", QuantityUnit: "ea", URLSlugText: "emporium-selection-triple-cream-brie-cheese-200g",
	}
	sp.Price.Amount = 499
	sp.Price.Comparison = 2495
	sp.Price.ComparisonDisplay = "$24.95 per 1 kg"
	p := sp.toProduct(nil)
	if p.PriceCents != 499 || p.UnitPriceCents != 2495 || p.Brand != "EMPORIUM SELECTION" {
		t.Fatalf("unexpected mapping: %+v", p)
	}
	if p.URL != "/product/emporium-selection-triple-cream-brie-cheese-200g-000000000000281811" {
		t.Errorf("unexpected URL: %s", p.URL)
	}
}
