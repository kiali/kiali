package checkers

import (
	"github.com/kiali/kiali/models"
	extentions_v1alpha1 "istio.io/client-go/pkg/apis/extensions/v1alpha1"
)

const WasmPluginCheckerType = "wasmplugin"

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
