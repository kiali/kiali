package destinationrules

import (
	networking_v1 "istio.io/client-go/pkg/apis/networking/v1"

	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
)

type DisabledNamespaceWideMTLSChecker struct {
	DestinationRule *networking_v1.DestinationRule
	MTLSDetails     kubernetes.MTLSDetails
}

// Check if a the PeerAuthn is allows non-mtls traffic when DestinationRule explicitly disables mTLS ns-wide
func (m DisabledNamespaceWideMTLSChecker) Check() ([]*models.IstioCheck, bool) {
	validations := make([]*models.IstioCheck, 0)

	// Stop validation if DestinationRule doesn't explicitly disables mTLS
	if _, mode := kubernetes.DestinationRuleHasNamespaceWideMTLSEnabled(m.DestinationRule.Namespace, m.DestinationRule); mode != "DISABLE" {
		return validations, true
	}

	// otherwise, check among PeerAuthentications for a rule enabling mTLS
	nsDisablePeerAuthnFound := false
	for _, mp := range m.MTLSDetails.PeerAuthentications {
		enabled, mode := kubernetes.PeerAuthnHasMTLSEnabled(mp)
		if enabled {
			// If PeerAuthn has mTLS enabled in STRICT mode
			// traffic going through DestinationRule won't work
			if mode == "STRICT" {
				check := models.Build("destinationrules.mtls.policymtlsenabled", "spec/trafficPolicy/tls/mode")
				return append(validations, &check), false
			} else {
				// If PeerAuthn has mTLS enabled in PERMISSIVE mode
				// traffic going through DestinationRule will work
				// no need for further analysis in MeshPeerAuthentications
				return validations, true
			}
		}
		if mode == "DISABLE" {
			nsDisablePeerAuthnFound = true
		}
	}

	if !nsDisablePeerAuthnFound {
		// In case any PeerAuthn enables mTLS, check among MeshPeerAuthentications for a rule enabling it
		for _, mp := range m.MTLSDetails.MeshPeerAuthentications {
			if strictMode := kubernetes.PeerAuthnHasStrictMTLS(mp); strictMode {
				check := models.Build("destinationrules.mtls.meshpolicymtlsenabled", "spec/trafficPolicy/tls/mode")
				return append(validations, &check), false
			}
		}
	}

	return validations, true
}
