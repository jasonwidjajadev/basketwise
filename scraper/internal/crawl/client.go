package crawl

import (
	"bytes"
	"compress/gzip"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/http/cookiejar"
	"net/url"
	"os"
	"strings"
	"sync/atomic"
	"time"
)

const UserAgent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36"

// ErrKind classifies a failed fetch.
type ErrKind string

const (
	KindHTTP      ErrKind = "http"      // status >= 400 (rate-relevant unless 404 on detail)
	KindNet       ErrKind = "net"       // dial/timeout/reset
	KindChallenge ErrKind = "challenge" // anti-bot interstitial
	KindBody      ErrKind = "body"      // not JSON / decode failure
)

// FetchError is returned by Client.Fetch for anything that is not a clean 200.
type FetchError struct {
	Kind   ErrKind
	Status int
	URL    string
	Msg    string
}

func (e *FetchError) Error() string {
	if e.Status > 0 {
		return fmt.Sprintf("%s %d %s", e.Kind, e.Status, e.URL)
	}
	return fmt.Sprintf("%s %s: %s", e.Kind, e.URL, e.Msg)
}

// RateRelevant says whether the error should trigger AIMD backoff.
// 404 (missing product) and 401 (transient session blip, not a throttle) are
// not rate signals; 403/429/5xx and anti-bot interstitials are.
func (e *FetchError) RateRelevant() bool {
	if e.Kind == KindHTTP && (e.Status == 404 || e.Status == 401) {
		return false
	}
	return true
}

// Client wraps http.Client with cookie jar, gzip accounting and error classification.
type Client struct {
	HTTP      *http.Client
	Jar       http.CookieJar
	BytesWire atomic.Int64
	BytesRaw  atomic.Int64
	Requests  atomic.Int64
	Challenge []string // substrings that identify an anti-bot page
}

func NewClient(timeout time.Duration) *Client {
	jar, _ := cookiejar.New(nil)
	tr := &http.Transport{
		Proxy:               http.ProxyFromEnvironment,
		DialContext:         (&net.Dialer{Timeout: 10 * time.Second, KeepAlive: 30 * time.Second}).DialContext,
		ForceAttemptHTTP2:   true,
		MaxIdleConns:        512,
		MaxIdleConnsPerHost: 512,
		MaxConnsPerHost:     0,
		IdleConnTimeout:     90 * time.Second,
		TLSHandshakeTimeout: 10 * time.Second,
		DisableCompression:  true, // we do gzip ourselves to measure wire bytes
	}
	return &Client{
		HTTP: &http.Client{Transport: tr, Jar: jar, Timeout: timeout, CheckRedirect: func(req *http.Request, via []*http.Request) error {
			return http.ErrUseLastResponse
		}},
		Jar:       jar,
		Challenge: []string{"Pardon Our Interruption", "Access Denied", "<title>Just a moment"},
	}
}

// LoadCookies imports a Playwright-style cookies JSON file into the jar.
func (c *Client) LoadCookies(path string) (int, error) {
	b, err := os.ReadFile(path)
	if err != nil {
		return 0, err
	}
	var raw []struct {
		Name, Value, Domain, Path string
	}
	if err := json.Unmarshal(b, &raw); err != nil {
		return 0, err
	}
	byHost := map[string][]*http.Cookie{}
	for _, ck := range raw {
		host := strings.TrimPrefix(ck.Domain, ".")
		byHost[host] = append(byHost[host], &http.Cookie{Name: ck.Name, Value: ck.Value, Path: ck.Path, Domain: ck.Domain})
	}
	n := 0
	for host, cks := range byHost {
		u, _ := url.Parse("https://" + host + "/")
		c.Jar.SetCookies(u, cks)
		n += len(cks)
	}
	return n, nil
}

// Result of a successful fetch.
type Result struct {
	Body    []byte
	Status  int
	Header  http.Header
	Latency time.Duration
	Wire    int64
}

func setDefaultHeaders(req *http.Request, wantJSON bool) {
	h := req.Header
	if h.Get("User-Agent") == "" {
		h.Set("User-Agent", UserAgent)
	}
	h.Set("Accept-Encoding", "gzip")
	h.Set("Accept-Language", "en-AU,en;q=0.9")
	if wantJSON {
		if h.Get("Accept") == "" {
			h.Set("Accept", "application/json")
		}
		h.Set("sec-fetch-dest", "empty")
		h.Set("sec-fetch-mode", "cors")
		h.Set("sec-fetch-site", "same-origin")
		h.Set("priority", "u=1, i")
	} else {
		if h.Get("Accept") == "" {
			h.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8")
		}
		h.Set("sec-fetch-dest", "document")
		h.Set("sec-fetch-mode", "navigate")
		h.Set("sec-fetch-site", "none")
		h.Set("sec-fetch-user", "?1")
		h.Set("Upgrade-Insecure-Requests", "1")
		h.Set("priority", "u=0, i")
	}
	h.Set("sec-ch-ua", `"Not=A?Brand";v="99", "Google Chrome";v="151", "Chromium";v="151"`)
	h.Set("sec-ch-ua-mobile", "?0")
	h.Set("sec-ch-ua-platform", `"macOS"`)
}

// Fetch performs the request, decompresses, and classifies failures.
// allowRedirect returns the redirect response (3xx) as a result instead of an error.
func (c *Client) Fetch(ctx context.Context, req *http.Request, wantJSON bool) (*Result, error) {
	setDefaultHeaders(req, wantJSON)
	req = req.WithContext(ctx)
	start := time.Now()
	c.Requests.Add(1)
	resp, err := c.HTTP.Do(req)
	if err != nil {
		if errors.Is(err, context.Canceled) {
			return nil, err
		}
		return nil, &FetchError{Kind: KindNet, URL: req.URL.Path, Msg: err.Error()}
	}
	defer resp.Body.Close()
	var body []byte
	var wire int64
	if req.Method != http.MethodHead {
		cr := &countingReader{r: resp.Body}
		var rd io.Reader = cr
		if strings.EqualFold(resp.Header.Get("Content-Encoding"), "gzip") {
			gz, gerr := gzip.NewReader(cr)
			if gerr != nil {
				return nil, &FetchError{Kind: KindBody, Status: resp.StatusCode, URL: req.URL.Path, Msg: "gzip: " + gerr.Error()}
			}
			rd = gz
		}
		body, err = io.ReadAll(rd)
		if err != nil {
			return nil, &FetchError{Kind: KindNet, Status: resp.StatusCode, URL: req.URL.Path, Msg: "read: " + err.Error()}
		}
		wire = cr.n
	}
	c.BytesWire.Add(wire + 400) // + rough header overhead
	c.BytesRaw.Add(int64(len(body)))
	res := &Result{Body: body, Status: resp.StatusCode, Header: resp.Header, Latency: time.Since(start), Wire: wire}
	if resp.StatusCode >= 300 && resp.StatusCode < 400 {
		return res, nil
	}
	if resp.StatusCode >= 400 {
		kind := KindHTTP
		if c.isChallenge(body) {
			kind = KindChallenge
		}
		return nil, &FetchError{Kind: kind, Status: resp.StatusCode, URL: req.URL.Path}
	}
	if c.isChallenge(body) {
		return nil, &FetchError{Kind: KindChallenge, Status: resp.StatusCode, URL: req.URL.Path, Msg: "interstitial"}
	}
	if wantJSON {
		ct := resp.Header.Get("Content-Type")
		if !strings.Contains(ct, "json") && !looksJSON(body) {
			return nil, &FetchError{Kind: KindBody, Status: resp.StatusCode, URL: req.URL.Path, Msg: "non-json " + ct}
		}
	}
	return res, nil
}

func (c *Client) isChallenge(body []byte) bool {
	if len(body) == 0 || len(body) > 200_000 {
		return false
	}
	head := body
	if len(head) > 8192 {
		head = head[:8192]
	}
	for _, s := range c.Challenge {
		if bytes.Contains(head, []byte(s)) {
			return true
		}
	}
	return false
}

func looksJSON(b []byte) bool {
	t := bytes.TrimSpace(b)
	return len(t) > 0 && (t[0] == '{' || t[0] == '[')
}

type countingReader struct {
	r io.Reader
	n int64
}

func (c *countingReader) Read(p []byte) (int, error) {
	n, err := c.r.Read(p)
	c.n += int64(n)
	return n, err
}
