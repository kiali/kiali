/*
Package polltest provides polling helpers for tests.
*/
package polltest

import (
	"testing"
	"time"
)

// PollForCondition polls until a condition is met or timeout is reached.
// Returns true if condition was met, false if timeout occurred.
func PollForCondition(t *testing.T, timeout time.Duration, condition func() bool) bool {
	t.Helper()

	return PollForConditionInterval(t, timeout, 50*time.Millisecond, condition)
}

// PollForConditionInterval polls until a condition is met or timeout is reached, checking
// the condition at the given interval.
// Returns true if condition was met, false if timeout occurred.
func PollForConditionInterval(t *testing.T, timeout time.Duration, interval time.Duration, condition func() bool) bool {
	t.Helper()

	if interval <= 0 {
		t.Fatalf("interval must be > 0, got: %v", interval)
	}

	iterations := int(timeout / interval)
	for i := 0; i < iterations; i++ {
		time.Sleep(interval)
		if condition() {
			return true
		}
	}
	return false
}
