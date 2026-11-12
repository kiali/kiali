package business

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	ctrlclient "sigs.k8s.io/controller-runtime/pkg/client"

	"github.com/kiali/kiali/cache"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
)

// TestSkipUnavailableCluster covers the degraded-cluster decision the per-cluster list
// and status handlers rely on: a remote cluster whose service-account cache cannot serve
// reads is skipped, the home cluster fails, an available cluster proceeds.
func TestSkipUnavailableCluster(t *testing.T) {
	require := require.New(t)

	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = config.DefaultClusterID
	k8s := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("testNamespace"))

	// The home cluster's cache is wired to a revocation check we trigger below; a
	// second, uncached cluster stands in for an unregistered remote.
	access := cache.NewClusterAccess(func(context.Context, string, string, string) (bool, error) {
		return false, nil
	})
	clients := map[string]kubernetes.ClientInterface{config.DefaultClusterID: k8s}
	clusterCache, err := cache.NewKialiCache(context.Background(), clients,
		map[string]ctrlclient.Reader{config.DefaultClusterID: k8s}, *conf, cache.WithClusterAccess(access))
	require.NoError(err)
	layer := NewLayerBuilder(t, conf).WithClient(k8s).WithCache(clusterCache).Build()

	// An available cluster proceeds.
	skip, err := layer.SkipUnavailableCluster(context.Background(), config.DefaultClusterID)
	assert.NoError(t, err)
	assert.False(t, skip, "an available cluster is not skipped")

	// A remote cluster without a cache is skipped, not failed.
	skip, err = layer.SkipUnavailableCluster(context.Background(), "remote-cluster")
	assert.NoError(t, err)
	assert.True(t, skip, "a remote cluster with no cache is skipped")

	// Degrade the home cluster (revoked access confirmed): it is not skippable, its
	// cache being unavailable fails the request.
	access.ConfirmRevoked(context.Background(), config.DefaultClusterID, "apps", "deployments")
	skip, err = layer.SkipUnavailableCluster(context.Background(), config.DefaultClusterID)
	assert.Error(t, err)
	assert.False(t, skip, "the home cluster is never skipped")
}
