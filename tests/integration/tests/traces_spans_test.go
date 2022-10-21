package tests

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/kiali/kiali/jaeger"
	"github.com/kiali/kiali/tests/integration/utils"
)

func TestServiceTraces(t *testing.T) {
	assert := assert.New(t)
	name := "details"
	traces, statusCode, err := utils.Traces("services", name, utils.BOOKINFO)
	assertTraces(traces, statusCode, err, assert)
}

func TestWorkloadTraces(t *testing.T) {
	assert := assert.New(t)
	name := "details-v1"
	traces, statusCode, err := utils.Traces("workloads", name, utils.BOOKINFO)
	assertTraces(traces, statusCode, err, assert)
}

func TestAppTraces(t *testing.T) {
	assert := assert.New(t)
	name := "details"
	traces, statusCode, err := utils.Traces("apps", name, utils.BOOKINFO)
	assertTraces(traces, statusCode, err, assert)
}

func TestWrongTracesType(t *testing.T) {
	assert := assert.New(t)
	name := "details"
	traces, statusCode, err := utils.Traces("wrong", name, utils.BOOKINFO)
	assert.NotEqual(200, statusCode)
	assert.NotNil(err)
	assert.Empty(traces)
}

func TestWrongNamespaceTraces(t *testing.T) {
	assert := assert.New(t)
	name := "details"
	traces, _, _ := utils.Traces("apps", name, "wrong")
	assert.Empty(traces.Data)
	assert.Empty(traces.Errors)
}

func TestServiceSpans(t *testing.T) {
	assert := assert.New(t)
	name := "details"
	spans, statusCode, err := utils.Spans("services", name, utils.BOOKINFO)
	assertSpans(spans, statusCode, err, assert)
}

func TestAppSpans(t *testing.T) {
	assert := assert.New(t)
	name := "details"
	spans, statusCode, err := utils.Spans("apps", name, utils.BOOKINFO)
	assertSpans(spans, statusCode, err, assert)
}

func TestWorkloadSpans(t *testing.T) {
	assert := assert.New(t)
	name := "details-v1"
	spans, statusCode, err := utils.Spans("workloads", name, utils.BOOKINFO)
	assertSpans(spans, statusCode, err, assert)
}

func TestWrongTypeSpans(t *testing.T) {
	assert := assert.New(t)
	name := "details-v1"
	spans, statusCode, err := utils.Spans("wrong", name, utils.BOOKINFO)
	assert.NotEqual(200, statusCode)
	assert.NotNil(err)
	assert.Empty(spans)
}

func TestWrongNamespaceSpans(t *testing.T) {
	assert := assert.New(t)
	name := "details-v1"
	spans, _, _ := utils.Spans("apps", name, "wrong")
	assert.Empty(spans)
}

func assertTraces(traces *jaeger.JaegerResponse, statusCode int, err error, assert *assert.Assertions) {
	if statusCode == 200 {
		assert.Nil(err)
		assert.NotNil(traces)
		assert.NotNil(traces.Data)
		if len(traces.Data) > 0 {
			assert.NotNil(traces.Data[0].TraceID)
			assert.NotEmpty(traces.Data[0].Spans)
			for _, span := range traces.Data[0].Spans {
				assert.NotNil(span.TraceID)
				assert.Equal(span.TraceID, traces.Data[0].TraceID)
			}
		}
	} else {
		assert.Fail(fmt.Sprintf("Status code should be '200' but was: %d and error: %s", statusCode, err))
	}
}

func assertSpans(spans []jaeger.JaegerSpan, statusCode int, err error, assert *assert.Assertions) {
	if statusCode == 200 {
		assert.Nil(err)
		assert.NotNil(spans)
		if len(spans) > 0 {
			assert.NotNil(spans[0].TraceID)
			assert.NotEmpty(spans[0].References)
			assert.NotNil(spans[0].References[0].TraceID)
			assert.Equal(spans[0].TraceID, spans[0].References[0].TraceID)
		}
	} else {
		assert.Fail(fmt.Sprintf("Status code should be '200' but was: %d and error: %s", statusCode, err))
	}
}
