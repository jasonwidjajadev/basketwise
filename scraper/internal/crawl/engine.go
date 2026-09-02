package crawl

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"os"
	"sync"
	"sync/atomic"
	"time"
)

// Item is a unit of crawl work. Do returns a *FetchError for transport-level
// failures (which may trigger AIMD backoff + retry) or any other error for
// permanent failures.
type Item interface {
	Do(ctx context.Context, e *Engine) error
	Kind() string // "list" | "detail" | "rating"
}

// Store is implemented by each retailer package.
type Store interface {
	Name() string
	// Warmup fetches cookies / build ids. Called at start and on rewarm requests.
	Warmup(ctx context.Context, e *Engine) error
	// Categories returns the listing roots to crawl.
	Categories(ctx context.Context, e *Engine) ([]Category, error)
	// ListItem creates the item that fetches one listing page.
	ListItem(cat Category, page int) Item
	// DetailItem creates the item that fetches one product's detail (slugHint may be "").
	DetailItem(id string, slugHint string) Item
	// FlushBatches lets stores emit pending batch items (e.g. ratings) at the end of a phase.
	FlushBatches(e *Engine)
}

// Engine runs items through the AIMD-controlled client and persists results.
type Engine struct {
	Store       Store
	Client      *Client
	Ctrl        *Controller
	Sink        *Sink
	Dedupe      *Dedupe
	Stats       *Stats
	Emit        *Emitter
	Log         *slog.Logger
	Workers     int
	MaxPages    int
	DoDetail    bool // enqueue detail items as products are discovered
	MaxAttempts int
	StartRate   float64

	listQ           chan queued
	detailQ         chan queued
	listInflight    atomic.Int64
	pending         atomic.Int64
	done            chan struct{}
	doneOnce        sync.Once
	blocked         atomic.Bool
	challengeTimes  []time.Time
	challengeWarned bool
	cmu             sync.Mutex
	warmMu          sync.Mutex
	warming         atomic.Bool
}

type queued struct {
	item     Item
	attempts int
}

func NewEngine(store Store, client *Client, ctrl *Controller, sink *Sink, stats *Stats, emit *Emitter, workers int) *Engine {
	return &Engine{
		Store: store, Client: client, Ctrl: ctrl, Sink: sink, Dedupe: NewDedupe(), Stats: stats, Emit: emit,
		Log:     slog.New(slog.NewTextHandler(os.Stderr, nil)).With("store", store.Name()),
		Workers: workers, MaxAttempts: 5,
		listQ: make(chan queued, 1<<16), detailQ: make(chan queued, 1<<19), done: make(chan struct{}),
	}
}

// Enqueue adds an item; list items go to the priority queue.
func (e *Engine) Enqueue(it Item) { e.enqueue(queued{item: it}) }

func (e *Engine) enqueue(q queued) {
	e.pending.Add(1)
	if q.item.Kind() == "list" {
		e.Stats.QueueList.Add(1)
		e.listQ <- q
	} else {
		e.Stats.QueueDetail.Add(1)
		e.detailQ <- q
	}
}

func (e *Engine) finish() {
	if e.pending.Add(-1) == 0 {
		e.doneOnce.Do(func() { close(e.done) })
	}
}

// Fetch runs one HTTP request under rate control and feeds the controller.
func (e *Engine) Fetch(ctx context.Context, req Request, wantJSON bool) (*Result, error) {
	if err := e.Ctrl.Acquire(ctx); err != nil {
		return nil, err
	}
	defer e.Ctrl.Release()
	httpReq, err := req.Build()
	if err != nil {
		return nil, err
	}
	res, err := e.Client.Fetch(ctx, httpReq, wantJSON)
	if err != nil {
		var fe *FetchError
		if errors.As(err, &fe) {
			code := string(fe.Kind)
			if fe.Kind == KindHTTP && fe.Status > 0 {
				code = fmt.Sprint(fe.Status)
			}
			e.Stats.Error(code, fe.Error())
			if fe.Kind == KindChallenge {
				e.Stats.Challenges.Add(1)
				e.noteChallenge()
			}
			if fe.RateRelevant() {
				e.Ctrl.OnError()
				if e.Ctrl.Blocked() && !e.blocked.Load() {
					e.blocked.Store(true)
					e.Emit.Event(e.Store.Name(), "blocked", "consecutive backoffs with no successful response: "+fe.Error())
				}
			}
		}
		return nil, err
	}
	e.Ctrl.OnSuccess(res.Latency)
	return res, nil
}

// FetchNoRate performs a request under the rate limiter but does NOT feed the
// controller's backoff logic. Used for warmup / build-id probes whose failures
// (e.g. an HTML anti-bot interstitial) do not indicate the JSON API is overloaded.
func (e *Engine) FetchNoRate(ctx context.Context, req Request, wantJSON bool) (*Result, error) {
	if err := e.Ctrl.Acquire(ctx); err != nil {
		return nil, err
	}
	defer e.Ctrl.Release()
	httpReq, err := req.Build()
	if err != nil {
		return nil, err
	}
	res, err := e.Client.Fetch(ctx, httpReq, wantJSON)
	if err == nil {
		e.Ctrl.OnSuccess(res.Latency)
	}
	return res, err
}

func (e *Engine) noteChallenge() {
	e.cmu.Lock()
	defer e.cmu.Unlock()
	now := time.Now()
	keep := e.challengeTimes[:0]
	for _, t := range e.challengeTimes {
		if now.Sub(t) < time.Minute {
			keep = append(keep, t)
		}
	}
	e.challengeTimes = append(keep, now)
	// Intermittent interstitials (Imperva on Coles) recover on their own, so a
	// burst of them only warns. A *hard* wall shows up as consecutive backoffs
	// with no success in between and is caught by the controller's dead-backoff
	// logic instead. Only warn once per crawl to avoid event spam.
	if len(e.challengeTimes) >= 8 && !e.challengeWarned {
		e.challengeWarned = true
		e.Emit.Event(e.Store.Name(), "challenge", "frequent anti-bot interstitials; riding through with backoff")
	}
}

// Request is a lazily-built HTTP request (so retries get fresh build ids etc).
type Request interface {
	Build() (*httpRequest, error)
}

// Run executes the crawl until all work is done or ctx is cancelled.
// Returns exit code semantics: nil ok; ErrBlocked when anti-bot stopped us.
func (e *Engine) Run(ctx context.Context, seedList bool, detailSeeds []DetailSeed) error {
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()
	go e.Ctrl.Run(ctx)

	var werr error
	for attempt := 0; attempt < 4; attempt++ {
		if werr = e.Store.Warmup(ctx, e); werr == nil {
			break
		}
		e.Log.Warn("warmup failed", "attempt", attempt+1, "err", werr)
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(time.Duration(3+attempt*4) * time.Second):
		}
	}
	if werr != nil {
		e.Emit.Event(e.Store.Name(), "blocked", "warmup: "+werr.Error())
		return ErrBlocked
	}
	e.Ctrl.Reset(e.StartRate)
	e.Emit.Event(e.Store.Name(), "start", fmt.Sprintf("workers=%d", e.Workers))

	// pre-seed so pending never hits zero before discovery finishes
	e.pending.Add(1)
	if seedList {
		e.Stats.Phase.Store("list")
		cats, err := e.Store.Categories(ctx, e)
		if err != nil {
			return fmt.Errorf("categories: %w", err)
		}
		for _, c := range cats {
			c := c
			e.Sink.Category(&c, false)
			e.Enqueue(e.Store.ListItem(c, 1))
		}
		e.Log.Info("seeded categories", "n", len(cats))
	} else {
		e.Stats.Phase.Store("detail")
	}
	for _, seed := range detailSeeds {
		e.Enqueue(e.Store.DetailItem(seed.ID, seed.Slug))
	}

	var wg sync.WaitGroup
	for i := 0; i < e.Workers; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			e.worker(ctx)
		}()
	}
	// rewarm watcher
	go func() {
		t := time.NewTicker(time.Second)
		defer t.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-t.C:
				if e.Ctrl.TakeRewarm() {
					e.rewarm(ctx)
				}
			}
		}
	}()
	e.finish() // release pre-seed
	// phase tracking: when list queue drains, flip to detail
	go func() {
		for {
			select {
			case <-ctx.Done():
				return
			case <-e.done:
				return
			case <-time.After(500 * time.Millisecond):
				if seedList && e.Stats.QueueList.Load() == 0 && e.listInflight.Load() == 0 && e.Stats.Phase.Load().(string) == "list" {
					e.Stats.Phase.Store("detail")
					e.Store.FlushBatches(e)
				}
			}
		}
	}()
	blockedTick := time.NewTicker(500 * time.Millisecond)
	defer blockedTick.Stop()
wait:
	for {
		select {
		case <-e.done:
			break wait
		case <-ctx.Done():
			break wait
		case <-blockedTick.C:
			if e.blocked.Load() {
				e.Log.Error("blocked; stopping crawl so the caller can escalate (cookies / browser mode)")
				cancel()
				break wait
			}
		}
	}
	// let stores flush trailing batches (ratings); wait for them too
	e.pending.Add(1)
	e.Store.FlushBatches(e)
	e.doneOnce = sync.Once{}
	e.done = make(chan struct{})
	e.finish()
	select {
	case <-e.done:
	case <-ctx.Done():
	case <-time.After(30 * time.Second):
	}
	cancel()
	wg.Wait()
	e.Sink.Flush()
	e.Stats.Phase.Store("done")
	if e.blocked.Load() {
		return ErrBlocked
	}
	return nil
}

var ErrBlocked = errors.New("blocked by anti-bot")

func (e *Engine) worker(ctx context.Context) {
	for {
		var q queued
		select {
		case <-ctx.Done():
			return
		case q = <-e.listQ:
			e.Stats.QueueList.Add(-1)
		default:
			select {
			case <-ctx.Done():
				return
			case q = <-e.listQ:
				e.Stats.QueueList.Add(-1)
			case q = <-e.detailQ:
				e.Stats.QueueDetail.Add(-1)
			}
		}
		isList := q.item.Kind() == "list"
		if isList {
			e.listInflight.Add(1)
		}
		err := q.item.Do(ctx, e)
		if isList {
			e.listInflight.Add(-1)
		}
		if err != nil && ctx.Err() == nil {
			var fe *FetchError
			if errors.As(err, &fe) && q.attempts+1 < e.MaxAttempts && !e.blocked.Load() {
				q.attempts++
				// re-queue with jitter (don't block the worker)
				go func(q queued) {
					time.Sleep(time.Duration(200*(1<<q.attempts)) * time.Millisecond)
					e.enqueue(q)
				}(q)
			} else if !errors.As(err, &fe) {
				e.Stats.Error("parse", err.Error())
				e.Log.Warn("item failed", "kind", q.item.Kind(), "err", err)
			} else {
				e.Log.Warn("item gave up", "kind", q.item.Kind(), "err", err)
			}
		}
		e.finish()
	}
}

func (e *Engine) rewarm(ctx context.Context) {
	if !e.warming.CompareAndSwap(false, true) {
		return
	}
	defer e.warming.Store(false)
	e.Log.Info("re-warming cookies after repeated backoffs")
	if err := e.Store.Warmup(ctx, e); err != nil {
		e.Log.Warn("rewarm failed", "err", err)
	}
}

// ---- helpers used by store packages ----

// OnListingPage handles a parsed listing page: dedupe, persist, enqueue detail.
// Returns number of new products.
func (e *Engine) OnListingPage(cat Category, page int, prods []*Product, slugs []string) int {
	e.Stats.Pages.Add(1)
	e.Stats.Products.Add(int64(len(prods)))
	ids := make([]string, 0, len(prods))
	newN := 0
	for i, p := range prods {
		ids = append(ids, p.ID)
		if e.Dedupe.Seen(p.ID) {
			e.Stats.Dupes.Add(1)
			continue
		}
		newN++
		e.Stats.Unique.Add(1)
		if e.Dedupe.Changed(p.ID, p.ContentHash()) {
			e.Sink.UpsertListing(p)
		} else {
			e.Stats.Unchanged.Add(1)
			e.Sink.Touch(p)
		}
		if p.PriceCents > 0 && e.Dedupe.PriceChanged(p.ID, p.PriceCents, p.WasCents) {
			e.Sink.Price(p)
		}
		if e.DoDetail {
			hint := ""
			if slugs != nil {
				hint = slugs[i]
			}
			e.Enqueue(e.Store.DetailItem(p.ID, hint))
		}
	}
	if len(ids) > 0 && e.Dedupe.PageRepeated(cat.ID, ids) {
		return -1 // signal: repeated garbage page
	}
	return newN
}

// OnDetail persists a fetched detail.
func (e *Engine) OnDetail(p *Product) {
	e.Stats.Details.Add(1)
	if !e.Dedupe.Seen(p.ID) {
		e.Stats.Unique.Add(1) // seed-only product not in any listing
	}
	e.Sink.UpsertDetail(p)
	if p.PriceCents > 0 && e.Dedupe.PriceChanged(p.ID, p.PriceCents, p.WasCents) {
		e.Sink.Price(p)
	}
}

// OnDeprecated marks a product id that no longer resolves.
func (e *Engine) OnDeprecated(id string) {
	e.Stats.Details.Add(1)
	e.Sink.Deprecate(id)
}

// EnqueuePages enqueues pages 2..n for a category (bounded by MaxPages).
func (e *Engine) EnqueuePages(cat Category, total, pageSize int) int {
	n := (total + pageSize - 1) / pageSize
	if e.MaxPages > 0 && n > e.MaxPages {
		n = e.MaxPages
	}
	for p := 2; p <= n; p++ {
		e.Enqueue(e.Store.ListItem(cat, p))
	}
	c := cat
	c.Total = total
	e.Sink.Category(&c, true)
	return n
}
