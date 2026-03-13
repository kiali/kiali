package business_test

import (
	"context"
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

func TestGetMesh(t *testing.T) {
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

	t.Run("returns mesh", func(t *testing.T) {
		mesh, err := meshSvc.GetMesh(context.TODO())
		require.NoError(t, err)
		require.NotNil(t, mesh)
		require.Len(t, mesh.ControlPlanes, 1)
	})

	t.Run("BuildNamespaceToMeshConfig returns config for managed namespace", func(t *testing.T) {
		mesh, err := meshSvc.GetMesh(context.TODO())
		require.NoError(t, err)

		nsMeshConfigs := mesh.BuildNamespaceToMeshConfig(cluster, []string{"bookinfo"})
		require.NotNil(t, nsMeshConfigs)

		mc, ok := nsMeshConfigs["bookinfo"]
		require.True(t, ok)
		assert.Equal(t, []string{"."}, mc.DefaultVirtualServiceExportTo)
		assert.Equal(t, []string{"."}, mc.DefaultDestinationRuleExportTo)
		assert.Equal(t, []string{"*"}, mc.DefaultServiceExportTo)
	})

	t.Run("BuildNamespaceToMeshConfig skips unmanaged namespace", func(t *testing.T) {
		mesh, err := meshSvc.GetMesh(context.TODO())
		require.NoError(t, err)

		nsMeshConfigs := mesh.BuildNamespaceToMeshConfig(cluster, []string{"unknown"})
		require.NotNil(t, nsMeshConfigs)
		assert.Empty(t, nsMeshConfigs)
	})

	t.Run("BuildNamespaceToExportTo returns DefaultServiceExportTo", func(t *testing.T) {
		mesh, err := meshSvc.GetMesh(context.TODO())
		require.NoError(t, err)

		nsExportTo := mesh.BuildNamespaceToExportTo(cluster, []string{"bookinfo"})
		require.NotNil(t, nsExportTo)

		exportTo, ok := nsExportTo["bookinfo"]
		require.True(t, ok)
		assert.Equal(t, []string{"*"}, exportTo)
	})
}
