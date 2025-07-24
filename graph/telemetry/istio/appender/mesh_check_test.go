package appender

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	apps_v1 "k8s.io/api/apps/v1"
	core_v1 "k8s.io/api/core/v1"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/graph"
	"github.com/kiali/kiali/kubernetes/kubetest"
)

func TestWorkloadSidecarsPasses(t *testing.T) {
	trafficMap := buildWorkloadTrafficMap()
	businessLayer := setupSidecarsCheckWorkloads(t, buildFakeWorkloadDeployments(), buildFakeWorkloadPods())

	globalInfo := graph.NewGlobalInfo(businessLayer, nil, config.Get())
	namespaceInfo := graph.NewAppenderNamespaceInfo("testNamespace")
	key := graph.GetClusterSensitiveKey(config.DefaultClusterID, "testNamespace")

	a := MeshCheckAppender{
		AccessibleNamespaces: map[graph.ClusterSensitiveKey]*graph.AccessibleNamespace{
			key: {
				Cluster:           config.DefaultClusterID,
				CreationTimestamp: time.Now(),
				Name:              "testNamespace",
			},
		},
	}
	a.AppendGraph(context.Background(), trafficMap, globalInfo, namespaceInfo)

	for _, node := range trafficMap {
		_, ok := node.Metadata[graph.IsOutOfMesh].(bool)
		assert.False(t, ok)
	}
}

func TestWorkloadWithMissingSidecarsIsFlagged(t *testing.T) {
	trafficMap := buildWorkloadTrafficMap()
	businessLayer := setupSidecarsCheckWorkloads(t, buildFakeWorkloadDeployments(), buildFakeWorkloadPodsNoSidecar())

	globalInfo := graph.NewGlobalInfo(businessLayer, nil, config.Get())
	namespaceInfo := graph.NewAppenderNamespaceInfo("testNamespace")
	key := graph.GetClusterSensitiveKey(config.DefaultClusterID, "testNamespace")

	a := MeshCheckAppender{
		AccessibleNamespaces: map[graph.ClusterSensitiveKey]*graph.AccessibleNamespace{
			key: {
				Cluster:           config.DefaultClusterID,
				CreationTimestamp: time.Now(),
				Name:              "testNamespace",
			},
		},
	}
	a.AppendGraph(context.Background(), trafficMap, globalInfo, namespaceInfo)

	for _, node := range trafficMap {
		flag, ok := node.Metadata[graph.IsOutOfMesh].(bool)
		assert.True(t, ok)
		assert.True(t, flag)
	}
}

func TestInaccessibleWorkload(t *testing.T) {
	trafficMap := buildInaccessibleWorkloadTrafficMap()
	businessLayer := setupSidecarsCheckWorkloads(t, buildFakeWorkloadDeployments(), buildFakeWorkloadPodsNoSidecar())

	globalInfo := graph.NewGlobalInfo(businessLayer, nil, config.Get())
	namespaceInfo := graph.NewAppenderNamespaceInfo("testNamespace")
	key := graph.GetClusterSensitiveKey(config.DefaultClusterID, "testNamespace")

	a := MeshCheckAppender{
		AccessibleNamespaces: map[graph.ClusterSensitiveKey]*graph.AccessibleNamespace{
			key: {
				Cluster:           config.DefaultClusterID,
				CreationTimestamp: time.Now(),
				Name:              "testNamespace",
			},
		},
	}
	a.AppendGraph(context.Background(), trafficMap, globalInfo, namespaceInfo)

	for _, node := range trafficMap {
		_, ok := node.Metadata[graph.IsOutOfMesh].(bool)
		assert.False(t, ok)
	}
}

func TestAppNoPodsPasses(t *testing.T) {
	trafficMap := buildAppTrafficMap()
	businessLayer := setupSidecarsCheckWorkloads(t, []apps_v1.Deployment{}, []core_v1.Pod{})

	globalInfo := graph.NewGlobalInfo(businessLayer, nil, config.Get())
	namespaceInfo := graph.NewAppenderNamespaceInfo("testNamespace")
	key := graph.GetClusterSensitiveKey(config.DefaultClusterID, "testNamespace")

	a := MeshCheckAppender{
		AccessibleNamespaces: map[graph.ClusterSensitiveKey]*graph.AccessibleNamespace{
			key: {
				Cluster:           config.DefaultClusterID,
				CreationTimestamp: time.Now(),
				Name:              "testNamespace",
			},
		},
	}
	a.AppendGraph(context.Background(), trafficMap, globalInfo, namespaceInfo)

	for _, node := range trafficMap {
		_, ok := node.Metadata[graph.IsOutOfMesh].(bool)
		assert.False(t, ok)
	}
}

func TestAppSidecarsPasses(t *testing.T) {
	trafficMap := buildAppTrafficMap()
	businessLayer := setupSidecarsCheckWorkloads(t, []apps_v1.Deployment{}, buildFakeWorkloadPods())

	globalInfo := graph.NewGlobalInfo(businessLayer, nil, config.Get())
	namespaceInfo := graph.NewAppenderNamespaceInfo("testNamespace")
	key := graph.GetClusterSensitiveKey(config.DefaultClusterID, "testNamespace")

	a := MeshCheckAppender{
		AccessibleNamespaces: map[graph.ClusterSensitiveKey]*graph.AccessibleNamespace{
			key: {
				Cluster:           config.DefaultClusterID,
				CreationTimestamp: time.Now(),
				Name:              "testNamespace",
			},
		},
	}
	a.AppendGraph(context.Background(), trafficMap, globalInfo, namespaceInfo)

	for _, node := range trafficMap {
		_, ok := node.Metadata[graph.IsOutOfMesh].(bool)
		assert.False(t, ok)
	}
}

func TestAppWithMissingSidecarsIsFlagged(t *testing.T) {
	trafficMap := buildAppTrafficMap()
	businessLayer := setupSidecarsCheckWorkloads(t, []apps_v1.Deployment{}, buildFakeWorkloadPodsNoSidecar())

	globalInfo := graph.NewGlobalInfo(businessLayer, nil, config.Get())
	namespaceInfo := graph.NewAppenderNamespaceInfo("testNamespace")
	key := graph.GetClusterSensitiveKey(config.DefaultClusterID, "testNamespace")

	a := MeshCheckAppender{
		AccessibleNamespaces: map[graph.ClusterSensitiveKey]*graph.AccessibleNamespace{
			key: {
				Cluster:           config.DefaultClusterID,
				CreationTimestamp: time.Now(),
				Name:              "testNamespace",
			},
		},
	}
	a.AppendGraph(context.Background(), trafficMap, globalInfo, namespaceInfo)

	for _, node := range trafficMap {
		flag, ok := node.Metadata[graph.IsOutOfMesh].(bool)
		assert.True(t, ok)
		assert.True(t, flag)
	}
}

func TestAppWithAmbientIsFlagged(t *testing.T) {
	trafficMap := buildAppTrafficMap()
	businessLayer := setupSidecarsCheckWorkloads(t, []apps_v1.Deployment{}, buildFakeWorkloadPodsAmbient())

	globalInfo := graph.NewGlobalInfo(businessLayer, nil, config.Get())
	namespaceInfo := graph.NewAppenderNamespaceInfo("testNamespace")
	key := graph.GetClusterSensitiveKey(config.DefaultClusterID, "testNamespace")

	a := MeshCheckAppender{
		AccessibleNamespaces: map[graph.ClusterSensitiveKey]*graph.AccessibleNamespace{
			key: {
				Cluster:           config.DefaultClusterID,
				CreationTimestamp: time.Now(),
				Name:              "testNamespace",
			},
		},
	}
	a.AppendGraph(context.Background(), trafficMap, globalInfo, namespaceInfo)

	for _, node := range trafficMap {
		flag, ok := node.Metadata[graph.IsOutOfMesh].(bool)
		assert.False(t, ok)
		assert.False(t, flag)
	}
}

func TestServicesAreAlwaysValid(t *testing.T) {
	trafficMap := buildServiceTrafficMap()
	businessLayer := setupSidecarsCheckWorkloads(t, []apps_v1.Deployment{}, []core_v1.Pod{})

	globalInfo := graph.NewGlobalInfo(businessLayer, nil, config.Get())
	namespaceInfo := graph.NewAppenderNamespaceInfo("testNamespace")
	key := graph.GetClusterSensitiveKey(config.DefaultClusterID, "testNamespace")

	a := MeshCheckAppender{
		AccessibleNamespaces: map[graph.ClusterSensitiveKey]*graph.AccessibleNamespace{
			key: {
				Cluster:           config.DefaultClusterID,
				CreationTimestamp: time.Now(),
				Name:              "testNamespace",
			},
		},
	}
	a.AppendGraph(context.Background(), trafficMap, globalInfo, namespaceInfo)

	for _, node := range trafficMap {
		_, ok := node.Metadata[graph.IsOutOfMesh].(bool)
		assert.False(t, ok)
	}
}

func buildWorkloadTrafficMap() graph.TrafficMap {
	trafficMap := graph.NewTrafficMap()
	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = config.DefaultClusterID
	config.Set(conf)
	node, _ := graph.NewNode(conf.KubernetesConfig.ClusterName, "testNamespace", "", "testNamespace", "workload-1", graph.Unknown, graph.Unknown, graph.GraphTypeWorkload)
	trafficMap[node.ID] = node

	return trafficMap
}

func buildInaccessibleWorkloadTrafficMap() graph.TrafficMap {
	trafficMap := graph.NewTrafficMap()
	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = config.DefaultClusterID
	config.Set(conf)
	node, _ := graph.NewNode(conf.KubernetesConfig.ClusterName, "inaccessibleNamespace", "", "inaccessibleNamespace", "workload-1", graph.Unknown, graph.Unknown, graph.GraphTypeVersionedApp)
	trafficMap[node.ID] = node

	return trafficMap
}

func buildAppTrafficMap() graph.TrafficMap {
	trafficMap := graph.NewTrafficMap()
	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = config.DefaultClusterID
	config.Set(conf)
	node, _ := graph.NewNode(conf.KubernetesConfig.ClusterName, "testNamespace", "", "testNamespace", graph.Unknown, "myTest", graph.Unknown, graph.GraphTypeVersionedApp)
	trafficMap[node.ID] = node

	return trafficMap
}

func buildServiceTrafficMap() graph.TrafficMap {
	trafficMap := graph.NewTrafficMap()
	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = config.DefaultClusterID
	config.Set(conf)
	node, _ := graph.NewNode(conf.KubernetesConfig.ClusterName, "testNamespace", "svc", "testNamespace", graph.Unknown, graph.Unknown, graph.Unknown, graph.GraphTypeVersionedApp)
	trafficMap[node.ID] = node

	return trafficMap
}

func buildFakeWorkloadDeployments() []apps_v1.Deployment {
	return []apps_v1.Deployment{
		{
			ObjectMeta: meta_v1.ObjectMeta{
				Name:      "workload-1",
				Namespace: "testNamespace",
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
	istioAnnotation := config.IstioSidecarAnnotation

	return []core_v1.Pod{
		{
			ObjectMeta: meta_v1.ObjectMeta{
				Name:              "wk-1-asdf",
				Namespace:         "testNamespace",
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
	istioAnnotation := config.IstioSidecarAnnotation

	podList := buildFakeWorkloadPods()
	podList[0].Annotations[istioAnnotation] = "{}"

	return podList
}

func buildFakeWorkloadPodsAmbient() []core_v1.Pod {
	podList := buildFakeWorkloadPodsNoSidecar()
	podList[0].Annotations["ambient.istio.io/redirection"] = "enabled"

	return podList
}

func setupSidecarsCheckWorkloads(t *testing.T, deployments []apps_v1.Deployment, pods []core_v1.Pod) *business.Layer {
	objects := []runtime.Object{kubetest.FakeNamespace("testNamespace")}
	for _, obj := range deployments {
		o := obj
		objects = append(objects, &o)
	}
	for _, obj := range pods {
		o := obj
		objects = append(objects, &o)
	}
	k8s := kubetest.NewFakeK8sClient(objects...)

	conf := config.NewConfig()
	conf.ExternalServices.Istio.IstioAPIEnabled = false
	conf.KubernetesConfig.ClusterName = config.DefaultClusterID
	config.Set(conf)

	return business.NewLayerBuilder(t, conf).WithClient(k8s).Build()
}
