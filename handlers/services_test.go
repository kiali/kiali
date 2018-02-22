package handlers

import (
	"github.com/swift-sunshine/swscore/config"
)

func setupConfig() {
	conf := config.NewConfig()
	conf.PrometheusServiceURL = "http://prometheus-istio-system.127.0.0.1.nip.io"
	config.Set(conf)
}

// Integration test. Manual for the moment.
// func TestGetServiceMetrics(t *testing.T) {
// 	setupConfig()
// 	startServer()
// 	// Open up your browser and hit http://127.0.0.1:8000/api/namespaces/tutorial/services/preference/metrics
// }

// func startServer() {
// 	conf := config.Get()
// 	router := routing.NewRouter(conf)
// 	srv := &http.Server{
// 		Handler:      router,
// 		Addr:         "127.0.0.1:8000",
// 		WriteTimeout: 15 * time.Second,
// 		ReadTimeout:  15 * time.Second,
// 	}
// 	log.Fatal(srv.ListenAndServe())
// }
