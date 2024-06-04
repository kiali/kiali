package authorization

import (
	"fmt"
	"regexp"
	"strings"

	api_security_v1 "istio.io/api/security/v1"
	security_v1 "istio.io/client-go/pkg/apis/security/v1"

	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/util/httputil"
)

var methodMatcher = regexp.MustCompile(`^((\/[a-zA-Z\.]+)+)(\/[a-zA-Z]+)$`)

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
	valid := false

	for _, httpMethod := range httputil.HttpMethods() {
		// HTTP methods allowed or
		// For gRPC service, a fully-qualified name like “/package.service/method”
		valid = valid || (strings.TrimSpace(strings.ToUpper(m)) == httpMethod || methodMatcher.MatchString(m))
	}

	return valid
}
