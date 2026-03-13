package models_test

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	istiov1alpha1 "istio.io/api/mesh/v1alpha1"

	"github.com/kiali/kiali/models"
)

func TestControlPlaneForNamespace(t *testing.T) {
	cluster := "Kubernetes"

	t.Run("single control plane single cluster", func(t *testing.T) {
		mesh := models.Mesh{
			ControlPlanes: []models.ControlPlane{{
				Cluster:         &models.KubeCluster{Name: cluster, IsKialiHome: true},
				ManagedClusters: []*models.KubeCluster{{Name: cluster}},
				ManagedNamespaces: []models.Namespace{
					{Name: "bookinfo", Cluster: ""},
					{Name: "default", Cluster: ""},
				},
			}},
		}
		cp, err := mesh.ControlPlaneForNamespace(cluster, "bookinfo")
		require.NoError(t, err)
		require.NotNil(t, cp)
		assert.Equal(t, cluster, cp.Cluster.Name)
		cp, err = mesh.ControlPlaneForNamespace(cluster, "default")
		require.NoError(t, err)
		require.NotNil(t, cp)
	})

	t.Run("multi-primary different ManagedNamespaces", func(t *testing.T) {
		mesh := models.Mesh{
			ControlPlanes: []models.ControlPlane{
				{
					Cluster:           &models.KubeCluster{Name: cluster, IsKialiHome: true},
					ManagedClusters:   []*models.KubeCluster{{Name: cluster}},
					ManagedNamespaces: []models.Namespace{{Name: "bookinfo", Cluster: ""}},
				},
				{
					Cluster:           &models.KubeCluster{Name: cluster, IsKialiHome: false},
					ManagedClusters:   []*models.KubeCluster{{Name: cluster}},
					ManagedNamespaces: []models.Namespace{{Name: "bookinfo2", Cluster: ""}},
				},
			},
		}
		cp1, err := mesh.ControlPlaneForNamespace(cluster, "bookinfo")
		require.NoError(t, err)
		cp2, err := mesh.ControlPlaneForNamespace(cluster, "bookinfo2")
		require.NoError(t, err)
		require.NotNil(t, cp1)
		require.NotNil(t, cp2)
		assert.NotSame(t, cp1, cp2)
		assert.True(t, cp1.Cluster.IsKialiHome, "bookinfo should be managed by the Kiali-home CP")
		assert.False(t, cp2.Cluster.IsKialiHome, "bookinfo2 should be managed by the non-home CP")
		assert.Equal(t, "bookinfo", cp1.ManagedNamespaces[0].Name)
		assert.Equal(t, "bookinfo2", cp2.ManagedNamespaces[0].Name)
	})

	t.Run("primary-remote two clusters", func(t *testing.T) {
		mesh := models.Mesh{
			ControlPlanes: []models.ControlPlane{{
				Cluster: &models.KubeCluster{Name: cluster, IsKialiHome: true},
				ManagedClusters: []*models.KubeCluster{
					{Name: cluster},
					{Name: "west"},
				},
				ManagedNamespaces: []models.Namespace{
					{Name: "bookinfo", Cluster: ""},
					{Name: "bookinfo", Cluster: "west"},
				},
			}},
		}
		cp, err := mesh.ControlPlaneForNamespace(cluster, "bookinfo")
		require.NoError(t, err)
		require.NotNil(t, cp)
		cpWest, err := mesh.ControlPlaneForNamespace("west", "bookinfo")
		require.NoError(t, err)
		require.NotNil(t, cpWest)
		assert.Same(t, cp.Cluster, cpWest.Cluster)
	})

	t.Run("returns error when ManagedNamespaces empty", func(t *testing.T) {
		mesh := models.Mesh{
			ControlPlanes: []models.ControlPlane{
				{
					Cluster:           &models.KubeCluster{Name: cluster, IsKialiHome: false},
					ManagedClusters:   []*models.KubeCluster{{Name: cluster}},
					ManagedNamespaces: []models.Namespace{},
				},
				{
					Cluster:           &models.KubeCluster{Name: cluster, IsKialiHome: true},
					ManagedClusters:   []*models.KubeCluster{{Name: cluster}},
					ManagedNamespaces: []models.Namespace{},
				},
			},
		}
		cp, err := mesh.ControlPlaneForNamespace(cluster, "bookinfo")
		assert.Error(t, err)
		assert.Nil(t, cp)
	})

	t.Run("unknown cluster returns error", func(t *testing.T) {
		mesh := models.Mesh{
			ControlPlanes: []models.ControlPlane{{
				Cluster:         &models.KubeCluster{Name: cluster},
				ManagedClusters: []*models.KubeCluster{{Name: cluster}},
			}},
		}
		cp, err := mesh.ControlPlaneForNamespace("unknown-cluster", "bookinfo")
		assert.Error(t, err)
		assert.Nil(t, cp)
	})

	t.Run("matches IstiodNamespace", func(t *testing.T) {
		mesh := models.Mesh{
			ControlPlanes: []models.ControlPlane{{
				Cluster:           &models.KubeCluster{Name: cluster},
				IstiodNamespace:   "istio-system",
				ManagedNamespaces: []models.Namespace{},
			}},
		}
		cp, err := mesh.ControlPlaneForNamespace(cluster, "istio-system")
		require.NoError(t, err)
		require.NotNil(t, cp)
		assert.Equal(t, "istio-system", cp.IstiodNamespace)
	})

	t.Run("matches RootNamespace", func(t *testing.T) {
		mesh := models.Mesh{
			ControlPlanes: []models.ControlPlane{{
				Cluster:           &models.KubeCluster{Name: cluster},
				IstiodNamespace:   "istio-system",
				RootNamespace:     "istio-root",
				ManagedNamespaces: []models.Namespace{},
			}},
		}
		cp, err := mesh.ControlPlaneForNamespace(cluster, "istio-root")
		require.NoError(t, err)
		require.NotNil(t, cp)
		assert.Equal(t, "istio-root", cp.RootNamespace)
	})
}

func TestBuildNamespaceToMeshConfig(t *testing.T) {
	cluster := "Kubernetes"
	meshConfig := &models.MeshConfig{
		MeshConfig: &istiov1alpha1.MeshConfig{
			DefaultServiceExportTo:         []string{"*"},
			DefaultDestinationRuleExportTo: []string{"."},
			DefaultVirtualServiceExportTo:  []string{"."},
		},
	}

	mesh := &models.Mesh{
		ControlPlanes: []models.ControlPlane{{
			Cluster:           &models.KubeCluster{Name: cluster},
			IstiodNamespace:   "istio-system",
			ManagedNamespaces: []models.Namespace{{Name: "bookinfo"}, {Name: "travel"}},
			MeshConfig:        meshConfig,
		}},
	}

	t.Run("returns config for managed namespaces", func(t *testing.T) {
		result := mesh.BuildNamespaceToMeshConfig(cluster, []string{"bookinfo", "travel"})
		require.Len(t, result, 2)
		assert.Equal(t, meshConfig, result["bookinfo"])
		assert.Equal(t, meshConfig, result["travel"])
	})

	t.Run("skips unmanaged namespaces", func(t *testing.T) {
		result := mesh.BuildNamespaceToMeshConfig(cluster, []string{"bookinfo", "unknown"})
		require.Len(t, result, 1)
		assert.Equal(t, meshConfig, result["bookinfo"])
	})

	t.Run("deduplicates namespaces", func(t *testing.T) {
		result := mesh.BuildNamespaceToMeshConfig(cluster, []string{"bookinfo", "bookinfo", "bookinfo"})
		require.Len(t, result, 1)
		assert.Equal(t, meshConfig, result["bookinfo"])
	})

	t.Run("includes IstiodNamespace", func(t *testing.T) {
		result := mesh.BuildNamespaceToMeshConfig(cluster, []string{"istio-system"})
		require.Len(t, result, 1)
		assert.Equal(t, meshConfig, result["istio-system"])
	})

	t.Run("nil mesh returns empty map", func(t *testing.T) {
		var nilMesh *models.Mesh
		result := nilMesh.BuildNamespaceToMeshConfig(cluster, []string{"bookinfo"})
		assert.NotNil(t, result)
		assert.Empty(t, result)
	})

	t.Run("nil MeshConfig in control plane is skipped", func(t *testing.T) {
		m := &models.Mesh{
			ControlPlanes: []models.ControlPlane{{
				Cluster:           &models.KubeCluster{Name: cluster},
				ManagedNamespaces: []models.Namespace{{Name: "bookinfo"}},
				MeshConfig:        nil,
			}},
		}
		result := m.BuildNamespaceToMeshConfig(cluster, []string{"bookinfo"})
		assert.Empty(t, result)
	})
}

func TestBuildNamespaceToExportTo(t *testing.T) {
	cluster := "Kubernetes"
	meshConfig := &models.MeshConfig{
		MeshConfig: &istiov1alpha1.MeshConfig{
			DefaultServiceExportTo: []string{"*"},
		},
	}

	mesh := &models.Mesh{
		ControlPlanes: []models.ControlPlane{{
			Cluster:           &models.KubeCluster{Name: cluster},
			ManagedNamespaces: []models.Namespace{{Name: "bookinfo"}},
			MeshConfig:        meshConfig,
		}},
	}

	t.Run("returns DefaultServiceExportTo for managed namespaces", func(t *testing.T) {
		result := mesh.BuildNamespaceToExportTo(cluster, []string{"bookinfo"})
		require.Len(t, result, 1)
		assert.Equal(t, []string{"*"}, result["bookinfo"])
	})

	t.Run("skips unmanaged namespaces", func(t *testing.T) {
		result := mesh.BuildNamespaceToExportTo(cluster, []string{"unknown"})
		assert.Empty(t, result)
	})

	t.Run("nil mesh returns empty", func(t *testing.T) {
		var nilMesh *models.Mesh
		result := nilMesh.BuildNamespaceToExportTo(cluster, []string{"bookinfo"})
		assert.Empty(t, result)
	})
}

func TestMeshConfigJSONMarshal(t *testing.T) {
	cases := map[string]struct {
		OutboundTrafficPolicy *istiov1alpha1.MeshConfig_OutboundTrafficPolicy
		Expected              string
	}{
		"outboundTrafficPolicy with REGISTRY_ONLY keeps REGISTRY_ONLY": {
			OutboundTrafficPolicy: &istiov1alpha1.MeshConfig_OutboundTrafficPolicy{
				Mode: istiov1alpha1.MeshConfig_OutboundTrafficPolicy_REGISTRY_ONLY,
			},
			Expected: "{\"outboundTrafficPolicy\":{\"mode\":\"REGISTRY_ONLY\"}}",
		},
		"outboundTrafficPolicy with ALLOW_ANY keeps ALLOW_ANY": {
			OutboundTrafficPolicy: &istiov1alpha1.MeshConfig_OutboundTrafficPolicy{
				Mode: istiov1alpha1.MeshConfig_OutboundTrafficPolicy_ALLOW_ANY,
			},
			Expected: "{\"outboundTrafficPolicy\":{\"mode\":\"ALLOW_ANY\"}}",
		},
		"nil outboundTrafficPolicy empty": {
			OutboundTrafficPolicy: nil,
			Expected:              "{}",
		},
		// Since the default is actually ALLOW_ANY this doesn't make much sense.
		"empty outboundTrafficPolicy keeps REGISTRY_ONLY": {
			OutboundTrafficPolicy: &istiov1alpha1.MeshConfig_OutboundTrafficPolicy{},
			Expected:              "{\"outboundTrafficPolicy\":{\"mode\":\"REGISTRY_ONLY\"}}",
		},
	}
	for name, tc := range cases {
		t.Run(name, func(t *testing.T) {
			require := require.New(t)
			b, err := json.Marshal(models.MeshConfig{&istiov1alpha1.MeshConfig{OutboundTrafficPolicy: tc.OutboundTrafficPolicy}})
			require.NoError(err)

			require.Equal(string(b), tc.Expected)
		})
	}
}
