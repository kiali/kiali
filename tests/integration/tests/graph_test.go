package tests

import (
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/util/wait"

	"github.com/kiali/kiali/tests/integration/utils"
)

func TestAppBase(t *testing.T) {
	require := require.New(t)
	params := map[string]string{"graphType": "app", "duration": "60s"}
	requireBoxBy(params, require)
}

func TestAppNoLabels(t *testing.T) {
	require := require.New(t)
	params := map[string]string{"graphType": "app", "edges": "noEdgeLabels", "duration": "60s"}
	requireGraph(params, require)
}

func TestAppRequestsPerSecond(t *testing.T) {
	require := require.New(t)
	params := map[string]string{"graphType": "app", "edges": "requestsPerSecond", "duration": "60s"}
	requireGraph(params, require)
}

func TestAppRequestsPercentage(t *testing.T) {
	require := require.New(t)
	params := map[string]string{"graphType": "app", "edges": "requestsPercentage", "duration": "60s"}
	requireGraph(params, require)
}

func TestAppRequestsResponseTime(t *testing.T) {
	require := require.New(t)
	params := map[string]string{"graphType": "app", "edges": "responseTime", "duration": "60s"}
	requireGraph(params, require)
}

func TestAppInjectServiceNodesTrue(t *testing.T) {
	require := require.New(t)
	params := map[string]string{"graphType": "app", "edges": "responseTime", "duration": "60s", "injectServiceNodes": "true"}
	requireGraph(params, require)
}

func TestAppInjectServiceNodesFalse(t *testing.T) {
	require := require.New(t)
	params := map[string]string{"graphType": "app", "edges": "responseTime", "duration": "60s", "injectServiceNodes": "false"}
	requireGraph(params, require)
}

func TestAppAppendersBlank(t *testing.T) {
	require := require.New(t)
	params := map[string]string{"graphType": "app", "duration": "60s", "appenders": ""}
	requireGraph(params, require)
}

func TestAppAppendersInvalid(t *testing.T) {
	require := require.New(t)
	params := map[string]string{"graphType": "app", "duration": "60s", "appenders": "invalid"}
	requireGraphInvalid(params, require)
}

func TestServiceBase(t *testing.T) {
	require := require.New(t)
	params := map[string]string{"graphType": "service", "duration": "300s"}
	requireBoxBy(params, require)
}

func TestServiceNoLabels(t *testing.T) {
	require := require.New(t)
	params := map[string]string{"graphType": "service", "edges": "noEdgeLabels", "duration": "300s"}
	requireGraph(params, require)
}

func TestServiceRequestsPerSecond(t *testing.T) {
	require := require.New(t)
	params := map[string]string{"graphType": "service", "edges": "requestsPerSecond", "duration": "300s"}
	requireGraph(params, require)
}

func TestServiceRequestsPercentage(t *testing.T) {
	require := require.New(t)
	params := map[string]string{"graphType": "service", "edges": "requestsPercentage", "duration": "300s"}
	requireGraph(params, require)
}

func TestServiceResponseTime(t *testing.T) {
	require := require.New(t)
	params := map[string]string{"graphType": "service", "edges": "responseTime", "duration": "300s"}
	requireGraph(params, require)
}

func TestServiceInjectServiceNodesTrue(t *testing.T) {
	require := require.New(t)
	params := map[string]string{"graphType": "service", "edges": "responseTime", "duration": "60s", "injectServiceNodes": "true"}
	requireGraph(params, require)
}

func TestServiceInjectServiceNodesFalse(t *testing.T) {
	require := require.New(t)
	params := map[string]string{"graphType": "service", "edges": "responseTime", "duration": "60s", "injectServiceNodes": "false"}
	requireGraph(params, require)
}

func TestServiceAppendersBlank(t *testing.T) {
	require := require.New(t)
	params := map[string]string{"graphType": "service", "duration": "60s", "appenders": ""}
	requireGraph(params, require)
}

func TestVersionedAppBase(t *testing.T) {
	require := require.New(t)
	params := map[string]string{"graphType": "versionedApp", "duration": "600s"}
	requireBoxBy(params, require)
}

func TestVersionedAppNoLabels(t *testing.T) {
	require := require.New(t)
	params := map[string]string{"graphType": "versionedApp", "edges": "noEdgeLabels", "duration": "600s"}
	requireGraph(params, require)
}

func TestVersionedAppRequestsPerSecond(t *testing.T) {
	require := require.New(t)
	params := map[string]string{"graphType": "versionedApp", "edges": "requestsPerSecond", "duration": "600s"}
	requireGraph(params, require)
}

func TestVersionedAppRequestsPercentage(t *testing.T) {
	require := require.New(t)
	params := map[string]string{"graphType": "versionedApp", "edges": "requestsPercentage", "duration": "600s"}
	requireGraph(params, require)
}

func TestVersionedAppRequestsResponseTime(t *testing.T) {
	require := require.New(t)
	params := map[string]string{"graphType": "versionedApp", "edges": "responseTime", "duration": "600s"}
	requireGraph(params, require)
}

func TestVersionedAppRInjectServiceNodesTrue(t *testing.T) {
	require := require.New(t)
	params := map[string]string{"graphType": "versionedApp", "edges": "responseTime", "duration": "60s", "injectServiceNodes": "true"}
	requireGraph(params, require)
}

func TestVersionedAppRInjectServiceNodesFalse(t *testing.T) {
	require := require.New(t)
	params := map[string]string{"graphType": "versionedApp", "edges": "responseTime", "duration": "60s", "injectServiceNodes": "false"}
	requireGraph(params, require)
}

func TestVersionedAppAppendersBlank(t *testing.T) {
	require := require.New(t)
	params := map[string]string{"graphType": "versionedApp", "duration": "60s", "appenders": ""}
	requireGraph(params, require)
}

func TestWorkloadNoLabels(t *testing.T) {
	require := require.New(t)
	params := map[string]string{"graphType": "workload", "edges": "noEdgeLabels", "duration": "21600s"}
	requireGraph(params, require)
}

func TestWorkloadRequestsPerSecond(t *testing.T) {
	require := require.New(t)
	params := map[string]string{"graphType": "workload", "edges": "requestsPerSecond", "duration": "21600s"}
	requireGraph(params, require)
}

func TestWorkloadRequestPercentage(t *testing.T) {
	require := require.New(t)
	params := map[string]string{"graphType": "workload", "edges": "requestsPercentage", "duration": "21600s"}
	requireGraph(params, require)
}

func TestWorkloadRequestsResponseTime(t *testing.T) {
	require := require.New(t)
	params := map[string]string{"graphType": "workload", "edges": "responseTime", "duration": "21600s"}
	requireGraph(params, require)
}

func TestWorkloadAppendersBlank(t *testing.T) {
	require := require.New(t)
	params := map[string]string{"graphType": "workload", "duration": "60s", "appenders": ""}
	requireGraph(params, require)
}

func TestBoxNegative(t *testing.T) {
	require := require.New(t)
	params := map[string]string{"graphType": "app", "duration": "60s"}
	params["boxBy"] = "junk"
	requireGraphInvalid(params, require)
}

func TestGraphTypeNegative(t *testing.T) {
	require := require.New(t)
	params := map[string]string{"graphType": "app", "duration": "60s"}
	params["graphType"] = "junk"
	requireGraphInvalid(params, require)
}

func TestDisplayIdleEdges(t *testing.T) {
	require := require.New(t)
	params := map[string]string{"graphType": "versionedApp", "duration": "300s", "idleEdges": "true"}
	requireGraph(params, require)
}

func TestDisplayIdleNodes(t *testing.T) {
	require := require.New(t)
	params := map[string]string{"graphType": "versionedApp", "duration": "300s", "idleNodes": "true"}
	requireGraph(params, require)
}

func TestDisplayOperationNodes(t *testing.T) {
	require := require.New(t)
	params := map[string]string{"graphType": "versionedApp", "duration": "300s", "operationNodes": "true"}
	requireGraph(params, require)
}

func TestDisplayServiceNodes(t *testing.T) {
	require := require.New(t)
	params := map[string]string{"graphType": "versionedApp", "duration": "300s", "injectServiceNodes": "true"}
	requireGraph(params, require)
}

func requireGraphInvalid(params map[string]string, require *require.Assertions) {
	params["namespaces"] = utils.BOOKINFO
	_, statusCode, _ := utils.Graph(params)
	require.Equal(statusCode, 400)
}

func requireGraph(params map[string]string, require *require.Assertions) {
	params["namespaces"] = utils.BOOKINFO
	pollErr := wait.Poll(time.Second, time.Minute, func() (bool, error) {
		graph, statusCode, err := utils.Graph(params)
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

func requireBoxBy(params map[string]string, require *require.Assertions) {
	for _, v := range []string{"cluster", "namespace", "app"} {
		params["boxBy"] = v
		requireGraph(params, require)
	}
}
