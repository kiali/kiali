package k8sgateways

import (
	"testing"

	"github.com/stretchr/testify/assert"
	k8s_networking_v1alpha2 "sigs.k8s.io/gateway-api/apis/v1alpha2"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tests/data"
)

func TestCorrectK8sGateways(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	gwObject := data.CreateEmptyK8sGateway("validgateway", "test")

	gws := []*k8s_networking_v1alpha2.Gateway{gwObject}

	vals := MultiMatchChecker{
		K8sGateways: gws,
	}.Check()

	assert.Empty(vals)
	_, ok := vals[models.IstioValidationKey{ObjectType: "k8sgateway", Namespace: "test", Name: "validgateway"}]
	assert.False(ok)
}

func TestDuplicateListenersCheckError(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	gwObject := data.AddListenerToK8sGateway(data.CreateListener("test", "host.com", 80, "http"),
		data.CreateEmptyK8sGateway("validgateway", "test"))

	gwObject2 := data.AddListenerToK8sGateway(data.CreateListener("test", "host.com", 80, "http"),
		data.CreateEmptyK8sGateway("validgateway2", "test"))

	gws := []*k8s_networking_v1alpha2.Gateway{gwObject, gwObject2}

	vals := MultiMatchChecker{
		K8sGateways: gws,
	}.Check()

	assert.NotEmpty(vals)
	assert.Equal(1, len(vals))
	validation, ok := vals[models.IstioValidationKey{ObjectType: "k8sgateway", Namespace: "test", Name: "validgateway2"}]
	assert.True(ok)
	assert.NotNil(validation)
	assert.True(validation.Valid)
	assert.Greater(len(validation.Checks), 0)

	// TODO: Should validgateway be the same. Why not?
}

func TestDuplicateListenersCheckOk(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	gwObject := data.AddListenerToK8sGateway(data.CreateListener("test", "host.es", 80, "http"),
		data.CreateEmptyK8sGateway("validgateway", "test"))

	gwObject2 := data.AddListenerToK8sGateway(data.CreateListener("test", "host.com", 80, "http"),
		data.CreateEmptyK8sGateway("validgateway2", "test"))

	gws := []*k8s_networking_v1alpha2.Gateway{gwObject, gwObject2}

	vals := MultiMatchChecker{
		K8sGateways: gws,
	}.Check()

	assert.Empty(vals)

}
