package tools

import (
	"context"
	"errors"

	openai "github.com/sashabaranov/go-openai"

	"github.com/kiali/kiali/models"
)

// NamespaceProvider exposes the minimal capability needed by this tool: listing namespaces.
type NamespaceProvider interface {
	GetNamespaces(ctx context.Context) ([]models.Namespace, error)
}

// NamespacesTool implements the ToolHandler for fetching namespaces.
type NamespacesTool struct {
	provider NamespaceProvider
}

func NewNamespacesTool(provider NamespaceProvider) NamespacesTool {
	return NamespacesTool{provider: provider}
}

func (t NamespacesTool) Definition() openai.Tool {
	return openai.Tool{
		Type: openai.ToolTypeFunction,
		Function: &openai.FunctionDefinition{
			Name:        "get_namespaces",
			Description: "Returns the namespaces of your current context, including those you may not have access to.",
		},
	}
}

func (t NamespacesTool) Call(ctx context.Context, args map[string]interface{}) (interface{}, error) {
	namespaces, err := t.provider.GetNamespaces(ctx)
	if err != nil {
		return nil, errors.New("failed to get namespaces")
	}

	return namespaces, nil
}