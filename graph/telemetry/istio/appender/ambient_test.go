package appender

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/graph"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
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

	business.SetupBusinessLayer(t, k8s, *conf)
	k8sclients := make(map[string]kubernetes.ClientInterface)
	k8sclients[defaultCluster] = k8s
	businessLayer := business.NewWithBackends(k8sclients, k8sclients, nil, nil)
	return businessLayer
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

	globalInfo := graph.NewGlobalInfo()
	globalInfo.Business = businessLayer
	namespaceInfo := graph.NewAppenderNamespaceInfo(appNamespace)

	assert.Equal(5, len(trafficMap))

	// Run the appender...

	a := AmbientAppender{
		AccessibleNamespaces: map[string]*graph.AccessibleNamespace{
			fmt.Sprintf("%s:%s", defaultCluster, appNamespace): {
				Cluster: defaultCluster,
				Name:    appNamespace,
			},
		},
		ShowWaypoints: false}
	a.AppendGraph(trafficMap, globalInfo, namespaceInfo)

	assert.Equal(4, len(trafficMap))

	waypointWorkloadID, _, _ := graph.Id(defaultCluster, appNamespace, appName, appNamespace, "namespace-istio-waypoint", appName, "v2", graph.GraphTypeVersionedApp)
	_, found := trafficMap[waypointWorkloadID]
	assert.False(found)
}

func TestIsWaypointExcludedNs(t *testing.T) {
	assert := require.New(t)

	businessLayer := setupMocks(t)
	trafficMap := workloadEntriesTrafficMapExcludedNs()

	globalInfo := graph.NewGlobalInfo()
	globalInfo.Business = businessLayer
	namespaceInfo := graph.NewAppenderNamespaceInfo(appNamespace)

	assert.Equal(9, len(trafficMap))

	// Run the appender...

	a := AmbientAppender{
		AccessibleNamespaces: map[string]*graph.AccessibleNamespace{
			fmt.Sprintf("%s:%s", defaultCluster, appNamespace): {
				Cluster: defaultCluster,
				Name:    appNamespace,
			},
		},
		ShowWaypoints: true}

	a.AppendGraph(trafficMap, globalInfo, namespaceInfo)

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
