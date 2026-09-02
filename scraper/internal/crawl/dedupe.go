package crawl

import (
	"sync"

	"github.com/cespare/xxhash/v2"
)

// Dedupe tracks seen product IDs (bitset for numeric IDs, map fallback),
// per-product content hashes and price hashes.
type Dedupe struct {
	mu      sync.Mutex
	bits    []uint64
	other   map[string]struct{}
	content map[string]uint64
	price   map[string]uint64
	pageSig map[string]struct{}
}

func NewDedupe() *Dedupe {
	return &Dedupe{bits: make([]uint64, 1<<18), other: map[string]struct{}{}, content: map[string]uint64{}, price: map[string]uint64{}, pageSig: map[string]struct{}{}}
}

func numericID(id string) (uint64, bool) {
	if id == "" || len(id) > 9 {
		return 0, false
	}
	var n uint64
	for i := 0; i < len(id); i++ {
		c := id[i]
		if c < '0' || c > '9' {
			return 0, false
		}
		n = n*10 + uint64(c-'0')
	}
	return n, true
}

// Seen marks id as seen and reports whether it was already seen.
func (d *Dedupe) Seen(id string) bool {
	d.mu.Lock()
	defer d.mu.Unlock()
	return d.seenLocked(id)
}

func (d *Dedupe) seenLocked(id string) bool {
	if n, ok := numericID(id); ok {
		w, b := n/64, n%64
		for w >= uint64(len(d.bits)) {
			d.bits = append(d.bits, make([]uint64, len(d.bits))...)
		}
		was := d.bits[w]&(1<<b) != 0
		d.bits[w] |= 1 << b
		return was
	}
	_, was := d.other[id]
	d.other[id] = struct{}{}
	return was
}

// Preload marks ids as seen without counting (used for -phase detail from DB).
func (d *Dedupe) Preload(id string, contentHash, priceHash uint64) {
	d.mu.Lock()
	d.seenLocked(id)
	if contentHash != 0 {
		d.content[id] = contentHash
	}
	if priceHash != 0 {
		d.price[id] = priceHash
	}
	d.mu.Unlock()
}

// Changed reports whether the content hash differs from the stored one and records it.
func (d *Dedupe) Changed(id string, h uint64) bool {
	d.mu.Lock()
	defer d.mu.Unlock()
	if old, ok := d.content[id]; ok && old == h {
		return false
	}
	d.content[id] = h
	return true
}

// PriceChanged reports whether (price,was) differs from the last recorded pair.
func (d *Dedupe) PriceChanged(id string, price, was int64) bool {
	h := uint64(price)*1_000_003 + uint64(was) + 1
	d.mu.Lock()
	defer d.mu.Unlock()
	if old, ok := d.price[id]; ok && old == h {
		return false
	}
	d.price[id] = h
	return true
}

// PageRepeated detects a listing page whose ID set was already seen for this category
// (Woolworths returns a fixed garbage page past its pagination cap).
func (d *Dedupe) PageRepeated(cat string, ids []string) bool {
	h := xxhash.New()
	h.WriteString(cat)
	for _, id := range ids {
		h.WriteString(id)
		h.WriteString("|")
	}
	key := cat + ":" + string(h.Sum(nil))
	d.mu.Lock()
	defer d.mu.Unlock()
	if _, ok := d.pageSig[key]; ok {
		return true
	}
	d.pageSig[key] = struct{}{}
	return false
}

// HashFields hashes a set of strings (content hash helper).
func HashFields(parts ...string) uint64 {
	h := xxhash.New()
	for _, p := range parts {
		h.WriteString(p)
		h.Write([]byte{0})
	}
	return h.Sum64()
}
