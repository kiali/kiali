package cache

// Assisted-by: Claude Code

import (
	"context"
	"errors"
	"time"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"sigs.k8s.io/controller-runtime/pkg/client"

	"github.com/kiali/kiali/log"
)

// timeoutReader bounds every read of a cluster's kube cache. The informer cache blocks a read
// until its informer syncs, and an informer that lost access to its cluster never syncs, so a
// read with a context that is never cancelled would otherwise block forever.
type timeoutReader struct {
	cluster string
	inner   client.Reader
	timeout time.Duration
}

func (r timeoutReader) Get(ctx context.Context, key client.ObjectKey, obj client.Object, opts ...client.GetOption) error {
	ctx, cancel := context.WithTimeout(ctx, r.timeout)
	defer cancel()
	err := r.inner.Get(ctx, key, obj, opts...)
	r.warnIfTimedOut(ctx, "Get", err)
	return err
}

func (r timeoutReader) List(ctx context.Context, list client.ObjectList, opts ...client.ListOption) error {
	ctx, cancel := context.WithTimeout(ctx, r.timeout)
	defer cancel()
	err := r.inner.List(ctx, list, opts...)
	r.warnIfTimedOut(ctx, "List", err)
	return err
}

// warnIfTimedOut surfaces reads that failed because their deadline expired. When a cluster's
// informers cannot sync (e.g. its access was revoked after a watch-error teardown) every read
// times out; without this log there is no server-side signal tying slow or failing requests to
// the cluster, and the next investigation needs a goroutine dump.
func (r timeoutReader) warnIfTimedOut(ctx context.Context, op string, err error) {
	if err == nil {
		return
	}
	if !errors.Is(ctx.Err(), context.DeadlineExceeded) && !apierrors.IsTimeout(err) {
		return
	}
	log.WithGroup(log.KialiCacheLogName).Warn().Msgf(
		"Kube cache read timed out (cluster=[%s], operation=[%s], timeout=[%s]). The cluster's informers may be unable to sync; reads will recover if access is restored. err=%s",
		r.cluster, op, r.timeout, err)
}

// withReadTimeout wraps each cluster's reader in a timeoutReader. A timeout of zero or less leaves them unbounded.
func withReadTimeout(readers map[string]client.Reader, timeout time.Duration) map[string]client.Reader {
	if timeout <= 0 {
		return readers
	}
	wrapped := make(map[string]client.Reader, len(readers))
	for cluster, reader := range readers {
		wrapped[cluster] = timeoutReader{cluster: cluster, inner: reader, timeout: timeout}
	}
	return wrapped
}
