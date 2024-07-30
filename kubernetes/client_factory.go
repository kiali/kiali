package kubernetes

import (
	"context"
	"crypto/md5"
	"encoding/base64"
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

// ClientFactory interface for the clientFactory object
type ClientFactory interface {
	GetClient(authInfo *api.AuthInfo, cluster string) (ClientInterface, error)
	GetClients(authInfos map[string]*api.AuthInfo) (map[string]ClientInterface, error)
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

	kialiConfig *kialiConfig.Config

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
		if factory != nil {
			return
		}

		factory, err = getClientFactory(*kialiConfig.Get())
	})
	return factory, err
}

func getClientFactory(conf kialiConfig.Config) (*clientFactory, error) {
	// Get the normal configuration
	var config *rest.Config
	config, err := getConfigForLocalCluster()
	if err != nil {
		return nil, err
	}

	// Create a new config based on what was gathered above but don't specify the bearer token to use
	baseConfig := rest.Config{
		Host:            config.Host, // TODO: do we need this? remote cluster clients should ignore this
		TLSClientConfig: config.TLSClientConfig,
		QPS:             conf.KubernetesConfig.QPS,
		Burst:           conf.KubernetesConfig.Burst,
	}

	return newClientFactory(&conf, &baseConfig)
}

// NewClientFactory creates a new client factory that can be transitory.
// Callers should close the ctx when done with the client factory.
// Does not set the global ClientFactory. You should probably use
// GetClientFactory instead of this method unless you temporaily need
// to create a client like when Kiali sets the cluster id.
func NewClientFactory(ctx context.Context, conf kialiConfig.Config) (ClientFactory, error) {
	cf, err := getClientFactory(conf)
	if err != nil {
		return nil, err
	}

	// Need to cleanup the recycle chan since this client factory could be transitory.
	go func() {
		<-ctx.Done()
		log.Debug("Stopping client factory recycle chan")
		close(cf.recycleChan)
	}()

	return cf, nil
}

// newClientFactory allows for specifying the config and expiry duration
// Mock friendly for testing purposes
func newClientFactory(conf *kialiConfig.Config, restConfig *rest.Config) (*clientFactory, error) {
	f := &clientFactory{
		kialiConfig:     conf,
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
		return nil, fmt.Errorf("unable to create home cluster Kiali Service Account client. Err: %s", err)
	}

	f.saClientEntries[f.homeCluster] = homeClient

	for cluster, clusterInfo := range remoteClusterInfos {
		client, err := f.newSAClient(&clusterInfo)
		if err != nil {
			return nil, fmt.Errorf("unable to create remote Kiali Service Account client. Err: %s", err)
		}
		f.saClientEntries[cluster] = client
	}

	return f, nil
}

// newClient creates a new ClientInterface based on a users k8s token. It is assumed users do not have a token file in authInfo.
func (cf *clientFactory) newClient(authInfo *api.AuthInfo, expirationTime time.Duration, cluster string) (ClientInterface, error) {
	config := *cf.baseRestConfig

	config.BearerToken = authInfo.Token
	config.BearerTokenFile = ""

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
	if cf.kialiConfig.Auth.Strategy == kialiConfig.AuthStrategyOpenId && cf.kialiConfig.Auth.OpenId.ApiProxy != "" && cf.kialiConfig.Auth.OpenId.ApiProxyCAData != "" {
		// Override the CA data on the client with the proxy CA from the Kiali config.
		caData := cf.kialiConfig.Auth.OpenId.ApiProxyCAData
		rootCaDecoded, err := base64.StdEncoding.DecodeString(caData)
		if err != nil {
			return nil, err
		}

		config.TLSClientConfig = rest.TLSClientConfig{
			CAData: []byte(rootCaDecoded),
		}
		config.Host = cf.kialiConfig.Auth.OpenId.ApiProxy
	}

	// Impersonation is valid only for header authentication strategy
	if cf.kialiConfig.Auth.Strategy == kialiConfig.AuthStrategyHeader && authInfo.Impersonate != "" {
		config.Impersonate.UserName = authInfo.Impersonate
		config.Impersonate.Groups = authInfo.ImpersonateGroups
		config.Impersonate.Extra = authInfo.ImpersonateUserExtra
	}

	var newClient ClientInterface
	if cluster == cf.homeCluster {
		client, err := newClientWithRemoteClusterInfo(&config, nil)
		if err != nil {
			log.Errorf("Error creating client for cluster %s: %s", cluster, err.Error())
			return nil, err
		}
		newClient = client
	} else {
		// Remote clusters
		clusterInfos, err := GetRemoteClusterInfos()
		if err != nil {
			log.Errorf("Error getting remote cluster infos: %c", err)
			return nil, err
		}

		clusterInfo, ok := clusterInfos[cluster]
		if !ok {
			return nil, fmt.Errorf("unable to find cluster [%s] in remote cluster info", cluster)
		}

		remoteConfig, err := cf.getConfig(&clusterInfo)
		if err != nil {
			log.Errorf("Error getting remote cluster [%s] info: %s", cluster, err)
			return nil, err
		}

		// Replace the Kiali SA token with the user's auth token.
		remoteConfig.BearerToken = authInfo.Token
		remoteConfig.BearerTokenFile = ""

		newClient, err = newClientWithRemoteClusterInfo(remoteConfig, &clusterInfo)
		if err != nil {
			log.Errorf("Error getting remote client for cluster [%s]. Err: %s", cluster, err.Error())
			return nil, err
		}
	}

	// run to recycle client
	go func(token string) {
		<-time.After(expirationTime)
		cf.recycleChan <- token
	}(getTokenHash(authInfo))

	return newClient, nil
}

// newSAClient returns a new client for the given cluster. If clusterInfo is nil then a client for the local cluster is returned.
func (cf *clientFactory) newSAClient(remoteClusterInfo *RemoteClusterInfo) (*K8SClient, error) {
	log.Debug("Creating new Kiali Service Account client")
	// if no cluster info is provided, we are being asked to create a new client for the home cluster
	config, err := cf.getConfig(remoteClusterInfo)
	if err != nil {
		return nil, err
	}

	client, err := newClientWithRemoteClusterInfo(config, remoteClusterInfo)
	if err != nil {
		return nil, err
	}

	return client, nil
}

// getClient returns a client for the specified token. Creating one if necessary.
func (cf *clientFactory) GetSAClients() map[string]ClientInterface {
	cf.mutex.RLock()
	defer cf.mutex.RUnlock()
	return cf.saClientEntries
}

// getClient returns a client for the specified token. Creating one if necessary.
func (cf *clientFactory) GetClient(authInfo *api.AuthInfo, cluster string) (ClientInterface, error) {
	if cf.kialiConfig.RBACDisabled() {
		return cf.GetSAClient(cluster), nil
	}

	return cf.getRecycleClient(authInfo, defaultExpirationTime, cluster)
}

// getClient returns a client for the specified token. Creating one if necessary.
func (cf *clientFactory) GetClients(authInfos map[string]*api.AuthInfo) (map[string]ClientInterface, error) {
	if cf.kialiConfig.RBACDisabled() {
		return cf.GetSAClients(), nil
	}

	clients := make(map[string]ClientInterface)
	for cluster, authInfo := range authInfos {
		ci, err := cf.getRecycleClient(authInfo, defaultExpirationTime, cluster)
		if err != nil {
			log.Errorf("Error returning user client for cluster: %s. Err: %s", cluster, err)
		}
		clients[cluster] = ci
	}

	if len(clients) == 0 {
		return nil, errors.New("unable to create any user clients")
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
			log.Debug("recycleChan closed when watching clients")
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
	cf.mutex.RLock()
	defer cf.mutex.RUnlock()
	return cf.saClientEntries[cluster]
}

// KialiSAHomeClusterClient returns the Kiali service account client for the cluster where Kiali is running.
func (cf *clientFactory) GetSAHomeClusterClient() ClientInterface {
	return cf.GetSAClient(cf.homeCluster)
}

func (cf *clientFactory) getConfig(clusterInfo *RemoteClusterInfo) (*rest.Config, error) {
	kialiConfig := kialiConfig.Get()
	clientConfig := *cf.baseRestConfig

	// Remote Cluster
	if clusterInfo != nil {
		remoteConfig, err := clusterInfo.Config.ClientConfig()
		if err != nil {
			return nil, err
		}

		// Use the remote config entirely for remote clusters.
		clientConfig = *remoteConfig
	} else {
		// Just read the token and then use the base config.
		// We're an in cluster client. Read the kiali service account token.
		kialiToken, kialiTokenFile, err := GetKialiTokenForHomeCluster()
		if err != nil {
			return nil, fmt.Errorf("unable to get Kiali service account token: %s", err)
		}

		// Copy over the base rest config and the token
		clientConfig.BearerToken = kialiToken
		clientConfig.BearerTokenFile = kialiTokenFile
	}

	if !kialiConfig.KialiFeatureFlags.Clustering.EnableExecProvider {
		clientConfig.ExecProvider = nil
	}

	// Override some settings with what's in kiali config
	clientConfig.QPS = kialiConfig.KubernetesConfig.QPS
	clientConfig.Burst = kialiConfig.KubernetesConfig.Burst

	return &clientConfig, nil
}
