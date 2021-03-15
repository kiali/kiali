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

var kubeFactory *kubeClientFactory
var meshFactory *meshClientFactory

// Mutex for when modifying the stored clients
var mutex = &sync.RWMutex{}

const expirationTime = time.Minute * 15

// ClientFactory interface for the clientFactory object
type KubeClientFactory interface {
	GetKubeClient(authInfo *api.AuthInfo) (KubeClientInterface, error)
}
type MeshClientFactory interface {
	GetMeshClient(authInfo *api.AuthInfo) (MeshClientInterface, error)
}

// clientFactory used to generate per users clients
type kubeClientFactory struct {
	KubeClientFactory
	baseIstioConfig *rest.Config
	clientEntries   map[string]*kubeClientEntry
}
type meshClientFactory struct {
	MeshClientFactory
	baseIstioConfig *rest.Config
	clientEntries   map[string]*meshClientEntry
}

// clientEntry stored the client and its created timestamp
type kubeClientEntry struct {
	client  KubeClientInterface
	created time.Time
}
type meshClientEntry struct {
	client  MeshClientInterface
	created time.Time
}

// GetClientFactory returns the client factory. Creates a new one if necessary
func GetKubeClientFactory() (KubeClientFactory, error) {
	if kubeFactory == nil {
		// Get the normal configuration
		config, err := ConfigClient(Remote)
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

		return getKubeClientFactory(&istioConfig, expirationTime)

	}
	return kubeFactory, nil
}

// GetClientFactory returns the client factory. Creates a new one if necessary
func GetMeshClientFactory() (MeshClientFactory, error) {
	if meshFactory == nil {
		// Get the normal configuration
		config, err := ConfigClient(Primary)
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

		return getMeshClientFactory(&istioConfig, expirationTime)

	}
	return meshFactory, nil
}

// newClientFactory allows for specifying the config and expiry duration
// Mock friendly for testing purposes
func getKubeClientFactory(istioConfig *rest.Config, expiry time.Duration) (*kubeClientFactory, error) {
	mutex.Lock()
	if kubeFactory == nil {
		clientEntriesMap := make(map[string]*kubeClientEntry)

		kubeFactory = &kubeClientFactory{
			baseIstioConfig: istioConfig,
			clientEntries:   clientEntriesMap,
		}

		go watchKubeClients(clientEntriesMap, expiry)
	}
	mutex.Unlock()
	return kubeFactory, nil
}

// newClientFactory allows for specifying the config and expiry duration
// Mock friendly for testing purposes
func getMeshClientFactory(istioConfig *rest.Config, expiry time.Duration) (*meshClientFactory, error) {
	mutex.Lock()
	if meshFactory == nil {
		clientEntriesMap := make(map[string]*meshClientEntry)

		meshFactory = &meshClientFactory{
			baseIstioConfig: istioConfig,
			clientEntries:   clientEntriesMap,
		}

		go watchMeshClients(clientEntriesMap, expiry)
	}
	mutex.Unlock()
	return meshFactory, nil
}

// NewClient creates a new ClientInterface based on a users k8s token
func (cf *kubeClientFactory) newKubeClient(authInfo *api.AuthInfo) (KubeClientInterface, error) {
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

	return NewKubeClientFromConfig(&config)
}

// NewClient creates a new ClientInterface based on a users k8s token
func (cf *meshClientFactory) newMeshClient(authInfo *api.AuthInfo) (MeshClientInterface, error) {
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

	return NewMeshClientFromConfig(&config)
}

// GetClient returns a client for the specified token. Creating one if necessary.
func (cf *kubeClientFactory) GetKubeClient(authInfo *api.AuthInfo) (KubeClientInterface, error) {
	clientEntry, err := cf.getKubeClientEntry(authInfo)
	if err != nil {
		return nil, err
	}
	return clientEntry.client, nil
}
func (cf *meshClientFactory) GetMeshClient(authInfo *api.AuthInfo) (MeshClientInterface, error) {
	clientEntry, err := cf.getMeshClientEntry(authInfo)
	if err != nil {
		return nil, err
	}
	return clientEntry.client, nil
}

// getClientEntry returns a clientEntry for the specified token. Creating one if necessary.
func (cf *kubeClientFactory) getKubeClientEntry(authInfo *api.AuthInfo) (*kubeClientEntry, error) {
	tokenHash := getTokenHash(authInfo)
	mutex.RLock()
	cEntry, ok := cf.clientEntries[tokenHash]
	mutex.RUnlock()
	if ok {
		return cEntry, nil
	} else {
		client, err := cf.newKubeClient(authInfo)
		if err != nil {
			log.Errorf("Error fetching the Kubernetes client: %v", err)
			return nil, err
		}

		cEntry := kubeClientEntry{
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
func (cf *meshClientFactory) getMeshClientEntry(authInfo *api.AuthInfo) (*meshClientEntry, error) {
	tokenHash := getTokenHash(authInfo)
	mutex.RLock()
	cEntry, ok := cf.clientEntries[tokenHash]
	mutex.RUnlock()
	if ok {
		return cEntry, nil
	} else {
		client, err := cf.newMeshClient(authInfo)
		if err != nil {
			log.Errorf("Error fetching the Kubernetes client: %v", err)
			return nil, err
		}

		cEntry := meshClientEntry{
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
func watchKubeClients(clientEntries map[string]*kubeClientEntry, expiry time.Duration) {
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
func watchMeshClients(clientEntries map[string]*meshClientEntry, expiry time.Duration) {
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
