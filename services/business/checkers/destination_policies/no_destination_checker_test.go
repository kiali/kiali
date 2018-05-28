package destination_policies

import (
	"testing"

	"github.com/stretchr/testify/assert"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kiali/kiali/kubernetes"
)

func TestValidDestination(t *testing.T) {
	assert := assert.New(t)

	validations, valid := NoDestinationChecker{
		Namespace:         "test-namespace",
		ServiceNames:      []string{"reviews", "other"},
		DestinationPolicy: fakeNameDestinationPolicy(),
	}.Check()

	assert.True(valid)
	assert.Empty(validations)

	validations, valid = NoDestinationChecker{
		Namespace:         "bookinfo",
		ServiceNames:      []string{"reviews", "other"},
		DestinationPolicy: fakeNameAndNamespaceDestinationPolicy(),
	}.Check()

	assert.True(valid)
	assert.Empty(validations)
}

func TestNoValidDestination(t *testing.T) {
	assert := assert.New(t)

	// reviews is not part of service names
	validations, valid := NoDestinationChecker{
		Namespace:         "test-namespace",
		ServiceNames:      []string{"details", "other"},
		DestinationPolicy: fakeNameDestinationPolicy(),
	}.Check()

	assert.False(valid)
	assert.NotEmpty(validations)
	assert.Equal("error", validations[0].Severity)
	assert.Equal("Destination doesn't have a valid service", validations[0].Message)
	assert.Equal("spec/destination", validations[0].Path)

	// reviews belongs to bookinfo not test-namespace
	validations, valid = NoDestinationChecker{
		Namespace:         "test-namespace",
		ServiceNames:      []string{"reviews", "other"},
		DestinationPolicy: fakeNameAndNamespaceDestinationPolicy(),
	}.Check()

	assert.False(valid)
	assert.NotEmpty(validations)
	assert.Equal("error", validations[0].Severity)
	assert.Equal("Destination doesn't have a valid service", validations[0].Message)
	assert.Equal("spec/destination", validations[0].Path)
}

func fakeNameDestinationPolicy() kubernetes.IstioObject {
	destinationDP := kubernetes.DestinationPolicy{
		ObjectMeta: meta_v1.ObjectMeta{
			Name: "reviews-destination-name",
		},
		Spec: map[string]interface{}{
			"destination": map[string]interface{}{
				"name": "reviews",
			},
		},
	}
	return &destinationDP
}

func fakeNameAndNamespaceDestinationPolicy() kubernetes.IstioObject {
	destinationDP := kubernetes.DestinationPolicy{
		ObjectMeta: meta_v1.ObjectMeta{
			Name: "reviews-destination-name-namespace",
		},
		Spec: map[string]interface{}{
			"destination": map[string]interface{}{
				"namespace": "bookinfo",
				"name":      "reviews",
			},
		},
	}
	return &destinationDP
}
