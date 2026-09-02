package crawl

import (
	"encoding/json"
	"io"
	"sync"
	"sync/atomic"
	"time"
)

// Stats holds atomic counters and emits NDJSON snapshots.
type Stats struct {
	Store string
	Phase atomic.Value // string

	Pages, Products, Unique, Dupes, Unchanged, Details, Errors, Challenges atomic.Int64
	QueueList, QueueDetail                                                 atomic.Int64

	mu        sync.Mutex
	byCode    map[string]int64
	lastError string
	start     time.Time
	prev      sample
	prevT     time.Time
	rateSm    float64
}

type sample struct {
	req, wire, raw, pages, products, details int64
}

func NewStats(store string) *Stats {
	s := &Stats{Store: store, byCode: map[string]int64{}, start: time.Now(), prevT: time.Now()}
	s.Phase.Store("init")
	return s
}

func (s *Stats) Error(code string, msg string) {
	s.Errors.Add(1)
	s.mu.Lock()
	s.byCode[code]++
	s.lastError = msg
	s.mu.Unlock()
}

type StatLine struct {
	T              string           `json:"t"`
	Store          string           `json:"store"`
	Phase          string           `json:"phase"`
	Elapsed        float64          `json:"elapsed_s"`
	RateTarget     float64          `json:"rate_target"`
	RateActual     float64          `json:"rate_actual"`
	Inflight       int64            `json:"inflight"`
	Ctrl           string           `json:"ctrl"`
	PauseRemaining float64          `json:"pause_remaining_s"`
	BestRate       float64          `json:"best_rate"`
	P50            float64          `json:"p50_ms"`
	BytesWire      int64            `json:"bytes_wire"`
	BytesRaw       int64            `json:"bytes_raw"`
	BytesWireS     float64          `json:"bytes_wire_s"`
	BytesRawS      float64          `json:"bytes_raw_s"`
	Requests       int64            `json:"requests"`
	ReqS           float64          `json:"req_s"`
	Pages          int64            `json:"pages"`
	PagesS         float64          `json:"pages_s"`
	Products       int64            `json:"products"`
	ProductsS      float64          `json:"products_s"`
	Unique         int64            `json:"unique"`
	Dupes          int64            `json:"dupes"`
	Unchanged      int64            `json:"unchanged"`
	Details        int64            `json:"details"`
	DetailsS       float64          `json:"details_s"`
	Errors         int64            `json:"errors"`
	ErrorsByCode   map[string]int64 `json:"errors_by_code"`
	Backoffs       int64            `json:"backoffs"`
	Challenges     int64            `json:"challenges"`
	QueueList      int64            `json:"queue_list"`
	QueueDetail    int64            `json:"queue_detail"`
	ETA            float64          `json:"eta_s"`
	LastError      string           `json:"last_error"`
}

// Snapshot computes rates since the previous snapshot (smoothed).
func (s *Stats) Snapshot(c *Client, ctrl *Controller) StatLine {
	now := time.Now()
	cur := sample{req: c.Requests.Load(), wire: c.BytesWire.Load(), raw: c.BytesRaw.Load(), pages: s.Pages.Load(), products: s.Products.Load(), details: s.Details.Load()}
	s.mu.Lock()
	dt := now.Sub(s.prevT).Seconds()
	if dt <= 0 {
		dt = 1e-3
	}
	per := func(a, b int64) float64 { return float64(a-b) / dt }
	reqS := per(cur.req, s.prev.req)
	// EWMA over ~1s
	alpha := dt / (dt + 1.0)
	s.rateSm = s.rateSm*(1-alpha) + reqS*alpha
	line := StatLine{
		T: "stats", Store: s.Store, Phase: s.Phase.Load().(string), Elapsed: now.Sub(s.start).Seconds(),
		RateActual: s.rateSm,
		BytesWire:  cur.wire, BytesRaw: cur.raw, BytesWireS: per(cur.wire, s.prev.wire), BytesRawS: per(cur.raw, s.prev.raw),
		Requests: cur.req, ReqS: reqS, Pages: cur.pages, PagesS: per(cur.pages, s.prev.pages),
		Products: cur.products, ProductsS: per(cur.products, s.prev.products),
		Unique: s.Unique.Load(), Dupes: s.Dupes.Load(), Unchanged: s.Unchanged.Load(),
		Details: cur.details, DetailsS: per(cur.details, s.prev.details),
		Errors: s.Errors.Load(), ErrorsByCode: map[string]int64{}, Challenges: s.Challenges.Load(),
		QueueList: s.QueueList.Load(), QueueDetail: s.QueueDetail.Load(), LastError: s.lastError,
	}
	for k, v := range s.byCode {
		line.ErrorsByCode[k] = v
	}
	s.prev, s.prevT = cur, now
	s.mu.Unlock()
	cs := ctrl.Snapshot()
	line.RateTarget, line.BestRate, line.P50, line.Ctrl, line.PauseRemaining, line.Inflight, line.Backoffs =
		cs.Rate, cs.Best, cs.P50, cs.Phase.String(), cs.PauseRemaining, cs.Inflight, cs.Backoffs
	if q := line.QueueList + line.QueueDetail; q > 0 && s.rateSm > 0.1 {
		line.ETA = float64(q) / s.rateSm
	}
	return line
}

// Emitter writes stat lines and events to w as NDJSON.
type Emitter struct {
	mu sync.Mutex
	w  io.Writer
}

func NewEmitter(w io.Writer) *Emitter { return &Emitter{w: w} }

func (e *Emitter) Emit(v any) {
	b, err := json.Marshal(v)
	if err != nil {
		return
	}
	e.mu.Lock()
	e.w.Write(append(b, '\n'))
	e.mu.Unlock()
}

type Event struct {
	T     string `json:"t"`
	Store string `json:"store"`
	Event string `json:"event"`
	Msg   string `json:"msg"`
}

func (e *Emitter) Event(store, ev, msg string) {
	e.Emit(Event{T: "event", Store: store, Event: ev, Msg: msg})
}
