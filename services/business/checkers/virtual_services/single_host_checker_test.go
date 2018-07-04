package virtual_services

import (
	"testing"

	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/services/models"
	"github.com/stretchr/testify/assert"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func TestOneVirtualServicePerHost(t *testing.T) {
	vss := []kubernetes.IstioObject{
		buildVirtualService("virtual-1", "reviews"),
		buildVirtualService("virtual-2", "ratings"),
	}
	validations := SingleHostChecker{
		Namespace:       "bookinfo",
		VirtualServices: vss,
	}.Check()

	noValidationResult(t, validations)
}

func TestOneVirtualServicePerFQDNHost(t *testing.T) {
	vss := []kubernetes.IstioObject{
		buildVirtualService("virtual-1", "reviews.bookinfo.svc.cluster.local"),
		buildVirtualService("virtual-2", "ratings.bookinfo.svc.cluster.local"),
	}
	validations := SingleHostChecker{
		Namespace:       "bookinfo",
		VirtualServices: vss,
	}.Check()

	noValidationResult(t, validations)
}

func TestOneVirtualServicePerFQDNWildcardHost(t *testing.T) {
	vss := []kubernetes.IstioObject{
		buildVirtualService("virtual-1", "*.bookinfo.svc.cluster.local"),
		buildVirtualService("virtual-2", "*.eshop.svc.cluster.local"),
	}
	validations := SingleHostChecker{
		Namespace:       "bookinfo",
		VirtualServices: vss,
	}.Check()

	noValidationResult(t, validations)
}

func TestRepeatingSimpleHost(t *testing.T) {
	vss := []kubernetes.IstioObject{
		buildVirtualService("virtual-1", "reviews"),
		buildVirtualService("virtual-2", "reviews"),
	}

	validations := SingleHostChecker{
		Namespace:       "bookinfo",
		VirtualServices: vss,
	}.Check()

	presentValidationTest(t, validations, "virtual-2")
}

func TestRepeatingFQDNHost(t *testing.T) {
	vss := []kubernetes.IstioObject{
		buildVirtualService("virtual-1", "reviews.bookinfo.svc.cluster.local"),
		buildVirtualService("virtual-2", "reviews.bookinfo.svc.cluster.local"),
	}
	validations := SingleHostChecker{
		Namespace:       "bookinfo",
		VirtualServices: vss,
	}.Check()

	presentValidationTest(t, validations, "virtual-2")
}

func TestRepeatingFQDNWildcardHost(t *testing.T) {
	vss := []kubernetes.IstioObject{
		buildVirtualService("virtual-1", "*.bookinfo.svc.cluster.local"),
		buildVirtualService("virtual-2", "*.bookinfo.svc.cluster.local"),
	}
	validations := SingleHostChecker{
		Namespace:       "bookinfo",
		VirtualServices: vss,
	}.Check()

	presentValidationTest(t, validations, "virtual-2")
}

func TestIncludedIntoWildCard(t *testing.T) {
	vss := []kubernetes.IstioObject{
		buildVirtualService("virtual-1", "*.bookinfo.svc.cluster.local"),
		buildVirtualService("virtual-2", "reviews.bookinfo.svc.cluster.local"),
	}
	validations := SingleHostChecker{
		Namespace:       "bookinfo",
		VirtualServices: vss,
	}.Check()

	presentValidationTest(t, validations, "virtual-2")

	// Same test, with different order of appearance
	vss = []kubernetes.IstioObject{
		buildVirtualService("virtual-1", "reviews.bookinfo.svc.cluster.local"),
		buildVirtualService("virtual-2", "*.bookinfo.svc.cluster.local"),
	}
	validations = SingleHostChecker{
		Namespace:       "bookinfo",
		VirtualServices: vss,
	}.Check()

	presentValidationTest(t, validations, "virtual-2")
}

func TestShortHostNameIncludedIntoWildCard(t *testing.T) {
	vss := []kubernetes.IstioObject{
		buildVirtualService("virtual-1", "*.bookinfo.svc.cluster.local"),
		buildVirtualService("virtual-2", "reviews"),
	}
	validations := SingleHostChecker{
		Namespace:       "bookinfo",
		VirtualServices: vss,
	}.Check()

	presentValidationTest(t, validations, "virtual-2")
}

func buildVirtualService(name, host string) kubernetes.IstioObject {
	vs := (&kubernetes.VirtualService{

		ObjectMeta: meta_v1.ObjectMeta{
			Name:      name,
			Namespace: "bookinfo",
		},
		Spec: map[string]interface{}{
			"hosts": []interface{}{
				host,
			},
		},
	}).DeepCopyIstioObject()

	return vs
}

func noValidationResult(t *testing.T, validations models.IstioValidations) {
	assert := assert.New(t)
	assert.Empty(validations)

	validation, ok := validations[models.IstioValidationKey{"virtualservice", "reviews"}]
	assert.False(ok)
	assert.Nil(validation)
}

func presentValidationTest(t *testing.T, validations models.IstioValidations, serviceName string) {
	assert := assert.New(t)
	assert.NotEmpty(validations)

	validation, ok := validations[models.IstioValidationKey{"virtualservice", serviceName}]
	assert.True(ok)

	assert.False(validation.Valid)
	assert.NotEmpty(validation.Checks)
	assert.Equal("warning", validation.Checks[0].Severity)
	assert.Equal("More than one Virtual Service for same host", validation.Checks[0].Message)
	assert.Equal("spec/hosts", validation.Checks[0].Path)
}
