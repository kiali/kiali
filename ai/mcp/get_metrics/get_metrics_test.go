package get_metrics

// Assisted-by: Claude Code

import (
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	prom_v1 "github.com/prometheus/client_golang/api/prometheus/v1"
	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"k8s.io/client-go/tools/clientcmd/api"

	"github.com/kiali/kiali/ai/mcputil"
	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/cache"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/handlers/authentication"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/prometheus"
	"github.com/kiali/kiali/prometheus/prometheustest"
)

// executeWithRangeCapture runs the tool against a Prometheus mock and returns every range the
// tool asked Prometheus for.
func executeWithRangeCapture(t *testing.T, args map[string]interface{}) ([]prom_v1.Range, interface{}, int) {
	t.Helper()
	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "Kubernetes"
	config.Set(conf)

	k8s := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("bookinfo"))
	clientFactory := kubetest.NewFakeClientFactoryWithClient(conf, k8s)
	kialiCache := cache.NewTestingCacheWithClients(t, kubernetes.ConvertFromUserClients(map[string]kubernetes.UserClientInterface{conf.KubernetesConfig.ClusterName: k8s}), *conf)

	var mu sync.Mutex
	var ranges []prom_v1.Range
	promAPI := new(prometheustest.PromAPIMock)
	promAPI.On("QueryRange", mock.Anything, mock.Anything, mock.AnythingOfType("v1.Range")).
		Run(func(args mock.Arguments) {
			mu.Lock()
			defer mu.Unlock()
			ranges = append(ranges, args.Get(2).(prom_v1.Range))
		}).
		Return(model.Matrix{}, nil)
	prom, err := prometheus.NewClient(*conf, k8s.GetToken())
	require.NoError(t, err)
	prom.Inject(promAPI)

	businessLayer := business.NewLayerBuilder(t, conf).WithClient(k8s).WithProm(prom).Build()

	req := httptest.NewRequest(http.MethodPost, "http://kiali/api/chat/mcp/get_metrics", nil)
	authInfo := map[string]*api.AuthInfo{conf.KubernetesConfig.ClusterName: {Token: k8s.GetToken()}}
	req = req.WithContext(authentication.SetAuthInfoContext(req.Context(), authInfo))

	res, code := Execute(&mcputil.KialiInterface{
		Request:       req,
		BusinessLayer: businessLayer,
		ClientFactory: clientFactory,
		KialiCache:    kialiCache,
		Conf:          conf,
		Prom:          prom,
	}, args)
	return ranges, res, code
}

func TestExecuteQueriesTheSinceToRange(t *testing.T) {
	ranges, res, code := executeWithRangeCapture(t, map[string]interface{}{
		"resourceType": "service",
		"namespace":    "bookinfo",
		"resourceName": "reviews",
		"since":        "2026-03-09T07:00:00Z",
		"to":           "2026-03-09T08:00:00Z",
	})
	require.Equal(t, http.StatusOK, code, res)
	require.NotEmpty(t, ranges)
	for _, r := range ranges {
		assert.Equal(t, time.Date(2026, time.March, 9, 7, 0, 0, 0, time.UTC), r.Start.UTC())
		assert.Equal(t, time.Date(2026, time.March, 9, 8, 0, 0, 0, time.UTC), r.End.UTC())
		assert.Equal(t, 15*time.Second, r.Step)
	}
}

func TestExecuteQueriesARelativeSinceBeforeNow(t *testing.T) {
	before := time.Now()
	ranges, res, code := executeWithRangeCapture(t, map[string]interface{}{
		"resourceType": "workload",
		"namespace":    "bookinfo",
		"resourceName": "reviews-v1",
		"since":        "2h",
	})
	after := time.Now()
	require.Equal(t, http.StatusOK, code, res)
	require.NotEmpty(t, ranges)
	for _, r := range ranges {
		assert.False(t, r.End.Before(before.Truncate(time.Second)), "end %s is before the call", r.End)
		assert.False(t, r.End.After(after), "end %s is after the call", r.End)
		// The start is rounded down to a multiple of the step.
		assert.InDelta(t, (2 * time.Hour).Seconds(), r.End.Sub(r.Start).Seconds(), 15)
	}
}

func TestExecuteKeepsALongRangeUnderThePrometheusPointLimit(t *testing.T) {
	ranges, res, code := executeWithRangeCapture(t, map[string]interface{}{
		"resourceType": "app",
		"namespace":    "bookinfo",
		"resourceName": "reviews",
		"since":        "7d",
		"to":           "2026-03-09T08:00:00Z",
	})
	require.Equal(t, http.StatusOK, code, res)
	require.NotEmpty(t, ranges)
	for _, r := range ranges {
		// Prometheus rejects range queries with more than 11,000 points per series.
		assert.LessOrEqual(t, int(r.End.Sub(r.Start)/r.Step)+1, 11000)
	}
}

func TestExecuteRejectsAnInvalidRange(t *testing.T) {
	ranges, res, code := executeWithRangeCapture(t, map[string]interface{}{
		"resourceType": "service",
		"namespace":    "bookinfo",
		"resourceName": "reviews",
		"since":        "2026-03-09T09:00:00Z",
		"to":           "2026-03-09T08:00:00Z",
	})
	require.Equal(t, http.StatusBadRequest, code)
	assert.Contains(t, res, "'since' must be before 'to'")
	assert.Empty(t, ranges)
}
