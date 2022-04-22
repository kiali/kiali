package tests

import (
	"fmt"
	"testing"
	"time"

	"k8s.io/apimachinery/pkg/util/wait"

	"github.com/stretchr/testify/assert"

	"github.com/kiali/kiali/tests/integration/utils"
)

func TestAppBase(t *testing.T) {
	assert := assert.New(t)
	params := map[string]string{"graphType": "app", "duration": "60s"}
	assertBoxBy(params, assert)
}

func TestAppNoLabels(t *testing.T) {
	assert := assert.New(t)
	params := map[string]string{"graphType": "app", "edges": "noEdgeLabels", "duration": "60s"}
	assertGraph(params, assert)
}

func TestAppRequestsPerSecond(t *testing.T) {
	assert := assert.New(t)
	params := map[string]string{"graphType": "app", "edges": "requestsPerSecond", "duration": "60s"}
	assertGraph(params, assert)
}

func TestAppRequestsPercentage(t *testing.T) {
	assert := assert.New(t)
	params := map[string]string{"graphType": "app", "edges": "requestsPercentage", "duration": "60s"}
	assertGraph(params, assert)
}

func TestAppRequestsResponseTime(t *testing.T) {
	assert := assert.New(t)
	params := map[string]string{"graphType": "app", "edges": "responseTime", "duration": "60s"}
	assertGraph(params, assert)
}

func TestAppInjectServiceNodesTrue(t *testing.T) {
	assert := assert.New(t)
	params := map[string]string{"graphType": "app", "edges": "responseTime", "duration": "60s", "injectServiceNodes": "true"}
	assertGraph(params, assert)
}

func TestAppInjectServiceNodesFalse(t *testing.T) {
	assert := assert.New(t)
	params := map[string]string{"graphType": "app", "edges": "responseTime", "duration": "60s", "injectServiceNodes": "false"}
	assertGraph(params, assert)
}

func TestAppAppendersBlank(t *testing.T) {
	assert := assert.New(t)
	params := map[string]string{"graphType": "app", "duration": "60s", "appenders": ""}
	assertGraph(params, assert)
}

func TestAppAppendersInvalid(t *testing.T) {
	assert := assert.New(t)
	params := map[string]string{"graphType": "app", "duration": "60s", "appenders": "invalid"}
	assertGraphInvalid(params, assert)
}

func TestServiceBase(t *testing.T) {
	assert := assert.New(t)
	params := map[string]string{"graphType": "service", "duration": "300s"}
	assertBoxBy(params, assert)
}

func TestServiceNoLabels(t *testing.T) {
	assert := assert.New(t)
	params := map[string]string{"graphType": "service", "edges": "noEdgeLabels", "duration": "300s"}
	assertGraph(params, assert)
}

func TestServiceRequestsPerSecond(t *testing.T) {
	assert := assert.New(t)
	params := map[string]string{"graphType": "service", "edges": "requestsPerSecond", "duration": "300s"}
	assertGraph(params, assert)
}

func TestServiceRequestsPercentage(t *testing.T) {
	assert := assert.New(t)
	params := map[string]string{"graphType": "service", "edges": "requestsPercentage", "duration": "300s"}
	assertGraph(params, assert)
}

func TestServiceResponseTime(t *testing.T) {
	assert := assert.New(t)
	params := map[string]string{"graphType": "service", "edges": "responseTime", "duration": "300s"}
	assertGraph(params, assert)
}

func TestServiceInjectServiceNodesTrue(t *testing.T) {
	assert := assert.New(t)
	params := map[string]string{"graphType": "service", "edges": "responseTime", "duration": "60s", "injectServiceNodes": "true"}
	assertGraph(params, assert)
}

func TestServiceInjectServiceNodesFalse(t *testing.T) {
	assert := assert.New(t)
	params := map[string]string{"graphType": "service", "edges": "responseTime", "duration": "60s", "injectServiceNodes": "false"}
	assertGraph(params, assert)
}

func TestServiceAppendersBlank(t *testing.T) {
	assert := assert.New(t)
	params := map[string]string{"graphType": "service", "duration": "60s", "appenders": ""}
	assertGraph(params, assert)
}

func TestVersionedAppBase(t *testing.T) {
	assert := assert.New(t)
	params := map[string]string{"graphType": "versionedApp", "duration": "600s"}
	assertBoxBy(params, assert)
}

func TestVersionedAppNoLabels(t *testing.T) {
	assert := assert.New(t)
	params := map[string]string{"graphType": "versionedApp", "edges": "noEdgeLabels", "duration": "600s"}
	assertGraph(params, assert)
}

func TestVersionedAppRequestsPerSecond(t *testing.T) {
	assert := assert.New(t)
	params := map[string]string{"graphType": "versionedApp", "edges": "requestsPerSecond", "duration": "600s"}
	assertGraph(params, assert)
}

func TestVersionedAppRequestsPercentage(t *testing.T) {
	assert := assert.New(t)
	params := map[string]string{"graphType": "versionedApp", "edges": "requestsPercentage", "duration": "600s"}
	assertGraph(params, assert)
}

func TestVersionedAppRequestsResponseTime(t *testing.T) {
	assert := assert.New(t)
	params := map[string]string{"graphType": "versionedApp", "edges": "responseTime", "duration": "600s"}
	assertGraph(params, assert)
}

func TestVersionedAppRInjectServiceNodesTrue(t *testing.T) {
	assert := assert.New(t)
	params := map[string]string{"graphType": "versionedApp", "edges": "responseTime", "duration": "60s", "injectServiceNodes": "true"}
	assertGraph(params, assert)
}

func TestVersionedAppRInjectServiceNodesFalse(t *testing.T) {
	assert := assert.New(t)
	params := map[string]string{"graphType": "versionedApp", "edges": "responseTime", "duration": "60s", "injectServiceNodes": "false"}
	assertGraph(params, assert)
}

func TestVersionedAppAppendersBlank(t *testing.T) {
	assert := assert.New(t)
	params := map[string]string{"graphType": "versionedApp", "duration": "60s", "appenders": ""}
	assertGraph(params, assert)
}

func TestWorkloadNoLabels(t *testing.T) {
	assert := assert.New(t)
	params := map[string]string{"graphType": "workload", "edges": "noEdgeLabels", "duration": "21600s"}
	assertGraph(params, assert)
}

func TestWorkloadRequestsPerSecond(t *testing.T) {
	assert := assert.New(t)
	params := map[string]string{"graphType": "workload", "edges": "requestsPerSecond", "duration": "21600s"}
	assertGraph(params, assert)
}

func TestWorkloadRequestPercentage(t *testing.T) {
	assert := assert.New(t)
	params := map[string]string{"graphType": "workload", "edges": "requestsPercentage", "duration": "21600s"}
	assertGraph(params, assert)
}

func TestWorkloadRequestsResponseTime(t *testing.T) {
	assert := assert.New(t)
	params := map[string]string{"graphType": "workload", "edges": "responseTime", "duration": "21600s"}
	assertGraph(params, assert)
}

func TestWorkloadAppendersBlank(t *testing.T) {
	assert := assert.New(t)
	params := map[string]string{"graphType": "workload", "duration": "60s", "appenders": ""}
	assertGraph(params, assert)
}

func TestBoxNegative(t *testing.T) {
	assert := assert.New(t)
	params := map[string]string{"graphType": "app", "duration": "60s"}
	params["boxBy"] = "junk"
	assertGraphInvalid(params, assert)
}

func TestGraphTypeNegative(t *testing.T) {
	assert := assert.New(t)
	params := map[string]string{"graphType": "app", "duration": "60s"}
	params["graphType"] = "junk"
	assertGraphInvalid(params, assert)
}

func TestDisplayIdleEdges(t *testing.T) {
	assert := assert.New(t)
	params := map[string]string{"graphType": "versionedApp", "duration": "300s", "idleEdges": "true"}
	assertGraph(params, assert)
}

func TestDisplayIdleNodes(t *testing.T) {
	assert := assert.New(t)
	params := map[string]string{"graphType": "versionedApp", "duration": "300s", "idleNodes": "true"}
	assertGraph(params, assert)
}

func TestDisplayOperationNodes(t *testing.T) {
	assert := assert.New(t)
	params := map[string]string{"graphType": "versionedApp", "duration": "300s", "operationNodes": "true"}
	assertGraph(params, assert)
}

func TestDisplayServiceNodes(t *testing.T) {
	assert := assert.New(t)
	params := map[string]string{"graphType": "versionedApp", "duration": "300s", "injectServiceNodes": "true"}
	assertGraph(params, assert)
}
func assertGraphInvalid(params map[string]string, assert *assert.Assertions) {
	params["namespaces"] = utils.BOOKINFO
	_, statusCode, _ := utils.Graph(params)
	assert.Equal(statusCode, 400)
}

func assertGraph(params map[string]string, assert *assert.Assertions) {
	params["namespaces"] = utils.BOOKINFO
	pollErr := wait.Poll(time.Second, time.Minute, func() (bool, error) {
		graph, statusCode, err := utils.Graph(params)
		if statusCode != 200 {
			return false, err
		}

		for key, value := range params {
			switch key {
			case "duration":
				assert.Contains(value, fmt.Sprintf("%d", graph.Duration))
			case "graphType":
				assert.Equal(value, graph.GraphType)
			}
		}
		return len(graph.Elements.Nodes) > 0 && len(graph.Elements.Edges) > 0, nil
	})
	assert.Nil(pollErr, "Graph elements should contains Nodes and Edges")
}

func assertBoxBy(params map[string]string, assert *assert.Assertions) {
	for _, v := range []string{"cluster", "namespace", "app"} {
		params["boxBy"] = v
		assertGraph(params, assert)
	}
}
