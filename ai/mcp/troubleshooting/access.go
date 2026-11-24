package troubleshooting

import (
	"slices"
	"strings"

	"k8s.io/client-go/tools/clientcmd/api"

	"github.com/kiali/kiali/ai/mcputil"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/handlers/authentication"
)

// suggestionsAllowed reports whether sub-problem actions should be returned.
// The caller must be allowed to use chat. An empty chat allow list allows every user.
func suggestionsAllowed(ki *mcputil.KialiInterface) bool {
	if ki == nil || ki.Conf == nil || !ki.Conf.AI.Enabled || !ki.Conf.AI.ChatAI.Enabled {
		return false
	}
	return userAllowed(ki.Conf.AI.ChatAI.AllowedUsers, requestUsername(ki))
}

func userAllowed(allowed []string, username string) bool {
	if len(allowed) == 0 {
		return true
	}
	return slices.Contains(allowed, username)
}

// clearSuggestedActions removes executable Advice/commands when chat is not allowed.
// Analyze/Question actions stay so the UI can still show disabled "Fix with AI" controls.
func clearSuggestedActions(issues []Issue) {
	for i := range issues {
		for j := range issues[i].SubProblems {
			actions := issues[i].SubProblems[j].SuggestedActions
			if len(actions) == 0 {
				continue
			}
			kept := make([]SuggestedAction, 0, len(actions))
			for _, action := range actions {
				if action.Type == ActionTypeAnalyze || action.Type == ActionTypeQuestion {
					kept = append(kept, action)
				}
			}
			issues[i].SubProblems[j].SuggestedActions = kept
		}
	}
}

func requestUsername(ki *mcputil.KialiInterface) string {
	if ki == nil || ki.Conf == nil {
		return ""
	}
	if ki.Conf.Auth.Strategy == config.AuthStrategyAnonymous {
		return "anonymous"
	}
	if ki.Request == nil {
		return ""
	}
	if user := strings.TrimSpace(ki.Request.Header.Get("Kiali-User")); user != "" {
		return strings.TrimPrefix(user, "system:serviceaccount:")
	}
	authInfoContext := authentication.GetAuthInfoContext(ki.Request.Context())
	infos, ok := authInfoContext.(map[string]*api.AuthInfo)
	if !ok {
		return ""
	}
	info := infos[ki.Conf.KubernetesConfig.ClusterName]
	if info == nil {
		return ""
	}
	return info.Username
}
