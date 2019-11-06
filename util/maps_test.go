package util

import (
	"github.com/stretchr/testify/assert"
	"testing"
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
