package business_test

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	istiov1alpha1 "istio.io/api/mesh/v1alpha1"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/istio/istiotest"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/models"
)

func TestGetMeshConfigForNamespace(t *testing.T) {
	conf := config.NewConfig()
	cluster := conf.KubernetesConfig.ClusterName

	k8sclients := make(map[string]kubernetes.UserClientInterface)
	k8sclients[cluster] = kubetest.NewFakeK8sClient()
	discovery := &istiotest.FakeDiscovery{
		MeshReturn: models.Mesh{
			ControlPlanes: []models.ControlPlane{{
				Cluster: &models.KubeCluster{Name: cluster, IsKialiHome: true},
				ManagedNamespaces: []models.Namespace{
					{Name: "bookinfo"},
				},
				MeshConfig: &models.MeshConfig{
					MeshConfig: &istiov1alpha1.MeshConfig{
						DefaultServiceExportTo:         []string{"*"},
						DefaultDestinationRuleExportTo: []string{"."},
						DefaultVirtualServiceExportTo:  []string{"."},
					},
				},
			}},
		},
	}

	meshSvc := business.NewMeshService(conf, discovery, kubernetes.ConvertFromUserClients(k8sclients))

	t.Run("returns mesh config for managed namespace", func(t *testing.T) {
		meshConfig, err := meshSvc.GetMeshConfigForNamespace(cluster, "bookinfo")
		require.NoError(t, err)
		require.NotNil(t, meshConfig)
		assert.Equal(t, []string{"."}, meshConfig.DefaultVirtualServiceExportTo)
		assert.Equal(t, []string{"."}, meshConfig.DefaultDestinationRuleExportTo)
		assert.Equal(t, []string{"*"}, meshConfig.DefaultServiceExportTo)
	})

	t.Run("returns error for unmanaged namespace", func(t *testing.T) {
		meshConfig, err := meshSvc.GetMeshConfigForNamespace(cluster, "unknown")
		assert.Error(t, err)
		assert.Nil(t, meshConfig)
	})
}
