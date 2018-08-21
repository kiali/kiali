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

func TestAppsListHandler(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	// Setup mocks
	k8s := new(kubetest.K8SClientMock)
	// Auxiliar fake* tests defined in workload_test.go
	k8s.On("GetDeployments", mock.AnythingOfType("string")).Return(fakeDeploymentList(), nil)
	k8s.On("GetPods", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return(fakePodList(), nil)
	k8s.On("GetDeploymentSelector", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return(fakeDeploymentSelector(), nil)
	svc := setupAppService(k8s)

	appList, _ := svc.GetAppList("Namespace")

	assert.Equal("Namespace", appList.Namespace.Name)

	assert.Equal(1, len(appList.Apps))
	assert.Equal("httpbin", appList.Apps[0].Name)
}
