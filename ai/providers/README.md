# AI Providers

Kiali AI providers are configured under `chat_ai.providers` in `config/config.go`.
Each provider defines a `type`, a `config` mode, a default model, and a list of
models with credentials. Only enabled providers/models are used.

## Available providers

- [OpenAI (`type: openai`)](#openai-type-openai)
- [Google GenAI (`type: google`)](#google-genai-type-google)

### OpenAI (`type: openai`)

The OpenAI provider uses the OpenAI-compatible chat completion API via the
`openai-go` client. It supports three configuration modes via `config`:

- `default`: Standard OpenAI-compatible API (OpenAI, local gateways, etc.).
- `gemini`: Google Gemini via OpenAI-compatible endpoint.
- `azure`: Azure OpenAI.

#### Shared fields

These fields apply to all OpenAI config modes:

- `providers[].name`: Unique provider name (also used in secrets mount names).
- `providers[].enabled`: Enable/disable the provider.
- `providers[].default_model`: Name of the default model for this provider.
- `providers[].key`: API key for all models, unless a model overrides it.
- `providers[].models[]`:
  - `name`: Model alias used in requests.
  - `model`: Provider-specific model identifier (sent to the API).
  - `enabled`: Enable/disable the model.
  - `endpoint`: Optional base URL override (required for Azure).
  - `key`: Optional per-model key override.

#### Config mode: `default`

Use this for OpenAI or any OpenAI-compatible endpoint.

```yaml
chat_ai:
  enabled: true
  default_provider: openai-default
  providers:
  - name: openai-default
    type: openai
    config: default
    enabled: true
    default_model: gpt-4o-mini
    key: "secret:my-ai-keys:openai"
    models:
    - name: gpt-4o-mini
      model: gpt-4o-mini
      enabled: true
      # endpoint: "https://api.openai.com/v1" # optional override
```

#### Config mode: `gemini`

Use this for Google Gemini through its OpenAI-compatible endpoint. If `endpoint`
is omitted, Kiali defaults to:
`https://generativelanguage.googleapis.com/v1beta/openai`.

```yaml
chat_ai:
  enabled: true
  default_provider: gemini
  providers:
  - name: gemini
    type: openai
    config: gemini
    enabled: true
    default_model: gemini-pro
    key: "secret:my-ai-keys:gemini"
    models:
    - name: gemini-pro
      model: gemini-2.5-pro
      enabled: true
      # endpoint: "https://generativelanguage.googleapis.com/v1beta/openai"
```

### Google GenAI (`type: google`)

The Google provider uses the `google.golang.org/genai` client with the Gemini API.
It supports the `default` and `gemini` config modes (both map to Gemini).

#### Shared fields

These fields apply to the Google provider:

- `providers[].name`: Unique provider name (also used in secrets mount names).
- `providers[].enabled`: Enable/disable the provider.
- `providers[].default_model`: Name of the default model for this provider.
- `providers[].key`: API key for all models, unless a model overrides it.
- `providers[].models[]`:
  - `name`: Model alias used in requests.
  - `model`: Provider-specific model identifier (sent to the API).
  - `enabled`: Enable/disable the model.
  - `key`: Optional per-model key override.

#### Config mode: `gemini` (or `default`)

```yaml
chat_ai:
  enabled: true
  default_provider: google-gemini
  providers:
  - name: google-gemini
    type: google
    config: gemini
    enabled: true
    default_model: gemini-pro
    key: "secret:my-ai-keys:google-gemini"
    models:
    - name: gemini-pro
      model: gemini-2.5-pro
      enabled: true
```

#### Config mode: `azure`

Use this for Azure OpenAI. `endpoint` is required and must include the Azure
resource endpoint. The SDK uses API version `2024-06-01`.

```yaml
chat_ai:
  enabled: true
  default_provider: azure-openai
  providers:
  - name: azure-openai
    type: openai
    config: azure
    enabled: true
    default_model: gpt-4o
    models:
    - name: gpt-4o
      model: gpt-4o
      enabled: true
      endpoint: "https://<resource-name>.openai.azure.com"
      key: "secret:my-ai-keys:azure-openai"
```

## Credentials and secrets

Keys can be set inline or via secrets. The secret reference format is
`secret:<secret-name>:<key-in-secret>`. Provider keys are used by default, and
model keys override provider keys when set.

Only secrets referenced by enabled providers/models are mounted automatically by
the Operator and Helm charts.