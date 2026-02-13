# Kiali AI

This package provides the Kiali AI Assistant backend. It wires the chat provider, tool execution, and optional conversation storage so the UI can answer questions, navigate Kiali, and manage Istio resources.

## Table of contents

- [High-level flow](#high-level-flow)
- [Configuration summary](#configuration-summary)
- [Configuring providers and models](#configuring-providers-and-models)
  - [Top-level chat_ai keys](#top-level-chat_ai-keys)
  - [Provider keys (providers[])](#provider-keys-providers)
  - [Model keys (providers[].models[])](#model-keys-providersmodels)
  - [Store config keys (store_config)](#store-config-keys-store_config)
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

```yaml
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
```

Notes:

* Model keys override provider keys if both are set.
* `endpoint` is required for the `azure` config and optional for others.
* Provider and model names are used in secret volume names; avoid special characters.

## Configuring providers and models

Reference for every configuration key under `chat_ai`, with type, allowed values, and description.

### Top-level chat_ai keys

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `enabled` | boolean | `false` | Turns the AI assistant on or off. When `true`, `default_provider` is required. |
| `default_provider` | string | `""` | Name of the provider to use when the UI does not specify one. Must match a provider `name` and that provider must be enabled. |
| `providers` | array | `[]` | List of provider definitions. Each entry has the keys described in [Provider keys](#provider-keys-providers). |
| `store_config` | object | (see below) | Optional conversation storage settings. Keys are described in [Store config keys](#store-config-keys-store_config). |

### Provider keys (providers[])

| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `name` | string | yes | Unique identifier for the provider. Used in API requests and in secret volume names; avoid special characters. |
| `type` | string | yes* | Backend to use. Values: `openai`, `google`. Empty defaults to `openai`. |
| `config` | string | yes* | Mode for this provider. For `type: openai`: `default`, `azure`, or `gemini`. For `type: google`: `default` or `gemini` (both use Gemini). Empty is defaulted per type. |
| `enabled` | boolean | no | Enable or disable this provider. Defaults to `true`. Disabled providers are ignored. |
| `default_model` | string | yes | Name of the default model for this provider. Must match a model `name` in `models` and that model must be enabled. |
| `description` | string | no | Human-readable description of the provider (e.g. for UI). |
| `key` | string | conditional | API key for all models in this provider. Inline value or `secret:<secret-name>:<key-in-secret>`. Required if no model has a `key`. |
| `models` | array | yes | List of models. Each entry has the keys described in [Model keys](#model-keys-providersmodels). |

### Model keys (providers[].models[])

| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `name` | string | yes | Alias used in requests (e.g. when the UI selects a model). Used in secret volume names; avoid special characters. |
| `model` | string | yes | Provider-specific model ID sent to the API (e.g. `gpt-4o-mini`, `gemini-2.5-pro`). |
| `enabled` | boolean | no | Enable or disable this model. Defaults to `true`. Disabled models are ignored. |
| `description` | string | no | Human-readable description of the model (e.g. for UI). |
| `endpoint` | string | conditional | Base URL for the API. Required for `config: azure`. Optional for `openai`/`gemini` (e.g. override for OpenAI or Gemini endpoint). Not used for `type: google`. |
| `key` | string | conditional | Per-model API key. Overrides the provider `key` when set. Inline value or `secret:<secret-name>:<key-in-secret>`. Required when the provider has no `key`. |

### Store config keys (store_config)

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `enabled` | boolean | `true` | Enable or disable the AI store. When enabled, conversation context is kept across requests. |
| `max_cache_memory_mb` | integer | `1024` | Maximum memory (MB) for all stored conversations. Oldest conversations are pruned when the limit is reached. |
| `reduce_with_ai` | boolean | `false` | If `true`, long conversations are summarized using the configured AI provider when reduced; if `false`, older messages are dropped. |
| `reduce_threshold` | integer | `15` | When a conversation reaches this number of messages, it is reduced (by summarization or truncation depending on `reduce_with_ai`). |

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

The AI store keeps conversation context (enabled by default). When limits are reached, older conversations are pruned. For all `store_config` keys, values, and descriptions, see [Store config keys](#store-config-keys-store_config). For design and behavior details, see [AI STORE README](../design/KEPS/ai-store/proposal.md).

