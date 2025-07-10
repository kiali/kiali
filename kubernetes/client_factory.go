package kubernetes

import (
	"context"
	"crypto/sha256"
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

// ClientFactory interface for the clientFactory object. The factory is the source
// for all User Clients (UserClientInterface) and SA Clients (ClientInterface).
// User Clients are those that have read and write capabilities, and perform those
// functions as a specific user who has provided credentials and logged in.
// SA clients are those that have read-only capabilities and use the Kiali SA
// credentials for access.
type ClientFactory interface {
	GetClient(authInfo *api.AuthInfo, cluster string) (UserClientInterface, error)
	GetClients(authInfos map[string]*api.AuthInfo) (map[string]UserClientInterface, error)
	GetSAClient(cluster string) ClientInterface
	GetSAClients() map[string]ClientInterface
	GetSAHomeClusterClient() ClientInterface
	// we really don't want to expose this, but we need to give this to kiali main.
	// There is a TODO to remove this. See comments at NewLayerWithSAClients
	GetSAClientsAsUserClientInterfaces() map[string]UserClientInterface
}

// clientFactory used to generate per users clients
type clientFactory struct {
	// baseRestConfig contains some of the base rest config to be used for all clients.
	// Not all of the data in this base config is used - some will be overridden per client like token and host info.
	baseRestConfig *rest.Config

	// clientEntries contain user clients that are used to authenticate as logged in users.
	// Keyed by hash code generated from auth data.
	clientEntries map[string]map[string]UserClientInterface // By token by cluster

	// Name of the cluster on which Kiali is deployed. If Istio is co-deployed this will be Istio's clusterID, otherwise it
	// will be set to the local config Host.
	homeCluster string

	kialiConfig *kialiConfig.Config

	// mutex for when accessing the stored clients
	mutex sync.RWMutex

	// when a client is expired, a signal with its tokenHash will be sent to recycleChan
	recycleChan chan string

	// remoteClusterInfos contains information on all remote clusters taken from the remote cluster secrets, keyed on cluster name.
	remoteClusterInfos map[string]RemoteClusterInfo

	// saClientEntries is a map of cluster name to a Kiali SA client for that cluster.
	// The Kiali SA client uses the Kiali service account to access the cluster API.
	// Note that the underlying type for this map is UserClientInterface but this is only because
	// the SA clients may need write capabilities in some special cases (i.e. when RBAC mode is disabled,
	// or anonymous mode is used). However, for safety the client factory should normally cast these
	// clients to ClientInterface to enforce read-only capabilities for SA clients (which is what they
	// are supposed to be under normal circumstances. It is only when you explicitly want to use SA clients
	// to write data when you expose them as UserClientInterface. Again, this is only for special cases
	// like RBAC is disabled or anonymous mode is used).
	saClientEntries map[string]UserClientInterface
}

// GetClientFactory returns the client factory. Creates a new one if necessary
func GetClientFactory() (ClientFactory, error) {
	var err error
	once.Do(func() {
		if factory != nil {
			return
		}
		factory, err = getClientFactory(kialiConfig.Get())
	})
	return factory, err
}

func getClientFactory(kialiConf *kialiConfig.Config) (*clientFactory, error) {
	// Create a new config but don't specify the bearer token to use
	baseConfig := rest.Config{
		QPS:   kialiConf.KubernetesConfig.QPS,
		Burst: kialiConf.KubernetesConfig.Burst,
	}

	if !kialiConf.Clustering.IgnoreLocalCluster {
		restConfig, err := getConfigForLocalCluster()
		if err != nil {
			return nil, err
		}
		baseConfig.Host = restConfig.Host // remote cluster clients should ignore this
		baseConfig.TLSClientConfig = restConfig.TLSClientConfig
	}

	return newClientFactory(kialiConf, &baseConfig)
}

// NewClientFactory creates a new client factory that can be transitory.
// Callers should close the ctx when done with the client factory.
// Does not set the global ClientFactory. You should probably use
// GetClientFactory instead of this method unless you temporaily need
// to create a client like when Kiali sets the cluster id.
func NewClientFactory(ctx context.Context, conf *kialiConfig.Config) (ClientFactory, error) {
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
func newClientFactory(kialiConf *kialiConfig.Config, restConf *rest.Config) (*clientFactory, error) {
	f := &clientFactory{
		kialiConfig:     kialiConf,
		baseRestConfig:  restConf,
		clientEntries:   make(map[string]map[string]UserClientInterface),
		homeCluster:     kialiConf.KubernetesConfig.ClusterName,
		recycleChan:     make(chan string),
		saClientEntries: make(map[string]UserClientInterface),
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

	for cluster, clusterInfo := range remoteClusterInfos {
		client, err := f.newSAClient(&clusterInfo)
		if err != nil {
			return nil, fmt.Errorf("unable to create remote Kiali Service Account client. Err: %s", err)
		}
		f.saClientEntries[cluster] = client
	}

	if kialiConf.Clustering.IgnoreLocalCluster {
		if len(f.saClientEntries) == 0 {
			return nil, fmt.Errorf("kiali will exit because it has no local or remote cluster to manage. Currently clustering.IgnoreLocalClient=true but no cluster secrets have been discovered")
		}

		// use a cluster secret to assign a home cluster
		for _, v := range f.saClientEntries {
			f.homeCluster = v.ClusterInfo().Name
			break
		}
	} else {
		if f.homeCluster == "" {
			f.homeCluster = f.baseRestConfig.Host
		}
		// Create service account clients for the local cluster and each remote cluster.
		// Note that this means each remote cluster secret token must be given the proper permissions
		// in that remote cluster for Kiali to do its work. i.e. logging into a remote cluster with the
		// remote cluster secret token must be given the same permissions as the local cluster Kiali SA.
		homeClient, err := f.newSAClient(nil)
		if err != nil {
			return nil, fmt.Errorf("unable to create home cluster Kiali Service Account client. Err: %s", err)
		}
		f.saClientEntries[f.homeCluster] = homeClient
	}

	return f, nil
}

// newClient creates a new UserClientInterface based on a users k8s token. It is assumed users do not have a token file in authInfo.
func (cf *clientFactory) newClient(authInfo *api.AuthInfo, expirationTime time.Duration, cluster string) (UserClientInterface, error) {
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

	var newClient UserClientInterface
	if cluster == cf.homeCluster {
		client, err := NewClientWithRemoteClusterInfo(&config, nil)
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

		newClient, err = NewClientWithRemoteClusterInfo(remoteConfig, &clusterInfo)
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
	log.Debugf("Creating new Kiali Service Account client [%v]", remoteClusterInfo)
	// if no cluster info is provided, we are being asked to create a new client for the home cluster
	config, err := cf.getConfig(remoteClusterInfo)
	if err != nil {
		return nil, err
	}

	client, err := NewClientWithRemoteClusterInfo(config, remoteClusterInfo)
	if err != nil {
		return nil, err
	}

	return client, nil
}

// GetSAClients returns all the read-only SA clients.
func (cf *clientFactory) GetSAClients() map[string]ClientInterface {
	cf.mutex.RLock()
	defer cf.mutex.RUnlock()
	return ConvertFromUserClients(cf.saClientEntries)
}

// GetClient returns a read-write client for the specified user token and cluster, creating one if necessary.
func (cf *clientFactory) GetClient(authInfo *api.AuthInfo, cluster string) (UserClientInterface, error) {
	if cf.kialiConfig.IsRBACDisabled() {
		return cf.GetSAClientAsUserClientInterface(cluster), nil
	}

	return cf.getRecycleClient(authInfo, defaultExpirationTime, cluster)
}

// GetClients returns all read-write clients for the specified user tokens, creating them as necessary.
func (cf *clientFactory) GetClients(authInfos map[string]*api.AuthInfo) (map[string]UserClientInterface, error) {
	if cf.kialiConfig.IsRBACDisabled() {
		return cf.GetSAClientsAsUserClientInterfaces(), nil
	}

	clients := make(map[string]UserClientInterface)
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
func (cf *clientFactory) getRecycleClient(authInfo *api.AuthInfo, expirationTime time.Duration, cluster string) (UserClientInterface, error) {
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
			cf.clientEntries[tokenHash] = make(map[string]UserClientInterface)
		}
		cf.clientEntries[tokenHash][cluster] = client
		internalmetrics.SetKubernetesClients(cf.getClientsLengthNoLock())
		return client, nil
	}
}

// hasClient checks if clientFactory has a client, returning the client if clientFactory has it.
// This is a helper function for testing.
// It uses the shared lock so beware of nested locking with other methods.
func (cf *clientFactory) hasClient(authInfo *api.AuthInfo) (map[string]UserClientInterface, bool) {
	tokenHash := getTokenHash(authInfo)
	cf.mutex.RLock()
	cEntry, ok := cf.clientEntries[tokenHash]
	defer cf.mutex.RUnlock()
	return cEntry, ok
}

// getClientsLength returns the number of known clients.
// This is a helper function for testing.
// It uses the shared lock so beware of nested locking with other methods.
func (cf *clientFactory) getClientsLength() int {
	cf.mutex.RLock()
	defer cf.mutex.RUnlock()
	return cf.getClientsLengthNoLock()
}

// getClientsLengthNoLock returns the number of known clients without locking the shared lock,
// so only use this function if you know you are already safe.
func (cf *clientFactory) getClientsLengthNoLock() int {
	count := 0
	for _, innerMap := range cf.clientEntries {
		count += len(innerMap)
	}
	return count
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
	internalmetrics.SetKubernetesClients(cf.getClientsLengthNoLock())
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

	h := sha256.New()
	_, err := h.Write([]byte(tokenData))
	if err != nil {
		// errcheck linter want us to check for the error returned by h.Write.
		// However, docs of sha256 say that this Writer never returns an error.
		// See: https://golang.org/pkg/hash/#Hash
		// So, let's check the error, and panic. Per the docs, this panic should
		// never be reached.
		panic("sha256.Write returned error.")
	}
	return string(h.Sum(nil))
}

// GetSAClient returns the read-only client associated with the Kiali service account for the given cluster.
func (cf *clientFactory) GetSAClient(cluster string) ClientInterface {
	cf.mutex.RLock()
	defer cf.mutex.RUnlock()

	return cf.saClientEntries[cluster]
}

// getSAClientAsUserClientInterface returns a read-write client associated with the Kiali service account for the given cluster.
//
// USE WITH CAUTION!! This client gives you the Kiali SA write permissions!
//
// Note this is a special function that should be used sparingly. It returns an SA client (which is usually meant to be read-only)
// as a UserClientInterface (aka a read-write client) thus allowing you to write data with the returned client.
func (cf *clientFactory) GetSAClientAsUserClientInterface(cluster string) UserClientInterface {
	cf.mutex.RLock()
	defer cf.mutex.RUnlock()
	return cf.saClientEntries[cluster]
}

// GetSAClientsAsUserClientInterfaces returns all the SA clients as read-write clients (UserClientInterface).
//
// USE WITH CAUTION!! These clients give you the Kiali SA write permissions!
//
// Read the comments for GetSAClientAsUserClientInterface for more info.
func (cf *clientFactory) GetSAClientsAsUserClientInterfaces() map[string]UserClientInterface {
	cf.mutex.RLock()
	defer cf.mutex.RUnlock()
	return cf.saClientEntries
}

// KialiSAHomeClusterClient returns the read-only Kiali SA client for the cluster where Kiali is running.
func (cf *clientFactory) GetSAHomeClusterClient() ClientInterface {
	return cf.GetSAClient(cf.homeCluster)
}

func (cf *clientFactory) getConfig(clusterInfo *RemoteClusterInfo) (*rest.Config, error) {
	kialiConf := kialiConfig.Get()
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

	if !kialiConf.KialiFeatureFlags.Clustering.EnableExecProvider {
		clientConfig.ExecProvider = nil
	}

	// Override some settings with what's in kiali config
	clientConfig.QPS = kialiConf.KubernetesConfig.QPS
	clientConfig.Burst = kialiConf.KubernetesConfig.Burst

	return &clientConfig, nil
}
