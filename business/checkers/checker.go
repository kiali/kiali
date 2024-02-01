package checkers

import "github.com/kiali/kiali/models"

type Checker interface {
	Check() ([]*models.IstioCheck, bool)
}

type GroupChecker interface {
	Check() models.IstioValidations
}

// EmptyValidValidation returns a stub validation object which can be used by checkers
func EmptyValidValidations(name, namespace, objectType, cluster string) models.IstioValidations {
	key, emptyValidation := EmptyValidValidation(name, namespace, objectType, cluster)
	return models.IstioValidations{key: emptyValidation}
}

func EmptyValidValidation(name, namespace, objectType, cluster string) (models.IstioValidationKey, *models.IstioValidation) {
	key := models.IstioValidationKey{Name: name, Namespace: namespace, ObjectType: objectType, Cluster: cluster}
	emptyValidation := &models.IstioValidation{
		Cluster:    key.Cluster,
		Name:       key.Name,
		Namespace:  key.Namespace,
		ObjectType: key.ObjectType,
		Valid:      true,
		Checks:     []*models.IstioCheck{},
	}

	return key, emptyValidation
}
