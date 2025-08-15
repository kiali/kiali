package istio

import (
	"fmt"

	"k8s.io/client-go/rest"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
)

// This func is here to avoid an import cycle between kubernetes and config packages.

// DetermineHomeClusterName is used to update the config with information about istio that
// comes from the environment such as the cluster name.
func DetermineHomeClusterName(conf *config.Config, restConf *rest.Config) error {
	// If the home cluster name is already set, we don't need to do anything
	homeCluster := conf.KubernetesConfig.ClusterName
	if homeCluster != "" {
		return nil
	}

	// If the cluster name is not set and we don't have a co-located control plane, it's an error
	if conf.Clustering.IgnoreHomeCluster {
		return fmt.Errorf("could not determine Kiali home cluster name. You must set kubernetes_config.cluster_name when clustering.ignore_home_cluster=true")
	}

	// use the control plane's configured cluster name, or the default
	err := func() error {
		log.Debug("Cluster name is not set. Attempting to auto-detect the cluster name from the Istio control plane environment.")

		// Need to create a temporary client here in order
		// to auto-detect the istio cluster name from the environment. There's a bit of a
		// chicken and egg problem with the client factory because the client factory
		// uses the cluster id to keep track of all the clients. But in order to create
		// a client to get the cluster id from the environment, you need to create a client factory.
		// To get around that we create a temporary client here and then set the kiali
		// config cluster name. We then create the client factory later and that
		// client factory has the cluster id set properly.
		client, err := kubernetes.NewClient(kubernetes.ClusterInfo{
			ClientConfig: restConf,
			Name:         conf.KubernetesConfig.ClusterName,
		}, conf)
		if err != nil {
			return err
		}

		// Try to auto-detect the cluster name
		homeCluster, err = kubernetes.ClusterNameFromIstiod(conf, client)
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

	return nil
}
