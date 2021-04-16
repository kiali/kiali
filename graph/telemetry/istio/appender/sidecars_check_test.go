package appender

import (
	"testing"
	"time"

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
)

func TestWorkloadSidecarsPasses(t *testing.T) {
	config.Set(config.NewConfig())
	trafficMap := buildWorkloadTrafficMap()
	businessLayer := setupSidecarsCheckWorkloads(buildFakeWorkloadDeployments(), buildFakeWorkloadPods())

	globalInfo := graph.NewAppenderGlobalInfo()
	globalInfo.Business = businessLayer
	namespaceInfo := graph.NewAppenderNamespaceInfo("testNamespace")

	a := SidecarsCheckAppender{
		AccessibleNamespaces: map[string]time.Time{"testNamespace": time.Now()},
	}
	a.AppendGraph(trafficMap, globalInfo, namespaceInfo)

	for _, node := range trafficMap {
		_, ok := node.Metadata[graph.HasMissingSC].(bool)
		assert.False(t, ok)
	}
}

func TestWorkloadWithMissingSidecarsIsFlagged(t *testing.T) {
	config.Set(config.NewConfig())
	trafficMap := buildWorkloadTrafficMap()
	businessLayer := setupSidecarsCheckWorkloads(buildFakeWorkloadDeployments(), buildFakeWorkloadPodsNoSidecar())

	globalInfo := graph.NewAppenderGlobalInfo()
	globalInfo.Business = businessLayer
	namespaceInfo := graph.NewAppenderNamespaceInfo("testNamespace")

	a := SidecarsCheckAppender{
		AccessibleNamespaces: map[string]time.Time{"testNamespace": time.Now()},
	}
	a.AppendGraph(trafficMap, globalInfo, namespaceInfo)

	for _, node := range trafficMap {
		flag, ok := node.Metadata[graph.HasMissingSC].(bool)
		assert.True(t, ok)
		assert.True(t, flag)
	}
}

func TestInaccessibleWorkload(t *testing.T) {
	config.Set(config.NewConfig())
	trafficMap := buildInaccessibleWorkloadTrafficMap()
	businessLayer := setupSidecarsCheckWorkloads(buildFakeWorkloadDeployments(), buildFakeWorkloadPodsNoSidecar())

	globalInfo := graph.NewAppenderGlobalInfo()
	globalInfo.Business = businessLayer
	namespaceInfo := graph.NewAppenderNamespaceInfo("testNamespace")

	a := SidecarsCheckAppender{
		AccessibleNamespaces: map[string]time.Time{"testNamespace": time.Now()},
	}
	a.AppendGraph(trafficMap, globalInfo, namespaceInfo)

	for _, node := range trafficMap {
		_, ok := node.Metadata[graph.HasMissingSC].(bool)
		assert.False(t, ok)
	}
}

func TestAppNoPodsPasses(t *testing.T) {
	config.Set(config.NewConfig())
	trafficMap := buildAppTrafficMap()
	businessLayer := setupSidecarsCheckWorkloads([]apps_v1.Deployment{}, []core_v1.Pod{})

	globalInfo := graph.NewAppenderGlobalInfo()
	globalInfo.Business = businessLayer
	namespaceInfo := graph.NewAppenderNamespaceInfo("testNamespace")

	a := SidecarsCheckAppender{
		AccessibleNamespaces: map[string]time.Time{"testNamespace": time.Now()},
	}
	a.AppendGraph(trafficMap, globalInfo, namespaceInfo)

	for _, node := range trafficMap {
		_, ok := node.Metadata[graph.HasMissingSC].(bool)
		assert.False(t, ok)
	}
}

func TestAppSidecarsPasses(t *testing.T) {
	config.Set(config.NewConfig())
	trafficMap := buildAppTrafficMap()
	businessLayer := setupSidecarsCheckWorkloads([]apps_v1.Deployment{}, buildFakeWorkloadPods())

	globalInfo := graph.NewAppenderGlobalInfo()
	globalInfo.Business = businessLayer
	namespaceInfo := graph.NewAppenderNamespaceInfo("testNamespace")

	a := SidecarsCheckAppender{
		AccessibleNamespaces: map[string]time.Time{"testNamespace": time.Now()},
	}
	a.AppendGraph(trafficMap, globalInfo, namespaceInfo)

	for _, node := range trafficMap {
		_, ok := node.Metadata[graph.HasMissingSC].(bool)
		assert.False(t, ok)
	}
}

func TestAppWithMissingSidecarsIsFlagged(t *testing.T) {
	config.Set(config.NewConfig())
	trafficMap := buildAppTrafficMap()
	businessLayer := setupSidecarsCheckWorkloads([]apps_v1.Deployment{}, buildFakeWorkloadPodsNoSidecar())

	globalInfo := graph.NewAppenderGlobalInfo()
	globalInfo.Business = businessLayer
	namespaceInfo := graph.NewAppenderNamespaceInfo("testNamespace")

	a := SidecarsCheckAppender{
		AccessibleNamespaces: map[string]time.Time{"testNamespace": time.Now()},
	}
	a.AppendGraph(trafficMap, globalInfo, namespaceInfo)

	for _, node := range trafficMap {
		flag, ok := node.Metadata[graph.HasMissingSC].(bool)
		assert.True(t, ok)
		assert.True(t, flag)
	}
}

func TestServicesAreAlwaysValid(t *testing.T) {
	trafficMap := buildServiceTrafficMap()
	businessLayer := setupSidecarsCheckWorkloads([]apps_v1.Deployment{}, []core_v1.Pod{})

	globalInfo := graph.NewAppenderGlobalInfo()
	globalInfo.Business = businessLayer
	namespaceInfo := graph.NewAppenderNamespaceInfo("testNamespace")

	a := SidecarsCheckAppender{
		AccessibleNamespaces: map[string]time.Time{"testNamespace": time.Now()},
	}
	a.AppendGraph(trafficMap, globalInfo, namespaceInfo)

	for _, node := range trafficMap {
		_, ok := node.Metadata[graph.HasMissingSC].(bool)
		assert.False(t, ok)
	}
}

func buildWorkloadTrafficMap() graph.TrafficMap {
	trafficMap := graph.NewTrafficMap()

	node := graph.NewNode(graph.Unknown, "testNamespace", "", "testNamespace", "workload-1", graph.Unknown, graph.Unknown, graph.GraphTypeWorkload)
	trafficMap[node.ID] = &node

	return trafficMap
}

func buildInaccessibleWorkloadTrafficMap() graph.TrafficMap {
	trafficMap := graph.NewTrafficMap()

	node := graph.NewNode(graph.Unknown, "inaccessibleNamespace", "", "inaccessibleNamespace", "workload-1", graph.Unknown, graph.Unknown, graph.GraphTypeVersionedApp)
	trafficMap[node.ID] = &node

	return trafficMap
}

func buildAppTrafficMap() graph.TrafficMap {
	trafficMap := graph.NewTrafficMap()

	node := graph.NewNode(graph.Unknown, "testNamespace", "", "testNamespace", graph.Unknown, "myTest", graph.Unknown, graph.GraphTypeVersionedApp)
	trafficMap[node.ID] = &node

	return trafficMap
}

func buildServiceTrafficMap() graph.TrafficMap {
	trafficMap := graph.NewTrafficMap()

	node := graph.NewNode(graph.Unknown, "testNamespace", "svc", "testNamespace", graph.Unknown, graph.Unknown, graph.Unknown, graph.GraphTypeVersionedApp)
	trafficMap[node.ID] = &node

	return trafficMap
}

func buildFakeWorkloadDeployments() []apps_v1.Deployment {
	return []apps_v1.Deployment{
		{
			ObjectMeta: meta_v1.ObjectMeta{
				Name: "workload-1",
			},
			Spec: apps_v1.DeploymentSpec{
				Template: core_v1.PodTemplateSpec{
					ObjectMeta: meta_v1.ObjectMeta{
						Labels: map[string]string{"app": "myTest", "wk": "wk-1"},
					},
				},
			},
		},
	}
}

func buildFakeWorkloadPods() []core_v1.Pod {
	istioAnnotation := config.Get().ExternalServices.Istio.IstioSidecarAnnotation

	return []core_v1.Pod{
		{
			ObjectMeta: meta_v1.ObjectMeta{
				Name:              "wk-1-asdf",
				Labels:            map[string]string{"app": "myTest", "wk": "wk-1"},
				CreationTimestamp: meta_v1.NewTime(time.Date(2018, 8, 24, 14, 0, 0, 0, time.UTC)),
				Annotations: map[string]string{
					istioAnnotation: "{ \"containers\":[\"istio-proxy\"] }",
				},
			},
		},
	}
}

func buildFakeWorkloadPodsNoSidecar() []core_v1.Pod {
	istioAnnotation := config.Get().ExternalServices.Istio.IstioSidecarAnnotation

	podList := buildFakeWorkloadPods()
	podList[0].ObjectMeta.Annotations[istioAnnotation] = "{}"

	return podList
}

func setupSidecarsCheckWorkloads(deployments []apps_v1.Deployment, pods []core_v1.Pod) *business.Layer {
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
	config.Set(config.NewConfig())

	businessLayer := business.NewWithBackends(k8s, nil, nil)
	return businessLayer
}
