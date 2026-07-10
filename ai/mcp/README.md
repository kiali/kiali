# MCP Tools Documentation

This directory contains the Model Context Protocol (MCP) tools that enable the Kiali AI Assistant to interact with the service mesh, Kubernetes resources, and Istio configuration. These tools are called by the AI model to gather information, perform actions, and provide navigation capabilities.

## Table of Contents

- [Overview](#overview)
- [Token Consumption](#token-consumption)
- [Multicluster token consumption](#multicluster-token-consumption)
- [Available Tools](#available-tools)
  - [get_action_ui](#1-get_action_ui)
  - [get_referenced_docs](#2-get_referenced_docs)
  - [get_logs](#3-get_logs)
  - [get_mesh_status](#4-get_mesh_status)
  - [get_mesh_traffic_graph](#5-get_mesh_traffic_graph)
  - [list_traces](#6-list_traces)
  - [get_trace_details](#7-get_trace_details)
  - [get_metrics](#8-get_metrics)
  - [get_pod_performance](#9-get_pod_performance)
  - [list_or_get_resources](#10-list_or_get_resources)
  - [manage_istio_config_read](#11-manage_istio_config_read)
  - [manage_istio_config](#12-manage_istio_config)
- [Tool Definitions (YAML)](#tool-definitions-yaml)
- [Tool Execution Flow](#tool-execution-flow)
  - [ExcludedToolNames](#excludedtoolnames)
- [Response Format](#response-format)
- [Usage in AI Conversations](#usage-in-ai-conversations)
- [Adding New Tools](#adding-new-tools)

## Overview

MCP tools are functions that the AI can call to:
- Retrieve service mesh topology, health, and traffic data
- List and inspect Kubernetes resources (services, workloads, apps, namespaces)
- Manage Istio configuration objects (create, patch, delete)
- Get logs, metrics, traces, and pod performance data
- Check mesh-wide status (control plane, observability stack, connectivity)
- Generate navigation actions for the Kiali UI
- Find relevant documentation referenced_docs

All tools accept a `*mcputil.KialiInterface` struct and a `map[string]interface{}` of arguments. Tool definitions live in YAML files under `ai/mcp/tools/`.

## Available Tools

### 1. `get_action_ui`

Generates navigation actions for the Kiali UI. The AI calls this tool whenever the user asks to navigate, view, show, or open a resource.

**Parameters**:
- `resourceType` (string, required): The view category — `"service"`, `"workload"`, `"app"`, `"istio"`, `"graph"`, `"overview"`, or `"namespaces"`.
- `namespaces` (string, optional): Comma-separated list of namespaces. If empty, uses all accessible namespaces.
- `resourceName` (string, optional): Specific resource name for detail views. Leave empty for list views.
- `graph` (string, optional): Required only if `resourceType` is `"graph"`. Values: `"mesh"` or `"traffic"`.
- `graphType` (string, optional): Graph granularity — `"versionedApp"`, `"app"`, `"service"`, `"workload"`. Default: `"versionedApp"`.
- `tab` (string, optional): Tab to open for details — `"info"`, `"logs"`, `"metrics"`, `"in_metrics"`, `"out_metrics"`, `"traffic"`, `"traces"`, `"envoy"`. Default: `"info"`.

**Returns**: `GetActionUIResponse` with `actions` array and optional `errors`.

**Examples**:
```json
{"resourceType": "graph", "namespaces": "bookinfo", "graph": "traffic", "graphType": "versionedApp"}
{"resourceType": "service", "namespaces": "default"}
{"resourceType": "workload", "namespaces": "bookinfo", "resourceName": "reviews-v1", "tab": "metrics"}
```

---

### 2. `get_referenced_docs`

Surfaces relevant Istio/Kiali documentation links when the user asks conceptual questions or needs troubleshooting help.

**Parameters**:
- `keywords` (string, required): Comma-separated keywords extracted from the user's query.
- `domain` (string, optional): `"kiali"`, `"istio"`, or `"all"` (default).

**Returns**: Array of up to 3 `Citation` objects with `link`, `title`, and `body`.

**Examples**:
```json
{"keywords": "traffic shifting,canary", "domain": "istio"}
{"keywords": "mtls,security,authentication"}
```

---

### 3. `get_logs`

Gets logs from a Kubernetes Pod or workload. If the pod name is not found, it resolves the workload name and picks a running pod.

**Parameters**:
- `namespace` (string, required): Namespace of the pod.
- `name` (string, required): Pod name (falls back to workload name resolution).
- `workload` (string, optional): Workload name override.
- `container` (string, optional): Container name.
- `tail` (integer, optional): Number of lines from the end. Default 50, max 200.
- `severity` (string, optional): Client-side filter — `"ERROR"`, `"WARN"`, or `"ERROR,WARN"`.
- `previous` (boolean, optional): Return logs from previous terminated container.
- `clusterName` (string, optional): Cluster name.
- `format` (string, optional): `"codeblock"` (recommended) or `"plain"`.

**Example**:
```json
{"namespace": "bookinfo", "name": "reviews-v1", "tail": 100, "severity": "ERROR"}
```

---

### 4. `get_mesh_status`

Retrieves the high-level health and environment details of the Istio service mesh. Returns control plane status, data plane namespace health, observability stack health (Prometheus, Grafana, tracing), component connectivity, and critical alerts. Use this as the first diagnostic step for mesh-wide issues.

**Parameters**: None required. The tool uses the current Kiali configuration to determine the cluster and mesh.

**Returns**: Compact mesh status with:
- `components.control_plane`: Istiod nodes with cluster, name, namespace, status, version
- `components.data_plane`: Monitored namespaces with injection, ambient, and health status
- `components.observability_stack`: Health of Grafana, Prometheus, tracing (Jaeger/Tempo)
- `connectivity_graph`: Array of `{from, to, status}` connections between mesh components
- `critical_alerts`: Array of `{component, message, impact}` for unhealthy components
- `environment`: Istio version, Kiali version, trust domain, timestamp

**Example**:
```json
{}
```

---

### 5. `get_mesh_traffic_graph`

Returns a compact service-to-service traffic topology with network metrics (throughput, response time, mTLS) for the specified namespaces. The output is LLM-optimized — Cytoscape hash IDs are resolved to human-readable names and the mesh/namespace metadata is stripped.

**Parameters**:
- `namespaces` (string, required): Comma-separated list of namespaces to map.
- `graphType` (string, optional): `"versionedApp"`, `"app"`, `"service"`, `"workload"`. Default: `"versionedApp"`.
- `clusterName` (string, optional): Cluster name. Defaults to the Kiali configuration cluster.

**Returns**: `CompactGraphResponse` with:
- `graphType`, `namespaces`: Metadata
- `nodes`: Array of `{name, type, version}` — only real nodes, no box/compound nodes
- `traffic`: Array of `{source, target, protocol, throughput, responseTimeMs, mTLS, health}` — source/target are human-readable labels like `"productpage (v1)"`
- `health`: Optional `MeshHealthSummary` with overall status and per-namespace breakdown

**Example**:
```json
{"namespaces": "bookinfo", "graphType": "versionedApp"}
```

### 6. `list_traces`

Lists distributed traces for a service from the configured tracing backend (Jaeger/Tempo). Returns a **summary** (namespace, service, total_found, avg_duration_ms) and a **traces** list with id, duration_ms, spans_count, root_op, slowest_service, has_errors. Use **get_trace_details** with a trace id to get the full call hierarchy.

**Parameters** (JSON Schema uses camelCase; snake_case aliases are accepted where noted):
- `namespace` (string, required): Namespace of the service.
- `serviceName` (string, required): Service name to search traces for. Alias: `service_name`.
- `errorOnly` (boolean, optional): If true, only consider error traces. Alias: `error_only`.
- `lookbackSeconds` (integer, optional): Search window. Default 600. Aliases: `lookback_seconds`.
- `limit` (integer, optional): Max traces to return. Default 10.
- `clusterName` (string, optional): Cluster name. Alias: `cluster_name`.

**Returns**: `GetTracesListResponse` with `summary` and `traces` (list of lightweight items).

**Example**: List traces for a service
```json
{
  "namespace": "bookinfo",
  "serviceName": "reviews",
  "errorOnly": true,
  "lookbackSeconds": 900
}
```

---

### 7. `get_trace_details`

Fetches one distributed trace by id and returns a **call hierarchy** (service tree with duration, status, nested calls). Call this **after** `list_traces` using a trace `id` from the list.

**Parameters**:
- `traceId` (string, required): Trace id from the tracing backend. Alias: `trace_id`.

**Returns**: `GetTraceDetailResponse` with `traceId`, `totalMs`, and `hierarchy`.

**Example**:
```json
{"traceId": "1a2b3c4d5e6f7890"}
```

---

### 8. `get_metrics`

Returns Istio/Envoy metrics for a specific resource.

**Parameters**:
- `resourceType` (string, required): `"service"`, `"workload"`, or `"app"`.
- `namespace` (string, required): Namespace.
- `resourceName` (string, required): Resource name.
- `direction` (string, optional): `"inbound"` or `"outbound"`. Default: `"outbound"`.
- `reporter` (string, optional): `"source"`, `"destination"`, or `"both"`. Default: `"source"`.
- `rateInterval` (string, optional): Rate interval. Default: `"10m"`.
- `step` (string, optional): Step between data points in seconds. Default: `"15"`.
- `requestProtocol` (string, optional): `"http"` or `"grpc"`.
- `quantiles` (string, optional): Comma-separated quantiles. Default: `"0.5,0.95,0.99,0.999"`.
- `byLabels` (string, optional): Comma-separated labels to group by.
- `clusterName` (string, optional): Cluster name.

**Example**:
```json
{"resourceType": "service", "namespace": "bookinfo", "resourceName": "reviews", "direction": "inbound", "rateInterval": "5m"}
```

---

### 9. `get_pod_performance`

Returns a human-readable summary of Pod CPU/memory usage (from Prometheus) compared to Kubernetes requests/limits.

**Parameters**:
- `namespace` (string, required): Namespace.
- `podName` (string, optional): Pod name.
- `workloadName` (string, optional): Workload name (resolves to a pod).
- `timeRange` (string, optional): Time window for CPU rate. Default: `"10m"`.
- `queryTime` (string, optional): End timestamp (RFC3339). Default: now.
- `clusterName` (string, optional): Cluster name.

**Example**:
```json
{"namespace": "bookinfo", "workloadName": "reviews-v1", "timeRange": "10m"}
```

---

### 10. `list_or_get_resources`

Unified tool to list or get details for services, workloads, apps, namespaces, and ArgoCD applications. If `resourceName` is omitted, returns a compact list. If provided, returns detailed information for that specific resource.

**Parameters**:
- `resourceType` (string, required): `"service"`, `"workload"`, `"app"`, `"namespace"`, or `"argoapp"` (ArgoCD).
- `namespaces` (string, optional): Comma-separated namespaces. If empty, queries all accessible namespaces.
- `resourceName` (string, optional): If provided, returns detail view. If empty, returns list view.
- `clusterName` (string, optional): Cluster name. Defaults to the Kiali configuration cluster.

**Returns (list mode)**:
- **Services/Workloads**: `map[cluster][]ResourceListItem` with `name`, `namespace`, `health`, `configuration`, `details`, `labels`, `type` (workloads only).
- **Apps**: `AppListResponse` with `cluster` at root, `applications` array with `name`, `namespace`, `health`, `istio` status, `versions`, `istioReferences`.
- **Namespaces**: `NamespaceListResponse` with `cluster` at root, `namespaces` array with `name`, `injection`, `health`, `counts`, `validations` (omitted when zero).
- **ArgoCD Apps**: `ArgoCDAppListResponse` with `cluster` at root, `applications` array with `name`, `namespace`, `health`, `syncStatus`, `repoURL`.

**Returns (detail mode)**:
- **Services**: `ServiceDetailResponse` with service info, istio config, workloads, endpoints, health status, inbound success rate.
- **Workloads**: `WorkloadDetailResponse` with workload info, replica status, traffic success rates, istio mode/proxy version/sync status, pods, associated services.
- **Apps**: `AppDetailResponse` with app name, services, istio context, workloads with versions.
- **Namespaces**: `NamespaceDetailResponse` with istio context (injection, discovery, revision) and resource counts.
- **ArgoCD Apps**: `ArgoCDAppDetailResponse` with source, destination, sync status, health, managed resources, revision history, operation state.

> **RBAC Requirement**: The `argoapp` resource type queries ArgoCD `Application` CRDs (`applications.argoproj.io`) using a Kubernetes dynamic client. The **Kiali Service Account must have `get` and `list` permissions** on `applications.argoproj.io` in the relevant namespaces (or cluster-wide). Without these permissions, queries will return a permission-denied error. See [ArgoCD RBAC Setup](#argocd-rbac-setup) below.

**Examples**:
```json
{"resourceType": "service", "namespaces": "bookinfo"}
{"resourceType": "workload", "namespaces": "bookinfo", "resourceName": "reviews-v1"}
{"resourceType": "namespace"}
{"resourceType": "namespace", "resourceName": "bookinfo"}
{"resourceType": "app", "namespaces": "bookinfo", "resourceName": "productpage"}
{"resourceType": "argoapp", "namespaces": "argocd"}
{"resourceType": "argoapp", "namespaces": "argocd", "resourceName": "guestbook"}
```

---

### 11. `manage_istio_config_read`

Read-only: list or get Istio configuration objects.

**Parameters**:
- `action` (string, required): `"list"` or `"get"`.
- `namespace` (string, optional for list, required for get): Namespace.
- `group`, `version`, `kind` (required for get): API group/version/kind.
- `object` (string, required for get): Object name.
- `serviceName` (string, optional): Filter by service (list only).
- `clusterName` (string, optional): Cluster name.

**Examples**:
```json
{"action": "list", "namespace": "bookinfo"}
{"action": "get", "namespace": "bookinfo", "group": "networking.istio.io", "version": "v1", "kind": "VirtualService", "object": "reviews"}
```

---

### 12. `manage_istio_config`

Create, patch, or delete Istio configuration. Always use `confirmed: false` first for a preview, then `confirmed: true` after user confirmation.

**Parameters**:
- `action` (string, required): `"create"`, `"patch"`, or `"delete"`.
- `confirmed` (boolean, required): `false` for preview, `true` to execute.
- `namespace` (string, required): Namespace.
- `group` (string, required): API group (e.g. `"networking.istio.io"`).
- `version` (string, required): API version (e.g. `"v1"`).
- `kind` (string, required): Kind (e.g. `"VirtualService"`, `"DestinationRule"`).
- `object` (string, required): Object name.
- `data` (string, required for create/patch): Complete JSON or YAML manifest.
- `dataFormat` (string, optional): `"auto"`, `"json"`, or `"yaml"`.
- `clusterName` (string, optional): Cluster name.

**Example**:
```json
{
  "action": "create",
  "confirmed": false,
  "namespace": "bookinfo",
  "group": "networking.istio.io",
  "version": "v1",
  "kind": "DestinationRule",
  "object": "reviews",
  "data": "apiVersion: networking.istio.io/v1\nkind: DestinationRule\nmetadata:\n  name: reviews\nspec:\n  host: reviews\n  trafficPolicy:\n    loadBalancer:\n      simple: LEAST_CONN\n"
}
```

---

## ArgoCD RBAC Setup

To use the `argoapp` resource type in `list_or_get_resources`, the Kiali Service Account needs read access to ArgoCD Application CRDs. Create a `ClusterRole` and `ClusterRoleBinding` (or namespace-scoped `Role`/`RoleBinding` if ArgoCD applications are limited to specific namespaces):

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: kiali-argocd-reader
rules:
- apiGroups: ["argoproj.io"]
  resources: ["applications"]
  verbs: ["get", "list"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: kiali-argocd-reader
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: kiali-argocd-reader
subjects:
- kind: ServiceAccount
  name: kiali
  namespace: kiali  # adjust to your Kiali namespace
```

Without these permissions, the AI assistant will return a message indicating that ArgoCD Application resources could not be queried.

---

## Tool Definitions (YAML)

Tool definitions are described in YAML files under `ai/mcp/tools/`. Each file defines a single tool (or a list with exactly one tool). The loader reads all `*.yaml`/`*.yml` files and registers them by name.

**Schema**:
- `name`: Tool name, must match the switch case in `ToolDef.Call` in `mcp_tools.go`.
- `description`: Description sent to the AI model. Should instruct the model when and how to use the tool.
- `toolset`: List of handler sets — `default` (chatbot UI), `mcp` (full MCP endpoint). A tool can be in one or both.
- `input_schema`: JSON Schema object describing the tool parameters.

**Example**:
```yaml
- name: "list_or_get_resources"
  description: "Fetches a list of resources OR retrieves detailed data for a specific resource."
  toolset: [default, mcp]
  input_schema:
    type: "object"
    required: ["resourceType"]
    properties:
      resourceType:
        type: "string"
        description: "The type of resource to query."
        enum: ["service", "workload", "app", "namespace", "argoapp"]
      namespaces:
        type: "string"
        description: "Comma-separated list of namespaces to query."
```

## Tool Execution Flow

Tools are loaded via `mcp.LoadTools()` and exposed to providers as tool definitions. Execution is routed by name in `ToolDef.Call`, which receives a `*mcputil.KialiInterface` (bundling the HTTP request, business layer, cache, config, and all service clients) and the tool arguments.

### ExcludedToolNames

`ExcludedToolNames` defines tools that **return UI actions or referenced_docs only**. For these tools, the AI does not interpret the result — the UI consumes the `actions` or `referenced_docs` directly. The AI response includes only an acknowledgment so the conversation can continue.

Current excluded tools: `get_action_ui`, `get_referenced_docs`.

## Response Format

All tools return:
- **Success**: Tool-specific response object + HTTP `200`
- **Error**: Error message string + appropriate HTTP status code (`400`, `403`, `404`, `500`)

Tool responses for `list_or_get_resources` and `get_mesh_traffic_graph` are **compact/LLM-optimized** — raw Kubernetes/Istio model objects are transformed to reduce token usage by 75-90%.

## Usage in AI Conversations

The AI model calls tools based on user queries:
- Navigate/show/view → `get_action_ui`
- Documentation/how-to → `get_referenced_docs`
- Pod logs → `get_logs`
- Mesh health/status/versions → `get_mesh_status`
- Traffic topology/dependencies → `get_mesh_traffic_graph`
- Resource metrics → `get_metrics`
- CPU/memory analysis → `get_pod_performance`
- Distributed traces (list) → `list_traces`; drill-down by id → `get_trace_details`
- List/detail resources → `list_or_get_resources`
- List accessible clusters → `list_clusters`
- List/get Istio config → `manage_istio_config_read`
- Create/patch/delete Istio config → `manage_istio_config`

## Adding New Tools

1. Add a YAML definition in `ai/mcp/tools/<tool_name>.yaml`.
2. Implement the tool in `ai/mcp/<tool_name>/` with an `Execute(ki *mcputil.KialiInterface, args map[string]interface{}) (interface{}, int)` function.
3. Add a switch case in `ToolDef.Call` in `mcp_tools.go`.
4. If the tool only emits UI actions/referenced_docs, add the name to `ExcludedToolNames`.

See existing tools for end-to-end examples.


# Token Consumption
<!-- TOKENS-CONSUMPTION-START -->

### Evaluation Summary

| Metric | Value |
|--------|-------|
| Tasks Passed | 22/22 (100%) |
| Assertions Pass Rate | 100% |
| Total Tokens Estimate | 78089 |
| MCP Schema Tokens | 55946 |

### Per-Task Breakdown

| Task | Tokens Estimate | MCP Schema Tokens | Passed |
|------|----------------:|------------------:|--------|
| Create Istio Gateway | 3030 | 2543 | ✅ |
| Remove Fault Injection | 6871 | 2543 | ✅ |
| List and Validate VirtualServices | 2666 | 2543 | ✅ |
| List Comprehensive Istio Configuration | 2802 | 2543 | ✅ |
| List and Validate DestinationRules | 2681 | 2543 | ✅ |
| Update Traffic Shifting | 5904 | 2543 | ✅ |
| Analyze Service Traffic Volume | 2693 | 2543 | ✅ |
| Analyze Workload Response Times | 2708 | 2543 | ✅ |
| Identify Degraded Namespaces | 2949 | 2543 | ✅ |
| List Mesh-Enabled Namespaces | 2949 | 2543 | ✅ |
| Inspect Service Details | 4489 | 2543 | ✅ |
| Inspect Workload Details | 2831 | 2543 | ✅ |
| Inventory Namespace Services | 2953 | 2543 | ✅ |
| Inventory Workloads with Sidecar Status | 3269 | 2543 | ✅ |
| Comprehensive Mesh Health Audit | 2949 | 2543 | ✅ |
| Visualize Namespace Traffic | 3450 | 2543 | ✅ |
| Audit Control Plane Connectivity | 2949 | 2543 | ✅ |
| Visualize Cross-Namespace Traffic | 3556 | 2543 | ✅ |
| Visualize Workload-Level Topology | 3500 | 2543 | ✅ |
| Debug Service Errors via Logs | 4862 | 2543 | ✅ |
| Analyze Latency with Distributed Tracing | 4916 | 2543 | ✅ |
| Retrieve Recent Workload Logs | 3112 | 2543 | ✅ |
<!-- TOKENS-CONSUMPTION-END -->

## Multicluster token consumption

Results from the **multicluster** mcpchecker job (`tests/evals/gemini/eval-multicluster.yaml`). Updated automatically when `tests/evals/results/mcpchecker-gemini-multicluster-eval-out.json` exists (for example after a successful baseline run on `master`).

<!-- TOKENS-CONSUMPTION-MULTICLUSTER-START -->

_No committed multicluster baseline yet. Run MCP-Checker Evaluation on `master` (manual workflow dispatch) to populate this section._

<!-- TOKENS-CONSUMPTION-MULTICLUSTER-END -->

## MCP evaluation (CI)

The repository runs [mcpchecker](https://github.com/mcpchecker/mcpchecker) in GitHub Actions against:

1. A **single-cluster** Kind environment with Istio and Kiali (`hack/run-integration-tests.sh --test-suite backend --setup-only true`)
2. A **primary-remote multicluster** Kind environment — same setup as Cypress multicluster tests (`hack/run-integration-tests.sh --test-suite frontend-primary-remote --setup-only true`; Jaeger tracing, no Tempo)

Multicluster-specific tasks (for example `list_clusters` and tools using `clusterName`) live under `tests/evals/tasks-multicluster/` and run only in the second job. This is separate from unit/integration tests: it uses an LLM agent and costs API usage.

### Multicluster evaluation tasks

Primary-remote setup uses Kind clusters **east** (home, where Kiali runs) and **west** (remote). Bookinfo is split: productpage and most workloads on east; reviews versions (v1–v3) on west.

| Task | MCP tools exercised | What it validates |
|------|---------------------|-------------------|
| Discover Accessible Clusters | `list_clusters` | Returns east/west and marks the home cluster |
| Inspect Remote Cluster Workload | `list_clusters`, `list_or_get_resources` | Workload detail with `clusterName=west` |
| Visualize West Cluster Traffic | `get_mesh_traffic_graph` | Traffic graph scoped to west |
| Analyze Remote Service Metrics | `get_metrics` | Inbound metrics for reviews on west |
| List Remote Cluster Traces | `list_traces` | Traces for reviews on west (Jaeger, same as frontend-primary-remote CI) |
| Audit Multicluster Mesh Health | `get_mesh_status` | Control/data plane health across clusters |

Task definitions: `tests/evals/tasks-multicluster/*/`.

### Running multicluster evals locally

```bash
# 1. Build and set up primary-remote Kind + Kiali (same suite as Cypress multicluster tests)
make build-ui build
hack/run-integration-tests.sh --test-suite frontend-primary-remote --setup-only true

# 2. Install eval tooling and start kubernetes-mcp-server
make mcp-install-tools mcp-start-server

# 3. Run multicluster eval (requires GEMINI_API_KEY)
export GEMINI_API_KEY=...
make mcp-run-eval-multicluster
make mcp-eval-summary MCP_EVAL_RESULTS=tests/evals/results/mcpchecker-gemini-multicluster-eval-out.json

# 4. Stop MCP server when done
make mcp-stop-server
```

### How to trigger the workflow

1. **On a pull request** — Comment `/run-mcpchecker` on the PR. Only collaborators with **write** or **admin** permission on the repository can trigger it. When the run completes, the **mcpchecker MCP Evaluation - Report** workflow posts a results comment on the same PR.

2. **Manually** — In GitHub: **Actions** → workflow **mcpchecker MCP Evaluation** → **Run workflow**. Pick the branch and optionally enable **verbose** output.

### Requirements

- Configure the **`GEMINI_API_KEY`** repository secret. Eval configuration lives under `tests/evals/`:
  - Single-cluster: `tests/evals/gemini/eval.yaml`
  - Multicluster: `tests/evals/gemini/eval-multicluster.yaml`

### Where it is defined

| Piece | Location |
|-------|----------|
| Main workflow | `.github/workflows/mcpchecker.yml` |
| Single-cluster eval config | `tests/evals/gemini/eval.yaml` |
| Multicluster eval config | `tests/evals/gemini/eval-multicluster.yaml` |
| Multicluster tasks | `tests/evals/tasks-multicluster/` |
| PR results comment | `.github/workflows/mcpchecker.yml` (`post-pr-eval-report` job) |
| Make targets (install, run eval, token summary) | `make/Makefile.mcp.mk` |
| Multicluster local setup | `hack/run-integration-tests.sh --test-suite frontend-primary-remote --setup-only true` |
| Multicluster eval run | `make mcp-run-eval-multicluster` |

### Token baseline

Successful runs that are **not** tied to a PR comment trigger (for example a manual run on `master`) can update the committed eval baselines via the **Update Token Baseline** job: it refreshes `tests/evals/results/mcpchecker-gemini-eval-out.json`, `tests/evals/results/mcpchecker-gemini-multicluster-eval-out.json`, and the [Token Consumption](#token-consumption) and [Multicluster token consumption](#multicluster-token-consumption) sections (through `hack/mcp/update-token-readme.sh`) and may open an automated PR.

