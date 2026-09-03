package generator

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/kiali/kiali/mesh"
	"github.com/kiali/kiali/models"
)

func TestFindManagingIstiod(t *testing.T) {
	cluster := "cluster-primary"
	ztunnelRevision := models.DefaultRevisionLabel

	newIstiod := func(namespace, name, tag, version string) *mesh.Node {
		cp := models.ControlPlane{
			IstiodName:      name,
			IstiodNamespace: namespace,
		}
		if tag != "" {
			cp.Tag = &models.Tag{Name: tag}
		}
		if version != "" {
			cp.Version = &models.ExternalServiceInfo{Version: version}
		}
		node := mesh.NewNode("id", mesh.NodeTypeInfra, mesh.InfraTypeIstiod, cluster, namespace, name)
		node.Metadata[mesh.InfraData] = cp
		return node
	}

	t.Run("returns nil when no istiod matches revision", func(t *testing.T) {
		meshMap := mesh.NewMeshMap()
		meshMap["a"] = newIstiod("istio-system", "istiod-canary", "canary", "1.24.0")

		assert.Nil(t, findManagingIstiod(meshMap, cluster, ztunnelRevision, "1.24.0"))
	})

	t.Run("returns single matching istiod", func(t *testing.T) {
		meshMap := mesh.NewMeshMap()
		istiod := newIstiod("istio-system", "istiod", models.DefaultRevisionLabel, "1.24.0")
		meshMap["a"] = istiod

		assert.Same(t, istiod, findManagingIstiod(meshMap, cluster, ztunnelRevision, "1.24.0"))
	})

	t.Run("filters by app.kubernetes.io/version tie-breaker", func(t *testing.T) {
		meshMap := mesh.NewMeshMap()
		istiod124 := newIstiod("istio-system", "istiod", models.DefaultRevisionLabel, "1.24.0")
		meshMap["a"] = istiod124
		meshMap["b"] = newIstiod("istio-system", "istiod-canary", models.DefaultRevisionLabel, "1.25.0")

		assert.Same(t, istiod124, findManagingIstiod(meshMap, cluster, ztunnelRevision, "1.24.0"))
	})

	t.Run("returns deterministic result when multiple istiods match", func(t *testing.T) {
		meshMap := mesh.NewMeshMap()
		istiodA := newIstiod("istio-a", "istiod", models.DefaultRevisionLabel, "")
		istiodB := newIstiod("istio-b", "istiod", models.DefaultRevisionLabel, "")
		meshMap["b"] = istiodB
		meshMap["a"] = istiodA

		result := findManagingIstiod(meshMap, cluster, ztunnelRevision, "")
		require.NotNil(t, result)
		assert.Equal(t, "istio-a", result.Namespace)
		assert.Same(t, istiodA, result)
	})
}
