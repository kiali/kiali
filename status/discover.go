package status

import (
	"context"
	"net/url"
	"strings"

	"github.com/kiali/kiali/appstate"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
)

var clientFactory kubernetes.ClientFactory

func getClient() (kubernetes.ClientInterface, error) {
	if clientFactory == nil {
		userClientFactory, err := kubernetes.GetClientFactory()
		if err != nil {
			return nil, err
		}
		clientFactory = userClientFactory
	}

	client := clientFactory.GetSAHomeClusterClient()
	return client, nil
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
		return grafanaConf.URL
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
				appstate.GrafanaDiscoveredURL = routeURL
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
	route, err := client.GetRoute(context.TODO(), ns, service)
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
