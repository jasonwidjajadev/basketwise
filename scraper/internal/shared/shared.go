package shared

import (
	"context"
	"errors"
	"net/http"
	"time"

	"golang.org/x/time/rate"
)

var ErrProductMissing = errors.New("product missing")

type ProductInfo struct {
	ID                 string
	Name               string
	Description        string
	Department         string
	PriceCents         int64
	PreviousPriceCents int64
	WeightGrams        int
	Timestamp          time.Time
	Store              string
}

type RLHTTPClient struct {
	Client      *http.Client
	Ratelimiter *rate.Limiter
}

func (c *RLHTTPClient) Do(req *http.Request) (*http.Response, error) {
	if err := c.Ratelimiter.Wait(context.Background()); err != nil {
		return nil, err
	}
	return c.Client.Do(req)
}
