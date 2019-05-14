package business

import (
	"testing"

	"github.com/stretchr/testify/assert"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kiali/kiali/kubernetes"
)

func TestParseIstioConfigForExtract(t *testing.T) {
	assert := assert.New(t)

	newRule := kubernetes.GenericIstioObject{
		TypeMeta: meta_v1.TypeMeta{
			APIVersion: "config.istio.io/v1alpha2",
			Kind:       "rule",
		},
		ObjectMeta: meta_v1.ObjectMeta{
			Name:      "threescale-travel-agency-travels",
			Namespace: "istio-config",
			Labels: map[string]string{
				"kiali_wizard": "travel-agency-travels",
			},
		},
		Spec: map[string]interface{}{
			"match": "destination.service.namespace == \"travel-agency\" && destination.service.name == \"travels\" && destination.labels[\"app\"] == \"travels\"",
			"actions": []interface{}{
				map[string]interface{}{
					"handler": "threescale-travel-agency-travels.istio-system",
					"instances": []interface{}{
						"threescale-authorization-threescale-travel-agency-travels.istio-system",
					},
				},
			},
		},
	}

	threeScaleHandlerName := getThreeScaleRuleDetails(&newRule)

	assert.Equal("threescale-travel-agency-travels", threeScaleHandlerName)
}
