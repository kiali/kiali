package context

import (
	"context"
)

type contextKey string

var ContextKeyRequestHeaders contextKey = "requestHeaders"

// RequestHeaders holds request-scoped header information for propagation to external services
type RequestHeaders struct {
	XRequestID string
}

// IsValid performs basic validation on request headers
func (h *RequestHeaders) IsValid() bool {
	return h.XRequestID != "" && len(h.XRequestID) <= 1024
}

// SetRequestHeadersContext stores request headers in context for propagation
func SetRequestHeadersContext(ctx context.Context, headers *RequestHeaders) context.Context {
	return context.WithValue(ctx, ContextKeyRequestHeaders, headers)
}

// GetRequestHeadersContext retrieves request headers from context
func GetRequestHeadersContext(ctx context.Context) *RequestHeaders {
	if headers, ok := ctx.Value(ContextKeyRequestHeaders).(*RequestHeaders); ok {
		return headers
	}
	return nil
}
