package log

// these are variables used to define logger group names
// see log.WithGroup for when these are typically used
var (
	AuthenticateLogName = "authenticate"
	ClustersLogName     = "clusters"
	ConfigLogName       = "config"
	GraphLogName        = "graph"
	IstioConfigLogName  = "istioConfig"
	KialiCacheLogName   = "kialiCache"
	MeshLogName         = "mesh"
	MetricsLogName      = "metrics"
	PromCacheLogName    = "promCache"
	PrometheusLogName   = "prometheus"
	ResourcesLogName    = "resources"
	StatusLogName       = "status"
	TracingLogName      = "tracing"
	ValidationLogName   = "validation"
)

// these are structured attribute key names for log messages
var (
	GraphAppenderLogName = "appender"
	GroupLogName         = "group"
	RouteLogName         = "route"
	RoutePatternLogName  = "route-pattern"
)
