package handlers

import (
	"net/http"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"

	"github.com/kiali/kiali/models"
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
	q.Add("byLabels[]", "response_code")
	q.Add("filters[]", "request_count")
	q.Add("filters[]", "request_size")
	q.Add("reporter", "destination")
	q.Add("direction", "outbound")
	q.Add("requestProtocol", "http")
	req.URL.RawQuery = q.Encode()

	mq := prometheus.IstioMetricsQuery{Namespace: "ns"}
	err = extractIstioMetricsQueryParams(req, &mq, buildNamespace("ns", time.Time{}))
	if err != nil {
		t.Fatal(err)
	}

	assert.Equal(t, "5h", mq.RateInterval)
	assert.Equal(t, "irate", mq.RateFunc)
	assert.Equal(t, 10*time.Second, mq.Step)
	assert.Equal(t, []string{"response_code"}, mq.ByLabels)
	assert.Equal(t, []string{"request_count", "request_size"}, mq.Filters)
	assert.Equal(t, "destination", mq.Reporter)
	assert.Equal(t, "outbound", mq.Direction)
	assert.Equal(t, "http", mq.RequestProtocol)

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

	mq := prometheus.IstioMetricsQuery{Namespace: "ns"}
	err = extractIstioMetricsQueryParams(req, &mq, buildNamespace("ns", time.Time{}))
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

func TestExtractMetricsQueryIntervalBoundary(t *testing.T) {
	req, err := http.NewRequest("GET", "http://host/api/namespaces/ns/services/svc/metrics", nil)
	if err != nil {
		t.Fatal(err)
	}
	q := req.URL.Query()
	q.Add("queryTime", "1523364060") // 2018-04-10T12:41:00
	q.Add("duration", "1000")        // Makes start = 2018-04-10T12:24:20
	q.Add("rateInterval", "35m")
	req.URL.RawQuery = q.Encode()

	mq := prometheus.IstioMetricsQuery{Namespace: "ns"}
	err = extractIstioMetricsQueryParams(req, &mq, buildNamespace("ns", time.Date(2018, 4, 10, 12, 10, 0, 0, time.UTC)))
	if err != nil {
		t.Fatal(err)
	}

	// Check that start and end dates don't need normalization, already hitting step bounds
	// Interval [12:24:20, 12:41:00] should be kept unchanged
	assert.Equal(t, "1860s", mq.RateInterval)
}

func TestExtractMetricsQueryStartTimeBoundary(t *testing.T) {
	req, err := http.NewRequest("GET", "http://host/api/namespaces/ns/services/svc/metrics", nil)
	if err != nil {
		t.Fatal(err)
	}
	q := req.URL.Query()
	q.Add("queryTime", "1523364060") // 2018-04-10T12:41:00
	q.Add("duration", "1000")        // Makes start = 2018-04-10T12:24:20
	q.Add("rateInterval", "1m")
	req.URL.RawQuery = q.Encode()

	mq := prometheus.IstioMetricsQuery{Namespace: "ns"}
	namespaceTimestamp := time.Date(2018, 4, 10, 12, 30, 0, 0, time.UTC)

	err = extractIstioMetricsQueryParams(req, &mq, buildNamespace("ns", namespaceTimestamp))
	if err != nil {
		t.Fatal(err)
	}

	// Check that start and end dates don't need normalization, already hitting step bounds
	// Interval [12:24:20, 12:41:00] should be kept unchanged
	assert.Equal(t, namespaceTimestamp.Add(1*time.Minute).UTC(), mq.Start.UTC())
}

func buildNamespace(name string, creationTime time.Time) *models.Namespace {
	return &models.Namespace{
		Name:              name,
		CreationTimestamp: creationTime,
	}
}
