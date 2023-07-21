package tests

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/util/wait"

	"github.com/kiali/kiali/tests/integration/utils/kiali"
)

func TestAppBase(t *testing.T) {
	require := require.New(t)
	params := map[string]string{"graphType": "app", "duration": "60s"}
	assertBoxBy(params, require)
}

func TestAppNoLabels(t *testing.T) {
	require := require.New(t)
	params := map[string]string{"graphType": "app", "edges": "noEdgeLabels", "duration": "60s"}
	assertGraph(params, require)
}

func TestAppRequestsPerSecond(t *testing.T) {
	require := require.New(t)
	params := map[string]string{"graphType": "app", "edges": "requestsPerSecond", "duration": "60s"}
	assertGraph(params, require)
}

func TestAppRequestsPercentage(t *testing.T) {
	require := require.New(t)
	params := map[string]string{"graphType": "app", "edges": "requestsPercentage", "duration": "60s"}
	assertGraph(params, require)
}

func TestAppRequestsResponseTime(t *testing.T) {
	require := require.New(t)
	params := map[string]string{"graphType": "app", "edges": "responseTime", "duration": "60s"}
	assertGraph(params, require)
}

func TestAppInjectServiceNodesTrue(t *testing.T) {
	require := require.New(t)
	params := map[string]string{"graphType": "app", "edges": "responseTime", "duration": "60s", "injectServiceNodes": "true"}
	assertGraph(params, require)
}

func TestAppInjectServiceNodesFalse(t *testing.T) {
	require := require.New(t)
	params := map[string]string{"graphType": "app", "edges": "responseTime", "duration": "60s", "injectServiceNodes": "false"}
	assertGraph(params, require)
}

func TestAppAppendersBlank(t *testing.T) {
	require := require.New(t)
	params := map[string]string{"graphType": "app", "duration": "60s", "appenders": ""}
	assertGraph(params, require)
}

func TestAppAppendersInvalid(t *testing.T) {
	require := require.New(t)
	params := map[string]string{"graphType": "app", "duration": "60s", "appenders": "invalid"}
	assertGraphInvalid(params, require)
}

func TestServiceBase(t *testing.T) {
	require := require.New(t)
	params := map[string]string{"graphType": "service", "duration": "300s"}
	assertBoxBy(params, require)
}

func TestServiceNoLabels(t *testing.T) {
	require := require.New(t)
	params := map[string]string{"graphType": "service", "edges": "noEdgeLabels", "duration": "300s"}
	assertGraph(params, require)
}

func TestServiceRequestsPerSecond(t *testing.T) {
	require := require.New(t)
	params := map[string]string{"graphType": "service", "edges": "requestsPerSecond", "duration": "300s"}
	assertGraph(params, require)
}

func TestServiceRequestsPercentage(t *testing.T) {
	require := require.New(t)
	params := map[string]string{"graphType": "service", "edges": "requestsPercentage", "duration": "300s"}
	assertGraph(params, require)
}

func TestServiceResponseTime(t *testing.T) {
	require := require.New(t)
	params := map[string]string{"graphType": "service", "edges": "responseTime", "duration": "300s"}
	assertGraph(params, require)
}

func TestServiceInjectServiceNodesTrue(t *testing.T) {
	require := require.New(t)
	params := map[string]string{"graphType": "service", "edges": "responseTime", "duration": "60s", "injectServiceNodes": "true"}
	assertGraph(params, require)
}

func TestServiceInjectServiceNodesFalse(t *testing.T) {
	require := require.New(t)
	params := map[string]string{"graphType": "service", "edges": "responseTime", "duration": "60s", "injectServiceNodes": "false"}
	assertGraph(params, require)
}

func TestServiceAppendersBlank(t *testing.T) {
	require := require.New(t)
	params := map[string]string{"graphType": "service", "duration": "60s", "appenders": ""}
	assertGraph(params, require)
}

func TestVersionedAppBase(t *testing.T) {
	require := require.New(t)
	params := map[string]string{"graphType": "versionedApp", "duration": "600s"}
	assertBoxBy(params, require)
}

func TestVersionedAppNoLabels(t *testing.T) {
	require := require.New(t)
	params := map[string]string{"graphType": "versionedApp", "edges": "noEdgeLabels", "duration": "600s"}
	assertGraph(params, require)
}

func TestVersionedAppRequestsPerSecond(t *testing.T) {
	require := require.New(t)
	params := map[string]string{"graphType": "versionedApp", "edges": "requestsPerSecond", "duration": "600s"}
	assertGraph(params, require)
}

func TestVersionedAppRequestsPercentage(t *testing.T) {
	require := require.New(t)
	params := map[string]string{"graphType": "versionedApp", "edges": "requestsPercentage", "duration": "600s"}
	assertGraph(params, require)
}

func TestVersionedAppRequestsResponseTime(t *testing.T) {
	require := require.New(t)
	params := map[string]string{"graphType": "versionedApp", "edges": "responseTime", "duration": "600s"}
	assertGraph(params, require)
}

func TestVersionedAppRInjectServiceNodesTrue(t *testing.T) {
	require := require.New(t)
	params := map[string]string{"graphType": "versionedApp", "edges": "responseTime", "duration": "60s", "injectServiceNodes": "true"}
	assertGraph(params, require)
}

func TestVersionedAppRInjectServiceNodesFalse(t *testing.T) {
	require := require.New(t)
	params := map[string]string{"graphType": "versionedApp", "edges": "responseTime", "duration": "60s", "injectServiceNodes": "false"}
	assertGraph(params, require)
}

func TestVersionedAppAppendersBlank(t *testing.T) {
	require := require.New(t)
	params := map[string]string{"graphType": "versionedApp", "duration": "60s", "appenders": ""}
	assertGraph(params, require)
}

func TestWorkloadNoLabels(t *testing.T) {
	require := require.New(t)
	params := map[string]string{"graphType": "workload", "edges": "noEdgeLabels", "duration": "21600s"}
	assertGraph(params, require)
}

func TestWorkloadRequestsPerSecond(t *testing.T) {
	require := require.New(t)
	params := map[string]string{"graphType": "workload", "edges": "requestsPerSecond", "duration": "21600s"}
	assertGraph(params, require)
}

func TestWorkloadRequestPercentage(t *testing.T) {
	require := require.New(t)
	params := map[string]string{"graphType": "workload", "edges": "requestsPercentage", "duration": "21600s"}
	assertGraph(params, require)
}

func TestWorkloadRequestsResponseTime(t *testing.T) {
	require := require.New(t)
	params := map[string]string{"graphType": "workload", "edges": "responseTime", "duration": "21600s"}
	assertGraph(params, require)
}

func TestWorkloadAppendersBlank(t *testing.T) {
	require := require.New(t)
	params := map[string]string{"graphType": "workload", "duration": "60s", "appenders": ""}
	assertGraph(params, require)
}

func TestBoxNegative(t *testing.T) {
	require := require.New(t)
	params := map[string]string{"graphType": "app", "duration": "60s"}
	params["boxBy"] = "junk"
	assertGraphInvalid(params, require)
}

func TestGraphTypeNegative(t *testing.T) {
	require := require.New(t)
	params := map[string]string{"graphType": "app", "duration": "60s"}
	params["graphType"] = "junk"
	assertGraphInvalid(params, require)
}

func TestDisplayIdleEdges(t *testing.T) {
	require := require.New(t)
	params := map[string]string{"graphType": "versionedApp", "duration": "300s", "idleEdges": "true"}
	assertGraph(params, require)
}

func TestDisplayIdleNodes(t *testing.T) {
	require := require.New(t)
	params := map[string]string{"graphType": "versionedApp", "duration": "300s", "idleNodes": "true"}
	assertGraph(params, require)
}

func TestDisplayOperationNodes(t *testing.T) {
	require := require.New(t)
	params := map[string]string{"graphType": "versionedApp", "duration": "300s", "operationNodes": "true"}
	assertGraph(params, require)
}

func TestDisplayServiceNodes(t *testing.T) {
	require := require.New(t)
	params := map[string]string{"graphType": "versionedApp", "duration": "300s", "injectServiceNodes": "true"}
	assertGraph(params, require)
}

func assertGraphInvalid(params map[string]string, require *require.Assertions) {
	params["namespaces"] = kiali.BOOKINFO
	_, statusCode, _ := kiali.Graph(params)
	require.Equal(statusCode, 400)
}

func assertGraph(params map[string]string, require *require.Assertions) {
	params["namespaces"] = kiali.BOOKINFO
	ctx := context.TODO()
	pollErr := wait.PollUntilContextTimeout(ctx, time.Second, time.Minute, false, func(ctx context.Context) (bool, error) {
		graph, statusCode, err := kiali.Graph(params)
		if statusCode != 200 {
			return false, err
		}

		for key, value := range params {
			switch key {
			case "duration":
				require.Contains(value, fmt.Sprintf("%d", graph.Duration))
			case "graphType":
				require.Equal(value, graph.GraphType)
			}
		}
		return len(graph.Elements.Nodes) > 0 && len(graph.Elements.Edges) > 0, nil
	})
	require.Nil(pollErr, "Graph elements should contains Nodes and Edges")
}

func assertBoxBy(params map[string]string, require *require.Assertions) {
	for _, v := range []string{"cluster", "namespace", "app"} {
		params["boxBy"] = v
		assertGraph(params, require)
	}
}
