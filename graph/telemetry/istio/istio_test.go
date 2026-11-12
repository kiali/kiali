package istio

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	ctrlclient "sigs.k8s.io/controller-runtime/pkg/client"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/cache"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/graph"
	"github.com/kiali/kiali/graph/telemetry/istio/appender"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/models"
)

func TestDropUnavailableClusterNodes(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = config.DefaultClusterID
	config.Set(conf)
	k8s := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("testNamespace"))
	layer := business.NewLayerBuilder(t, config.Get()).WithClient(k8s).Build()

	home := &graph.Node{ID: "homeNode", Cluster: config.DefaultClusterID, Namespace: "testNamespace", NodeType: graph.NodeTypeWorkload}
	remote := &graph.Node{ID: "remoteNode", Cluster: "remote-cluster", Namespace: "testNamespace", NodeType: graph.NodeTypeWorkload}
	external := &graph.Node{ID: "externalNode", Cluster: "unknown", Namespace: graph.Unknown, NodeType: graph.NodeTypeWorkload}
	home.Edges = []*graph.Edge{{Source: home, Dest: remote}, {Source: home, Dest: external}}
	trafficMap := graph.TrafficMap{home.ID: home, remote.ID: remote, external.ID: external}

	clusters := []models.KubeCluster{{Name: config.DefaultClusterID}, {Name: "remote-cluster"}}
	globalInfo := graph.NewGlobalInfo(layer, nil, config.Get(), clusters, appender.NewGlobalIstioInfo())
	dropUnavailableClusterNodes(context.Background(), trafficMap, globalInfo)

	assert.Contains(trafficMap, "homeNode", "the available cluster's nodes are kept")
	assert.NotContains(trafficMap, "remoteNode", "the unavailable cluster's nodes are dropped")
	assert.Contains(trafficMap, "externalNode", "a cluster that is not a Kiali cluster (external traffic) is left alone")
	assert.Len(home.Edges, 1, "only the edge pointing at the dropped node is removed")
	assert.Equal(external, home.Edges[0].Dest)
}

func TestDropUnavailableClusterNodesFailsOnHomeCluster(t *testing.T) {
	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = config.DefaultClusterID
	config.Set(conf)
	k8s := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("testNamespace"))

	// Degrade the home cluster's cache (revoked access confirmed): the home cluster
	// is not skippable, so building the graph must fail cleanly instead of
	// rendering around it.
	access := cache.NewClusterAccess(func(context.Context, string, string, string) (bool, error) {
		return false, nil
	})
	access.ConfirmRevoked(context.Background(), config.DefaultClusterID, "apps", "deployments")
	clients := map[string]kubernetes.ClientInterface{config.DefaultClusterID: k8s}
	clusterCache, err := cache.NewKialiCache(context.Background(), clients, map[string]ctrlclient.Reader{config.DefaultClusterID: k8s}, *conf, cache.WithClusterAccess(access))
	require.NoError(t, err)
	layer := business.NewLayerBuilder(t, conf).WithClient(k8s).WithCache(clusterCache).Build()

	home := &graph.Node{ID: "homeNode", Cluster: config.DefaultClusterID, Namespace: "testNamespace", NodeType: graph.NodeTypeWorkload}
	trafficMap := graph.TrafficMap{home.ID: home}
	clusters := []models.KubeCluster{{Name: config.DefaultClusterID}}
	globalInfo := graph.NewGlobalInfo(layer, nil, config.Get(), clusters, appender.NewGlobalIstioInfo())

	assert.Panics(t, func() {
		dropUnavailableClusterNodes(context.Background(), trafficMap, globalInfo)
	})
}
