package api

import (
	"context"
	"fmt"
	"net/http"

	"k8s.io/apimachinery/pkg/api/errors"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/cache"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/grafana"
	"github.com/kiali/kiali/graph"
	"github.com/kiali/kiali/istio"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/mesh"
	"github.com/kiali/kiali/mesh/config/common"
	"github.com/kiali/kiali/mesh/generator"
	"github.com/kiali/kiali/observability"
	"github.com/kiali/kiali/prometheus/internalmetrics"
)

// GraphMesh generates a mesh graph using the provided options
func GraphMesh(
	ctx context.Context,
	business *business.Layer,
	o mesh.Options,
	clientFactory kubernetes.ClientFactory,
	kialiCache cache.KialiCache,
	conf *config.Config,
	grafana *grafana.Service,
	discovery *istio.Discovery,
) (code int, config interface{}) {
	var end observability.EndFunc
	ctx, end = observability.StartSpan(ctx, "GraphNamespaces",
		observability.Attribute("package", "api"),
	)
	defer end()

	// Create a 'global' object to store the business. Global only to the request.
	globalInfo := mesh.NewGlobalInfo()
	globalInfo.Business = business
	globalInfo.ClientFactory = clientFactory
	globalInfo.Conf = conf
	globalInfo.Discovery = discovery
	globalInfo.Grafana = grafana
	globalInfo.KialiCache = kialiCache
	globalInfo.IstioStatusGetter = &business.IstioStatus

	promtimer := internalmetrics.GetGraphGenerationTimePrometheusTimer("mesh", "mesh", false)
	promtimer.ObserveDuration()

	code, config = graphMesh(ctx, globalInfo, o)

	return code, config
}

// graphMesh provides a test hook that accepts mock clients
func graphMesh(ctx context.Context, globalInfo *mesh.GlobalInfo, o mesh.Options) (code int, config interface{}) {
	meshMap, err := generator.BuildMeshMap(ctx, o, globalInfo)
	if err != nil {
		if errors.IsForbidden(err) {
			return http.StatusForbidden, nil
		}
		return http.StatusInternalServerError, nil
	}
	code, config = generateGraph(meshMap, o)

	return code, config
}

func generateGraph(meshMap mesh.MeshMap, o mesh.Options) (int, interface{}) {
	log.Tracef("Generating config for [%s] graph...", o.ConfigVendor)

	promtimer := internalmetrics.GetGraphMarshalTimePrometheusTimer("mesh", "mesh", false)
	defer promtimer.ObserveDuration()

	var vendorConfig interface{}
	switch o.ConfigVendor {
	case graph.VendorCommon:
		vendorConfig = common.NewConfig(meshMap, o.ConfigOptions)
	default:
		graph.Error(fmt.Sprintf("ConfigVendor [%s] not supported", o.ConfigVendor))
	}

	log.Tracef("Done generating config for [%s] graph", o.ConfigVendor)
	return http.StatusOK, vendorConfig
}
