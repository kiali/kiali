package cache

import (
	"testing"

	"github.com/stretchr/testify/assert"
	apps_v1 "k8s.io/api/apps/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	"github.com/kiali/kiali/kubernetes"
)

// Other parts of the codebase assume that this kind field is present so it's important
// that the cache sets it.
func TestKubeGetAndListReturnKindInfo(t *testing.T) {
	assert := assert.New(t)
	d := &apps_v1.Deployment{
		ObjectMeta: metav1.ObjectMeta{
			Name: "deployment", Namespace: "test",
		},
	}
	kialiCache := newTestKialiCache([]runtime.Object{d}, nil, nil)
	kialiCache.Refresh("test")

	deploymentFromCache, err := kialiCache.GetDeployment("test", "deployment")
	assert.NoError(err)
	assert.Equal(kubernetes.DeploymentType, deploymentFromCache.Kind)

	deploymentListFromCache, err := kialiCache.GetDeployments("test")
	assert.NoError(err)
	for _, deployment := range deploymentListFromCache {
		assert.Equal(kubernetes.DeploymentType, deployment.Kind)
	}
}
