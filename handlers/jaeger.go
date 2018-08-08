package handlers

import (
	"errors"
	"fmt"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/services/models"
)

/** Proxy solution Jaeger*/
func ProxyJaeger(w http.ResponseWriter, r *http.Request) {
	jaegerConfig := config.Get().ExternalServices.Jaeger
	// It assumes that jaeger internally is accessible through http. This is how it works in Istio 1.0 GA.
	url, err := url.Parse(fmt.Sprintf("http://%s.%s:%s/", jaegerConfig.Service, jaegerConfig.ServiceNamespace, jaegerConfig.ServicePort))
	if err != nil {
		log.Error(err)
		return
	}
	proxy := httputil.ReverseProxy{Director: func(r *http.Request) {
		r.URL.Scheme = url.Scheme
		r.URL.Host = url.Host
		r.URL.Path = strings.Replace(r.URL.Path, "/api/jaeger", "", -1)
		r.Host = url.Host
	}}
	proxy.ServeHTTP(w, r)
}

/** End solution */

// GetjaegerInfo provides the jaeger URL, first by checking if a config exists
// then (if not) by inspecting the Kubernetes Jaeger service in namespace istio-system
func GetJaegerInfo(w http.ResponseWriter, r *http.Request) {
	conf := config.Get()
	info, code, err := getJaegerInfo(getOpenshiftRouteURL, getService)
	if err != nil {
		log.Error(err)
		RespondWithError(w, code, err.Error())
		return
	}
	/** Request the proxy solution */
	urlKiali, _ := getOpenshiftRouteURL(conf.IstioNamespace, conf.KialiService)
	url, _ := url.Parse(urlKiali)

	info.URL = fmt.Sprintf("%s://%s:%s", url.Scheme, url.Host, "32439")
	/** End Request proxy solution */
	RespondWithJSON(w, code, info)
}

// getJaegerInfo returns the Jaeger URL, the HTTP status code (int) and eventually an error
func getJaegerInfo(osRouteSupplier osRouteSupplier, serviceSupplier serviceSupplier) (*models.JaegerInfo, int, error) {
	jaegerConfig := config.Get().ExternalServices.Jaeger
	jaegerInfo := models.JaegerInfo{
		URL: jaegerConfig.URL}
	if jaegerInfo.URL != "" {
		return &jaegerInfo, http.StatusOK, nil
	}

	url, err := osRouteSupplier(jaegerConfig.ServiceNamespace, jaegerConfig.Service)
	if err == nil {
		jaegerInfo.URL = url
		return &jaegerInfo, http.StatusOK, nil
	}
	// Else on error, silently continue. Might not be running on OpenShift.

	spec, err := serviceSupplier(jaegerConfig.ServiceNamespace, jaegerConfig.Service)
	if err != nil {
		return nil, http.StatusInternalServerError, err
	}

	if len(spec.ExternalIPs) == 0 {
		return nil, http.StatusNotFound, errors.New("Unable to find Jaeger URL: no route defined. ExternalIPs not defined on service 'jaeger'")
	}
	var port int32
	port = 80

	if len(spec.ExternalIPs) > 1 {
		log.Warning("Several IPs found for service 'jaeger', only the first will be used")
	}
	if len(spec.Ports) > 0 {
		port = spec.Ports[0].Port
		if len(spec.Ports) > 1 {
			log.Warning("Several ports found for service 'jaeger', only the first will be used")
		}
	}

	// detect https?
	jaegerInfo.URL = fmt.Sprintf("http://%s:%d", spec.ExternalIPs[0], port)
	return &jaegerInfo, http.StatusOK, nil
}
