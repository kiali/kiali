package providers

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"regexp"
	"sort"
	"strings"
	"time"

	"github.com/kiali/kiali/ai/mcp"
	"github.com/kiali/kiali/ai/types"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/handlers/authentication"
	"github.com/kiali/kiali/log"
)

// Logging control for AI stuff
type LogLevel int

const (
	LogLevelDebug LogLevel = iota
	LogLevelInfo
	LogLevelWarn
	LogLevelError
)

// formatToolArgValue renders a single tool argument value for log output.
// Strings and JSON-serialised values longer than maxArgLen characters are
// truncated and annotated with their total length so the log stays readable
// even when an argument contains full YAML or multi-line text.
const maxArgLen = 100

func formatToolArgValue(v any) string {
	var s string
	switch val := v.(type) {
	case string:
		s = val
	case bool, float64, int, int64:
		s = fmt.Sprintf("%v", val)
	default:
		b, err := json.Marshal(v)
		if err != nil {
			s = fmt.Sprintf("%v", v)
		} else {
			s = string(b)
		}
	}
	if len(s) <= maxArgLen {
		return s
	}
	return fmt.Sprintf("%s… (%d chars)", s[:maxArgLen], len(s))
}

// LogToolCalls emits a structured debug block per tool call, showing each
// argument as key=value on its own indented line.  Large values (e.g. YAML
// payloads) are truncated so the log stays human-readable.
//
// Example output:
//
//	[Chat AI][OpenAI][ToolCalls] Executing tool (iter=0): manage_istio_config
//	  action    = create
//	  confirmed = false
//	  data      = apiVersion: networking.istio.io/v1… (843 chars)
//	  group     = networking.istio.io
//	  kind      = DestinationRule
//	  namespace = bookinfo
//	  object    = reviews
func LogToolCalls(p AIProvider, iter int, tools []types.StreamToolCallData) {
	for _, tc := range tools {
		if len(tc.Args) == 0 {
			Log(p, LogLevelDebug, "ToolCalls", "Executing tool (iter=%d): %s  id=%s (no args)", iter, tc.Name, tc.ID)
			continue
		}

		// Collect keys in sorted order for a stable, readable output
		keys := make([]string, 0, len(tc.Args))
		for k := range tc.Args {
			keys = append(keys, k)
		}
		sort.Strings(keys)

		// Find the longest key for alignment
		maxKeyLen := 0
		for _, k := range keys {
			if len(k) > maxKeyLen {
				maxKeyLen = len(k)
			}
		}

		lines := make([]string, 0, len(keys)+1)
		lines = append(lines, fmt.Sprintf("Executing tool (iter=%d): %s  id=%s", iter, tc.Name, tc.ID))
		for _, k := range keys {
			padding := strings.Repeat(" ", maxKeyLen-len(k))
			lines = append(lines, fmt.Sprintf("  %s%s = %s", k, padding, formatToolArgValue(tc.Args[k])))
		}

		Log(p, LogLevelDebug, "ToolCalls", "%s", strings.Join(lines, "\n"))
	}
}

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

var dateLikeRegexp = regexp.MustCompile(`\b\d{4}-\d{2}-\d{2}\b`)

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

func NewContextCanceledResponse(onChunk func(chunk string), err error) {
	if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
		StreamError(onChunk, err.Error())
		return
	}
	StreamError(onChunk, "request cancelled")
}

func CleanConversation(ptr *types.Conversation) {
	if ptr == nil {
		return
	}
	// List of tool names that are not useful to store in conversation history

	cleaned := make([]types.ConversationMessage, 0, len(ptr.Conversation))
	for _, msg := range ptr.Conversation {
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
	ptr.Mu.Lock()
	ptr.LastAccessed = time.Now()
	ptr.Conversation = cleaned
	ptr.Mu.Unlock()
}

func GetStoreConversation(
	r *http.Request,
	req *types.AIRequest,
	aiStore types.AIStore,
	initializeConversation func(*types.Conversation, string),
) (*types.Conversation, string) {
	ptr := &types.Conversation{}
	sessionID := authentication.GetSessionIDContext(r.Context())
	if req.ConversationID == "" {
		req.ConversationID = aiStore.GenerateConversationID()
	}
	if aiStore.Enabled() {
		log.Debugf("Getting conversation for session ID: %s", sessionID)
		var found bool
		storedConversation, found := aiStore.GetConversation(sessionID, req.ConversationID)
		if found && storedConversation != nil {
			log.Debugf("Conversation found for conversation ID: %s", req.ConversationID)
			// Work on a copy to avoid mutating store-backed slice before persistence.
			ptr.Conversation = append([]types.ConversationMessage(nil), storedConversation.Conversation...)
			ptr.LastAccessed = storedConversation.LastAccessed
			ptr.EstimatedMB = storedConversation.EstimatedMB
		} else {
			log.Debugf("Creating new conversation for conversation ID: %s", req.ConversationID)
		}
		if initializeConversation != nil {
			initializeConversation(ptr, req.Query)
		}
	}

	return ptr, sessionID
}

func StoreConversation(aiProvider AIProvider, ctx context.Context, aiStore types.AIStore, ptr *types.Conversation, sessionID string, req types.AIRequest) {
	if aiStore.Enabled() {
		if err := ctx.Err(); err != nil {
			log.Errorf("[Chat AI] Failed to store conversation for session ID: %s and conversation ID: %s: %v", sessionID, req.ConversationID, err)
			return
		}
		// Clean conversation by removing tool messages that are not useful for storage
		CleanConversation(ptr)
		if aiStore.ReduceWithAI() {
			if err := ctx.Err(); err != nil {
				log.Errorf("[Chat AI] Failed to store conversation for session ID: %s and conversation ID: %s: %v", sessionID, req.ConversationID, err)
				return
			}
			// Reduce the conversation with AI
			aiProvider.ReduceConversation(ctx, ptr, aiStore.ReduceThreshold())
			if err := ctx.Err(); err != nil {
				log.Errorf("[Chat AI] Failed to store conversation for session ID: %s and conversation ID: %s: %v", sessionID, req.ConversationID, err)
				return
			}
		}
		err := aiStore.SetConversation(sessionID, req.ConversationID, ptr)
		if err != nil {
			log.Errorf("[Chat AI] Failed to set conversation for session ID: %s and conversation ID: %s: %v", sessionID, req.ConversationID, err)
		}
	}
}

func SplitConversationForReduction(
	conversation []types.ConversationMessage,
	reduceThreshold int,
	keepCount int,
) (instructions []types.ConversationMessage, toSummarize []types.ConversationMessage, recentMessages []types.ConversationMessage, ok bool) {
	if len(conversation) < reduceThreshold {
		return nil, nil, nil, false
	}

	anchorCount := 0
	for i, msg := range conversation {
		if i >= 2 || msg.Role != "system" {
			break
		}
		anchorCount++
	}

	if len(conversation)-anchorCount <= keepCount {
		return nil, nil, nil, false
	}

	splitPoint := len(conversation) - keepCount
	return conversation[:anchorCount], conversation[anchorCount:splitPoint], conversation[splitPoint:], true
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

// ResolveProviderEndpoint returns the effective base URL for a model.
// It prefers the model-level endpoint and falls back to the provider-level
// endpoint when the model does not define one.  An empty string is returned
// when neither specifies an endpoint; callers that require one (e.g. Azure)
// are responsible for producing an appropriate error.
func ResolveProviderEndpoint(provider *config.ProviderConfig, model *config.AIModel) string {
	if model.Endpoint != "" {
		return model.Endpoint
	}
	return provider.Endpoint
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
