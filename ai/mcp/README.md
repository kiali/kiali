# MCP Tools Documentation

This directory contains the Model Context Protocol (MCP) tools that enable the Kiali AI Assistant to interact with the service mesh, Kubernetes resources, and Istio configuration. These tools are called by the AI model to gather information, perform actions, and provide navigation capabilities.

## Overview

MCP tools are functions that the AI can call to:
- Retrieve service mesh topology and health data
- Get Kubernetes resource information
- Manage Istio configuration objects
- Generate navigation actions for the Kiali UI
- Find relevant documentation citations

All tools implement the `ToolHandler` interface defined in `mcp_tools.go`.

## Available Tools

### 1. `get_action_ui`

Generates navigation actions for the Kiali UI. Returns buttons that users can click to navigate to specific views in the Kiali interface.

**Purpose**: Create UI navigation buttons when users request to view graphs, lists, or resource details.

**Parameters**:
- `namespaces` (string, optional): Comma-separated list of namespaces (e.g., `"bookinfo"` or `"bookinfo,default"`). If empty, uses all accessible namespaces.
- `resourceType` (string, optional): Type of resource (`"service"`, `"workload"`, `"app"`, `"istio"`, `"graph"`, or `"overview"`).
- `resourceName` (string, optional): Name of a specific resource for detail views. If empty, returns list view.
- `graph` (string, optional): Graph type - `"mesh"` for mesh graph or `"traffic"` for traffic graph. Default is `"traffic"`.
- `graphType` (string, optional): Graph aggregation type - `"versionedApp"`, `"app"`, `"service"`, or `"workload"`. Default is `"versionedApp"`.
- `tab` (string, optional): Tab to open for resource details - `"info"`, `"logs"`, `"metrics"`, `"in_metrics"`, `"out_metrics"`, `"traffic"`, `"traces"`, or `"envoy"`. Default is `"info"`.

**Returns**: `GetActionUIResponse` object with:
- `actions` (array): `Action` objects with `title`, `kind`, and `payload`
- `errors` (string): Error message, if any

**Example 1**: Show traffic graph for bookinfo namespace
```json
{
  "namespaces": "bookinfo",
  "graph": "graph",
  "graphType": "versionedApp"
}
```

**Example 2**: List all services in default namespace
```json
{
  "namespaces": "default",
  "resourceType": "service"
}
```

**Example 3**: Show details for a specific workload
```json
{
  "namespaces": "bookinfo",
  "resourceType": "workload",
  "resourceName": "reviews-v1",
  "tab": "metrics"
}
```

**Example 4**: Show mesh graph for multiple namespaces
```json
{
  "namespaces": "bookinfo,istio-system",
  "resourceType": "graph",
  "graph": "mesh"
}
```

**Example 5**: Show details for an Istio config by name
```json
{
  "namespaces": "bookinfo",
  "resourceType": "istio",
  "resourceName": "bookinfo-gateway"
}
```

When `resourceType` is `"istio"` and `resourceName` is provided, the tool returns one or more actions that match the name across Istio config kinds. The navigation payloads include API version and kind, e.g.:

`/namespaces/<namespace>/istio/<apiVersion>/<kind>/<name>`

---

### 2. `get_citations`

Searches documentation and returns relevant citation links based on keywords. Helps users find documentation related to their questions.

**Purpose**: Provide documentation links when users ask about troubleshooting, configuration, features, or need help understanding Kiali or Istio concepts.

**Parameters**:
- `keywords` (string, required): Comma-separated list of keywords to search for (e.g., `"graph empty,mtls,security"`).
- `domain` (string, optional): Filter by domain - `"kiali"` or `"istio"`. If not provided, searches all domains.

**Returns**: Array of up to 3 `Citation` objects with:
- `link` (string): URL to the documentation page
- `title` (string): Title of the documentation
- `body` (string): Description or excerpt from the documentation

**Example 1**: Search for traffic shifting documentation
```json
{
  "keywords": "traffic shifting,canary,blue green",
  "domain": "istio"
}
```

**Example 2**: Search for Kiali graph documentation
```json
{
  "keywords": "graph empty,no data,visualization",
  "domain": "kiali"
}
```

**Example 3**: Search across all domains
```json
{
  "keywords": "mtls,security,authentication"
}
```

**Example 4**: Search for troubleshooting help
```json
{
  "keywords": "error rate,503,timeout",
  "domain": "istio"
}
```

---

### 3. `get_mesh_graph`

Retrieves service mesh topology, health status, and aggregated metrics for namespaces. Provides a comprehensive overview of the mesh state.

**Purpose**: Get high-level mesh overview, health summaries, and topology data for analysis and troubleshooting.

**Parameters**:
- `namespace` (string, optional): Single namespace to include (alternative to `namespaces`).
- `namespaces` (string, optional): Comma-separated list of namespaces (e.g., `"bookinfo,default"`).
- `rateInterval` (string, optional): Time interval for metrics (e.g., `"10m"`, `"5m"`, `"1h"`). Default is `"10m"`.
- `graphType` (string, optional): Graph aggregation type - `"versionedApp"`, `"app"`, `"service"`, or `"workload"`. Default is `"versionedApp"`.
- `clusterName` (string, optional): Cluster name. Defaults to the cluster in Kiali configuration.

**Returns**: `MeshHealthSummary` object containing:
- `overallStatus` (string): Overall mesh health (`"HEALTHY"`, `"DEGRADED"`, `"UNHEALTHY"`)
- `availability` (float64): Overall availability percentage (0-100)
- `totalErrorRate` (float64): Total error rate across the mesh
- `namespaceCount` (int): Number of namespaces
- `entityCounts` (object): Health counts for apps, services, and workloads
- `namespaceSummary` (object): Per-namespace health summaries
- `topUnhealthy` (array): List of unhealthy entities
- `timestamp` (string): When the data was collected
- `rateInterval` (string): The rate interval used

**Example 1**: Get mesh overview for bookinfo namespace
```json
{
  "namespace": "bookinfo",
  "rateInterval": "10m",
  "graphType": "versionedApp"
}
```

**Example 2**: Get mesh health for multiple namespaces
```json
{
  "namespaces": "bookinfo,default,istio-system",
  "rateInterval": "5m"
}
```

**Example 3**: Get service-level graph
```json
{
  "namespaces": "bookinfo",
  "graphType": "service",
  "rateInterval": "1h"
}
```

**Example 4**: Get mesh overview for specific cluster
```json
{
  "namespaces": "bookinfo",
  "clusterName": "cluster1",
  "rateInterval": "10m"
}
```

---

### 4. `get_resource_detail`

Retrieves detailed information or lists of Kubernetes resources (services, workloads) within the service mesh.

**Purpose**: Get specific resource information for analysis, troubleshooting, or display.

**Parameters**:
- `resource_type` (string, required): Type of resource - `"service"` or `"workload"`.
- `namespaces` (string, optional): Comma-separated list of namespaces (e.g., `"bookinfo,default"`). If not provided, lists from all accessible namespaces.
- `resource_name` (string, optional): Name of a specific resource. If provided, returns details; if empty, returns list.
- `cluster_name` (string, optional): Cluster name. Defaults to the cluster in Kiali configuration.

**Returns**: Resource details or list of resources depending on whether `resource_name` is provided.

**Example 1**: List all services in bookinfo namespace
```json
{
  "resource_type": "service",
  "namespaces": "bookinfo"
}
```

**Example 2**: Get details for a specific workload
```json
{
  "resource_type": "workload",
  "namespaces": "bookinfo",
  "resource_name": "reviews-v1"
}
```

**Example 3**: List all workloads across multiple namespaces
```json
{
  "resource_type": "workload",
  "namespaces": "bookinfo,default"
}
```

**Example 4**: Get service details from specific cluster
```json
{
  "resource_type": "service",
  "namespaces": "bookinfo",
  "resource_name": "reviews",
  "cluster_name": "cluster1"
}
```

---

### 5. `get_traces`

Fetches a distributed trace from the configured tracing backend (Jaeger/Tempo) and returns a compact summary highlighting **latency bottlenecks** and/or **error chains**.

**Action**: Query tracing backend and summarize spans.

**Parameters**:
- `trace_id` (string, optional): If provided, fetch that trace and summarize it.
- `namespace` (string, required if `trace_id` omitted): Namespace of the service.
- `service_name` (string, required if `trace_id` omitted): Service name to search traces for.
- `error_only` (boolean, optional): If true, only consider error traces.
- `lookback_seconds` (integer, optional): Search window when using `service_name`. Default 600.
- `limit` (integer, optional): Max traces to consider when searching. Default 10.
- `max_spans` (integer, optional): Max spans to return per summary section. Default 7.

**Returns**: `GetTracesResponse` with:
- `summary.bottlenecks`: Largest-duration spans (where latency concentrates)
- `summary.error_spans`: Spans tagged as errors
- `summary.error_chain`: Root → error span chain for the most expensive error span

**Example 1**: Summarize a specific trace
```json
{
  "trace_id": "0af7651916cd43dd8448eb211c80319c"
}
```

**Example 2**: Find an error trace for a service and summarize it
```json
{
  "namespace": "bookinfo",
  "service_name": "reviews",
  "error_only": true,
  "lookback_seconds": 900
}
```

---

### 6. `manage_istio_config`

Manages Istio configuration objects: list, get, create, patch, and delete operations.

**Purpose**: Query and modify Istio configuration objects like VirtualServices, DestinationRules, Gateways, etc.

**Parameters**:
- `action` (string, required): Action to perform - `"list"`, `"get"`, `"create"`, `"patch"`, or `"delete"`.
- `cluster` (string, optional): Cluster name. Defaults to the cluster in Kiali configuration.
- `namespace` (string, optional): Namespace. If not provided for `list`, returns all Istio objects across all namespaces.
- `group` (string, required for create/patch/get): API group (e.g., `"networking.istio.io"`, `"gateway.networking.k8s.io"`).
- `version` (string, required for create/patch/get): API version (e.g., `"v1alpha3"`, `"v1beta1"`).
- `kind` (string, required for create/patch/get): Object kind (e.g., `"VirtualService"`, `"DestinationRule"`, `"Gateway"`).
- `object` (string, required for patch/delete): Name of the Istio object.
- `json_data` (string, required for create/patch): JSON data for the object (as string).

**Returns**: 
- For `list`: Array of Istio objects
- For `get`: Single Istio object
- For `create`/`patch`/`delete`: Success/error message

**Example 1**: List all VirtualServices in bookinfo namespace
```json
{
  "action": "list",
  "namespace": "bookinfo",
  "group": "networking.istio.io",
  "version": "v1alpha3",
  "kind": "VirtualService"
}
```

**Example 2**: Get a specific VirtualService
```json
{
  "action": "get",
  "namespace": "bookinfo",
  "group": "networking.istio.io",
  "version": "v1alpha3",
  "kind": "VirtualService",
  "object": "reviews"
}
```

**Example 3**: Create a new DestinationRule
```json
{
  "action": "create",
  "namespace": "bookinfo",
  "group": "networking.istio.io",
  "version": "v1alpha3",
  "kind": "DestinationRule",
  "json_data": "{\"apiVersion\":\"networking.istio.io/v1alpha3\",\"kind\":\"DestinationRule\",\"metadata\":{\"name\":\"reviews\",\"namespace\":\"bookinfo\"},\"spec\":{\"host\":\"reviews\",\"trafficPolicy\":{\"loadBalancer\":{\"simple\":\"LEAST_CONN\"}}}}"
}
```

**Example 4**: Patch an existing VirtualService
```json
{
  "action": "patch",
  "namespace": "bookinfo",
  "group": "networking.istio.io",
  "version": "v1alpha3",
  "kind": "VirtualService",
  "object": "reviews",
  "json_data": "{\"spec\":{\"http\":[{\"match\":[{\"headers\":{\"end-user\":{\"exact\":\"jason\"}}}],\"route\":[{\"destination\":{\"host\":\"reviews\",\"subset\":\"v2\"}}]}]}}"
}
```

**Example 5**: Delete a DestinationRule
```json
{
  "action": "delete",
  "namespace": "bookinfo",
  "group": "networking.istio.io",
  "version": "v1alpha3",
  "kind": "DestinationRule",
  "object": "reviews"
}
```

**Example 6**: List all Istio objects across all namespaces
```json
{
  "action": "list",
  "group": "networking.istio.io",
  "version": "v1alpha3",
  "kind": "VirtualService"
}
```

---

## Tool definitions (YAML)

Tool definitions are now described in YAML files under `ai/mcp/tools/`. Each
file defines a single tool, or a list with exactly one tool. The loader reads
all `*.yaml`/`*.yml` files and registers them by name.

**Schema**

- `name`: Tool name, must match the implementation switch in `mcp_tools.go`.
- `description`: Short description sent to the model.
- `input_schema`: JSON Schema object describing the tool parameters.

Example:

```yaml
- name: "get_mesh_graph"
  description: "Returns the mesh graph data for the given namespaces and graph type."
  input_schema:
    type: "object"
    properties:
      namespaces:
        type: "string"
        description: "Comma-separated list of namespaces to include in the graph"
      graphType:
        type: "string"
        description: "Type of graph to return"
        enum: ["versionedApp", "app", "service", "workload"]
```

## Tool execution flow

Tools are loaded via `mcp.LoadTools()` and exposed to the provider as OpenAI
tools. The execution is routed by name in `ToolDef.Call`.

### ExcludedToolNames

`ExcludedToolNames` defines tools that **return UI actions or citations only**.
For these tools, the AI does not need to interpret or summarize the result; the
UI consumes the `actions` or `citations` directly. The AI response only includes
an acknowledgment tool message so the conversation can continue.

## Response Format

All tools return:
- **Success**: The tool-specific response object and HTTP status code `200`
- **Error**: Error message and appropriate HTTP status code (e.g., `400` for bad requests, `500` for server errors)

## Usage in AI Conversations

The AI model automatically calls these tools based on user queries:
- When users ask to "show" or "view" something → `get_action_ui`
- When users ask about documentation or troubleshooting → `get_citations`
- When users ask about mesh health or topology → `get_mesh_graph`
- When users ask about specific resources → `get_resource_detail`
- When users want to manage Istio config → `manage_istio_config`

The AI combines results from multiple tools to provide comprehensive answers with navigation actions and citations.

## Adding New Tools

To add a new MCP tool:

1. Add a YAML definition in `ai/mcp/tools/<tool_name>.yaml` using the schema
   above. The `name` must match the implementation name.
2. Implement the tool logic in `ai/mcp/<tool_name>/` and expose an `Execute`
   function (follow existing tools).
3. Add a switch case in `ToolDef.Call` in `mcp_tools.go` to route the tool name
   to your `Execute` function.
4. If your tool only emits UI actions or citations and the AI should not consume
   the tool output, add the tool name to `ExcludedToolNames`.

See existing tools in `ai/mcp/` and `ai/mcp/tools/` for end-to-end examples.

