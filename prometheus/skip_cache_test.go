package prometheus

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestContextWithSkipCache(t *testing.T) {
	ctx := context.Background()
	assert.False(t, shouldSkipCache(ctx), "plain context should not skip cache")

	skipCtx := ContextWithSkipCache(ctx)
	assert.True(t, shouldSkipCache(skipCtx), "context with skip-cache should skip cache")
}

func TestSkipCacheChildContext(t *testing.T) {
	ctx := ContextWithSkipCache(context.Background())

	// Child contexts should inherit the skip-cache signal
	childCtx, cancel := context.WithCancel(ctx)
	defer cancel()
	assert.True(t, shouldSkipCache(childCtx), "child context should inherit skip-cache")
}
