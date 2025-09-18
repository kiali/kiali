package appender_test

import (
	"context"
	"sort"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	networking_v1 "istio.io/client-go/pkg/apis/networking/v1"
	"k8s.io/apimachinery/pkg/runtime"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/graph"
	"github.com/kiali/kiali/graph/telemetry/istio/appender"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/models"
)

const (
	testCluster  = "defaultCluster"
	appName      = "ratings"
	appNamespace = "testNamespace"
)

func setupBusinessLayer(t *testing.T, istioObjects ...runtime.Object) *business.Layer {
	k8s := kubetest.NewFakeK8sClient(istioObjects...)
	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = testCluster
	conf.ExternalServices.Istio.IstioAPIEnabled = false
	config.Set(conf)

	return business.NewLayerBuilder(t, conf).WithClient(k8s).Build()
}

func setupWorkloadEntries(t *testing.T) *business.Layer {
	workloadV1 := &networking_v1.WorkloadEntry{}
	workloadV1.Name = "workloadA"
	workloadV1.Namespace = appNamespace
	workloadV1.Spec.Labels = map[string]string{
		"app":     appName,
		"version": "v1",
	}
	workloadV2 := &networking_v1.WorkloadEntry{}
	workloadV2.Name = "workloadB"
	workloadV2.Namespace = appNamespace
	workloadV2.Spec.Labels = map[string]string{
		"app":     appName,
		"version": "v2",
	}
	ns := kubetest.FakeNamespace(appNamespace)
	return setupBusinessLayer(t, workloadV1, workloadV2, ns)
}

func workloadEntriesTrafficMap() map[string]*graph.Node {
	// VersionedApp graph
	trafficMap := make(map[string]*graph.Node)

	// 1 service, 3 workloads. v1 and v2 are workload entries. v3 is not a workload entry e.g. a kube deployment.

	// Service node
	n0, _ := graph.NewNode(testCluster, appNamespace, appName, appNamespace, "", "", "", graph.GraphTypeVersionedApp)

	// v1 Workload
	n1, _ := graph.NewNode(testCluster, appNamespace, appName, appNamespace, "ratings-v1", appName, "v1", graph.GraphTypeVersionedApp)

	// v2 Workload
	n2, _ := graph.NewNode(testCluster, appNamespace, appName, appNamespace, "ratings-v2", appName, "v2", graph.GraphTypeVersionedApp)

	// v3 Workload
	n3, _ := graph.NewNode(testCluster, appNamespace, appName, appNamespace, "ratings-v3", appName, "v3", graph.GraphTypeVersionedApp)

	// v4 Workload (just to test ignoring of outsider nodes)
	n4, _ := graph.NewNode(testCluster, "outsider", "outsider", "outsider", "outsider-v1", "outsider", "v1", graph.GraphTypeVersionedApp)

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

func TestWorkloadEntry(t *testing.T) {
	assert := require.New(t)

	businessLayer := setupWorkloadEntries(t)
	trafficMap := workloadEntriesTrafficMap()

	assert.Equal(5, len(trafficMap))

	seSVCID, _, _ := graph.Id(testCluster, appNamespace, appName, appNamespace, "", "", "", graph.GraphTypeVersionedApp)
	seSVCNode, found := trafficMap[seSVCID]
	assert.True(found)
	assert.Equal(4, len(seSVCNode.Edges))

	v1WorkloadID, _, _ := graph.Id(testCluster, appNamespace, appName, appNamespace, "ratings-v1", appName, "v1", graph.GraphTypeVersionedApp)
	v1Node, found := trafficMap[v1WorkloadID]
	assert.True(found)
	assert.NotContains(v1Node.Metadata, graph.HasWorkloadEntry)

	v2WorkloadID, _, _ := graph.Id(testCluster, appNamespace, appName, appNamespace, "ratings-v2", appName, "v2", graph.GraphTypeVersionedApp)
	v2Node, found := trafficMap[v2WorkloadID]
	assert.True(found)
	assert.NotContains(v2Node.Metadata, graph.HasWorkloadEntry)

	v3WorkloadID, _, _ := graph.Id(testCluster, appNamespace, appName, appNamespace, "ratings-v3", appName, "v3", graph.GraphTypeVersionedApp)
	v3Node, found := trafficMap[v3WorkloadID]
	assert.True(found)
	assert.NotContains(v3Node.Metadata, graph.HasWorkloadEntry)

	v4WorkloadID, _, _ := graph.Id(testCluster, "outsider", "outsider", "outsider", "outsider-v1", "outsider", "v1", graph.GraphTypeVersionedApp)
	v4Node, found := trafficMap[v4WorkloadID]
	assert.True(found)
	assert.NotContains(v4Node.Metadata, graph.HasWorkloadEntry)

	globalInfo := graph.NewGlobalInfo(businessLayer, nil, config.Get(), []models.KubeCluster{}, appender.NewGlobalIstioInfo())
	namespaceInfo := appender.NewAppenderNamespaceInfo(appNamespace)
	key := graph.GetClusterSensitiveKey(testCluster, appNamespace)

	// Run the appender...
	a := appender.WorkloadEntryAppender{
		AccessibleNamespaces: graph.AccessibleNamespaces{
			key: &graph.AccessibleNamespace{
				Cluster:           testCluster,
				CreationTimestamp: time.Now(),
				Name:              appNamespace,
			},
		},
	}
	a.AppendGraph(context.Background(), trafficMap, globalInfo, namespaceInfo)

	assert.Equal(5, len(trafficMap))

	workloadV1ID, _, _ := graph.Id(testCluster, appNamespace, appName, appNamespace, "ratings-v1", appName, "v1", graph.GraphTypeVersionedApp)
	workloadV1Node, found := trafficMap[workloadV1ID]
	assert.True(found)
	assert.Equal(workloadV1Node.Metadata[graph.HasWorkloadEntry], []graph.WEInfo{{Name: "workloadA"}})

	workloadV2ID, _, _ := graph.Id(testCluster, appNamespace, appName, appNamespace, "ratings-v2", appName, "v2", graph.GraphTypeVersionedApp)
	workloadV2Node, found := trafficMap[workloadV2ID]
	assert.True(found)
	assert.Equal(workloadV2Node.Metadata[graph.HasWorkloadEntry], []graph.WEInfo{{Name: "workloadB"}})

	workloadV3ID, _, _ := graph.Id(testCluster, appNamespace, appName, appNamespace, "ratings-v3", appName, "v3", graph.GraphTypeVersionedApp)
	workloadV3Node, found := trafficMap[workloadV3ID]
	assert.True(found)
	assert.NotContains(workloadV3Node.Metadata, graph.HasWorkloadEntry)
}

func TestWorkloadEntryAppLabelNotMatching(t *testing.T) {
	assert := require.New(t)

	workloadV1 := &networking_v1.WorkloadEntry{}
	workloadV1.Name = "workloadA"
	workloadV1.Namespace = appNamespace
	workloadV1.Spec.Labels = map[string]string{
		"app":     "pastamaker",
		"version": "v1",
	}

	workloadV2 := &networking_v1.WorkloadEntry{}
	workloadV2.Name = "workloadB"
	workloadV2.Namespace = appNamespace
	workloadV2.Spec.Labels = map[string]string{
		"app":     "pastamaker",
		"version": "v2",
	}

	ns := kubetest.FakeNamespace(appNamespace)
	businessLayer := setupBusinessLayer(t, workloadV1, workloadV2, ns)
	trafficMap := workloadEntriesTrafficMap()

	assert.Equal(5, len(trafficMap))

	seSVCID, _, _ := graph.Id(testCluster, appNamespace, appName, appNamespace, "", "", "", graph.GraphTypeVersionedApp)
	seSVCNode, found := trafficMap[seSVCID]
	assert.True(found)
	assert.Equal(4, len(seSVCNode.Edges))

	v1WorkloadID, _, _ := graph.Id(testCluster, appNamespace, appName, appNamespace, "ratings-v1", appName, "v1", graph.GraphTypeVersionedApp)
	v1Node, found := trafficMap[v1WorkloadID]
	assert.True(found)
	assert.NotContains(v1Node.Metadata, graph.HasWorkloadEntry)

	v2WorkloadID, _, _ := graph.Id(testCluster, appNamespace, appName, appNamespace, "ratings-v2", appName, "v2", graph.GraphTypeVersionedApp)
	v2Node, found := trafficMap[v2WorkloadID]
	assert.True(found)
	assert.NotContains(v2Node.Metadata, graph.HasWorkloadEntry)

	v3WorkloadID, _, _ := graph.Id(testCluster, appNamespace, appName, appNamespace, "ratings-v3", appName, "v3", graph.GraphTypeVersionedApp)
	v3Node, found := trafficMap[v3WorkloadID]
	assert.True(found)
	assert.NotContains(v3Node.Metadata, graph.HasWorkloadEntry)

	globalInfo := graph.NewGlobalInfo(businessLayer, nil, config.Get(), []models.KubeCluster{}, appender.NewGlobalIstioInfo())
	namespaceInfo := appender.NewAppenderNamespaceInfo(appNamespace)
	key := graph.GetClusterSensitiveKey(testCluster, appNamespace)

	// Run the appender...
	a := appender.WorkloadEntryAppender{
		AccessibleNamespaces: graph.AccessibleNamespaces{
			key: &graph.AccessibleNamespace{
				Cluster:           testCluster,
				CreationTimestamp: time.Now(),
				Name:              appNamespace,
			},
		},
	}
	a.AppendGraph(context.Background(), trafficMap, globalInfo, namespaceInfo)

	assert.Equal(5, len(trafficMap))

	workloadV1ID, _, _ := graph.Id(testCluster, appNamespace, appName, appNamespace, "ratings-v1", appName, "v1", graph.GraphTypeVersionedApp)
	workloadV1Node, found := trafficMap[workloadV1ID]
	assert.True(found)
	assert.NotContains(workloadV1Node.Metadata, graph.HasWorkloadEntry)

	workloadV2ID, _, _ := graph.Id(testCluster, appNamespace, appName, appNamespace, "ratings-v2", appName, "v2", graph.GraphTypeVersionedApp)
	workloadV2Node, found := trafficMap[workloadV2ID]
	assert.True(found)
	assert.NotContains(workloadV2Node.Metadata, graph.HasWorkloadEntry)

	workloadV3ID, _, _ := graph.Id(testCluster, appNamespace, appName, appNamespace, "ratings-v3", appName, "v3", graph.GraphTypeVersionedApp)
	workloadV3Node, found := trafficMap[workloadV3ID]
	assert.True(found)
	assert.NotContains(workloadV3Node.Metadata, graph.HasWorkloadEntry)
}

func TestMultipleWorkloadEntryForSameWorkload(t *testing.T) {
	assert := require.New(t)

	workloadV1A := &networking_v1.WorkloadEntry{}
	workloadV1A.Name = "workloadV1A"
	workloadV1A.Namespace = appNamespace
	workloadV1A.Spec.Labels = map[string]string{
		"app":     appName,
		"version": "v1",
	}

	workloadV1B := &networking_v1.WorkloadEntry{}
	workloadV1B.Name = "workloadV1B"
	workloadV1B.Namespace = appNamespace
	workloadV1B.Spec.Labels = map[string]string{
		"app":     appName,
		"version": "v1",
	}

	workloadV2 := &networking_v1.WorkloadEntry{}
	workloadV2.Name = "workloadV2"
	workloadV2.Namespace = appNamespace
	workloadV2.Spec.Labels = map[string]string{
		"app":     appName,
		"version": "v2",
	}

	ns := kubetest.FakeNamespace(appNamespace)
	businessLayer := setupBusinessLayer(t, workloadV1A, workloadV1B, workloadV2, ns)
	trafficMap := workloadEntriesTrafficMap()

	assert.Equal(5, len(trafficMap))

	seSVCID, _, _ := graph.Id(testCluster, appNamespace, appName, appNamespace, "", "", "", graph.GraphTypeVersionedApp)
	seSVCNode, found := trafficMap[seSVCID]
	assert.True(found)
	assert.Equal(4, len(seSVCNode.Edges))

	v1WorkloadID, _, _ := graph.Id(testCluster, appNamespace, appName, appNamespace, "ratings-v1", appName, "v1", graph.GraphTypeVersionedApp)
	v1Node, found := trafficMap[v1WorkloadID]
	assert.True(found)
	assert.NotContains(v1Node.Metadata, graph.HasWorkloadEntry)

	v2WorkloadID, _, _ := graph.Id(testCluster, appNamespace, appName, appNamespace, "ratings-v2", appName, "v2", graph.GraphTypeVersionedApp)
	v2Node, found := trafficMap[v2WorkloadID]
	assert.True(found)
	assert.NotContains(v2Node.Metadata, graph.HasWorkloadEntry)

	v3WorkloadID, _, _ := graph.Id(testCluster, appNamespace, appName, appNamespace, "ratings-v3", appName, "v3", graph.GraphTypeVersionedApp)
	v3Node, found := trafficMap[v3WorkloadID]
	assert.True(found)
	assert.NotContains(v3Node.Metadata, graph.HasWorkloadEntry)

	globalInfo := graph.NewGlobalInfo(businessLayer, nil, config.Get(), []models.KubeCluster{}, appender.NewGlobalIstioInfo())
	namespaceInfo := appender.NewAppenderNamespaceInfo(appNamespace)
	key := graph.GetClusterSensitiveKey(testCluster, appNamespace)

	// Run the appender...
	a := appender.WorkloadEntryAppender{
		AccessibleNamespaces: graph.AccessibleNamespaces{
			key: &graph.AccessibleNamespace{
				Cluster:           testCluster,
				CreationTimestamp: time.Now(),
				Name:              appNamespace,
			},
		},
	}
	a.AppendGraph(context.Background(), trafficMap, globalInfo, namespaceInfo)

	assert.Equal(5, len(trafficMap))

	workloadV1ID, _, _ := graph.Id(testCluster, appNamespace, appName, appNamespace, "ratings-v1", appName, "v1", graph.GraphTypeVersionedApp)
	workloadV1Node, found := trafficMap[workloadV1ID]
	assert.True(found)
	res := workloadV1Node.Metadata[graph.HasWorkloadEntry].([]graph.WEInfo)
	sort.Slice(res, func(i, j int) bool {
		return res[i].Name < res[j].Name
	})
	assert.Equal(
		[]graph.WEInfo{{Name: "workloadV1A"}, {Name: "workloadV1B"}},
		res,
	)

	workloadV2ID, _, _ := graph.Id(testCluster, appNamespace, appName, appNamespace, "ratings-v2", appName, "v2", graph.GraphTypeVersionedApp)
	workloadV2Node, found := trafficMap[workloadV2ID]
	assert.True(found)
	assert.Equal(workloadV2Node.Metadata[graph.HasWorkloadEntry], []graph.WEInfo{{Name: "workloadV2"}})

	workloadV3ID, _, _ := graph.Id(testCluster, appNamespace, appName, appNamespace, "ratings-v3", appName, "v3", graph.GraphTypeVersionedApp)
	workloadV3Node, found := trafficMap[workloadV3ID]
	assert.True(found)
	assert.NotContains(workloadV3Node.Metadata, graph.HasWorkloadEntry)
}

func TestWorkloadWithoutWorkloadEntries(t *testing.T) {
	assert := require.New(t)

	businessLayer := setupBusinessLayer(t, kubetest.FakeNamespace(appNamespace))
	trafficMap := workloadEntriesTrafficMap()

	assert.Equal(5, len(trafficMap))

	seSVCID, _, _ := graph.Id(testCluster, appNamespace, appName, appNamespace, "", "", "", graph.GraphTypeVersionedApp)
	seSVCNode, found := trafficMap[seSVCID]
	assert.True(found)
	assert.Equal(4, len(seSVCNode.Edges))

	v1WorkloadID, _, _ := graph.Id(testCluster, appNamespace, appName, appNamespace, "ratings-v1", appName, "v1", graph.GraphTypeVersionedApp)
	v1Node, found := trafficMap[v1WorkloadID]
	assert.True(found)
	assert.NotContains(v1Node.Metadata, graph.HasWorkloadEntry)

	v2WorkloadID, _, _ := graph.Id(testCluster, appNamespace, appName, appNamespace, "ratings-v2", appName, "v2", graph.GraphTypeVersionedApp)
	v2Node, found := trafficMap[v2WorkloadID]
	assert.True(found)
	assert.NotContains(v2Node.Metadata, graph.HasWorkloadEntry)

	v3WorkloadID, _, _ := graph.Id(testCluster, appNamespace, appName, appNamespace, "ratings-v3", appName, "v3", graph.GraphTypeVersionedApp)
	v3Node, found := trafficMap[v3WorkloadID]
	assert.True(found)
	assert.NotContains(v3Node.Metadata, graph.HasWorkloadEntry)

	globalInfo := graph.NewGlobalInfo(businessLayer, nil, config.Get(), []models.KubeCluster{}, appender.NewGlobalIstioInfo())
	namespaceInfo := appender.NewAppenderNamespaceInfo(appNamespace)
	key := graph.GetClusterSensitiveKey(testCluster, appNamespace)

	// Run the appender...
	a := appender.WorkloadEntryAppender{
		AccessibleNamespaces: graph.AccessibleNamespaces{
			key: &graph.AccessibleNamespace{
				Cluster:           testCluster,
				CreationTimestamp: time.Now(),
				Name:              appNamespace,
			},
		},
	}
	a.AppendGraph(context.Background(), trafficMap, globalInfo, namespaceInfo)

	assert.Equal(5, len(trafficMap))

	workloadV1ID, _, _ := graph.Id(testCluster, appNamespace, appName, appNamespace, "ratings-v1", appName, "v1", graph.GraphTypeVersionedApp)
	workloadV1Node, found := trafficMap[workloadV1ID]
	assert.True(found)
	assert.NotContains(workloadV1Node.Metadata, graph.HasWorkloadEntry)

	workloadV2ID, _, _ := graph.Id(testCluster, appNamespace, appName, appNamespace, "ratings-v2", appName, "v2", graph.GraphTypeVersionedApp)
	workloadV2Node, found := trafficMap[workloadV2ID]
	assert.True(found)
	assert.NotContains(workloadV2Node.Metadata, graph.HasWorkloadEntry)

	workloadV3ID, _, _ := graph.Id(testCluster, appNamespace, appName, appNamespace, "ratings-v3", appName, "v3", graph.GraphTypeVersionedApp)
	workloadV3Node, found := trafficMap[workloadV3ID]
	assert.True(found)
	assert.NotContains(workloadV3Node.Metadata, graph.HasWorkloadEntry)
}

// TestKiali7305 tests the scenario where the node is inaccessible
func TestWEKiali7305(t *testing.T) {
	assert := require.New(t)

	businessLayer := setupBusinessLayer(t, kubetest.FakeNamespace(appNamespace))

	// VersionedApp graph
	trafficMap := make(map[string]*graph.Node)

	// v1 Workload
	n0, _ := graph.NewNode("inaccessibleCluster", appNamespace, appName, appNamespace, "ratings-v1", appName, "v1", graph.GraphTypeVersionedApp)
	trafficMap[n0.ID] = n0

	assert.Equal(1, len(trafficMap))

	globalInfo := graph.NewGlobalInfo(businessLayer, nil, config.Get(), []models.KubeCluster{}, appender.NewGlobalIstioInfo())
	namespaceInfo := appender.NewAppenderNamespaceInfo("testNamespace")
	key := graph.GetClusterSensitiveKey(testCluster, appNamespace)

	// Run the appender...
	a := appender.WorkloadEntryAppender{
		AccessibleNamespaces: graph.AccessibleNamespaces{
			key: &graph.AccessibleNamespace{
				Cluster:           testCluster,
				CreationTimestamp: time.Now(),
				Name:              appNamespace,
			},
		},
	}
	a.AppendGraph(context.Background(), trafficMap, globalInfo, namespaceInfo)

	// No changes, just validating an accessibility check
	assert.Equal(1, len(trafficMap))
}
