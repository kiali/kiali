package checkers

import (
	"testing"

	"github.com/stretchr/testify/assert"
	extentions_v1alpha1 "istio.io/client-go/pkg/apis/extensions/v1alpha1"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kiali/kiali/models"
)

func TestTrafficExtensionCheckerReturnsNoValidations(t *testing.T) {
	checker := TrafficExtensionChecker{
		Namespaces: models.Namespaces{},
		TrafficExtensions: []*extentions_v1alpha1.TrafficExtension{
			{ObjectMeta: meta_v1.ObjectMeta{Name: "my-filter", Namespace: "test"}},
		},
	}

	validations := checker.Check()
	assert.NotNil(t, validations)
	assert.Empty(t, validations)
}

func TestTrafficExtensionCheckerHandlesNilList(t *testing.T) {
	checker := TrafficExtensionChecker{
		Namespaces:        models.Namespaces{},
		TrafficExtensions: nil,
	}

	validations := checker.Check()
	assert.NotNil(t, validations)
	assert.Empty(t, validations)
}

func TestTrafficExtensionCheckerHandlesMultipleItems(t *testing.T) {
	checker := TrafficExtensionChecker{
		Namespaces: models.Namespaces{},
		TrafficExtensions: []*extentions_v1alpha1.TrafficExtension{
			{ObjectMeta: meta_v1.ObjectMeta{Name: "filter-a", Namespace: "ns1"}},
			{ObjectMeta: meta_v1.ObjectMeta{Name: "filter-b", Namespace: "ns1"}},
			{ObjectMeta: meta_v1.ObjectMeta{Name: "filter-c", Namespace: "ns2"}},
		},
	}

	validations := checker.Check()
	assert.NotNil(t, validations)
	assert.Empty(t, validations)
}
