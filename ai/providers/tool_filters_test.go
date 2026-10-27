package providers

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/kiali/kiali/ai/mcp"
	"github.com/kiali/kiali/config"
)

func TestIsDefaultToolExposed_HidesTotallyExcludedTools(t *testing.T) {
	require.NoError(t, mcp.LoadTools())

	assert.True(t, mcp.TotallyExcludedToolNames["troubleshooting"])
	assert.False(t, IsDefaultToolExposed(config.NewConfig(), "", "troubleshooting"))
	assert.NotContains(t, FilteredDefaultToolNames(config.NewConfig(), ""), "troubleshooting")
	assert.Contains(t, FilteredDefaultToolNames(config.NewConfig(), ""), "get_mesh_status")
}
