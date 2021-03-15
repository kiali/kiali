package cache

import (
	"time"

	"k8s.io/client-go/tools/cache"

	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
)

// Istio uses caches for pods and controllers.
// Kiali will use caches for specific namespaces and types
// https://github.com/istio/istio/blob/master/mixer/adapter/kubernetesenv/cache.go

type (
	// This map will store Informers per specific types
	// i.e. map["Deployment"], map["Service"]
	typeCache map[string]cache.SharedIndexInformer

	namespaceCache struct {
		created       time.Time
		namespaces    []models.Namespace
		nameNamespace map[string]models.Namespace
	}

	podProxyStatus struct {
		namespace   string
		pod         string
		proxyStatus *kubernetes.ProxyStatus
	}
)
