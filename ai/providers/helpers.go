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
	return strings.ReplaceAll(content, "```", "~~~")
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
