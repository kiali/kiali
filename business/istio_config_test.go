package business

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	auth_v1 "k8s.io/api/authorization/v1"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tests/data"
)

func TestGetIstioConfig(t *testing.T) {
	assert := assert.New(t)
	criteria := IstioConfigCriteria{
		Namespace:               "test",
		IncludeGateways:         false,
		IncludeVirtualServices:  false,
		IncludeDestinationRules: false,
		IncludeServiceEntries:   false,
		IncludeRules:            false,
		IncludeQuotaSpecs:       false,
	}

	configService := mockGetIstioConfig()

	istioconfigList, err := configService.GetIstioConfig(criteria)

	assert.Equal(0, len(istioconfigList.Gateways))
	assert.Equal(0, len(istioconfigList.VirtualServices))
	assert.Equal(0, len(istioconfigList.DestinationRules))
	assert.Equal(0, len(istioconfigList.ServiceEntries))
	assert.Equal(0, len(istioconfigList.Rules))
	assert.Equal(0, len(istioconfigList.QuotaSpecs))
	assert.Equal(0, len(istioconfigList.QuotaSpecBindings))
	assert.Equal(models.ResourcePermissions{
		Create: false,
		Update: true,
		Delete: false,
	}, istioconfigList.Permissions["destinationrules"])
	assert.Nil(err)

	criteria.IncludeGateways = true

	istioconfigList, err = configService.GetIstioConfig(criteria)

	assert.Equal(2, len(istioconfigList.Gateways))
	assert.Equal(0, len(istioconfigList.VirtualServices))
	assert.Equal(0, len(istioconfigList.DestinationRules))
	assert.Equal(0, len(istioconfigList.ServiceEntries))
	assert.Equal(0, len(istioconfigList.Rules))
	assert.Equal(0, len(istioconfigList.QuotaSpecs))
	assert.Equal(0, len(istioconfigList.QuotaSpecBindings))
	assert.Nil(err)

	criteria.IncludeVirtualServices = true

	istioconfigList, err = configService.GetIstioConfig(criteria)

	assert.Equal(2, len(istioconfigList.Gateways))
	assert.Equal(2, len(istioconfigList.VirtualServices))
	assert.Equal(0, len(istioconfigList.DestinationRules))
	assert.Equal(0, len(istioconfigList.ServiceEntries))
	assert.Equal(0, len(istioconfigList.Rules))
	assert.Equal(0, len(istioconfigList.QuotaSpecs))
	assert.Equal(0, len(istioconfigList.QuotaSpecBindings))
	assert.Nil(err)

	criteria.IncludeDestinationRules = true

	istioconfigList, err = configService.GetIstioConfig(criteria)

	assert.Equal(2, len(istioconfigList.Gateways))
	assert.Equal(2, len(istioconfigList.VirtualServices))
	assert.Equal(2, len(istioconfigList.DestinationRules))
	assert.Equal(0, len(istioconfigList.ServiceEntries))
	assert.Equal(0, len(istioconfigList.Rules))
	assert.Equal(0, len(istioconfigList.QuotaSpecs))
	assert.Equal(0, len(istioconfigList.QuotaSpecBindings))
	assert.Nil(err)

	criteria.IncludeServiceEntries = true

	istioconfigList, err = configService.GetIstioConfig(criteria)

	assert.Equal(2, len(istioconfigList.Gateways))
	assert.Equal(2, len(istioconfigList.VirtualServices))
	assert.Equal(2, len(istioconfigList.DestinationRules))
	assert.Equal(1, len(istioconfigList.ServiceEntries))
	assert.Equal(0, len(istioconfigList.Rules))
	assert.Equal(0, len(istioconfigList.QuotaSpecs))
	assert.Equal(0, len(istioconfigList.QuotaSpecBindings))
	assert.Nil(err)

	criteria.IncludeRules = true

	istioconfigList, err = configService.GetIstioConfig(criteria)

	assert.Equal(2, len(istioconfigList.Gateways))
	assert.Equal(2, len(istioconfigList.VirtualServices))
	assert.Equal(2, len(istioconfigList.DestinationRules))
	assert.Equal(1, len(istioconfigList.ServiceEntries))
	assert.Equal(1, len(istioconfigList.Rules))
	assert.Equal(0, len(istioconfigList.QuotaSpecs))
	assert.Equal(0, len(istioconfigList.QuotaSpecBindings))
	assert.Nil(err)

	criteria.IncludeQuotaSpecs = true

	istioconfigList, err = configService.GetIstioConfig(criteria)

	assert.Equal(2, len(istioconfigList.Gateways))
	assert.Equal(2, len(istioconfigList.VirtualServices))
	assert.Equal(2, len(istioconfigList.DestinationRules))
	assert.Equal(1, len(istioconfigList.ServiceEntries))
	assert.Equal(1, len(istioconfigList.Rules))
	assert.Equal(1, len(istioconfigList.QuotaSpecs))
	assert.Equal(0, len(istioconfigList.QuotaSpecBindings))
	assert.Nil(err)

	criteria.IncludeQuotaSpecBindings = true

	istioconfigList, err = configService.GetIstioConfig(criteria)

	assert.Equal(2, len(istioconfigList.Gateways))
	assert.Equal(2, len(istioconfigList.VirtualServices))
	assert.Equal(2, len(istioconfigList.DestinationRules))
	assert.Equal(1, len(istioconfigList.ServiceEntries))
	assert.Equal(1, len(istioconfigList.Rules))
	assert.Equal(1, len(istioconfigList.QuotaSpecs))
	assert.Equal(1, len(istioconfigList.QuotaSpecBindings))
	assert.Nil(err)
}

func TestGetIstioConfigDetails(t *testing.T) {
	assert := assert.New(t)

	configService := mockGetIstioConfigDetails()

	istioConfigDetails, err := configService.GetIstioConfigDetails("test", "gateways", "gw-1")
	assert.Equal("gw-1", istioConfigDetails.Gateway.Name)
	assert.Equal(models.ResourcePermissions{
		Create: false,
		Update: true,
		Delete: false,
	}, istioConfigDetails.Permissions)
	assert.Nil(err)

	istioConfigDetails, err = configService.GetIstioConfigDetails("test", "virtualservices", "reviews")
	assert.Equal("reviews", istioConfigDetails.VirtualService.Name)
	assert.Nil(err)

	istioConfigDetails, err = configService.GetIstioConfigDetails("test", "destinationrules", "reviews-dr")
	assert.Equal("reviews-dr", istioConfigDetails.DestinationRule.Name)
	assert.Nil(err)

	istioConfigDetails, err = configService.GetIstioConfigDetails("test", "rules", "checkfromcustomer")
	assert.Equal("checkfromcustomer", istioConfigDetails.Rule.Name)
	assert.Nil(err)

	istioConfigDetails, err = configService.GetIstioConfigDetails("test", "serviceentries", "googleapis")
	assert.Equal("googleapis", istioConfigDetails.ServiceEntry.Name)
	assert.Nil(err)

	istioConfigDetails, err = configService.GetIstioConfigDetails("test", "rules-bad", "stdio")
	assert.Error(err)
}

func mockGetIstioConfig() IstioConfigService {
	k8s := new(kubetest.K8SClientMock)
	k8s.On("GetGateways", mock.AnythingOfType("string")).Return(fakeGetGateways(), nil)
	k8s.On("GetVirtualServices", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return(fakeGetVirtualServices(), nil)
	k8s.On("GetDestinationRules", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return(fakeGetDestinationRules(), nil)
	k8s.On("GetServiceEntries", mock.AnythingOfType("string")).Return(fakeGetServiceEntries(), nil)
	k8s.On("GetIstioRules", mock.AnythingOfType("string")).Return(fakeGetIstioRules(), nil)
	k8s.On("GetQuotaSpecs", mock.AnythingOfType("string")).Return(fakeGetQuotaSpecs(), nil)
	k8s.On("GetQuotaSpecBindings", mock.AnythingOfType("string")).Return(fakeGetQuotaSpecBindings(), nil)
	k8s.On("GetSelfSubjectAccessReview", "test", mock.AnythingOfType("[]string"), mock.AnythingOfType("map[string]string")).Return(fakeGetSelfSubjectAccessReview(), nil)

	return IstioConfigService{k8s: k8s}
}

func fakeGetGateways() []kubernetes.IstioObject {
	gw1 := data.CreateEmptyGateway("gw-1", map[string]string{
		"app": "my-gateway1-controller",
	})

	gw1.GetSpec()["servers"] = []interface{}{
		map[string]interface{}{
			"port": map[string]interface{}{
				"number":   80,
				"name":     "http",
				"protocol": "HTTP",
			},
			"hosts": []interface{}{
				"uk.bookinfo.com",
				"eu.bookinfo.com",
			},
			"tls": map[string]interface{}{
				"httpsRedirect": "true",
			},
		},
	}

	gw2 := data.CreateEmptyGateway("gw-2", map[string]string{
		"app": "my-gateway2-controller",
	})

	gw2.GetSpec()["servers"] = []interface{}{
		map[string]interface{}{
			"port": map[string]interface{}{
				"number":   80,
				"name":     "http",
				"protocol": "HTTP",
			},
			"hosts": []interface{}{
				"uk.bookinfo.com",
				"eu.bookinfo.com",
			},
			"tls": map[string]interface{}{
				"httpsRedirect": "true",
			},
		},
	}

	return []kubernetes.IstioObject{gw1, gw2}
}

func fakeGetVirtualServices() []kubernetes.IstioObject {
	virtualService1 := data.AddRoutesToVirtualService("http", data.CreateRoute("reviews", "v2", 50),
		data.AddRoutesToVirtualService("http", data.CreateRoute("reviews", "v3", 50),
			data.CreateEmptyVirtualService("reviews", "test", []string{"reviews"}),
		),
	)

	virtualService2 := data.AddRoutesToVirtualService("http", data.CreateRoute("details", "v2", 50),
		data.AddRoutesToVirtualService("http", data.CreateRoute("details", "v3", 50),
			data.CreateEmptyVirtualService("details", "test", []string{"details"}),
		),
	)

	return []kubernetes.IstioObject{virtualService1, virtualService2}
}

func fakeGetDestinationRules() []kubernetes.IstioObject {

	destinationRule1 := data.AddSubsetToDestinationRule(data.CreateSubset("v1", "v1"),
		data.AddSubsetToDestinationRule(data.CreateSubset("v2", "v2"),
			data.CreateEmptyDestinationRule("test", "reviews-dr", "reviews")))

	destinationRule1.GetSpec()["trafficPolicy"] = map[string]interface{}{
		"connectionPool": map[string]interface{}{
			"http": map[string]interface{}{
				"maxRequestsPerConnection": 100,
			},
		},
		"outlierDetection": map[string]interface{}{
			"http": map[string]interface{}{
				"consecutiveErrors": 50,
			},
		},
	}

	destinationRule2 := data.AddSubsetToDestinationRule(data.CreateSubset("v1", "v1"),
		data.AddSubsetToDestinationRule(data.CreateSubset("v2", "v2"),
			data.CreateEmptyDestinationRule("test", "details-dr", "details")))

	destinationRule2.GetSpec()["trafficPolicy"] = map[string]interface{}{
		"connectionPool": map[string]interface{}{
			"http": map[string]interface{}{
				"maxRequestsPerConnection": 100,
			},
		},
		"outlierDetection": map[string]interface{}{
			"http": map[string]interface{}{
				"consecutiveErrors": 50,
			},
		},
	}

	return []kubernetes.IstioObject{destinationRule1, destinationRule2}
}

func fakeGetServiceEntries() []kubernetes.IstioObject {
	serviceEntry := kubernetes.MockIstioObject{
		ObjectMeta: meta_v1.ObjectMeta{
			Name: "googleapis",
		},
		Spec: map[string]interface{}{
			"hosts": []interface{}{
				"*.googleapis.com",
			},
			"ports": []interface{}{
				map[string]interface{}{
					"number":   443,
					"name":     "https",
					"protocol": "http",
				},
			},
		},
	}
	return []kubernetes.IstioObject{&serviceEntry}
}

func fakeGetIstioRules() *kubernetes.IstioRules {
	stdioRule := kubernetes.MockIstioObject{}
	stdioRule.Name = "stdio"
	stdioRule.Spec = map[string]interface{}{
		"match": "true",
		"actions": []map[string]interface{}{
			{
				"handler": "handler.stdio",
				"instances": []string{
					"accesslog.logentry",
				},
			},
		},
	}
	return &kubernetes.IstioRules{
		Rules: []kubernetes.IstioObject{&stdioRule},
	}
}

func fakeCheckFromCustomerRule() kubernetes.IstioObject {
	checkfromcustomerRule := kubernetes.MockIstioObject{}
	checkfromcustomerRule.Name = "checkfromcustomer"
	checkfromcustomerRule.Spec = map[string]interface{}{
		"match": "destination.labels[\"app\"] == \"preference\"",
		"actions": []map[string]interface{}{
			{
				"handler": "preferencewhitelist.listchecker",
				"instances": []string{
					"preferencesource.listentry",
				},
			},
		},
	}
	return &checkfromcustomerRule
}

func fakeCheckFromCustomerActions() []*kubernetes.IstioRuleAction {
	actions := make([]*kubernetes.IstioRuleAction, 0)
	handler := kubernetes.MockIstioObject{}
	handler.Name = "preferencewhitelist"
	handler.Spec = map[string]interface{}{
		"overrides": []string{
			"recommendation",
		},
		"blacklist": false,
		"adapter":   "listchecker",
	}
	instance := kubernetes.MockIstioObject{}
	instance.Name = "preferencesource"
	instance.Spec = map[string]interface{}{
		"value":    "source.labels[\"app\"]",
		"template": "listentry",
	}

	actions = append(actions, &kubernetes.IstioRuleAction{
		Handler:   &handler,
		Instances: []kubernetes.IstioObject{&instance},
	})
	return actions
}

func fakeGetIstioRuleDetails() *kubernetes.IstioRuleDetails {
	istioRulesDetails := kubernetes.IstioRuleDetails{}
	istioRulesDetails.Rule = fakeCheckFromCustomerRule()
	istioRulesDetails.Actions = fakeCheckFromCustomerActions()
	return &istioRulesDetails
}

func fakeGetQuotaSpecs() []kubernetes.IstioObject {
	quotaSpec := kubernetes.MockIstioObject{}
	quotaSpec.Name = "request-count"
	quotaSpec.Spec = map[string]interface{}{
		"rules": []interface{}{
			map[string]interface{}{
				"quotas": []interface{}{
					map[string]interface{}{
						"charge": 1,
						"quota":  "RequestCount",
					},
				},
			},
		},
	}
	return []kubernetes.IstioObject{&quotaSpec}
}

func fakeGetQuotaSpecBindings() []kubernetes.IstioObject {
	quotaSpec := kubernetes.MockIstioObject{}
	quotaSpec.Name = "request-count"
	quotaSpec.Spec = map[string]interface{}{
		"quotaSpecs": []interface{}{
			map[string]interface{}{
				"name":      "request-count",
				"namespace": "istio-system",
			},
		},
		"services": []interface{}{
			map[string]interface{}{
				"name": "ratings",
			},
			map[string]interface{}{
				"name": "reviews",
			},
			map[string]interface{}{
				"name": "details",
			},
			map[string]interface{}{
				"name": "productpage",
			},
		},
	}
	return []kubernetes.IstioObject{&quotaSpec}
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
			Allowed: false,
			Reason:  "not authorized",
		},
	}
	update := auth_v1.SelfSubjectAccessReview{
		Spec: auth_v1.SelfSubjectAccessReviewSpec{
			ResourceAttributes: &auth_v1.ResourceAttributes{
				Namespace: "test",
				Verb:      "update",
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
	k8s.On("GetGateway", "test", "gw-1").Return(fakeGetGateways()[0], nil)
	k8s.On("GetVirtualService", "test", "reviews").Return(fakeGetVirtualServices()[0], nil)
	k8s.On("GetDestinationRule", "test", "reviews-dr").Return(fakeGetDestinationRules()[0], nil)
	k8s.On("GetServiceEntry", "test", "googleapis").Return(fakeGetServiceEntries()[0], nil)
	k8s.On("GetIstioRuleDetails", "test", "checkfromcustomer").Return(fakeGetIstioRuleDetails(), nil)
	k8s.On("GetQuotaSpec", "test", "request-count").Return(fakeGetQuotaSpecs()[0], nil)
	k8s.On("GetQuotaSpecBinding", "test", "request-count").Return(fakeGetQuotaSpecBindings()[0], nil)
	k8s.On("GetSelfSubjectAccessReview", "test", mock.AnythingOfType("[]string"), mock.AnythingOfType("map[string]string")).Return(fakeGetSelfSubjectAccessReview(), nil)

	return IstioConfigService{k8s: k8s}
}
