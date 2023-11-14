package meshconfig

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/kiali/kiali/graph"
)

func TestRateStrings(t *testing.T) {
	assert := assert.New(t)

	assert.Equal(1, calcPrecision(0.1, 5))
	assert.Equal(1, calcPrecision(0.4, 5))
	assert.Equal(1, calcPrecision(0.5, 5))
	assert.Equal(1, calcPrecision(0.9, 5))
	assert.Equal(2, calcPrecision(0.01, 5))
	assert.Equal(2, calcPrecision(0.04, 5))
	assert.Equal(2, calcPrecision(0.05, 5))
	assert.Equal(2, calcPrecision(0.09, 5))
	assert.Equal(3, calcPrecision(0.001, 5))
	assert.Equal(3, calcPrecision(0.004, 5))
	assert.Equal(3, calcPrecision(0.005, 5))
	assert.Equal(3, calcPrecision(0.009, 5))
	assert.Equal(4, calcPrecision(0.0001, 5))
	assert.Equal(4, calcPrecision(0.0004, 5))
	assert.Equal(4, calcPrecision(0.0005, 5))
	assert.Equal(4, calcPrecision(0.0009, 5))
	assert.Equal(1, calcPrecision(0.99, 5))
	assert.Equal(1, calcPrecision(0.999, 5))
	assert.Equal(5, calcPrecision(0.00000000001, 5)) // max precision 5

	assert.Equal("10.0", rateToString(1, 10))
	assert.Equal("10.4", rateToString(1, 10.4))
	assert.Equal("10.5", rateToString(1, 10.49))
	assert.Equal("10.9", rateToString(1, 10.9))
	assert.Equal("11.0", rateToString(1, 10.99))
	assert.Equal("0.1", rateToString(1, 0.1))
	assert.Equal("0.1", rateToString(1, 0.14))
	assert.Equal("0.2", rateToString(1, 0.19))
	assert.Equal("0.9", rateToString(1, 0.9))
	assert.Equal("0.9", rateToString(1, 0.94))
	assert.Equal("1.0", rateToString(1, 0.99))
	assert.Equal("0.01", rateToString(1, 0.01))
	assert.Equal("0.01", rateToString(1, 0.014))
	assert.Equal("0.02", rateToString(1, 0.019))
	assert.Equal("0.0004", rateToString(1, 0.0004))
	assert.Equal("0.0004", rateToString(1, 0.00044))
	assert.Equal("0.0005", rateToString(1, 0.00049))

	assert.Equal("10.00", rateToString(2, 10))
	assert.Equal("10.40", rateToString(2, 10.4))
	assert.Equal("10.49", rateToString(2, 10.49))
	assert.Equal("10.49", rateToString(2, 10.491))
	assert.Equal("10.50", rateToString(2, 10.499))
	assert.Equal("10.90", rateToString(2, 10.9))
	assert.Equal("10.99", rateToString(2, 10.99))
	assert.Equal("11.00", rateToString(2, 10.999))
	assert.Equal("0.10", rateToString(2, 0.1))
	assert.Equal("0.14", rateToString(2, 0.14))
	assert.Equal("0.19", rateToString(2, 0.19))
	assert.Equal("0.19", rateToString(2, 0.194))
	assert.Equal("0.20", rateToString(2, 0.199))
	assert.Equal("0.90", rateToString(2, 0.9))
	assert.Equal("0.94", rateToString(2, 0.94))
	assert.Equal("0.99", rateToString(2, 0.99))
	assert.Equal("0.99", rateToString(2, 0.994))
	assert.Equal("1.00", rateToString(2, 0.999))
	assert.Equal("0.01", rateToString(2, 0.01))
	assert.Equal("0.01", rateToString(2, 0.014))
	assert.Equal("0.02", rateToString(2, 0.019))
	assert.Equal("0.001", rateToString(2, 0.001))
	assert.Equal("0.001", rateToString(2, 0.0014))
	assert.Equal("0.002", rateToString(2, 0.0019))
	assert.Equal("0.009", rateToString(2, 0.009))
	assert.Equal("0.009", rateToString(2, 0.0094))
	assert.Equal("0.010", rateToString(2, 0.0099))
	assert.Equal("0.0001", rateToString(2, 0.0001))
	assert.Equal("0.0001", rateToString(2, 0.00014))
	assert.Equal("0.0002", rateToString(2, 0.00019))
	assert.Equal("0.0009", rateToString(2, 0.0009))
	assert.Equal("0.0009", rateToString(2, 0.00094))
	assert.Equal("0.0010", rateToString(2, 0.00099))
}

func TestHasWorkloadEntryAddedToGraph(t *testing.T) {
	assert := assert.New(t)

	traffic := graph.NewTrafficMap()

	n0, _ := graph.NewNode("testCluster", "appNamespace", "ratings", "appNamespace", "ratings-v1", "ratings", "v1", graph.GraphTypeVersionedApp)
	n0.Metadata[graph.HasWorkloadEntry] = []graph.WEInfo{{Name: "ratings-v1"}}
	traffic[n0.ID] = n0
	cytoConfig := NewConfig(traffic, graph.ConfigOptions{})

	cytoNode := cytoConfig.Elements.Nodes[0]
	assert.Equal(cytoNode.Data.HasWorkloadEntry, n0.Metadata[graph.HasWorkloadEntry])
}

func TestHasWorkloadEntryEmpty(t *testing.T) {
	assert := assert.New(t)

	traffic := graph.NewTrafficMap()

	n0, _ := graph.NewNode("testCluster", "appNamespace", "ratings", "appNamespace", "ratings-v1", "ratings", "v1", graph.GraphTypeVersionedApp)
	traffic[n0.ID] = n0
	cytoConfig := NewConfig(traffic, graph.ConfigOptions{})

	cytoNode := cytoConfig.Elements.Nodes[0]
	assert.Empty(cytoNode.Data.HasWorkloadEntry)
}

func TestHTTPToTrafficRate(t *testing.T) {
	assert := assert.New(t)

	traffic := graph.NewTrafficMap()

	svc, _ := graph.NewNode("testCluster", "appNamespace", "ratings", "appNamespace", "", "ratings", "", graph.GraphTypeVersionedApp)
	traffic[svc.ID] = svc

	v1, _ := graph.NewNode("testCluster", "appNamespace", "", "appNamespace", "ratings-v1", "ratings", "v1", graph.GraphTypeVersionedApp)
	traffic[v1.ID] = v1

	e := svc.AddEdge(v1)
	e.Metadata[graph.HTTP.EdgeResponses] = graph.Responses{
		"200": &graph.ResponseDetail{
			Flags: graph.ResponseFlags{
				"-": 0.3333999999,
			},
			Hosts: graph.ResponseHosts{
				svc.Service: 0.3333999999,
			},
		},
	}
	e.Metadata[graph.MetadataKey("http")] = 1.00

	cytoConfig := NewConfig(traffic, graph.ConfigOptions{})

	cytoNode := cytoConfig.Elements.Edges[0]
	assert.NotNil(cytoNode.Data.Traffic)
	assert.NotNil(cytoNode.Data.Traffic.Rates)
}
