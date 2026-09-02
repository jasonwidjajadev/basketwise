package harrisfarm

import "testing"

func TestDollarsToCents(t *testing.T) {
	cases := []struct {
		in   string
		want int64
	}{
		{"", 0},
		{"15.99", 1599},
		{"4.00", 400},
		{"not-a-number", 0},
	}
	for _, c := range cases {
		if got := dollarsToCents(c.in); got != c.want {
			t.Errorf("dollarsToCents(%q) = %d, want %d", c.in, got, c.want)
		}
	}
}

func TestShopifyProductToProduct(t *testing.T) {
	sp := shopifyProduct{ID: 7816211464251, Title: "Adelaide Hills Smoked Brie Cheese 200g", Vendor: "HFM", ProductType: "Frdg1-Cheese", Handle: "adelaide-hills-smoked-brie-cheese-200g"}
	sp.Variants = []variant{{SKU: "89978", Price: "15.99", Grams: 150, Available: true}}
	p := sp.toProduct(nil)
	if p.ID != "89978" || p.PriceCents != 1599 || p.Size != "150g" || p.Brand != "HFM" {
		t.Fatalf("unexpected mapping: %+v", p)
	}
	if p.URL != "/products/adelaide-hills-smoked-brie-cheese-200g" {
		t.Errorf("unexpected URL: %s", p.URL)
	}
}

func TestStripHTML(t *testing.T) {
	got := stripHTML("<p>Fresh <strong>cheese</strong>&nbsp;from the Adelaide Hills.</p>")
	want := "Fresh cheese&nbsp;from the Adelaide Hills."
	if got != want {
		t.Errorf("stripHTML() = %q, want %q", got, want)
	}
}
