package troubleshooting

import (
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/kiali/kiali/ai/mcputil"
	"github.com/kiali/kiali/config"
)

func TestSuggestionsAllowed(t *testing.T) {
	conf := config.NewConfig()
	conf.Auth.Strategy = config.AuthStrategyAnonymous
	ki := &mcputil.KialiInterface{Conf: conf, Request: httptest.NewRequest("POST", "/", nil)}

	assert.False(t, suggestionsAllowed(ki), "AI support disabled")

	conf.AI.Troubleshooting.AISupport.Enabled = true
	assert.True(t, suggestionsAllowed(ki), "empty ai_support.allowed_users allows every user")

	conf.AI.Troubleshooting.AISupport.AllowedUsers = []string{"other"}
	assert.False(t, suggestionsAllowed(ki), "anonymous is not in the allow list")

	conf.AI.Troubleshooting.AISupport.AllowedUsers = []string{"anonymous"}
	assert.True(t, suggestionsAllowed(ki))
}

func TestClearSuggestedActions(t *testing.T) {
	issues := []Issue{{
		SubProblems: []SubProblem{{
			SuggestedActions: []SuggestedAction{{Type: ActionTypeAdvice, Command: "kubectl get pods"}},
			SuggestedPrompt:  "keep this prompt",
		}},
	}}
	clearSuggestedActions(issues)
	require.Empty(t, issues[0].SubProblems[0].SuggestedActions)
	assert.Equal(t, "keep this prompt", issues[0].SubProblems[0].SuggestedPrompt)
}
