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

type LogLevel int

const (
	LogLevelDebug LogLevel = iota
	LogLevelInfo
	LogLevelWarn
	LogLevelError
)

func Log(provider AIProvider, level LogLevel, category string, format string, args ...interface{}) {
	msg := fmt.Sprintf(format, args...)
	prefix := fmt.Sprintf("[Chat AI][%s][%s]", provider.GetName(), category)
	switch level {
	case LogLevelDebug:
		log.Debugf("%s %s", prefix, msg)
	case LogLevelInfo:
		log.Infof("%s %s", prefix, msg)
	case LogLevelWarn:
		log.Warningf("%s %s", prefix, msg)
	case LogLevelError:
		log.Errorf("%s %s", prefix, msg)
	}
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

func GetStoreConversation(r *http.Request, req *types.AIRequest, aiStore types.AIStore) (*types.Conversation, string) {
	ptr := &types.Conversation{}
	sessionID := authentication.GetSessionIDContext(r.Context())
	if aiStore.Enabled() && req.ConversationID != "" {
		log.Debugf("Getting conversation for session ID: %s", sessionID)
		var found bool
		ptr, found = aiStore.GetConversation(sessionID, req.ConversationID)
		if found && ptr != nil {
			log.Debugf("Conversation found for conversation ID: %s", req.ConversationID)
			return ptr, sessionID
		}
	}
	return ptr, sessionID
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
	ShouldReturnEarly bool
}

// ProcessToolResults processes tool execution results in a standardized way
// and builds the response and conversation accordingly
func ProcessToolResults(toolResults []types.StreamToolResultData, conversation []types.ConversationMessage) ToolResultProcessingResult {
	result := ToolResultProcessingResult{
		Response:     &types.AIResponse{},
		Conversation: conversation,
	}

	for _, toolResult := range toolResults {
		// Handle errors
		if toolResult.Status == "error" {
			result.Response.Error = toolResult.Content
			return result
		}
	}
	return result
}

// AddContextToConversation creates a temporary copy of the conversation with context added
// The context is NOT saved to the persistent conversation to avoid contaminating future interactions
func AddContextToConversation(conversation []types.ConversationMessage, req types.AIRequest) []types.ConversationMessage {
	if len(conversation) == 0 {
		return conversation
	}

	// Create a copy to avoid modifying the original
	result := make([]types.ConversationMessage, 0, len(conversation)+1)

	// Add system instruction (should be first)
	result = append(result, conversation[0])

	// Add context as second message (after system instruction, before user messages)
	contextBytes, _ := json.Marshal(req.Context)
	contextContent := fmt.Sprintf("CONTEXT (JSON):\n%s\n\n", string(contextBytes))
	result = append(result, types.ConversationMessage{
		Content: contextContent,
		Name:    "",
		Param:   nil,
		Role:    "system",
	})

	// Add the rest of the conversation
	if len(conversation) > 1 {
		result = append(result, conversation[1:]...)
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
