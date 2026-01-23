package server

import (
	"crypto/tls"
	"fmt"
	"net/http"
	"time"

	"github.com/prometheus/client_golang/prometheus/promhttp"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/log"
)

var metricsServer *http.Server

// StartMetricsServer starts a new HTTP server that exposes Kiali internal metrics in Prometheus format.
// When the main server uses TLS, the metrics server also uses TLS with the same policy enforcement.
func StartMetricsServer(conf *config.Config) {
	log.Infof("Starting Metrics Server on [%v:%v]", conf.Server.Address, conf.Server.Observability.Metrics.Port)
	metricsServer = &http.Server{
		Addr:         fmt.Sprintf("%s:%d", conf.Server.Address, conf.Server.Observability.Metrics.Port),
		Handler:      promhttp.Handler(),
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 30 * time.Second,
	}

	// Apply TLS configuration if the main server uses TLS
	if conf.IsServerHTTPS() {
		tlsConfig := &tls.Config{
			NextProtos: []string{"h2", "http/1.1"},
		}
		conf.ResolvedTLSPolicy.ApplyTo(tlsConfig)
		metricsServer.TLSConfig = tlsConfig
	}

	go func() {
		var err error
		if conf.IsServerHTTPS() {
			log.Info("Metrics Server will require https")
			err = metricsServer.ListenAndServeTLS(conf.Identity.CertFile, conf.Identity.PrivateKeyFile)
		} else {
			err = metricsServer.ListenAndServe()
		}
		log.Warning(err)
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
