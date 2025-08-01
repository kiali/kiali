package business

import (
	"context"
	"os"
	"sort"
	"testing"
	"time"

	osroutes_v1 "github.com/openshift/api/route/v1"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	networking_v1 "istio.io/client-go/pkg/apis/networking/v1"
	core_v1 "k8s.io/api/core/v1"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/util/yaml"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/prometheus"
	"github.com/kiali/kiali/prometheus/prometheustest"
)

func TestServiceListParsing(t *testing.T) {
	assert := assert.New(t)
	require := require.New(t)

	// Setup mocks
	s1 := kubetest.FakeService("Namespace", "reviews")
	s2 := kubetest.FakeService("Namespace", "httpbin")
	objects := []runtime.Object{
		kubetest.FakeNamespace("Namespace"),
		&s1,
		&s2,
	}
	conf := config.NewConfig()
	config.Set(conf)
	k8s := kubetest.NewFakeK8sClient(objects...)
	svc := NewLayerBuilder(t, conf).WithClient(k8s).Build().Svc

	criteria := ServiceCriteria{Namespace: "Namespace", IncludeIstioResources: false, IncludeHealth: false}
	serviceList, err := svc.GetServiceList(context.TODO(), criteria)
	require.NoError(err)

	require.Equal("Namespace", serviceList.Namespace)
	require.Len(serviceList.Services, 2)
	serviceNames := []string{serviceList.Services[0].Name, serviceList.Services[1].Name}

	assert.Contains(serviceNames, "reviews")
	assert.Contains(serviceNames, "httpbin")
	assert.Equal("Namespace", serviceList.Services[0].Namespace)
	assert.Equal("Namespace", serviceList.Services[1].Namespace)
}

func TestParseRegistryServices(t *testing.T) {
	assert := assert.New(t)
	require := require.New(t)

	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = config.DefaultClusterID
	config.Set(conf)

	serviceEntries := []*networking_v1.ServiceEntry{}
	configzFile := "../tests/data/registry/services-configz.json"
	configz, err := os.ReadFile(configzFile)
	require.NoError(err)
	require.NoError(yaml.Unmarshal(configz, &serviceEntries))
	require.Equal(2, len(serviceEntries))

	objs := []runtime.Object{kubetest.FakeNamespace("electronic-shop")}
	objs = append(objs, kubernetes.ToRuntimeObjects(serviceEntries)...)
	k8s := kubetest.NewFakeK8sClient(objs...)
	svc := NewLayerBuilder(t, conf).WithClient(k8s).Build().Svc

	servicesz := "../tests/data/registry/services-registryz.json"
	bServicesz, err := os.ReadFile(servicesz)
	assert.NoError(err)
	rServices := map[string][]byte{
		"istiod1": bServicesz,
	}
	registryServices, err2 := parseRegistryServices(rServices)
	assert.NoError(err2)

	assert.Equal(3, len(registryServices))

	istioConfigList := models.IstioConfigList{
		ServiceEntries: serviceEntries,
	}

	parsedServices := svc.buildRegistryServices(registryServices, istioConfigList, config.DefaultClusterID)
	require.Equal(3, len(parsedServices))
	assert.Equal(1, len(parsedServices[0].IstioReferences))
	assert.Equal(1, len(parsedServices[1].IstioReferences))
	assert.Equal(0, len(parsedServices[2].IstioReferences))
}

func TestFilterLocalIstioRegistry(t *testing.T) {
	assert := assert.New(t)

	conf := config.NewConfig()
	config.Set(conf)

	servicesz := "../tests/data/registry/istio-east-registryz.json"
	bServicesz, err := os.ReadFile(servicesz)
	assert.NoError(err)
	rServices := map[string][]byte{
		"istiod1": bServicesz,
	}
	registryServices, err2 := parseRegistryServices(rServices)
	assert.NoError(err2)

	assert.Equal(true, filterIstioServiceByClusterId("istio-east", registryServices[0]))
	assert.Equal(false, filterIstioServiceByClusterId("istio-east", registryServices[1]))
}

func TestGetServiceListFromMultipleClusters(t *testing.T) {
	assert := assert.New(t)
	require := require.New(t)

	conf := config.NewConfig()
	conf.ExternalServices.Istio.IstioAPIEnabled = false
	config.Set(conf)

	clients := map[string]kubernetes.UserClientInterface{
		conf.KubernetesConfig.ClusterName: kubetest.NewFakeK8sClient(
			kubetest.FakeNamespace("bookinfo"),
			&core_v1.Service{ObjectMeta: meta_v1.ObjectMeta{Name: "ratings-home-cluster", Namespace: "bookinfo"}},
		),
		"west": kubetest.NewFakeK8sClient(
			kubetest.FakeNamespace("bookinfo"),
			&core_v1.Service{ObjectMeta: meta_v1.ObjectMeta{Name: "ratings-west-cluster", Namespace: "bookinfo"}},
		),
	}
	svc := NewLayerBuilder(t, conf).WithClients(clients).Build().Svc
	svcs, err := svc.GetServiceList(context.TODO(), ServiceCriteria{Namespace: "bookinfo"})
	require.NoError(err)
	require.Len(svcs.Services, 2)

	sort.Slice(svcs.Services, func(i, j int) bool {
		return svcs.Services[i].Name < svcs.Services[j].Name
	})
	assert.Equal(svcs.Services[0].Cluster, conf.KubernetesConfig.ClusterName)
	assert.Equal(svcs.Services[1].Cluster, "west")
}

func TestMultiClusterGetService(t *testing.T) {
	assert := assert.New(t)
	require := require.New(t)

	conf := config.NewConfig()
	conf.ExternalServices.Istio.IstioAPIEnabled = false
	config.Set(conf)

	clients := map[string]kubernetes.UserClientInterface{
		conf.KubernetesConfig.ClusterName: kubetest.NewFakeK8sClient(
			kubetest.FakeNamespace("bookinfo"),
			&core_v1.Service{ObjectMeta: meta_v1.ObjectMeta{Name: "ratings-home-cluster", Namespace: "bookinfo"}},
		),
		"west": kubetest.NewFakeK8sClient(
			kubetest.FakeNamespace("bookinfo"),
			&core_v1.Service{ObjectMeta: meta_v1.ObjectMeta{Name: "ratings-west-cluster", Namespace: "bookinfo"}},
		),
	}
	svc := NewLayerBuilder(t, conf).WithClients(clients).Build().Svc
	s, err := svc.GetService(context.TODO(), "west", "bookinfo", "ratings-west-cluster")
	require.NoError(err)

	assert.Equal(s.Name, "ratings-west-cluster")

	s, err = svc.GetService(context.TODO(), conf.KubernetesConfig.ClusterName, "bookinfo", "ratings-home-cluster")
	require.NoError(err)

	assert.Equal(s.Name, "ratings-home-cluster")
}

// TODO: This test is currently broken because the testing cache uses a different
// fake client and object trackers are different. Add this test back in once both
// clients are the same.
// func TestMultiClusterServiceUpdate(t *testing.T) {
// 	assert := assert.New(t)
// 	require := require.New(t)

// 	conf := config.NewConfig()
// 	conf.ExternalServices.Istio.IstioAPIEnabled = false
// 	config.Set(conf)

// 	clientFactory := kubetest.NewK8SClientFactoryMock(nil)
// 	clients := map[string]kubernetes.ClientInterface{
// 		conf.KubernetesConfig.ClusterName: kubetest.NewFakeK8sClient(
// 			kubetest.FakeNamespace("bookinfo"),
// 			&core_v1.Service{ObjectMeta: meta_v1.ObjectMeta{Name: "ratings-home-cluster", Namespace: "bookinfo"}},
// 		),
// 		"west": kubetest.NewFakeK8sClient(
// 			kubetest.FakeNamespace("bookinfo"),
// 			&core_v1.Service{ObjectMeta: meta_v1.ObjectMeta{Name: "ratings-west-cluster", Namespace: "bookinfo"}},
// 		),
// 	}
// 	clientFactory.SetClients(clients)
// 	cache := cache.NewTestingCacheWithFactory(t, clientFactory, *conf)
// 	kialiCache = cache

// 	prom, err := prometheus.NewClient()
// 	require.NoError(err)

// 	promMock := new(prometheustest.PromAPIMock)
// 	promMock.SpyArgumentsAndReturnEmpty(func(mock.Arguments) {})
// 	prom.Inject(promMock)
// 	svc := NewWithBackends(t, clients, clients, prom, nil).Svc
// 	_, err = svc.UpdateService(context.TODO(), "west", "bookinfo", "ratings-west-cluster", "60s", time.Now(), `{"metadata":{"annotations":{"test":"newlabel"}}}`, "merge")
// 	require.NoError(err)

// 	s, err := svc.GetService(context.TODO(), "west", "bookinfo", "ratings-west-cluster")
// 	require.NoError(err)
// 	assert.Contains(s.Annotations, "test")

// 	s, err = svc.GetService(context.TODO(), conf.KubernetesConfig.ClusterName, "bookinfo", "ratings-home-cluster")
// 	require.NoError(err)
// 	assert.NotContains(s.Annotations, "test")
// }

func TestMultiClusterGetServiceDetails(t *testing.T) {
	assert := assert.New(t)
	require := require.New(t)

	conf := config.NewConfig()
	conf.ExternalServices.Istio.IstioAPIEnabled = false
	config.Set(conf)

	clients := map[string]kubernetes.UserClientInterface{
		conf.KubernetesConfig.ClusterName: kubetest.NewFakeK8sClient(
			kubetest.FakeNamespace("bookinfo"),
			&core_v1.Service{ObjectMeta: meta_v1.ObjectMeta{Name: "ratings-home-cluster", Namespace: "bookinfo"}},
		),
		"west": kubetest.NewFakeK8sClient(
			kubetest.FakeNamespace("bookinfo"),
			&core_v1.Service{ObjectMeta: meta_v1.ObjectMeta{Name: "ratings-west-cluster", Namespace: "bookinfo"}},
		),
	}
	prom, err := prometheus.NewClient(*conf, clients[conf.KubernetesConfig.ClusterName].GetToken())
	require.NoError(err)

	promMock := new(prometheustest.PromAPIMock)
	promMock.SpyArgumentsAndReturnEmpty(func(mock.Arguments) {})
	prom.Inject(promMock)
	svc := NewLayerBuilder(t, conf).WithClients(clients).WithProm(prom).Build().Svc
	s, err := svc.GetServiceDetails(context.TODO(), "west", "bookinfo", "ratings-west-cluster", "60s", time.Now(), true)
	require.NoError(err)

	assert.Equal(s.Service.Name, "ratings-west-cluster")
}

func TestMultiClusterGetServiceAppName(t *testing.T) {
	assert := assert.New(t)
	require := require.New(t)

	conf := config.NewConfig()
	config.Set(conf)

	clients := map[string]kubernetes.UserClientInterface{
		conf.KubernetesConfig.ClusterName: kubetest.NewFakeK8sClient(
			kubetest.FakeNamespace("bookinfo"),
			&core_v1.Service{ObjectMeta: meta_v1.ObjectMeta{Name: "ratings-home-cluster", Namespace: "bookinfo"}},
		),
		"west": kubetest.NewFakeK8sClient(
			kubetest.FakeNamespace("bookinfo"),
			&core_v1.Service{
				ObjectMeta: meta_v1.ObjectMeta{
					Name:      "ratings-west-cluster",
					Namespace: "bookinfo",
				},
				Spec: core_v1.ServiceSpec{
					Selector: map[string]string{
						"app": "ratings",
					},
				},
			},
		),
	}
	svc := NewLayerBuilder(t, conf).WithClients(clients).Build().Svc
	s, err := svc.GetServiceTracingName(context.TODO(), "west", "bookinfo", "ratings-west-cluster")
	require.NoError(err)

	assert.Equal("ratings", s.Lookup)
	assert.Equal("ratings", s.App)
}

func TestGetServiceRouteURL(t *testing.T) {
	assert := assert.New(t)
	require := require.New(t)

	conf := config.NewConfig()
	conf.ExternalServices.Istio.IstioAPIEnabled = false
	config.Set(conf)

	k8s := kubetest.NewFakeK8sClient(
		&core_v1.Namespace{ObjectMeta: meta_v1.ObjectMeta{Name: "bookinfo"}},
		&core_v1.Service{ObjectMeta: meta_v1.ObjectMeta{Name: "ratings", Namespace: "bookinfo"}},
		&osroutes_v1.Route{ObjectMeta: meta_v1.ObjectMeta{Name: "ratings", Namespace: "bookinfo"}, Spec: osroutes_v1.RouteSpec{Host: "external.com"}},
	)
	k8s.OpenShift = true

	prom, err := prometheus.NewClient(*conf, k8s.GetToken())
	require.NoError(err)

	promMock := new(prometheustest.PromAPIMock)
	promMock.SpyArgumentsAndReturnEmpty(func(mock.Arguments) {})
	prom.Inject(promMock)
	svc := NewLayerBuilder(t, conf).WithClient(k8s).WithProm(prom).Build().Svc

	url := svc.GetServiceRouteURL(context.TODO(), conf.KubernetesConfig.ClusterName, "bookinfo", "ratings")
	require.NoError(err)
	assert.Equal("http://external.com", url)

	url = svc.GetServiceRouteURL(context.TODO(), conf.KubernetesConfig.ClusterName, "bookinfo", "_bogus_")
	require.NoError(err)
	assert.Equal("", url)
}

func TestGetServicesFromWaypoint(t *testing.T) {
	assert := assert.New(t)
	require := require.New(t)

	conf := config.NewConfig()
	conf.ExternalServices.Istio.IstioAPIEnabled = false
	config.Set(conf)

	clients := kubetest.FakeWaypointAndEnrolledClients("ratings", conf.KubernetesConfig.ClusterName, "bookinfo")
	svc := NewLayerBuilder(t, conf).WithClients(clients).Build().Svc

	svcList := svc.ListWaypointServices(context.TODO(), "waypoint", "bookinfo", conf.KubernetesConfig.ClusterName)
	require.NotNil(svcList)
	assert.Equal("ratings", svcList[0].Name)
	assert.Equal("service", svcList[0].LabelType)
	assert.Equal("bookinfo", svcList[0].Namespace)
	assert.Equal(conf.KubernetesConfig.ClusterName, svcList[0].Cluster)
	assert.Len(svcList, 1)
}

func TestGetWaypointServices(t *testing.T) {
	assert := assert.New(t)
	require := require.New(t)

	conf := config.NewConfig()
	conf.ExternalServices.Istio.IstioAPIEnabled = false
	config.Set(conf)

	clients := kubetest.FakeWaypointAndEnrolledClients("ratings", conf.KubernetesConfig.ClusterName, "bookinfo")
	svc := NewLayerBuilder(t, conf).WithClients(clients).Build().Svc

	service, _ := svc.GetService(context.TODO(), conf.KubernetesConfig.ClusterName, "bookinfo", "ratings")

	waypointsList := svc.GetWaypointsForService(context.TODO(), &service)
	require.NotNil(waypointsList)
	assert.Equal("waypoint", waypointsList[0].Name)
	assert.Equal("", waypointsList[0].LabelType)
	assert.Equal("bookinfo", waypointsList[0].Namespace)
	assert.Equal(conf.KubernetesConfig.ClusterName, waypointsList[0].Cluster)
	assert.Len(waypointsList, 1)
}

func TestGetServiceDetailsValidations(t *testing.T) {
	assert := assert.New(t)
	require := require.New(t)

	conf := config.NewConfig()
	conf.ExternalServices.Istio.IstioAPIEnabled = false
	config.Set(conf)

	clients := map[string]kubernetes.UserClientInterface{
		conf.KubernetesConfig.ClusterName: kubetest.NewFakeK8sClient(
			kubetest.FakeNamespace("bookinfo"),
			&core_v1.Service{
				ObjectMeta: meta_v1.ObjectMeta{Name: "ratings-home-cluster", Namespace: "bookinfo", Labels: map[string]string{"app": "ratings"}},
				Spec:       core_v1.ServiceSpec{Ports: []core_v1.ServicePort{{Name: "http", Port: 9080, Protocol: "TCP"}}, Selector: map[string]string{"app": "ratings"}},
			},
			FakeDeploymentWithPort("ratings", 9080),
		),
	}

	prom, err := prometheus.NewClient(*conf, clients[conf.KubernetesConfig.ClusterName].GetToken())
	require.NoError(err)

	promMock := new(prometheustest.PromAPIMock)
	promMock.SpyArgumentsAndReturnEmpty(func(mock.Arguments) {})
	prom.Inject(promMock)
	svc := NewLayerBuilder(t, conf).WithClients(clients).WithProm(prom).Build().Svc

	s, err := svc.GetServiceDetails(context.TODO(), conf.KubernetesConfig.ClusterName, "bookinfo", "ratings-home-cluster", "60s", time.Now(), true)
	require.NoError(err)

	validationKey := models.IstioValidationKey{
		Cluster:   conf.KubernetesConfig.ClusterName,
		Namespace: "bookinfo", Name: "ratings-home-cluster", ObjectGVK: schema.GroupVersionKind{Group: "", Version: "", Kind: "service"},
	}
	assert.NotNil(s.Validations[validationKey])
	assert.NotNil(s.Validations[validationKey].Checks)
	assert.Equal(len(s.Validations[validationKey].Checks), 0)
}

func TestGetServiceDetailsValidationErrors(t *testing.T) {
	assert := assert.New(t)
	require := require.New(t)

	conf := config.NewConfig()
	conf.ExternalServices.Istio.IstioAPIEnabled = false
	config.Set(conf)

	clients := map[string]kubernetes.UserClientInterface{
		conf.KubernetesConfig.ClusterName: kubetest.NewFakeK8sClient(
			kubetest.FakeNamespace("bookinfo"),
			&core_v1.Service{
				ObjectMeta: meta_v1.ObjectMeta{Name: "ratings-home-cluster", Namespace: "bookinfo", Labels: map[string]string{"app": "ratings"}},
				Spec:       core_v1.ServiceSpec{Ports: []core_v1.ServicePort{{Name: "http", Port: 9081, Protocol: "TCP"}}, Selector: map[string]string{"app": "ratings"}},
			},
			FakeDeploymentWithPort("ratings", 9080),
		),
	}

	prom, err := prometheus.NewClient(*conf, clients[conf.KubernetesConfig.ClusterName].GetToken())
	require.NoError(err)

	promMock := new(prometheustest.PromAPIMock)
	promMock.SpyArgumentsAndReturnEmpty(func(mock.Arguments) {})
	prom.Inject(promMock)
	svc := NewLayerBuilder(t, conf).WithClients(clients).WithProm(prom).Build().Svc

	s, err := svc.GetServiceDetails(context.TODO(), conf.KubernetesConfig.ClusterName, "bookinfo", "ratings-home-cluster", "60s", time.Now(), true)
	require.NoError(err)

	validationKey := models.IstioValidationKey{
		Cluster:   conf.KubernetesConfig.ClusterName,
		Namespace: "bookinfo", Name: "ratings-home-cluster", ObjectGVK: schema.GroupVersionKind{Group: "", Version: "", Kind: "service"},
	}
	assert.NotNil(s.Validations[validationKey])
	assert.Equal(1, len(s.Validations[validationKey].Checks))
	assert.Equal("KIA0701", s.Validations[validationKey].Checks[0].Code)
	assert.Equal("Deployment exposing same port as Service not found", s.Validations[validationKey].Checks[0].Message)
	assert.Equal(models.SeverityLevel("warning"), s.Validations[validationKey].Checks[0].Severity)
	assert.Equal("spec/ports[0]", s.Validations[validationKey].Checks[0].Path)
}
