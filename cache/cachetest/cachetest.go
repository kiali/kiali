// Package cachetest provides the shared test setup for a KialiCache wired to fake clients
// and a configurable ClusterAccess - the recipe every test exercising degraded or
// partially-revoked clusters needs. It lives in its own package (not kubetest) because the
// cache package's own internal tests import kubetest, so kubetest cannot import cache.
package cachetest

import (
	"context"

	ctrlclient "sigs.k8s.io/controller-runtime/pkg/client"

	"github.com/kiali/kiali/cache"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
)

// NewFakeKialiCache builds a KialiCache over the given fake SA clients - each client also
// serves as its cluster's cache reader - optionally wiring a ClusterAccess whose live check
// is the given function. A nil check leaves the cache without cluster-access tracking
// (no degradation, no partial revocations). It returns the cache and the ClusterAccess (nil
// when check is nil), so tests can drive ConfirmRevoked and Probe directly.
func NewFakeKialiCache(ctx context.Context, conf *config.Config, clients map[string]kubernetes.ClientInterface, check cache.AccessCheck) (cache.KialiCache, *cache.ClusterAccess, error) {
	readers := make(map[string]ctrlclient.Reader, len(clients))
	for cluster, client := range clients {
		readers[cluster] = client
	}

	var clusterAccess *cache.ClusterAccess
	var opts []cache.Option
	if check != nil {
		clusterAccess = cache.NewClusterAccess(check)
		opts = append(opts, cache.WithClusterAccess(clusterAccess))
	}

	kialiCache, err := cache.NewKialiCache(ctx, clients, readers, *conf, opts...)
	if err != nil {
		return nil, nil, err
	}
	return kialiCache, clusterAccess, nil
}
