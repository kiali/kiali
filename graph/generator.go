package graph

// GeneratorVendor is an interface that must be satisfied for each config generator implementation.
type GeneratorVendor interface {

	// NewConfig must be implemented to satisfy GeneratorVendor.  It must produce a valid
	// Config for the provided TrafficMap, It is recommended to use the graph/util.go definitions for
	// error handling. Refer to the Cytoscape implementation as an example.
	NewConfig(trafficMap TrafficMap, o VendorOptions) interface{}
}
