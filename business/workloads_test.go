package business

import (
	"fmt"
	"k8s.io/api/core/v1"
	"testing"

	osappsv1 "github.com/openshift/api/apps/v1"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"k8s.io/api/apps/v1beta1"
	"k8s.io/api/apps/v1beta2"
	batch_v1 "k8s.io/api/batch/v1"
	batch_v1beta1 "k8s.io/api/batch/v1beta1"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes/kubetest"
)

func setupWorkloadService(k8s *kubetest.K8SClientMock) WorkloadService {
	return WorkloadService{k8s: k8s}
}

func TestGetWorkloadListFromDeployments(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	// Setup mocks
	k8s := new(kubetest.K8SClientMock)
	k8s.On("IsOpenShift").Return(true)
	k8s.On("GetDeployments", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return(FakeDeployments(), nil)
	k8s.On("GetDeploymentConfigs", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return([]osappsv1.DeploymentConfig{}, nil)
	k8s.On("GetReplicaSets", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return([]v1beta2.ReplicaSet{}, nil)
	k8s.On("GetReplicationControllers", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return([]v1.ReplicationController{}, nil)
	k8s.On("GetStatefulSets", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return([]v1beta2.StatefulSet{}, nil)
	k8s.On("GetJobs", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return([]batch_v1.Job{}, nil)
	k8s.On("GetCronJobs", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return([]batch_v1beta1.CronJob{}, nil)
	k8s.On("GetPods", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return([]v1.Pod{}, nil)

	svc := setupWorkloadService(k8s)

	workloadList, _ := svc.GetWorkloadList("Namespace")
	workloads := workloadList.Workloads

	assert.Equal("Namespace", workloadList.Namespace.Name)

	assert.Equal(3, len(workloads))
	assert.Equal("httpbin-v1", workloads[0].Name)
	assert.Equal(true, workloads[0].AppLabel)
	assert.Equal(false, workloads[0].VersionLabel)
	assert.Equal("Deployment", workloads[0].Type)
	assert.Equal("httpbin-v2", workloads[1].Name)
	assert.Equal(true, workloads[1].AppLabel)
	assert.Equal(true, workloads[1].VersionLabel)
	assert.Equal("Deployment", workloads[1].Type)
	assert.Equal("httpbin-v3", workloads[2].Name)
	assert.Equal(false, workloads[2].AppLabel)
	assert.Equal(false, workloads[2].VersionLabel)
	assert.Equal("Deployment", workloads[2].Type)
}

func TestGetWorkloadListFromDepRCPod(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	// Setup mocks
	k8s := new(kubetest.K8SClientMock)
	k8s.On("IsOpenShift").Return(true)
	k8s.On("GetDeployments", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return(FakeDepSyncedWithRS(), nil)
	k8s.On("GetDeploymentConfigs", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return([]osappsv1.DeploymentConfig{}, nil)
	k8s.On("GetReplicaSets", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return(FakeRSSyncedWithPods(), nil)
	k8s.On("GetReplicationControllers", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return([]v1.ReplicationController{}, nil)
	k8s.On("GetStatefulSets", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return([]v1beta2.StatefulSet{}, nil)
	k8s.On("GetJobs", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return([]batch_v1.Job{}, nil)
	k8s.On("GetCronJobs", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return([]batch_v1beta1.CronJob{}, nil)
	k8s.On("GetPods", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return(FakePodsSyncedWithDeployments(), nil)

	svc := setupWorkloadService(k8s)

	workloadList, _ := svc.GetWorkloadList("Namespace")
	workloads := workloadList.Workloads

	assert.Equal("Namespace", workloadList.Namespace.Name)

	assert.Equal(1, len(workloads))
	assert.Equal("details-v1", workloads[0].Name)
	assert.Equal("Deployment", workloads[0].Type)
	assert.Equal(true, workloads[0].AppLabel)
	assert.Equal(true, workloads[0].VersionLabel)
}

func TestGetWorkloadListFromPod(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	// Setup mocks
	k8s := new(kubetest.K8SClientMock)
	k8s.On("IsOpenShift").Return(true)
	k8s.On("GetDeployments", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return([]v1beta1.Deployment{}, nil)
	k8s.On("GetDeploymentConfigs", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return([]osappsv1.DeploymentConfig{}, nil)
	k8s.On("GetReplicaSets", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return([]v1beta2.ReplicaSet{}, nil)
	k8s.On("GetReplicationControllers", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return([]v1.ReplicationController{}, nil)
	k8s.On("GetStatefulSets", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return([]v1beta2.StatefulSet{}, nil)
	k8s.On("GetJobs", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return([]batch_v1.Job{}, nil)
	k8s.On("GetCronJobs", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return([]batch_v1beta1.CronJob{}, nil)
	k8s.On("GetPods", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return(FakePodsNoController(), nil)

	svc := setupWorkloadService(k8s)

	workloadList, _ := svc.GetWorkloadList("Namespace")
	workloads := workloadList.Workloads

	assert.Equal("Namespace", workloadList.Namespace.Name)

	assert.Equal(1, len(workloads))
	assert.Equal("orphan-pod", workloads[0].Name)
	assert.Equal("Pod", workloads[0].Type)
	assert.Equal(true, workloads[0].AppLabel)
	assert.Equal(true, workloads[0].VersionLabel)
}

func TestGetWorkloadFromDeployment(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	// Setup mocks
	notfound := fmt.Errorf("not found")
	k8s := new(kubetest.K8SClientMock)
	k8s.On("IsOpenShift").Return(true)
	k8s.On("GetDeployment", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return(&FakeDepSyncedWithRS()[0], nil)
	k8s.On("GetDeploymentConfig", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return(&osappsv1.DeploymentConfig{}, notfound)
	k8s.On("GetReplicaSets", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return([]v1beta2.ReplicaSet{}, nil)
	k8s.On("GetReplicationControllers", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return([]v1.ReplicationController{}, nil)
	k8s.On("GetStatefulSet", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return(&v1beta2.StatefulSet{}, notfound)
	k8s.On("GetPods", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return(FakePodsSyncedWithDeployments(), nil)
	k8s.On("GetJobs", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return([]batch_v1.Job{}, nil)
	k8s.On("GetCronJobs", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return([]batch_v1beta1.CronJob{}, nil)

	svc := setupWorkloadService(k8s)

	workload, _ := svc.GetWorkload("Namespace", "details-v1", false)

	assert.Equal("details-v1", workload.Name)
	assert.Equal("Deployment", workload.Type)
	assert.Equal(true, workload.AppLabel)
	assert.Equal(true, workload.VersionLabel)
}

func TestGetPods(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	// Setup mocks
	k8s := new(kubetest.K8SClientMock)
	k8s.On("GetPods", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return(FakePodsSyncedWithDeployments(), nil)

	svc := setupWorkloadService(k8s)

	pods, _ := svc.GetPods("Namespace", "app=httpbin")

	assert.Equal(1, len(pods))
	assert.Equal("details-v1-3618568057-dnkjp", pods[0].Name)
}

func TestDuplicatedControllers(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	// Setup mocks
	k8s := new(kubetest.K8SClientMock)
	k8s.On("IsOpenShift").Return(true)
	k8s.On("GetDeployments", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return(FakeDuplicatedDeployments(), nil)
	k8s.On("GetDeploymentConfigs", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return([]osappsv1.DeploymentConfig{}, nil)
	k8s.On("GetReplicaSets", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return(FakeDuplicatedReplicaSets(), nil)
	k8s.On("GetReplicationControllers", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return([]v1.ReplicationController{}, nil)
	k8s.On("GetStatefulSets", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return(FakeDuplicatedStatefulSets(), nil)
	k8s.On("GetJobs", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return([]batch_v1.Job{}, nil)
	k8s.On("GetCronJobs", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return([]batch_v1beta1.CronJob{}, nil)
	k8s.On("GetPods", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return(FakePodsSyncedWithDuplicated(), nil)

	notfound := fmt.Errorf("not found")
	k8s.On("GetDeployment", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return(&FakeDuplicatedDeployments()[0], nil)
	k8s.On("GetDeploymentConfig", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return(&osappsv1.DeploymentConfig{}, notfound)
	k8s.On("GetStatefulSet", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return(&FakeDuplicatedStatefulSets()[0], nil)

	svc := setupWorkloadService(k8s)

	workloadList, _ := svc.GetWorkloadList("Namespace")
	workloads := workloadList.Workloads

	workload, _ := svc.GetWorkload("Namespace", "duplicated-v1", false)

	assert.Equal(workloads[0].Type, workload.Type)
}
