package authorization

import (
	"fmt"
	"reflect"
	"regexp"
	"strings"

	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/util/httputil"
)

const grpcFQDN = `^((\/[a-zA-Z\.]+)+)(\/[a-zA-Z]+)$`

type NamespaceMethodChecker struct {
	AuthorizationPolicy kubernetes.IstioObject
	Namespaces          models.NamespaceNames
}

func (ap NamespaceMethodChecker) Check() ([]*models.IstioCheck, bool) {
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
		if !ok || rule == nil {
			continue
		}

		if rule["from"] != nil {
			toChecks, toValid := ap.validateFromField(ruleIdx, rule["from"])
			checks = append(checks, toChecks...)
			valid = valid && toValid
		}

		if rule["to"] != nil {
			fromChecks, fromValid := ap.validateToField(ruleIdx, rule["to"])
			checks = append(checks, fromChecks...)
			valid = valid && fromValid
		}

	}

	return checks, valid
}

func (ap NamespaceMethodChecker) validateFromField(ruleIdx int, from interface{}) ([]*models.IstioCheck, bool) {
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
				valid = true
				path := fmt.Sprintf("spec/rules[%d]/from[%d]/source/namespaces[%d]", ruleIdx, fromIdx, i)
				validation := models.Build("authorizationpolicy.source.namespacenotfound", path)
				checks = append(checks, &validation)
			}
		}
	}

	return checks, valid
}

func (ap NamespaceMethodChecker) validateToField(ruleIdx int, to interface{}) ([]*models.IstioCheck, bool) {
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

		mthdList, ok := sourceMap["methods"].([]interface{})
		if !ok {
			continue
		}

		for i, m := range mthdList {
			if !validMethod(m.(string)) {
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
	validGRPCMethod := regexp.MustCompile(grpcFQDN)

	for _, httpMethod := range httputil.HttpMethods() {
		// HTTP methods allowed or
		// For gRPC service, a fully-qualified name like “/package.service/method”
		valid = valid || (strings.TrimSpace(strings.ToUpper(m)) == httpMethod || validGRPCMethod.MatchString(m))
	}

	return valid
}
