package generator

import (
	"context"
	"crypto/md5"
	"fmt"

	"github.com/kiali/kiali/graph"
	"github.com/kiali/kiali/mesh"
	"github.com/kiali/kiali/mesh/appender"
	"github.com/kiali/kiali/observability"
	"github.com/kiali/kiali/prometheus"
)

// BuildMeshMap is required by the graph/TelemetryVendor interface
func BuildMeshMap(ctx context.Context, o mesh.Options, client *prometheus.Client, gi *mesh.AppenderGlobalInfo) mesh.MeshMap {
	var end observability.EndFunc
	ctx, end = observability.StartSpan(ctx, "BuildMeshMap",
		observability.Attribute("package", "generator"),
	)
	defer end()

	_, finalizers := appender.ParseAppenders(o)
	meshMap := mesh.NewMeshMap()

	// start by creating namespace nodes for each accessible namespace and cluster
	for _, ns := range o.AccessibleNamespaces {
		var err error
		_, _, err = addNode(meshMap, ns.Cluster, ns.Name, "")
		mesh.CheckError(err)

		_, _, err = addNode(meshMap, ns.Cluster, "", "")
		mesh.CheckError(err)
	}

	// add any clusters that are configured but somehow don't have accessible namespaces
	meshClusters, err := gi.Business.Mesh.GetClusters(o.Request)
	graph.CheckError(err)

	for _, cluster := range meshClusters {
		var err error
		_, _, err = addNode(meshMap, cluster.Name, "", "")
		mesh.CheckError(err)
	}

	// The finalizers can perform final manipulations on the complete graph
	for _, f := range finalizers {
		f.AppendGraph(meshMap, gi, nil)
	}

	return meshMap
}

func addNode(meshMap mesh.MeshMap, cluster, namespace, name string) (*mesh.Node, bool, error) {
	id, nodeType, err := mesh.Id(cluster, namespace, name)
	if err != nil {
		return nil, false, err
	}
	node, found := meshMap[id]
	if !found {
		newNode := mesh.NewNodeExplicit(id, nodeType, cluster, namespace, name)
		node = newNode
		meshMap[id] = node
	}
	node.Metadata["tsHash"] = timeSeriesHash(cluster, namespace, name)
	return node, found, nil
}

func timeSeriesHash(cluster, namespace, name string) string {
	return fmt.Sprintf("%x", md5.Sum([]byte(fmt.Sprintf("%s:%s:%s", cluster, namespace, name))))
}
