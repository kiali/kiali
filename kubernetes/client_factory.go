package kubernetes

import (
	"crypto/md5"
	"errors"
	"fmt"
	"sync"
	"time"

	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd/api"

	kialiConfig "github.com/kiali/kiali/config"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/prometheus/internalmetrics"
)

// the cached factory - only one is ever created; once created it is cached here
var factory *clientFactory

// Ensures only one factory is created
var once sync.Once

// defaultExpirationTime set the default expired time of a client
const defaultExpirationTime = time.Minute * 15

// cluster name to denote the cluster where Kiali is deployed
// If you need an SA client connected to the home cluster, use GetSAHomeClusterClient()
// instead of this. This gets set when newClientFactory() is called.
// TODO: Deprecated - remove this.
var (
	HomeClusterName = ""
)

// ClientFactory interface for the clientFactory object
type ClientFactory interface {
	GetClient(authInfo *api.AuthInfo) (ClientInterface, error) // TODO: Make private
	GetClients(authInfo *api.AuthInfo) (map[string]ClientInterface, error)
	GetSAClient(cluster string) ClientInterface
	GetSAClients() map[string]ClientInterface
	GetSAHomeClusterClient() ClientInterface
}

// clientFactory used to generate per users clients
type clientFactory struct {
	// baseRestConfig contains some of the base rest config to be used for all clients.
	// Not all of the data in this base config is used - some will be overridden per client like token and host info.
	baseRestConfig *rest.Config

	// clientEntries contain user clients that are used to authenticate as logged in users.
	// Keyed by hash code generated from auth data.
	clientEntries map[string]map[string]ClientInterface // By token by cluster

	// Name of the home cluster. This is the cluster where Kiali is deployed which is usually the
	// "in cluster" config. This name comes from the istio cluster id.
	homeCluster string

	// mutex for when accessing the stored clients
	mutex sync.RWMutex

	// when a client is expired, a signal with its tokenHash will be sent to recycleChan
	recycleChan chan string

	// remoteClusterInfos contains information on all remote clusters taken from the remote cluster secrets, keyed on cluster name.
	remoteClusterInfos map[string]RemoteClusterInfo

	// maps cluster name to a kiali client for that cluster. The kiali client uses the
	// kiali service account to access the cluster API.
	saClientEntries map[string]ClientInterface
}

// GetClientFactory returns the client factory. Creates a new one if necessary
func GetClientFactory() (ClientFactory, error) {
	var err error
	once.Do(func() {
		HomeClusterName = kialiConfig.Get().KubernetesConfig.ClusterName
		// Get the normal configuration
		var config *rest.Config
		config, err = GetConfigForLocalCluster()
		if err != nil {
			return
		}

		// Create a new config based on what was gathered above but don't specify the bearer token to use
		baseConfig := rest.Config{
			Host:            config.Host, // TODO: do we need this? remote cluster clients should ignore this
			TLSClientConfig: config.TLSClientConfig,
			QPS:             config.QPS,
			Burst:           config.Burst,
		}

		factory, err = newClientFactory(&baseConfig)
	})
	return factory, err
}

// newClientFactory allows for specifying the config and expiry duration
// Mock friendly for testing purposes
func newClientFactory(restConfig *rest.Config) (*clientFactory, error) {
	f := &clientFactory{
		baseRestConfig:  restConfig,
		clientEntries:   make(map[string]map[string]ClientInterface),
		recycleChan:     make(chan string),
		saClientEntries: make(map[string]ClientInterface),
		homeCluster:     kialiConfig.Get().KubernetesConfig.ClusterName,
	}
	// after creating a client factory
	// background goroutines will be watching the clients` expiration
	// if a client is expired, it will be removed from clientEntries
	go f.watchClients()

	// obtain details on all known remote clusters
	remoteClusterInfos, err := GetRemoteClusterInfos()
	if err != nil {
		return nil, err
	}
	f.remoteClusterInfos = remoteClusterInfos

	// Create serivce account clients for the home cluster and each remote cluster.
	// Note that this means each remote cluster secret token must be given the proper permissions
	// in that remote cluster for Kiali to do its work. i.e. logging into a remote cluster with the
	// remote cluster secret token must be given the same permissions as the local cluster Kiali SA.
	homeClient, err := f.newSAClient(nil)
	if err != nil {
		return nil, err
	}

	f.saClientEntries[f.homeCluster] = homeClient

	for _, clusterInfo := range remoteClusterInfos {
		client, err := f.newSAClient(&clusterInfo)
		if err != nil {
			return nil, err
		}
		f.saClientEntries[clusterInfo.Cluster.Name] = client
	}

	return f, nil
}

// newClient creates a new ClientInterface based on a users k8s token
func (cf *clientFactory) newClient(authInfo *api.AuthInfo, expirationTime time.Duration, cluster string) (ClientInterface, error) {
	config := *cf.baseRestConfig

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

		var kialiToken string
		var err error

		if cluster == cf.homeCluster {
			kialiToken, err = GetKialiTokenForHomeCluster()
		} else {
			kialiToken, err = cf.GetSAClient(cluster).GetToken(), nil
		}

		if err != nil {
			return nil, err
		}

		if kialiToken != authInfo.Token {
			// Using `UseRemoteCreds` function as a helper
			apiProxyConfig, errProxy := GetConfigForRemoteCluster(RemoteSecretClusterListItem{
				Cluster: RemoteSecretCluster{
					CertificateAuthorityData: cfg.Auth.OpenId.ApiProxyCAData,
					Server:                   cfg.Auth.OpenId.ApiProxy,
				},
				Name: "api_proxy",
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

	var newClient ClientInterface
	var err error

	if cluster == cf.homeCluster {
		newClient, err = NewClientFromConfig(&config)
		if err != nil {
			log.Errorf("Error creating client for cluster %s: %s", cluster, err.Error())
			return nil, err
		}

	} else {
		// Remote clusters
		clusterInfo, errClusterInfo := GetRemoteClusterInfos()
		if errClusterInfo == nil {
			var remoteConfig *rest.Config
			var err2 error
			// In auth strategy should we use SA token
			if cfg.Auth.Strategy == kialiConfig.AuthStrategyAnonymous {
				remoteConfig, err2 = GetConfigForRemoteClusterInfo(clusterInfo[cluster])
			} else {
				remoteConfig, err2 = GetConfigWithTokenForRemoteCluster(clusterInfo[cluster].Cluster,
					RemoteSecretUser{
						Name: authInfo.Username, User: RemoteSecretUserToken{Token: authInfo.Token},
					})
			}

			if err2 != nil {
				log.Errorf("Error getting remote cluster [%s] info: %s", cluster, err2)
			}
			newClient, err = NewClientFromConfig(remoteConfig)
			if err != nil {
				log.Errorf("Error getting remote client for cluster %s, %s", cluster, err.Error())
			}
		} else {
			log.Errorf("Error getting remote cluster infos: %c", errClusterInfo)
		}
	}

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

// newSAClient returns a new client for the given cluster. If clusterInfo is nil then a client for the local cluster is returned.
func (cf *clientFactory) newSAClient(clusterInfo *RemoteClusterInfo) (*K8SClient, error) {
	// if no cluster info is provided, we are being asked to create a new client for the home cluster
	if clusterInfo == nil {
		config := *cf.baseRestConfig
		if kialiConfig.Get().InCluster {
			if saToken, err := GetKialiTokenForHomeCluster(); err != nil {
				return nil, err
			} else {
				config.BearerToken = saToken
			}
		}
		return NewClientFromConfig(&config)
	}

	if config, err := GetConfigForRemoteClusterInfo(*clusterInfo); err != nil {
		return nil, err
	} else {
		return NewClientFromConfig(config)
	}
}

// getClient returns a client for the specified token. Creating one if necessary.
func (cf *clientFactory) GetSAClients() map[string]ClientInterface {
	cf.mutex.RLock()
	defer cf.mutex.RUnlock()
	return cf.saClientEntries
}

// getClient returns a client for the specified token. Creating one if necessary.
func (cf *clientFactory) GetClient(authInfo *api.AuthInfo) (ClientInterface, error) {
	return cf.getRecycleClient(authInfo, defaultExpirationTime, cf.homeCluster)
}

// getClient returns a client for the specified token. Creating one if necessary.
func (cf *clientFactory) GetClients(authInfo *api.AuthInfo) (map[string]ClientInterface, error) {
	clients := make(map[string]ClientInterface)
	// Try to create a user client for each cluster there's a kiali service account configured.
	for cluster := range cf.saClientEntries {
		ci, err := cf.getRecycleClient(authInfo, defaultExpirationTime, cluster)
		if err != nil {
			log.Errorf("Error returning user client for cluster: %s. Err: %s", cluster, err)
		}
		clients[cluster] = ci
	}

	if len(clients) == 0 {
		return nil, errors.New("unable to create create any user clients")
	}

	return clients, nil
}

// getRecycleClient returns a client for the specified token with expirationTime. Creating one if necessary.
func (cf *clientFactory) getRecycleClient(authInfo *api.AuthInfo, expirationTime time.Duration, cluster string) (ClientInterface, error) {
	cf.mutex.Lock()
	defer cf.mutex.Unlock()
	tokenHash := getTokenHash(authInfo)
	if cEntry, ok := cf.clientEntries[tokenHash][cluster]; ok {
		return cEntry, nil
	} else {
		client, err := cf.newClient(authInfo, expirationTime, cluster)
		if err != nil {
			log.Errorf("Error fetching the Kubernetes client: %v", err)
			return nil, err
		}

		if cf.clientEntries[tokenHash] == nil {
			cf.clientEntries[tokenHash] = make(map[string]ClientInterface)
		}
		cf.clientEntries[tokenHash][cluster] = client
		internalmetrics.SetKubernetesClients(len(cf.clientEntries))
		return client, nil
	}
}

// hasClient check if clientFactory has a client, return the client if clientFactory has it
// This is a helper function for testing.
// It uses the shared lock so beware of nested locking with other methods.
func (cf *clientFactory) hasClient(authInfo *api.AuthInfo) (map[string]ClientInterface, bool) {
	tokenHash := getTokenHash(authInfo)
	cf.mutex.RLock()
	cEntry, ok := cf.clientEntries[tokenHash]
	defer cf.mutex.RUnlock()
	return cEntry, ok
}

// getClientsLength returns the length of clients.
// This is a helper function for testing.
// It uses the shared lock so beware of nested locking with other methods.
func (cf *clientFactory) getClientsLength() int {
	cf.mutex.RLock()
	defer cf.mutex.RUnlock()
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
	internalmetrics.SetKubernetesClients(len(cf.clientEntries)) // TODO: + 2 dimmension map?
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
func (cf *clientFactory) GetSAClient(cluster string) ClientInterface {
	// while we are here, refresh the client
	if err := cf.refreshClientIfTokenChanged(cluster); err != nil {
		log.Errorf("Unable to refresh Kiali SA client for cluster [%s]: %v", cluster, err)
	}

	cf.mutex.RLock()
	defer cf.mutex.RUnlock()
	return cf.saClientEntries[cluster]
}

// Check for kiali token changes and refresh the client when it does.
func (cf *clientFactory) refreshClientIfTokenChanged(cluster string) error {
	var refreshTheClient bool // will be true if the client needs to be refreshed
	var rci *RemoteClusterInfo

	if cluster == cf.homeCluster {
		// LOCAL CLUSTER
		if newTokenToCheck, err := GetKialiTokenForHomeCluster(); err != nil {
			return err
		} else {
			cf.mutex.RLock()
			client, ok := cf.saClientEntries[cluster]
			cf.mutex.RUnlock()
			if !ok {
				return fmt.Errorf("There is no home cluster SA client to refresh")
			}
			refreshTheClient = client.GetToken() != newTokenToCheck
			rci = nil
		}
	} else {
		// REMOTE CLUSTER
		cf.mutex.RLock()
		remoteRci, ok := cf.remoteClusterInfos[cluster]
		cf.mutex.RUnlock()
		if !ok {
			return fmt.Errorf("Cannot refresh token for unknown cluster [%s]", cluster)
		} else {
			if reloadedRci, err := reloadRemoteClusterInfoFromFile(remoteRci); err != nil {
				return err
			} else {
				refreshTheClient = (reloadedRci != nil) // note that anything (not just the token) that changed will trigger the client to be refreshed
				rci = reloadedRci
			}
		}
	}

	if refreshTheClient {
		log.Debugf("Kiali SA token has changed for cluster [%s], refreshing the client", cluster)
		newClient, err := cf.newSAClient(rci)
		if err != nil {
			return err
		}
		cf.mutex.Lock()
		cf.saClientEntries[cluster] = newClient
		cf.mutex.Unlock()
	}

	return nil
}

// KialiSAHomeClusterClient returns the Kiali service account client for the cluster where Kiali is running.
func (cf *clientFactory) GetSAHomeClusterClient() ClientInterface {
	return cf.GetSAClient(cf.homeCluster)
}
