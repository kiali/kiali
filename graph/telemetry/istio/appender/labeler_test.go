package appender

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	apps_v1 "k8s.io/api/apps/v1"
	core_v1 "k8s.io/api/core/v1"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/graph"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/models"
)

func setupLabelerTrafficMap() (map[string]*graph.Node, string, string, string, string, string) {
	trafficMap := graph.NewTrafficMap()

	appNode, _ := graph.NewNode(config.DefaultClusterID, "testNamespace", "test", "testNamespace", graph.Unknown, "test", "", graph.GraphTypeVersionedApp)
	trafficMap[appNode.ID] = appNode

	appNodeV1, _ := graph.NewNode(config.DefaultClusterID, "testNamespace", "test", "testNamespace", "test-v1", "test", "v1", graph.GraphTypeVersionedApp)
	trafficMap[appNodeV1.ID] = appNodeV1

	appNodeV2, _ := graph.NewNode(config.DefaultClusterID, "testNamespace", "test", "testNamespace", "test-v2", "test", "v2", graph.GraphTypeVersionedApp)
	trafficMap[appNodeV2.ID] = appNodeV2

	serviceNode, _ := graph.NewNode(config.DefaultClusterID, "testNamespace", "test", "testNamespace", graph.Unknown, graph.Unknown, graph.Unknown, graph.GraphTypeVersionedApp)
	trafficMap[serviceNode.ID] = serviceNode

	workloadNode, _ := graph.NewNode(config.DefaultClusterID, "testNamespace", "test", "testNamespace", "test-v1", graph.Unknown, graph.Unknown, graph.GraphTypeWorkload)
	trafficMap[workloadNode.ID] = workloadNode

	return trafficMap, appNode.ID, appNodeV1.ID, appNodeV2.ID, serviceNode.ID, workloadNode.ID
}

func setupLabelerK8S(t *testing.T) *business.Layer {
	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = config.DefaultClusterID
	conf.ExternalServices.Istio.IstioAPIEnabled = false
	config.Set(conf)

	k8s := kubetest.NewFakeK8sClient(
		kubetest.FakeNamespace("testNamespace"),
		&apps_v1.Deployment{
			ObjectMeta: meta_v1.ObjectMeta{
				Name:      "test-v1",
				Namespace: "testNamespace",
			},
			Spec: apps_v1.DeploymentSpec{
				Template: core_v1.PodTemplateSpec{
					ObjectMeta: meta_v1.ObjectMeta{
						Labels: graph.LabelsMetadata{"app": "test", "version": "v1", "datacenter": "east"},
					},
				},
			},
		},
		&apps_v1.Deployment{
			ObjectMeta: meta_v1.ObjectMeta{
				Name:      "test-v2",
				Namespace: "testNamespace",
			},
			Spec: apps_v1.DeploymentSpec{
				Template: core_v1.PodTemplateSpec{
					ObjectMeta: meta_v1.ObjectMeta{
						Labels: graph.LabelsMetadata{"app": "test", "version": "v2", "datacenter": "west"},
					},
				},
			},
		},
		&core_v1.Pod{
			ObjectMeta: meta_v1.ObjectMeta{
				Name:      "test-v1-1234",
				Namespace: "testNamespace",
				Labels:    graph.LabelsMetadata{"app": "test", "version": "v1", "datacenter": "east"},
			},
			Status: core_v1.PodStatus{
				Message: "foo",
			},
		},
		&core_v1.Pod{
			ObjectMeta: meta_v1.ObjectMeta{
				Name:      "test-v2-1234",
				Namespace: "testNamespace",
				Labels:    graph.LabelsMetadata{"app": "test", "version": "v2", "datacenter": "west"},
			},
			Status: core_v1.PodStatus{
				Message: "foo",
			},
		},
		&core_v1.Service{
			ObjectMeta: meta_v1.ObjectMeta{
				Name:      "test",
				Namespace: "testNamespace",
				Labels:    graph.LabelsMetadata{"app": "test", "datacenter": "east"},
			},
		},
	)

	return business.NewLayerBuilder(t, conf).WithClient(k8s).Build()
}

func TestLabeler(t *testing.T) {
	assert := assert.New(t)

	businessLayer := setupLabelerK8S(t)
	trafficMap, appNodeId, appNodeV1Id, appNodeV2Id, svcNodeId, wlNodeId := setupLabelerTrafficMap()

	assert.Equal(5, len(trafficMap))
	assert.Equal(nil, trafficMap[appNodeId].Metadata[graph.Labels])
	assert.Equal(nil, trafficMap[appNodeV1Id].Metadata[graph.Labels])
	assert.Equal(nil, trafficMap[appNodeV2Id].Metadata[graph.Labels])
	assert.Equal(nil, trafficMap[svcNodeId].Metadata[graph.Labels])
	assert.Equal(nil, trafficMap[wlNodeId].Metadata[graph.Labels])

	globalInfo := graph.NewGlobalInfo(businessLayer, nil, config.Get(), []models.KubeCluster{}, NewIstioInfo())

	a := LabelerAppender{}
	a.AppendGraph(context.Background(), trafficMap, globalInfo, nil)

	assert.Equal(5, len(trafficMap))
	assert.Equal(1, len(trafficMap[appNodeId].Metadata[graph.Labels].(graph.LabelsMetadata)))
	assert.Equal("east,west", trafficMap[appNodeId].Metadata[graph.Labels].(graph.LabelsMetadata)["datacenter"])
	assert.Equal(1, len(trafficMap[appNodeV1Id].Metadata[graph.Labels].(graph.LabelsMetadata)))
	assert.Equal("east", trafficMap[appNodeV1Id].Metadata[graph.Labels].(graph.LabelsMetadata)["datacenter"])
	assert.Equal(1, len(trafficMap[appNodeV2Id].Metadata[graph.Labels].(graph.LabelsMetadata)))
	assert.Equal("west", trafficMap[appNodeV2Id].Metadata[graph.Labels].(graph.LabelsMetadata)["datacenter"])
	assert.Equal(1, len(trafficMap[svcNodeId].Metadata[graph.Labels].(graph.LabelsMetadata)))
	assert.Equal("east", trafficMap[svcNodeId].Metadata[graph.Labels].(graph.LabelsMetadata)["datacenter"])
	assert.Equal(1, len(trafficMap[wlNodeId].Metadata[graph.Labels].(graph.LabelsMetadata)))
	assert.Equal("east", trafficMap[wlNodeId].Metadata[graph.Labels].(graph.LabelsMetadata)["datacenter"])
}
