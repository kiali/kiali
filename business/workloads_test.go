package business

import (
	"context"
	"encoding/json"
	"io"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	osproject_v1 "github.com/openshift/api/project/v1"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apps_v1 "k8s.io/api/apps/v1"
	core_v1 "k8s.io/api/core/v1"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/types"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/cache"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/prometheus/prometheustest"
)

func setupWorkloadService(k8s kubernetes.ClientInterface, conf *config.Config) WorkloadService {
	// config needs to be set by other services since those rely on the global.
	prom := new(prometheustest.PromClientMock)
	k8sclients := make(map[string]kubernetes.ClientInterface)
	k8sclients[conf.KubernetesConfig.ClusterName] = k8s
	return NewWithBackends(k8sclients, k8sclients, prom, nil).Workload
}

func callStreamPodLogs(svc WorkloadService, namespace, podName string, opts *LogOptions) PodLog {
	w := httptest.NewRecorder()

	_ = svc.StreamPodLogs(svc.config.KubernetesConfig.ClusterName, namespace, podName, opts, w)

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
	config.Set(conf)

	// Setup mocks
	kubeObjs := []runtime.Object{
		&osproject_v1.Project{ObjectMeta: v1.ObjectMeta{Name: "Namespace"}},
	}
	for _, obj := range FakeDeployments(*conf) {
		o := obj
		kubeObjs = append(kubeObjs, &o)
	}
	k8s := kubetest.NewFakeK8sClient(kubeObjs...)
	k8s.OpenShift = true
	SetupBusinessLayer(t, k8s, *conf)
	svc := setupWorkloadService(k8s, config.NewConfig())

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

func TestGetWorkloadListFromReplicaSets(t *testing.T) {
	assert := assert.New(t)
	require := require.New(t)

	conf := config.NewConfig()
	config.Set(conf)

	// Setup mocks
	kubeObjs := []runtime.Object{
		&osproject_v1.Project{ObjectMeta: v1.ObjectMeta{Name: "Namespace"}},
	}
	for _, obj := range FakeReplicaSets(*conf) {
		o := obj
		kubeObjs = append(kubeObjs, &o)
	}
	k8s := kubetest.NewFakeK8sClient(kubeObjs...)
	k8s.OpenShift = true
	SetupBusinessLayer(t, k8s, *conf)
	svc := setupWorkloadService(k8s, config.NewConfig())

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

	// Setup mocks
	kubeObjs := []runtime.Object{
		&osproject_v1.Project{ObjectMeta: v1.ObjectMeta{Name: "Namespace"}},
	}
	for _, obj := range FakeReplicationControllers() {
		o := obj
		kubeObjs = append(kubeObjs, &o)
	}
	k8s := kubetest.NewFakeK8sClient(kubeObjs...)
	k8s.OpenShift = true
	SetupBusinessLayer(t, k8s, *config.NewConfig())
	svc := setupWorkloadService(k8s, config.NewConfig())
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

	// Setup mocks
	kubeObjs := []runtime.Object{
		&osproject_v1.Project{ObjectMeta: v1.ObjectMeta{Name: "Namespace"}},
	}
	for _, obj := range FakeDeploymentConfigs() {
		o := obj
		kubeObjs = append(kubeObjs, &o)
	}
	k8s := kubetest.NewFakeK8sClient(kubeObjs...)
	k8s.OpenShift = true
	SetupBusinessLayer(t, k8s, *config.NewConfig())
	svc := setupWorkloadService(k8s, config.NewConfig())
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

	// Setup mocks
	kubeObjs := []runtime.Object{
		&osproject_v1.Project{ObjectMeta: v1.ObjectMeta{Name: "Namespace"}},
	}
	for _, obj := range FakeStatefulSets() {
		o := obj
		kubeObjs = append(kubeObjs, &o)
	}
	k8s := kubetest.NewFakeK8sClient(kubeObjs...)
	k8s.OpenShift = true
	SetupBusinessLayer(t, k8s, *config.NewConfig())
	svc := setupWorkloadService(k8s, config.NewConfig())
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

	// Setup mocks
	kubeObjs := []runtime.Object{
		&osproject_v1.Project{ObjectMeta: v1.ObjectMeta{Name: "Namespace"}},
	}
	for _, obj := range FakeDaemonSets() {
		o := obj
		kubeObjs = append(kubeObjs, &o)
	}
	k8s := kubetest.NewFakeK8sClient(kubeObjs...)
	k8s.OpenShift = true
	SetupBusinessLayer(t, k8s, *config.NewConfig())
	svc := setupWorkloadService(k8s, config.NewConfig())
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

	// Setup mocks
	kubeObjs := []runtime.Object{
		&osproject_v1.Project{ObjectMeta: v1.ObjectMeta{Name: "Namespace"}},
	}
	for _, obj := range FakeDepSyncedWithRS() {
		o := obj
		kubeObjs = append(kubeObjs, &o)
	}
	for _, obj := range FakeRSSyncedWithPods() {
		o := obj
		kubeObjs = append(kubeObjs, &o)
	}
	for _, obj := range FakePodsSyncedWithDeployments() {
		o := obj
		kubeObjs = append(kubeObjs, &o)
	}
	k8s := kubetest.NewFakeK8sClient(kubeObjs...)
	k8s.OpenShift = true
	SetupBusinessLayer(t, k8s, *config.NewConfig())
	svc := setupWorkloadService(k8s, config.NewConfig())

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

	// Setup mocks
	kubeObjs := []runtime.Object{
		&osproject_v1.Project{ObjectMeta: v1.ObjectMeta{Name: "Namespace"}},
	}
	for _, obj := range FakePodsNoController() {
		o := obj
		kubeObjs = append(kubeObjs, &o)
	}
	k8s := kubetest.NewFakeK8sClient(kubeObjs...)
	k8s.OpenShift = true
	SetupBusinessLayer(t, k8s, *config.NewConfig())
	svc := setupWorkloadService(k8s, config.NewConfig())

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

	// Setup mocks
	kubeObjs := []runtime.Object{
		&osproject_v1.Project{ObjectMeta: v1.ObjectMeta{Name: "Namespace"}},
	}
	for _, obj := range FakeCustomControllerRSSyncedWithPods() {
		o := obj
		kubeObjs = append(kubeObjs, &o)
	}
	for _, obj := range FakePodsFromCustomController() {
		o := obj
		kubeObjs = append(kubeObjs, &o)
	}
	k8s := kubetest.NewFakeK8sClient(kubeObjs...)
	k8s.OpenShift = true
	SetupBusinessLayer(t, k8s, *config.NewConfig())
	svc := setupWorkloadService(k8s, config.NewConfig())

	criteria := WorkloadCriteria{Namespace: "Namespace", IncludeIstioResources: false, IncludeHealth: false}
	workloadList, _ := svc.GetWorkloadList(context.TODO(), criteria)
	workloads := workloadList.Workloads

	assert.Equal("Namespace", workloadList.Namespace)

	require.Equal(1, len(workloads))
	assert.Equal("custom-controller-RS-123", workloads[0].Name)
	assert.Equal("ReplicaSet", workloads[0].WorkloadGVK.Kind)
	assert.Equal(true, workloads[0].AppLabel)
	assert.Equal(true, workloads[0].VersionLabel)
}

func TestGetWorkloadFromDeployment(t *testing.T) {
	assert := assert.New(t)
	require := require.New(t)

	// Disabling CustomDashboards on Workload details testing
	conf := config.NewConfig()
	conf.ExternalServices.CustomDashboards.Enabled = false
	kubernetes.SetConfig(t, *conf)

	// Setup mocks
	kubeObjs := []runtime.Object{
		&osproject_v1.Project{ObjectMeta: v1.ObjectMeta{Name: "Namespace"}},
		&FakeDepSyncedWithRS()[0],
	}
	for _, o := range FakeRSSyncedWithPods() {
		kubeObjs = append(kubeObjs, &o)
	}
	for _, o := range FakePodsSyncedWithDeployments() {
		kubeObjs = append(kubeObjs, &o)
	}
	k8s := kubetest.NewFakeK8sClient(kubeObjs...)
	k8s.OpenShift = true
	SetupBusinessLayer(t, k8s, *conf)
	svc := setupWorkloadService(k8s, conf)

	criteria := WorkloadCriteria{Cluster: conf.KubernetesConfig.ClusterName, Namespace: "Namespace", WorkloadName: "details-v1", WorkloadGVK: schema.GroupVersionKind{}, IncludeServices: false}
	workload, err := svc.GetWorkload(context.TODO(), criteria)
	require.NoError(err)

	assert.Equal("details-v1", workload.Name)
	assert.Equal("Deployment", workload.WorkloadGVK.Kind)
	assert.Equal(true, workload.AppLabel)
	assert.Equal(true, workload.VersionLabel)
}

func TestGetWorkloadWithInvalidWorkloadType(t *testing.T) {
	assert := assert.New(t)
	require := require.New(t)

	// Disabling CustomDashboards on Workload details testing
	// otherwise this adds 10s to the test due to an http timeout.
	conf := config.NewConfig()
	conf.ExternalServices.CustomDashboards.Enabled = false
	kubernetes.SetConfig(t, *conf)

	// Setup mocks
	kubeObjs := []runtime.Object{
		&FakeDepSyncedWithRS()[0],
		&osproject_v1.Project{ObjectMeta: v1.ObjectMeta{Name: "Namespace"}},
	}
	for _, obj := range FakeRSSyncedWithPods() {
		o := obj
		kubeObjs = append(kubeObjs, &o)
	}
	for _, obj := range FakePodsSyncedWithDeployments() {
		o := obj
		kubeObjs = append(kubeObjs, &o)
	}
	k8s := kubetest.NewFakeK8sClient(kubeObjs...)
	k8s.OpenShift = true
	SetupBusinessLayer(t, k8s, *conf)
	svc := setupWorkloadService(k8s, conf)

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
	kubernetes.SetConfig(t, *conf)

	// Setup mocks
	kubeObjs := []runtime.Object{
		&osproject_v1.Project{ObjectMeta: v1.ObjectMeta{Name: "Namespace"}},
	}
	for _, obj := range FakeCustomControllerRSSyncedWithPods() {
		o := obj
		kubeObjs = append(kubeObjs, &o)
	}
	for _, obj := range FakePodsFromCustomController() {
		o := obj
		kubeObjs = append(kubeObjs, &o)
	}
	k8s := kubetest.NewFakeK8sClient(kubeObjs...)
	k8s.OpenShift = true
	SetupBusinessLayer(t, k8s, *conf)
	svc := setupWorkloadService(k8s, conf)

	criteria := WorkloadCriteria{Cluster: conf.KubernetesConfig.ClusterName, Namespace: "Namespace", WorkloadName: "custom-controller", WorkloadGVK: schema.GroupVersionKind{}, IncludeServices: false}
	workload, err := svc.GetWorkload(context.TODO(), criteria)
	require.Error(err)

	// custom controller is not a workload type, only its replica set(s)
	assert.Equal((*models.Workload)(nil), workload)

	criteria = WorkloadCriteria{Cluster: conf.KubernetesConfig.ClusterName, Namespace: "Namespace", WorkloadName: "custom-controller-RS-123", WorkloadGVK: schema.GroupVersionKind{}, IncludeServices: false}
	workload, err = svc.GetWorkload(context.TODO(), criteria)
	require.NoError(err)

	assert.Equal("custom-controller-RS-123", workload.Name)
	assert.Equal("ReplicaSet", workload.WorkloadGVK.Kind)
	assert.Equal(true, workload.AppLabel)
	assert.Equal(true, workload.VersionLabel)
	assert.Equal(0, len(workload.Runtimes))
	assert.Equal(0, len(workload.AdditionalDetails))
}

func TestGetPod(t *testing.T) {
	assert := assert.New(t)
	require := require.New(t)

	conf := config.NewConfig()
	k8s := kubetest.NewFakeK8sClient(FakePodSyncedWithDeployments(), &osproject_v1.Project{ObjectMeta: v1.ObjectMeta{Name: "Namespace"}})
	SetupBusinessLayer(t, k8s, *conf)
	svc := setupWorkloadService(k8s, conf)

	pod, err := svc.GetPod(conf.KubernetesConfig.ClusterName, "Namespace", "details-v1-3618568057-dnkjp")
	require.NoError(err)

	assert.Equal("details-v1-3618568057-dnkjp", pod.Name)
}

// a fake log streamer that returns a fixed string for testing.
type logStreamer struct {
	logs string
	kubernetes.ClientInterface
}

func (l *logStreamer) StreamPodLogs(namespace, name string, opts *core_v1.PodLogOptions) (io.ReadCloser, error) {
	return io.NopCloser(strings.NewReader(l.logs)), nil
}

func TestGetPodLogs(t *testing.T) {
	assert := assert.New(t)
	require := require.New(t)

	k8s := &logStreamer{
		logs:            FakePodLogsSyncedWithDeployments().Logs,
		ClientInterface: kubetest.NewFakeK8sClient(&osproject_v1.Project{ObjectMeta: v1.ObjectMeta{Name: "Namespace"}}),
	}

	SetupBusinessLayer(t, k8s, *config.NewConfig())
	svc := setupWorkloadService(k8s, config.NewConfig())
	podLogs := callStreamPodLogs(svc, "Namespace", "details-v1-3618568057-dnkjp", &LogOptions{PodLogOptions: core_v1.PodLogOptions{Container: "details"}})

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
		logs:            FakePodLogsSyncedWithDeployments().Logs,
		ClientInterface: kubetest.NewFakeK8sClient(&osproject_v1.Project{ObjectMeta: v1.ObjectMeta{Name: "Namespace"}}),
	}

	SetupBusinessLayer(t, k8s, *config.NewConfig())
	svc := setupWorkloadService(k8s, config.NewConfig())

	maxLines := 2
	duration, _ := time.ParseDuration("6h")
	podLogs := callStreamPodLogs(svc, "Namespace", "details-v1-3618568057-dnkjp", &LogOptions{PodLogOptions: core_v1.PodLogOptions{Container: "details"}, MaxLines: &maxLines, Duration: &duration})

	require.Equal(2, len(podLogs.Entries))
	assert.Equal("INFO #1 Log Message", podLogs.Entries[0].Message)
	assert.Equal("WARN #2 Log Message", podLogs.Entries[1].Message)
}

func TestGetPodLogsDuration(t *testing.T) {
	assert := assert.New(t)
	require := require.New(t)
	conf := config.NewConfig()

	proj := &osproject_v1.Project{ObjectMeta: v1.ObjectMeta{Name: "Namespace"}}
	k8s := &logStreamer{
		logs:            FakePodLogsSyncedWithDeployments().Logs,
		ClientInterface: kubetest.NewFakeK8sClient(proj),
	}
	SetupBusinessLayer(t, k8s, *config.NewConfig())
	svc := setupWorkloadService(k8s, config.NewConfig())

	duration, _ := time.ParseDuration("59m")
	podLogs := callStreamPodLogs(svc, "Namespace", "details-v1-3618568057-dnkjp", &LogOptions{PodLogOptions: core_v1.PodLogOptions{Container: "details"}, Duration: &duration})
	require.Equal(1, len(podLogs.Entries))
	assert.Equal("INFO #1 Log Message", podLogs.Entries[0].Message)

	// Re-setup mocks
	k8s = &logStreamer{
		logs:            FakePodLogsSyncedWithDeployments().Logs,
		ClientInterface: kubetest.NewFakeK8sClient(proj),
	}
	svc = setupWorkloadService(k8s, conf)

	duration, _ = time.ParseDuration("1h")
	podLogs = callStreamPodLogs(svc, "Namespace", "details-v1-3618568057-dnkjp", &LogOptions{PodLogOptions: core_v1.PodLogOptions{Container: "details"}, Duration: &duration})
	require.Equal(2, len(podLogs.Entries))
	assert.Equal("INFO #1 Log Message", podLogs.Entries[0].Message)
	assert.Equal("WARN #2 Log Message", podLogs.Entries[1].Message)

	// Re-setup mocks
	k8s = &logStreamer{
		logs:            FakePodLogsSyncedWithDeployments().Logs,
		ClientInterface: kubetest.NewFakeK8sClient(proj),
	}
	svc = setupWorkloadService(k8s, conf)

	duration, _ = time.ParseDuration("2h")
	podLogs = callStreamPodLogs(svc, "Namespace", "details-v1-3618568057-dnkjp", &LogOptions{PodLogOptions: core_v1.PodLogOptions{Container: "details"}, Duration: &duration})
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
	proj := &osproject_v1.Project{ObjectMeta: v1.ObjectMeta{Name: "Namespace"}}
	k8s := &logStreamer{
		logs:            FakePodLogsSyncedWithDeployments().Logs,
		ClientInterface: kubetest.NewFakeK8sClient(proj),
	}
	SetupBusinessLayer(t, k8s, *config.NewConfig())
	svc := setupWorkloadService(k8s, conf)

	maxLines := 2
	duration, _ := time.ParseDuration("2h")
	podLogs := callStreamPodLogs(svc, "Namespace", "details-v1-3618568057-dnkjp", &LogOptions{Duration: &duration, PodLogOptions: core_v1.PodLogOptions{Container: "details"}, MaxLines: &maxLines})
	require.Equal(2, len(podLogs.Entries))
	assert.Equal("INFO #1 Log Message", podLogs.Entries[0].Message)
	assert.Equal("WARN #2 Log Message", podLogs.Entries[1].Message)
	assert.True(podLogs.LinesTruncated)

	// Re-setup mocks
	k8s = &logStreamer{
		logs:            FakePodLogsSyncedWithDeployments().Logs,
		ClientInterface: kubetest.NewFakeK8sClient(proj),
	}
	svc = setupWorkloadService(k8s, conf)

	maxLines = 3
	duration, _ = time.ParseDuration("3h")
	podLogs = callStreamPodLogs(svc, "Namespace", "details-v1-3618568057-dnkjp", &LogOptions{Duration: &duration, PodLogOptions: core_v1.PodLogOptions{Container: "details"}, MaxLines: &maxLines})
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
	proj := &osproject_v1.Project{ObjectMeta: v1.ObjectMeta{Name: "Namespace"}}
	k8s := &logStreamer{
		logs:            FakePodLogsProxy().Logs,
		ClientInterface: kubetest.NewFakeK8sClient(proj),
	}
	SetupBusinessLayer(t, k8s, *config.NewConfig())
	svc := setupWorkloadService(k8s, conf)

	maxLines := 2
	duration, _ := time.ParseDuration("2h")
	podLogs := callStreamPodLogs(svc, "Namespace", "details-v1-3618568057-dnkjp", &LogOptions{Duration: &duration, LogType: models.LogTypeProxy, PodLogOptions: core_v1.PodLogOptions{Container: "details"}, MaxLines: &maxLines})
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

	// Setup mocks
	kubeObjs := []runtime.Object{
		FakePodSyncedWithDeployments(),
		&osproject_v1.Project{ObjectMeta: v1.ObjectMeta{Name: "bookinfo"}},
	}
	for _, obj := range FakeZtunnelDaemonSet() {
		o := obj
		kubeObjs = append(kubeObjs, &o)
	}
	for _, obj := range FakeZtunnelPods() {
		o := obj
		kubeObjs = append(kubeObjs, &o)
	}
	k8s := &logStreamer{
		logs:            FakePodLogsZtunnel().Logs,
		ClientInterface: kubetest.NewFakeK8sClient(kubeObjs...),
	}
	SetupBusinessLayer(t, k8s, *config.NewConfig())
	svc := setupWorkloadService(k8s, conf)

	maxLines := 2
	duration, _ := time.ParseDuration("2h")
	podLogs := callStreamPodLogs(svc, "bookinfo", "details-v1-cf74bb974-wg44w", &LogOptions{Duration: &duration, LogType: models.LogTypeZtunnel, PodLogOptions: core_v1.PodLogOptions{Container: "details"}, MaxLines: &maxLines})
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

	podLogsQuotes := callStreamPodLogs(svc, "travel-agency", "cars-v1-6c869ff769-4hk27", &LogOptions{Duration: &duration, LogType: models.LogTypeZtunnel, PodLogOptions: core_v1.PodLogOptions{Container: "details"}, MaxLines: &maxLines})
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

func TestDuplicatedControllers(t *testing.T) {
	assert := assert.New(t)
	require := require.New(t)

	// Disabling CustomDashboards on Workload details testing
	// otherwise this adds 10s to the test due to an http timeout.
	conf := config.NewConfig()
	conf.ExternalServices.CustomDashboards.Enabled = false
	kubernetes.SetConfig(t, *conf)

	// Setup mocks
	kubeObjs := []runtime.Object{
		FakePodSyncedWithDeployments(),
		&osproject_v1.Project{ObjectMeta: v1.ObjectMeta{Name: "Namespace"}},
	}
	for _, obj := range FakeDuplicatedDeployments() {
		o := obj
		kubeObjs = append(kubeObjs, &o)
	}
	for _, obj := range FakeDuplicatedReplicaSets() {
		o := obj
		kubeObjs = append(kubeObjs, &o)
	}
	for _, obj := range FakeDuplicatedStatefulSets() {
		o := obj
		kubeObjs = append(kubeObjs, &o)
	}
	for _, obj := range FakePodsSyncedWithDuplicated() {
		o := obj
		kubeObjs = append(kubeObjs, &o)
	}
	k8s := kubetest.NewFakeK8sClient(kubeObjs...)
	k8s.OpenShift = true
	SetupBusinessLayer(t, k8s, *conf)
	svc := setupWorkloadService(k8s, conf)

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

	pods := FakePodsSyncedWithDeployments()

	// Doesn't matter what the type is as long as kiali doesn't recognize it as a workload.
	owner := &core_v1.ConfigMap{
		ObjectMeta: v1.ObjectMeta{
			Name: "testing",
			UID:  types.UID("f9952f02-5552-4b2c-afdb-441d859dbb36"),
		},
	}
	ref := v1.NewControllerRef(owner, core_v1.SchemeGroupVersion.WithKind("ConfigMap"))

	for i := range pods {
		pods[i].OwnerReferences = []v1.OwnerReference{*ref}
	}

	// Setup mocks
	kubeObjs := []runtime.Object{
		&osproject_v1.Project{ObjectMeta: v1.ObjectMeta{Name: "Namespace"}},
	}
	for _, obj := range pods {
		o := obj
		kubeObjs = append(kubeObjs, &o)
	}
	k8s := kubetest.NewFakeK8sClient(kubeObjs...)
	k8s.OpenShift = true
	SetupBusinessLayer(t, k8s, *config.NewConfig())
	svc := setupWorkloadService(k8s, config.NewConfig())

	// Disabling CustomDashboards on Workload details testing
	conf := config.Get()
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

	rs := FakeRSSyncedWithPods()
	pods := FakePodsSyncedWithDeployments()
	pods[0].OwnerReferences[0].APIVersion = kubernetes.ReplicaSets.GroupVersion().String()
	pods[0].OwnerReferences[0].Kind = kubernetes.ReplicaSets.Kind

	// Setup mocks
	kubeObjs := []runtime.Object{
		&osproject_v1.Project{ObjectMeta: v1.ObjectMeta{Name: "Namespace"}},
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
	SetupBusinessLayer(t, k8s, *config.NewConfig())
	svc := setupWorkloadService(k8s, conf)

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

	rs := FakeRSSyncedWithPods()
	// Doesn't matter what the type is as long as kiali doesn't recognize it as a workload.
	owner := &core_v1.ConfigMap{
		ObjectMeta: v1.ObjectMeta{
			// Random prefix
			Name: "h79a3h-controlling-workload",
			UID:  types.UID("f9952f02-5552-4b2c-afdb-441d859dbb36"),
		},
		TypeMeta: v1.TypeMeta{
			Kind: "ConfigMap",
		},
	}
	rs[0].OwnerReferences = []v1.OwnerReference{*v1.NewControllerRef(owner, core_v1.SchemeGroupVersion.WithKind(owner.Kind))}
	pods := FakePodsSyncedWithDeployments()

	// Setup mocks
	kubeObjs := []runtime.Object{
		&osproject_v1.Project{ObjectMeta: v1.ObjectMeta{Name: "Namespace"}},
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
	SetupBusinessLayer(t, k8s, *config.NewConfig())
	svc := setupWorkloadService(k8s, conf)

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
	config.Set(conf)

	replicaSets := FakeRSSyncedWithPods()

	// Doesn't matter what the type is as long as kiali doesn't recognize it as a workload.
	owner := &core_v1.ConfigMap{
		ObjectMeta: v1.ObjectMeta{
			Name: "controlling-workload",
			UID:  types.UID("f9952f02-5552-4b2c-afdb-441d859dbb36"),
		},
		TypeMeta: v1.TypeMeta{
			Kind: "ConfigMap",
		},
	}
	ref := v1.NewControllerRef(owner, core_v1.SchemeGroupVersion.WithKind(owner.Kind))

	for i := range replicaSets {
		replicaSets[i].OwnerReferences = []v1.OwnerReference{*ref}
	}

	pods := FakePodsSyncedWithDeployments()

	// Setup mocks
	kubeObjs := []runtime.Object{
		&osproject_v1.Project{ObjectMeta: v1.ObjectMeta{Name: "Namespace"}},
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
	SetupBusinessLayer(t, k8s, *conf)
	svc := setupWorkloadService(k8s, conf)

	criteria := WorkloadCriteria{Cluster: conf.KubernetesConfig.ClusterName, Namespace: "Namespace", IncludeIstioResources: false, IncludeHealth: false}
	workloadList, err := svc.GetWorkloadList(context.TODO(), criteria)
	require.NoError(err)
	workloads := workloadList.Workloads

	criteria = WorkloadCriteria{Cluster: conf.KubernetesConfig.ClusterName, Namespace: "Namespace", WorkloadName: owner.Name, WorkloadGVK: schema.GroupVersionKind{}, IncludeServices: false}
	workload, _ := svc.GetWorkload(context.TODO(), criteria)

	require.Equal(len(workloads), 1)
	assert.Nil(workload)

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
		logs:            logs,
		ClientInterface: kubetest.NewFakeK8sClient(&osproject_v1.Project{ObjectMeta: v1.ObjectMeta{Name: "Namespace"}}),
	}
	conf := config.NewConfig()
	config.Set(conf)
	SetupBusinessLayer(t, k8s, *conf)
	svc := setupWorkloadService(k8s, conf)

	podLogs := callStreamPodLogs(svc, "Namespace", "details-v1-3618568057-dnkjp", &LogOptions{LogType: models.LogTypeProxy, PodLogOptions: core_v1.PodLogOptions{Container: "istio-proxy"}})

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

	clientFactory := kubetest.NewK8SClientFactoryMock(nil)
	clients := map[string]kubernetes.ClientInterface{
		"east": kubetest.NewFakeK8sClient(
			kubetest.FakeNamespace("bookinfo"),
			&apps_v1.Deployment{
				ObjectMeta: meta_v1.ObjectMeta{
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
				ObjectMeta: meta_v1.ObjectMeta{
					Name:      "ratings-v1",
					Namespace: "bookinfo",
					Annotations: map[string]string{
						"unique-to-west": "true",
					},
				},
			},
		),
	}
	clientFactory.SetClients(clients)
	cache := cache.NewTestingCacheWithFactory(t, clientFactory, *conf)
	kialiCache = cache

	workloadService := NewWithBackends(clients, clients, nil, nil).Workload
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
		&osproject_v1.Project{ObjectMeta: v1.ObjectMeta{Name: "Namespace"}},
	}

	for _, obj := range FakeWaypointPod() {
		o := obj
		kubeObjs = append(kubeObjs, &o)
	}

	for _, obj := range FakeWaypointNamespaceEnrolledPods(true) {
		o := obj
		kubeObjs = append(kubeObjs, &o)
	}

	k8s := kubetest.NewFakeK8sClient(kubeObjs...)
	k8s.OpenShift = true
	SetupBusinessLayer(t, k8s, *conf)
	svc := setupWorkloadService(k8s, conf)

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

	waypointLabel := conf.IstioLabels.AmbientWaypointUseLabel

	// Setup mocks
	kubeObjs := []runtime.Object{
		&osproject_v1.Project{ObjectMeta: v1.ObjectMeta{Name: "Namespace", Labels: map[string]string{waypointLabel: "waypoint"}}},
	}

	for _, obj := range FakeWaypointPod() {
		o := obj
		kubeObjs = append(kubeObjs, &o)
	}

	for _, obj := range FakeWaypointNamespaceEnrolledPods(false) {
		o := obj
		kubeObjs = append(kubeObjs, &o)
	}

	// cache
	clientFactory := kubetest.NewK8SClientFactoryMock(nil)
	clients := map[string]kubernetes.ClientInterface{
		"": kubetest.NewFakeK8sClient(
			&osproject_v1.Project{ObjectMeta: v1.ObjectMeta{Name: "Namespace", Labels: map[string]string{waypointLabel: "waypoint"}}},
		),
	}
	clientFactory.SetClients(clients)
	cache := cache.NewTestingCacheWithFactory(t, clientFactory, *conf)
	kialiCache = cache

	k8s := kubetest.NewFakeK8sClient(kubeObjs...)
	k8s.OpenShift = true
	SetupBusinessLayer(t, k8s, *conf)
	svc := setupWorkloadService(k8s, conf)

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
	config.Set(conf)

	// Setup mocks
	kubeObjs := []runtime.Object{
		&osproject_v1.Project{ObjectMeta: v1.ObjectMeta{Name: "Namespace"}},
	}

	for _, obj := range FakeWaypointPod() {
		o := obj
		kubeObjs = append(kubeObjs, &o)
	}

	for _, obj := range FakeWaypointNamespaceEnrolledPods(false) {
		o := obj
		kubeObjs = append(kubeObjs, &o)
	}

	for _, obj := range FakeWaypointNServiceEnrolledPods() {
		o := obj
		kubeObjs = append(kubeObjs, &o)
	}

	k8s := kubetest.NewFakeK8sClient(kubeObjs...)
	k8s.OpenShift = true
	SetupBusinessLayer(t, k8s, *conf)
	svc := setupWorkloadService(k8s, conf)

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

// TestValidateWaypoint validate waypoint proxy status
func TestValidateWaypointProxyStatus(t *testing.T) {
	assert := assert.New(t)
	require := require.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	// Setup mocks
	kubeObjs := []runtime.Object{
		&osproject_v1.Project{ObjectMeta: v1.ObjectMeta{Name: "Namespace"}},
	}

	for _, obj := range FakeWaypointPod() {
		o := obj
		kubeObjs = append(kubeObjs, &o)
	}

	for _, obj := range FakeWaypointNamespaceEnrolledPods(true) {
		o := obj
		kubeObjs = append(kubeObjs, &o)
	}

	k8s := kubetest.NewFakeK8sClient(kubeObjs...)
	k8s.OpenShift = true
	SetupBusinessLayer(t, k8s, *conf)
	svc := setupWorkloadService(k8s, conf)

	// Set cache proxy status
	ps := kubernetes.ProxyStatus{
		Pilot: "istiod-54b6586f84-9bgw2",
		SyncStatus: kubernetes.SyncStatus{ClusterID: "",
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
		&core_v1.Namespace{ObjectMeta: meta_v1.ObjectMeta{Name: "Namespace"}},
		&apps_v1.Deployment{
			ObjectMeta: meta_v1.ObjectMeta{
				Name:      "ingress-gateway",
				Namespace: "Namespace",
			},
			Spec: apps_v1.DeploymentSpec{
				Template: core_v1.PodTemplateSpec{
					ObjectMeta: meta_v1.ObjectMeta{
						Labels: map[string]string{
							"istio.io/gateway-name": "ingress-gateway",
						},
					},
				},
			},
		},
	)
	SetupBusinessLayer(t, k8s, *conf)
	svc := setupWorkloadService(k8s, conf)

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
		&core_v1.Namespace{ObjectMeta: meta_v1.ObjectMeta{Name: "Namespace"}},
		&apps_v1.Deployment{
			ObjectMeta: meta_v1.ObjectMeta{
				Name:      "ingress-gateway",
				Namespace: "Namespace",
			},
			Spec: apps_v1.DeploymentSpec{
				Template: core_v1.PodTemplateSpec{
					ObjectMeta: meta_v1.ObjectMeta{
						Labels: map[string]string{
							"istio.io/gateway-name": "ingress-gateway",
						},
					},
				},
			},
		},
		&apps_v1.Deployment{
			ObjectMeta: meta_v1.ObjectMeta{
				Name:      "non-gateway-workload",
				Namespace: "Namespace",
			},
		},
	)
	SetupBusinessLayer(t, k8s, *conf)
	svc := setupWorkloadService(k8s, conf)

	workloads, err := svc.GetAllGateways(context.Background(), conf.KubernetesConfig.ClusterName)
	require.NoError(err)

	require.Len(workloads, 1)
	require.True(workloads[0].IsGateway(), "Expected IsGateway to be True but it was false")
}

func TestGetWorkloadListWithCustomKindThatMatchesCoreKind(t *testing.T) {
	assert := assert.New(t)
	require := require.New(t)

	conf := config.NewConfig()

	kubeObjs := []runtime.Object{
		&osproject_v1.Project{ObjectMeta: v1.ObjectMeta{Name: "Namespace"}},
	}
	for _, pod := range FakePodsFromCustomController() {
		p := pod
		// Setting here a custom type whose Kind matches a core Kube type.
		p.OwnerReferences[0].APIVersion = "customAPI/v1"
		p.OwnerReferences[0].Kind = "DaemonSet"
		kubeObjs = append(kubeObjs, &p)
	}

	k8s := kubetest.NewFakeK8sClient(kubeObjs...)
	k8s.OpenShift = true
	SetupBusinessLayer(t, k8s, *conf)
	svc := setupWorkloadService(k8s, conf)

	criteria := WorkloadCriteria{Namespace: "Namespace", IncludeIstioResources: false, IncludeHealth: false}
	workloadList, _ := svc.GetWorkloadList(context.TODO(), criteria)
	workloads := workloadList.Workloads

	assert.Equal("Namespace", workloadList.Namespace)

	require.Equal(1, len(workloads))
	assert.Equal("custom-controller-RS-123", workloads[0].Name)
	assert.Equal("DaemonSet", workloads[0].WorkloadGVK.Kind)
}
