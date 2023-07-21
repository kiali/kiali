package tests

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/util/wait"

	"github.com/kiali/kiali/tests/integration/utils/kiali"
)

func TestAppGraph(t *testing.T) {
	require := require.New(t)
	name := "details"
	graphType := "app"
	assertGraphConfig("applications", graphType, kiali.BOOKINFO, name, require)
}

func TestAppVersionGraph(t *testing.T) {
	require := require.New(t)
	name := "details"
	graphType := "app"
	assertGraphConfig("applications", graphType, kiali.BOOKINFO, name, require)
}

func TestVersionedAppGraph(t *testing.T) {
	require := require.New(t)
	name := "ratings"
	graphType := "versionedApp"
	ctx := context.TODO()
	pollErr := wait.PollUntilContextTimeout(ctx, time.Second, time.Minute, false, func(ctx context.Context) (bool, error) {
		config, statusCode, err := kiali.AppVersionGraph(graphType, name, "v1", kiali.BOOKINFO)
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
	assertEmptyGraphConfig("applications", graphType, kiali.BOOKINFO, name, require)
}

func TestServiceGraph(t *testing.T) {
	require := require.New(t)
	name := "details"
	graphType := "versionedApp"
	assertGraphConfig("services", graphType, kiali.BOOKINFO, name, require)
}

func TestServiceGraphEmpty(t *testing.T) {
	require := require.New(t)
	name := "detailswrong"
	graphType := "workload"
	assertEmptyGraphConfig("services", graphType, kiali.BOOKINFO, name, require)
}

func TestWorkloadGraph(t *testing.T) {
	require := require.New(t)
	name := "details-v1"
	graphType := "workload"
	assertGraphConfig("workloads", graphType, kiali.BOOKINFO, name, require)
}

func TestWorkloadGraphEmpty(t *testing.T) {
	require := require.New(t)
	name := "reviews-wrong"
	graphType := "workload"
	assertEmptyGraphConfig("workloads", graphType, kiali.BOOKINFO, name, require)
}

func assertGraphConfig(objectType, graphType, namespace, name string, require *require.Assertions) {
	ctx := context.TODO()
	pollErr := wait.PollUntilContextTimeout(ctx, time.Second, time.Minute, false, func(ctx context.Context) (bool, error) {
		config, statusCode, err := kiali.ObjectGraph(objectType, graphType, name, namespace)
		if statusCode != 200 {
			return false, err
		}
		require.Equal(config.GraphType, graphType)
		require.NotNil(config.Elements)
		return len(config.Elements.Nodes) > 0 && len(config.Elements.Edges) > 0, nil
	})
	require.Nil(pollErr, "Graph elements should contains Nodes and Edges")
}

func assertEmptyGraphConfig(objectType, graphType, namespace, name string, require *require.Assertions) {
	config, statusCode, err := kiali.ObjectGraph(objectType, graphType, name, namespace)
	require.Equal(200, statusCode)
	require.NoError(err)
	require.Equal(config.GraphType, graphType)
	require.NotNil(config.Elements)
	require.Empty(config.Elements.Nodes)
	require.Empty(config.Elements.Edges)
}
