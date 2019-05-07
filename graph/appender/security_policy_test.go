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

	q0 := `round(sum(rate(istio_requests_total{reporter="destination",source_workload_namespace!="bookinfo",destination_service_namespace="bookinfo"}[60s]) > 0) by (source_workload_namespace,source_workload,source_app,source_version,destination_service_namespace,destination_service_name,destination_workload_namespace,destination_workload,destination_app,destination_version,connection_security_policy),0.001)`
	v0 := model.Vector{}

	q1 := `round(sum(rate(istio_requests_total{reporter="destination",source_workload_namespace="bookinfo",destination_service_namespace!="istio-system"}[60s]) > 0) by (source_workload_namespace,source_workload,source_app,source_version,destination_service_namespace,destination_service_name,destination_workload_namespace,destination_workload,destination_app,destination_version,connection_security_policy),0.001)`
	q1m0 := model.Metric{
		"source_workload_namespace":      "istio-system",
		"source_workload":                "ingressgateway-unknown",
		"source_app":                     "ingressgateway",
		"source_version":                 model.LabelValue(graph.Unknown),
		"destination_service_namespace":  "bookinfo",
		"destination_service_name":       "productpage",
		"destination_workload_namespace": "bookinfo",
		"destination_workload":           "productpage-v1",
		"destination_app":                "productpage",
		"destination_version":            "v1",
		"connection_security_policy":     "mutual_tls"}
	q1m1 := model.Metric{
		"source_workload_namespace":      "istio-system",
		"source_workload":                "ingressgateway-unknown",
		"source_app":                     "ingressgateway",
		"source_version":                 model.LabelValue(graph.Unknown),
		"destination_service_namespace":  "bookinfo",
		"destination_service_name":       "productpage",
		"destination_workload_namespace": "bookinfo",
		"destination_workload":           "productpage-v1",
		"destination_app":                "productpage",
		"destination_version":            "v1",
		"connection_security_policy":     "none"}
	v1 := model.Vector{
		&model.Sample{
			Metric: q1m0,
			Value:  10.0},
		&model.Sample{
			Metric: q1m1,
			Value:  10.0}}

	client, api, err := setupMocked()
	if err != nil {
		t.Error(err)
		return
	}
	mockQuery(api, q0, &v0)
	mockQuery(api, q1, &v1)

	trafficMap := securityPolicyTestTraffic()
	ingressId, _ := graph.Id("istio-system", "", "istio-system", "ingressgateway-unknown", "ingressgateway", graph.Unknown, graph.GraphTypeVersionedApp)
	ingress, ok := trafficMap[ingressId]
	assert.Equal(true, ok)
	assert.Equal("ingressgateway", ingress.App)
	assert.Equal(1, len(ingress.Edges))
	assert.Equal(nil, ingress.Edges[0].Metadata[graph.IsMTLS])

	duration, _ := time.ParseDuration("60s")
	appender := SecurityPolicyAppender{
		GraphType:          graph.GraphTypeVersionedApp,
		IncludeIstio:       false,
		InjectServiceNodes: false,
		Namespaces: map[string]graph.NamespaceInfo{
			"bookinfo": {
				Name:     "bookinfo",
				Duration: duration,
			},
		},
		QueryTime: time.Now().Unix(),
	}

	appender.appendGraph(trafficMap, "bookinfo", client)

	ingress, ok = trafficMap[ingressId]
	assert.Equal(true, ok)
	assert.Equal("ingressgateway", ingress.App)
	assert.Equal(1, len(ingress.Edges))
	assert.Equal(50.0, ingress.Edges[0].Metadata[graph.IsMTLS])

	productpage := ingress.Edges[0].Dest
	assert.Equal("productpage", productpage.App)
	assert.Equal("v1", productpage.Version)
}

func TestSecurityPolicyWithServiceNodes(t *testing.T) {
	assert := assert.New(t)

	q0 := `round(sum(rate(istio_requests_total{reporter="destination",source_workload_namespace!="bookinfo",destination_service_namespace="bookinfo"}[60s]) > 0) by (source_workload_namespace,source_workload,source_app,source_version,destination_service_namespace,destination_service_name,destination_workload_namespace,destination_workload,destination_app,destination_version,connection_security_policy),0.001)`
	v0 := model.Vector{}

	q1 := `round(sum(rate(istio_requests_total{reporter="destination",source_workload_namespace="bookinfo",destination_service_namespace!="istio-system"}[60s]) > 0) by (source_workload_namespace,source_workload,source_app,source_version,destination_service_namespace,destination_service_name,destination_workload_namespace,destination_workload,destination_app,destination_version,connection_security_policy),0.001)`
	q1m0 := model.Metric{
		"source_workload_namespace":      "istio-system",
		"source_workload":                "ingressgateway-unknown",
		"source_app":                     "ingressgateway",
		"source_version":                 model.LabelValue(graph.Unknown),
		"destination_service_namespace":  "bookinfo",
		"destination_service_name":       "productpage",
		"destination_workload_namespace": "bookinfo",
		"destination_workload":           "productpage-v1",
		"destination_app":                "productpage",
		"destination_version":            "v1",
		"connection_security_policy":     "mutual_tls"}
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

	trafficMap := securityPolicyTestTrafficWithServiceNodes()
	ingressId, _ := graph.Id("istio-system", "", "istio-system", "ingressgateway-unknown", "ingressgateway", graph.Unknown, graph.GraphTypeVersionedApp)
	ingress, ok := trafficMap[ingressId]
	assert.Equal(true, ok)
	assert.Equal("ingressgateway", ingress.App)
	assert.Equal(1, len(ingress.Edges))
	assert.Equal(nil, ingress.Edges[0].Metadata[graph.IsMTLS])

	duration, _ := time.ParseDuration("60s")
	appender := SecurityPolicyAppender{
		GraphType:          graph.GraphTypeVersionedApp,
		IncludeIstio:       false,
		InjectServiceNodes: true,
		Namespaces: map[string]graph.NamespaceInfo{
			"bookinfo": {
				Name:     "bookinfo",
				Duration: duration,
			},
		},
		QueryTime: time.Now().Unix(),
	}

	appender.appendGraph(trafficMap, "bookinfo", client)

	ingress, ok = trafficMap[ingressId]
	assert.Equal(true, ok)
	assert.Equal("ingressgateway", ingress.App)
	assert.Equal(1, len(ingress.Edges))
	assert.Equal(100.0, ingress.Edges[0].Metadata[graph.IsMTLS])

	productpagesvc := ingress.Edges[0].Dest
	assert.Equal("productpage", productpagesvc.Service)
	assert.Equal(1, len(productpagesvc.Edges))
	assert.Equal(100.0, productpagesvc.Edges[0].Metadata[graph.IsMTLS])

	productpage := productpagesvc.Edges[0].Dest
	assert.Equal("productpage", productpage.App)
	assert.Equal("v1", productpage.Version)
}

func securityPolicyTestTraffic() graph.TrafficMap {
	ingress := graph.NewNode("istio-system", "", "istio-system", "ingressgateway-unknown", "ingressgateway", graph.Unknown, graph.GraphTypeVersionedApp)
	productpage := graph.NewNode("bookinfo", "productpage", "bookinfo", "productpage-v1", "productpage", "v1", graph.GraphTypeVersionedApp)
	trafficMap := graph.NewTrafficMap()
	trafficMap[ingress.ID] = &ingress
	trafficMap[productpage.ID] = &productpage

	ingress.AddEdge(&productpage)

	return trafficMap
}

func securityPolicyTestTrafficWithServiceNodes() graph.TrafficMap {
	ingress := graph.NewNode("istio-system", "", "istio-system", "ingressgateway-unknown", "ingressgateway", graph.Unknown, graph.GraphTypeVersionedApp)
	productpagesvc := graph.NewNode("bookinfo", "productpage", "bookinfo", "", "", "", graph.GraphTypeVersionedApp)
	productpage := graph.NewNode("bookinfo", "productpage", "bookinfo", "productpage-v1", "productpage", "v1", graph.GraphTypeVersionedApp)
	trafficMap := graph.NewTrafficMap()
	trafficMap[ingress.ID] = &ingress
	trafficMap[productpagesvc.ID] = &productpagesvc
	trafficMap[productpage.ID] = &productpage

	ingress.AddEdge(&productpagesvc)
	productpagesvc.AddEdge(&productpage)

	return trafficMap
}
