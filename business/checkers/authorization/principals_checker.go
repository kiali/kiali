package authorization

import (
	"fmt"
	"regexp"
	"strings"

	api_security_v1 "istio.io/api/security/v1"
	security_v1 "istio.io/client-go/pkg/apis/security/v1"

	"github.com/kiali/kiali/models"
)

type PrincipalsChecker struct {
	AuthorizationPolicy *security_v1.AuthorizationPolicy
	Cluster             string
	ServiceAccounts     map[string][]string
}

const (
	wildCardMatch = "*"
)

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

func (pc PrincipalsChecker) validateFromField(ruleIdx int, from []*api_security_v1.Rule_From) ([]*models.IstioCheck, bool) {
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
			if !pc.hasMatchingServiceAccount(pc.ServiceAccounts[pc.Cluster], p) {
				path := fmt.Sprintf("spec/rules[%d]/from[%d]/source/principals[%d]", ruleIdx, fromIdx, i)
				valid = false
				if pc.hasMatchingRemoteServiceAccount(p) {
					validation := models.Build("authorizationpolicy.source.principalremote", path)
					checks = append(checks, &validation)
				} else {
					validation := models.Build("authorizationpolicy.source.principalnotfound", path)
					checks = append(checks, &validation)
				}
			}
		}
	}

	return checks, valid
}

func (pc PrincipalsChecker) hasMatchingServiceAccount(serviceAccounts []string, principal string) bool {
	if principal == wildCardMatch {
		return true
	}

	principalRegex := regexpFromPrincipal(principal)
	hasWild := strings.HasPrefix(principal, wildCardMatch) || strings.HasSuffix(principal, wildCardMatch)
	for _, sa := range serviceAccounts {
		if hasWild && principalRegex.MatchString(sa) {
			// Prefix match: “abc*” will match on value “abc” and “abcd”.
			// Suffix match: “*abc” will match on value “abc” and “xabc”.
			return true
		} else if sa == principal {
			return true
		}
	}

	return false
}

func (pc PrincipalsChecker) hasMatchingRemoteServiceAccount(principal string) bool {
	// should check among remote cluster's service accounts
	for cluster, sas := range pc.ServiceAccounts {
		if cluster != pc.Cluster && pc.hasMatchingServiceAccount(sas, principal) {
			return true
		}
	}
	return false
}

func regexpFromPrincipal(principal string) *regexp.Regexp {
	// Replace '*' from principal with regexp '.*'
	escaped := strings.Replace(principal, "*", ".*", -1)

	// We anchor the beginning and end of the string when it's
	// to be used as a regex, so that we don't get spurious
	// substring matches, e.g., "example.com" matching
	// "foo.example.com".
	anchored := strings.Join([]string{"^", escaped, "$"}, "")

	return regexp.MustCompile(anchored)
}
