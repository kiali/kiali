package get_troubleshooting_snapshot

import (
	"context"
	"net/http"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/kiali/kiali/ai/mcputil"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/models"
	jaegerModel "github.com/kiali/kiali/tracing/jaeger/model"
	jaegerModels "github.com/kiali/kiali/tracing/jaeger/model/json"
)

type stubSnapshotTracing struct {
	serviceCalls  int
	workloadCalls int
}

func (s *stubSnapshotTracing) GetServiceTraces(_ context.Context, _, _ string, _ models.TracingQuery) (*jaegerModel.TracingResponse, error) {
	s.serviceCalls++
	return &jaegerModel.TracingResponse{}, nil
}

func (s *stubSnapshotTracing) GetWorkloadTraces(_ context.Context, _, _ string, _ models.TracingQuery) (*jaegerModel.TracingResponse, error) {
	s.workloadCalls++
	return &jaegerModel.TracingResponse{}, nil
}

func testKialiInterface() *mcputil.KialiInterface {
	return &mcputil.KialiInterface{Conf: &config.Config{}}
}

func TestParseArgs_ValidWorkload(t *testing.T) {
	args, errMsg, code := parseArgs(map[string]interface{}{
		"clusterName":  "east",
		"namespace":    "bookinfo",
		"since":        "2026-01-01T10:00:00Z",
		"to":           "2026-01-01T11:00:00Z",
		"workloadName": "productpage-v1",
	}, testKialiInterface())

	require.Empty(t, errMsg)
	assert.Equal(t, http.StatusOK, code)
	assert.Equal(t, "east", args.ClusterName)
	assert.Equal(t, "bookinfo", args.Namespace)
	assert.Equal(t, "productpage-v1", args.WorkloadName)
	assert.True(t, args.SinceTime.Equal(time.Date(2026, 1, 1, 10, 0, 0, 0, time.UTC)))
	assert.True(t, args.ToTime.Equal(time.Date(2026, 1, 1, 11, 0, 0, 0, time.UTC)))
	assert.True(t, args.IncludeLogs)
	assert.True(t, args.IncludeMetrics)
	assert.True(t, args.IncludeTraces)
	assert.Equal(t, defaultMaxLogPods, args.MaxLogPods)
}

func TestParseArgs_DefaultCurrentWindow(t *testing.T) {
	before := time.Now().UTC()
	args, errMsg, code := parseArgs(map[string]interface{}{
		"namespace":    "bookinfo",
		"workloadName": "details-v1",
	}, testKialiInterface())
	after := time.Now().UTC()

	require.Empty(t, errMsg)
	assert.Equal(t, http.StatusOK, code)
	assert.Equal(t, defaultSnapshotSeconds, args.DurationSeconds)
	assert.False(t, args.SinceTime.Before(before.Add(-time.Duration(defaultSnapshotSeconds)*time.Second)))
	assert.False(t, args.ToTime.After(after))
	assert.True(t, args.ToTime.Sub(args.SinceTime) == time.Duration(defaultSnapshotSeconds)*time.Second)
}

func TestParseArgs_WindowModesAreExclusive(t *testing.T) {
	base := map[string]interface{}{
		"namespace":       "bookinfo",
		"serviceName":     "details",
		"since":           "2026-01-01T10:00:00Z",
		"to":              "2026-01-01T11:00:00Z",
		"durationSeconds": 900,
	}

	_, errMsg, code := parseArgs(base, testKialiInterface())
	assert.Equal(t, http.StatusBadRequest, code)
	assert.Contains(t, errMsg, "not both")

	partial := map[string]interface{}{
		"namespace":   "bookinfo",
		"serviceName": "details",
		"since":       "2026-01-01T10:00:00Z",
	}
	_, errMsg, code = parseArgs(partial, testKialiInterface())
	assert.Equal(t, http.StatusBadRequest, code)
	assert.Contains(t, errMsg, "provide both since and to")
}

func TestParseArgs_RequiresExactlyOneTarget(t *testing.T) {
	base := map[string]interface{}{
		"namespace": "bookinfo",
		"since":     "2026-01-01T10:00:00Z",
		"to":        "2026-01-01T11:00:00Z",
	}

	_, errMsg, code := parseArgs(base, testKialiInterface())
	assert.Equal(t, http.StatusBadRequest, code)
	assert.Contains(t, errMsg, "workloadName or serviceName is required")

	both := map[string]interface{}{
		"namespace":    "bookinfo",
		"since":        "2026-01-01T10:00:00Z",
		"to":           "2026-01-01T11:00:00Z",
		"serviceName":  "productpage",
		"workloadName": "productpage-v1",
	}
	_, errMsg, code = parseArgs(both, testKialiInterface())
	assert.Equal(t, http.StatusBadRequest, code)
	assert.Contains(t, errMsg, "not both")
}

func TestParseArgs_RejectsInvalidWindow(t *testing.T) {
	_, errMsg, code := parseArgs(map[string]interface{}{
		"namespace":   "bookinfo",
		"since":       "not-a-timestamp",
		"to":          "2026-01-01T11:00:00Z",
		"serviceName": "productpage",
	}, testKialiInterface())

	assert.Equal(t, http.StatusBadRequest, code)
	assert.Contains(t, errMsg, "invalid since timestamp")

	_, errMsg, code = parseArgs(map[string]interface{}{
		"namespace":   "bookinfo",
		"since":       "2026-01-01T11:00:00Z",
		"to":          "2026-01-01T10:00:00Z",
		"serviceName": "productpage",
	}, testKialiInterface())

	assert.Equal(t, http.StatusBadRequest, code)
	assert.Contains(t, errMsg, "to must be later than since")
}

func TestBuildTraceSummary(t *testing.T) {
	traces := &jaegerModel.TracingResponse{
		Data: []jaegerModels.Trace{{
			TraceID: "trace-1",
			Spans: []jaegerModels.Span{
				{OperationName: "root", StartTime: 1_000_000, Duration: 1_000_000},
				{
					OperationName: "child",
					ParentSpanID:  "parent",
					StartTime:     3_000_000,
					Duration:      1_000_000,
					Tags:          []jaegerModels.KeyValue{{Key: "error", Value: true}},
				},
			},
		}},
	}

	summary := buildTraceSummary("productpage", traces)
	require.Len(t, summary.Traces, 1)
	assert.Equal(t, "productpage", summary.Service)
	assert.Equal(t, 1, summary.TotalFound)
	assert.Equal(t, "trace-1", summary.Traces[0].ID)
	assert.Equal(t, "root", summary.Traces[0].RootOperation)
	assert.Equal(t, 2, summary.Traces[0].SpansCount)
	assert.Equal(t, 3000.0, summary.Traces[0].DurationMs)
	assert.True(t, summary.Traces[0].HasErrors)
}

func TestContainerForPod(t *testing.T) {
	pod := &models.Pod{
		Containers:      []*models.ContainerInfo{{Name: "istio-proxy"}},
		IstioContainers: []*models.ContainerInfo{{Name: "istio-proxy"}},
	}
	assert.Equal(t, "istio-proxy", containerForPod(pod))

	pod.Containers = []*models.ContainerInfo{{Name: "productpage"}, {Name: "istio-proxy"}}
	assert.Equal(t, "productpage", containerForPod(pod))
}

func TestFetchSnapshotTraces_RoutesByTarget(t *testing.T) {
	query := models.TracingQuery{Cluster: "east"}
	stub := &stubSnapshotTracing{}

	_, err := fetchSnapshotTraces(context.Background(), stub, TroubleshootingSnapshotArgs{
		Namespace:    "bookinfo",
		ServiceName:  "productpage",
		WorkloadName: "",
	}, query)
	require.NoError(t, err)
	assert.Equal(t, 1, stub.serviceCalls)
	assert.Equal(t, 0, stub.workloadCalls)

	stub = &stubSnapshotTracing{}
	_, err = fetchSnapshotTraces(context.Background(), stub, TroubleshootingSnapshotArgs{
		Namespace:    "bookinfo",
		WorkloadName: "productpage-v1",
	}, query)
	require.NoError(t, err)
	assert.Equal(t, 0, stub.serviceCalls)
	assert.Equal(t, 1, stub.workloadCalls)
}

func TestParseArgs_RejectsInvalidLimits(t *testing.T) {
	base := map[string]any{
		"namespace":    "bookinfo",
		"workloadName": "details-v1",
	}

	_, errMsg, code := parseArgs(map[string]any{
		"namespace":    "bookinfo",
		"workloadName": "details-v1",
		"maxLogPods":   0,
	}, testKialiInterface())
	assert.Equal(t, http.StatusBadRequest, code)
	assert.Contains(t, errMsg, "maxLogPods")

	_, errMsg, code = parseArgs(map[string]any{
		"namespace":           "bookinfo",
		"workloadName":        "details-v1",
		"maxEnvoyConfigDumps": -1,
	}, testKialiInterface())
	assert.Equal(t, http.StatusBadRequest, code)
	assert.Contains(t, errMsg, "maxEnvoyConfigDumps")

	_, errMsg, code = parseArgs(mergeArgs(base, map[string]any{"durationSeconds": maxSnapshotDurationSeconds + 1}), testKialiInterface())
	assert.Equal(t, http.StatusBadRequest, code)
	assert.Contains(t, errMsg, "durationSeconds")
}

func mergeArgs(base, extra map[string]any) map[string]any {
	merged := map[string]any{}
	for key, value := range base {
		merged[key] = value
	}
	for key, value := range extra {
		merged[key] = value
	}
	return merged
}

func TestDefaultWindowHelpers(t *testing.T) {
	args := TroubleshootingSnapshotArgs{
		SinceTime: time.Date(2026, 1, 1, 10, 0, 0, 0, time.UTC),
		ToTime:    time.Date(2026, 1, 1, 11, 0, 0, 0, time.UTC),
	}
	assert.Equal(t, "10m0s", defaultRateInterval(args))
	assert.Equal(t, 36, defaultStepSeconds(args))

	args.ToTime = args.SinceTime.Add(5 * time.Minute)
	assert.Equal(t, "5m0s", defaultRateInterval(args))
	assert.Equal(t, 15, defaultStepSeconds(args))
}
