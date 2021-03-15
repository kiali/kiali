package kubernetes

import (
	"fmt"
	"os"
	"time"

	kialiConfig "github.com/kiali/kiali/config"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/util/httputil"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
)

// ConfigClient return a client with the correct configuration
// Returns configuration if Kiali is in Cluster when InCluster is true
// Returns configuration if Kiali is not int Cluster when InCluster is false
// It returns an error on any problem
func ConfigClient(k8sType K8sType) (*rest.Config, error) {
	if kialiConfig.Get().InCluster {
		var config *rest.Config
		var err error
		if k8sType == Primary {
			config, err = GetRemoteClusterConfig()
		} else {
			config, err = rest.InClusterConfig()
		}
		if err != nil {
			return nil, err
		}
		config.QPS = kialiConfig.Get().KubernetesConfig.QPS
		config.Burst = kialiConfig.Get().KubernetesConfig.Burst
		return config, nil
	} else {
		config, err := clientcmd.BuildConfigFromFlags("", GetKubeConfigPath(k8sType))
		if err != nil {
			return nil, fmt.Errorf("fail to BuildConfigFromFlags:%v", err)
		}
		return config, nil
	}
}

func GetKubeConfigPath(k8sType K8sType) string {
	if k8sType == Primary {
		return getPrimaryKubeConfigPath()
	} else if k8sType == Remote {
		return getRemoteKubeConfigPath()
	}
	err := fmt.Errorf("illegal type:%v", k8sType)
	log.Error("%v", err)
	return ""
}

func getPrimaryKubeConfigPath() string {
	return os.Getenv("PRIMARY_KUBE_CONFIG")
}

func getRemoteKubeConfigPath() string {
	return os.Getenv("REMOTE_KUBE_CONFIG")
}

func GetTimeout() time.Duration {
	timeout := os.Getenv("HTTP_TIMEOUT")
	duration, err := time.ParseDuration(timeout)
	if err != nil {
		return httputil.DefaultTimeout
	}
	return duration
}

func GetK8sTimeout() time.Duration {
	timeout := os.Getenv("K8S_TIMEOUT")
	duration, err := time.ParseDuration(timeout)
	if err != nil {
		return 15 * time.Second
	}
	return duration
}

type K8sType string

const (
	Primary K8sType = "primary"
	Remote  K8sType = "remote"
)
