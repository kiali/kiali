package appender

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/graph"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
)

func setupServiceEntries() *business.Layer {
	k8s := kubetest.NewK8SClientMock()

	externalSE := kubernetes.GenericIstioObject{
		ObjectMeta: meta_v1.ObjectMeta{
			Name: "externalSE",
		},
		Spec: map[string]interface{}{
			"hosts": []interface{}{
				"host1.external.com",
				"host2.external.com"},
			"location": "MESH_EXTERNAL",
		},
	}
	internalSE := kubernetes.GenericIstioObject{
		ObjectMeta: meta_v1.ObjectMeta{
			Name: "internalSE",
		},
		Spec: map[string]interface{}{
			"hosts": []interface{}{
				"internalHost1",
				"internalHost2.namespace.svc.cluster.local"},
			"location": "MESH_INTERNAL",
		},
	}

	k8s.On("GetServiceEntries", mock.AnythingOfType("string")).Return([]kubernetes.IstioObject{
		&externalSE,
		&internalSE},
		nil)
	config.Set(config.NewConfig())

	businessLayer := business.NewWithBackends(k8s, nil)
	return businessLayer
}

func serviceEntriesTrafficMap() map[string]*graph.Node {
	// VersionedApp graph
	trafficMap := make(map[string]*graph.Node)

	// unknownNode
	n0 := graph.NewNode(graph.Unknown, "", graph.Unknown, graph.Unknown, graph.Unknown, graph.Unknown, graph.GraphTypeVersionedApp)

	// NotSE serviceNode
	n1 := graph.NewNode("testNamespace", "NotSE", "testNamespace", "", "", "", graph.GraphTypeVersionedApp)

	// NotSE appNode
	n2 := graph.NewNode("testNamespace", "NotSE", "testNamespace", "NotSE-v1", "NotSE", "v1", graph.GraphTypeVersionedApp)

	// externalSE host1 serviceNode
	n3 := graph.NewNode("testNamespace", "host1.external.com", "testNamespace", "", "", "", graph.GraphTypeVersionedApp)
	n3.Metadata = graph.NewMetadata()
	destServices := graph.NewDestServicesMetadata()
	destService := graph.Service{Namespace: n3.Namespace, Name: n3.Service}
	destServices[destService.Key()] = destService
	n3.Metadata[graph.DestServices] = destServices

	// externalSE host2 serviceNode
	n4 := graph.NewNode("testNamespace", "host2.external.com", "testNamespace", "", "", "", graph.GraphTypeVersionedApp)
	n4.Metadata = graph.NewMetadata()
	destServices = graph.NewDestServicesMetadata()
	destService = graph.Service{Namespace: n4.Namespace, Name: n4.Service}
	destServices[destService.Key()] = destService
	n4.Metadata[graph.DestServices] = destServices

	// non-service-entry (ALLOW_ANY) serviceNode
	n5 := graph.NewNode("testNamespace", "hostX.external.com", "testNamespace", "", "", "", graph.GraphTypeVersionedApp)

	// internalSE host1 serviceNode
	n6 := graph.NewNode("testNamespace", "internalHost1", "testNamespace", "", "", "", graph.GraphTypeVersionedApp)
	n6.Metadata = graph.NewMetadata()
	destServices = graph.NewDestServicesMetadata()
	destService = graph.Service{Namespace: n6.Namespace, Name: n6.Service}
	destServices[destService.Key()] = destService
	n6.Metadata[graph.DestServices] = destServices

	// internalSE host2 serviceNode (test prefix)
	n7 := graph.NewNode("testNamespace", "internalHost2", "testNamespace", "", "", "", graph.GraphTypeVersionedApp)
	n7.Metadata = graph.NewMetadata()
	destServices = graph.NewDestServicesMetadata()
	destService = graph.Service{Namespace: n7.Namespace, Name: n7.Service}
	destServices[destService.Key()] = destService
	n7.Metadata[graph.DestServices] = destServices

	trafficMap[n0.ID] = &n0
	trafficMap[n1.ID] = &n1
	trafficMap[n2.ID] = &n2
	trafficMap[n3.ID] = &n3
	trafficMap[n4.ID] = &n4
	trafficMap[n5.ID] = &n5
	trafficMap[n6.ID] = &n6
	trafficMap[n7.ID] = &n7

	n0.AddEdge(&n1)
	n1.AddEdge(&n2)
	n2.AddEdge(&n3)
	n2.AddEdge(&n4)
	n2.AddEdge(&n5)
	n2.AddEdge(&n6)
	n2.AddEdge(&n7)

	return trafficMap
}

func TestServiceEntry(t *testing.T) {
	assert := assert.New(t)

	businessLayer := setupServiceEntries()
	trafficMap := serviceEntriesTrafficMap()

	assert.Equal(8, len(trafficMap))

	unknownID, _ := graph.Id(graph.Unknown, "", graph.Unknown, graph.Unknown, graph.Unknown, graph.Unknown, graph.GraphTypeVersionedApp)
	unknownNode, found0 := trafficMap[unknownID]
	assert.Equal(true, found0)
	assert.Equal(1, len(unknownNode.Edges))
	assert.Equal(nil, unknownNode.Metadata[graph.IsServiceEntry])

	notSEServiceID, _ := graph.Id("testNamespace", "NotSE", "testNamespace", "", "", "", graph.GraphTypeVersionedApp)
	notSEServiceNode, found1 := trafficMap[notSEServiceID]
	assert.Equal(true, found1)
	assert.Equal(1, len(notSEServiceNode.Edges))
	assert.Equal(nil, notSEServiceNode.Metadata[graph.IsServiceEntry])

	notSEAppID, _ := graph.Id("testNamespace", "NotSE", "testNamespace", "NotSE-v1", "NotSE", "v1", graph.GraphTypeVersionedApp)
	notSEAppNode, found2 := trafficMap[notSEAppID]
	assert.Equal(true, found2)
	assert.Equal(5, len(notSEAppNode.Edges))
	assert.Equal(nil, notSEAppNode.Metadata[graph.IsServiceEntry])

	externalSEHost1ServiceID, _ := graph.Id("testNamespace", "host1.external.com", "testNamespace", "", "", "", graph.GraphTypeVersionedApp)
	externalSEHost1ServiceNode, found3 := trafficMap[externalSEHost1ServiceID]
	assert.Equal(true, found3)
	assert.Equal(0, len(externalSEHost1ServiceNode.Edges))
	assert.Equal(nil, externalSEHost1ServiceNode.Metadata[graph.IsServiceEntry])

	externalSEHost2ServiceID, _ := graph.Id("testNamespace", "host2.external.com", "testNamespace", "", "", "", graph.GraphTypeVersionedApp)
	externalSEHost2ServiceNode, found4 := trafficMap[externalSEHost2ServiceID]
	assert.Equal(true, found4)
	assert.Equal(0, len(externalSEHost2ServiceNode.Edges))
	assert.Equal(nil, externalSEHost2ServiceNode.Metadata[graph.IsServiceEntry])

	externalHostXServiceID, _ := graph.Id("testNamespace", "hostX.external.com", "testNamespace", "", "", "", graph.GraphTypeVersionedApp)
	externalHostXServiceNode, found5 := trafficMap[externalHostXServiceID]
	assert.Equal(true, found5)
	assert.Equal(0, len(externalHostXServiceNode.Edges))
	assert.Equal(nil, externalHostXServiceNode.Metadata[graph.IsServiceEntry])

	internalSEHost1ServiceID, _ := graph.Id("testNamespace", "internalHost1", "testNamespace", "", "", "", graph.GraphTypeVersionedApp)
	internalSEHost1ServiceNode, found6 := trafficMap[internalSEHost1ServiceID]
	assert.Equal(true, found6)
	assert.Equal(0, len(internalSEHost1ServiceNode.Edges))
	assert.Equal(nil, internalSEHost1ServiceNode.Metadata[graph.IsServiceEntry])

	internalSEHost2ServiceID, _ := graph.Id("testNamespace", "internalHost2", "testNamespace", "", "", "", graph.GraphTypeVersionedApp)
	internalSEHost2ServiceNode, found7 := trafficMap[internalSEHost2ServiceID]
	assert.Equal(true, found7)
	assert.Equal(0, len(internalSEHost2ServiceNode.Edges))
	assert.Equal(nil, internalSEHost2ServiceNode.Metadata[graph.IsServiceEntry])

	globalInfo := graph.NewAppenderGlobalInfo()
	globalInfo.Business = businessLayer
	namespaceInfo := graph.NewAppenderNamespaceInfo("testNamespace")

	// Run the appender...
	a := ServiceEntryAppender{
		AccessibleNamespaces: map[string]time.Time{"testNamespace": time.Now()},
	}
	a.AppendGraph(trafficMap, globalInfo, namespaceInfo)

	assert.Equal(6, len(trafficMap))

	unknownID, _ = graph.Id(graph.Unknown, "", graph.Unknown, graph.Unknown, graph.Unknown, graph.Unknown, graph.GraphTypeVersionedApp)
	unknownNode, found0 = trafficMap[unknownID]
	assert.Equal(true, found0)
	assert.Equal(1, len(unknownNode.Edges))
	assert.Equal(nil, unknownNode.Metadata[graph.IsServiceEntry])

	notSEServiceID, _ = graph.Id("testNamespace", "NotSE", "testNamespace", "", "", "", graph.GraphTypeVersionedApp)
	notSEServiceNode, found1 = trafficMap[notSEServiceID]
	assert.Equal(true, found1)
	assert.Equal(1, len(notSEServiceNode.Edges))
	assert.Equal(nil, notSEServiceNode.Metadata[graph.IsServiceEntry])

	notSEAppID, _ = graph.Id("testNamespace", "NotSE", "testNamespace", "NotSE-v1", "NotSE", "v1", graph.GraphTypeVersionedApp)
	notSEAppNode, found2 = trafficMap[notSEAppID]
	assert.Equal(true, found2)
	assert.Equal(5, len(notSEAppNode.Edges))
	assert.Equal(nil, notSEAppNode.Metadata[graph.IsServiceEntry])

	externalSEServiceEntryID, _ := graph.Id("testNamespace", "externalSE", "testNamespace", "", "", "", graph.GraphTypeVersionedApp)
	externalSEServiceEntryNode, found3 := trafficMap[externalSEServiceEntryID]
	assert.Equal(true, found3)
	assert.Equal(0, len(externalSEServiceEntryNode.Edges))
	assert.Equal("MESH_EXTERNAL", externalSEServiceEntryNode.Metadata[graph.IsServiceEntry])
	assert.Equal(2, len(externalSEServiceEntryNode.Metadata[graph.DestServices].(graph.DestServicesMetadata)))

	externalHostXServiceID, _ = graph.Id("testNamespace", "hostX.external.com", "testNamespace", "", "", "", graph.GraphTypeVersionedApp)
	externalHostXServiceNode, found4 = trafficMap[externalHostXServiceID]
	assert.Equal(true, found4)
	assert.Equal(0, len(externalHostXServiceNode.Edges))
	assert.Equal(nil, externalHostXServiceNode.Metadata[graph.IsServiceEntry])

	internalSEServiceEntryID, _ := graph.Id("testNamespace", "internalSE", "testNamespace", "", "", "", graph.GraphTypeVersionedApp)
	internalSEServiceEntryNode, found5 := trafficMap[internalSEServiceEntryID]
	assert.Equal(true, found5)
	assert.Equal(0, len(internalSEServiceEntryNode.Edges))
	assert.Equal("MESH_INTERNAL", internalSEServiceEntryNode.Metadata[graph.IsServiceEntry])
	assert.Equal(2, len(internalSEServiceEntryNode.Metadata[graph.DestServices].(graph.DestServicesMetadata)))
}
