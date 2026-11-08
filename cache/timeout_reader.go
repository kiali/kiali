package cache

// Assisted-by: Claude Code

import (
	"context"
	"time"

	"sigs.k8s.io/controller-runtime/pkg/client"
)

// timeoutReader bounds every read of a cluster's kube cache. The informer cache blocks a read
// until its informer syncs, and an informer that lost access to its cluster never syncs, so a
// read with a context that is never cancelled would otherwise block forever.
type timeoutReader struct {
	inner   client.Reader
	timeout time.Duration
}

func (r timeoutReader) Get(ctx context.Context, key client.ObjectKey, obj client.Object, opts ...client.GetOption) error {
	ctx, cancel := context.WithTimeout(ctx, r.timeout)
	defer cancel()
	return r.inner.Get(ctx, key, obj, opts...)
}

func (r timeoutReader) List(ctx context.Context, list client.ObjectList, opts ...client.ListOption) error {
	ctx, cancel := context.WithTimeout(ctx, r.timeout)
	defer cancel()
	return r.inner.List(ctx, list, opts...)
}

// withReadTimeout wraps each cluster's reader in a timeoutReader. A timeout of zero or less leaves them unbounded.
func withReadTimeout(readers map[string]client.Reader, timeout time.Duration) map[string]client.Reader {
	if timeout <= 0 {
		return readers
	}
	wrapped := make(map[string]client.Reader, len(readers))
	for cluster, reader := range readers {
		wrapped[cluster] = timeoutReader{inner: reader, timeout: timeout}
	}
	return wrapped
}
