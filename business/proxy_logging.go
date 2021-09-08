package business

import (
	"github.com/kiali/kiali/kubernetes"
)

// ProxyLoggingService is a thin layer over the kube interface for proxy logging functions.
type ProxyLoggingService struct {
	k8s kubernetes.ClientInterface
}

// SetLogLevel sets the pod's proxy log level.
func (in *ProxyLoggingService) SetLogLevel(namespace, pod, level string) error {
	return in.k8s.SetProxyLogLevel(namespace, pod, level)
}
