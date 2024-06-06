package multicluster

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tests/integration/utils/kiali"
)

// Expected to be run with setup-external-controlplane.sh
func TestMeshShowsExternalControlPlane(t *testing.T) {
	require := require.New(t)

	mesh, err := kiali.Mesh()
	require.NoError(err)

	require.Len(mesh.ControlPlanes, 2)

	// Manages the controlplane cluster.
	controlPlane := business.FindOrFail(t, mesh.ControlPlanes, func(c models.ControlPlane) bool {
		return c.IstiodName == "istiod" && c.IstiodNamespace == "istio-system" && c.Cluster.Name == "Kubernetes"
	})
	require.Len(controlPlane.ManagedClusters, 1)
	require.Equal("Kubernetes", controlPlane.ManagedClusters[0].Name)

	// Manages the external clusters.
	externalControlPlane := business.FindOrFail(t, mesh.ControlPlanes, func(c models.ControlPlane) bool {
		return c.IstiodName == "istiod" && c.IstiodNamespace == "external-istiod" && c.Cluster.Name == "Kubernetes"
	})

	require.Equal("dataplane", externalControlPlane.ID)
	require.True(externalControlPlane.ExternalControlPlane)
	require.Len(externalControlPlane.ManagedClusters, 1)
	require.Equal("dataplane", externalControlPlane.ManagedClusters[0].Name)
}
