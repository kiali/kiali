package business

import (
	"context"
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	core_v1 "k8s.io/api/core/v1"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/models"
)

func TestServiceListParsing(t *testing.T) {
	assert := assert.New(t)
	require := require.New(t)

	// Setup mocks
	s1 := kubetest.FakeService("Namespace", "reviews")
	s2 := kubetest.FakeService("Namespace", "httpbin")
	objects := []runtime.Object{
		&core_v1.Namespace{ObjectMeta: meta_v1.ObjectMeta{Name: "Namespace"}},
		&s1,
		&s2,
	}
	k8s := kubetest.NewFakeK8sClient(objects...)
	conf := config.NewConfig()
	config.Set(conf)
	setupGlobalMeshConfig()
	SetupBusinessLayer(t, k8s, *conf)
	k8sclients := make(map[string]kubernetes.ClientInterface)
	k8sclients[kubernetes.HomeClusterName] = k8s
	svc := NewWithBackends(k8sclients, k8sclients, nil, nil).Svc

	criteria := ServiceCriteria{Namespace: "Namespace", IncludeIstioResources: false, Health: false}
	serviceList, err := svc.GetServiceList(context.TODO(), criteria)
	require.NoError(err)

	require.Equal("Namespace", serviceList.Namespace.Name)
	require.Len(serviceList.Services, 2)
	serviceNames := []string{serviceList.Services[0].Name, serviceList.Services[1].Name}

	assert.Contains(serviceNames, "reviews")
	assert.Contains(serviceNames, "httpbin")
}

func TestParseRegistryServices(t *testing.T) {
	assert := assert.New(t)

	conf := config.NewConfig()
	config.Set(conf)

	k8s := new(kubetest.K8SClientMock)
	k8s.On("IsOpenShift").Return(false)
	k8s.On("IsGatewayAPI").Return(false)
	setupGlobalMeshConfig()
	k8sclients := make(map[string]kubernetes.ClientInterface)
	k8sclients[kubernetes.HomeClusterName] = k8s
	svc := SvcService{k8s: nil, businessLayer: NewWithBackends(k8sclients, k8sclients, nil, nil)}

	servicesz := "../tests/data/registry/services-registryz.json"
	bServicesz, err := os.ReadFile(servicesz)
	assert.NoError(err)
	rServices := map[string][]byte{
		"istiod1": bServicesz,
	}
	registryServices, err2 := kubernetes.ParseRegistryServices(rServices)
	assert.NoError(err2)

	assert.Equal(3, len(registryServices))

	configz := "../tests/data/registry/services-configz.json"
	bConfigz, err2 := os.ReadFile(configz)
	assert.NoError(err2)
	rConfig := map[string][]byte{
		"istiod1": bConfigz,
	}
	registryConfig, err2 := kubernetes.ParseRegistryConfig(rConfig)
	assert.NoError(err2)

	assert.Equal(2, len(registryConfig.ServiceEntries))

	istioConfigList := models.IstioConfigList{
		ServiceEntries: registryConfig.ServiceEntries,
	}

	parsedServices := svc.buildRegistryServices(registryServices, istioConfigList)
	assert.Equal(3, len(parsedServices))
	assert.Equal(1, len(parsedServices[0].IstioReferences))
	assert.Equal(1, len(parsedServices[1].IstioReferences))
	assert.Equal(0, len(parsedServices[2].IstioReferences))
}

func TestFilterLocalIstioRegistry(t *testing.T) {
	assert := assert.New(t)

	conf := config.NewConfig()
	config.Set(conf)

	servicesz := "../tests/data/registry/istio-east-registryz.json"
	bServicesz, err := os.ReadFile(servicesz)
	assert.NoError(err)
	rServices := map[string][]byte{
		"istiod1": bServicesz,
	}
	registryServices, err2 := kubernetes.ParseRegistryServices(rServices)
	assert.NoError(err2)

	assert.Equal(true, filterIstioServiceByClusterId("istio-east", registryServices[0]))
	assert.Equal(false, filterIstioServiceByClusterId("istio-east", registryServices[1]))
}
