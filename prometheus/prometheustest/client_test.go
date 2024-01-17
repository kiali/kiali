package prometheustest

import (
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
	api.OnQueryTime(`rate(istio_requests_total{destination_service_namespace="ns",source_workload_namespace!="ns",destination_cluster="east"}[5m]) > 0`, &queryTime, vectorQ1)

	vectorQ2 := model.Vector{
		&model.Sample{
			Timestamp: model.Now(),
			Value:     model.SampleValue(2),
			Metric:    model.Metric{"foo": "bar"}},
	}
	api.OnQueryTime(`rate(istio_requests_total{source_workload_namespace="ns",source_cluster="east"}[5m]) > 0`, &queryTime, vectorQ2)

	rates, _ := client.GetAllRequestRates("ns", "east", "5m", queryTime)
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
	api.OnQueryTime(`rate(istio_requests_total{destination_service_namespace="istio-system",source_workload_namespace!="istio-system",destination_cluster="east"}[5m]) > 0`, &queryTime, vectorQ1)

	vectorQ2 := model.Vector{
		&model.Sample{
			Timestamp: model.Now(),
			Value:     model.SampleValue(2),
			Metric:    model.Metric{"foo": "bar"}},
	}
	api.OnQueryTime(`rate(istio_requests_total{source_workload_namespace="istio-system",source_cluster="east"}[5m]) > 0`, &queryTime, vectorQ2)

	rates, _ := client.GetAllRequestRates("istio-system", "east", "5m", queryTime)
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
	api.OnQueryTime(`rate(istio_requests_total{destination_service_namespace="ns",destination_cluster="east"}[5m]) > 0`, &queryTime, vectorQ1)

	rates, _ := client.GetNamespaceServicesRequestRates("ns", "east", "5m", queryTime)
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

func TestRuntimeInfo(t *testing.T) {
	client, api, err := setupMocked()
	if err != nil {
		t.Error(err)
		return
	}
	mockRuntimeinfoResult(api, prom_v1.RuntimeinfoResult{StorageRetention: "6h"})

	ri, _ := client.GetRuntimeinfo()
	assert.Equal(t, "6h", ri.StorageRetention)
}

func mockConfig(api *PromAPIMock, ret prom_v1.ConfigResult) {
	api.On("Config", mock.Anything).Return(ret, nil)
}

func mockRuntimeinfoResult(api *PromAPIMock, ret prom_v1.RuntimeinfoResult) {
	api.On("Runtimeinfo", mock.Anything).Return(ret, nil)
}
