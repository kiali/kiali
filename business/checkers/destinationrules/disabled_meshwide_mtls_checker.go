package destinationrules

import (
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
)

type DisabledMeshWideMTLSChecker struct {
	DestinationRule kubernetes.IstioObject
	MeshPeerAuthns  []kubernetes.IstioObject
}

func (c DisabledMeshWideMTLSChecker) Check() ([]*models.IstioCheck, bool) {
	validations := make([]*models.IstioCheck, 0)

	if _, mode := kubernetes.DestinationRuleHasMeshWideMTLSEnabled(c.DestinationRule); mode != "DISABLE" {
		return validations, true
	}

	for _, pa := range c.MeshPeerAuthns {
		if _, mode := kubernetes.PeerAuthnHasMTLSEnabled(pa); mode == "STRICT" {
			check := models.Build("destinationrules.mtls.meshpolicymtlsenabled", "spec/trafficPolicy/tls/mode")
			return append(validations, &check), false
		}
	}

	return validations, true
}
