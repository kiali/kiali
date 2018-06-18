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

func TestLatency(t *testing.T) {
	assert := assert.New(t)

	q0 := "round(histogram_quantile(0.95, sum(rate(istio_request_duration_bucket{source_service!~\".*\\\\.bookinfo\\\\..*\",destination_service=~\".*\\\\.bookinfo\\\\..*\",response_code=\"200\"}[60s])) by (le,source_service,source_version,destination_service,destination_version)),0.001)"
	q0m0 := model.Metric{
		"source_service":      "ingress.istio-system.svc.cluster.local",
		"source_version":      graph.UnknownVersion,
		"destination_service": "productpage.bookinfo.svc.cluster.local",
		"destination_version": "v1"}
	v0 := model.Vector{
		&model.Sample{
			Metric: q0m0,
			Value:  10.0}}

	q1 := "round(histogram_quantile(0.95, sum(rate(istio_request_duration_bucket{source_service=~\".*\\\\.bookinfo\\\\..*\",response_code=\"200\"}[60s])) by (le,source_service,source_version,destination_service,destination_version)),0.001)"
	q1m0 := model.Metric{
		"source_service":      "productpage.bookinfo.svc.cluster.local",
		"source_version":      "v1",
		"destination_service": "reviews.bookinfo.svc.cluster.local",
		"destination_version": "v1"}
	q1m1 := model.Metric{
		"source_service":      "productpage.bookinfo.svc.cluster.local",
		"source_version":      "v1",
		"destination_service": "reviews.bookinfo.svc.cluster.local",
		"destination_version": "v2"}
	q1m2 := model.Metric{
		"source_service":      "reviews.bookinfo.svc.cluster.local",
		"source_version":      "v1",
		"destination_service": "ratings.bookinfo.svc.cluster.local",
		"destination_version": "v1"}
	q1m3 := model.Metric{
		"source_service":      "reviews.bookinfo.svc.cluster.local",
		"source_version":      "v2",
		"destination_service": "ratings.bookinfo.svc.cluster.local",
		"destination_version": "v1"}
	v1 := model.Vector{
		&model.Sample{
			Metric: q1m0,
			Value:  20.0},
		&model.Sample{
			Metric: q1m1,
			Value:  20.0},
		&model.Sample{
			Metric: q1m2,
			Value:  30.0},
		&model.Sample{
			Metric: q1m3,
			Value:  30.0}}

	client, api, err := setupMocked()
	if err != nil {
		t.Error(err)
		return
	}
	mockQuery(api, q0, &v0)
	mockQuery(api, q1, &v1)

	trafficMap := latencyTestTraffic()
	ingressId := graph.Id("ingress.istio-system.svc.cluster.local", graph.UnknownVersion)
	ingress, ok := trafficMap[ingressId]
	assert.Equal(true, ok)
	assert.Equal("ingress.istio-system.svc.cluster.local", ingress.Name)
	assert.Equal(1, len(ingress.Edges))
	assert.Equal(nil, ingress.Edges[0].Metadata["latency"])

	duration, _ := time.ParseDuration("60s")
	appender := LatencyAppender{
		Duration:  duration,
		Quantile:  0.95,
		QueryTime: time.Now().Unix(),
	}

	appender.appendGraph(trafficMap, "bookinfo", client)

	ingress, ok = trafficMap[ingressId]
	assert.Equal(true, ok)
	assert.Equal("ingress.istio-system.svc.cluster.local", ingress.Name)
	assert.Equal(1, len(ingress.Edges))
	assert.Equal(10.0, ingress.Edges[0].Metadata["latency"])

	productpage := ingress.Edges[0].Dest
	assert.Equal("productpage.bookinfo.svc.cluster.local", productpage.Name)
	assert.Equal("v1", productpage.Version)
	assert.Equal(nil, productpage.Metadata["latency"])
	assert.Equal(2, len(productpage.Edges))
	assert.Equal(20.0, productpage.Edges[0].Metadata["latency"])
	assert.Equal(20.0, productpage.Edges[1].Metadata["latency"])

	reviews1 := productpage.Edges[0].Dest
	assert.Equal("reviews.bookinfo.svc.cluster.local", reviews1.Name)
	assert.Equal("v1", reviews1.Version)
	assert.Equal(nil, reviews1.Metadata["latency"])
	assert.Equal(1, len(reviews1.Edges))
	assert.Equal(30.0, reviews1.Edges[0].Metadata["latency"])

	reviews2 := productpage.Edges[1].Dest
	assert.Equal("reviews.bookinfo.svc.cluster.local", reviews2.Name)
	assert.Equal("v2", reviews2.Version)
	assert.Equal(nil, reviews2.Metadata["latency"])
	assert.Equal(1, len(reviews2.Edges))
	assert.Equal(30.0, reviews2.Edges[0].Metadata["latency"])

	ratingsPath1 := reviews1.Edges[0].Dest
	assert.Equal("ratings.bookinfo.svc.cluster.local", ratingsPath1.Name)
	assert.Equal("v1", ratingsPath1.Version)
	assert.Equal(nil, ratingsPath1.Metadata["latency"])
	assert.Equal(0, len(ratingsPath1.Edges))

	ratingsPath2 := reviews2.Edges[0].Dest
	assert.Equal("ratings.bookinfo.svc.cluster.local", ratingsPath2.Name)
	assert.Equal("v1", ratingsPath2.Version)
	assert.Equal(nil, ratingsPath2.Metadata["latency"])
	assert.Equal(0, len(ratingsPath2.Edges))

	assert.Equal(ratingsPath1, ratingsPath2)
}

func latencyTestTraffic() graph.TrafficMap {
	ingress := graph.NewServiceNode("ingress.istio-system.svc.cluster.local", graph.UnknownVersion)
	productpage := graph.NewServiceNode("productpage.bookinfo.svc.cluster.local", "v1")
	reviewsV1 := graph.NewServiceNode("reviews.bookinfo.svc.cluster.local", "v1")
	reviewsV2 := graph.NewServiceNode("reviews.bookinfo.svc.cluster.local", "v2")
	ratingsPath1 := graph.NewServiceNode("ratings.bookinfo.svc.cluster.local", "v1")
	ratingsPath2 := graph.NewServiceNode("ratings.bookinfo.svc.cluster.local", "v1")
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
