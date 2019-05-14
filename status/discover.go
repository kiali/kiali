package status

import (
	"errors"
	"io/ioutil"

	"k8s.io/apimachinery/pkg/labels"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
)

// The Kiali ServiceAccount token.
var saToken string

var clientFactory kubernetes.ClientFactory

func getClient() (kubernetes.IstioClientInterface, error) {
	if saToken == "" {
		token, err := ioutil.ReadFile("/var/run/secrets/kubernetes.io/serviceaccount/token")
		if err != nil {
			return nil, err
		}
		saToken = string(token)
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
	labelSelectorService := labels.Set(svc.Labels).String()
	deployments, err := client.GetDeploymentsByLabel(ns, labelSelectorService)

	if err != nil {
		return path, nil
	}

	switch len(deployments) {
	case 0:
		log.Debugf("Kiali not found a deployment for service %s", service)
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
		url, err = discoverUrlService(ns, service)
		if err != nil {
			// We found a URL and the user set the service so Tracing is ENABLED
			conf.ExternalServices.Tracing.EnableJaeger = true
		}
	} else {
		// User didn't set the service
		log.Debugf("Kiali is looking for Tracing/Jaeger service ...")
		// look in Tracing Default Service
		url, err = discoverUrlService(ns, service)
		if err != nil {
			// Look in jaeger Query Default Service
			service := jaeger
			url, err = discoverUrlService(ns, service)
			if err == nil {
				log.Debugf("Kiali found Jaeger in %s", url)
			} else {
				log.Debugf("Kiali not found Tracing/Jaerger")
			}
		} else {
			log.Debugf("Kiali found Tracing in %s", url)
		}

		// We found the Tracing service in Tracing or Jaeger Default
		if err == nil {
			if conf.ExternalServices.Tracing.URL == "" {
				path, err := checkIfQueryBasePath(ns, service)
				if err != nil {
					log.Debugf("Error checking the query base path")
				}
				conf.ExternalServices.Tracing.URL = url + path // Overwrite URL if the user didn't set
			}
			// Tracing is ENABLED
			conf.ExternalServices.Tracing.EnableJaeger = true
			// Set the service
			conf.ExternalServices.Tracing.Service = service
		}
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
		config.Set(conf)
		return conf.ExternalServices.Tracing.URL, nil
	}

	return checkTracingService()
}

func DiscoverGrafana() (url string, err error) {
	conf := config.Get()
	// If display link is disable in Grafana configuration return empty string and avoid discover
	if !conf.ExternalServices.Grafana.DisplayLink {
		return "", nil
	}
	if conf.ExternalServices.Grafana.URL != "" {
		return conf.ExternalServices.Grafana.URL, nil
	}
	log.Debugf("Kiali is looking for Grafana service ...")
	url, err = discoverUrlService(config.Get().ExternalServices.Grafana.ServiceNamespace, config.Get().ExternalServices.Grafana.Service)
	if err != nil {
		log.Debugf("Kiali not found Grafana in service %s error: %s", config.Get().ExternalServices.Grafana.Service, err)
	} else {
		log.Debugf("Kiali found Grafana in %s", url)
	}
	conf.ExternalServices.Grafana.URL = url
	config.Set(conf)
	return url, err
}

func discoverUrlService(ns string, service string) (url string, err error) {
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
	} else {
		return "http://" + host, nil
	}
}
