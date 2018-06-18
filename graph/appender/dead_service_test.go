package appender

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/graph"
	"github.com/kiali/kiali/kubernetes/kubetest"
)

func TestDeadService(t *testing.T) {
	assert := assert.New(t)
	k8s := new(kubetest.K8SClientMock)

	k8s.On("GetService", mock.AnythingOfType("string"), "testPodsWithTraffic").Return(
		&v1.Service{
			TypeMeta: metav1.TypeMeta{
				Kind: "foo",
			},
		}, nil)
	k8s.On("GetServicePods", mock.AnythingOfType("string"), "testPodsWithTraffic", "v1").Return(
		&v1.PodList{
			Items: []v1.Pod{v1.Pod{
				Status: v1.PodStatus{
					Message: "foo",
				}},
			},
		}, nil)

	k8s.On("GetService", mock.AnythingOfType("string"), "testPodsNoTraffic").Return(
		&v1.Service{
			TypeMeta: metav1.TypeMeta{
				Kind: "foo",
			},
		}, nil)
	k8s.On("GetServicePods", mock.AnythingOfType("string"), "testPodsNoTraffic", "v1").Return(
		&v1.PodList{
			Items: []v1.Pod{v1.Pod{
				Status: v1.PodStatus{
					Message: "foo",
				}},
			},
		}, nil)

	k8s.On("GetService", mock.AnythingOfType("string"), "testNoPodsWithTraffic").Return(
		&v1.Service{
			TypeMeta: metav1.TypeMeta{
				Kind: "foo",
			},
		}, nil)
	k8s.On("GetServicePods", mock.AnythingOfType("string"), "testNoPodsWithTraffic", "v1").Return(
		&v1.PodList{
			Items: []v1.Pod{},
		}, nil)

	k8s.On("GetService", mock.AnythingOfType("string"), "testNoPodsNoTraffic").Return(
		&v1.Service{
			TypeMeta: metav1.TypeMeta{
				Kind: "foo",
			},
		}, nil)
	k8s.On("GetServicePods", mock.AnythingOfType("string"), "testNoPodsNoTraffic", "v1").Return(
		&v1.PodList{
			Items: []v1.Pod{},
		}, nil)

	k8s.On("GetService", mock.AnythingOfType("string"), "testNoServiceWithTraffic").Return((*v1.Service)(nil), nil)
	k8s.On("GetService", mock.AnythingOfType("string"), "testNoServiceNoTraffic").Return((*v1.Service)(nil), nil)

	config.Set(config.NewConfig())

	trafficMap := testTrafficMap()

	assert.Equal(7, len(trafficMap))
	unknownService, found := trafficMap[graph.Id(graph.UnknownService, graph.UnknownVersion)]
	assert.Equal(true, found)
	assert.Equal(graph.UnknownService, unknownService.Name)
	assert.Equal(6, len(unknownService.Edges))

	applyDeadServices(trafficMap, k8s)

	assert.Equal(6, len(trafficMap))
	unknownService, found = trafficMap[graph.Id(graph.UnknownService, graph.UnknownVersion)]
	assert.Equal(true, found)
	assert.Equal(5, len(unknownService.Edges))

	assert.Equal("testPodsWithTraffic.testNamespace.svc.cluster.local", unknownService.Edges[0].Dest.Name)
	assert.Equal("testPodsNoTraffic.testNamespace.svc.cluster.local", unknownService.Edges[1].Dest.Name)
	assert.Equal("testNoPodsWithTraffic.testNamespace.svc.cluster.local", unknownService.Edges[2].Dest.Name)
	assert.Equal("testNoPodsNoTraffic.testNamespace.svc.cluster.local", unknownService.Edges[3].Dest.Name)
	assert.Equal("testNoServiceWithTraffic.testNamespace.svc.cluster.local", unknownService.Edges[4].Dest.Name)

	noPodsNoTraffic, ok := trafficMap[graph.Id("testNoPodsNoTraffic.testNamespace.svc.cluster.local", "v1")]
	assert.Equal(true, ok)
	isDead, ok := noPodsNoTraffic.Metadata["isDead"]
	assert.Equal(true, ok)
	assert.Equal(true, isDead)
}

func testTrafficMap() map[string]*graph.ServiceNode {
	trafficMap := make(map[string]*graph.ServiceNode)

	s0 := graph.NewServiceNode(graph.UnknownService, graph.UnknownVersion)
	s0.Metadata["rateOut"] = 2.4
	s1 := graph.NewServiceNode("testPodsWithTraffic.testNamespace.svc.cluster.local", "v1")
	s1.Metadata["rateIn"] = 0.8
	s2 := graph.NewServiceNode("testPodsNoTraffic.testNamespace.svc.cluster.local", "v1")
	s3 := graph.NewServiceNode("testNoPodsWithTraffic.testNamespace.svc.cluster.local", "v1")
	s3.Metadata["rateIn"] = 0.8
	s4 := graph.NewServiceNode("testNoPodsNoTraffic.testNamespace.svc.cluster.local", "v1")
	s5 := graph.NewServiceNode("testNoServiceWithTraffic.testNamespace.svc.cluster.local", "v1")
	s5.Metadata["rateIn"] = 0.8
	s6 := graph.NewServiceNode("testNoServiceNoTraffic.testNamespace.svc.cluster.local", "v1")
	trafficMap[s0.ID] = &s0
	trafficMap[s1.ID] = &s1
	trafficMap[s2.ID] = &s2
	trafficMap[s3.ID] = &s3
	trafficMap[s4.ID] = &s4
	trafficMap[s5.ID] = &s5
	trafficMap[s6.ID] = &s6

	e := s0.AddEdge(&s1)
	e.Metadata["rate"] = 0.8

	e = s0.AddEdge(&s2)
	e.Metadata["rate"] = 0.0

	e = s0.AddEdge(&s3)
	e.Metadata["rate"] = 0.8

	e = s0.AddEdge(&s4)
	e.Metadata["rate"] = 0.0

	e = s0.AddEdge(&s5)
	e.Metadata["rate"] = 0.8

	e = s0.AddEdge(&s6)
	e.Metadata["rate"] = 0.0

	return trafficMap
}
