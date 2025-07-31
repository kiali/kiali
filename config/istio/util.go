package istio

import (
	"context"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
)

// This func is here to avoid an import cycle between kubernetes and config packages.

// UpdateConfigWithIstioInfo is used to update the config with information about istio that
// comes from the environment such as the cluster name.
func UpdateConfigWithIstioInfo(conf *config.Config) {
	homeCluster := conf.KubernetesConfig.ClusterName
	if homeCluster != "" {
		// If the cluster name is already set, we don't need to do anything
		return
	}

	err := func() error {
		log.Debug("Cluster name is not set. Attempting to auto-detect the cluster name from the home cluster environment.")
		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()

		// Need to create a temporary client factory here so that we can create a client
		// to auto-detect the istio cluster name from the environment. There's a bit of a
		// chicken and egg problem with the client factory because the client factory
		// uses the cluster id to keep track of all the clients. But in order to create
		// a client to get the cluster id from the environment, you need to create a client factory.
		// To get around that we create a temporary client factory here and then set the kiali
		// config cluster name. We then create the global client factory later in the business
		// package and that global client factory has the cluster id set properly.
		cf, err := kubernetes.NewClientFactory(ctx, *conf)
		if err != nil {
			return err
		}

		// Try to auto-detect the cluster name
		homeCluster, err = kubernetes.ClusterNameFromIstiod(*conf, cf.GetSAHomeClusterClient())
		if err != nil {
			return err
		}

		return nil
	}()
	if err != nil {
		log.Warningf("Cannot resolve local cluster name. Err: %s. Falling back to [%s]", err, config.DefaultClusterID)
		homeCluster = config.DefaultClusterID
	}

	log.Debugf("Auto-detected the istio cluster name to be [%s]. Updating the kiali config", homeCluster)
	conf.KubernetesConfig.ClusterName = homeCluster
	config.Set(conf)
}
