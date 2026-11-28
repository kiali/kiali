package kubernetes

import (
	"context"
	"errors"
	"net"
	"net/url"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestIsConnectionErrorClassification(t *testing.T) {
	require := require.New(t)
	require.True(IsConnectionError(&net.OpError{Op: "dial", Err: errors.New("connection refused")}))
	require.True(IsConnectionError(context.DeadlineExceeded), "a deadline is evidence the remote did not answer in time")
	require.False(IsConnectionError(context.Canceled))
	// http.Client wraps a canceled request in a *url.Error, which implements
	// net.Error unconditionally — the shape a browser navigate-away produces.
	require.False(IsConnectionError(&url.Error{Op: "Get", URL: "https://remote", Err: context.Canceled}))
	require.False(IsConnectionError(errors.New("an API-level error")))
}
