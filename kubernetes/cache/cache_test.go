package cache

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
)

// Need to lock the client when we go to check the value of the token
// but only the tests need this functionality so we can use a fake
// that has access to the kubeCache's lock and has a getClient() method
// that returns the client after locking. Without this, the tests will
// fail with the race detector enabled.
type fakeKubeCache struct {
	*kubeCache
}

func (f *fakeKubeCache) getClient() kubernetes.ClientInterface {
	f.kubeCache.cacheLock.RLock()
	defer f.kubeCache.cacheLock.RUnlock()
	return f.kubeCache.client
}

func TestClientUpdatedWhenSAClientChanges(t *testing.T) {
	require := require.New(t)
	config := config.NewConfig()

	client := kubetest.NewFakeK8sClient()
	client.Token = "current-token"
	clientFactory := kubetest.NewK8SClientFactoryMock(client)
	k8sCache, err := NewKubeCache(client, *config, emptyHandler)
	require.NoError(err)

	kubeCache := &fakeKubeCache{kubeCache: k8sCache}
	kialiCache := &kialiCacheImpl{
		clientRefreshPollingPeriod: time.Millisecond,
		clientFactory:              clientFactory,
		KubeCache:                  kubeCache,
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	kialiCache.watchForClientChanges(ctx, client.Token)

	// Update the client. This should trigger a cache refresh.
	newClient := kubetest.NewFakeK8sClient()
	newClient.Token = "new-token"
	clientFactory.SetK8s(newClient)

	require.Eventually(
		func() bool { return kubeCache.getClient() != client },
		500*time.Millisecond,
		5*time.Millisecond,
		"client and cache should have been updated",
	)
}
