package kubernetes

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"k8s.io/client-go/rest"
)

// TestClientExpiry Verify that clients expire
func TestClientExpiry(t *testing.T) {
	istioConfig := rest.Config{}
	clientFactory, _ := getClientFactory(&istioConfig, time.Millisecond*100)

	clientEntries := clientFactory.clientEntries
	// Make sure we are starting off with an empty set of clients
	mutex.RLock()
	assert.Equal(t, 0, len(clientEntries))
	mutex.RUnlock()

	mutex.Lock()
	// Create a single initial test client
	clientEntries["foo"] = &clientEntry{
		created: time.Now(),
	}
	mutex.Unlock()

	// Verify we have the client
	mutex.RLock()
	assert.Equal(t, 1, len(clientEntries))
	_, found := clientEntries["foo"]
	mutex.RUnlock()
	assert.True(t, found)

	// Sleep for a bit and add another client
	time.Sleep(time.Millisecond * 25)
	mutex.Lock()
	clientEntries["bar"] = &clientEntry{
		created: time.Now(),
	}
	mutex.Unlock()

	// Verify we have both the foo and bar clients
	mutex.RLock()
	assert.Equal(t, 2, len(clientEntries))
	_, found = clientEntries["foo"]
	assert.True(t, found)
	_, found = clientEntries["bar"]
	assert.True(t, found)
	mutex.RUnlock()

	// Wait for foo to be expired
	time.Sleep(time.Millisecond * 100)
	// Verify the client has been removed
	mutex.RLock()
	assert.Equal(t, 1, len(clientEntries))
	_, found = clientEntries["foo"]
	assert.False(t, found)
	_, found = clientEntries["bar"]
	assert.True(t, found)
	mutex.RUnlock()

	// Wait for bar to be expired
	time.Sleep(time.Millisecond * 125)
	mutex.RLock()
	assert.Equal(t, 0, len(clientEntries))
	mutex.RUnlock()
}
