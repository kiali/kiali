package types

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestTokenUsageAddRecomputesTotalFromSummedFields(t *testing.T) {
	usage := TokenUsage{
		PromptTokens:     10,
		CompletionTokens: 5,
		TotalTokens:      15,
	}

	usage.Add(TokenUsage{
		PromptTokens:     3,
		CompletionTokens: 2,
		TotalTokens:      0,
	})

	assert.Equal(t, int64(13), usage.PromptTokens)
	assert.Equal(t, int64(7), usage.CompletionTokens)
	assert.Equal(t, int64(20), usage.TotalTokens)
}
