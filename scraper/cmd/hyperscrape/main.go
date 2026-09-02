// hyperscrape: AIMD-rate-controlled full-catalogue crawler for Coles and Woolworths.
package main

import (
	"context"
	"database/sql"
	"errors"
	"flag"
	"fmt"
	"log/slog"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"basketwise/scraper/internal/crawl"
	"basketwise/scraper/internal/stores/aldi"
	"basketwise/scraper/internal/stores/coles"
	"basketwise/scraper/internal/stores/harrisfarm"
	"basketwise/scraper/internal/stores/woolworths"
)

// noDetail lists stores with no per-product detail endpoint (everything is in
// the listing already). Their DetailItem is a true no-op — see
// internal/stores/aldi/aldi.go for why it must stay that way — so the detail
// phase is skipped entirely for them rather than churned through for nothing.
var noDetail = map[string]bool{"aldi": true, "harrisfarm": true}

// defaultMaxRate is the per-store AIMD ceiling used when -max-rate is left at
// its zero value. Coles/Woolworths are capped by their anti-bot; ALDI/Harris
// Farm have none observed, but are still capped to be a polite crawler.
var defaultMaxRate = map[string]float64{"coles": 45, "woolworths": 18, "aldi": 25, "harrisfarm": 15}

func main() {
	var (
		store     = flag.String("store", "", "coles | woolworths | aldi | harrisfarm")
		dbPath    = flag.String("db", "", "sqlite path (default data/hyper_<store>.db)")
		phase     = flag.String("phase", "all", "list | detail | all")
		startRate = flag.String("start-rate", "0.1", "initial req/s, or 'auto' (25% of last run's peak)")
		maxRate   = flag.Float64("max-rate", 400, "ceiling req/s")
		pause     = flag.Duration("pause", 5*time.Second, "pause after an HTTP error")
		epoch     = flag.Duration("epoch", 2*time.Second, "AIMD decision interval")
		workers   = flag.Int("workers", 96, "worker goroutines")
		maxInfl   = flag.Int("max-inflight", 128, "max concurrent requests")
		maxPages  = flag.Int("max-pages", 0, "cap pages per category (testing)")
		seedDB    = flag.String("seed-db", "", "old go scraper db to seed detail ids from (coles.db / woolworths.db)")
		cookies   = flag.String("cookies", "", "Playwright cookies JSON to import")
		interval  = flag.Duration("stats-interval", 250*time.Millisecond, "stats emit interval")
		detailAge = flag.Duration("detail-max-age", 24*time.Hour, "re-fetch detail older than this")
		leaves    = flag.Bool("leaves", false, "coles: crawl leaf categories instead of top-level")
		noRatings = flag.Bool("no-ratings", false, "woolworths: skip graphql ratings")
		quiet     = flag.Bool("quiet", false, "no stderr logs")
	)
	flag.Parse()
	if *store == "" {
		fmt.Fprintln(os.Stderr, "usage: hyperscrape -store coles|woolworths|aldi|harrisfarm [-phase all]")
		os.Exit(1)
	}
	if *dbPath == "" {
		*dbPath = "data/hyper_" + *store + ".db"
	}
	_ = os.MkdirAll("data", 0o755)
	if *quiet {
		slog.SetDefault(slog.New(slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{Level: slog.LevelError})))
	} else {
		slog.SetDefault(slog.New(slog.NewTextHandler(os.Stderr, nil)))
	}

	var st crawl.Store
	switch *store {
	case "coles":
		s := coles.New()
		s.Leaves = *leaves
		st = s
	case "woolworths":
		s := woolworths.New()
		s.NoRatings = *noRatings
		st = s
	case "aldi":
		st = aldi.New()
	case "harrisfarm":
		st = harrisfarm.New()
	default:
		fmt.Fprintln(os.Stderr, "unknown store", *store)
		os.Exit(1)
	}

	if *maxRate <= 0 {
		*maxRate = defaultMaxRate[*store]
	}
	cfg := crawl.DefaultControllerConfig()
	cfg.MaxRate, cfg.Pause, cfg.Epoch, cfg.MaxInflight = *maxRate, *pause, *epoch, *maxInfl
	ctrl := crawl.NewController(cfg)
	client := crawl.NewClient(20 * time.Second)
	if *cookies != "" {
		n, err := client.LoadCookies(*cookies)
		if err != nil {
			slog.Error("cookies", "err", err)
			os.Exit(1)
		}
		slog.Info("loaded cookies", "n", n)
	}
	sink, err := crawl.OpenSink(*dbPath, *store, 500)
	if err != nil {
		slog.Error("open db", "err", err)
		os.Exit(1)
	}
	stats := crawl.NewStats(*store)
	emit := crawl.NewEmitter(os.Stdout)
	eng := crawl.NewEngine(st, client, ctrl, sink, stats, emit, *workers)
	eng.MaxPages = *maxPages
	eng.DoDetail = *phase == "all" && !noDetail[*store]
	eng.StartRate = cfg.StartRate

	if *phase == "detail" && noDetail[*store] {
		slog.Info("store has no per-product detail endpoint; nothing to do", "store", *store)
		_ = sink.Close()
		os.Exit(0)
	}

	if *startRate == "auto" {
		if r := sink.LastPeakRate(); r > 0 {
			eng.StartRate = r / 4
			slog.Info("auto start rate", "rate", r/4)
		}
	} else {
		var r float64
		fmt.Sscanf(*startRate, "%g", &r)
		if r > 0 {
			eng.StartRate = r
		}
	}
	ctrl.SetStartRate(eng.StartRate)

	ctx, cancel := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer cancel()

	// preload dedupe state; collect ids that need detail
	need, err := sink.LoadExisting(ctx, eng.Dedupe, *detailAge)
	if err != nil {
		slog.Error("load existing", "err", err)
		os.Exit(1)
	}
	var detailSeeds []crawl.DetailSeed
	if *phase == "detail" {
		detailSeeds = need
		if *seedDB != "" {
			seen := map[string]bool{}
			for _, s := range need {
				seen[s.ID] = true
			}
			for _, id := range loadSeedIDs(*seedDB, *store) {
				if !seen[id] && !eng.Dedupe.Seen(id) {
					detailSeeds = append(detailSeeds, crawl.DetailSeed{ID: id})
				}
			}
		}
		slog.Info("detail phase", "ids", len(detailSeeds))
	} else if *phase == "all" && *seedDB != "" {
		for _, id := range loadSeedIDs(*seedDB, *store) {
			if !eng.Dedupe.Seen(id) {
				detailSeeds = append(detailSeeds, crawl.DetailSeed{ID: id})
			}
		}
	}
	if *phase == "all" || *phase == "list" {
		// fresh list crawl: reset dedupe "seen" so listing re-counts unique; keep hashes
		eng.Dedupe = crawl.NewDedupe()
		_, _ = sink.LoadExistingHashesOnly(ctx, eng.Dedupe)
	}

	// stats emitter
	go func() {
		t := time.NewTicker(*interval)
		defer t.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-t.C:
				emit.Emit(stats.Snapshot(client, ctrl))
			}
		}
	}()

	started := time.Now()
	runErr := eng.Run(ctx, *phase != "detail", detailSeeds)
	emit.Emit(stats.Snapshot(client, ctrl))
	sink.RecordRun(*store, *phase, started, stats, client, ctrl)
	if err := sink.Close(); err != nil {
		slog.Error("close db", "err", err)
	}
	switch {
	case runErr == nil:
		emit.Event(*store, "done", fmt.Sprintf("unique=%d details=%d dupes=%d errors=%d elapsed=%s", stats.Unique.Load(), stats.Details.Load(), stats.Dupes.Load(), stats.Errors.Load(), time.Since(started).Round(time.Second)))
	case errors.Is(runErr, crawl.ErrBlocked):
		emit.Event(*store, "blocked", runErr.Error())
		os.Exit(2)
	default:
		emit.Event(*store, "error", runErr.Error())
		os.Exit(1)
	}
}

// loadSeedIDs reads product ids from the old go scraper sqlite (prefixes coles_id_/woolworths_sku_).
func loadSeedIDs(path, store string) []string {
	db, err := sql.Open("sqlite3", "file:"+path+"?mode=ro")
	if err != nil {
		slog.Warn("seed db", "err", err)
		return nil
	}
	defer db.Close()
	rows, err := db.Query(`SELECT productID FROM products`)
	if err != nil {
		slog.Warn("seed db query", "err", err)
		return nil
	}
	defer rows.Close()
	var out []string
	for rows.Next() {
		var id string
		if rows.Scan(&id) == nil {
			id = strings.TrimPrefix(strings.TrimPrefix(id, "coles_id_"), "woolworths_sku_")
			if id != "" {
				out = append(out, id)
			}
		}
	}
	return out
}
