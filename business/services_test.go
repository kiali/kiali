package business

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	core_v1 "k8s.io/api/core/v1"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes/kubetest"
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
