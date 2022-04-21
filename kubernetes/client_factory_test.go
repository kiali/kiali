package kubernetes

import (
	"fmt"
	"math/rand"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd/api"
)

// TestClientExpiration Verify the details that clients expire are correct
func TestClientExpiration(t *testing.T) {

	istioConfig := rest.Config{}
	clientFactory := newClientFactory(&istioConfig)

	// Make sure we are starting off with an empty set of clients
	assert.Equal(t, 0, clientFactory.getClientsLength())

	// Create a single initial test clients
	authInfo := api.NewAuthInfo()
	authInfo.Token = "foo-token"
	_, err := clientFactory.getRecycleClient(authInfo, 100*time.Millisecond)
	if err != nil {
		assert.Nil(t, err)
	}

	// Verify we have the client
	assert.Equal(t, 1, clientFactory.getClientsLength())
	_, found := clientFactory.hasClient(authInfo)
	assert.True(t, found)

	// Sleep for a bit and add another client
	time.Sleep(time.Millisecond * 60)
	authInfo1 := api.NewAuthInfo()
	authInfo1.Token = "bar-token"
	_, err = clientFactory.getRecycleClient(authInfo1, 100*time.Millisecond)
	if err != nil {
		assert.Nil(t, err)
	}

	// Verify we have both the foo and bar clients
	assert.Equal(t, 2, clientFactory.getClientsLength())
	_, found = clientFactory.hasClient(authInfo)
	assert.True(t, found)
	_, found = clientFactory.hasClient(authInfo1)
	assert.True(t, found)

	// Wait for foo to be expired
	time.Sleep(time.Millisecond * 60)
	// Verify the client has been removed
	assert.Equal(t, 1, clientFactory.getClientsLength())
	_, found = clientFactory.hasClient(authInfo)
	assert.False(t, found)
	_, found = clientFactory.hasClient(authInfo1)
	assert.True(t, found)

	// Wait for bar to be expired
	time.Sleep(time.Millisecond * 60)
	assert.Equal(t, 0, clientFactory.getClientsLength())
}

// TestConcurrentClientExpiration Verify Concurrent clients are expired correctly
func TestConcurrentClientExpiration(t *testing.T) {
	istioConfig := rest.Config{}
	clientFactory := newClientFactory(&istioConfig)
	count := 100

	wg := sync.WaitGroup{}
	wg.Add(count)

	for i := 0; i < count; i++ {
		go func() {
			authInfo := api.NewAuthInfo()
			authInfo.Token = fmt.Sprintf("%d", rand.Intn(10000000000))
			if _, err := clientFactory.getRecycleClient(authInfo, 10*time.Millisecond); err != nil {
				assert.Nil(t, err)
			}
			wg.Done()
		}()
	}

	wg.Wait()
	time.Sleep(3 * time.Second)

	assert.Equal(t, 0, clientFactory.getClientsLength())
}

// TestConcurrentClientFactory test Concurrently create ClientFactory
func TestConcurrentClientFactory(t *testing.T) {
	istioConfig := rest.Config{}
	count := 100

	wg := sync.WaitGroup{}
	wg.Add(count)

	for i := 0; i < count; i++ {
		go func() {
			newClientFactory(&istioConfig)
			wg.Done()
		}()
	}

	wg.Wait()
}
