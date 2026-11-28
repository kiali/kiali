package kubernetes

import (
	"net/http"
	"sync"
)

// client-go shares credential refreshes, but runs exec plugins without a context.
// If the provider stalls, let the caller leave and hold retries behind the outstanding
// attempt. Once it returns, ordinary requests can use the refreshed credentials.
type execCredentialTransport struct {
	abandoned int
	base      http.RoundTripper
	mu        sync.Mutex
	resumed   chan struct{}
}

func (t *execCredentialTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	t.mu.Lock()
	pending := t.resumed
	t.mu.Unlock()
	if pending != nil {
		select {
		case <-pending:
		case <-req.Context().Done():
			if req.Body != nil {
				req.Body.Close()
			}
			return nil, req.Context().Err()
		}
	}

	type result struct {
		resp *http.Response
		err  error
	}
	results := make(chan result)
	abandon := make(chan struct{})
	request := req.Clone(req.Context())
	go func() {
		resp, err := t.base.RoundTrip(request)
		select {
		case results <- result{resp, err}:
		case <-abandon:
			if resp != nil {
				resp.Body.Close()
			}
			t.mu.Lock()
			t.abandoned--
			if t.abandoned == 0 {
				close(t.resumed)
				t.resumed = nil
			}
			t.mu.Unlock()
		}
	}()
	select {
	case r := <-results:
		return r.resp, r.err
	case <-req.Context().Done():
		t.mu.Lock()
		if t.abandoned == 0 {
			t.resumed = make(chan struct{})
		}
		t.abandoned++
		close(abandon)
		t.mu.Unlock()
		return nil, req.Context().Err()
	}
}
