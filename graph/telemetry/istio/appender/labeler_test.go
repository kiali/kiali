package appender

import (
	"testing"

	osapps_v1 "github.com/openshift/api/apps/v1"
	osproject_v1 "github.com/openshift/api/project/v1"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	apps_v1 "k8s.io/api/apps/v1"
	batch_v1 "k8s.io/api/batch/v1"
	core_v1 "k8s.io/api/core/v1"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/graph"
	"github.com/kiali/kiali/kubernetes/kubetest"
)

func setupLabelerTrafficMap() (map[string]*graph.Node, string, string, string, string, string) {
	trafficMap := graph.NewTrafficMap()

	appNode := graph.NewNode(business.DefaultClusterID, "testNamespace", "test", "testNamespace", graph.Unknown, "test", "", graph.GraphTypeVersionedApp)
	trafficMap[appNode.ID] = &appNode

	appNodeV1 := graph.NewNode(business.DefaultClusterID, "testNamespace", "test", "testNamespace", "test-v1", "test", "v1", graph.GraphTypeVersionedApp)
	trafficMap[appNodeV1.ID] = &appNodeV1

	appNodeV2 := graph.NewNode(business.DefaultClusterID, "testNamespace", "test", "testNamespace", "test-v2", "test", "v2", graph.GraphTypeVersionedApp)
	trafficMap[appNodeV2.ID] = &appNodeV2

	serviceNode := graph.NewNode(business.DefaultClusterID, "testNamespace", "test", "testNamespace", graph.Unknown, graph.Unknown, graph.Unknown, graph.GraphTypeVersionedApp)
	trafficMap[serviceNode.ID] = &serviceNode

	workloadNode := graph.NewNode(business.DefaultClusterID, "testNamespace", "test", "testNamespace", "test-v1", graph.Unknown, graph.Unknown, graph.GraphTypeWorkload)
	trafficMap[workloadNode.ID] = &workloadNode

	return trafficMap, appNode.ID, appNodeV1.ID, appNodeV2.ID, serviceNode.ID, workloadNode.ID
}

func setupLabelerK8S() *business.Layer {
	k8s := kubetest.NewK8SClientMock()
	conf := config.NewConfig()
	config.Set(conf)

	k8s.On("GetProject", mock.AnythingOfType("string")).Return(&osproject_v1.Project{}, nil)

	k8s.On("GetCronJobs", mock.AnythingOfType("string")).Return([]batch_v1.CronJob{}, nil)
	k8s.On("GetDeployment", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return((*apps_v1.Deployment)(nil), nil)
	k8s.On("GetDeployments", mock.AnythingOfType("string")).Return([]apps_v1.Deployment{
		{
			ObjectMeta: meta_v1.ObjectMeta{
				Name: "test-v1",
			},
			Spec: apps_v1.DeploymentSpec{
				Template: core_v1.PodTemplateSpec{
					ObjectMeta: meta_v1.ObjectMeta{
						Labels: graph.LabelsMetadata{"app": "test", "version": "v1", "datacenter": "east"},
					},
				},
			},
		},
		{
			ObjectMeta: meta_v1.ObjectMeta{
				Name: "test-v2",
			},
			Spec: apps_v1.DeploymentSpec{
				Template: core_v1.PodTemplateSpec{
					ObjectMeta: meta_v1.ObjectMeta{
						Labels: graph.LabelsMetadata{"app": "test", "version": "v2", "datacenter": "west"},
					},
				},
			},
		},
	}, nil)
	k8s.On("GetDeploymentConfigs", mock.AnythingOfType("string")).Return([]osapps_v1.DeploymentConfig{}, nil)
	k8s.On("GetJobs", mock.AnythingOfType("string")).Return([]batch_v1.Job{}, nil)
	k8s.On("GetPods", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return(
		[]core_v1.Pod{
			{
				ObjectMeta: meta_v1.ObjectMeta{
					Name:   "test-v1-1234",
					Labels: graph.LabelsMetadata{"app": "test", "version": "v1", "datacenter": "east"},
				},
				Status: core_v1.PodStatus{
					Message: "foo"},
			},
			{
				ObjectMeta: meta_v1.ObjectMeta{
					Name:   "test-v2-1234",
					Labels: graph.LabelsMetadata{"app": "test", "version": "v2", "datacenter": "west"},
				},
				Status: core_v1.PodStatus{
					Message: "foo"},
			},
		}, nil)
	k8s.On("GetReplicationControllers", mock.AnythingOfType("string")).Return([]core_v1.ReplicationController{}, nil)
	k8s.On("GetReplicaSets", mock.AnythingOfType("string")).Return([]apps_v1.ReplicaSet{}, nil)
	k8s.On("GetStatefulSets", mock.AnythingOfType("string")).Return([]apps_v1.StatefulSet{}, nil)
	k8s.On("GetDaemonSets", mock.AnythingOfType("string")).Return([]apps_v1.DaemonSet{}, nil)

	k8s.On("GetServices", mock.AnythingOfType("string"), mock.Anything).Return([]core_v1.Service{{
		ObjectMeta: meta_v1.ObjectMeta{
			Name:   "test",
			Labels: graph.LabelsMetadata{"app": "test", "datacenter": "east"},
		},
	},
	}, nil)

	config.Set(config.NewConfig())

	businessLayer := business.NewWithBackends(k8s, nil, nil)
	return businessLayer
}

func TestLabeler(t *testing.T) {
	assert := assert.New(t)

	businessLayer := setupLabelerK8S()
	trafficMap, appNodeId, appNodeV1Id, appNodeV2Id, svcNodeId, wlNodeId := setupLabelerTrafficMap()

	assert.Equal(5, len(trafficMap))
	assert.Equal(nil, trafficMap[appNodeId].Metadata[graph.Labels])
	assert.Equal(nil, trafficMap[appNodeV1Id].Metadata[graph.Labels])
	assert.Equal(nil, trafficMap[appNodeV2Id].Metadata[graph.Labels])
	assert.Equal(nil, trafficMap[svcNodeId].Metadata[graph.Labels])
	assert.Equal(nil, trafficMap[wlNodeId].Metadata[graph.Labels])

	globalInfo := graph.NewAppenderGlobalInfo()
	globalInfo.Business = businessLayer

	a := LabelerAppender{}
	a.AppendGraph(trafficMap, globalInfo, nil)

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
