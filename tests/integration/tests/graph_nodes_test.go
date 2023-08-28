package tests

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/util/wait"

	"github.com/kiali/kiali/tests/integration/utils"
)

func TestAppGraph(t *testing.T) {
	require := require.New(t)
	name := "details"
	graphType := "app"
	requireGraphConfig("applications", graphType, utils.BOOKINFO, name, require)
}

func TestAppVersionGraph(t *testing.T) {
	require := require.New(t)
	name := "details"
	graphType := "app"
	requireGraphConfig("applications", graphType, utils.BOOKINFO, name, require)
}

func TestVersionedAppGraph(t *testing.T) {
	require := require.New(t)
	name := "ratings"
	graphType := "versionedApp"
	pollErr := wait.Poll(time.Second, time.Minute, func() (bool, error) {
		config, statusCode, err := utils.AppVersionGraph(graphType, name, "v1", utils.BOOKINFO)
		if statusCode != 200 {
			return false, err
		}
		require.Equal(config.GraphType, graphType)
		require.NotNil(config.Elements)
		return len(config.Elements.Nodes) > 0 && len(config.Elements.Edges) > 0, nil
	})
	require.Nil(pollErr, "Graph elements should contains Nodes and Edges")
}

func TestAppGraphEmpty(t *testing.T) {
	require := require.New(t)
	name := "detailswrong"
	graphType := "app"
	requireEmptyGraphConfig("applications", graphType, utils.BOOKINFO, name, require)
}

func TestServiceGraph(t *testing.T) {
	require := require.New(t)
	name := "details"
	graphType := "versionedApp"
	requireGraphConfig("services", graphType, utils.BOOKINFO, name, require)
}

func TestServiceGraphEmpty(t *testing.T) {
	require := require.New(t)
	name := "detailswrong"
	graphType := "workload"
	requireEmptyGraphConfig("services", graphType, utils.BOOKINFO, name, require)
}

func TestWorkloadGraph(t *testing.T) {
	require := require.New(t)
	name := "details-v1"
	graphType := "workload"
	requireGraphConfig("workloads", graphType, utils.BOOKINFO, name, require)
}

func TestWorkloadGraphEmpty(t *testing.T) {
	require := require.New(t)
	name := "reviews-wrong"
	graphType := "workload"
	requireEmptyGraphConfig("workloads", graphType, utils.BOOKINFO, name, require)
}

func requireGraphConfig(objectType, graphType, namespace, name string, require *require.Assertions) {
	pollErr := wait.Poll(time.Second, time.Minute, func() (bool, error) {
		config, statusCode, err := utils.ObjectGraph(objectType, graphType, name, namespace)
		if statusCode != 200 {
			return false, err
		}
		require.Equal(config.GraphType, graphType)
		require.NotNil(config.Elements)
		return len(config.Elements.Nodes) > 0 && len(config.Elements.Edges) > 0, nil
	})
	require.Nil(pollErr, "Graph elements should contains Nodes and Edges")
}

func requireEmptyGraphConfig(objectType, graphType, namespace, name string, require *require.Assertions) {
	config, statusCode, err := utils.ObjectGraph(objectType, graphType, name, namespace)
	require.Equal(200, statusCode)
	require.Nil(err)
	require.Equal(config.GraphType, graphType)
	require.NotNil(config.Elements)
	require.Empty(config.Elements.Nodes)
	require.Empty(config.Elements.Edges)
}
