package appender

import (
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"k8s.io/api/apps/v1beta1"
	api_v1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/graph"
	"github.com/kiali/kiali/kubernetes/kubetest"
)

func TestWorkloadSidecarsPasses(t *testing.T) {
	config.Set(config.NewConfig())
	k8s := new(kubetest.K8SClientMock)
	k8s.On("GetDeployment", "testing", "workload-1").Return(buildFakeWorkloadDeployment(), nil)
	k8s.On("GetPods", "testing", "wk=wk-1").Return(buildFakeWorkloadPods(), nil)

	trafficMap := buildWorkloadTrafficMap()
	sidecarsAppender := SidecarsCheckAppender{}

	sidecarsAppender.applySidecarsChecks(trafficMap, k8s)

	for _, node := range trafficMap {
		_, ok := node.Metadata["hasMissingSC"].(bool)
		assert.False(t, ok)
	}
}

func TestWorkloadWithMissingSidecarsIsFlagged(t *testing.T) {
	config.Set(config.NewConfig())
	k8s := new(kubetest.K8SClientMock)
	k8s.On("GetDeployment", "testing", "workload-1").Return(buildFakeWorkloadDeployment(), nil)
	k8s.On("GetPods", "testing", "wk=wk-1").Return(buildFakeWorkloadPodsNoSidecar(), nil)

	trafficMap := buildWorkloadTrafficMap()
	sidecarsAppender := SidecarsCheckAppender{}

	sidecarsAppender.applySidecarsChecks(trafficMap, k8s)

	for _, node := range trafficMap {
		flag, ok := node.Metadata["hasMissingSC"].(bool)
		assert.True(t, ok)
		assert.True(t, flag)
	}
}

func TestAppSidecarsPasses(t *testing.T) {
	config.Set(config.NewConfig())
	k8s := new(kubetest.K8SClientMock)
	k8s.On("GetPods", "testing", fmt.Sprintf("%v=myTest", config.Get().IstioLabels.AppLabelName)).Return(buildFakeWorkloadPods(), nil)

	trafficMap := buildAppTrafficMap()
	sidecarsAppender := SidecarsCheckAppender{}

	sidecarsAppender.applySidecarsChecks(trafficMap, k8s)

	for _, node := range trafficMap {
		_, ok := node.Metadata["hasMissingSC"].(bool)
		assert.False(t, ok)
	}
}

func TestAppWithMissingSidecarsIsFlagged(t *testing.T) {
	config.Set(config.NewConfig())
	k8s := new(kubetest.K8SClientMock)
	k8s.On("GetPods", "testing", fmt.Sprintf("%v=myTest", config.Get().IstioLabels.AppLabelName)).Return(buildFakeWorkloadPodsNoSidecar(), nil)

	trafficMap := buildAppTrafficMap()
	sidecarsAppender := SidecarsCheckAppender{}

	sidecarsAppender.applySidecarsChecks(trafficMap, k8s)

	for _, node := range trafficMap {
		flag, ok := node.Metadata["hasMissingSC"].(bool)
		assert.True(t, ok)
		assert.True(t, flag)
	}
}

func TestServicesAreAlwaysValid(t *testing.T) {
	config.Set(config.NewConfig())
	k8s := new(kubetest.K8SClientMock)

	trafficMap := buildServiceTrafficMap()
	sidecarsAppender := SidecarsCheckAppender{}

	sidecarsAppender.applySidecarsChecks(trafficMap, k8s)

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

func buildFakeWorkloadDeployment() *v1beta1.Deployment {
	return &v1beta1.Deployment{
		Spec: v1beta1.DeploymentSpec{
			Selector: &v1.LabelSelector{
				MatchLabels: map[string]string{
					"wk": "wk-1",
				}}}}
}

func buildFakeWorkloadPods() []api_v1.Pod {
	istioAnnotation := config.Get().ExternalServices.Istio.IstioSidecarAnnotation

	return []api_v1.Pod{
		{
			ObjectMeta: v1.ObjectMeta{
				Name:              "wk-1-asdf",
				CreationTimestamp: v1.NewTime(time.Date(2018, 8, 24, 14, 0, 0, 0, time.UTC)),
				Annotations: map[string]string{
					istioAnnotation: "{ \"containers\":[\"istio-proxy\"] }",
				},
			},
		},
	}
}

func buildFakeWorkloadPodsNoSidecar() []api_v1.Pod {
	istioAnnotation := config.Get().ExternalServices.Istio.IstioSidecarAnnotation

	podList := buildFakeWorkloadPods()
	podList[0].ObjectMeta.Annotations[istioAnnotation] = "{}"

	return podList
}
