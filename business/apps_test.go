package business

import (
	"context"
	"testing"

	osproject_v1 "github.com/openshift/api/project/v1"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	core_v1 "k8s.io/api/core/v1"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/cache"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/prometheus/prometheustest"
)

func setupAppService(k8s *kubetest.FakeK8sClient) *AppService {
	prom := new(prometheustest.PromClientMock)
	clients := make(map[string]kubernetes.ClientInterface)
	clients[kubernetes.HomeClusterName] = k8s
	layer := NewWithBackends(clients, prom, nil)
	setupGlobalMeshConfig()
	return &AppService{k8s: clients, prom: prom, businessLayer: layer}
}

func setupTestingKialiCache(k8s *kubetest.FakeK8sClient, conf *config.Config, require *require.Assertions) func() {
	if conf == nil {
		conf = config.NewConfig()
		config.Set(conf)
	}

	clientFactory := kubetest.NewK8SClientFactoryMock(nil)
	clientFactory.SetClients(map[string]kubernetes.ClientInterface{
		kubernetes.HomeClusterName: k8s,
	})

	kialiCache, _ = cache.NewKialiCache(clientFactory, *conf)
	require.NotNil(kialiCache)

	kialiCache.CheckNamespace("Namespace")
	kialiCache.SetRegistryStatus(&kubernetes.RegistryStatus{})

	return func() {
		kialiCache.Stop()
		kialiCache = nil
	}
}

func TestGetAppListFromDeployments(t *testing.T) {
	assert := assert.New(t)
	require := require.New(t)

	t.Setenv("KUBERNETES_SERVICE_HOST", "127.0.0.2")
	t.Setenv("KUBERNETES_SERVICE_PORT", "9443")

	// Auxiliar fake* tests defined in workload_test.go
	objects := []runtime.Object{
		&core_v1.Namespace{ObjectMeta: v1.ObjectMeta{Name: "Namespace"}},
		&osproject_v1.Project{ObjectMeta: v1.ObjectMeta{Name: "Namespace"}},
	}
	for _, obj := range FakeDeployments() {
		o := obj
		objects = append(objects, &o)
	}

	// Setup mocks
	k8s := kubetest.NewFakeK8sClient(objects...)
	k8s.OpenShift = true
	k8s.Token = "token" // Not needed a result, just to not send an error to test this usecase

	stopCache := setupTestingKialiCache(k8s, nil, require)
	defer stopCache()

	svc := setupAppService(k8s)

	criteria := AppCriteria{Namespace: "Namespace", IncludeIstioResources: false, IncludeHealth: false}
	appList, err := svc.GetAppList(context.TODO(), criteria)
	require.NoError(err)

	assert.Equal("Namespace", appList.Namespace.Name)

	assert.Equal(1, len(appList.Apps))
	assert.Equal("httpbin", appList.Apps[0].Name)
}

func TestGetAppFromDeployments(t *testing.T) {
	require := require.New(t)
	assert := assert.New(t)

	t.Setenv("KUBERNETES_SERVICE_HOST", "127.0.0.2")
	t.Setenv("KUBERNETES_SERVICE_PORT", "9443")

	conf := config.NewConfig()
	conf.ExternalServices.CustomDashboards.Enabled = false
	config.Set(conf)

	// Setup mocks
	objects := []runtime.Object{
		&osproject_v1.Project{ObjectMeta: v1.ObjectMeta{Name: "Namespace"}},
	}
	for _, obj := range FakeDeployments() {
		o := obj
		objects = append(objects, &o)
	}
	for _, obj := range FakeServices() {
		o := obj
		objects = append(objects, &o)
	}

	k8s := kubetest.NewFakeK8sClient(objects...)
	k8s.OpenShift = true

	stopCache := setupTestingKialiCache(k8s, conf, require)
	defer stopCache()

	svc := setupAppService(k8s)

	criteria := AppCriteria{Namespace: "Namespace", AppName: "httpbin"}
	appDetails, appDetailsErr := svc.GetAppDetails(context.TODO(), criteria)
	assert.NoError(appDetailsErr)

	assert.Equal("Namespace", appDetails.Namespace.Name)
	assert.Equal("httpbin", appDetails.Name)

	assert.Equal(2, len(appDetails.Workloads))
	assert.Equal("httpbin-v1", appDetails.Workloads[0].WorkloadName)
	assert.Equal("httpbin-v2", appDetails.Workloads[1].WorkloadName)
	assert.Equal(1, len(appDetails.ServiceNames))
	assert.Equal("httpbin", appDetails.ServiceNames[0])
}

func TestGetAppListFromReplicaSets(t *testing.T) {
	require := require.New(t)
	assert := assert.New(t)

	t.Setenv("KUBERNETES_SERVICE_HOST", "127.0.0.2")
	t.Setenv("KUBERNETES_SERVICE_PORT", "9443")

	// Setup mocks
	// Auxiliar fake* tests defined in workload_test.go
	objects := []runtime.Object{
		&osproject_v1.Project{ObjectMeta: v1.ObjectMeta{Name: "Namespace"}},
	}
	for _, obj := range FakeReplicaSets() {
		o := obj
		objects = append(objects, &o)
	}

	k8s := kubetest.NewFakeK8sClient(objects...)
	k8s.OpenShift = true

	stopCache := setupTestingKialiCache(k8s, nil, require)
	defer stopCache()

	svc := setupAppService(k8s)

	criteria := AppCriteria{Namespace: "Namespace", IncludeIstioResources: false, IncludeHealth: false}
	appList, _ := svc.GetAppList(context.TODO(), criteria)

	assert.Equal("Namespace", appList.Namespace.Name)

	assert.Equal(1, len(appList.Apps))
	assert.Equal("httpbin", appList.Apps[0].Name)
}

func TestGetAppFromReplicaSets(t *testing.T) {
	require := require.New(t)
	assert := assert.New(t)

	t.Setenv("KUBERNETES_SERVICE_HOST", "127.0.0.2")
	t.Setenv("KUBERNETES_SERVICE_PORT", "9443")

	// Setup mocks
	objects := []runtime.Object{
		&osproject_v1.Project{ObjectMeta: v1.ObjectMeta{Name: "Namespace"}},
	}
	for _, obj := range FakeReplicaSets() {
		o := obj
		objects = append(objects, &o)
	}
	for _, obj := range FakeServices() {
		o := obj
		objects = append(objects, &o)
	}

	k8s := kubetest.NewFakeK8sClient(objects...)
	k8s.OpenShift = true

	stopCache := setupTestingKialiCache(k8s, nil, require)
	defer stopCache()

	svc := setupAppService(k8s)

	criteria := AppCriteria{Namespace: "Namespace", AppName: "httpbin"}
	appDetails, _ := svc.GetAppDetails(context.TODO(), criteria)

	assert.Equal("Namespace", appDetails.Namespace.Name)
	assert.Equal("httpbin", appDetails.Name)

	assert.Equal(2, len(appDetails.Workloads))
	assert.Equal("httpbin-v1", appDetails.Workloads[0].WorkloadName)
	assert.Equal("httpbin-v2", appDetails.Workloads[1].WorkloadName)
	assert.Equal(1, len(appDetails.ServiceNames))
	assert.Equal("httpbin", appDetails.ServiceNames[0])
}

func TestJoinMap(t *testing.T) {
	assert := assert.New(t)
	tempLabels := map[string][]string{}
	labelsA := map[string]string{
		"key1": "val1",
		"key2": "val2",
	}

	t.Setenv("KUBERNETES_SERVICE_HOST", "127.0.0.2")
	t.Setenv("KUBERNETES_SERVICE_PORT", "9443")

	joinMap(tempLabels, labelsA)
	assert.Len(tempLabels, 2)
	assert.Equal([]string{"val1"}, tempLabels["key1"])
	assert.Equal([]string{"val2"}, tempLabels["key2"])

	// Test with an added value on key1
	labelsB := map[string]string{
		"key1": "val3",
		"key3": "val4",
	}
	joinMap(tempLabels, labelsB)
	assert.Len(tempLabels, 3)
	assert.Equal([]string{"val1", "val3"}, tempLabels["key1"])
	assert.Equal([]string{"val2"}, tempLabels["key2"])
	assert.Equal([]string{"val4"}, tempLabels["key3"])

	// Test with duplicates; val3 is duplicated, al4 is not (is substring)
	// al4 must also appear before val4 on final labels (sorted)
	labelsC := map[string]string{
		"key1": "val3",
		"key3": "al4",
	}
	joinMap(tempLabels, labelsC)
	assert.Len(tempLabels, 3)
	assert.Equal([]string{"val1", "val3"}, tempLabels["key1"])
	assert.Equal([]string{"val2"}, tempLabels["key2"])
	assert.Equal([]string{"val4", "al4"}, tempLabels["key3"])

	labels := buildFinalLabels(tempLabels)
	assert.Len(labels, 3)
	assert.Equal("val1,val3", labels["key1"])
	assert.Equal("val2", labels["key2"])
	assert.Equal("al4,val4", labels["key3"])
}
