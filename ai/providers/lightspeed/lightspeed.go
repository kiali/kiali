package lightspeed_provider

import (
	"context"
	"encoding/json"
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

type lightSpeedEndUsage struct {
	InputTokens     int64 `json:"input_tokens"`
	OutputTokens    int64 `json:"output_tokens"`
	ReasoningTokens int64 `json:"reasoning_tokens"`
}

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

func (p *LightSpeedProvider) SendChat(onChunk func(chunk string), r *http.Request, req types.AIRequest, kialiInterface *mcputil.KialiInterface, aiStore types.AIStore) types.TokenUsage {
	bearerToken := getBearerToken(r, kialiInterface.Conf)
	p.client.SetAuthToken(bearerToken)
	authorizedResponse, code, err := p.client.Authorized(r.Context(), "")
	if err != nil {
		providers.Log(p, providers.LogLevelError, "Error", "Error authorizing user: %v", err)
		providers.StreamError(onChunk, handleErrorCodeAuthorized(code))
		return types.TokenUsage{}
	}
	providers.Log(p, providers.LogLevelDebug, "Conversation", "The user %s is logged-in and authorized to access OLS", authorizedResponse.Username)
	usage := types.TokenUsage{}
	sanitizedOnChunk := func(chunk string) {
		sanitizedChunk, chunkUsage := sanitizeLightSpeedChunk(chunk)
		usage.Add(chunkUsage)
		onChunk(sanitizedChunk)
	}
	mode := string(req.InteractionMode)
	if mode == "" {
		mode = "ask"
	}
	// Map "troubleshoot" to "troubleshooting" for Lightspeed API compatibility
	if mode == "troubleshoot" {
		mode = "troubleshooting"
	}
	// Validate mode is supported, default to "ask" if invalid
	if mode != "ask" && mode != "troubleshooting" {
		providers.Log(p, providers.LogLevelWarn, "Validation", "Invalid interaction mode %q, defaulting to 'ask'", mode)
		mode = "ask"
	}
	request := &client.LLMRequest{
		ConversationID: req.ConversationID,
		MediaType:      "application/json",
		Mode:           mode,
		Query:          req.Query,
	}
	code, err = p.client.StreamingQuery(r.Context(), request, authorizedResponse.UserID, sanitizedOnChunk)
	if err != nil {
		providers.Log(p, providers.LogLevelError, "Error", "Error querying OLS: %v", err)
		providers.StreamError(onChunk, fmt.Sprintf("[%s] %s", handleErrorCodeQuery(code), err.Error()))
	}
	return usage
}

func sanitizeLightSpeedChunk(chunk string) (string, types.TokenUsage) {
	var event types.StreamEvent
	if err := json.Unmarshal([]byte(chunk), &event); err != nil || event.Event != providers.LLM_END_EVENT {
		return chunk, types.TokenUsage{}
	}

	var usagePayload lightSpeedEndUsage
	_ = json.Unmarshal(event.Data, &usagePayload)
	usage := types.NewTokenUsage(usagePayload.InputTokens, usagePayload.OutputTokens, 0)

	var endData map[string]json.RawMessage
	if err := json.Unmarshal(event.Data, &endData); err != nil {
		return `{"event":"end","data":{}}`, usage
	}

	delete(endData, "input_tokens")
	delete(endData, "output_tokens")
	delete(endData, "reasoning_tokens")

	sanitizedData, err := json.Marshal(endData)
	if err != nil {
		return `{"event":"end","data":{}}`, usage
	}
	event.Data = sanitizedData

	sanitizedChunk, err := json.Marshal(event)
	if err != nil {
		return `{"event":"end","data":{}}`, usage
	}
	return string(sanitizedChunk), usage
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

func (p *LightSpeedProvider) InitializeConversation(_ *types.Conversation, _ types.AIRequest) {}

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
