package status

import (
	"errors"
	"net/url"
	"strings"

	"k8s.io/apimachinery/pkg/labels"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
)

var grafanaDiscoveredURL string

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
		return nil, errors.New("Client is not Openshift")
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

func checkTracingService() (url string, err error) {
	conf := config.Get()
	tracing := config.TracingDefaultService
	jaeger := config.JaegerQueryDefaultService
	ns := config.IstioDefaultNamespace
	service := tracing

	if conf.ExternalServices.Tracing.Namespace != "" {
		ns = conf.ExternalServices.Tracing.Namespace
	}

	if conf.ExternalServices.Tracing.Service != "" {
		// We need discover the URL
		service = conf.ExternalServices.Tracing.Service
		url, err = discoverServiceURL(ns, service)
	} else {
		// User didn't set the service
		log.Debugf("Kiali is looking for Tracing/Jaeger service ...")
		// look in Tracing Default Service
		url, err = discoverServiceURL(ns, service)
		if err != nil {
			// Look in jaeger Query Default Service
			service := jaeger
			url, err = discoverServiceURL(ns, service)
			if err == nil {
				log.Infof("Jaeger URL found: %s", url)
			} else {
				log.Infof("Could not find Tracing/Jaeger")
			}
		} else {
			log.Infof("Tracing URL found: %s", url)
		}
	}

	// The user set the service or We found the service in tracing or jaeger-query
	if err == nil {
		// Calculate if Path
		path, err := checkIfQueryBasePath(ns, service)
		if err != nil {
			log.Debugf("Error checking the query base path")
		}
		// The user didn't set the URL, so we need to set
		if conf.ExternalServices.Tracing.URL == "" {
			conf.ExternalServices.Tracing.URL = url + path // Overwrite URL if the user didn't set
		}

		// We store the path
		conf.ExternalServices.Tracing.Path = path
		// Tracing is ENABLED
		conf.ExternalServices.Tracing.EnableJaeger = true
		// Set the service
		conf.ExternalServices.Tracing.Service = service
	}

	// Save configuration
	config.Set(conf)

	return conf.ExternalServices.Tracing.URL, err

}

func DiscoverJaeger() (url string, err error) {
	conf := config.Get()

	if conf.ExternalServices.Tracing.URL != "" && conf.ExternalServices.Tracing.Service != "" {
		// User assume his configuration
		conf.ExternalServices.Tracing.EnableJaeger = true
		conf.ExternalServices.Tracing.Path = getPathURL(conf.ExternalServices.Tracing.URL)
		config.Set(conf)
		return conf.ExternalServices.Tracing.URL, nil
	}

	return checkTracingService()
}

// DiscoverGrafana will return the Grafana URL if it has been configured,
// or will try to retrieve it if an OpenShift Route is defined.
func DiscoverGrafana() (string, error) {
	grafanaConf := config.Get().ExternalServices.Grafana
	// If display link is disable in Grafana configuration return empty string and avoid discovery
	if !grafanaConf.DisplayLink {
		return "", nil
	}
	if grafanaConf.URL != "" || !grafanaConf.InCluster {
		return strings.TrimSuffix(grafanaConf.URL, "/"), nil
	}
	if grafanaDiscoveredURL != "" {
		return grafanaDiscoveredURL, nil
	}
	url, err := discoverServiceURL(grafanaConf.ServiceNamespace, grafanaConf.Service)
	if err != nil {
		log.Infof("Could not find Grafana URL: %v", err)
	} else {
		log.Infof("Grafana URL found: %s", url)
	}
	grafanaDiscoveredURL = strings.TrimSuffix(url, "/")
	return grafanaDiscoveredURL, err
}

func discoverServiceURL(ns string, service string) (string, error) {
	client, err := getClient()

	if err != nil {
		return "", err
	}
	route, err := client.GetRoute(ns, service)
	if err != nil {
		return "", err
	}

	host := route.Spec.Host
	if route.Spec.TLS != nil {
		return "https://" + host, nil
	}
	return "http://" + host, nil
}
