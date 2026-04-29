package mcputil

// Default values for Kiali API parameters shared across this package.
const (
	// DefaultRateInterval is the default rate interval for fetching error rates and metrics.
	// This value is used when rateInterval is not explicitly provided in API calls.
	DefaultRateInterval    = "10m"
	DefaultGraphType       = "versionedApp"
	DefaultDuration        = "30m"
	DefaultStep            = "15"
	DefaultDirection       = "outbound"
	DefaultReporter        = "source"
	DefaultRequestProtocol = "http"
	DefaultQuantiles       = "0.5,0.95,0.99,0.999"
	DefaultLimit           = "100"
	DefaultTail            = "100"

	// Default graph parameters
	DefaultIncludeIdleEdges   = "false"
	DefaultInjectServiceNodes = "true"
	DefaultBoxBy              = "cluster,namespace,app"
	DefaultAmbientTraffic     = "none"
	DefaultAppenders          = "deadNode,istio,serviceEntry,meshCheck,workloadEntry,health"
	DefaultRateGrpc           = "requests"
	DefaultRateHttp           = "requests"
	DefaultRateTcp            = "sent"

	// Default mesh status parameters
	DefaultIncludeGateways  = "false"
	DefaultIncludeWaypoints = "false"

	// Default traces
	DefaultLookbackSeconds = 600 // 10m
	DefaultMaxSpans        = 7
	DefaultTracesLimit     = 10
)
