package google_provider

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"google.golang.org/genai"
)

func TestUsageFromGenerateContentResponse(t *testing.T) {
	usage := usageFromGenerateContentResponse(&genai.GenerateContentResponse{
		UsageMetadata: &genai.GenerateContentResponseUsageMetadata{
			PromptTokenCount:        11,
			ToolUsePromptTokenCount: 7,
			CandidatesTokenCount:    13,
			ThoughtsTokenCount:      5,
			TotalTokenCount:         36,
		},
	})

	assert.Equal(t, int64(18), usage.PromptTokens)
	assert.Equal(t, int64(18), usage.CompletionTokens)
	assert.Equal(t, int64(36), usage.TotalTokens)
}
