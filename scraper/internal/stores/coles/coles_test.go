package coles

import "testing"

func TestSlug(t *testing.T) {
	cases := []struct{ brand, name, size, id, want string }{
		{"Coles", "Free Range Eggs 12 Pack", "700g", "9453478", "coles-free-range-eggs-12-pack-700g-9453478"},
		{"Obento", "Panko Bread Crumbs", "200g", "2017230", "obento-panko-bread-crumbs-200g-2017230"},
		{"Heinz", "Crushed Tomatoes", "2.9kg", "1134862", "heinz-crushed-tomatoes-2.9kg-1134862"},
		{"Cottee's", "Maple Flavoured Syrup", "3L", "1139039", "cottee's-maple-flavoured-syrup-3l-1139039"},
		{"Blackmores", "Multivits+antioxidants", "180 Pack", "1335933", "blackmores-multivits+antioxidants-180-pack-1335933"},
	}
	for _, c := range cases {
		if got := Slug(c.brand, c.name, c.size, c.id); got != c.want {
			t.Errorf("Slug(%q,%q,%q)=%q want %q", c.brand, c.name, c.size, got, c.want)
		}
	}
}
