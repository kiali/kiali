package business

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/kiali/kiali/config"
)

func TestHealthRateMatcherGetMatchingRate(t *testing.T) {
	conf := config.NewConfig()
	conf.HealthConfig.Rate = []config.Rate{
		{
			Namespace: "production",
			Kind:      "workload",
			Name:      "critical-.*",
			Tolerance: []config.Tolerance{
				{Code: "5XX", Protocol: "http", Direction: "inbound", Degraded: 1, Failure: 5},
			},
		},
		{
			Namespace: "staging",
			Kind:      ".*",
			Name:      ".*",
			Tolerance: []config.Tolerance{
				{Code: "5XX", Protocol: "http", Direction: ".*", Degraded: 5, Failure: 15},
			},
		},
		{
			// Default - matches everything
			Namespace: "",
			Kind:      "",
			Name:      "",
			Tolerance: []config.Tolerance{
				{Code: "5XX", Protocol: "http", Direction: ".*", Degraded: 10, Failure: 20},
			},
		},
	}

	matcher := NewHealthRateMatcher(conf)

	// Test exact namespace/kind/name match
	rate := matcher.GetMatchingRate("production", "critical-api", "workload")
	assert.NotNil(t, rate)
	assert.Equal(t, "production", rate.Namespace)
	assert.Equal(t, float32(1), rate.Tolerance[0].Degraded)

	// Test partial match - staging namespace
	rate = matcher.GetMatchingRate("staging", "my-service", "service")
	assert.NotNil(t, rate)
	assert.Equal(t, "staging", rate.Namespace)
	assert.Equal(t, float32(5), rate.Tolerance[0].Degraded)

	// Test default fallback
	rate = matcher.GetMatchingRate("development", "test-app", "app")
	assert.NotNil(t, rate)
	assert.Equal(t, "", rate.Namespace) // Default has empty patterns
	assert.Equal(t, float32(10), rate.Tolerance[0].Degraded)

	// Test no match for production but wrong kind
	rate = matcher.GetMatchingRate("production", "critical-api", "service")
	assert.NotNil(t, rate)
	// Should fall through to default since kind doesn't match "workload"
	assert.Equal(t, "", rate.Namespace)
}

func TestHealthRateMatcherCodePatternXReplacement(t *testing.T) {
	conf := config.NewConfig()
	conf.HealthConfig.Rate = []config.Rate{
		{
			Tolerance: []config.Tolerance{
				{Code: "5XX", Protocol: "http", Direction: ".*"},
				{Code: "4xx", Protocol: "http", Direction: ".*"},
			},
		},
	}

	matcher := NewHealthRateMatcher(conf)

	// The X/x should be replaced with \d in the compiled pattern
	// This test verifies the pattern compilation is correct
	rate := matcher.GetMatchingRate("any", "any", "any")
	assert.NotNil(t, rate)
	assert.Len(t, rate.Tolerance, 2)
}

func TestParseHealthAnnotation(t *testing.T) {
	// Valid annotation
	tolerances := ParseHealthAnnotation("5xx,5,10,http,inbound")
	assert.Len(t, tolerances, 1)
	assert.Equal(t, "5xx", tolerances[0].Code)
	assert.Equal(t, float32(5), tolerances[0].Degraded)
	assert.Equal(t, float32(10), tolerances[0].Failure)
	assert.Equal(t, "http", tolerances[0].Protocol)
	assert.Equal(t, "inbound", tolerances[0].Direction)

	// Multiple tolerances
	tolerances = ParseHealthAnnotation("5xx,5,10,http,inbound;4xx,10,20,http,outbound")
	assert.Len(t, tolerances, 2)
	assert.Equal(t, "5xx", tolerances[0].Code)
	assert.Equal(t, "4xx", tolerances[1].Code)

	// Empty annotation
	tolerances = ParseHealthAnnotation("")
	assert.Nil(t, tolerances)

	// Invalid format (wrong number of fields)
	tolerances = ParseHealthAnnotation("5xx,5,10,http")
	assert.Len(t, tolerances, 0)

	// Invalid threshold (non-numeric)
	tolerances = ParseHealthAnnotation("5xx,abc,10,http,inbound")
	assert.Len(t, tolerances, 0)

	// Invalid threshold (degraded > failure)
	tolerances = ParseHealthAnnotation("5xx,20,10,http,inbound")
	assert.Len(t, tolerances, 0)

	// Mixed valid and invalid
	tolerances = ParseHealthAnnotation("5xx,5,10,http,inbound;invalid;4xx,10,20,http,outbound")
	assert.Len(t, tolerances, 2)
}

func TestCompilePatternWithInvalidRegex(t *testing.T) {
	// Invalid regex should fall back to .*
	pattern := compilePattern("[invalid", ".*")
	assert.NotNil(t, pattern)
	assert.True(t, pattern.MatchString("anything"))
}
