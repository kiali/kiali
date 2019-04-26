package prometheustest

import (
	"fmt"
	"testing"
	"time"

	prom_v1 "github.com/prometheus/client_golang/api/prometheus/v1"
	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/prometheus"
)

func setupMocked() (*prometheus.Client, *PromAPIMock, error) {
	config.Set(config.NewConfig())
	api := new(PromAPIMock)
	client, err := prometheus.NewClient()
	if err != nil {
		return nil, nil, err
	}
	client.Inject(api)
	return client, api, nil
}

func round(q string) string {
	return fmt.Sprintf("round(%s, 0.001000) > 0.001000 or %s", q, q)
}

func TestGetServiceMetrics(t *testing.T) {
	client, api, err := setupMocked()
	if err != nil {
		t.Error(err)
		return
	}

	q := prometheus.IstioMetricsQuery{
		Namespace: "bookinfo",
		Service:   "productpage",
	}
	q.FillDefaults()
	q.Direction = "inbound"
	q.RateInterval = "5m"
	q.Quantiles = []string{"0.99"}
	expectedRange := prom_v1.Range{
		Start: q.Start,
		End:   q.End,
		Step:  q.Step,
	}

	mockWithRange(api, expectedRange, round("sum(rate(istio_requests_total{reporter=\"source\",destination_service_name=\"productpage\",destination_service_namespace=\"bookinfo\"}[5m]))"), 2.5)
	mockWithRange(api, expectedRange, round("sum(rate(istio_requests_total{reporter=\"source\",destination_service_name=\"productpage\",destination_service_namespace=\"bookinfo\",response_code=~\"[5|4].*\"}[5m]))"), 4.5)
	mockWithRange(api, expectedRange, round("sum(rate(istio_tcp_received_bytes_total{reporter=\"source\",destination_service_name=\"productpage\",destination_service_namespace=\"bookinfo\"}[5m]))"), 11)
	mockWithRange(api, expectedRange, round("sum(rate(istio_tcp_sent_bytes_total{reporter=\"source\",destination_service_name=\"productpage\",destination_service_namespace=\"bookinfo\"}[5m]))"), 13)
	mockHistogram(api, "istio_request_bytes", "{reporter=\"source\",destination_service_name=\"productpage\",destination_service_namespace=\"bookinfo\"}[5m]", 0.35, 0.2, 0.3, 0.7)
	mockHistogram(api, "istio_request_duration_seconds", "{reporter=\"source\",destination_service_name=\"productpage\",destination_service_namespace=\"bookinfo\"}[5m]", 0.35, 0.2, 0.3, 0.8)
	mockHistogram(api, "istio_response_bytes", "{reporter=\"source\",destination_service_name=\"productpage\",destination_service_namespace=\"bookinfo\"}[5m]", 0.35, 0.2, 0.3, 0.9)

	// Test that range and rate interval are changed when needed (namespace bounds)
	metrics := client.GetMetrics(&q)

	assert.Equal(t, 4, len(metrics.Metrics), "Should have 4 simple metrics")
	assert.Equal(t, 3, len(metrics.Histograms), "Should have 3 histograms")
	rqCountIn := metrics.Metrics["request_count"]
	assert.NotNil(t, rqCountIn)
	rqErrorCountIn := metrics.Metrics["request_error_count"]
	assert.NotNil(t, rqCountIn)
	rqSizeIn := metrics.Histograms["request_size"]
	assert.NotNil(t, rqSizeIn)
	rqDurationIn := metrics.Histograms["request_duration"]
	assert.NotNil(t, rqDurationIn)
	rsSizeIn := metrics.Histograms["response_size"]
	assert.NotNil(t, rsSizeIn)
	tcpRecIn := metrics.Metrics["tcp_received"]
	assert.NotNil(t, tcpRecIn)
	tcpSentIn := metrics.Metrics["tcp_sent"]
	assert.NotNil(t, tcpSentIn)

	assert.Equal(t, 2.5, float64(rqCountIn.Matrix[0].Values[0].Value))
	assert.Equal(t, 4.5, float64(rqErrorCountIn.Matrix[0].Values[0].Value))
	assert.Equal(t, 0.7, float64(rqSizeIn["0.99"].Matrix[0].Values[0].Value))
	assert.Equal(t, 0.8, float64(rqDurationIn["0.99"].Matrix[0].Values[0].Value))
	assert.Equal(t, 0.9, float64(rsSizeIn["0.99"].Matrix[0].Values[0].Value))
	assert.Equal(t, 11.0, float64(tcpRecIn.Matrix[0].Values[0].Value))
	assert.Equal(t, 13.0, float64(tcpSentIn.Matrix[0].Values[0].Value))
}

func TestGetAppMetrics(t *testing.T) {
	client, api, err := setupMocked()
	if err != nil {
		t.Error(err)
		return
	}
	mockRange(api, round("sum(rate(istio_requests_total{reporter=\"source\",source_workload_namespace=\"bookinfo\",source_app=\"productpage\"}[5m]))"), 1.5)
	mockRange(api, round("sum(rate(istio_requests_total{reporter=\"source\",source_workload_namespace=\"bookinfo\",source_app=\"productpage\",response_code=~\"[5|4].*\"}[5m]))"), 3.5)
	mockRange(api, round("sum(rate(istio_tcp_received_bytes_total{reporter=\"source\",source_workload_namespace=\"bookinfo\",source_app=\"productpage\"}[5m]))"), 10)
	mockRange(api, round("sum(rate(istio_tcp_sent_bytes_total{reporter=\"source\",source_workload_namespace=\"bookinfo\",source_app=\"productpage\"}[5m]))"), 12)
	mockHistogram(api, "istio_request_bytes", "{reporter=\"source\",source_workload_namespace=\"bookinfo\",source_app=\"productpage\"}[5m]", 0.35, 0.2, 0.3, 0.4)
	mockHistogram(api, "istio_request_duration_seconds", "{reporter=\"source\",source_workload_namespace=\"bookinfo\",source_app=\"productpage\"}[5m]", 0.35, 0.2, 0.3, 0.5)
	mockHistogram(api, "istio_response_bytes", "{reporter=\"source\",source_workload_namespace=\"bookinfo\",source_app=\"productpage\"}[5m]", 0.35, 0.2, 0.3, 0.6)
	q := prometheus.IstioMetricsQuery{
		Namespace: "bookinfo",
		App:       "productpage",
	}
	q.FillDefaults()
	q.RateInterval = "5m"
	q.Quantiles = []string{"0.5", "0.95", "0.99"}
	metrics := client.GetMetrics(&q)

	assert.Equal(t, 4, len(metrics.Metrics), "Should have 4 simple metrics")
	assert.Equal(t, 3, len(metrics.Histograms), "Should have 3 histograms")
	rqCountIn := metrics.Metrics["request_count"]
	assert.NotNil(t, rqCountIn)
	rqErrorCountIn := metrics.Metrics["request_error_count"]
	assert.NotNil(t, rqErrorCountIn)
	rqSizeIn := metrics.Histograms["request_size"]
	assert.NotNil(t, rqSizeIn)
	rqDurationIn := metrics.Histograms["request_duration"]
	assert.NotNil(t, rqDurationIn)
	rsSizeIn := metrics.Histograms["response_size"]
	assert.NotNil(t, rsSizeIn)
	tcpRecIn := metrics.Metrics["tcp_received"]
	assert.NotNil(t, tcpRecIn)
	tcpSentIn := metrics.Metrics["tcp_sent"]
	assert.NotNil(t, tcpSentIn)

	assert.Equal(t, 1.5, float64(rqCountIn.Matrix[0].Values[0].Value))
	assert.Equal(t, 3.5, float64(rqErrorCountIn.Matrix[0].Values[0].Value))
	assert.Equal(t, 0.35, float64(rqSizeIn["avg"].Matrix[0].Values[0].Value))
	assert.Equal(t, 0.2, float64(rqSizeIn["0.5"].Matrix[0].Values[0].Value))
	assert.Equal(t, 0.3, float64(rqSizeIn["0.95"].Matrix[0].Values[0].Value))
	assert.Equal(t, 0.4, float64(rqSizeIn["0.99"].Matrix[0].Values[0].Value))
	assert.Equal(t, 0.5, float64(rqDurationIn["0.99"].Matrix[0].Values[0].Value))
	assert.Equal(t, 0.6, float64(rsSizeIn["0.99"].Matrix[0].Values[0].Value))
	assert.Equal(t, 10.0, float64(tcpRecIn.Matrix[0].Values[0].Value))
	assert.Equal(t, 12.0, float64(tcpSentIn.Matrix[0].Values[0].Value))
}

func TestGetFilteredAppMetrics(t *testing.T) {
	client, api, err := setupMocked()
	if err != nil {
		t.Error(err)
		return
	}
	mockRange(api, round("sum(rate(istio_requests_total{reporter=\"source\",source_workload_namespace=\"bookinfo\",source_app=\"productpage\"}[5m]))"), 1.5)
	mockHistogram(api, "istio_request_bytes", "{reporter=\"source\",source_workload_namespace=\"bookinfo\",source_app=\"productpage\"}[5m]", 0.35, 0.2, 0.3, 0.4)
	q := prometheus.IstioMetricsQuery{
		Namespace: "bookinfo",
		App:       "productpage",
	}
	q.FillDefaults()
	q.RateInterval = "5m"
	q.Filters = []string{"request_count", "request_size"}
	metrics := client.GetMetrics(&q)

	assert.Equal(t, 1, len(metrics.Metrics), "Should have 1 simple metric")
	assert.Equal(t, 1, len(metrics.Histograms), "Should have 1 histogram")
	rqCountOut := metrics.Metrics["request_count"]
	assert.NotNil(t, rqCountOut)
	rqSizeOut := metrics.Histograms["request_size"]
	assert.NotNil(t, rqSizeOut)
}

func TestGetAppMetricsInstantRates(t *testing.T) {
	client, api, err := setupMocked()
	if err != nil {
		t.Error(err)
		return
	}
	mockRange(api, round("sum(irate(istio_requests_total{reporter=\"source\",source_workload_namespace=\"bookinfo\",source_app=\"productpage\"}[1m]))"), 1.5)
	q := prometheus.IstioMetricsQuery{
		Namespace: "bookinfo",
		App:       "productpage",
	}
	q.FillDefaults()
	q.RateFunc = "irate"
	q.Filters = []string{"request_count"}
	metrics := client.GetMetrics(&q)

	assert.Equal(t, 1, len(metrics.Metrics), "Should have 1 simple metric")
	assert.Equal(t, 0, len(metrics.Histograms), "Should have no histogram")
	rqCountOut := metrics.Metrics["request_count"]
	assert.NotNil(t, rqCountOut)
}

func TestGetAppMetricsUnavailable(t *testing.T) {
	client, api, err := setupMocked()
	if err != nil {
		t.Error(err)
		return
	}
	// Mock everything to return empty data
	mockEmptyRange(api, round("sum(rate(istio_requests_total{reporter=\"source\",source_workload_namespace=\"bookinfo\",source_app=\"productpage\"}[5m]))"))
	mockEmptyHistogram(api, "istio_request_bytes", "{reporter=\"source\",source_workload_namespace=\"bookinfo\",source_app=\"productpage\"}[5m]")
	q := prometheus.IstioMetricsQuery{
		Namespace: "bookinfo",
		App:       "productpage",
	}
	q.FillDefaults()
	q.RateInterval = "5m"
	q.Quantiles = []string{"0.5", "0.95", "0.99"}
	q.Filters = []string{"request_count", "request_size"}
	metrics := client.GetMetrics(&q)

	assert.Equal(t, 1, len(metrics.Metrics), "Should have 1 simple metric")
	assert.Equal(t, 1, len(metrics.Histograms), "Should have 1 histogram")
	rqCountIn := metrics.Metrics["request_count"]
	assert.NotNil(t, rqCountIn)
	rqSizeIn := metrics.Histograms["request_size"]
	assert.NotNil(t, rqSizeIn)

	// Simple metric & histogram are empty
	assert.Empty(t, rqCountIn.Matrix[0].Values)
	assert.Empty(t, rqSizeIn["avg"].Matrix[0].Values)
	assert.Empty(t, rqSizeIn["0.5"].Matrix[0].Values)
	assert.Empty(t, rqSizeIn["0.95"].Matrix[0].Values)
	assert.Empty(t, rqSizeIn["0.99"].Matrix[0].Values)
}

func TestGetNamespaceMetrics(t *testing.T) {
	client, api, err := setupMocked()
	if err != nil {
		t.Error(err)
		return
	}
	mockRange(api, round("sum(rate(istio_requests_total{reporter=\"source\",source_workload_namespace=\"bookinfo\"}[5m]))"), 1.5)
	mockRange(api, round("sum(rate(istio_requests_total{reporter=\"source\",source_workload_namespace=\"bookinfo\",response_code=~\"[5|4].*\"}[5m]))"), 3.5)
	mockRange(api, round("sum(rate(istio_tcp_received_bytes_total{reporter=\"source\",source_workload_namespace=\"bookinfo\"}[5m]))"), 10)
	mockRange(api, round("sum(rate(istio_tcp_sent_bytes_total{reporter=\"source\",source_workload_namespace=\"bookinfo\"}[5m]))"), 12)
	mockHistogram(api, "istio_request_bytes", "{reporter=\"source\",source_workload_namespace=\"bookinfo\"}[5m]", 0.35, 0.2, 0.3, 0.4)
	mockHistogram(api, "istio_request_duration_seconds", "{reporter=\"source\",source_workload_namespace=\"bookinfo\"}[5m]", 0.35, 0.2, 0.3, 0.5)
	mockHistogram(api, "istio_response_bytes", "{reporter=\"source\",source_workload_namespace=\"bookinfo\"}[5m]", 0.35, 0.2, 0.3, 0.6)
	q := prometheus.IstioMetricsQuery{
		Namespace: "bookinfo",
	}
	q.FillDefaults()
	q.RateInterval = "5m"
	q.Quantiles = []string{"0.5", "0.95", "0.99"}
	metrics := client.GetMetrics(&q)

	assert.Equal(t, 4, len(metrics.Metrics), "Should have 4 simple metrics")
	assert.Equal(t, 3, len(metrics.Histograms), "Should have 3 histograms")
	rqCountOut := metrics.Metrics["request_count"]
	assert.NotNil(t, rqCountOut)
	rqErrorCountOut := metrics.Metrics["request_error_count"]
	assert.NotNil(t, rqCountOut)
	rqSizeOut := metrics.Histograms["request_size"]
	assert.NotNil(t, rqSizeOut)
	rqDurationOut := metrics.Histograms["request_duration"]
	assert.NotNil(t, rqDurationOut)
	rsSizeOut := metrics.Histograms["response_size"]
	assert.NotNil(t, rsSizeOut)
	tcpRecOut := metrics.Metrics["tcp_received"]
	assert.NotNil(t, tcpRecOut)
	tcpSentOut := metrics.Metrics["tcp_sent"]
	assert.NotNil(t, tcpSentOut)

	assert.Equal(t, 1.5, float64(rqCountOut.Matrix[0].Values[0].Value))
	assert.Equal(t, 3.5, float64(rqErrorCountOut.Matrix[0].Values[0].Value))
	assert.Equal(t, 0.35, float64(rqSizeOut["avg"].Matrix[0].Values[0].Value))
	assert.Equal(t, 0.2, float64(rqSizeOut["0.5"].Matrix[0].Values[0].Value))
	assert.Equal(t, 0.3, float64(rqSizeOut["0.95"].Matrix[0].Values[0].Value))
	assert.Equal(t, 0.4, float64(rqSizeOut["0.99"].Matrix[0].Values[0].Value))
	assert.Equal(t, 0.5, float64(rqDurationOut["0.99"].Matrix[0].Values[0].Value))
	assert.Equal(t, 0.6, float64(rsSizeOut["0.99"].Matrix[0].Values[0].Value))
	assert.Equal(t, 10.0, float64(tcpRecOut.Matrix[0].Values[0].Value))
	assert.Equal(t, 12.0, float64(tcpSentOut.Matrix[0].Values[0].Value))
}

func TestGetAllRequestRates(t *testing.T) {
	client, api, err := setupMocked()
	if err != nil {
		t.Error(err)
		return
	}

	queryTime := time.Date(2017, 01, 15, 0, 0, 0, 0, time.UTC)

	vectorQ1 := model.Vector{
		&model.Sample{
			Timestamp: model.Now(),
			Value:     model.SampleValue(1),
			Metric:    model.Metric{"foo": "bar"},
		},
	}
	mockQueryWithTime(api, `rate(istio_requests_total{destination_service_namespace="ns",source_workload_namespace!="ns"}[5m])`, queryTime, &vectorQ1)

	vectorQ2 := model.Vector{
		&model.Sample{
			Timestamp: model.Now(),
			Value:     model.SampleValue(2),
			Metric:    model.Metric{"foo": "bar"}},
	}
	mockQueryWithTime(api, `rate(istio_requests_total{source_workload_namespace="ns"}[5m])`, queryTime, &vectorQ2)

	rates, _ := client.GetAllRequestRates("ns", "5m", queryTime)
	assert.Equal(t, 2, rates.Len())
	assert.Equal(t, vectorQ1[0], rates[0])
	assert.Equal(t, vectorQ2[0], rates[1])
}

func TestGetAllRequestRatesIstioSystem(t *testing.T) {
	client, api, err := setupMocked()
	if err != nil {
		t.Error(err)
		return
	}

	queryTime := time.Date(2017, 01, 15, 0, 0, 0, 0, time.UTC)

	vectorQ1 := model.Vector{
		&model.Sample{
			Timestamp: model.Now(),
			Value:     model.SampleValue(1),
			Metric:    model.Metric{"foo": "bar"},
		},
	}
	mockQueryWithTime(api, `rate(istio_requests_total{destination_service_namespace="istio-system",source_workload_namespace!="istio-system"}[5m])`, queryTime, &vectorQ1)

	vectorQ2 := model.Vector{
		&model.Sample{
			Timestamp: model.Now(),
			Value:     model.SampleValue(2),
			Metric:    model.Metric{"foo": "bar"}},
	}
	mockQueryWithTime(api, `rate(istio_requests_total{source_workload_namespace="istio-system"}[5m])`, queryTime, &vectorQ2)

	rates, _ := client.GetAllRequestRates("istio-system", "5m", queryTime)
	assert.Equal(t, 2, rates.Len())
	assert.Equal(t, vectorQ1[0], rates[0])
	assert.Equal(t, vectorQ2[0], rates[1])
}

func TestGetNamespaceServicesRequestRates(t *testing.T) {
	client, api, err := setupMocked()
	if err != nil {
		t.Error(err)
		return
	}

	queryTime := time.Date(2017, 01, 15, 0, 0, 0, 0, time.UTC)

	vectorQ1 := model.Vector{
		&model.Sample{
			Timestamp: model.Now(),
			Value:     model.SampleValue(1),
			Metric:    model.Metric{"foo": "bar"},
		},
	}
	mockQueryWithTime(api, `rate(istio_requests_total{destination_service_namespace="ns"}[5m])`, queryTime, &vectorQ1)

	rates, _ := client.GetNamespaceServicesRequestRates("ns", "5m", queryTime)
	assert.Equal(t, 1, rates.Len())
	assert.Equal(t, vectorQ1[0], rates[0])
}

func TestConfig(t *testing.T) {
	client, api, err := setupMocked()
	if err != nil {
		t.Error(err)
		return
	}
	mockConfig(api, prom_v1.ConfigResult{
		YAML: `{"status":"success","data":{"yaml":"global:\n  scrape_interval: 15s\n"}}`,
	})

	config, _ := client.GetConfiguration()
	assert.Contains(t, config.YAML, "scrape_interval")
}

func TestFlags(t *testing.T) {
	client, api, err := setupMocked()
	if err != nil {
		t.Error(err)
		return
	}
	mockFlags(api, prom_v1.FlagsResult{"storage.tsdb.retention": "6h"})

	flags, _ := client.GetFlags()
	assert.Equal(t, flags["storage.tsdb.retention"], "6h")
}

func mockQueryWithTime(api *PromAPIMock, query string, queryTime time.Time, ret *model.Vector) {
	api.On(
		"Query",
		mock.AnythingOfType("*context.emptyCtx"),
		query,
		queryTime).
		Return(*ret, nil)
}

func mockQueryRange(api *PromAPIMock, query string, ret *model.Matrix) {
	api.On(
		"QueryRange",
		mock.AnythingOfType("*context.emptyCtx"),
		query,
		mock.AnythingOfType("v1.Range")).
		Return(*ret, nil)
}

func mockRange(api *PromAPIMock, query string, ret model.SampleValue) {
	metric := model.Metric{
		"reporter": "destination",
		"__name__": "whatever",
		"instance": "whatever",
		"job":      "whatever"}
	matrix := model.Matrix{
		&model.SampleStream{
			Metric: metric,
			Values: []model.SamplePair{model.SamplePair{Timestamp: 0, Value: ret}}}}
	mockQueryRange(api, query, &matrix)
}

func mockWithRange(api *PromAPIMock, qRange prom_v1.Range, query string, ret model.SampleValue) {
	metric := model.Metric{
		"reporter": "destination",
		"__name__": "whatever",
		"instance": "whatever",
		"job":      "whatever"}
	matrix := model.Matrix{
		&model.SampleStream{
			Metric: metric,
			Values: []model.SamplePair{model.SamplePair{Timestamp: 0, Value: ret}}}}
	api.On(
		"QueryRange",
		mock.AnythingOfType("*context.emptyCtx"),
		query,
		qRange).
		Return(matrix, nil)
}

func mockEmptyRange(api *PromAPIMock, query string) {
	metric := model.Metric{
		"reporter": "destination",
		"__name__": "whatever",
		"instance": "whatever",
		"job":      "whatever"}
	matrix := model.Matrix{
		&model.SampleStream{
			Metric: metric,
			Values: []model.SamplePair{}}}
	mockQueryRange(api, query, &matrix)
}

func mockHistogram(api *PromAPIMock, baseName string, suffix string, retAvg model.SampleValue, retMed model.SampleValue, ret95 model.SampleValue, ret99 model.SampleValue) {
	histMetric := "sum(rate(" + baseName + "_bucket" + suffix + ")) by (le))"
	mockRange(api, round("histogram_quantile(0.5, "+histMetric), retMed)
	mockRange(api, round("histogram_quantile(0.95, "+histMetric), ret95)
	mockRange(api, round("histogram_quantile(0.99, "+histMetric), ret99)
	mockRange(api, round("histogram_quantile(0.999, "+histMetric), ret99)
	mockRange(api, round("sum(rate("+baseName+"_sum"+suffix+")) / sum(rate("+baseName+"_count"+suffix+"))"), retAvg)
}

func mockEmptyHistogram(api *PromAPIMock, baseName string, suffix string) {
	histMetric := "sum(rate(" + baseName + "_bucket" + suffix + ")) by (le))"
	mockEmptyRange(api, round("histogram_quantile(0.5, "+histMetric))
	mockEmptyRange(api, round("histogram_quantile(0.95, "+histMetric))
	mockEmptyRange(api, round("histogram_quantile(0.99, "+histMetric))
	mockEmptyRange(api, round("histogram_quantile(0.999, "+histMetric))
	mockEmptyRange(api, round("sum(rate("+baseName+"_sum"+suffix+")) / sum(rate("+baseName+"_count"+suffix+"))"))
}

func mockConfig(api *PromAPIMock, ret prom_v1.ConfigResult) {
	api.On("Config", mock.AnythingOfType("*context.emptyCtx")).Return(ret, nil)
}

func mockFlags(api *PromAPIMock, ret prom_v1.FlagsResult) {
	api.On("Flags", mock.AnythingOfType("*context.emptyCtx")).Return(ret, nil)
}
