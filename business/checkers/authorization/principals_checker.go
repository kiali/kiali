package authorization

import (
	"fmt"

	api_security_v1beta "istio.io/api/security/v1beta1"
	security_v1beta "istio.io/client-go/pkg/apis/security/v1beta1"

	"github.com/kiali/kiali/models"
)

type PrincipalsChecker struct {
	AuthorizationPolicy security_v1beta.AuthorizationPolicy
	ServiceAccounts     []string
}

func (pc PrincipalsChecker) Check() ([]*models.IstioCheck, bool) {
	checks, valid := make([]*models.IstioCheck, 0), true

	for ruleIdx, rule := range pc.AuthorizationPolicy.Spec.Rules {
		if rule == nil {
			continue
		}
		if len(rule.From) > 0 {
			toChecks, toValid := pc.validateFromField(ruleIdx, rule.From)
			checks = append(checks, toChecks...)
			valid = valid && toValid
		}
	}
	return checks, valid
}

func (pc PrincipalsChecker) validateFromField(ruleIdx int, from []*api_security_v1beta.Rule_From) ([]*models.IstioCheck, bool) {
	if len(from) == 0 {
		return nil, true
	}

	checks, valid := make([]*models.IstioCheck, 0, len(from)), true
	for fromIdx, f := range from {
		if f == nil {
			continue
		}

		if f.Source == nil {
			continue
		}

		if len(f.Source.Principals) == 0 {
			continue
		}

		for i, p := range f.Source.Principals {
			if !pc.hasMatchingServiceAccount(p) {
				valid = false
				path := fmt.Sprintf("spec/rules[%d]/from[%d]/source/principals[%d]", ruleIdx, fromIdx, i)
				validation := models.Build("authorizationpolicy.source.principalnotfound", path)
				checks = append(checks, &validation)
			}
		}
	}

	return checks, valid
}

func (pc PrincipalsChecker) hasMatchingServiceAccount(principal string) bool {
	for _, sa := range pc.ServiceAccounts {
		if sa == principal {
			return true
		}
	}

	return false
}
