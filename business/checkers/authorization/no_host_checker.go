package authorization

import (
	"fmt"
	"reflect"
	"strings"

	core_v1 "k8s.io/api/core/v1"

	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
)

type NoHostChecker struct {
	AuthorizationPolicy kubernetes.IstioObject
	Namespace           string
	Namespaces          models.Namespaces
	ServiceEntries      map[string][]string
	Services            []core_v1.Service
}

func (n NoHostChecker) Check() ([]*models.IstioCheck, bool) {
	checks, valid := make([]*models.IstioCheck, 0), true

	// Getting rules array. If not present, quitting validation.
	rulesStct, ok := n.AuthorizationPolicy.GetSpec()["rules"]
	if !ok {
		return checks, valid
	}

	// Getting slice of Rules. Quitting if not an slice.
	rules := reflect.ValueOf(rulesStct)
	if rules.Kind() != reflect.Slice {
		return checks, valid
	}

	for ruleIdx := 0; ruleIdx < rules.Len(); ruleIdx++ {
		rule, ok := rules.Index(ruleIdx).Interface().(map[string]interface{})
		if !ok || rule == nil {
			continue
		}

		if rule["to"] != nil {
			fromChecks, fromValid := n.validateHost(ruleIdx, rule["to"])
			checks = append(checks, fromChecks...)
			valid = valid && fromValid
		}

	}
	return checks, valid
}

func (n NoHostChecker) validateHost(ruleIdx int, to interface{}) ([]*models.IstioCheck, bool) {
	toSl, ok := to.([]interface{})
	if !ok {
		return nil, true
	}

	checks, valid := make([]*models.IstioCheck, 0, len(toSl)), true
	for toIdx, toStc := range toSl {
		toMap, ok := toStc.(map[string]interface{})
		if !ok {
			continue
		}

		sourceMap, ok := toMap["operation"].(map[string]interface{})
		if !ok {
			continue
		}

		hostList, ok := sourceMap["hosts"].([]interface{})
		if !ok {
			continue
		}

		for hostIdx, h := range hostList {
			if dHost, ok := h.(string); ok {
				fqdn := kubernetes.GetHost(dHost, n.AuthorizationPolicy.GetObjectMeta().Namespace, n.AuthorizationPolicy.GetObjectMeta().ClusterName, n.Namespaces.GetNames())
				if !n.hasMatchingService(fqdn, n.AuthorizationPolicy.GetObjectMeta().Namespace) {
					path := fmt.Sprintf("spec/rules[%d]/to[%d]/operation/hosts[%d]", ruleIdx, toIdx, hostIdx)
					if fqdn.Namespace != n.AuthorizationPolicy.GetObjectMeta().Namespace && fqdn.Namespace != "" {
						validation := models.Build("validation.unable.cross-namespace", path)
						valid = valid && true
						checks = append(checks, &validation)
					} else {
						validation := models.Build("authorizationpolicy.nodest.matchingregistry", path)
						valid = false
						checks = append(checks, &validation)
					}
				}
			}
		}
	}

	return checks, valid
}

func (n NoHostChecker) hasMatchingService(host kubernetes.Host, itemNamespace string) bool {
	// Covering 'servicename.namespace' host format scenario
	localSvc, localNs := kubernetes.ParseTwoPartHost(host)

	// Check wildcard hosts - needs to match "*" and "*.suffix" also..
	if strings.HasPrefix(host.Service, "*") && localNs == itemNamespace {
		return true
	}

	// Only find matches for workloads and services in the same namespace
	if localNs == itemNamespace {
		// Check ServiceNames
		if matches := kubernetes.HasMatchingServices(localSvc, n.Services); matches {
			return matches
		}
	}

	// Otherwise Check ServiceEntries
	return kubernetes.HasMatchingServiceEntries(host.Service, n.ServiceEntries)
}
