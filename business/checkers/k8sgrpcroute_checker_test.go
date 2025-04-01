package checkers

import (
	"testing"

	"github.com/stretchr/testify/assert"
	k8s_networking_v1 "sigs.k8s.io/gateway-api/apis/v1"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tests/data"
	"github.com/kiali/kiali/tests/testutils/validations"
)

func TestNoCrashOnEmptyRouteGRPC(t *testing.T) {
	assert := assert.New(t)

	typeValidations := K8sGRPCRouteChecker{
		Conf:             config.Get(),
		K8sGRPCRoutes:    []*k8s_networking_v1.GRPCRoute{},
		K8sGateways:      []*k8s_networking_v1.Gateway{},
		RegistryServices: data.CreateEmptyRegistryServices(),
		Namespaces:       models.Namespaces{},
	}.Check()

	assert.Empty(typeValidations)
}

func TestWithoutK8sGatewayGRPC(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)
	assert := assert.New(t)

	vals := K8sGRPCRouteChecker{
		Conf: config.Get(),
		K8sGRPCRoutes: []*k8s_networking_v1.GRPCRoute{
			data.CreateGRPCRoute("route1", "bookinfo", "gatewayapi", []string{"bookinfo"}),
			data.CreateGRPCRoute("route2", "bookinfo", "gatewayapi2", []string{"bookinfo"})},
		K8sGateways: []*k8s_networking_v1.Gateway{data.CreateEmptyK8sGateway("gatewayapiwrong", "bookinfo")},
	}.Check()

	assert.NotEmpty(vals)

	route1 := vals[models.IstioValidationKey{ObjectGVK: kubernetes.K8sGRPCRoutes, Namespace: "bookinfo", Name: "route1"}]
	assert.False(route1.Valid)
	assert.NoError(validations.ConfirmIstioCheckMessage("k8sroutes.nok8sgateway", route1.Checks[0]))
	route2 := vals[models.IstioValidationKey{ObjectGVK: kubernetes.K8sGRPCRoutes, Namespace: "bookinfo", Name: "route2"}]
	assert.False(route2.Valid)
	assert.NoError(validations.ConfirmIstioCheckMessage("k8sroutes.nok8sgateway", route2.Checks[0]))
}

func TestWithoutServiceGRPC(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)
	assert := assert.New(t)

	registryService1 := data.CreateFakeRegistryServices("other.bookinfo.svc.cluster.local", "bookinfo", "*")
	registryService2 := data.CreateFakeRegistryServices("details.bookinfo.svc.cluster.local", "bookinfo2", "*")

	vals := K8sGRPCRouteChecker{
		Conf: config.Get(),
		K8sGRPCRoutes: []*k8s_networking_v1.GRPCRoute{
			data.AddBackendRefToGRPCRoute("ratings", "bookinfo", data.CreateGRPCRoute("route1", "bookinfo", "gatewayapi", []string{"bookinfo"})),
			data.AddBackendRefToGRPCRoute("ratings", "bookinfo", data.CreateGRPCRoute("route2", "bookinfo2", "gatewayapi2", []string{"bookinfo2"}))},
		K8sGateways:      []*k8s_networking_v1.Gateway{data.CreateEmptyK8sGateway("gatewayapi", "bookinfo"), data.CreateEmptyK8sGateway("gatewayapi2", "bookinfo2")},
		RegistryServices: append(registryService1, registryService2...),
		Namespaces:       models.Namespaces{models.Namespace{Name: "bookinfo"}, models.Namespace{Name: "bookinfo2"}, models.Namespace{Name: "bookinfo3"}},
	}.Check()

	assert.NotEmpty(vals)

	route1 := vals[models.IstioValidationKey{ObjectGVK: kubernetes.K8sGRPCRoutes, Namespace: "bookinfo", Name: "route1"}]
	assert.False(route1.Valid)
	assert.NoError(validations.ConfirmIstioCheckMessage("k8sroutes.nohost.namenotfound", route1.Checks[0]))
	route2 := vals[models.IstioValidationKey{ObjectGVK: kubernetes.K8sGRPCRoutes, Namespace: "bookinfo2", Name: "route2"}]
	assert.False(route2.Valid)
	assert.NoError(validations.ConfirmIstioCheckMessage("k8sroutes.nohost.namenotfound", route2.Checks[0]))
}
