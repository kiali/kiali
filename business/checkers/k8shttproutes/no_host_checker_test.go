package k8shttproutes

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tests/data"
	"github.com/kiali/kiali/tests/testutils/validations"
)

func TestValidRefHost(t *testing.T) {
	c := config.Get()
	c.ExternalServices.Istio.IstioIdentityDomain = "svc.cluster.local"
	config.Set(c)

	assert := assert.New(t)

	registryService1 := data.CreateFakeRegistryServices("other.bookinfo.svc.cluster.local", "bookinfo", "*")
	registryService2 := data.CreateFakeRegistryServices("reviews.bookinfo.svc.cluster.local", "bookinfo", "*")

	vals, valid := NoHostChecker{
		RegistryServices: append(registryService1, registryService2...),
		K8sHTTPRoute:     data.AddBackendRefToHTTPRoute("reviews", data.CreateHTTPRoute("route", "bookinfo", "gatewayapi", []string{"bookinfo"})),
	}.Check()

	assert.True(valid)
	assert.Empty(vals)
}

func TestNoValidRefHost(t *testing.T) {
	c := config.Get()
	c.ExternalServices.Istio.IstioIdentityDomain = "svc.cluster.local"
	config.Set(c)

	registryService1 := data.CreateFakeRegistryServices("other.bookinfo.svc.cluster.local", "bookinfo", "*")
	registryService2 := data.CreateFakeRegistryServices("details.bookinfo.svc.cluster.local", "bookinfo", "*")

	assert := assert.New(t)

	vals, valid := NoHostChecker{
		RegistryServices: append(registryService1, registryService2...),
		K8sHTTPRoute:     data.AddBackendRefToHTTPRoute("ratings", data.AddBackendRefToHTTPRoute("reviews", data.CreateHTTPRoute("route", "bookinfo", "gatewayapi", []string{"bookinfo"}))),
	}.Check()

	assert.False(valid)
	assert.NotEmpty(vals)
	assert.Len(vals, 2)
	assert.Equal(models.ErrorSeverity, vals[0].Severity)
	assert.NoError(validations.ConfirmIstioCheckMessage("k8shttproutes.nohost.namenotfound", vals[0]))
	assert.Equal("spec/rules[0]/backendRefs[0]/name", vals[0].Path)

	assert.Equal(models.ErrorSeverity, vals[1].Severity)
	assert.NoError(validations.ConfirmIstioCheckMessage("k8shttproutes.nohost.namenotfound", vals[1]))
	assert.Equal("spec/rules[1]/backendRefs[0]/name", vals[1].Path)
}
