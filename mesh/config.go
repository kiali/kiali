package mesh

// ConfigVendor is an interface that must be satisfied for each config vendor implementation.
type ConfigVendor interface {

	// NewConfig is required by the ConfigVendor interface.  It must produce a valid
	// Config for the provided TrafficMap, It is recommended to use the graph/util.go
	// definitions for error handling. Refer to the Cytoscape implementation as an example.
	NewConfig(meshMap MeshMap, o ConfigOptions) interface{}
}
