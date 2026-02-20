package lightspeed_provider

import (
	"context"
	"net/http"

	"k8s.io/client-go/tools/clientcmd/api"

	"github.com/kiali/kiali/ai/mcp"
	"github.com/kiali/kiali/ai/providers/lightspeed/client"
	"github.com/kiali/kiali/ai/types"
	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/cache"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/grafana"
	"github.com/kiali/kiali/handlers/authentication"
	"github.com/kiali/kiali/istio"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/perses"
	"github.com/kiali/kiali/prometheus"
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

func (p *LightSpeedProvider) SendChat(r *http.Request, req types.AIRequest, business *business.Layer, prom prometheus.ClientInterface, clientFactory kubernetes.ClientFactory,
	kialiCache cache.KialiCache, aiStore types.AIStore, conf *config.Config, grafana *grafana.Service, perses *perses.Service, discovery *istio.Discovery) (*types.AIResponse, int) {
	bearerToken := getBearerToken(r, conf)
	p.client.SetAuthToken(bearerToken)
	authorizedResponse, code, err := p.client.Authorized(r.Context(), "")
	log.Debugf("LightSpeed provider authorized response: %+v", authorizedResponse)
	if err != nil {
		return handleErrorCodeAuthorized(code), http.StatusInternalServerError
	}
	log.Debugf("The user %s is logged-in and authorized to access OLS", authorizedResponse.Username)
	if err != nil {
		return &types.AIResponse{Error: err.Error()}, http.StatusInternalServerError
	}
	request := &client.LLMRequest{
		Query: req.Query,
	}
	response, code, err := p.client.Query(r.Context(), request, authorizedResponse.UserID)
	if err != nil {
		return handleErrorCodeQuery(code), http.StatusInternalServerError
	}
	return response, code
}

func handleErrorCodeQuery(code int) *types.AIResponse {
	switch code {
	case http.StatusUnauthorized:
		return &types.AIResponse{Error: "Missing or invalid credentials provided by client"}
	case http.StatusForbidden:
		return &types.AIResponse{Error: "Client does not have permission to access resource"}
	case 413:
		return &types.AIResponse{Error: "Prompt is too long"}
	case 500:
		return &types.AIResponse{Error: "Query can not be validated, LLM is not accessible or other internal error"}
	case 422:
		return &types.AIResponse{Error: "Validation Error"}
	}
	return nil
}
func handleErrorCodeAuthorized(code int) *types.AIResponse {
	switch code {
	case http.StatusUnauthorized:
		return &types.AIResponse{Error: "Missing or invalid credentials provided by client"}
	case http.StatusForbidden:
		return &types.AIResponse{Error: "User is not authorized"}
	case 500:
		return &types.AIResponse{Error: "Unexpected error during token review"}
	case 422:
		return &types.AIResponse{Error: "Validation Error"}
	}
	return nil
}

// Not used for LightSpeed provider
func (p *LightSpeedProvider) InitializeConversation(conversation *[]types.ConversationMessage, req types.AIRequest) {
}
func (p *LightSpeedProvider) ReduceConversation(ctx context.Context, conversation []types.ConversationMessage, reduceThreshold int) []types.ConversationMessage {
	return conversation
}
func (p *LightSpeedProvider) TransformToolCallToToolsProcessor(toolCall any) ([]mcp.ToolsProcessor, []string) {
	return nil, nil
}
func (p *LightSpeedProvider) ConversationToProvider(conversation []types.ConversationMessage) interface{} {
	return nil
}
func (p *LightSpeedProvider) ProviderToConversation(providerMessage interface{}) types.ConversationMessage {
	return types.ConversationMessage{}
}
