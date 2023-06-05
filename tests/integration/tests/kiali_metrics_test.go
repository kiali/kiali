package tests

import (
	"context"
	"testing"
	"time"

	"k8s.io/apimachinery/pkg/util/wait"

	"github.com/stretchr/testify/assert"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/tests/integration/utils/kiali"
)

var METRICS_PARAMS = map[string]string{"direction": "outbound", "reporter": "destination"}

func TestNamespaceMetrics(t *testing.T) {
	assert := assert.New(t)
	ctx := context.TODO()

	pollErr := wait.PollUntilContextTimeout(ctx, time.Second, time.Minute, false, func(ctx context.Context) (bool, error) {
		metrics, err := kiali.NamespaceMetrics(kiali.BOOKINFO, METRICS_PARAMS)
		return CheckMetrics(metrics.ResponseSize, metrics.RequestSize), err
	})
	assert.Nil(pollErr, "Metrics should be returned")
}

func TestServiceMetrics(t *testing.T) {
	assert := assert.New(t)
	name := "ratings"
	conf := config.NewConfig()
	config.Set(conf)
	ctx := context.TODO()

	pollErr := wait.PollUntilContextTimeout(ctx, time.Second, time.Minute, false, func(ctx context.Context) (bool, error) {
		METRICS_PARAMS["cluster"] = conf.KubernetesConfig.ClusterName
		metrics, err := kiali.ObjectMetrics(kiali.BOOKINFO, name, "services", METRICS_PARAMS)
		return CheckMetrics(metrics.RequestCount, metrics.RequestDurationMillis, metrics.RequestErrorCount), err
	})
	assert.Nil(pollErr, "Metrics should be returned")
}

func TestAppMetrics(t *testing.T) {
	assert := assert.New(t)
	name := "productpage"
	conf := config.NewConfig()
	config.Set(conf)
	ctx := context.TODO()

	pollErr := wait.PollUntilContextTimeout(ctx, time.Second, time.Minute, false, func(ctx context.Context) (bool, error) {
		METRICS_PARAMS["cluster"] = conf.KubernetesConfig.ClusterName
		metrics, err := kiali.ObjectMetrics(kiali.BOOKINFO, name, "apps", METRICS_PARAMS)
		return CheckMetrics(metrics.RequestDurationMillis), err
	})
	assert.Nil(pollErr, "Metrics should be returned")
}

func TestWorkloadMetrics(t *testing.T) {
	assert := assert.New(t)
	name := "productpage-v1"
	conf := config.NewConfig()
	config.Set(conf)
	ctx := context.TODO()

	pollErr := wait.PollUntilContextTimeout(ctx, time.Second, time.Minute, false, func(ctx context.Context) (bool, error) {
		METRICS_PARAMS["cluster"] = conf.KubernetesConfig.ClusterName
		metrics, err := kiali.ObjectMetrics(kiali.BOOKINFO, name, "workloads", METRICS_PARAMS)
		return CheckMetrics(metrics.RequestSize, metrics.ResponseSize), err
	})
	assert.Nil(pollErr, "Metrics should be returned")
}

func CheckMetrics(metrics ...[]kiali.MetricJson) bool {
	for _, metric := range metrics {
		if len(metric) == 0 || len(metric[0].Datapoints) == 0 {
			return false
		}
	}
	return true
}
