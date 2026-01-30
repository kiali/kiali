package business

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"

	"github.com/kiali/kiali/config"
)

func TestCalculateDuration_ConfiguredDuration(t *testing.T) {
	conf := config.NewConfig()
	conf.HealthConfig.Compute.Duration = 5 * time.Minute
	conf.HealthConfig.Compute.RefreshInterval = 1 * time.Minute

	monitor := &healthMonitor{
		conf:    conf,
		lastRun: time.Time{}, // Zero value - first run
	}

	result := monitor.calculateDuration()
	assert.Equal(t, "5m", result)
}

func TestCalculateDuration_FirstRunAutoCalculate(t *testing.T) {
	conf := config.NewConfig()
	conf.HealthConfig.Compute.Duration = 0 // Auto-calculate
	conf.HealthConfig.Compute.RefreshInterval = 2 * time.Minute

	monitor := &healthMonitor{
		conf:    conf,
		lastRun: time.Time{}, // Zero value - first run
	}

	// First run should use 2x refresh interval
	result := monitor.calculateDuration()
	assert.Equal(t, "4m", result) // 2 * 2 minutes = 4 minutes
}

func TestCalculateDuration_SubsequentRunAutoCalculate(t *testing.T) {
	conf := config.NewConfig()
	conf.HealthConfig.Compute.Duration = 0 // Auto-calculate
	conf.HealthConfig.Compute.RefreshInterval = 1 * time.Minute

	// Simulate a run that happened 3 minutes ago
	lastRunTime := time.Now().Add(-3 * time.Minute)

	monitor := &healthMonitor{
		conf:    conf,
		lastRun: lastRunTime,
	}

	result := monitor.calculateDuration()

	// Should be approximately 3 minutes * 1.1 = 3.3 minutes = 198 seconds
	// Due to time passing during test, we'll check it's in a reasonable range
	// The result should be formatted as seconds since it won't be an exact minute
	assert.Contains(t, result, "s", "Expected seconds format for non-exact minute")

	// Parse the number to verify it's approximately correct
	var seconds int
	_, err := parseSeconds(result, &seconds)
	assert.NoError(t, err)
	// Should be around 198 seconds (3 minutes * 1.1), allow some variance for test execution time
	assert.GreaterOrEqual(t, seconds, 190, "Expected at least 190 seconds")
	assert.LessOrEqual(t, seconds, 220, "Expected at most 220 seconds")
}

func TestCalculateDuration_MinimumOneMinute(t *testing.T) {
	conf := config.NewConfig()
	conf.HealthConfig.Compute.Duration = 0 // Auto-calculate
	conf.HealthConfig.Compute.RefreshInterval = 1 * time.Minute

	// Simulate a run that happened just 10 seconds ago
	lastRunTime := time.Now().Add(-10 * time.Second)

	monitor := &healthMonitor{
		conf:    conf,
		lastRun: lastRunTime,
	}

	result := monitor.calculateDuration()

	// Should be at least 1 minute (minimum enforced)
	assert.Equal(t, "1m", result)
}

func TestCalculateDuration_ConfiguredOverridesElapsed(t *testing.T) {
	conf := config.NewConfig()
	conf.HealthConfig.Compute.Duration = 10 * time.Minute // Explicit configuration
	conf.HealthConfig.Compute.RefreshInterval = 1 * time.Minute

	// Even with a recent run, configured duration should be used
	lastRunTime := time.Now().Add(-2 * time.Minute)

	monitor := &healthMonitor{
		conf:    conf,
		lastRun: lastRunTime,
	}

	result := monitor.calculateDuration()

	// Should use configured duration, not calculated
	assert.Equal(t, "10m", result)
}

// parseSeconds is a helper to parse duration strings like "198s" into seconds
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
