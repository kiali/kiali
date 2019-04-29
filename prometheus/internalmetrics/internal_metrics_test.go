package internalmetrics

import (
	"fmt"
	"testing"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/assert"
)

// TestSuccessOrFailureMetric ensures that using defer with the ObserveNow(*error) function works.
func TestSuccessOrFailureMetric(t *testing.T) {
	// put back the original default registry when we are done
	originalRegistry := prometheus.DefaultRegisterer
	defer func() { prometheus.DefaultRegisterer = originalRegistry }()

	// setup our internal metric registry for this test
	registry := prometheus.NewRegistry()
	prometheus.DefaultRegisterer = registry
	RegisterInternalMetrics()

	metrics, err := registry.Gather()
	if err != nil {
		t.Errorf("Cannot test initial state of metrics: %v", err)
	}
	if len(metrics) != 0 {
		t.Errorf("Should not have any metrics yet")
	}

	// simulate a failure - our failure counter metric should increment to 1
	doSomeWork(true)
	metrics, err = registry.Gather()
	assert.Nil(t, err)
	if len(metrics) != 2 {
		t.Errorf("Should have metrics now")
	}

	// not guaranteed what order the metrics are returned in - just look for the failures counter
	for _, m := range metrics {
		if m.GetName() == "kiali_go_function_failures_total" {
			if m.GetMetric()[0].Counter.GetValue() != 1 {
				t.Errorf("Failure counter metric should have a value of 1: %+v", m)
			}
		} else if m.GetName() == "kiali_go_function_processing_duration_seconds" {
			if m.GetMetric()[0].Histogram.GetSampleCount() != 0 {
				t.Errorf("Histogram metric sample count should still be 0: %+v", m)
			}
		}
	}

	// simulate a success
	doSomeWork(false)
	metrics, err = registry.Gather()
	assert.Nil(t, err)

	for _, m := range metrics {
		if m.GetName() == "kiali_go_function_failures_total" {
			if m.GetMetric()[0].Counter.GetValue() != 1 {
				t.Errorf("Failure counter metric should not have increased: %+v", m)
			}
		} else if m.GetName() == "kiali_go_function_processing_duration_seconds" {
			if m.GetMetric()[0].Histogram.GetSampleCount() != 1 {
				t.Errorf("Histogram metric sample count should now have a value of 1: %+v", m)
			}
		}
	}

}

func doSomeWork(simulateFailure bool) error {
	var err error
	promtimer := GetGoFunctionMetric("test", "", "doSomeWork")
	defer promtimer.ObserveNow(&err)

	if simulateFailure {
		err = fmt.Errorf("FAILURE")
	}

	time.Sleep(500 * time.Millisecond)
	return err
}
