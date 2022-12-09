package cache

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apps_v1 "k8s.io/api/apps/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
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
	kialiCache := newTestKialiCache(kubetest.NewFakeK8sClient(d))
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

// Tests that when a refresh happens, the new cache must fully load before the
// new object is returned.
func TestConcurrentAccessDuringRefresh(t *testing.T) {
	require := require.New(t)
	d := &apps_v1.Deployment{
		ObjectMeta: metav1.ObjectMeta{
			Name: "deployment", Namespace: "test",
		},
	}

	kialiCache := newTestKialiCache(kubetest.NewFakeK8sClient(d))
	// Prime the pump with a first Refresh.
	kialiCache.Refresh("test")

	stop := make(chan bool)
	go func() {
		for {
			select {
			case <-stop:
				return
			default:
				_, err := kialiCache.GetDeployment(d.Namespace, d.Name)
				require.NoError(err)
			}
		}
	}()

	kialiCache.Refresh("test")
	close(stop)
}
