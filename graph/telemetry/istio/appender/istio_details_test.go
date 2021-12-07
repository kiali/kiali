package appender

import (
	"testing"

	osproject_v1 "github.com/openshift/api/project/v1"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	api_networking_v1alpha3 "istio.io/api/networking/v1alpha3"
	networking_v1alpha3 "istio.io/client-go/pkg/apis/networking/v1alpha3"
	core_v1 "k8s.io/api/core/v1"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/graph"
	"github.com/kiali/kiali/kubernetes/kubetest"
)

func setupTrafficMap() (map[string]*graph.Node, string, string, string, string, string, string) {
	trafficMap := graph.NewTrafficMap()

	appNode := graph.NewNode(business.DefaultClusterID, "testNamespace", "ratings", "testNamespace", graph.Unknown, "ratings", "", graph.GraphTypeVersionedApp)
	appNode.Metadata[graph.DestServices] = graph.NewDestServicesMetadata().Add("testNamespace ratings", graph.ServiceName{Namespace: "testNamespace", Name: "ratings"})
	trafficMap[appNode.ID] = &appNode

	appNodeV1 := graph.NewNode(business.DefaultClusterID, "testNamespace", "ratings", "testNamespace", "ratings-v1", "ratings", "v1", graph.GraphTypeVersionedApp)
	appNodeV1.Metadata[graph.DestServices] = graph.NewDestServicesMetadata().Add("testNamespace ratings", graph.ServiceName{Namespace: "testNamespace", Name: "ratings"})
	trafficMap[appNodeV1.ID] = &appNodeV1

	appNodeV2 := graph.NewNode(business.DefaultClusterID, "testNamespace", "ratings", "testNamespace", "ratings-v2", "ratings", "v2", graph.GraphTypeVersionedApp)
	appNodeV2.Metadata[graph.DestServices] = graph.NewDestServicesMetadata().Add("testNamespace ratings", graph.ServiceName{Namespace: "testNamespace", Name: "ratings"})
	trafficMap[appNodeV2.ID] = &appNodeV2

	serviceNode := graph.NewNode(business.DefaultClusterID, "testNamespace", "ratings", "testNamespace", graph.Unknown, graph.Unknown, graph.Unknown, graph.GraphTypeVersionedApp)
	trafficMap[serviceNode.ID] = &serviceNode

	workloadNode := graph.NewNode(business.DefaultClusterID, "testNamespace", "ratings", "testNamespace", "ratings-v1", graph.Unknown, graph.Unknown, graph.GraphTypeWorkload)
	workloadNode.Metadata[graph.DestServices] = graph.NewDestServicesMetadata().Add("testNamespace ratings", graph.ServiceName{Namespace: "testNamespace", Name: "ratings"})
	trafficMap[workloadNode.ID] = &workloadNode

	fooServiceNode := graph.NewNode(business.DefaultClusterID, "testNamespace", "foo", "testNamespace", graph.Unknown, graph.Unknown, graph.Unknown, graph.GraphTypeVersionedApp)
	trafficMap[fooServiceNode.ID] = &fooServiceNode

	return trafficMap, appNode.ID, appNodeV1.ID, appNodeV2.ID, serviceNode.ID, workloadNode.ID, fooServiceNode.ID
}

func TestCBAll(t *testing.T) {
	assert := assert.New(t)
	config.Set(config.NewConfig())

	k8s := kubetest.NewK8SClientMock()
	dRule := &networking_v1alpha3.DestinationRule{}
	dRule.Name = "dRule-1"
	dRule.Namespace = "testNamespace"
	dRule.Spec.Host = "ratings"
	dRule.Spec.TrafficPolicy = &api_networking_v1alpha3.TrafficPolicy{
		ConnectionPool: &api_networking_v1alpha3.ConnectionPoolSettings{
			Http: &api_networking_v1alpha3.ConnectionPoolSettings_HTTPSettings{
				MaxRequestsPerConnection: 30,
			},
		},
	}
	k8s.MockIstio(dRule)
	k8s.On("GetProject", mock.AnythingOfType("string")).Return(&osproject_v1.Project{}, nil)
	k8s.On("GetProjects", mock.AnythingOfType("string")).Return([]osproject_v1.Project{}, nil)
	k8s.On("GetEndpoints", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return(&core_v1.Endpoints{}, nil)
	k8s.On("GetServices", mock.AnythingOfType("string"), mock.Anything).Return([]core_v1.Service{{}}, nil)

	businessLayer := business.NewWithBackends(k8s, nil, nil)
	trafficMap, appNodeId, appNodeV1Id, appNodeV2Id, svcNodeId, wlNodeId, _ := setupTrafficMap()

	assert.Equal(6, len(trafficMap))
	assert.Equal(nil, trafficMap[appNodeId].Metadata[graph.HasCB])
	assert.Equal(nil, trafficMap[appNodeV1Id].Metadata[graph.HasCB])
	assert.Equal(nil, trafficMap[appNodeV2Id].Metadata[graph.HasCB])
	assert.Equal(nil, trafficMap[svcNodeId].Metadata[graph.HasCB])
	assert.Equal(nil, trafficMap[wlNodeId].Metadata[graph.HasCB])
	assert.Equal(nil, trafficMap[appNodeId].Metadata[graph.HasVS])
	assert.Equal(nil, trafficMap[appNodeV1Id].Metadata[graph.HasVS])
	assert.Equal(nil, trafficMap[appNodeV2Id].Metadata[graph.HasVS])
	assert.Equal(nil, trafficMap[svcNodeId].Metadata[graph.HasVS])
	assert.Equal(nil, trafficMap[wlNodeId].Metadata[graph.HasVS])

	globalInfo := graph.NewAppenderGlobalInfo()
	globalInfo.Business = businessLayer
	namespaceInfo := graph.NewAppenderNamespaceInfo("testNamespace")

	a := IstioAppender{}
	a.AppendGraph(trafficMap, globalInfo, namespaceInfo)

	assert.Equal(6, len(trafficMap))
	assert.Equal(true, trafficMap[appNodeId].Metadata[graph.HasCB])
	assert.Equal(true, trafficMap[appNodeV1Id].Metadata[graph.HasCB])
	assert.Equal(true, trafficMap[appNodeV2Id].Metadata[graph.HasCB])
	assert.Equal(true, trafficMap[svcNodeId].Metadata[graph.HasCB])
	assert.Equal(nil, trafficMap[wlNodeId].Metadata[graph.HasCB])
	assert.Equal(nil, trafficMap[appNodeId].Metadata[graph.HasVS])
	assert.Equal(nil, trafficMap[appNodeV1Id].Metadata[graph.HasVS])
	assert.Equal(nil, trafficMap[appNodeV2Id].Metadata[graph.HasVS])
	assert.Equal(nil, trafficMap[svcNodeId].Metadata[graph.HasVS])
	assert.Equal(nil, trafficMap[wlNodeId].Metadata[graph.HasVS])
}

func TestCBSubset(t *testing.T) {
	assert := assert.New(t)
	config.Set(config.NewConfig())

	k8s := kubetest.NewK8SClientMock()
	dRule := &networking_v1alpha3.DestinationRule{}
	dRule.Name = "dRule-1"
	dRule.Namespace = "testNamespace"
	dRule.Spec.Host = "ratings"
	dRule.Spec.Subsets = []*api_networking_v1alpha3.Subset{
		{
			TrafficPolicy: &api_networking_v1alpha3.TrafficPolicy{
				ConnectionPool: &api_networking_v1alpha3.ConnectionPoolSettings{
					Http: &api_networking_v1alpha3.ConnectionPoolSettings_HTTPSettings{
						MaxRequestsPerConnection: 30,
					},
				},
			},
			Labels: map[string]string{
				"version": "v1",
			},
		},
	}
	k8s.MockIstio(dRule)

	k8s.On("GetProject", mock.AnythingOfType("string")).Return(&osproject_v1.Project{}, nil)
	k8s.On("GetProjects", mock.AnythingOfType("string")).Return([]osproject_v1.Project{}, nil)
	k8s.On("GetEndpoints", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return(&core_v1.Endpoints{}, nil)
	k8s.On("GetServices", mock.AnythingOfType("string"), mock.Anything).Return([]core_v1.Service{{}}, nil)

	businessLayer := business.NewWithBackends(k8s, nil, nil)
	trafficMap, appNodeId, appNodeV1Id, appNodeV2Id, svcNodeId, wlNodeId, _ := setupTrafficMap()

	assert.Equal(6, len(trafficMap))
	assert.Equal(nil, trafficMap[appNodeId].Metadata[graph.HasCB])
	assert.Equal(nil, trafficMap[appNodeV1Id].Metadata[graph.HasCB])
	assert.Equal(nil, trafficMap[appNodeV2Id].Metadata[graph.HasCB])
	assert.Equal(nil, trafficMap[svcNodeId].Metadata[graph.HasCB])
	assert.Equal(nil, trafficMap[wlNodeId].Metadata[graph.HasCB])
	assert.Equal(nil, trafficMap[appNodeId].Metadata[graph.HasVS])
	assert.Equal(nil, trafficMap[appNodeV1Id].Metadata[graph.HasVS])
	assert.Equal(nil, trafficMap[appNodeV2Id].Metadata[graph.HasVS])
	assert.Equal(nil, trafficMap[svcNodeId].Metadata[graph.HasVS])
	assert.Equal(nil, trafficMap[wlNodeId].Metadata[graph.HasVS])

	globalInfo := graph.NewAppenderGlobalInfo()
	globalInfo.Business = businessLayer
	namespaceInfo := graph.NewAppenderNamespaceInfo("testNamespace")

	a := IstioAppender{}
	a.AppendGraph(trafficMap, globalInfo, namespaceInfo)

	assert.Equal(6, len(trafficMap))
	assert.Equal(true, trafficMap[appNodeId].Metadata[graph.HasCB])
	assert.Equal(true, trafficMap[appNodeV1Id].Metadata[graph.HasCB])
	assert.Equal(nil, trafficMap[appNodeV2Id].Metadata[graph.HasCB])
	assert.Equal(true, trafficMap[svcNodeId].Metadata[graph.HasCB])
	assert.Equal(nil, trafficMap[wlNodeId].Metadata[graph.HasCB])
	assert.Equal(nil, trafficMap[appNodeId].Metadata[graph.HasVS])
	assert.Equal(nil, trafficMap[appNodeV1Id].Metadata[graph.HasVS])
	assert.Equal(nil, trafficMap[appNodeV2Id].Metadata[graph.HasVS])
	assert.Equal(nil, trafficMap[svcNodeId].Metadata[graph.HasVS])
	assert.Equal(nil, trafficMap[wlNodeId].Metadata[graph.HasVS])
}

// TODO: Re-add following two tests. A way for testing code that *requires* the cache to be enabled is needed.
//func TestVS(t *testing.T) {
//	assert := assert.New(t)
//	config.Set(config.NewConfig())
//
//	k8s := kubetest.NewK8SClientMock()
//	vService := &networking_v1alpha3.VirtualService{}
//	vService.Name = "vService-1"
//	vService.Namespace = "testNamespace"
//	vService.Spec.Hosts = []string{"ratings"}
//	vService.Spec.Http = []*api_networking_v1alpha3.HTTPRoute{
//		{
//			Route: []*api_networking_v1alpha3.HTTPRouteDestination{
//				{
//					Destination: &api_networking_v1alpha3.Destination{
//						Host: "foo",
//					},
//				},
//			},
//		},
//	}
//	k8s.MockIstio(vService)
//
//	k8s.On("GetProject", mock.AnythingOfType("string")).Return(&osproject_v1.Project{}, nil)
//	k8s.On("GetProjects", mock.AnythingOfType("string")).Return([]osproject_v1.Project{}, nil)
//	k8s.On("GetEndpoints", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return(&core_v1.Endpoints{}, nil)
//	k8s.On("GetServices", mock.AnythingOfType("string"), mock.Anything).Return([]core_v1.Service{{}}, nil)
//
//	businessLayer := business.NewWithBackends(k8s, nil, nil)
//	trafficMap, appNodeId, appNodeV1Id, appNodeV2Id, svcNodeId, wlNodeId, fooSvcNodeId := setupTrafficMap()
//
//	assert.Equal(6, len(trafficMap))
//	assert.Equal(nil, trafficMap[appNodeId].Metadata[graph.HasCB])
//	assert.Equal(nil, trafficMap[appNodeV1Id].Metadata[graph.HasCB])
//	assert.Equal(nil, trafficMap[appNodeV2Id].Metadata[graph.HasCB])
//	assert.Equal(nil, trafficMap[svcNodeId].Metadata[graph.HasCB])
//	assert.Equal(nil, trafficMap[wlNodeId].Metadata[graph.HasCB])
//	assert.Equal(nil, trafficMap[appNodeId].Metadata[graph.HasVS])
//	assert.Equal(nil, trafficMap[appNodeV1Id].Metadata[graph.HasVS])
//	assert.Equal(nil, trafficMap[appNodeV2Id].Metadata[graph.HasVS])
//	assert.Equal(nil, trafficMap[svcNodeId].Metadata[graph.HasVS])
//	assert.Equal(nil, trafficMap[wlNodeId].Metadata[graph.HasVS])
//	assert.Equal(nil, trafficMap[fooSvcNodeId].Metadata[graph.HasVS])
//
//	globalInfo := graph.NewAppenderGlobalInfo()
//	globalInfo.Business = businessLayer
//	namespaceInfo := graph.NewAppenderNamespaceInfo("testNamespace")
//
//	a := IstioAppender{}
//	a.AppendGraph(trafficMap, globalInfo, namespaceInfo)
//
//	assert.Equal(6, len(trafficMap))
//	assert.Equal(nil, trafficMap[appNodeId].Metadata[graph.HasCB])
//	assert.Equal(nil, trafficMap[appNodeV1Id].Metadata[graph.HasCB])
//	assert.Equal(nil, trafficMap[appNodeV2Id].Metadata[graph.HasCB])
//	assert.Equal(nil, trafficMap[svcNodeId].Metadata[graph.HasCB])
//	assert.Equal(nil, trafficMap[wlNodeId].Metadata[graph.HasCB])
//	assert.Equal(nil, trafficMap[appNodeId].Metadata[graph.HasVS])
//	assert.Equal(nil, trafficMap[appNodeV1Id].Metadata[graph.HasVS])
//	assert.Equal(nil, trafficMap[appNodeV2Id].Metadata[graph.HasVS])
//	assert.Equal(nil, trafficMap[svcNodeId].Metadata[graph.HasVS])
//	assert.Equal(nil, trafficMap[wlNodeId].Metadata[graph.HasVS])
//
//	assert.NotNil(trafficMap[fooSvcNodeId].Metadata[graph.HasVS])
//	assert.IsType(graph.VirtualServicesMetadata{}, trafficMap[fooSvcNodeId].Metadata[graph.HasVS])
//	assert.Len(trafficMap[fooSvcNodeId].Metadata[graph.HasVS], 1)
//	assert.Len(trafficMap[fooSvcNodeId].Metadata[graph.HasVS].(graph.VirtualServicesMetadata)["vService-1"], 1)
//	assert.Equal("ratings", trafficMap[fooSvcNodeId].Metadata[graph.HasVS].(graph.VirtualServicesMetadata)["vService-1"][0])
//}
//
//func TestVSWithRoutingBadges(t *testing.T) {
//	assert := assert.New(t)
//	config.Set(config.NewConfig())
//
//	k8s := kubetest.NewK8SClientMock()
//	vService := &networking_v1alpha3.VirtualService{}
//	vService.Name = "vService-1"
//	vService.Namespace = "testNamespace"
//	vService.Spec.Hosts = []string{"ratings"}
//	vService.Spec.Http = []*api_networking_v1alpha3.HTTPRoute{
//		{
//			Route: []*api_networking_v1alpha3.HTTPRouteDestination{
//				{
//					Destination: &api_networking_v1alpha3.Destination{
//						Host: "foo",
//					},
//					Weight: 20,
//				},
//				{
//					Destination: &api_networking_v1alpha3.Destination{
//						Host: "bar",
//					},
//					Weight: 80,
//				},
//			},
//		},
//	}
//	k8s.MockIstio(vService)
//	k8s.On("GetProject", mock.AnythingOfType("string")).Return(&osproject_v1.Project{}, nil)
//	k8s.On("GetProjects", mock.AnythingOfType("string")).Return([]osproject_v1.Project{}, nil)
//	k8s.On("GetEndpoints", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return(&core_v1.Endpoints{}, nil)
//	k8s.On("GetServices", mock.AnythingOfType("string"), mock.Anything).Return([]core_v1.Service{{}}, nil)
//
//	businessLayer := business.NewWithBackends(k8s, nil, nil)
//	trafficMap, _, _, _, _, _, fooSvcNodeId := setupTrafficMap()
//
//	assert.Equal(nil, trafficMap[fooSvcNodeId].Metadata[graph.HasVS])
//	assert.Equal(nil, trafficMap[fooSvcNodeId].Metadata[graph.HasTrafficShifting])
//	assert.Equal(nil, trafficMap[fooSvcNodeId].Metadata[graph.HasRequestRouting])
//
//	globalInfo := graph.NewAppenderGlobalInfo()
//	globalInfo.Business = businessLayer
//	namespaceInfo := graph.NewAppenderNamespaceInfo("testNamespace")
//
//	a := IstioAppender{}
//	a.AppendGraph(trafficMap, globalInfo, namespaceInfo)
//
//	assert.Equal(true, trafficMap[fooSvcNodeId].Metadata[graph.HasTrafficShifting])
//}

func TestSEInAppBox(t *testing.T) {
	check := assert.New(t)
	config.Set(config.NewConfig())

	k8s := kubetest.NewK8SClientMock()
	k8s.MockIstio()
	k8s.On("GetProject", mock.AnythingOfType("string")).Return(&osproject_v1.Project{}, nil)
	k8s.On("GetServices", mock.AnythingOfType("string"), mock.Anything).Return([]core_v1.Service{{
		ObjectMeta: meta_v1.ObjectMeta{
			Name: "foobar",
			Labels: map[string]string{
				"app": "fooApp",
			},
		},
	}}, nil)

	businessLayer := business.NewWithBackends(k8s, nil, nil)

	trafficMap := graph.NewTrafficMap()
	serviceEntryNode := graph.NewNode(business.DefaultClusterID, "testNamespace", "ratings", "", "", "", "", graph.GraphTypeVersionedApp)
	serviceEntryNode.Metadata[graph.IsServiceEntry] = &graph.SEInfo{
		Hosts:     []string{"foobar.com"},
		Location:  "MESH_INTERNAL",
		Namespace: "testNamespace",
	}
	trafficMap[serviceEntryNode.ID] = &serviceEntryNode

	globalInfo := graph.NewAppenderGlobalInfo()
	globalInfo.Business = businessLayer
	namespaceInfo := graph.NewAppenderNamespaceInfo("testNamespace")

	a := IstioAppender{}
	a.AppendGraph(trafficMap, globalInfo, namespaceInfo)

	check.Equal("fooApp", trafficMap[serviceEntryNode.ID].App)
}
