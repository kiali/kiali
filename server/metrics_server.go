package server

import (
	"fmt"
	"net/http"
	"time"

	"github.com/prometheus/client_golang/prometheus/promhttp"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/log"
)

var metricsServer *http.Server

// StartMetricsServer starts a new HTTP server forthat exposes Kiali internal metrics in Prometheus format
func StartMetricsServer(conf *config.Config) {
	log.Infof("Starting Metrics Server on [%v:%v]", conf.Server.Address, conf.Server.Observability.Metrics.Port)
	metricsServer = &http.Server{
		Addr:         fmt.Sprintf("%s:%d", conf.Server.Address, conf.Server.Observability.Metrics.Port),
		Handler:      promhttp.Handler(),
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 30 * time.Second,
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
