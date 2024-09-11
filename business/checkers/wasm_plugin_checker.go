package checkers

import (
	extentions_v1alpha1 "istio.io/client-go/pkg/apis/extensions/v1alpha1"

	"github.com/kiali/kiali/models"
)

type WasmPluginChecker struct {
	Namespaces  models.Namespaces
	WasmPlugins []*extentions_v1alpha1.WasmPlugin
}

// An Object Checker runs all checkers for an specific object type (i.e.: pod, route rule,...)
// It run two kinds of checkers:
// 1. Individual checks: validating individual objects.
// 2. Group checks: validating behaviour between configurations.
func (in WasmPluginChecker) Check() models.IstioValidations {
	validations := models.IstioValidations{}

	return validations
}
