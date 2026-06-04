# OpenShift LightSpeed Setup

This directory contains the deployment manifests and the [`setup-osl.sh`](./setup-osl.sh) script for installing the **OpenShift LightSpeed service API** into a CRC (CodeReady Containers) or OpenShift cluster that already has an MCP server running.

The LightSpeed service acts as the AI backend: it receives queries from Kiali, calls the configured LLM, and uses the MCP server for tool calling to inspect the live service mesh.

> **Note:** This script deploys the LightSpeed service directly (no OLM operator required). It requires `oc` — LightSpeed is OpenShift-only.

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Script: setup-osl.sh](#script-setup-oslsh)
  - [Commands](#commands)
  - [Options](#options)
  - [Examples](#examples)
- [How It Works](#how-it-works)
- [Deployment Manifests](#deployment-manifests)
- [Local Development](#local-development)

---

## Prerequisites

- An **OpenShift** cluster (CRC recommended for local development):
  - Cluster monitoring (`openshift-monitoring` pods running) is required
  - `oc` CLI available and logged in with `cluster-admin`
- An **MCP server** already running — install one with [`hack/setup-mcp.sh`](../setup-mcp.sh)
- An **OpenAI or OpenAI-compatible API key**
- `envsubst` available (part of `gettext`)

### Starting CRC with monitoring enabled

```bash
./hack/crc-openshift.sh \
  --enable-cluster-monitoring true \
  -p <path-to-pull-secret> \
  start
```

---

## Script: setup-osl.sh

**Location:** [`hack/lightspeed/setup-osl.sh`](./setup-osl.sh)

The script auto-detects which MCP variant is running (`kubernetes-mcp` or `openshift-mcp`) and refuses to proceed if no healthy MCP pod is found.

### Commands

| Command | Description |
|---|---|
| `install-lightspeed` | Detect MCP and deploy the LightSpeed service |
| `uninstall-lightspeed` | Remove all LightSpeed resources and delete the namespace |
| `status-lightspeed` | Show deployment, pods, ConfigMap, secret, NetworkPolicy, and MCP status |

### Options

| Flag | Default | Description |
|---|---|---|
| `-ot \| --openai-token` | *(required)* | OpenAI or OpenAI-compatible API token. Can also be set via `OPENAI_TOKEN` env var |
| `--llm-url` | `https://api.openai.com/v1` | Base URL of the OpenAI-compatible LLM provider |
| `--llm-model` | `gpt-5.4-nano` | Default model configured in LightSpeed |
| `-n \| --namespace` | `openshift-lightspeed` | Namespace to install LightSpeed into |
| `-i \| --image` | `quay.io/openshift-lightspeed/lightspeed-service-api:latest` | Container image to deploy |
| `-in \| --istio-namespace` | `istio-system` | Namespace where Istio and Kiali are installed |
| `-ce \| --client-exe` | `oc` | Path to `oc` (must be `oc`) |
| `-t \| --timeout` | `300` | Seconds to wait for resources |
| `-v \| --verbose` | — | Enable debug output |

### Examples

```bash
# Install (auto-detects running MCP)
./hack/lightspeed/setup-osl.sh --openai-token sk-... install-lightspeed

# Install with a custom image
./hack/lightspeed/setup-osl.sh --openai-token sk-... \
  --image quay.io/openshift-lightspeed/lightspeed-service-api:v0.2.0 \
  install-lightspeed

# Install using Gemini's OpenAI-compatible endpoint
./hack/lightspeed/setup-osl.sh --openai-token <gemini-token> \
  --llm-url https://generativelanguage.googleapis.com/v1beta/openai \
  --llm-model gemini-2.5-pro \
  install-lightspeed

# Check full status
./hack/lightspeed/setup-osl.sh status-lightspeed

# Uninstall
./hack/lightspeed/setup-osl.sh uninstall-lightspeed
```

---

## How It Works

`install-lightspeed` runs these steps in order:

1. **Validate** the API token, LLM URL, and model are set and not placeholders
2. **Discover** the running MCP server (`kubernetes-mcp` or `openshift-mcp`)
3. **Create namespace** `openshift-lightspeed` (idempotent)
4. **Create secret** `credentials` with the provider API token
5. **Create ConfigMap / OLSConfig** with the selected provider, model, MCP endpoint, and mounted credentials
6. **Create Deployment** `lightspeed-app-server` running the LightSpeed service API image
7. **Create NetworkPolicy** allowing only labelled namespaces to reach the service on port 8443
8. **Label** `istio-system` with `allow-lightspeed=true` so Kiali (running there) can connect

`uninstall-lightspeed` reverses all of the above and deletes the namespace.

---

## Deployment Manifests

All templates live in [`hack/lightspeed/deployment/`](deployment/) and use `${VARIABLE}` placeholders:

| File | Placeholders | Description |
|---|---|---|
| [`allow-policy.yaml`](deployment/allow-policy.yaml) | `${LIGHTSPEED_NAMESPACE}` | `NetworkPolicy` restricting ingress to labelled namespaces |
| [`osl_config.yaml`](deployment/osl_config.yaml) | `${MCP_PROVIDER}` `${LLM_PROVIDER_URL}` `${LLM_MODEL}` | `OLSConfig` CR for the selected OpenAI-compatible provider |

---

## Local Development

For running the LightSpeed service locally with Podman (without deploying to a cluster), see the provider-specific guide:

👉 [ai/providers/lightspeed/DEVELOPMENT.md](../../ai/providers/lightspeed/DEVELOPMENT.md)
