package appender

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/graph/tree"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/prometheus/prometheustest"
	"github.com/kiali/kiali/services/business"
)

func TestDeadService(t *testing.T) {
	assert := assert.New(t)
	k8s := new(kubetest.K8SClientMock)
	prom := new(prometheustest.PromClientMock)
	business.SetWithBackends(k8s, prom)

	k8s.On("GetService", mock.AnythingOfType("string"), "testPodsWithTraffic").Return(
		&v1.Service{
			TypeMeta: metav1.TypeMeta{
				Kind: "foo",
			},
		}, nil)
	k8s.On("GetServicePods", mock.AnythingOfType("string"), "testPodsWithTraffic", "v1", "").Return(
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
	k8s.On("GetServicePods", mock.AnythingOfType("string"), "testPodsNoTraffic", "v1", "").Return(
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
	k8s.On("GetServicePods", mock.AnythingOfType("string"), "testNoPodsWithTraffic", "v1", "").Return(
		&v1.PodList{
			Items: []v1.Pod{},
		}, nil)

	k8s.On("GetService", mock.AnythingOfType("string"), "testNoPodsNoTraffic").Return(
		&v1.Service{
			TypeMeta: metav1.TypeMeta{
				Kind: "foo",
			},
		}, nil)
	k8s.On("GetServicePods", mock.AnythingOfType("string"), "testNoPodsNoTraffic", "v1", "").Return(
		&v1.PodList{
			Items: []v1.Pod{},
		}, nil)

	k8s.On("GetService", mock.AnythingOfType("string"), "testNoServiceWithTraffic").Return((*v1.Service)(nil), nil)
	k8s.On("GetService", mock.AnythingOfType("string"), "testNoServiceNoTraffic").Return((*v1.Service)(nil), nil)

	config.Set(config.NewConfig())

	trees := testTree()

	assert.Equal(1, len(trees))
	assert.Equal(tree.UnknownService, trees[0].Name)
	assert.Equal(6, len(trees[0].Children))

	applyDeadServices(&trees[0], "testNamespace", k8s)

	assert.Equal(1, len(trees))
	assert.Equal(tree.UnknownService, trees[0].Name)
	assert.Equal(5, len(trees[0].Children))

	assert.Equal("testPodsWithTraffic.testNamespace.svc.cluster.local", trees[0].Children[0].Name)
	assert.Equal("testPodsNoTraffic.testNamespace.svc.cluster.local", trees[0].Children[1].Name)
	assert.Equal("testNoPodsWithTraffic.testNamespace.svc.cluster.local", trees[0].Children[2].Name)
	assert.Equal("testNoPodsNoTraffic.testNamespace.svc.cluster.local", trees[0].Children[3].Name)
	isDead, ok := trees[0].Children[3].Metadata["isDead"]
	assert.Equal(true, ok)
	assert.Equal("true", isDead)
	assert.Equal("testNoServiceWithTraffic.testNamespace.svc.cluster.local", trees[0].Children[4].Name)
}

func testTree() []tree.ServiceNode {
	trees := make([]tree.ServiceNode, 1)

	trees[0] = tree.NewServiceNode(tree.UnknownService, tree.UnknownVersion)
	trees[0].Children = make([]*tree.ServiceNode, 6)

	child0 := tree.NewServiceNode("testPodsWithTraffic.testNamespace.svc.cluster.local", "v1")
	child0.Metadata = make(map[string]interface{})
	child0.Metadata["rate"] = 0.8
	trees[0].Children[0] = &child0

	child1 := tree.NewServiceNode("testPodsNoTraffic.testNamespace.svc.cluster.local", "v1")
	child1.Metadata = make(map[string]interface{})
	child1.Metadata["rate"] = 0.0
	trees[0].Children[1] = &child1

	child2 := tree.NewServiceNode("testNoPodsWithTraffic.testNamespace.svc.cluster.local", "v1")
	child2.Metadata = make(map[string]interface{})
	child2.Metadata["rate"] = 0.8
	trees[0].Children[2] = &child2

	child3 := tree.NewServiceNode("testNoPodsNoTraffic.testNamespace.svc.cluster.local", "v1")
	child3.Metadata = make(map[string]interface{})
	child3.Metadata["rate"] = 0.0
	trees[0].Children[3] = &child3

	child4 := tree.NewServiceNode("testNoServiceWithTraffic.testNamespace.svc.cluster.local", "v1")
	child4.Metadata = make(map[string]interface{})
	child4.Metadata["rate"] = 0.8
	trees[0].Children[4] = &child4

	child5 := tree.NewServiceNode("testNoServiceNoTraffic.testNamespace.svc.cluster.local", "v1")
	child5.Metadata = make(map[string]interface{})
	child5.Metadata["rate"] = 0.0
	trees[0].Children[5] = &child5

	return trees
}
