# MCP Tools Documentation

This directory contains the Model Context Protocol (MCP) tools that enable the Kiali AI Assistant to interact with the service mesh, Kubernetes resources, and Istio configuration. These tools are called by the AI model to gather information, perform actions, and provide navigation capabilities.

## Overview

MCP tools are functions that the AI can call to:
- Retrieve service mesh topology and traffic data
- List and inspect Kubernetes resources (services, workloads, apps, namespaces)
- Manage Istio configuration objects (create, patch, delete)
- Get logs, metrics, traces, and pod performance data
- Generate navigation actions for the Kiali UI
- Find relevant documentation citations

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

### 2. `get_citations`

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

### 3. `get_mesh_traffic_graph`

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

---

### 4. `list_or_get_resources`

Unified tool to list or get details for services, workloads, apps, and namespaces. If `resourceName` is omitted, returns a compact list. If provided, returns detailed information for that specific resource.

**Parameters**:
- `resourceType` (string, required): `"service"`, `"workload"`, `"app"`, or `"namespace"`.
- `namespaces` (string, optional): Comma-separated namespaces. If empty, queries all accessible namespaces.
- `resourceName` (string, optional): If provided, returns detail view. If empty, returns list view.
- `clusterName` (string, optional): Cluster name. Defaults to the Kiali configuration cluster.

**Returns (list mode)**:
- **Services/Workloads**: `map[cluster][]ResourceListItem` with `name`, `namespace`, `health`, `configuration`, `details`, `labels`, `type` (workloads only).
- **Apps**: `AppListResponse` with `cluster` at root, `applications` array with `name`, `namespace`, `health`, `istio` status, `versions`, `istioReferences`.
- **Namespaces**: `NamespaceListResponse` with `cluster` at root, `namespaces` array with `name`, `injection`, `health`, `counts`, `validations` (omitted when zero).

**Returns (detail mode)**:
- **Services**: `ServiceDetailResponse` with service info, istio config, workloads, endpoints, health status, inbound success rate.
- **Workloads**: `WorkloadDetailResponse` with workload info, replica status, traffic success rates, istio mode/proxy version/sync status, pods, associated services.
- **Apps**: `AppDetailResponse` with app name, services, istio context, workloads with versions.
- **Namespaces**: `NamespaceDetailResponse` with istio context (injection, discovery, revision) and resource counts.

**Examples**:
```json
{"resourceType": "service", "namespaces": "bookinfo"}
{"resourceType": "workload", "namespaces": "bookinfo", "resourceName": "reviews-v1"}
{"resourceType": "namespace"}
{"resourceType": "namespace", "resourceName": "bookinfo"}
{"resourceType": "app", "namespaces": "bookinfo", "resourceName": "productpage"}
```

---

### 5. `get_logs`

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

### 6. `get_metrics`

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

### 7. `get_pod_performance`

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

### 8. `get_traces`

Fetches distributed traces from Jaeger/Tempo and summarizes bottlenecks and error spans.

**Parameters**:
- `traceId` (string, optional): Specific trace ID. If provided, namespace/service_name are ignored.
- `namespace` (string, required if no traceId): Namespace of the service.
- `serviceName` (string, required if no traceId): Service name.
- `errorOnly` (boolean, optional): Only consider error traces. Default: false.
- `lookbackSeconds` (integer, optional): Search window. Default: 600 (10 minutes).
- `limit` (integer, optional): Max traces to consider. Default: 10.
- `maxSpans` (integer, optional): Max spans per summary section. Default: 7.
- `clusterName` (string, optional): Cluster name.

**Returns**: `GetTracesResponse` with `summary.bottlenecks`, `summary.error_spans`, and `summary.error_chain`.

**Examples**:
```json
{"traceId": "0af7651916cd43dd8448eb211c80319c"}
{"namespace": "bookinfo", "serviceName": "reviews", "errorOnly": true}
```

---

### 9. `manage_istio_config_read`

Read-only: list or get Istio configuration objects.

**Parameters**:
- `action` (string, required): `"list"` or `"get"`.
- `namespace` (string, optional for list, required for get): Namespace.
- `group`, `version`, `kind` (required for get): API group/version/kind.
- `object` (string, required for get): Object name.
- `service_name` (string, optional): Filter by service (list only).
- `cluster` (string, optional): Cluster name.

**Examples**:
```json
{"action": "list", "namespace": "bookinfo"}
{"action": "get", "namespace": "bookinfo", "group": "networking.istio.io", "version": "v1", "kind": "VirtualService", "object": "reviews"}
```

---

### 10. `manage_istio_config`

Create, patch, or delete Istio configuration. Always use `confirmed: false` first for a preview, then `confirmed: true` after user confirmation.

**Parameters**:
- `action` (string, required): `"create"`, `"patch"`, or `"delete"`.
- `confirmed` (boolean, required): `false` for preview, `true` to execute.
- `namespace`, `group`, `version`, `kind`, `object` (required).
- `data` (string, required for create/patch): Complete JSON or YAML manifest.
- `data_format` (string, optional): `"auto"`, `"json"`, or `"yaml"`.
- `cluster` (string, optional): Cluster name.

**Example**:
```json
{
  "action": "create",
  "confirmed": false,
  "namespace": "bookinfo",
  "group": "networking.istio.io",
  "version": "v1",
  "kind": "DestinationRule",
  "data": "apiVersion: networking.istio.io/v1\nkind: DestinationRule\nmetadata:\n  name: reviews\nspec:\n  host: reviews\n  trafficPolicy:\n    loadBalancer:\n      simple: LEAST_CONN\n"
}
```

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
        enum: ["service", "workload", "app", "namespace"]
      namespaces:
        type: "string"
        description: "Comma-separated list of namespaces to query."
```

## Tool Execution Flow

Tools are loaded via `mcp.LoadTools()` and exposed to providers as tool definitions. Execution is routed by name in `ToolDef.Call`, which receives a `*mcputil.KialiInterface` (bundling the HTTP request, business layer, cache, config, and all service clients) and the tool arguments.

### ExcludedToolNames

`ExcludedToolNames` defines tools that **return UI actions or citations only**. For these tools, the AI does not interpret the result — the UI consumes the `actions` or `citations` directly. The AI response includes only an acknowledgment so the conversation can continue.

Current excluded tools: `get_action_ui`, `get_citations`.

## Response Format

All tools return:
- **Success**: Tool-specific response object + HTTP `200`
- **Error**: Error message string + appropriate HTTP status code (`400`, `403`, `404`, `500`)

Tool responses for `list_or_get_resources` and `get_mesh_traffic_graph` are **compact/LLM-optimized** — raw Kubernetes/Istio model objects are transformed to reduce token usage by 75-90%.

## Usage in AI Conversations

The AI model calls tools based on user queries:
- Navigate/show/view → `get_action_ui`
- Documentation/how-to → `get_citations`
- Traffic topology/dependencies → `get_mesh_traffic_graph`
- List/detail resources → `list_or_get_resources`
- Pod logs → `get_logs`
- Resource metrics → `get_metrics`
- CPU/memory analysis → `get_pod_performance`
- Distributed traces → `get_traces`
- List/get Istio config → `manage_istio_config_read`
- Create/patch/delete Istio config → `manage_istio_config`

## Adding New Tools

1. Add a YAML definition in `ai/mcp/tools/<tool_name>.yaml`.
2. Implement the tool in `ai/mcp/<tool_name>/` with an `Execute(ki *mcputil.KialiInterface, args map[string]interface{}) (interface{}, int)` function.
3. Add a switch case in `ToolDef.Call` in `mcp_tools.go`.
4. If the tool only emits UI actions/citations, add the name to `ExcludedToolNames`.

See existing tools for end-to-end examples.
