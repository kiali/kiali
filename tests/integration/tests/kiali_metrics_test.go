package tests

import (
	"testing"
	"time"

	"k8s.io/apimachinery/pkg/util/wait"

	"github.com/stretchr/testify/assert"

	"github.com/kiali/kiali/tests/integration/utils"
)

var METRICS_PARAMS = map[string]string{"direction": "outbound", "reporter": "destination"}

func TestNamespaceMetrics(t *testing.T) {
	assert := assert.New(t)

	pollErr := wait.Poll(time.Second, time.Minute, func() (bool, error) {
		metrics, err := utils.NamespaceMetrics(utils.BOOKINFO, METRICS_PARAMS)
		return CheckMetrics(metrics.ResponseSize, metrics.RequestSize), err
	})
	assert.Nil(pollErr, "Metrics should be returned")
}

func TestServiceMetrics(t *testing.T) {
	assert := assert.New(t)
	name := "ratings"

	pollErr := wait.Poll(time.Second, time.Minute, func() (bool, error) {
		metrics, err := utils.ObjectMetrics(utils.BOOKINFO, name, "services", METRICS_PARAMS)
		return CheckMetrics(metrics.RequestCount, metrics.RequestDurationMillis, metrics.RequestErrorCount), err
	})
	assert.Nil(pollErr, "Metrics should be returned")
}

func TestAppMetrics(t *testing.T) {
	assert := assert.New(t)
	name := "productpage"

	pollErr := wait.Poll(time.Second, time.Minute, func() (bool, error) {
		metrics, err := utils.ObjectMetrics(utils.BOOKINFO, name, "apps", METRICS_PARAMS)
		return CheckMetrics(metrics.RequestDurationMillis), err
	})
	assert.Nil(pollErr, "Metrics should be returned")
}

func TestWorkloadMetrics(t *testing.T) {
	assert := assert.New(t)
	name := "productpage-v1"

	pollErr := wait.Poll(time.Second, time.Minute, func() (bool, error) {
		metrics, err := utils.ObjectMetrics(utils.BOOKINFO, name, "workloads", METRICS_PARAMS)
		return CheckMetrics(metrics.RequestSize, metrics.ResponseSize), err
	})
	assert.Nil(pollErr, "Metrics should be returned")
}

func CheckMetrics(metrics ...[]utils.MetricJson) bool {
	for _, metric := range metrics {
		if len(metric) == 0 || len(metric[0].Datapoints) == 0 {
			return false
		}
	}
	return true
}
