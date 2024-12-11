package business

import (
	"context"
	"strings"
	"testing"

	osproject_v1 "github.com/openshift/api/project/v1"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/prometheus/prometheustest"
)

func setupAppService(clients map[string]kubernetes.ClientInterface) *AppService {
	prom := new(prometheustest.PromClientMock)
	layer := NewWithBackends(clients, clients, prom, nil)
	return &layer.App
}

func TestGetAppListFromDeployments(t *testing.T) {
	assert := assert.New(t)
	require := require.New(t)

	conf := config.NewConfig()
	config.Set(conf)
	// Auxiliar fake* tests defined in workload_test.go
	objects := []runtime.Object{
		kubetest.FakeNamespace("Namespace"),
		&osproject_v1.Project{ObjectMeta: v1.ObjectMeta{Name: "Namespace"}},
	}
	for _, obj := range FakeDeployments(*conf) {
		o := obj
		objects = append(objects, &o)
	}

	// Setup mocks
	k8s := kubetest.NewFakeK8sClient(objects...)
	k8s.OpenShift = true
	k8s.Token = "token" // Not needed a result, just to not send an error to test this usecase
	mockClientFactory := kubetest.NewK8SClientFactoryMock(k8s)
	SetWithBackends(mockClientFactory, nil)

	SetupBusinessLayer(t, k8s, *conf)

	svc := setupAppService(mockClientFactory.Clients)

	criteria := AppCriteria{Cluster: conf.KubernetesConfig.ClusterName, Namespace: "Namespace", IncludeIstioResources: false, IncludeHealth: false}
	appList, err := svc.GetClusterAppList(context.TODO(), criteria)
	require.NoError(err)

	assert.Equal(1, len(appList.Apps))
	assert.Equal("httpbin", appList.Apps[0].Name)
	assert.Equal("Namespace", appList.Apps[0].Namespace)
}

func TestGetAppListFromWorkloadGroups(t *testing.T) {
	assert := assert.New(t)
	require := require.New(t)

	conf := config.NewConfig()
	config.Set(conf)
	// Auxiliar fake* tests defined in workload_test.go
	kubeObjs := []runtime.Object{
		kubetest.FakeNamespace("Namespace"),
		&osproject_v1.Project{ObjectMeta: v1.ObjectMeta{Name: "Namespace"}},
	}
	for _, obj := range FakeWorkloadGroups(*conf) {
		o := obj
		kubeObjs = append(kubeObjs, &o)
	}
	for _, obj := range FakeWorkloadEntries(*conf) {
		o := obj
		kubeObjs = append(kubeObjs, &o)
	}
	for _, obj := range FakeWorkloadGroupSidecars(*conf) {
		o := obj
		kubeObjs = append(kubeObjs, &o)
	}

	// Setup mocks
	k8s := kubetest.NewFakeK8sClient(kubeObjs...)
	k8s.OpenShift = true
	k8s.Token = "token" // Not needed a result, just to not send an error to test this usecase
	mockClientFactory := kubetest.NewK8SClientFactoryMock(k8s)
	SetWithBackends(mockClientFactory, nil)

	SetupBusinessLayer(t, k8s, *conf)

	svc := setupAppService(mockClientFactory.Clients)

	criteria := AppCriteria{Cluster: conf.KubernetesConfig.ClusterName, Namespace: "Namespace", IncludeIstioResources: true, IncludeHealth: false}
	appList, err := svc.GetClusterAppList(context.TODO(), criteria)
	require.NoError(err)

	assert.Equal(3, len(appList.Apps))
	for _, app := range appList.Apps {
		require.NotEmpty(app.Name)
		require.Equal("Namespace", app.Namespace)
		if !strings.Contains(app.Name, "no") {
			require.True(app.IstioSidecar)
		}
	}
}

func TestGetAppFromDeployments(t *testing.T) {
	assert := assert.New(t)
	require := require.New(t)

	conf := config.NewConfig()
	conf.ExternalServices.CustomDashboards.Enabled = false
	config.Set(conf)

	// Setup mocks
	objects := []runtime.Object{
		&osproject_v1.Project{ObjectMeta: v1.ObjectMeta{Name: "Namespace"}},
	}
	for _, obj := range FakeDeployments(*conf) {
		o := obj
		objects = append(objects, &o)
	}
	for _, obj := range FakeServices() {
		o := obj
		objects = append(objects, &o)
	}

	k8s := kubetest.NewFakeK8sClient(objects...)
	k8s.OpenShift = true
	mockClientFactory := kubetest.NewK8SClientFactoryMock(k8s)
	SetWithBackends(mockClientFactory, nil)

	SetupBusinessLayer(t, k8s, *conf)

	svc := setupAppService(mockClientFactory.Clients)

	criteria := AppCriteria{Namespace: "Namespace", AppName: "httpbin", Cluster: conf.KubernetesConfig.ClusterName}
	appDetails, appDetailsErr := svc.GetAppDetails(context.TODO(), criteria)
	require.NoError(appDetailsErr)

	assert.Equal("Namespace", appDetails.Namespace.Name)
	assert.Equal("httpbin", appDetails.Name)

	assert.Equal(2, len(appDetails.Workloads))
	assert.Equal("httpbin-v1", appDetails.Workloads[0].WorkloadName)
	assert.Equal("httpbin-v2", appDetails.Workloads[1].WorkloadName)
	assert.Equal(1, len(appDetails.ServiceNames))
	assert.Equal("httpbin", appDetails.ServiceNames[0])
}

func TestGetAppFromWorkloadGroups(t *testing.T) {
	assert := assert.New(t)
	require := require.New(t)

	conf := config.NewConfig()
	conf.ExternalServices.CustomDashboards.Enabled = false
	config.Set(conf)

	// Setup mocks
	kubeObjs := []runtime.Object{
		&osproject_v1.Project{ObjectMeta: v1.ObjectMeta{Name: "Namespace"}},
	}
	for _, obj := range FakeWorkloadGroups(*conf) {
		o := obj
		kubeObjs = append(kubeObjs, &o)
	}
	for _, obj := range FakeWorkloadEntries(*conf) {
		o := obj
		kubeObjs = append(kubeObjs, &o)
	}
	for _, obj := range FakeWorkloadGroupSidecars(*conf) {
		o := obj
		kubeObjs = append(kubeObjs, &o)
	}

	k8s := kubetest.NewFakeK8sClient(kubeObjs...)
	k8s.OpenShift = true
	mockClientFactory := kubetest.NewK8SClientFactoryMock(k8s)
	SetWithBackends(mockClientFactory, nil)

	SetupBusinessLayer(t, k8s, *conf)

	svc := setupAppService(mockClientFactory.Clients)

	criteria := AppCriteria{Namespace: "Namespace", AppName: "ratings-vm", Cluster: conf.KubernetesConfig.ClusterName}
	appDetails, appDetailsErr := svc.GetAppDetails(context.TODO(), criteria)
	require.NoError(appDetailsErr)

	assert.Equal("Namespace", appDetails.Namespace.Name)
	assert.Equal("ratings-vm", appDetails.Name)

	assert.Equal(1, len(appDetails.Workloads))
	assert.Equal("ratings-vm", appDetails.Workloads[0].WorkloadName)
	assert.Equal(0, len(appDetails.ServiceNames))
}

func TestGetAppListFromReplicaSets(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()

	// Setup mocks
	// Auxiliar fake* tests defined in workload_test.go
	objects := []runtime.Object{
		&osproject_v1.Project{ObjectMeta: v1.ObjectMeta{Name: "Namespace"}},
	}
	for _, obj := range FakeReplicaSets(*conf) {
		o := obj
		objects = append(objects, &o)
	}

	k8s := kubetest.NewFakeK8sClient(objects...)
	k8s.OpenShift = true
	mockClientFactory := kubetest.NewK8SClientFactoryMock(k8s)
	SetWithBackends(mockClientFactory, nil)

	SetupBusinessLayer(t, k8s, *conf)

	svc := setupAppService(mockClientFactory.Clients)

	criteria := AppCriteria{Cluster: conf.KubernetesConfig.ClusterName, Namespace: "Namespace", IncludeIstioResources: false, IncludeHealth: false}
	appList, _ := svc.GetClusterAppList(context.TODO(), criteria)

	assert.Equal(1, len(appList.Apps))
	assert.Equal("httpbin", appList.Apps[0].Name)
	assert.Equal("Namespace", appList.Apps[0].Namespace)
}

func TestGetAppFromReplicaSets(t *testing.T) {
	assert := assert.New(t)

	// Disabling CustomDashboards on Workload details testing
	// otherwise this adds 10s to the test due to an http timeout.
	conf := config.NewConfig()
	conf.ExternalServices.CustomDashboards.Enabled = false
	kubernetes.SetConfig(t, *conf)

	// Setup mocks
	objects := []runtime.Object{
		&osproject_v1.Project{ObjectMeta: v1.ObjectMeta{Name: "Namespace"}},
	}
	for _, obj := range FakeReplicaSets(*conf) {
		o := obj
		objects = append(objects, &o)
	}
	for _, obj := range FakeServices() {
		o := obj
		objects = append(objects, &o)
	}

	k8s := kubetest.NewFakeK8sClient(objects...)
	k8s.OpenShift = true
	mockClientFactory := kubetest.NewK8SClientFactoryMock(k8s)
	SetWithBackends(mockClientFactory, nil)

	SetupBusinessLayer(t, k8s, *conf)

	svc := setupAppService(mockClientFactory.Clients)

	criteria := AppCriteria{Namespace: "Namespace", AppName: "httpbin", Cluster: conf.KubernetesConfig.ClusterName}
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
