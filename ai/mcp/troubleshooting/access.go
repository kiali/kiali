package troubleshooting

import (
	"slices"
	"strings"

	"k8s.io/client-go/tools/clientcmd/api"

	"github.com/kiali/kiali/ai/mcputil"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/handlers/authentication"
)

// suggestionsAllowed reports whether sub-problem actions and the top-level ask/Fix
// actions should be returned. AI support must be enabled, and the caller must be
// in ai.troubleshooting.ai_support.allowed_users. An empty list allows every user.
func suggestionsAllowed(ki *mcputil.KialiInterface) bool {
	if ki == nil || ki.Conf == nil || !ki.Conf.AI.Troubleshooting.AISupport.Enabled {
		return false
	}
	return userAllowed(ki.Conf.AI.Troubleshooting.AISupport.AllowedUsers, requestUsername(ki))
}

func userAllowed(allowed []string, username string) bool {
	if len(allowed) == 0 {
		return true
	}
	return slices.Contains(allowed, username)
}

func clearSuggestedActions(issues []Issue) {
	for i := range issues {
		for j := range issues[i].SubProblems {
			issues[i].SubProblems[j].SuggestedActions = nil
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
