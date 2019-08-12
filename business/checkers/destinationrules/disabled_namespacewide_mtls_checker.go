package destinationrules

import (
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
)

type DisabledNamespaceWideMTLSChecker struct {
	DestinationRule kubernetes.IstioObject
	MTLSDetails     kubernetes.MTLSDetails
}

// Check if a the Policy is allows non-mtls traffic when DestinationRule explicitly disables mTLS ns-wide
func (m DisabledNamespaceWideMTLSChecker) Check() ([]*models.IstioCheck, bool) {
	validations := make([]*models.IstioCheck, 0)

	// Stop validation if DestinationRule doesn't explicitly disables mTLS
	if _, mode := kubernetes.DestinationRuleHasNamespaceWideMTLSEnabled(m.DestinationRule.GetObjectMeta().Namespace, m.DestinationRule); mode != "DISABLE" {
		return validations, true
	}

	// otherwise, check among Policies for a rule enabling mTLS
	for _, mp := range m.MTLSDetails.Policies {
		if enabled, mode := kubernetes.PolicyHasMTLSEnabled(mp); enabled {
			// If Policy has mTLS enabled in STRICT mode
			// traffic going through DestinationRule won't work
			if mode != "PERMISSIVE" {
				check := models.Build("destinationrules.mtls.policymtlsenabled", "spec/trafficPolicy/tls/mode")
				return append(validations, &check), false
			} else {
				// If Policy has mTLS enabled in PERMISSIVE mode
				// traffic going through DestinationRule will work
				// no need for further analysis in MeshPolicies
				return validations, true
			}
		}
	}

	// In case any Policy enables mTLS, check among MeshPolicies for a rule enabling it
	// ServiceMeshPolicies are a clone of MeshPolicies but used in Maistra scenarios
	// MeshPolicies and ServiceMeshPolicies won't co-exist, only ony array will be populated
	mPolicies := m.MTLSDetails.MeshPolicies
	checkerId := "destinationrules.mtls.meshpolicymtlsenabled"
	if m.MTLSDetails.ServiceMeshPolicies != nil {
		mPolicies = m.MTLSDetails.ServiceMeshPolicies
		checkerId = "destinationrules.mtls.servicemeshpolicymtlsenabled"
	}
	for _, mp := range mPolicies {
		if strictMode := kubernetes.PolicyHasStrictMTLS(mp); strictMode {
			check := models.Build(checkerId, "spec/trafficPolicy/tls/mode")
			return append(validations, &check), false
		}
	}

	return validations, true
}
