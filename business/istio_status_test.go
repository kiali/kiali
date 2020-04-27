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

var isMixerDisabled *bool

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

	// Cleaning up environment
	shutdown()
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

	// Cleaning up environment
	shutdown()
}

func TestGrafanaDisabled(t *testing.T) {
	assert := assert.New(t)

	conf := config.NewConfig()
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
	assertNotPresent(assert, icsl, GRAFANA_COMPONENT)

	// Cleaning up environment
	shutdown()
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
	assertNotPresent(assert, icsl, TRACING_COMPONENT)

	// Cleaning up environment
	shutdown()
}

func TestMonolithComp(t *testing.T) {
	assert := assert.New(t)

	conf := config.NewConfig()
	config.Set(conf)

	pods := []apps_v1.Deployment{
		fakeDeploymentWithStatus("istio-egressgateway", map[string]string{"app": "istio-egressgateway", "istio": "egressgateway"}, healthyStatus),
		fakeDeploymentWithStatus("istiod", map[string]string{"app": "istiod", "istio": "pilot"}, healthyStatus),
		fakeDeploymentWithStatus("grafana", map[string]string{"app": "grafana"}, unhealthyStatus),
		fakeDeploymentWithStatus("istio-tracing", map[string]string{"app": "jaeger"}, unhealthyStatus),
	}

	k8s := mockDeploymentCall(pods, true)
	iss := IstioStatusService{k8s: k8s}

	icsl, error := iss.GetStatus()
	assert.NoError(error)
	assertComponent(assert, icsl, "istio-ingressgateway", NotFound, true)
	assertComponent(assert, icsl, "grafana", Unhealthy, false)
	assertComponent(assert, icsl, "istio-tracing", Unhealthy, false)
	assertComponent(assert, icsl, "prometheus", NotFound, true)

	// Don't return healthy deployments
	assertNotPresent(assert, icsl, "istio-egressgateway")
	assertNotPresent(assert, icsl, "istiod")

	// Don't return status of mixer deployment
	assertNotPresent(assert, icsl, "istio-citadel")
	assertNotPresent(assert, icsl, "istio-galley")
	assertNotPresent(assert, icsl, "istio-pilot")
	assertNotPresent(assert, icsl, "istio-policy")
	assertNotPresent(assert, icsl, "istio-telemetry")

	// Cleaning up environment
	shutdown()
}

func TestMixerComp(t *testing.T) {
	assert := assert.New(t)

	conf := config.NewConfig()
	config.Set(conf)

	pods := []apps_v1.Deployment{
		fakeDeploymentWithStatus("istio-citadel", map[string]string{"app": "citadel", "istio": "citadel"}, healthyStatus),
		fakeDeploymentWithStatus("istio-egressgateway", map[string]string{"app": "istio-egressgateway", "istio": "egressgateway"}, healthyStatus), fakeDeploymentWithStatus("istio-pilot", map[string]string{"app": "pilot", "istio": "pilot"}, healthyStatus), fakeDeploymentWithStatus("grafana", map[string]string{"app": "grafana"}, unhealthyStatus),
		fakeDeploymentWithStatus("istio-tracing", map[string]string{"app": "jaeger"}, unhealthyStatus),
	}

	k8s := mockDeploymentCall(pods, false)
	iss := IstioStatusService{k8s: k8s}

	boolVar := true
	isMixerDisabled = &boolVar
	icsl, error := iss.GetStatus()
	assert.NoError(error)
	assertComponent(assert, icsl, "istio-galley", NotFound, true)
	assertComponent(assert, icsl, "istio-ingressgateway", NotFound, true)
	assertComponent(assert, icsl, "istio-policy", NotFound, true)
	assertComponent(assert, icsl, "istio-sidecar-injector", NotFound, true)
	assertComponent(assert, icsl, "istio-telemetry", NotFound, true)
	assertComponent(assert, icsl, "grafana", Unhealthy, false)
	assertComponent(assert, icsl, "istio-tracing", Unhealthy, false)
	assertComponent(assert, icsl, "prometheus", NotFound, true)

	// Don't return healthy deployments
	assertNotPresent(assert, icsl, "istio-citadel")
	assertNotPresent(assert, icsl, "istio-egressgateway")
	assertNotPresent(assert, icsl, "istio-pilot")

	// Don't return status of mixer deployment
	assertNotPresent(assert, icsl, "istiod")

	// Cleaning up environment
	shutdown()
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
			Replicas: &status.Replicas,
			Selector: &meta_v1.LabelSelector{
				MatchLabels: labels}}}
}

func shutdown() {
	delete(components["mixer"], GRAFANA_COMPONENT)
	delete(components["mixer"], TRACING_COMPONENT)
	delete(components["mixerless"], TRACING_COMPONENT)
	delete(components["mixerless"], GRAFANA_COMPONENT)
}
