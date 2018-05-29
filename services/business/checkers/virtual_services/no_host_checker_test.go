package virtual_services

import (
	"testing"

	"github.com/stretchr/testify/assert"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kiali/kiali/kubernetes"
)

func TestValidHost(t *testing.T) {
	assert := assert.New(t)

	validations, valid := NoHostChecker{
		Namespace:      "test-namespace",
		ServiceNames:   []string{"reviews", "other"},
		VirtualService: fakeVirtualService(),
	}.Check()

	assert.True(valid)
	assert.Empty(validations)
}

func TestNoValidHost(t *testing.T) {
	assert := assert.New(t)

	validations, valid := NoHostChecker{
		Namespace:      "test-namespace",
		ServiceNames:   []string{"details", "other"},
		VirtualService: fakeVirtualService(),
	}.Check()

	assert.False(valid)
	assert.NotEmpty(validations)
	assert.Equal("error", validations[0].Severity)
	assert.Equal("Hosts doesn't have a valid service", validations[0].Message)
	assert.Equal("spec/hosts", validations[0].Path)
}

func fakeVirtualService() kubernetes.IstioObject {
	virtualService := kubernetes.VirtualService{
		ObjectMeta: meta_v1.ObjectMeta{
			Name: "reviews",
		},
		Spec: map[string]interface{}{
			"hosts": []interface{}{
				"reviews",
			},
		},
	}
	return &virtualService
}
