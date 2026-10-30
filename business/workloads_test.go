package business

import (
	"context"
	"encoding/json"
	"io"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apps_v1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/types"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/prometheus/prometheustest"
	"github.com/kiali/kiali/tests/data"
	"github.com/kiali/kiali/util/sliceutil"
)

func setupWorkloadService(t testing.TB, k8s kubernetes.UserClientInterface, conf *config.Config) WorkloadService {
	// config needs to be set by other services since those rely on the global.
	prom := new(prometheustest.PromClientMock)
	// Mocking out for the dashboards service. Maybe this should be set to something real?
	prom.MockMetricsForLabels(context.Background(), []string{})
	return NewLayerBuilder(t, conf).WithClient(k8s).WithProm(prom).Build().Workload
}

func callStreamPodLogs(svc WorkloadService, namespace, workload, app, podName string, opts *LogOptions) PodLog {
	w := httptest.NewRecorder()

	_ = svc.StreamPodLogs(context.TODO(), svc.conf.KubernetesConfig.ClusterName, namespace, workload, app, podName, opts, w)

	response := w.Result()
	body, _ := io.ReadAll(response.Body)

	var podLogs PodLog
	_ = json.Unmarshal(body, &podLogs)

	return podLogs
}

func TestGetWorkloadListFromDeployments(t *testing.T) {
	assert := assert.New(t)
	require := require.New(t)
	conf := config.NewConfig()
	conf.ExternalServices.Istio.IstioAPIEnabled = false
	conf.IstioLabels.AppLabelName = "app"
	conf.IstioLabels.VersionLabelName = "version"
	config.Set(conf)

	// Setup mocks
	kubeObjs := []runtime.Object{
		&corev1.Namespace{ObjectMeta: metav1.ObjectMeta{Name: "Namespace"}},
	}
	for _, obj := range FakeDeployments(*conf) {
		o := obj
		kubeObjs = append(kubeObjs, &o)
	}
	k8s := kubetest.NewFakeK8sClient(kubeObjs...)
	k8s.OpenShift = true
	svc := setupWorkloadService(t, k8s, conf)

	criteria := WorkloadCriteria{Namespace: "Namespace", IncludeIstioResources: false, IncludeHealth: false, Cluster: conf.KubernetesConfig.ClusterName}
	workloadList, _ := svc.GetWorkloadList(context.TODO(), criteria)
	workloads := workloadList.Workloads

	assert.Equal("Namespace", workloadList.Namespace)

	require.Equal(3, len(workloads))
	assert.Equal("httpbin-v1", workloads[0].Name)
	assert.Equal(true, workloads[0].AppLabel)
	assert.Equal(false, workloads[0].VersionLabel)
	assert.Equal("Deployment", workloads[0].WorkloadGVK.Kind)
	assert.Equal("httpbin-v2", workloads[1].Name)
	assert.Equal(true, workloads[1].AppLabel)
	assert.Equal(true, workloads[1].VersionLabel)
	assert.Equal("Deployment", workloads[1].WorkloadGVK.Kind)
	assert.Equal("httpbin-v3", workloads[2].Name)
	assert.Equal(false, workloads[2].AppLabel)
	assert.Equal(false, workloads[2].VersionLabel)
	assert.Equal("Deployment", workloads[2].WorkloadGVK.Kind)
}

func TestGetWorkloadListFromDeploymentsNoAppVerLabelNames(t *testing.T) {
	assert := assert.New(t)
	require := require.New(t)
	conf := config.NewConfig()
	conf.ExternalServices.Istio.IstioAPIEnabled = false
	config.Set(conf)

	// Setup mocks
	kubeObjs := []runtime.Object{
		&corev1.Namespace{ObjectMeta: metav1.ObjectMeta{Name: "Namespace"}},
	}
	for _, obj := range FakeDeployments(*conf) {
		o := obj
		kubeObjs = append(kubeObjs, &o)
	}
	k8s := kubetest.NewFakeK8sClient(kubeObjs...)
	k8s.OpenShift = true
	svc := setupWorkloadService(t, k8s, conf)

	criteria := WorkloadCriteria{Namespace: "Namespace", IncludeIstioResources: false, IncludeHealth: false, Cluster: conf.KubernetesConfig.ClusterName}
	workloadList, _ := svc.GetWorkloadList(context.TODO(), criteria)
	workloads := workloadList.Workloads

	assert.Equal("Namespace", workloadList.Namespace)

	require.Equal(3, len(workloads))
	assert.Equal("httpbin-v1", workloads[0].Name)
	assert.Equal(true, workloads[0].AppLabel)
	assert.Equal(false, workloads[0].VersionLabel)
	assert.Equal("Deployment", workloads[0].WorkloadGVK.Kind)
	assert.Equal("httpbin-v2", workloads[1].Name)
	assert.Equal(true, workloads[1].AppLabel)
	assert.Equal(true, workloads[1].VersionLabel)
	assert.Equal("Deployment", workloads[1].WorkloadGVK.Kind)
	assert.Equal("httpbin-v3", workloads[2].Name)
	assert.Equal(false, workloads[2].AppLabel)
	assert.Equal(false, workloads[2].VersionLabel)
	assert.Equal("Deployment", workloads[2].WorkloadGVK.Kind)
}

func TestGetWorkloadListFromDeploymentsWithIstioResources(t *testing.T) {
	assert := assert.New(t)
	require := require.New(t)
	conf := config.NewConfig()
	conf.ExternalServices.Istio.IstioAPIEnabled = false
	conf.IstioLabels.AppLabelName = "app"
	conf.IstioLabels.VersionLabelName = "version"
	config.Set(conf)

	kubeObjs := []runtime.Object{
		&corev1.Namespace{ObjectMeta: metav1.ObjectMeta{Name: "Namespace"}},
	}
	for _, obj := range FakeDeployments(*conf) {
		o := obj
		kubeObjs = append(kubeObjs, &o)
	}
	k8s := kubetest.NewFakeK8sClient(kubeObjs...)
	k8s.OpenShift = true
	svc := setupWorkloadService(t, k8s, conf)

	criteria := WorkloadCriteria{Cluster: conf.KubernetesConfig.ClusterName, Namespace: "Namespace", IncludeIstioResources: true, IncludeHealth: false}
	workloadList, err := svc.GetWorkloadList(context.TODO(), criteria)
	require.NoError(err)

	assert.Equal("Namespace", workloadList.Namespace)
	require.Equal(3, len(workloadList.Workloads))
	assert.Equal("httpbin-v1", workloadList.Workloads[0].Name)
	assert.Equal("Deployment", workloadList.Workloads[0].WorkloadGVK.Kind)
}

func TestGetWorkloadListFromWorkloadGroups(t *testing.T) {
	assert := assert.New(t)
	require := require.New(t)
	conf := config.NewConfig()
	conf.ExternalServices.Istio.IstioAPIEnabled = false
	conf.IstioLabels.AppLabelName = "app"
	conf.IstioLabels.VersionLabelName = "version"
	config.Set(conf)

	// Setup mocks
	kubeObjs := []runtime.Object{
		&corev1.Namespace{ObjectMeta: metav1.ObjectMeta{Name: "Namespace"}},
	}
	for _, obj := range data.CreateWorkloadGroups(*conf) {
		o := obj
		kubeObjs = append(kubeObjs, o)
	}
	for _, obj := range data.CreateWorkloadEntries(*conf) {
		o := obj
		kubeObjs = append(kubeObjs, o)
	}
	for _, obj := range data.CreateWorkloadGroupSidecars(*conf) {
		o := obj
		kubeObjs = append(kubeObjs, o)
	}

	k8s := kubetest.NewFakeK8sClient(kubeObjs...)
	k8s.OpenShift = true
	svc := setupWorkloadService(t, k8s, conf)

	criteria := WorkloadCriteria{Namespace: "Namespace", IncludeIstioResources: true, IncludeHealth: false, Cluster: conf.KubernetesConfig.ClusterName}
	workloadList, _ := svc.GetWorkloadList(context.TODO(), criteria)
	workloads := workloadList.Workloads

	assert.Equal("Namespace", workloadList.Namespace)

	require.Equal(4, len(workloads))
	assert.Equal("ratings-vm", workloads[0].Name)
	assert.Equal(true, workloads[0].AppLabel)
	assert.Equal(true, workloads[0].VersionLabel)
	assert.Equal(true, workloads[0].IstioSidecar)
	assert.Equal("WorkloadGroup", workloads[0].WorkloadGVK.Kind)

	assert.Equal("ratings-vm-no-entry", workloads[1].Name)
	assert.Equal(true, workloads[1].AppLabel)
	assert.Equal(false, workloads[1].VersionLabel)
	assert.Equal(false, workloads[1].IstioSidecar)
	assert.Equal("WorkloadGroup", workloads[1].WorkloadGVK.Kind)

	assert.Equal("ratings-vm-no-labels", workloads[2].Name)
	assert.Equal(false, workloads[2].AppLabel)
	assert.Equal(false, workloads[2].VersionLabel)
	assert.Equal(false, workloads[2].IstioSidecar)
	assert.Equal("WorkloadGroup", workloads[2].WorkloadGVK.Kind)

	assert.Equal("ratings-vm2", workloads[3].Name)
	assert.Equal(true, workloads[3].AppLabel)
	assert.Equal(true, workloads[3].VersionLabel)
	assert.Equal(true, workloads[3].IstioSidecar)
	assert.Equal("WorkloadGroup", workloads[3].WorkloadGVK.Kind)
}

func TestGetWorkloadListFromReplicaSets(t *testing.T) {
	assert := assert.New(t)
	require := require.New(t)
	conf := config.NewConfig()
	conf.IstioLabels.AppLabelName = "app"
	conf.IstioLabels.VersionLabelName = "version"
	config.Set(conf)

	// Setup mocks
	kubeObjs := []runtime.Object{
		&corev1.Namespace{ObjectMeta: metav1.ObjectMeta{Name: "Namespace"}},
	}
	for _, obj := range FakeReplicaSets(*conf) {
		o := obj
		kubeObjs = append(kubeObjs, &o)
	}
	k8s := kubetest.NewFakeK8sClient(kubeObjs...)
	k8s.OpenShift = true
	svc := setupWorkloadService(t, k8s, conf)

	criteria := WorkloadCriteria{Namespace: "Namespace", IncludeIstioResources: false, IncludeHealth: false}
	workloadList, _ := svc.GetWorkloadList(context.TODO(), criteria)
	workloads := workloadList.Workloads

	assert.Equal("Namespace", workloadList.Namespace)

	require.Equal(3, len(workloads))
	assert.Equal("httpbin-v1", workloads[0].Name)
	assert.Equal(true, workloads[0].AppLabel)
	assert.Equal(false, workloads[0].VersionLabel)
	assert.Equal("ReplicaSet", workloads[0].WorkloadGVK.Kind)
	assert.Equal("httpbin-v2", workloads[1].Name)
	assert.Equal(true, workloads[1].AppLabel)
	assert.Equal(true, workloads[1].VersionLabel)
	assert.Equal("ReplicaSet", workloads[1].WorkloadGVK.Kind)
	assert.Equal("httpbin-v3", workloads[2].Name)
	assert.Equal(false, workloads[2].AppLabel)
	assert.Equal(false, workloads[2].VersionLabel)
	assert.Equal("ReplicaSet", workloads[2].WorkloadGVK.Kind)
}

func TestGetWorkloadListFromReplicationControllers(t *testing.T) {
	assert := assert.New(t)
	require := require.New(t)
	conf := config.NewConfig()
	conf.IstioLabels.AppLabelName = "app"
	conf.IstioLabels.VersionLabelName = "version"
	config.Set(conf)

	// Setup mocks
	kubeObjs := []runtime.Object{
		&corev1.Namespace{ObjectMeta: metav1.ObjectMeta{Name: "Namespace"}},
	}
	for _, obj := range FakeReplicationControllers(conf) {
		o := obj
		kubeObjs = append(kubeObjs, &o)
	}
	k8s := kubetest.NewFakeK8sClient(kubeObjs...)
	k8s.OpenShift = true
	svc := setupWorkloadService(t, k8s, conf)
	svc.excludedWorkloads = map[string]bool{}

	criteria := WorkloadCriteria{Namespace: "Namespace", IncludeIstioResources: false, IncludeHealth: false}
	workloadList, _ := svc.GetWorkloadList(context.TODO(), criteria)
	workloads := workloadList.Workloads

	assert.Equal("Namespace", workloadList.Namespace)

	require.Equal(3, len(workloads))
	assert.Equal("httpbin-v1", workloads[0].Name)
	assert.Equal(true, workloads[0].AppLabel)
	assert.Equal(false, workloads[0].VersionLabel)
	assert.Equal("ReplicationController", workloads[0].WorkloadGVK.Kind)
	assert.Equal("httpbin-v2", workloads[1].Name)
	assert.Equal(true, workloads[1].AppLabel)
	assert.Equal(true, workloads[1].VersionLabel)
	assert.Equal("ReplicationController", workloads[1].WorkloadGVK.Kind)
	assert.Equal("httpbin-v3", workloads[2].Name)
	assert.Equal(false, workloads[2].AppLabel)
	assert.Equal(false, workloads[2].VersionLabel)
	assert.Equal("ReplicationController", workloads[2].WorkloadGVK.Kind)
}

func TestGetWorkloadListFromDeploymentConfigs(t *testing.T) {
	assert := assert.New(t)
	require := require.New(t)
	conf := config.NewConfig()
	conf.IstioLabels.AppLabelName = "app"
	conf.IstioLabels.VersionLabelName = "version"
	config.Set(conf)

	// Setup mocks
	kubeObjs := []runtime.Object{
		&corev1.Namespace{ObjectMeta: metav1.ObjectMeta{Name: "Namespace"}},
	}
	for _, obj := range FakeDeploymentConfigs(conf) {
		o := obj
		kubeObjs = append(kubeObjs, &o)
	}
	k8s := kubetest.NewFakeK8sClient(kubeObjs...)
	k8s.OpenShift = true
	svc := setupWorkloadService(t, k8s, conf)
	svc.excludedWorkloads = map[string]bool{}

	criteria := WorkloadCriteria{Namespace: "Namespace", IncludeIstioResources: false, IncludeHealth: false}
	workloadList, _ := svc.GetWorkloadList(context.TODO(), criteria)
	workloads := workloadList.Workloads

	assert.Equal("Namespace", workloadList.Namespace)

	require.Equal(3, len(workloads))
	assert.Equal("httpbin-v1", workloads[0].Name)
	assert.Equal(true, workloads[0].AppLabel)
	assert.Equal(false, workloads[0].VersionLabel)
	assert.Equal("DeploymentConfig", workloads[0].WorkloadGVK.Kind)
	assert.Equal("httpbin-v2", workloads[1].Name)
	assert.Equal(true, workloads[1].AppLabel)
	assert.Equal(true, workloads[1].VersionLabel)
	assert.Equal("DeploymentConfig", workloads[1].WorkloadGVK.Kind)
	assert.Equal("httpbin-v3", workloads[2].Name)
	assert.Equal(false, workloads[2].AppLabel)
	assert.Equal(false, workloads[2].VersionLabel)
	assert.Equal("DeploymentConfig", workloads[2].WorkloadGVK.Kind)
}

func TestGetWorkloadListFromStatefulSets(t *testing.T) {
	assert := assert.New(t)
	require := require.New(t)
	conf := config.NewConfig()
	conf.IstioLabels.AppLabelName = "app"
	conf.IstioLabels.VersionLabelName = "version"
	config.Set(conf)

	// Setup mocks
	kubeObjs := []runtime.Object{
		&corev1.Namespace{ObjectMeta: metav1.ObjectMeta{Name: "Namespace"}},
	}
	for _, obj := range FakeStatefulSets(conf) {
		o := obj
		kubeObjs = append(kubeObjs, &o)
	}
	k8s := kubetest.NewFakeK8sClient(kubeObjs...)
	k8s.OpenShift = true
	svc := setupWorkloadService(t, k8s, conf)
	svc.excludedWorkloads = map[string]bool{}

	criteria := WorkloadCriteria{Namespace: "Namespace", IncludeIstioResources: false, IncludeHealth: false}
	workloadList, _ := svc.GetWorkloadList(context.TODO(), criteria)
	workloads := workloadList.Workloads

	assert.Equal("Namespace", workloadList.Namespace)

	require.Equal(3, len(workloads))
	assert.Equal("httpbin-v1", workloads[0].Name)
	assert.Equal(true, workloads[0].AppLabel)
	assert.Equal(false, workloads[0].VersionLabel)
	assert.Equal("StatefulSet", workloads[0].WorkloadGVK.Kind)
	assert.Equal("httpbin-v2", workloads[1].Name)
	assert.Equal(true, workloads[1].AppLabel)
	assert.Equal(true, workloads[1].VersionLabel)
	assert.Equal("StatefulSet", workloads[1].WorkloadGVK.Kind)
	assert.Equal("httpbin-v3", workloads[2].Name)
	assert.Equal(false, workloads[2].AppLabel)
	assert.Equal(false, workloads[2].VersionLabel)
	assert.Equal("StatefulSet", workloads[2].WorkloadGVK.Kind)
}

func TestGetWorkloadListFromDaemonSets(t *testing.T) {
	assert := assert.New(t)
	require := require.New(t)
	conf := config.NewConfig()
	conf.IstioLabels.AppLabelName = "app"
	conf.IstioLabels.VersionLabelName = "version"
	config.Set(conf)

	// Setup mocks
	kubeObjs := []runtime.Object{
		&corev1.Namespace{ObjectMeta: metav1.ObjectMeta{Name: "Namespace"}},
	}
	for _, obj := range FakeDaemonSets(conf) {
		o := obj
		kubeObjs = append(kubeObjs, &o)
	}
	k8s := kubetest.NewFakeK8sClient(kubeObjs...)
	k8s.OpenShift = true
	svc := setupWorkloadService(t, k8s, config.NewConfig())
	svc.excludedWorkloads = map[string]bool{}

	criteria := WorkloadCriteria{Namespace: "Namespace", IncludeIstioResources: false, IncludeHealth: false}
	workloadList, _ := svc.GetWorkloadList(context.TODO(), criteria)
	workloads := workloadList.Workloads

	assert.Equal("Namespace", workloadList.Namespace)

	require.Equal(3, len(workloads))
	assert.Equal("httpbin-v1", workloads[0].Name)
	assert.Equal(true, workloads[0].AppLabel)
	assert.Equal(false, workloads[0].VersionLabel)
	assert.Equal("DaemonSet", workloads[0].WorkloadGVK.Kind)
	assert.Equal("httpbin-v2", workloads[1].Name)
	assert.Equal(true, workloads[1].AppLabel)
	assert.Equal(true, workloads[1].VersionLabel)
	assert.Equal("DaemonSet", workloads[1].WorkloadGVK.Kind)
	assert.Equal("httpbin-v3", workloads[2].Name)
	assert.Equal(false, workloads[2].AppLabel)
	assert.Equal(false, workloads[2].VersionLabel)
	assert.Equal("DaemonSet", workloads[2].WorkloadGVK.Kind)
}

func TestGetWorkloadListFromDepRCPod(t *testing.T) {
	assert := assert.New(t)
	require := require.New(t)
	conf := config.NewConfig()
	conf.IstioLabels.AppLabelName = "app"
	conf.IstioLabels.VersionLabelName = "version"
	config.Set(conf)

	// Setup mocks
	kubeObjs := []runtime.Object{
		&corev1.Namespace{ObjectMeta: metav1.ObjectMeta{Name: "Namespace"}},
	}
	for _, obj := range FakeDepSyncedWithRS(conf) {
		o := obj
		kubeObjs = append(kubeObjs, &o)
	}
	for _, obj := range FakeRSSyncedWithPods(conf) {
		o := obj
		kubeObjs = append(kubeObjs, &o)
	}
	for _, obj := range FakePodsSyncedWithDeployments(conf) {
		o := obj
		kubeObjs = append(kubeObjs, &o)
	}
	k8s := kubetest.NewFakeK8sClient(kubeObjs...)
	k8s.OpenShift = true
	svc := setupWorkloadService(t, k8s, conf)

	criteria := WorkloadCriteria{Namespace: "Namespace", IncludeIstioResources: false, IncludeHealth: false}
	workloadList, _ := svc.GetWorkloadList(context.TODO(), criteria)
	workloads := workloadList.Workloads

	assert.Equal("Namespace", workloadList.Namespace)

	require.Equal(1, len(workloads))
	assert.Equal("details-v1", workloads[0].Name)
	assert.Equal("Deployment", workloads[0].WorkloadGVK.Kind)
	assert.Equal(true, workloads[0].AppLabel)
	assert.Equal(true, workloads[0].VersionLabel)
}

func TestGetWorkloadListFromPod(t *testing.T) {
	assert := assert.New(t)
	require := require.New(t)
	conf := config.NewConfig()
	conf.IstioLabels.AppLabelName = "app"
	conf.IstioLabels.VersionLabelName = "version"
	config.Set(conf)

	// Setup mocks
	kubeObjs := []runtime.Object{
		&corev1.Namespace{ObjectMeta: metav1.ObjectMeta{Name: "Namespace"}},
	}
	for _, obj := range FakePodsNoController(conf) {
		o := obj
		kubeObjs = append(kubeObjs, &o)
	}
	k8s := kubetest.NewFakeK8sClient(kubeObjs...)
	k8s.OpenShift = true
	svc := setupWorkloadService(t, k8s, conf)

	criteria := WorkloadCriteria{Namespace: "Namespace", IncludeIstioResources: false, IncludeHealth: false}
	workloadList, _ := svc.GetWorkloadList(context.TODO(), criteria)
	workloads := workloadList.Workloads

	assert.Equal("Namespace", workloadList.Namespace)

	require.Equal(1, len(workloads))
	assert.Equal("orphan-pod", workloads[0].Name)
	assert.Equal("Pod", workloads[0].WorkloadGVK.Kind)
	assert.Equal(true, workloads[0].AppLabel)
	assert.Equal(true, workloads[0].VersionLabel)
}

func TestGetWorkloadListFromPods(t *testing.T) {
	assert := assert.New(t)
	require := require.New(t)
	conf := config.NewConfig()
	conf.IstioLabels.AppLabelName = "app"
	conf.IstioLabels.VersionLabelName = "version"
	config.Set(conf)

	// Setup mocks
	kubeObjs := []runtime.Object{
		&corev1.Namespace{ObjectMeta: metav1.ObjectMeta{Name: "Namespace"}},
	}
	for _, obj := range FakeCustomControllerRSSyncedWithPods(conf) {
		o := obj
		kubeObjs = append(kubeObjs, &o)
	}
	for _, obj := range FakePodsFromCustomController(conf) {
		o := obj
		kubeObjs = append(kubeObjs, &o)
	}
	k8s := kubetest.NewFakeK8sClient(kubeObjs...)
	k8s.OpenShift = true
	svc := setupWorkloadService(t, k8s, conf)

	criteria := WorkloadCriteria{Namespace: "Namespace", IncludeIstioResources: false, IncludeHealth: false}
	workloadList, _ := svc.GetWorkloadList(context.TODO(), criteria)
	workloads := workloadList.Workloads

	assert.Equal("Namespace", workloadList.Namespace)

	require.Equal(1, len(workloads))
	assert.Equal("custom-controller", workloads[0].Name)
	assert.Equal("CustomController", workloads[0].WorkloadGVK.Kind)
	assert.Equal(true, workloads[0].AppLabel)
	assert.Equal(true, workloads[0].VersionLabel)
}

func TestGetWorkloadFromDeployment(t *testing.T) {
	assert := assert.New(t)
	require := require.New(t)

	// Disabling CustomDashboards on Workload details testing
	conf := config.NewConfig()
	conf.ExternalServices.CustomDashboards.Enabled = false
	conf.IstioLabels.AppLabelName = "app"
	conf.IstioLabels.VersionLabelName = "version"
	config.Set(conf)

	// Setup mocks
	kubeObjs := []runtime.Object{
		&corev1.Namespace{ObjectMeta: metav1.ObjectMeta{Name: "Namespace"}},
		&FakeDepSyncedWithRS(conf)[0],
	}
	for _, o := range FakeRSSyncedWithPods(conf) {
		kubeObjs = append(kubeObjs, &o)
	}
	for _, o := range FakePodsSyncedWithDeployments(conf) {
		kubeObjs = append(kubeObjs, &o)
	}
	k8s := kubetest.NewFakeK8sClient(kubeObjs...)
	k8s.OpenShift = true
	svc := setupWorkloadService(t, k8s, conf)

	criteria := WorkloadCriteria{Cluster: conf.KubernetesConfig.ClusterName, Namespace: "Namespace", WorkloadName: "details-v1", WorkloadGVK: schema.GroupVersionKind{}, IncludeServices: false}
	workload, err := svc.GetWorkload(context.TODO(), criteria)
	require.NoError(err)

	assert.Equal("details-v1", workload.Name)
	assert.Equal("Deployment", workload.WorkloadGVK.Kind)
	assert.Equal(true, workload.AppLabel)
	assert.Equal(true, workload.VersionLabel)
}

func TestGetWorkloadFromWorkloadGroup(t *testing.T) {
	assert := assert.New(t)
	require := require.New(t)

	// Disabling CustomDashboards on Workload details testing
	conf := config.NewConfig()
	conf.ExternalServices.CustomDashboards.Enabled = false
	conf.IstioLabels.AppLabelName = "app"
	conf.IstioLabels.VersionLabelName = "version"
	kubernetes.SetConfig(t, *conf)

	// Setup mocks
	kubeObjs := []runtime.Object{
		&corev1.Namespace{ObjectMeta: metav1.ObjectMeta{Name: "Namespace"}},
	}
	for _, obj := range data.CreateWorkloadGroups(*conf) {
		o := obj
		kubeObjs = append(kubeObjs, o)
	}
	for _, obj := range data.CreateWorkloadEntries(*conf) {
		o := obj
		kubeObjs = append(kubeObjs, o)
	}
	for _, obj := range data.CreateWorkloadGroupSidecars(*conf) {
		o := obj
		kubeObjs = append(kubeObjs, o)
	}
	k8s := kubetest.NewFakeK8sClient(kubeObjs...)
	k8s.OpenShift = true
	svc := setupWorkloadService(t, k8s, conf)

	criteria := WorkloadCriteria{Cluster: conf.KubernetesConfig.ClusterName, Namespace: "Namespace", WorkloadName: "ratings-vm", WorkloadGVK: schema.GroupVersionKind{}, IncludeServices: false}
	workload, err := svc.GetWorkload(context.TODO(), criteria)
	require.NoError(err)

	assert.Equal("ratings-vm", workload.Name)
	assert.Equal("WorkloadGroup", workload.WorkloadGVK.Kind)
	assert.Equal(true, workload.AppLabel)
	assert.Equal(true, workload.VersionLabel)
	assert.Equal(true, workload.IstioSidecar)
	assert.NotNil(workload.WorkloadEntries)
	assert.Equal(1, len(workload.WorkloadEntries))
	assert.Equal("ratings-vm", workload.WorkloadEntries[0].Name)

	criteria = WorkloadCriteria{Cluster: conf.KubernetesConfig.ClusterName, Namespace: "Namespace", WorkloadName: "ratings-vm-no-entry", WorkloadGVK: schema.GroupVersionKind{}, IncludeServices: false}
	workload, err = svc.GetWorkload(context.TODO(), criteria)
	require.NoError(err)

	assert.Equal("ratings-vm-no-entry", workload.Name)
	assert.Equal("WorkloadGroup", workload.WorkloadGVK.Kind)
	// AppLabel comes from WorkloadGroup when WorkloadEntry is missing
	assert.Equal(true, workload.AppLabel)
	assert.Equal(false, workload.VersionLabel)
	assert.Equal(false, workload.IstioSidecar)
	assert.Nil(workload.WorkloadEntries)
}

func TestGetWorkloadWithInvalidWorkloadType(t *testing.T) {
	assert := assert.New(t)
	require := require.New(t)

	// Disabling CustomDashboards on Workload details testing
	// otherwise this adds 10s to the test due to an http timeout.
	conf := config.NewConfig()
	conf.ExternalServices.CustomDashboards.Enabled = false
	conf.IstioLabels.AppLabelName = "app"
	conf.IstioLabels.VersionLabelName = "version"
	kubernetes.SetConfig(t, *conf)

	// Setup mocks
	kubeObjs := []runtime.Object{
		&FakeDepSyncedWithRS(conf)[0],
		&corev1.Namespace{ObjectMeta: metav1.ObjectMeta{Name: "Namespace"}},
	}
	for _, obj := range FakeRSSyncedWithPods(conf) {
		o := obj
		kubeObjs = append(kubeObjs, &o)
	}
	for _, obj := range FakePodsSyncedWithDeployments(conf) {
		o := obj
		kubeObjs = append(kubeObjs, &o)
	}
	k8s := kubetest.NewFakeK8sClient(kubeObjs...)
	k8s.OpenShift = true
	svc := setupWorkloadService(t, k8s, conf)

	criteria := WorkloadCriteria{Cluster: conf.KubernetesConfig.ClusterName, Namespace: "Namespace", WorkloadName: "details-v1", WorkloadGVK: schema.GroupVersionKind{Kind: "invalid"}, IncludeServices: false}
	workload, err := svc.GetWorkload(context.TODO(), criteria)
	require.NoError(err)

	assert.Equal("details-v1", workload.Name)
	assert.Equal("Deployment", workload.WorkloadGVK.Kind)
	assert.Equal(true, workload.AppLabel)
	assert.Equal(true, workload.VersionLabel)
}

func TestGetWorkloadFromPods(t *testing.T) {
	assert := assert.New(t)
	require := require.New(t)

	// Disabling CustomDashboards on Workload details testing
	// otherwise this adds 10s to the test due to an http timeout.
	conf := config.NewConfig()
	conf.ExternalServices.CustomDashboards.Enabled = false
	conf.IstioLabels.AppLabelName = "app"
	conf.IstioLabels.VersionLabelName = "version"
	kubernetes.SetConfig(t, *conf)

	// Setup mocks
	kubeObjs := []runtime.Object{
		&corev1.Namespace{ObjectMeta: metav1.ObjectMeta{Name: "Namespace"}},
	}
	for _, obj := range FakeCustomControllerRSSyncedWithPods(conf) {
		o := obj
		kubeObjs = append(kubeObjs, &o)
	}
	for _, obj := range FakePodsFromCustomController(conf) {
		o := obj
		kubeObjs = append(kubeObjs, &o)
	}
	k8s := kubetest.NewFakeK8sClient(kubeObjs...)
	k8s.OpenShift = true
	svc := setupWorkloadService(t, k8s, conf)

	criteria := WorkloadCriteria{Cluster: conf.KubernetesConfig.ClusterName, Namespace: "Namespace", WorkloadName: "custom-controller", WorkloadGVK: schema.GroupVersionKind{}, IncludeServices: false}
	workload, err := svc.GetWorkload(context.TODO(), criteria)
	require.NoError(err)

	assert.Equal("custom-controller", workload.Name)
	assert.Equal("CustomController", workload.WorkloadGVK.Kind)
	assert.Equal(true, workload.AppLabel)
	assert.Equal(true, workload.VersionLabel)
	assert.Equal(0, len(workload.Runtimes))
	assert.Equal(0, len(workload.AdditionalDetails))
}

func TestGetPod(t *testing.T) {
	assert := assert.New(t)
	require := require.New(t)

	conf := config.NewConfig()
	k8s := kubetest.NewFakeK8sClient(FakePodSyncedWithDeployments(conf), &corev1.Namespace{ObjectMeta: metav1.ObjectMeta{Name: "Namespace"}})
	svc := setupWorkloadService(t, k8s, conf)

	pod, err := svc.GetPod(conf.KubernetesConfig.ClusterName, "Namespace", "details-v1-3618568057-dnkjp")
	require.NoError(err)

	assert.Equal("details-v1-3618568057-dnkjp", pod.Name)
}

// a fake log streamer that returns a fixed string for testing.
type logStreamer struct {
	logs string
	kubernetes.UserClientInterface
}

func (l *logStreamer) StreamPodLogs(namespace, name string, opts *corev1.PodLogOptions) (io.ReadCloser, error) {
	return io.NopCloser(strings.NewReader(l.logs)), nil
}

func TestGetPodLogs(t *testing.T) {
	assert := assert.New(t)
	require := require.New(t)

	k8s := &logStreamer{
		logs:                FakePodLogsSyncedWithDeployments().Logs,
		UserClientInterface: kubetest.NewFakeK8sClient(&corev1.Namespace{ObjectMeta: metav1.ObjectMeta{Name: "Namespace"}}),
	}

	svc := setupWorkloadService(t, k8s, config.NewConfig())
	podLogs := callStreamPodLogs(svc, "Namespace", "details", "details", "details-v1-3618568057-dnkjp", &LogOptions{PodLogOptions: corev1.PodLogOptions{Container: "details"}})

	require.Equal(len(podLogs.Entries), 4)

	assert.Equal("2018-01-02 03:34:28.000", podLogs.Entries[0].Timestamp)
	assert.Equal(int64(1514864068000), podLogs.Entries[0].TimestampUnix)
	assert.Equal("INFO #1 Log Message", podLogs.Entries[0].Message)
	assert.Equal("INFO", podLogs.Entries[0].Severity)

	assert.Equal("2018-01-02 04:34:28.000", podLogs.Entries[1].Timestamp)
	assert.Equal(int64(1514867668000), podLogs.Entries[1].TimestampUnix)
	assert.Equal("WARN #2 Log Message", podLogs.Entries[1].Message)
	assert.Equal("WARN", podLogs.Entries[1].Severity)

	assert.Equal("2018-01-02 05:34:28.000", podLogs.Entries[2].Timestamp)
	assert.Equal(int64(1514871268000), podLogs.Entries[2].TimestampUnix)
	assert.Equal("#3 Log Message", podLogs.Entries[2].Message)
	assert.Equal("INFO", podLogs.Entries[2].Severity)

	assert.Equal("2018-01-02 06:34:28.000", podLogs.Entries[3].Timestamp)
	assert.Equal(int64(1514874868000), podLogs.Entries[3].TimestampUnix)
	assert.Equal("#4 Log error Message", podLogs.Entries[3].Message)
	assert.Equal("ERROR", podLogs.Entries[3].Severity)
}

func TestGetPodLogsMaxLines(t *testing.T) {
	assert := assert.New(t)
	require := require.New(t)

	k8s := &logStreamer{
		logs:                FakePodLogsSyncedWithDeployments().Logs,
		UserClientInterface: kubetest.NewFakeK8sClient(&corev1.Namespace{ObjectMeta: metav1.ObjectMeta{Name: "Namespace"}}),
	}

	svc := setupWorkloadService(t, k8s, config.NewConfig())

	maxLines := 2
	duration, _ := time.ParseDuration("6h")
	podLogs := callStreamPodLogs(svc, "Namespace", "details", "details", "details-v1-3618568057-dnkjp", &LogOptions{PodLogOptions: corev1.PodLogOptions{Container: "details"}, MaxLines: &maxLines, Duration: &duration})

	require.Equal(2, len(podLogs.Entries))
	assert.Equal("INFO #1 Log Message", podLogs.Entries[0].Message)
	assert.Equal("WARN #2 Log Message", podLogs.Entries[1].Message)
}

func TestGetPodLogsDuration(t *testing.T) {
	assert := assert.New(t)
	require := require.New(t)
	conf := config.NewConfig()

	proj := &corev1.Namespace{ObjectMeta: metav1.ObjectMeta{Name: "Namespace"}}
	k8s := &logStreamer{
		logs:                FakePodLogsSyncedWithDeployments().Logs,
		UserClientInterface: kubetest.NewFakeK8sClient(proj),
	}
	svc := setupWorkloadService(t, k8s, config.NewConfig())

	duration, _ := time.ParseDuration("59m")
	podLogs := callStreamPodLogs(svc, "Namespace", "details", "details", "details-v1-3618568057-dnkjp", &LogOptions{PodLogOptions: corev1.PodLogOptions{Container: "details"}, Duration: &duration})
	require.Equal(1, len(podLogs.Entries))
	assert.Equal("INFO #1 Log Message", podLogs.Entries[0].Message)

	// Re-setup mocks
	k8s = &logStreamer{
		logs:                FakePodLogsSyncedWithDeployments().Logs,
		UserClientInterface: kubetest.NewFakeK8sClient(proj),
	}
	svc = setupWorkloadService(t, k8s, conf)

	duration, _ = time.ParseDuration("1h")
	podLogs = callStreamPodLogs(svc, "Namespace", "details", "details", "details-v1-3618568057-dnkjp", &LogOptions{PodLogOptions: corev1.PodLogOptions{Container: "details"}, Duration: &duration})
	require.Equal(2, len(podLogs.Entries))
	assert.Equal("INFO #1 Log Message", podLogs.Entries[0].Message)
	assert.Equal("WARN #2 Log Message", podLogs.Entries[1].Message)

	// Re-setup mocks
	k8s = &logStreamer{
		logs:                FakePodLogsSyncedWithDeployments().Logs,
		UserClientInterface: kubetest.NewFakeK8sClient(proj),
	}
	svc = setupWorkloadService(t, k8s, conf)

	duration, _ = time.ParseDuration("2h")
	podLogs = callStreamPodLogs(svc, "Namespace", "details", "details", "details-v1-3618568057-dnkjp", &LogOptions{PodLogOptions: corev1.PodLogOptions{Container: "details"}, Duration: &duration})
	require.Equal(3, len(podLogs.Entries))
	assert.Equal("INFO #1 Log Message", podLogs.Entries[0].Message)
	assert.Equal("WARN #2 Log Message", podLogs.Entries[1].Message)
	assert.Equal("#3 Log Message", podLogs.Entries[2].Message)
}

func TestGetPodLogsMaxLinesAndDurations(t *testing.T) {
	assert := assert.New(t)
	require := require.New(t)
	conf := config.NewConfig()

	// Setup mocks
	proj := &corev1.Namespace{ObjectMeta: metav1.ObjectMeta{Name: "Namespace"}}
	k8s := &logStreamer{
		logs:                FakePodLogsSyncedWithDeployments().Logs,
		UserClientInterface: kubetest.NewFakeK8sClient(proj),
	}
	svc := setupWorkloadService(t, k8s, conf)

	maxLines := 2
	duration, _ := time.ParseDuration("2h")
	podLogs := callStreamPodLogs(svc, "Namespace", "details", "details", "details-v1-3618568057-dnkjp", &LogOptions{Duration: &duration, PodLogOptions: corev1.PodLogOptions{Container: "details"}, MaxLines: &maxLines})
	require.Equal(2, len(podLogs.Entries))
	assert.Equal("INFO #1 Log Message", podLogs.Entries[0].Message)
	assert.Equal("WARN #2 Log Message", podLogs.Entries[1].Message)
	assert.True(podLogs.LinesTruncated)

	// Re-setup mocks
	k8s = &logStreamer{
		logs:                FakePodLogsSyncedWithDeployments().Logs,
		UserClientInterface: kubetest.NewFakeK8sClient(proj),
	}
	svc = setupWorkloadService(t, k8s, conf)

	maxLines = 3
	duration, _ = time.ParseDuration("3h")
	podLogs = callStreamPodLogs(svc, "Namespace", "details", "details", "details-v1-3618568057-dnkjp", &LogOptions{Duration: &duration, PodLogOptions: corev1.PodLogOptions{Container: "details"}, MaxLines: &maxLines})
	require.Equal(3, len(podLogs.Entries))
	assert.Equal("INFO #1 Log Message", podLogs.Entries[0].Message)
	assert.Equal("WARN #2 Log Message", podLogs.Entries[1].Message)
	assert.Equal("#3 Log Message", podLogs.Entries[2].Message)
	assert.False(podLogs.LinesTruncated)
}

func TestGetPodLogsProxy(t *testing.T) {
	assert := assert.New(t)
	require := require.New(t)
	conf := config.NewConfig()

	// Setup mocks
	proj := &corev1.Namespace{ObjectMeta: metav1.ObjectMeta{Name: "Namespace"}}
	k8s := &logStreamer{
		logs:                FakePodLogsProxy().Logs,
		UserClientInterface: kubetest.NewFakeK8sClient(proj),
	}
	svc := setupWorkloadService(t, k8s, conf)

	maxLines := 2
	duration, _ := time.ParseDuration("2h")
	podLogs := callStreamPodLogs(svc, "Namespace", "details", "details", "details-v1-3618568057-dnkjp", &LogOptions{Duration: &duration, LogType: models.LogTypeProxy, PodLogOptions: corev1.PodLogOptions{Container: "details"}, MaxLines: &maxLines})
	require.Equal(1, len(podLogs.Entries))
	entry := podLogs.Entries[0]
	assert.Equal(`[2021-02-01T21:34:35.533Z] "GET /hotels/Ljubljana HTTP/1.1" 200 - via_upstream - "-" 0 99 14 14 "-" "Go-http-client/1.1" "7e7e2dd0-0a96-4535-950b-e303805b7e27" "hotels.travel-agency:8000" "127.0.2021-02-01T21:34:38.761055140Z 0.1:8000" inbound|8000|| 127.0.0.1:33704 10.129.0.72:8000 10.128.0.79:39880 outbound_.8000_._.hotels.travel-agency.svc.cluster.local default`, entry.Message)
	assert.Equal("2021-02-01 21:34:35.533", entry.Timestamp)
	assert.NotNil(entry.AccessLog)
	assert.Equal("GET", entry.AccessLog.Method)
	assert.Equal("200", entry.AccessLog.StatusCode)
	assert.Equal("2021-02-01T21:34:35.533Z", entry.AccessLog.Timestamp)
	assert.Equal(int64(1612215275533), entry.TimestampUnix)
}

func TestGetZtunnelPodLogsProxy(t *testing.T) {
	assert := assert.New(t)
	require := require.New(t)
	conf := config.NewConfig()
	conf.IstioLabels.AppLabelName = "app"
	conf.IstioLabels.VersionLabelName = "version"
	kubernetes.SetConfig(t, *conf)

	// Setup mocks
	kubeObjs := []runtime.Object{
		FakePodSyncedWithDeployments(conf),
		&corev1.Namespace{ObjectMeta: metav1.ObjectMeta{Name: "bookinfo"}},
	}
	for _, obj := range FakeZtunnelDaemonSet(conf) {
		o := obj
		kubeObjs = append(kubeObjs, &o)
	}
	for _, obj := range FakeZtunnelPods(conf) {
		o := obj
		kubeObjs = append(kubeObjs, &o)
	}
	k8s := &logStreamer{
		logs:                FakePodLogsZtunnel().Logs,
		UserClientInterface: kubetest.NewFakeK8sClient(kubeObjs...),
	}
	svc := setupWorkloadService(t, k8s, conf)

	maxLines := 2
	duration, _ := time.ParseDuration("2h")
	podLogs := callStreamPodLogs(svc, "bookinfo", "details", "details", "details-v1-cf74bb974-wg44w", &LogOptions{Duration: &duration, LogType: models.LogTypeZtunnel, PodLogOptions: corev1.PodLogOptions{Container: "details"}, MaxLines: &maxLines})
	require.Equal(1, len(podLogs.Entries))
	entry := podLogs.Entries[0]

	assert.Equal("[ztunnel] src.addr=10.244.0.16:51748 src.workload=productpage-v1-87d54dd59-fzflt src.namespace=bookinfo src.identity=\"spiffe://cluster.local/ns/bookinfo/sa/bookinfo-productpage\" dst.addr=10.244.0.11:15008 dst.service=details.bookinfo.svc.cluster.local dst.workload=details-v1-cf74bb974-wg44w dst.namespace=bookinfo dst.identity=\"spiffe://cluster.local/ns/bookinfo/sa/bookinfo-details\" direction=\"outbound\" bytes_sent=200 bytes_recv=358 duration=\"1ms\"\n", entry.Message)
	assert.Equal("2024-04-12 10:31:51.078", entry.Timestamp)
	assert.NotNil(entry.AccessLog)
	assert.Equal("358", entry.AccessLog.BytesReceived)
	assert.Equal("200", entry.AccessLog.BytesSent)
	assert.Equal("1ms\n", entry.AccessLog.Duration)
	assert.Equal("spiffe://cluster.local/ns/bookinfo/sa/bookinfo-productpage", entry.AccessLog.UpstreamCluster)
	assert.Equal("details.bookinfo.svc.cluster.local", entry.AccessLog.RequestedServer)
	assert.Equal(int64(1712917911078), entry.TimestampUnix)

	podLogsQuotes := callStreamPodLogs(svc, "travel-agency", "cars", "cars", "cars-v1-6c869ff769-4hk27", &LogOptions{Duration: &duration, LogType: models.LogTypeZtunnel, PodLogOptions: corev1.PodLogOptions{Container: "details"}, MaxLines: &maxLines})
	require.Equal(2, len(podLogsQuotes.Entries))
	entryQuotes := podLogsQuotes.Entries[0]

	assert.Equal("[ztunnel] src.addr=10.244.0.118:51405 src.workload=\"cars-v1-6c869ff769-4hk27\" src.namespace=\"travel-agency\" src.identity=\"spiffe://cluster.local/ns/travel-agency/sa/default\" dst.addr=10.244.0.117:3306 dst.hbone_addr=10.244.0.117:3306 dst.service=\"mysqldb.travel-agency.svc.cluster.local\" dst.workload=\"mysqldb-v1-64bc584fdc-bb5vw\" dst.namespace=\"travel-agency\" dst.identity=\"spiffe://cluster.local/ns/travel-agency/sa/default\" direction=\"inbound\" bytes_sent=250 bytes_recv=206 duration=\"1ms\"\n", entryQuotes.Message)
	assert.Equal("2024-07-02 13:41:03.203", entryQuotes.Timestamp)
	assert.NotNil(entryQuotes.AccessLog)
	assert.Equal("206", entryQuotes.AccessLog.BytesReceived)
	assert.Equal("250", entryQuotes.AccessLog.BytesSent)
	assert.Equal("1ms\n", entryQuotes.AccessLog.Duration)
	assert.Equal("spiffe://cluster.local/ns/travel-agency/sa/default", entryQuotes.AccessLog.UpstreamCluster)
	assert.Equal("mysqldb.travel-agency.svc.cluster.local", entryQuotes.AccessLog.RequestedServer)
	assert.Equal(int64(1719927663203), entryQuotes.TimestampUnix)
}

func TestGetWaypointPodLogsProxy(t *testing.T) {
	assert := assert.New(t)
	require := require.New(t)
	conf := config.NewConfig()
	conf.IstioLabels.AppLabelName = "app"
	conf.IstioLabels.VersionLabelName = "version"
	config.Set(conf)

	// Setup mocks
	kubeObjs := []runtime.Object{
		FakePodWithWaypointAndDeployments(),
		&corev1.Namespace{ObjectMeta: metav1.ObjectMeta{Name: "Namespace"}},
	}
	for _, obj := range FakeWaypointPod() {
		o := obj
		kubeObjs = append(kubeObjs, &o)
	}

	for _, obj := range FakeWaypointNamespaceEnrolledPods(conf, true) {
		o := obj
		kubeObjs = append(kubeObjs, &o)
	}

	kubeObjs = append(kubeObjs,
		&apps_v1.Deployment{
			TypeMeta: metav1.TypeMeta{
				APIVersion: kubernetes.Deployments.GroupVersion().String(),
				Kind:       kubernetes.Deployments.Kind,
			},
			ObjectMeta: metav1.ObjectMeta{
				Name:      "waypoint",
				Namespace: "Namespace",
			},
			Spec: apps_v1.DeploymentSpec{
				Template: corev1.PodTemplateSpec{
					ObjectMeta: metav1.ObjectMeta{
						Labels: map[string]string{
							"gateway.istio.io/managed":               "istio.io-mesh-controller",
							"gateway.networking.k8s.io/gateway-name": "waypoint",
						},
					},
				},
			},
		},
	)

	client := kubetest.NewFakeK8sClient(kubeObjs...)
	client.OpenShift = true

	k8s := &logStreamer{
		logs:                FakePodLogsWaypoint().Logs,
		UserClientInterface: client,
	}

	svc := setupWorkloadService(t, k8s, conf)

	a, v := svc.GetWorkload(context.TODO(), WorkloadCriteria{Cluster: svc.conf.KubernetesConfig.ClusterName, Namespace: "Namespace", WorkloadName: "details", IncludeServices: false})
	assert.Nil(v)
	assert.NotNil(a)
	maxLines := 2
	duration, _ := time.ParseDuration("2h")
	podLogs := callStreamPodLogs(svc, "Namespace", "details", "details", "details-v1-cf74bb974-wg44w", &LogOptions{Duration: &duration, LogType: models.LogTypeWaypoint, PodLogOptions: corev1.PodLogOptions{Container: "details"}, MaxLines: &maxLines})
	require.Equal(2, len(podLogs.Entries))
	entry := podLogs.Entries[0]

	assert.Equal("[2025-01-30T12:10:13.279Z] \"GET /details/0 HTTP/1.1\" 200 - via_upstream - \"-\" 0 178 0 0 \"-\" \"Go-http-client/1.1\" \"e7d5b6ce-5f7f-9731-8471-ca5bcd650a72\" \"details:9080\" \"envoy://connect_originate/10.244.0.32:9080\" inbound-vip|9080|http|details.bookinfo.svc.cluster.local envoy://internal_client_address/ 10.96.185.196:9080 10.244.0.37:52134 - default", entry.Message)
	assert.Equal("2025-01-30 12:10:13.279", entry.Timestamp)
	assert.Equal("INFO", entry.Severity)
	assert.NotNil(entry.AccessLog)
	assert.Equal("0", entry.AccessLog.BytesReceived)
	assert.Equal("178", entry.AccessLog.BytesSent)
	assert.Equal("0", entry.AccessLog.Duration)
	assert.Equal("inbound-vip|9080|http|details.bookinfo.svc.cluster.local", entry.AccessLog.UpstreamCluster)
	assert.Equal("envoy://connect_originate/10.244.0.32:9080", entry.AccessLog.UpstreamService)
	assert.Equal("10.96.185.196:9080", entry.AccessLog.DownstreamLocal)
	assert.Equal("/details/0", entry.AccessLog.UriPath)
	assert.Equal("-", entry.AccessLog.RequestedServer)
	assert.Equal(int64(1738239013279), entry.TimestampUnix)
}

func TestDuplicatedControllers(t *testing.T) {
	assert := assert.New(t)
	require := require.New(t)

	// Disabling CustomDashboards on Workload details testing
	// otherwise this adds 10s to the test due to an http timeout.
	conf := config.NewConfig()
	conf.ExternalServices.CustomDashboards.Enabled = false
	conf.IstioLabels.AppLabelName = "app"
	conf.IstioLabels.VersionLabelName = "version"
	kubernetes.SetConfig(t, *conf)

	// Setup mocks
	kubeObjs := []runtime.Object{
		FakePodSyncedWithDeployments(conf),
		&corev1.Namespace{ObjectMeta: metav1.ObjectMeta{Name: "Namespace"}},
	}
	for _, obj := range FakeDuplicatedDeployments() {
		o := obj
		kubeObjs = append(kubeObjs, &o)
	}
	for _, obj := range FakeDuplicatedReplicaSets() {
		o := obj
		kubeObjs = append(kubeObjs, &o)
	}
	for _, obj := range FakeDuplicatedStatefulSets(conf) {
		o := obj
		kubeObjs = append(kubeObjs, &o)
	}
	for _, obj := range FakePodsSyncedWithDuplicated(conf) {
		o := obj
		kubeObjs = append(kubeObjs, &o)
	}
	k8s := kubetest.NewFakeK8sClient(kubeObjs...)
	k8s.OpenShift = true
	svc := setupWorkloadService(t, k8s, conf)

	criteria := WorkloadCriteria{Namespace: "Namespace", IncludeIstioResources: false, IncludeHealth: false}
	workloadList, err := svc.GetWorkloadList(context.TODO(), criteria)
	require.NoError(err)

	workloads := workloadList.Workloads

	criteria = WorkloadCriteria{Cluster: conf.KubernetesConfig.ClusterName, Namespace: "Namespace", WorkloadName: "duplicated-v1", WorkloadGVK: schema.GroupVersionKind{}, IncludeServices: false}
	workload, err := svc.GetWorkload(context.TODO(), criteria)

	require.NoError(err)
	assert.Equal(workloads[0].WorkloadGVK.String(), workload.WorkloadGVK.String())
}

func TestGetWorkloadListFromGenericPodController(t *testing.T) {
	assert := assert.New(t)
	require := require.New(t)
	conf := config.NewConfig()
	conf.IstioLabels.AppLabelName = "app"
	conf.IstioLabels.VersionLabelName = "version"
	config.Set(conf)

	pods := FakePodsSyncedWithDeployments(conf)

	// Doesn't matter what the type is as long as kiali doesn't recognize it as a workload.
	owner := &corev1.ConfigMap{
		ObjectMeta: metav1.ObjectMeta{
			Name: "testing",
			UID:  types.UID("f9952f02-5552-4b2c-afdb-441d859dbb36"),
		},
	}
	ref := metav1.NewControllerRef(owner, corev1.SchemeGroupVersion.WithKind("ConfigMap"))

	for i := range pods {
		pods[i].OwnerReferences = []metav1.OwnerReference{*ref}
	}

	// Setup mocks
	kubeObjs := []runtime.Object{
		&corev1.Namespace{ObjectMeta: metav1.ObjectMeta{Name: "Namespace"}},
	}
	for _, obj := range pods {
		o := obj
		kubeObjs = append(kubeObjs, &o)
	}
	k8s := kubetest.NewFakeK8sClient(kubeObjs...)
	k8s.OpenShift = true
	svc := setupWorkloadService(t, k8s, conf)

	// Disabling CustomDashboards on Workload details testing
	conf = config.Get()
	conf.ExternalServices.CustomDashboards.Enabled = false
	config.Set(conf)

	criteria := WorkloadCriteria{Namespace: "Namespace", IncludeIstioResources: false, IncludeHealth: false}
	workloadList, _ := svc.GetWorkloadList(context.TODO(), criteria)
	workloads := workloadList.Workloads

	criteria = WorkloadCriteria{Cluster: conf.KubernetesConfig.ClusterName, Namespace: "Namespace", WorkloadName: owner.Name, WorkloadGVK: schema.GroupVersionKind{}, IncludeServices: false}
	workload, err := svc.GetWorkload(context.TODO(), criteria)

	require.NoError(err)
	require.Equal(len(workloads), 1)
	require.NotNil(workload)

	assert.Equal(len(pods), len(workload.Pods))
}

func TestGetWorkloadListKindsWithSameName(t *testing.T) {
	assert := assert.New(t)

	// Disabling CustomDashboards on Workload details testing
	conf := config.NewConfig()
	conf.ExternalServices.CustomDashboards.Enabled = false
	conf.IstioLabels.AppLabelName = "app"
	conf.IstioLabels.VersionLabelName = "version"
	config.Set(conf)

	rs := FakeRSSyncedWithPods(conf)
	pods := FakePodsSyncedWithDeployments(conf)
	pods[0].OwnerReferences[0].APIVersion = kubernetes.ReplicaSets.GroupVersion().String()
	pods[0].OwnerReferences[0].Kind = kubernetes.ReplicaSets.Kind

	// Setup mocks
	kubeObjs := []runtime.Object{
		&corev1.Namespace{ObjectMeta: metav1.ObjectMeta{Name: "Namespace"}},
	}
	for _, obj := range rs {
		o := obj
		kubeObjs = append(kubeObjs, &o)
	}
	for _, obj := range pods {
		o := obj
		kubeObjs = append(kubeObjs, &o)
	}
	k8s := kubetest.NewFakeK8sClient(kubeObjs...)
	k8s.OpenShift = true
	svc := setupWorkloadService(t, k8s, conf)

	criteria := WorkloadCriteria{Namespace: "Namespace", IncludeIstioResources: false, IncludeHealth: false}
	workloadList, _ := svc.GetWorkloadList(context.TODO(), criteria)
	workloads := workloadList.Workloads

	assert.Equal(0, len(workloads))
}

func TestGetWorkloadListRSWithoutPrefix(t *testing.T) {
	assert := assert.New(t)

	// Disabling CustomDashboards on Workload details testing
	conf := config.NewConfig()
	conf.ExternalServices.CustomDashboards.Enabled = false
	conf.IstioLabels.AppLabelName = "app"
	conf.IstioLabels.VersionLabelName = "version"
	config.Set(conf)

	rs := FakeRSSyncedWithPods(conf)
	// Doesn't matter what the type is as long as kiali doesn't recognize it as a workload.
	owner := &corev1.ConfigMap{
		ObjectMeta: metav1.ObjectMeta{
			// Random prefix
			Name: "h79a3h-controlling-workload",
			UID:  types.UID("f9952f02-5552-4b2c-afdb-441d859dbb36"),
		},
		TypeMeta: metav1.TypeMeta{
			Kind: "ConfigMap",
		},
	}
	rs[0].OwnerReferences = []metav1.OwnerReference{*metav1.NewControllerRef(owner, corev1.SchemeGroupVersion.WithKind(owner.Kind))}
	pods := FakePodsSyncedWithDeployments(conf)

	// Setup mocks
	kubeObjs := []runtime.Object{
		&corev1.Namespace{ObjectMeta: metav1.ObjectMeta{Name: "Namespace"}},
	}
	for _, obj := range rs {
		o := obj
		kubeObjs = append(kubeObjs, &o)
	}
	for _, obj := range pods {
		o := obj
		kubeObjs = append(kubeObjs, &o)
	}
	k8s := kubetest.NewFakeK8sClient(kubeObjs...)
	k8s.OpenShift = true
	svc := setupWorkloadService(t, k8s, conf)

	criteria := WorkloadCriteria{Namespace: "Namespace", IncludeIstioResources: false, IncludeHealth: false}
	workloadList, _ := svc.GetWorkloadList(context.TODO(), criteria)
	workloads := workloadList.Workloads

	assert.Equal(1, len(workloads))
}

func TestGetWorkloadListRSOwnedByCustom(t *testing.T) {
	assert := assert.New(t)
	require := require.New(t)

	// Disabling CustomDashboards on Workload details testing
	conf := config.NewConfig()
	conf.ExternalServices.CustomDashboards.Enabled = false
	conf.KubernetesConfig.ClusterName = "east"
	conf.IstioLabels.AppLabelName = "app"
	conf.IstioLabels.VersionLabelName = "version"
	config.Set(conf)

	replicaSets := FakeRSSyncedWithPods(conf)

	// Doesn't matter what the type is as long as kiali doesn't recognize it as a workload.
	owner := &corev1.ConfigMap{
		ObjectMeta: metav1.ObjectMeta{
			Name: "controlling-workload",
			UID:  types.UID("f9952f02-5552-4b2c-afdb-441d859dbb36"),
		},
		TypeMeta: metav1.TypeMeta{
			Kind: "ConfigMap",
		},
	}
	ref := metav1.NewControllerRef(owner, corev1.SchemeGroupVersion.WithKind(owner.Kind))

	for i := range replicaSets {
		replicaSets[i].OwnerReferences = []metav1.OwnerReference{*ref}
	}

	pods := FakePodsSyncedWithDeployments(conf)

	// Setup mocks
	kubeObjs := []runtime.Object{
		&corev1.Namespace{ObjectMeta: metav1.ObjectMeta{Name: "Namespace"}},
	}
	for _, obj := range replicaSets {
		o := obj
		kubeObjs = append(kubeObjs, &o)
	}
	for _, obj := range pods {
		o := obj
		kubeObjs = append(kubeObjs, &o)
	}
	k8s := kubetest.NewFakeK8sClient(kubeObjs...)
	k8s.OpenShift = true
	svc := setupWorkloadService(t, k8s, conf)

	criteria := WorkloadCriteria{Cluster: conf.KubernetesConfig.ClusterName, Namespace: "Namespace", IncludeIstioResources: false, IncludeHealth: false}
	workloadList, err := svc.GetWorkloadList(context.TODO(), criteria)
	require.NoError(err)
	workloads := workloadList.Workloads

	criteria = WorkloadCriteria{Cluster: conf.KubernetesConfig.ClusterName, Namespace: "Namespace", WorkloadName: owner.Name, WorkloadGVK: schema.GroupVersionKind{}, IncludeServices: false}
	workload, _ := svc.GetWorkload(context.TODO(), criteria)

	require.Equal(len(workloads), 1)
	assert.NotNil(workload)

	criteria.WorkloadName = workloads[0].Name
	workload, _ = svc.GetWorkload(context.TODO(), criteria)

	assert.NotNil(workload)
}

func TestGetPodLogsWithoutAccessLogs(t *testing.T) {
	assert := assert.New(t)

	const logs = `2021-10-05T00:32:40.309334Z     debug   envoy http      [C57][S7648448766062793478] request end stream
2021-10-05T00:32:40.309425Z     debug   envoy router    [C57][S7648448766062793478] cluster 'inbound|9080||' match for URL '/details/0'
2021-10-05T00:32:40.309438Z     debug   envoy upstream  Using existing host 172.17.0.12:9080.
2021-10-05T00:32:40.309457Z     debug   envoy router    [C57][S7648448766062793478] router decoding headers:
2021-10-05T00:32:40.309457Z     ':authority', 'details:9080'
2021-10-05T00:32:40.309457Z     ':path', '/details/0'
2021-10-05T00:32:40.309457Z     ':method', 'GET'
2021-10-05T00:32:40.309457Z     ':scheme', 'http'`
	k8s := &logStreamer{
		logs:                logs,
		UserClientInterface: kubetest.NewFakeK8sClient(&corev1.Namespace{ObjectMeta: metav1.ObjectMeta{Name: "Namespace"}}),
	}
	conf := config.NewConfig()
	config.Set(conf)
	svc := setupWorkloadService(t, k8s, conf)

	podLogs := callStreamPodLogs(svc, "Namespace", "details", "details", "details-v1-3618568057-dnkjp", &LogOptions{LogType: models.LogTypeProxy, PodLogOptions: corev1.PodLogOptions{Container: "istio-proxy"}})

	assert.Equal(8, len(podLogs.Entries))
	for _, entry := range podLogs.Entries {
		assert.Nil(entry.AccessLog)
	}
}

func TestFilterUniqueIstioReferences(t *testing.T) {
	assert := assert.New(t)
	references := []*models.IstioValidationKey{
		{ObjectGVK: schema.GroupVersionKind{Group: "", Version: "", Kind: "t1"}, Namespace: "ns1", Name: "n1"},
		{ObjectGVK: schema.GroupVersionKind{Group: "", Version: "", Kind: "t1"}, Namespace: "ns1", Name: "n1"},
		{ObjectGVK: schema.GroupVersionKind{Group: "", Version: "", Kind: "t2"}, Namespace: "ns2", Name: "n2"},
	}
	filtered := FilterUniqueIstioReferences(references)
	assert.Equal(2, len(filtered))
}

func TestGetWorkloadMultiCluster(t *testing.T) {
	assert := assert.New(t)
	require := require.New(t)

	conf := config.NewConfig()
	conf.ExternalServices.Istio.IstioAPIEnabled = false
	conf.KubernetesConfig.ClusterName = "east"
	config.Set(conf)

	clients := map[string]kubernetes.UserClientInterface{
		"east": kubetest.NewFakeK8sClient(
			kubetest.FakeNamespace("bookinfo"),
			&apps_v1.Deployment{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "ratings-v1",
					Namespace: "bookinfo",
					Annotations: map[string]string{
						"unique-to-east": "true",
					},
				},
			},
		),
		"west": kubetest.NewFakeK8sClient(
			kubetest.FakeNamespace("bookinfo"),
			&apps_v1.Deployment{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "ratings-v1",
					Namespace: "bookinfo",
					Annotations: map[string]string{
						"unique-to-west": "true",
					},
				},
			},
		),
	}
	workloadService := NewLayerBuilder(t, conf).WithClients(clients).Build().Workload
	workload, err := workloadService.GetWorkload(context.TODO(), WorkloadCriteria{Cluster: "west", Namespace: "bookinfo", WorkloadName: "ratings-v1"})
	require.NoError(err)
	assert.Equal("west", workload.Cluster)
	assert.Contains(workload.Annotations, "unique-to-west")

	workload, err = workloadService.GetWorkload(context.TODO(), WorkloadCriteria{Cluster: "east", Namespace: "bookinfo", WorkloadName: "ratings-v1"})
	require.NoError(err)
	assert.Equal("east", workload.Cluster)
	assert.Contains(workload.Annotations, "unique-to-east")
}

// TestValidateWaypoint where the pod is enrolled
func TestValidateWaypoint(t *testing.T) {
	assert := assert.New(t)
	require := require.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	// Setup mocks
	kubeObjs := []runtime.Object{
		&corev1.Namespace{ObjectMeta: metav1.ObjectMeta{Name: "Namespace"}},
	}

	for _, obj := range FakeWaypointPod() {
		o := obj
		kubeObjs = append(kubeObjs, &o)
	}

	for _, obj := range FakeWaypointNamespaceEnrolledPods(conf, true) {
		o := obj
		kubeObjs = append(kubeObjs, &o)
	}

	kubeObjs = append(kubeObjs,
		&apps_v1.Deployment{
			TypeMeta: metav1.TypeMeta{
				APIVersion: kubernetes.Deployments.GroupVersion().String(),
				Kind:       kubernetes.Deployments.Kind,
			},
			ObjectMeta: metav1.ObjectMeta{
				Name:      "waypoint",
				Namespace: "Namespace",
			},
			Spec: apps_v1.DeploymentSpec{
				Template: corev1.PodTemplateSpec{
					ObjectMeta: metav1.ObjectMeta{
						Labels: map[string]string{
							"gateway.istio.io/managed":               "istio.io-mesh-controller",
							"gateway.networking.k8s.io/gateway-name": "waypoint",
						},
					},
				},
			},
		},
	)

	k8s := kubetest.NewFakeK8sClient(kubeObjs...)
	k8s.OpenShift = true
	svc := setupWorkloadService(t, k8s, conf)

	// Get waypoint proxy
	criteria := WorkloadCriteria{Cluster: conf.KubernetesConfig.ClusterName, Namespace: "Namespace", WorkloadName: "waypoint", WorkloadGVK: schema.GroupVersionKind{}, IncludeServices: false}
	workload, err := svc.GetWorkload(context.TODO(), criteria)

	require.NoError(err)
	require.NotNil(workload)

	assert.Equal(1, len(workload.Pods))
	assert.True(workload.IsWaypoint())

	// Get waypoint proxy
	criteriaDetails := WorkloadCriteria{Cluster: conf.KubernetesConfig.ClusterName, Namespace: "Namespace", WorkloadName: "details", WorkloadGVK: schema.GroupVersionKind{}, IncludeServices: false}
	workloadDetails, errDetails := svc.GetWorkload(context.TODO(), criteriaDetails)

	require.NoError(errDetails)
	require.NotNil(workloadDetails)

	assert.Equal(1, len(workloadDetails.Pods))
	assert.Equal(1, len(workloadDetails.WaypointWorkloads))
	assert.Equal("waypoint", workloadDetails.WaypointWorkloads[0].Name)

	// productPage should not have a waypoint
	criteriaProductPage := WorkloadCriteria{Cluster: conf.KubernetesConfig.ClusterName, Namespace: "Namespace", WorkloadName: "productpage", WorkloadGVK: schema.GroupVersionKind{}, IncludeServices: false}
	workloadProductPage, errProductPage := svc.GetWorkload(context.TODO(), criteriaProductPage)

	require.NoError(errProductPage)
	require.NotNil(workloadProductPage)

	assert.Equal(1, len(workloadProductPage.Pods))
	assert.Equal(0, len(workloadProductPage.WaypointWorkloads))
}

// TestValidateWaypointNS where the namespace is enrolled, not the pod
func TestValidateWaypointNS(t *testing.T) {
	assert := assert.New(t)
	require := require.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	waypointLabel := config.WaypointUseLabel

	// Setup mocks
	kubeObjs := []runtime.Object{
		&corev1.Namespace{ObjectMeta: metav1.ObjectMeta{Name: "Namespace", Labels: map[string]string{waypointLabel: "waypoint"}}},
	}

	for _, obj := range FakeWaypointPod() {
		o := obj
		kubeObjs = append(kubeObjs, &o)
	}

	for _, obj := range FakeWaypointNamespaceEnrolledPods(conf, false) {
		o := obj
		kubeObjs = append(kubeObjs, &o)
	}

	kubeObjs = append(kubeObjs,
		&apps_v1.Deployment{
			TypeMeta: metav1.TypeMeta{
				APIVersion: kubernetes.Deployments.GroupVersion().String(),
				Kind:       kubernetes.Deployments.Kind,
			},
			ObjectMeta: metav1.ObjectMeta{
				Name:      "waypoint",
				Namespace: "Namespace",
			},
			Spec: apps_v1.DeploymentSpec{
				Template: corev1.PodTemplateSpec{
					ObjectMeta: metav1.ObjectMeta{
						Labels: map[string]string{
							"gateway.istio.io/managed":               "istio.io-mesh-controller",
							"gateway.networking.k8s.io/gateway-name": "waypoint",
						},
					},
				},
			},
		},
	)

	k8s := kubetest.NewFakeK8sClient(kubeObjs...)
	k8s.OpenShift = true
	svc := setupWorkloadService(t, k8s, conf)

	// Get waypoint proxy
	criteria := WorkloadCriteria{Cluster: conf.KubernetesConfig.ClusterName, Namespace: "Namespace", WorkloadName: "waypoint", WorkloadGVK: schema.GroupVersionKind{}, IncludeServices: false}
	workload, err := svc.GetWorkload(context.TODO(), criteria)

	require.NoError(err)
	require.NotNil(workload)

	assert.Equal(1, len(workload.Pods))
	assert.True(workload.IsWaypoint())

	// Get waypoint proxy
	criteriaDetails := WorkloadCriteria{Cluster: conf.KubernetesConfig.ClusterName, Namespace: "Namespace", WorkloadName: "details", WorkloadGVK: schema.GroupVersionKind{}, IncludeServices: false}
	workloadDetails, errDetails := svc.GetWorkload(context.TODO(), criteriaDetails)

	require.NoError(errDetails)
	require.NotNil(workloadDetails)

	assert.Equal(1, len(workloadDetails.Pods))
	assert.Equal(1, len(workloadDetails.WaypointWorkloads))
	assert.Equal("waypoint", workloadDetails.WaypointWorkloads[0].Name)

	// productPage should have also a waypoint
	criteriaProductPage := WorkloadCriteria{Cluster: conf.KubernetesConfig.ClusterName, Namespace: "Namespace", WorkloadName: "productpage", WorkloadGVK: schema.GroupVersionKind{}, IncludeServices: false}
	workloadProductPage, errProductPage := svc.GetWorkload(context.TODO(), criteriaProductPage)

	require.NoError(errProductPage)
	require.NotNil(workloadProductPage)

	assert.Equal(1, len(workloadProductPage.Pods))
	assert.Equal(1, len(workloadProductPage.WaypointWorkloads))
	assert.Equal("waypoint", workloadProductPage.WaypointWorkloads[0].Name)
}

// TestValidateWaypoint where the service is enrolled
func TestValidateWaypointService(t *testing.T) {
	assert := assert.New(t)
	require := require.New(t)
	conf := config.NewConfig()
	conf.IstioLabels.AppLabelName = "app"
	conf.IstioLabels.VersionLabelName = "version"
	config.Set(conf)

	// Setup mocks
	kubeObjs := []runtime.Object{
		&corev1.Namespace{ObjectMeta: metav1.ObjectMeta{Name: "Namespace"}},
	}

	for _, obj := range FakeWaypointPod() {
		o := obj
		kubeObjs = append(kubeObjs, &o)
	}

	for _, obj := range FakeWaypointNamespaceEnrolledPods(conf, false) {
		o := obj
		kubeObjs = append(kubeObjs, &o)
	}

	for _, obj := range FakeWaypointNServiceEnrolledPods(conf) {
		o := obj
		kubeObjs = append(kubeObjs, &o)
	}

	kubeObjs = append(kubeObjs,
		&apps_v1.Deployment{
			TypeMeta: metav1.TypeMeta{
				APIVersion: kubernetes.Deployments.GroupVersion().String(),
				Kind:       kubernetes.Deployments.Kind,
			},
			ObjectMeta: metav1.ObjectMeta{
				Name:      "waypoint",
				Namespace: "Namespace",
			},
			Spec: apps_v1.DeploymentSpec{
				Template: corev1.PodTemplateSpec{
					ObjectMeta: metav1.ObjectMeta{
						Labels: map[string]string{
							"gateway.istio.io/managed":               "istio.io-mesh-controller",
							"gateway.networking.k8s.io/gateway-name": "waypoint",
						},
					},
				},
			},
		},
	)

	k8s := kubetest.NewFakeK8sClient(kubeObjs...)
	k8s.OpenShift = true
	svc := setupWorkloadService(t, k8s, conf)

	// Get waypoint proxy
	criteria := WorkloadCriteria{Cluster: conf.KubernetesConfig.ClusterName, Namespace: "Namespace", WorkloadName: "waypoint", WorkloadGVK: schema.GroupVersionKind{}, IncludeServices: false}
	waypoint, err := svc.GetWorkload(context.TODO(), criteria)

	require.NoError(err)
	require.NotNil(waypoint)

	require.Equal(1, len(waypoint.Pods))
	assert.True(waypoint.IsWaypoint())
	assert.NotNil(waypoint.WaypointServices)
	require.Equal(1, len(waypoint.WaypointServices))
	assert.Equal("details", waypoint.WaypointServices[0].Name)
	assert.Equal("Namespace", waypoint.WaypointServices[0].Namespace)
	assert.Equal("service", waypoint.WaypointServices[0].LabelType)

	// Get service
	criteriaDetails := WorkloadCriteria{Cluster: conf.KubernetesConfig.ClusterName, Namespace: "Namespace", WorkloadName: "details", WorkloadGVK: schema.GroupVersionKind{}, IncludeServices: false}
	workloadDetails, errDetails := svc.GetWorkload(context.TODO(), criteriaDetails)

	require.NoError(errDetails)
	require.NotNil(workloadDetails)

	require.Equal(1, len(workloadDetails.Pods))
	require.Equal(1, len(workloadDetails.WaypointWorkloads))
	assert.Equal("waypoint", workloadDetails.WaypointWorkloads[0].Name)

	// productPage should not have a waypoint
	criteriaProductPage := WorkloadCriteria{Cluster: conf.KubernetesConfig.ClusterName, Namespace: "Namespace", WorkloadName: "productpage", WorkloadGVK: schema.GroupVersionKind{}, IncludeServices: false}
	workloadProductPage, errProductPage := svc.GetWorkload(context.TODO(), criteriaProductPage)

	require.NoError(errProductPage)
	require.NotNil(workloadProductPage)

	assert.Equal(1, len(workloadProductPage.Pods))
	assert.Equal(0, len(workloadProductPage.WaypointWorkloads))
}

// TestGetWaypointWorkloads List of waypoint workloads
func TestGetWaypointWorkloads(t *testing.T) {
	assert := assert.New(t)
	require := require.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	// Setup mocks
	kubeObjs := []runtime.Object{
		&corev1.Namespace{ObjectMeta: metav1.ObjectMeta{Name: "Namespace", Labels: map[string]string{"istio.io/use-waypoint": "waypoint"}}},
	}

	for _, obj := range FakeWaypointPod() {
		o := obj
		kubeObjs = append(kubeObjs, &o)
	}

	for _, obj := range FakeWaypointNamespaceEnrolledPods(conf, true) {
		o := obj
		kubeObjs = append(kubeObjs, &o)
	}

	for _, obj := range FakeWaypointNServiceEnrolledPods(conf) {
		o := obj
		kubeObjs = append(kubeObjs, &o)
	}

	kubeObjs = append(kubeObjs,
		&apps_v1.Deployment{
			TypeMeta: metav1.TypeMeta{
				APIVersion: kubernetes.Deployments.GroupVersion().String(),
				Kind:       kubernetes.Deployments.Kind,
			},
			ObjectMeta: metav1.ObjectMeta{
				Name:      "waypoint",
				Namespace: "Namespace",
			},
			Spec: apps_v1.DeploymentSpec{
				Template: corev1.PodTemplateSpec{
					ObjectMeta: metav1.ObjectMeta{
						Labels: map[string]string{
							"gateway.istio.io/managed":               "istio.io-mesh-controller",
							"gateway.networking.k8s.io/gateway-name": "waypoint",
						},
					},
				},
			},
		},
	)

	k8s := kubetest.NewFakeK8sClient(kubeObjs...)
	k8s.OpenShift = true
	svc := setupWorkloadService(t, k8s, conf)

	// Get waypoint proxy
	criteria := WorkloadCriteria{Cluster: conf.KubernetesConfig.ClusterName, Namespace: "Namespace", WorkloadName: "waypoint", WorkloadGVK: schema.GroupVersionKind{}, IncludeServices: false}
	waypoint, err := svc.GetWorkload(context.TODO(), criteria)

	require.NoError(err)
	require.NotNil(waypoint)

	assert.Equal(1, len(waypoint.Pods))
	assert.True(waypoint.IsWaypoint())
	assert.False(waypoint.HasIstioAmbient())
	assert.NotNil(waypoint.WaypointWorkloads)
	assert.NotNil(waypoint.WaypointServices)

	// Get enrolled workload
	criteriaDetails := WorkloadCriteria{Cluster: conf.KubernetesConfig.ClusterName, Namespace: "Namespace", WorkloadName: "details", WorkloadGVK: schema.GroupVersionKind{}, IncludeServices: false}
	workloadDetails, errDetails := svc.GetWorkload(context.TODO(), criteriaDetails)

	require.NoError(errDetails)
	require.NotNil(workloadDetails)

	assert.Equal(1, len(workloadDetails.Pods))
	assert.Equal(1, len(workloadDetails.WaypointWorkloads))
	assert.Equal("waypoint", workloadDetails.WaypointWorkloads[0].Name)
	assert.Nil(workloadDetails.WaypointServices)

	// productPage should not have a waypoint
	criteriaProductPage := WorkloadCriteria{Cluster: conf.KubernetesConfig.ClusterName, Namespace: "Namespace", WorkloadName: "productpage", WorkloadGVK: schema.GroupVersionKind{}, IncludeServices: false}
	workloadProductPage, errProductPage := svc.GetWorkload(context.TODO(), criteriaProductPage)

	require.NoError(errProductPage)
	require.NotNil(workloadProductPage)

	assert.Equal(1, len(workloadProductPage.Pods))
	assert.Equal(1, len(workloadProductPage.WaypointWorkloads))
}

// TestValidateWaypoint validate waypoint proxy status
func TestValidateWaypointProxyStatus(t *testing.T) {
	assert := assert.New(t)
	require := require.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	// Setup mocks
	kubeObjs := []runtime.Object{
		&corev1.Namespace{ObjectMeta: metav1.ObjectMeta{Name: "Namespace"}},
	}

	for _, obj := range FakeWaypointPod() {
		o := obj
		kubeObjs = append(kubeObjs, &o)
	}

	for _, obj := range FakeWaypointNamespaceEnrolledPods(conf, true) {
		o := obj
		kubeObjs = append(kubeObjs, &o)
	}

	k8s := kubetest.NewFakeK8sClient(kubeObjs...)
	k8s.OpenShift = true
	svc := setupWorkloadService(t, k8s, conf)

	// Set cache proxy status
	ps := kubernetes.ProxyStatus{
		Pilot: "istiod-54b6586f84-9bgw2",
		SyncStatus: kubernetes.SyncStatus{
			ClusterID:     "",
			ProxyID:       "waypoint.Namespace",
			ProxyVersion:  "",
			IstioVersion:  "1.24.1",
			ClusterSent:   "2024-12-05T09:04:18Z/388d498c74-bc9a-4fa8-a658-36fe2a752d32",
			ClusterAcked:  "2024-12-05T09:04:18Z/388d498c74-bc9a-4fa8-a658-36fe2a752d32",
			ListenerSent:  "2024-12-05T09:04:18Z/38936e5b48-b856-4ec4-94b0-0ef0f085aca5",
			ListenerAcked: "2024-12-05T09:04:18Z/38936e5b48-b856-4ec4-94b0-0ef0f085aca5",
			RouteSent:     "",
			RouteAcked:    "",
			EndpointSent:  "2024-12-05T09:04:18Z/3889678ca1-9e60-4c11-973e-c7fdbc338d92",
			EndpointAcked: "2024-12-05T09:04:18Z/3889678ca1-9e60-4c11-973e-c7fdbc338d92",
		},
	}
	psArr := []*kubernetes.ProxyStatus{&ps}
	svc.cache.SetPodProxyStatus(psArr)

	// Get waypoint proxy
	criteria := WorkloadCriteria{Cluster: conf.KubernetesConfig.ClusterName, Namespace: "Namespace", WorkloadName: "waypoint", WorkloadGVK: schema.GroupVersionKind{}, IncludeServices: false}
	workload, err := svc.GetWorkload(context.TODO(), criteria)

	require.NoError(err)
	require.NotNil(workload)

	assert.Equal(1, len(workload.Pods))
	assert.False(workload.IsGateway())
	assert.True(workload.IsWaypoint())

	pod := workload.Pods[0]
	assert.NotNil(pod.ProxyStatus)
	assert.Equal(pod.ProxyStatus.CDS, "Synced")
	assert.Equal(pod.ProxyStatus.EDS, "Synced")
	assert.Equal(pod.ProxyStatus.LDS, "Synced")
	assert.Equal(pod.ProxyStatus.RDS, "IGNORED")
}

func TestGetWorkloadSetsIsGateway(t *testing.T) {
	require := require.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	k8s := kubetest.NewFakeK8sClient(
		&corev1.Namespace{ObjectMeta: metav1.ObjectMeta{Name: "Namespace"}},
		&apps_v1.Deployment{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "ingress-gateway",
				Namespace: "Namespace",
			},
			Spec: apps_v1.DeploymentSpec{
				Template: corev1.PodTemplateSpec{
					ObjectMeta: metav1.ObjectMeta{
						Labels: map[string]string{
							"istio.io/gateway-name": "ingress-gateway",
						},
					},
				},
			},
		},
	)
	svc := setupWorkloadService(t, k8s, conf)

	criteria := WorkloadCriteria{Cluster: conf.KubernetesConfig.ClusterName, Namespace: "Namespace", WorkloadName: "ingress-gateway", IncludeServices: false}
	workload, err := svc.GetWorkload(context.TODO(), criteria)
	require.NoError(err)

	require.True(workload.WorkloadListItem.IsGateway, "Expected IsGateway to be True but it was false")
}

func TestGetAllGateways(t *testing.T) {
	require := require.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	k8s := kubetest.NewFakeK8sClient(
		&corev1.Namespace{ObjectMeta: metav1.ObjectMeta{Name: "Namespace"}},
		&apps_v1.Deployment{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "ingress-gateway",
				Namespace: "Namespace",
			},
			Spec: apps_v1.DeploymentSpec{
				Template: corev1.PodTemplateSpec{
					ObjectMeta: metav1.ObjectMeta{
						Labels: map[string]string{
							"istio.io/gateway-name": "ingress-gateway",
						},
					},
				},
			},
		},
		&apps_v1.Deployment{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "non-gateway-workload",
				Namespace: "Namespace",
			},
		},
	)
	svc := setupWorkloadService(t, k8s, conf)

	gateways, err := svc.GetGateways(context.Background())
	require.NoError(err)
	gateways = sliceutil.Filter(gateways, func(gw *models.Workload) bool {
		return gw.Cluster == conf.KubernetesConfig.ClusterName
	})

	require.Len(gateways, 1)
	require.True(gateways[0].IsGateway(), "Expected IsGateway to be True but it was false")
}

func TestGetWorkloadListWithCustomKindThatMatchesCoreKind(t *testing.T) {
	assert := assert.New(t)
	require := require.New(t)

	conf := config.NewConfig()

	kubeObjs := []runtime.Object{
		&corev1.Namespace{ObjectMeta: metav1.ObjectMeta{Name: "Namespace"}},
	}
	for _, pod := range FakePodsFromCustomController(conf) {
		p := pod
		// Setting here a custom type whose Kind matches a core Kube type.
		p.OwnerReferences[0].APIVersion = "customAPI/v1"
		p.OwnerReferences[0].Kind = "DaemonSet"
		kubeObjs = append(kubeObjs, &p)
	}

	k8s := kubetest.NewFakeK8sClient(kubeObjs...)
	k8s.OpenShift = true
	svc := setupWorkloadService(t, k8s, conf)

	criteria := WorkloadCriteria{Namespace: "Namespace", IncludeIstioResources: false, IncludeHealth: false}
	workloadList, err := svc.GetWorkloadList(context.TODO(), criteria)
	require.NoError(err)
	workloads := workloadList.Workloads

	assert.Equal("Namespace", workloadList.Namespace)

	require.Equal(1, len(workloads))
	assert.Equal("custom-controller-123", workloads[0].Name)
	assert.Equal("DaemonSet", workloads[0].WorkloadGVK.Kind)
}

// FakePodLogsZtunnelPrefixNamespaces returns ztunnel access log lines for two
// namespaces where one name is a prefix of the other ("bookinfo" and
// "bookinfo-evil"), with workload names sharing prefixes ("v" vs "victim-*"),
// in both the quoted and unquoted value forms. These lines reproduce the
// prefix-matching leak: with unanchored filter patterns, a user filtering for
// namespace "bookinfo" and a one-letter pod name "v" would see them.
func FakePodLogsZtunnelPrefixNamespaces() *kubernetes.PodLogs {
	return &kubernetes.PodLogs{
		Logs: `2024-07-02T13:41:03.203349Z	info	access	connection complete	src.addr=10.244.0.123:43847 src.workload="victim-app-1" src.namespace="bookinfo-evil" src.identity="spiffe://cluster.local/ns/bookinfo-evil/sa/default" dst.addr=10.244.0.117:3306 dst.service="victim-svc.bookinfo-evil.svc.cluster.local" dst.workload="victim-db-1" dst.namespace="bookinfo-evil" dst.identity="spiffe://cluster.local/ns/bookinfo-evil/sa/default" direction="inbound" bytes_sent=250 bytes_recv=206 duration="1ms"
2024-07-02T13:41:03.203467Z	info	access	connection complete	src.addr=10.244.0.120:36632 src.workload=victim-app-2 src.namespace=bookinfo-evil src.identity="spiffe://cluster.local/ns/bookinfo-evil/sa/default" dst.addr=10.244.0.117:15008 dst.service=victim-svc.bookinfo-evil.svc.cluster.local dst.workload=victim-db-2 dst.namespace=bookinfo-evil dst.identity="spiffe://cluster.local/ns/bookinfo-evil/sa/default" direction="outbound" bytes_sent=208 bytes_recv=281 duration="1ms"
2024-07-02T13:41:04.502606Z	info	access	connection complete	src.addr=10.244.0.7:37222 src.workload="votes-v1-abcde" src.namespace="bookinfo" dst.addr=10.244.0.101:9080 dst.service="votes.bookinfo.svc.cluster.local" dst.workload="victim-app-1" dst.namespace="bookinfo" direction="inbound" bytes_sent=2913 bytes_recv=293 duration="2ms"
`,
	}
}

// TestZtunnelFilterPatternsExactMatch asserts the anchored patterns match lines
// with the exact namespace/workload/service names, in both quoted and unquoted
// value forms.
func TestZtunnelFilterPatternsExactMatch(t *testing.T) {
	assert := assert.New(t)
	require := require.New(t)

	filter, err := ztunnelFilterPatterns("bookinfo", "details-v1-cf74bb974-wg44w", "details")
	require.NoError(err)

	// (srcNs && srcWk) clause, quoted and unquoted forms.
	assert.True(filterMatches(`[ztunnel] src.addr=1.2.3.4:1 src.workload="details-v1-cf74bb974-wg44w" src.namespace="bookinfo" dst.workload="other" dst.namespace="other-ns"`, filter))
	assert.True(filterMatches(`[ztunnel] src.addr=1.2.3.4:1 src.workload=details-v1-cf74bb974-wg44w src.namespace=bookinfo dst.workload=other dst.namespace=other-ns`, filter))
	// (destNs && destWk) clause.
	assert.True(filterMatches(`[ztunnel] src.workload="other" src.namespace="other-ns" dst.workload="details-v1-cf74bb974-wg44w" dst.namespace="bookinfo"`, filter))
	// destSvc clause, quoted and unquoted forms.
	assert.True(filterMatches(`[ztunnel] src.workload="other" src.namespace="other-ns" dst.service="details.bookinfo.svc.cluster.local"`, filter))
	assert.True(filterMatches(`[ztunnel] src.workload="other" src.namespace="other-ns" dst.service=details.bookinfo.svc.cluster.local`, filter))
}

// TestZtunnelFilterPatternsPrefixPodName asserts a one-letter / prefix pod name
// with the victim namespace returns zero lines: the workload patterns are
// anchored to the full field value.
func TestZtunnelFilterPatternsPrefixPodName(t *testing.T) {
	assert := assert.New(t)
	require := require.New(t)

	// Filter for pod name "v" in the victim namespace: must not match any
	// workload whose name merely starts with "v".
	filter, err := ztunnelFilterPatterns("bookinfo-evil", "v", "v")
	require.NoError(err)

	lines := []string{
		`[ztunnel] src.workload="victim-app-1" src.namespace="bookinfo-evil" dst.workload="victim-db-1" dst.namespace="bookinfo-evil" dst.service="victim-svc.bookinfo-evil.svc.cluster.local"`,
		`[ztunnel] src.workload=victim-app-2 src.namespace=bookinfo-evil dst.workload=victim-db-2 dst.namespace=bookinfo-evil dst.service=victim-svc.bookinfo-evil.svc.cluster.local`,
	}
	for _, line := range lines {
		assert.False(filterMatches(line, filter), line)
	}
}

// TestZtunnelFilterPatternsPrefixNamespace asserts a namespace whose name is a
// prefix of another namespace's name does not leak the latter's lines. This is
// the case that survives a handler-level namespace check alone if the anchoring
// is missing, so it is asserted for all five patterns.
func TestZtunnelFilterPatternsPrefixNamespace(t *testing.T) {
	assert := assert.New(t)
	require := require.New(t)

	filter, err := ztunnelFilterPatterns("bookinfo", "details-v1-cf74bb974-wg44w", "details")
	require.NoError(err)

	// Lines about "bookinfo-evil" (its name starts with "bookinfo"): none of the
	// five patterns may match them, through either the src or dst fields.
	lines := []string{
		`[ztunnel] src.workload="evil-app-1" src.namespace="bookinfo-evil" dst.workload="details-v1-cf74bb974-wg44w" dst.namespace="bookinfo-evil" dst.service="evil-svc.bookinfo-evil.svc.cluster.local"`,
		`[ztunnel] src.workload=evil-app-2 src.namespace=bookinfo-evil dst.workload=details-v1-cf74bb974-wg44w dst.namespace=bookinfo-evil dst.service=evil-svc.bookinfo-evil.svc.cluster.local`,
		`[ztunnel] src.workload="details-v1-cf74bb974-wg44w" src.namespace="bookinfo-evil" dst.workload="evil-app-1" dst.namespace="bookinfo-evil"`,
		`[ztunnel] src.workload="evil-app-1" src.namespace="bookinfo" dst.workload="evil-app-2" dst.namespace="bookinfo-evil" dst.service="details.bookinfo-evil.svc.cluster.local"`,
	}
	for _, line := range lines {
		assert.False(filterMatches(line, filter), line)
	}
}

// TestZtunnelFilterPatternsServicePattern asserts the service pattern positively
// first (a pattern that matches nothing passes negative-only tests, and the
// existing TestGetZtunnelPodLogsProxy will not catch it because its lines match
// via the (destNs && destWk) clause), then the negatives.
func TestZtunnelFilterPatternsServicePattern(t *testing.T) {
	assert := assert.New(t)
	require := require.New(t)

	filter, err := ztunnelFilterPatterns("n", "some-pod", "s")
	require.NoError(err)

	// Positive: a filter for service "s" in namespace "n" must match the service
	// FQDN in both quoted and unquoted forms.
	assert.True(filterMatches(`[ztunnel] dst.service="s.n.svc.cluster.local"`, filter))
	assert.True(filterMatches(`[ztunnel] dst.service=s.n.svc.cluster.local`, filter))

	// Negative: different service, different namespace, or a namespace whose
	// name merely starts with "n".
	assert.False(filterMatches(`[ztunnel] dst.service="s2.n.svc.cluster.local"`, filter))
	assert.False(filterMatches(`[ztunnel] dst.service="s.n2.svc.cluster.local"`, filter))
	assert.False(filterMatches(`[ztunnel] dst.service="s.n-evil.svc.cluster.local"`, filter))
	assert.False(filterMatches(`[ztunnel] dst.service="s2.n-evil.svc.cluster.local"`, filter))
	// A service name that merely starts with "s" must not match either.
	assert.False(filterMatches(`[ztunnel] dst.service="s2-other.n.svc.cluster.local"`, filter))
}

// TestGetZtunnelPodLogsPrefixNamespace reproduces the prefix-namespace attack
// end-to-end through StreamPodLogs: a user filtering for namespace "bookinfo"
// (a prefix of "bookinfo-evil") with a one-letter pod name "v" must get zero
// lines, while the exact names still return the lines.
func TestGetZtunnelPodLogsPrefixNamespace(t *testing.T) {
	assert := assert.New(t)
	require := require.New(t)
	conf := config.NewConfig()
	conf.IstioLabels.AppLabelName = "app"
	conf.IstioLabels.VersionLabelName = "version"
	kubernetes.SetConfig(t, *conf)

	kubeObjs := []runtime.Object{
		FakePodSyncedWithDeployments(conf),
		&corev1.Namespace{ObjectMeta: metav1.ObjectMeta{Name: "bookinfo"}},
		&corev1.Namespace{ObjectMeta: metav1.ObjectMeta{Name: "bookinfo-evil"}},
	}
	for _, obj := range FakeZtunnelDaemonSet(conf) {
		o := obj
		kubeObjs = append(kubeObjs, &o)
	}
	for _, obj := range FakeZtunnelPods(conf) {
		o := obj
		kubeObjs = append(kubeObjs, &o)
	}
	k8s := &logStreamer{
		logs:                FakePodLogsZtunnelPrefixNamespaces().Logs,
		UserClientInterface: kubetest.NewFakeK8sClient(kubeObjs...),
	}
	svc := setupWorkloadService(t, k8s, conf)

	// The attacker's filter: their own namespace "bookinfo" and a one-letter pod
	// prefix "v". Under the old unanchored patterns every line of the fixture
	// matched; with the anchored patterns nothing does.
	podLogs := callStreamPodLogs(svc, "bookinfo", "v", "v", "v", &LogOptions{LogType: models.LogTypeZtunnel, PodLogOptions: corev1.PodLogOptions{Container: "details"}})
	require.Equal(0, len(podLogs.Entries))

	// Filtering for the exact names still returns the lines (positive control).
	podLogs = callStreamPodLogs(svc, "bookinfo-evil", "victim-app-1", "victim-app-1", "victim-app-1", &LogOptions{LogType: models.LogTypeZtunnel, PodLogOptions: corev1.PodLogOptions{Container: "details"}})
	require.Equal(1, len(podLogs.Entries))
	assert.Contains(podLogs.Entries[0].Message, `src.workload="victim-app-1"`)
}

// ztunnelFilterTestDump builds a dump with entries in three namespaces for the
// filter tests.
func ztunnelFilterTestDump() *kubernetes.ZtunnelConfigDump {
	return &kubernetes.ZtunnelConfigDump{
		Certificates: []kubernetes.Certificate{
			{Identity: "spiffe://cluster.local/ns/bookinfo/sa/default", State: "READY"},
		},
		Config: kubernetes.Config{ClusterDomain: "cluster.local"},
		Policies: []any{
			map[string]any{"name": "policy-bookinfo", "namespace": "bookinfo"},
			map[string]any{"name": "policy-victim", "namespace": "victim-ns"},
			map[string]any{"name": "policy-no-namespace"},
			"not-a-map",
		},
		Services: []kubernetes.Service{
			{Name: "svc-bookinfo", Namespace: "bookinfo"},
			{Name: "svc-victim", Namespace: "victim-ns"},
		},
		Workloads: []kubernetes.Workload{
			{Name: "wl-bookinfo", Namespace: "bookinfo"},
			{Name: "wl-victim", Namespace: "victim-ns"},
		},
	}
}

// TestFilterZtunnelDump asserts the dump filter keeps only accessible-namespace
// entries, drops certificates, fails closed on unparsable policies, and keeps
// the Config (ztunnel pod's own settings) as-is.
func TestFilterZtunnelDump(t *testing.T) {
	assert := assert.New(t)

	dump := ztunnelFilterTestDump()
	accessible := map[string]struct{}{"bookinfo": {}}

	filtered := filterZtunnelDump(dump, accessible)

	// Workloads and Services: only the accessible namespace's entries, kept
	// byte-for-byte.
	require.Len(t, filtered.Workloads, 1)
	assert.Equal(kubernetes.Workload{Name: "wl-bookinfo", Namespace: "bookinfo"}, filtered.Workloads[0])
	require.Len(t, filtered.Services, 1)
	assert.Equal(kubernetes.Service{Name: "svc-bookinfo", Namespace: "bookinfo"}, filtered.Services[0])

	// Policies: accessible namespace kept; inaccessible, missing-namespace and
	// unparsable entries dropped (fail closed).
	require.Len(t, filtered.Policies, 1)
	assert.Equal(map[string]any{"name": "policy-bookinfo", "namespace": "bookinfo"}, filtered.Policies[0])

	// Certificates are omitted.
	assert.Empty(filtered.Certificates)

	// Config is kept.
	assert.Equal("cluster.local", filtered.Config.ClusterDomain)

	// A completely filtered result must serialize the collections as [] rather
	// than null: the UI tolerates null without crashing but renders its
	// service/workload count labels incorrectly.
	emptyFiltered := filterZtunnelDump(dump, map[string]struct{}{})
	require.NotNil(t, emptyFiltered)
	marshaled, err := json.Marshal(emptyFiltered)
	require.NoError(t, err)
	assert.Contains(string(marshaled), `"workloads":[]`)
	assert.Contains(string(marshaled), `"services":[]`)
	assert.Contains(string(marshaled), `"policies":[]`)
	assert.Contains(string(marshaled), `"certificates":[]`)
}

// TestGetZtunnelConfigFiltersAndCacheIsUnmutated asserts that GetZtunnelConfig
// filters the dump to the user's accessible namespaces AND that the cached,
// shared dump is never mutated: a direct GetZtunnelDump afterwards must still
// return the complete dump.
func TestGetZtunnelConfigFiltersAndCacheIsUnmutated(t *testing.T) {
	assert := assert.New(t)
	require := require.New(t)

	conf := config.NewConfig()
	cluster := conf.KubernetesConfig.ClusterName
	// The fake client only holds the "bookinfo" namespace: that is the full
	// accessible set for this user.
	k8s := kubetest.NewFakeK8sClient(&corev1.Namespace{ObjectMeta: metav1.ObjectMeta{Name: "bookinfo"}})
	prom := new(prometheustest.PromClientMock)
	prom.MockMetricsForLabels(context.Background(), []string{})
	svc := NewLayerBuilder(t, conf).WithClient(k8s).WithProm(prom).Build().Workload

	dump := ztunnelFilterTestDump()
	svc.cache.SetZtunnelDump(cluster+"ztunnel-test", dump)

	filtered, err := svc.GetZtunnelConfig(context.TODO(), cluster, "ztunnel-test")
	require.NoError(err)
	require.NotNil(filtered)

	// Filtered to the accessible namespace only.
	assert.Len(filtered.Workloads, 1)
	assert.Len(filtered.Services, 1)
	assert.Len(filtered.Policies, 1)
	assert.Empty(filtered.Certificates)

	// The cache still holds the full, unfiltered dump.
	cached := svc.cache.GetZtunnelDump(cluster, "ztunnel-test")
	require.NotNil(cached)
	assert.Len(cached.Workloads, 2)
	assert.Len(cached.Services, 2)
	assert.Len(cached.Policies, 4)
	assert.Len(cached.Certificates, 1)
}
