package kubernetes

import (
	"fmt"
	"math/rand"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd/api"

	"github.com/kiali/kiali/config"
)

// TestClientExpiration Verify the details that clients expire are correct
func TestClientExpiration(t *testing.T) {
	assert := assert.New(t)
	require := require.New(t)

	istioConfig := rest.Config{}
	clientFactory, err := newClientFactory(&istioConfig)
	require.NoError(err)

	// Make sure we are starting off with an empty set of clients
	assert.Equal(0, clientFactory.getClientsLength())

	// Create a single initial test clients
	authInfo := api.NewAuthInfo()
	authInfo.Token = "foo-token"
	_, err = clientFactory.getRecycleClient(authInfo, 100*time.Millisecond)
	require.NoError(err)

	// Verify we have the client
	assert.Equal(1, clientFactory.getClientsLength())
	_, found := clientFactory.hasClient(authInfo)
	assert.True(found)

	// Sleep for a bit and add another client
	time.Sleep(time.Millisecond * 60)
	authInfo1 := api.NewAuthInfo()
	authInfo1.Token = "bar-token"
	_, err = clientFactory.getRecycleClient(authInfo1, 100*time.Millisecond)
	require.NoError(err)

	// Verify we have both the foo and bar clients
	assert.Equal(2, clientFactory.getClientsLength())
	_, found = clientFactory.hasClient(authInfo)
	assert.True(found)
	_, found = clientFactory.hasClient(authInfo1)
	assert.True(found)

	// Wait for foo to be expired
	time.Sleep(time.Millisecond * 60)
	// Verify the client has been removed
	assert.Equal(1, clientFactory.getClientsLength())
	_, found = clientFactory.hasClient(authInfo)
	assert.False(found)
	_, found = clientFactory.hasClient(authInfo1)
	assert.True(found)

	// Wait for bar to be expired
	time.Sleep(time.Millisecond * 60)
	assert.Equal(0, clientFactory.getClientsLength())
}

// TestConcurrentClientExpiration Verify Concurrent clients are expired correctly
func TestConcurrentClientExpiration(t *testing.T) {
	assert := assert.New(t)
	require := require.New(t)

	istioConfig := rest.Config{}
	clientFactory, err := newClientFactory(&istioConfig)
	require.NoError(err)
	count := 100

	wg := sync.WaitGroup{}
	wg.Add(count)

	for i := 0; i < count; i++ {
		go func() {
			defer wg.Done()
			authInfo := api.NewAuthInfo()
			authInfo.Token = fmt.Sprintf("%d", rand.Intn(10000000000))
			_, innerErr := clientFactory.getRecycleClient(authInfo, 10*time.Millisecond)
			assert.NoError(innerErr)
		}()
	}

	wg.Wait()
	time.Sleep(3 * time.Second)

	assert.Equal(0, clientFactory.getClientsLength())
}

// TestConcurrentClientFactory test Concurrently create ClientFactory
func TestConcurrentClientFactory(t *testing.T) {
	assert := assert.New(t)
	istioConfig := rest.Config{}
	count := 100

	wg := sync.WaitGroup{}
	wg.Add(count)

	for i := 0; i < count; i++ {
		go func() {
			defer wg.Done()
			_, err := newClientFactory(&istioConfig)
			assert.NoError(err)
		}()
	}

	wg.Wait()
}

func TestSAHomeClientUpdatesWhenKialiTokenChanges(t *testing.T) {
	assert := assert.New(t)
	require := require.New(t)
	kialiConfig := config.NewConfig()
	config.Set(kialiConfig)
	t.Cleanup(func() {
		// Other tests use this global var so we need to reset it.
		KialiTokenForHomeCluster = ""
	})

	tokenRead = time.Now()
	KialiTokenForHomeCluster = "current-token"

	restConfig := rest.Config{}
	clientFactory, err := newClientFactory(&restConfig)
	require.NoError(err)

	currentClient := clientFactory.GetSAHomeClusterClient()
	assert.Equal(KialiTokenForHomeCluster, currentClient.GetToken())
	assert.Equal(currentClient, clientFactory.GetSAHomeClusterClient())

	KialiTokenForHomeCluster = "new-token"

	// Assert that the token has changed and the client has changed.
	newClient := clientFactory.GetSAHomeClusterClient()
	assert.Equal(KialiTokenForHomeCluster, newClient.GetToken())
	assert.NotEqual(currentClient, newClient)
}

func TestSAClientsUpdateWhenKialiTokenChanges(t *testing.T) {
	require := require.New(t)
	kialiConfig := config.NewConfig()
	config.Set(kialiConfig)
	t.Cleanup(func() {
		// Other tests use this global var so we need to reset it.
		KialiTokenForHomeCluster = ""
	})

	tokenRead = time.Now()
	KialiTokenForHomeCluster = "current-token"

	restConfig := rest.Config{}
	clientFactory, err := newClientFactory(&restConfig)
	require.NoError(err)

	client := clientFactory.GetSAClient(HomeClusterName)
	require.Equal(KialiTokenForHomeCluster, client.GetToken())

	KialiTokenForHomeCluster = "new-token"

	client = clientFactory.GetSAClient(HomeClusterName)
	require.Equal(KialiTokenForHomeCluster, client.GetToken())
}
