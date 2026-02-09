package mcputil

import (
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

type stringerVal struct{}

func (stringerVal) String() string {
	return "stringer"
}

func TestGetStringArg(t *testing.T) {
	args := map[string]interface{}{
		"first":  "  value  ",
		"second": "other",
	}

	assert.Equal(t, "value", GetStringArg(args, "first", "second"))
	assert.Equal(t, "other", GetStringArg(args, "missing", "second"))
	assert.Equal(t, "", GetStringArg(args, "missing"))
}

func TestGetTimeArg(t *testing.T) {
	now := time.Now()
	args := map[string]interface{}{
		"t1": now,
		"t2": now.Format(time.RFC3339),
	}

	assert.Equal(t, now, GetTimeArg(args, "t1"))
	parsed := GetTimeArg(args, "t2")
	assert.True(t, parsed.Equal(now))
	assert.True(t, GetTimeArg(map[string]interface{}{}, "missing").IsZero())
}

func TestAsString(t *testing.T) {
	assert.Equal(t, "", AsString(nil))
	assert.Equal(t, "text", AsString("text"))
	assert.Equal(t, "bytes", AsString([]byte("bytes")))
	assert.Equal(t, "stringer", AsString(stringerVal{}))
	assert.Equal(t, "1.23", AsString(float64(1.23)))
	assert.Equal(t, "7", AsString(int(7)))
	assert.Equal(t, "9", AsString(int64(9)))
	assert.Equal(t, "11", AsString(uint64(11)))
	assert.Equal(t, "true", AsString(true))
	assert.Equal(t, "false", AsString(false))
	assert.Equal(t, fmt.Sprintf("%v", struct{ A int }{A: 1}), AsString(struct{ A int }{A: 1}))
}

func TestAsBool(t *testing.T) {
	assert.True(t, AsBool(true))
	assert.False(t, AsBool(false))
	assert.True(t, AsBool("true"))
	assert.False(t, AsBool("false"))
	assert.False(t, AsBool("not-bool"))
	assert.False(t, AsBool(123))
}

func TestAsInt(t *testing.T) {
	assert.Equal(t, 5, AsInt(5))
	assert.Equal(t, 6, AsInt(int64(6)))
	assert.Equal(t, 7, AsInt(float64(7.9)))
	assert.Equal(t, 8, AsInt("8"))
	assert.Equal(t, 0, AsInt("not-int"))
	assert.Equal(t, 0, AsInt(true))
}
