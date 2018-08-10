package appender

import (
	"testing"
	"time"

	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/assert"

	"github.com/kiali/kiali/graph"
)

func TestSecurityPolicy(t *testing.T) {
	assert := assert.New(t)

	q0 := "round(sum(rate(istio_requests_total{reporter=\"destination\",source_workload_namespace!=\"bookinfo\",destination_service_namespace=\"bookinfo\",connection_security_policy!=\"none\",response_code=~\"[2345][0-9][0-9]\"}[60s])) by (source_workload_namespace,source_workload,source_app,source_version,destination_service_namespace,destination_service_name,destination_workload,destination_app,destination_version,connection_security_policy),0.001)"
	v0 := model.Vector{}

	q1 := "round(sum(rate(istio_requests_total{reporter=\"destination\",source_workload_namespace=\"bookinfo\",destination_service_namespace!=\"istio-system\",connection_security_policy!=\"none\",response_code=~\"[2345][0-9][0-9]\"}[60s])) by (source_workload_namespace,source_workload,source_app,source_version,destination_service_namespace,destination_service_name,destination_workload,destination_app,destination_version,connection_security_policy),0.001)"
	q1m0 := model.Metric{
		"source_workload_namespace":     "istio-system",
		"source_workload":               "ingressgateway-unknown",
		"source_app":                    "ingressgateway",
		"source_version":                model.LabelValue(graph.UnknownVersion),
		"destination_service_namespace": "bookinfo",
		"destination_service_name":      "productpage",
		"destination_workload":          "productpage-v1",
		"destination_app":               "productpage",
		"destination_version":           "v1",
		"connection_security_policy":    "mutual_tls"}
	v1 := model.Vector{
		&model.Sample{
			Metric: q1m0,
			Value:  10.0}}

	client, api, err := setupMocked()
	if err != nil {
		t.Error(err)
		return
	}
	mockQuery(api, q0, &v0)
	mockQuery(api, q1, &v1)

	trafficMap := securityPolicyTestTraffic()
	ingressId, _ := graph.Id("istio-system", "ingressgateway-unknown", "ingressgateway", graph.UnknownVersion, "", graph.GraphTypeVersionedApp)
	ingress, ok := trafficMap[ingressId]
	assert.Equal(true, ok)
	assert.Equal("ingressgateway", ingress.App)
	assert.Equal(1, len(ingress.Edges))
	assert.Equal(nil, ingress.Edges[0].Metadata["isMTLS"])

	duration, _ := time.ParseDuration("60s")
	appender := SecurityPolicyAppender{
		Duration:     duration,
		GraphType:    graph.GraphTypeVersionedApp,
		IncludeIstio: false,
		QueryTime:    time.Now().Unix(),
	}

	appender.appendGraph(trafficMap, "bookinfo", client)

	ingress, ok = trafficMap[ingressId]
	assert.Equal(true, ok)
	assert.Equal("ingressgateway", ingress.App)
	assert.Equal(1, len(ingress.Edges))
	assert.Equal(true, ingress.Edges[0].Metadata["isMTLS"])

	productpage := ingress.Edges[0].Dest
	assert.Equal("productpage", productpage.App)
	assert.Equal("v1", productpage.Version)
}

func securityPolicyTestTraffic() graph.TrafficMap {
	ingress := graph.NewNode("istio-system", "ingressgateway-unknown", "ingressgateway", graph.UnknownVersion, "", graph.GraphTypeVersionedApp)
	productpage := graph.NewNode("bookinfo", "productpage-v1", "productpage", "v1", "productpage", graph.GraphTypeVersionedApp)
	trafficMap := graph.NewTrafficMap()
	trafficMap[ingress.ID] = &ingress
	trafficMap[productpage.ID] = &productpage

	ingress.AddEdge(&productpage)

	return trafficMap
}
