package business

import (
	"context"
	"sort"
	"testing"
	"time"

	osroutes_v1 "github.com/openshift/api/route/v1"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	api_networking_v1 "istio.io/api/networking/v1"
	networking_v1 "istio.io/client-go/pkg/apis/networking/v1"
	apps_v1 "k8s.io/api/apps/v1"
	core_v1 "k8s.io/api/core/v1"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"

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

func TestGetServiceTracingNameUseWaypointNameConfig(t *testing.T) {
	assert := assert.New(t)
	require := require.New(t)

	k8sObjects := []runtime.Object{
		kubetest.FakeNamespaceWithLabels("bookinfo", map[string]string{}),
		&core_v1.Service{
			ObjectMeta: meta_v1.ObjectMeta{
				Name:      "ratings",
				Namespace: "bookinfo",
				Labels: map[string]string{
					config.WaypointUseLabel: "waypoint",
				},
			},
			Spec: core_v1.ServiceSpec{
				Selector: map[string]string{
					"app": "ratings",
				},
			},
		},
		&apps_v1.Deployment{
			ObjectMeta: meta_v1.ObjectMeta{
				Name:      "waypoint",
				Namespace: "bookinfo",
				Annotations: map[string]string{
					"gateway.istio.io/managed": "istio.io-mesh-controller",
				},
			},
		},
	}

	{
		conf := config.NewConfig()
		conf.ExternalServices.Istio.IstioAPIEnabled = false
		conf.ExternalServices.Tracing.UseWaypointName = false
		config.Set(conf)

		k8s := kubetest.NewFakeK8sClient(k8sObjects...)
		svc := NewLayerBuilder(t, conf).WithClient(k8s).Build().Svc

		s, err := svc.GetServiceTracingName(context.TODO(), conf.KubernetesConfig.ClusterName, "bookinfo", "ratings")
		require.NoError(err)
		assert.Equal("ratings", s.App)
		assert.Equal("ratings.bookinfo.svc.cluster.local", s.Lookup)
		assert.Equal("ratings.bookinfo.svc.cluster.local", s.WaypointName)
	}

	{
		conf := config.NewConfig()
		conf.ExternalServices.Istio.IstioAPIEnabled = false
		conf.ExternalServices.Tracing.UseWaypointName = true
		config.Set(conf)

		k8s := kubetest.NewFakeK8sClient(k8sObjects...)
		svc := NewLayerBuilder(t, conf).WithClient(k8s).Build().Svc

		s, err := svc.GetServiceTracingName(context.TODO(), conf.KubernetesConfig.ClusterName, "bookinfo", "ratings")
		require.NoError(err)
		assert.Equal("ratings", s.App)
		assert.Equal("waypoint", s.Lookup)
		assert.Equal("waypoint", s.WaypointName)
		assert.Equal("bookinfo", s.WaypointNamespace)
	}
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

func TestServiceListIncludesServiceEntryServices(t *testing.T) {
	assert := assert.New(t)
	require := require.New(t)

	conf := config.NewConfig()
	config.Set(conf)

	se := &networking_v1.ServiceEntry{
		ObjectMeta: meta_v1.ObjectMeta{
			Name:      "external-api",
			Namespace: "bookinfo",
			Labels:    map[string]string{"app": "external"},
		},
		Spec: api_networking_v1.ServiceEntry{
			Hosts: []string{"external-api.example.com"},
		},
	}

	k8s := kubetest.NewFakeK8sClient(
		kubetest.FakeNamespace("bookinfo"),
		&core_v1.Service{ObjectMeta: meta_v1.ObjectMeta{Name: "reviews", Namespace: "bookinfo"}},
		se,
	)
	svc := NewLayerBuilder(t, conf).WithClient(k8s).Build().Svc

	criteria := ServiceCriteria{
		Namespace:             "bookinfo",
		IncludeIstioResources: true,
		IncludeHealth:         false,
	}
	serviceList, err := svc.GetServiceList(context.TODO(), criteria)
	require.NoError(err)
	require.Len(serviceList.Services, 2)

	var seService *models.ServiceOverview
	for i := range serviceList.Services {
		if serviceList.Services[i].Name == "external-api.example.com" {
			seService = &serviceList.Services[i]
			break
		}
	}
	require.NotNil(seService, "SE-backed service not found in list")
	assert.Equal("External", seService.ServiceRegistry)
	assert.True(seService.IstioSidecar)
	assert.Equal("bookinfo", seService.Namespace)
	assert.Equal(conf.KubernetesConfig.ClusterName, seService.Cluster)
	assert.Equal(map[string]string{"app": "external"}, seService.Labels)

	require.NotEmpty(seService.IstioReferences)
	foundSERef := false
	for _, ref := range seService.IstioReferences {
		if ref.Name == "external-api" && ref.ObjectGVK == kubernetes.ServiceEntries {
			foundSERef = true
			break
		}
	}
	assert.True(foundSERef, "ServiceEntry reference not found in IstioReferences")
}

func TestServiceListSEMultipleHosts(t *testing.T) {
	require := require.New(t)

	conf := config.NewConfig()
	config.Set(conf)

	se := &networking_v1.ServiceEntry{
		ObjectMeta: meta_v1.ObjectMeta{
			Name:      "multi-host-se",
			Namespace: "bookinfo",
		},
		Spec: api_networking_v1.ServiceEntry{
			Hosts: []string{"api-v1.example.com", "api-v2.example.com", "api-v3.example.com"},
		},
	}

	k8s := kubetest.NewFakeK8sClient(
		kubetest.FakeNamespace("bookinfo"),
		se,
	)
	svc := NewLayerBuilder(t, conf).WithClient(k8s).Build().Svc

	criteria := ServiceCriteria{
		Namespace:             "bookinfo",
		IncludeIstioResources: true,
		IncludeHealth:         false,
	}
	serviceList, err := svc.GetServiceList(context.TODO(), criteria)
	require.NoError(err)
	require.Len(serviceList.Services, 3)

	names := make(map[string]bool)
	for _, s := range serviceList.Services {
		names[s.Name] = true
	}
	require.True(names["api-v1.example.com"])
	require.True(names["api-v2.example.com"])
	require.True(names["api-v3.example.com"])
}

func TestServiceListForClusterAllNamespacesIncludesServiceEntryServices(t *testing.T) {
	require := require.New(t)

	conf := config.NewConfig()
	config.Set(conf)

	bookinfoSE := &networking_v1.ServiceEntry{
		ObjectMeta: meta_v1.ObjectMeta{
			Name:      "bookinfo-external",
			Namespace: "bookinfo",
		},
		Spec: api_networking_v1.ServiceEntry{
			Hosts: []string{"bookinfo-external.example.com"},
		},
	}
	travelSE := &networking_v1.ServiceEntry{
		ObjectMeta: meta_v1.ObjectMeta{
			Name:      "travel-external",
			Namespace: "travel",
		},
		Spec: api_networking_v1.ServiceEntry{
			Hosts: []string{"travel-external.example.com"},
		},
	}

	k8s := kubetest.NewFakeK8sClient(
		kubetest.FakeNamespace("bookinfo"),
		kubetest.FakeNamespace("travel"),
		&core_v1.Service{ObjectMeta: meta_v1.ObjectMeta{Name: "reviews", Namespace: "bookinfo"}},
		&core_v1.Service{ObjectMeta: meta_v1.ObjectMeta{Name: "ratings", Namespace: "travel"}},
		bookinfoSE,
		travelSE,
	)
	svc := NewLayerBuilder(t, conf).WithClient(k8s).Build().Svc

	criteria := ServiceCriteria{
		Namespace:              "",
		IncludeIstioResources:  true,
		IncludeHealth:          false,
		IncludeOnlyDefinitions: true,
	}
	serviceList, err := svc.GetServiceListForCluster(context.TODO(), criteria, conf.KubernetesConfig.ClusterName)
	require.NoError(err)

	names := make(map[string]bool)
	for _, s := range serviceList.Services {
		names[s.Name] = true
	}
	require.True(names["bookinfo-external.example.com"])
	require.True(names["travel-external.example.com"])
}

func TestServiceListSEDeduplicatesAgainstK8sService(t *testing.T) {
	assert := assert.New(t)
	require := require.New(t)

	conf := config.NewConfig()
	config.Set(conf)

	se := &networking_v1.ServiceEntry{
		ObjectMeta: meta_v1.ObjectMeta{
			Name:      "reviews-se",
			Namespace: "bookinfo",
		},
		Spec: api_networking_v1.ServiceEntry{
			Hosts: []string{"reviews", "external-only.example.com"},
		},
	}

	k8s := kubetest.NewFakeK8sClient(
		kubetest.FakeNamespace("bookinfo"),
		&core_v1.Service{ObjectMeta: meta_v1.ObjectMeta{Name: "reviews", Namespace: "bookinfo"}},
		se,
	)
	svc := NewLayerBuilder(t, conf).WithClient(k8s).Build().Svc

	criteria := ServiceCriteria{
		Namespace:             "bookinfo",
		IncludeIstioResources: true,
		IncludeHealth:         false,
	}
	serviceList, err := svc.GetServiceList(context.TODO(), criteria)
	require.NoError(err)

	require.Len(serviceList.Services, 2)
	names := make(map[string]bool)
	for _, s := range serviceList.Services {
		names[s.Name] = true
	}
	assert.True(names["reviews"])
	assert.True(names["external-only.example.com"])
}

func TestServiceListSEDeduplicatesAgainstK8sServiceFQDN(t *testing.T) {
	assert := assert.New(t)
	require := require.New(t)

	conf := config.NewConfig()
	config.Set(conf)

	se := &networking_v1.ServiceEntry{
		ObjectMeta: meta_v1.ObjectMeta{
			Name:      "reviews-se",
			Namespace: "bookinfo",
		},
		Spec: api_networking_v1.ServiceEntry{
			Hosts: []string{"reviews.bookinfo.svc.cluster.local", "external-only.example.com"},
		},
	}

	k8s := kubetest.NewFakeK8sClient(
		kubetest.FakeNamespace("bookinfo"),
		&core_v1.Service{ObjectMeta: meta_v1.ObjectMeta{Name: "reviews", Namespace: "bookinfo"}},
		se,
	)
	svc := NewLayerBuilder(t, conf).WithClient(k8s).Build().Svc

	criteria := ServiceCriteria{
		Namespace:             "bookinfo",
		IncludeIstioResources: true,
		IncludeHealth:         false,
	}
	serviceList, err := svc.GetServiceList(context.TODO(), criteria)
	require.NoError(err)

	require.Len(serviceList.Services, 2)
	names := make(map[string]bool)
	for _, s := range serviceList.Services {
		names[s.Name] = true
	}
	assert.True(names["reviews"])
	assert.True(names["external-only.example.com"])
	assert.False(names["reviews.bookinfo.svc.cluster.local"])
}

func TestServiceListSEDifferentNamespaceSkipped(t *testing.T) {
	require := require.New(t)

	conf := config.NewConfig()
	config.Set(conf)

	se := &networking_v1.ServiceEntry{
		ObjectMeta: meta_v1.ObjectMeta{
			Name:      "other-ns-se",
			Namespace: "other-namespace",
		},
		Spec: api_networking_v1.ServiceEntry{
			Hosts: []string{"external.example.com"},
		},
	}

	k8s := kubetest.NewFakeK8sClient(
		kubetest.FakeNamespace("bookinfo"),
		kubetest.FakeNamespace("other-namespace"),
		&core_v1.Service{ObjectMeta: meta_v1.ObjectMeta{Name: "reviews", Namespace: "bookinfo"}},
		se,
	)
	svc := NewLayerBuilder(t, conf).WithClient(k8s).Build().Svc

	criteria := ServiceCriteria{
		Namespace:             "bookinfo",
		IncludeIstioResources: true,
		IncludeHealth:         false,
	}
	serviceList, err := svc.GetServiceList(context.TODO(), criteria)
	require.NoError(err)
	require.Len(serviceList.Services, 1)
	require.Equal("reviews", serviceList.Services[0].Name)
}

func TestServiceListSEDuplicateHostnameAcrossSEs(t *testing.T) {
	require := require.New(t)

	conf := config.NewConfig()
	config.Set(conf)

	se1 := &networking_v1.ServiceEntry{
		ObjectMeta: meta_v1.ObjectMeta{
			Name:      "se-one",
			Namespace: "bookinfo",
		},
		Spec: api_networking_v1.ServiceEntry{
			Hosts: []string{"shared.example.com", "unique-a.example.com"},
		},
	}
	se2 := &networking_v1.ServiceEntry{
		ObjectMeta: meta_v1.ObjectMeta{
			Name:      "se-two",
			Namespace: "bookinfo",
		},
		Spec: api_networking_v1.ServiceEntry{
			Hosts: []string{"shared.example.com", "unique-b.example.com"},
		},
	}

	k8s := kubetest.NewFakeK8sClient(
		kubetest.FakeNamespace("bookinfo"),
		se1, se2,
	)
	svc := NewLayerBuilder(t, conf).WithClient(k8s).Build().Svc

	criteria := ServiceCriteria{
		Namespace:             "bookinfo",
		IncludeIstioResources: true,
		IncludeHealth:         false,
	}
	serviceList, err := svc.GetServiceList(context.TODO(), criteria)
	require.NoError(err)
	require.Len(serviceList.Services, 3)

	names := make(map[string]int)
	for _, s := range serviceList.Services {
		names[s.Name]++
	}
	require.Equal(1, names["shared.example.com"], "shared hostname should appear only once")
	require.Equal(1, names["unique-a.example.com"])
	require.Equal(1, names["unique-b.example.com"])
}

func TestGetServiceFallbackToServiceEntry(t *testing.T) {
	assert := assert.New(t)
	require := require.New(t)

	conf := config.NewConfig()
	config.Set(conf)

	se := &networking_v1.ServiceEntry{
		ObjectMeta: meta_v1.ObjectMeta{
			Name:      "external-api-se",
			Namespace: "bookinfo",
			Labels:    map[string]string{"app": "external-api"},
		},
		Spec: api_networking_v1.ServiceEntry{
			Hosts: []string{"external-api.example.com"},
			Ports: []*api_networking_v1.ServicePort{
				{Name: "http", Number: 80, Protocol: "HTTP"},
			},
		},
	}

	k8s := kubetest.NewFakeK8sClient(
		kubetest.FakeNamespace("bookinfo"),
		se,
	)
	svc := NewLayerBuilder(t, conf).WithClient(k8s).Build().Svc

	s, err := svc.GetService(context.TODO(), conf.KubernetesConfig.ClusterName, "bookinfo", "external-api.example.com")
	require.NoError(err)

	assert.Equal("external-api.example.com", s.Name)
	assert.Equal("bookinfo", s.Namespace)
	assert.Equal("External", s.Type)
	assert.Equal(conf.KubernetesConfig.ClusterName, s.Cluster)
	assert.Equal(map[string]string{"app": "external-api"}, s.Labels)
	require.Len(s.Ports, 1)
	assert.Equal("http", s.Ports[0].Name)
	assert.Equal(int32(80), s.Ports[0].Port)
}

func TestGetServiceNotFoundWhenNoSEMatch(t *testing.T) {
	require := require.New(t)

	conf := config.NewConfig()
	config.Set(conf)

	se := &networking_v1.ServiceEntry{
		ObjectMeta: meta_v1.ObjectMeta{
			Name:      "unrelated-se",
			Namespace: "bookinfo",
		},
		Spec: api_networking_v1.ServiceEntry{
			Hosts: []string{"unrelated.example.com"},
		},
	}

	k8s := kubetest.NewFakeK8sClient(
		kubetest.FakeNamespace("bookinfo"),
		se,
	)
	svc := NewLayerBuilder(t, conf).WithClient(k8s).Build().Svc

	_, err := svc.GetService(context.TODO(), conf.KubernetesConfig.ClusterName, "bookinfo", "nonexistent-service")
	require.Error(err)
}

func TestGetServiceDetailsSubServicesVersioned(t *testing.T) {
	assert := assert.New(t)
	require := require.New(t)

	conf := config.NewConfig()
	config.Set(conf)

	mainSvc := &core_v1.Service{
		ObjectMeta: meta_v1.ObjectMeta{Name: "reviews", Namespace: "bookinfo", Labels: map[string]string{"app": "reviews"}},
		Spec: core_v1.ServiceSpec{
			Selector: map[string]string{"app": "reviews"},
			Ports:    []core_v1.ServicePort{{Name: "http", Port: 9080, Protocol: "TCP"}},
		},
	}
	subSvcV1 := &core_v1.Service{
		ObjectMeta: meta_v1.ObjectMeta{Name: "reviews-v1", Namespace: "bookinfo", Labels: map[string]string{"app": "reviews"}},
		Spec: core_v1.ServiceSpec{
			Selector: map[string]string{"app": "reviews", "version": "v1"},
			Ports:    []core_v1.ServicePort{{Name: "http", Port: 9080, Protocol: "TCP"}},
		},
	}
	subSvcV2 := &core_v1.Service{
		ObjectMeta: meta_v1.ObjectMeta{Name: "reviews-v2", Namespace: "bookinfo", Labels: map[string]string{"app": "reviews"}},
		Spec: core_v1.ServiceSpec{
			Selector: map[string]string{"app": "reviews", "version": "v2"},
			Ports:    []core_v1.ServicePort{{Name: "http", Port: 9080, Protocol: "TCP"}},
		},
	}
	unrelatedSvc := &core_v1.Service{
		ObjectMeta: meta_v1.ObjectMeta{Name: "ratings", Namespace: "bookinfo", Labels: map[string]string{"app": "ratings"}},
		Spec: core_v1.ServiceSpec{
			Selector: map[string]string{"app": "ratings", "version": "v1"},
			Ports:    []core_v1.ServicePort{{Name: "http", Port: 9081, Protocol: "TCP"}},
		},
	}

	clients := map[string]kubernetes.UserClientInterface{
		conf.KubernetesConfig.ClusterName: kubetest.NewFakeK8sClient(
			kubetest.FakeNamespace("bookinfo"),
			mainSvc, subSvcV1, subSvcV2, unrelatedSvc,
		),
	}
	prom, err := prometheus.NewClient(*conf, clients[conf.KubernetesConfig.ClusterName].GetToken())
	require.NoError(err)
	promMock := new(prometheustest.PromAPIMock)
	promMock.SpyArgumentsAndReturnEmpty(func(mock.Arguments) {})
	prom.Inject(promMock)

	svc := NewLayerBuilder(t, conf).WithClients(clients).WithProm(prom).Build().Svc

	s, err := svc.GetServiceDetails(context.TODO(), conf.KubernetesConfig.ClusterName, "bookinfo", "reviews", "60s", time.Now(), false)
	require.NoError(err)

	require.Len(s.SubServices, 2)
	subNames := make(map[string]bool)
	for _, sub := range s.SubServices {
		subNames[sub.Name] = true
	}
	assert.True(subNames["reviews-v1"])
	assert.True(subNames["reviews-v2"])
	assert.False(subNames["ratings"])
	assert.False(subNames["reviews"])
}

func TestServiceListSEAppearsWithoutIstioResources(t *testing.T) {
	assert := assert.New(t)
	require := require.New(t)

	conf := config.NewConfig()
	config.Set(conf)

	se := &networking_v1.ServiceEntry{
		ObjectMeta: meta_v1.ObjectMeta{
			Name:      "external-api",
			Namespace: "bookinfo",
			Labels:    map[string]string{"app": "external"},
		},
		Spec: api_networking_v1.ServiceEntry{
			Hosts: []string{"foo.bookinfo.ext"},
		},
	}

	k8s := kubetest.NewFakeK8sClient(
		kubetest.FakeNamespace("bookinfo"),
		&core_v1.Service{ObjectMeta: meta_v1.ObjectMeta{Name: "reviews", Namespace: "bookinfo"}},
		se,
	)
	svc := NewLayerBuilder(t, conf).WithClient(k8s).Build().Svc

	criteria := ServiceCriteria{
		Namespace:             "bookinfo",
		IncludeIstioResources: false,
		IncludeHealth:         false,
	}
	serviceList, err := svc.GetServiceList(context.TODO(), criteria)
	require.NoError(err)
	require.Len(serviceList.Services, 2)

	names := make(map[string]bool)
	for _, s := range serviceList.Services {
		names[s.Name] = true
	}
	assert.True(names["reviews"])
	assert.True(names["foo.bookinfo.ext"], "SE-backed service must appear even when IncludeIstioResources is false")
}

// With the Istiod service registry removed, ServiceEntries are now the source
// of SE-backed services. They must always be included in the service list,
// regardless of whether the caller requests Istio resources. This test uses the
// exact criteria the graph idle node appender uses to verify that SE-backed
// services remain visible.
func TestServiceListSEAppearsForGraphAppenderPattern(t *testing.T) {
	assert := assert.New(t)
	require := require.New(t)

	conf := config.NewConfig()
	config.Set(conf)

	se := &networking_v1.ServiceEntry{
		ObjectMeta: meta_v1.ObjectMeta{
			Name:      "external-api",
			Namespace: "bookinfo",
		},
		Spec: api_networking_v1.ServiceEntry{
			Hosts: []string{"foo.bookinfo.ext"},
		},
	}

	k8s := kubetest.NewFakeK8sClient(
		kubetest.FakeNamespace("bookinfo"),
		&core_v1.Service{ObjectMeta: meta_v1.ObjectMeta{Name: "reviews", Namespace: "bookinfo"}},
		se,
	)
	svc := NewLayerBuilder(t, conf).WithClient(k8s).Build().Svc

	criteria := ServiceCriteria{
		Cluster:                conf.KubernetesConfig.ClusterName,
		Namespace:              "bookinfo",
		IncludeHealth:          false,
		IncludeOnlyDefinitions: true,
	}
	serviceList, err := svc.GetServiceList(context.TODO(), criteria)
	require.NoError(err)
	require.Len(serviceList.Services, 2)

	var seService *models.ServiceOverview
	for i := range serviceList.Services {
		if serviceList.Services[i].Name == "foo.bookinfo.ext" {
			seService = &serviceList.Services[i]
			break
		}
	}
	require.NotNil(seService, "SE-backed service must appear with IncludeOnlyDefinitions=true, IncludeIstioResources=false")
	assert.Equal("External", seService.ServiceRegistry)
	assert.Equal("bookinfo", seService.Namespace)
	assert.Equal(conf.KubernetesConfig.ClusterName, seService.Cluster)
}

func TestServiceListSEReferencesLimitedWithoutIstioResources(t *testing.T) {
	assert := assert.New(t)
	require := require.New(t)

	conf := config.NewConfig()
	config.Set(conf)

	se := &networking_v1.ServiceEntry{
		ObjectMeta: meta_v1.ObjectMeta{
			Name:      "external-api",
			Namespace: "bookinfo",
		},
		Spec: api_networking_v1.ServiceEntry{
			Hosts: []string{"foo.bookinfo.ext"},
		},
	}

	k8s := kubetest.NewFakeK8sClient(
		kubetest.FakeNamespace("bookinfo"),
		se,
	)
	svc := NewLayerBuilder(t, conf).WithClient(k8s).Build().Svc

	withIstio := ServiceCriteria{
		Namespace:             "bookinfo",
		IncludeIstioResources: true,
		IncludeHealth:         false,
	}
	withIstioList, err := svc.GetServiceList(context.TODO(), withIstio)
	require.NoError(err)
	require.Len(withIstioList.Services, 1)

	withoutIstio := ServiceCriteria{
		Namespace:             "bookinfo",
		IncludeIstioResources: false,
		IncludeHealth:         false,
	}
	withoutIstioList, err := svc.GetServiceList(context.TODO(), withoutIstio)
	require.NoError(err)
	require.Len(withoutIstioList.Services, 1)

	assert.Equal("foo.bookinfo.ext", withIstioList.Services[0].Name)
	assert.Equal("foo.bookinfo.ext", withoutIstioList.Services[0].Name)

	// With IncludeIstioResources=true, the SE reference should be present
	assert.NotEmpty(withIstioList.Services[0].IstioReferences,
		"SE reference should be present when IncludeIstioResources is true")

	// With IncludeIstioResources=false, the SE reference is still present
	// because ServiceEntries are always fetched.
	assert.NotEmpty(withoutIstioList.Services[0].IstioReferences,
		"SE reference should still be present since ServiceEntries are always fetched")
}

func TestGetServiceDetailsSubServicesFallbackToMainService(t *testing.T) {
	assert := assert.New(t)
	require := require.New(t)

	conf := config.NewConfig()
	config.Set(conf)

	mainSvc := &core_v1.Service{
		ObjectMeta: meta_v1.ObjectMeta{Name: "reviews", Namespace: "bookinfo", Labels: map[string]string{"app": "reviews"}},
		Spec: core_v1.ServiceSpec{
			Selector: map[string]string{"app": "reviews"},
			Ports:    []core_v1.ServicePort{{Name: "http", Port: 9080, Protocol: "TCP"}},
		},
	}

	clients := map[string]kubernetes.UserClientInterface{
		conf.KubernetesConfig.ClusterName: kubetest.NewFakeK8sClient(
			kubetest.FakeNamespace("bookinfo"),
			mainSvc,
		),
	}
	prom, err := prometheus.NewClient(*conf, clients[conf.KubernetesConfig.ClusterName].GetToken())
	require.NoError(err)
	promMock := new(prometheustest.PromAPIMock)
	promMock.SpyArgumentsAndReturnEmpty(func(mock.Arguments) {})
	prom.Inject(promMock)

	svc := NewLayerBuilder(t, conf).WithClients(clients).WithProm(prom).Build().Svc

	s, err := svc.GetServiceDetails(context.TODO(), conf.KubernetesConfig.ClusterName, "bookinfo", "reviews", "60s", time.Now(), false)
	require.NoError(err)

	require.Len(s.SubServices, 1)
	assert.Equal("reviews", s.SubServices[0].Name)
	assert.Equal(9080, s.SubServices[0].Ports["http"])
}
