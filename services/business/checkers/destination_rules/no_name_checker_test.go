package destination_rules

import (
	"github.com/kiali/kiali/kubernetes"
	"github.com/stretchr/testify/assert"
	"testing"
)

func TestValidName(t *testing.T) {
	assert := assert.New(t)

	validations, valid := NoNameChecker{
		Namespace:       "test-namespace",
		ServiceNames:    []string{"reviews", "other"},
		DestinationRule: fakeNameDestinationRule(),
	}.Check()

	assert.True(valid)
	assert.Empty(validations)
}

func TestNoValidName(t *testing.T) {
	assert := assert.New(t)

	// reviews is not part of service names
	validations, valid := NoNameChecker{
		Namespace:       "test-namespace",
		ServiceNames:    []string{"details", "other"},
		DestinationRule: fakeNameDestinationRule(),
	}.Check()

	assert.False(valid)
	assert.NotEmpty(validations)
	assert.Equal("error", validations[0].Severity)
	assert.Equal("Name doesn't have a valid service", validations[0].Message)
	assert.Equal("spec/name", validations[0].Path)
}

func fakeNameDestinationRule() kubernetes.IstioObject {
	destinationRule := kubernetes.DestinationRule{
		Spec: map[string]interface{}{
			"name": "reviews",
			"subsets": []interface{}{
				map[string]interface{}{
					"name": "v1",
					"labels": map[string]interface{}{
						"version": "v1",
					},
				},
				map[string]interface{}{
					"name": "v2",
					"labels": map[string]interface{}{
						"version": "v2",
					},
				},
			},
		},
	}
	return &destinationRule
}
