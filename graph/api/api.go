package api

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/graph"
	"github.com/kiali/kiali/graph/config/cytoscape"
	"github.com/kiali/kiali/graph/telemetry/istio"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/prometheus"
	"github.com/kiali/kiali/prometheus/internalmetrics"
)

// GraphNamespaces generates a namespaces graph using the provided options
func GraphNamespaces(business *business.Layer, o graph.Options, ctx context.Context) (code int, config interface{}) {
	// time how long it takes to generate this graph
	promtimer := internalmetrics.GetGraphGenerationTimePrometheusTimer(o.GetGraphKind(), o.TelemetryOptions.GraphType, o.InjectServiceNodes)
	defer promtimer.ObserveDuration()

	switch o.TelemetryVendor {
	case graph.VendorIstio:
		prom, err := prometheus.NewClient()
		graph.CheckError(err)
		code, config = graphNamespacesIstio(business, prom, o, ctx)
	default:
		graph.Error(fmt.Sprintf("TelemetryVendor [%s] not supported", o.TelemetryVendor))
	}

	// update metrics
	internalmetrics.SetGraphNodes(o.GetGraphKind(), o.TelemetryOptions.GraphType, o.InjectServiceNodes, 0)

	return code, config
}

// graphNamespacesIstio provides a test hook that accepts mock clients
func graphNamespacesIstio(business *business.Layer, prom *prometheus.Client, o graph.Options, ctx context.Context) (code int, config interface{}) {

	// Create a 'global' object to store the business. Global only to the request.
	globalInfo := graph.NewAppenderGlobalInfo()
	globalInfo.Business = business

	trafficMap := istio.BuildNamespacesTrafficMap(o.TelemetryOptions, prom, globalInfo)
	code, config = generateGraph(trafficMap, o, business, ctx)

	return code, config
}

// GraphNode generates a node graph using the provided options
func GraphNode(business *business.Layer, o graph.Options, ctx context.Context) (code int, config interface{}) {
	if len(o.Namespaces) != 1 {
		graph.Error("Node graph does not support the 'namespaces' query parameter or the 'all' namespace")
	}

	// time how long it takes to generate this graph
	promtimer := internalmetrics.GetGraphGenerationTimePrometheusTimer(o.GetGraphKind(), o.TelemetryOptions.GraphType, o.InjectServiceNodes)
	defer promtimer.ObserveDuration()

	switch o.TelemetryVendor {
	case graph.VendorIstio:
		prom, err := prometheus.NewClient()
		graph.CheckError(err)
		code, config = graphNodeIstio(business, prom, o, ctx)
	default:
		graph.Error(fmt.Sprintf("TelemetryVendor [%s] not supported", o.TelemetryVendor))
	}
	// update metrics
	internalmetrics.SetGraphNodes(o.GetGraphKind(), o.TelemetryOptions.GraphType, o.InjectServiceNodes, 0)

	return code, config
}

// graphNodeIstio provides a test hook that accepts mock clients
func graphNodeIstio(business *business.Layer, client *prometheus.Client, o graph.Options, ctx context.Context) (code int, config interface{}) {

	// Create a 'global' object to store the business. Global only to the request.
	globalInfo := graph.NewAppenderGlobalInfo()
	globalInfo.Business = business

	trafficMap := istio.BuildNodeTrafficMap(o.TelemetryOptions, client, globalInfo)
	code, config = generateGraph(trafficMap, o, business, ctx)

	return code, config
}

func generateGraph(trafficMap graph.TrafficMap, o graph.Options, bs *business.Layer, ctx context.Context) (int, interface{}) {
	log.Tracef("Generating config for [%s] graph...", o.ConfigVendor)

	promtimer := internalmetrics.GetGraphMarshalTimePrometheusTimer(o.GetGraphKind(), o.TelemetryOptions.GraphType, o.InjectServiceNodes)
	defer promtimer.ObserveDuration()

	var vendorConfig interface{}
	switch o.ConfigVendor {
	case graph.VendorCytoscape:
		vc := cytoscape.NewConfig(trafficMap, o.ConfigOptions)
		if o.ConfigOptions.IncludeHealth {
			err := collectGraphHealth(&vc, o.ConfigOptions, bs, ctx)
			if err != nil {
				graph.Error(fmt.Sprintf("Error collecting graph health: %s", err.Error()))
			}
		}
		vendorConfig = &vc
	default:
		graph.Error(fmt.Sprintf("ConfigVendor [%s] not supported", o.ConfigVendor))
	}

	log.Tracef("Done generating config for [%s] graph", o.ConfigVendor)
	return http.StatusOK, vendorConfig
}

func collectGraphHealth(vendorConfig *cytoscape.Config, o graph.ConfigOptions, bs *business.Layer, ctx context.Context) error {
	healthReqs := make(map[string]map[string][]*cytoscape.NodeWrapper)

	// Limit health fetches to only the necessary namespaces for the necessary types
	for _, node := range vendorConfig.Elements.Nodes {
		if node.Data.IsInaccessible {
			continue
		}

		kind := ""
		namespace := node.Data.Namespace
		nodeType := node.Data.NodeType
		workloadOk := len(node.Data.Workload) != 0 && node.Data.Workload != graph.Unknown

		useWorkloadHealth := nodeType == graph.NodeTypeWorkload || (nodeType == graph.NodeTypeApp && workloadOk)
		if useWorkloadHealth {
			kind = "workload"
		} else {
			switch nodeType {
			case graph.NodeTypeApp:
				kind = "app"
			case graph.NodeTypeBox:
				if node.Data.IsBox == graph.BoxByApp {
					kind = "app"
				}
			case graph.NodeTypeService:
				kind = "service"
			}
		}

		if len(kind) != 0 {
			if _, nsOk := healthReqs[namespace]; !nsOk {
				healthReqs[namespace] = make(map[string][]*cytoscape.NodeWrapper)
			}

			healthReqs[namespace][kind] = append(healthReqs[namespace][kind], node)
		}
	}

	// Execute health fetches and attach retrieved health data to nodes
	for namespace, kinds := range healthReqs {
		for kind, nodeWrappers := range kinds {
			switch kind {
			case "app":
				health, err := bs.Health.GetNamespaceAppHealth(ctx, namespace, o.RawDuration, time.Unix(o.QueryTime, 0))
				if err != nil {
					return err
				}
				for _, nodeWrap := range nodeWrappers {
					if h, ok := health[nodeWrap.Data.App]; ok {
						nodeWrap.Data.HealthData = h
					} else {
						nodeWrap.Data.HealthData = []int{}
						log.Debugf("No health found for [%s] [%s]", nodeWrap.Data.NodeType, nodeWrap.Data.App)
					}
				}
			case "service":
				health, err := bs.Health.GetNamespaceServiceHealth(ctx, namespace, o.RawDuration, time.Unix(o.QueryTime, 0))
				if err != nil {
					return err
				}
				for _, nodeWrap := range nodeWrappers {
					if h, ok := health[nodeWrap.Data.Service]; ok {
						nodeWrap.Data.HealthData = h
					} else {
						nodeWrap.Data.HealthData = []int{}
						log.Debugf("No health found for [%s] [%s]", nodeWrap.Data.NodeType, nodeWrap.Data.Service)
					}
				}
			case "workload":
				health, err := bs.Health.GetNamespaceWorkloadHealth(ctx, namespace, o.RawDuration, time.Unix(o.QueryTime, 0))
				if err != nil {
					return err
				}
				for _, nodeWrap := range nodeWrappers {
					if h, ok := health[nodeWrap.Data.Workload]; ok {
						nodeWrap.Data.HealthData = h
					} else {
						nodeWrap.Data.HealthData = []int{}
						log.Debugf("No health found for [%s] [%s]", nodeWrap.Data.NodeType, nodeWrap.Data.Workload)
					}
				}
			}
		}
	}

	return nil
}
