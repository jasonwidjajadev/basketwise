// Package crawl is the store-agnostic high-concurrency crawl engine:
// AIMD rate control, HTTP client, dedupe, SQLite sink and stats.
package crawl

import (
	"context"
	"math"
	"sort"
	"sync"
	"time"

	"golang.org/x/time/rate"
)

// CtrlPhase is the phase of the AIMD controller.
type CtrlPhase int32

const (
	PhaseSlowStart CtrlPhase = iota
	PhaseProbe
	PhasePaused
)

func (p CtrlPhase) String() string {
	switch p {
	case PhaseSlowStart:
		return "slowstart"
	case PhaseProbe:
		return "probe"
	case PhasePaused:
		return "paused"
	}
	return "?"
}

// ControllerConfig tunes the TCP-like rate controller.
type ControllerConfig struct {
	StartRate    float64       // req/s at start (0.1 = one request every 10 s)
	MaxRate      float64       // hard ceiling
	MinRate      float64       // floor after backoff
	Pause        time.Duration // base pause after an error (doubles on consecutive dead backoffs)
	MaxPause     time.Duration
	Epoch        time.Duration // decision interval
	AddStep      float64       // additive increase fraction of rate (min 1 req/s)
	LatencyHold  float64       // hold growth if p50 > LatencyHold * baseline
	MaxInflight  int
	DeadBackoffs int // consecutive backoffs with no success in between => blocked
}

func DefaultControllerConfig() ControllerConfig {
	return ControllerConfig{
		StartRate: 0.1, MaxRate: 400, MinRate: 0.5, Pause: 5 * time.Second, MaxPause: 2 * time.Minute,
		Epoch: 2 * time.Second, AddStep: 0.05, LatencyHold: 2.5, MaxInflight: 128, DeadBackoffs: 4,
	}
}

// Controller implements slow-start / additive-increase / multiplicative-decrease
// with a latency guard, growth gated on *achieved* throughput, escalating pauses
// and memory of the best clean rate.
type Controller struct {
	cfg ControllerConfig
	lim *rate.Limiter
	sem chan struct{}

	mu          sync.Mutex
	rateTarget  float64
	ssthresh    float64
	phase       CtrlPhase
	pausedUntil time.Time
	pauseDur    time.Duration
	bestClean   float64 // highest *achieved* clean rate
	cleanEpochs int
	epochErrs   int
	epochOK     int
	epochLat    []float64
	baseLat     float64 // ms: min p50 seen (with enough samples)
	backoffs    int64
	deadStreak  int // backoffs without any success since the previous one
	okSinceBack bool
	inflight    int64
	lastP50     float64
	lastAch     float64
	rewarmReq   bool
	blocked     bool
}

func NewController(cfg ControllerConfig) *Controller {
	if cfg.StartRate <= 0 {
		cfg.StartRate = 0.1
	}
	if cfg.MaxPause <= 0 {
		cfg.MaxPause = 2 * time.Minute
	}
	if cfg.DeadBackoffs <= 0 {
		cfg.DeadBackoffs = 4
	}
	c := &Controller{cfg: cfg, rateTarget: cfg.StartRate, ssthresh: math.Inf(1), phase: PhaseSlowStart, pauseDur: cfg.Pause, okSinceBack: true}
	c.lim = rate.NewLimiter(rate.Limit(cfg.StartRate), 1)
	c.sem = make(chan struct{}, cfg.MaxInflight)
	return c
}

// Reset returns the controller to a fresh slow start at the given rate.
func (c *Controller) Reset(startRate float64) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.phase, c.ssthresh, c.cleanEpochs, c.epochErrs, c.epochOK = PhaseSlowStart, math.Inf(1), 0, 0, 0
	c.pauseDur, c.deadStreak, c.okSinceBack, c.blocked = c.cfg.Pause, 0, true, false
	c.epochLat = c.epochLat[:0]
	c.setRate(startRate)
}

// Run drives the epoch ticker until ctx is done.
func (c *Controller) Run(ctx context.Context) {
	t := time.NewTicker(c.cfg.Epoch)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			c.epoch()
		}
	}
}

func (c *Controller) epoch() {
	c.mu.Lock()
	defer c.mu.Unlock()
	now := time.Now()
	ok := c.epochOK
	achieved := float64(ok) / c.cfg.Epoch.Seconds()
	c.lastAch = achieved
	p50 := 0.0
	if n := len(c.epochLat); n > 0 {
		sort.Float64s(c.epochLat)
		p50 = c.epochLat[n/2]
	}
	c.lastP50 = p50
	hadErr := c.epochErrs > 0
	c.epochErrs, c.epochOK, c.epochLat = 0, 0, c.epochLat[:0]

	if c.phase == PhasePaused {
		if now.Before(c.pausedUntil) {
			return
		}
		c.phase = PhaseProbe
		if c.rateTarget < c.ssthresh {
			c.phase = PhaseSlowStart
		}
		return // first epoch after a pause: observe only
	}
	if hadErr {
		return // OnError already reacted
	}
	// baseline latency: slow EWMA of typical p50 so the guard tracks the current
	// normal latency instead of locking to a lucky fast epoch. Only updated on
	// epochs with enough samples and without a spike, so a spike can't inflate it.
	if ok >= 3 && p50 > 0 {
		if c.baseLat == 0 {
			c.baseLat = p50
		} else if p50 <= c.baseLat*c.cfg.LatencyHold {
			c.baseLat = 0.9*c.baseLat + 0.1*p50
		}
	}
	if ok > 0 {
		c.cleanEpochs++
	}
	if c.cleanEpochs >= 2 && achieved > c.bestClean {
		c.bestClean = achieved
	}
	// growth is gated on actually achieving the current target (or the epoch being
	// too short for even one request at very low rates)
	minPerEpoch := c.rateTarget * c.cfg.Epoch.Seconds()
	if minPerEpoch >= 1 && achieved < 0.6*c.rateTarget {
		return // not delivering the current rate yet (latency-bound or inflight-bound)
	}
	if minPerEpoch < 1 && ok == 0 {
		return // wait for the first success at very low rates
	}
	// latency guard (Vegas-style)
	if c.baseLat > 0 && p50 > c.baseLat*c.cfg.LatencyHold {
		return // hold: server is queueing
	}
	next := c.rateTarget
	switch c.phase {
	case PhaseSlowStart:
		mult := 2.0
		if c.rateTarget >= 20 {
			mult = 1.5 // gentler once we are already fast
		}
		next = c.rateTarget * mult
		if next >= c.ssthresh {
			next = c.ssthresh
			c.phase = PhaseProbe
		}
	case PhaseProbe:
		next = c.rateTarget + math.Max(1, c.rateTarget*c.cfg.AddStep)
	}
	c.setRate(math.Min(next, c.cfg.MaxRate))
}

func (c *Controller) setRate(r float64) {
	if r < c.cfg.MinRate {
		r = c.cfg.MinRate
	}
	c.rateTarget = r
	c.lim.SetLimit(rate.Limit(r))
	burst := int(math.Ceil(r / 4))
	if burst < 1 {
		burst = 1
	}
	c.lim.SetBurst(burst)
}

// OnError registers a rate-relevant failure: pause everything, halve.
// Consecutive backoffs with no success in between escalate the pause and
// eventually flag the controller as blocked.
func (c *Controller) OnError() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.epochErrs++
	now := time.Now()
	if c.phase == PhasePaused && now.Before(c.pausedUntil) {
		return // one backoff per pause window
	}
	c.backoffs++
	c.cleanEpochs = 0
	if c.okSinceBack {
		c.deadStreak = 0
		c.pauseDur = c.cfg.Pause
	} else {
		c.deadStreak++
		c.pauseDur *= 2
		if c.pauseDur > c.cfg.MaxPause {
			c.pauseDur = c.cfg.MaxPause
		}
		if c.deadStreak >= 2 {
			c.rewarmReq = true
		}
		if c.deadStreak >= c.cfg.DeadBackoffs {
			c.blocked = true
		}
	}
	// Isolated error (we had successes since the last backoff and no dead streak):
	// ease off gently and keep probing near the ceiling. A sustained problem
	// (no success since last backoff) triggers the classic multiplicative halving.
	isolated := c.okSinceBack && c.deadStreak == 0
	factor := 0.5
	if isolated {
		factor = 0.75
	}
	c.okSinceBack = false
	c.phase = PhasePaused
	c.pausedUntil = now.Add(c.pauseDur)
	c.ssthresh = math.Max(c.cfg.MinRate, c.rateTarget*factor)
	if c.bestClean > 0 && c.ssthresh > 0.9*c.bestClean {
		c.ssthresh = 0.9 * c.bestClean
	}
	c.setRate(c.rateTarget * factor)
}

// OnSuccess records latency for the epoch.
func (c *Controller) OnSuccess(lat time.Duration) {
	c.mu.Lock()
	c.epochLat = append(c.epochLat, float64(lat.Milliseconds()))
	c.epochOK++
	c.okSinceBack = true
	c.mu.Unlock()
}

// Blocked reports whether consecutive dead backoffs exhausted the controller.
func (c *Controller) Blocked() bool {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.blocked
}

// Acquire blocks until a request may start (rate token + inflight slot + not paused).
func (c *Controller) Acquire(ctx context.Context) error {
	for {
		c.mu.Lock()
		until := c.pausedUntil
		paused := c.phase == PhasePaused
		c.mu.Unlock()
		if !paused || time.Now().After(until) {
			break
		}
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(time.Until(until) + 10*time.Millisecond):
		}
	}
	if err := c.lim.Wait(ctx); err != nil {
		return err
	}
	select {
	case c.sem <- struct{}{}:
	case <-ctx.Done():
		return ctx.Err()
	}
	c.mu.Lock()
	c.inflight++
	c.mu.Unlock()
	return nil
}

// Release frees the inflight slot.
func (c *Controller) Release() {
	<-c.sem
	c.mu.Lock()
	c.inflight--
	c.mu.Unlock()
}

// TakeRewarm returns true once when the controller wants a cookie re-warm.
func (c *Controller) TakeRewarm() bool {
	c.mu.Lock()
	defer c.mu.Unlock()
	r := c.rewarmReq
	c.rewarmReq = false
	return r
}

// CtrlSnapshot is a point-in-time view for stats.
type CtrlSnapshot struct {
	Rate, Best, P50, Achieved float64
	Phase                     CtrlPhase
	PauseRemaining            float64
	Inflight                  int64
	Backoffs                  int64
}

func (c *Controller) Snapshot() CtrlSnapshot {
	c.mu.Lock()
	defer c.mu.Unlock()
	s := CtrlSnapshot{Rate: c.rateTarget, Best: c.bestClean, P50: c.lastP50, Achieved: c.lastAch, Phase: c.phase, Inflight: c.inflight, Backoffs: c.backoffs}
	if c.phase == PhasePaused {
		if d := time.Until(c.pausedUntil); d > 0 {
			s.PauseRemaining = d.Seconds()
		}
	}
	return s
}

// SetStartRate overrides the initial rate (used by -start-rate auto).
func (c *Controller) SetStartRate(r float64) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.setRate(math.Min(r, c.cfg.MaxRate))
}
