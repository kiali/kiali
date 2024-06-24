package sidecars

import (
	networking_v1 "istio.io/client-go/pkg/apis/networking/v1"

	"github.com/kiali/kiali/models"
)

type OutboundTrafficPolicyModeChecker struct {
	Sidecar *networking_v1.Sidecar
}

func (c OutboundTrafficPolicyModeChecker) Check() ([]*models.IstioCheck, bool) {
	checks := make([]*models.IstioCheck, 0)

	// read this issue to find out why we do this check: https://github.com/kiali/kiali/issues/5882
	if c.Sidecar.Spec.OutboundTrafficPolicy != nil {
		if c.Sidecar.Spec.OutboundTrafficPolicy.Mode.Number() == 0 {
			check := models.Build("sidecar.outboundtrafficpolicy.mode.ambiguous", "spec/outboundTrafficPolicy")
			checks = append(checks, &check)
		}
	}

	return checks, true
}
