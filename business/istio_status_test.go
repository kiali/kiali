package business

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	v1 "k8s.io/api/core/v1"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes/kubetest"
)

func TestComponentNotRunning(t *testing.T) {
	assert := assert.New(t)

	phases := []v1.PodPhase{
		v1.PodFailed,
		v1.PodPending,
		v1.PodSucceeded,
		v1.PodUnknown,
	}

	for _, phase := range phases {
		status, ok := GetPodStatus(fakePodWithPhase(phase))
		assert.True(ok)
		assert.Equal(NotRunning, status)
	}
}

func TestComponentRunning(t *testing.T) {
	assert := assert.New(t)

	status, ok := GetPodStatus(fakePodWithPhase(v1.PodRunning))
	assert.True(ok)
	assert.Equal(Running, status)
}

func fakePodWithPhase(phase v1.PodPhase) v1.Pod {
	return kubetest.FakePod(
		"grafana-19hhhj",
		map[string]string{"app": "grafana"},
		phase,
	)
}

func TestAllComp(t *testing.T) {
	assert := assert.New(t)

	conf := config.NewConfig()
	config.Set(conf)

	pods := []v1.Pod{
		kubetest.FakePod("istio-egressgateway-122hjbhq", map[string]string{"app": "istio-egressgateway", "istio": "egressgateway"}, v1.PodRunning),
		kubetest.FakePod("istiod-1jna99", map[string]string{"app": "istiod", "istio": "pilot"}, v1.PodRunning),
		kubetest.FakePod("grafana-982jjh", map[string]string{"app": "grafana"}, v1.PodFailed),
		kubetest.FakePod("istio-tracing-847ajj", map[string]string{"app": "jaeger"}, v1.PodPending),
	}

	k8s := mockPodsCall(pods)
	iss := IstioStatusService{k8s: k8s}

	icsl, error := iss.GetStatus()
	assert.NoError(error)
	assert.Equal(Running, icsl["istio-egressgateway"].Status)
	assert.Equal(IsCoreComponent(true), icsl["istio-egressgateway"].IsCore)
	assert.Equal(NotFound, icsl["istio-ingressgateway"].Status)
	assert.Equal(IsCoreComponent(true), icsl["istio-ingressgateway"].IsCore)
	assert.Equal(Running, icsl["istiod"].Status)
	assert.Equal(IsCoreComponent(true), icsl["istiod"].IsCore)
	assert.Equal(NotRunning, icsl["grafana"].Status)
	assert.Equal(IsCoreComponent(false), icsl["grafana"].IsCore)
	assert.Equal(NotRunning, icsl["jaeger"].Status)
	assert.Equal(IsCoreComponent(false), icsl["jaeger"].IsCore)
	assert.Equal(NotFound, icsl["prometheus"].Status)
	assert.Equal(IsCoreComponent(false), icsl["prometheus"].IsCore)
}

func TestMultiplePod(t *testing.T) {
	assert := assert.New(t)

	conf := config.NewConfig()
	config.Set(conf)

	pods := []v1.Pod{
		kubetest.FakePod("istio-egressgateway-122hjbhq", map[string]string{"app": "istio-egressgateway", "istio": "egressgateway"}, v1.PodRunning),
		kubetest.FakePod("istio-egressgateway-jh88j880", map[string]string{"app": "istio-egressgateway", "istio": "egressgateway"}, v1.PodFailed),
	}

	k8s := mockPodsCall(pods)
	iss := IstioStatusService{k8s: k8s}

	icsl, error := iss.GetStatus()
	assert.NoError(error)
	assert.Equal(Running, icsl["istio-egressgateway"].Status)
	assert.Equal(IsCoreComponent(true), icsl["istio-egressgateway"].IsCore)
}

func TestContainerStatus(t *testing.T) {
	assert := assert.New(t)

	conf := config.NewConfig()
	config.Set(conf)

	pods := []v1.Pod{
		kubetest.FakePodWithContainers(
			"istio-egressgateway-122hjbhq",
			map[string]string{"app": "istio-egressgateway", "istio": "egressgateway"},
			v1.PodRunning,
			[]v1.ContainerStatus{
				{
					Name:  "istio-egressgateway",
					Ready: false,
				},
				{
					Name:  "istio-egress-2",
					Ready: true,
				},
			},
		),
		kubetest.FakePodWithContainers(
			"istiod-1jna99",
			map[string]string{"app": "istiod", "istio": "pilot"},
			v1.PodRunning,
			[]v1.ContainerStatus{
				{
					Name:  "istiod",
					Ready: true,
				},
				{
					Name:  "istiod",
					Ready: true,
				},
			},
		),
		kubetest.FakePodWithContainers(
			"istio-tracing-847ajj",
			map[string]string{"app": "jaeger"},
			v1.PodRunning,
			[]v1.ContainerStatus{
				{
					Name:  "istio-tracing",
					Ready: true,
				},
			},
		),
		kubetest.FakePodWithContainers(
			"grafana-982jjh",
			map[string]string{"app": "grafana"},
			v1.PodRunning,
			[]v1.ContainerStatus{
				{
					Name:  "grafana",
					Ready: false,
				},
			},
		),
		kubetest.FakePodWithContainers(
			"prometheus-982jjh",
			map[string]string{"app": "prometheus"},
			v1.PodPending,
			[]v1.ContainerStatus{
				{
					Name:  "prometheus",
					Ready: true,
				},
			},
		),
	}

	k8s := mockPodsCall(pods)
	iss := IstioStatusService{k8s: k8s}

	icsl, error := iss.GetStatus()
	assert.NoError(error)
	assert.Equal(NotRunning, icsl["istio-egressgateway"].Status)
	assert.Equal(Running, icsl["istiod"].Status)
	assert.Equal(Running, icsl["jaeger"].Status)
	assert.Equal(NotRunning, icsl["grafana"].Status)
	assert.Equal(NotRunning, icsl["prometheus"].Status)
	assert.Equal(NotFound, icsl["istio-ingressgateway"].Status)
}

func TestStatusHealthier(t *testing.T) {
	assert := assert.New(t)

	assert.Equal(Running, healthiest(Running, Running))
	assert.Equal(Running, healthiest(Running, NotRunning))
	assert.Equal(Running, healthiest(Running, NotFound))

	assert.Equal(Running, healthiest(NotRunning, Running))
	assert.Equal(NotRunning, healthiest(NotRunning, NotRunning))
	assert.Equal(NotRunning, healthiest(NotRunning, NotFound))

	assert.Equal(Running, healthiest(NotFound, Running))
	assert.Equal(NotRunning, healthiest(NotFound, NotRunning))
	assert.Equal(NotFound, healthiest(NotFound, NotFound))
}

// Setup K8S api call to fetch Pods
func mockPodsCall(pods []v1.Pod) *kubetest.K8SClientMock {
	k8s := new(kubetest.K8SClientMock)
	k8s.On("GetPods", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return(pods, nil)

	return k8s
}
