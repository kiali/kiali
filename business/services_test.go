package business

import (
	"io/ioutil"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	core_v1 "k8s.io/api/core/v1"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/models"
)

func TestServiceListParsing(t *testing.T) {
	assert := assert.New(t)

	// Setup mocks
	k8s := new(kubetest.K8SClientMock)
	k8s.MockServices("Namespace", []string{"reviews", "httpbin"})
	k8s.On("GetPods", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return(kubetest.FakePodList(), nil)
	k8s.On("IsOpenShift").Return(false)
	k8s.On("GetNamespace", mock.AnythingOfType("string")).Return(&core_v1.Namespace{}, nil)
	conf := config.NewConfig()
	config.Set(conf)
	setupGlobalMeshConfig()
	svc := SvcService{k8s: k8s, businessLayer: NewWithBackends(k8s, nil, nil)}

	criteria := ServiceCriteria{Namespace: "Namespace", IncludeIstioResources: false}
	serviceList, _ := svc.GetServiceList(criteria)

	assert.Equal("Namespace", serviceList.Namespace.Name)
	assert.Len(serviceList.Services, 2)
	reviewsOverview := serviceList.Services[0]
	httpbinOverview := serviceList.Services[1]

	assert.Equal("reviews", reviewsOverview.Name)
	assert.Equal("httpbin", httpbinOverview.Name)
}

func TestParseRegistryServices(t *testing.T) {
	assert := assert.New(t)

	conf := config.NewConfig()
	config.Set(conf)

	k8s := new(kubetest.K8SClientMock)
	k8s.On("IsOpenShift").Return(false)
	setupGlobalMeshConfig()
	svc := SvcService{k8s: nil, businessLayer: NewWithBackends(k8s, nil, nil)}

	servicesz := "../tests/data/registry/services-registryz.json"
	bServicesz, err := ioutil.ReadFile(servicesz)
	assert.NoError(err)
	rServices := map[string][]byte{
		"istiod1": bServicesz,
	}
	registryServices, err2 := kubernetes.ParseRegistryServices(rServices)
	assert.NoError(err2)

	assert.Equal(3, len(registryServices))

	configz := "../tests/data/registry/services-configz.json"
	bConfigz, err2 := ioutil.ReadFile(configz)
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
	bServicesz, err := ioutil.ReadFile(servicesz)
	assert.NoError(err)
	rServices := map[string][]byte{
		"istiod1": bServicesz,
	}
	registryServices, err2 := kubernetes.ParseRegistryServices(rServices)
	assert.NoError(err2)

	assert.Equal(true, filterIstioServiceByClusterId("istio-east", registryServices[0]))
	assert.Equal(false, filterIstioServiceByClusterId("istio-east", registryServices[1]))
}
