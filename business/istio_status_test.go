package business

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	apps_v1 "k8s.io/api/apps/v1"
	v1 "k8s.io/api/core/v1"
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

func TestGrafanaDisabled(t *testing.T) {
	assert := assert.New(t)

	conf := confWithIstioComponents()
	conf.ExternalServices.Grafana.Enabled = false
	config.Set(conf)

	pods := []apps_v1.Deployment{
		fakeDeploymentWithStatus("istiod", map[string]string{"app": "istiod", "istio": "pilot"}, healthyStatus),
	}

	k8s := mockDeploymentCall(pods, true)
	iss := IstioStatusService{k8s: k8s}

	icsl, error := iss.GetStatus()
	assert.NoError(error)
	assertComponent(assert, icsl, "istio-ingressgateway", NotFound, true)

	// Don't return status of mixer deployment
	assertNotPresent(assert, icsl, "grafana")
}

func TestTracingDisabled(t *testing.T) {
	assert := assert.New(t)

	conf := config.NewConfig()
	conf.ExternalServices.Tracing.Enabled = false
	config.Set(conf)

	pods := []apps_v1.Deployment{
		fakeDeploymentWithStatus("istiod", map[string]string{"app": "istiod", "istio": "pilot"}, healthyStatus),
	}

	k8s := mockDeploymentCall(pods, true)
	iss := IstioStatusService{k8s: k8s}

	icsl, error := iss.GetStatus()
	assert.NoError(error)
	assertComponent(assert, icsl, "istio-ingressgateway", NotFound, true)

	// Don't return status of mixer deployment
	assertNotPresent(assert, icsl, "jaeger")
}

func TestDefaults(t *testing.T) {
	assert := assert.New(t)

	config.Set(confWithIstioComponents())

	pods := []apps_v1.Deployment{
		fakeDeploymentWithStatus("istio-egressgateway", map[string]string{"app": "istio-egressgateway", "istio": "egressgateway"}, healthyStatus),
		fakeDeploymentWithStatus("istiod", map[string]string{"app": "istiod", "istio": "pilot"}, healthyStatus),
		fakeDeploymentWithStatus("grafana", map[string]string{"app": "grafana"}, unhealthyStatus),
		fakeDeploymentWithStatus("jaeger", map[string]string{"app": "jaeger"}, unhealthyStatus),
	}

	k8s := mockDeploymentCall(pods, true)
	iss := IstioStatusService{k8s: k8s}

	icsl, error := iss.GetStatus()
	assert.NoError(error)
	assertComponent(assert, icsl, "istio-ingressgateway", NotFound, true)
	assertComponent(assert, icsl, "grafana", Unhealthy, false)
	assertComponent(assert, icsl, "jaeger", Unhealthy, false)
	assertComponent(assert, icsl, "prometheus", NotFound, true)

	// Don't return healthy deployments
	assertNotPresent(assert, icsl, "istio-egressgateway")
	assertNotPresent(assert, icsl, "istiod")
}

func TestNonDefaults(t *testing.T) {
	assert := assert.New(t)

	c := confWithIstioComponents()
	c.ExternalServices.Tracing.ComponentStatus = config.ComponentStatus{AppLabel: "jaeger", IsCore: true}
	c.ExternalServices.Istio.ComponentStatuses = config.ComponentStatuses{
		Enabled: true,
		Components: []config.ComponentStatus{
			{AppLabel: "istiod", IsCore: true},
			{AppLabel: "istio-egressgateway", IsCore: false},
			{AppLabel: "istio-ingressgateway", IsCore: false},
		},
	}
	config.Set(c)

	pods := []apps_v1.Deployment{
		fakeDeploymentWithStatus("istio-egressgateway", map[string]string{"app": "istio-egressgateway", "istio": "egressgateway"}, healthyStatus),
		fakeDeploymentWithStatus("istiod", map[string]string{"app": "istiod", "istio": "pilot"}, healthyStatus),
		fakeDeploymentWithStatus("grafana", map[string]string{"app": "grafana"}, unhealthyStatus),
		fakeDeploymentWithStatus("jaeger", map[string]string{"app": "jaeger"}, unhealthyStatus),
	}

	k8s := mockDeploymentCall(pods, true)
	iss := IstioStatusService{k8s: k8s}

	icsl, error := iss.GetStatus()
	assert.NoError(error)
	assertComponent(assert, icsl, "istio-ingressgateway", NotFound, false)
	assertComponent(assert, icsl, "grafana", Unhealthy, false)
	assertComponent(assert, icsl, "jaeger", Unhealthy, true)
	assertComponent(assert, icsl, "prometheus", NotFound, true)

	// Don't return healthy deployments
	assertNotPresent(assert, icsl, "istio-egressgateway")
	assertNotPresent(assert, icsl, "istiod")
}

func assertComponent(assert *assert.Assertions, icsl IstioComponentStatus, name string, status string, isCore bool) {
	componentFound := false
	for _, ics := range icsl {
		if ics.Name == name {
			assert.Equal(status, ics.Status)
			assert.Equal(isCore, ics.IsCore)
			componentFound = true
		}
	}

	assert.True(componentFound)
}

func assertNotPresent(assert *assert.Assertions, icsl IstioComponentStatus, name string) {
	componentFound := false
	for _, ics := range icsl {
		if ics.Name == name {
			componentFound = true
		}
	}
	assert.False(componentFound)
}

// Setup K8S api call to fetch Pods
func mockDeploymentCall(deployments []apps_v1.Deployment, mixerDisabled bool) *kubetest.K8SClientMock {
	k8s := new(kubetest.K8SClientMock)
	k8s.On("GetDeployments", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return(deployments, nil)
	k8s.On("IsMixerDisabled").Return(mixerDisabled)

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
			Template: v1.PodTemplateSpec{
				ObjectMeta: meta_v1.ObjectMeta{
					Name:   "",
					Labels: labels,
				},
			},
			Replicas: &status.Replicas,
		}}
}

func confWithIstioComponents() *config.Config {
	conf := config.NewConfig()
	conf.IstioComponentNamespaces = config.IstioComponentNamespaces{
		"grafana": "istio-system",
		"istiod":  "istio-config",
	}
	return conf
}
