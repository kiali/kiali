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

// Mutex for when modifying the stored clients
var mutex = &sync.RWMutex{}

const expirationTime = time.Minute * 15

// ClientFactory interface for the clientFactory object
type ClientFactory interface {
	GetClient(authInfo *api.AuthInfo) (ClientInterface, error)
}

// clientFactory used to generate per users clients
type clientFactory struct {
	ClientFactory
	baseIstioConfig *rest.Config
	clientEntries   map[string]*clientEntry
}

// clientEntry stored the client and its created timestamp
type clientEntry struct {
	client  ClientInterface
	created time.Time
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

		return getClientFactory(&istioConfig, expirationTime)

	}
	return factory, nil
}

// newClientFactory allows for specifying the config and expiry duration
// Mock friendly for testing purposes
func getClientFactory(istioConfig *rest.Config, expiry time.Duration) (*clientFactory, error) {
	mutex.Lock()
	if factory == nil {
		clientEntriesMap := make(map[string]*clientEntry)

		factory = &clientFactory{
			baseIstioConfig: istioConfig,
			clientEntries:   clientEntriesMap,
		}

		go watchClients(clientEntriesMap, expiry)
	}
	mutex.Unlock()
	return factory, nil
}

// NewClient creates a new ClientInterface based on a users k8s token
func (cf *clientFactory) newClient(authInfo *api.AuthInfo) (ClientInterface, error) {
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

	return NewClientFromConfig(&config)
}

// GetClient returns a client for the specified token. Creating one if necessary.
func (cf *clientFactory) GetClient(authInfo *api.AuthInfo) (ClientInterface, error) {
	clientEntry, err := cf.getClientEntry(authInfo)
	if err != nil {
		return nil, err
	}
	return clientEntry.client, nil
}

// getClientEntry returns a clientEntry for the specified token. Creating one if necessary.
func (cf *clientFactory) getClientEntry(authInfo *api.AuthInfo) (*clientEntry, error) {
	tokenHash := getTokenHash(authInfo)
	mutex.RLock()
	cEntry, ok := cf.clientEntries[tokenHash]
	mutex.RUnlock()
	if ok {
		return cEntry, nil
	} else {
		client, err := cf.newClient(authInfo)
		if err != nil {
			log.Errorf("Error fetching the Kubernetes client: %v", err)
			return nil, err
		}

		cEntry := clientEntry{
			client:  client,
			created: time.Now(),
		}

		mutex.Lock()
		cf.clientEntries[tokenHash] = &cEntry
		mutex.Unlock()
		internalmetrics.SetKubernetesClients(len(cf.clientEntries))
		return &cEntry, nil
	}
}

// watchClients loops over clients and removes ones which are too old
func watchClients(clientEntries map[string]*clientEntry, expiry time.Duration) {
	for {
		time.Sleep(expiry)
		mutex.Lock()
		for token, clientEntry := range clientEntries {
			if time.Since(clientEntry.created) > expiry {
				delete(clientEntries, token)
			}
		}
		internalmetrics.SetKubernetesClients(len(clientEntries))
		mutex.Unlock()
	}
}

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
