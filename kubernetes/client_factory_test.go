package kubernetes

import (
	"context"
	_ "embed"
	"encoding/base64"
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

var (
	//go:embed testdata/remote-cluster-exec.yaml
	remoteClusterExecYAML string

	//go:embed testdata/remote-cluster.yaml
	remoteClusterYAML string

	//go:embed testdata/proxy-ca.pem
	proxyCAData []byte

	//go:embed testdata/sa-token.yaml
	saTokenYAML string
)

// TestClientExpiration Verify the details that clients expire are correct
func TestClientExpiration(t *testing.T) {
	assert := assert.New(t)
	require := require.New(t)
	conf := config.Get()
	conf.Auth.Strategy = config.AuthStrategyOpenId
	conf.Auth.OpenId.DisableRBAC = false
	SetConfig(t, *conf)

	clientFactory := NewTestingClientFactory(t)

	// Make sure we are starting off with an empty set of clients
	assert.Equal(0, clientFactory.getClientsLength())

	// Create a single initial test clients
	authInfo := api.NewAuthInfo()
	authInfo.Token = "foo-token"
	_, err := clientFactory.getRecycleClient(authInfo, 100*time.Millisecond, conf.KubernetesConfig.ClusterName)
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

	clientFactory := NewTestingClientFactory(t)
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
	require := require.New(t)
	istioConfig := rest.Config{}
	count := 100

	wg := sync.WaitGroup{}
	wg.Add(count)

	setGlobalKialiSAToken(t)

	for i := 0; i < count; i++ {
		go func() {
			defer wg.Done()
			_, err := newClientFactory(&istioConfig)
			require.NoError(err)
		}()
	}

	wg.Wait()
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

	const testClusterName = "TestRemoteCluster"
	createTestRemoteClusterSecret(t, testClusterName, remoteClusterYAML)

	clientFactory := NewTestingClientFactory(t)

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

func TestClientCreatedWithAuthStrategyAnonymous(t *testing.T) {
	// Create a fake cluster info file.
	// Ensure client gets created with this.
	// For AuthStrategyAnonymous ensure newClient for remote cluster has token from remote config.
	require := require.New(t)
	assert := assert.New(t)

	conf := config.NewConfig()
	conf.Auth.Strategy = config.AuthStrategyAnonymous

	config.Set(conf)

	const testClusterName = "TestRemoteCluster"
	const testUserToken = "TestUserToken"

	createTestRemoteClusterSecret(t, testClusterName, remoteClusterYAML)
	clientFactory := NewTestingClientFactory(t)

	// Create a single initial test clients
	authInfo := api.NewAuthInfo()
	authInfo.Token = testUserToken

	// User clients
	userClients, err := clientFactory.GetClients(authInfo)
	require.NoError(err)

	require.Contains(userClients, testClusterName)
	assert.Equal(testClusterName, userClients[testClusterName].ClusterInfo().Name)
	assert.Equal(userClients[testClusterName].GetToken(), "token")
	assert.NotEqual(userClients[testClusterName].GetToken(), testUserToken)
}

func TestClientCreatedWithAuthStrategyOpenIdAndDisableRBAC(t *testing.T) {
	// Create a fake cluster info file.
	// Ensure client gets created with this.
	// For AuthStrategyOpenId and DisableRBAC ensure newClient for remote cluster has token from remote config.
	require := require.New(t)
	assert := assert.New(t)

	conf := config.NewConfig()
	conf.Auth.Strategy = config.AuthStrategyOpenId
	conf.Auth.OpenId.DisableRBAC = true

	config.Set(conf)

	const testClusterName = "TestRemoteCluster"
	const testUserToken = "TestUserToken"
	createTestRemoteClusterSecret(t, testClusterName, remoteClusterYAML)
	clientFactory := NewTestingClientFactory(t)

	// Create a single initial test clients
	authInfo := api.NewAuthInfo()
	authInfo.Token = testUserToken

	// User clients
	userClients, err := clientFactory.GetClients(authInfo)
	require.NoError(err)

	require.Contains(userClients, testClusterName)
	assert.Equal(userClients[testClusterName].GetToken(), "token")
	assert.NotEqual(userClients[testClusterName].GetToken(), testUserToken)
}

func TestClientCreatedWithAuthStrategyOpenIdAndDisableRBACFalse(t *testing.T) {
	// Create a fake cluster info file.
	// Ensure client gets created with this.
	// For AuthStrategyOpenId and DisableRBAC is off ensure newClient for remote cluster has user token.
	require := require.New(t)
	assert := assert.New(t)

	conf := config.NewConfig()
	conf.Auth.Strategy = config.AuthStrategyOpenId
	conf.Auth.OpenId.DisableRBAC = false

	config.Set(conf)

	const testClusterName = "TestRemoteCluster"
	const testUserToken = "TestUserToken"
	createTestRemoteClusterSecret(t, testClusterName, remoteClusterYAML)
	clientFactory := NewTestingClientFactory(t)

	// Create a single initial test clients
	authInfo := api.NewAuthInfo()
	authInfo.Token = testUserToken

	// User clients
	userClients, err := clientFactory.GetClients(authInfo)
	require.NoError(err)

	require.Contains(userClients, testClusterName)
	assert.Equal(testClusterName, userClients[testClusterName].ClusterInfo().Name)
	assert.Equal(userClients[testClusterName].GetToken(), testUserToken)
	assert.NotEqual(userClients[testClusterName].GetToken(), "token")
}

func TestSAClientCreatedWithExecProvider(t *testing.T) {
	// by default, ExecProvider support should be disabled
	cases := map[string]struct {
		remoteSecretContents string
		expected             rest.Config
	}{
		"Only bearer token": {
			remoteSecretContents: remoteClusterYAML,
			expected: rest.Config{
				BearerToken:  "token",
				ExecProvider: nil,
			},
		},
		"Use bearer token and exec credentials (which should be ignored)": {
			remoteSecretContents: remoteClusterExecYAML,
			expected: rest.Config{
				BearerToken:  "token",
				ExecProvider: nil,
			},
		},
	}

	for name, tc := range cases {
		t.Run(name, func(t *testing.T) {
			require := require.New(t)
			const clusterName = "TestRemoteCluster"

			originalSecretsDir := RemoteClusterSecretsDir
			t.Cleanup(func() {
				RemoteClusterSecretsDir = originalSecretsDir
			})
			RemoteClusterSecretsDir = t.TempDir()

			createTestRemoteClusterSecretFile(t, RemoteClusterSecretsDir, clusterName, tc.remoteSecretContents)
			cf := NewTestingClientFactory(t)

			saClients := cf.GetSAClients()
			// Should be home cluster client and one remote client
			require.Equal(2, len(saClients))
			require.Contains(saClients, clusterName)

			clientConfig := saClients[clusterName].ClusterInfo().ClientConfig
			require.Equal(tc.expected.BearerToken, clientConfig.BearerToken)
			require.Nil(clientConfig.ExecProvider)
		})
	}

	// now enable ExecProvider support
	conf := config.NewConfig()
	conf.KialiFeatureFlags.Clustering.EnableExecProvider = true
	SetConfig(t, *conf)

	cases = map[string]struct {
		remoteSecretContents string
		expected             rest.Config
	}{
		"Only bearer token": {
			remoteSecretContents: remoteClusterYAML,
			expected: rest.Config{
				BearerToken:  "token",
				ExecProvider: nil,
			},
		},
		"Use bearer token and exec credentials": {
			remoteSecretContents: remoteClusterExecYAML,
			expected: rest.Config{
				BearerToken: "token",
				ExecProvider: &api.ExecConfig{
					Command: "command",
					Args:    []string{"arg1", "arg2"},
				},
			},
		},
	}

	for name, tc := range cases {
		t.Run(name, func(t *testing.T) {
			require := require.New(t)
			const clusterName = "TestRemoteCluster"

			originalSecretsDir := RemoteClusterSecretsDir
			t.Cleanup(func() {
				RemoteClusterSecretsDir = originalSecretsDir
			})
			RemoteClusterSecretsDir = t.TempDir()

			createTestRemoteClusterSecretFile(t, RemoteClusterSecretsDir, clusterName, tc.remoteSecretContents)
			cf := NewTestingClientFactory(t)

			saClients := cf.GetSAClients()
			// Should be home cluster client and one remote client
			require.Equal(2, len(saClients))
			require.Contains(saClients, clusterName)

			clientConfig := saClients[clusterName].ClusterInfo().ClientConfig
			require.Equal(tc.expected.BearerToken, clientConfig.BearerToken)
			if tc.expected.ExecProvider != nil {
				// Just check a few fields for sanity
				require.Equal(tc.expected.ExecProvider.Command, clientConfig.ExecProvider.Command)
				require.Equal(tc.expected.ExecProvider.Args, clientConfig.ExecProvider.Args)
			}
		})
	}
}

func setGlobalKialiSAToken(t *testing.T) {
	t.Helper()

	// reuse the "create a test remote cluster secret file" function, but for this test it is really representing our home cluster SA token
	saTokenDir := t.TempDir()
	createTestRemoteClusterSecretFile(t, saTokenDir, "saSecret", saTokenYAML)

	originalToken := KialiTokenForHomeCluster
	originalTokenFile := KialiTokenFileForHomeCluster
	t.Cleanup(func() {
		KialiTokenForHomeCluster = originalToken
		KialiTokenFileForHomeCluster = originalTokenFile
		tokenRead = time.Time{}
	})

	KialiTokenForHomeCluster = "test-token" // as defined in testdata/sa-token.yaml
	KialiTokenFileForHomeCluster = ""
	tokenRead = time.Now()
}

func TestClientCreatedWithProxyInfo(t *testing.T) {
	require := require.New(t)

	cfg := config.NewConfig()
	cfg.Deployment.RemoteSecretPath = t.TempDir() // Random dir so that the remote secret isn't read if it exists.
	cfg.Auth.Strategy = config.AuthStrategyOpenId
	cfg.Auth.OpenId.ApiProxyCAData = base64.StdEncoding.EncodeToString(proxyCAData)
	cfg.Auth.OpenId.ApiProxy = "https://api-proxy:8443"
	SetConfig(t, *cfg)

	clientFactory := NewTestingClientFactory(t)

	// Regular clients should have the proxy info
	client, err := clientFactory.GetClient(api.NewAuthInfo(), cfg.KubernetesConfig.ClusterName)
	require.NoError(err)

	require.Equal(cfg.Auth.OpenId.ApiProxy, client.ClusterInfo().ClientConfig.Host)
	require.Equal(proxyCAData, client.ClusterInfo().ClientConfig.CAData)

	// Service account clients should not have the proxy info.
	// Two ways to get a SA client: 1. GetClient with SA token and 2. GetSAClient
	setGlobalKialiSAToken(t)
	authInfo := api.NewAuthInfo()
	authInfo.Token = KialiTokenForHomeCluster

	client, err = clientFactory.GetClient(authInfo, cfg.KubernetesConfig.ClusterName)
	require.NoError(err)

	require.NotEqual(cfg.Auth.OpenId.ApiProxy, client.ClusterInfo().ClientConfig.Host)
	require.NotEqual(proxyCAData, client.ClusterInfo().ClientConfig.CAData)

	client = clientFactory.GetSAClient(cfg.KubernetesConfig.ClusterName)
	require.NotEqual(cfg.Auth.OpenId.ApiProxy, client.ClusterInfo().ClientConfig.Host)
	require.NotEqual(proxyCAData, client.ClusterInfo().ClientConfig.CAData)
}

func TestNewClientFactoryClosesRecycleWhenCTXCancelled(t *testing.T) {
	require := require.New(t)

	// Create the remote secret so that the "in cluster" config is not used.
	// Otherwise the "in cluster" config looks for some env vars that are not present.
	const testClusterName = "TestRemoteCluster"
	filename := createTestRemoteClusterSecret(t, testClusterName, remoteClusterYAML)

	cfg := config.NewConfig()
	cfg.Deployment.RemoteSecretPath = filename
	SetConfig(t, *cfg)

	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)
	f, err := NewClientFactory(ctx, *cfg)
	t.Cleanup(func() {
		KialiTokenForHomeCluster = ""     // Need to reset this global because other tests depend on it being empty.
		KialiTokenFileForHomeCluster = "" // Need to reset this global because other tests depend on it being empty.
	})
	require.NoError(err)
	factory := f.(*clientFactory)

	cancel()

	select {
	case <-time.After(200 * time.Millisecond):
		require.Fail("recycleChan should have been closed")
	case <-factory.recycleChan:
	}
}

func TestNewClientFactoryDoesNotSetGlobalClientFactory(t *testing.T) {
	require := require.New(t)

	// Make sure global is nil before test begins
	if factory != nil {
		factory = nil
	}

	// Create the remote secret so that the "in cluster" config is not used.
	// Otherwise the "in cluster" config looks for some env vars that are not present.
	const testClusterName = "TestRemoteCluster"
	filename := createTestRemoteClusterSecret(t, testClusterName, remoteClusterYAML)

	cfg := config.NewConfig()
	cfg.Deployment.RemoteSecretPath = filename
	SetConfig(t, *cfg)

	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)
	_, err := NewClientFactory(ctx, *cfg)
	t.Cleanup(func() {
		KialiTokenForHomeCluster = ""     // Need to reset this global because other tests depend on it being empty.
		KialiTokenFileForHomeCluster = "" // Need to reset this global because other tests depend on it being empty.
	})
	require.NoError(err)

	require.Nil(factory)
}

func TestClientFactoryReturnsSAClientWhenConfigClusterNameIsEmpty(t *testing.T) {
	require := require.New(t)

	// Create the remote secret so that the "in cluster" config is not used.
	// Otherwise the "in cluster" config looks for some env vars that are not present.
	const testClusterName = "TestRemoteCluster"
	filename := createTestRemoteClusterSecret(t, testClusterName, remoteClusterYAML)

	cfg := config.NewConfig()
	cfg.Deployment.RemoteSecretPath = filename
	cfg.KubernetesConfig.ClusterName = ""
	SetConfig(t, *cfg)

	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)
	clientFactory, err := NewClientFactory(ctx, *cfg)
	t.Cleanup(func() {
		KialiTokenForHomeCluster = ""     // Need to reset this global because other tests depend on it being empty.
		KialiTokenFileForHomeCluster = "" // Need to reset this global because other tests depend on it being empty.
	})
	require.NoError(err)

	require.NotNil(clientFactory.GetSAHomeClusterClient())
}
