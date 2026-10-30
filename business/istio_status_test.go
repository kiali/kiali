package business

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"

	"github.com/gorilla/mux"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apps_v1 "k8s.io/api/apps/v1"
	v1 "k8s.io/api/core/v1"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	"github.com/kiali/kiali/cache"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/istio"
	"github.com/kiali/kiali/istio/istiotest"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tracing"
	"github.com/kiali/kiali/tracing/tracingtest"
)

type addOnsSetup struct {
	Url        string
	StatusCode int
	CallCount  *int
}

var notReadyStatus = apps_v1.DeploymentStatus{
	Replicas:            0,
	AvailableReplicas:   0,
	UnavailableReplicas: 0,
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

var healthyDaemonSetStatus = apps_v1.DaemonSetStatus{
	DesiredNumberScheduled: 2,
	CurrentNumberScheduled: 2,
	NumberAvailable:        2,
	NumberUnavailable:      0,
}

var unhealthyDaemonSetStatus = apps_v1.DaemonSetStatus{
	DesiredNumberScheduled: 2,
	CurrentNumberScheduled: 2,
	NumberAvailable:        1,
	NumberUnavailable:      1,
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
		d := fakeDeploymentWithStatus(
			"istio=egressgateway",
			map[string]string{"istio": "egressgateway"},
			ds,
		)
		wl := &models.Workload{}
		wl.ParseDeployment(d, config.Get())
		assert.Equal(kubernetes.ComponentUnhealthy, GetWorkloadStatus(*wl))
	}
}

func TestComponentRunning(t *testing.T) {
	assert := assert.New(t)

	d := fakeDeploymentWithStatus(
		"istio=egressgateway",
		map[string]string{"istio": "egressgateway"},
		apps_v1.DeploymentStatus{
			Replicas:            2,
			AvailableReplicas:   2,
			UnavailableReplicas: 0,
		})

	wl := &models.Workload{}
	wl.ParseDeployment(d, config.Get())

	assert.Equal(kubernetes.ComponentHealthy, GetWorkloadStatus(*wl))
}

func TestComponentNamespaces(t *testing.T) {
	a := assert.New(t)

	conf := confWithComponentNamespaces()

	nss := getComponentNamespaces(conf)

	a.Contains(nss, "istio-system")
	a.Contains(nss, "istio-admin")
	a.Contains(nss, "ingress-egress")
	a.Len(nss, 4)
}

func mockAddOnsCalls(t *testing.T, objects []runtime.Object, _ bool, overrideAddonURLs bool) (kubernetes.UserClientInterface, *int, *int, *int) {
	// Prepare the Call counts for each Addon
	grafanaCalls, persesCalls, prometheusCalls := 0, 0, 0

	objects = append(objects, &v1.Namespace{ObjectMeta: meta_v1.ObjectMeta{Name: "istio-system"}})

	k8s := kubetest.NewFakeK8sClient(objects...)
	k8s.OpenShift = true
	routes := mockAddOnCalls(defaultAddOnCalls(&grafanaCalls, &persesCalls, &prometheusCalls))
	httpServer := mockServer(t, routes)

	// Adapt the AddOns URLs to the mock Server
	conf := addonAddMockUrls(httpServer.URL, config.NewConfig(), overrideAddonURLs)
	config.Set(conf)

	return k8s, &grafanaCalls, &persesCalls, &prometheusCalls
}

func sampleIstioComponent() ([]runtime.Object, bool, bool) {
	deployment := fakeDeploymentWithStatus(
		"istio=egressgateway",
		map[string]string{"istio": "egressgateway"},
		apps_v1.DeploymentStatus{
			Replicas:            2,
			AvailableReplicas:   2,
			UnavailableReplicas: 0,
		})
	objects := []runtime.Object{deployment}
	for _, obj := range healthyIstiods() {
		o := obj
		objects = append(objects, &o)
	}
	return objects, true, false
}

func healthyIstiods() []v1.Pod {
	return []v1.Pod{
		fakePod("istiod-x3v1kn0l-running", "istio-system", "istiod", "Running"),
		fakePod("istiod-x3v1kn1l-running", "istio-system", "istiod", "Running"),
		fakePod("istiod-x3v1kn0l-terminating", "istio-system", "istiod", "Terminating"),
		fakePod("istiod-x3v1kn1l-terminating", "istio-system", "istiod", "Terminating"),
	}
}

func fakePod(name, namespace, appLabel, phase string) v1.Pod {
	return v1.Pod{
		ObjectMeta: meta_v1.ObjectMeta{
			Name:      name,
			Namespace: namespace,
			Labels: map[string]string{
				"app": appLabel,
			},
		},
		Status: v1.PodStatus{
			Phase: v1.PodPhase(phase),
		},
	}
}

func TestGrafanaWorking(t *testing.T) {
	assert := assert.New(t)

	objs, b1, b2 := sampleIstioComponent()
	k8s, grafanaCalls, persesCalls, promCalls := mockAddOnsCalls(t, objs, b1, b2)

	conf := config.Get()
	config.Set(conf)

	iss := NewLayerBuilder(t, conf).WithClient(k8s).WithTraceLoader(mockJaeger).Build().IstioStatus
	icsl, error := iss.GetStatus(context.TODO())
	assert.NoError(error)

	// Requests to AddOns have to be 1
	assert.Equal(1, *grafanaCalls)
	assert.Equal(1, *promCalls)
	assert.Equal(1, *persesCalls)

	// All services are healthy
	assertComponent(assert, icsl, "grafana", kubernetes.ComponentHealthy, false)
	assertComponent(assert, icsl, "prometheus", kubernetes.ComponentHealthy, false)
	assertComponent(assert, icsl, "tracing", kubernetes.ComponentHealthy, false)
	assertComponent(assert, icsl, "custom dashboards", kubernetes.ComponentHealthy, false)
}

func TestGrafanaDisabled(t *testing.T) {
	assert := assert.New(t)

	objects := []runtime.Object{
		fakeDeploymentWithStatus(
			"istio=egressgateway",
			map[string]string{"istio": "egressgateway"},
			apps_v1.DeploymentStatus{
				Replicas:            2,
				AvailableReplicas:   2,
				UnavailableReplicas: 0,
			}),
	}
	k8s, grafanaCalls, persesCalls, promCalls := mockAddOnsCalls(t, objects, true, false)
	// Disable Grafana
	conf := config.Get()
	conf.ExternalServices.Grafana.Enabled = false
	config.Set(conf)

	iss := NewLayerBuilder(t, conf).WithClient(k8s).WithTraceLoader(mockJaeger).Build().IstioStatus
	icsl, error := iss.GetStatus(context.TODO())
	assert.NoError(error)

	// No request performed to Grafana endpoint
	assert.Zero(*grafanaCalls)

	// Requests to Tracing and Prometheus performed once
	assert.Equal(1, *promCalls)

	assert.Equal(1, *persesCalls)
	// Grafana is disabled
	assertNotPresent(assert, icsl, "grafana")

	// istiod component is missing
	assertComponent(assert, icsl, "istiod", kubernetes.ComponentNotFound, true)

	// The rest of the components are healthy
	assertComponent(assert, icsl, "istio=egressgateway", kubernetes.ComponentHealthy, false)
	assertComponent(assert, icsl, "prometheus", kubernetes.ComponentHealthy, false)
	assertComponent(assert, icsl, "tracing", kubernetes.ComponentHealthy, false)
	assertComponent(assert, icsl, "custom dashboards", kubernetes.ComponentHealthy, false)
}

func TestPrometheusDisabled(t *testing.T) {
	assert := assert.New(t)

	objects := []runtime.Object{
		fakeDeploymentWithStatus(
			"istio=egressgateway",
			map[string]string{"istio": "egressgateway"},
			apps_v1.DeploymentStatus{
				Replicas:            2,
				AvailableReplicas:   2,
				UnavailableReplicas: 0,
			}),
	}
	k8s, grafanaCalls, _, promCalls := mockAddOnsCalls(t, objects, true, false)
	conf := config.Get()
	conf.ExternalServices.Prometheus.Enabled = false
	config.Set(conf)

	iss := NewLayerBuilder(t, conf).WithClient(k8s).WithTraceLoader(mockJaeger).Build().IstioStatus
	icsl, error := iss.GetStatus(context.TODO())
	assert.NoError(error)

	assert.Zero(*promCalls)
	assertNotPresent(assert, icsl, "prometheus")

	assert.NotZero(*grafanaCalls)
	assertComponent(assert, icsl, "grafana", kubernetes.ComponentHealthy, false)
}

func TestGrafanaNotWorking(t *testing.T) {
	assert := assert.New(t)
	grafanaCalls, persesCalls, prometheusCalls := 0, 0, 0
	objects := []runtime.Object{
		fakeDeploymentWithStatus(
			"istio=egressgateway",
			map[string]string{"istio": "egressgateway"},
			apps_v1.DeploymentStatus{
				Replicas:            2,
				AvailableReplicas:   2,
				UnavailableReplicas: 0,
			}),
	}
	objects = append(objects, &v1.Namespace{ObjectMeta: meta_v1.ObjectMeta{Name: "istio-system"}})
	addOnsStetup := defaultAddOnCalls(&grafanaCalls, &persesCalls, &prometheusCalls)
	addOnsStetup["grafana"] = addOnsSetup{
		Url:        "/grafana/mock",
		StatusCode: 501,
		CallCount:  &grafanaCalls,
	}
	routes := mockAddOnCalls(addOnsStetup)
	httpServer := mockServer(t, routes)

	// Adapt the AddOns URLs to the mock Server
	conf := addonAddMockUrls(httpServer.URL, config.NewConfig(), false)
	config.Set(conf)

	k8s := kubetest.NewFakeK8sClient(objects...)
	k8s.OpenShift = true

	iss := NewLayerBuilder(t, conf).WithClient(k8s).WithTraceLoader(mockJaeger).Build().IstioStatus
	icsl, error := iss.GetStatus(context.TODO())
	assert.NoError(error)

	// Requests to AddOns have to be 1
	assert.Equal(1, grafanaCalls)
	assert.Equal(1, prometheusCalls)

	// Grafana and istiod comp missing
	assertComponent(assert, icsl, "grafana", kubernetes.ComponentUnreachable, false)
	assertComponent(assert, icsl, "istiod", kubernetes.ComponentNotFound, true)

	// The rest of the components are healthy
	assertComponent(assert, icsl, "istio=egressgateway", kubernetes.ComponentHealthy, false)
	assertComponent(assert, icsl, "prometheus", kubernetes.ComponentHealthy, false)
	assertComponent(assert, icsl, "tracing", kubernetes.ComponentHealthy, false)
	assertComponent(assert, icsl, "custom dashboards", kubernetes.ComponentHealthy, false)
}

func TestFailingTracingService(t *testing.T) {
	assert := assert.New(t)

	objs, b1, b2 := sampleIstioComponent()
	k8s, grafanaCalls, persesCalls, promCalls := mockAddOnsCalls(t, objs, b1, b2)

	conf := config.Get()
	config.Set(conf)

	iss := NewLayerBuilder(t, conf).WithClient(k8s).WithTraceLoader(mockFailingJaeger).Build().IstioStatus
	icsl, error := iss.GetStatus(context.TODO())
	assert.NoError(error)

	// Requests to AddOns have to be 1
	assert.Equal(1, *grafanaCalls)
	assert.Equal(1, *promCalls)
	assert.Equal(1, *persesCalls)

	// Tracing service is unreachable
	assertComponent(assert, icsl, "tracing", kubernetes.ComponentUnreachable, false)

	// The rest of the services are healthy
	assertComponent(assert, icsl, "grafana", kubernetes.ComponentHealthy, false)
	assertComponent(assert, icsl, "prometheus", kubernetes.ComponentHealthy, false)
	assertComponent(assert, icsl, "custom dashboards", kubernetes.ComponentHealthy, false)
}

func TestOverriddenUrls(t *testing.T) {
	assert := assert.New(t)

	objects, idReachable, _ := sampleIstioComponent()
	k8s, grafanaCalls, persesCalls, promCalls := mockAddOnsCalls(t, objects, idReachable, true)

	// conf set in mockAddOnsCalls
	conf := config.Get()

	iss := NewLayerBuilder(t, conf).WithClient(k8s).WithTraceLoader(mockJaeger).Build().IstioStatus
	icsl, error := iss.GetStatus(context.TODO())
	assert.NoError(error)

	// Requests to AddOns have to be 1
	assert.Equal(1, *grafanaCalls)
	assert.Equal(1, *promCalls)
	assert.Equal(1, *persesCalls)

	// All the services are healthy
	assertComponent(assert, icsl, "grafana", kubernetes.ComponentHealthy, false)
	assertComponent(assert, icsl, "prometheus", kubernetes.ComponentHealthy, false)
	assertComponent(assert, icsl, "tracing", kubernetes.ComponentHealthy, false)
	assertComponent(assert, icsl, "custom dashboards", kubernetes.ComponentHealthy, false)
}

func TestCustomDashboardsMainPrometheus(t *testing.T) {
	assert := assert.New(t)

	objs, b1, b2 := sampleIstioComponent()
	k8s, grafanaCalls, persesCalls, promCalls := mockAddOnsCalls(t, objs, b1, b2)

	// Custom Dashboard prom URL forced to be empty
	conf := config.Get()
	conf.ExternalServices.CustomDashboards.Prometheus.URL = ""
	config.Set(conf)

	iss := NewLayerBuilder(t, conf).WithClient(k8s).WithTraceLoader(mockJaeger).Build().IstioStatus
	icsl, error := iss.GetStatus(context.TODO())
	assert.NoError(error)

	// Requests to AddOns have to be 1
	assert.Equal(1, *grafanaCalls)
	assert.Equal(2, *promCalls)
	assert.Equal(1, *persesCalls)

	// All the services are healthy
	assertComponent(assert, icsl, "grafana", kubernetes.ComponentHealthy, false)
	assertComponent(assert, icsl, "prometheus", kubernetes.ComponentHealthy, false)
	assertComponent(assert, icsl, "tracing", kubernetes.ComponentHealthy, false)
	assertComponent(assert, icsl, "custom dashboards", kubernetes.ComponentHealthy, false)
}

func TestNoIstioComponentFoundError(t *testing.T) {
	assert := assert.New(t)

	k8s, _, _, _ := mockAddOnsCalls(t, []runtime.Object{}, true, false)

	conf := config.Get()

	iss := NewLayerBuilder(t, conf).WithClient(k8s).WithTraceLoader(mockJaeger).Build().IstioStatus
	icsl, error := iss.GetStatus(context.TODO())
	assert.NoError(error)
	assertComponent(assert, icsl, "istiod", kubernetes.ComponentNotFound, true)
}

func TestDefaults(t *testing.T) {
	assert := assert.New(t)

	objects := []runtime.Object{
		fakeDeploymentWithStatus("istio=egressgateway", map[string]string{"istio": "egressgateway"}, unhealthyStatus),
		fakeDeploymentWithStatus("istiod", map[string]string{"app": "istiod", "istio": "pilot"}, healthyStatus),
	}

	for _, obj := range healthyIstiods() {
		o := obj
		objects = append(objects, &o)
	}

	k8s, grafanaCalls, persesCalls, promCalls := mockAddOnsCalls(t, objects, true, false)

	// conf set in mockAddOnsCalls
	conf := config.Get()
	config.Set(conf)

	discovery := &istiotest.FakeDiscovery{
		MeshReturn: models.Mesh{
			ControlPlanes: []models.ControlPlane{{Cluster: &models.KubeCluster{Name: conf.KubernetesConfig.ClusterName}, IstiodName: "istiod", Status: kubernetes.ComponentHealthy}},
		},
	}

	iss := NewLayerBuilder(t, conf).WithClient(k8s).WithDiscovery(discovery).WithTraceLoader(mockJaeger).Build().IstioStatus

	icsl, err := iss.GetStatus(context.TODO())
	assert.NoError(err)

	// One istio component is not found or unhealthy
	assertComponent(assert, icsl, "istio=egressgateway", kubernetes.ComponentUnhealthy, false)

	// The rest of the components are healthy
	assertComponent(assert, icsl, "istiod", kubernetes.ComponentHealthy, true)
	assertComponent(assert, icsl, "grafana", kubernetes.ComponentHealthy, false)
	assertComponent(assert, icsl, "prometheus", kubernetes.ComponentHealthy, false)
	assertComponent(assert, icsl, "tracing", kubernetes.ComponentHealthy, false)
	assertComponent(assert, icsl, "custom dashboards", kubernetes.ComponentHealthy, false)

	// Requests to AddOns have to be 1
	assert.Equal(1, *grafanaCalls)
	assert.Equal(1, *promCalls)
	assert.Equal(1, *persesCalls)
}

func TestNonDefaults(t *testing.T) {
	assert := assert.New(t)

	objects := []runtime.Object{
		fakeDeploymentWithStatus("istio=egressgateway", map[string]string{"istio": "egressgateway"}, healthyStatus),
		fakeDeploymentWithStatus("istio=ingressgateway", map[string]string{"istio": "ingressgateway"}, healthyStatus),
		fakeDeploymentWithStatus("istio=eastwestgateway", map[string]string{"istio": "ingressgateway"}, healthyStatus),
		fakeDeploymentWithStatus("istiod", map[string]string{"app": "istiod", "istio": "pilot"}, healthyStatus),
	}

	for _, obj := range healthyIstiods() {
		o := obj
		objects = append(objects, &o)
	}

	k8s, grafanaCalls, persesCalls, promCalls := mockAddOnsCalls(t, objects, true, false)

	conf := config.Get()
	conf.ExternalServices.Istio.ComponentStatuses = config.ComponentStatuses{
		Enabled: true,
	}
	config.Set(conf)

	discovery := &istiotest.FakeDiscovery{
		MeshReturn: models.Mesh{
			ControlPlanes: []models.ControlPlane{{Cluster: &models.KubeCluster{Name: conf.KubernetesConfig.ClusterName}, IstiodName: "istiod", Status: kubernetes.ComponentHealthy}},
		},
	}

	iss := NewLayerBuilder(t, conf).WithClient(k8s).WithDiscovery(discovery).WithTraceLoader(mockJaeger).Build().IstioStatus

	icsl, error := iss.GetStatus(context.TODO())
	assert.NoError(error)

	// All Istio components are healthy
	assertComponent(assert, icsl, "istio=ingressgateway", kubernetes.ComponentHealthy, false)
	assertComponent(assert, icsl, "istio=egressgateway", kubernetes.ComponentHealthy, false)
	// ComponentStatus was used for custom eastwestgateway
	assertComponent(assert, icsl, "istio=eastwestgateway", kubernetes.ComponentHealthy, false)

	// The rest of the components are healthy
	assertComponent(assert, icsl, "istiod", kubernetes.ComponentHealthy, true)
	assertComponent(assert, icsl, "grafana", kubernetes.ComponentHealthy, false)
	assertComponent(assert, icsl, "prometheus", kubernetes.ComponentHealthy, false)
	assertComponent(assert, icsl, "tracing", kubernetes.ComponentHealthy, false)
	assertComponent(assert, icsl, "custom dashboards", kubernetes.ComponentHealthy, false)

	// Requests to AddOns have to be 1
	assert.Equal(1, *grafanaCalls)
	assert.Equal(1, *promCalls)
	assert.Equal(1, *persesCalls)
}

// Istiod replicas is downscaled to 0
// Kiali should notify that in the Istio Component Status
func TestIstiodNotReady(t *testing.T) {
	assert := assert.New(t)

	objects := []runtime.Object{
		fakeDeploymentWithStatus("istio=egressgateway", map[string]string{"istio": "egressgateway"}, unhealthyStatus),
		fakeDeploymentWithStatus("istiod", map[string]string{"app": "istiod", "istio": "pilot"}, notReadyStatus),
	}

	k8s, grafanaCalls, persesCalls, promCalls := mockAddOnsCalls(t, objects, false, false)

	conf := config.Get()
	conf.IstioLabels.AppLabelName = "app.kubernetes.io/name"
	conf.ExternalServices.Istio.ComponentStatuses = config.ComponentStatuses{
		Enabled: true,
	}
	config.Set(conf)

	discovery := &istiotest.FakeDiscovery{
		MeshReturn: models.Mesh{
			ControlPlanes: []models.ControlPlane{{Cluster: &models.KubeCluster{Name: conf.KubernetesConfig.ClusterName}, IstiodName: "istiod", Status: kubernetes.ComponentNotReady}},
		},
	}

	iss := NewLayerBuilder(t, conf).WithClient(k8s).WithDiscovery(discovery).WithTraceLoader(mockJaeger).Build().IstioStatus

	icsl, error := iss.GetStatus(context.TODO())
	assert.NoError(error)

	// Two istio components are unhealthy, not found or not ready
	assertComponent(assert, icsl, "istio=egressgateway", kubernetes.ComponentUnhealthy, false)
	assertComponent(assert, icsl, "istiod", kubernetes.ComponentNotReady, true)

	// The rest of the components are healthy
	assertComponent(assert, icsl, "grafana", kubernetes.ComponentHealthy, false)
	assertComponent(assert, icsl, "prometheus", kubernetes.ComponentHealthy, false)
	assertComponent(assert, icsl, "tracing", kubernetes.ComponentHealthy, false)

	// Terminating pods are not present
	assertNotPresent(assert, icsl, "istiod-x3v1kn0l-terminating")
	assertNotPresent(assert, icsl, "istiod-x3v1kn1l-terminating")

	// Requests to AddOns have to be 1
	assert.Equal(1, *grafanaCalls)
	assert.Equal(1, *promCalls)
	assert.Equal(1, *persesCalls)
}

// Istio deployments only have the "app" app_label.
// Users can't customize this one. They can only customize it for their own deployments.
func TestCustomizedAppLabel(t *testing.T) {
	assert := assert.New(t)

	objects := []runtime.Object{
		fakeDeploymentWithStatus("istio=egressgateway", map[string]string{"istio": "egressgateway"}, unhealthyStatus),
		fakeDeploymentWithStatus("istiod", map[string]string{"app": "istiod", "istio": "pilot"}, healthyStatus),
	}

	for _, obj := range healthyIstiods() {
		o := obj
		objects = append(objects, &o)
	}

	k8s, grafanaCalls, persesCalls, promCalls := mockAddOnsCalls(t, objects, true, false)

	conf := config.Get()
	conf.IstioLabels.AppLabelName = "app.kubernetes.io/name"
	conf.ExternalServices.Istio.ComponentStatuses = config.ComponentStatuses{
		Enabled: true,
	}
	config.Set(conf)

	discovery := &istiotest.FakeDiscovery{
		MeshReturn: models.Mesh{
			ControlPlanes: []models.ControlPlane{{Cluster: &models.KubeCluster{Name: conf.KubernetesConfig.ClusterName}, IstiodName: "istiod", Status: kubernetes.ComponentHealthy}},
		},
	}

	iss := NewLayerBuilder(t, conf).WithClient(k8s).WithDiscovery(discovery).WithTraceLoader(mockJaeger).Build().IstioStatus

	icsl, error := iss.GetStatus(context.TODO())
	assert.NoError(error)

	// istio component not found or unhealthy
	assertComponent(assert, icsl, "istio=egressgateway", kubernetes.ComponentUnhealthy, false)

	// The rest of the components are healthy
	assertComponent(assert, icsl, "istiod", kubernetes.ComponentHealthy, true)
	assertComponent(assert, icsl, "grafana", kubernetes.ComponentHealthy, false)
	assertComponent(assert, icsl, "prometheus", kubernetes.ComponentHealthy, false)
	assertComponent(assert, icsl, "tracing", kubernetes.ComponentHealthy, false)
	assertComponent(assert, icsl, "custom dashboards", kubernetes.ComponentHealthy, false)

	// Requests to AddOns have to be 1
	assert.Equal(1, *grafanaCalls)
	assert.Equal(1, *promCalls)
	assert.Equal(1, *persesCalls)
}

func TestDaemonSetComponentHealthy(t *testing.T) {
	assert := assert.New(t)

	objects := []runtime.Object{
		fakeDaemonSetWithStatus("istio=ingressgateway", map[string]string{"istio": "ingressgateway"}, healthyDaemonSetStatus),
		fakeDeploymentWithStatus("istio=egressgateway", map[string]string{"istio": "egressgateway"}, unhealthyStatus),
		fakeDeploymentWithStatus("istiod", map[string]string{"app": "istiod", "istio": "pilot"}, healthyStatus),
	}

	for _, obj := range healthyIstiods() {
		o := obj
		objects = append(objects, &o)
	}

	k8s, grafanaCalls, persesCalls, promCalls := mockAddOnsCalls(t, objects, true, false)

	conf := config.Get()
	conf.IstioLabels.AppLabelName = "app.kubernetes.io/name"
	conf.ExternalServices.Istio.ComponentStatuses = config.ComponentStatuses{
		Enabled: true,
	}
	config.Set(conf)

	discovery := &istiotest.FakeDiscovery{
		MeshReturn: models.Mesh{
			ControlPlanes: []models.ControlPlane{{Cluster: &models.KubeCluster{Name: conf.KubernetesConfig.ClusterName}, IstiodName: "istiod", Status: kubernetes.ComponentHealthy}},
		},
	}

	iss := NewLayerBuilder(t, conf).WithClient(k8s).WithDiscovery(discovery).WithTraceLoader(mockJaeger).Build().IstioStatus

	icsl, error := iss.GetStatus(context.TODO())
	assert.NoError(error)

	// One istio components is unhealthy
	assertComponent(assert, icsl, "istio=egressgateway", kubernetes.ComponentUnhealthy, false)

	// The rest of the components are healthy
	assertComponent(assert, icsl, "istio=ingressgateway", kubernetes.ComponentHealthy, false)
	assertComponent(assert, icsl, "istiod", kubernetes.ComponentHealthy, true)
	assertComponent(assert, icsl, "grafana", kubernetes.ComponentHealthy, false)
	assertComponent(assert, icsl, "prometheus", kubernetes.ComponentHealthy, false)
	assertComponent(assert, icsl, "tracing", kubernetes.ComponentHealthy, false)
	assertComponent(assert, icsl, "custom dashboards", kubernetes.ComponentHealthy, false)

	// Requests to AddOns have to be 1
	assert.Equal(1, *grafanaCalls)
	assert.Equal(1, *promCalls)
	assert.Equal(1, *persesCalls)
}

// Users may use DaemonSets to deploy istio components
func TestDaemonSetComponentUnhealthy(t *testing.T) {
	assert := assert.New(t)

	objects := []runtime.Object{
		fakeDaemonSetWithStatus("istio=ingressgateway", map[string]string{"istio": "ingressgateway"}, unhealthyDaemonSetStatus),
		fakeDeploymentWithStatus("istio=egressgateway", map[string]string{"istio": "egressgateway"}, unhealthyStatus),
		fakeDeploymentWithStatus("istiod", map[string]string{"app": "istiod", "istio": "pilot"}, healthyStatus),
	}

	k8s, grafanaCalls, persesCalls, promCalls := mockAddOnsCalls(t, objects, true, false)

	conf := config.Get()
	conf.IstioLabels.AppLabelName = "app.kubernetes.io/name"
	conf.ExternalServices.Istio.ComponentStatuses = config.ComponentStatuses{
		Enabled: true,
	}
	config.Set(conf)

	// Set global cache var
	discovery := &istiotest.FakeDiscovery{
		MeshReturn: models.Mesh{
			ControlPlanes: []models.ControlPlane{{Cluster: &models.KubeCluster{Name: conf.KubernetesConfig.ClusterName}, IstiodName: "istiod", Status: kubernetes.ComponentHealthy}},
		},
	}
	iss := NewLayerBuilder(t, conf).WithClient(k8s).WithDiscovery(discovery).WithTraceLoader(mockJaeger).Build().IstioStatus

	icsl, error := iss.GetStatus(context.TODO())
	assert.NoError(error)

	// Two istio components are unhealthy
	assertComponent(assert, icsl, "istio=ingressgateway", kubernetes.ComponentUnhealthy, false)
	assertComponent(assert, icsl, "istio=egressgateway", kubernetes.ComponentUnhealthy, false)

	// The rest of the components are healthy
	assertComponent(assert, icsl, "istiod", kubernetes.ComponentHealthy, true)
	assertComponent(assert, icsl, "grafana", kubernetes.ComponentHealthy, false)
	assertComponent(assert, icsl, "prometheus", kubernetes.ComponentHealthy, false)
	assertComponent(assert, icsl, "tracing", kubernetes.ComponentHealthy, false)
	assertComponent(assert, icsl, "custom dashboards", kubernetes.ComponentHealthy, false)

	// Requests to AddOns have to be 1
	assert.Equal(1, *grafanaCalls)
	assert.Equal(1, *promCalls)
	assert.Equal(1, *persesCalls)
}

func assertComponent(assert *assert.Assertions, icsl kubernetes.IstioComponentStatus, name string, status string, isCore bool) {
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

func assertNotPresent(assert *assert.Assertions, icsl kubernetes.IstioComponentStatus, name string) {
	componentFound := false
	for _, ics := range icsl {
		if ics.Name == name {
			componentFound = true
		}
	}
	assert.False(componentFound)
}

func mockJaeger() tracing.ClientInterface {
	j := new(tracingtest.TracingClientMock)
	j.On("GetServiceStatus", context.TODO()).Return(true, nil)
	return j
}

func mockFailingJaeger() tracing.ClientInterface {
	j := new(tracingtest.TracingClientMock)
	j.On("GetServiceStatus", context.TODO()).Return(false, errors.New("error connecting with tracing service"))
	return j
}

func fakeDeploymentWithStatus(name string, labels map[string]string, status apps_v1.DeploymentStatus) *apps_v1.Deployment {
	return &apps_v1.Deployment{
		ObjectMeta: meta_v1.ObjectMeta{
			Name:      name,
			Namespace: "istio-system",
			Labels:    labels,
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
		},
	}
}

func fakeDaemonSetWithStatus(name string, labels map[string]string, status apps_v1.DaemonSetStatus) *apps_v1.DaemonSet {
	return &apps_v1.DaemonSet{
		ObjectMeta: meta_v1.ObjectMeta{
			Name:      name,
			Namespace: "istio-system",
			Labels:    labels,
		},
		Status: status,
		Spec: apps_v1.DaemonSetSpec{
			Selector: &meta_v1.LabelSelector{
				MatchLabels: labels,
			},
			Template: v1.PodTemplateSpec{
				ObjectMeta: meta_v1.ObjectMeta{
					Name:   "",
					Labels: labels,
				},
			},
		},
	}
}

func confWithComponentNamespaces() *config.Config {
	conf := config.NewConfig()
	conf.ExternalServices.Istio.ComponentStatuses = config.ComponentStatuses{
		Enabled: true,
		Components: []config.ComponentStatus{
			{AppLabel: "pilot", IsCore: true, Namespace: "istio-system"},
			{AppLabel: "ingress", IsCore: true, Namespace: "ingress-egress"},
			{AppLabel: "egress", IsCore: false, Namespace: "ingress-egress"},
			{AppLabel: "sds", IsCore: false, Namespace: "istio-admin"},
		},
	}

	return conf
}

func mockServer(t *testing.T, mr *mux.Router) *httptest.Server {
	s := httptest.NewServer(mr)
	t.Cleanup(s.Close)
	return s
}

func addAddOnRoute(mr *mux.Router, mu *sync.Mutex, url string, statusCode int, callNum *int) {
	mr.HandleFunc(url, func(w http.ResponseWriter, r *http.Request) {
		mu.Lock()
		if callNum != nil {
			*callNum = *callNum + 1
		}
		mu.Unlock()
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
	var mu sync.Mutex
	mr := mux.NewRouter()
	for _, addon := range addons {
		addAddOnRoute(mr, &mu, addon.Url, addon.StatusCode, addon.CallCount)
	}
	return mr
}

func defaultAddOnCalls(grafana, perses, prom *int) map[string]addOnsSetup {
	return map[string]addOnsSetup{
		"prometheus": {
			Url:        "/prometheus/mock",
			StatusCode: 200,
			CallCount:  prom,
		},
		"prometheus-healthy": {
			Url:        "/prometheus/mock/-/healthy",
			StatusCode: 200,
			CallCount:  prom,
		},
		"grafana": {
			Url:        "/grafana/mock",
			StatusCode: 200,
			CallCount:  grafana,
		},
		"perses": {
			Url:        "/perses/mock",
			StatusCode: 200,
			CallCount:  perses,
		},
		"custom dashboards": {
			Url:        "/prometheus-dashboards/mock",
			StatusCode: 200,
			CallCount:  nil,
		},
	}
}

func addonAddMockUrls(baseUrl string, conf *config.Config, overrideUrl bool) *config.Config {
	conf.ExternalServices.Grafana.Enabled = true
	conf.ExternalServices.Grafana.InternalURL = baseUrl + "/grafana/mock"
	conf.ExternalServices.Grafana.IsCore = false

	conf.ExternalServices.Perses.Enabled = true
	conf.ExternalServices.Perses.InternalURL = baseUrl + "/perses/mock"
	conf.ExternalServices.Perses.IsCore = false

	conf.ExternalServices.Tracing.Enabled = true
	conf.ExternalServices.Tracing.InternalURL = baseUrl + "/tracing/mock"
	conf.ExternalServices.Tracing.IsCore = false

	conf.ExternalServices.Prometheus.URL = baseUrl + "/prometheus/mock"

	conf.ExternalServices.CustomDashboards.Enabled = true
	conf.ExternalServices.CustomDashboards.Prometheus.URL = baseUrl + "/prometheus-dashboards/mock"
	conf.ExternalServices.CustomDashboards.IsCore = false

	if overrideUrl {
		conf.ExternalServices.Grafana.HealthCheckUrl = conf.ExternalServices.Grafana.InternalURL
		conf.ExternalServices.Grafana.InternalURL = baseUrl + "/grafana/wrong"

		conf.ExternalServices.Perses.HealthCheckUrl = conf.ExternalServices.Perses.InternalURL
		conf.ExternalServices.Perses.InternalURL = baseUrl + "/perses/wrong"

		conf.ExternalServices.Prometheus.HealthCheckUrl = conf.ExternalServices.Prometheus.URL
		conf.ExternalServices.Prometheus.URL = baseUrl + "/prometheus/wrong"

		conf.ExternalServices.CustomDashboards.Prometheus.HealthCheckUrl = conf.ExternalServices.CustomDashboards.Prometheus.URL
		conf.ExternalServices.CustomDashboards.Prometheus.URL = baseUrl + "/prometheus/wrong"

	}
	return conf
}

// gatewayDeployment builds a deployment that IsGatewayWorkload detects as a
// gateway (the istioctl labeling).
func gatewayDeployment(namespace, name string) *apps_v1.Deployment {
	return &apps_v1.Deployment{
		ObjectMeta: meta_v1.ObjectMeta{
			Labels:    map[string]string{"app": name},
			Name:      name,
			Namespace: namespace,
		},
		Spec: apps_v1.DeploymentSpec{
			Selector: &meta_v1.LabelSelector{
				MatchLabels: map[string]string{"istio": "ingressgateway"},
			},
			Template: v1.PodTemplateSpec{
				ObjectMeta: meta_v1.ObjectMeta{
					Labels: map[string]string{"istio": "ingressgateway"},
				},
			},
		},
	}
}

// TestGetGatewaysPopulatesSharedCacheSAWide pins that the shared gateway
// cache is populated with the SA-visible gateways, not the warming user's
// accessible subset: the cache serves every user, so a user-scoped fetch
// would truncate the list for broader users (and leak to narrower ones).
func TestGetGatewaysPopulatesSharedCacheSAWide(t *testing.T) {
	assert := assert.New(t)
	require := require.New(t)

	conf := config.NewConfig()
	config.Set(conf)
	cluster := conf.KubernetesConfig.ClusterName

	// Gateway workloads in the accessible namespace and in a namespace the
	// user cannot see. The SA sees both.
	objects := []runtime.Object{
		kubetest.FakeNamespace("bookinfo"),
		kubetest.FakeNamespace("victim-ns"),
		gatewayDeployment("bookinfo", "gw-allowed"),
		gatewayDeployment("victim-ns", "gw-victim"),
	}
	sa := kubetest.NewFakeK8sClient(objects...)
	sa.Token = "sa-token"
	user := kubetest.NewNamespaceRestrictedClient(kubetest.NewFakeK8sClient(objects...), "user-token", []string{"bookinfo"})

	saClients := map[string]kubernetes.ClientInterface{cluster: sa}
	userClients := map[string]kubernetes.UserClientInterface{cluster: user}
	kialiCache := cache.NewTestingCacheWithClients(t, saClients, *conf)
	discovery := istio.NewDiscovery(saClients, kialiCache, conf)
	layer := newLayer(userClients, saClients, nil, nil, kialiCache, conf, nil, discovery, nil)

	// The restricted user warms the shared cache.
	gateways, err := layer.Workload.GetGateways(context.TODO())
	require.NoError(err)

	gatewayNamespaces := make(map[string]string, len(gateways))
	for _, gw := range gateways {
		gatewayNamespaces[gw.Name] = gw.Namespace
	}
	assert.Equal("bookinfo", gatewayNamespaces["gw-allowed"], "the accessible namespace's gateway must be cached")
	assert.Equal("victim-ns", gatewayNamespaces["gw-victim"], "the SA-visible denied namespace's gateway must be cached too: the cache is SA-scoped")
}

// TestGetStatusFiltersCachedGatewayEntriesForUser pins the istio status
// authorization at the cached read path: the shared status cache holds the
// SA-wide gateway list (whatever user warmed it), so the entries returned to
// a restricted user must be filtered. Control-plane entries are kept without
// access (mesh-wide information, like the mesh endpoints expose), entries
// without a namespace are kept (they disclose none), and a gateway in a
// namespace the user cannot access is dropped.
func TestGetStatusFiltersCachedGatewayEntriesForUser(t *testing.T) {
	assert := assert.New(t)
	require := require.New(t)

	conf := config.NewConfig()
	config.Set(conf)
	conf.ExternalServices.Istio.ComponentStatuses.Enabled = true
	// The configured control-plane namespace: its entries are kept for every
	// user regardless of namespace access.
	conf.ExternalServices.Istio.ComponentStatuses.Components = []config.ComponentStatus{
		{AppLabel: "istiod", IsCore: true, Namespace: "istio-system"},
	}
	cluster := conf.KubernetesConfig.ClusterName

	sa, user := newAccessibleSetClients([]string{"bookinfo", "victim-ns", "istio-system"}, []string{"bookinfo"})
	saClients := map[string]kubernetes.ClientInterface{cluster: sa}
	userClients := map[string]kubernetes.UserClientInterface{cluster: user}
	kialiCache := cache.NewTestingCacheWithClients(t, saClients, *conf)
	discovery := istio.NewDiscovery(saClients, kialiCache, conf)
	layer := newLayer(userClients, saClients, nil, nil, kialiCache, conf, nil, discovery, nil)

	// A broader user's request computed and cached the status; the gateway
	// entries in it span the SA-visible namespaces.
	kialiCache.SetIstioStatus(kubernetes.IstioComponentStatus{
		{Cluster: cluster, Name: "istiod", Namespace: "istio-system", Status: kubernetes.ComponentHealthy, IsCore: true},
		{Cluster: cluster, Name: "gw-allowed", Namespace: "bookinfo", Status: kubernetes.ComponentHealthy},
		{Cluster: cluster, Name: "gw-victim", Namespace: "victim-ns", Status: kubernetes.ComponentHealthy},
		{Cluster: cluster, Name: "prometheus", Status: kubernetes.ComponentHealthy},
	})

	status, err := layer.IstioStatus.GetStatus(context.TODO())
	require.NoError(err)

	componentNames := make(map[string]bool, len(status))
	for _, component := range status {
		componentNames[component.Name] = true
	}
	assert.True(componentNames["istiod"], "the control-plane entry must be kept without access to its namespace")
	assert.True(componentNames["gw-allowed"], "the accessible namespace's gateway must be kept")
	assert.True(componentNames["prometheus"], "the namespace-less addon entry must be kept")
	assert.False(componentNames["gw-victim"], "a denied namespace's gateway entry must not be returned")
}

// TestGetStatusControlPlaneExemptionIsClusterScoped pins that the
// discovered control-plane exemption is keyed by (cluster, namespace): a
// namespace that hosts a control plane in one cluster may be an ordinary
// tenant namespace in another, and the collision must not exempt the other
// cluster's entries. The configured component namespaces stay a deliberate
// global exemption (the operator declares them by name only).
func TestGetStatusControlPlaneExemptionIsClusterScoped(t *testing.T) {
	assert := assert.New(t)
	require := require.New(t)

	conf := config.NewConfig()
	config.Set(conf)
	conf.ExternalServices.Istio.ComponentStatuses.Enabled = true
	conf.ExternalServices.Istio.IstioAPIEnabled = true
	// A configured component namespace: a global exemption by design.
	conf.ExternalServices.Istio.ComponentStatuses.Components = []config.ComponentStatus{
		{AppLabel: "comp", IsCore: true, Namespace: "configured-ns"},
	}
	home := conf.KubernetesConfig.ClusterName
	const remote = "cluster-b"

	// The user can access bookinfo in the home cluster only; in the remote
	// cluster their LIST is empty (direct namespace access is denied).
	homeSA := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("bookinfo"), kubetest.FakeNamespace("shared"))
	homeSA.Token = "home-sa-token"
	remoteSA := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("shared"))
	remoteSA.Token = "remote-sa-token"
	homeUser := kubetest.NewNamespaceRestrictedClient(kubetest.NewFakeK8sClient(kubetest.FakeNamespace("bookinfo"), kubetest.FakeNamespace("shared")), "user-token", []string{"bookinfo"})
	remoteUser := kubetest.NewNamespaceRestrictedClient(kubetest.NewFakeK8sClient(kubetest.FakeNamespace("shared")), "user-token", nil)

	saClients := map[string]kubernetes.ClientInterface{home: homeSA, remote: remoteSA}
	userClients := map[string]kubernetes.UserClientInterface{home: homeUser, remote: remoteUser}
	kialiCache := cache.NewTestingCacheWithClients(t, saClients, *conf)
	discovery := istio.NewDiscovery(saClients, kialiCache, conf)
	layer := newLayer(userClients, saClients, nil, nil, kialiCache, conf, nil, discovery, nil)

	// The mesh hosts a control plane in the home cluster's "shared"
	// namespace. The remote cluster also has a "shared" namespace — with an
	// ordinary tenant gateway in it.
	layer.IstioStatus.discovery = &istiotest.FakeDiscovery{MeshReturn: models.Mesh{
		ControlPlanes: []models.ControlPlane{{
			Cluster:         &models.KubeCluster{Name: home},
			IstiodNamespace: "shared",
		}},
	}}

	kialiCache.SetIstioStatus(kubernetes.IstioComponentStatus{
		// The control plane itself: kept via the (cluster, namespace) pair.
		{Cluster: home, Name: "istiod", Namespace: "shared", Status: kubernetes.ComponentHealthy, IsCore: true},
		// The collision: a tenant gateway in the remote cluster's same-named
		// namespace. The user is denied there, and the remote "shared" is not
		// a control-plane namespace — the entry must be dropped.
		{Cluster: remote, Name: "gw-tenant-collision", Namespace: "shared", Status: kubernetes.ComponentHealthy},
		// Positive control: an accessible namespace's gateway is kept.
		{Cluster: home, Name: "gw-allowed", Namespace: "bookinfo", Status: kubernetes.ComponentHealthy},
		// The configured component namespace is a global exemption: kept
		// even in the remote cluster the user cannot see.
		{Cluster: remote, Name: "gw-configured", Namespace: "configured-ns", Status: kubernetes.ComponentHealthy},
	})

	status, err := layer.IstioStatus.GetStatus(context.TODO())
	require.NoError(err)

	componentNames := make(map[string]bool, len(status))
	for _, component := range status {
		componentNames[component.Name] = true
	}
	assert.True(componentNames["istiod"], "the control plane in the home cluster's shared namespace must be kept")
	assert.True(componentNames["gw-allowed"], "the accessible namespace's gateway must be kept")
	assert.True(componentNames["gw-configured"], "the configured component namespace is a global exemption and must be kept")
	assert.False(componentNames["gw-tenant-collision"], "a tenant gateway in another cluster's same-named namespace must not be exempted")
}
