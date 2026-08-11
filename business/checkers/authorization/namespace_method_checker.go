package authorization

import (
	"fmt"
	"strings"

	api_security_v1 "istio.io/api/security/v1"
	security_v1 "istio.io/client-go/pkg/apis/security/v1"

	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/util/httputil"
)

type NamespaceMethodChecker struct {
	AuthorizationPolicy *security_v1.AuthorizationPolicy
	Namespaces          models.NamespaceNames
}

func (ap NamespaceMethodChecker) Check() ([]*models.IstioCheck, bool) {
	checks, valid := make([]*models.IstioCheck, 0), true

	for ruleIdx, rule := range ap.AuthorizationPolicy.Spec.Rules {
		if rule == nil {
			continue
		}
		if len(rule.From) > 0 {
			toChecks, toValid := ap.validateFromField(ruleIdx, rule.From)
			checks = append(checks, toChecks...)
			valid = valid && toValid
		}
		if len(rule.To) > 0 {
			fromChecks, fromValid := ap.validateToField(ruleIdx, rule.To)
			checks = append(checks, fromChecks...)
			valid = valid && fromValid
		}
	}
	return checks, valid
}

func (ap NamespaceMethodChecker) validateFromField(ruleIdx int, from []*api_security_v1.Rule_From) ([]*models.IstioCheck, bool) {
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

		if len(f.Source.Namespaces) == 0 {
			continue
		}

		for i, n := range f.Source.Namespaces {
			if !ap.Namespaces.Includes(n) {
				valid = true
				path := fmt.Sprintf("spec/rules[%d]/from[%d]/source/namespaces[%d]", ruleIdx, fromIdx, i)
				validation := models.Build("authorizationpolicy.source.namespacenotfound", path)
				checks = append(checks, &validation)
			}
		}
	}

	return checks, valid
}

func (ap NamespaceMethodChecker) validateToField(ruleIdx int, to []*api_security_v1.Rule_To) ([]*models.IstioCheck, bool) {
	if len(to) == 0 {
		return nil, true
	}

	checks, valid := make([]*models.IstioCheck, 0, len(to)), true
	for toIdx, t := range to {
		if t == nil {
			continue
		}

		if t.Operation == nil {
			continue
		}

		if len(t.Operation.Methods) == 0 {
			continue
		}

		for i, m := range t.Operation.Methods {
			if !validMethod(m) {
				valid = true
				path := fmt.Sprintf("spec/rules[%d]/to[%d]/operation/methods[%d]", ruleIdx, toIdx, i)
				validation := models.Build("authorizationpolicy.to.wrongmethod", path)
				checks = append(checks, &validation)
			}
		}
	}

	return checks, valid
}

func validMethod(m string) bool {
	method := strings.TrimSpace(m)
	if method == "" {
		return false
	}

	// Istio AuthorizationPolicy string fields support Exact / Prefix / Suffix / Presence:
	// https://istio.io/latest/docs/reference/config/security/authorization-policy/
	// Presence match: "*" matches when the HTTP method header is not empty.
	if method == "*" {
		return true
	}

	// Prefix match: "GET*" ; Suffix match: "*ET" (wildcard only at start or end, not both).
	prefixMatch := strings.HasSuffix(method, "*") && !strings.HasPrefix(method, "*")
	suffixMatch := strings.HasPrefix(method, "*") && !strings.HasSuffix(method, "*")

	var pattern string
	switch {
	case prefixMatch:
		pattern = strings.ToUpper(strings.TrimSuffix(method, "*"))
	case suffixMatch:
		pattern = strings.ToUpper(strings.TrimPrefix(method, "*"))
	default:
		pattern = strings.ToUpper(method)
	}

	// methods is the HTTP method (for gRPC this is always POST). gRPC FQNs belong in paths.
	for _, httpMethod := range httputil.HttpMethods() {
		switch {
		case prefixMatch:
			if pattern != "" && strings.HasPrefix(httpMethod, pattern) {
				return true
			}
		case suffixMatch:
			if pattern != "" && strings.HasSuffix(httpMethod, pattern) {
				return true
			}
		default:
			if httpMethod == pattern {
				return true
			}
		}
	}

	return false
}
