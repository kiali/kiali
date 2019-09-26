package checkers

import "github.com/kiali/kiali/models"

type Checker interface {
	Check() ([]*models.IstioCheck, bool)
}

type GroupChecker interface {
	Check() models.IstioValidations
}

// EmptyValidValidation returns a stub validation object which can be used by checkers
func EmptyValidValidations(name, namespace, objectType string) models.IstioValidations {
	key, emptyValidation := EmptyValidValidation(name, namespace, objectType)
	return models.IstioValidations{key: emptyValidation}
}

func EmptyValidValidation(name, namespace, objectType string) (models.IstioValidationKey, *models.IstioValidation) {
	key := models.IstioValidationKey{Name: name, Namespace: namespace, ObjectType: objectType}
	emptyValidation := &models.IstioValidation{
		Name:       key.Name,
		ObjectType: key.ObjectType,
		Valid:      true,
		Checks:     []*models.IstioCheck{},
	}

	return key, emptyValidation
}
