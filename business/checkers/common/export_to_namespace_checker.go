package common

import (
	"fmt"

	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/util/sliceutil"
)

type ExportToNamespaceChecker struct {
	ExportTo   []string
	Namespaces []string
}

func (p ExportToNamespaceChecker) Check() ([]*models.IstioCheck, bool) {
	validations := make([]*models.IstioCheck, 0)

	if len(p.ExportTo) > 0 {
		for nsIndex, namespace := range p.ExportTo {
			if namespace != "." && namespace != "*" && !sliceutil.SomeString(p.Namespaces, namespace) {
				validation := models.Build("generic.exportto.namespacenotfound",
					fmt.Sprintf("spec/exportTo[%d]", nsIndex))
				validations = append(validations, &validation)
			}
		}
	}

	return validations, len(validations) == 0
}
