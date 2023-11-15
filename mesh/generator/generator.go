package generator

import (
	"context"

	"github.com/kiali/kiali/graph"
	"github.com/kiali/kiali/mesh"
	"github.com/kiali/kiali/mesh/appender"
	"github.com/kiali/kiali/observability"
	"github.com/kiali/kiali/prometheus"
)

// BuildMeshMap is required by the graph/TelemetryVendor interface
func BuildMeshMap(ctx context.Context, o mesh.CommonOptions, client *prometheus.Client, globalInfo *graph.AppenderGlobalInfo) mesh.MeshMap {
	var end observability.EndFunc
	ctx, end = observability.StartSpan(ctx, "BuildMeshMap",
		observability.Attribute("package", "generator"),
	)
	defer end()

	appenders, finalizers := appender.ParseAppenders(o)
	meshMap := mesh.NewMeshMap()

	return nil
}
