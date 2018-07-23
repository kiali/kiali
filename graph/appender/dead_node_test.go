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
)

func TestDeadNode(t *testing.T) {
	assert := assert.New(t)
	k8s := new(kubetest.K8SClientMock)

	k8s.On("GetDeployment", mock.AnythingOfType("string"), "testPodsWithTraffic-v1").Return(
		&v1beta1.Deployment{
			Spec: v1beta1.DeploymentSpec{
				Selector: &metav1.LabelSelector{
					MatchLabels: map[string]string{"app": "testPodsWithTraffic", "version": "v1"},
				},
			},
		}, nil)
	k8s.On("GetPods", mock.AnythingOfType("string"), "app=testPodsWithTraffic,version=v1").Return(
		&v1.PodList{
			Items: []v1.Pod{v1.Pod{
				Status: v1.PodStatus{
					Message: "foo",
				}},
			},
		}, nil)

	k8s.On("GetDeployment", mock.AnythingOfType("string"), "testPodsNoTraffic-v1").Return(
		&v1beta1.Deployment{
			Spec: v1beta1.DeploymentSpec{
				Selector: &metav1.LabelSelector{
					MatchLabels: map[string]string{"app": "testPodsNoTraffic", "version": "v1"},
				},
			},
		}, nil)
	k8s.On("GetPods", mock.AnythingOfType("string"), "app=testPodsNoTraffic,version=v1").Return(
		&v1.PodList{
			Items: []v1.Pod{v1.Pod{
				Status: v1.PodStatus{
					Message: "foo",
				}},
			},
		}, nil)

	k8s.On("GetDeployment", mock.AnythingOfType("string"), "testNoPodsWithTraffic-v1").Return(
		&v1beta1.Deployment{
			Spec: v1beta1.DeploymentSpec{
				Selector: &metav1.LabelSelector{
					MatchLabels: map[string]string{"app": "testNoPodsWithTraffic", "version": "v1"},
				},
			},
		}, nil)
	k8s.On("GetPods", mock.AnythingOfType("string"), "app=testNoPodsWithTraffic,version=v1").Return(
		&v1.PodList{
			Items: []v1.Pod{},
		}, nil)

	k8s.On("GetDeployment", mock.AnythingOfType("string"), "testNoPodsNoTraffic-v1").Return(
		&v1beta1.Deployment{
			Spec: v1beta1.DeploymentSpec{
				Selector: &metav1.LabelSelector{
					MatchLabels: map[string]string{"app": "testNoPodsNoTraffic", "version": "v1"},
				},
			},
		}, nil)
	k8s.On("GetPods", mock.AnythingOfType("string"), "app=testNoPodsNoTraffic,version=v1").Return(
		&v1.PodList{
			Items: []v1.Pod{},
		}, nil)

	k8s.On("GetDeployment", mock.AnythingOfType("string"), "testNoDeploymentWithTraffic-v1").Return((*v1beta1.Deployment)(nil), nil)
	k8s.On("GetDeployment", mock.AnythingOfType("string"), "testNoDeploymentNoTraffic-v1").Return((*v1beta1.Deployment)(nil), nil)

	config.Set(config.NewConfig())

	trafficMap := testTrafficMap()

	assert.Equal(7, len(trafficMap))
	unknownNode, found := trafficMap[graph.Id(graph.UnknownNamespace, graph.UnknownWorkload, graph.UnknownApp, graph.UnknownVersion, "appPreferred", true)]
	assert.Equal(true, found)
	assert.Equal(graph.UnknownWorkload, unknownNode.Workload)
	assert.Equal(6, len(unknownNode.Edges))

	applyDeadNodes(trafficMap, k8s)

	assert.Equal(6, len(trafficMap))
	unknownNode, found = trafficMap[graph.Id(graph.UnknownNamespace, graph.UnknownWorkload, graph.UnknownApp, graph.UnknownVersion, graph.GraphTypeAppPreferred, true)]
	assert.Equal(true, found)
	assert.Equal(5, len(unknownNode.Edges))

	assert.Equal("testPodsWithTraffic-v1", unknownNode.Edges[0].Dest.Workload)
	assert.Equal("testPodsNoTraffic-v1", unknownNode.Edges[1].Dest.Workload)
	assert.Equal("testNoPodsWithTraffic-v1", unknownNode.Edges[2].Dest.Workload)
	assert.Equal("testNoPodsNoTraffic-v1", unknownNode.Edges[3].Dest.Workload)
	assert.Equal("testNoDeploymentWithTraffic-v1", unknownNode.Edges[4].Dest.Workload)

	noPodsNoTraffic, ok := trafficMap[graph.Id("testNamespace", "testNoPodsNoTraffic-v1", "testNoPodsNoTraffic", "v1", graph.GraphTypeAppPreferred, true)]
	assert.Equal(true, ok)
	isDead, ok := noPodsNoTraffic.Metadata["isDead"]
	assert.Equal(true, ok)
	assert.Equal(true, isDead)
}

func testTrafficMap() map[string]*graph.Node {
	trafficMap := make(map[string]*graph.Node)

	id := graph.Id(graph.UnknownNamespace, graph.UnknownWorkload, graph.UnknownApp, graph.UnknownVersion, graph.GraphTypeAppPreferred, true)
	n0 := graph.NewNode(id, graph.UnknownNamespace, graph.UnknownWorkload, graph.UnknownApp, graph.UnknownVersion)
	n0.Metadata["rateOut"] = 2.4

	id = graph.Id("testNamespace", "testPodsWithTraffic-v1", "testPodsWithTraffic", "v1", graph.GraphTypeAppPreferred, true)
	n1 := graph.NewNode(id, "testNamespace", "testPodsWithTraffic-v1", "testPodsWithTraffic", "v1")
	n1.Metadata["rate"] = 0.8

	id = graph.Id("testNamespace", "testPodsNoTraffic-v1", "testPodsNoTraffic", "v1", graph.GraphTypeAppPreferred, true)
	n2 := graph.NewNode(id, "testNamespace", "testPodsNoTraffic-v1", "testPodsNoTraffic", "v1")

	id = graph.Id("testNamespace", "testNoPodsWithTraffic-v1", "testNoPodsWithTraffic", "v1", graph.GraphTypeAppPreferred, true)
	n3 := graph.NewNode(id, "testNamespace", "testNoPodsWithTraffic-v1", "testNoPodsWithTraffic", "v1")
	n3.Metadata["rate"] = 0.8

	id = graph.Id("testNamespace", "testNoPodsNoTraffic-v1", "testNoPodsNoTraffic", "v1", graph.GraphTypeAppPreferred, true)
	n4 := graph.NewNode(id, "testNamespace", "testNoPodsNoTraffic-v1", "testNoPodsNoTraffic", "v1")

	id = graph.Id("testNamespace", "testNoDeploymentWithTraffic-v1", "testNoDeploymentWithTraffic", "v1", graph.GraphTypeAppPreferred, true)
	n5 := graph.NewNode(id, "testNamespace", "testNoDeploymentWithTraffic-v1", "testNoDeploymentWithTraffic", "v1")
	n5.Metadata["rate"] = 0.8

	id = graph.Id("testNamespace", "testNoDeploymentNoTraffic-v1", "testNoDeploymentNoTraffic", "v1", graph.GraphTypeAppPreferred, true)
	n6 := graph.NewNode(id, "testNamespace", "testNoDeploymentNoTraffic-v1", "testNoDeploymentNoTraffic", "v1")

	trafficMap[n0.ID] = &n0
	trafficMap[n1.ID] = &n1
	trafficMap[n2.ID] = &n2
	trafficMap[n3.ID] = &n3
	trafficMap[n4.ID] = &n4
	trafficMap[n5.ID] = &n5
	trafficMap[n6.ID] = &n6

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

	return trafficMap
}
