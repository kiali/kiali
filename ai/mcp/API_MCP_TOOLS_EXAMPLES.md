# MCP Tools API Call Examples

The base endpoint is **POST** `/api/chat/mcp/{tool_name}`. The body must be JSON with the tool arguments.

Replace `$KIALI_URL` with your Kiali URL (e.g. `https://kiali.example.com`) and add the authentication headers used by your setup (session cookie, token, etc.).

---

## 1. get_mesh_graph

Returns the mesh graph data for the given namespaces and graph type.

```bash
curl -X POST "$KIALI_URL/api/chat/mcp/get_mesh_graph" \
  -H "Content-Type: application/json" \
  -d '{
    "namespace": "bookinfo"
  }'
```

```bash
curl -X POST "$KIALI_URL/api/chat/mcp/get_mesh_graph" \
  -H "Content-Type: application/json" \
  -d '{
    "namespaces": "bookinfo,default",
    "graphType": "versionedApp",
    "rateInterval": "10m",
    "clusterName": "east"
  }'
```

**Parameters (all optional):**

| Parameter    | Type   | Description |
|--------------|--------|-------------|
| namespace    | string | Single namespace (alternative to namespaces) |
| namespaces   | string | Comma-separated list of namespaces |
| graphType    | string | `versionedApp`, `app`, `service`, `workload` |
| rateInterval | string | e.g. `10m`, `5m`, `1h` (default `10m`) |
| clusterName  | string | Cluster (default: from KubeConfig) |

---

## 2. get_resource_detail

Returns resource detail or listing for a resource type (service, workload, app, istio).

```bash
curl -X POST "$KIALI_URL/api/chat/mcp/get_resource_detail" \
  -H "Content-Type: application/json" \
  -d '{
    "resourceType": "service",
    "namespaces": "bookinfo"
  }'
```

```bash
curl -X POST "$KIALI_URL/api/chat/mcp/get_resource_detail" \
  -H "Content-Type: application/json" \
  -d '{
    "resourceType": "workload",
    "namespaces": "bookinfo",
    "resourceName": "reviews-v1",
    "rate_interval": "5m",
    "query_time": "2025-03-13T12:00:00Z",
    "clusterName": "east"
  }'
```

**Parameters:**

| Parameter    | Type   | Required | Description |
|--------------|--------|----------|-------------|
| resourceType | string | Yes      | `service`, `workload`, `app`, `istio` |
| namespaces   | string | No       | Comma-separated namespaces (empty = all accessible) |
| resourceName | string | No       | Resource name (if empty, lists all) |
| clusterName  | string | No       | Cluster (default: Kiali config) |
| rate_interval / rateInterval | string | No | e.g. `10m` (default `10m`) |
| query_time / queryTime       | string | No | RFC3339 timestamp (default: now) |

---

## 3. get_traces

Fetches a trace by `trace_id` or searches by `service_name` (optionally errors only).

```bash
# By trace_id
curl -X POST "$KIALI_URL/api/chat/mcp/get_traces" \
  -H "Content-Type: application/json" \
  -d '{
    "trace_id": "abc123def456"
  }'
```

```bash
# By namespace and service
curl -X POST "$KIALI_URL/api/chat/mcp/get_traces" \
  -H "Content-Type: application/json" \
  -d '{
    "namespace": "bookinfo",
    "service_name": "reviews",
    "error_only": false,
    "lookback_seconds": 600,
    "limit": 10,
    "max_spans": 7,
    "cluster_name": "east"
  }'
```

**Parameters:**

| Parameter        | Type    | Description |
|------------------|---------|-------------|
| trace_id         | string  | Trace ID (if provided, namespace/service_name are ignored) |
| namespace        | string  | Service namespace (required when trace_id is not provided) |
| service_name     | string  | Service name (required when trace_id is not provided) |
| error_only       | boolean | Only traces with errors (default false) |
| cluster_name     | string  | Cluster (default: Kiali config) |
| lookback_seconds | integer | How far back to search when using service_name (default 600) |
| limit            | integer | Max traces when searching by service (default 10) |
| max_spans        | integer | Max spans per section in summary (default 7) |

---

## 4. get_logs

Gets logs for a Pod (or resolves by workload name).

```bash
curl -X POST "$KIALI_URL/api/chat/mcp/get_logs" \
  -H "Content-Type: application/json" \
  -d '{
    "namespace": "bookinfo",
    "name": "reviews-v1-7d4b8c9f5-xk2lm"
  }'
```

```bash
curl -X POST "$KIALI_URL/api/chat/mcp/get_logs" \
  -H "Content-Type: application/json" \
  -d '{
    "namespace": "bookinfo",
    "name": "reviews-v1",
    "workload": "reviews-v1",
    "container": "reviews",
    "tail": 100,
    "severity": "ERROR,WARN",
    "previous": false,
    "cluster_name": "east",
    "format": "codeblock"
  }'
```

**Parameters:**

| Parameter    | Type    | Required | Description |
|--------------|---------|----------|-------------|
| namespace    | string  | Yes      | Pod namespace |
| name         | string  | Yes      | Pod name (or workload if not found as Pod) |
| workload     | string  | No       | Workload name override |
| container    | string  | No       | Container name |
| tail         | integer | No       | Lines from end (default 50, max 200) |
| severity     | string  | No       | Filter: `ERROR`, `WARN` or `ERROR,WARN` |
| previous     | boolean | No       | Previous terminated container logs |
| cluster_name | string  | No       | Cluster (default: Kiali config) |
| format       | string  | No       | `codeblock` or `plain` |

---

## 5. get_pod_performance

Summary of Pod CPU/memory usage vs requests/limits (Prometheus + Pod spec).

```bash
# By Pod name
curl -X POST "$KIALI_URL/api/chat/mcp/get_pod_performance" \
  -H "Content-Type: application/json" \
  -d '{
    "namespace": "bookinfo",
    "podName": "reviews-v1-7d4b8c9f5-xk2lm"
  }'
```

```bash
# By workload name
curl -X POST "$KIALI_URL/api/chat/mcp/get_pod_performance" \
  -H "Content-Type: application/json" \
  -d '{
    "namespace": "bookinfo",
    "workloadName": "reviews-v1",
    "timeRange": "10m",
    "queryTime": "2025-03-13T12:00:00Z",
    "clusterName": "east"
  }'
```

**Parameters:**

| Parameter    | Type   | Required | Description |
|--------------|--------|----------|-------------|
| namespace    | string | Yes      | Pod namespace |
| podName      | string | Yes*     | Pod name (*or workloadName) |
| workloadName | string | Yes*     | Workload name (Deployment/StatefulSet, etc.) |
| timeRange    | string | No       | Prometheus window: `5m`, `10m`, `1h`, `1d` (default `10m`) |
| queryTime    | string | No       | Query end time RFC3339 (default: now) |
| clusterName  | string | No       | Cluster (default: Kiali config) |

---

## 6. manage_istio_config

List, get, create, patch or delete Istio config.

```bash
# List Istio objects (all namespaces)
curl -X POST "$KIALI_URL/api/chat/mcp/manage_istio_config" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "list",
    "confirmed": false
  }'
```

```bash
# List in a namespace
curl -X POST "$KIALI_URL/api/chat/mcp/manage_istio_config" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "list",
    "confirmed": false,
    "namespace": "bookinfo",
    "cluster": "east"
  }'
```

```bash
# Get an object
curl -X POST "$KIALI_URL/api/chat/mcp/manage_istio_config" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "get",
    "confirmed": false,
    "namespace": "bookinfo",
    "group": "networking.istio.io",
    "version": "v1",
    "kind": "VirtualService",
    "object": "reviews"
  }'
```

```bash
# Create (preview without confirmed)
curl -X POST "$KIALI_URL/api/chat/mcp/manage_istio_config" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "create",
    "confirmed": false,
    "namespace": "bookinfo",
    "group": "networking.istio.io",
    "version": "v1",
    "kind": "VirtualService",
    "object": "mi-vs",
    "json_data": "{\"apiVersion\":\"networking.istio.io/v1\",\"kind\":\"VirtualService\",\"metadata\":{\"name\":\"mi-vs\",\"namespace\":\"bookinfo\"},\"spec\":{\"hosts\":[\"reviews\"],\"http\":[{\"route\":[{\"destination\":{\"host\":\"reviews\",\"subset\":\"v1\"}}]}]}}"
  }'
```

```bash
# Delete (with confirmation)
curl -X POST "$KIALI_URL/api/chat/mcp/manage_istio_config" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "delete",
    "confirmed": true,
    "namespace": "bookinfo",
    "group": "networking.istio.io",
    "version": "v1",
    "kind": "VirtualService",
    "object": "mi-vs"
  }'
```

**Parameters:**

| Parameter  | Type    | Required | Description |
|------------|---------|----------|-------------|
| action     | string  | Yes      | `list`, `get`, `create`, `patch`, `delete` |
| confirmed  | boolean | Yes      | For create/patch/delete: `true` executes; `false` returns preview (create/patch) |
| cluster    | string  | No       | Cluster (default: Kiali config) |
| namespace  | string  | No       | Namespace (list without namespace = all) |
| group      | string  | Yes for get/create/patch | API group (e.g. `networking.istio.io`) |
| version    | string  | Yes for get/create/patch | API version (use `v1` for VS/DR/Gateway) |
| kind       | string  | Yes for get/create/patch | e.g. `VirtualService`, `DestinationRule` |
| object     | string  | Yes for get/create/patch/delete | Object name |
| json_data  | string  | Yes for create/patch | JSON for the object to apply |

---

## 7. get_action_ui

Returns the action to navigate in the Kiali UI (graph, list, detail, overview).

```bash
curl -X POST "$KIALI_URL/api/chat/mcp/get_action_ui" \
  -H "Content-Type: application/json" \
  -d '{
    "resourceType": "graph",
    "namespaces": "bookinfo",
    "graph": "traffic",
    "graphType": "versionedApp"
  }'
```

```bash
curl -X POST "$KIALI_URL/api/chat/mcp/get_action_ui" \
  -H "Content-Type: application/json" \
  -d '{
    "resourceType": "service",
    "namespaces": "bookinfo",
    "resourceName": "reviews",
    "tab": "metrics",
    "clusterName": "east"
  }'
```

**Parameters:**

| Parameter    | Type   | Required | Description |
|--------------|--------|----------|-------------|
| resourceType | string | Yes      | `service`, `workload`, `app`, `istio`, `graph`, `overview` |
| namespaces   | string | No       | Comma-separated namespaces (empty = all) |
| resourceName | string | No       | Resource name for detail view |
| graph        | string | No       | If resourceType=graph: `mesh` or `traffic` |
| graphType    | string | No       | `versionedApp`, `app`, `service`, `workload` (default versionedApp) |
| tab          | string | No       | Detail tab: `info`, `logs`, `metrics`, `in_metrics`, `out_metrics`, `traffic`, `traces`, `envoy` |
| clusterName  | string | No       | Cluster (default: Kiali config) |

---

## 8. get_citations

Returns links to documentation based on a list of keywords.

```bash
curl -X POST "$KIALI_URL/api/chat/mcp/get_citations" \
  -H "Content-Type: application/json" \
  -d '{
    "keywords": "virtual service, traffic, routing"
  }'
```

```bash
curl -X POST "$KIALI_URL/api/chat/mcp/get_citations" \
  -H "Content-Type: application/json" \
  -d '{
    "keywords": "destination rule",
    "domain": "istio"
  }'
```

**Parameters:**

| Parameter | Type   | Required | Description |
|-----------|--------|----------|-------------|
| keywords  | string | Yes      | Comma-separated keywords |
| domain    | string | No       | `kiali`, `istio`, `all` or empty (all) |

---

## Tools summary

| Tool                | Brief description |
|---------------------|-------------------|
| get_mesh_graph      | Mesh graph by namespaces and type |
| get_resource_detail| Detail/listing for service, workload, app, istio |
| get_traces          | Traces by trace_id or by service |
| get_logs            | Pod logs (or workload resolved to Pod) |
| get_pod_performance | Pod CPU/memory vs requests/limits |
| manage_istio_config | List/get/create/patch/delete Istio config |
| get_action_ui       | Kiali UI navigation action |
| get_citations       | Documentation links by keywords |

**Note:** The `get_action_ui` and `get_citations` tools are excluded from the AI chat tool list (`ExcludedToolNames`) but can still be invoked via the POST API.
