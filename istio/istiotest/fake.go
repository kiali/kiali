package istiotest

import (
	"context"

	"github.com/kiali/kiali/models"
)

// FakeDiscovery implements the MeshDiscovery interface. Useful for testing.
type FakeDiscovery struct {
	// MeshReturn is the return value of Mesh().
	MeshReturn models.Mesh
}

func (fmd *FakeDiscovery) Mesh(ctx context.Context) (*models.Mesh, error) {
	return &fmd.MeshReturn, nil
}
