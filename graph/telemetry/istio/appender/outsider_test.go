package appender

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/graph"
)

func TestOutsider(t *testing.T) {
	require := require.New(t)

	trafficMap := graph.NewTrafficMap()

	inaccessible, _ := graph.NewNode(config.DefaultClusterID, "inaccessibleNamespace", "test", "inaccessibleNamespace", "test-v1", "test", "v1", graph.GraphTypeVersionedApp)
	trafficMap[inaccessible.ID] = inaccessible

	accessible, _ := graph.NewNode(config.DefaultClusterID, "accessibleNamespace", "test", "accessibleNamespace", "test-v1", "test", "v1", graph.GraphTypeVersionedApp)
	trafficMap[accessible.ID] = accessible

	globalInfo := graph.NewGlobalInfo(context.TODO(), nil, nil, config.Get())
	namespaceInfo := graph.NewAppenderNamespaceInfo("testNamespace")

	a := OutsiderAppender{
		AccessibleNamespaces: map[string]*graph.AccessibleNamespace{
			fmt.Sprintf("%s:accessibleNamespace", config.DefaultClusterID): {
				Name:    "accessibleNamespace",
				Cluster: config.DefaultClusterID,
			},
		},
	}
	a.AppendGraph(trafficMap, globalInfo, namespaceInfo)

	require.Equal(true, trafficMap[inaccessible.ID].Metadata[graph.IsInaccessible])
	require.Equal(nil, trafficMap[accessible.ID].Metadata[graph.IsInaccessible])
}
