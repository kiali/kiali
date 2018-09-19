package appender

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"k8s.io/api/apps/v1beta1"
	"k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/graph"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/services/business"
)

func setupWorkloadService() business.WorkloadService {
	k8s := kubetest.NewK8SClientMock()

	k8s.On("GetDeployment", mock.AnythingOfType("string"), "testPodsWithTraffic-v1").Return(
		&v1beta1.Deployment{
			ObjectMeta: metav1.ObjectMeta{
				Name: "testPodsWithTraffic-v1",
			},
			Spec: v1beta1.DeploymentSpec{
				Template: v1.PodTemplateSpec{
					ObjectMeta: metav1.ObjectMeta{
						Labels: map[string]string{"app": "testPodsWithTraffic", "version": "v1"},
					},
				},
			},
		}, nil)
	k8s.On("GetPods", mock.AnythingOfType("string"), "app=testPodsWithTraffic,version=v1").Return(
		[]v1.Pod{v1.Pod{
			Status: v1.PodStatus{
				Message: "foo",
			}},
		}, nil)

	k8s.On("GetDeployment", mock.AnythingOfType("string"), "testPodsNoTraffic-v1").Return(
		&v1beta1.Deployment{
			ObjectMeta: metav1.ObjectMeta{
				Name: "testPodsNoTraffic-v1",
			},
			Spec: v1beta1.DeploymentSpec{
				Template: v1.PodTemplateSpec{
					ObjectMeta: metav1.ObjectMeta{
						Labels: map[string]string{"app": "testPodsNoTraffic", "version": "v1"},
					},
				},
			},
		}, nil)
	k8s.On("GetPods", mock.AnythingOfType("string"), "app=testPodsNoTraffic,version=v1").Return(
		[]v1.Pod{v1.Pod{
			Status: v1.PodStatus{
				Message: "foo",
			}},
		}, nil)

	k8s.On("GetDeployment", mock.AnythingOfType("string"), "testNoPodsWithTraffic-v1").Return(
		&v1beta1.Deployment{
			ObjectMeta: metav1.ObjectMeta{
				Name: "testNoPodsWithTraffic-v1",
			},
			Spec: v1beta1.DeploymentSpec{
				Template: v1.PodTemplateSpec{
					ObjectMeta: metav1.ObjectMeta{
						Labels: map[string]string{"app": "testNoPodsWithTraffic", "version": "v1"},
					},
				},
			},
		}, nil)
	k8s.On("GetPods", mock.AnythingOfType("string"), "app=testNoPodsWithTraffic,version=v1").Return(
		[]v1.Pod{}, nil)

	k8s.On("GetDeployment", mock.AnythingOfType("string"), "testNoPodsNoTraffic-v1").Return(
		&v1beta1.Deployment{
			ObjectMeta: metav1.ObjectMeta{
				Name: "testNoPodsNoTraffic-v1",
			},
			Spec: v1beta1.DeploymentSpec{
				Template: v1.PodTemplateSpec{
					ObjectMeta: metav1.ObjectMeta{
						Labels: map[string]string{"app": "testNoPodsNoTraffic", "version": "v1"},
					},
				},
			},
		}, nil)
	k8s.On("GetPods", mock.AnythingOfType("string"), "app=testNoPodsNoTraffic,version=v1").Return(
		[]v1.Pod{}, nil)

	k8s.On("GetDeployment", mock.AnythingOfType("string"), "testNoDeploymentWithTraffic-v1").Return((*v1beta1.Deployment)(nil), nil)
	k8s.On("GetDeployment", mock.AnythingOfType("string"), "testNoDeploymentNoTraffic-v1").Return((*v1beta1.Deployment)(nil), nil)

	config.Set(config.NewConfig())

	return business.SetWithBackends(k8s, nil).Workload
}

func TestDeadNode(t *testing.T) {
	assert := assert.New(t)

	workloadService := setupWorkloadService()
	trafficMap := testTrafficMap()

	assert.Equal(11, len(trafficMap))
	id, _ := graph.Id(graph.UnknownNamespace, graph.UnknownWorkload, graph.UnknownApp, graph.UnknownVersion, "", graph.GraphTypeVersionedApp)
	unknownNode, found := trafficMap[id]
	assert.Equal(true, found)
	assert.Equal(graph.UnknownWorkload, unknownNode.Workload)
	assert.Equal(10, len(unknownNode.Edges))

	applyDeadNodes(trafficMap, workloadService, map[string]bool{
		"localhost.local": true,
		"egress.io":       true})

	assert.Equal(9, len(trafficMap))
	unknownNode, found = trafficMap[id]
	assert.Equal(true, found)
	assert.Equal(8, len(unknownNode.Edges))

	assert.Equal("testPodsWithTraffic-v1", unknownNode.Edges[0].Dest.Workload)
	assert.Equal("testPodsNoTraffic-v1", unknownNode.Edges[1].Dest.Workload)
	assert.Equal("testNoPodsWithTraffic-v1", unknownNode.Edges[2].Dest.Workload)
	assert.Equal("testNoPodsNoTraffic-v1", unknownNode.Edges[3].Dest.Workload)
	assert.Equal("testNoDeploymentWithTraffic-v1", unknownNode.Edges[4].Dest.Workload)
	assert.Equal("testNodeWithTcpSentTraffic-v1", unknownNode.Edges[5].Dest.Workload)
	assert.Equal("testNodeWithTcpSentOutTraffic-v1", unknownNode.Edges[6].Dest.Workload)

	id, _ = graph.Id("testNamespace", "testNoPodsNoTraffic-v1", "testNoPodsNoTraffic", "v1", "testNoPodsNoTraffic", graph.GraphTypeVersionedApp)
	noPodsNoTraffic, ok := trafficMap[id]
	assert.Equal(true, ok)
	isDead, ok := noPodsNoTraffic.Metadata["isDead"]
	assert.Equal(true, ok)
	assert.Equal(true, isDead)

	// Check that external services are flagged
	id, _ = graph.Id("testNamespace", "", "", "", "egress.io", graph.GraphTypeVersionedApp)
	externalNode, okExternal := trafficMap[id]
	assert.Equal(true, okExternal)
	assert.Equal(true, externalNode.Metadata["isEgress"])
}

func testTrafficMap() map[string]*graph.Node {
	trafficMap := make(map[string]*graph.Node)

	n0 := graph.NewNode(graph.UnknownNamespace, graph.UnknownWorkload, graph.UnknownApp, graph.UnknownVersion, "", graph.GraphTypeVersionedApp)
	n0.Metadata["rateOut"] = 2.4

	n1 := graph.NewNode("testNamespace", "testPodsWithTraffic-v1", "testPodsWithTraffic", "v1", "testPodsWithTraffic", graph.GraphTypeVersionedApp)
	n1.Metadata["rate"] = 0.8

	n2 := graph.NewNode("testNamespace", "testPodsNoTraffic-v1", "testPodsNoTraffic", "v1", "testPodsNoTraffic", graph.GraphTypeVersionedApp)

	n3 := graph.NewNode("testNamespace", "testNoPodsWithTraffic-v1", "testNoPodsWithTraffic", "v1", "testNoPodsWithTraffic", graph.GraphTypeVersionedApp)
	n3.Metadata["rate"] = 0.8

	n4 := graph.NewNode("testNamespace", "testNoPodsNoTraffic-v1", "testNoPodsNoTraffic", "v1", "testNoPodsNoTraffic", graph.GraphTypeVersionedApp)

	n5 := graph.NewNode("testNamespace", "testNoDeploymentWithTraffic-v1", "testNoDeploymentWithTraffic", "v1", "testNoDeploymentWithTraffic", graph.GraphTypeVersionedApp)
	n5.Metadata["rate"] = 0.8

	n6 := graph.NewNode("testNamespace", "testNoDeploymentNoTraffic-v1", "testNoDeploymentNoTraffic", "v1", "testNoDeploymentNoTraffic", graph.GraphTypeVersionedApp)

	n7 := graph.NewNode("testNamespace", "testNodeWithTcpSentTraffic-v1", "testNodeWithTcpSentTraffic", "v1", "testNodeWithTcpSentTraffic", graph.GraphTypeVersionedApp)
	n7.Metadata["tcpSentRate"] = 74.1

	n8 := graph.NewNode("testNamespace", "testNodeWithTcpSentOutTraffic-v1", "testNodeWithTcpSentOutTraffic", "v1", "testNodeWithTcpSentOutTraffic", graph.GraphTypeVersionedApp)
	n8.Metadata["tcpSentRateOut"] = 74.1

	n9 := graph.NewNode("testNamespace", "", "", "", "egress.io", graph.GraphTypeVersionedApp)
	n9.Metadata["rate"] = 0.8

	n10 := graph.NewNode("testNamespace", "", "", "", "egress.not.defined", graph.GraphTypeVersionedApp)
	n10.Metadata["rate"] = 0.8

	trafficMap[n0.ID] = &n0
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

	e := n0.AddEdge(&n1)
	e.Metadata["rate"] = 0.8

	e = n0.AddEdge(&n2)
	e.Metadata["rate"] = 0.0

	e = n0.AddEdge(&n3)
	e.Metadata["rate"] = 0.8

	e = n0.AddEdge(&n4)
	e.Metadata["rate"] = 0.0

	e = n0.AddEdge(&n5)
	e.Metadata["rate"] = 0.8

	e = n0.AddEdge(&n6)
	e.Metadata["rate"] = 0.0

	e = n0.AddEdge(&n7)
	e.Metadata["tcpSentRate"] = 74.1

	e = n0.AddEdge(&n8)
	e.Metadata["tcpSentRate"] = 74.1

	e = n0.AddEdge(&n9)
	e.Metadata["rate"] = 0.8

	e = n0.AddEdge(&n10)
	e.Metadata["rate"] = 0.8

	return trafficMap
}
