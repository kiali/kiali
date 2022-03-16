package business

import (
	"context"
	"testing"

	"github.com/gogo/protobuf/types"
	osproject_v1 "github.com/openshift/api/project/v1"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	api_networking_v1alpha3 "istio.io/api/networking/v1alpha3"
	networking_v1alpha3 "istio.io/client-go/pkg/apis/networking/v1alpha3"
	auth_v1 "k8s.io/api/authorization/v1"
	"k8s.io/apimachinery/pkg/runtime"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tests/data"
	"github.com/kiali/kiali/tests/testutils/validations"
)

func TestParseListParams(t *testing.T) {
	namespace := "bookinfo"
	objects := ""
	labelSelector := ""
	criteria := ParseIstioConfigCriteria(namespace, objects, labelSelector, "", false)

	assert.Equal(t, namespace, criteria.Namespace)
	assert.True(t, criteria.IncludeVirtualServices)
	assert.True(t, criteria.IncludeDestinationRules)
	assert.True(t, criteria.IncludeServiceEntries)
	assert.False(t, criteria.AllNamespaces)

	objects = "gateways"
	criteria = ParseIstioConfigCriteria(namespace, objects, labelSelector, "", false)

	assert.True(t, criteria.IncludeGateways)
	assert.False(t, criteria.IncludeVirtualServices)
	assert.False(t, criteria.IncludeDestinationRules)
	assert.False(t, criteria.IncludeServiceEntries)
	assert.False(t, criteria.AllNamespaces)
	assert.Equal(t, namespace, criteria.Namespace)

	criteria = ParseIstioConfigCriteria("", objects, labelSelector, "", true)

	assert.True(t, criteria.IncludeGateways)
	assert.False(t, criteria.IncludeVirtualServices)
	assert.False(t, criteria.IncludeDestinationRules)
	assert.False(t, criteria.IncludeServiceEntries)
	assert.True(t, criteria.AllNamespaces)
	assert.Equal(t, "", criteria.Namespace)

	objects = "virtualservices"
	criteria = ParseIstioConfigCriteria(namespace, objects, labelSelector, "", false)

	assert.False(t, criteria.IncludeGateways)
	assert.True(t, criteria.IncludeVirtualServices)
	assert.False(t, criteria.IncludeDestinationRules)
	assert.False(t, criteria.IncludeServiceEntries)
	assert.False(t, criteria.AllNamespaces)
	assert.Equal(t, namespace, criteria.Namespace)

	objects = "destinationrules"
	criteria = ParseIstioConfigCriteria(namespace, objects, labelSelector, "", false)

	assert.False(t, criteria.IncludeGateways)
	assert.False(t, criteria.IncludeVirtualServices)
	assert.True(t, criteria.IncludeDestinationRules)
	assert.False(t, criteria.IncludeServiceEntries)
	assert.False(t, criteria.AllNamespaces)
	assert.Equal(t, namespace, criteria.Namespace)

	objects = "serviceentries"
	criteria = ParseIstioConfigCriteria(namespace, objects, labelSelector, "", false)

	assert.False(t, criteria.IncludeGateways)
	assert.False(t, criteria.IncludeVirtualServices)
	assert.False(t, criteria.IncludeDestinationRules)
	assert.True(t, criteria.IncludeServiceEntries)
	assert.False(t, criteria.AllNamespaces)
	assert.Equal(t, namespace, criteria.Namespace)

	objects = "virtualservices"
	criteria = ParseIstioConfigCriteria(namespace, objects, labelSelector, "", false)

	assert.False(t, criteria.IncludeGateways)
	assert.True(t, criteria.IncludeVirtualServices)
	assert.False(t, criteria.IncludeDestinationRules)
	assert.False(t, criteria.IncludeServiceEntries)
	assert.False(t, criteria.AllNamespaces)
	assert.Equal(t, namespace, criteria.Namespace)

	objects = "destinationrules,virtualservices"
	criteria = ParseIstioConfigCriteria(namespace, objects, labelSelector, "", false)

	assert.False(t, criteria.IncludeGateways)
	assert.True(t, criteria.IncludeVirtualServices)
	assert.True(t, criteria.IncludeDestinationRules)
	assert.False(t, criteria.IncludeServiceEntries)
	assert.False(t, criteria.AllNamespaces)
	assert.Equal(t, namespace, criteria.Namespace)

	objects = "notsupported"
	criteria = ParseIstioConfigCriteria(namespace, objects, labelSelector, "", false)

	assert.False(t, criteria.IncludeGateways)
	assert.False(t, criteria.IncludeVirtualServices)
	assert.False(t, criteria.IncludeDestinationRules)
	assert.False(t, criteria.IncludeServiceEntries)
	assert.False(t, criteria.AllNamespaces)
	assert.Equal(t, namespace, criteria.Namespace)
}

func TestGetIstioConfigList(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	criteria := IstioConfigCriteria{
		Namespace:               "test",
		IncludeGateways:         false,
		IncludeVirtualServices:  false,
		IncludeDestinationRules: false,
		IncludeServiceEntries:   false,
	}

	configService := mockGetIstioConfigList()

	istioconfigList, err := configService.GetIstioConfigList(context.TODO(), criteria)

	assert.Equal(0, len(istioconfigList.Gateways))
	assert.Equal(0, len(istioconfigList.VirtualServices))
	assert.Equal(0, len(istioconfigList.DestinationRules))
	assert.Equal(0, len(istioconfigList.ServiceEntries))
	assert.Nil(err)

	criteria.IncludeGateways = true

	istioconfigList, err = configService.GetIstioConfigList(context.TODO(), criteria)

	assert.Equal(2, len(istioconfigList.Gateways))
	assert.Equal(0, len(istioconfigList.VirtualServices))
	assert.Equal(0, len(istioconfigList.DestinationRules))
	assert.Equal(0, len(istioconfigList.ServiceEntries))
	assert.Nil(err)

	criteria.IncludeVirtualServices = true

	istioconfigList, err = configService.GetIstioConfigList(context.TODO(), criteria)

	assert.Equal(2, len(istioconfigList.Gateways))
	assert.Equal(2, len(istioconfigList.VirtualServices))
	assert.Equal(0, len(istioconfigList.DestinationRules))
	assert.Equal(0, len(istioconfigList.ServiceEntries))
	assert.Nil(err)

	criteria.IncludeDestinationRules = true

	istioconfigList, err = configService.GetIstioConfigList(context.TODO(), criteria)

	assert.Equal(2, len(istioconfigList.Gateways))
	assert.Equal(2, len(istioconfigList.VirtualServices))
	assert.Equal(2, len(istioconfigList.DestinationRules))
	assert.Equal(0, len(istioconfigList.ServiceEntries))
	assert.Nil(err)

	criteria.IncludeServiceEntries = true

	istioconfigList, err = configService.GetIstioConfigList(context.TODO(), criteria)

	assert.Equal(2, len(istioconfigList.Gateways))
	assert.Equal(2, len(istioconfigList.VirtualServices))
	assert.Equal(2, len(istioconfigList.DestinationRules))
	assert.Equal(1, len(istioconfigList.ServiceEntries))
	assert.Nil(err)
}

func TestGetIstioConfigDetails(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	configService := mockGetIstioConfigDetails()

	istioConfigDetails, err := configService.GetIstioConfigDetails(context.TODO(), "test", "gateways", "gw-1")
	assert.Equal("gw-1", istioConfigDetails.Gateway.Name)
	assert.True(istioConfigDetails.Permissions.Update)
	assert.False(istioConfigDetails.Permissions.Delete)
	assert.Nil(err)

	istioConfigDetails, err = configService.GetIstioConfigDetails(context.TODO(), "test", "virtualservices", "reviews")
	assert.Equal("reviews", istioConfigDetails.VirtualService.Name)
	assert.Equal("VirtualService", istioConfigDetails.VirtualService.Kind)
	assert.Equal("networking.istio.io/v1alpha3", istioConfigDetails.VirtualService.APIVersion)
	assert.Nil(err)

	istioConfigDetails, err = configService.GetIstioConfigDetails(context.TODO(), "test", "destinationrules", "reviews-dr")
	assert.Equal("reviews-dr", istioConfigDetails.DestinationRule.Name)
	assert.Equal("DestinationRule", istioConfigDetails.DestinationRule.Kind)
	assert.Equal("networking.istio.io/v1alpha3", istioConfigDetails.DestinationRule.APIVersion)
	assert.Nil(err)

	istioConfigDetails, err = configService.GetIstioConfigDetails(context.TODO(), "test", "serviceentries", "googleapis")
	assert.Equal("googleapis", istioConfigDetails.ServiceEntry.Name)
	assert.Equal("ServiceEntry", istioConfigDetails.ServiceEntry.Kind)
	assert.Equal("networking.istio.io/v1alpha3", istioConfigDetails.ServiceEntry.APIVersion)
	assert.Nil(err)

	istioConfigDetails, err = configService.GetIstioConfigDetails(context.TODO(), "test", "rules-bad", "stdio")
	assert.Error(err)
}

func mockGetIstioConfigList() IstioConfigService {
	k8s := new(kubetest.K8SClientMock)
	k8s.On("IsOpenShift").Return(true)
	k8s.On("GetProject", mock.AnythingOfType("string")).Return(&osproject_v1.Project{}, nil)

	fakeIstioObjects := []runtime.Object{}
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
	k8s.MockIstio(fakeIstioObjects...)
	return IstioConfigService{k8s: k8s, businessLayer: NewWithBackends(k8s, nil, nil)}
}

func fakeGetGateways() []networking_v1alpha3.Gateway {
	gw1 := data.CreateEmptyGateway("gw-1", "test", map[string]string{
		"app": "my-gateway1-controller",
	})
	gw1.Spec.Servers = []*api_networking_v1alpha3.Server{
		{
			Port: &api_networking_v1alpha3.Port{
				Number:   80,
				Name:     "http",
				Protocol: "HTTP",
			},
			Hosts: []string{
				"uk.bookinfo.com",
				"eu.bookinfo.com",
			},
			Tls: &api_networking_v1alpha3.ServerTLSSettings{
				HttpsRedirect: true,
			},
		},
	}

	gw2 := data.CreateEmptyGateway("gw-2", "test", map[string]string{
		"app": "my-gateway2-controller",
	})
	gw2.Spec.Servers = []*api_networking_v1alpha3.Server{
		{
			Port: &api_networking_v1alpha3.Port{
				Number:   80,
				Name:     "http",
				Protocol: "HTTP",
			},
			Hosts: []string{
				"uk.bookinfo.com",
				"eu.bookinfo.com",
			},
			Tls: &api_networking_v1alpha3.ServerTLSSettings{
				HttpsRedirect: true,
			},
		},
	}

	return []networking_v1alpha3.Gateway{*gw1, *gw2}
}

func fakeGetVirtualServices() []networking_v1alpha3.VirtualService {
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

	return []networking_v1alpha3.VirtualService{*virtualService1, *virtualService2}
}

func fakeGetDestinationRules() []networking_v1alpha3.DestinationRule {
	destinationRule1 := data.AddSubsetToDestinationRule(data.CreateSubset("v1", "v1"),
		data.AddSubsetToDestinationRule(data.CreateSubset("v2", "v2"),
			data.CreateEmptyDestinationRule("test", "reviews-dr", "reviews")))

	destinationRule1.Spec.TrafficPolicy = &api_networking_v1alpha3.TrafficPolicy{
		ConnectionPool: &api_networking_v1alpha3.ConnectionPoolSettings{
			Http: &api_networking_v1alpha3.ConnectionPoolSettings_HTTPSettings{
				MaxRequestsPerConnection: 100,
			},
		},
		OutlierDetection: &api_networking_v1alpha3.OutlierDetection{
			Consecutive_5XxErrors: &types.UInt32Value{
				Value: 50,
			},
		},
	}

	destinationRule2 := data.AddSubsetToDestinationRule(data.CreateSubset("v1", "v1"),
		data.AddSubsetToDestinationRule(data.CreateSubset("v2", "v2"),
			data.CreateEmptyDestinationRule("test", "details-dr", "details")))

	destinationRule2.Spec.TrafficPolicy = &api_networking_v1alpha3.TrafficPolicy{
		ConnectionPool: &api_networking_v1alpha3.ConnectionPoolSettings{
			Http: &api_networking_v1alpha3.ConnectionPoolSettings_HTTPSettings{
				MaxRequestsPerConnection: 100,
			},
		},
		OutlierDetection: &api_networking_v1alpha3.OutlierDetection{
			Consecutive_5XxErrors: &types.UInt32Value{
				Value: 50,
			},
		},
	}

	return []networking_v1alpha3.DestinationRule{*destinationRule1, *destinationRule2}
}

func fakeGetServiceEntries() []networking_v1alpha3.ServiceEntry {
	serviceEntry := networking_v1alpha3.ServiceEntry{}
	serviceEntry.Name = "googleapis"
	serviceEntry.Namespace = "test"
	serviceEntry.Spec.Hosts = []string{
		"*.googleapis.com",
	}
	serviceEntry.Spec.Ports = []*api_networking_v1alpha3.Port{
		{
			Number:   443,
			Name:     "https",
			Protocol: "HTTP",
		},
	}
	return []networking_v1alpha3.ServiceEntry{serviceEntry}
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

func mockGetIstioConfigDetails() IstioConfigService {
	k8s := new(kubetest.K8SClientMock)
	fakeIstioObjects := []runtime.Object{}
	fakeIstioObjects = append(fakeIstioObjects, &fakeGetGateways()[0])
	fakeIstioObjects = append(fakeIstioObjects, &fakeGetVirtualServices()[0])
	fakeIstioObjects = append(fakeIstioObjects, &fakeGetDestinationRules()[0])
	fakeIstioObjects = append(fakeIstioObjects, &fakeGetServiceEntries()[0])
	k8s.MockIstio(fakeIstioObjects...)

	k8s.On("IsOpenShift").Return(true)
	k8s.On("GetProject", mock.AnythingOfType("string")).Return(&osproject_v1.Project{}, nil)
	k8s.On("GetSelfSubjectAccessReview", mock.Anything, "test", mock.AnythingOfType("string"), mock.AnythingOfType("string"), mock.AnythingOfType("[]string")).Return(fakeGetSelfSubjectAccessReview(), nil)

	return IstioConfigService{k8s: k8s, businessLayer: NewWithBackends(k8s, nil, nil)}
}

func TestIsValidHost(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	vs := data.CreateEmptyVirtualService("reviews", "test", []string{"reviews"})
	vs = data.AddHttpRoutesToVirtualService(data.CreateHttpRouteDestination("reviews", "v2", 50), vs)
	vs = data.AddHttpRoutesToVirtualService(data.CreateHttpRouteDestination("reviews", "v3", 50), vs)

	assert.False(t, models.IsVSValidHost(vs, "test", ""))
	assert.False(t, models.IsVSValidHost(vs, "test", "ratings"))
	assert.True(t, models.IsVSValidHost(vs, "test", "reviews"))
}

func TestHasCircuitBreaker(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	dRule1 := data.CreateEmptyDestinationRule("test", "reviews", "reviews")
	dRule1.Spec.TrafficPolicy = &api_networking_v1alpha3.TrafficPolicy{
		ConnectionPool: &api_networking_v1alpha3.ConnectionPoolSettings{
			Http: &api_networking_v1alpha3.ConnectionPoolSettings_HTTPSettings{
				MaxRequestsPerConnection: 100,
			},
		},
		OutlierDetection: &api_networking_v1alpha3.OutlierDetection{
			Consecutive_5XxErrors: &types.UInt32Value{
				Value: 50,
			},
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
	dRule2.Spec.Subsets[1].TrafficPolicy = &api_networking_v1alpha3.TrafficPolicy{
		ConnectionPool: &api_networking_v1alpha3.ConnectionPoolSettings{
			Http: &api_networking_v1alpha3.ConnectionPoolSettings_HTTPSettings{
				MaxRequestsPerConnection: 100,
			},
		},
		OutlierDetection: &api_networking_v1alpha3.OutlierDetection{
			Consecutive_5XxErrors: &types.UInt32Value{
				Value: 50,
			},
		},
	}

	assert.True(t, models.HasDRCircuitBreaker(dRule2, "test", "reviews", ""))
	assert.False(t, models.HasDRCircuitBreaker(dRule2, "test", "reviews", "v1"))
	assert.True(t, models.HasDRCircuitBreaker(dRule2, "test", "reviews", "v2"))
	assert.False(t, models.HasDRCircuitBreaker(dRule2, "test", "reviews-bad", "v2"))
}

func TestDeleteIstioConfigDetails(t *testing.T) {
	assert := assert.New(t)
	configService := mockDeleteIstioConfigDetails()

	err := configService.DeleteIstioConfigDetail("test", "virtualservices", "reviews-to-delete")
	assert.Nil(err)
}

func mockDeleteIstioConfigDetails() IstioConfigService {
	k8s := new(kubetest.K8SClientMock)
	k8s.MockIstio(data.CreateEmptyVirtualService("reviews-to-delete", "test", []string{"reviews"}))
	return IstioConfigService{k8s: k8s}
}

func TestUpdateIstioConfigDetails(t *testing.T) {
	assert := assert.New(t)
	configService := mockUpdateIstioConfigDetails()

	updatedVirtualService, err := configService.UpdateIstioConfigDetail("test", "virtualservices", "reviews-to-update", "{}")
	assert.Equal("test", updatedVirtualService.Namespace.Name)
	assert.Equal("virtualservices", updatedVirtualService.ObjectType)
	assert.Equal("reviews-to-update", updatedVirtualService.VirtualService.Name)
	assert.Nil(err)
}

func mockUpdateIstioConfigDetails() IstioConfigService {
	k8s := new(kubetest.K8SClientMock)
	k8s.MockIstio(data.CreateEmptyVirtualService("reviews-to-update", "test", []string{"reviews"}))
	return IstioConfigService{k8s: k8s}
}

// mockCreateIstioConfigDetails to verify the behavior of API calls is the same for create and update
func mockCreateIstioConfigDetails() IstioConfigService {
	k8s := new(kubetest.K8SClientMock)
	k8s.MockIstio()
	return IstioConfigService{k8s: k8s}
}

func TestCreateIstioConfigDetails(t *testing.T) {
	assert := assert.New(t)
	configService := mockCreateIstioConfigDetails()

	createVirtualService, err := configService.CreateIstioConfigDetail("test", "virtualservices", []byte("{}"))
	assert.Equal("test", createVirtualService.Namespace.Name)
	assert.Equal("virtualservices", createVirtualService.ObjectType)
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
