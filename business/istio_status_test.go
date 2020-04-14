package business

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	apps_v1 "k8s.io/api/apps/v1"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes/kubetest"
)

var healthyStatus = apps_v1.DeploymentStatus{
	Replicas:            2,
	AvailableReplicas:   2,
	UnavailableReplicas: 0,
}

var unhealthyStatus = apps_v1.DeploymentStatus{
	Replicas:            2,
	AvailableReplicas:   1,
	UnavailableReplicas: 1,
}

func TestComponentNotRunning(t *testing.T) {
	assert := assert.New(t)

	dss := []apps_v1.DeploymentStatus{
		{
			Replicas:            3,
			AvailableReplicas:   2,
			UnavailableReplicas: 1,
		},
		{
			Replicas:            1,
			AvailableReplicas:   0,
			UnavailableReplicas: 0,
		},
	}

	for _, ds := range dss {
		assert.Equal(Unhealthy, GetDeploymentStatus(
			fakeDeploymentWithStatus(
				"istio-egressgateway",
				map[string]string{"app": "istio-egressgateway", "istio": "egressgateway"},
				ds,
			)))
	}
}

func TestComponentRunning(t *testing.T) {
	assert := assert.New(t)

	status := GetDeploymentStatus(fakeDeploymentWithStatus(
		"istio-egressgateway",
		map[string]string{"app": "istio-egressgateway"},
		apps_v1.DeploymentStatus{
			Replicas:            2,
			AvailableReplicas:   2,
			UnavailableReplicas: 0,
		}),
	)

	assert.Equal(Healthy, status)
}

func TestAllComp(t *testing.T) {
	assert := assert.New(t)

	conf := config.NewConfig()
	config.Set(conf)

	pods := []apps_v1.Deployment{
		fakeDeploymentWithStatus("istio-egressgateway", map[string]string{"app": "istio-egressgateway", "istio": "egressgateway"}, healthyStatus),
		fakeDeploymentWithStatus("istiod", map[string]string{"app": "istiod", "istio": "pilot"}, healthyStatus),
		fakeDeploymentWithStatus("grafana", map[string]string{"app": "grafana"}, unhealthyStatus),
		fakeDeploymentWithStatus("istio-tracing", map[string]string{"app": "jaeger"}, unhealthyStatus),
	}

	k8s := mockDeploymentCall(pods)
	iss := IstioStatusService{k8s: k8s}

	icsl, error := iss.GetStatus()
	assert.NoError(error)
	assertComponent(assert, icsl, "istio-egressgateway", Healthy, true)
	assertComponent(assert, icsl, "istio-ingressgateway", NotFound, true)
	assertComponent(assert, icsl, "istiod", Healthy, true)
	assertComponent(assert, icsl, "grafana", Unhealthy, false)
	assertComponent(assert, icsl, "jaeger", Unhealthy, false)
	assertComponent(assert, icsl, "prometheus", NotFound, false)
}

func assertComponent(assert *assert.Assertions, icsl IstioComponentStatus, name string, status Status, isCore bool) {
	for _, ics := range icsl {
		if ics.Name == ComponentName(name) {
			assert.Equal(status, ics.Status)
			assert.Equal(IsCoreComponent(isCore), ics.IsCore)
		}
	}
}

// Setup K8S api call to fetch Pods
func mockDeploymentCall(deployments []apps_v1.Deployment) *kubetest.K8SClientMock {
	k8s := new(kubetest.K8SClientMock)
	k8s.On("GetDeployments", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return(deployments, nil)

	return k8s
}

func fakeDeploymentWithStatus(name string, labels map[string]string, status apps_v1.DeploymentStatus) apps_v1.Deployment {
	return apps_v1.Deployment{
		ObjectMeta: meta_v1.ObjectMeta{
			Name:   name,
			Labels: labels,
		},
		Status: status,
		Spec: apps_v1.DeploymentSpec{
			Replicas: &status.Replicas,
			Selector: &meta_v1.LabelSelector{
				MatchLabels: labels}}}
}
