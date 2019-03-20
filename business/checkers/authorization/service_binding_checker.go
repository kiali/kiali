package authorization

import (
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
)

type BindingChecker struct {
	ServiceRoles       []kubernetes.IstioObject
	ServiceRoleBinding kubernetes.IstioObject
}

func (sc BindingChecker) Check() ([]*models.IstioCheck, bool) {
	validations := make([]*models.IstioCheck, 0)

	if roleRefSpec, found := sc.ServiceRoleBinding.GetSpec()["roleRef"]; found {
		if roleRef, ok := roleRefSpec.(map[string]interface{}); ok {
			if roleKind, found := roleRef["kind"]; found && roleKind == "ServiceRole" {
				if roleName, found := roleRef["name"]; found {
					if roleRefName, ok := roleName.(string); ok {
						if !sc.checkMatch(roleRefName) {
							validation := models.Build("servicerolebinding.invalid.role", "spec/roleRef/name")
							validations = append(validations, &validation)
						}
					}
				}
			}
		}
	}

	return validations, len(validations) == 0
}

func (sc BindingChecker) checkMatch(roleRefName string) bool {
	for _, sr := range sc.ServiceRoles {
		if roleRefName == sr.GetObjectMeta().Name {
			return true
		}
	}
	return false
}
