package jobs

import (
	"time"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/util"
)

var (
	lastPublicConfig *config.PublicConfig
)

// StartPeriodicJob starts a "ticker" that runs various periodic checks on external services
func StartPeriodicJob(duration time.Duration, jobs ...func()) chan bool {
	checkAll(jobs)
	ticker := time.NewTicker(duration)
	quit := make(chan bool)
	go func() {
		for {
			select {
			case <-ticker.C:
				checkAll(jobs)
			case <-quit:
				ticker.Stop()
				return
			}
		}
	}()
	return quit
}

func checkAll(jobs []func()) {
	for _, job := range jobs {
		job()
	}
}

func CheckPublicConfig() {
	publicConfig := business.GetPublicConfig()
	// Compare only prometheus values, the others are not (yet?) expected to change
	if lastPublicConfig == nil ||
		lastPublicConfig.Prometheus.GlobalScrapeInterval != publicConfig.Prometheus.GlobalScrapeInterval ||
		lastPublicConfig.Prometheus.StorageTsdbRetention != publicConfig.Prometheus.StorageTsdbRetention {
		log.Infof("Found new PublicConfig, updating")
		if lastPublicConfig == nil && publicConfig.WebRoot != "" {
			util.UpdateBaseURL(publicConfig.WebRoot)
		}
		err := publicConfig.ToEnvJS()
		if err != nil {
			log.Errorf("Could not generate env.js from public config: %s", err)
		}
		lastPublicConfig = &publicConfig
	}
}

func CheckJaeger() {
	// check if Jaeger is available
	_, err := business.GetJaegerServices()
	if err != nil {
		business.JaegerAvailable = false
		log.Errorf("Jaeger is not available: %s", err)
	} else {
		business.JaegerAvailable = true
	}
}
