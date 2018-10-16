package appender

import (
	"testing"
	"time"

	osappsv1 "github.com/openshift/api/apps/v1"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"k8s.io/api/apps/v1beta1"
	"k8s.io/api/apps/v1beta2"
	batch_v1 "k8s.io/api/batch/v1"
	batch_v1beta1 "k8s.io/api/batch/v1beta1"
	"k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/graph"
	"github.com/kiali/kiali/kubernetes/kubetest"
)

func TestWorkloadSidecarsPasses(t *testing.T) {
	config.Set(config.NewConfig())
	trafficMap := buildWorkloadTrafficMap()
	businessLayer := setupSidecarsCheckWorkloads(buildFakeWorkloadDeployments(), buildFakeWorkloadPods())

	globalInfo := GlobalInfo{
		Business: businessLayer,
	}
	namespaceInfo := NamespaceInfo{
		Namespace: "testing",
	}
	a := SidecarsCheckAppender{}
	a.AppendGraph(trafficMap, &globalInfo, &namespaceInfo)

	for _, node := range trafficMap {
		_, ok := node.Metadata["hasMissingSC"].(bool)
		assert.False(t, ok)
	}
}

func TestWorkloadWithMissingSidecarsIsFlagged(t *testing.T) {
	config.Set(config.NewConfig())
	trafficMap := buildWorkloadTrafficMap()
	businessLayer := setupSidecarsCheckWorkloads(buildFakeWorkloadDeployments(), buildFakeWorkloadPodsNoSidecar())

	globalInfo := GlobalInfo{
		Business: businessLayer,
	}
	namespaceInfo := NamespaceInfo{
		Namespace: "testing",
	}

	a := SidecarsCheckAppender{}
	a.AppendGraph(trafficMap, &globalInfo, &namespaceInfo)

	for _, node := range trafficMap {
		flag, ok := node.Metadata["hasMissingSC"].(bool)
		assert.True(t, ok)
		assert.True(t, flag)
	}
}

func TestAppNoPodsPasses(t *testing.T) {
	config.Set(config.NewConfig())
	trafficMap := buildAppTrafficMap()
	businessLayer := setupSidecarsCheckWorkloads([]v1beta1.Deployment{}, []v1.Pod{})

	globalInfo := GlobalInfo{
		Business: businessLayer,
	}
	namespaceInfo := NamespaceInfo{
		Namespace: "testing",
	}

	a := SidecarsCheckAppender{}
	a.AppendGraph(trafficMap, &globalInfo, &namespaceInfo)

	for _, node := range trafficMap {
		_, ok := node.Metadata["hasMissingSC"].(bool)
		assert.False(t, ok)
	}
}

func TestAppSidecarsPasses(t *testing.T) {
	config.Set(config.NewConfig())
	trafficMap := buildAppTrafficMap()
	businessLayer := setupSidecarsCheckWorkloads([]v1beta1.Deployment{}, buildFakeWorkloadPods())

	globalInfo := GlobalInfo{
		Business: businessLayer,
	}
	namespaceInfo := NamespaceInfo{
		Namespace: "testing",
	}

	a := SidecarsCheckAppender{}
	a.AppendGraph(trafficMap, &globalInfo, &namespaceInfo)

	for _, node := range trafficMap {
		_, ok := node.Metadata["hasMissingSC"].(bool)
		assert.False(t, ok)
	}
}

func TestAppWithMissingSidecarsIsFlagged(t *testing.T) {
	config.Set(config.NewConfig())
	trafficMap := buildAppTrafficMap()
	businessLayer := setupSidecarsCheckWorkloads([]v1beta1.Deployment{}, buildFakeWorkloadPodsNoSidecar())

	globalInfo := GlobalInfo{
		Business: businessLayer,
	}
	namespaceInfo := NamespaceInfo{
		Namespace: "testing",
	}

	a := SidecarsCheckAppender{}
	a.AppendGraph(trafficMap, &globalInfo, &namespaceInfo)

	for _, node := range trafficMap {
		flag, ok := node.Metadata["hasMissingSC"].(bool)
		assert.True(t, ok)
		assert.True(t, flag)
	}
}

func TestServicesAreAlwaysValid(t *testing.T) {
	trafficMap := buildServiceTrafficMap()
	businessLayer := setupSidecarsCheckWorkloads([]v1beta1.Deployment{}, []v1.Pod{})

	globalInfo := GlobalInfo{
		Business: businessLayer,
	}
	namespaceInfo := NamespaceInfo{
		Namespace: "testing",
	}

	a := SidecarsCheckAppender{}
	a.AppendGraph(trafficMap, &globalInfo, &namespaceInfo)

	for _, node := range trafficMap {
		_, ok := node.Metadata["hasMissingSC"].(bool)
		assert.False(t, ok)
	}
}

func buildWorkloadTrafficMap() graph.TrafficMap {
	trafficMap := graph.NewTrafficMap()

	node := graph.NewNode("testing", "workload-1", graph.UnknownApp, graph.UnknownVersion, "", graph.GraphTypeWorkload)
	trafficMap[node.ID] = &node

	return trafficMap
}

func buildAppTrafficMap() graph.TrafficMap {
	trafficMap := graph.NewTrafficMap()

	node := graph.NewNode("testing", graph.UnknownWorkload, "myTest", graph.UnknownVersion, "", graph.GraphTypeVersionedApp)
	trafficMap[node.ID] = &node

	return trafficMap
}

func buildServiceTrafficMap() graph.TrafficMap {
	trafficMap := graph.NewTrafficMap()

	node := graph.NewNode("testing", graph.UnknownWorkload, graph.UnknownApp, graph.UnknownVersion, "svc", graph.GraphTypeVersionedApp)
	trafficMap[node.ID] = &node

	return trafficMap
}

func buildFakeWorkloadDeployments() []v1beta1.Deployment {
	return []v1beta1.Deployment{
		{
			ObjectMeta: metav1.ObjectMeta{
				Name: "workload-1",
			},
			Spec: v1beta1.DeploymentSpec{
				Template: v1.PodTemplateSpec{
					ObjectMeta: metav1.ObjectMeta{
						Labels: map[string]string{"app": "myTest", "wk": "wk-1"},
					},
				},
			},
		},
	}
}

func buildFakeWorkloadPods() []v1.Pod {
	istioAnnotation := config.Get().ExternalServices.Istio.IstioSidecarAnnotation

	return []v1.Pod{
		{
			ObjectMeta: metav1.ObjectMeta{
				Name:              "wk-1-asdf",
				Labels:            map[string]string{"app": "myTest", "wk": "wk-1"},
				CreationTimestamp: metav1.NewTime(time.Date(2018, 8, 24, 14, 0, 0, 0, time.UTC)),
				Annotations: map[string]string{
					istioAnnotation: "{ \"containers\":[\"istio-proxy\"] }",
				},
			},
		},
	}
}

func buildFakeWorkloadPodsNoSidecar() []v1.Pod {
	istioAnnotation := config.Get().ExternalServices.Istio.IstioSidecarAnnotation

	podList := buildFakeWorkloadPods()
	podList[0].ObjectMeta.Annotations[istioAnnotation] = "{}"

	return podList
}

func setupSidecarsCheckWorkloads(deployments []v1beta1.Deployment, pods []v1.Pod) *business.Layer {
	k8s := kubetest.NewK8SClientMock()

	k8s.On("GetCronJobs", mock.AnythingOfType("string")).Return([]batch_v1beta1.CronJob{}, nil)
	k8s.On("GetDeployments", mock.AnythingOfType("string")).Return(deployments, nil)
	k8s.On("GetDeploymentConfigs", mock.AnythingOfType("string")).Return([]osappsv1.DeploymentConfig{}, nil)
	k8s.On("GetJobs", mock.AnythingOfType("string")).Return([]batch_v1.Job{}, nil)
	k8s.On("GetPods", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return(pods, nil)
	k8s.On("GetReplicationControllers", mock.AnythingOfType("string")).Return([]v1.ReplicationController{}, nil)
	k8s.On("GetReplicaSets", mock.AnythingOfType("string")).Return([]v1beta2.ReplicaSet{}, nil)
	k8s.On("GetStatefulSets", mock.AnythingOfType("string")).Return([]v1beta2.StatefulSet{}, nil)
	config.Set(config.NewConfig())

	businessLayer := business.SetWithBackends(k8s, nil)
	return businessLayer
}
