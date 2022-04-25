package tests

import (
	"testing"
	"time"

	"k8s.io/apimachinery/pkg/util/wait"

	"github.com/stretchr/testify/assert"

	"github.com/kiali/kiali/tests/integration/utils"
)

func TestNamespaceMetrics(t *testing.T) {
	assert := assert.New(t)
	params := map[string]string{"filters": "tcp_sent,tcp_received"}

	pollErr := wait.Poll(time.Second, time.Minute, func() (bool, error) {
		metrics, err := utils.NamespaceMetrics(utils.BOOKINFO, params)
		assert.Nil(err)
		assert.NotEmpty(metrics)
		return CheckMetrics(metrics.TcpSent, metrics.TcpReceived), nil
	})
	assert.Nil(pollErr, "Metrics should be returned")
}

func TestServiceMetrics(t *testing.T) {
	assert := assert.New(t)
	name := "ratings"
	params := map[string]string{"filters": "request_count,request_duration_millis,request_error_count"}

	pollErr := wait.Poll(time.Second, time.Minute, func() (bool, error) {
		metrics, err := utils.ServiceMetrics(utils.BOOKINFO, name, params)
		assert.Nil(err)
		assert.NotEmpty(metrics)
		return CheckMetrics(metrics.RequestCount, metrics.RequestDurationMillis, metrics.RequestErrorCount), nil
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
