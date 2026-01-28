/*
  This file contains testing helpers for the handlers package.
*/

package handlers

import (
	"fmt"
	"net/http"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	dto "github.com/prometheus/client_model/go"
	core_v1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/tools/clientcmd/api"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/handlers/authentication"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/prometheus/internalmetrics"
	"github.com/kiali/kiali/util"
)

func mockClock() {
	clockTime := time.Date(2017, 0o1, 15, 0, 0, 0, 0, time.UTC)
	util.Clock = util.ClockMock{Time: clockTime}
}

type noPrivClient struct {
	kubernetes.UserClientInterface
}

func (n *noPrivClient) GetNamespace(namespace string) (*core_v1.Namespace, error) {
	return nil, errors.NewForbidden(schema.GroupResource{Group: core_v1.GroupName, Resource: "namespaces"}, "namespace", fmt.Errorf("Rejecting"))
}

func (n *noPrivClient) GetNamespaces(labelSelector string) ([]core_v1.Namespace, error) {
	return nil, errors.NewForbidden(schema.GroupResource{Group: core_v1.GroupName, Resource: "namespaces"}, "", fmt.Errorf("Rejecting"))
}

// WithAuthInfo injects the given auth info into the request context of the given handler.
// Useful for testing only.
func WithAuthInfo(authInfo map[string]*api.AuthInfo, hf http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		context := authentication.SetAuthInfoContext(r.Context(), authInfo)
		hf(w, r.WithContext(context))
	}
}

// WithFakeAuthInfo helper for WithAuthInfo that injects a fake token.
func WithFakeAuthInfo(conf *config.Config, hf http.HandlerFunc) http.HandlerFunc {
	authInfo := map[string]*api.AuthInfo{conf.KubernetesConfig.ClusterName: {Token: "test"}}
	return WithAuthInfo(authInfo, hf)
}

// GraphCacheMetrics holds graph cache metrics that can be exposed via the API.
// This is useful for testing and monitoring without having to scrape the Prometheus metrics endpoint.
type GraphCacheMetrics struct {
	GraphCacheEvictions float64 `json:"graphCacheEvictions"`
	GraphCacheHits      float64 `json:"graphCacheHits"`
	GraphCacheMisses    float64 `json:"graphCacheMisses"`
}

// getCounterValue extracts the current value from a Prometheus Counter.
func getCounterValue(counter prometheus.Counter) float64 {
	m := &dto.Metric{}
	if err := counter.Write(m); err != nil {
		return 0
	}
	return m.Counter.GetValue()
}

// GraphCacheMetricsHandler returns Kiali's graph cache metrics in JSON format.
// This endpoint provides a simple way to access internal metrics without having to
// parse the Prometheus text format from the /metrics endpoint.
func GraphCacheMetricsHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		metrics := GraphCacheMetrics{
			GraphCacheEvictions: getCounterValue(internalmetrics.GetGraphCacheEvictionsTotalMetric()),
			GraphCacheHits:      getCounterValue(internalmetrics.GetGraphCacheHitsTotalMetric()),
			GraphCacheMisses:    getCounterValue(internalmetrics.GetGraphCacheMissesTotalMetric()),
		}

		RespondWithJSON(w, http.StatusOK, metrics)
	}
}

// HealthCacheMetrics holds health cache metrics that can be exposed via the API.
// This is useful for testing and monitoring without having to scrape the Prometheus metrics endpoint.
type HealthCacheMetrics struct {
	HealthCacheHits   float64 `json:"healthCacheHits"`
	HealthCacheMisses float64 `json:"healthCacheMisses"`
}

// getCounterVecTotal sums up all values from a CounterVec across all label combinations.
func getCounterVecTotal(counterVec *prometheus.CounterVec) float64 {
	ch := make(chan prometheus.Metric, 100)
	go func() {
		counterVec.Collect(ch)
		close(ch)
	}()

	var total float64
	for metric := range ch {
		m := &dto.Metric{}
		if err := metric.Write(m); err == nil && m.Counter != nil {
			total += m.Counter.GetValue()
		}
	}
	return total
}

// HealthCacheMetricsHandler returns Kiali's health cache metrics in JSON format.
// This endpoint provides a simple way to access internal metrics without having to
// parse the Prometheus text format from the /metrics endpoint.
func HealthCacheMetricsHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		metrics := HealthCacheMetrics{
			HealthCacheHits:   getCounterVecTotal(internalmetrics.GetHealthCacheHitsTotalMetric()),
			HealthCacheMisses: getCounterVecTotal(internalmetrics.GetHealthCacheMissesTotalMetric()),
		}

		RespondWithJSON(w, http.StatusOK, metrics)
	}
}
