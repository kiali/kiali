package util

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/kiali/kiali/config"
)

func TestAddScopeNoScope(t *testing.T) {
	conf := config.NewConfig()
	conf.ExternalServices.Prometheus.QueryScope = map[string]string{}
	config.Set(conf)

	query := `sum(rate(istio_requests_total{reporter="destination",destination_workload_namespace="bookinfo"} [600s])) by (source_cluster,source_workload_namespace,source_workload,source_canonical_service,source_canonical_revision,destination_cluster,destination_service_namespace,destination_service,destination_service_name,destination_workload_namespace,destination_workload,destination_canonical_service,destination_canonical_revision,request_protocol,response_code,grpc_response_status,response_flags)`
	scopedQuery := AddQueryScope(query, conf)

	assert.Equal(t, query, scopedQuery)
}

func TestAddScopeOneLabel(t *testing.T) {
	conf := config.NewConfig()
	conf.ExternalServices.Prometheus.QueryScope = map[string]string{"mesh_id": "mesh1"}
	config.Set(conf)

	query := `sum(rate(istio_requests_total{reporter="destination",destination_workload_namespace="bookinfo"} [600s])) by (source_cluster,source_workload_namespace,source_workload,source_canonical_service,source_canonical_revision,destination_cluster,destination_service_namespace,destination_service,destination_service_name,destination_workload_namespace,destination_workload,destination_canonical_service,destination_canonical_revision,request_protocol,response_code,grpc_response_status,response_flags)`
	scopedQuery := AddQueryScope(query, conf)
	expected := `sum(rate(istio_requests_total{mesh_id="mesh1",reporter="destination",destination_workload_namespace="bookinfo"} [600s])) by (source_cluster,source_workload_namespace,source_workload,source_canonical_service,source_canonical_revision,destination_cluster,destination_service_namespace,destination_service,destination_service_name,destination_workload_namespace,destination_workload,destination_canonical_service,destination_canonical_revision,request_protocol,response_code,grpc_response_status,response_flags)`
	assert.Equal(t, expected, scopedQuery)
}

func TestAddScopeMultiLabel(t *testing.T) {
	conf := config.NewConfig()
	conf.ExternalServices.Prometheus.QueryScope = map[string]string{"mesh_id": "mesh1", "cluster": "cluster1"}
	config.Set(conf)

	query := `sum(rate(istio_requests_total{reporter="destination",destination_workload_namespace="bookinfo"} [600s])) by (source_cluster,source_workload_namespace,source_workload,source_canonical_service,source_canonical_revision,destination_cluster,destination_service_namespace,destination_service,destination_service_name,destination_workload_namespace,destination_workload,destination_canonical_service,destination_canonical_revision,request_protocol,response_code,grpc_response_status,response_flags)`
	scopedQuery := AddQueryScope(query, conf)
	expected := `sum(rate(istio_requests_total{mesh_id="mesh1",cluster="cluster1",reporter="destination",destination_workload_namespace="bookinfo"} [600s])) by (source_cluster,source_workload_namespace,source_workload,source_canonical_service,source_canonical_revision,destination_cluster,destination_service_namespace,destination_service,destination_service_name,destination_workload_namespace,destination_workload,destination_canonical_service,destination_canonical_revision,request_protocol,response_code,grpc_response_status,response_flags)`
	if expected != scopedQuery {
		// Maps are unordered so check both permutations that the labels could've been set in.
		expected = `sum(rate(istio_requests_total{cluster="cluster1",mesh_id="mesh1",reporter="destination",destination_workload_namespace="bookinfo"} [600s])) by (source_cluster,source_workload_namespace,source_workload,source_canonical_service,source_canonical_revision,destination_cluster,destination_service_namespace,destination_service,destination_service_name,destination_workload_namespace,destination_workload,destination_canonical_service,destination_canonical_revision,request_protocol,response_code,grpc_response_status,response_flags)`
		assert.Equal(t, expected, scopedQuery)
	}
}

func TestAddScopeMultiSegment(t *testing.T) {
	conf := config.NewConfig()
	conf.ExternalServices.Prometheus.QueryScope = map[string]string{"mesh_id": "mesh1"}
	config.Set(conf)

	query := `sum(rate(istio_requests_total{reporter="destination",source_workload_namespace!="bookinfo",destination_service_namespace="bookinfo"}[60s])) by (source_cluster,source_workload_namespace,source_workload,source_canonical_service,source_canonical_revision,source_principal,destination_cluster,destination_service_namespace,destination_service_name,destination_workload_namespace,destination_workload,destination_canonical_service,destination_canonical_revision,destination_principal,connection_security_policy) > 0) OR (sum(rate(istio_tcp_sent_bytes_total{reporter="destination",source_workload_namespace!="bookinfo",destination_service_namespace="bookinfo"}[60s])) by (source_cluster,source_workload_namespace,source_workload,source_canonical_service,source_canonical_revision,source_principal,destination_cluster,destination_service_namespace,destination_service_name,destination_workload_namespace,destination_workload,destination_canonical_service,destination_canonical_revision,destination_principal,connection_security_policy) > 0)`
	scopedQuery := AddQueryScope(query, conf)
	expected := `sum(rate(istio_requests_total{mesh_id="mesh1",reporter="destination",source_workload_namespace!="bookinfo",destination_service_namespace="bookinfo"}[60s])) by (source_cluster,source_workload_namespace,source_workload,source_canonical_service,source_canonical_revision,source_principal,destination_cluster,destination_service_namespace,destination_service_name,destination_workload_namespace,destination_workload,destination_canonical_service,destination_canonical_revision,destination_principal,connection_security_policy) > 0) OR (sum(rate(istio_tcp_sent_bytes_total{mesh_id="mesh1",reporter="destination",source_workload_namespace!="bookinfo",destination_service_namespace="bookinfo"}[60s])) by (source_cluster,source_workload_namespace,source_workload,source_canonical_service,source_canonical_revision,source_principal,destination_cluster,destination_service_namespace,destination_service_name,destination_workload_namespace,destination_workload,destination_canonical_service,destination_canonical_revision,destination_principal,connection_security_policy) > 0)`
	assert.Equal(t, expected, scopedQuery)
}
