package prometheus

import (
	"github.com/swift-sunshine/swscore/config"
)

func setupConfig() {
	conf := config.NewConfig()
	conf.PrometheusServiceURL = "http://prometheus-istio-system.127.0.0.1.nip.io"
	config.Set(conf)
}

// For now it's just a runnable manual test rather than an itest.
// To be transformed in itest when we have a test environment ready.
// func TestGetSourceServices(t *testing.T) {
// 	setupConfig()
// 	prometheusClient, err := NewClient()
// 	if err != nil {
// 		t.Error(err)
// 		return
// 	}
// 	fmt.Printf("Dependencies: \n")
// 	incomeServices, err := prometheusClient.GetSourceServices("tutorial", "preference")
// 	if err != nil {
// 		t.Error(err)
// 		return
// 	}
// 	for dest, origin := range incomeServices {
// 		fmt.Printf("To: %s, From: %s \n", dest, origin)
// 	}
// }

// For now it's just a runnable manual test rather than an itest.
// To be transformed in itest when we have a test environment ready.
// func TestGetServiceMetrics(t *testing.T) {
// 	setupConfig()
// 	prometheusClient, err := NewClient()
// 	if err != nil {
// 		t.Error(err)
// 		return
// 	}
// 	fmt.Printf("Metrics: \n")
// 	metrics, err := prometheusClient.GetServiceMetrics("tutorial", "preference", "5m")
// 	if err != nil {
// 		t.Error(err)
// 		return
// 	}
// 	for desc, metric := range metrics {
// 		fmt.Printf("Description: %s, Metric: %v \n", desc, metric)
// 	}
// }
