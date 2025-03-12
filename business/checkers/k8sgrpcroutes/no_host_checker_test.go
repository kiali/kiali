package k8sgrpcroutes

import (
	"testing"

	k8s_networking_v1beta1 "sigs.k8s.io/gateway-api/apis/v1beta1"

	"github.com/stretchr/testify/assert"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
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
		Conf:               config.Get(),
		RegistryServices:   append(registryService1, registryService2...),
		K8sReferenceGrants: []*k8s_networking_v1beta1.ReferenceGrant{data.CreateReferenceGrantByKind("grant", "bookinfo", "bookinfo2", k8s_networking_v1beta1.Kind(kubernetes.K8sGRPCRoutes.Kind))},
		K8sGRPCRoute:       data.AddServiceParentRefToGRPCRoute("reviews", "bookinfo", data.AddBackendRefToGRPCRoute("reviews", "bookinfo", data.CreateGRPCRoute("route", "bookinfo2", "gatewayapi", []string{"bookinfo"}))),
	}.Check()

	assert.True(valid)
	assert.Empty(vals)
}

func TestMissingGrant(t *testing.T) {
	c := config.Get()
	c.ExternalServices.Istio.IstioIdentityDomain = "svc.cluster.local"
	config.Set(c)

	assert := assert.New(t)

	registryService1 := data.CreateFakeRegistryServices("other.bookinfo.svc.cluster.local", "bookinfo", "*")
	registryService2 := data.CreateFakeRegistryServices("reviews.bookinfo.svc.cluster.local", "bookinfo", "*")

	vals, valid := NoHostChecker{
		Conf:             config.Get(),
		RegistryServices: append(registryService1, registryService2...),
		K8sGRPCRoute:     data.AddServiceParentRefToGRPCRoute("reviews", "bookinfo", data.AddBackendRefToGRPCRoute("reviews", "bookinfo", data.CreateGRPCRoute("route", "bookinfo2", "gatewayapi", []string{"bookinfo"}))),
	}.Check()

	assert.False(valid)
	assert.NotEmpty(vals)
	assert.Len(vals, 2)
	assert.Equal(models.ErrorSeverity, vals[0].Severity)
	assert.NoError(validations.ConfirmIstioCheckMessage("k8sroutes.nohost.namenotfound", vals[0]))
	assert.Equal("spec/parentRefs[1]/name", vals[0].Path)
	assert.Equal(models.ErrorSeverity, vals[1].Severity)
	assert.NoError(validations.ConfirmIstioCheckMessage("k8sroutes.nohost.namenotfound", vals[1]))
	assert.Equal("spec/rules[0]/backendRefs[0]/name", vals[1].Path)
}

func TestWrongGrant(t *testing.T) {
	c := config.Get()
	c.ExternalServices.Istio.IstioIdentityDomain = "svc.cluster.local"
	config.Set(c)

	assert := assert.New(t)

	registryService1 := data.CreateFakeRegistryServices("other.bookinfo.svc.cluster.local", "bookinfo", "*")
	registryService2 := data.CreateFakeRegistryServices("reviews.bookinfo.svc.cluster.local", "bookinfo", "*")

	vals, valid := NoHostChecker{
		Conf:               config.Get(),
		RegistryServices:   append(registryService1, registryService2...),
		K8sReferenceGrants: []*k8s_networking_v1beta1.ReferenceGrant{data.CreateReferenceGrantByKind("grant", "bookinfo", "bookinfo", k8s_networking_v1beta1.Kind(kubernetes.K8sGRPCRoutes.Kind))},
		K8sGRPCRoute:       data.AddServiceParentRefToGRPCRoute("reviews", "bookinfo", data.AddBackendRefToGRPCRoute("reviews", "bookinfo", data.CreateGRPCRoute("route", "bookinfo2", "gatewayapi", []string{"bookinfo"}))),
	}.Check()

	assert.False(valid)
	assert.NotEmpty(vals)
	assert.Len(vals, 2)
	assert.Equal(models.ErrorSeverity, vals[0].Severity)
	assert.NoError(validations.ConfirmIstioCheckMessage("k8sroutes.nohost.namenotfound", vals[0]))
	assert.Equal("spec/parentRefs[1]/name", vals[0].Path)
	assert.Equal(models.ErrorSeverity, vals[1].Severity)
	assert.NoError(validations.ConfirmIstioCheckMessage("k8sroutes.nohost.namenotfound", vals[1]))
	assert.Equal("spec/rules[0]/backendRefs[0]/name", vals[1].Path)
}

func TestValidRefHostDefaultNs(t *testing.T) {
	c := config.Get()
	c.ExternalServices.Istio.IstioIdentityDomain = "svc.cluster.local"
	config.Set(c)

	assert := assert.New(t)

	registryService1 := data.CreateFakeRegistryServices("other.bookinfo.svc.cluster.local", "bookinfo", "*")
	registryService2 := data.CreateFakeRegistryServices("reviews.bookinfo.svc.cluster.local", "bookinfo", "*")

	vals, valid := NoHostChecker{
		Conf:               config.Get(),
		RegistryServices:   append(registryService1, registryService2...),
		K8sReferenceGrants: []*k8s_networking_v1beta1.ReferenceGrant{data.CreateReferenceGrantByKind("grant", "bookinfo", "bookinfo2", k8s_networking_v1beta1.Kind(kubernetes.K8sGRPCRoutes.Kind))},
		K8sGRPCRoute:       data.AddServiceParentRefToGRPCRoute("reviews", "", data.AddBackendRefToGRPCRoute("reviews", "", data.CreateGRPCRoute("route", "bookinfo", "gatewayapi", []string{"bookinfo"}))),
	}.Check()

	assert.True(valid)
	assert.Empty(vals)
}

func TestInvalidRefHostDefaultNs(t *testing.T) {
	c := config.Get()
	c.ExternalServices.Istio.IstioIdentityDomain = "svc.cluster.local"
	config.Set(c)

	assert := assert.New(t)

	registryService1 := data.CreateFakeRegistryServices("other.bookinfo.svc.cluster.local", "bookinfo", "*")
	registryService2 := data.CreateFakeRegistryServices("reviews.bookinfo.svc.cluster.local", "bookinfo", "*")

	vals, valid := NoHostChecker{
		Conf:               config.Get(),
		RegistryServices:   append(registryService1, registryService2...),
		K8sReferenceGrants: []*k8s_networking_v1beta1.ReferenceGrant{data.CreateReferenceGrantByKind("grant", "bookinfo", "bookinfo2", k8s_networking_v1beta1.Kind(kubernetes.K8sGRPCRoutes.Kind))},
		K8sGRPCRoute:       data.AddServiceParentRefToGRPCRoute("reviews", "", data.AddBackendRefToGRPCRoute("reviews", "", data.CreateGRPCRoute("route", "bookinfo2", "gatewayapi", []string{"bookinfo"}))),
	}.Check()

	assert.False(valid)
	assert.NotEmpty(vals)
	assert.Len(vals, 2)
	assert.Equal(models.ErrorSeverity, vals[0].Severity)
	assert.NoError(validations.ConfirmIstioCheckMessage("k8sroutes.nohost.namenotfound", vals[0]))
	assert.Equal("spec/parentRefs[1]/name", vals[0].Path)
	assert.Equal(models.ErrorSeverity, vals[1].Severity)
	assert.NoError(validations.ConfirmIstioCheckMessage("k8sroutes.nohost.namenotfound", vals[1]))
	assert.Equal("spec/rules[0]/backendRefs[0]/name", vals[1].Path)
}

func TestNoValidRefHost(t *testing.T) {
	c := config.Get()
	c.ExternalServices.Istio.IstioIdentityDomain = "svc.cluster.local"
	config.Set(c)

	registryService1 := data.CreateFakeRegistryServices("other.bookinfo.svc.cluster.local", "bookinfo", "*")
	registryService2 := data.CreateFakeRegistryServices("details.bookinfo.svc.cluster.local", "bookinfo", "*")

	assert := assert.New(t)

	vals, valid := NoHostChecker{
		Conf:               config.Get(),
		RegistryServices:   append(registryService1, registryService2...),
		K8sReferenceGrants: []*k8s_networking_v1beta1.ReferenceGrant{data.CreateReferenceGrantByKind("grant", "bookinfo", "bookinfo2", k8s_networking_v1beta1.Kind(kubernetes.K8sGRPCRoutes.Kind))},
		K8sGRPCRoute:       data.AddServiceParentRefToGRPCRoute("ratings", "bookinfo", data.AddBackendRefToGRPCRoute("ratings", "bookinfo", data.AddBackendRefToGRPCRoute("reviews", "bookinfo", data.CreateGRPCRoute("route", "bookinfo2", "gatewayapi", []string{"bookinfo2"})))),
	}.Check()

	assert.False(valid)
	assert.NotEmpty(vals)
	assert.Len(vals, 3)
	assert.Equal(models.ErrorSeverity, vals[0].Severity)
	assert.NoError(validations.ConfirmIstioCheckMessage("k8sroutes.nohost.namenotfound", vals[0]))
	assert.Equal("spec/parentRefs[1]/name", vals[0].Path)

	assert.Equal(models.ErrorSeverity, vals[1].Severity)
	assert.NoError(validations.ConfirmIstioCheckMessage("k8sroutes.nohost.namenotfound", vals[1]))
	assert.Equal("spec/rules[0]/backendRefs[0]/name", vals[1].Path)
	assert.Equal(models.ErrorSeverity, vals[2].Severity)
	assert.NoError(validations.ConfirmIstioCheckMessage("k8sroutes.nohost.namenotfound", vals[2]))
	assert.Equal("spec/rules[1]/backendRefs[0]/name", vals[2].Path)
}

func TestInvalidRefHostFQDN(t *testing.T) {
	c := config.Get()
	c.ExternalServices.Istio.IstioIdentityDomain = "svc.cluster.local"
	config.Set(c)

	assert := assert.New(t)

	registryService1 := data.CreateFakeRegistryServices("other.bookinfo.svc.cluster.local", "bookinfo", "*")
	registryService2 := data.CreateFakeRegistryServices("reviews.bookinfo.svc.cluster.local", "bookinfo", "*")

	vals, valid := NoHostChecker{
		Conf:               config.Get(),
		RegistryServices:   append(registryService1, registryService2...),
		K8sReferenceGrants: []*k8s_networking_v1beta1.ReferenceGrant{data.CreateReferenceGrantByKind("grant", "bookinfo", "bookinfo2", k8s_networking_v1beta1.Kind(kubernetes.K8sGRPCRoutes.Kind))},
		K8sGRPCRoute:       data.AddServiceParentRefToGRPCRoute("reviews.bookinfo.svc.cluster.local", "", data.AddBackendRefToGRPCRoute("reviews.bookinfo.svc.cluster.local", "", data.CreateGRPCRoute("route", "bookinfo2", "gatewayapi", []string{"bookinfo"}))),
	}.Check()

	assert.False(valid)
	assert.NotEmpty(vals)
	assert.Len(vals, 2)
	assert.Equal(models.ErrorSeverity, vals[0].Severity)
	assert.NoError(validations.ConfirmIstioCheckMessage("k8sroutes.nohost.namenotfound", vals[0]))
	assert.Equal("spec/parentRefs[1]/name", vals[0].Path)
	assert.Equal(models.ErrorSeverity, vals[1].Severity)
	assert.NoError(validations.ConfirmIstioCheckMessage("k8sroutes.nohost.namenotfound", vals[1]))
	assert.Equal("spec/rules[0]/backendRefs[0]/name", vals[1].Path)
}
