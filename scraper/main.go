package main

import (
	"log/slog"
	"os"
	"os/signal"
	"syscall"
	"time"

	"basketwise/scraper/coles"
	"basketwise/scraper/woolworths"
)

const productMaxAge = 24 * time.Hour

func main() {
	var c coles.Coles
	if err := c.Init("https://www.coles.com.au", "coles.db", productMaxAge); err != nil {
		slog.Error("failed to init Coles", "error", err)
		os.Exit(1)
	}

	var w woolworths.Woolworths
	if err := w.Init("https://www.woolworths.com.au", "woolworths.db", productMaxAge); err != nil {
		slog.Error("failed to init Woolworths", "error", err)
		os.Exit(1)
	}

	cancelColes := make(chan struct{})
	cancelWoolworths := make(chan struct{})

	go c.Run(cancelColes)
	go w.Run(cancelWoolworths)

	slog.Info("scrapers running, press Ctrl+C to stop")

	sig := make(chan os.Signal, 1)
	signal.Notify(sig, syscall.SIGINT, syscall.SIGTERM)
	<-sig

	slog.Info("shutting down")
	close(cancelColes)
	close(cancelWoolworths)
}
