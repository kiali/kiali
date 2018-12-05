package appender

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/graph"
	"github.com/kiali/kiali/models"
)

func TestNonTrafficScenario(t *testing.T) {
	assert := assert.New(t)

	config.Set(config.NewConfig())

	// Empty trafficMap
	trafficMap := graph.NewTrafficMap()
	workloads := mockWorkloads()

	a := UnusedNodeAppender{
		graph.GraphTypeVersionedApp,
		false,
	}
	a.addUnusedNodes(trafficMap, "testNamespace", workloads)
	assert.Equal(4, len(trafficMap))

	id, _ := graph.Id("testNamespace", "customer-v1", "customer", "v1", "customer", a.GraphType)
	n, ok := trafficMap[id]
	assert.Equal(true, ok)
	assert.Equal("customer-v1", n.Workload)
	assert.Equal("customer", n.App)
	assert.Equal("v1", n.Version)
	assert.Equal(true, n.Metadata["isUnused"])

	id, _ = graph.Id("testNamespace", "preference-v1", "preference", "v1", "preference", a.GraphType)
	n, ok = trafficMap[id]
	assert.Equal(true, ok)
	assert.Equal("preference-v1", n.Workload)
	assert.Equal("preference", n.App)
	assert.Equal("v1", n.Version)
	assert.Equal(true, n.Metadata["isUnused"])

	id, _ = graph.Id("testNamespace", "recommendation-v1", "recommendation", "v1", "recommendation", a.GraphType)
	n, ok = trafficMap[id]
	assert.Equal(true, ok)
	assert.Equal("recommendation-v1", n.Workload)
	assert.Equal("recommendation", n.App)
	assert.Equal("v1", n.Version)
	assert.Equal(true, n.Metadata["isUnused"])

	id, _ = graph.Id("testNamespace", "recommendation-v2", "recommendation", "v2", "recommendation", a.GraphType)
	n, ok = trafficMap[id]
	assert.Equal(true, ok)
	assert.Equal("recommendation-v2", n.Workload)
	assert.Equal("recommendation", n.App)
	assert.Equal("v2", n.Version)
	assert.Equal(true, n.Metadata["isUnused"])
}

func TestOneNodeTrafficScenario(t *testing.T) {
	assert := assert.New(t)

	config.Set(config.NewConfig())

	a := UnusedNodeAppender{
		graph.GraphTypeVersionedApp,
		false,
	}

	trafficMap := a.oneNodeTraffic()
	workloads := mockWorkloads()

	a.addUnusedNodes(trafficMap, "testNamespace", workloads)

	assert.Equal(5, len(trafficMap))
	id, _ := graph.Id(graph.Unknown, graph.Unknown, graph.Unknown, graph.Unknown, "", a.GraphType)
	unknown, ok := trafficMap[id]
	assert.Equal(true, ok)
	assert.Equal(graph.Unknown, unknown.Workload)
	assert.Equal(1, len(unknown.Edges))

	e := unknown.Edges[0]
	assert.Equal(float64(0.8), e.Metadata["rate"])
	n := e.Dest
	assert.Equal("customer-v1", n.Workload)
	assert.Equal("customer", n.App)
	assert.Equal("v1", n.Version)
	assert.Equal(nil, n.Metadata["isUnused"])

	id, _ = graph.Id("testNamespace", "preference-v1", "preference", "v1", "preference", a.GraphType)
	n, ok = trafficMap[id]
	assert.Equal(true, ok)
	assert.Equal("preference-v1", n.Workload)
	assert.Equal("preference", n.App)
	assert.Equal("v1", n.Version)
	assert.Equal(true, n.Metadata["isUnused"])

	id, _ = graph.Id("testNamespace", "recommendation-v1", "recommendation", "v1", "recommendation", a.GraphType)
	n, ok = trafficMap[id]
	assert.Equal(true, ok)
	assert.Equal("recommendation-v1", n.Workload)
	assert.Equal("recommendation", n.App)
	assert.Equal("v1", n.Version)
	assert.Equal(true, n.Metadata["isUnused"])

	id, _ = graph.Id("testNamespace", "recommendation-v2", "recommendation", "v2", "recommendation", a.GraphType)
	n, ok = trafficMap[id]
	assert.Equal(true, ok)
	assert.Equal("recommendation-v2", n.Workload)
	assert.Equal("recommendation", n.App)
	assert.Equal("v2", n.Version)
	assert.Equal(true, n.Metadata["isUnused"])
}

func TestVersionWithNoTrafficScenario(t *testing.T) {
	assert := assert.New(t)

	config.Set(config.NewConfig())

	a := UnusedNodeAppender{
		graph.GraphTypeVersionedApp,
		false,
	}

	trafficMap := a.v1Traffic()
	workloads := mockWorkloads()

	a.addUnusedNodes(trafficMap, "testNamespace", workloads)

	assert.Equal(5, len(trafficMap))
	id, _ := graph.Id(graph.Unknown, graph.Unknown, graph.Unknown, graph.Unknown, "", a.GraphType)
	unknown, ok := trafficMap[id]
	assert.Equal(true, ok)
	assert.Equal(graph.Unknown, unknown.Workload)
	assert.Equal(1, len(unknown.Edges))

	customer := unknown.Edges[0].Dest
	assert.Equal("customer-v1", customer.Workload)
	assert.Equal("customer", customer.App)
	assert.Equal("v1", customer.Version)
	assert.Equal(float64(0.8), unknown.Edges[0].Metadata["rate"])
	assert.Equal(nil, customer.Metadata["isUnused"])
	assert.Equal(1, len(customer.Edges))

	e := customer.Edges[0]
	preference := e.Dest
	assert.Equal("preference-v1", preference.Workload)
	assert.Equal("preference", preference.App)
	assert.Equal("v1", preference.Version)
	assert.Equal(float64(0.8), e.Metadata["rate"])
	assert.Equal(nil, preference.Metadata["isUnused"])
	assert.Equal(2, len(preference.Edges))

	e = preference.Edges[0]
	recommendationV1 := e.Dest
	assert.Equal("recommendation-v1", recommendationV1.Workload)
	assert.Equal("recommendation", recommendationV1.App)
	assert.Equal("v1", recommendationV1.Version)
	assert.Equal(float64(0.8), e.Metadata["rate"])
	assert.Equal(nil, recommendationV1.Metadata["isUnused"])

	e = preference.Edges[1]
	recommendationV2 := e.Dest
	assert.Equal("recommendation-v2", recommendationV2.Workload)
	assert.Equal("recommendation", recommendationV2.App)
	assert.Equal("v2", recommendationV2.Version)
	assert.Equal(true, recommendationV2.Metadata["isUnused"])
}

func mockWorkloads() []models.WorkloadListItem {
	return []models.WorkloadListItem{
		{
			Name:   "customer-v1",
			Labels: map[string]string{"app": "customer", "version": "v1"},
		},
		{
			Name:   "preference-v1",
			Labels: map[string]string{"app": "preference", "version": "v1"},
		},
		{
			Name:   "recommendation-v1",
			Labels: map[string]string{"app": "recommendation", "version": "v1"},
		},
		{
			Name:   "recommendation-v2",
			Labels: map[string]string{"app": "recommendation", "version": "v2"},
		},
	}
}

func (a *UnusedNodeAppender) oneNodeTraffic() map[string]*graph.Node {
	trafficMap := make(map[string]*graph.Node)

	unknown := graph.NewNode(graph.Unknown, graph.Unknown, graph.Unknown, graph.Unknown, "", a.GraphType)
	customer := graph.NewNode("testNamespace", "customer-v1", "customer", "v1", "customer", a.GraphType)
	trafficMap[unknown.ID] = &unknown
	trafficMap[customer.ID] = &customer
	edge := unknown.AddEdge(&customer)
	edge.Metadata["rate"] = 0.8
	unknown.Metadata["rateOut"] = 0.8
	customer.Metadata["rateIn"] = 0.8

	return trafficMap
}

func (a *UnusedNodeAppender) v1Traffic() map[string]*graph.Node {
	trafficMap := make(map[string]*graph.Node)

	unknown := graph.NewNode(graph.Unknown, graph.Unknown, graph.Unknown, graph.Unknown, "", a.GraphType)
	customer := graph.NewNode("testNamespace", "customer-v1", "customer", "v1", "customer", a.GraphType)
	preference := graph.NewNode("testNamespace", "preference-v1", "preference", "v1", "preference", a.GraphType)
	recommendation := graph.NewNode("testNamespace", "recommendation-v1", "recommendation", "v1", "recommendation", a.GraphType)
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
