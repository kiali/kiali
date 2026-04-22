package business

import (
	"testing"

	"github.com/stretchr/testify/assert"
	istiov1alpha1 "istio.io/api/mesh/v1alpha1"

	"github.com/kiali/kiali/models"
)

func TestResolveClusterIdentityDomain(t *testing.T) {
	cases := map[string]struct {
		mesh       *models.Mesh
		cluster    string
		configured string
		expected   string
	}{
		"nil mesh falls back to default": {
			mesh:       nil,
			cluster:    "mycluster",
			configured: "",
			expected:   "svc.cluster.local",
		},
		"nil mesh uses explicit config": {
			mesh:       nil,
			cluster:    "mycluster",
			configured: "svc.custom.domain",
			expected:   "svc.custom.domain",
		},
		"matching cluster derives from trustDomain": {
			mesh: &models.Mesh{
				ControlPlanes: []models.ControlPlane{{
					Cluster: &models.KubeCluster{Name: "mycluster"},
					MeshConfig: &models.MeshConfig{
						MeshConfig: &istiov1alpha1.MeshConfig{TrustDomain: "example.org"},
					},
				}},
			},
			cluster:    "mycluster",
			configured: "",
			expected:   "svc.example.org",
		},
		"no matching cluster falls back to default": {
			mesh: &models.Mesh{
				ControlPlanes: []models.ControlPlane{{
					Cluster: &models.KubeCluster{Name: "other"},
					MeshConfig: &models.MeshConfig{
						MeshConfig: &istiov1alpha1.MeshConfig{TrustDomain: "example.org"},
					},
				}},
			},
			cluster:    "mycluster",
			configured: "",
			expected:   "svc.cluster.local",
		},
		"matching cluster with nil MeshConfig falls back to default": {
			mesh: &models.Mesh{
				ControlPlanes: []models.ControlPlane{{
					Cluster:    &models.KubeCluster{Name: "mycluster"},
					MeshConfig: nil,
				}},
			},
			cluster:    "mycluster",
			configured: "",
			expected:   "svc.cluster.local",
		},
		"explicit config overrides mesh trustDomain": {
			mesh: &models.Mesh{
				ControlPlanes: []models.ControlPlane{{
					Cluster: &models.KubeCluster{Name: "mycluster"},
					MeshConfig: &models.MeshConfig{
						MeshConfig: &istiov1alpha1.MeshConfig{TrustDomain: "example.org"},
					},
				}},
			},
			cluster:    "mycluster",
			configured: "svc.override.local",
			expected:   "svc.override.local",
		},
	}

	for name, tc := range cases {
		t.Run(name, func(t *testing.T) {
			got := ResolveClusterIdentityDomain(tc.mesh, tc.cluster, tc.configured)
			assert.Equal(t, tc.expected, got)
		})
	}
}
