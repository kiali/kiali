package tests

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/kiali/kiali/tests/integration/utils/kiali"
	"github.com/kiali/kiali/tracing/jaeger/model"
)

func TestServiceTraces(t *testing.T) {
	require := require.New(t)
	name := "details"
	traces, statusCode, err := kiali.Traces("services", name, kiali.BOOKINFO)
	assertTraces(traces, statusCode, err, require)
}

func TestWorkloadTraces(t *testing.T) {
	require := require.New(t)
	name := "details-v1"
	traces, statusCode, err := kiali.Traces("workloads", name, kiali.BOOKINFO)
	assertTraces(traces, statusCode, err, require)
}

func TestAppTraces(t *testing.T) {
	require := require.New(t)
	name := "details"
	traces, statusCode, err := kiali.Traces("apps", name, kiali.BOOKINFO)
	assertTraces(traces, statusCode, err, require)
}

func TestWrongTracesType(t *testing.T) {
	require := require.New(t)
	name := "details"
	traces, statusCode, err := kiali.Traces("wrong", name, kiali.BOOKINFO)
	require.NotEqual(200, statusCode)
	require.NotNil(err)
	require.Empty(traces)
}

func TestWrongNamespaceTraces(t *testing.T) {
	require := require.New(t)
	name := "details"
	traces, _, _ := kiali.Traces("apps", name, "wrong")
	require.Empty(traces.Data)
	require.Empty(traces.Errors)
}

func TestServiceSpans(t *testing.T) {
	require := require.New(t)
	name := "details"
	spans, statusCode, err := kiali.Spans("services", name, kiali.BOOKINFO)
	assertSpans(spans, statusCode, err, require)
}

func TestAppSpans(t *testing.T) {
	require := require.New(t)
	name := "details"
	spans, statusCode, err := kiali.Spans("apps", name, kiali.BOOKINFO)
	assertSpans(spans, statusCode, err, require)
}

func TestWorkloadSpans(t *testing.T) {
	require := require.New(t)
	name := "details-v1"
	spans, statusCode, err := kiali.Spans("workloads", name, kiali.BOOKINFO)
	assertSpans(spans, statusCode, err, require)
}

func TestWrongTypeSpans(t *testing.T) {
	require := require.New(t)
	name := "details-v1"
	spans, statusCode, err := kiali.Spans("wrong", name, kiali.BOOKINFO)
	require.NotEqual(200, statusCode)
	require.NotNil(err)
	require.Empty(spans)
}

func TestWrongNamespaceSpans(t *testing.T) {
	require := require.New(t)
	name := "details-v1"
	spans, _, _ := kiali.Spans("apps", name, "wrong")
	require.Empty(spans)
}

func assertTraces(traces *model.TracingResponse, statusCode int, err error, require *require.Assertions) {
	if statusCode == 200 {
		require.NoError(err)
		require.NotNil(traces)
		require.NotNil(traces.Data)
		if len(traces.Data) > 0 {
			require.NotNil(traces.Data[0].TraceID)
			require.NotEmpty(traces.Data[0].Spans)
			for _, span := range traces.Data[0].Spans {
				require.NotNil(span.TraceID)
				require.Equal(span.TraceID, traces.Data[0].TraceID)
			}
		}
	} else {
		require.Fail(fmt.Sprintf("Status code should be '200' but was: %d and error: %s", statusCode, err))
	}
}

func assertSpans(spans []model.TracingSpan, statusCode int, err error, require *require.Assertions) {
	tracing, _, errTracing := kiali.TracingConfig()
	require.NoError(errTracing)

	if statusCode == 200 {
		require.NoError(err)
		require.NotNil(spans)
		if len(spans) > 0 {
			require.NotNil(spans[0].TraceID)
			require.NotNil(spans[0].References[0].TraceID)
			require.Equal(spans[0].TraceID, spans[0].References[0].TraceID)
			// References in Tempo are converted from the SpanTraceId, which is not available from the /api/search in Tempo
			if tracing.Provider == "jaeger" {
				require.NotEmpty(spans[0].References)
			}
		}
	} else {
		require.Fail(fmt.Sprintf("Status code should be '200' but was: %d and error: %s", statusCode, err))
	}
}
