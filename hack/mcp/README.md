# MCP Server Setup

This directory contains the deployment manifests and the [`setup-mcp.sh`](../setup-mcp.sh) script for installing a **Kubernetes or OpenShift MCP (Model Context Protocol) server** into a cluster that already has Istio and Kiali running.

The MCP server exposes Kiali's API as tools that AI assistants (e.g. OpenShift LightSpeed) can call during a conversation to inspect the service mesh.

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Script: setup-mcp.sh](#script-setup-mcpsh)
  - [Commands](#commands)
  - [Options](#options)
  - [Examples](#examples)
- [Deployment Manifests](#deployment-manifests)

---

## Prerequisites

- A running Kubernetes or OpenShift cluster with Istio installed
- Kiali deployed and running in `istio-system` (or your custom Istio namespace)
- `kubectl` or `oc` CLI available and logged in with sufficient privileges
- `envsubst` (part of `gettext`, available on most Linux distros and macOS via `brew install gettext`)

---

## Script: setup-mcp.sh

**Location:** [`hack/setup-mcp.sh`](../setup-mcp.sh)

The script automates the full MCP server lifecycle: namespace creation, RBAC, ConfigMap, Deployment, Service, and (on OpenShift) Route creation.

### Commands

| Command | Description |
|---|---|
| `install-mcp` | Install the MCP server into `<provider>-mcp` namespace |
| `uninstall-mcp` | Remove all MCP resources and delete the namespace |
| `status-mcp` | Show pods, service, ConfigMap, and endpoint |

### Options

| Flag | Default | Description |
|---|---|---|
| `-p \| --provider` | `kubernetes` | Provider to install: `kubernetes` or `openshift` |
| `-mv \| --mcp-version` | `latest` | Image tag (e.g. `v0.2.0`) |
| `-ce \| --client-exe` | `kubectl` | Path to `kubectl` or `oc` |
| `-in \| --istio-namespace` | `istio-system` | Namespace where Istio and Kiali are installed |
| `-t \| --timeout` | `300` | Seconds to wait for resources |
| `-v \| --verbose` | — | Enable debug output |

### Examples

```bash
# Install the Kubernetes MCP server (default)
./hack/setup-mcp.sh install-mcp

# Install the OpenShift MCP server
./hack/setup-mcp.sh --provider openshift install-mcp

# Install a specific version using oc
./hack/setup-mcp.sh --client-exe oc --provider openshift --mcp-version v0.2.0 install-mcp

# Check status
./hack/setup-mcp.sh status-mcp

# Uninstall
./hack/setup-mcp.sh --provider openshift uninstall-mcp
```

The installed namespace follows the pattern `<provider>-mcp` (`kubernetes-mcp` or `openshift-mcp`).
On OpenShift, a **Route** is created automatically so the MCP endpoint is reachable externally.

---

## Deployment Manifests

All templates live in [`hack/mcp/deployment/`](deployment/) and use `${VARIABLE}` placeholders substituted by `envsubst` at apply time:

| File | Description |
|---|---|
| [`deployment.yaml`](deployment/deployment.yaml) | MCP server `Deployment` |
| [`mcp_service.yaml`](deployment/mcp_service.yaml) | `Service` exposing port 8080 |
| [`service_account.yaml`](deployment/service_account.yaml) | `ServiceAccount` + `ClusterRole` + `ClusterRoleBinding` |
| [`config_kubernetes.toml`](deployment/config_kubernetes.toml) | OLS config template for the `kubernetes` provider |
| [`config_openshift.toml`](deployment/config_openshift.toml) | OLS config template for the `openshift` provider |

The config files use `${KIALI_URL}` as their only dynamic placeholder, which is substituted from `--istio-namespace` at install time.
