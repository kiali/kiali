package handlers

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"k8s.io/api/apps/v1beta1"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/graph/tree"
)

func TestNonTrafficScenario(t *testing.T) {
	assert := assert.New(t)

	config.Set(config.NewConfig())

	// Empty trees
	trees := make([]tree.ServiceNode, 0)
	deployments := mockDeploments()

	addUnusedNodes(&trees, "testNamespace", deployments)

	assert.Equal(4, len(trees))

	assert.Equal("customer.testNamespace.svc.cluster.local", trees[0].Name)
	assert.Equal(float64(-1), trees[0].Metadata["rate"])

	assert.Equal("preference.testNamespace.svc.cluster.local", trees[1].Name)
	assert.Equal(float64(-1), trees[1].Metadata["rate"])

	assert.Equal("recommendation.testNamespace.svc.cluster.local", trees[2].Name)
	assert.Equal("v1", trees[2].Version)
	assert.Equal(float64(-1), trees[2].Metadata["rate"])

	assert.Equal("recommendation.testNamespace.svc.cluster.local", trees[3].Name)
	assert.Equal("v2", trees[3].Version)
	assert.Equal(float64(-1), trees[3].Metadata["rate"])
}

func TestOneNodeTrafficScenario(t *testing.T) {
	assert := assert.New(t)

	config.Set(config.NewConfig())

	trees := oneNodeTraffic()
	deployments := mockDeploments()

	addUnusedNodes(&trees, "testNamespace", deployments)

	assert.Equal(4, len(trees))
	assert.Equal(tree.UnknownService, trees[0].Name)
	assert.Equal(1, len(trees[0].Children))

	assert.Equal("customer.testNamespace.svc.cluster.local", trees[0].Children[0].Name)
	assert.Equal(float64(0.8), trees[0].Children[0].Metadata["rate"])

	assert.Equal("preference.testNamespace.svc.cluster.local", trees[1].Name)
	assert.Equal(float64(-1), trees[1].Metadata["rate"])

	assert.Equal("recommendation.testNamespace.svc.cluster.local", trees[2].Name)
	assert.Equal("v1", trees[2].Version)
	assert.Equal(float64(-1), trees[2].Metadata["rate"])

	assert.Equal("recommendation.testNamespace.svc.cluster.local", trees[3].Name)
	assert.Equal("v2", trees[3].Version)
	assert.Equal(float64(-1), trees[3].Metadata["rate"])
}

func TestVersionWithNoTrafficScenario(t *testing.T) {
	assert := assert.New(t)

	config.Set(config.NewConfig())

	trees := v1Traffic()
	deployments := mockDeploments()

	addUnusedNodes(&trees, "testNamespace", deployments)

	assert.Equal(1, len(trees))
	assert.Equal(tree.UnknownService, trees[0].Name)
	assert.Equal(1, len(trees[0].Children))

	customer := trees[0].Children[0]
	assert.Equal("customer.testNamespace.svc.cluster.local", customer.Name)
	assert.Equal(float64(0.8), customer.Metadata["rate"])
	assert.Equal(1, len(customer.Children))

	preference := customer.Children[0]
	assert.Equal("preference.testNamespace.svc.cluster.local", preference.Name)
	assert.Equal(float64(0.8), preference.Metadata["rate"])

	assert.Equal(2, len(preference.Children))
	recommendationV1 := preference.Children[0]
	assert.Equal("recommendation.testNamespace.svc.cluster.local", recommendationV1.Name)
	assert.Equal("v1", recommendationV1.Version)
	assert.Equal(float64(0.8), recommendationV1.Metadata["rate"])

	recommendationV2 := preference.Children[1]
	assert.Equal("recommendation.testNamespace.svc.cluster.local", recommendationV2.Name)
	assert.Equal("v2", recommendationV2.Version)
	assert.Equal(float64(-1), recommendationV2.Metadata["rate"])
}

func mockDeploments() *v1beta1.DeploymentList {
	deployments := v1beta1.DeploymentList{
		Items: []v1beta1.Deployment{
			{
				ObjectMeta: meta_v1.ObjectMeta{
					Name:   "customer-v1",
					Labels: map[string]string{"app": "customer", "version": "v1"},
				},
			},
			{
				ObjectMeta: meta_v1.ObjectMeta{
					Name:   "preference-v1",
					Labels: map[string]string{"app": "preference", "version": "v1"},
				},
			},
			{
				ObjectMeta: meta_v1.ObjectMeta{
					Name:   "recommendation-v1",
					Labels: map[string]string{"app": "recommendation", "version": "v1"},
				},
			},
			{
				ObjectMeta: meta_v1.ObjectMeta{
					Name:   "recommendation-v2",
					Labels: map[string]string{"app": "recommendation", "version": "v2"},
				},
			},
		},
	}

	return &deployments
}

func oneNodeTraffic() []tree.ServiceNode {
	trees := make([]tree.ServiceNode, 1)

	trees[0] = tree.NewServiceNode(tree.UnknownService, tree.UnknownVersion)
	trees[0].Children = make([]*tree.ServiceNode, 1)
	child := tree.NewServiceNode("customer.testNamespace.svc.cluster.local", "v1")
	child.Metadata = make(map[string]interface{})
	child.Metadata["rate"] = 0.8
	child.Metadata["source_svc"] = tree.UnknownService
	child.Metadata["source_ver"] = tree.UnknownVersion
	trees[0].Children[0] = &child

	return trees
}

func v1Traffic() []tree.ServiceNode {
	trees := make([]tree.ServiceNode, 1)

	trees[0] = tree.NewServiceNode(tree.UnknownService, tree.UnknownVersion)
	trees[0].Children = make([]*tree.ServiceNode, 1)
	customer := tree.NewServiceNode("customer.testNamespace.svc.cluster.local", "v1")
	customer.Metadata = make(map[string]interface{})
	customer.Metadata["rate"] = 0.8
	customer.Metadata["source_svc"] = tree.UnknownService
	customer.Metadata["source_ver"] = tree.UnknownVersion
	trees[0].Children[0] = &customer

	preference := tree.NewServiceNode("preference.testNamespace.svc.cluster.local", "v1")
	preference.Metadata = make(map[string]interface{})
	preference.Metadata["rate"] = 0.8
	preference.Metadata["source_svc"] = "customer.testNamespace.svc.cluster.local"
	preference.Metadata["source_ver"] = tree.UnknownVersion
	customer.Children = make([]*tree.ServiceNode, 1)
	customer.Children[0] = &preference

	recommendation := tree.NewServiceNode("recommendation.testNamespace.svc.cluster.local", "v1")
	recommendation.Metadata = make(map[string]interface{})
	recommendation.Metadata["rate"] = 0.8
	recommendation.Metadata["source_svc"] = "preference.testNamespace.svc.cluster.local"
	recommendation.Metadata["source_ver"] = tree.UnknownVersion
	preference.Children = make([]*tree.ServiceNode, 1)
	preference.Children[0] = &recommendation

	return trees
}
