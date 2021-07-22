package common

import (
	"fmt"

	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
)

type ExportToNamespaceChecker struct {
	IstioObject kubernetes.IstioObject
	Namespaces  models.Namespaces
}

func (p ExportToNamespaceChecker) Check() ([]*models.IstioCheck, bool) {
	validations := make([]*models.IstioCheck, 0)

	if exportToSpec, found := p.IstioObject.GetSpec()["exportTo"]; found {
		if namespaces, ok := exportToSpec.([]interface{}); ok {
			for nsIndex, namespace := range namespaces {
				if namespace != "." && !p.Namespaces.Includes(namespace.(string)) {
					validation := models.Build("generic.exportto.namespacenotfound",
						fmt.Sprintf("spec/exportTo[%d]", nsIndex))
					validations = append(validations, &validation)
				}
			}
		}
	}

	return validations, len(validations) == 0
}
