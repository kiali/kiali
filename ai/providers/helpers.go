package providers

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"regexp"
	"strings"

	"github.com/kiali/kiali/ai/mcp"
	"github.com/kiali/kiali/ai/types"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/handlers/authentication"
	"github.com/kiali/kiali/log"
)

var dateLikeRegexp = regexp.MustCompile(`\b\d{4}-\d{2}-\d{2}\b`)

func ShouldGenerateAnswer(response *types.AIResponse, toolNames []string) (bool, string) {
	shouldGenerate := false
	for _, toolName := range toolNames {
		if !mcp.ExcludedToolNames[toolName] {
			shouldGenerate = true
			break
		}
	}
	if shouldGenerate {
		return true, ""
	}

	if len(response.Actions) > 0 {
		return false, "I have found the following actions: "
	}
	if len(response.Citations) > 0 {
		return false, "I have found the following citations: "
	}
	return true, ""
}

func ParseMarkdownResponse(content string) string {
	// Fix code blocks: replace ``` with ~~~ (AI sometimes uses wrong delimiter)
	content = strings.ReplaceAll(content, "```", "~~~")

	// Defensive sanitization: sometimes models emit pseudo-tool tags like <execute_browse>...</execute_browse>.
	// These are not supported by Kiali and can leak to the UI as raw text.
	content = strings.ReplaceAll(content, `\u003c`, "<")
	content = strings.ReplaceAll(content, `\u003e`, ">")
	content = strings.ReplaceAll(content, "<execute_browse>", "")
	content = strings.ReplaceAll(content, "</execute_browse>", "")

	return content
}

func NewContextCanceledResponse(err error) (*types.AIResponse, int) {
	if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
		return &types.AIResponse{Error: err.Error()}, http.StatusRequestTimeout
	}
	return &types.AIResponse{Error: "request cancelled"}, http.StatusRequestTimeout
}

func CleanConversation(conversation *[]types.ConversationMessage) {
	// List of tool names that are not useful to store in conversation history

	cleaned := make([]types.ConversationMessage, 0, len(*conversation))
	for _, msg := range *conversation {
		// Remove tool messages where the tool name is in the exclusion list
		if msg.Role == "tool" && mcp.ExcludedToolNames[msg.Name] {
			log.Debugf("Removing tool message with excluded tool name: %s", msg.Name)
			continue
		}
		// Avoid persisting tool log dumps in conversation history; they can contaminate later answers.
		// This can happen both when the tool name is preserved (OpenAI path) and when it isn't (Google path).
		if msg.Role == "tool" {
			if msg.Name == "get_logs" {
				log.Debugf("Removing get_logs tool message from conversation history")
				continue
			}
			// Heuristic for unnamed tool messages that look like logs.
			if strings.HasPrefix(msg.Content, "~~~\n") && strings.HasSuffix(msg.Content, "~~~\n") && len(msg.Content) > 1500 && dateLikeRegexp.MatchString(msg.Content) {
				log.Debugf("Removing log-like tool message from conversation history")
				continue
			}
		}
		// Avoid persisting large log dumps in conversation history; they can contaminate later answers.
		// Heuristic: codeblock fences + date-like timestamps + large payload.
		if msg.Role == "assistant" && strings.HasPrefix(msg.Content, "~~~\n") && strings.HasSuffix(msg.Content, "~~~\n") && len(msg.Content) > 4000 && dateLikeRegexp.MatchString(msg.Content) {
			log.Debugf("Removing large log-like assistant message from conversation history")
			continue
		}
		cleaned = append(cleaned, msg)
	}
	*conversation = cleaned
}

func GetStoreConversation(r *http.Request, req types.AIRequest, aiStore types.AIStore) (*types.Conversation, string, []types.ConversationMessage) {
	var conversation []types.ConversationMessage
	var ptr *types.Conversation
	sessionID := authentication.GetSessionIDContext(r.Context())
	if aiStore.Enabled() {
		log.Debugf("Getting conversation for session ID: %s", sessionID)
		var found bool
		ptr, found = aiStore.GetConversation(sessionID, req.ConversationID)
		if found && ptr != nil {
			log.Debugf("Conversation found for conversation ID: %s", req.ConversationID)
			conversation = ptr.Conversation
		} else {
			log.Debugf("Creating new conversation for conversation ID: %s", req.ConversationID)
			// Create a new Conversation struct for storage later
			ptr = &types.Conversation{}
		}
	}
	return ptr, sessionID, conversation
}

func StoreConversation(aiProvider AIProvider, ctx context.Context, aiStore types.AIStore, ptr *types.Conversation, sessionID string, req types.AIRequest, conversation []types.ConversationMessage) {
	if aiStore.Enabled() {
		if err := ctx.Err(); err != nil {
			log.Errorf("[Chat AI] Failed to store conversation for session ID: %s and conversation ID: %s: %v", sessionID, req.ConversationID, err)
			return
		}
		// Clean conversation by removing tool messages that are not useful for storage
		CleanConversation(&conversation)
		if aiStore.ReduceWithAI() {
			if err := ctx.Err(); err != nil {
				log.Errorf("[Chat AI] Failed to store conversation for session ID: %s and conversation ID: %s: %v", sessionID, req.ConversationID, err)
				return
			}
			// Reduce the conversation with AI
			conversation = aiProvider.ReduceConversation(ctx, conversation, aiStore.ReduceThreshold())
			if err := ctx.Err(); err != nil {
				log.Errorf("[Chat AI] Failed to store conversation for session ID: %s and conversation ID: %s: %v", sessionID, req.ConversationID, err)
				return
			}
		}
		ptr.Mu.Lock()
		ptr.Conversation = conversation
		ptr.Mu.Unlock()
		err := aiStore.SetConversation(sessionID, req.ConversationID, ptr)
		if err != nil {
			log.Errorf("[Chat AI] Failed to set conversation for session ID: %s and conversation ID: %s: %v", sessionID, req.ConversationID, err)
		}
	}
}

// ToolResultProcessingResult contains the processed tool results and metadata
type ToolResultProcessingResult struct {
	Response          *types.AIResponse
	Conversation      []types.ConversationMessage
	GetLogsContent    string
	GetLogsAnalyze    bool
	ShouldReturnEarly bool
}

// ProcessToolResults processes tool execution results in a standardized way
// This function handles special cases for specific tools (get_pod_performance, get_logs)
// and builds the response and conversation accordingly
func ProcessToolResults(toolResults []mcp.ToolCallResult, conversation []types.ConversationMessage) ToolResultProcessingResult {
	result := ToolResultProcessingResult{
		Response:     &types.AIResponse{},
		Conversation: conversation,
	}

	for _, toolResult := range toolResults {
		// Handle errors
		if toolResult.Error != nil {
			result.Response.Error = toolResult.Error.Error()
			result.ShouldReturnEarly = true
			return result
		}

		// Collect actions and citations
		if len(toolResult.Actions) > 0 {
			result.Response.Actions = append(result.Response.Actions, toolResult.Actions...)
		}
		if len(toolResult.Citations) > 0 {
			result.Response.Citations = append(result.Response.Citations, toolResult.Citations...)
		}

		// Skip adding to conversation if we have actions/citations
		if len(toolResult.Actions) > 0 || len(toolResult.Citations) > 0 {
			continue
		}

		// Special handling for get_pod_performance: return markdown summary directly
		// This avoids depending on a second model call to "re-say" the table
		if toolResult.Message.Name == "get_pod_performance" && toolResult.Message.Content != "" {
			result.Response.Answer = ParseMarkdownResponse(toolResult.Message.Content)
			result.ShouldReturnEarly = true
			return result
		}

		// Special handling for get_logs
		if toolResult.Message.Name == "get_logs" && toolResult.Message.Content != "" {
			// Check if analyze parameter is false (default is false)
			analyze := false
			if toolResult.Message.Param != nil {
				if params, ok := toolResult.Message.Param.(map[string]interface{}); ok {
					log.Debugf("[ProcessToolResults] get_logs params: %+v", params)
					if analyzeVal, ok := params["analyze"].(bool); ok {
						analyze = analyzeVal
						log.Debugf("[ProcessToolResults] get_logs analyze param found: %v", analyze)
					} else {
						log.Debugf("[ProcessToolResults] get_logs analyze param not found or not bool, defaulting to false")
					}
				} else {
					log.Debugf("[ProcessToolResults] get_logs Param is not map[string]interface{}, type is: %T", toolResult.Message.Param)
				}
			} else {
				log.Debugf("[ProcessToolResults] get_logs Param is nil")
			}

			if !analyze {
				// Return logs directly without model analysis
				log.Debugf("[ProcessToolResults] get_logs returning logs directly (analyze=false)")
				result.Response.Answer = ParseMarkdownResponse(toolResult.Message.Content)
				result.ShouldReturnEarly = true
				return result
			}

			// analyze=true: keep tool content available for fallback if model returns unusable output
			log.Debugf("[ProcessToolResults] get_logs deferring to AI analysis (analyze=true)")
			result.GetLogsContent = toolResult.Message.Content
			result.GetLogsAnalyze = true
			// Do not append raw logs to the stored conversation; we will inject them only
			// into the analysis request to avoid contaminating future turns
			continue
		}

		// Default: append tool message to conversation
		if toolResult.Message.Content != "" {
			result.Conversation = append(result.Conversation, toolResult.Message)
		}
	}

	return result
}

func FormatToolContent(result interface{}) (string, error) {
	switch v := result.(type) {
	case string:
		return v, nil
	case []byte:
		return string(v), nil
	default:
		bytes, err := json.Marshal(v)
		if err != nil {
			return "", err
		}
		return string(bytes), nil
	}
}

func ResolveProviderKey(conf *config.Config, provider *config.ProviderConfig, model *config.AIModel) (string, error) {
	if conf == nil {
		return "", fmt.Errorf("config is required to resolve chat_ai credentials")
	}

	key := model.Key
	if key == "" {
		key = provider.Key
	}
	if key == "" {
		return "", fmt.Errorf("chat_ai provider %q model %q requires a key", provider.Name, model.Name)
	}

	resolvedKey, err := conf.GetCredential(key)
	if err != nil {
		return "", fmt.Errorf("failed to resolve chat_ai key for provider %q model %q: %w", provider.Name, model.Name, err)
	}
	return resolvedKey, nil
}
