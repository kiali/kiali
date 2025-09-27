package authentication

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"

	utilcontext "github.com/kiali/kiali/util/context"
)

func TestRequestHeaders_IsValid(t *testing.T) {
	testCases := []struct {
		name        string
		requestID   string
		expectValid bool
	}{
		{"valid short ID", "req-123", true},
		{"valid UUID", "550e8400-e29b-41d4-a716-446655440000", true},
		{"valid generated ID", "kiali-20250924-abc123", true},
		{"empty ID", "", false},
		{"valid long ID", string(make([]byte, 1024)), true}, // 1024 chars = valid
		{"too long ID", string(make([]byte, 1025)), false},  // 1025 chars = invalid
		{"very long ID", string(make([]byte, 2000)), false},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			headers := &utilcontext.RequestHeaders{XRequestID: tc.requestID}
			assert.Equal(t, tc.expectValid, headers.IsValid())
		})
	}
}

func TestSetRequestHeadersContext(t *testing.T) {
	testCases := []struct {
		name    string
		headers *utilcontext.RequestHeaders
	}{
		{"valid headers", &utilcontext.RequestHeaders{XRequestID: "test-123"}},
		{"empty request ID", &utilcontext.RequestHeaders{XRequestID: ""}},
		{"nil headers", nil},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			ctx := context.Background()

			// Set headers in context
			newCtx := utilcontext.SetRequestHeadersContext(ctx, tc.headers)

			// Verify context was modified
			assert.NotEqual(t, ctx, newCtx)

			// Verify we can retrieve the headers
			retrieved := utilcontext.GetRequestHeadersContext(newCtx)
			assert.Equal(t, tc.headers, retrieved)
		})
	}
}

func TestGetRequestHeadersContext(t *testing.T) {
	testCases := []struct {
		name     string
		setup    func() context.Context
		expected *utilcontext.RequestHeaders
	}{
		{
			name: "context with headers",
			setup: func() context.Context {
				headers := &utilcontext.RequestHeaders{XRequestID: "test-456"}
				return utilcontext.SetRequestHeadersContext(context.Background(), headers)
			},
			expected: &utilcontext.RequestHeaders{XRequestID: "test-456"},
		},
		{
			name: "empty context",
			setup: func() context.Context {
				return context.Background()
			},
			expected: nil,
		},
		{
			name: "context with wrong type",
			setup: func() context.Context {
				// Store wrong type in context
				return context.WithValue(context.Background(), utilcontext.ContextKeyRequestHeaders, "wrong-type")
			},
			expected: nil,
		},
		{
			name: "context with nil headers",
			setup: func() context.Context {
				return utilcontext.SetRequestHeadersContext(context.Background(), nil)
			},
			expected: nil,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			ctx := tc.setup()
			retrieved := utilcontext.GetRequestHeadersContext(ctx)
			assert.Equal(t, tc.expected, retrieved)
		})
	}
}

func TestRequestHeadersContext_Isolation(t *testing.T) {
	// Test that different contexts maintain isolated headers
	ctx1 := utilcontext.SetRequestHeadersContext(context.Background(), &utilcontext.RequestHeaders{XRequestID: "request-1"})
	ctx2 := utilcontext.SetRequestHeadersContext(context.Background(), &utilcontext.RequestHeaders{XRequestID: "request-2"})

	// Verify isolation
	headers1 := utilcontext.GetRequestHeadersContext(ctx1)
	headers2 := utilcontext.GetRequestHeadersContext(ctx2)

	assert.NotNil(t, headers1)
	assert.NotNil(t, headers2)
	assert.Equal(t, "request-1", headers1.XRequestID)
	assert.Equal(t, "request-2", headers2.XRequestID)
	assert.NotEqual(t, headers1.XRequestID, headers2.XRequestID)
}

func TestRequestHeadersContext_WithExistingAuthInfo(t *testing.T) {
	// Test that request headers context works alongside existing auth info context
	ctx := context.Background()

	// Add auth info (existing pattern)
	authInfo := map[string]interface{}{"cluster": "test-cluster"}
	ctx = SetAuthInfoContext(ctx, authInfo)

	// Add request headers (new pattern)
	headers := &utilcontext.RequestHeaders{XRequestID: "test-789"}
	ctx = utilcontext.SetRequestHeadersContext(ctx, headers)

	// Verify both can be retrieved
	retrievedAuth := GetAuthInfoContext(ctx)
	retrievedHeaders := utilcontext.GetRequestHeadersContext(ctx)

	assert.Equal(t, authInfo, retrievedAuth)
	assert.Equal(t, headers, retrievedHeaders)
	assert.Equal(t, "test-789", retrievedHeaders.XRequestID)
}
