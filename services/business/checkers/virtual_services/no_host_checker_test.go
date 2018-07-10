package virtual_services

import (
	"testing"

	"github.com/stretchr/testify/assert"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kiali/kiali/config"
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
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	virtualService := fakeVirtualService()

	validations, valid := NoHostChecker{
		Namespace:      "test-namespace",
		ServiceNames:   []string{"details", "other"},
		VirtualService: virtualService,
	}.Check()

	assert.False(valid)
	assert.NotEmpty(validations)
	assert.Equal("error", validations[0].Severity)
	assert.Equal("Route doesn't have a valid service", validations[0].Message)
	assert.Equal("spec/http", validations[0].Path)
	assert.Equal("error", validations[1].Severity)
	assert.Equal("Route doesn't have a valid service", validations[1].Message)
	assert.Equal("spec/tcp", validations[1].Path)

	delete(virtualService.GetSpec(), "http")

	validations, valid = NoHostChecker{
		Namespace:      "test-namespace",
		ServiceNames:   []string{"details", "other"},
		VirtualService: virtualService,
	}.Check()

	assert.False(valid)
	assert.NotEmpty(validations)
	assert.Equal("error", validations[0].Severity)
	assert.Equal("Route doesn't have a valid service", validations[0].Message)
	assert.Equal("spec/tcp", validations[0].Path)

	delete(virtualService.GetSpec(), "tcp")

	validations, valid = NoHostChecker{
		Namespace:      "test-namespace",
		ServiceNames:   []string{"details", "other"},
		VirtualService: virtualService,
	}.Check()

	assert.False(valid)
	assert.NotEmpty(validations)
	assert.Equal("error", validations[0].Severity)
	assert.Equal("VirtualService doesn't define any protocol", validations[0].Message)
	assert.Equal("", validations[0].Path)
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
			"http": []interface{}{
				map[string]interface{}{
					"route": []interface{}{
						map[string]interface{}{
							"destination": map[string]interface{}{
								"host":   "reviews",
								"subset": "v1",
							},
						},
					},
				},
			},
			"tcp": []interface{}{
				map[string]interface{}{
					"route": []interface{}{
						map[string]interface{}{
							"destination": map[string]interface{}{
								"host":   "reviews",
								"subset": "v1",
							},
						},
					},
				},
			},
		},
	}
	return &virtualService
}
