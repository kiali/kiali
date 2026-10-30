//go:build race

package business

// raceDetectorEnabled reports whether the test binary was built with the
// race detector, so allocation-count assertions can be skipped where the
// detector makes them non-deterministic.
const raceDetectorEnabled = true
