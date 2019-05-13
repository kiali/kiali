package appender

import (
	"testing"

	osapps_v1 "github.com/openshift/api/apps/v1"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	apps_v1 "k8s.io/api/apps/v1"
	batch_v1 "k8s.io/api/batch/v1"
	batch_v1beta1 "k8s.io/api/batch/v1beta1"
	core_v1 "k8s.io/api/core/v1"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/graph"
	"github.com/kiali/kiali/kubernetes/kubetest"
)

func setupWorkloads() *business.Layer {
	k8s := kubetest.NewK8SClientMock()

	k8s.On("GetCronJobs", mock.AnythingOfType("string")).Return([]batch_v1beta1.CronJob{}, nil)
	k8s.On("GetDeployments", mock.AnythingOfType("string")).Return([]apps_v1.Deployment{
		apps_v1.Deployment{
			ObjectMeta: meta_v1.ObjectMeta{
				Name: "testPodsWithTraffic-v1",
			},
			Spec: apps_v1.DeploymentSpec{
				Template: core_v1.PodTemplateSpec{
					ObjectMeta: meta_v1.ObjectMeta{
						Labels: map[string]string{"app": "testPodsWithTraffic", "version": "v1"},
					},
				},
			},
		},
		apps_v1.Deployment{
			ObjectMeta: meta_v1.ObjectMeta{
				Name: "testPodsNoTraffic-v1",
			},
			Spec: apps_v1.DeploymentSpec{
				Template: core_v1.PodTemplateSpec{
					ObjectMeta: meta_v1.ObjectMeta{
						Labels: map[string]string{"app": "testPodsNoTraffic", "version": "v1"},
					},
				},
			},
		},
		apps_v1.Deployment{
			ObjectMeta: meta_v1.ObjectMeta{
				Name: "testNoPodsWithTraffic-v1",
			},
			Spec: apps_v1.DeploymentSpec{
				Template: core_v1.PodTemplateSpec{
					ObjectMeta: meta_v1.ObjectMeta{
						Labels: map[string]string{"app": "testNoPodsWithTraffic", "version": "v1"},
					},
				},
			},
		},
		apps_v1.Deployment{
			ObjectMeta: meta_v1.ObjectMeta{
				Name: "testNoPodsNoTraffic-v1",
			},
			Spec: apps_v1.DeploymentSpec{
				Template: core_v1.PodTemplateSpec{
					ObjectMeta: meta_v1.ObjectMeta{
						Labels: map[string]string{"app": "testNoPodsNoTraffic", "version": "v1"},
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
					Name:   "testPodsWithTraffic-v1-1234",
					Labels: map[string]string{"app": "testPodsWithTraffic", "version": "v1"},
				},
				Status: core_v1.PodStatus{
					Message: "foo"},
			},
			{
				ObjectMeta: meta_v1.ObjectMeta{
					Name:   "testPodsNoTraffic-v1-1234",
					Labels: map[string]string{"app": "testPodsNoTraffic", "version": "v1"},
				},
				Status: core_v1.PodStatus{
					Message: "foo"},
			},
		}, nil)
	k8s.On("GetReplicationControllers", mock.AnythingOfType("string")).Return([]core_v1.ReplicationController{}, nil)
	k8s.On("GetReplicaSets", mock.AnythingOfType("string")).Return([]apps_v1.ReplicaSet{}, nil)
	k8s.On("GetStatefulSets", mock.AnythingOfType("string")).Return([]apps_v1.StatefulSet{}, nil)
	config.Set(config.NewConfig())

	businessLayer := business.NewWithBackends(k8s, nil)
	return businessLayer
}

func TestDeadNode(t *testing.T) {
	assert := assert.New(t)

	businessLayer := setupWorkloads()
	trafficMap := testTrafficMap()

	assert.Equal(12, len(trafficMap))
	unknownId, _ := graph.Id(graph.Unknown, "", graph.Unknown, graph.Unknown, graph.Unknown, graph.Unknown, graph.GraphTypeVersionedApp)
	unknownNode, found := trafficMap[unknownId]
	assert.Equal(true, found)
	assert.Equal(graph.Unknown, unknownNode.Workload)
	assert.Equal(10, len(unknownNode.Edges))

	ingressId, _ := graph.Id(graph.Unknown, "", "istio-system", "istio-ingressgateway", "istio-ingressgateway", graph.Unknown, graph.GraphTypeVersionedApp)
	ingressNode, found := trafficMap[ingressId]
	assert.Equal(true, found)
	assert.Equal("istio-ingressgateway", ingressNode.Workload)
	assert.Equal(10, len(ingressNode.Edges))

	globalInfo := graph.NewAppenderGlobalInfo()
	globalInfo.Business = businessLayer
	namespaceInfo := graph.NewAppenderNamespaceInfo("testNamespace")

	a := DeadNodeAppender{}
	a.AppendGraph(trafficMap, globalInfo, namespaceInfo)

	assert.Equal(9, len(trafficMap))

	_, found = trafficMap[unknownId]
	assert.Equal(false, found)

	ingressNode, found = trafficMap[ingressId]
	assert.Equal(true, found)
	assert.Equal(8, len(ingressNode.Edges))

	assert.Equal("testPodsWithTraffic-v1", ingressNode.Edges[0].Dest.Workload)
	assert.Equal("testPodsNoTraffic-v1", ingressNode.Edges[1].Dest.Workload)
	assert.Equal("testNoPodsWithTraffic-v1", ingressNode.Edges[2].Dest.Workload)
	assert.Equal("testNoPodsNoTraffic-v1", ingressNode.Edges[3].Dest.Workload)
	assert.Equal("testNoDeploymentWithTraffic-v1", ingressNode.Edges[4].Dest.Workload)
	assert.Equal("testNodeWithTcpSentTraffic-v1", ingressNode.Edges[5].Dest.Workload)
	assert.Equal("testNodeWithTcpSentOutTraffic-v1", ingressNode.Edges[6].Dest.Workload)

	id, _ := graph.Id("testNamespace", "testNoPodsNoTraffic", "testNamespace", "testNoPodsNoTraffic-v1", "testNoPodsNoTraffic", "v1", graph.GraphTypeVersionedApp)
	noPodsNoTraffic, ok := trafficMap[id]
	assert.Equal(true, ok)
	isDead, ok := noPodsNoTraffic.Metadata[graph.IsDead]
	assert.Equal(true, ok)
	assert.Equal(true, isDead)

	// Check that external services are not removed
	id, _ = graph.Id("testNamespace", "egress.io", "testNamespace", "", "", "", graph.GraphTypeVersionedApp)
	_, okExternal := trafficMap[id]
	assert.Equal(true, okExternal)
}

func testTrafficMap() map[string]*graph.Node {
	trafficMap := make(map[string]*graph.Node)

	n0 := graph.NewNode(graph.Unknown, "", graph.Unknown, graph.Unknown, graph.Unknown, graph.Unknown, graph.GraphTypeVersionedApp)

	n00 := graph.NewNode(graph.Unknown, "", "istio-system", "istio-ingressgateway", "istio-ingressgateway", graph.Unknown, graph.GraphTypeVersionedApp)
	n00.Metadata["httpOut"] = 4.8

	n1 := graph.NewNode("testNamespace", "testPodsWithTraffic", "testNamespace", "testPodsWithTraffic-v1", "testPodsWithTraffic", "v1", graph.GraphTypeVersionedApp)
	n1.Metadata["httpIn"] = 0.8

	n2 := graph.NewNode("testNamespace", "testPodsNoTraffic", "testNamespace", "testPodsNoTraffic-v1", "testPodsNoTraffic", "v1", graph.GraphTypeVersionedApp)

	n3 := graph.NewNode("testNamespace", "testNoPodsWithTraffic", "testNamespace", "testNoPodsWithTraffic-v1", "testNoPodsWithTraffic", "v1", graph.GraphTypeVersionedApp)
	n3.Metadata["httpIn"] = 0.8

	n4 := graph.NewNode("testNamespace", "testNoPodsNoTraffic", "testNamespace", "testNoPodsNoTraffic-v1", "testNoPodsNoTraffic", "v1", graph.GraphTypeVersionedApp)

	n5 := graph.NewNode("testNamespace", "testNoDeploymentWithTraffic", "testNamespace", "testNoDeploymentWithTraffic-v1", "testNoDeploymentWithTraffic", "v1", graph.GraphTypeVersionedApp)
	n5.Metadata["httpIn"] = 0.8

	n6 := graph.NewNode("testNamespace", "testNoDeploymentNoTraffic", "testNamespace", "testNoDeploymentNoTraffic-v1", "testNoDeploymentNoTraffic", "v1", graph.GraphTypeVersionedApp)

	n7 := graph.NewNode("testNamespace", "testNodeWithTcpSentTraffic", "testNamespace", "testNodeWithTcpSentTraffic-v1", "testNodeWithTcpSentTraffic", "v1", graph.GraphTypeVersionedApp)
	n7.Metadata["tcpIn"] = 74.1

	n8 := graph.NewNode("testNamespace", "testNodeWithTcpSentOutTraffic", "testNamespace", "testNodeWithTcpSentOutTraffic-v1", "testNodeWithTcpSentOutTraffic", "v1", graph.GraphTypeVersionedApp)
	n8.Metadata["tcpOut"] = 74.1

	n9 := graph.NewNode("testNamespace", "egress.io", "testNamespace", "", "", "", graph.GraphTypeVersionedApp)
	n9.Metadata["httpIn"] = 0.8
	n9.Metadata[graph.IsServiceEntry] = "MESH_EXTERNAL"

	n10 := graph.NewNode("testNamespace", "egress.not.defined", "testNamespace", "", "", "", graph.GraphTypeVersionedApp)
	n10.Metadata["httpIn"] = 0.8

	trafficMap[n0.ID] = &n0
	trafficMap[n00.ID] = &n00
	trafficMap[n1.ID] = &n1
	trafficMap[n2.ID] = &n2
	trafficMap[n3.ID] = &n3
	trafficMap[n4.ID] = &n4
	trafficMap[n5.ID] = &n5
	trafficMap[n6.ID] = &n6
	trafficMap[n7.ID] = &n7
	trafficMap[n8.ID] = &n8
	trafficMap[n9.ID] = &n9
	trafficMap[n10.ID] = &n10

	n0.AddEdge(&n1)
	e := n00.AddEdge(&n1)
	e.Metadata["http"] = 0.8

	n0.AddEdge(&n2)
	e = n00.AddEdge(&n2)
	e.Metadata["http"] = 0.8

	n0.AddEdge(&n3)
	e = n00.AddEdge(&n3)
	e.Metadata["http"] = 0.8

	n0.AddEdge(&n4)
	e = n00.AddEdge(&n4)
	e.Metadata["http"] = 0.0

	n0.AddEdge(&n5)
	e = n00.AddEdge(&n5)
	e.Metadata["http"] = 0.8

	n0.AddEdge(&n6)
	e = n00.AddEdge(&n6)
	e.Metadata["http"] = 0.0

	n0.AddEdge(&n7)
	e = n00.AddEdge(&n7)
	e.Metadata["tcp"] = 74.1

	n0.AddEdge(&n8)
	e = n00.AddEdge(&n8)
	e.Metadata["tcp"] = 74.1

	n0.AddEdge(&n9)
	e = n00.AddEdge(&n9)
	e.Metadata["http"] = 0.8

	n0.AddEdge(&n10)
	e = n00.AddEdge(&n10)
	e.Metadata["http"] = 0.8

	return trafficMap
}
