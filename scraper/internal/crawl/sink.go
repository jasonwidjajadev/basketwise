package crawl

import (
	"context"
	"database/sql"
	_ "embed"
	"fmt"
	"log/slog"
	"strings"
	"sync"
	"time"

	"github.com/klauspost/compress/zstd"
	_ "github.com/mattn/go-sqlite3"
)

//go:embed schema.sql
var schemaSQL string

// Sink is the single-writer SQLite persistence layer with batched transactions
// and zstd-compressed raw JSON.
type Sink struct {
	DB    *sql.DB
	store string
	ch    chan sinkOp
	wg    sync.WaitGroup
	enc   *zstd.Encoder
	dec   *zstd.Decoder
	batch int
	Errs  chan error
}

type sinkOp struct {
	p       *Product
	kind    byte // 'l' listing, 'd' detail, 'p' price, 'x' deprecated, 'c' category, 't' touch(last_seen)
	price   [2]int64
	cat     *Category
	catDone bool
	flush   chan struct{}
}

func OpenSink(path, store string, batch int) (*Sink, error) {
	db, err := sql.Open("sqlite3", path+"?_journal_mode=WAL&_synchronous=NORMAL&_busy_timeout=10000")
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(4)
	for _, stmt := range strings.Split(schemaSQL, ";") {
		if strings.TrimSpace(stmt) == "" {
			continue
		}
		if _, err := db.Exec(stmt); err != nil {
			return nil, fmt.Errorf("schema: %w: %s", err, stmt)
		}
	}
	enc, _ := zstd.NewWriter(nil, zstd.WithEncoderLevel(zstd.SpeedDefault), zstd.WithEncoderConcurrency(1))
	dec, _ := zstd.NewReader(nil, zstd.WithDecoderConcurrency(1))
	s := &Sink{DB: db, store: store, ch: make(chan sinkOp, 8192), enc: enc, dec: dec, batch: batch, Errs: make(chan error, 8)}
	s.wg.Add(1)
	go s.loop()
	return s, nil
}

func (s *Sink) Compress(b []byte) []byte {
	if len(b) == 0 {
		return nil
	}
	return s.enc.EncodeAll(b, make([]byte, 0, len(b)/4))
}

func (s *Sink) Decompress(b []byte) ([]byte, error) {
	if len(b) == 0 {
		return nil, nil
	}
	return s.dec.DecodeAll(b, nil)
}

func (s *Sink) UpsertListing(p *Product) { s.ch <- sinkOp{kind: 'l', p: p} }
func (s *Sink) UpsertDetail(p *Product)  { s.ch <- sinkOp{kind: 'd', p: p} }
func (s *Sink) Touch(p *Product)         { s.ch <- sinkOp{kind: 't', p: p} }
func (s *Sink) Price(p *Product) {
	s.ch <- sinkOp{kind: 'p', p: p, price: [2]int64{p.PriceCents, p.WasCents}}
}
func (s *Sink) Deprecate(id string) { s.ch <- sinkOp{kind: 'x', p: &Product{ID: id}} }
func (s *Sink) Category(c *Category, done bool) {
	s.ch <- sinkOp{kind: 'c', cat: c, catDone: done}
}

// Flush blocks until everything queued so far is committed.
func (s *Sink) Flush() {
	f := make(chan struct{})
	s.ch <- sinkOp{flush: f}
	<-f
}

func (s *Sink) Close() error {
	close(s.ch)
	s.wg.Wait()
	s.enc.Close()
	s.dec.Close()
	return s.DB.Close()
}

const upsertListingSQL = `INSERT INTO products (store, product_id, name, brand, size, description, price_cents, was_price_cents, save_cents,
 unit_price_cents, unit_measure, unit_price_str, in_stock, available, is_weighted, is_market, retail_limit, promo_limit, barcode,
 dept, category, aisle, category_path, image_urls, nutrition, url, listing_json, content_hash, first_seen, last_seen, deprecated)
 VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,NULLIF(?,''),?,?,?,?,NULLIF(?,''),NULLIF(?,''),?,?,?,?,?,0)
 ON CONFLICT(store, product_id) DO UPDATE SET
 name=excluded.name, brand=excluded.brand, size=excluded.size, description=excluded.description,
 price_cents=excluded.price_cents, was_price_cents=excluded.was_price_cents, save_cents=excluded.save_cents,
 unit_price_cents=excluded.unit_price_cents, unit_measure=excluded.unit_measure, unit_price_str=excluded.unit_price_str,
 in_stock=excluded.in_stock, available=excluded.available, is_weighted=excluded.is_weighted, is_market=excluded.is_market,
 retail_limit=excluded.retail_limit, promo_limit=excluded.promo_limit, barcode=COALESCE(excluded.barcode, products.barcode),
 dept=excluded.dept, category=excluded.category, aisle=excluded.aisle, category_path=excluded.category_path,
 image_urls=COALESCE(excluded.image_urls, products.image_urls), nutrition=COALESCE(products.nutrition, excluded.nutrition),
 url=COALESCE(excluded.url, products.url), listing_json=excluded.listing_json, content_hash=excluded.content_hash,
 last_seen=excluded.last_seen, deprecated=0`

const upsertDetailSQL = `INSERT INTO products (store, product_id, name, brand, size, description, long_description, price_cents, was_price_cents, save_cents,
 unit_price_cents, unit_measure, unit_price_str, in_stock, available, is_weighted, is_market, retail_limit, promo_limit, barcode,
 dept, category, aisle, category_path, image_urls, ingredients, allergens, allergens_may, dietary, nutrition, country_of_origin,
 health_star, rating_avg, rating_count, url, detail_json, first_seen, last_seen, detail_fetched_at, deprecated)
 VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,NULLIF(?,''),?,?,?,?,NULLIF(?,''),NULLIF(?,''),NULLIF(?,''),NULLIF(?,''),NULLIF(?,''),NULLIF(?,''),NULLIF(?,''),?,?,?,NULLIF(?,''),?,?,?,?,0)
 ON CONFLICT(store, product_id) DO UPDATE SET
 name=COALESCE(NULLIF(excluded.name,''), products.name), brand=COALESCE(NULLIF(excluded.brand,''), products.brand),
 size=COALESCE(NULLIF(excluded.size,''), products.size), description=COALESCE(NULLIF(excluded.description,''), products.description),
 long_description=excluded.long_description,
 price_cents=CASE WHEN excluded.price_cents>0 THEN excluded.price_cents ELSE products.price_cents END,
 was_price_cents=CASE WHEN excluded.price_cents>0 THEN excluded.was_price_cents ELSE products.was_price_cents END,
 save_cents=CASE WHEN excluded.price_cents>0 THEN excluded.save_cents ELSE products.save_cents END,
 unit_price_cents=CASE WHEN excluded.unit_price_cents>0 THEN excluded.unit_price_cents ELSE products.unit_price_cents END,
 unit_measure=COALESCE(NULLIF(excluded.unit_measure,''), products.unit_measure), unit_price_str=COALESCE(NULLIF(excluded.unit_price_str,''), products.unit_price_str),
 in_stock=excluded.in_stock, available=excluded.available, is_market=excluded.is_market,
 retail_limit=CASE WHEN excluded.retail_limit>0 THEN excluded.retail_limit ELSE products.retail_limit END,
 promo_limit=CASE WHEN excluded.promo_limit>0 THEN excluded.promo_limit ELSE products.promo_limit END,
 barcode=COALESCE(excluded.barcode, products.barcode),
 dept=COALESCE(NULLIF(excluded.dept,''), products.dept), category=COALESCE(NULLIF(excluded.category,''), products.category),
 aisle=COALESCE(NULLIF(excluded.aisle,''), products.aisle), category_path=COALESCE(NULLIF(excluded.category_path,''), products.category_path),
 image_urls=COALESCE(excluded.image_urls, products.image_urls), ingredients=excluded.ingredients, allergens=excluded.allergens,
 allergens_may=excluded.allergens_may, dietary=excluded.dietary, nutrition=COALESCE(excluded.nutrition, products.nutrition),
 country_of_origin=excluded.country_of_origin, health_star=CASE WHEN excluded.health_star>0 THEN excluded.health_star ELSE products.health_star END,
 rating_avg=CASE WHEN excluded.rating_avg>0 THEN excluded.rating_avg ELSE products.rating_avg END,
 rating_count=CASE WHEN excluded.rating_count>0 THEN excluded.rating_count ELSE products.rating_count END,
 url=COALESCE(excluded.url, products.url), detail_json=excluded.detail_json, last_seen=excluded.last_seen,
 detail_fetched_at=excluded.detail_fetched_at, deprecated=0`

func b2i(b bool) int {
	if b {
		return 1
	}
	return 0
}

func (s *Sink) loop() {
	defer s.wg.Done()
	var tx *sql.Tx
	var stL, stD, stP, stX, stC, stT, stR *sql.Stmt
	n := 0
	begin := func() error {
		var err error
		tx, err = s.DB.Begin()
		if err != nil {
			return err
		}
		stL, _ = tx.Prepare(upsertListingSQL)
		stD, _ = tx.Prepare(upsertDetailSQL)
		stP, _ = tx.Prepare(`INSERT OR IGNORE INTO price_history (store, product_id, ts, price_cents, was_price_cents) VALUES (?,?,?,?,?)`)
		stX, _ = tx.Prepare(`UPDATE products SET deprecated=1 WHERE store=? AND product_id=?`)
		stC, _ = tx.Prepare(`INSERT INTO categories (store,node_id,path,name,total,pages,done,updated) VALUES (?,?,?,?,?,?,?,?)
			ON CONFLICT(store,node_id) DO UPDATE SET total=excluded.total,pages=excluded.pages,done=excluded.done,updated=excluded.updated`)
		stT, _ = tx.Prepare(`UPDATE products SET last_seen=? WHERE store=? AND product_id=?`)
		stR, _ = tx.Prepare(`UPDATE products SET rating_avg=?, rating_count=? WHERE store=? AND product_id=?`)
		return nil
	}
	commit := func() {
		if tx == nil {
			return
		}
		for _, st := range []*sql.Stmt{stL, stD, stP, stX, stC, stT, stR} {
			if st != nil {
				st.Close()
			}
		}
		if err := tx.Commit(); err != nil {
			slog.Error("sink commit", "err", err)
			select {
			case s.Errs <- err:
			default:
			}
		}
		tx = nil
		n = 0
	}
	defer commit()
	timer := time.NewTicker(500 * time.Millisecond)
	defer timer.Stop()
	for {
		select {
		case op, ok := <-s.ch:
			if !ok {
				return
			}
			if op.flush != nil {
				commit()
				close(op.flush)
				continue
			}
			if tx == nil {
				if err := begin(); err != nil {
					slog.Error("sink begin", "err", err)
					continue
				}
			}
			now := time.Now().UTC().Format(time.RFC3339)
			var err error
			p := op.p
			switch op.kind {
			case 'l':
				_, err = stL.Exec(s.store, p.ID, p.Name, p.Brand, p.Size, p.Description, p.PriceCents, p.WasCents, p.SaveCents,
					p.UnitPriceCents, p.UnitMeasure, p.UnitPriceStr, b2i(p.InStock), b2i(p.Available), b2i(p.IsWeighted), b2i(p.IsMarket),
					p.RetailLimit, p.PromoLimit, p.Barcode, p.Dept, p.Category, p.Aisle, p.CategoryPath, p.imageJSON(), p.nutritionJSON(), p.URL,
					s.Compress(p.ListingJSON), int64(p.ContentHash()), now, now)
			case 'd':
				_, err = stD.Exec(s.store, p.ID, p.Name, p.Brand, p.Size, p.Description, p.LongDescription, p.PriceCents, p.WasCents, p.SaveCents,
					p.UnitPriceCents, p.UnitMeasure, p.UnitPriceStr, b2i(p.InStock), b2i(p.Available), b2i(p.IsWeighted), b2i(p.IsMarket),
					p.RetailLimit, p.PromoLimit, p.Barcode, p.Dept, p.Category, p.Aisle, p.CategoryPath, p.imageJSON(),
					p.Ingredients, p.Allergens, p.AllergensMay, p.Dietary, p.nutritionJSON(), p.CountryOfOrigin,
					p.HealthStar, p.RatingAvg, p.RatingCount, p.URL, s.Compress(p.DetailJSON), now, now, now)
			case 'p':
				_, err = stP.Exec(s.store, p.ID, now, op.price[0], op.price[1])
			case 'x':
				_, err = stX.Exec(s.store, p.ID)
			case 't':
				_, err = stT.Exec(now, s.store, p.ID)
			case 'r':
				_, err = stR.Exec(p.RatingAvg, p.RatingCount, s.store, p.ID)
			case 'c':
				c := op.cat
				_, err = stC.Exec(s.store, c.ID, c.Path, c.Name, c.Total, 0, b2i(op.catDone), now)
			}
			if err != nil {
				slog.Error("sink exec", "kind", string(op.kind), "err", err)
			}
			n++
			if n >= s.batch {
				commit()
			}
		case <-timer.C:
			if n > 0 {
				commit()
			}
		}
	}
}

// DetailSeed is a product that needs its detail fetched, with the slug already
// known from a prior listing (empty when unknown).
type DetailSeed struct {
	ID   string
	Slug string // for Coles, the /product/<slug> path component; ignored elsewhere
}

// LoadExisting preloads dedupe state and returns products lacking fresh detail.
func (s *Sink) LoadExisting(ctx context.Context, d *Dedupe, maxAge time.Duration) (needDetail []DetailSeed, err error) {
	rows, err := s.DB.QueryContext(ctx, `SELECT product_id, COALESCE(content_hash,0), COALESCE(price_cents,0), COALESCE(was_price_cents,0), COALESCE(detail_fetched_at,''), COALESCE(url,''), deprecated FROM products WHERE store=?`, s.store)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	cutoff := time.Now().Add(-maxAge).UTC().Format(time.RFC3339)
	for rows.Next() {
		var id, fetched, url string
		var h, price, was int64
		var dep int
		if err := rows.Scan(&id, &h, &price, &was, &fetched, &url, &dep); err != nil {
			return nil, err
		}
		d.Preload(id, uint64(h), uint64(price)*1_000_003+uint64(was)+1)
		if dep == 0 && (fetched == "" || fetched < cutoff) {
			slug := ""
			if i := strings.LastIndex(url, "/product/"); i >= 0 {
				slug = url[i+len("/product/"):]
			}
			needDetail = append(needDetail, DetailSeed{ID: id, Slug: slug})
		}
	}
	return needDetail, rows.Err()
}

// RecordRun writes a crawl_runs row.
func (s *Sink) RecordRun(store, phase string, started time.Time, st *Stats, c *Client, ctrl *Controller) {
	cs := ctrl.Snapshot()
	_, err := s.DB.Exec(`INSERT INTO crawl_runs (store,phase,started,finished,listed,detailed,dupes,unchanged,errors,backoffs,peak_rate,bytes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
		store, phase, started.UTC().Format(time.RFC3339), time.Now().UTC().Format(time.RFC3339), st.Unique.Load(), st.Details.Load(), st.Dupes.Load(), st.Unchanged.Load(), st.Errors.Load(), cs.Backoffs, cs.Best, c.BytesWire.Load())
	if err != nil {
		slog.Error("record run", "err", err)
	}
}

// LastPeakRate returns the best rate of the most recent run (0 if none).
func (s *Sink) LastPeakRate() float64 {
	var r sql.NullFloat64
	_ = s.DB.QueryRow(`SELECT peak_rate FROM crawl_runs WHERE store=? AND peak_rate>0 ORDER BY id DESC LIMIT 1`, s.store).Scan(&r)
	return r.Float64
}

// LoadExistingHashesOnly preloads content/price hashes without marking ids as seen,
// so a fresh listing crawl counts unique/dupes from scratch but still detects "unchanged".
func (s *Sink) LoadExistingHashesOnly(ctx context.Context, d *Dedupe) (int, error) {
	rows, err := s.DB.QueryContext(ctx, `SELECT product_id, COALESCE(content_hash,0), COALESCE(price_cents,0), COALESCE(was_price_cents,0) FROM products WHERE store=?`, s.store)
	if err != nil {
		return 0, err
	}
	defer rows.Close()
	n := 0
	for rows.Next() {
		var id string
		var h, price, was int64
		if err := rows.Scan(&id, &h, &price, &was); err != nil {
			return n, err
		}
		d.mu.Lock()
		if h != 0 {
			d.content[id] = uint64(h)
		}
		d.price[id] = uint64(price)*1_000_003 + uint64(was) + 1
		d.mu.Unlock()
		n++
	}
	return n, rows.Err()
}

// Rating updates the rating columns of a product.
func (s *Sink) Rating(id string, avg float64, count int) {
	s.ch <- sinkOp{kind: 'r', p: &Product{ID: id, RatingAvg: avg, RatingCount: count}}
}
