package status

import (
	"net/url"
	"strings"

	"k8s.io/apimachinery/pkg/labels"

	"github.com/kiali/kiali/appstate"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
)

// Route names to lookup for discovery
var tracingLookupRoutes = [...]string{"jaeger-query", "istio-tracing", "tracing"}

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

	return client, nil
}

func checkIfQueryBasePath(ns string, service string) (path string, err error) {
	path = ""
	client, err := getClient()
	// Return if there is a problem with the client
	if err != nil {
		return path, err
	}
	// Get the service
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
		log.Debugf("[TRACING] Kiali didn't found a deployment for service %s", service)
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
		log.Debugf("[TRACING] Kiali found 2 or + deployments for service %s", service)
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

func discoverTracingService() (service string) {
	client, err := getClient()
	//  Return if there is a problem with the client
	if err != nil {
		log.Debugf("[TRACING] Service discovery failed: %v", err)
		return
	}
	// Check for each service in list
	for _, name := range tracingLookupRoutes {
		service = name
		// Try to discover the service
		serv, err := client.GetService(config.Get().IstioNamespace, service)
		// If there is no error and the service is not nil that means that we found tracing
		if serv != nil && err == nil {
			log.Debugf("[TRACING] Service in: %s", service)
			break
		} else {
			// No service found set to empty for the last iteration
			service = ""
		}
	}
	return
}

func discoverTracingPath() (path string) {
	tracingConfig := config.Get().ExternalServices.Tracing
	// We had the service so we can check the Path
	path, err := checkIfQueryBasePath(tracingConfig.Namespace, tracingConfig.Service)
	if err != nil {
		log.Debugf("[TRACING] Error checking the query base path")
	}
	return
}

func discoverURLTracingService() (url string) {
	// Try to discover the URL . Openshift Client
	url, _ = discoverServiceURL(appstate.JaegerConfig.Namespace, appstate.JaegerConfig.Service)

	if url == "" {
		return
	}

	// Trim the string to format correctly the url with the path
	url = strings.TrimSuffix(url, "/") + "/" + appstate.JaegerConfig.Path
	appstate.JaegerEnabled = true
	return
}

func DiscoverJaeger() string {
	// Kiali has all the configuration
	if appstate.JaegerEnabled {
		return appstate.JaegerConfig.URL
	}

	// Get the configuration
	tracingConfig := config.Get().ExternalServices.Tracing

	// There is not a service in the configuration we need discover the service
	if tracingConfig.Service == "" {
		tracingConfig.Service = discoverTracingService()
		appstate.JaegerConfig = tracingConfig
	}

	//There is an endpoint in the configuration discovery QUERY_BASE_PATH by endpoint defined
	if tracingConfig.URL != "" {
		// User assumes configuration
		appstate.JaegerEnabled = true
		// Get Path from the URL (User could set the QUERY_BASE_PATH in the URL)
		tracingConfig.Path = getPathURL(tracingConfig.URL)
		appstate.JaegerConfig = tracingConfig
	}

	// Discover QUERY_BASE_PATH by deployment
	if tracingConfig.Service != "" && tracingConfig.Path == "" {
		tracingConfig.Path = discoverTracingPath()
		appstate.JaegerConfig = tracingConfig
	}

	//There is not an endpoint, go discover for Openshift
	if tracingConfig.Service != "" && tracingConfig.URL == "" {
		tracingConfig.URL = discoverURLTracingService()
		appstate.JaegerConfig = tracingConfig
	}

	return appstate.JaegerConfig.URL
}

// DiscoverGrafana will return the Grafana URL if it has been configured,
// or will try to retrieve it if an OpenShift Route is defined.
func DiscoverGrafana() string {
	grafanaConf := config.Get().ExternalServices.Grafana

	// If Grafana is disabled in the configuration return an empty string and avoid discovery
	if !grafanaConf.Enabled {
		return ""
	}
	if grafanaConf.URL != "" || grafanaConf.InClusterURL == "" {
		return strings.TrimSuffix(grafanaConf.URL, "/")
	}
	if appstate.GrafanaDiscoveredURL != "" {
		return appstate.GrafanaDiscoveredURL
	}
	// Try to get service and namespace from in-cluster URL, to discover route
	if grafanaConf.InClusterURL != "" {
		parsedURL, err := url.Parse(grafanaConf.InClusterURL)
		if err == nil {
			parts := strings.Split(parsedURL.Hostname(), ".")
			if len(parts) >= 2 {
				routeURL, err := discoverServiceURL(parts[1], parts[0])
				if err != nil {
					log.Debugf("[GRAFANA] URL discovery failed: %v", err)
				}
				appstate.GrafanaDiscoveredURL = strings.TrimSuffix(routeURL, "/")
			}
		}
	}
	return appstate.GrafanaDiscoveredURL
}

func discoverServiceURL(ns, service string) (url string, err error) {
	log.Debugf("[%s] URL discovery for service '%s', namespace '%s'...", strings.ToUpper(service), service, ns)
	url = ""
	client, err := getClient()

	// If the client is not openshift return and avoid discover
	if err != nil {
		log.Debugf("[%s] Discovery failed: %v", strings.ToUpper(service), err)
		return
	}

	if !client.IsOpenShift() {
		log.Debugf("[%s] Client is not Openshift, discovery url is only supported in Openshift", strings.ToUpper(service))
		return
	}

	// Assuming service name == route name
	route, err := client.GetRoute(ns, service)
	if err != nil {
		log.Debugf("[%s] Discovery failed: %v", strings.ToUpper(service), err)
		return
	}

	host := route.Spec.Host
	if route.Spec.TLS != nil {
		url = "https://" + host
	} else {
		url = "http://" + host
	}
	log.Infof("[%s] URL discovered for %s: %s", strings.ToUpper(service), service, url)
	return
}
