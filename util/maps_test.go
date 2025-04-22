package util

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestRemoveNilValues(t *testing.T) {
	vs := map[string]interface{}{
		"k1": "v1",
		"k2": nil,
		"k3": map[string]interface{}{
			"k3k1": "k3v1",
			"k3k2": nil,
			"k3k3": map[string]interface{}{
				"k3k3k1": "k3k3v1",
				"k3k3k2": nil,
				"k3k3k3": "k3k3v3",
			},
		},
	}

	RemoveNilValues(vs)

	_, k2 := vs["k2"]
	_, k3k2 := (vs["k3"].(map[string]interface{}))["k3k2"]
	_, k3k3k2 := ((vs["k3"].(map[string]interface{}))["k3k3"].(map[string]interface{}))["k3k3k2"]

	assert.False(t, k2)
	assert.False(t, k3k2)
	assert.False(t, k3k3k2)

	_, k1 := vs["k1"]
	_, k3k1 := (vs["k3"].(map[string]interface{}))["k3k1"]
	_, k3k3k1 := ((vs["k3"].(map[string]interface{}))["k3k3"].(map[string]interface{}))["k3k3k1"]

	assert.True(t, k1)
	assert.True(t, k3k1)
	assert.True(t, k3k3k1)
}

func TestCopyMap(t *testing.T) {
	initialMap := map[string]string{
		"cluster":   "east",
		"namespace": "bookinfo",
	}
	copyMap := CopyStringMap(initialMap)

	initialMap["cluster"] = "west"

	assert.Equal(t, initialMap["cluster"], "west")
	assert.Equal(t, copyMap["cluster"], "east")
	assert.Equal(t, copyMap["namespace"], initialMap["namespace"])
}

func TestIsRollout(t *testing.T) {
	tests := []struct {
		name     string
		labels   map[string]string
		expected bool
	}{
		{
			name:     "istio-rollout-6859f78556",
			labels:   map[string]string{RolloutsLabel: "6859f78556"},
			expected: true,
		},
		{
			name:     "some-other-name",
			labels:   map[string]string{RolloutsLabel: "6859f78556"},
			expected: false,
		},
		{
			name:     "istio-rollout-6859f78556",
			labels:   map[string]string{},
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.expected, IsRollout(tt.name, tt.labels))
		})
	}
}

func TestGetRolloutName(t *testing.T) {
	tests := []struct {
		name     string
		labels   map[string]string
		expected string
	}{
		{
			name:     "istio-rollout-6859f78556-v1",
			labels:   map[string]string{RolloutsLabel: "6859f78556"},
			expected: "istio-rollout",
		},
		{
			name:     "istio-rollout-6859f78556",
			labels:   map[string]string{RolloutsLabel: "6859f78556"},
			expected: "istio-rollout",
		},
		{
			name:     "other-name",
			labels:   map[string]string{RolloutsLabel: "6859f78556"},
			expected: "other-name",
		},
		{
			name:     "no-label",
			labels:   map[string]string{},
			expected: "no-label",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.expected, GetRolloutName(tt.name, tt.labels))
		})
	}
}

func TestJoinLabels(t *testing.T) {
	labels1 := map[string]string{
		"app":         "istio-rollout",
		RolloutsLabel: "6859f78556",
	}
	labels2 := map[string]string{
		"app":     "istio-rollout",
		"version": "v1",
	}
	labels3 := map[string]string{
		"app": "istio-rollout",
	}

	expected := map[string]string{
		"app":     "istio-rollout",
		"version": "v1",
	}

	assert.Equal(t, expected, JoinLabelsWithoutRollout(labels1, labels2, labels3))
}
