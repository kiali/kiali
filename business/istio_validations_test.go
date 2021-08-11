package business

import (
	"fmt"
	"testing"

	osapps_v1 "github.com/openshift/api/apps/v1"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	apps_v1 "k8s.io/api/apps/v1"
	batch_v1 "k8s.io/api/batch/v1"
	batch_v1beta1 "k8s.io/api/batch/v1beta1"
	core_v1 "k8s.io/api/core/v1"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tests/data"
	"github.com/kiali/kiali/tests/testutils/validations"
)

func TestGetNamespaceValidations(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	vs := mockCombinedValidationService(fakeCombinedIstioDetails(),
		[]string{"details", "product", "customer"}, fakePods())

	validations, _ := vs.GetValidations("test", "")
	assert.NotEmpty(validations)
	assert.True(validations[models.IstioValidationKey{ObjectType: "virtualservice", Namespace: "test", Name: "product-vs"}].Valid)
}

func TestGetIstioObjectValidations(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	vs := mockCombinedValidationService(fakeCombinedIstioDetails(), []string{"details", "product", "customer"}, fakePods())

	validations, _ := vs.GetIstioObjectValidations("test", "virtualservices", "product-vs")

	assert.NotEmpty(validations)
}

func TestGatewayValidation(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	v := mockMultiNamespaceGatewaysValidationService()
	validations, _ := v.GetIstioObjectValidations("test", "gateways", "second")
	assert.NotEmpty(validations)
}

func TestFilterExportToNamespacesVS(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	var currentIstioObjects []kubernetes.IstioObject
	vs1to3 := loadIstioObject("vs_bookinfo1_to_2_3.yaml", "VirtualService", t)
	currentIstioObjects = append(currentIstioObjects, vs1to3)
	vs1tothis := loadIstioObject("vs_bookinfo1_to_this.yaml", "VirtualService", t)
	currentIstioObjects = append(currentIstioObjects, vs1tothis)
	vs2to1 := loadIstioObject("vs_bookinfo2_to_1.yaml", "VirtualService", t)
	currentIstioObjects = append(currentIstioObjects, vs2to1)
	vs2tothis := loadIstioObject("vs_bookinfo2_to_this.yaml", "VirtualService", t)
	currentIstioObjects = append(currentIstioObjects, vs2tothis)
	vs3to2 := loadIstioObject("vs_bookinfo3_to_2.yaml", "VirtualService", t)
	currentIstioObjects = append(currentIstioObjects, vs3to2)
	vs3toall := loadIstioObject("vs_bookinfo3_to_all.yaml", "VirtualService", t)
	currentIstioObjects = append(currentIstioObjects, vs3toall)
	v := mockEmptyValidationService()
	filteredVSs := v.filterExportToNamespacesIstioObjects("bookinfo", &currentIstioObjects)
	var expectedVS []kubernetes.IstioObject
	expectedVS = append(expectedVS, vs2to1)
	expectedVS = append(expectedVS, vs3toall)
	assert.EqualValues(filteredVSs, &expectedVS)
}

func mockWorkLoadService(k8s *kubetest.K8SClientMock) WorkloadService {
	// Setup mocks
	k8s.On("IsOpenShift").Return(true)
	k8s.On("GetDeployments", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return(FakeDepSyncedWithRS(), nil)
	k8s.On("GetDeploymentConfigs", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return([]osapps_v1.DeploymentConfig{}, nil)
	k8s.On("GetReplicaSets", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return(FakeRSSyncedWithPods(), nil)
	k8s.On("GetReplicationControllers", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return([]core_v1.ReplicationController{}, nil)
	k8s.On("GetStatefulSets", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return([]apps_v1.StatefulSet{}, nil)
	k8s.On("GetDaemonSets", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return([]apps_v1.DaemonSet{}, nil)
	k8s.On("GetJobs", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return([]batch_v1.Job{}, nil)
	k8s.On("GetCronJobs", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return([]batch_v1beta1.CronJob{}, nil)
	k8s.On("GetPods", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return(fakePods().Items, nil)
	k8s.On("GetConfigMap", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return(&core_v1.ConfigMap{}, nil)

	svc := setupWorkloadService(k8s)
	return svc
}

func mockMultiNamespaceGatewaysValidationService() IstioValidationsService {
	k8s := new(kubetest.K8SClientMock)
	k8s.On("IsOpenShift").Return(false)
	k8s.On("GetNamespace", mock.AnythingOfType("string")).Return(&core_v1.Namespace{}, nil)
	k8s.On("IsMaistraApi").Return(false)
	k8s.On("GetIstioObjects", "test", "gateways", "").Return(getGateway("first"), nil)
	k8s.On("GetIstioObjects", "test2", "gateways", "").Return(getGateway("second"), nil)
	k8s.On("GetNamespaces", mock.AnythingOfType("string")).Return(fakeNamespaces(), nil)
	mockWorkLoadService(k8s)
	k8s.On("GetIstioObjects", mock.AnythingOfType("string"), "destinationrules", "").Return(fakeCombinedIstioDetails().DestinationRules, nil)
	k8s.On("GetIstioObjects", mock.AnythingOfType("string"), "sidecars", "").Return(fakeCombinedIstioDetails().Sidecars, nil)
	k8s.On("GetServices", mock.AnythingOfType("string"), mock.AnythingOfType("map[string]string")).Return(fakeCombinedServices([]string{""}), nil)
	k8s.On("GetDeployments", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return(FakeDepSyncedWithRS(), nil)
	k8s.On("GetMeshPolicies", mock.AnythingOfType("string")).Return(fakeMeshPolicies(), nil)
	k8s.On("GetIstioObjects", mock.AnythingOfType("string"), "peerauthentications", "").Return(fakePolicies(), nil)
	k8s.On("GetIstioObjects", mock.AnythingOfType("string"), "requestauthentications", "").Return([]kubernetes.IstioObject{}, nil)
	k8s.On("GetIstioObjects", mock.AnythingOfType("string"), "clusterrbacconfigs", "").Return([]kubernetes.IstioObject{}, nil)
	k8s.On("GetIstioObjects", mock.AnythingOfType("string"), "authorizationpolicies", "").Return([]kubernetes.IstioObject{}, nil)
	k8s.On("GetIstioObjects", mock.AnythingOfType("string"), "servicerolebindings", "").Return([]kubernetes.IstioObject{}, nil)
	k8s.On("GetIstioObjects", mock.AnythingOfType("string"), "serviceroles", "").Return([]kubernetes.IstioObject{}, nil)
	k8s.On("GetIstioObjects", mock.AnythingOfType("string"), "virtualservices", "").Return(fakeCombinedIstioDetails().VirtualServices, nil)
	k8s.On("GetIstioObjects", mock.AnythingOfType("string"), "serviceentries", "").Return(fakeCombinedIstioDetails().ServiceEntries, nil)

	return IstioValidationsService{k8s: k8s, businessLayer: NewWithBackends(k8s, nil, nil)}
}

func mockCombinedValidationService(istioObjects *kubernetes.IstioDetails, services []string, podList *core_v1.PodList) IstioValidationsService {
	k8s := new(kubetest.K8SClientMock)
	k8s.On("GetIstioObjects", mock.AnythingOfType("string"), "sidecars", "").Return(istioObjects.Sidecars, nil)
	k8s.On("GetIstioObjects", mock.AnythingOfType("string"), "requestauthentications", "").Return(istioObjects.RequestAuthentications, nil)
	k8s.On("GetServices", mock.AnythingOfType("string"), mock.AnythingOfType("map[string]string")).Return(fakeCombinedServices(services), nil)
	k8s.On("GetDeployments", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return(FakeDepSyncedWithRS(), nil)
	k8s.On("GetIstioObjects", mock.AnythingOfType("string"), "virtualservices", "").Return(fakeCombinedIstioDetails().VirtualServices, nil)
	k8s.On("GetIstioObjects", mock.AnythingOfType("string"), "destinationrules", "").Return(fakeCombinedIstioDetails().DestinationRules, nil)
	k8s.On("GetIstioObjects", mock.AnythingOfType("string"), "authorizationpolicies", "").Return([]kubernetes.IstioObject{}, nil)
	k8s.On("GetIstioObjects", mock.AnythingOfType("string"), "clusterrbacconfigs", "").Return([]kubernetes.IstioObject{}, nil)
	k8s.On("GetIstioObjects", mock.AnythingOfType("string"), "servicerolebindings", "").Return([]kubernetes.IstioObject{}, nil)
	k8s.On("GetIstioObjects", mock.AnythingOfType("string"), "serviceroles", "").Return([]kubernetes.IstioObject{}, nil)
	k8s.On("GetIstioObjects", mock.AnythingOfType("string"), "serviceentries", "").Return(fakeCombinedIstioDetails().ServiceEntries, nil)
	k8s.On("GetIstioObjects", mock.AnythingOfType("string"), "gateways", "").Return(fakeCombinedIstioDetails().Gateways, nil)
	k8s.On("GetNamespace", mock.AnythingOfType("string")).Return(kubetest.FakeNamespace("test"), nil)
	k8s.On("GetIstioObjects", "istio-system", "peerauthentications", "").Return(fakeMeshPolicies(), nil)
	k8s.On("GetIstioObjects", mock.AnythingOfType("string"), "peerauthentications", "").Return(fakePolicies(), nil)
	k8s.On("IsOpenShift").Return(false)
	k8s.On("IsMaistraApi").Return(false)
	k8s.On("GetIstioObjects", "test", "gateways", "").Return(getGateway("first"), nil)
	k8s.On("GetIstioObjects", "test2", "gateways", "").Return(getGateway("second"), nil)
	k8s.On("GetIstioObjects", mock.AnythingOfType("string"), "gateways", "").Return(fakeCombinedIstioDetails().Gateways, nil)
	k8s.On("GetNamespaces", mock.AnythingOfType("string")).Return(fakeNamespaces(), nil)

	mockWorkLoadService(k8s)

	return IstioValidationsService{k8s: k8s, businessLayer: NewWithBackends(k8s, nil, nil)}
}

func mockEmptyValidationService() IstioValidationsService {
	k8s := new(kubetest.K8SClientMock)
	k8s.On("IsOpenShift").Return(false)
	k8s.On("IsMaistraApi").Return(false)
	return IstioValidationsService{k8s: k8s, businessLayer: NewWithBackends(k8s, nil, nil)}
}

func fakeCombinedIstioDetails() *kubernetes.IstioDetails {
	istioDetails := kubernetes.IstioDetails{}

	istioDetails.VirtualServices = []kubernetes.IstioObject{
		data.AddRoutesToVirtualService("http", data.CreateRoute("product", "v1", -1),
			data.AddRoutesToVirtualService("tcp", data.CreateRoute("product", "v1", -1),
				data.CreateEmptyVirtualService("product-vs", "test", []string{"product"})))}

	istioDetails.DestinationRules = []kubernetes.IstioObject{
		data.AddSubsetToDestinationRule(data.CreateSubset("v1", "v1"), data.CreateEmptyDestinationRule("test", "product-dr", "product")),
		data.CreateEmptyDestinationRule("test", "customer-dr", "customer"),
	}
	return &istioDetails
}

func fakeMeshPolicies() []kubernetes.IstioObject {
	return []kubernetes.IstioObject{
		data.CreateEmptyMeshPeerAuthentication("default", nil),
		data.CreateEmptyMeshPeerAuthentication("test", nil),
	}
}

func fakePolicies() []kubernetes.IstioObject {
	return []kubernetes.IstioObject{
		data.CreateEmptyPeerAuthentication("default", "bookinfo", nil),
		data.CreateEmptyPeerAuthentication("test", "foo", nil),
	}
}

func fakeNamespaces() []core_v1.Namespace {
	return []core_v1.Namespace{
		{
			ObjectMeta: meta_v1.ObjectMeta{
				Name: "test",
			},
		},
		{
			ObjectMeta: meta_v1.ObjectMeta{
				Name: "test2",
			},
		},
	}
}

func fakeCombinedServices(services []string) []core_v1.Service {
	items := []core_v1.Service{}

	for _, service := range services {
		items = append(items, core_v1.Service{
			ObjectMeta: meta_v1.ObjectMeta{
				Name: service,
				Labels: map[string]string{
					"app":     service,
					"version": "v1",
				},
			},
		})
	}
	return items
}

func fakePods() *core_v1.PodList {
	return &core_v1.PodList{
		Items: []core_v1.Pod{
			{
				ObjectMeta: meta_v1.ObjectMeta{
					Name: "reviews-12345-hello",
					Labels: map[string]string{
						"app":     "reviews",
						"version": "v2",
					},
				},
			},
			{
				ObjectMeta: meta_v1.ObjectMeta{
					Name: "reviews-54321-hello",
					Labels: map[string]string{
						"app":     "reviews",
						"version": "v1",
					},
				},
			},
		},
	}
}

func getGateway(name string) []kubernetes.IstioObject {
	return []kubernetes.IstioObject{data.AddServerToGateway(data.CreateServer([]string{"valid"}, 80, "http", "http"),
		data.CreateEmptyGateway(name, "test", map[string]string{
			"app": "real",
		}))}
}

func loadIstioObject(file string, objectType string, t *testing.T) kubernetes.IstioObject {
	loader := yamlFixtureLoaderFor(file)
	err := loader.Load()
	if err != nil {
		t.Error("Error loading test data.")
	}
	return loader.GetFirstResource(objectType)
}

func yamlFixtureLoaderFor(file string) *validations.YamlFixtureLoader {
	path := fmt.Sprintf("../tests/data/validations/exportto/cns/%s", file)
	return &validations.YamlFixtureLoader{Filename: path}
}
