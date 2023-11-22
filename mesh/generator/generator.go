package generator

import (
	"context"
	"crypto/md5"
	"fmt"

	"github.com/kiali/kiali/graph"
	"github.com/kiali/kiali/mesh"
	"github.com/kiali/kiali/mesh/appender"
	"github.com/kiali/kiali/observability"
)

// BuildMeshMap is required by the graph/TelemetryVendor interface
func BuildMeshMap(ctx context.Context, o mesh.Options, gi *mesh.AppenderGlobalInfo) mesh.MeshMap {
	var end observability.EndFunc
	ctx, end = observability.StartSpan(ctx, "BuildMeshMap",
		observability.Attribute("package", "generator"),
	)
	defer end()

	_, finalizers := appender.ParseAppenders(o)
	meshMap := mesh.NewMeshMap()

	// start by creating infra nodes for each accessible namespace
	// note - namespace infra nodes will be replaced, as needed, by namespace boxes at the config-gen stage (e.g. in Cytoscape.go)
	clusterMap := make(map[string]bool)
	for _, ns := range o.AccessibleNamespaces {
		clusterMap[ns.Cluster] = true

		var err error
		_, _, err = addInfra(meshMap, mesh.InfraTypeNamespace, ns.Cluster, ns.Name, ns.Name)
		mesh.CheckError(err)
	}

	meshClusters, err := gi.Business.Mesh.GetClusters(o.Request)
	graph.CheckError(err)

	for _, cluster := range meshClusters {
		// add any clusters that is configured but somehow has no accessible namespace
		if _, ok := clusterMap[cluster.Name]; !ok {
			_, _, err := addInfra(meshMap, mesh.InfraTypeCluster, cluster.Name, mesh.Unknown, cluster.Name)
			mesh.CheckError(err)

			continue
		}

		// add any Kiali instances
		for _, kiali := range cluster.KialiInstances {
			_, _, err := addInfra(meshMap, mesh.InfraTypeKiali, cluster.Name, kiali.Namespace, kiali.ServiceName)
			mesh.CheckError(err)
		}
	}

	// The finalizers can perform final manipulations on the complete graph
	for _, f := range finalizers {
		f.AppendGraph(meshMap, gi, nil)
	}

	return meshMap
}

func addInfra(meshMap mesh.MeshMap, infraType, cluster, namespace, name string) (*mesh.Node, bool, error) {
	id, err := mesh.Id(cluster, namespace, name)
	if err != nil {
		return nil, false, err
	}
	node, found := meshMap[id]
	if !found {
		newNode := mesh.NewNodeExplicit(id, mesh.NodeTypeInfra, infraType, cluster, namespace, name)
		node = newNode
		meshMap[id] = node
	}
	node.Metadata["tsHash"] = timeSeriesHash(cluster, namespace, name)
	return node, found, nil
}

func timeSeriesHash(cluster, namespace, name string) string {
	return fmt.Sprintf("%x", md5.Sum([]byte(fmt.Sprintf("%s:%s:%s", cluster, namespace, name))))
}
