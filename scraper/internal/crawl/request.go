package crawl

import (
	"bytes"
	"net/http"
)

type httpRequest = http.Request

// SimpleRequest is a Request built from a method/url/body/headers.
type SimpleRequest struct {
	Method  string
	URL     string
	Body    []byte
	Headers map[string]string
}

func (r SimpleRequest) Build() (*http.Request, error) {
	var body *bytes.Reader
	var req *http.Request
	var err error
	if r.Body != nil {
		body = bytes.NewReader(r.Body)
		req, err = http.NewRequest(r.Method, r.URL, body)
	} else {
		req, err = http.NewRequest(r.Method, r.URL, nil)
	}
	if err != nil {
		return nil, err
	}
	for k, v := range r.Headers {
		req.Header.Set(k, v)
	}
	return req, nil
}

// RequestFunc adapts a closure to Request (for lazily-resolved URLs).
type RequestFunc func() (*http.Request, error)

func (f RequestFunc) Build() (*http.Request, error) { return f() }
