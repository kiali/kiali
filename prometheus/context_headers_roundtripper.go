package prometheus

import (
	"net/http"

	"github.com/kiali/kiali/log"
	utilcontext "github.com/kiali/kiali/util/context"
)

// contextHeadersRoundTripper injects headers from request context into outgoing HTTP requests
type contextHeadersRoundTripper struct {
	originalRT http.RoundTripper
}

// RoundTrip implements http.RoundTripper interface
// It extracts headers from the request context and injects them into the outgoing HTTP request
func (rt *contextHeadersRoundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
	// Safely extract headers from request context
	if headers := utilcontext.GetRequestHeadersContext(req.Context()); headers != nil {
		if headers.IsValid() {
			// Add X-Request-Id header to outgoing request
			req.Header.Set("X-Request-Id", headers.XRequestID)

			// Optional trace logging for debugging
			if log.IsTrace() {
				log.Tracef("Propagated X-Request-Id to Prometheus: %s", headers.XRequestID)
			}
		}
	}

	// Continue with the original RoundTripper
	return rt.originalRT.RoundTrip(req)
}

// newContextHeadersRoundTripper creates a new context-aware RoundTripper
func newContextHeadersRoundTripper(rt http.RoundTripper) http.RoundTripper {
	return &contextHeadersRoundTripper{
		originalRT: rt,
	}
}
