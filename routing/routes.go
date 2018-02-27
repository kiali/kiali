package routing

import (
	"net/http"

	"github.com/swift-sunshine/swscore/handlers"
)

// Route describes a single route
type Route struct {
	Name        string
	Method      string
	Pattern     string
	HandlerFunc http.HandlerFunc
}

// Routes holds an array of Route
type Routes struct {
	Routes []Route
}

// NewRoutes creates and returns all the API routes
func NewRoutes() (r *Routes) {
	r = new(Routes)

	r.Routes = []Route{
		{
			"Root",
			"GET",
			"/api",
			handlers.Root,
		},
		{
			"ServiceList",
			"GET",
			"/api/namespaces/{namespace}/services",
			handlers.ServiceList,
		},
		{
			"ServiceDetails",
			"GET",
			"/api/namespaces/{namespace}/services/{service}",
			handlers.ServiceDetails,
		},
		{
			"NamespaceList",
			"GET",
			"/api/namespaces",
			handlers.NamespaceList,
		},
		{
			"ServiceMetrics",
			"GET",
			"/api/namespaces/{namespace}/services/{service}/metrics",
			handlers.ServiceMetrics,
		},
		{
			// Supported query parameters:
			// vendor:         cytoscape (default) | vizceral
			// metric:         Prometheus metric name used to generate the dependency graph (default=istio_request_count)
			// groupByVersion: visually group versions of the same service (cytoscape only, default true)
			// offset:         Duration indicating desired query offset (default 0m)
			// interval:       Duration indicating desired query period (default 10m)

			"GraphNamespace",
			"GET",
			"/api/namespaces/{namespace}/graphs",
			handlers.GraphNamespace,
		},
		{
			// Supported query parameters:
			// vendor:         cytoscape (default)
			// metric:         Prometheus metric name used to generate the dependency graph (default=istio_request_count)
			// groupByVersion: visually group versions of the same service (cytoscape only, default true)
			// offset:         Duration indicating desired query offset (default 0m)
			// interval:       Duration indicating desired query period (default 10m)

			"GraphService",
			"GET",
			"/api/namespaces/{namespace}/services/{service}/graphs",
			handlers.GraphService,
		},
		{
			"GrafanaURL",
			"GET",
			"/api/grafana",
			handlers.GetGrafanaURL,
		},
	}

	return
}
