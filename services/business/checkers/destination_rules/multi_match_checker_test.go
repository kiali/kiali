package destination_rules

import (
	"testing"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/services/models"
	"github.com/stretchr/testify/assert"

	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func TestMultiHostMatchCorrect(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	destinationRules := []kubernetes.IstioObject{
		fakeHostDestinationRule("rule1", "host1"),
		fakeHostDestinationRule("rule2", "host2"),
	}

	validations := MultiMatchChecker{
		DestinationRules: destinationRules,
	}.Check()

	assert.Empty(validations)
	validation, ok := validations[models.IstioValidationKey{"destinationrules", "rule2"}]
	assert.False(ok)
	assert.Nil(validation)
}

func TestMultiHostMatchInvalid(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	destinationRules := []kubernetes.IstioObject{
		fakeHostDestinationRule("rule1", "host1"),
		fakeHostDestinationRule("rule2", "host1"),
	}

	validations := MultiMatchChecker{
		DestinationRules: destinationRules,
	}.Check()

	assert.NotEmpty(validations)
	validation, ok := validations[models.IstioValidationKey{"destinationrules", "rule2"}]
	assert.True(ok)
	assert.True(validation.Valid) // As long as it is warning, this is true
	assert.NotEmpty(validation.Checks)
	assert.Equal("warning", validation.Checks[0].Severity)
}

func fakeHostDestinationRule(name string, host string) kubernetes.IstioObject {
	destinationRule := kubernetes.DestinationRule{
		ObjectMeta: meta_v1.ObjectMeta{
			Name: name,
		},
		Spec: map[string]interface{}{
			"host": host,
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
