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
	assert.Equal("DestinationWeight on route doesn't have a valid service (host not found)", validations[0].Message)
	assert.Equal("spec/http", validations[0].Path)
	assert.Equal("error", validations[1].Severity)
	assert.Equal("DestinationWeight on route doesn't have a valid service (host not found)", validations[1].Message)
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
	assert.Equal("DestinationWeight on route doesn't have a valid service (host not found)", validations[0].Message)
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
	assert.Equal("VirtualService doesn't define any route protocol", validations[0].Message)
	assert.Equal("", validations[0].Path)
}

func TestValidServiceEntryHost(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	virtualService := fakeVirtualServiceWithServiceEntryTarget()

	validations, valid := NoHostChecker{
		Namespace:      "test-namespace",
		ServiceNames:   []string{"my-wiki-rule"},
		VirtualService: virtualService,
	}.Check()

	assert.False(valid)
	assert.NotEmpty(validations)

	// Add ServiceEntry for validity
	serviceEntry := fakeExternalServiceEntry()

	validations, valid = NoHostChecker{
		Namespace:         "test-namespace",
		ServiceNames:      []string{"my-wiki-rule"},
		VirtualService:    virtualService,
		ServiceEntryHosts: kubernetes.ServiceEntryHostnames([]kubernetes.IstioObject{serviceEntry}),
	}.Check()

	assert.True(valid)
	assert.Empty(validations)
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

// Example from https://istio.io/docs/reference/config/istio.networking.v1alpha3/#Destination
func fakeVirtualServiceWithServiceEntryTarget() kubernetes.IstioObject {
	return (&kubernetes.VirtualService{
		ObjectMeta: meta_v1.ObjectMeta{
			Name:      "my-wiki-rule",
			Namespace: "wikipedia",
		},
		Spec: map[string]interface{}{
			"hosts": []interface{}{
				"wikipedia.org",
			},
			"http": []interface{}{
				map[string]interface{}{
					"timeout": "5s",
					"route": []interface{}{
						map[string]interface{}{
							"destination": map[string]interface{}{
								"host": "wikipedia.org",
							},
						},
					},
				},
			},
		},
	}).DeepCopyIstioObject()
}

func fakeExternalServiceEntry() kubernetes.IstioObject {
	return (&kubernetes.ServiceEntry{
		ObjectMeta: meta_v1.ObjectMeta{
			Name:      "external-svc-wikipedia",
			Namespace: "wikipedia",
		},
		Spec: map[string]interface{}{
			"hosts": []interface{}{
				"wikipedia.org",
			},
			"location": "MESH_EXTERNAL",
			"ports": map[string]interface{}{
				"number":   uint64(80),
				"name":     "example-http",
				"protocol": "HTTP",
			},
			"resolution": "DNS",
		},
	}).DeepCopyIstioObject()
}

func fakeVirtualServiceMultipleIstioObjects() []kubernetes.IstioObject {
	return []kubernetes.IstioObject{fakeVirtualServiceWithServiceEntryTarget(), fakeExternalServiceEntry()}
}
