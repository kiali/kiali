package business

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/kiali/kiali/config"
)

func TestMetricsLabelsBuilderInboundHttp(t *testing.T) {
	assert := assert.New(t)

	lb := NewMetricsLabelsBuilder("inbound")
	lb.App("test", "ns")
	lb.Reporter("source", false)
	lb.Protocol("http")
	assert.Equal(`{destination_workload_namespace="ns",destination_canonical_service="test",reporter="source",request_protocol="http"}`, lb.Build())

	errs := lb.BuildForErrors()
	assert.Len(errs, 1)
	assert.Equal(`{destination_workload_namespace="ns",destination_canonical_service="test",reporter="source",request_protocol="http",response_code=~"^0$|^[4-5]\\d\\d$"}`, errs[0])
}

func TestMetricsLabelsBuilderOutboundGrpc(t *testing.T) {
	assert := assert.New(t)

	lb := NewMetricsLabelsBuilder("outbound")
	lb.Workload("test", "ns")
	lb.Reporter("destination", false)
	lb.Protocol("grpc")
	assert.Equal(`{source_workload_namespace="ns",source_workload="test",reporter="destination",request_protocol="grpc"}`, lb.Build())

	errs := lb.BuildForErrors()
	assert.Len(errs, 2)
	assert.Equal(`{source_workload_namespace="ns",source_workload="test",reporter="destination",request_protocol="grpc",response_code=~"^0$|^[4-5]\\d\\d$"}`, errs[0])
	assert.Equal(`{source_workload_namespace="ns",source_workload="test",reporter="destination",request_protocol="grpc",grpc_response_status=~"^[1-9]$|^1[0-6]$",response_code!~"^0$|^[4-5]\\d\\d$"}`, errs[1])
}

func TestMetricsLabelsBuilderInboundPeerLabels(t *testing.T) {
	assert := assert.New(t)

	lb := NewMetricsLabelsBuilder("inbound")
	lb.Service("test", "ns")
	lb.PeerApp("peer", "ns2")
	assert.Equal(`{destination_service_name="test",destination_service_namespace="ns",source_workload_namespace="ns2",source_canonical_service="peer"}`, lb.Build())
}

func TestMetricsLabelsBuilderOutboundPeerLabels(t *testing.T) {
	assert := assert.New(t)

	lb := NewMetricsLabelsBuilder("outbound")
	lb.Workload("test", "ns")
	lb.PeerService("peer", "ns2")
	assert.Equal(`{source_workload_namespace="ns",source_workload="test",destination_service_name="peer",destination_service_namespace="ns2"}`, lb.Build())
}

func TestMetricsLabelsBuilderQueryScope(t *testing.T) {
	testConfig := config.NewConfig()
	testConfig.ExternalServices.Prometheus.QueryScope = map[string]string{"mesh_id": "mesh1"}
	config.Set(testConfig)

	assert := assert.New(t)

	lb := NewMetricsLabelsBuilder("outbound")
	lb.QueryScope()
	lb.Workload("test", "ns")
	lb.PeerService("peer", "ns2")
	assert.Equal(`{mesh_id="mesh1",source_workload_namespace="ns",source_workload="test",destination_service_name="peer",destination_service_namespace="ns2"}`, lb.Build())
}
