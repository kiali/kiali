package tools

import (
	"context"

	openai "github.com/sashabaranov/go-openai"
)

// ToolHandler defines the contract for a tool: its definition and how to execute it.
type ToolHandler interface {
	Definition() openai.Tool
	Call(ctx context.Context, args map[string]interface{}) (interface{}, error)
}