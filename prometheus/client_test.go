package prometheus

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"

	"github.com/prometheus/client_golang/api/prometheus/v1"
	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/mock"
	"github.com/swift-sunshine/swscore/config"
)

// Setup mock

type promAPIMock struct {
	mock.Mock
}

func (o *promAPIMock) Query(ctx context.Context, query string, ts time.Time) (model.Value, error) {
	args := o.Called(ctx, query, ts)
	return args.Get(0).(model.Value), args.Error(1)
}

func (o *promAPIMock) QueryRange(ctx context.Context, query string, r v1.Range) (model.Value, error) {
	args := o.Called(ctx, query, r)
	return args.Get(0).(model.Value), args.Error(1)
}

func (o *promAPIMock) LabelValues(ctx context.Context, label string) (model.LabelValues, error) {
	args := o.Called(ctx, label)
	return args.Get(0).(model.LabelValues), args.Error(1)
}

func (o *promAPIMock) Series(ctx context.Context, matches []string, startTime time.Time, endTime time.Time) ([]model.LabelSet, error) {
	args := o.Called(ctx, matches, startTime, endTime)
	return args.Get(0).([]model.LabelSet), args.Error(1)
}

func setupMocked() (*Client, *promAPIMock, error) {
	config.Set(config.NewConfig())
	api := new(promAPIMock)
	client, err := NewClient()
	if err != nil {
		return nil, nil, err
	}
	client.inject(api)
	return client, api, nil
}

func TestGetSourceServices(t *testing.T) {
	rqCustV1 := model.Metric{
		"__name__":            "istio_request_count",
		"instance":            "172.17.0.6:42422",
		"job":                 "istio-mesh",
		"response_code":       "200",
		"source_service":      "customer.istio-system.svc.cluster.local",
		"source_version":      "v1",
		"destination_service": "productpage.istio-system.svc.cluster.local",
		"destination_version": "v1"}
	rqCustV2 := model.Metric{
		"__name__":            "istio_request_count",
		"instance":            "172.17.0.6:42422",
		"job":                 "istio-mesh",
		"response_code":       "200",
		"source_service":      "customer.istio-system.svc.cluster.local",
		"source_version":      "v2",
		"destination_service": "productpage.istio-system.svc.cluster.local",
		"destination_version": "v1"}
	rqCustV2ToV2 := model.Metric{
		"__name__":            "istio_request_count",
		"instance":            "172.17.0.6:42422",
		"job":                 "istio-mesh",
		"response_code":       "200",
		"source_service":      "customer.istio-system.svc.cluster.local",
		"source_version":      "v2",
		"destination_service": "productpage.istio-system.svc.cluster.local",
		"destination_version": "v2"}
	vector := model.Vector{
		&model.Sample{
			Metric: rqCustV1,
			Value:  4},
		&model.Sample{
			Metric: rqCustV2,
			Value:  1},
		&model.Sample{
			Metric: rqCustV2ToV2,
			Value:  2}}

	client, api, err := setupMocked()
	if err != nil {
		t.Error(err)
		return
	}
	mockQuery(api, "istio_request_count{destination_service=\"productpage.istio-system.svc.cluster.local\"}", &vector)
	sources, err := client.GetSourceServices("istio-system", "productpage")
	if err != nil {
		t.Error(err)
		return
	}
	assert.Equal(t, 2, len(sources), "Map should have 2 keys (versions)")
	assert.Equal(t, 2, len(sources["v1"]), "v1 should have 2 sources")
	assert.Equal(t, "customer.istio-system/v1", sources["v1"][0])
	assert.Equal(t, "customer.istio-system/v2", sources["v1"][1])
	assert.Equal(t, 1, len(sources["v2"]), "v2 should have 1 source")
	assert.Equal(t, "customer.istio-system/v2", sources["v2"][0])
}

func TestGetServiceMetrics(t *testing.T) {
	client, api, err := setupMocked()
	if err != nil {
		t.Error(err)
		return
	}
	mockSingle(api, "envoy_cluster_out_productpage_istio_system_svc_cluster_local_http_membership_healthy", 0)
	mockSingle(api, "envoy_cluster_out_productpage_istio_system_svc_cluster_local_http_membership_total", 1)
	mockSingle(api, "rate(istio_request_count{source_service=\"productpage.istio-system.svc.cluster.local\"}[5m])", 1.5)
	mockSingle(api, "rate(istio_request_count{destination_service=\"productpage.istio-system.svc.cluster.local\"}[5m])", 2.5)
	mockHistogram(api, "istio_request_size", "{source_service=\"productpage.istio-system.svc.cluster.local\"}[5m]", 0.35, 0.2, 0.3, 0.4)
	mockHistogram(api, "istio_request_duration", "{source_service=\"productpage.istio-system.svc.cluster.local\"}[5m]", 0.35, 0.2, 0.3, 0.5)
	mockHistogram(api, "istio_response_size", "{source_service=\"productpage.istio-system.svc.cluster.local\"}[5m]", 0.35, 0.2, 0.3, 0.6)
	mockHistogram(api, "istio_request_size", "{destination_service=\"productpage.istio-system.svc.cluster.local\"}[5m]", 0.35, 0.2, 0.3, 0.7)
	mockHistogram(api, "istio_request_duration", "{destination_service=\"productpage.istio-system.svc.cluster.local\"}[5m]", 0.35, 0.2, 0.3, 0.8)
	mockHistogram(api, "istio_response_size", "{destination_service=\"productpage.istio-system.svc.cluster.local\"}[5m]", 0.35, 0.2, 0.3, 0.9)
	metrics, err := client.GetServiceMetrics("istio-system", "productpage", "5m")
	if err != nil {
		t.Error(err)
		return
	}
	// for desc, metric := range metrics {
	// 	fmt.Printf("Description: %s, Metric: %v \n", desc, metric)
	// }
	assert.Equal(t, 10, len(metrics), "Should have 10 metrics")
	assert.IsType(t, &MetricValue{}, metrics["total_replicas"])
	assert.Equal(t, 1.0, metrics["total_replicas"].(*MetricValue).Value)
	assert.IsType(t, &MetricValue{}, metrics["healthy_replicas"])
	assert.Equal(t, 0.0, metrics["healthy_replicas"].(*MetricValue).Value)
	assert.IsType(t, &MetricValue{}, metrics["request_count_in"])
	assert.Equal(t, 2.5, metrics["request_count_in"].(*MetricValue).Value)
	assert.IsType(t, &MetricValue{}, metrics["request_count_out"])
	assert.Equal(t, 1.5, metrics["request_count_out"].(*MetricValue).Value)
	assert.IsType(t, &MetricHistogram{}, metrics["request_size_out"])
	assert.Equal(t, 0.35, metrics["request_size_out"].(*MetricHistogram).Average)
	assert.Equal(t, 0.2, metrics["request_size_out"].(*MetricHistogram).Median)
	assert.Equal(t, 0.3, metrics["request_size_out"].(*MetricHistogram).Percentile95)
	assert.Equal(t, 0.4, metrics["request_size_out"].(*MetricHistogram).Percentile99)
	assert.IsType(t, &MetricHistogram{}, metrics["request_duration_out"])
	assert.Equal(t, 0.5, metrics["request_duration_out"].(*MetricHistogram).Percentile99)
	assert.IsType(t, &MetricHistogram{}, metrics["response_size_out"])
	assert.Equal(t, 0.6, metrics["response_size_out"].(*MetricHistogram).Percentile99)
	assert.IsType(t, &MetricHistogram{}, metrics["request_size_in"])
	assert.Equal(t, 0.7, metrics["request_size_in"].(*MetricHistogram).Percentile99)
	assert.IsType(t, &MetricHistogram{}, metrics["request_duration_in"])
	assert.Equal(t, 0.8, metrics["request_duration_in"].(*MetricHistogram).Percentile99)
	assert.IsType(t, &MetricHistogram{}, metrics["response_size_in"])
	assert.Equal(t, 0.9, metrics["response_size_in"].(*MetricHistogram).Percentile99)
}

func mockQuery(api *promAPIMock, query string, ret *model.Vector) {
	api.On(
		"Query",
		mock.AnythingOfType("*context.emptyCtx"),
		query,
		mock.AnythingOfType("time.Time")).
		Return(*ret, nil)
}

func mockSingle(api *promAPIMock, query string, ret model.SampleValue) {
	metric := model.Metric{
		"__name__": "whatever",
		"instance": "whatever",
		"job":      "whatever"}
	vector := model.Vector{
		&model.Sample{
			Metric: metric,
			Value:  ret}}
	mockQuery(api, query, &vector)
}

func mockHistogram(api *promAPIMock, baseName string, suffix string, retAvg model.SampleValue, retMed model.SampleValue, ret95 model.SampleValue, ret99 model.SampleValue) {
	histMetric := "sum(rate(" + baseName + "_bucket" + suffix + ")) by (le))"
	mockSingle(api, "histogram_quantile(0.5, "+histMetric, retMed)
	mockSingle(api, "histogram_quantile(0.95, "+histMetric, ret95)
	mockSingle(api, "histogram_quantile(0.99, "+histMetric, ret99)
	mockSingle(api, "sum(rate("+baseName+"_sum"+suffix+")) / sum(rate("+baseName+"_count"+suffix+"))", retAvg)
}

func setupExternal() (*Client, error) {
	conf := config.NewConfig()
	conf.PrometheusServiceURL = "http://prometheus-istio-system.127.0.0.1.nip.io"
	config.Set(conf)
	return NewClient()
}

// Fake test / runnable function for manual test against actual server.
func TestAgainstLiveGetSourceServices(t *testing.T) {
	client, err := setupExternal()
	if err != nil {
		fmt.Printf("TestAgainstLive / Client error: %v\n", err)
		return
	}
	sources, err := client.GetSourceServices("istio-system", "productpage")
	if err != nil {
		fmt.Printf("TestAgainstLive / GetSourceServices error: %v\n", err)
		return
	}
	for dest, origin := range sources {
		fmt.Printf("To: %s, From: %s \n", dest, origin)
	}
}

// Fake test / runnable function for manual test against actual server.
func TestAgainstLiveGetServiceMetrics(t *testing.T) {
	client, err := setupExternal()
	if err != nil {
		fmt.Printf("TestAgainstLive / Client error: %v\n", err)
		return
	}
	fmt.Printf("Metrics: \n")
	metrics, err := client.GetServiceMetrics("istio-system", "productpage", "5m")
	if err != nil {
		fmt.Printf("TestAgainstLive / GetServiceMetrics error: %v\n", err)
		return
	}
	for desc, metric := range metrics {
		fmt.Printf("Description: %s, Metric: %v \n", desc, metric)
	}
}
