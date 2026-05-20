package models

import "testing"

func TestMetricsStatsQueryGenKeyIncludesReporters(t *testing.T) {
	base := MetricsStatsQuery{
		Target: Target{
			Namespace: "bookinfo",
			Kind:      "workload",
			Name:      "reviews-v1",
		},
		Direction:   "inbound",
		RawInterval: "10m",
	}

	withDefaultReporter := base
	withWaypoint := base
	withWaypoint.Reporters = []string{"waypoint", "destination"}

	if got, want := withDefaultReporter.GenKey(), "bookinfo:workload:reviews-v1::inbound:10m:destination"; got != want {
		t.Fatalf("GenKey() = %q, want %q", got, want)
	}

	if got, want := withWaypoint.GenKey(), "bookinfo:workload:reviews-v1::inbound:10m:destination,waypoint"; got != want {
		t.Fatalf("GenKey() = %q, want %q", got, want)
	}
}

func TestMetricsStatsQueryValidateRejectsReporterWithoutDirectionSide(t *testing.T) {
	q := MetricsStatsQuery{
		Target: Target{
			Namespace: "bookinfo",
			Kind:      "workload",
			Name:      "reviews-v1",
		},
		Direction:    "inbound",
		RawInterval:  "10m",
		RawQueryTime: 1,
		Reporters:    []string{"waypoint"},
	}

	if err := q.Validate(); err == nil {
		t.Fatal("Validate() expected error, got nil")
	}
}
