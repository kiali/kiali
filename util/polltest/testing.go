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

	const interval = 50 * time.Millisecond
	iterations := int(timeout / interval)
	for i := 0; i < iterations; i++ {
		time.Sleep(interval)
		if condition() {
			return true
		}
	}
	return false
}
