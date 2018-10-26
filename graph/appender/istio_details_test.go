package appender

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"

	"k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/graph"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
)

func setupTrafficMap() (map[string]*graph.Node, string, string, string, string, string) {
	trafficMap := graph.NewTrafficMap()

	appNode := graph.NewNode("testNamespace", graph.UnknownWorkload, "ratings", "", "ratings", graph.GraphTypeVersionedApp)
	appNode.Metadata["destServices"] = map[string]bool{"ratings": true}
	trafficMap[appNode.ID] = &appNode

	appNodeV1 := graph.NewNode("testNamespace", "ratings-v1", "ratings", "v1", "ratings", graph.GraphTypeVersionedApp)
	appNodeV1.Metadata["destServices"] = map[string]bool{"ratings": true}
	trafficMap[appNodeV1.ID] = &appNodeV1

	appNodeV2 := graph.NewNode("testNamespace", "ratings-v2", "ratings", "v2", "ratings", graph.GraphTypeVersionedApp)
	appNodeV2.Metadata["destServices"] = map[string]bool{"ratings": true}
	trafficMap[appNodeV2.ID] = &appNodeV2

	serviceNode := graph.NewNode("testNamespace", graph.UnknownWorkload, graph.UnknownApp, graph.UnknownVersion, "ratings", graph.GraphTypeVersionedApp)
	trafficMap[serviceNode.ID] = &serviceNode

	workloadNode := graph.NewNode("testNamespace", "ratings-v1", graph.UnknownApp, graph.UnknownVersion, "ratings", graph.GraphTypeWorkload)
	workloadNode.Metadata["destServices"] = map[string]bool{"ratings": true}
	trafficMap[workloadNode.ID] = &workloadNode

	return trafficMap, appNode.ID, appNodeV1.ID, appNodeV2.ID, serviceNode.ID, workloadNode.ID
}

func TestCBAll(t *testing.T) {
	assert := assert.New(t)
	config.Set(config.NewConfig())

	k8s := kubetest.NewK8SClientMock()
	dRule := kubernetes.DestinationRule{
		ObjectMeta: v1.ObjectMeta{
			Name: "dRule-1",
		},
		Spec: map[string]interface{}{
			"host":          "ratings",
			"trafficPolicy": map[string]interface{}{"connectionPool": true},
		},
	}
	k8s.On("GetDestinationRules", mock.AnythingOfType("string"), "").Return([]kubernetes.IstioObject{
		dRule.DeepCopyIstioObject(),
	}, nil)
	k8s.On("GetVirtualServices", mock.AnythingOfType("string"), "").Return([]kubernetes.IstioObject{}, nil)

	businessLayer := business.SetWithBackends(k8s, nil)
	trafficMap, appNodeId, appNodeV1Id, appNodeV2Id, svcNodeId, wlNodeId := setupTrafficMap()

	assert.Equal(5, len(trafficMap))
	assert.Equal(nil, trafficMap[appNodeId].Metadata["hasCB"])
	assert.Equal(nil, trafficMap[appNodeV1Id].Metadata["hasCB"])
	assert.Equal(nil, trafficMap[appNodeV2Id].Metadata["hasCB"])
	assert.Equal(nil, trafficMap[svcNodeId].Metadata["hasCB"])
	assert.Equal(nil, trafficMap[wlNodeId].Metadata["hasCB"])
	assert.Equal(nil, trafficMap[appNodeId].Metadata["hasVS"])
	assert.Equal(nil, trafficMap[appNodeV1Id].Metadata["hasVS"])
	assert.Equal(nil, trafficMap[appNodeV2Id].Metadata["hasVS"])
	assert.Equal(nil, trafficMap[svcNodeId].Metadata["hasVS"])
	assert.Equal(nil, trafficMap[wlNodeId].Metadata["hasVS"])

	globalInfo := GlobalInfo{
		Business: businessLayer,
	}
	namespaceInfo := NamespaceInfo{
		Namespace: "testNamespace",
	}

	a := IstioAppender{}
	a.AppendGraph(trafficMap, &globalInfo, &namespaceInfo)

	assert.Equal(5, len(trafficMap))
	assert.Equal(true, trafficMap[appNodeId].Metadata["hasCB"])
	assert.Equal(true, trafficMap[appNodeV1Id].Metadata["hasCB"])
	assert.Equal(true, trafficMap[appNodeV2Id].Metadata["hasCB"])
	assert.Equal(true, trafficMap[svcNodeId].Metadata["hasCB"])
	assert.Equal(nil, trafficMap[wlNodeId].Metadata["hasCB"])
	assert.Equal(nil, trafficMap[appNodeId].Metadata["hasVS"])
	assert.Equal(nil, trafficMap[appNodeV1Id].Metadata["hasVS"])
	assert.Equal(nil, trafficMap[appNodeV2Id].Metadata["hasVS"])
	assert.Equal(nil, trafficMap[svcNodeId].Metadata["hasVS"])
	assert.Equal(nil, trafficMap[wlNodeId].Metadata["hasVS"])
}

func TestCBSubset(t *testing.T) {
	assert := assert.New(t)
	config.Set(config.NewConfig())

	k8s := kubetest.NewK8SClientMock()
	dRule := kubernetes.DestinationRule{
		ObjectMeta: v1.ObjectMeta{
			Name: "dRule-1",
		},
		Spec: map[string]interface{}{
			"host": "ratings",
			"subsets": []interface{}{
				map[string]interface{}{
					"trafficPolicy": map[string]interface{}{"connectionPool": true},
					"labels":        map[string]interface{}{"version": "v1"},
				},
			},
		},
	}
	k8s.On("GetDestinationRules", mock.AnythingOfType("string"), "").Return([]kubernetes.IstioObject{
		dRule.DeepCopyIstioObject(),
	}, nil)
	k8s.On("GetVirtualServices", mock.AnythingOfType("string"), "").Return([]kubernetes.IstioObject{}, nil)

	businessLayer := business.SetWithBackends(k8s, nil)
	trafficMap, appNodeId, appNodeV1Id, appNodeV2Id, svcNodeId, wlNodeId := setupTrafficMap()

	assert.Equal(5, len(trafficMap))
	assert.Equal(nil, trafficMap[appNodeId].Metadata["hasCB"])
	assert.Equal(nil, trafficMap[appNodeV1Id].Metadata["hasCB"])
	assert.Equal(nil, trafficMap[appNodeV2Id].Metadata["hasCB"])
	assert.Equal(nil, trafficMap[svcNodeId].Metadata["hasCB"])
	assert.Equal(nil, trafficMap[wlNodeId].Metadata["hasCB"])
	assert.Equal(nil, trafficMap[appNodeId].Metadata["hasVS"])
	assert.Equal(nil, trafficMap[appNodeV1Id].Metadata["hasVS"])
	assert.Equal(nil, trafficMap[appNodeV2Id].Metadata["hasVS"])
	assert.Equal(nil, trafficMap[svcNodeId].Metadata["hasVS"])
	assert.Equal(nil, trafficMap[wlNodeId].Metadata["hasVS"])

	globalInfo := GlobalInfo{
		Business: businessLayer,
	}
	namespaceInfo := NamespaceInfo{
		Namespace: "testNamespace",
	}

	a := IstioAppender{}
	a.AppendGraph(trafficMap, &globalInfo, &namespaceInfo)

	assert.Equal(5, len(trafficMap))
	assert.Equal(true, trafficMap[appNodeId].Metadata["hasCB"])
	assert.Equal(true, trafficMap[appNodeV1Id].Metadata["hasCB"])
	assert.Equal(nil, trafficMap[appNodeV2Id].Metadata["hasCB"])
	assert.Equal(true, trafficMap[svcNodeId].Metadata["hasCB"])
	assert.Equal(nil, trafficMap[wlNodeId].Metadata["hasCB"])
	assert.Equal(nil, trafficMap[appNodeId].Metadata["hasVS"])
	assert.Equal(nil, trafficMap[appNodeV1Id].Metadata["hasVS"])
	assert.Equal(nil, trafficMap[appNodeV2Id].Metadata["hasVs"])
	assert.Equal(nil, trafficMap[svcNodeId].Metadata["hasVS"])
	assert.Equal(nil, trafficMap[wlNodeId].Metadata["hasVS"])
}

func TestVS(t *testing.T) {
	assert := assert.New(t)
	config.Set(config.NewConfig())

	k8s := kubetest.NewK8SClientMock()
	vService := kubernetes.VirtualService{
		ObjectMeta: v1.ObjectMeta{
			Name: "vService-1",
		},
		Spec: map[string]interface{}{
			"hosts": []interface{}{
				"ratings",
			},
		},
	}
	k8s.On("GetDestinationRules", mock.AnythingOfType("string"), "").Return([]kubernetes.IstioObject{}, nil)
	k8s.On("GetVirtualServices", mock.AnythingOfType("string"), "").Return([]kubernetes.IstioObject{
		vService.DeepCopyIstioObject(),
	}, nil)

	businessLayer := business.SetWithBackends(k8s, nil)
	trafficMap, appNodeId, appNodeV1Id, appNodeV2Id, svcNodeId, wlNodeId := setupTrafficMap()

	assert.Equal(5, len(trafficMap))
	assert.Equal(nil, trafficMap[appNodeId].Metadata["hasCB"])
	assert.Equal(nil, trafficMap[appNodeV1Id].Metadata["hasCB"])
	assert.Equal(nil, trafficMap[appNodeV2Id].Metadata["hasCB"])
	assert.Equal(nil, trafficMap[svcNodeId].Metadata["hasCB"])
	assert.Equal(nil, trafficMap[wlNodeId].Metadata["hasCB"])
	assert.Equal(nil, trafficMap[appNodeId].Metadata["hasVS"])
	assert.Equal(nil, trafficMap[appNodeV1Id].Metadata["hasVS"])
	assert.Equal(nil, trafficMap[appNodeV2Id].Metadata["hasVS"])
	assert.Equal(nil, trafficMap[svcNodeId].Metadata["hasVS"])
	assert.Equal(nil, trafficMap[wlNodeId].Metadata["hasVS"])

	globalInfo := GlobalInfo{
		Business: businessLayer,
	}
	namespaceInfo := NamespaceInfo{
		Namespace: "testNamespace",
	}

	a := IstioAppender{}
	a.AppendGraph(trafficMap, &globalInfo, &namespaceInfo)

	assert.Equal(5, len(trafficMap))
	assert.Equal(nil, trafficMap[appNodeId].Metadata["hasCB"])
	assert.Equal(nil, trafficMap[appNodeV1Id].Metadata["hasCB"])
	assert.Equal(nil, trafficMap[appNodeV2Id].Metadata["hasCB"])
	assert.Equal(nil, trafficMap[svcNodeId].Metadata["hasCB"])
	assert.Equal(nil, trafficMap[wlNodeId].Metadata["hasCB"])
	assert.Equal(nil, trafficMap[appNodeId].Metadata["hasVS"])
	assert.Equal(nil, trafficMap[appNodeV1Id].Metadata["hasVS"])
	assert.Equal(nil, trafficMap[appNodeV2Id].Metadata["hasVS"])
	assert.Equal(true, trafficMap[svcNodeId].Metadata["hasVS"])
	assert.Equal(nil, trafficMap[wlNodeId].Metadata["hasVS"])
}
