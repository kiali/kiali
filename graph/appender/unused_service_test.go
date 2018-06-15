package appender

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"k8s.io/api/core/v1"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/graph"
)

func TestNonTrafficScenario(t *testing.T) {
	assert := assert.New(t)

	config.Set(config.NewConfig())

	// Empty trafficMap
	trafficMap := graph.NewTrafficMap()
	pods := mockPods()

	addUnusedNodes(trafficMap, "testNamespace", pods)

	assert.Equal(4, len(trafficMap))

	id := graph.Id("customer.testNamespace.svc.cluster.local", "v1")
	s, ok := trafficMap[id]
	assert.Equal(true, ok)
	assert.Equal("customer.testNamespace.svc.cluster.local", s.Name)
	assert.Equal(true, s.Metadata["isUnused"])

	id = graph.Id("preference.testNamespace.svc.cluster.local", "v1")
	s, ok = trafficMap[id]
	assert.Equal("preference.testNamespace.svc.cluster.local", s.Name)
	assert.Equal(true, s.Metadata["isUnused"])

	id = graph.Id("recommendation.testNamespace.svc.cluster.local", "v1")
	s, ok = trafficMap[id]
	assert.Equal("recommendation.testNamespace.svc.cluster.local", s.Name)
	assert.Equal("v1", s.Version)
	assert.Equal(true, s.Metadata["isUnused"])

	id = graph.Id("recommendation.testNamespace.svc.cluster.local", "v2")
	s, ok = trafficMap[id]
	assert.Equal("recommendation.testNamespace.svc.cluster.local", s.Name)
	assert.Equal("v2", s.Version)
	assert.Equal(true, s.Metadata["isUnused"])
}

func TestOneNodeTrafficScenario(t *testing.T) {
	assert := assert.New(t)

	config.Set(config.NewConfig())

	trafficMap := oneNodeTraffic()
	pods := mockPods()

	addUnusedNodes(trafficMap, "testNamespace", pods)

	assert.Equal(5, len(trafficMap))
	unknown, ok := trafficMap[graph.Id(graph.UnknownService, graph.UnknownVersion)]
	assert.Equal(true, ok)
	assert.Equal(graph.UnknownService, unknown.Name)
	assert.Equal(1, len(unknown.Edges))

	e := unknown.Edges[0]
	customer := e.Dest
	assert.Equal("customer.testNamespace.svc.cluster.local", customer.Name)
	assert.Equal(float64(0.8), e.Metadata["rate"])
	assert.Equal(nil, customer.Metadata["isUnused"])

	preference, okPref := trafficMap[graph.Id("preference.testNamespace.svc.cluster.local", "v1")]
	assert.Equal(true, okPref)
	assert.Equal("preference.testNamespace.svc.cluster.local", preference.Name)
	assert.Equal(true, preference.Metadata["isUnused"])

	recommendationV1, okRec1 := trafficMap[graph.Id("recommendation.testNamespace.svc.cluster.local", "v1")]
	assert.Equal(true, okRec1)
	assert.Equal("recommendation.testNamespace.svc.cluster.local", recommendationV1.Name)
	assert.Equal("v1", recommendationV1.Version)
	assert.Equal(true, preference.Metadata["isUnused"])

	recommendationV2, okRec2 := trafficMap[graph.Id("recommendation.testNamespace.svc.cluster.local", "v2")]
	assert.Equal(true, okRec2)
	assert.Equal("recommendation.testNamespace.svc.cluster.local", recommendationV2.Name)
	assert.Equal("v2", recommendationV2.Version)
	assert.Equal(true, preference.Metadata["isUnused"])
}

func TestVersionWithNoTrafficScenario(t *testing.T) {
	assert := assert.New(t)

	config.Set(config.NewConfig())

	trafficMap := v1Traffic()
	pods := mockPods()

	addUnusedNodes(trafficMap, "testNamespace", pods)

	assert.Equal(5, len(trafficMap))
	unknown, ok := trafficMap[graph.Id(graph.UnknownService, graph.UnknownVersion)]
	assert.Equal(true, ok)
	assert.Equal(graph.UnknownService, unknown.Name)
	assert.Equal(1, len(unknown.Edges))

	customer := unknown.Edges[0].Dest
	assert.Equal("customer.testNamespace.svc.cluster.local", customer.Name)
	assert.Equal(float64(0.8), unknown.Edges[0].Metadata["rate"])
	assert.Equal(nil, customer.Metadata["isUnused"])
	assert.Equal(1, len(customer.Edges))

	e := customer.Edges[0]
	preference := e.Dest
	assert.Equal("preference.testNamespace.svc.cluster.local", preference.Name)
	assert.Equal(float64(0.8), e.Metadata["rate"])
	assert.Equal(nil, preference.Metadata["isUnused"])
	assert.Equal(2, len(preference.Edges))

	e = preference.Edges[0]
	recommendationV1 := e.Dest
	assert.Equal("recommendation.testNamespace.svc.cluster.local", recommendationV1.Name)
	assert.Equal("v1", recommendationV1.Version)
	assert.Equal(float64(0.8), e.Metadata["rate"])
	assert.Equal(nil, recommendationV1.Metadata["isUnused"])

	e = preference.Edges[1]
	recommendationV2 := e.Dest
	assert.Equal("recommendation.testNamespace.svc.cluster.local", recommendationV2.Name)
	assert.Equal("v2", recommendationV2.Version)
	assert.Equal(true, recommendationV2.Metadata["isUnused"])
}

func mockPods() *v1.PodList {
	pods := v1.PodList{
		Items: []v1.Pod{
			{
				ObjectMeta: meta_v1.ObjectMeta{
					Name:   "customer-v1",
					Labels: map[string]string{"app": "customer", "version": "v1"},
				},
			},
			{
				ObjectMeta: meta_v1.ObjectMeta{
					Name:   "preference-v1",
					Labels: map[string]string{"app": "preference", "version": "v1"},
				},
			},
			{
				ObjectMeta: meta_v1.ObjectMeta{
					Name:   "preference-v1-scaled-2",
					Labels: map[string]string{"app": "preference", "version": "v1"},
				},
			},
			{
				ObjectMeta: meta_v1.ObjectMeta{
					Name:   "recommendation-v1",
					Labels: map[string]string{"app": "recommendation", "version": "v1"},
				},
			},
			{
				ObjectMeta: meta_v1.ObjectMeta{
					Name:   "recommendation-v2",
					Labels: map[string]string{"app": "recommendation", "version": "v2"},
				},
			},
			{
				ObjectMeta: meta_v1.ObjectMeta{
					Name:   "recommendation-v2-scaled2",
					Labels: map[string]string{"app": "recommendation", "version": "v2"},
				},
			},
		},
	}

	return &pods
}

func oneNodeTraffic() map[string]*graph.ServiceNode {
	trafficMap := make(map[string]*graph.ServiceNode)

	unknown := graph.NewServiceNode(graph.UnknownService, graph.UnknownVersion)
	customer := graph.NewServiceNode("customer.testNamespace.svc.cluster.local", "v1")
	trafficMap[unknown.ID] = &unknown
	trafficMap[customer.ID] = &customer
	edge := unknown.AddEdge(&customer)
	edge.Metadata["rate"] = 0.8
	unknown.Metadata["rateOut"] = 0.8
	customer.Metadata["rateIn"] = 0.8

	return trafficMap
}

func v1Traffic() map[string]*graph.ServiceNode {
	trafficMap := make(map[string]*graph.ServiceNode)

	unknown := graph.NewServiceNode(graph.UnknownService, graph.UnknownVersion)
	customer := graph.NewServiceNode("customer.testNamespace.svc.cluster.local", "v1")
	preference := graph.NewServiceNode("preference.testNamespace.svc.cluster.local", "v1")
	recommendation := graph.NewServiceNode("recommendation.testNamespace.svc.cluster.local", "v1")
	trafficMap[unknown.ID] = &unknown
	trafficMap[customer.ID] = &customer
	trafficMap[preference.ID] = &preference
	trafficMap[recommendation.ID] = &recommendation

	edge := unknown.AddEdge(&customer)
	edge.Metadata["rate"] = 0.8
	unknown.Metadata["rateOut"] = 0.8
	customer.Metadata["rateIn"] = 0.8

	edge = customer.AddEdge(&preference)
	edge.Metadata["rate"] = 0.8
	customer.Metadata["rateOut"] = 0.8
	preference.Metadata["rateIn"] = 0.8

	edge = preference.AddEdge(&recommendation)
	edge.Metadata["rate"] = 0.8
	preference.Metadata["rateOut"] = 0.8
	recommendation.Metadata["rateIn"] = 0.8

	return trafficMap
}
