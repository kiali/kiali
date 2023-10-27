package business

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestIstioConfigMapName(t *testing.T) {
	testCases := map[string]struct {
		revision string
		expected string
	}{
		"revision is default": {
			revision: "default",
			expected: "istio",
		},
		"revision is v1": {
			revision: "v1",
			expected: "istio-v1",
		},
		"revision is empty": {
			revision: "",
			expected: "istio",
		},
	}

	for desc, tc := range testCases {
		t.Run(desc, func(t *testing.T) {
			result := guessIstioConfigMapName(tc.revision)
			assert.Equal(t, tc.expected, result)
		})
	}
}
