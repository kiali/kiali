# LightSpeed Provider — Development Setup

This guide walks you through running a full local stack for developing and testing the LightSpeed
provider integration: a Kubernetes cluster with Istio and Kiali, a Kubernetes MCP server, and
the LightSpeed service container.

## Table of Contents

- [Prerequisites](#prerequisites)
- [1. Start the Kubernetes MCP Server](#1-start-the-kubernetes-mcp-server)
- [2. Start the LightSpeed Service](#2-start-the-lightspeed-service)

## Prerequisites

- A running Kubernetes cluster with Istio and Kiali deployed (see the main
  [Kiali AGENTS.md](../../../../AGENTS.md) for cluster setup options).
- Kiali running and accessible at `http://localhost:20001/` (via `kiali run` or port-forward).
- [Node.js](https://nodejs.org/) installed (for `npx`).
- [Podman](https://podman.io/) or Docker installed (for the LightSpeed container).
- Your OpenAI API key stored in `~/.openai/openai_api_key.txt`:

  ```bash
  mkdir -p ~/.openai
  echo "sk-..." > ~/.openai/openai_api_key.txt
  ```

---

## 1. Start the Kubernetes MCP Server

The MCP server exposes Kiali's API as tools that the LightSpeed service can call during a
conversation. It must be running on port **8081** before starting LightSpeed.

From the root of the Kiali repository, run in a dedicated terminal:

```bash
npx kubernetes-mcp-server@latest --config ./hack/mcp/kubernetes-mcp-config.toml
```

The configuration file (`hack/mcp/kubernetes-mcp-config.toml`) points the MCP server at your
local Kiali instance:

```toml
toolsets = ["kiali"]
log_level = 0
port = "8081"

[toolset_configs.kiali]
url = "http://localhost:20001/"
insecure = true
```

Once started, the MCP server will be available at `http://localhost:8081/mcp`.

---

## 2. Start the LightSpeed Service

The LightSpeed service is the AI backend. It receives queries from Kiali, calls the configured
LLM, and uses the MCP server for tool calling.

> **Prerequisite:** The MCP server from step 1 must already be running on port **8081** before
> starting the container, because `dev_oslconfig.yaml` references it at
> `http://host.containers.internal:8081/mcp`.

Run the container from the root of the Kiali repository:

```bash
podman run -it --rm \
  -v ./hack/lightspeed:/app-root/config:Z \
  -v ~/.openai:/app-root/.openai:Z \
  -e OLS_CONFIG_FILE=/app-root/config/dev_oslconfig.yaml \
  -p 8080:8080 \
  quay.io/openshift-lightspeed/lightspeed-service-api:latest
```

**Volumes mounted:**

| Host path               | Container path          | Purpose                              |
|-------------------------|-------------------------|--------------------------------------|
| `./hack/lightspeed/`    | `/app-root/config/`     | Dev configuration (`dev_oslconfig.yaml`) |
| `~/.openai/`            | `/app-root/.openai/`    | OpenAI API key (`openai_api_key.txt`)    |

The service will start on `0.0.0.0:8080`. You can verify it with a quick test query:

```bash
# Non-streaming
curl -X POST 'http://127.0.0.1:8080/v1/query' \
  -H 'Content-Type: application/json' \
  -d '{"query": "List the services in the bookinfo namespace"}'

# Streaming
curl -X POST 'http://127.0.0.1:8080/v1/streaming_query' \
  -H 'Content-Type: application/json' \
  -d '{"query": "List the services in the bookinfo namespace"}'
```

---

Once both processes are running, open Kiali in your browser and select **LightSpeed** as the AI
provider in the chat panel.

For more on the LightSpeed service itself, see the upstream repository:
<https://github.com/openshift/lightspeed-service>
