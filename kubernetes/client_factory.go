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

// mutex for when modifying the stored clients
var mutex = &sync.RWMutex{}

// when a client is expired, a signal with its tokenHash will be sent to recycleChan
var recycleChan = make(chan string, 10)

// defaultExpirationTime set the default expired time of a client
const defaultExpirationTime = time.Minute * 15

// ClientFactory interface for the clientFactory object
type ClientFactory interface {
	GetClient(authInfo *api.AuthInfo) (ClientInterface, error)
}

// clientFactory used to generate per users clients
type clientFactory struct {
	ClientFactory
	baseIstioConfig *rest.Config
	clientEntries   map[string]*ClientInterface
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

		return newClientFactory(&istioConfig), nil

	}
	return factory, nil
}

// newClientFactory allows for specifying the config and expiry duration
// Mock friendly for testing purposes
func newClientFactory(istioConfig *rest.Config) *clientFactory {
	if factory == nil {
		clientEntriesMap := make(map[string]*ClientInterface)

		factory = &clientFactory{
			baseIstioConfig: istioConfig,
			clientEntries:   clientEntriesMap,
		}

		// after creating a client factory
		// background goroutines will be watching the clients` expiration
		// if a client is expired, it will be removed from clientEntries
		go watchClients(clientEntriesMap)
	}
	return factory
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
			recycleChan <- token
		}
	}(getTokenHash(authInfo), err)

	return newClient, err
}

// GetClient returns a client for the specified token. Creating one if necessary.
func (cf *clientFactory) GetClient(authInfo *api.AuthInfo) (ClientInterface, error) {
	client, err := cf.getClient(authInfo)
	if err != nil {
		return nil, err
	}
	return *client, nil
}

// getClient returns a client for the specified token. Creating one if necessary.
func (cf *clientFactory) getClient(authInfo *api.AuthInfo) (*ClientInterface, error) {
	return cf.getRecycleClient(authInfo, defaultExpirationTime)
}

// getRecycleClient returns a client for the specified token with expirationTime. Creating one if necessary.
func (cf *clientFactory) getRecycleClient(authInfo *api.AuthInfo, expirationTime time.Duration) (*ClientInterface, error) {
	if cEntry, ok := cf.hasClient(authInfo); ok {
		return cEntry, nil
	} else {
		client, err := cf.newClient(authInfo, expirationTime)
		if err != nil {
			log.Errorf("Error fetching the Kubernetes client: %v", err)
			return nil, err
		}

		mutex.Lock()
		cf.clientEntries[getTokenHash(authInfo)] = &client
		internalmetrics.SetKubernetesClients(len(cf.clientEntries))
		mutex.Unlock()
		return &client, nil
	}
}

// hasClient check if clientFactory has a client, return the client if clientFactory has it
func (cf *clientFactory) hasClient(authInfo *api.AuthInfo) (*ClientInterface, bool) {
	tokenHash := getTokenHash(authInfo)
	mutex.RLock()
	cEntry, ok := cf.clientEntries[tokenHash]
	mutex.RUnlock()
	return cEntry, ok
}

// getClientsLength returns the length of clients
func (cf *clientFactory) getClientsLength() int {
	mutex.RLock()
	length := len(cf.clientEntries)
	mutex.RUnlock()
	return length
}

// watchClients listen signal from recycleChan and clean the expired clients
func watchClients(clientEntries map[string]*ClientInterface) {
	for {
		// listen signal from recycleChan
		tokenHash, ok := <-recycleChan
		if !ok {
			log.Error("recycleChan closed when watching clients")
			return
		}
		// clean expired client with its token hash
		mutex.Lock()
		delete(clientEntries, tokenHash)
		internalmetrics.SetKubernetesClients(len(clientEntries))
		mutex.Unlock()
	}
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
