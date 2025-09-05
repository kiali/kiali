package istiotest

import (
	"context"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/models"
)

// FakeDiscovery implements the MeshDiscovery interface. Useful for testing.
type FakeDiscovery struct {
	// ClustersReturn is the return value of Clusters().
	ClustersReturn []models.KubeCluster
	// GetControlPlaneNamespacesReturn is the return value of GetControlPlaneNamespaces().
	GetControlPlaneNamespacesReturn []string
	// GetRootNamespaceReturn is the return value of GetRootNamespace().
	GetRootNamespaceReturn string
	// IsControlPlaneReturn is the return value of IsControlPlane().
	IsControlPlaneReturn bool
	// MeshReturn is the return value of Mesh().
	MeshReturn models.Mesh
}

func (fmd *FakeDiscovery) Clusters() ([]models.KubeCluster, error) {
	return fmd.ClustersReturn, nil
}

func (fmd *FakeDiscovery) GetControlPlaneNamespaces(ctx context.Context, cluster string) []string {
	return fmd.GetControlPlaneNamespacesReturn
}

func (fmd *FakeDiscovery) GetRootNamespace(ctx context.Context, cluster, namespace string) string {
	if fmd.GetRootNamespaceReturn == "" {
		return config.IstioNamespaceDefault
	}
	return fmd.GetRootNamespaceReturn
}

func (fmd *FakeDiscovery) IsControlPlane(ctx context.Context, cluster, namespace string) bool {
	return fmd.IsControlPlaneReturn
}

func (fmd *FakeDiscovery) Mesh(ctx context.Context) (*models.Mesh, error) {
	return &fmd.MeshReturn, nil
}
