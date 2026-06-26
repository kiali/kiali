package models

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestValidateReporter(t *testing.T) {
	cases := []struct {
		input   string
		wantErr bool
	}{
		{"both", false},
		{"source", false},
		{"destination", false},
		{"waypoint", false},
		{"source,waypoint", false},
		{"destination,waypoint", false},
		{"invalid", true},
		{"source,invalid", true},
		{"source,both", true},
		{"both,source", true},
		{"", true},
	}
	for _, tc := range cases {
		t.Run(tc.input, func(t *testing.T) {
			err := ValidateReporter(tc.input)
			if tc.wantErr {
				assert.Error(t, err, "ValidateReporter(%q) should return an error", tc.input)
			} else {
				assert.NoError(t, err, "ValidateReporter(%q) should not return an error", tc.input)
			}
		})
	}
}

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
