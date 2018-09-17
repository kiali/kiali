package business

import (
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"testing"
)

func setupAppService(k8s *kubetest.K8SClientMock) AppService {
	return AppService{k8s: k8s}
}

func TestGetAppList(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	// Setup mocks
	k8s := new(kubetest.K8SClientMock)
	// Auxiliar fake* tests defined in workload_test.go
	k8s.On("GetDeployments", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return(fakeDeploymentList(), nil)
	k8s.On("GetPods", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return(fakePodList(), nil)
	svc := setupAppService(k8s)

	appList, _ := svc.GetAppList("Namespace")

	assert.Equal("Namespace", appList.Namespace.Name)

	assert.Equal(1, len(appList.Apps))
	assert.Equal("httpbin", appList.Apps[0].Name)
}

func TestGetApp(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	// Setup mocks
	k8s := new(kubetest.K8SClientMock)
	k8s.On("GetDeployments", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return(fakeDeploymentList(), nil)
	k8s.On("GetPods", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return(fakePodList(), nil)
	k8s.On("GetServices", mock.AnythingOfType("string"), mock.AnythingOfType("map[string]string")).Return(fakeServices(), nil)
	svc := setupAppService(k8s)

	appDetails, _ := svc.GetApp("Namespace", "httpbin")

	assert.Equal("Namespace", appDetails.Namespace.Name)
	assert.Equal("httpbin", appDetails.Name)

	assert.Equal(3, len(appDetails.Workloads))
	assert.Equal("httpbin-v1", appDetails.Workloads[0].WorkloadName)
	assert.Equal("httpbin-v2", appDetails.Workloads[1].WorkloadName)
	assert.Equal("httpbin-v3", appDetails.Workloads[2].WorkloadName)
}
