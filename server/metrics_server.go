package server

import (
	"fmt"
	"net/http"

	"github.com/prometheus/client_golang/prometheus/promhttp"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/log"
)

var metricsServer *http.Server

// StartMetricsServer starts a new HTTP server forthat exposes Kiali internal metrics in Prometheus format
func StartMetricsServer() {
	conf := config.Get()
	log.Infof("Starting Metrics Server on [%v:%v]", conf.Server.Address, conf.Server.MetricsPort)
	metricsServer = &http.Server{
		Addr:    fmt.Sprintf("%v:%v", conf.Server.Address, conf.Server.MetricsPort),
		Handler: promhttp.Handler(),
	}
	go func() {
		log.Warning(metricsServer.ListenAndServe())
	}()
}

// StopMetricsServer stops the metrics server
func StopMetricsServer() {
	if metricsServer != nil {
		log.Info("Stopping Metrics Server")
		metricsServer.Close()
		metricsServer = nil
	}
}
