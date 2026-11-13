// Assisted-by: Codex

package appender

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
	core_v1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/graph"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/models"
)

const (
	defaultCluster = "Kubernetes"
	appName        = "productpage"
	appNamespace   = "ambientNamespace"
	kubeNamespace  = "kube-system"
)

func setupMocks(t *testing.T) *business.Layer {
	ns := kubetest.FakeNamespace(appNamespace)
	k8s := kubetest.NewFakeK8sClient(ns)

	conf := config.NewConfig()
	conf.ExternalServices.Istio.IstioAPIEnabled = false
	conf.KubernetesConfig.ClusterName = defaultCluster
	config.Set(conf)

	return business.NewLayerBuilder(t, conf).WithClient(k8s).Build()
}

func workloadEntriesTrafficMap() map[string]*graph.Node {
	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = defaultCluster
	config.Set(conf)

	// VersionedApp graph
	trafficMap := make(map[string]*graph.Node)

	// Service node
	n0, _ := graph.NewNode(defaultCluster, appNamespace, appName, appNamespace, "", "", "", graph.GraphTypeVersionedApp)
	// v1 Workload
	n1, _ := graph.NewNode(defaultCluster, appNamespace, appName, appNamespace, "ratings-v1", appName, "v1", graph.GraphTypeVersionedApp)
	// v2 Workload
	n2, _ := graph.NewNode(defaultCluster, appNamespace, appName, appNamespace, "ratings-v2", appName, "v2", graph.GraphTypeVersionedApp)
	// v3 Workload with waypoint name
	n3, _ := graph.NewNode(defaultCluster, appNamespace, appName, appNamespace, "fake-istio-waypoint", appName, "v2", graph.GraphTypeVersionedApp)
	// v4 Waypoint proxy
	n4, _ := graph.NewNode(defaultCluster, appNamespace, appName, appNamespace, "namespace-istio-waypoint", appName, "v2", graph.GraphTypeVersionedApp)
	n4.Metadata[graph.IsWaypoint] = true // this metadata is provided by the base graph-gen

	trafficMap[n0.ID] = n0
	trafficMap[n1.ID] = n1
	trafficMap[n2.ID] = n2
	trafficMap[n3.ID] = n3
	trafficMap[n4.ID] = n4

	n0.AddEdge(n1).Metadata[graph.ProtocolKey] = graph.HTTP.Name
	n0.AddEdge(n2).Metadata[graph.ProtocolKey] = graph.HTTP.Name
	n0.AddEdge(n3).Metadata[graph.ProtocolKey] = graph.HTTP.Name
	n0.AddEdge(n4).Metadata[graph.ProtocolKey] = graph.HTTP.Name
	// Need to put some metadata in here to ensure it gets counted as a workload

	return trafficMap
}

func workloadEntriesTrafficMapExcludedNs() map[string]*graph.Node {
	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = defaultCluster
	config.Set(conf)

	// VersionedApp graph
	trafficMap := workloadEntriesTrafficMap()

	// 1 service, 3 workloads. v1 and v2 are workload entries. v3 is a waypoint proxy but with no labels. v4 has the right labels.

	// Service node
	n0, _ := graph.NewNode(defaultCluster, kubeNamespace, "kube-dns", kubeNamespace, "", "", "", graph.GraphTypeVersionedApp)
	// v1 Workload
	n1, _ := graph.NewNode(defaultCluster, kubeNamespace, "kube-dns", kubeNamespace, "corens-v1", appName, "v1", graph.GraphTypeVersionedApp)
	// v2 Workload
	n2, _ := graph.NewNode(defaultCluster, kubeNamespace, "kube-dns", kubeNamespace, "kube-apiserver", appName, "v2", graph.GraphTypeVersionedApp)
	// v3 Workload with waypoint name
	n3, _ := graph.NewNode(defaultCluster, kubeNamespace, "kube-dns", kubeNamespace, "kube-proxy", appName, "v2", graph.GraphTypeVersionedApp)

	trafficMap[n0.ID] = n0
	trafficMap[n1.ID] = n1
	trafficMap[n2.ID] = n2
	trafficMap[n3.ID] = n3

	n0.AddEdge(n1).Metadata[graph.ProtocolKey] = graph.HTTP.Name
	n0.AddEdge(n2).Metadata[graph.ProtocolKey] = graph.HTTP.Name
	n0.AddEdge(n3).Metadata[graph.ProtocolKey] = graph.HTTP.Name
	// Need to put some metadata in here to ensure it gets counted as a workload

	return trafficMap
}

func TestRemoveWaypoint(t *testing.T) {
	assert := require.New(t)

	businessLayer := setupMocks(t)
	trafficMap := workloadEntriesTrafficMap()

	globalInfo := graph.NewGlobalInfo(businessLayer, nil, config.Get(), []models.KubeCluster{}, NewGlobalIstioInfo())
	namespaceInfo := NewAppenderNamespaceInfo(appNamespace)

	assert.Equal(5, len(trafficMap))

	// Run the appender...

	a := AmbientAppender{
		AccessibleNamespaces: map[string]*graph.AccessibleNamespace{
			fmt.Sprintf("%s:%s", defaultCluster, appNamespace): {
				Cluster: defaultCluster,
				Name:    appNamespace,
			},
		},
		ShowWaypoints: false,
	}
	a.AppendGraph(context.Background(), trafficMap, globalInfo, namespaceInfo)

	assert.Equal(4, len(trafficMap))

	waypointWorkloadID, _, _ := graph.Id(defaultCluster, appNamespace, appName, appNamespace, "namespace-istio-waypoint", appName, "v2", graph.GraphTypeVersionedApp)
	_, found := trafficMap[waypointWorkloadID]
	assert.False(found)
}

func TestIsWaypointExcludedNs(t *testing.T) {
	assert := require.New(t)

	businessLayer := setupMocks(t)
	trafficMap := workloadEntriesTrafficMapExcludedNs()

	globalInfo := graph.NewGlobalInfo(businessLayer, nil, config.Get(), []models.KubeCluster{}, NewGlobalIstioInfo())
	namespaceInfo := NewAppenderNamespaceInfo(appNamespace)

	assert.Equal(9, len(trafficMap))

	// Run the appender...

	a := AmbientAppender{
		AccessibleNamespaces: map[string]*graph.AccessibleNamespace{
			fmt.Sprintf("%s:%s", defaultCluster, appNamespace): {
				Cluster: defaultCluster,
				Name:    appNamespace,
			},
		},
		ShowWaypoints: true,
	}

	a.AppendGraph(context.Background(), trafficMap, globalInfo, namespaceInfo)

	assert.Equal(9, len(trafficMap))

	waypointWorkloadID, _, _ := graph.Id(defaultCluster, appNamespace, appName, appNamespace, "namespace-istio-waypoint", appName, "v2", graph.GraphTypeVersionedApp)
	waypointNode, found := trafficMap[waypointWorkloadID]
	assert.True(found)
	assert.Contains(waypointNode.Metadata, graph.IsWaypoint)

	fakeWaypointWorkloadID, _, _ := graph.Id(defaultCluster, appNamespace, appName, appNamespace, "fake-istio-waypoint", appName, "v2", graph.GraphTypeVersionedApp)
	fakeWaypointNode, found := trafficMap[fakeWaypointWorkloadID]
	assert.True(found)
	assert.NotContains(fakeWaypointNode.Metadata, graph.IsWaypoint)
}

func TestWaypointLabelsFromServiceCanary(t *testing.T) {
	for _, weight := range []int{15, 0, 100} {
		t.Run(fmt.Sprintf("weight-%d", weight), func(t *testing.T) {
			conf := config.NewConfig()
			conf.ExternalServices.Istio.IstioAPIEnabled = false
			conf.KubernetesConfig.ClusterName = defaultCluster
			config.Set(conf)
			service := &core_v1.Service{ObjectMeta: metav1.ObjectMeta{
				Annotations: map[string]string{config.WaypointCanaryWeightAnnotation: fmt.Sprint(weight)},
				Labels: map[string]string{
					config.WaypointUseLabel:             "primary",
					config.WaypointUseNamespaceLabel:    "infra",
					config.WaypointCanaryUseLabel:       "canary",
					config.WaypointCanaryNamespaceLabel: "infra",
				},
				Name:      "reviews",
				Namespace: "bookinfo",
			}}
			client := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("bookinfo"), kubetest.FakeNamespace("infra"), service)
			layer := business.NewLayerBuilder(t, conf).WithClient(client).Build()
			gi := graph.NewGlobalInfo(layer, nil, conf, []models.KubeCluster{}, NewGlobalIstioInfo())
			a := AmbientAppender{
				AccessibleNamespaces: graph.AccessibleNamespaces{
					graph.GetClusterSensitiveKey(defaultCluster, "bookinfo"): {Cluster: defaultCluster, Name: "bookinfo"},
					graph.GetClusterSensitiveKey(defaultCluster, "infra"):    {Cluster: defaultCluster, Name: "infra"},
				},
				ShowWaypoints: true,
			}
			trafficMap := graph.NewTrafficMap()
			for _, name := range []string{"primary", "canary", "unrelated"} {
				node, err := graph.NewNode(defaultCluster, "infra", "", "infra", name, "", "", graph.GraphTypeWorkload)
				require.NoError(t, err)
				node.Metadata[graph.IsWaypoint] = true
				trafficMap[node.ID] = node
			}
			a.AppendGraph(context.Background(), trafficMap, gi, NewAppenderNamespaceInfo("bookinfo"))
			require.Contains(t, gi.Vendor.ClusterServiceLists, defaultCluster)
			for _, node := range trafficMap {
				switch node.Workload {
				case "primary":
					require.Equal(t, fmt.Sprintf("Primary %d%%", 100-weight), node.Metadata[graph.WaypointCanaryLabel])
				case "canary":
					require.Equal(t, fmt.Sprintf("Canary %d%%", weight), node.Metadata[graph.WaypointCanaryLabel])
				default:
					require.NotContains(t, node.Metadata, graph.WaypointCanaryLabel)
				}
			}

			// A request cache may cover more namespaces than this graph's accessible set.
			// Do not expose a service's canary configuration through that cache.
			delete(a.AccessibleNamespaces, graph.GetClusterSensitiveKey(defaultCluster, "bookinfo"))
			for _, node := range trafficMap {
				delete(node.Metadata, graph.WaypointCanaryLabel)
			}
			a.AppendGraph(context.Background(), trafficMap, gi, NewAppenderNamespaceInfo("infra"))
			for _, node := range trafficMap {
				require.NotContains(t, node.Metadata, graph.WaypointCanaryLabel)
			}
		})
	}
}

func TestWaypointLabelsFromInheritedPrimaryCanary(t *testing.T) {
	for _, weight := range []int{15, 0, 100} {
		t.Run(fmt.Sprintf("weight-%d", weight), func(t *testing.T) {
			conf := config.NewConfig()
			conf.ExternalServices.Istio.IstioAPIEnabled = false
			conf.KubernetesConfig.ClusterName = defaultCluster
			config.Set(conf)
			service := &core_v1.Service{ObjectMeta: metav1.ObjectMeta{
				Annotations: map[string]string{config.WaypointCanaryWeightAnnotation: fmt.Sprint(weight)},
				Labels: map[string]string{

					config.WaypointCanaryUseLabel:       "canary",
					config.WaypointCanaryNamespaceLabel: "infra",
				},
				Name:      "reviews",
				Namespace: "bookinfo",
			}}
			ns := kubetest.FakeNamespace("bookinfo")
			ns.Labels = map[string]string{config.WaypointUseLabel: "primary", config.WaypointUseNamespaceLabel: "infra"}
			client := kubetest.NewFakeK8sClient(ns, kubetest.FakeNamespace("infra"), service)
			layer := business.NewLayerBuilder(t, conf).WithClient(client).Build()
			gi := graph.NewGlobalInfo(layer, nil, conf, []models.KubeCluster{}, NewGlobalIstioInfo())
			a := AmbientAppender{
				AccessibleNamespaces: graph.AccessibleNamespaces{
					graph.GetClusterSensitiveKey(defaultCluster, "bookinfo"): {Cluster: defaultCluster, Labels: ns.Labels, Name: "bookinfo"},
					graph.GetClusterSensitiveKey(defaultCluster, "infra"):    {Cluster: defaultCluster, Name: "infra"},
				},
				ShowWaypoints: true,
			}
			trafficMap := graph.NewTrafficMap()
			for _, name := range []string{"primary", "canary", "unrelated"} {
				node, err := graph.NewNode(defaultCluster, "infra", "", "infra", name, "", "", graph.GraphTypeWorkload)
				require.NoError(t, err)
				node.Metadata[graph.IsWaypoint] = true
				trafficMap[node.ID] = node
			}
			a.AppendGraph(context.Background(), trafficMap, gi, NewAppenderNamespaceInfo("bookinfo"))
			require.Contains(t, gi.Vendor.ClusterServiceLists, defaultCluster)
			for _, node := range trafficMap {
				switch node.Workload {
				case "primary":
					require.Equal(t, fmt.Sprintf("Primary %d%%", 100-weight), node.Metadata[graph.WaypointCanaryLabel])
				case "canary":
					require.Equal(t, fmt.Sprintf("Canary %d%%", weight), node.Metadata[graph.WaypointCanaryLabel])
				default:
					require.NotContains(t, node.Metadata, graph.WaypointCanaryLabel)
				}
			}

			// Weight-only overrides must also affect graph labels when both gateway
			// names are inherited. The namespace's default remains a distinct source.
			an := a.AccessibleNamespaces[graph.GetClusterSensitiveKey(defaultCluster, "bookinfo")]
			an.Labels[config.WaypointCanaryUseLabel] = "canary"
			an.Labels[config.WaypointCanaryNamespaceLabel] = "infra"
			an.Annotations = map[string]string{config.WaypointCanaryWeightAnnotation: "30"}
			gi.Vendor.ClusterServiceLists[defaultCluster].Services[0].Labels = nil
			a.AppendGraph(context.Background(), trafficMap, gi, NewAppenderNamespaceInfo("bookinfo"))
			for _, node := range trafficMap {
				switch node.Workload {
				case "primary":
					require.Equal(t, "Primary "+models.WaypointCanaryMultipleSplitsLabel, node.Metadata[graph.WaypointCanaryLabel])
				case "canary":
					require.Equal(t, "Canary "+models.WaypointCanaryMultipleSplitsLabel, node.Metadata[graph.WaypointCanaryLabel])
				}
			}

			// A request cache may cover more namespaces than this graph's accessible set.
			// Do not expose a service's canary configuration through that cache.
			delete(a.AccessibleNamespaces, graph.GetClusterSensitiveKey(defaultCluster, "bookinfo"))
			for _, node := range trafficMap {
				delete(node.Metadata, graph.WaypointCanaryLabel)
			}
			a.AppendGraph(context.Background(), trafficMap, gi, NewAppenderNamespaceInfo("infra"))
			for _, node := range trafficMap {
				require.NotContains(t, node.Metadata, graph.WaypointCanaryLabel)
			}
		})
	}
}
