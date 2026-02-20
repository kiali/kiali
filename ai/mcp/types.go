package mcp

import (
	"github.com/kiali/kiali/ai/mcp/get_action_ui"
	"github.com/kiali/kiali/ai/types"
)

type ToolDef struct {
	Name        string                 `yaml:"name"`
	Description string                 `yaml:"description"`
	InputSchema map[string]interface{} `yaml:"input_schema"` // Raw JSON schema
}

type ToolCallResult struct {
	Message             types.ConversationMessage
	Error               error
	Code                int
	Actions             []get_action_ui.Action
	ReferencedDocuments []types.ReferencedDocument
}

type ToolsProcessor struct {
	Args       map[string]any
	Name       string
	ToolCallID string
}
