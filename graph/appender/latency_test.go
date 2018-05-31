package appender

import (
	"testing"
	"time"

	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/graph/tree"
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
		"source_version":      tree.UnknownVersion,
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

	trees := latencyTestTree()
	assert.Equal(1, len(trees))
	assert.Equal("ingress.istio-system.svc.cluster.local", trees[0].Name)
	assert.Equal(1, len(trees[0].Children))
	assert.Equal(nil, trees[0].Children[0].Metadata["latency"])

	duration, _ := time.ParseDuration("60s")
	appender := LatencyAppender{
		Duration:  duration,
		Quantile:  0.95,
		QueryTime: time.Now().Unix(),
	}

	appender.appendGraph(&trees, "bookinfo", client)

	ingress := trees[0]
	assert.Equal("ingress.istio-system.svc.cluster.local", trees[0].Name)
	assert.Equal(nil, ingress.Metadata["latency"])
	productpage := ingress.Children[0]
	assert.Equal("productpage.bookinfo.svc.cluster.local", productpage.Name)
	assert.Equal("v1", productpage.Version)
	assert.Equal(10.0, productpage.Metadata["latency"])
	reviews1 := productpage.Children[0]
	assert.Equal("reviews.bookinfo.svc.cluster.local", reviews1.Name)
	assert.Equal("v1", reviews1.Version)
	assert.Equal(20.0, reviews1.Metadata["latency"])
	reviews2 := productpage.Children[1]
	assert.Equal("reviews.bookinfo.svc.cluster.local", reviews2.Name)
	assert.Equal("v2", reviews2.Version)
	assert.Equal(20.0, reviews2.Metadata["latency"])
	ratingsPath1 := reviews1.Children[0]
	assert.Equal("ratings.bookinfo.svc.cluster.local", ratingsPath1.Name)
	assert.Equal("v1", ratingsPath1.Version)
	assert.Equal(30.0, ratingsPath1.Metadata["latency"])
	ratingsPath2 := reviews2.Children[0]
	assert.Equal("ratings.bookinfo.svc.cluster.local", ratingsPath2.Name)
	assert.Equal("v1", ratingsPath2.Version)
	assert.Equal(30.0, ratingsPath2.Metadata["latency"])
	assert.NotEqual(ratingsPath1, ratingsPath2)
}

func latencyTestTree() []*tree.ServiceNode {
	ingress := tree.NewServiceNode("ingress.istio-system.svc.cluster.local", tree.UnknownVersion)
	productpage := tree.NewServiceNode("productpage.bookinfo.svc.cluster.local", "v1")
	reviewsV1 := tree.NewServiceNode("reviews.bookinfo.svc.cluster.local", "v1")
	reviewsV2 := tree.NewServiceNode("reviews.bookinfo.svc.cluster.local", "v2")
	ratingsPath1 := tree.NewServiceNode("ratings.bookinfo.svc.cluster.local", "v1")
	ratingsPath2 := tree.NewServiceNode("ratings.bookinfo.svc.cluster.local", "v1")

	ingress.Metadata = make(map[string]interface{})
	ingress.Children = make([]*tree.ServiceNode, 1)
	ingress.Children[0] = &productpage

	productpage.Metadata = make(map[string]interface{})
	productpage.Parent = &ingress
	productpage.Children = make([]*tree.ServiceNode, 2)
	productpage.Children[0] = &reviewsV1
	productpage.Children[1] = &reviewsV2

	reviewsV1.Metadata = make(map[string]interface{})
	reviewsV1.Parent = &productpage
	reviewsV1.Children = make([]*tree.ServiceNode, 1)
	reviewsV1.Children[0] = &ratingsPath1

	reviewsV2.Metadata = make(map[string]interface{})
	reviewsV2.Parent = &productpage
	reviewsV2.Children = make([]*tree.ServiceNode, 1)
	reviewsV2.Children[0] = &ratingsPath2

	ratingsPath1.Parent = &reviewsV1
	ratingsPath1.Metadata = make(map[string]interface{})

	ratingsPath2.Parent = &reviewsV2
	ratingsPath2.Metadata = make(map[string]interface{})

	trees := make([]*tree.ServiceNode, 1)
	trees[0] = &ingress

	return trees
}
