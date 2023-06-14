package kubernetes

import (
	"fmt"
	"math/rand"
	"os"
	"sync"
	"testing"
	"time"

	"gopkg.in/yaml.v2"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd/api"

	"github.com/kiali/kiali/config"
)

func newTestingClientFactory(t *testing.T) *clientFactory {
	t.Helper()
	clientConfig := rest.Config{}
	client, err := newClientFactory(&clientConfig)
	if err != nil {
		t.Fatalf("Error creating client factory: %v", err)
	}
	return client
}

// TestClientExpiration Verify the details that clients expire are correct
func TestClientExpiration(t *testing.T) {
	assert := assert.New(t)
	require := require.New(t)
	conf := config.Get()

	istioConfig := rest.Config{}
	clientFactory, err := newClientFactory(&istioConfig)
	require.NoError(err)

	// Make sure we are starting off with an empty set of clients
	assert.Equal(0, clientFactory.getClientsLength())

	// Create a single initial test clients
	authInfo := api.NewAuthInfo()
	authInfo.Token = "foo-token"
	_, err = clientFactory.getRecycleClient(authInfo, 100*time.Millisecond, conf.KubernetesConfig.ClusterName)
	require.NoError(err)

	// Verify we have the client
	assert.Equal(1, clientFactory.getClientsLength())
	_, found := clientFactory.hasClient(authInfo)
	assert.True(found)

	// Sleep for a bit and add another client
	time.Sleep(time.Millisecond * 60)
	authInfo1 := api.NewAuthInfo()
	authInfo1.Token = "bar-token"
	_, err = clientFactory.getRecycleClient(authInfo1, 100*time.Millisecond, conf.KubernetesConfig.ClusterName)
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
			_, innerErr := clientFactory.getRecycleClient(authInfo, 10*time.Millisecond, config.Get().KubernetesConfig.ClusterName)
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
	conf := config.NewConfig()
	config.Set(conf)
	t.Cleanup(func() {
		// Other tests use this global var so we need to reset it.
		KialiTokenForHomeCluster = ""
	})

	tokenRead = time.Now()
	KialiTokenForHomeCluster = "current-token"

	restConfig := rest.Config{}
	clientFactory, err := newClientFactory(&restConfig)
	require.NoError(err)

	client := clientFactory.GetSAClient(conf.KubernetesConfig.ClusterName)
	require.Equal(KialiTokenForHomeCluster, client.GetToken())

	KialiTokenForHomeCluster = "new-token"

	client = clientFactory.GetSAClient(conf.KubernetesConfig.ClusterName)
	require.Equal(KialiTokenForHomeCluster, client.GetToken())
}

// Helper function to create a test remote cluster secret file from a RemoteSecret.
// It will cleanup after itself when the test is done.
func createTestRemoteClusterSecret(t *testing.T, remoteSecret RemoteSecret) {
	t.Helper()
	// create a mock volume mount directory where the test remote cluster secret content will go
	originalRemoteClusterSecretsDir := RemoteClusterSecretsDir
	t.Cleanup(func() {
		RemoteClusterSecretsDir = originalRemoteClusterSecretsDir
	})
	RemoteClusterSecretsDir = t.TempDir()

	marshalledRemoteSecretData, err := yaml.Marshal(remoteSecret)
	if err != nil {
		t.Fatalf("Failed to marshal remote secret data: %v", err)
	}
	createTestRemoteClusterSecretFile(t, RemoteClusterSecretsDir, remoteSecret.Clusters[0].Name, string(marshalledRemoteSecretData))
}

// Helper function to create a test token to standin for the kiali token.
func newFakeToken(t *testing.T) {
	t.Helper()
	tokenDir := t.TempDir()
	fileName := tokenDir + "/token"
	oldTokenPath := DefaultServiceAccountPath
	oldToken := KialiTokenForHomeCluster
	t.Cleanup(func() {
		DefaultServiceAccountPath = oldTokenPath
		KialiTokenForHomeCluster = oldToken
	})
	DefaultServiceAccountPath = fileName
	if err := os.WriteFile(fileName, []byte("fake-token"), 0o644); err != nil {
		t.Fatalf("Failed to create fake token: %v", err)
	}
}

func TestClientCreatedWithClusterInfo(t *testing.T) {
	// Create a fake cluster info file.
	// Ensure client gets created with this.
	// Need to test newClient and newSAClient
	// Need to test that home cluster gets this info as well
	require := require.New(t)
	assert := assert.New(t)

	conf := config.NewConfig()
	config.Set(conf)

	const (
		testClusterName = "TestRemoteCluster"
	)
	remoteSecretData := RemoteSecret{
		Clusters: []RemoteSecretClusterListItem{
			{
				Name: testClusterName,
				Cluster: RemoteSecretCluster{
					Server: "https://192.168.1.2:1234",
				},
			},
		},
		Users: []RemoteSecretUser{
			{
				Name: "remoteuser1",
				User: RemoteSecretUserAuthInfo{
					Token: "remotetoken1",
				},
			},
		},
	}

	createTestRemoteClusterSecret(t, remoteSecretData)
	newFakeToken(t)

	clientFactory := newTestingClientFactory(t)

	// Service account clients
	saClients := clientFactory.GetSAClients()
	require.Contains(saClients, testClusterName)
	require.Contains(saClients, conf.KubernetesConfig.ClusterName)
	assert.Equal(testClusterName, saClients[testClusterName].ClusterInfo().Name)
	assert.Equal("https://192.168.1.2:1234", saClients[testClusterName].ClusterInfo().ClientConfig.Host)
	assert.Contains(saClients[conf.KubernetesConfig.ClusterName].ClusterInfo().Name, conf.KubernetesConfig.ClusterName)

	// User clients
	userClients, err := clientFactory.GetClients(api.NewAuthInfo())
	require.NoError(err)

	require.Contains(userClients, testClusterName)
	require.Contains(userClients, conf.KubernetesConfig.ClusterName)
	assert.Equal(testClusterName, userClients[testClusterName].ClusterInfo().Name)
	assert.Equal("https://192.168.1.2:1234", userClients[testClusterName].ClusterInfo().ClientConfig.Host)
	assert.Contains(userClients[conf.KubernetesConfig.ClusterName].ClusterInfo().Name, conf.KubernetesConfig.ClusterName)
}
