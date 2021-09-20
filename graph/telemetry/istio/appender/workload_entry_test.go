package appender_test

import (
	"testing"

	osproject_v1 "github.com/openshift/api/project/v1"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/graph"
	"github.com/kiali/kiali/graph/telemetry/istio/appender"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
)

const (
	testCluster  = "testCluster"
	appName      = "ratings"
	appNamespace = "testNamespace"
)

func setupBusinessLayer(istioObjects ...kubernetes.IstioObject) *business.Layer {
	k8s := kubetest.NewK8SClientMock()

	return setupBusinessLayerWithKube(k8s, istioObjects...)
}

func setupBusinessLayerWithKube(k8s *kubetest.K8SClientMock, istioObjects ...kubernetes.IstioObject) *business.Layer {
	k8s.On("GetProject", mock.AnythingOfType("string")).Return(&osproject_v1.Project{}, nil)
	k8s.On("GetIstioObjects", mock.AnythingOfType("string"), "workloadentries", "").Return(istioObjects, nil)
	config.Set(config.NewConfig())

	businessLayer := business.NewWithBackends(k8s, nil, nil)
	return businessLayer
}

func setupWorkloadEntries() *business.Layer {
	workloadV1 := &kubernetes.GenericIstioObject{
		ObjectMeta: meta_v1.ObjectMeta{
			Name:      "workloadA",
			Namespace: appNamespace,
		},
		Spec: map[string]interface{}{
			"labels": map[string]interface{}{
				"app":     appName,
				"version": "v1",
			},
		},
	}
	workloadV2 := &kubernetes.GenericIstioObject{
		ObjectMeta: meta_v1.ObjectMeta{
			Name:      "workloadB",
			Namespace: appNamespace,
		},
		Spec: map[string]interface{}{
			"labels": map[string]interface{}{
				"app":     appName,
				"version": "v2",
			},
		},
	}

	return setupBusinessLayer(workloadV1, workloadV2)
}

func workloadEntriesTrafficMap() map[string]*graph.Node {
	// VersionedApp graph
	trafficMap := make(map[string]*graph.Node)

	// 1 service, 3 workloads. v1 and v2 are workload entries. v3 is not a workload entry e.g. a kube deployment.

	// Service node
	n0 := graph.NewNode(testCluster, appNamespace, appName, appNamespace, "", "", "", graph.GraphTypeVersionedApp)

	// v1 Workload
	n1 := graph.NewNode(testCluster, appNamespace, appName, appNamespace, "ratings-v1", appName, "v1", graph.GraphTypeVersionedApp)

	// v2 Workload
	n2 := graph.NewNode(testCluster, appNamespace, appName, appNamespace, "ratings-v2", appName, "v2", graph.GraphTypeVersionedApp)

	// v3 Workload
	n3 := graph.NewNode(testCluster, appNamespace, appName, appNamespace, "ratings-v3", appName, "v3", graph.GraphTypeVersionedApp)

	trafficMap[n0.ID] = &n0
	trafficMap[n1.ID] = &n1
	trafficMap[n2.ID] = &n2
	trafficMap[n3.ID] = &n3

	n0.AddEdge(&n1).Metadata[graph.ProtocolKey] = graph.HTTP.Name
	n0.AddEdge(&n2).Metadata[graph.ProtocolKey] = graph.HTTP.Name
	n0.AddEdge(&n3).Metadata[graph.ProtocolKey] = graph.HTTP.Name
	// Need to put some metadata in here to ensure it gets counted as a workload

	return trafficMap
}

func TestWorkloadEntry(t *testing.T) {
	assert := require.New(t)

	businessLayer := setupWorkloadEntries()
	trafficMap := workloadEntriesTrafficMap()

	assert.Equal(4, len(trafficMap))

	seSVCID, _ := graph.Id(testCluster, appNamespace, appName, appNamespace, "", "", "", graph.GraphTypeVersionedApp)
	seSVCNode, found := trafficMap[seSVCID]
	assert.True(found)
	assert.Equal(3, len(seSVCNode.Edges))

	v1WorkloadID, _ := graph.Id(testCluster, appNamespace, appName, appNamespace, "ratings-v1", appName, "v1", graph.GraphTypeVersionedApp)
	v1Node, found := trafficMap[v1WorkloadID]
	assert.True(found)
	assert.NotContains(v1Node.Metadata, graph.HasWorkloadEntry)

	v2WorkloadID, _ := graph.Id(testCluster, appNamespace, appName, appNamespace, "ratings-v2", appName, "v2", graph.GraphTypeVersionedApp)
	v2Node, found := trafficMap[v2WorkloadID]
	assert.True(found)
	assert.NotContains(v2Node.Metadata, graph.HasWorkloadEntry)

	v3WorkloadID, _ := graph.Id(testCluster, appNamespace, appName, appNamespace, "ratings-v3", appName, "v3", graph.GraphTypeVersionedApp)
	v3Node, found := trafficMap[v3WorkloadID]
	assert.True(found)
	assert.NotContains(v3Node.Metadata, graph.HasWorkloadEntry)

	globalInfo := graph.NewAppenderGlobalInfo()
	globalInfo.HomeCluster = testCluster
	globalInfo.Business = businessLayer
	namespaceInfo := graph.NewAppenderNamespaceInfo(appNamespace)

	// Run the appender...
	a := appender.WorkloadEntryAppender{}
	a.AppendGraph(trafficMap, globalInfo, namespaceInfo)

	assert.Equal(4, len(trafficMap))

	workloadV1ID, _ := graph.Id(testCluster, appNamespace, appName, appNamespace, "ratings-v1", appName, "v1", graph.GraphTypeVersionedApp)
	workloadV1Node, found := trafficMap[workloadV1ID]
	assert.True(found)
	assert.Equal(workloadV1Node.Metadata[graph.HasWorkloadEntry], []graph.WEInfo{{Name: "workloadA"}})

	workloadV2ID, _ := graph.Id(testCluster, appNamespace, appName, appNamespace, "ratings-v2", appName, "v2", graph.GraphTypeVersionedApp)
	workloadV2Node, found := trafficMap[workloadV2ID]
	assert.True(found)
	assert.Equal(workloadV2Node.Metadata[graph.HasWorkloadEntry], []graph.WEInfo{{Name: "workloadB"}})

	workloadV3ID, _ := graph.Id(testCluster, appNamespace, appName, appNamespace, "ratings-v3", appName, "v3", graph.GraphTypeVersionedApp)
	workloadV3Node, found := trafficMap[workloadV3ID]
	assert.True(found)
	assert.NotContains(workloadV3Node.Metadata, graph.HasWorkloadEntry)
}

func TestWorkloadEntryAppLabelNotMatching(t *testing.T) {
	assert := require.New(t)

	workloadV1 := &kubernetes.GenericIstioObject{
		ObjectMeta: meta_v1.ObjectMeta{
			Name:      "workloadA",
			Namespace: appNamespace,
		},
		Spec: map[string]interface{}{
			"labels": map[string]interface{}{
				"app":     "pastamaker",
				"version": "v1",
			},
		},
	}
	workloadV2 := &kubernetes.GenericIstioObject{
		ObjectMeta: meta_v1.ObjectMeta{
			Name:      "workloadB",
			Namespace: appNamespace,
		},
		Spec: map[string]interface{}{
			"labels": map[string]interface{}{
				"app":     "pastamaker",
				"version": "v2",
			},
		},
	}

	businessLayer := setupBusinessLayer(workloadV1, workloadV2)
	trafficMap := workloadEntriesTrafficMap()

	assert.Equal(4, len(trafficMap))

	seSVCID, _ := graph.Id(testCluster, appNamespace, appName, appNamespace, "", "", "", graph.GraphTypeVersionedApp)
	seSVCNode, found := trafficMap[seSVCID]
	assert.True(found)
	assert.Equal(3, len(seSVCNode.Edges))

	v1WorkloadID, _ := graph.Id(testCluster, appNamespace, appName, appNamespace, "ratings-v1", appName, "v1", graph.GraphTypeVersionedApp)
	v1Node, found := trafficMap[v1WorkloadID]
	assert.True(found)
	assert.NotContains(v1Node.Metadata, graph.HasWorkloadEntry)

	v2WorkloadID, _ := graph.Id(testCluster, appNamespace, appName, appNamespace, "ratings-v2", appName, "v2", graph.GraphTypeVersionedApp)
	v2Node, found := trafficMap[v2WorkloadID]
	assert.True(found)
	assert.NotContains(v2Node.Metadata, graph.HasWorkloadEntry)

	v3WorkloadID, _ := graph.Id(testCluster, appNamespace, appName, appNamespace, "ratings-v3", appName, "v3", graph.GraphTypeVersionedApp)
	v3Node, found := trafficMap[v3WorkloadID]
	assert.True(found)
	assert.NotContains(v3Node.Metadata, graph.HasWorkloadEntry)

	globalInfo := graph.NewAppenderGlobalInfo()
	globalInfo.HomeCluster = testCluster
	globalInfo.Business = businessLayer
	namespaceInfo := graph.NewAppenderNamespaceInfo(appNamespace)

	// Run the appender...
	a := appender.WorkloadEntryAppender{}
	a.AppendGraph(trafficMap, globalInfo, namespaceInfo)

	assert.Equal(4, len(trafficMap))

	workloadV1ID, _ := graph.Id(testCluster, appNamespace, appName, appNamespace, "ratings-v1", appName, "v1", graph.GraphTypeVersionedApp)
	workloadV1Node, found := trafficMap[workloadV1ID]
	assert.True(found)
	assert.NotContains(workloadV1Node.Metadata, graph.HasWorkloadEntry)

	workloadV2ID, _ := graph.Id(testCluster, appNamespace, appName, appNamespace, "ratings-v2", appName, "v2", graph.GraphTypeVersionedApp)
	workloadV2Node, found := trafficMap[workloadV2ID]
	assert.True(found)
	assert.NotContains(workloadV2Node.Metadata, graph.HasWorkloadEntry)

	workloadV3ID, _ := graph.Id(testCluster, appNamespace, appName, appNamespace, "ratings-v3", appName, "v3", graph.GraphTypeVersionedApp)
	workloadV3Node, found := trafficMap[workloadV3ID]
	assert.True(found)
	assert.NotContains(workloadV3Node.Metadata, graph.HasWorkloadEntry)
}

func TestMultipleWorkloadEntryForSameWorkload(t *testing.T) {
	assert := require.New(t)

	workloadV1A := &kubernetes.GenericIstioObject{
		ObjectMeta: meta_v1.ObjectMeta{
			Name:      "workloadV1A",
			Namespace: appNamespace,
		},
		Spec: map[string]interface{}{
			"labels": map[string]interface{}{
				"app":     appName,
				"version": "v1",
			},
		},
	}
	workloadV1B := &kubernetes.GenericIstioObject{
		ObjectMeta: meta_v1.ObjectMeta{
			Name:      "workloadV1B",
			Namespace: appNamespace,
		},
		Spec: map[string]interface{}{
			"labels": map[string]interface{}{
				"app":     appName,
				"version": "v1",
			},
		},
	}
	workloadV2 := &kubernetes.GenericIstioObject{
		ObjectMeta: meta_v1.ObjectMeta{
			Name:      "workloadV2",
			Namespace: appNamespace,
		},
		Spec: map[string]interface{}{
			"labels": map[string]interface{}{
				"app":     appName,
				"version": "v2",
			},
		},
	}

	businessLayer := setupBusinessLayer(workloadV1A, workloadV1B, workloadV2)
	trafficMap := workloadEntriesTrafficMap()

	assert.Equal(4, len(trafficMap))

	seSVCID, _ := graph.Id(testCluster, appNamespace, appName, appNamespace, "", "", "", graph.GraphTypeVersionedApp)
	seSVCNode, found := trafficMap[seSVCID]
	assert.True(found)
	assert.Equal(3, len(seSVCNode.Edges))

	v1WorkloadID, _ := graph.Id(testCluster, appNamespace, appName, appNamespace, "ratings-v1", appName, "v1", graph.GraphTypeVersionedApp)
	v1Node, found := trafficMap[v1WorkloadID]
	assert.True(found)
	assert.NotContains(v1Node.Metadata, graph.HasWorkloadEntry)

	v2WorkloadID, _ := graph.Id(testCluster, appNamespace, appName, appNamespace, "ratings-v2", appName, "v2", graph.GraphTypeVersionedApp)
	v2Node, found := trafficMap[v2WorkloadID]
	assert.True(found)
	assert.NotContains(v2Node.Metadata, graph.HasWorkloadEntry)

	v3WorkloadID, _ := graph.Id(testCluster, appNamespace, appName, appNamespace, "ratings-v3", appName, "v3", graph.GraphTypeVersionedApp)
	v3Node, found := trafficMap[v3WorkloadID]
	assert.True(found)
	assert.NotContains(v3Node.Metadata, graph.HasWorkloadEntry)

	globalInfo := graph.NewAppenderGlobalInfo()
	globalInfo.HomeCluster = testCluster
	globalInfo.Business = businessLayer
	namespaceInfo := graph.NewAppenderNamespaceInfo(appNamespace)

	// Run the appender...
	a := appender.WorkloadEntryAppender{}
	a.AppendGraph(trafficMap, globalInfo, namespaceInfo)

	assert.Equal(4, len(trafficMap))

	workloadV1ID, _ := graph.Id(testCluster, appNamespace, appName, appNamespace, "ratings-v1", appName, "v1", graph.GraphTypeVersionedApp)
	workloadV1Node, found := trafficMap[workloadV1ID]
	assert.True(found)
	assert.Equal(
		workloadV1Node.Metadata[graph.HasWorkloadEntry],
		[]graph.WEInfo{{Name: "workloadV1A"}, {Name: "workloadV1B"}},
	)

	workloadV2ID, _ := graph.Id(testCluster, appNamespace, appName, appNamespace, "ratings-v2", appName, "v2", graph.GraphTypeVersionedApp)
	workloadV2Node, found := trafficMap[workloadV2ID]
	assert.True(found)
	assert.Equal(workloadV2Node.Metadata[graph.HasWorkloadEntry], []graph.WEInfo{{Name: "workloadV2"}})

	workloadV3ID, _ := graph.Id(testCluster, appNamespace, appName, appNamespace, "ratings-v3", appName, "v3", graph.GraphTypeVersionedApp)
	workloadV3Node, found := trafficMap[workloadV3ID]
	assert.True(found)
	assert.NotContains(workloadV3Node.Metadata, graph.HasWorkloadEntry)
}

func TestWorkloadWithoutWorkloadEntries(t *testing.T) {
	assert := require.New(t)

	businessLayer := setupBusinessLayer()
	trafficMap := workloadEntriesTrafficMap()

	assert.Equal(4, len(trafficMap))

	seSVCID, _ := graph.Id(testCluster, appNamespace, appName, appNamespace, "", "", "", graph.GraphTypeVersionedApp)
	seSVCNode, found := trafficMap[seSVCID]
	assert.True(found)
	assert.Equal(3, len(seSVCNode.Edges))

	v1WorkloadID, _ := graph.Id(testCluster, appNamespace, appName, appNamespace, "ratings-v1", appName, "v1", graph.GraphTypeVersionedApp)
	v1Node, found := trafficMap[v1WorkloadID]
	assert.True(found)
	assert.NotContains(v1Node.Metadata, graph.HasWorkloadEntry)

	v2WorkloadID, _ := graph.Id(testCluster, appNamespace, appName, appNamespace, "ratings-v2", appName, "v2", graph.GraphTypeVersionedApp)
	v2Node, found := trafficMap[v2WorkloadID]
	assert.True(found)
	assert.NotContains(v2Node.Metadata, graph.HasWorkloadEntry)

	v3WorkloadID, _ := graph.Id(testCluster, appNamespace, appName, appNamespace, "ratings-v3", appName, "v3", graph.GraphTypeVersionedApp)
	v3Node, found := trafficMap[v3WorkloadID]
	assert.True(found)
	assert.NotContains(v3Node.Metadata, graph.HasWorkloadEntry)

	globalInfo := graph.NewAppenderGlobalInfo()
	globalInfo.HomeCluster = testCluster
	globalInfo.Business = businessLayer
	namespaceInfo := graph.NewAppenderNamespaceInfo(appNamespace)

	// Run the appender...
	a := appender.WorkloadEntryAppender{}
	a.AppendGraph(trafficMap, globalInfo, namespaceInfo)

	assert.Equal(4, len(trafficMap))

	workloadV1ID, _ := graph.Id(testCluster, appNamespace, appName, appNamespace, "ratings-v1", appName, "v1", graph.GraphTypeVersionedApp)
	workloadV1Node, found := trafficMap[workloadV1ID]
	assert.True(found)
	assert.NotContains(workloadV1Node.Metadata, graph.HasWorkloadEntry)

	workloadV2ID, _ := graph.Id(testCluster, appNamespace, appName, appNamespace, "ratings-v2", appName, "v2", graph.GraphTypeVersionedApp)
	workloadV2Node, found := trafficMap[workloadV2ID]
	assert.True(found)
	assert.NotContains(workloadV2Node.Metadata, graph.HasWorkloadEntry)

	workloadV3ID, _ := graph.Id(testCluster, appNamespace, appName, appNamespace, "ratings-v3", appName, "v3", graph.GraphTypeVersionedApp)
	workloadV3Node, found := trafficMap[workloadV3ID]
	assert.True(found)
	assert.NotContains(workloadV3Node.Metadata, graph.HasWorkloadEntry)
}
