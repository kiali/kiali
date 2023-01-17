package kubernetes

import (
	"sync"

	"github.com/kiali/kiali/config"
)

// ClusterClientManager is responsible for creating kubernetes clients across multiple clusters.
type ClusterClientManager struct {
	// Maps cluster name to client.
	clients map[string]ClientInterface
	config  config.Config
	// Client for cluster kiali is deployed in.
	homeClusterClient ClientInterface
	lock              sync.RWMutex
}

// NewClusterClientManager creates a new ClusterClientManager.
// Initializes the clients for all clusters.
func NewClusterClientManager(cfg config.Config) (*ClusterClientManager, error) {
	ccm := &ClusterClientManager{
		config:  cfg,
		clients: make(map[string]ClientInterface),
	}

	homeClusterClient, err := ccm.newClient()
	if err != nil {
		return nil, err
	}

	ccm.homeClusterClient = homeClusterClient

	// TODO: Add more clusters and getting remote clients.
	ccm.clients["home"] = homeClusterClient

	return ccm, nil
}

func (c *ClusterClientManager) newClient() (ClientInterface, error) {
	restConfig, err := ConfigClient()
	if err != nil {
		return nil, err
	}

	if c.config.InCluster {
		if saToken, err := GetKialiToken(); err != nil {
			return nil, err
		} else {
			restConfig.BearerToken = saToken
		}
	}

	return NewClientFromConfig(restConfig)
}

// KialiSAClients returns all clients associated with the Kiali service account across clusters.
func (c *ClusterClientManager) KialiSAClients() map[string]ClientInterface {
	c.lock.RLock()
	defer c.lock.RUnlock()

	return c.clients
}

// KialiSAHomeCluster returns the Kiali service account client for the cluster where Kiali is running.
func (c *ClusterClientManager) KialiSAHomeCluster() ClientInterface {
	c.lock.RLock()
	defer c.lock.RUnlock()

	return c.homeClusterClient
}
