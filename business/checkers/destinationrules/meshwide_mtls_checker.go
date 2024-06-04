package destinationrules

import (
	networking_v1 "istio.io/client-go/pkg/apis/networking/v1"

	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
)

type MeshWideMTLSChecker struct {
	DestinationRule *networking_v1.DestinationRule
	MTLSDetails     kubernetes.MTLSDetails
}

func (m MeshWideMTLSChecker) Check() ([]*models.IstioCheck, bool) {
	validations := make([]*models.IstioCheck, 0)

	// if DestinationRule doesn't enable mTLS, stop validation with any check
	if enabled, _ := kubernetes.DestinationRuleHasMeshWideMTLSEnabled(m.DestinationRule); !enabled {
		return validations, true
	}

	// otherwise, check among MeshPeerAuthentications for a rule enabling mesh-wide mTLS
	for _, mp := range m.MTLSDetails.MeshPeerAuthentications {
		if enabled, _ := kubernetes.PeerAuthnHasMTLSEnabled(mp); enabled {
			return validations, true
		}
	}

	check := models.Build("destinationrules.mtls.meshpolicymissing", "spec/trafficPolicy/tls/mode")
	validations = append(validations, &check)

	return validations, false
}
