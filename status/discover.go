package status

import (
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"io/ioutil"
)

// The Kiali ServiceAccount token.
var saToken string

var clientFactory kubernetes.ClientFactory

func DiscoverJaeger() (url string, err error) {
	if config.Get().ExternalServices.Jaeger.URL != "" {
		return config.Get().ExternalServices.Jaeger.URL, nil
	}
	return discoverUrlService(config.Get().ExternalServices.Jaeger.ServiceNamespace, config.Get().ExternalServices.Jaeger.Service)
}

func DiscoverGrafana() (url string, err error) {
	if config.Get().ExternalServices.Grafana.URL != "" {
		return config.Get().ExternalServices.Grafana.URL, nil
	}
	return discoverUrlService(config.Get().ExternalServices.Grafana.ServiceNamespace, config.Get().ExternalServices.Grafana.Service)
}

func discoverUrlService(ns string, service string) (url string, err error) {

	if saToken == "" {
		token, err := ioutil.ReadFile("/var/run/secrets/kubernetes.io/serviceaccount/token")
		if err != nil {
			return "", err
		}
		saToken = string(token)
	}

	if clientFactory == nil {
		userClientFactory, err := kubernetes.GetClientFactory()
		if err != nil {
			return "", err
		}
		clientFactory = userClientFactory
	}

	client, err := clientFactory.GetClient(saToken)
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
	} else {
		return "http://" + host, nil
	}
}
