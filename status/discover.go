package status

import (
	"io/ioutil"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
)

// The Kiali ServiceAccount token.
var saToken string

var clientFactory kubernetes.ClientFactory

func DiscoverJaeger() (url string, err error) {
	conf := config.Get()

	if conf.ExternalServices.Jaeger.URL != "" {
		log.Debugf("Detected url %s configured for tracing service", conf.ExternalServices.Jaeger.URL)
		return conf.ExternalServices.Jaeger.URL, nil
	}
	log.Debugf("Kiali is looking for Tracing service ...")
	tracing := conf.ExternalServices.Jaeger.Service
	jaeger := conf.ExternalServices.Jaeger.JaegerService
	ns := conf.ExternalServices.Jaeger.Namespace
	// Check if there is a Tracing service in the namespace
	url, err = discoverUrlService(ns, tracing)
	if err != nil || url == "" {
		// Check if there is a Jaeger-Query service in the namespace
		url, err = discoverUrlService(ns, jaeger)
		if err != nil || url == "" {
			log.Debugf("Services %s or %s not detected  in namespace %s", jaeger, tracing, ns)
		}
	}
	conf.ExternalServices.Jaeger.URL = url
	config.Set(conf)
	return url, err
}

func DiscoverGrafana() (url string, err error) {
	conf := config.Get()
	// If display link is disable in Grafana configuration return empty string and avoid discover
	if !conf.ExternalServices.Grafana.DisplayLink {
		log.Debugf("Grafana display link is disabled in the configuration.")
		return "", nil
	}
	if conf.ExternalServices.Grafana.URL != "" {
		log.Debugf("Detected url %s configured for tracing service", config.Get().ExternalServices.Grafana.URL)
		return conf.ExternalServices.Grafana.URL, nil
	}
	log.Debugf("Kiali is looking for Grafana service ...")
	url, err = discoverUrlService(config.Get().ExternalServices.Grafana.ServiceNamespace, config.Get().ExternalServices.Grafana.Service)
	conf.ExternalServices.Grafana.URL = url
	config.Set(conf)
	return url, err
}

func discoverUrlService(ns string, service string) (url string, err error) {
	if saToken == "" {
		log.Debugf("Reading sa Token")
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
	// If the client is not openshift return and avoid discover
	if !client.IsOpenShift() {
		log.Debugf("Kiali detect a no Openshift Cluster")
		return "", nil
	}
	route, err := client.GetRoute(ns, service)
	if err != nil {
		log.Debugf("Kiali not detect the service %s in the namespace %s", service, ns)
		return "", err
	}

	host := route.Spec.Host
	if route.Spec.TLS != nil {
		log.Debugf("Kiali detect the service %s in the namespace %s with SSL in %s", service, ns, "https://"+host)
		return "https://" + host, nil
	} else {
		log.Debugf("Kiali detect the service %s in the namespace %s without SSL in %s", service, ns, "http://"+host)
		return "http://" + host, nil
	}
}
