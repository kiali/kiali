package business

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/prometheus/prometheustest"
)

func TestServiceListParsing(t *testing.T) {
	assert := assert.New(t)

	// Setup mocks
	k8s := new(kubetest.K8SClientMock)
	k8s.On("GetServices", mock.AnythingOfType("string")).Return(k8s.FakeServiceList(), nil)
	k8s.On("GetPods", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return(k8s.FakePodList(), nil)
	conf := config.NewConfig()
	config.Set(conf)
	svc := SvcService{k8s: k8s}

	serviceList, _ := svc.GetServiceList("Namespace")

	assert.Equal("Namespace", serviceList.Namespace.Name)
	assert.Len(serviceList.Services, 2)
	reviewsOverview := serviceList.Services[0]
	httpbinOverview := serviceList.Services[1]

	assert.Equal("reviews", reviewsOverview.Name)
	assert.Equal("httpbin", httpbinOverview.Name)
}

func setupServices(k8s *kubetest.K8SClientMock, prom *prometheustest.PromClientMock) SvcService {
	conf := config.NewConfig()
	config.Set(conf)
	health := HealthService{k8s: k8s, prom: prom}
	svc := SvcService{k8s: k8s, prom: prom, health: &health}
	return svc
}

func fakeIstioDetails() *kubernetes.IstioDetails {
	return &kubernetes.IstioDetails{}
}
