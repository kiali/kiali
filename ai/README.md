# Kiali AI

This package provides the Kiali AI Assistant backend. It wires the chat provider, tool execution, and optional conversation storage so the UI can answer questions, navigate Kiali, and manage Istio resources.

## High-level flow

1. The UI sends a chat request with a model name and context.
2. `ai.NewAIProvider` selects a model from `chat_ai` configuration.
3. The provider sends the conversation to the model and exposes MCP tools.
4. Tool results (actions, citations, data) are combined into the final response.
5. If AI store is enabled, the conversation is saved and can be reduced.

## Configuration summary

AI is configured under `chat_ai` in `config/config.go`. Key fields:

- `enabled`: Enables/disables the AI assistant.
- `default_provider`: The provider name to use by default.
- `providers`: List of providers, each with type/config, models, and keys.
- `store_config`: Optional conversation storage settings.

Validation rules are enforced in `Config.ValidateAI()`. Disabled providers/models are ignored during validation, but defaults must exist and be enabled.

### API Key Configuration

Provider and model API keys can be configured in two ways:

1. **Inline key** (not recommended for production):
   ```yaml
   chat_ai:
     providers:
     - name: my-provider
       key: "sk-abc123..."
   ```

2. **Secret reference** (recommended):
   ```yaml
   chat_ai:
     providers:
     - name: my-provider
       key: "secret:my-secret-name:api-key"
   ```

The secret reference syntax is `secret:<secret-name>:<key-in-secret>`. When using secret references:
- The Kiali Operator and Helm charts automatically mount the referenced secrets
- No need to configure `deployment.custom_secrets` separately
- Secrets must exist in the Kiali deployment namespace
- Only secrets for enabled providers and models are mounted

## MCP tools (summary)

The AI uses MCP tools to interact with Kiali and the mesh:

- `get_action_ui`: Builds UI navigation actions.
- `get_citations`: Finds relevant documentation links.
- `get_mesh_graph`: Returns mesh health and topology summaries.
- `get_resource_detail`: Fetches service/workload details or lists.
- `manage_istio_config`: List/get/create/patch/delete Istio objects.

For detailed tool documentation, see `ai/mcp/README.md`.

## Key files

- `provider.go`: Provider selection and model lookup.
- `providers/`: Provider implementations (OpenAI today).
- `mcp/`: MCP tool implementations and registration.
- `store.go`: Conversation storage and cleanup.
