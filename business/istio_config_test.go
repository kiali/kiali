package business

import (
	"context"
	"testing"
	"time"

	"github.com/golang/protobuf/ptypes/wrappers"
	osproject_v1 "github.com/openshift/api/project/v1"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	api_networking_v1 "istio.io/api/networking/v1"
	networking_v1 "istio.io/client-go/pkg/apis/networking/v1"
	auth_v1 "k8s.io/api/authorization/v1"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tests/data"
	"github.com/kiali/kiali/tests/testutils"
	"github.com/kiali/kiali/tests/testutils/validations"
)

func TestParseListParams(t *testing.T) {
	objects := ""
	labelSelector := ""
	criteria := ParseIstioConfigCriteria(objects, labelSelector, "")

	assert.True(t, criteria.IncludeVirtualServices)
	assert.True(t, criteria.IncludeDestinationRules)
	assert.True(t, criteria.IncludeServiceEntries)

	objects = kubernetes.Gateways.String()
	criteria = ParseIstioConfigCriteria(objects, labelSelector, "")

	assert.True(t, criteria.IncludeGateways)
	assert.False(t, criteria.IncludeVirtualServices)
	assert.False(t, criteria.IncludeDestinationRules)
	assert.False(t, criteria.IncludeServiceEntries)

	objects = kubernetes.K8sGateways.String()
	criteria = ParseIstioConfigCriteria(objects, labelSelector, "")

	assert.True(t, criteria.IncludeK8sGateways)
	assert.False(t, criteria.IncludeVirtualServices)
	assert.False(t, criteria.IncludeDestinationRules)
	assert.False(t, criteria.IncludeServiceEntries)

	objects = kubernetes.VirtualServices.String()
	criteria = ParseIstioConfigCriteria(objects, labelSelector, "")

	assert.False(t, criteria.IncludeGateways)
	assert.True(t, criteria.IncludeVirtualServices)
	assert.False(t, criteria.IncludeDestinationRules)
	assert.False(t, criteria.IncludeServiceEntries)

	objects = kubernetes.DestinationRules.String()
	criteria = ParseIstioConfigCriteria(objects, labelSelector, "")

	assert.False(t, criteria.IncludeGateways)
	assert.False(t, criteria.IncludeVirtualServices)
	assert.True(t, criteria.IncludeDestinationRules)
	assert.False(t, criteria.IncludeServiceEntries)

	objects = kubernetes.ServiceEntries.String()
	criteria = ParseIstioConfigCriteria(objects, labelSelector, "")

	assert.False(t, criteria.IncludeGateways)
	assert.False(t, criteria.IncludeVirtualServices)
	assert.False(t, criteria.IncludeDestinationRules)
	assert.True(t, criteria.IncludeServiceEntries)

	objects = kubernetes.VirtualServices.String()
	criteria = ParseIstioConfigCriteria(objects, labelSelector, "")

	assert.False(t, criteria.IncludeGateways)
	assert.True(t, criteria.IncludeVirtualServices)
	assert.False(t, criteria.IncludeDestinationRules)
	assert.False(t, criteria.IncludeServiceEntries)

	objects = kubernetes.DestinationRules.String() + ";" + kubernetes.VirtualServices.String()
	criteria = ParseIstioConfigCriteria(objects, labelSelector, "")

	assert.False(t, criteria.IncludeGateways)
	assert.True(t, criteria.IncludeVirtualServices)
	assert.True(t, criteria.IncludeDestinationRules)
	assert.False(t, criteria.IncludeServiceEntries)

	objects = "notsupported"
	criteria = ParseIstioConfigCriteria(objects, labelSelector, "")

	assert.False(t, criteria.IncludeGateways)
	assert.False(t, criteria.IncludeVirtualServices)
	assert.False(t, criteria.IncludeDestinationRules)
	assert.False(t, criteria.IncludeServiceEntries)
}

func TestGetIstioConfigList(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	criteria := IstioConfigCriteria{
		IncludeGateways:         false,
		IncludeVirtualServices:  false,
		IncludeDestinationRules: false,
		IncludeServiceEntries:   false,
	}
	cluster := conf.KubernetesConfig.ClusterName

	configService := mockGetIstioConfigList(t)

	istioconfigList, err := configService.GetIstioConfigList(context.TODO(), cluster, criteria)

	assert.Equal(0, len(istioconfigList.Gateways))
	assert.Equal(0, len(istioconfigList.VirtualServices))
	assert.Equal(0, len(istioconfigList.DestinationRules))
	assert.Equal(0, len(istioconfigList.ServiceEntries))
	assert.Nil(err)

	criteria.IncludeGateways = true

	istioconfigList, err = configService.GetIstioConfigList(context.TODO(), cluster, criteria)

	assert.Equal(2, len(istioconfigList.Gateways))
	assert.Equal(0, len(istioconfigList.VirtualServices))
	assert.Equal(0, len(istioconfigList.DestinationRules))
	assert.Equal(0, len(istioconfigList.ServiceEntries))
	assert.Nil(err)

	criteria.IncludeVirtualServices = true

	istioconfigList, err = configService.GetIstioConfigList(context.TODO(), cluster, criteria)

	assert.Equal(2, len(istioconfigList.Gateways))
	assert.Equal(2, len(istioconfigList.VirtualServices))
	assert.Equal(0, len(istioconfigList.DestinationRules))
	assert.Equal(0, len(istioconfigList.ServiceEntries))
	assert.Nil(err)

	criteria.IncludeDestinationRules = true

	istioconfigList, err = configService.GetIstioConfigList(context.TODO(), cluster, criteria)

	assert.Equal(2, len(istioconfigList.Gateways))
	assert.Equal(2, len(istioconfigList.VirtualServices))
	assert.Equal(2, len(istioconfigList.DestinationRules))
	assert.Equal(0, len(istioconfigList.ServiceEntries))
	assert.Nil(err)

	criteria.IncludeServiceEntries = true

	istioconfigList, err = configService.GetIstioConfigList(context.TODO(), cluster, criteria)

	assert.Equal(2, len(istioconfigList.Gateways))
	assert.Equal(2, len(istioconfigList.VirtualServices))
	assert.Equal(2, len(istioconfigList.DestinationRules))
	assert.Equal(1, len(istioconfigList.ServiceEntries))
	assert.Nil(err)
}

func TestGetIstioConfigDetails(t *testing.T) {
	assert := assert.New(t)

	configService := mockGetIstioConfigDetails(t)
	conf := config.Get()

	istioConfigDetails, err := configService.GetIstioConfigDetails(context.TODO(), conf.KubernetesConfig.ClusterName, "test", kubernetes.Gateways, "gw-1")
	assert.Equal("gw-1", istioConfigDetails.Gateway.Name)
	assert.True(istioConfigDetails.Permissions.Update)
	assert.False(istioConfigDetails.Permissions.Delete)
	assert.Nil(err)

	istioConfigDetails, err = configService.GetIstioConfigDetails(context.TODO(), conf.KubernetesConfig.ClusterName, "test", kubernetes.VirtualServices, "reviews")
	assert.Equal("reviews", istioConfigDetails.VirtualService.Name)
	assert.Equal("VirtualService", istioConfigDetails.VirtualService.Kind)
	assert.Equal("networking.istio.io/v1", istioConfigDetails.VirtualService.APIVersion)
	assert.Nil(err)

	istioConfigDetails, err = configService.GetIstioConfigDetails(context.TODO(), conf.KubernetesConfig.ClusterName, "test", kubernetes.DestinationRules, "reviews-dr")
	assert.Equal("reviews-dr", istioConfigDetails.DestinationRule.Name)
	assert.Equal("DestinationRule", istioConfigDetails.DestinationRule.Kind)
	assert.Equal("networking.istio.io/v1", istioConfigDetails.DestinationRule.APIVersion)
	assert.Nil(err)

	istioConfigDetails, err = configService.GetIstioConfigDetails(context.TODO(), conf.KubernetesConfig.ClusterName, "test", kubernetes.ServiceEntries, "googleapis")
	assert.Equal("googleapis", istioConfigDetails.ServiceEntry.Name)
	assert.Equal("ServiceEntry", istioConfigDetails.ServiceEntry.Kind)
	assert.Equal("networking.istio.io/v1", istioConfigDetails.ServiceEntry.APIVersion)
	assert.Nil(err)
}

func TestCheckMulticlusterPermissions(t *testing.T) {
	assert := assert.New(t)

	configService := mockGetIstioConfigDetailsMulticluster(t)

	istioConfigDetails, err := configService.GetIstioConfigDetails(context.TODO(), config.Get().KubernetesConfig.ClusterName, "test", kubernetes.Gateways, "gw-1")
	assert.Equal("gw-1", istioConfigDetails.Gateway.Name)
	assert.True(istioConfigDetails.Permissions.Update)
	assert.False(istioConfigDetails.Permissions.Delete)
	assert.Nil(err)

	istioConfigDetailsRemote, err := configService.GetIstioConfigDetails(context.TODO(), "east", "test", kubernetes.Gateways, "gw-1")
	assert.Equal("gw-1", istioConfigDetailsRemote.Gateway.Name)
	assert.True(istioConfigDetailsRemote.Permissions.Update)
	assert.False(istioConfigDetailsRemote.Permissions.Delete)
	assert.Nil(err)
}

func mockGetIstioConfigList(t *testing.T) IstioConfigService {
	fakeIstioObjects := []runtime.Object{&osproject_v1.Project{ObjectMeta: meta_v1.ObjectMeta{Name: "test"}}}
	for _, g := range fakeGetGateways() {
		fakeIstioObjects = append(fakeIstioObjects, g.DeepCopyObject())
	}
	for _, v := range fakeGetVirtualServices() {
		fakeIstioObjects = append(fakeIstioObjects, v.DeepCopyObject())
	}
	for _, d := range fakeGetDestinationRules() {
		fakeIstioObjects = append(fakeIstioObjects, d.DeepCopyObject())
	}
	for _, s := range fakeGetServiceEntries() {
		fakeIstioObjects = append(fakeIstioObjects, s.DeepCopyObject())
	}
	k8s := kubetest.NewFakeK8sClient(
		fakeIstioObjects...,
	)
	k8s.OpenShift = true

	conf := config.NewConfig()
	cache := SetupBusinessLayer(t, k8s, *conf)

	k8sclients := make(map[string]kubernetes.UserClientInterface)
	k8sclients[config.Get().KubernetesConfig.ClusterName] = k8s
	return IstioConfigService{
		userClients:   k8sclients,
		saClients:     kubernetes.ConvertFromUserClients(k8sclients),
		kialiCache:    cache,
		businessLayer: NewWithBackends(k8sclients, kubernetes.ConvertFromUserClients(k8sclients), nil, nil),
		conf:          conf,
	}
}

func fakeGetGateways() []*networking_v1.Gateway {
	gw1 := data.CreateEmptyGateway("gw-1", "test", map[string]string{
		"app": "my-gateway1-controller",
	})
	gw1.Spec.Servers = []*api_networking_v1.Server{
		{
			Port: &api_networking_v1.Port{
				Number:   80,
				Name:     "http",
				Protocol: "HTTP",
			},
			Hosts: []string{
				"uk.bookinfo.com",
				"eu.bookinfo.com",
			},
			Tls: &api_networking_v1.ServerTLSSettings{
				HttpsRedirect: true,
			},
		},
	}

	gw2 := data.CreateEmptyGateway("gw-2", "test", map[string]string{
		"app": "my-gateway2-controller",
	})
	gw2.Spec.Servers = []*api_networking_v1.Server{
		{
			Port: &api_networking_v1.Port{
				Number:   80,
				Name:     "http",
				Protocol: "HTTP",
			},
			Hosts: []string{
				"uk.bookinfo.com",
				"eu.bookinfo.com",
			},
			Tls: &api_networking_v1.ServerTLSSettings{
				HttpsRedirect: true,
			},
		},
	}

	return []*networking_v1.Gateway{gw1, gw2}
}

func fakeGetVirtualServices() []*networking_v1.VirtualService {
	virtualService1 := data.AddHttpRoutesToVirtualService(data.CreateHttpRouteDestination("reviews", "v2", 50),
		data.AddHttpRoutesToVirtualService(data.CreateHttpRouteDestination("reviews", "v3", 50),
			data.CreateEmptyVirtualService("reviews", "test", []string{"reviews"}),
		),
	)

	virtualService2 := data.AddHttpRoutesToVirtualService(data.CreateHttpRouteDestination("details", "v2", 50),
		data.AddHttpRoutesToVirtualService(data.CreateHttpRouteDestination("details", "v3", 50),
			data.CreateEmptyVirtualService("details", "test", []string{"details"}),
		),
	)

	return []*networking_v1.VirtualService{virtualService1, virtualService2}
}

func fakeGetDestinationRules() []*networking_v1.DestinationRule {
	destinationRule1 := data.AddSubsetToDestinationRule(data.CreateSubset("v1", "v1"),
		data.AddSubsetToDestinationRule(data.CreateSubset("v2", "v2"),
			data.CreateEmptyDestinationRule("test", "reviews-dr", "reviews")))

	errors := wrappers.UInt32Value{Value: 50}
	destinationRule1.Spec.TrafficPolicy = &api_networking_v1.TrafficPolicy{
		ConnectionPool: &api_networking_v1.ConnectionPoolSettings{
			Http: &api_networking_v1.ConnectionPoolSettings_HTTPSettings{
				MaxRequestsPerConnection: 100,
			},
		},
		OutlierDetection: &api_networking_v1.OutlierDetection{
			Consecutive_5XxErrors: &errors,
		},
	}

	destinationRule2 := data.AddSubsetToDestinationRule(data.CreateSubset("v1", "v1"),
		data.AddSubsetToDestinationRule(data.CreateSubset("v2", "v2"),
			data.CreateEmptyDestinationRule("test", "details-dr", "details")))

	destinationRule2.Spec.TrafficPolicy = &api_networking_v1.TrafficPolicy{
		ConnectionPool: &api_networking_v1.ConnectionPoolSettings{
			Http: &api_networking_v1.ConnectionPoolSettings_HTTPSettings{
				MaxRequestsPerConnection: 100,
			},
		},
		OutlierDetection: &api_networking_v1.OutlierDetection{
			Consecutive_5XxErrors: &errors,
		},
	}

	return []*networking_v1.DestinationRule{destinationRule1, destinationRule2}
}

func fakeGetServiceEntries() []*networking_v1.ServiceEntry {
	serviceEntry := networking_v1.ServiceEntry{}
	serviceEntry.Name = "googleapis"
	serviceEntry.Namespace = "test"
	serviceEntry.Spec.Hosts = []string{
		"*.googleapis.com",
	}
	serviceEntry.Spec.Ports = []*api_networking_v1.ServicePort{
		{
			Number:   443,
			Name:     "https",
			Protocol: "HTTP",
		},
	}
	return []*networking_v1.ServiceEntry{&serviceEntry}
}

func fakeGetSelfSubjectAccessReview() []*auth_v1.SelfSubjectAccessReview {
	create := auth_v1.SelfSubjectAccessReview{
		Spec: auth_v1.SelfSubjectAccessReviewSpec{
			ResourceAttributes: &auth_v1.ResourceAttributes{
				Namespace: "test",
				Verb:      "create",
				Resource:  "destinationrules",
			},
		},
		Status: auth_v1.SubjectAccessReviewStatus{
			Allowed: true,
			Reason:  "authorized",
		},
	}
	update := auth_v1.SelfSubjectAccessReview{
		Spec: auth_v1.SelfSubjectAccessReviewSpec{
			ResourceAttributes: &auth_v1.ResourceAttributes{
				Namespace: "test",
				Verb:      "patch",
				Resource:  "destinationrules",
			},
		},
		Status: auth_v1.SubjectAccessReviewStatus{
			Allowed: true,
			Reason:  "authorized",
		},
	}
	delete := auth_v1.SelfSubjectAccessReview{
		Spec: auth_v1.SelfSubjectAccessReviewSpec{
			ResourceAttributes: &auth_v1.ResourceAttributes{
				Namespace: "test",
				Verb:      "delete",
				Resource:  "destinationrules",
			},
		},
		Status: auth_v1.SubjectAccessReviewStatus{
			Allowed: false,
			Reason:  "not authorized",
		},
	}
	return []*auth_v1.SelfSubjectAccessReview{&create, &update, &delete}
}

// Need to mock out the SelfSubjectAccessReview.
type fakeAccessReview struct{ kubernetes.UserClientInterface }

func (a *fakeAccessReview) GetSelfSubjectAccessReview(ctx context.Context, namespace, api, resourceType string, verbs []string) ([]*auth_v1.SelfSubjectAccessReview, error) {
	return fakeGetSelfSubjectAccessReview(), nil
}

func mockGetIstioConfigDetails(t *testing.T) IstioConfigService {
	conf := config.NewConfig()
	config.Set(conf)
	fakeIstioObjects := []runtime.Object{
		fakeGetGateways()[0],
		fakeGetVirtualServices()[0],
		fakeGetDestinationRules()[0],
		fakeGetServiceEntries()[0],
		&osproject_v1.Project{ObjectMeta: meta_v1.ObjectMeta{Name: "test"}},
	}
	k8s := kubetest.NewFakeK8sClient(fakeIstioObjects...)
	k8s.OpenShift = true

	cache := SetupBusinessLayer(t, k8s, *conf)

	k8sclients := make(map[string]kubernetes.UserClientInterface)
	k8sclients[conf.KubernetesConfig.ClusterName] = &fakeAccessReview{k8s}
	return IstioConfigService{userClients: k8sclients, kialiCache: cache, businessLayer: NewWithBackends(k8sclients, kubernetes.ConvertFromUserClients(k8sclients), nil, nil), conf: conf}
}

func mockGetIstioConfigDetailsMulticluster(t *testing.T) IstioConfigService {
	conf := config.NewConfig()
	config.Set(conf)
	fakeIstioObjects := []runtime.Object{
		fakeGetGateways()[0],
		fakeGetVirtualServices()[0],
		fakeGetDestinationRules()[0],
		fakeGetServiceEntries()[0],
		&osproject_v1.Project{ObjectMeta: meta_v1.ObjectMeta{Name: "test"}},
	}
	k8s := kubetest.NewFakeK8sClient(fakeIstioObjects...)
	k8s.OpenShift = true

	cache := SetupBusinessLayer(t, k8s, *conf)

	k8sclients := make(map[string]kubernetes.UserClientInterface)
	k8sclients[conf.KubernetesConfig.ClusterName] = &fakeAccessReview{k8s}
	k8sclients["east"] = &fakeAccessReview{k8s}
	return IstioConfigService{userClients: k8sclients, kialiCache: cache, businessLayer: NewWithBackends(k8sclients, kubernetes.ConvertFromUserClients(k8sclients), nil, nil), conf: conf}
}

func TestIsValidHost(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	vs := data.CreateEmptyVirtualService("reviews", "test", []string{"reviews"})
	vs = data.AddHttpRoutesToVirtualService(data.CreateHttpRouteDestination("reviews", "v2", 50), vs)
	vs = data.AddHttpRoutesToVirtualService(data.CreateHttpRouteDestination("reviews", "v3", 50), vs)

	assert.False(t, models.IsVSValidHost(vs, "test", "", conf))
	assert.False(t, models.IsVSValidHost(vs, "test", "ratings", conf))
	assert.True(t, models.IsVSValidHost(vs, "test", "reviews", conf))
}

func TestHasCircuitBreaker(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	errors := wrappers.UInt32Value{Value: 50}
	dRule1 := data.CreateEmptyDestinationRule("test", "reviews", "reviews")
	dRule1.Spec.TrafficPolicy = &api_networking_v1.TrafficPolicy{
		ConnectionPool: &api_networking_v1.ConnectionPoolSettings{
			Http: &api_networking_v1.ConnectionPoolSettings_HTTPSettings{
				MaxRequestsPerConnection: 100,
			},
		},
		OutlierDetection: &api_networking_v1.OutlierDetection{
			Consecutive_5XxErrors: &errors,
		},
	}
	dRule1 = data.AddSubsetToDestinationRule(data.CreateSubset("v1", "v1"), dRule1)
	dRule1 = data.AddSubsetToDestinationRule(data.CreateSubset("v2", "v2"), dRule1)

	assert.False(t, models.HasDRCircuitBreaker(dRule1, "test", "", ""))
	assert.True(t, models.HasDRCircuitBreaker(dRule1, "test", "reviews", ""))
	assert.False(t, models.HasDRCircuitBreaker(dRule1, "test", "reviews-bad", ""))
	assert.True(t, models.HasDRCircuitBreaker(dRule1, "test", "reviews", "v1"))
	assert.True(t, models.HasDRCircuitBreaker(dRule1, "test", "reviews", "v2"))
	assert.True(t, models.HasDRCircuitBreaker(dRule1, "test", "reviews", "v3"))
	assert.False(t, models.HasDRCircuitBreaker(dRule1, "test", "reviews-bad", "v2"))

	dRule2 := data.CreateEmptyDestinationRule("test", "reviews", "reviews")
	dRule2 = data.AddSubsetToDestinationRule(data.CreateSubset("v1", "v1"), dRule2)
	dRule2 = data.AddSubsetToDestinationRule(data.CreateSubset("v2", "v2"), dRule2)
	dRule2.Spec.Subsets[1].TrafficPolicy = &api_networking_v1.TrafficPolicy{
		ConnectionPool: &api_networking_v1.ConnectionPoolSettings{
			Http: &api_networking_v1.ConnectionPoolSettings_HTTPSettings{
				MaxRequestsPerConnection: 100,
			},
		},
		OutlierDetection: &api_networking_v1.OutlierDetection{
			Consecutive_5XxErrors: &errors,
		},
	}

	assert.True(t, models.HasDRCircuitBreaker(dRule2, "test", "reviews", ""))
	assert.False(t, models.HasDRCircuitBreaker(dRule2, "test", "reviews", "v1"))
	assert.True(t, models.HasDRCircuitBreaker(dRule2, "test", "reviews", "v2"))
	assert.False(t, models.HasDRCircuitBreaker(dRule2, "test", "reviews-bad", "v2"))
}

func TestDeleteIstioConfigDetails(t *testing.T) {
	assert := assert.New(t)
	k8s := kubetest.NewFakeK8sClient(
		kubetest.FakeNamespace("test"),
		data.CreateEmptyVirtualService("reviews-to-delete", "test", []string{"reviews"}),
	)
	cache := SetupBusinessLayer(t, k8s, *config.NewConfig())
	conf := config.Get()

	k8sclients := make(map[string]kubernetes.UserClientInterface)
	k8sclients[conf.KubernetesConfig.ClusterName] = k8s

	layer := NewWithBackends(k8sclients, kubernetes.ConvertFromUserClients(k8sclients), nil, nil)
	configService := IstioConfigService{userClients: k8sclients, kialiCache: cache, controlPlaneMonitor: poller, businessLayer: layer, conf: conf}

	err := configService.DeleteIstioConfigDetail(context.Background(), conf.KubernetesConfig.ClusterName, "test", kubernetes.VirtualServices, "reviews-to-delete")
	assert.Nil(err)
}

func TestUpdateIstioConfigDetails(t *testing.T) {
	assert := assert.New(t)
	require := require.New(t)
	k8s := kubetest.NewFakeK8sClient(
		kubetest.FakeNamespace("test"),
		data.CreateEmptyVirtualService("reviews-to-update", "test", []string{"reviews"}),
	)
	cache := SetupBusinessLayer(t, k8s, *config.NewConfig())
	conf := config.Get()

	k8sclients := make(map[string]kubernetes.UserClientInterface)
	k8sclients[conf.KubernetesConfig.ClusterName] = k8s
	layer := NewWithBackends(k8sclients, kubernetes.ConvertFromUserClients(k8sclients), nil, nil)
	configService := IstioConfigService{userClients: k8sclients, kialiCache: cache, controlPlaneMonitor: poller, businessLayer: layer, conf: conf}

	updatedVirtualService, err := configService.UpdateIstioConfigDetail(context.Background(), conf.KubernetesConfig.ClusterName, "test", kubernetes.VirtualServices, "reviews-to-update", "{}")
	require.NoError(err)
	assert.Equal("test", updatedVirtualService.Namespace.Name)
	assert.Equal(kubernetes.VirtualServices.String(), updatedVirtualService.ObjectGVK.String())
	assert.Equal("reviews-to-update", updatedVirtualService.VirtualService.Name)
}

func TestCreateIstioConfigDetails(t *testing.T) {
	assert := assert.New(t)
	k8s := kubetest.NewFakeK8sClient(
		kubetest.FakeNamespace("test"),
	)
	cache := SetupBusinessLayer(t, k8s, *config.NewConfig())
	conf := config.Get()

	k8sclients := make(map[string]kubernetes.UserClientInterface)
	k8sclients[conf.KubernetesConfig.ClusterName] = k8s
	layer := NewWithBackends(k8sclients, kubernetes.ConvertFromUserClients(k8sclients), nil, nil)
	configService := IstioConfigService{userClients: k8sclients, kialiCache: cache, controlPlaneMonitor: poller, businessLayer: layer, conf: conf}

	createVirtualService, err := configService.CreateIstioConfigDetail(context.Background(), conf.KubernetesConfig.ClusterName, "test", kubernetes.VirtualServices, []byte("{}"))
	assert.Equal("test", createVirtualService.Namespace.Name)
	assert.Equal(kubernetes.VirtualServices.String(), createVirtualService.ObjectGVK.String())
	// Name is now encoded in the payload of the virtualservice so, it modifies this test
	// assert.Equal("reviews-to-update", createVirtualService.VirtualService.Name)
	assert.Nil(err)
}

func TestFilterIstioObjectsForWorkloadSelector(t *testing.T) {
	assert := assert.New(t)

	path := "../tests/data/filters/workload-selector-filter.yaml"
	loader := &validations.YamlFixtureLoader{Filename: path}
	err := loader.Load()
	if err != nil {
		t.Error("Error loading test data.")
	}

	istioConfigList := loader.GetResources()

	s := "app=my-gateway"
	gw := kubernetes.FilterGatewaysBySelector(s, istioConfigList.Gateways)
	assert.Equal(1, len(gw))
	assert.Equal("my-gateway", gw[0].Name)

	s = "app=my-envoyfilter"
	ef := kubernetes.FilterEnvoyFiltersBySelector(s, istioConfigList.EnvoyFilters)
	assert.Equal(1, len(ef))
	assert.Equal("my-envoyfilter", ef[0].Name)

	s = "app=my-sidecar"
	sc := kubernetes.FilterSidecarsBySelector(s, istioConfigList.Sidecars)
	assert.Equal(1, len(sc))
	assert.Equal("my-sidecar", sc[0].Name)

	s = "app=my-security"
	ap := kubernetes.FilterAuthorizationPoliciesBySelector(s, istioConfigList.AuthorizationPolicies)
	assert.Equal(1, len(ap))

	s = "app=my-security"
	ra := kubernetes.FilterRequestAuthenticationsBySelector(s, istioConfigList.RequestAuthentications)
	assert.Equal(1, len(ra))

	s = "app=my-security"
	pa := kubernetes.FilterPeerAuthenticationsBySelector(s, istioConfigList.PeerAuthentications)
	assert.Equal(1, len(pa))
}

func TestListWithAllNamespacesButNoAccessReturnsEmpty(t *testing.T) {
	assert := assert.New(t)
	require := require.New(t)

	conf := config.NewConfig()
	conf.KubernetesConfig.CacheTokenNamespaceDuration = 10000
	conf.KubernetesConfig.ClusterName = "Kubernetes"
	kubernetes.SetConfig(t, *conf)
	fakeIstioObjects := []runtime.Object{
		kubetest.FakeNamespace("test"),
	}
	fakeIstioObjects = append(fakeIstioObjects, kubernetes.ToRuntimeObjects(fakeGetGateways())...)
	k8s := kubetest.NewFakeK8sClient(fakeIstioObjects...)

	cache := SetupBusinessLayer(t, k8s, *conf)

	// Set the token and set the namespaces so that when namespace access is checked,
	// the token namespace cache will be used but will not have the "test" namespace
	// in it so the list should return empty.
	k8s.Token = "test"
	cache.SetNamespaces("test", []models.Namespace{{Name: "nottest", Cluster: "Kubernetes"}})
	k8sclients := make(map[string]kubernetes.UserClientInterface)
	k8sclients[conf.KubernetesConfig.ClusterName] = k8s
	configService := NewWithBackends(k8sclients, kubernetes.ConvertFromUserClients(k8sclients), nil, nil).IstioConfig

	criteria := IstioConfigCriteria{
		IncludeGateways: true,
	}

	istioConfigList, err := configService.GetIstioConfigList(context.Background(), conf.KubernetesConfig.ClusterName, criteria)
	require.NoError(err)

	assert.Len(istioConfigList.Gateways, 0)
}

func TestListNamespaceScopedReturnsAllAccessibleNamespaces(t *testing.T) {
	assert := assert.New(t)
	require := require.New(t)

	conf := testutils.GetConfigFromYaml(t, `
kubernetes_config:
  cache_token_namespace_duration: 10000
deployment:
  cluster_wide_access: false
  discovery_selectors:
    default:
    - matchLabels: {"kubernetes.io/metadata.name": "test" }
    - matchLabels: {"kubernetes.io/metadata.name": "test-b" }
    - matchLabels: {"kubernetes.io/metadata.name": "istio-system" }
`)
	kubernetes.SetConfig(t, *conf)
	objects := []runtime.Object{
		kubetest.FakeNamespace("istio-system"),
		kubetest.FakeNamespace("test"),
		kubetest.FakeNamespace("test-b"),
		kubetest.FakeNamespace("test-c"),
	}
	objects = append(objects, kubernetes.ToRuntimeObjects(fakeGetGateways())...)
	testBGateways := fakeGetGateways()
	for _, gateway := range testBGateways {
		gateway.Namespace = "test-b"
		objects = append(objects, gateway)
	}
	testCGateways := fakeGetGateways()
	for _, gateway := range testCGateways {
		gateway.Namespace = "test-c"
		objects = append(objects, gateway)
	}
	k8s := kubetest.NewFakeK8sClient(objects...)

	SetupBusinessLayer(t, k8s, *conf)

	k8sclients := make(map[string]kubernetes.UserClientInterface)
	k8sclients[conf.KubernetesConfig.ClusterName] = k8s
	configService := NewWithBackends(k8sclients, kubernetes.ConvertFromUserClients(k8sclients), nil, nil).IstioConfig

	criteria := IstioConfigCriteria{
		IncludeGateways: true,
	}

	istioConfigList, err := configService.GetIstioConfigList(context.Background(), conf.KubernetesConfig.ClusterName, criteria)
	require.NoError(err)

	assert.Len(istioConfigList.Gateways, 4)
}

func TestUpdateIstioObjectWithoutValidations(t *testing.T) {
	assert := assert.New(t)
	require := require.New(t)
	conf := config.Get()
	istioConfigList := fakeIstioConfigList()

	// Using a mocked configuration from the validations testing
	// This configuration will result in some validations errors
	validationService := mockCombinedValidationService(t, conf, istioConfigList,
		[]string{"details.test.svc.cluster.local", "product.test.svc.cluster.local", "customer.test.svc.cluster.local"})

	// Setting the resources to the k8s client too
	k8s := kubetest.NewFakeK8sClient(
		kubetest.FakeNamespace("test"),
		istioConfigList.VirtualServices[0],
		istioConfigList.DestinationRules[0],
		istioConfigList.Gateways[0],
	)

	// Disabling validations
	duration, err := time.ParseDuration("0s")
	if err != nil {
		println("Error parsing duration:", err.Error())
		return
	}
	conf.ExternalServices.Istio.ValidationReconcileInterval = &duration

	cache := SetupBusinessLayer(t, k8s, *conf)

	k8sclients := make(map[string]kubernetes.UserClientInterface)
	k8sclients[conf.KubernetesConfig.ClusterName] = k8s
	layer := NewWithBackends(k8sclients, kubernetes.ConvertFromUserClients(k8sclients), nil, nil)
	layer.Validations = validationService

	configService := IstioConfigService{userClients: k8sclients, kialiCache: cache, controlPlaneMonitor: poller, businessLayer: layer, conf: conf}

	updatedVirtualService, err := configService.UpdateIstioConfigDetail(context.Background(), conf.KubernetesConfig.ClusterName, "test", kubernetes.VirtualServices, "product-vs", "{}")

	require.NoError(err)
	assert.Equal("product-vs", updatedVirtualService.VirtualService.Name)
	assert.Equal(0, len(configService.kialiCache.Validations().Items()))
}
