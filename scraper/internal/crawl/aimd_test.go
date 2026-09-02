package crawl

import (
	"testing"
	"time"
)

func cfgFast() ControllerConfig {
	c := DefaultControllerConfig()
	c.Epoch = time.Millisecond
	c.StartRate, c.MaxRate = 1, 1000
	return c
}

func TestSlowStartDoubles(t *testing.T) {
	c := NewController(cfgFast())
	c.Reset(1)
	for i := 0; i < 3; i++ {
		for j := 0; j < 5; j++ {
			c.OnSuccess(10 * time.Millisecond)
		}
		c.epoch()
	}
	if c.rateTarget <= 1 {
		t.Fatalf("slow start did not grow rate: %v", c.rateTarget)
	}
}

func TestIsolatedBackoffEasesGently(t *testing.T) {
	c := NewController(cfgFast())
	c.Reset(40)
	c.OnSuccess(10 * time.Millisecond) // success before the error => isolated
	c.OnError()
	if c.phase != PhasePaused {
		t.Fatalf("expected paused, got %v", c.phase)
	}
	if c.rateTarget < 29.9 || c.rateTarget > 30.1 { // 0.75 * 40
		t.Fatalf("isolated backoff should ease to ~30, got %v", c.rateTarget)
	}
	if c.Snapshot().PauseRemaining <= 0 {
		t.Fatalf("expected pause remaining")
	}
}

func TestSustainedBackoffHalves(t *testing.T) {
	cfg := cfgFast()
	cfg.Pause = time.Millisecond
	c := NewController(cfg)
	c.Reset(40)
	c.OnError()                // first: isolated (okSinceBack from Reset) -> 30
	c.pausedUntil = time.Now() // allow the next to count
	c.OnError()                // no success since last backoff -> halve 30 -> 15
	if c.rateTarget < 14.9 || c.rateTarget > 15.1 {
		t.Fatalf("sustained backoff should halve to ~15, got %v", c.rateTarget)
	}
}

func TestDeadBackoffsBlock(t *testing.T) {
	cfg := cfgFast()
	cfg.Pause = time.Millisecond
	cfg.DeadBackoffs = 3
	c := NewController(cfg)
	c.Reset(40)
	for i := 0; i < 4; i++ {
		c.OnError()                // no OnSuccess in between => dead streak
		c.pausedUntil = time.Now() // let the next OnError count
	}
	if !c.Blocked() {
		t.Fatalf("expected controller to be blocked after dead backoffs")
	}
}

func TestSuccessResetsDeadStreak(t *testing.T) {
	cfg := cfgFast()
	cfg.Pause = time.Millisecond
	cfg.DeadBackoffs = 3
	c := NewController(cfg)
	c.Reset(40)
	for i := 0; i < 5; i++ {
		c.OnError()
		c.pausedUntil = time.Now()
		c.OnSuccess(5 * time.Millisecond) // recovery between backoffs
	}
	if c.Blocked() {
		t.Fatalf("healthy recoveries should not block")
	}
}

func TestLatencyGuardHolds(t *testing.T) {
	c := NewController(cfgFast())
	c.Reset(10)
	// establish a low baseline
	for j := 0; j < 5; j++ {
		c.OnSuccess(10 * time.Millisecond)
	}
	c.epoch()
	before := c.rateTarget
	// now high latency: growth should hold
	for j := 0; j < 20; j++ {
		c.OnSuccess(500 * time.Millisecond)
	}
	c.epoch()
	if c.rateTarget > before+0.001 {
		t.Fatalf("latency guard failed: %v -> %v", before, c.rateTarget)
	}
}
