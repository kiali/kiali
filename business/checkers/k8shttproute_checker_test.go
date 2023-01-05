package checkers

import (
	"testing"

	"github.com/stretchr/testify/assert"
	k8s_networking_v1alpha2 "sigs.k8s.io/gateway-api/apis/v1alpha2"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tests/data"
	"github.com/kiali/kiali/tests/testutils/validations"
)

func TestNoCrashOnEmptyRoute(t *testing.T) {
	assert := assert.New(t)

	typeValidations := K8sHTTPRouteChecker{
		K8sHTTPRoutes: []*k8s_networking_v1alpha2.HTTPRoute{},
		K8sGateways:   []*k8s_networking_v1alpha2.Gateway{},
	}.Check()

	assert.Empty(typeValidations)
}

func TestWithoutK8sGateway(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)
	assert := assert.New(t)

	vals := K8sHTTPRouteChecker{
		K8sHTTPRoutes: []*k8s_networking_v1alpha2.HTTPRoute{
			data.CreateHTTPRoute("route1", "bookinfo", "gatewayapi", []string{"bookinfo"}),
			data.CreateHTTPRoute("route2", "bookinfo", "gatewayapi2", []string{"bookinfo"})},
		K8sGateways: []*k8s_networking_v1alpha2.Gateway{data.CreateEmptyK8sGateway("gatewayapiwrong", "bookinfo")},
	}.Check()

	assert.NotEmpty(vals)

	route1 := vals[models.IstioValidationKey{ObjectType: "k8shttproute", Namespace: "bookinfo", Name: "route1"}]
	assert.False(route1.Valid)
	assert.NoError(validations.ConfirmIstioCheckMessage("k8shttproutes.nok8sgateway", route1.Checks[0]))
	route2 := vals[models.IstioValidationKey{ObjectType: "k8shttproute", Namespace: "bookinfo", Name: "route2"}]
	assert.False(route2.Valid)
	assert.NoError(validations.ConfirmIstioCheckMessage("k8shttproutes.nok8sgateway", route2.Checks[0]))
}
