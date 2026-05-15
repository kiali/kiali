package common

import (
	"testing"

	"github.com/kiali/kiali/mesh"
)

func TestNewConfig_IsAmbientPropagated(t *testing.T) {
	meshMap := mesh.NewMeshMap()

	ambientNode := mesh.NewNode("ambient-istiod-id", mesh.NodeTypeInfra, mesh.InfraTypeIstiod, "cluster-a", "istio-system", "istiod")
	ambientNode.Metadata[mesh.IsAmbient] = true
	ambientNode.Metadata[mesh.Version] = "1.24.0"
	meshMap["ambient-istiod-id"] = ambientNode

	opts := mesh.ConfigOptions{
		MeshNames: []string{"mesh-1"},
		CommonOptions: mesh.CommonOptions{
			QueryTime: 1000,
		},
	}

	config := NewConfig(meshMap, opts)

	var found bool
	for _, nw := range config.Elements.Nodes {
		if nw.Data.InfraType == mesh.InfraTypeIstiod && nw.Data.Cluster == "cluster-a" {
			if !nw.Data.IsAmbient {
				t.Errorf("expected IsAmbient=true for ambient istiod node, got false")
			}
			if nw.Data.Version != "1.24.0" {
				t.Errorf("expected Version=1.24.0, got %s", nw.Data.Version)
			}
			found = true
		}
	}
	if !found {
		t.Error("ambient istiod node not found in config output")
	}
}

func TestNewConfig_NonAmbientNodeHasIsAmbientFalse(t *testing.T) {
	meshMap := mesh.NewMeshMap()

	sidecarNode := mesh.NewNode("sidecar-istiod-id", mesh.NodeTypeInfra, mesh.InfraTypeIstiod, "cluster-b", "istio-system", "istiod")
	sidecarNode.Metadata[mesh.Version] = "1.24.0"
	meshMap["sidecar-istiod-id"] = sidecarNode

	opts := mesh.ConfigOptions{
		MeshNames: []string{"mesh-1"},
		CommonOptions: mesh.CommonOptions{
			QueryTime: 1000,
		},
	}

	config := NewConfig(meshMap, opts)

	var found bool
	for _, nw := range config.Elements.Nodes {
		if nw.Data.InfraType == mesh.InfraTypeIstiod && nw.Data.Cluster == "cluster-b" {
			if nw.Data.IsAmbient {
				t.Errorf("expected IsAmbient=false for non-ambient istiod node, got true")
			}
			found = true
		}
	}
	if !found {
		t.Error("sidecar istiod node not found in config output")
	}
}

func TestNewConfig_IsAmbientFalseWhenMetadataValueIsFalse(t *testing.T) {
	meshMap := mesh.NewMeshMap()

	node := mesh.NewNode("explicit-false-id", mesh.NodeTypeInfra, mesh.InfraTypeIstiod, "cluster-c", "istio-system", "istiod")
	node.Metadata[mesh.IsAmbient] = false
	meshMap["explicit-false-id"] = node

	opts := mesh.ConfigOptions{
		MeshNames: []string{"mesh-1"},
		CommonOptions: mesh.CommonOptions{
			QueryTime: 1000,
		},
	}

	config := NewConfig(meshMap, opts)

	for _, nw := range config.Elements.Nodes {
		if nw.Data.InfraType == mesh.InfraTypeIstiod && nw.Data.Cluster == "cluster-c" {
			if nw.Data.IsAmbient {
				t.Errorf("expected IsAmbient=false when metadata isAmbient is explicitly false, got true")
			}
			return
		}
	}
	t.Error("node not found in config output")
}

func TestNewConfig_MixedAmbientAndSidecarNodes(t *testing.T) {
	meshMap := mesh.NewMeshMap()

	ambientNode := mesh.NewNode("ambient-id", mesh.NodeTypeInfra, mesh.InfraTypeIstiod, "cluster-a", "istio-system-1", "istiod-ambient")
	ambientNode.Metadata[mesh.IsAmbient] = true
	ambientNode.Metadata[mesh.Version] = "1.24.0"
	meshMap["ambient-id"] = ambientNode

	sidecarNode := mesh.NewNode("sidecar-id", mesh.NodeTypeInfra, mesh.InfraTypeIstiod, "cluster-a", "istio-system-2", "istiod-sidecar")
	sidecarNode.Metadata[mesh.Version] = "1.24.0"
	meshMap["sidecar-id"] = sidecarNode

	opts := mesh.ConfigOptions{
		MeshNames: []string{"mesh-1", "mesh-2"},
		CommonOptions: mesh.CommonOptions{
			QueryTime: 1000,
		},
	}

	config := NewConfig(meshMap, opts)

	ambientCount := 0
	nonAmbientCount := 0
	for _, nw := range config.Elements.Nodes {
		if nw.Data.InfraType == mesh.InfraTypeIstiod {
			if nw.Data.IsAmbient {
				ambientCount++
			} else {
				nonAmbientCount++
			}
		}
	}

	if ambientCount != 1 {
		t.Errorf("expected exactly 1 ambient istiod node, got %d", ambientCount)
	}
	if nonAmbientCount != 1 {
		t.Errorf("expected exactly 1 non-ambient istiod node, got %d", nonAmbientCount)
	}
}

func TestNewConfig_IsExternalSetsIsInaccessible(t *testing.T) {
	meshMap := mesh.NewMeshMap()

	node := mesh.NewNode("ext-id", mesh.NodeTypeInfra, mesh.InfraTypeGrafana, mesh.External, "", "grafana")
	node.Metadata[mesh.IsExternal] = true
	meshMap["ext-id"] = node

	opts := mesh.ConfigOptions{
		MeshNames: []string{"mesh-1"},
		CommonOptions: mesh.CommonOptions{
			QueryTime: 1000,
		},
	}

	config := NewConfig(meshMap, opts)

	for _, nw := range config.Elements.Nodes {
		if nw.Data.InfraName == "grafana" {
			if !nw.Data.IsExternal {
				t.Error("expected IsExternal=true for external node")
			}
			if !nw.Data.IsInaccessible {
				t.Error("expected IsInaccessible=true for external node")
			}
			return
		}
	}
	t.Error("external grafana node not found in config output")
}

func TestNewConfig_EdgesCreated(t *testing.T) {
	meshMap := mesh.NewMeshMap()

	src := mesh.NewNode("src-id", mesh.NodeTypeInfra, mesh.InfraTypeIstiod, "cluster-a", "istio-system", "istiod")
	dest := mesh.NewNode("dest-id", mesh.NodeTypeInfra, mesh.InfraTypeDataPlane, "cluster-a", "", "dataplane")
	src.AddEdge(dest)
	meshMap["src-id"] = src
	meshMap["dest-id"] = dest

	opts := mesh.ConfigOptions{
		MeshNames: []string{"mesh-1"},
		CommonOptions: mesh.CommonOptions{
			QueryTime: 1000,
		},
	}

	config := NewConfig(meshMap, opts)

	if len(config.Elements.Edges) != 1 {
		t.Errorf("expected 1 edge, got %d", len(config.Elements.Edges))
	}
}

func TestNewConfig_MeshNamesPreserved(t *testing.T) {
	meshMap := mesh.NewMeshMap()

	node := mesh.NewNode("node-id", mesh.NodeTypeInfra, mesh.InfraTypeIstiod, "cluster-a", "istio-system", "istiod")
	meshMap["node-id"] = node

	names := []string{"mesh-alpha", "mesh-beta"}
	opts := mesh.ConfigOptions{
		MeshNames: names,
		CommonOptions: mesh.CommonOptions{
			QueryTime: 1234,
		},
	}

	config := NewConfig(meshMap, opts)

	if len(config.MeshNames) != 2 || config.MeshNames[0] != "mesh-alpha" || config.MeshNames[1] != "mesh-beta" {
		t.Errorf("expected MeshNames [mesh-alpha, mesh-beta], got %v", config.MeshNames)
	}
	if config.Timestamp != 1234 {
		t.Errorf("expected Timestamp 1234, got %d", config.Timestamp)
	}
}
