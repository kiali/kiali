package appender

import (
	"testing"
	"time"

	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/graph"
	"github.com/kiali/kiali/prometheus"
	"github.com/kiali/kiali/prometheus/prometheustest"
)

// Setup mock

func setupMocked() (*prometheus.Client, *prometheustest.PromAPIMock, error) {
	config.Set(config.NewConfig())
	api := new(prometheustest.PromAPIMock)
	client, err := prometheus.NewClient()
	if err != nil {
		return nil, nil, err
	}
	client.Inject(api)
	return client, api, nil
}

func mockQuery(api *prometheustest.PromAPIMock, query string, ret *model.Vector) {
	api.On(
		"Query",
		mock.AnythingOfType("*context.emptyCtx"),
		query,
		mock.AnythingOfType("time.Time"),
	).Return(*ret, nil)
	api.On(
		"Query",
		mock.AnythingOfType("*context.cancelCtx"),
		query,
		mock.AnythingOfType("time.Time"),
	).Return(*ret, nil)
}

func TestResponseTime(t *testing.T) {
	assert := assert.New(t)

	q0 := "round(histogram_quantile(0.95, sum(rate(istio_request_duration_seconds_bucket{reporter=\"destination\",source_workload=\"unknown\",destination_service_namespace=\"bookinfo\",response_code=\"200\"}[60s])) by (le,source_workload_namespace,source_workload,source_app,source_version,destination_service_namespace,destination_service_name,destination_workload,destination_app,destination_version)),0.001)"
	v0 := model.Vector{}

	q1 := "round(histogram_quantile(0.95, sum(rate(istio_request_duration_seconds_bucket{reporter=\"source\",source_workload_namespace!=\"bookinfo\",destination_service_namespace=\"bookinfo\",response_code=\"200\"}[60s])) by (le,source_workload_namespace,source_workload,source_app,source_version,destination_service_namespace,destination_service_name,destination_workload,destination_app,destination_version)),0.001)"
	q1m0 := model.Metric{
		"source_workload_namespace":     "istio-system",
		"source_workload":               "ingressgateway-unknown",
		"source_app":                    "ingressgateway",
		"source_version":                model.LabelValue(graph.UnknownVersion),
		"destination_service_namespace": "bookinfo",
		"destination_workload":          "productpage-v1",
		"destination_app":               "productpage",
		"destination_version":           "v1"}
	v1 := model.Vector{
		&model.Sample{
			Metric: q1m0,
			Value:  10.0}}

	q2 := "round(histogram_quantile(0.95, sum(rate(istio_request_duration_seconds_bucket{reporter=\"source\",source_workload_namespace=\"bookinfo\",response_code=\"200\"}[60s])) by (le,source_workload_namespace,source_workload,source_app,source_version,destination_service_namespace,destination_service_name,destination_workload,destination_app,destination_version)),0.001)"
	q2m0 := model.Metric{
		"source_workload_namespace":     "bookinfo",
		"source_workload":               "productpage-v1",
		"source_app":                    "productpage",
		"source_version":                "v1",
		"destination_service_namespace": "bookinfo",
		"destination_workload":          "reviews-v1",
		"destination_app":               "reviews",
		"destination_version":           "v1"}
	q2m1 := model.Metric{
		"source_workload_namespace":     "bookinfo",
		"source_workload":               "productpage-v1",
		"source_app":                    "productpage",
		"source_version":                "v1",
		"destination_service_namespace": "bookinfo",
		"destination_workload":          "reviews-v2",
		"destination_app":               "reviews",
		"destination_version":           "v2"}
	q2m2 := model.Metric{
		"source_workload_namespace":     "bookinfo",
		"source_workload":               "reviews-v1",
		"source_app":                    "reviews",
		"source_version":                "v1",
		"destination_service_namespace": "bookinfo",
		"destination_workload":          "ratings-v1",
		"destination_app":               "ratings",
		"destination_version":           "v1"}
	q2m3 := model.Metric{
		"source_workload_namespace":     "bookinfo",
		"source_workload":               "reviews-v2",
		"source_app":                    "reviews",
		"source_version":                "v2",
		"destination_service_namespace": "bookinfo",
		"destination_workload":          "ratings-v1",
		"destination_app":               "ratings",
		"destination_version":           "v1"}
	v2 := model.Vector{
		&model.Sample{
			Metric: q2m0,
			Value:  20.0},
		&model.Sample{
			Metric: q2m1,
			Value:  20.0},
		&model.Sample{
			Metric: q2m2,
			Value:  30.0},
		&model.Sample{
			Metric: q2m3,
			Value:  30.0}}

	client, api, err := setupMocked()
	if err != nil {
		t.Error(err)
		return
	}
	mockQuery(api, q0, &v0)
	mockQuery(api, q1, &v1)
	mockQuery(api, q2, &v2)

	trafficMap := responseTimeTestTraffic()
	ingressId, _ := graph.Id("istio-system", "ingressgateway-unknown", "ingressgateway", graph.UnknownVersion, graph.GraphTypeApp, true)
	ingress, ok := trafficMap[ingressId]
	assert.Equal(true, ok)
	assert.Equal("ingressgateway", ingress.App)
	assert.Equal(1, len(ingress.Edges))
	assert.Equal(nil, ingress.Edges[0].Metadata["responseTime"])

	duration, _ := time.ParseDuration("60s")
	appender := ResponseTimeAppender{
		Duration:  duration,
		GraphType: graph.GraphTypeApp,
		false,
		Quantile:  0.95,
		QueryTime: time.Now().Unix(),
		Versioned: true,
	}

	appender.appendGraph(trafficMap, "bookinfo", client)

	ingress, ok = trafficMap[ingressId]
	assert.Equal(true, ok)
	assert.Equal("ingressgateway", ingress.App)
	assert.Equal(1, len(ingress.Edges))
	assert.Equal(10.0, ingress.Edges[0].Metadata["responseTime"])

	productpage := ingress.Edges[0].Dest
	assert.Equal("productpage", productpage.App)
	assert.Equal("v1", productpage.Version)
	assert.Equal(nil, productpage.Metadata["responseTime"])
	assert.Equal(2, len(productpage.Edges))
	assert.Equal(20.0, productpage.Edges[0].Metadata["responseTime"])
	assert.Equal(20.0, productpage.Edges[1].Metadata["responseTime"])

	reviews1 := productpage.Edges[0].Dest
	assert.Equal("reviews", reviews1.App)
	assert.Equal("v1", reviews1.Version)
	assert.Equal(nil, reviews1.Metadata["responseTime"])
	assert.Equal(1, len(reviews1.Edges))
	assert.Equal(30.0, reviews1.Edges[0].Metadata["responseTime"])

	reviews2 := productpage.Edges[1].Dest
	assert.Equal("reviews", reviews2.App)
	assert.Equal("v2", reviews2.Version)
	assert.Equal(nil, reviews2.Metadata["responseTime"])
	assert.Equal(1, len(reviews2.Edges))
	assert.Equal(30.0, reviews2.Edges[0].Metadata["responseTime"])

	ratingsPath1 := reviews1.Edges[0].Dest
	assert.Equal("ratings", ratingsPath1.App)
	assert.Equal("v1", ratingsPath1.Version)
	assert.Equal(nil, ratingsPath1.Metadata["responseTime"])
	assert.Equal(0, len(ratingsPath1.Edges))

	ratingsPath2 := reviews2.Edges[0].Dest
	assert.Equal("ratings", ratingsPath2.App)
	assert.Equal("v1", ratingsPath2.Version)
	assert.Equal(nil, ratingsPath2.Metadata["responseTime"])
	assert.Equal(0, len(ratingsPath2.Edges))

	assert.Equal(ratingsPath1, ratingsPath2)
}

func responseTimeTestTraffic() graph.TrafficMap {
	ingress := graph.NewNode("istio-system", "ingressgateway-unknown", "ingressgateway", graph.UnknownVersion, graph.GraphTypeApp, true)
	productpage := graph.NewNode("bookinfo", "productpage-v1", "productpage", "v1", graph.GraphTypeApp, true)
	reviewsV1 := graph.NewNode("bookinfo", "reviews-v1", "reviews", "v1", graph.GraphTypeApp, true)
	reviewsV2 := graph.NewNode("bookinfo", "reviews-v2", "reviews", "v2", graph.GraphTypeApp, true)
	ratingsPath1 := graph.NewNode("bookinfo", "ratings-v1", "ratings", "v1", graph.GraphTypeApp, true)
	ratingsPath2 := graph.NewNode("bookinfo", "ratings-v1", "ratings", "v1", graph.GraphTypeApp, true)
	trafficMap := graph.NewTrafficMap()
	trafficMap[ingress.ID] = &ingress
	trafficMap[productpage.ID] = &productpage
	trafficMap[reviewsV1.ID] = &reviewsV1
	trafficMap[reviewsV2.ID] = &reviewsV2
	trafficMap[ratingsPath1.ID] = &ratingsPath1
	trafficMap[ratingsPath2.ID] = &ratingsPath2

	ingress.AddEdge(&productpage)
	productpage.AddEdge(&reviewsV1)
	productpage.AddEdge(&reviewsV2)
	reviewsV1.AddEdge(&ratingsPath1)
	reviewsV2.AddEdge(&ratingsPath2)

	return trafficMap
}
