package handlers

import (
	"net/http"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"

	"github.com/kiali/kiali/prometheus"
)

func TestExtractMetricsQueryParams(t *testing.T) {
	req, err := http.NewRequest("GET", "http://host/api/namespaces/ns/services/svc/metrics", nil)
	if err != nil {
		t.Fatal(err)
	}
	q := req.URL.Query()
	q.Add("rateInterval", "5h")
	q.Add("rateFunc", "irate")
	q.Add("step", "10")
	q.Add("queryTime", "1523364061") // 2018-04-10T12:41:01
	q.Add("duration", "1000")        // Makes start = 2018-04-10T12:24:21
	q.Add("byLabelsIn[]", "response_code")
	q.Add("byLabelsOut[]", "response_code")
	q.Add("filters[]", "request_count")
	q.Add("filters[]", "request_size")
	req.URL.RawQuery = q.Encode()

	mq := prometheus.MetricsQuery{}
	err = extractMetricsQueryParams(req, &mq)
	if err != nil {
		t.Fatal(err)
	}

	assert.Equal(t, "5h", mq.RateInterval)
	assert.Equal(t, "irate", mq.RateFunc)
	assert.Equal(t, 10*time.Second, mq.Step)
	assert.Equal(t, []string{"response_code"}, mq.ByLabelsIn)
	assert.Equal(t, []string{"response_code"}, mq.ByLabelsOut)
	assert.Equal(t, []string{"request_count", "request_size"}, mq.Filters)

	// Check that start date is normalized for step
	// Interval [12:24:21, 12:41:01] should be converted to [12:24:20, 12:41:01]
	assert.Equal(t, time.Unix(1523363060, 0), mq.Start)
	assert.Equal(t, 20, mq.Start.Second())
	assert.Equal(t, time.Unix(1523364061, 0), mq.End)
	assert.Equal(t, 1, mq.End.Second())
}

func TestExtractMetricsQueryParamsStepLimitCase(t *testing.T) {
	req, err := http.NewRequest("GET", "http://host/api/namespaces/ns/services/svc/metrics", nil)
	if err != nil {
		t.Fatal(err)
	}
	q := req.URL.Query()
	q.Add("step", "10")
	q.Add("queryTime", "1523364060") // 2018-04-10T12:41:00
	q.Add("duration", "1000")        // Makes start = 2018-04-10T12:24:20
	req.URL.RawQuery = q.Encode()

	mq := prometheus.MetricsQuery{}
	err = extractMetricsQueryParams(req, &mq)
	if err != nil {
		t.Fatal(err)
	}

	// Check that start and end dates don't need normalization, already hitting step bounds
	// Interval [12:24:20, 12:41:00] should be kept unchanged
	assert.Equal(t, time.Unix(1523363060, 0), mq.Start)
	assert.Equal(t, 20, mq.Start.Second())
	assert.Equal(t, time.Unix(1523364060, 0), mq.End)
	assert.Equal(t, 0, mq.End.Second())
}
