package virtual_services

import (
	"testing"

	"github.com/kiali/kiali/kubernetes"
	"github.com/stretchr/testify/assert"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func TestMissingGateway(t *testing.T) {
	assert := assert.New(t)

	virtualService := fakeVirtualServiceWithGateway()
	checker := NoGatewayChecker{
		VirtualService: virtualService,
		GatewayNames:   make(map[string]struct{}, 0),
	}

	validations, valid := checker.Check()
	assert.False(valid)
	assert.NotEmpty(validations)
	assert.Equal("error", validations[0].Severity)
}

func TestFoundGateway(t *testing.T) {
	assert := assert.New(t)

	virtualService := fakeVirtualServiceWithGateway()
	gatewayNames := kubernetes.GatewayNames([]kubernetes.IstioObject{fakeGateway()})

	checker := NoGatewayChecker{
		VirtualService: virtualService,
		GatewayNames:   gatewayNames,
	}

	validations, valid := checker.Check()
	assert.True(valid)
	assert.Empty(validations)
}

func fakeVirtualServiceWithGateway() kubernetes.IstioObject {
	virtualService := kubernetes.VirtualService{
		ObjectMeta: meta_v1.ObjectMeta{
			Name: "reviews",
		},
		Spec: map[string]interface{}{
			"hosts": []interface{}{
				"reviews",
			},
			"gateways": []interface{}{
				"my-gateway",
				"mesh",
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

func fakeGateway() kubernetes.IstioObject {
	gateway := kubernetes.Gateway{
		ObjectMeta: meta_v1.ObjectMeta{
			Name: "my-gateway",
		},
		Spec: map[string]interface{}{}, // No info used from here.. yet
	}
	return &gateway
}
