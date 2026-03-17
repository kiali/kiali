package mcp

import (
	"sync"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestLoadTools_Success(t *testing.T) {
	err := LoadTools()
	require.NoError(t, err)
	assert.Greater(t, len(DefaultToolHandlers), 0, "Should load at least one tool")
}

func TestLoadTools_Concurrent(t *testing.T) {
	// Reset state for this test (normally would use a test helper, but keeping it simple)
	// Note: In real scenario, sync.Once cannot be reset, so we're testing that concurrent
	// calls don't cause issues even if LoadTools was already called

	var wg sync.WaitGroup
	numGoroutines := 100
	errors := make(chan error, numGoroutines)

	// Simulate 100 concurrent HTTP requests all trying to load tools
	for i := 0; i < numGoroutines; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			err := LoadTools()
			if err != nil {
				errors <- err
			}
		}()
	}

	wg.Wait()
	close(errors)

	// Check no errors occurred
	for err := range errors {
		t.Errorf("LoadTools() failed in concurrent execution: %v", err)
	}

	// Verify tools were loaded
	assert.Greater(t, len(DefaultToolHandlers), 0, "Tools should be loaded after concurrent calls")
}

func TestLoadTools_Idempotent(t *testing.T) {
	// First call
	err1 := LoadTools()
	require.NoError(t, err1)
	count1 := len(DefaultToolHandlers)

	// Second call should return same result
	err2 := LoadTools()
	require.NoError(t, err2)
	count2 := len(DefaultToolHandlers)

	assert.Equal(t, count1, count2, "Multiple calls to LoadTools() should return same number of tools")
	assert.Greater(t, count1, 0, "Should have loaded tools")
}

func TestLoadTools_ThreadSafety(t *testing.T) {
	// This test should be run with: go test -race
	// It verifies that concurrent LoadTools() calls and concurrent map reads don't cause data races.
	var wg sync.WaitGroup
	errCh := make(chan error, 50)

	for i := 0; i < 50; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			errCh <- LoadTools()
			_ = len(DefaultToolHandlers) // Concurrent read after load
		}()
	}

	wg.Wait()
	close(errCh)
	for err := range errCh {
		require.NoError(t, err)
	}
}

func TestToolDef_Call_UnknownTool(t *testing.T) {
	tool := ToolDef{
		Name:        "unknown_tool",
		Description: "Unknown tool for testing",
	}

	result, code := tool.Call(nil, nil)

	assert.Nil(t, result, "Unknown tool should return nil")
	assert.Equal(t, 404, code, "Unknown tool should return 404")
}
