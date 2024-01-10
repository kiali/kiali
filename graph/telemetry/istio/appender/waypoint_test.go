package appender

import (
	"testing"

	"github.com/stretchr/testify/require"
	networking_v1beta1 "istio.io/client-go/pkg/apis/networking/v1beta1"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/graph"
)

const (
	defaultCluster = "Kubernetes"
	appName        = "productpage"
	appNamespace   = "testNamespace"
)

func setupWorkloadEntries(t *testing.T) *business.Layer {
	workloadV1 := &networking_v1beta1.WorkloadEntry{}
	workloadV1.Name = "workloadA"
	workloadV1.Namespace = appNamespace
	workloadV1.Spec.Labels = map[string]string{
		"app":     appName,
		"version": "v1",
	}
	workloadV2 := &networking_v1beta1.WorkloadEntry{}
	workloadV2.Name = "workloadB"
	workloadV2.Namespace = appNamespace
	workloadV2.Spec.Labels = map[string]string{
		"app":     appName,
		"version": "v2",
	}
	workloadV3 := &networking_v1beta1.WorkloadEntry{}
	workloadV3.Name = "fake-istio-waypoint"
	workloadV3.Namespace = appNamespace
	workloadV3.Spec.Labels = map[string]string{
		"app":     appName,
		"version": "v2",
	}
	workloadV4 := &networking_v1beta1.WorkloadEntry{}
	workloadV4.Name = "namespace-istio-waypoint"
	workloadV4.Namespace = appNamespace
	workloadV4.Spec.Labels = map[string]string{
		"app":                appName,
		"version":            "v2",
		config.WaypointLabel: config.WaypointLabelValue,
	}
	//ns := &core_v1.Namespace{ObjectMeta: meta_v1.ObjectMeta{Name: appNamespace}}
	return setupBusinessLayer(t, workloadV1, workloadV2, workloadV3, workloadV4)
}

func workloadEntriesTrafficMap() map[string]*graph.Node {
	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = defaultCluster
	config.Set(conf)

	// VersionedApp graph
	trafficMap := make(map[string]*graph.Node)

	// 1 service, 3 workloads. v1 and v2 are workload entries. v3 is a waypoint proxy but with no labels. v4 has the right labels.

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

func TestWaypoint(t *testing.T) {
	assert := require.New(t)

	businessLayer := setupWorkloadEntries(t)
	trafficMap := workloadEntriesTrafficMap()

	globalInfo := graph.NewAppenderGlobalInfo()
	globalInfo.Business = businessLayer
	namespaceInfo := graph.NewAppenderNamespaceInfo(appNamespace)

	assert.Equal(5, len(trafficMap))

	// Run the appender...
	a := WaypointAppender{}
	a.AppendGraph(trafficMap, globalInfo, namespaceInfo)

	assert.Equal(4, len(trafficMap))

}
