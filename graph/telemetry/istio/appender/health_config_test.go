package appender

import (
	"testing"

	osapps_v1 "github.com/openshift/api/apps/v1"
	osproject_v1 "github.com/openshift/api/project/v1"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	apps_v1 "k8s.io/api/apps/v1"
	batch_v1 "k8s.io/api/batch/v1"
	batch_v1beta1 "k8s.io/api/batch/v1beta1"
	core_v1 "k8s.io/api/core/v1"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/graph"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/models"
)

const rateDefinition = "400,10,20,http,inbound"
const rateWorkloadDefinition = "4xx,20,30,http,inbound"

func TestServicesHealthConfigPasses(t *testing.T) {
	config.Set(config.NewConfig())
	trafficMap := buildServiceTrafficMap()
	businessLayer := setupHealthConfig(buildFakeServicesHealth(rateDefinition), buildFakeWorkloadDeploymentsHealth(rateWorkloadDefinition), buildFakePodsHealth(rateWorkloadDefinition))

	globalInfo := graph.NewAppenderGlobalInfo()
	globalInfo.Business = businessLayer
	namespaceInfo := graph.NewAppenderNamespaceInfo("testNamespace")

	a := HealthConfigAppender{}
	a.AppendGraph(trafficMap, globalInfo, namespaceInfo)

	for _, node := range trafficMap {
		srv, ok := node.Metadata[graph.HasHealthConfig].(map[string]string)
		assert.True(t, ok)
		assert.Equal(t, rateDefinition, srv[string(models.RateHealthAnnotation)])
	}
}

func TestServicesHealthNoConfigPasses(t *testing.T) {
	config.Set(config.NewConfig())
	trafficMap := buildServiceTrafficMap()
	businessLayer := setupHealthConfig(buildFakeServicesHealth(""), buildFakeWorkloadDeploymentsHealth(""), buildFakePodsHealth(""))

	globalInfo := graph.NewAppenderGlobalInfo()
	globalInfo.Business = businessLayer
	namespaceInfo := graph.NewAppenderNamespaceInfo("testNamespace")

	a := HealthConfigAppender{}
	a.AppendGraph(trafficMap, globalInfo, namespaceInfo)

	for _, node := range trafficMap {
		srv, ok := node.Metadata[graph.HasHealthConfig].(map[string]string)
		assert.True(t, ok)
		assert.Equal(t, "", srv[string(models.RateHealthAnnotation)])
	}
}

func TestWorkloadHealthConfigPasses(t *testing.T) {
	config.Set(config.NewConfig())
	trafficMap := buildWorkloadTrafficMap()
	businessLayer := setupHealthConfig(buildFakeServicesHealth(rateDefinition), buildFakeWorkloadDeploymentsHealth(rateWorkloadDefinition), buildFakePodsHealth(rateWorkloadDefinition))

	globalInfo := graph.NewAppenderGlobalInfo()
	globalInfo.Business = businessLayer
	namespaceInfo := graph.NewAppenderNamespaceInfo("testNamespace")

	a := HealthConfigAppender{}
	a.AppendGraph(trafficMap, globalInfo, namespaceInfo)

	for _, node := range trafficMap {
		srv, ok := node.Metadata[graph.HasHealthConfig].(map[string]string)
		assert.True(t, ok)
		assert.Equal(t, rateWorkloadDefinition, srv[string(models.RateHealthAnnotation)])
	}
}

func TestWorkloadHealthNoConfigPasses(t *testing.T) {
	config.Set(config.NewConfig())
	trafficMap := buildWorkloadTrafficMap()
	businessLayer := setupHealthConfig(buildFakeServicesHealth(""), buildFakeWorkloadDeploymentsHealth(""), buildFakePodsHealth(""))

	globalInfo := graph.NewAppenderGlobalInfo()
	globalInfo.Business = businessLayer
	namespaceInfo := graph.NewAppenderNamespaceInfo("testNamespace")

	a := HealthConfigAppender{}
	a.AppendGraph(trafficMap, globalInfo, namespaceInfo)

	for _, node := range trafficMap {
		srv, ok := node.Metadata[graph.HasHealthConfig].(map[string]string)
		assert.True(t, ok)
		assert.Equal(t, "", srv[string(models.RateHealthAnnotation)])
	}
}

func buildFakeServicesHealth(rate string) []core_v1.Service {
	annotationMap := map[string]string{}
	if rate != "" {
		annotationMap[string(models.RateHealthAnnotation)] = rate
	}
	return []core_v1.Service{
		{
			ObjectMeta: meta_v1.ObjectMeta{
				Name:        "svc",
				Annotations: annotationMap,
			},
		},
	}
}

func buildFakeWorkloadDeploymentsHealth(rate string) []apps_v1.Deployment {
	apps := buildFakeWorkloadDeployments()
	if rate != "" {
		apps[0].ObjectMeta.Annotations = map[string]string{string(models.RateHealthAnnotation): rate}
	}
	return apps
}

func buildFakePodsHealth(rate string) []core_v1.Pod {
	pods := buildFakeWorkloadPods()
	if rate != "" {
		pods[0].ObjectMeta.Annotations[string(models.RateHealthAnnotation)] = rate
	}
	return pods
}

func setupHealthConfig(services []core_v1.Service, deployments []apps_v1.Deployment, pods []core_v1.Pod) *business.Layer {
	k8s := kubetest.NewK8SClientMock()

	k8s.On("GetProject", mock.AnythingOfType("string")).Return(&osproject_v1.Project{}, nil)
	k8s.On("GetCronJobs", mock.AnythingOfType("string")).Return([]batch_v1beta1.CronJob{}, nil)
	k8s.On("GetDeployments", mock.AnythingOfType("string")).Return(deployments, nil)
	k8s.On("GetDeploymentConfigs", mock.AnythingOfType("string")).Return([]osapps_v1.DeploymentConfig{}, nil)
	k8s.On("GetJobs", mock.AnythingOfType("string")).Return([]batch_v1.Job{}, nil)
	k8s.On("GetPods", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return(pods, nil)
	k8s.On("GetReplicationControllers", mock.AnythingOfType("string")).Return([]core_v1.ReplicationController{}, nil)
	k8s.On("GetReplicaSets", mock.AnythingOfType("string")).Return([]apps_v1.ReplicaSet{}, nil)
	k8s.On("GetStatefulSets", mock.AnythingOfType("string")).Return([]apps_v1.StatefulSet{}, nil)
	k8s.On("GetDaemonSets", mock.AnythingOfType("string")).Return([]apps_v1.DaemonSet{}, nil)
	k8s.On("GetServices", mock.AnythingOfType("string"), mock.Anything).Return(services, nil)
	config.Set(config.NewConfig())

	businessLayer := business.NewWithBackends(k8s, nil, nil)
	return businessLayer
}
