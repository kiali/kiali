package status

import (
	"errors"
	"net/url"
	"strings"

	"github.com/kiali/kiali/appstate"

	"k8s.io/apimachinery/pkg/labels"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
)

// Route names to lookup for discovery
var tracingLookupRoutes = [...]string{"tracing", "jaeger-query"}

var clientFactory kubernetes.ClientFactory

func getClient() (kubernetes.IstioClientInterface, error) {
	saToken, err := kubernetes.GetKialiToken()
	if err != nil {
		return nil, err
	}

	if clientFactory == nil {
		userClientFactory, err := kubernetes.GetClientFactory()
		if err != nil {
			return nil, err
		}
		clientFactory = userClientFactory
	}

	client, err := clientFactory.GetClient(saToken)
	if err != nil {
		return nil, err
	}

	// If the client is not openshift return and avoid discover
	if !client.IsOpenShift() {
		return nil, errors.New("client is not Openshift")
	}

	return client, nil
}

func checkIfQueryBasePath(ns string, service string) (path string, err error) {
	path = ""
	client, err := getClient()

	if err != nil {
		return path, err
	}
	svc, err := client.GetService(ns, service)
	if err != nil {
		return path, err
	}
	labelSelectorService := labels.Set(svc.Spec.Selector).String()
	deployments, err := client.GetDeploymentsByLabel(ns, labelSelectorService)

	if err != nil {
		return path, nil
	}

	switch len(deployments) {
	case 0:
		log.Debugf("Kiali didn't found a deployment for service %s", service)
	case 1:
		if len(deployments[0].Spec.Template.Spec.Containers) > 0 {
			for _, v := range deployments[0].Spec.Template.Spec.Containers[0].Env {
				if v.Name == "QUERY_BASE_PATH" {
					path = v.Value
					break
				}
			}
		}
	default:
		log.Debugf("Kiali found 2 or + deployments for service %s", service)
	}

	return path, nil
}

func getPathURL(endpoint string) (path string) {
	u, err := url.Parse(endpoint)
	if err != nil {
		return ""
	}
	return u.Path
}

func checkTracingService() (url string) {
	tracingConfig := config.Get().ExternalServices.Tracing
	service := tracingConfig.Service

	if service != "" {
		// Try to discover the URL
		url = discoverServiceURL(tracingConfig.Namespace, service)
	} else {
		// Check usual route names for tracing
		for _, name := range tracingLookupRoutes {
			service = name
			url = discoverServiceURL(tracingConfig.Namespace, name)
			if url != "" {
				break
			}
		}
	}

	// The user has set the route or we found one in tracing or jaeger-query
	if url != "" {
		// Calculate if Path
		path, err := checkIfQueryBasePath(tracingConfig.Namespace, service)
		if err != nil {
			log.Debugf("Error checking the query base path")
		}
		// The user didn't set the URL, so we need to set
		if tracingConfig.URL == "" {
			tracingConfig.URL = url + path // Overwrite URL if the user didn't set
		}

		// We store the path
		tracingConfig.Path = path
		// Set the service
		tracingConfig.Service = service
		appstate.JaegerEnabled = true
	}

	// Save config
	appstate.JaegerConfig = tracingConfig

	return tracingConfig.URL
}

func DiscoverJaeger() string {
	if appstate.JaegerEnabled {
		return appstate.JaegerConfig.URL
	}
	tracingConfig := config.Get().ExternalServices.Tracing
	if tracingConfig.URL != "" && tracingConfig.Service != "" {
		// User assumes configuration
		appstate.JaegerEnabled = true
		tracingConfig.Path = getPathURL(tracingConfig.URL)
		appstate.JaegerConfig = tracingConfig
		return tracingConfig.URL
	}

	return checkTracingService()
}

// DiscoverGrafana will return the Grafana URL if it has been configured,
// or will try to retrieve it if an OpenShift Route is defined.
func DiscoverGrafana() string {
	grafanaConf := config.Get().ExternalServices.Grafana
	// If display link is disable in Grafana configuration return empty string and avoid discovery
	if !grafanaConf.DisplayLink {
		return ""
	}
	if grafanaConf.URL != "" || !grafanaConf.InCluster {
		return strings.TrimSuffix(grafanaConf.URL, "/")
	}
	if appstate.GrafanaDiscoveredURL != "" {
		return appstate.GrafanaDiscoveredURL
	}
	url := discoverServiceURL(grafanaConf.Namespace, grafanaConf.Service)
	appstate.GrafanaDiscoveredURL = strings.TrimSuffix(url, "/")
	return appstate.GrafanaDiscoveredURL
}

func discoverServiceURL(ns, service string) (url string) {
	log.Debugf("URL discovery for service '%s', namespace '%s'...", service, ns)
	client, err := getClient()

	if err != nil {
		log.Debugf("Discovery failed: %v", err)
		return
	}
	// Assuming service name == route name
	route, err := client.GetRoute(ns, service)
	if err != nil {
		log.Debugf("Discovery failed: %v", err)
		return
	}

	host := route.Spec.Host
	if route.Spec.TLS != nil {
		url = "https://" + host
	} else {
		url = "http://" + host
	}
	log.Infof("URL discovered for %s: %s", service, url)
	return
}
