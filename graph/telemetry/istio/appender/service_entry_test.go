package appender

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/graph"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
)

func setupServiceEntries() *business.Layer {
	k8s := kubetest.NewK8SClientMock()

	externalServiceEntry := kubernetes.GenericIstioObject{
		Spec: map[string]interface{}{
			"hosts":    []interface{}{"ExternalServiceEntry"},
			"location": "MESH_EXTERNAL",
		},
	}
	internalServiceEntry := kubernetes.GenericIstioObject{
		Spec: map[string]interface{}{
			"hosts":    []interface{}{"InternalServiceEntry"},
			"location": "MESH_INTERNAL",
		},
	}
	defaultServiceEntry := kubernetes.GenericIstioObject{
		Spec: map[string]interface{}{
			"hosts": []interface{}{"DefaultServiceEntry"},
		},
	}

	k8s.On("GetServiceEntries", mock.AnythingOfType("string")).Return([]kubernetes.IstioObject{&externalServiceEntry, &internalServiceEntry, &defaultServiceEntry}, nil)
	config.Set(config.NewConfig())

	businessLayer := business.NewWithBackends(k8s, nil)
	return businessLayer
}

func TestServiceEntry(t *testing.T) {
	assert := assert.New(t)

	businessLayer := setupServiceEntries()
	trafficMap := serviceEntriesTrafficMap()

	assert.Equal(6, len(trafficMap))
	notServiceEntryId, _ := graph.Id("testNamespace", "NotServiceEntry", "testNamespace", "", "", "", graph.GraphTypeVersionedApp)
	notServiceEntryNode, found := trafficMap[notServiceEntryId]
	assert.Equal(true, found)
	assert.Equal(1, len(notServiceEntryNode.Edges))
	assert.Equal(nil, notServiceEntryNode.Metadata[graph.IsServiceEntry])

	extServiceEntryId, _ := graph.Id("testNamespace", "ExternalServiceEntry", "testNamespace", "", "", "", graph.GraphTypeVersionedApp)
	extServiceEntryNode, found2 := trafficMap[extServiceEntryId]
	assert.Equal(true, found2)
	assert.Equal(0, len(extServiceEntryNode.Edges))
	assert.Equal(nil, extServiceEntryNode.Metadata[graph.IsServiceEntry])

	intServiceEntryId, _ := graph.Id("testNamespace", "InternalServiceEntry", "testNamespace", "", "", "", graph.GraphTypeVersionedApp)
	intServiceEntryNode, found3 := trafficMap[intServiceEntryId]
	assert.Equal(true, found3)
	assert.Equal(0, len(intServiceEntryNode.Edges))
	assert.Equal(nil, extServiceEntryNode.Metadata[graph.IsServiceEntry])

	defaultServiceEntryId, _ := graph.Id("testNamespace", "DefaultServiceEntry", "testNamespace", "", "", "", graph.GraphTypeVersionedApp)
	defaultServiceEntryNode, found4 := trafficMap[defaultServiceEntryId]
	assert.Equal(true, found4)
	assert.Equal(0, len(defaultServiceEntryNode.Edges))
	assert.Equal(nil, defaultServiceEntryNode.Metadata[graph.IsServiceEntry])

	globalInfo := graph.NewAppenderGlobalInfo()
	globalInfo.Business = businessLayer
	namespaceInfo := graph.NewAppenderNamespaceInfo("testNamespace")

	a := ServiceEntryAppender{
		AccessibleNamespaces: map[string]time.Time{"testNamespace": time.Now()},
	}
	a.AppendGraph(trafficMap, globalInfo, namespaceInfo)

	assert.Equal(nil, notServiceEntryNode.Metadata[graph.IsServiceEntry])
	assert.Equal("MESH_EXTERNAL", extServiceEntryNode.Metadata[graph.IsServiceEntry])
	assert.Equal("MESH_INTERNAL", intServiceEntryNode.Metadata[graph.IsServiceEntry])
	assert.Equal("MESH_EXTERNAL", defaultServiceEntryNode.Metadata[graph.IsServiceEntry])
}

func serviceEntriesTrafficMap() map[string]*graph.Node {
	trafficMap := make(map[string]*graph.Node)

	n0 := graph.NewNode(graph.Unknown, "", graph.Unknown, graph.Unknown, graph.Unknown, graph.Unknown, graph.GraphTypeVersionedApp)

	n1 := graph.NewNode("testNamespace", "NotServiceEntry", "testNamespace", "", "", "", graph.GraphTypeVersionedApp)

	n2 := graph.NewNode("testNamespace", "NotServiceEntry", "testNamespace", "TestWorkload-v1", "TestApp", "v1", graph.GraphTypeVersionedApp)

	n3 := graph.NewNode("testNamespace", "ExternalServiceEntry", "testNamespace", "", "", "", graph.GraphTypeVersionedApp)

	n4 := graph.NewNode("testNamespace", "InternalServiceEntry", "testNamespace", "", "", "", graph.GraphTypeVersionedApp)

	n5 := graph.NewNode("testNamespace", "DefaultServiceEntry", "testNamespace", "", "", "", graph.GraphTypeVersionedApp)

	trafficMap[n0.ID] = &n0
	trafficMap[n1.ID] = &n1
	trafficMap[n2.ID] = &n2
	trafficMap[n3.ID] = &n3
	trafficMap[n4.ID] = &n4
	trafficMap[n5.ID] = &n5

	n0.AddEdge(&n1)
	n1.AddEdge(&n2)
	n2.AddEdge(&n3)
	n2.AddEdge(&n4)
	n2.AddEdge(&n5)

	return trafficMap
}
