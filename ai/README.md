# Kiali AI

This package provides the Kiali AI Assistant backend. It wires the chat provider, tool execution, and optional conversation storage so the UI can answer questions, navigate Kiali, and manage Istio resources.

## Table of contents

- [High-level flow](#high-level-flow)
- [Configuration summary](#configuration-summary)
  - [API Key Configuration](#api-key-configuration)
- [Providers Supported](#providers-supported)
- [MCP tools (summary)](#mcp-tools-summary)
- [AI Store](#ai-store)

## High-level flow

1. The UI sends a chat request with a model name and context.
2. `ai.NewAIProvider` selects a model from `chat_ai` configuration.
3. The provider sends the conversation to the model and exposes MCP tools.
4. Tool results (actions, citations, data) are combined into the final response.
5. We recommend enabling the AI store to retain context; it can optionally reduce stored conversations with AI (see [AI Store](#ai-store)).

## Configuration summary

AI is configured under `chat_ai` in `config/config.go`. Key fields:

- `enabled`: Enables/disables the AI assistant.
- `default_provider`: The provider name to use by default.
- `providers`: List of providers, each with type/config, models, and keys.
- `store_config`: Optional conversation storage settings.

Validation rules are enforced in `Config.ValidateAI()`. Disabled providers/models are ignored during validation, but defaults must exist and be enabled.

Example configuration:

[source,yaml]
----
chat_ai:
  enabled: true
  default_provider: "openai"
  providers:
    - name: "openai"
      enabled: true
      description: "OpenAI API Provider"
      type: "openai"
      config: "default"
      default_model: "gemini"
      models:
        - name: "gemini"
          enabled: true
          model: "gemini-2.5-pro"
          description: "Model provided by Google with OpenAI API Support"
          endpoint: "https://generativelanguage.googleapis.com/v1beta/openai"
          key: "secret:my-key-secret:openai-gemini"
----

Notes:

* Model keys override provider keys if both are set.
* `endpoint` is required for the `azure` config and optional for others.
* Provider and model names are used in secret volume names; avoid special characters.

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


So, we just need create the secret containing your API key:

```shell
kubectl -n istio-system create secret generic my-key-secret --from-literal=openai-gemini=<token>
```

Then configure `chat_ai` to reference the secret. The Kiali Operator and Helm charts automatically mount secrets referenced in `chat_ai` configuration.


## Providers Supported

| Provider | Configuration |
| --- | --- |
| OpenAI | default, azure, gemini |
| Google | gemini |

## MCP tools (summary)

The AI uses MCP tools to interact with Kiali and the mesh:

- `get_action_ui`: Builds UI navigation actions.
- `get_citations`: Finds relevant documentation links.
- `get_mesh_graph`: Returns mesh health and topology summaries.
- `get_resource_detail`: Fetches service/workload details or lists.
- `manage_istio_config`: List/get/create/patch/delete Istio objects.

For detailed tool documentation, see `ai/mcp/README.md`.

## AI Store

The AI store keeps conversation context (enabled by default). When limits are reached, older conversations are pruned. See [AI STORE README](../design/KEPS/ai-store/proposal.md) for details.

```yaml
chat_ai:
  store_config:
    enabled: true
    max_cache_memory_mb: 1024
    reduce_with_ai: false
    reduce_threshold: 15
```

Property details:

- `enabled`: Turns the AI store on/off. Enable it to keep conversation context across requests.
- `max_cache_memory_mb`: Maximum total memory for all stored conversations. When reached, the oldest conversations are removed to stay under the limit.
- `reduce_threshold`: When a conversation reaches this number of messages (e.g., 15), it is reduced by about 1/4.
- `reduce_with_ai`: Controls how reduction happens. If `false`, keep the most recent messages and drop older ones; if `true`, summarize the conversation using the configured AI provider.

