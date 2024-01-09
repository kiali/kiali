package k8sreferencegrants

import (
	"fmt"

	k8s_networking_v1beta1 "sigs.k8s.io/gateway-api/apis/v1beta1"

	"github.com/kiali/kiali/models"
)

type NamespaceChecker struct {
	Namespaces     models.Namespaces
	ReferenceGrant k8s_networking_v1beta1.ReferenceGrant
}

func (in NamespaceChecker) Check() ([]*models.IstioCheck, bool) {
	validations := make([]*models.IstioCheck, 0)

	if len(in.ReferenceGrant.Spec.From) > 0 {
		for nsIndex, from := range in.ReferenceGrant.Spec.From {
			if !in.Namespaces.Includes(string(from.Namespace)) {
				validation := models.Build("k8sreferencegrants.from.namespacenotfound",
					fmt.Sprintf("spec/from[%d]/namespace", nsIndex))
				validations = append(validations, &validation)
			}
		}
	}

	return validations, len(validations) == 0
}
