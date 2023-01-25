package kubernetes

import (
	"crypto/md5"
	"sync"
	"time"

	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd/api"

	kialiConfig "github.com/kiali/kiali/config"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/prometheus/internalmetrics"
)

var factory *clientFactory

// defaultExpirationTime set the default expired time of a client
const defaultExpirationTime = time.Minute * 15

const HomeClusterName = "_kiali_home"

// ClientFactory interface for the clientFactory object
type ClientFactory interface {
	GetClient(authInfo *api.AuthInfo) (ClientInterface, error)
	GetSAClients() map[string]ClientInterface
	GetSAHomeClusterClient() ClientInterface
}

// clientFactory used to generate per users clients
type clientFactory struct {
	baseIstioConfig *rest.Config
	clientEntries   map[string]ClientInterface
	// mutex for when modifying the stored clients
	mutex sync.RWMutex
	// when a client is expired, a signal with its tokenHash will be sent to recycleChan
	recycleChan chan string
	// maps cluster name to a kiali client for that cluster. The kiali client uses the
	// kiali service account to access the cluster API.
	saClientEntries map[string]ClientInterface
}

// GetClientFactory returns the client factory. Creates a new one if necessary
func GetClientFactory() (ClientFactory, error) {
	if factory == nil {
		// Get the normal configuration
		config, err := ConfigClient()
		if err != nil {
			return nil, err
		}

		// Create a new config based on what was gathered above but don't specify the bearer token to use
		istioConfig := rest.Config{
			Host:            config.Host,
			TLSClientConfig: config.TLSClientConfig,
			QPS:             config.QPS,
			Burst:           config.Burst,
		}

		cf, err := newClientFactory(&istioConfig)
		if err != nil {
			return nil, err
		}

		factory = cf
	}
	return factory, nil
}

// newClientFactory allows for specifying the config and expiry duration
// Mock friendly for testing purposes
func newClientFactory(istioConfig *rest.Config) (*clientFactory, error) {
	f := &clientFactory{
		baseIstioConfig: istioConfig,
		clientEntries:   make(map[string]ClientInterface),
		recycleChan:     make(chan string),
		saClientEntries: make(map[string]ClientInterface),
	}
	// after creating a client factory
	// background goroutines will be watching the clients` expiration
	// if a client is expired, it will be removed from clientEntries
	go f.watchClients()

	// Create serivce account clients.
	// TODO: Create a service account client for each cluster. Need a way to get all configured clusters.
	// TODO: Use a real cluster name instead of "home"
	clusters := []string{HomeClusterName}
	for _, cluster := range clusters {
		client, err := f.newSAClient(cluster)
		if err != nil {
			return nil, err
		}
		f.saClientEntries[cluster] = client
	}

	return f, nil
}

// newClient creates a new ClientInterface based on a users k8s token
func (cf *clientFactory) newClient(authInfo *api.AuthInfo, expirationTime time.Duration) (ClientInterface, error) {
	config := *cf.baseIstioConfig

	config.BearerToken = authInfo.Token

	// There is a feature when using OpenID strategy to allow using a proxy
	// for the cluster API.  People may want to place a proxy in
	// front of the cluster API when using Kubernetes-as-a-service and
	// the provider does not support configuring OpenID integration.
	// If OpenID integration is not available, people may opt into
	// an API proxy (like kube-oidc-proxy) as a workaround for OIDC integration.
	// Clearly, under this scenario, the cluster API must be accessed
	// through the proxy (not directly).
	//
	// So, if OpenID strategy is active, check if a proxy is configured.
	// If there is, use it UNLESS the token is the one of the Kiali SA. If
	// the token is the one of the Kiali SA, the proxy can be bypassed.
	cfg := kialiConfig.Get()
	if cfg.Auth.Strategy == kialiConfig.AuthStrategyOpenId && cfg.Auth.OpenId.ApiProxy != "" && cfg.Auth.OpenId.ApiProxyCAData != "" {
		kialiToken, err := GetKialiToken()
		if err != nil {
			return nil, err
		}

		if kialiToken != authInfo.Token {
			// Using `UseRemoteCreds` function as a  helper
			apiProxyConfig, errProxy := UseRemoteCreds(&RemoteSecret{
				Clusters: []RemoteSecretClusterListItem{
					{
						Cluster: RemoteSecretCluster{
							CertificateAuthorityData: cfg.Auth.OpenId.ApiProxyCAData,
							Server:                   cfg.Auth.OpenId.ApiProxy,
						},
						Name: "api_proxy",
					},
				},
			})

			if errProxy != nil {
				return nil, errProxy
			}

			config.Host = apiProxyConfig.Host
			config.TLSClientConfig = apiProxyConfig.TLSClientConfig
		}
	}

	// Impersonation is valid only for header authentication strategy
	if cfg.Auth.Strategy == kialiConfig.AuthStrategyHeader && authInfo.Impersonate != "" {
		config.Impersonate.UserName = authInfo.Impersonate
		config.Impersonate.Groups = authInfo.ImpersonateGroups
		config.Impersonate.Extra = authInfo.ImpersonateUserExtra
	}

	newClient, err := NewClientFromConfig(&config)

	// check if client is created correctly
	// if it is true, run to recycle client
	// if it is not, the token should not be added to recycleChan
	go func(token string, err error) {
		if err == nil {
			<-time.After(expirationTime)
			cf.recycleChan <- token
		}
	}(getTokenHash(authInfo), err)

	return newClient, err
}

func (cf *clientFactory) newSAClient(cluster string) (*K8SClient, error) {
	// TODO: Need a way to load in cluster configuration from the kube secret.
	if kialiConfig.Get().InCluster {
		if saToken, err := GetKialiToken(); err != nil {
			return nil, err
		} else {
			cf.baseIstioConfig.BearerToken = saToken
		}
	}

	return NewClientFromConfig(cf.baseIstioConfig)
}

// GetClient returns a client for the specified token. Creating one if necessary.
func (cf *clientFactory) GetClient(authInfo *api.AuthInfo) (ClientInterface, error) {
	client, err := cf.getClient(authInfo)
	if err != nil {
		return nil, err
	}
	return client, nil
}

// getClient returns a client for the specified token. Creating one if necessary.
func (cf *clientFactory) getClient(authInfo *api.AuthInfo) (ClientInterface, error) {
	return cf.getRecycleClient(authInfo, defaultExpirationTime)
}

// getRecycleClient returns a client for the specified token with expirationTime. Creating one if necessary.
func (cf *clientFactory) getRecycleClient(authInfo *api.AuthInfo, expirationTime time.Duration) (ClientInterface, error) {
	cf.mutex.Lock()
	defer cf.mutex.Unlock()
	tokenHash := getTokenHash(authInfo)
	if cEntry, ok := cf.clientEntries[tokenHash]; ok {
		return cEntry, nil
	} else {
		client, err := cf.newClient(authInfo, expirationTime)
		if err != nil {
			log.Errorf("Error fetching the Kubernetes client: %v", err)
			return nil, err
		}

		cf.clientEntries[getTokenHash(authInfo)] = client
		internalmetrics.SetKubernetesClients(len(cf.clientEntries))
		return client, nil
	}
}

// hasClient check if clientFactory has a client, return the client if clientFactory has it
// This is a helper function for testing.
// It uses the shared lock so beware of nested locking with other methods.
func (cf *clientFactory) hasClient(authInfo *api.AuthInfo) (ClientInterface, bool) {
	tokenHash := getTokenHash(authInfo)
	cf.mutex.RLock()
	cEntry, ok := cf.clientEntries[tokenHash]
	cf.mutex.RUnlock()
	return cEntry, ok
}

// getClientsLength returns the length of clients.
// This is a helper function for testing.
// It uses the shared lock so beware of nested locking with other methods.
func (cf *clientFactory) getClientsLength() int {
	cf.mutex.Lock()
	defer cf.mutex.Unlock()
	return len(cf.clientEntries)
}

// watchClients listen signal from recycleChan and clean the expired clients
func (cf *clientFactory) watchClients() {
	for {
		// listen signal from recycleChan
		tokenHash, ok := <-cf.recycleChan
		if !ok {
			log.Error("recycleChan closed when watching clients")
			return
		}
		// clean expired client with its token hash
		cf.deleteClient(tokenHash)
	}
}

func (cf *clientFactory) deleteClient(token string) {
	cf.mutex.Lock()
	defer cf.mutex.Unlock()
	delete(cf.clientEntries, token)
	internalmetrics.SetKubernetesClients(len(cf.clientEntries))
}

// getTokenHash get the token hash of a client
func getTokenHash(authInfo *api.AuthInfo) string {
	tokenData := authInfo.Token

	if authInfo.Impersonate != "" {
		tokenData += authInfo.Impersonate
	}

	if authInfo.ImpersonateGroups != nil {
		for _, group := range authInfo.ImpersonateGroups {
			tokenData += group
		}
	}

	if authInfo.ImpersonateUserExtra != nil {
		for key, element := range authInfo.ImpersonateUserExtra {
			for _, userExtra := range element {
				tokenData += key + userExtra
			}
		}
	}

	h := md5.New()
	_, err := h.Write([]byte(tokenData))
	if err != nil {
		// errcheck linter want us to check for the error returned by h.Write.
		// However, docs of md5 say that this Writer never returns an error.
		// See: https://golang.org/pkg/hash/#Hash
		// So, let's check the error, and panic. Per the docs, this panic should
		// never be reached.
		panic("md5.Write returned error.")
	}
	return string(h.Sum(nil))
}

// KialiSAClients returns all clients associated with the Kiali service account across clusters.
func (cf *clientFactory) GetSAClients() map[string]ClientInterface {
	cf.mutex.RLock()
	defer cf.mutex.RUnlock()

	for cluster := range cf.saClientEntries {
		if err := cf.refreshClientIfTokenChanged(cluster); err != nil {
			log.Errorf("Unable to refresh Kiali SA client for cluster: %s. Err: %s", cluster, err)
		}
	}

	return cf.saClientEntries
}

// Check for kiali token changes and refresh the client when it does.
func (cf *clientFactory) refreshClientIfTokenChanged(cluster string) error {
	kialiSAToken, err := GetKialiToken()
	if err != nil {
		return err
	}

	if cf.saClientEntries[cluster].GetToken() != kialiSAToken {
		log.Debugf("Kiali SA token has changed, refreshing client for cluster: %s", cluster)
		// Token has changed, so we need to refresh the client.
		newClient, err := cf.newSAClient(cluster)
		if err != nil {
			return err
		}
		cf.saClientEntries[cluster] = newClient
	}

	return nil
}

// KialiSAHomeCluster returns the Kiali service account client for the cluster where Kiali is running.
func (cf *clientFactory) GetSAHomeClusterClient() ClientInterface {
	cf.mutex.RLock()
	defer cf.mutex.RUnlock()

	if err := cf.refreshClientIfTokenChanged(HomeClusterName); err != nil {
		log.Errorf("Unable to refresh Kiali SA client for home cluster. Err: %s", err)
	}

	// TODO: Use a real cluster name instead of "home"
	return cf.saClientEntries[HomeClusterName]
}
