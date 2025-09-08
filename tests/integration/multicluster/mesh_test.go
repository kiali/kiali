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
	require.Equal("controlplane", istiodNodes[0].Data.Cluster)
	require.Equal("controlplane", istiodNodes[1].Data.Cluster)

	require.True(istiodNodes[0].Data.Namespace != istiodNodes[1].Data.Namespace)
	require.True(istiodNodes[0].Data.Namespace == "istio-system" || istiodNodes[0].Data.Namespace == "external-istiod")
	require.True(istiodNodes[1].Data.Namespace == "istio-system" || istiodNodes[1].Data.Namespace == "external-istiod")

	// TODO: When this is a mesh page test, need to ensure that there's two controlplanes
	// the "external" controlplane is managing the dataplane on the "remote" cluster.
}
