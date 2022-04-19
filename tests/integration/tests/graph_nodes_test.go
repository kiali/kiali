package tests

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/kiali/kiali/graph/config/cytoscape"
	"github.com/kiali/kiali/tests/integration/utils"
)

func TestAppGraph(t *testing.T) {
	assert := assert.New(t)
	name := "details"
	graphType := "app"
	graph, statusCode, err := utils.ObjectGraph("applications", graphType, name, utils.BOOKINFO)
	assertGraphConfig(graph, graphType, utils.BOOKINFO, statusCode, err, assert)
}

func TestVersionedAppGraph(t *testing.T) {
	assert := assert.New(t)
	name := "details"
	graphType := "versionedApp"
	graph, statusCode, err := utils.ObjectGraph("applications", graphType, name, utils.BOOKINFO)
	assertGraphConfig(graph, graphType, utils.BOOKINFO, statusCode, err, assert)
}

func TestAppGraphEmpty(t *testing.T) {
	assert := assert.New(t)
	name := "detailswrong"
	graphType := "app"
	graph, statusCode, err := utils.ObjectGraph("applications", graphType, name, utils.BOOKINFO)
	assertEmptyGraphConfig(graph, graphType, statusCode, err, assert)
}

func TestServiceGraph(t *testing.T) {
	assert := assert.New(t)
	name := "details"
	graphType := "versionedApp"
	graph, statusCode, err := utils.ObjectGraph("services", graphType, name, utils.BOOKINFO)
	assertGraphConfig(graph, graphType, utils.BOOKINFO, statusCode, err, assert)
}

func TestServiceGraphEmpty(t *testing.T) {
	assert := assert.New(t)
	name := "detailswrong"
	graphType := "workload"
	graph, statusCode, err := utils.ObjectGraph("services", graphType, name, utils.BOOKINFO)
	assertEmptyGraphConfig(graph, graphType, statusCode, err, assert)
}

func TestWorkloadGraph(t *testing.T) {
	assert := assert.New(t)
	name := "reviews-v2"
	graphType := "workload"
	graph, statusCode, err := utils.ObjectGraph("workloads", graphType, name, utils.BOOKINFO)
	assertGraphConfig(graph, graphType, utils.BOOKINFO, statusCode, err, assert)
}

func TestWorkloadGraphEmpty(t *testing.T) {
	assert := assert.New(t)
	name := "reviews-wrong"
	graphType := "workload"
	graph, statusCode, err := utils.ObjectGraph("workloads", graphType, name, utils.BOOKINFO)
	assertEmptyGraphConfig(graph, graphType, statusCode, err, assert)
}

func assertGraphConfig(config *cytoscape.Config, graphType, namespace string, statusCode int, err error, assert *assert.Assertions) {
	assert.Equal(200, statusCode)
	assert.Nil(err)
	assert.Equal(config.GraphType, graphType)
	assert.NotNil(config.Elements)
	graph, _, _ := utils.Graph(map[string]string{"graphType": graphType, "namespaces": namespace})
	// TODO better way to check if there are any graph nodes at all to be able to verify requested ones
	if len(graph.Elements.Nodes) > 0 && len(graph.Elements.Edges) > 0 {
		assert.NotEmpty(config.Elements.Nodes)
		assert.NotEmpty(config.Elements.Edges)
	}
}

func assertEmptyGraphConfig(config *cytoscape.Config, graphType string, statusCode int, err error, assert *assert.Assertions) {
	assert.Equal(200, statusCode)
	assert.Nil(err)
	assert.Equal(config.GraphType, graphType)
	assert.NotNil(config.Elements)
	assert.Empty(config.Elements.Nodes)
	assert.Empty(config.Elements.Edges)
}
