package threshold

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestCompare(t *testing.T) {
	assert.Equal(t, Compare(200, "<", 400), true)
	assert.Equal(t, Compare(200, "<=", 400), true)
	assert.Equal(t, Compare(200, "<=", 200), true)
	assert.Equal(t, Compare(200, "==", 200), true)
	assert.Equal(t, Compare(200, "!=", 400), true)
	assert.Equal(t, Compare(200, ">=", 200), true)

	assert.Equal(t, Compare(200, "!=", 200), false)
	assert.Equal(t, Compare(200, "==", 300), false)
	assert.Equal(t, Compare(200, ">=", 300), false)
	assert.Equal(t, Compare(200, ">", 300), false)
	assert.Equal(t, Compare(400, "<=", 300), false)
	assert.Equal(t, Compare(400, "<", 300), false)
	assert.Equal(t, Compare(400, "<", 400), false)
}

func TestDeleteEmpty(t *testing.T) {
	assert.Equal(t, delete_empty([]string{"a", "", "c"}), []string{"a", "c"})
}
