package business

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gorilla/mux"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	apps_v1 "k8s.io/api/apps/v1"
	v1 "k8s.io/api/core/v1"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/log"
)

type addOnsSetup struct {
	Url        string
	StatusCode int
	CallCount  *int
}

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

func TestComponentNamespaces(t *testing.T) {
	a := assert.New(t)

	conf := confWithComponentNamespaces()
	config.Set(conf)

	nss := getComponentNamespaces()

	a.Contains(nss, "istio-system")
	a.Contains(nss, "istio-admin")
	a.Contains(nss, "ingress-egress")
	a.Len(nss, 4)
}

func mockAddOnsCalls(ds []apps_v1.Deployment) (*kubetest.K8SClientMock, *httptest.Server, *int, *int, *int) {
	// Prepare the Call counts for each Addon
	jaegerCalls, grafanaCalls, prometheusCalls := 0, 0, 0

	// Mock k8s api calls
	k8s := mockDeploymentCall(ds)
	routes := mockAddOnCalls(defaultAddOnCalls(&jaegerCalls, &grafanaCalls, &prometheusCalls))
	httpServer := mockServer(routes)

	// Adapt the AddOns URLs to the mock Server
	conf := addonAddMockUrls(httpServer.URL, config.NewConfig())
	config.Set(conf)

	return k8s, httpServer, &jaegerCalls, &grafanaCalls, &prometheusCalls
}

func TestGrafanaWorking(t *testing.T) {
	assert := assert.New(t)

	k8s, httpServ, jaegerCalls, grafanaCalls, promCalls := mockAddOnsCalls([]apps_v1.Deployment{})
	defer httpServ.Close()

	iss := IstioStatusService{k8s: k8s}
	icsl, error := iss.GetStatus()
	assert.NoError(error)

	// Requests to AddOns have to be 1
	assert.Equal(1, *grafanaCalls)
	assert.Equal(1, *jaegerCalls)
	assert.Equal(1, *promCalls)

	assertNotPresent(assert, icsl, "grafana")
	assertNotPresent(assert, icsl, "prometheus")
	assertNotPresent(assert, icsl, "jaeger")
}

func TestGrafanaDisabled(t *testing.T) {
	assert := assert.New(t)

	k8s, httpServ, jaegerCalls, grafanaCalls, promCalls := mockAddOnsCalls([]apps_v1.Deployment{})
	defer httpServ.Close()

	// Disable Grafana
	conf := config.Get()
	conf.ExternalServices.Grafana.Enabled = false
	config.Set(conf)

	iss := IstioStatusService{k8s: k8s}
	icsl, error := iss.GetStatus()
	assert.NoError(error)

	// Only the Istio components are missing
	assert.Equal(3, len(icsl))

	// No request performed to Grafana endpoint
	assert.Zero(*grafanaCalls)

	// Requests to Jaeger and Prometheus performed once
	assert.Equal(1, *jaegerCalls)
	assert.Equal(1, *promCalls)

	assertNotPresent(assert, icsl, "grafana")
	assertNotPresent(assert, icsl, "prometheus")
	assertNotPresent(assert, icsl, "jaeger")
	assertNotPresent(assert, icsl, "custom dashboards")
}

func TestGrafanaNotWorking(t *testing.T) {
	assert := assert.New(t)
	jaegerCalls, grafanaCalls, prometheusCalls := 0, 0, 0
	k8s := mockDeploymentCall([]apps_v1.Deployment{})
	addOnsStetup := defaultAddOnCalls(&jaegerCalls, &grafanaCalls, &prometheusCalls)
	addOnsStetup["grafana"] = addOnsSetup{
		Url:        "/grafana/mock",
		StatusCode: 501,
		CallCount:  &grafanaCalls,
	}
	routes := mockAddOnCalls(addOnsStetup)
	httpServer := mockServer(routes)
	defer httpServer.Close()

	// Adapt the AddOns URLs to the mock Server
	conf := addonAddMockUrls(httpServer.URL, config.NewConfig())
	config.Set(conf)

	iss := IstioStatusService{k8s: k8s}
	icsl, error := iss.GetStatus()
	assert.NoError(error)

	// Grafana and Istio comps missing
	assert.Equal(4, len(icsl))

	// Requests to AddOns have to be 1
	assert.Equal(1, grafanaCalls)
	assert.Equal(1, jaegerCalls)
	assert.Equal(1, prometheusCalls)

	assertComponent(assert, icsl, "grafana", Unreachable, false)
	assertNotPresent(assert, icsl, "prometheus")
	assertNotPresent(assert, icsl, "jaeger")
}

func TestDefaults(t *testing.T) {
	assert := assert.New(t)

	pods := []apps_v1.Deployment{
		fakeDeploymentWithStatus("istio-egressgateway", map[string]string{"app": "istio-egressgateway", "istio": "egressgateway"}, unhealthyStatus),
		fakeDeploymentWithStatus("istiod", map[string]string{"app": "istiod", "istio": "pilot"}, healthyStatus),
	}

	k8s, httpServer, jaegerCalls, grafanaCalls, promCalls := mockAddOnsCalls(pods)
	defer httpServer.Close()

	iss := IstioStatusService{k8s: k8s}

	icsl, error := iss.GetStatus()
	assert.NoError(error)
	assertComponent(assert, icsl, "istio-ingressgateway", NotFound, true)
	assertComponent(assert, icsl, "istio-egressgateway", Unhealthy, false)

	// Don't return healthy deployments
	assertNotPresent(assert, icsl, "istiod")
	assertNotPresent(assert, icsl, "grafana")
	assertNotPresent(assert, icsl, "prometheus")
	assertNotPresent(assert, icsl, "jaeger")

	// Requests to AddOns have to be 1
	assert.Equal(1, *grafanaCalls)
	assert.Equal(1, *jaegerCalls)
	assert.Equal(1, *promCalls)
}

func TestNonDefaults(t *testing.T) {
	assert := assert.New(t)

	pods := []apps_v1.Deployment{
		fakeDeploymentWithStatus("istio-egressgateway", map[string]string{"app": "istio-egressgateway", "istio": "egressgateway"}, unhealthyStatus),
		fakeDeploymentWithStatus("istiod", map[string]string{"app": "istiod", "istio": "pilot"}, healthyStatus),
	}

	k8s, httpServer, jaegerCalls, grafanaCalls, promCalls := mockAddOnsCalls(pods)
	defer httpServer.Close()

	c := config.Get()
	c.ExternalServices.Istio.ComponentStatuses = config.ComponentStatuses{
		Enabled: true,
		Components: []config.ComponentStatus{
			{AppLabel: "istiod", IsCore: false},
			{AppLabel: "istio-egressgateway", IsCore: false},
			{AppLabel: "istio-ingressgateway", IsCore: false},
		},
	}
	config.Set(c)

	iss := IstioStatusService{k8s: k8s}

	icsl, error := iss.GetStatus()
	assert.NoError(error)
	assertComponent(assert, icsl, "istio-ingressgateway", NotFound, false)
	assertComponent(assert, icsl, "istio-egressgateway", Unhealthy, false)

	// Don't return healthy deployments
	assertNotPresent(assert, icsl, "istiod")
	assertNotPresent(assert, icsl, "grafana")
	assertNotPresent(assert, icsl, "prometheus")
	assertNotPresent(assert, icsl, "jaeger")

	// Requests to AddOns have to be 1
	assert.Equal(1, *grafanaCalls)
	assert.Equal(1, *jaegerCalls)
	assert.Equal(1, *promCalls)
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
			Template: v1.PodTemplateSpec{
				ObjectMeta: meta_v1.ObjectMeta{
					Name:   "",
					Labels: labels,
				},
			},
			Replicas: &status.Replicas,
		}}
}

func confWithComponentNamespaces() *config.Config {
	conf := config.NewConfig()
	conf.ExternalServices.Istio.ComponentStatuses = config.ComponentStatuses{
		Enabled: true,
		Components: []config.ComponentStatus{
			{AppLabel: "pilot", IsCore: true},
			{AppLabel: "ingress", IsCore: true, Namespace: "ingress-egress"},
			{AppLabel: "egress", IsCore: false, Namespace: "ingress-egress"},
			{AppLabel: "sds", IsCore: false, Namespace: "istio-admin"},
		},
	}

	return conf
}

func mockServer(mr *mux.Router) *httptest.Server {
	return httptest.NewServer(mr)
}

func addAddOnRoute(mr *mux.Router, url string, statusCode int, callNum *int) {
	mr.HandleFunc(url, func(w http.ResponseWriter, r *http.Request) {
		if callNum != nil {
			*callNum = *callNum + 1
		}
		if statusCode > 299 {
			http.Error(w, "Not a success", statusCode)
		} else {
			if c, err := w.Write([]byte("OK")); err != nil {
				log.Errorf("Error when mocking the addon call: %s (%d)", url, c)
			}
		}
	})
}

func mockAddOnCalls(addons map[string]addOnsSetup) *mux.Router {
	mr := mux.NewRouter()
	for _, addon := range addons {
		addAddOnRoute(mr, addon.Url, addon.StatusCode, addon.CallCount)
	}
	return mr
}

func defaultAddOnCalls(jaeger, grafana, prom *int) map[string]addOnsSetup {
	return map[string]addOnsSetup{
		"prometheus": {
			Url:        "/prometheus/mock",
			StatusCode: 200,
			CallCount:  prom,
		},
		"jaeger": {
			Url:        "/jaeger/mock",
			StatusCode: 200,
			CallCount:  jaeger,
		},
		"grafana": {
			Url:        "/grafana/mock",
			StatusCode: 200,
			CallCount:  grafana,
		},
		"custom dashboards": {
			Url:        "/prometheus-dashboards/mock",
			StatusCode: 200,
			CallCount:  nil,
		},
	}
}

func addonAddMockUrls(baseUrl string, conf *config.Config) *config.Config {
	conf.ExternalServices.Grafana.Enabled = true
	conf.ExternalServices.Grafana.IsCoreComponent = false
	conf.ExternalServices.Grafana.InClusterURL = baseUrl + "/grafana/mock"

	conf.ExternalServices.Tracing.Enabled = true
	conf.ExternalServices.Tracing.IsCoreComponent = false
	conf.ExternalServices.Tracing.InClusterURL = baseUrl + "/jaeger/mock"

	conf.ExternalServices.Prometheus.URL = baseUrl + "/prometheus/mock"

	conf.ExternalServices.CustomDashboards.Enabled = true
	conf.ExternalServices.CustomDashboards.IsCoreComponent = false
	conf.ExternalServices.CustomDashboards.Prometheus.URL = baseUrl + "/prometheus-dashboards/mock"
	return conf
}
