package peerauthentications

import (
	networking_v1alpha3 "istio.io/client-go/pkg/apis/networking/v1alpha3"
	security_v1beta "istio.io/client-go/pkg/apis/security/v1beta1"

	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
)

type DisabledNamespaceWideChecker struct {
	PeerAuthn        security_v1beta.PeerAuthentication
	DestinationRules []networking_v1alpha3.DestinationRule
}

func (c DisabledNamespaceWideChecker) Check() ([]*models.IstioCheck, bool) {
	validations := make([]*models.IstioCheck, 0)

	// Validation only affects to PeerAuthn disabling mTLS
	if _, mode := kubernetes.PeerAuthnHasMTLSEnabled(c.PeerAuthn); mode != "DISABLE" {
		return validations, true
	}

	nsDisableDRFound := false
	meshEnabledDRFound := false
	for _, dr := range c.DestinationRules {
		// If ns-wide Destination Rule enabling mtls found, error found
		_, mode := kubernetes.DestinationRuleHasNamespaceWideMTLSEnabled(c.PeerAuthn.Namespace, dr)
		if mode == "ISTIO_MUTUAL" || mode == "MUTUAL" {
			check := models.Build("peerauthentications.mtls.disabledestinationrulemissing", "spec/mtls")
			return append(validations, &check), false
		} else if mode == "DISABLE" {
			nsDisableDRFound = true
			break
		}

		if _, mode := kubernetes.DestinationRuleHasMeshWideMTLSEnabled(dr); mode == "ISTIO_MUTUAL" || mode == "MUTUAL" {
			meshEnabledDRFound = true
		}
	}

	if nsDisableDRFound {
		return validations, true
	}

	if meshEnabledDRFound {
		check := models.Build("peerauthentications.mtls.disabledestinationrulemissing", "spec/mtls")
		return append(validations, &check), false
	}

	return validations, true
}
