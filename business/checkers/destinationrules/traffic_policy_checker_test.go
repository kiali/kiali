package destinationrules

import "testing"

// Context: MeshPolicy Enabling mTLS
// Context: DestinationRule doesn't specify trafficPolicy
// It returns a validation
func TestMTLSMeshWideEnabledDRWithoutTrafficPolicy(t *testing.T) {

}

// Context: MeshPolicy Enabling mTLS
// Context: DestinationRule does specify trafficPolicy
// It doesn't return any validation
func TestMTLSMeshWideEnabledDRWithTrafficPolicy(t *testing.T) {

}

// Context: Namespace-wide mTLS enabled
// Context: DestinationRule doesn't specify trafficPolicy
// It returns a validation
func TestNamespacemTLSEnabledDRWithoutTrafficPolicy(t *testing.T) {

}

// Context: Namespace-wide mTLS enabled
// Context: DestinationRule does specify trafficPolicy
// It doesn't return any validation
func TestNamespacemTLSEnabledDRWithTrafficPolicy(t *testing.T) {

}
