package business

import (
	"fmt"
	"time"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/prometheus"
	yaml "gopkg.in/yaml.v2"
)

const (
	defaultPrometheusGlobalScrapeInterval = 15 // seconds
)

type prometheusPartialConfig struct {
	Global struct {
		Scrape_interval string
	}
}

// GetPublicConfig creates a PublicConfig struct based on Kiali configuration and Prometheus configuration
func GetPublicConfig() config.PublicConfig {
	// Note that determine the Prometheus config at request time because it is not
	// guaranteed to remain the same during the Kiali lifespan.
	promConfig := getPrometheusConfig()
	cfg := config.Get()
	var webRoot string
	if cfg.Server.WebRoot != "/" {
		webRoot = cfg.Server.WebRoot
	}
	return config.PublicConfig{
		IstioNamespace: cfg.IstioNamespace,
		IstioLabels:    cfg.IstioLabels,
		WebRoot:        webRoot,
		Prometheus: config.PrometheusConfig{
			GlobalScrapeInterval: promConfig.GlobalScrapeInterval,
			StorageTsdbRetention: promConfig.StorageTsdbRetention,
		},
	}
}

// getPrometheusConfig uses prom client to query config such as metrics TTL
func getPrometheusConfig() config.PrometheusConfig {
	promConfig := config.PrometheusConfig{
		GlobalScrapeInterval: defaultPrometheusGlobalScrapeInterval,
	}

	client, err := prometheus.NewClient()
	if !checkErr(err, "") {
		log.Error(err)
		return promConfig
	}

	configResult, err := client.GetConfiguration()
	if checkErr(err, "Failed to fetch Prometheus configuration") {
		var partial prometheusPartialConfig
		if checkErr(yaml.Unmarshal([]byte(configResult.YAML), &partial), "Failed to unmarshal Prometheus configuration") {
			scrapeIntervalString := partial.Global.Scrape_interval
			scrapeInterval, err := time.ParseDuration(scrapeIntervalString)
			if checkErr(err, fmt.Sprintf("Invalid global scrape interval [%s]", scrapeIntervalString)) {
				promConfig.GlobalScrapeInterval = int64(scrapeInterval.Seconds())
			}
		}
	}

	flags, err := client.GetFlags()
	if checkErr(err, "Failed to fetch Prometheus flags") {
		if retentionString, ok := flags["storage.tsdb.retention"]; ok {
			retention, err := time.ParseDuration(retentionString)
			if checkErr(err, fmt.Sprintf("Invalid storage.tsdb.retention [%s]", retentionString)) {
				promConfig.StorageTsdbRetention = int64(retention.Seconds())
			}
		}
	}

	return promConfig
}

func checkErr(err error, message string) bool {
	if err != nil {
		log.Errorf("%s: %v", message, err)
		return false
	}
	return true
}
