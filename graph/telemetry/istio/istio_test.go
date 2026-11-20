package istio

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/cache"
	"github.com/kiali/kiali/cache/cachetest"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/graph"
	"github.com/kiali/kiali/graph/telemetry/istio/appender"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/models"
)

func TestDropUnavailableClusterNodes(t *testing.T) {
	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = config.DefaultClusterID
	config.Set(conf)
	k8s := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("testNamespace"))
	remoteClient := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("testNamespace"))

	// The remote's access was revoked (degraded cache): the production scenario for
	// this function, rather than a cluster the layer simply was built without.
	clients := map[string]kubernetes.ClientInterface{config.DefaultClusterID: k8s, "remote-cluster": remoteClient}
	clusterCache, access, err := cachetest.NewFakeKialiCache(context.Background(), conf, clients,
		func(context.Context, string, string, string) (cache.DeniedAccess, error) {
			return cache.DeniedAccess{Cluster: true}, nil
		})
	require.NoError(t, err)
	require.True(t, access.ConfirmRevoked(context.Background(), "remote-cluster", "apps", "deployments"))
	layer := business.NewLayerBuilder(t, conf).WithClient(k8s).WithCache(clusterCache).Build()

	home := &graph.Node{ID: "homeNode", Cluster: config.DefaultClusterID, Namespace: "testNamespace", NodeType: graph.NodeTypeWorkload}
	kept := &graph.Node{ID: "keptNode", Cluster: config.DefaultClusterID, Namespace: "testNamespace", NodeType: graph.NodeTypeWorkload}
	remote := &graph.Node{ID: "remoteNode", Cluster: "remote-cluster", Namespace: "testNamespace", NodeType: graph.NodeTypeWorkload}
	external := &graph.Node{ID: "externalNode", Cluster: "unknown", Namespace: graph.Unknown, NodeType: graph.NodeTypeWorkload}
	// The dropped edge sits between two survivors so the survivors' order is observable.
	home.Edges = []*graph.Edge{{Source: home, Dest: kept}, {Source: home, Dest: remote}, {Source: home, Dest: external}}
	trafficMap := graph.TrafficMap{home.ID: home, kept.ID: kept, remote.ID: remote, external.ID: external}

	clusters := []models.KubeCluster{{Name: config.DefaultClusterID}, {Name: "remote-cluster"}}
	globalInfo := graph.NewGlobalInfo(layer, nil, config.Get(), clusters, appender.NewGlobalIstioInfo())
	dropUnavailableClusterNodes(trafficMap, globalInfo)

	require.Contains(t, trafficMap, "homeNode", "the available cluster's nodes are kept")
	require.NotContains(t, trafficMap, "remoteNode", "the unavailable cluster's nodes are dropped")
	require.Contains(t, trafficMap, "externalNode", "a cluster that is not a Kiali cluster (external traffic) is left alone")
	require.Len(t, home.Edges, 2, "only the edge pointing at the dropped node is removed")
	require.Equal(t, kept, home.Edges[0].Dest, "surviving edges keep their original order")
	require.Equal(t, external, home.Edges[1].Dest)
}

func TestDropUnavailableClusterNodesFailsOnHomeCluster(t *testing.T) {
	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = config.DefaultClusterID
	config.Set(conf)
	k8s := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("testNamespace"))

	// Degrade the home cluster's cache (revoked access confirmed): the home cluster
	// is not skippable, so building the graph must fail cleanly instead of
	// rendering around it.
	clients := map[string]kubernetes.ClientInterface{config.DefaultClusterID: k8s}
	clusterCache, access, err := cachetest.NewFakeKialiCache(context.Background(), conf, clients,
		func(context.Context, string, string, string) (cache.DeniedAccess, error) {
			return cache.DeniedAccess{Cluster: true}, nil
		})
	require.NoError(t, err)
	access.ConfirmRevoked(context.Background(), config.DefaultClusterID, "apps", "deployments")
	layer := business.NewLayerBuilder(t, conf).WithClient(k8s).WithCache(clusterCache).Build()

	home := &graph.Node{ID: "homeNode", Cluster: config.DefaultClusterID, Namespace: "testNamespace", NodeType: graph.NodeTypeWorkload}
	trafficMap := graph.TrafficMap{home.ID: home}
	clusters := []models.KubeCluster{{Name: config.DefaultClusterID}}
	globalInfo := graph.NewGlobalInfo(layer, nil, config.Get(), clusters, appender.NewGlobalIstioInfo())

	assert.Panics(t, func() {
		dropUnavailableClusterNodes(trafficMap, globalInfo)
	})
}
