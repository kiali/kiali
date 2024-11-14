package checkers

import (
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/kiali/kiali/models"
)

type Checker interface {
	Check() ([]*models.IstioCheck, bool)
}

type GroupChecker interface {
	Check() models.IstioValidations
}

type ObjectChecker interface {
	Check() models.IstioValidations
}

// EmptyValidValidation returns a stub validation object which can be used by checkers
func EmptyValidValidations(name, namespace string, objectGVK schema.GroupVersionKind, cluster string) models.IstioValidations {
	key, emptyValidation := EmptyValidValidation(name, namespace, objectGVK, cluster)
	return models.IstioValidations{key: emptyValidation}
}

func EmptyValidValidation(name, namespace string, objectGVK schema.GroupVersionKind, cluster string) (models.IstioValidationKey, *models.IstioValidation) {
	key := models.IstioValidationKey{Name: name, Namespace: namespace, ObjectGVK: objectGVK, Cluster: cluster}
	emptyValidation := &models.IstioValidation{
		Cluster:   key.Cluster,
		Name:      key.Name,
		Namespace: key.Namespace,
		ObjectGVK: key.ObjectGVK,
		Valid:     true,
		Checks:    []*models.IstioCheck{},
	}

	return key, emptyValidation
}
