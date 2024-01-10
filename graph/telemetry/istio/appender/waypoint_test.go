package appender

import (
	"testing"

	"github.com/stretchr/testify/require"
	core_v1 "k8s.io/api/core/v1"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

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
)

func setupWorkloadEntries(t *testing.T) *business.Layer {
	k8spod1 := &core_v1.Pod{
		ObjectMeta: meta_v1.ObjectMeta{
			Name:        "workloadA",
			Namespace:   appNamespace,
			Labels:      map[string]string{"apps": "workloadA", "version": "v1"},
			Annotations: map[string]string{"sidecar.istio.io/status": "{\"version\":\"\",\"initContainers\":[\"istio-init\",\"enable-core-dump\"],\"containers\":[\"istio-proxy\"],\"volumes\":[\"istio-envoy\",\"istio-certs\"]}"}},
		Spec: core_v1.PodSpec{
			Containers: []core_v1.Container{
				{Name: "workloadA", Image: "whatever"},
			},
		}}
	k8spod2 := &core_v1.Pod{
		ObjectMeta: meta_v1.ObjectMeta{
			Name:        "workloadB",
			Namespace:   appNamespace,
			Labels:      map[string]string{"apps": "workloadB", "version": "v2"},
			Annotations: map[string]string{"sidecar.istio.io/status": "{\"version\":\"\",\"initContainers\":[\"istio-init\",\"enable-core-dump\"],\"containers\":[\"istio-proxy\"],\"volumes\":[\"istio-envoy\",\"istio-certs\"]}"}},
		Spec: core_v1.PodSpec{
			Containers: []core_v1.Container{
				{Name: "workloadB", Image: "whatever"},
			},
		}}
	k8spod3 := &core_v1.Pod{
		ObjectMeta: meta_v1.ObjectMeta{
			Name:        "fake-istio-waypoint",
			Namespace:   appNamespace,
			Labels:      map[string]string{"apps": "fake-istio-waypoint", "version": "v1"},
			Annotations: map[string]string{"sidecar.istio.io/status": "{\"version\":\"\",\"initContainers\":[\"istio-init\",\"enable-core-dump\"],\"containers\":[\"istio-proxy\"],\"volumes\":[\"istio-envoy\",\"istio-certs\"]}"}},
		Spec: core_v1.PodSpec{
			Containers: []core_v1.Container{
				{Name: "fake-istio-waypoint", Image: "whatever"},
			},
		}}
	k8spod4 := &core_v1.Pod{
		ObjectMeta: meta_v1.ObjectMeta{
			Name:        "namespace-istio-waypoint",
			Namespace:   appNamespace,
			Labels:      map[string]string{"apps": "namespace-istio-waypoint", "version": "v1", config.WaypointLabel: config.WaypointLabelValue},
			Annotations: map[string]string{"sidecar.istio.io/status": "{\"version\":\"\",\"initContainers\":[\"istio-init\",\"enable-core-dump\"],\"containers\":[\"istio-proxy\"],\"volumes\":[\"istio-envoy\",\"istio-certs\"]}"}},
		Spec: core_v1.PodSpec{
			Containers: []core_v1.Container{
				{Name: "namespace-istio-waypoint", Image: "whatever"},
			},
		}}

	ns := &core_v1.Namespace{ObjectMeta: meta_v1.ObjectMeta{Name: appNamespace}}

	k8s := kubetest.NewFakeK8sClient(k8spod1, k8spod2, k8spod3, k8spod4, ns)
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
