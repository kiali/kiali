package authorization

import (
	"fmt"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
	"reflect"
)

type FromNamespaceChecker struct {
	AuthorizationPolicy kubernetes.IstioObject
	Namespaces          models.NamespaceNames
}

func (ap FromNamespaceChecker) Check() ([]*models.IstioCheck, bool) {
	checks, valid := make([]*models.IstioCheck, 0), true

	// Getting rules array. If not present, quitting validation.
	rulesStct, ok := ap.AuthorizationPolicy.GetSpec()["rules"]
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
		if !ok || rule["from"] == nil {
			continue
		}

		fromChecks, fromValid := ap.validateFromField(ruleIdx, rule["from"])
		checks = append(checks, fromChecks...)
		valid = valid && fromValid
	}

	return checks, valid
}

func (ap FromNamespaceChecker) validateFromField(ruleIdx int, from interface{}) ([]*models.IstioCheck, bool) {
	fromSl, ok := from.([]interface{})
	if !ok {
		return nil, true
	}

	checks, valid := make([]*models.IstioCheck, 0, len(fromSl)), true
	for fromIdx, fromStc := range fromSl {
		fromMap, ok := fromStc.(map[string]interface{})
		if !ok {
			continue
		}

		sourceMap, ok := fromMap["source"].(map[string]interface{})
		if !ok {
			continue
		}

		nsList, ok := sourceMap["namespaces"].([]interface{})
		if !ok {
			continue
		}

		for i, n := range nsList {
			if !ap.Namespaces.Includes(n.(string)) {
				valid = false
				path := fmt.Sprintf("spec/rules[%d]/from[%d]/source/namespaces[%d]", ruleIdx, fromIdx, i)
				validation := models.Build("authorizationpolicy.source.namespacenotfound", path)
				checks = append(checks, &validation)
			}
		}
	}

	return checks, valid
}
