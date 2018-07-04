package virtual_services

import (
	"testing"

	"github.com/kiali/kiali/kubernetes"
	"github.com/stretchr/testify/assert"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func TestOneVirtualServicePerHost(t *testing.T) {
	assert := assert.New(t)

	vss := []kubernetes.IstioObject{
		buildVirtualService("reviews"),
		buildVirtualService("ratings"),
	}
	validations, valid := SingleHostChecker{
		Namespace:       "bookinfo",
		VirtualServices: vss,
	}.Check()

	assert.True(valid)
	assert.Empty(validations)
}

func TestOneVirtualServicePerFQDNHost(t *testing.T) {
	assert := assert.New(t)

	vss := []kubernetes.IstioObject{
		buildVirtualService("reviews.bookinfo.svc.cluster.local"),
		buildVirtualService("ratings.bookinfo.svc.cluster.local"),
	}
	validations, valid := SingleHostChecker{
		Namespace:       "bookinfo",
		VirtualServices: vss,
	}.Check()

	assert.True(valid)
	assert.Empty(validations)
}

func TestOneVirtualServicePerFQDNWildcardHost(t *testing.T) {
	assert := assert.New(t)

	vss := []kubernetes.IstioObject{
		buildVirtualService("*.bookinfo.svc.cluster.local"),
		buildVirtualService("*.eshop.svc.cluster.local"),
	}
	validations, valid := SingleHostChecker{
		Namespace:       "bookinfo",
		VirtualServices: vss,
	}.Check()

	assert.True(valid)
	assert.Empty(validations)
}

func TestRepeatingSimpleHost(t *testing.T) {
	assert := assert.New(t)

	vss := []kubernetes.IstioObject{
		buildVirtualService("reviews"),
		buildVirtualService("reviews"),
	}
	validations, valid := SingleHostChecker{
		Namespace:       "bookinfo",
		VirtualServices: vss,
	}.Check()

	assert.False(valid)
	assert.NotEmpty(validations)
	assert.Equal("warning", validations[0].Severity)
	assert.Equal("More than one Virtual Service for same host", validations[0].Message)
	assert.Equal("spec/hosts", validations[0].Path)
}

func TestRepeatingFQDNHost(t *testing.T) {
	assert := assert.New(t)

	vss := []kubernetes.IstioObject{
		buildVirtualService("reviews.bookinfo.svc.cluster.local"),
		buildVirtualService("reviews.bookinfo.svc.cluster.local"),
	}
	validations, valid := SingleHostChecker{
		Namespace:       "bookinfo",
		VirtualServices: vss,
	}.Check()

	assert.False(valid)
	assert.NotEmpty(validations)
	assert.Equal("warning", validations[0].Severity)
	assert.Equal("More than one Virtual Service for same host", validations[0].Message)
	assert.Equal("spec/hosts", validations[0].Path)
}

func TestRepeatingFQDNWildcardHost(t *testing.T) {
	assert := assert.New(t)

	vss := []kubernetes.IstioObject{
		buildVirtualService("*.bookinfo.svc.cluster.local"),
		buildVirtualService("*.bookinfo.svc.cluster.local"),
	}
	validations, valid := SingleHostChecker{
		Namespace:       "bookinfo",
		VirtualServices: vss,
	}.Check()

	assert.False(valid)
	assert.NotEmpty(validations)
	assert.Equal("warning", validations[0].Severity)
	assert.Equal("More than one Virtual Service for same host", validations[0].Message)
	assert.Equal("spec/hosts", validations[0].Path)
}

func TestIncludedIntoWildCard(t *testing.T) {
	assert := assert.New(t)

	vss := []kubernetes.IstioObject{
		buildVirtualService("*.bookinfo.svc.cluster.local"),
		buildVirtualService("reviews.bookinfo.svc.cluster.local"),
	}
	validations, valid := SingleHostChecker{
		Namespace:       "bookinfo",
		VirtualServices: vss,
	}.Check()

	assert.False(valid)
	assert.NotEmpty(validations)
	assert.Equal("warning", validations[0].Severity)
	assert.Equal("More than one Virtual Service for same host", validations[0].Message)
	assert.Equal("spec/hosts", validations[0].Path)

	// Same test, with different order of appearance
	vss = []kubernetes.IstioObject{
		buildVirtualService("reviews.bookinfo.svc.cluster.local"),
		buildVirtualService("*.bookinfo.svc.cluster.local"),
	}
	validations, valid = SingleHostChecker{
		Namespace:       "bookinfo",
		VirtualServices: vss,
	}.Check()

	assert.False(valid)
	assert.NotEmpty(validations)
	assert.Equal("warning", validations[0].Severity)
	assert.Equal("More than one Virtual Service for same host", validations[0].Message)
	assert.Equal("spec/hosts", validations[0].Path)
}

func TestShortHostNameIncludedIntoWildCard(t *testing.T) {
	assert := assert.New(t)

	vss := []kubernetes.IstioObject{
		buildVirtualService("*.bookinfo.svc.cluster.local"),
		buildVirtualService("reviews"),
	}
	validations, valid := SingleHostChecker{
		Namespace:       "bookinfo",
		VirtualServices: vss,
	}.Check()

	assert.False(valid)
	assert.NotEmpty(validations)
	assert.Equal("warning", validations[0].Severity)
	assert.Equal("More than one Virtual Service for same host", validations[0].Message)
	assert.Equal("spec/hosts", validations[0].Path)
}

func buildVirtualService(host string) kubernetes.IstioObject {
	vs := (&kubernetes.VirtualService{

		ObjectMeta: meta_v1.ObjectMeta{
			Name:      "reviews",
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
