package istio

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/graph"
)

func TestAddTrafficSkipsDestServicesForWaypointDest(t *testing.T) {
	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "Kubernetes"
	config.Set(conf)

	trafficMap := graph.TrafficMap{}
	o := graph.TelemetryOptions{CommonOptions: graph.CommonOptions{GraphType: graph.GraphTypeWorkload}}

	const (
		cluster = "Kubernetes"
		ns      = "bookinfo"
	)

	addTraffic(
		context.Background(),
		trafficMap,
		"istio_tcp_sent_bytes_total",
		false,
		100,
		graph.TCP.Name,
		"",
		"",
		"details.bookinfo.svc.cluster.local",
		cluster, ns, "", "productpage-v1", "productpage", "v1",
		cluster, ns, "details", ns, "waypoint", "", "latest",
		false, true,
		o,
	)

	destID, destNodeType, err := graph.Id(cluster, ns, "details", ns, "waypoint", "", "latest", graph.GraphTypeWorkload)
	require.NoError(t, err)
	require.Equal(t, graph.NodeTypeWorkload, destNodeType)

	destNode := trafficMap[destID]
	require.NotNil(t, destNode)
	assert.Equal(t, true, destNode.Metadata[graph.IsWaypoint])
	_, hasDestServices := destNode.Metadata[graph.DestServices]
	assert.False(t, hasDestServices, "waypoint destination nodes must not accumulate destServices")
}

func TestAddTrafficSetsDestServicesForNonWaypointDest(t *testing.T) {
	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "Kubernetes"
	config.Set(conf)

	trafficMap := graph.TrafficMap{}
	o := graph.TelemetryOptions{CommonOptions: graph.CommonOptions{GraphType: graph.GraphTypeWorkload}}

	const (
		cluster = "Kubernetes"
		ns      = "bookinfo"
	)

	addTraffic(
		context.Background(),
		trafficMap,
		"istio_tcp_sent_bytes_total",
		false,
		100,
		graph.TCP.Name,
		"",
		"",
		"details.bookinfo.svc.cluster.local",
		cluster, ns, "", "productpage-v1", "productpage", "v1",
		cluster, ns, "details", ns, "details-v1", "details", "v1",
		false, false,
		o,
	)

	destID, _, err := graph.Id(cluster, ns, "details", ns, "details-v1", "details", "v1", graph.GraphTypeWorkload)
	require.NoError(t, err)

	destNode := trafficMap[destID]
	require.NotNil(t, destNode)

	destServices, ok := destNode.Metadata[graph.DestServices].(graph.DestServicesMetadata)
	require.True(t, ok)
	require.Len(t, destServices, 1)
	for _, ds := range destServices {
		assert.Equal(t, "details", ds.Name)
		assert.Equal(t, ns, ds.Namespace)
		break
	}
}
