package business

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"

	"github.com/kiali/kiali/config"
)

func TestCalculateDuration_FirstRun(t *testing.T) {
	conf := config.NewConfig()
	conf.HealthConfig.Compute.Duration = "5m"
	conf.HealthConfig.Compute.RefreshInterval = "1m"

	monitor := &healthMonitor{
		conf:    conf,
		lastRun: time.Time{}, // Zero value - first run
	}

	result := monitor.calculateDuration()
	assert.Equal(t, "5m", result)
}

func TestCalculateDuration_ElapsedWithinDuration(t *testing.T) {
	conf := config.NewConfig()
	conf.HealthConfig.Compute.Duration = "5m"
	conf.HealthConfig.Compute.RefreshInterval = "2m"

	// Simulate a run that happened 3 minutes ago (within the 5 minute duration)
	lastRunTime := time.Now().Add(-3 * time.Minute)

	monitor := &healthMonitor{
		conf:    conf,
		lastRun: lastRunTime,
	}

	result := monitor.calculateDuration()
	// Should use configured duration since elapsed <= duration
	assert.Equal(t, "5m", result)
}

func TestCalculateDuration_ElapsedExceedsDuration(t *testing.T) {
	conf := config.NewConfig()
	conf.HealthConfig.Compute.Duration = "2m"
	conf.HealthConfig.Compute.RefreshInterval = "1m"

	// Simulate a run that happened 5 minutes ago (exceeds the 2 minute duration)
	lastRunTime := time.Now().Add(-5 * time.Minute)

	monitor := &healthMonitor{
		conf:    conf,
		lastRun: lastRunTime,
	}

	result := monitor.calculateDuration()

	// Should be approximately 5 minutes * 1.1 = 5.5 minutes = 330 seconds
	// Due to time passing during test, we'll check it's in a reasonable range
	var seconds int
	_, err := parseSeconds(result, &seconds)
	assert.NoError(t, err)
	// Should be around 330 seconds (5 minutes * 1.1), allow some variance for test execution time
	assert.GreaterOrEqual(t, seconds, 320, "Expected at least 320 seconds")
	assert.LessOrEqual(t, seconds, 350, "Expected at most 350 seconds")
}

func TestCalculateDuration_ElapsedAtBoundary(t *testing.T) {
	conf := config.NewConfig()
	conf.HealthConfig.Compute.Duration = "5m"
	conf.HealthConfig.Compute.RefreshInterval = "2m"

	// Simulate a run that happened just under 5 minutes ago (within boundary)
	// Using 4m59s to ensure we're within the duration even with test execution time
	lastRunTime := time.Now().Add(-4*time.Minute - 59*time.Second)

	monitor := &healthMonitor{
		conf:    conf,
		lastRun: lastRunTime,
	}

	result := monitor.calculateDuration()
	// elapsed <= duration, so should use configured duration
	assert.Equal(t, "5m", result)
}

// parseSeconds is a helper to parse duration strings like "198s" or "5m" into seconds
func parseSeconds(s string, result *int) (bool, error) {
	if len(s) < 2 {
		return false, nil
	}
	suffix := s[len(s)-1]
	numStr := s[:len(s)-1]
	var num int
	_, err := parseNumber(numStr, &num)
	if err != nil {
		return false, err
	}
	if suffix == 'm' {
		*result = num * 60
	} else {
		*result = num
	}
	return true, nil
}

func parseNumber(s string, result *int) (bool, error) {
	n := 0
	for _, c := range s {
		if c < '0' || c > '9' {
			return false, nil
		}
		n = n*10 + int(c-'0')
	}
	*result = n
	return true, nil
}
