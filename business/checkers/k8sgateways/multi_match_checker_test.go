package k8sgateways

import (
	"testing"

	"github.com/stretchr/testify/assert"
	k8s_networking_v1 "sigs.k8s.io/gateway-api/apis/v1"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tests/data"
)

func TestCorrectK8sGateways(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	k8sgwObject := data.CreateEmptyK8sGateway("validk8sgateway", "test")

	k8sgws := []*k8s_networking_v1.Gateway{k8sgwObject}

	vals := MultiMatchChecker{
		K8sGateways: k8sgws,
		Cluster:     config.DefaultClusterID,
	}.Check()

	assert.Empty(vals)
	_, ok := vals[models.IstioValidationKey{ObjectGVK: kubernetes.K8sGateways, Namespace: "test", Name: "validk8sgateway", Cluster: config.DefaultClusterID}]
	assert.False(ok)
}

func TestDuplicateListenersCheckError(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	k8sgwObject := data.AddListenerToK8sGateway(data.CreateListener("test", "host.com", 80, "http"),
		data.CreateEmptyK8sGateway("validk8sgateway", "test"))

	k8sgwObject2 := data.AddListenerToK8sGateway(data.CreateListener("test", "host.com", 80, "http"),
		data.CreateEmptyK8sGateway("validk8sgateway2", "test"))

	k8sgws := []*k8s_networking_v1.Gateway{k8sgwObject, k8sgwObject2}

	vals := MultiMatchChecker{
		K8sGateways: k8sgws,
		Cluster:     config.DefaultClusterID,
	}.Check()

	assert.NotEmpty(vals)
	assert.Equal(2, len(vals))
	validation, ok := vals[models.IstioValidationKey{ObjectGVK: kubernetes.K8sGateways, Namespace: "test", Name: "validk8sgateway2", Cluster: config.DefaultClusterID}]
	assert.True(ok)
	assert.NotNil(validation)
	assert.True(validation.Valid)
	assert.Greater(len(validation.Checks), 0)

	secValidation, ok := vals[models.IstioValidationKey{ObjectGVK: kubernetes.K8sGateways, Namespace: "test", Name: "validk8sgateway", Cluster: config.DefaultClusterID}]
	assert.True(ok)
	assert.NotNil(secValidation)
	assert.True(secValidation.Valid)
	assert.Greater(len(secValidation.Checks), 0)

	// Check references
	assert.Equal(1, len(validation.References))
	assert.Equal(1, len(secValidation.References))
}

func TestDuplicateListenersCheckOk(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	k8sgwObject := data.AddListenerToK8sGateway(data.CreateListener("test", "host.es", 80, "http"),
		data.CreateEmptyK8sGateway("validk8sgateway", "test"))

	k8sgwObject2 := data.AddListenerToK8sGateway(data.CreateListener("test", "host.com", 80, "http"),
		data.CreateEmptyK8sGateway("validk8sgateway2", "test"))

	k8sgws := []*k8s_networking_v1.Gateway{k8sgwObject, k8sgwObject2}

	vals := MultiMatchChecker{
		K8sGateways: k8sgws,
		Cluster:     config.DefaultClusterID,
	}.Check()

	assert.Empty(vals)

}

func TestDuplicateAddresssCheckError(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	gwAddress := data.CreateGWAddress("IPAddress", "192.168.0.0")
	k8sgwObject := data.AddGwAddressToK8sGateway(gwAddress,
		data.CreateEmptyK8sGateway("validk8sgateway", "test"))

	k8sgwObject2 := data.AddGwAddressToK8sGateway(gwAddress,
		data.CreateEmptyK8sGateway("validk8sgateway2", "test"))

	k8sgws := []*k8s_networking_v1.Gateway{k8sgwObject, k8sgwObject2}

	vals := MultiMatchChecker{
		K8sGateways: k8sgws,
		Cluster:     config.DefaultClusterID,
	}.Check()

	assert.NotEmpty(vals)
	assert.Equal(2, len(vals))
	validation, ok := vals[models.IstioValidationKey{ObjectGVK: kubernetes.K8sGateways, Namespace: "test", Name: "validk8sgateway2", Cluster: config.DefaultClusterID}]
	assert.True(ok)
	assert.NotNil(validation)
	assert.True(validation.Valid)
	assert.Greater(len(validation.Checks), 0)

	secValidation, ok := vals[models.IstioValidationKey{ObjectGVK: kubernetes.K8sGateways, Namespace: "test", Name: "validk8sgateway", Cluster: config.DefaultClusterID}]
	assert.True(ok)
	assert.NotNil(secValidation)
	assert.True(secValidation.Valid)
	assert.Greater(len(secValidation.Checks), 0)

	// Check references
	assert.Equal(1, len(validation.References))
	assert.Equal(1, len(secValidation.References))
}

func TestDuplicateAddresssCheckOk(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	gwAddress := data.CreateGWAddress("IPAddress", "192.168.0.0")
	k8sgwObject := data.AddGwAddressToK8sGateway(gwAddress,
		data.CreateEmptyK8sGateway("validk8sgateway", "test"))

	gwAddress2 := data.CreateGWAddress("IPAddress", "127.0.0.1")
	k8sgwObject2 := data.AddGwAddressToK8sGateway(gwAddress2,
		data.CreateEmptyK8sGateway("validk8sgateway2", "test"))

	k8sgws := []*k8s_networking_v1.Gateway{k8sgwObject, k8sgwObject2}

	vals := MultiMatchChecker{
		K8sGateways: k8sgws,
		Cluster:     config.DefaultClusterID,
	}.Check()

	assert.Empty(vals)

}

func TestUniqueListenerOk(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	k8sgwObject := data.AddListenerToK8sGateway(data.CreateListener("test", "host.es", 80, "http"),
		data.CreateEmptyK8sGateway("validk8sgateway", "test"))

	k8sgwObject = data.AddListenerToK8sGateway(data.CreateListener("test2", "host.com", 80, "http"),
		k8sgwObject)

	k8sgws := []*k8s_networking_v1.Gateway{k8sgwObject}

	vals := MultiMatchChecker{
		K8sGateways: k8sgws,
		Cluster:     config.DefaultClusterID,
	}.Check()

	assert.Empty(vals)

}

func TestUniqueListenerDuplicate(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	k8sgwObject := data.AddListenerToK8sGateway(data.CreateListener("test", "host.es", 80, "http"),
		data.CreateEmptyK8sGateway("k8sgateway", "test"))

	k8sgwObject = data.AddListenerToK8sGateway(data.CreateListener("test2", "host.es", 80, "http"),
		k8sgwObject)

	k8sgws := []*k8s_networking_v1.Gateway{k8sgwObject}

	vals := MultiMatchChecker{
		K8sGateways: k8sgws,
		Cluster:     config.DefaultClusterID,
	}.Check()

	assert.NotEmpty(vals)
	assert.Equal(1, len(vals))
	validation, ok := vals[models.IstioValidationKey{ObjectGVK: kubernetes.K8sGateways, Namespace: "test", Name: "k8sgateway", Cluster: config.DefaultClusterID}]
	assert.True(ok)
	assert.Greater(len(validation.Checks), 0)

}

// TestMultimatchValidationValueCarriesNamespace pins the CI regression from
// PR #10448: the IstioValidation VALUE must carry its namespace. The
// cluster-wide GetValidations filter (accessible namespaces) reads the value's
// Namespace field, and an empty one made every collision-flagged K8sGateway
// lose its validation on /api/istio/config.
func TestMultimatchValidationValueCarriesNamespace(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	k8sgwObject := data.AddListenerToK8sGateway(data.CreateListener("default", "website.com", 80, "http"),
		data.CreateEmptyK8sGateway("gatewayapi-1", "bookinfo"))

	k8sgwObject2 := data.AddListenerToK8sGateway(data.CreateListener("default", "website.com", 80, "http"),
		data.CreateEmptyK8sGateway("gatewayapi-2", "bookinfo"))

	vals := MultiMatchChecker{
		K8sGateways: []*k8s_networking_v1.Gateway{k8sgwObject, k8sgwObject2},
		Cluster:     config.DefaultClusterID,
	}.Check()

	// Both colliding gateways must be flagged: pin the count so a checker
	// that silently produces fewer entries fails.
	assert.Len(vals, 2)
	for key, validation := range vals {
		assert.Equal("bookinfo", key.Namespace)
		assert.Equal(key.Namespace, validation.Namespace,
			"multimatch validation value for %s must carry its namespace, matching its key", key.Name)
	}
}
