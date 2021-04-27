package appender

import (
	"testing"
	"time"

	osproject_v1 "github.com/openshift/api/project/v1"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/graph"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
)

const testCluster = "testcluster"

func setupServiceEntries(exportTo interface{}) *business.Layer {
	k8s := kubetest.NewK8SClientMock()

	externalSE := kubernetes.GenericIstioObject{
		ObjectMeta: meta_v1.ObjectMeta{
			Name:      "externalSE",
			Namespace: "testNamespace",
		},
		Spec: map[string]interface{}{
			"exportTo": exportTo,
			"hosts": []interface{}{
				"host1.external.com",
				"host2.external.com"},
			"location": "MESH_EXTERNAL",
		},
	}
	internalSE := kubernetes.GenericIstioObject{
		ObjectMeta: meta_v1.ObjectMeta{
			Name:      "internalSE",
			Namespace: "testNamespace",
		},
		Spec: map[string]interface{}{
			"hosts": []interface{}{
				"internalHost1",
				"internalHost2.namespace.svc.cluster.local"},
			"location": "MESH_INTERNAL",
		},
	}

	k8s.On("GetProject", mock.AnythingOfType("string")).Return(&osproject_v1.Project{}, nil)
	k8s.On("GetIstioObjects", mock.AnythingOfType("string"), "serviceentries", "").Return([]kubernetes.IstioObject{
		&externalSE,
		&internalSE},
		nil)
	config.Set(config.NewConfig())

	businessLayer := business.NewWithBackends(k8s, nil, nil)
	return businessLayer
}

func serviceEntriesTrafficMap() map[string]*graph.Node {
	// VersionedApp graph
	trafficMap := make(map[string]*graph.Node)

	// unknownNode
	n0 := graph.NewNode(testCluster, graph.Unknown, "", graph.Unknown, graph.Unknown, graph.Unknown, graph.Unknown, graph.GraphTypeVersionedApp)

	// NotSE serviceNode
	n1 := graph.NewNode(testCluster, "testNamespace", "NotSE", "testNamespace", "", "", "", graph.GraphTypeVersionedApp)

	// NotSE appNode
	n2 := graph.NewNode(testCluster, "testNamespace", "NotSE", "testNamespace", "NotSE-v1", "NotSE", "v1", graph.GraphTypeVersionedApp)

	// externalSE host1 serviceNode
	n3 := graph.NewNode(testCluster, "testNamespace", "host1.external.com", "testNamespace", "", "", "", graph.GraphTypeVersionedApp)
	n3.Metadata = graph.NewMetadata()
	destServices := graph.NewDestServicesMetadata()
	destService := graph.ServiceName{Namespace: n3.Namespace, Name: n3.Service}
	destServices[destService.Key()] = destService
	n3.Metadata[graph.DestServices] = destServices

	// externalSE host2 serviceNode
	n4 := graph.NewNode(testCluster, "testNamespace", "host2.external.com", "testNamespace", "", "", "", graph.GraphTypeVersionedApp)
	n4.Metadata = graph.NewMetadata()
	destServices = graph.NewDestServicesMetadata()
	destService = graph.ServiceName{Namespace: n4.Namespace, Name: n4.Service}
	destServices[destService.Key()] = destService
	n4.Metadata[graph.DestServices] = destServices

	// non-service-entry (ALLOW_ANY) serviceNode
	n5 := graph.NewNode(testCluster, "testNamespace", "hostX.external.com", "testNamespace", "", "", "", graph.GraphTypeVersionedApp)

	// internalSE host1 serviceNode
	n6 := graph.NewNode(testCluster, "testNamespace", "internalHost1", "testNamespace", "", "", "", graph.GraphTypeVersionedApp)
	n6.Metadata = graph.NewMetadata()
	destServices = graph.NewDestServicesMetadata()
	destService = graph.ServiceName{Namespace: n6.Namespace, Name: n6.Service}
	destServices[destService.Key()] = destService
	n6.Metadata[graph.DestServices] = destServices

	// internalSE host2 serviceNode (test prefix)
	n7 := graph.NewNode(testCluster, "testNamespace", "internalHost2", "testNamespace", "", "", "", graph.GraphTypeVersionedApp)
	n7.Metadata = graph.NewMetadata()
	destServices = graph.NewDestServicesMetadata()
	destService = graph.ServiceName{Namespace: n7.Namespace, Name: n7.Service}
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

	n0.AddEdge(&n1).Metadata[graph.ProtocolKey] = graph.HTTP.Name
	n1.AddEdge(&n2).Metadata[graph.ProtocolKey] = graph.HTTP.Name
	n2.AddEdge(&n3).Metadata[graph.ProtocolKey] = graph.HTTP.Name
	n2.AddEdge(&n4).Metadata[graph.ProtocolKey] = graph.HTTP.Name
	n2.AddEdge(&n5).Metadata[graph.ProtocolKey] = graph.HTTP.Name
	n2.AddEdge(&n6).Metadata[graph.ProtocolKey] = graph.HTTP.Name
	n2.AddEdge(&n7).Metadata[graph.ProtocolKey] = graph.TCP.Name

	return trafficMap
}

func TestServiceEntry(t *testing.T) {
	assert := assert.New(t)

	businessLayer := setupServiceEntries(nil)
	trafficMap := serviceEntriesTrafficMap()

	assert.Equal(8, len(trafficMap))

	unknownID, _ := graph.Id(testCluster, graph.Unknown, "", graph.Unknown, graph.Unknown, graph.Unknown, graph.Unknown, graph.GraphTypeVersionedApp)
	unknownNode, found0 := trafficMap[unknownID]
	assert.Equal(true, found0)
	assert.Equal(1, len(unknownNode.Edges))
	assert.Equal(nil, unknownNode.Metadata[graph.IsServiceEntry])

	notSEServiceID, _ := graph.Id(testCluster, "testNamespace", "NotSE", "testNamespace", "", "", "", graph.GraphTypeVersionedApp)
	notSEServiceNode, found1 := trafficMap[notSEServiceID]
	assert.Equal(true, found1)
	assert.Equal(1, len(notSEServiceNode.Edges))
	assert.Equal(nil, notSEServiceNode.Metadata[graph.IsServiceEntry])

	notSEAppID, _ := graph.Id(testCluster, "testNamespace", "NotSE", "testNamespace", "NotSE-v1", "NotSE", "v1", graph.GraphTypeVersionedApp)
	notSEAppNode, found2 := trafficMap[notSEAppID]
	assert.Equal(true, found2)
	assert.Equal(5, len(notSEAppNode.Edges))
	assert.Equal(nil, notSEAppNode.Metadata[graph.IsServiceEntry])

	externalSEHost1ServiceID, _ := graph.Id(testCluster, "testNamespace", "host1.external.com", "testNamespace", "", "", "", graph.GraphTypeVersionedApp)
	externalSEHost1ServiceNode, found3 := trafficMap[externalSEHost1ServiceID]
	assert.Equal(true, found3)
	assert.Equal(0, len(externalSEHost1ServiceNode.Edges))
	assert.Equal(nil, externalSEHost1ServiceNode.Metadata[graph.IsServiceEntry])

	externalSEHost2ServiceID, _ := graph.Id(testCluster, "testNamespace", "host2.external.com", "testNamespace", "", "", "", graph.GraphTypeVersionedApp)
	externalSEHost2ServiceNode, found4 := trafficMap[externalSEHost2ServiceID]
	assert.Equal(true, found4)
	assert.Equal(0, len(externalSEHost2ServiceNode.Edges))
	assert.Equal(nil, externalSEHost2ServiceNode.Metadata[graph.IsServiceEntry])

	externalHostXServiceID, _ := graph.Id(testCluster, "testNamespace", "hostX.external.com", "testNamespace", "", "", "", graph.GraphTypeVersionedApp)
	externalHostXServiceNode, found5 := trafficMap[externalHostXServiceID]
	assert.Equal(true, found5)
	assert.Equal(0, len(externalHostXServiceNode.Edges))
	assert.Equal(nil, externalHostXServiceNode.Metadata[graph.IsServiceEntry])

	internalSEHost1ServiceID, _ := graph.Id(testCluster, "testNamespace", "internalHost1", "testNamespace", "", "", "", graph.GraphTypeVersionedApp)
	internalSEHost1ServiceNode, found6 := trafficMap[internalSEHost1ServiceID]
	assert.Equal(true, found6)
	assert.Equal(0, len(internalSEHost1ServiceNode.Edges))
	assert.Equal(nil, internalSEHost1ServiceNode.Metadata[graph.IsServiceEntry])

	internalSEHost2ServiceID, _ := graph.Id(testCluster, "testNamespace", "internalHost2", "testNamespace", "", "", "", graph.GraphTypeVersionedApp)
	internalSEHost2ServiceNode, found7 := trafficMap[internalSEHost2ServiceID]
	assert.Equal(true, found7)
	assert.Equal(0, len(internalSEHost2ServiceNode.Edges))
	assert.Equal(nil, internalSEHost2ServiceNode.Metadata[graph.IsServiceEntry])

	globalInfo := graph.NewAppenderGlobalInfo()
	globalInfo.HomeCluster = testCluster
	globalInfo.Business = businessLayer
	namespaceInfo := graph.NewAppenderNamespaceInfo("testNamespace")

	// Run the appender...
	a := ServiceEntryAppender{
		AccessibleNamespaces: map[string]time.Time{"testNamespace": time.Now()},
	}
	a.AppendGraph(trafficMap, globalInfo, namespaceInfo)

	assert.Equal(6, len(trafficMap))

	unknownID, _ = graph.Id(testCluster, graph.Unknown, "", graph.Unknown, graph.Unknown, graph.Unknown, graph.Unknown, graph.GraphTypeVersionedApp)
	unknownNode, found0 = trafficMap[unknownID]
	assert.Equal(true, found0)
	assert.Equal(1, len(unknownNode.Edges))
	assert.Equal(nil, unknownNode.Metadata[graph.IsServiceEntry])

	notSEServiceID, _ = graph.Id(testCluster, "testNamespace", "NotSE", "testNamespace", "", "", "", graph.GraphTypeVersionedApp)
	notSEServiceNode, found1 = trafficMap[notSEServiceID]
	assert.Equal(true, found1)
	assert.Equal(1, len(notSEServiceNode.Edges))
	assert.Equal(nil, notSEServiceNode.Metadata[graph.IsServiceEntry])

	notSEAppID, _ = graph.Id(testCluster, "testNamespace", "NotSE", "testNamespace", "NotSE-v1", "NotSE", "v1", graph.GraphTypeVersionedApp)
	notSEAppNode, found2 = trafficMap[notSEAppID]
	assert.Equal(true, found2)
	assert.Equal(4, len(notSEAppNode.Edges))
	assert.Equal(nil, notSEAppNode.Metadata[graph.IsServiceEntry])

	externalSEServiceEntryID, _ := graph.Id(testCluster, "testNamespace", "externalSE", "testNamespace", "", "", "", graph.GraphTypeVersionedApp)
	externalSEServiceEntryNode, found3 := trafficMap[externalSEServiceEntryID]
	assert.Equal(true, found3)
	assert.Equal(0, len(externalSEServiceEntryNode.Edges))
	assert.Equal("MESH_EXTERNAL", externalSEServiceEntryNode.Metadata[graph.IsServiceEntry].(*graph.SEInfo).Location)
	externalHosts := externalSEServiceEntryNode.Metadata[graph.IsServiceEntry].(*graph.SEInfo).Hosts
	assert.Equal("host1.external.com", externalHosts[0])
	assert.Equal("host2.external.com", externalHosts[1])
	assert.Equal(2, len(externalSEServiceEntryNode.Metadata[graph.DestServices].(graph.DestServicesMetadata)))

	externalHostXServiceID, _ = graph.Id(testCluster, "testNamespace", "hostX.external.com", "testNamespace", "", "", "", graph.GraphTypeVersionedApp)
	externalHostXServiceNode, found4 = trafficMap[externalHostXServiceID]
	assert.Equal(true, found4)
	assert.Equal(0, len(externalHostXServiceNode.Edges))
	assert.Equal(nil, externalHostXServiceNode.Metadata[graph.IsServiceEntry])

	internalSEServiceEntryID, _ := graph.Id(testCluster, "testNamespace", "internalSE", "testNamespace", "", "", "", graph.GraphTypeVersionedApp)
	internalSEServiceEntryNode, found5 := trafficMap[internalSEServiceEntryID]
	assert.Equal(true, found5)
	assert.Equal(0, len(internalSEServiceEntryNode.Edges))
	assert.Equal("MESH_INTERNAL", internalSEServiceEntryNode.Metadata[graph.IsServiceEntry].(*graph.SEInfo).Location)
	internalHosts := externalSEServiceEntryNode.Metadata[graph.IsServiceEntry].(*graph.SEInfo).Hosts
	assert.Equal("host1.external.com", internalHosts[0])
	assert.Equal("host2.external.com", internalHosts[1])
	assert.Equal(2, len(internalSEServiceEntryNode.Metadata[graph.DestServices].(graph.DestServicesMetadata)))
}

func TestServiceEntryExportAll(t *testing.T) {
	assert := assert.New(t)

	businessLayer := setupServiceEntries([]interface{}{"*"})
	trafficMap := serviceEntriesTrafficMap()

	assert.Equal(8, len(trafficMap))

	unknownID, _ := graph.Id(testCluster, graph.Unknown, "", graph.Unknown, graph.Unknown, graph.Unknown, graph.Unknown, graph.GraphTypeVersionedApp)
	unknownNode, found0 := trafficMap[unknownID]
	assert.Equal(true, found0)
	assert.Equal(1, len(unknownNode.Edges))
	assert.Equal(nil, unknownNode.Metadata[graph.IsServiceEntry])

	notSEServiceID, _ := graph.Id(testCluster, "testNamespace", "NotSE", "testNamespace", "", "", "", graph.GraphTypeVersionedApp)
	notSEServiceNode, found1 := trafficMap[notSEServiceID]
	assert.Equal(true, found1)
	assert.Equal(1, len(notSEServiceNode.Edges))
	assert.Equal(nil, notSEServiceNode.Metadata[graph.IsServiceEntry])

	notSEAppID, _ := graph.Id(testCluster, "testNamespace", "NotSE", "testNamespace", "NotSE-v1", "NotSE", "v1", graph.GraphTypeVersionedApp)
	notSEAppNode, found2 := trafficMap[notSEAppID]
	assert.Equal(true, found2)
	assert.Equal(5, len(notSEAppNode.Edges))
	assert.Equal(nil, notSEAppNode.Metadata[graph.IsServiceEntry])

	externalSEHost1ServiceID, _ := graph.Id(testCluster, "testNamespace", "host1.external.com", "testNamespace", "", "", "", graph.GraphTypeVersionedApp)
	externalSEHost1ServiceNode, found3 := trafficMap[externalSEHost1ServiceID]
	assert.Equal(true, found3)
	assert.Equal(0, len(externalSEHost1ServiceNode.Edges))
	assert.Equal(nil, externalSEHost1ServiceNode.Metadata[graph.IsServiceEntry])

	externalSEHost2ServiceID, _ := graph.Id(testCluster, "testNamespace", "host2.external.com", "testNamespace", "", "", "", graph.GraphTypeVersionedApp)
	externalSEHost2ServiceNode, found4 := trafficMap[externalSEHost2ServiceID]
	assert.Equal(true, found4)
	assert.Equal(0, len(externalSEHost2ServiceNode.Edges))
	assert.Equal(nil, externalSEHost2ServiceNode.Metadata[graph.IsServiceEntry])

	externalHostXServiceID, _ := graph.Id(testCluster, "testNamespace", "hostX.external.com", "testNamespace", "", "", "", graph.GraphTypeVersionedApp)
	externalHostXServiceNode, found5 := trafficMap[externalHostXServiceID]
	assert.Equal(true, found5)
	assert.Equal(0, len(externalHostXServiceNode.Edges))
	assert.Equal(nil, externalHostXServiceNode.Metadata[graph.IsServiceEntry])

	internalSEHost1ServiceID, _ := graph.Id(testCluster, "testNamespace", "internalHost1", "testNamespace", "", "", "", graph.GraphTypeVersionedApp)
	internalSEHost1ServiceNode, found6 := trafficMap[internalSEHost1ServiceID]
	assert.Equal(true, found6)
	assert.Equal(0, len(internalSEHost1ServiceNode.Edges))
	assert.Equal(nil, internalSEHost1ServiceNode.Metadata[graph.IsServiceEntry])

	internalSEHost2ServiceID, _ := graph.Id(testCluster, "testNamespace", "internalHost2", "testNamespace", "", "", "", graph.GraphTypeVersionedApp)
	internalSEHost2ServiceNode, found7 := trafficMap[internalSEHost2ServiceID]
	assert.Equal(true, found7)
	assert.Equal(0, len(internalSEHost2ServiceNode.Edges))
	assert.Equal(nil, internalSEHost2ServiceNode.Metadata[graph.IsServiceEntry])

	globalInfo := graph.NewAppenderGlobalInfo()
	globalInfo.Business = businessLayer
	globalInfo.HomeCluster = testCluster
	namespaceInfo := graph.NewAppenderNamespaceInfo("testNamespace")

	// Run the appender...
	a := ServiceEntryAppender{
		AccessibleNamespaces: map[string]time.Time{"testNamespace": time.Now()},
	}
	a.AppendGraph(trafficMap, globalInfo, namespaceInfo)

	assert.Equal(6, len(trafficMap))

	unknownID, _ = graph.Id(testCluster, graph.Unknown, "", graph.Unknown, graph.Unknown, graph.Unknown, graph.Unknown, graph.GraphTypeVersionedApp)
	unknownNode, found0 = trafficMap[unknownID]
	assert.Equal(true, found0)
	assert.Equal(1, len(unknownNode.Edges))
	assert.Equal(nil, unknownNode.Metadata[graph.IsServiceEntry])

	notSEServiceID, _ = graph.Id(testCluster, "testNamespace", "NotSE", "testNamespace", "", "", "", graph.GraphTypeVersionedApp)
	notSEServiceNode, found1 = trafficMap[notSEServiceID]
	assert.Equal(true, found1)
	assert.Equal(1, len(notSEServiceNode.Edges))
	assert.Equal(nil, notSEServiceNode.Metadata[graph.IsServiceEntry])

	notSEAppID, _ = graph.Id(testCluster, "testNamespace", "NotSE", "testNamespace", "NotSE-v1", "NotSE", "v1", graph.GraphTypeVersionedApp)
	notSEAppNode, found2 = trafficMap[notSEAppID]
	assert.Equal(true, found2)
	assert.Equal(4, len(notSEAppNode.Edges))
	assert.Equal(nil, notSEAppNode.Metadata[graph.IsServiceEntry])

	externalSEServiceEntryID, _ := graph.Id(testCluster, "testNamespace", "externalSE", "testNamespace", "", "", "", graph.GraphTypeVersionedApp)
	externalSEServiceEntryNode, found3 := trafficMap[externalSEServiceEntryID]
	assert.Equal(true, found3)
	assert.Equal(0, len(externalSEServiceEntryNode.Edges))
	assert.Equal("MESH_EXTERNAL", externalSEServiceEntryNode.Metadata[graph.IsServiceEntry].(*graph.SEInfo).Location)
	assert.Equal(2, len(externalSEServiceEntryNode.Metadata[graph.DestServices].(graph.DestServicesMetadata)))

	externalHostXServiceID, _ = graph.Id(testCluster, "testNamespace", "hostX.external.com", "testNamespace", "", "", "", graph.GraphTypeVersionedApp)
	externalHostXServiceNode, found4 = trafficMap[externalHostXServiceID]
	assert.Equal(true, found4)
	assert.Equal(0, len(externalHostXServiceNode.Edges))
	assert.Equal(nil, externalHostXServiceNode.Metadata[graph.IsServiceEntry])

	internalSEServiceEntryID, _ := graph.Id(testCluster, "testNamespace", "internalSE", "testNamespace", "", "", "", graph.GraphTypeVersionedApp)
	internalSEServiceEntryNode, found5 := trafficMap[internalSEServiceEntryID]
	assert.Equal(true, found5)
	assert.Equal(0, len(internalSEServiceEntryNode.Edges))
	assert.Equal("MESH_INTERNAL", internalSEServiceEntryNode.Metadata[graph.IsServiceEntry].(*graph.SEInfo).Location)
	assert.Equal(2, len(internalSEServiceEntryNode.Metadata[graph.DestServices].(graph.DestServicesMetadata)))
}

func TestServiceEntryExportNamespaceFound(t *testing.T) {
	assert := assert.New(t)

	businessLayer := setupServiceEntries([]interface{}{"fooNamespace", "testNamespace"})
	trafficMap := serviceEntriesTrafficMap()

	assert.Equal(8, len(trafficMap))

	unknownID, _ := graph.Id(testCluster, graph.Unknown, "", graph.Unknown, graph.Unknown, graph.Unknown, graph.Unknown, graph.GraphTypeVersionedApp)
	unknownNode, found0 := trafficMap[unknownID]
	assert.Equal(true, found0)
	assert.Equal(1, len(unknownNode.Edges))
	assert.Equal(nil, unknownNode.Metadata[graph.IsServiceEntry])

	notSEServiceID, _ := graph.Id(testCluster, "testNamespace", "NotSE", "testNamespace", "", "", "", graph.GraphTypeVersionedApp)
	notSEServiceNode, found1 := trafficMap[notSEServiceID]
	assert.Equal(true, found1)
	assert.Equal(1, len(notSEServiceNode.Edges))
	assert.Equal(nil, notSEServiceNode.Metadata[graph.IsServiceEntry])

	notSEAppID, _ := graph.Id(testCluster, "testNamespace", "NotSE", "testNamespace", "NotSE-v1", "NotSE", "v1", graph.GraphTypeVersionedApp)
	notSEAppNode, found2 := trafficMap[notSEAppID]
	assert.Equal(true, found2)
	assert.Equal(5, len(notSEAppNode.Edges))
	assert.Equal(nil, notSEAppNode.Metadata[graph.IsServiceEntry])

	externalSEHost1ServiceID, _ := graph.Id(testCluster, "testNamespace", "host1.external.com", "testNamespace", "", "", "", graph.GraphTypeVersionedApp)
	externalSEHost1ServiceNode, found3 := trafficMap[externalSEHost1ServiceID]
	assert.Equal(true, found3)
	assert.Equal(0, len(externalSEHost1ServiceNode.Edges))
	assert.Equal(nil, externalSEHost1ServiceNode.Metadata[graph.IsServiceEntry])

	externalSEHost2ServiceID, _ := graph.Id(testCluster, "testNamespace", "host2.external.com", "testNamespace", "", "", "", graph.GraphTypeVersionedApp)
	externalSEHost2ServiceNode, found4 := trafficMap[externalSEHost2ServiceID]
	assert.Equal(true, found4)
	assert.Equal(0, len(externalSEHost2ServiceNode.Edges))
	assert.Equal(nil, externalSEHost2ServiceNode.Metadata[graph.IsServiceEntry])

	externalHostXServiceID, _ := graph.Id(testCluster, "testNamespace", "hostX.external.com", "testNamespace", "", "", "", graph.GraphTypeVersionedApp)
	externalHostXServiceNode, found5 := trafficMap[externalHostXServiceID]
	assert.Equal(true, found5)
	assert.Equal(0, len(externalHostXServiceNode.Edges))
	assert.Equal(nil, externalHostXServiceNode.Metadata[graph.IsServiceEntry])

	internalSEHost1ServiceID, _ := graph.Id(testCluster, "testNamespace", "internalHost1", "testNamespace", "", "", "", graph.GraphTypeVersionedApp)
	internalSEHost1ServiceNode, found6 := trafficMap[internalSEHost1ServiceID]
	assert.Equal(true, found6)
	assert.Equal(0, len(internalSEHost1ServiceNode.Edges))
	assert.Equal(nil, internalSEHost1ServiceNode.Metadata[graph.IsServiceEntry])

	internalSEHost2ServiceID, _ := graph.Id(testCluster, "testNamespace", "internalHost2", "testNamespace", "", "", "", graph.GraphTypeVersionedApp)
	internalSEHost2ServiceNode, found7 := trafficMap[internalSEHost2ServiceID]
	assert.Equal(true, found7)
	assert.Equal(0, len(internalSEHost2ServiceNode.Edges))
	assert.Equal(nil, internalSEHost2ServiceNode.Metadata[graph.IsServiceEntry])

	globalInfo := graph.NewAppenderGlobalInfo()
	globalInfo.Business = businessLayer
	globalInfo.HomeCluster = testCluster
	namespaceInfo := graph.NewAppenderNamespaceInfo("testNamespace")

	// Run the appender...
	a := ServiceEntryAppender{
		AccessibleNamespaces: map[string]time.Time{"testNamespace": time.Now()},
	}
	a.AppendGraph(trafficMap, globalInfo, namespaceInfo)

	assert.Equal(6, len(trafficMap))

	unknownID, _ = graph.Id(testCluster, graph.Unknown, "", graph.Unknown, graph.Unknown, graph.Unknown, graph.Unknown, graph.GraphTypeVersionedApp)
	unknownNode, found0 = trafficMap[unknownID]
	assert.Equal(true, found0)
	assert.Equal(1, len(unknownNode.Edges))
	assert.Equal(nil, unknownNode.Metadata[graph.IsServiceEntry])

	notSEServiceID, _ = graph.Id(testCluster, "testNamespace", "NotSE", "testNamespace", "", "", "", graph.GraphTypeVersionedApp)
	notSEServiceNode, found1 = trafficMap[notSEServiceID]
	assert.Equal(true, found1)
	assert.Equal(1, len(notSEServiceNode.Edges))
	assert.Equal(nil, notSEServiceNode.Metadata[graph.IsServiceEntry])

	notSEAppID, _ = graph.Id(testCluster, "testNamespace", "NotSE", "testNamespace", "NotSE-v1", "NotSE", "v1", graph.GraphTypeVersionedApp)
	notSEAppNode, found2 = trafficMap[notSEAppID]
	assert.Equal(true, found2)
	assert.Equal(4, len(notSEAppNode.Edges))
	assert.Equal(nil, notSEAppNode.Metadata[graph.IsServiceEntry])

	externalSEServiceEntryID, _ := graph.Id(testCluster, "testNamespace", "externalSE", "testNamespace", "", "", "", graph.GraphTypeVersionedApp)
	externalSEServiceEntryNode, found3 := trafficMap[externalSEServiceEntryID]
	assert.Equal(true, found3)
	assert.Equal(0, len(externalSEServiceEntryNode.Edges))
	assert.Equal("MESH_EXTERNAL", externalSEServiceEntryNode.Metadata[graph.IsServiceEntry].(*graph.SEInfo).Location)
	assert.Equal(2, len(externalSEServiceEntryNode.Metadata[graph.DestServices].(graph.DestServicesMetadata)))

	externalHostXServiceID, _ = graph.Id(testCluster, "testNamespace", "hostX.external.com", "testNamespace", "", "", "", graph.GraphTypeVersionedApp)
	externalHostXServiceNode, found4 = trafficMap[externalHostXServiceID]
	assert.Equal(true, found4)
	assert.Equal(0, len(externalHostXServiceNode.Edges))
	assert.Equal(nil, externalHostXServiceNode.Metadata[graph.IsServiceEntry])

	internalSEServiceEntryID, _ := graph.Id(testCluster, "testNamespace", "internalSE", "testNamespace", "", "", "", graph.GraphTypeVersionedApp)
	internalSEServiceEntryNode, found5 := trafficMap[internalSEServiceEntryID]
	assert.Equal(true, found5)
	assert.Equal(0, len(internalSEServiceEntryNode.Edges))
	assert.Equal("MESH_INTERNAL", internalSEServiceEntryNode.Metadata[graph.IsServiceEntry].(*graph.SEInfo).Location)
	assert.Equal(2, len(internalSEServiceEntryNode.Metadata[graph.DestServices].(graph.DestServicesMetadata)))
}

func TestServiceEntryExportDefinitionNamespace(t *testing.T) {
	assert := assert.New(t)

	businessLayer := setupServiceEntries([]interface{}{"."})
	trafficMap := serviceEntriesTrafficMap()

	assert.Equal(8, len(trafficMap))

	unknownID, _ := graph.Id(testCluster, graph.Unknown, "", graph.Unknown, graph.Unknown, graph.Unknown, graph.Unknown, graph.GraphTypeVersionedApp)
	unknownNode, found0 := trafficMap[unknownID]
	assert.Equal(true, found0)
	assert.Equal(1, len(unknownNode.Edges))
	assert.Equal(nil, unknownNode.Metadata[graph.IsServiceEntry])

	notSEServiceID, _ := graph.Id(testCluster, "testNamespace", "NotSE", "testNamespace", "", "", "", graph.GraphTypeVersionedApp)
	notSEServiceNode, found1 := trafficMap[notSEServiceID]
	assert.Equal(true, found1)
	assert.Equal(1, len(notSEServiceNode.Edges))
	assert.Equal(nil, notSEServiceNode.Metadata[graph.IsServiceEntry])

	notSEAppID, _ := graph.Id(testCluster, "testNamespace", "NotSE", "testNamespace", "NotSE-v1", "NotSE", "v1", graph.GraphTypeVersionedApp)
	notSEAppNode, found2 := trafficMap[notSEAppID]
	assert.Equal(true, found2)
	assert.Equal(5, len(notSEAppNode.Edges))
	assert.Equal(nil, notSEAppNode.Metadata[graph.IsServiceEntry])

	externalSEHost1ServiceID, _ := graph.Id(testCluster, "testNamespace", "host1.external.com", "testNamespace", "", "", "", graph.GraphTypeVersionedApp)
	externalSEHost1ServiceNode, found3 := trafficMap[externalSEHost1ServiceID]
	assert.Equal(true, found3)
	assert.Equal(0, len(externalSEHost1ServiceNode.Edges))
	assert.Equal(nil, externalSEHost1ServiceNode.Metadata[graph.IsServiceEntry])

	externalSEHost2ServiceID, _ := graph.Id(testCluster, "testNamespace", "host2.external.com", "testNamespace", "", "", "", graph.GraphTypeVersionedApp)
	externalSEHost2ServiceNode, found4 := trafficMap[externalSEHost2ServiceID]
	assert.Equal(true, found4)
	assert.Equal(0, len(externalSEHost2ServiceNode.Edges))
	assert.Equal(nil, externalSEHost2ServiceNode.Metadata[graph.IsServiceEntry])

	externalHostXServiceID, _ := graph.Id(testCluster, "testNamespace", "hostX.external.com", "testNamespace", "", "", "", graph.GraphTypeVersionedApp)
	externalHostXServiceNode, found5 := trafficMap[externalHostXServiceID]
	assert.Equal(true, found5)
	assert.Equal(0, len(externalHostXServiceNode.Edges))
	assert.Equal(nil, externalHostXServiceNode.Metadata[graph.IsServiceEntry])

	internalSEHost1ServiceID, _ := graph.Id(testCluster, "testNamespace", "internalHost1", "testNamespace", "", "", "", graph.GraphTypeVersionedApp)
	internalSEHost1ServiceNode, found6 := trafficMap[internalSEHost1ServiceID]
	assert.Equal(true, found6)
	assert.Equal(0, len(internalSEHost1ServiceNode.Edges))
	assert.Equal(nil, internalSEHost1ServiceNode.Metadata[graph.IsServiceEntry])

	internalSEHost2ServiceID, _ := graph.Id(testCluster, "testNamespace", "internalHost2", "testNamespace", "", "", "", graph.GraphTypeVersionedApp)
	internalSEHost2ServiceNode, found7 := trafficMap[internalSEHost2ServiceID]
	assert.Equal(true, found7)
	assert.Equal(0, len(internalSEHost2ServiceNode.Edges))
	assert.Equal(nil, internalSEHost2ServiceNode.Metadata[graph.IsServiceEntry])

	globalInfo := graph.NewAppenderGlobalInfo()
	globalInfo.Business = businessLayer
	globalInfo.HomeCluster = testCluster
	namespaceInfo := graph.NewAppenderNamespaceInfo("testNamespace")

	// Run the appender...
	a := ServiceEntryAppender{
		AccessibleNamespaces: map[string]time.Time{"testNamespace": time.Now()},
	}
	a.AppendGraph(trafficMap, globalInfo, namespaceInfo)

	assert.Equal(6, len(trafficMap))

	unknownID, _ = graph.Id(testCluster, graph.Unknown, "", graph.Unknown, graph.Unknown, graph.Unknown, graph.Unknown, graph.GraphTypeVersionedApp)
	unknownNode, found0 = trafficMap[unknownID]
	assert.Equal(true, found0)
	assert.Equal(1, len(unknownNode.Edges))
	assert.Equal(nil, unknownNode.Metadata[graph.IsServiceEntry])

	notSEServiceID, _ = graph.Id(testCluster, "testNamespace", "NotSE", "testNamespace", "", "", "", graph.GraphTypeVersionedApp)
	notSEServiceNode, found1 = trafficMap[notSEServiceID]
	assert.Equal(true, found1)
	assert.Equal(1, len(notSEServiceNode.Edges))
	assert.Equal(nil, notSEServiceNode.Metadata[graph.IsServiceEntry])

	notSEAppID, _ = graph.Id(testCluster, "testNamespace", "NotSE", "testNamespace", "NotSE-v1", "NotSE", "v1", graph.GraphTypeVersionedApp)
	notSEAppNode, found2 = trafficMap[notSEAppID]
	assert.Equal(true, found2)
	assert.Equal(4, len(notSEAppNode.Edges))
	assert.Equal(nil, notSEAppNode.Metadata[graph.IsServiceEntry])

	externalSEServiceEntryID, _ := graph.Id(testCluster, "testNamespace", "externalSE", "testNamespace", "", "", "", graph.GraphTypeVersionedApp)
	externalSEServiceEntryNode, found3 := trafficMap[externalSEServiceEntryID]
	assert.Equal(true, found3)
	assert.Equal(0, len(externalSEServiceEntryNode.Edges))
	assert.Equal("MESH_EXTERNAL", externalSEServiceEntryNode.Metadata[graph.IsServiceEntry].(*graph.SEInfo).Location)
	assert.Equal(2, len(externalSEServiceEntryNode.Metadata[graph.DestServices].(graph.DestServicesMetadata)))

	externalHostXServiceID, _ = graph.Id(testCluster, "testNamespace", "hostX.external.com", "testNamespace", "", "", "", graph.GraphTypeVersionedApp)
	externalHostXServiceNode, found4 = trafficMap[externalHostXServiceID]
	assert.Equal(true, found4)
	assert.Equal(0, len(externalHostXServiceNode.Edges))
	assert.Equal(nil, externalHostXServiceNode.Metadata[graph.IsServiceEntry])

	internalSEServiceEntryID, _ := graph.Id(testCluster, "testNamespace", "internalSE", "testNamespace", "", "", "", graph.GraphTypeVersionedApp)
	internalSEServiceEntryNode, found5 := trafficMap[internalSEServiceEntryID]
	assert.Equal(true, found5)
	assert.Equal(0, len(internalSEServiceEntryNode.Edges))
	assert.Equal("MESH_INTERNAL", internalSEServiceEntryNode.Metadata[graph.IsServiceEntry].(*graph.SEInfo).Location)
	assert.Equal(2, len(internalSEServiceEntryNode.Metadata[graph.DestServices].(graph.DestServicesMetadata)))
}

func TestServiceEntryExportNamespaceNotFound(t *testing.T) {
	assert := assert.New(t)

	businessLayer := setupServiceEntries([]interface{}{"fooNamespace", "barNamespace"})
	trafficMap := serviceEntriesTrafficMap()

	assert.Equal(8, len(trafficMap))

	unknownID, _ := graph.Id(testCluster, graph.Unknown, "", graph.Unknown, graph.Unknown, graph.Unknown, graph.Unknown, graph.GraphTypeVersionedApp)
	unknownNode, found0 := trafficMap[unknownID]
	assert.Equal(true, found0)
	assert.Equal(1, len(unknownNode.Edges))
	assert.Equal(nil, unknownNode.Metadata[graph.IsServiceEntry])

	notSEServiceID, _ := graph.Id(testCluster, "testNamespace", "NotSE", "testNamespace", "", "", "", graph.GraphTypeVersionedApp)
	notSEServiceNode, found1 := trafficMap[notSEServiceID]
	assert.Equal(true, found1)
	assert.Equal(1, len(notSEServiceNode.Edges))
	assert.Equal(nil, notSEServiceNode.Metadata[graph.IsServiceEntry])

	notSEAppID, _ := graph.Id(testCluster, "testNamespace", "NotSE", "testNamespace", "NotSE-v1", "NotSE", "v1", graph.GraphTypeVersionedApp)
	notSEAppNode, found2 := trafficMap[notSEAppID]
	assert.Equal(true, found2)
	assert.Equal(5, len(notSEAppNode.Edges))
	assert.Equal(nil, notSEAppNode.Metadata[graph.IsServiceEntry])

	externalSEHost1ServiceID, _ := graph.Id(testCluster, "testNamespace", "host1.external.com", "testNamespace", "", "", "", graph.GraphTypeVersionedApp)
	externalSEHost1ServiceNode, found3 := trafficMap[externalSEHost1ServiceID]
	assert.Equal(true, found3)
	assert.Equal(0, len(externalSEHost1ServiceNode.Edges))
	assert.Equal(nil, externalSEHost1ServiceNode.Metadata[graph.IsServiceEntry])

	externalSEHost2ServiceID, _ := graph.Id(testCluster, "testNamespace", "host2.external.com", "testNamespace", "", "", "", graph.GraphTypeVersionedApp)
	externalSEHost2ServiceNode, found4 := trafficMap[externalSEHost2ServiceID]
	assert.Equal(true, found4)
	assert.Equal(0, len(externalSEHost2ServiceNode.Edges))
	assert.Equal(nil, externalSEHost2ServiceNode.Metadata[graph.IsServiceEntry])

	externalHostXServiceID, _ := graph.Id(testCluster, "testNamespace", "hostX.external.com", "testNamespace", "", "", "", graph.GraphTypeVersionedApp)
	externalHostXServiceNode, found5 := trafficMap[externalHostXServiceID]
	assert.Equal(true, found5)
	assert.Equal(0, len(externalHostXServiceNode.Edges))
	assert.Equal(nil, externalHostXServiceNode.Metadata[graph.IsServiceEntry])

	internalSEHost1ServiceID, _ := graph.Id(testCluster, "testNamespace", "internalHost1", "testNamespace", "", "", "", graph.GraphTypeVersionedApp)
	internalSEHost1ServiceNode, found6 := trafficMap[internalSEHost1ServiceID]
	assert.Equal(true, found6)
	assert.Equal(0, len(internalSEHost1ServiceNode.Edges))
	assert.Equal(nil, internalSEHost1ServiceNode.Metadata[graph.IsServiceEntry])

	internalSEHost2ServiceID, _ := graph.Id(testCluster, "testNamespace", "internalHost2", "testNamespace", "", "", "", graph.GraphTypeVersionedApp)
	internalSEHost2ServiceNode, found7 := trafficMap[internalSEHost2ServiceID]
	assert.Equal(true, found7)
	assert.Equal(0, len(internalSEHost2ServiceNode.Edges))
	assert.Equal(nil, internalSEHost2ServiceNode.Metadata[graph.IsServiceEntry])

	globalInfo := graph.NewAppenderGlobalInfo()
	globalInfo.Business = businessLayer
	globalInfo.HomeCluster = testCluster
	namespaceInfo := graph.NewAppenderNamespaceInfo("testNamespace")

	// Run the appender...
	a := ServiceEntryAppender{
		AccessibleNamespaces: map[string]time.Time{"testNamespace": time.Now()},
	}
	a.AppendGraph(trafficMap, globalInfo, namespaceInfo)

	assert.Equal(7, len(trafficMap))

	unknownID, _ = graph.Id(testCluster, graph.Unknown, "", graph.Unknown, graph.Unknown, graph.Unknown, graph.Unknown, graph.GraphTypeVersionedApp)
	unknownNode, found0 = trafficMap[unknownID]
	assert.Equal(true, found0)
	assert.Equal(1, len(unknownNode.Edges))
	assert.Equal(nil, unknownNode.Metadata[graph.IsServiceEntry])

	notSEServiceID, _ = graph.Id(testCluster, "testNamespace", "NotSE", "testNamespace", "", "", "", graph.GraphTypeVersionedApp)
	notSEServiceNode, found1 = trafficMap[notSEServiceID]
	assert.Equal(true, found1)
	assert.Equal(1, len(notSEServiceNode.Edges))
	assert.Equal(nil, notSEServiceNode.Metadata[graph.IsServiceEntry])

	notSEAppID, _ = graph.Id(testCluster, "testNamespace", "NotSE", "testNamespace", "NotSE-v1", "NotSE", "v1", graph.GraphTypeVersionedApp)
	notSEAppNode, found2 = trafficMap[notSEAppID]
	assert.Equal(true, found2)
	assert.Equal(5, len(notSEAppNode.Edges))
	assert.Equal(nil, notSEAppNode.Metadata[graph.IsServiceEntry])

	externalSEServiceEntryID, _ := graph.Id(testCluster, "testNamespace", "externalSE", "testNamespace", "", "", "", graph.GraphTypeVersionedApp)
	_, found3 = trafficMap[externalSEServiceEntryID]
	assert.Equal(false, found3)

	externalHostXServiceID, _ = graph.Id(testCluster, "testNamespace", "hostX.external.com", "testNamespace", "", "", "", graph.GraphTypeVersionedApp)
	externalHostXServiceNode, found4 = trafficMap[externalHostXServiceID]
	assert.Equal(true, found4)
	assert.Equal(0, len(externalHostXServiceNode.Edges))
	assert.Equal(nil, externalHostXServiceNode.Metadata[graph.IsServiceEntry])

	internalSEServiceEntryID, _ := graph.Id(testCluster, "testNamespace", "internalSE", "testNamespace", "", "", "", graph.GraphTypeVersionedApp)
	internalSEServiceEntryNode, found5 := trafficMap[internalSEServiceEntryID]
	assert.Equal(true, found5)
	assert.Equal(0, len(internalSEServiceEntryNode.Edges))
	assert.Equal("MESH_INTERNAL", internalSEServiceEntryNode.Metadata[graph.IsServiceEntry].(*graph.SEInfo).Location)
	assert.Equal(2, len(internalSEServiceEntryNode.Metadata[graph.DestServices].(graph.DestServicesMetadata)))
}

// TestDisjointGlobalEntries checks that a service node representing traffic to a remote cluster
// is correctly identified as a ServiceEntry. Also checks that a service node representing traffic
// to an internal service is not mixed with the node for the remote cluster.
func TestDisjointMulticlusterEntries(t *testing.T) {
	assert := assert.New(t)

	// Mock the k8s client with a "global" ServiceEntry
	k8s := kubetest.NewK8SClientMock()

	remoteSE := kubernetes.GenericIstioObject{
		ObjectMeta: meta_v1.ObjectMeta{
			Name: "externalSE",
		},
		Spec: map[string]interface{}{
			"hosts": []interface{}{
				"svc1.namespace.global"},
			"location": "MESH_INTERNAL",
		},
	}

	k8s.On("GetProject", mock.AnythingOfType("string")).Return(&osproject_v1.Project{}, nil)
	k8s.On("GetIstioObjects", mock.AnythingOfType("string"), "serviceentries", "").Return([]kubernetes.IstioObject{
		&remoteSE},
		nil)
	config.Set(config.NewConfig())

	businessLayer := business.NewWithBackends(k8s, nil, nil)

	// Create a VersionedApp traffic map where a workload is calling a remote service entry and also an internal one
	trafficMap := make(map[string]*graph.Node)

	n0 := graph.NewNode(testCluster, "namespace", "source", "namespace", "wk0", "source", "v0", graph.GraphTypeVersionedApp)
	n1 := graph.NewNode(testCluster, "namespace", "svc1.namespace.global", "unknown", "unknown", "unknown", "unknown", graph.GraphTypeVersionedApp)
	n2 := graph.NewNode(testCluster, "namespace", "svc1", "unknown", "unknown", "unknown", "unknown", graph.GraphTypeVersionedApp)

	trafficMap[n0.ID] = &n0
	trafficMap[n1.ID] = &n1
	trafficMap[n2.ID] = &n2

	n0.AddEdge(&n1)
	n0.AddEdge(&n2)

	// Run the appender
	globalInfo := graph.NewAppenderGlobalInfo()
	globalInfo.Business = businessLayer
	globalInfo.HomeCluster = testCluster
	namespaceInfo := graph.NewAppenderNamespaceInfo("namespace")

	a := ServiceEntryAppender{
		AccessibleNamespaces: map[string]time.Time{"namespace": time.Now()},
	}
	a.AppendGraph(trafficMap, globalInfo, namespaceInfo)

	// Assertions
	assert.Len(n0.Edges, 2)   // Check that source node still has two edges
	assert.Len(trafficMap, 3) // Check that traffic map still has three nodes

	// Check that there is a node for the local svc1.
	numMatches := 0
	for _, n := range trafficMap {
		if n.Service == "svc1" {
			numMatches++
			assert.Equal(n, &n2)
		}
	}
	assert.Equal(1, numMatches)

	// Check that there is a node for the remote svc1 and is was matched against the remote SE.
	numMatches = 0
	for _, n := range trafficMap {
		if n.Service == "externalSE" {
			numMatches++
			assert.Equal("MESH_INTERNAL", n.Metadata[graph.IsServiceEntry].(*graph.SEInfo).Location)
		}
	}
	assert.Equal(1, numMatches)
}

func TestServiceEntrySameHostMatchNamespace(t *testing.T) {
	k8s := kubetest.NewK8SClientMock()

	SE1 := kubernetes.GenericIstioObject{
		ObjectMeta: meta_v1.ObjectMeta{
			Name:      "SE1",
			Namespace: "fooNamespace", // definition namespace is irrelevant in this case
		},
		Spec: map[string]interface{}{
			"exportTo": []interface{}{"*"}, // can match a service in any namespace
			"hosts": []interface{}{
				"host1.external.com",
			},
			"location": "MESH_EXTERNAL",
		},
	}
	SE2 := kubernetes.GenericIstioObject{
		ObjectMeta: meta_v1.ObjectMeta{
			Name:      "SE2",
			Namespace: "testNamespace",
		},
		Spec: map[string]interface{}{
			"exportTo": []interface{}{"."}, // can match a service in only testNamespace
			"hosts": []interface{}{
				"host1.external.com",
				"host2.external.com",
			},
			"location": "MESH_EXTERNAL",
		},
	}

	k8s.On("GetProject", mock.AnythingOfType("string")).Return(&osproject_v1.Project{}, nil)
	k8s.On("GetIstioObjects", mock.AnythingOfType("string"), "serviceentries", "").Return([]kubernetes.IstioObject{
		&SE1,
		&SE2},
		nil)
	config.Set(config.NewConfig())

	businessLayer := business.NewWithBackends(k8s, nil, nil)

	assert := assert.New(t)

	trafficMap := make(map[string]*graph.Node)

	// unknownNode
	n0 := graph.NewNode(testCluster, graph.Unknown, "", graph.Unknown, graph.Unknown, graph.Unknown, graph.Unknown, graph.GraphTypeVersionedApp)

	// NotSE host3 serviceNode
	n1 := graph.NewNode(testCluster, "testNamespace", "host3.external.com", "testNamespace", "", "", "", graph.GraphTypeVersionedApp)

	// SE2 host1 serviceNode
	n2 := graph.NewNode(testCluster, "testNamespace", "host1.external.com", "testNamespace", "", "", "", graph.GraphTypeVersionedApp)
	n2.Metadata = graph.NewMetadata()
	destServices := graph.NewDestServicesMetadata()
	destService := graph.ServiceName{Namespace: n2.Namespace, Name: n2.Service}
	destServices[destService.Key()] = destService
	n2.Metadata[graph.DestServices] = destServices

	// SE2 host2 serviceNode
	n3 := graph.NewNode(testCluster, "testNamespace", "host2.external.com", "testNamespace", "", "", "", graph.GraphTypeVersionedApp)
	n3.Metadata = graph.NewMetadata()
	destServices = graph.NewDestServicesMetadata()
	destService = graph.ServiceName{Namespace: n3.Namespace, Name: n3.Service}
	destServices[destService.Key()] = destService
	n3.Metadata[graph.DestServices] = destServices

	trafficMap[n0.ID] = &n0
	trafficMap[n1.ID] = &n1
	trafficMap[n2.ID] = &n2
	trafficMap[n3.ID] = &n3

	n0.AddEdge(&n1).Metadata[graph.ProtocolKey] = graph.HTTP.Name
	n0.AddEdge(&n2).Metadata[graph.ProtocolKey] = graph.HTTP.Name
	n0.AddEdge(&n3).Metadata[graph.ProtocolKey] = graph.HTTP.Name

	assert.Equal(4, len(trafficMap))

	unknownID, _ := graph.Id(testCluster, graph.Unknown, "", graph.Unknown, graph.Unknown, graph.Unknown, graph.Unknown, graph.GraphTypeVersionedApp)
	unknownNode, found0 := trafficMap[unknownID]
	assert.Equal(true, found0)
	assert.Equal(3, len(unknownNode.Edges))
	assert.Equal(nil, unknownNode.Metadata[graph.IsServiceEntry])

	notSEServiceID, _ := graph.Id(testCluster, "testNamespace", "host3.external.com", "testNamespace", "", "", "", graph.GraphTypeVersionedApp)
	notSEServiceNode, found1 := trafficMap[notSEServiceID]
	assert.Equal(true, found1)
	assert.Equal(0, len(notSEServiceNode.Edges))
	assert.Equal(nil, notSEServiceNode.Metadata[graph.IsServiceEntry])

	SE2Host1ServiceID, _ := graph.Id(testCluster, "testNamespace", "host1.external.com", "testNamespace", "", "", "", graph.GraphTypeVersionedApp)
	SE2Host1ServiceNode, found2 := trafficMap[SE2Host1ServiceID]
	assert.Equal(true, found2)
	assert.Equal(0, len(SE2Host1ServiceNode.Edges))
	assert.Equal(nil, SE2Host1ServiceNode.Metadata[graph.IsServiceEntry])

	SE2Host2ServiceID, _ := graph.Id(testCluster, "testNamespace", "host2.external.com", "testNamespace", "", "", "", graph.GraphTypeVersionedApp)
	SE2Host2ServiceNode, found3 := trafficMap[SE2Host2ServiceID]
	assert.Equal(true, found3)
	assert.Equal(0, len(SE2Host2ServiceNode.Edges))
	assert.Equal(nil, SE2Host2ServiceNode.Metadata[graph.IsServiceEntry])

	globalInfo := graph.NewAppenderGlobalInfo()
	globalInfo.Business = businessLayer
	globalInfo.HomeCluster = testCluster
	namespaceInfo := graph.NewAppenderNamespaceInfo("testNamespace")

	// Run the appender...
	a := ServiceEntryAppender{
		AccessibleNamespaces: map[string]time.Time{"testNamespace": time.Now()},
	}
	a.AppendGraph(trafficMap, globalInfo, namespaceInfo)

	assert.Equal(3, len(trafficMap))

	unknownID, _ = graph.Id(testCluster, graph.Unknown, "", graph.Unknown, graph.Unknown, graph.Unknown, graph.Unknown, graph.GraphTypeVersionedApp)
	unknownNode, found0 = trafficMap[unknownID]
	assert.Equal(true, found0)
	assert.Equal(2, len(unknownNode.Edges))
	assert.Equal(nil, unknownNode.Metadata[graph.IsServiceEntry])

	notSEServiceID, _ = graph.Id(testCluster, "testNamespace", "host3.external.com", "testNamespace", "", "", "", graph.GraphTypeVersionedApp)
	notSEServiceNode, found1 = trafficMap[notSEServiceID]
	assert.Equal(true, found1)
	assert.Equal(0, len(notSEServiceNode.Edges))
	assert.Equal(nil, notSEServiceNode.Metadata[graph.IsServiceEntry])

	SE2ID, _ := graph.Id(testCluster, "testNamespace", "SE2", "testNamespace", "", "", "", graph.GraphTypeVersionedApp)
	SE2Node, found2 := trafficMap[SE2ID]
	assert.Equal(true, found2)
	assert.Equal(0, len(SE2Node.Edges))
	assert.Equal("MESH_EXTERNAL", SE2Node.Metadata[graph.IsServiceEntry].(*graph.SEInfo).Location)
	assert.Equal(2, len(SE2Node.Metadata[graph.DestServices].(graph.DestServicesMetadata)))
}

func TestServiceEntrySameHostNoMatchNamespace(t *testing.T) {
	k8s := kubetest.NewK8SClientMock()

	SE1 := kubernetes.GenericIstioObject{
		ObjectMeta: meta_v1.ObjectMeta{
			Name:      "SE1",
			Namespace: "fooNamespace", // definition namespace is irrelevant in this case
		},
		Spec: map[string]interface{}{
			"exportTo": []interface{}{"*"}, // can match a service in any namespace
			"hosts": []interface{}{
				"host1.external.com",
			},
			"location": "MESH_EXTERNAL",
		},
	}
	SE2 := kubernetes.GenericIstioObject{
		ObjectMeta: meta_v1.ObjectMeta{
			Name:      "SE2",
			Namespace: "testNamespace",
		},
		Spec: map[string]interface{}{
			"exportTo": []interface{}{"."}, // can match a service in only testNamespace
			"hosts": []interface{}{
				"host1.external.com",
				"host2.external.com",
			},
			"location": "MESH_EXTERNAL",
		},
	}

	k8s.On("GetProject", mock.AnythingOfType("string")).Return(&osproject_v1.Project{}, nil)
	k8s.On("GetIstioObjects", mock.AnythingOfType("string"), "serviceentries", "").Return([]kubernetes.IstioObject{
		&SE1,
		&SE2},
		nil)
	config.Set(config.NewConfig())

	businessLayer := business.NewWithBackends(k8s, nil, nil)

	assert := assert.New(t)

	trafficMap := make(map[string]*graph.Node)

	// unknownNode
	n0 := graph.NewNode(testCluster, graph.Unknown, "", graph.Unknown, graph.Unknown, graph.Unknown, graph.Unknown, graph.GraphTypeVersionedApp)

	// NotSE host3 serviceNode
	n1 := graph.NewNode(testCluster, "testNamespace", "host3.external.com", "testNamespace", "", "", "", graph.GraphTypeVersionedApp)

	// SE1 host1 serviceNode
	n2 := graph.NewNode(testCluster, "testNamespace", "host1.external.com", "testNamespace", "", "", "", graph.GraphTypeVersionedApp)
	n2.Metadata = graph.NewMetadata()
	destServices := graph.NewDestServicesMetadata()
	destService := graph.ServiceName{Namespace: n2.Namespace, Name: n2.Service}
	destServices[destService.Key()] = destService
	n2.Metadata[graph.DestServices] = destServices

	// Not SE host2 serviceNode
	n3 := graph.NewNode(testCluster, "testNamespace", "host2.external.com", "testNamespace", "", "", "", graph.GraphTypeVersionedApp)

	trafficMap[n0.ID] = &n0
	trafficMap[n1.ID] = &n1
	trafficMap[n2.ID] = &n2
	trafficMap[n3.ID] = &n3

	n0.AddEdge(&n1).Metadata[graph.ProtocolKey] = graph.HTTP.Name
	n0.AddEdge(&n2).Metadata[graph.ProtocolKey] = graph.HTTP.Name
	n0.AddEdge(&n3).Metadata[graph.ProtocolKey] = graph.HTTP.Name

	assert.Equal(4, len(trafficMap))

	unknownID, _ := graph.Id(testCluster, graph.Unknown, "", graph.Unknown, graph.Unknown, graph.Unknown, graph.Unknown, graph.GraphTypeVersionedApp)
	unknownNode, found0 := trafficMap[unknownID]
	assert.Equal(true, found0)
	assert.Equal(3, len(unknownNode.Edges))
	assert.Equal(nil, unknownNode.Metadata[graph.IsServiceEntry])

	notSEHost3ServiceID, _ := graph.Id(testCluster, "testNamespace", "host3.external.com", "testNamespace", "", "", "", graph.GraphTypeVersionedApp)
	notSEHost3ServiceNode, found1 := trafficMap[notSEHost3ServiceID]
	assert.Equal(true, found1)
	assert.Equal(0, len(notSEHost3ServiceNode.Edges))
	assert.Equal(nil, notSEHost3ServiceNode.Metadata[graph.IsServiceEntry])

	SE1Host1ServiceID, _ := graph.Id(testCluster, "testNamespace", "host1.external.com", "testNamespace", "", "", "", graph.GraphTypeVersionedApp)
	SE1Host1ServiceNode, found2 := trafficMap[SE1Host1ServiceID]
	assert.Equal(true, found2)
	assert.Equal(0, len(SE1Host1ServiceNode.Edges))
	assert.Equal(nil, SE1Host1ServiceNode.Metadata[graph.IsServiceEntry])

	notSEHost2ServiceID, _ := graph.Id(testCluster, "testNamespace", "host2.external.com", "testNamespace", "", "", "", graph.GraphTypeVersionedApp)
	notSEHost2ServiceNode, found3 := trafficMap[notSEHost2ServiceID]
	assert.Equal(true, found3)
	assert.Equal(0, len(notSEHost2ServiceNode.Edges))
	assert.Equal(nil, notSEHost2ServiceNode.Metadata[graph.IsServiceEntry])

	globalInfo := graph.NewAppenderGlobalInfo()
	globalInfo.Business = businessLayer
	globalInfo.HomeCluster = testCluster
	namespaceInfo := graph.NewAppenderNamespaceInfo("otherNamespace")

	// Run the appender...
	a := ServiceEntryAppender{
		AccessibleNamespaces: map[string]time.Time{"otherNamespace": time.Now()},
	}
	a.AppendGraph(trafficMap, globalInfo, namespaceInfo)

	assert.Equal(4, len(trafficMap))

	unknownID, _ = graph.Id(testCluster, graph.Unknown, "", graph.Unknown, graph.Unknown, graph.Unknown, graph.Unknown, graph.GraphTypeVersionedApp)
	unknownNode, found0 = trafficMap[unknownID]
	assert.Equal(true, found0)
	assert.Equal(3, len(unknownNode.Edges))
	assert.Equal(nil, unknownNode.Metadata[graph.IsServiceEntry])

	notSEHost3ServiceID, _ = graph.Id(testCluster, "testNamespace", "host3.external.com", "testNamespace", "", "", "", graph.GraphTypeVersionedApp)
	notSEHost3ServiceNode, found1 = trafficMap[notSEHost3ServiceID]
	assert.Equal(true, found1)
	assert.Equal(0, len(notSEHost3ServiceNode.Edges))
	assert.Equal(nil, notSEHost3ServiceNode.Metadata[graph.IsServiceEntry])

	SE1ID, _ := graph.Id(testCluster, "otherNamespace", "SE1", "otherNamespace", "", "", "", graph.GraphTypeVersionedApp)
	SE1Node, found2 := trafficMap[SE1ID]
	assert.Equal(true, found2)
	assert.Equal(0, len(SE1Node.Edges))
	assert.Equal("MESH_EXTERNAL", SE1Node.Metadata[graph.IsServiceEntry].(*graph.SEInfo).Location)
	assert.Equal(1, len(SE1Node.Metadata[graph.DestServices].(graph.DestServicesMetadata)))

	notSEHost2ServiceID, _ = graph.Id(testCluster, "testNamespace", "host2.external.com", "testNamespace", "", "", "", graph.GraphTypeVersionedApp)
	notSEHost2ServiceNode, found3 = trafficMap[notSEHost2ServiceID]
	assert.Equal(true, found3)
	assert.Equal(0, len(notSEHost2ServiceNode.Edges))
	assert.Equal(nil, notSEHost2ServiceNode.Metadata[graph.IsServiceEntry])
}
