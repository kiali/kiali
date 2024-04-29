package api

import (
	"context"
	"fmt"
	"net/http"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/graph"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/mesh"
	"github.com/kiali/kiali/mesh/config/cytoscape"
	"github.com/kiali/kiali/mesh/generator"
	"github.com/kiali/kiali/observability"
)

// GraphMesh generates a mesh graph using the provided options
func GraphMesh(ctx context.Context, business *business.Layer, o mesh.Options) (code int, config interface{}) {
	var end observability.EndFunc
	ctx, end = observability.StartSpan(ctx, "GraphNamespaces",
		observability.Attribute("package", "api"),
	)
	defer end()
	// time how long it takes to generate this graph
	//promtimer := internalmetrics.GetMeshGraphGenerationTimePrometheusTimer()
	//defer promtimer.ObserveDuration()

	// Create a 'global' object to store the business. Global only to the request.
	globalInfo := mesh.NewAppenderGlobalInfo()
	globalInfo.Business = business
	globalInfo.IstioStatusGetter = &business.IstioStatus
	globalInfo.Context = ctx

	code, config = graphMesh(ctx, globalInfo, o)

	return code, config
}

// graphMesh provides a test hook that accepts mock clients
func graphMesh(ctx context.Context, globalInfo *mesh.AppenderGlobalInfo, o mesh.Options) (code int, config interface{}) {

	meshMap := generator.BuildMeshMap(ctx, o, globalInfo)
	code, config = generateGraph(meshMap, o)

	return code, config
}

func generateGraph(meshMap mesh.MeshMap, o mesh.Options) (int, interface{}) {
	log.Tracef("Generating config for [%s] graph...", o.ConfigVendor)

	//	promtimer := internalmetrics.GetMeshGraphMarshalTimePrometheusTimer()
	//	defer promtimer.ObserveDuration()

	var vendorConfig interface{}
	switch o.ConfigVendor {
	case graph.VendorCytoscape:
		vendorConfig = cytoscape.NewConfig(meshMap, o.ConfigOptions)
	default:
		graph.Error(fmt.Sprintf("ConfigVendor [%s] not supported", o.ConfigVendor))
	}

	log.Tracef("Done generating config for [%s] graph", o.ConfigVendor)
	return http.StatusOK, vendorConfig
}
