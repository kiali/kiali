package handlers

import (
	"fmt"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/services/models"
)

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

// GetJaegerInfo provides the proxy Jaeger URL
func GetJaegerInfo(w http.ResponseWriter, r *http.Request) {
	conf := config.Get()
	urlKiali, err := getOpenshiftRouteURL(conf.IstioNamespace, conf.KialiService)
	if err != nil {
		log.Error(err)
		RespondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}
	url, _ := url.Parse(urlKiali)

	info := models.JaegerInfo{
		URL: fmt.Sprintf("%s://%s:%s", url.Scheme, url.Host, "32439"),
	}
	RespondWithJSON(w, http.StatusOK, info)
}
