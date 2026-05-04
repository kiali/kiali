package mcp

import (
	"github.com/kiali/kiali/ai/mcp/get_action_ui"
	"github.com/kiali/kiali/ai/types"
)

// HeaderKialiUI is the HTTP header the Kiali browser UI sets on POST /api/chat/mcp/{tool}.
// When non-empty, ChatMCP uses DefaultToolHandlers and sets mcp_mode false for tools that branch on it.
const HeaderKialiUI = "Kiali-UI"

type ToolDef struct {
	Name        string                 `yaml:"name"`
	Description string                 `yaml:"description"`
	InputSchema map[string]interface{} `yaml:"input_schema"` // Raw JSON schema
	// Toolset: which handler set(s) this tool belongs to. Values: "default" (chatbot UI / HeaderKialiUI on /api/chat/mcp), "mcp" (full MCP).
	// A tool can be in one or both sets. Example: toolset: [default, mcp]
	Toolset []string `yaml:"toolset"`
}

type ToolCallResult struct {
	Message        types.ConversationMessage
	Error          error
	Code           int
	Actions        []get_action_ui.Action
	ReferencedDocs []types.ReferencedDoc
}

type ToolsProcessor struct {
	Args       map[string]any
	Name       string
	ToolCallID string
}
