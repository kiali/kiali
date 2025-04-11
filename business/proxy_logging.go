package business

import (
	"fmt"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
)

// ValidProxyLogLevels are the application log levels supported by the envoy admin interface.
var ValidProxyLogLevels = []string{"off", "trace", "debug", "info", "warning", "error", "critical"}

// IsValidLogLevel determines if the provided string is a valid proxy log level.
// This can be called before calling SetLogLevel.
func IsValidProxyLogLevel(level string) bool {
	for _, l := range ValidProxyLogLevels {
		if level == l {
			return true
		}
	}
	return false
}

// ProxyLoggingService is a thin layer over the kube interface for proxy logging functions.
type ProxyLoggingService struct {
	conf        *config.Config
	proxyStatus *ProxyStatusService
	userClients map[string]kubernetes.UserClientInterface
}

// SetLogLevel sets the pod's proxy log level.
func (in *ProxyLoggingService) SetLogLevel(cluster, namespace, pod, level string) error {
	client, ok := in.userClients[cluster]
	if !ok {
		return fmt.Errorf("user client for cluster [%s] not found", cluster)
	}

	// Ensure pod exists
	if _, err := client.GetPod(namespace, pod); err != nil {
		return err
	}

	return client.SetProxyLogLevel(namespace, pod, level)
}
