package lightspeed_provider

import (
	"context"
	"fmt"
	"net/http"

	"k8s.io/client-go/tools/clientcmd/api"

	"github.com/kiali/kiali/ai/mcputil"
	"github.com/kiali/kiali/ai/providers"
	"github.com/kiali/kiali/ai/providers/lightspeed/client"
	"github.com/kiali/kiali/ai/types"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/handlers/authentication"
)

// getBearerToken returns the Kubernetes Bearer token for the user logged in to Kiali from the request context.
// The token is set by the authentication middleware after session validation. Returns empty string if not found.
func getBearerToken(r *http.Request, conf *config.Config) string {
	authInfoContext := authentication.GetAuthInfoContext(r.Context())
	if authInfoContext == nil {
		return ""
	}
	authInfos, ok := authInfoContext.(map[string]*api.AuthInfo)
	if !ok {
		return ""
	}
	info := authInfos[conf.KubernetesConfig.ClusterName]
	if info == nil {
		return ""
	}
	return info.Token
}

func (p *LightSpeedProvider) SendChat(onChunk func(chunk string), r *http.Request, req types.AIRequest, kialiInterface *mcputil.KialiInterface, aiStore types.AIStore) {
	bearerToken := getBearerToken(r, kialiInterface.Conf)
	p.client.SetAuthToken(bearerToken)
	authorizedResponse, code, err := p.client.Authorized(r.Context(), "")
	if err != nil {
		providers.Log(p, providers.LogLevelError, "Error", "Error authorizing user: %v", err)
		providers.StreamError(onChunk, handleErrorCodeAuthorized(code))
		return
	}
	providers.Log(p, providers.LogLevelDebug, "Conversation", "The user %s is logged-in and authorized to access OLS", authorizedResponse.Username)
	request := &client.LLMRequest{
		Query:          req.Query,
		MediaType:      "application/json",
		Mode:           "ask",
		ConversationID: req.ConversationID,
	}
	code, err = p.client.StreamingQuery(r.Context(), request, authorizedResponse.UserID, onChunk)
	if err != nil {
		providers.Log(p, providers.LogLevelError, "Error", "Error querying OLS: %v", err)
		providers.StreamError(onChunk, fmt.Sprintf("[%s] %s", handleErrorCodeQuery(code), err.Error()))
	}
}

func handleErrorCodeQuery(code int) string {
	switch code {
	case http.StatusUnauthorized:
		return "Missing or invalid credentials provided by client"
	case http.StatusForbidden:
		return "Client does not have permission to access resource"
	case 413:
		return "Prompt is too long"
	case 500:
		return "Query cannot be validated, LLM is not accessible or other internal error"
	case 422:
		return "Validation Error"
	}
	return "Unexpected error querying OLS"
}

func handleErrorCodeAuthorized(code int) string {
	switch code {
	case http.StatusUnauthorized:
		return "Missing or invalid credentials provided by client"
	case http.StatusForbidden:
		return "User is not authorized"
	case 500:
		return "Unexpected error during token review"
	case 422:
		return "Validation Error"
	}
	return "Unexpected error authorizing user"
}

// LightSpeed does not use Kiali's conversation store — it is stateless from
// Kiali's perspective (the OLS server maintains its own session state).

func (p *LightSpeedProvider) InitializeConversation(_ *types.Conversation, _ string) {}

func (p *LightSpeedProvider) ReduceConversation(_ context.Context, _ *types.Conversation, _ int) {
}

func (p *LightSpeedProvider) TransformToolCallToToolsProcessor(_ any) ([]types.StreamToolCallData, []string, error) {
	return nil, nil, nil
}

func (p *LightSpeedProvider) ConversationToProvider(_ []types.ConversationMessage) interface{} {
	return nil
}

func (p *LightSpeedProvider) ProviderToConversation(_ interface{}) types.ConversationMessage {
	return types.ConversationMessage{}
}
