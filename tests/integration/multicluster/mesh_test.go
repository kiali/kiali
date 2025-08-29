package multicluster

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/kiali/kiali/mesh/config/common"
	"github.com/kiali/kiali/tests/integration/utils/kiali"
	"github.com/kiali/kiali/util/sliceutil"
)

// Expected to be run with setup-external-controlplane.sh
// TODO: Move this to a frontend mesh page test.
func TestMeshShowsExternalControlPlane(t *testing.T) {
	require := require.New(t)

	mesh, err := kiali.MeshGraph()
	require.NoError(err)

	istiodNodes := sliceutil.Filter(mesh.Elements.Nodes, func(node *common.NodeWrapper) bool {
		return node.Data.InfraType == "istiod"
	})

	require.Len(istiodNodes, 2)
	require.True(istiodNodes[0].Data.Cluster != istiodNodes[1].Data.Cluster)
	require.True(istiodNodes[0].Data.Cluster == "Kubernetes" || istiodNodes[0].Data.Cluster == "dataplane")
	require.True(istiodNodes[1].Data.Cluster == "Kubernetes" || istiodNodes[1].Data.Cluster == "dataplane")

	// TODO: When this is a mesh page test, need to ensure that there's two controlplanes
	// the "external" controlplane is managing the dataplane on the "remote" cluster.
}
