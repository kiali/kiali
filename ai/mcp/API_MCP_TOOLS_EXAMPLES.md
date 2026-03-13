# Ejemplos de llamada al API MCP Tools

El endpoint base es **POST** `/api/chat/mcp/{tool_name}`. El cuerpo debe ser JSON con los argumentos de la tool.

Sustituye `$KIALI_URL` por la URL de tu Kiali (ej: `https://kiali.example.com`) y añade las cabeceras de autenticación que use tu instalación (cookie de sesión, token, etc.).

---

## 1. get_mesh_graph

Devuelve el grafo del mesh para los namespaces y tipo de grafo indicados.

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

**Parámetros (todos opcionales):**

| Parámetro     | Tipo   | Descripción |
|---------------|--------|-------------|
| namespace     | string | Un solo namespace (alternativa a namespaces) |
| namespaces    | string | Lista de namespaces separados por comas |
| graphType     | string | `versionedApp`, `app`, `service`, `workload` |
| rateInterval  | string | Ej: `10m`, `5m`, `1h` (default `10m`) |
| clusterName   | string | Cluster (default: el del KubeConfig) |

---

## 2. get_resource_detail

Devuelve detalle o listado de un tipo de recurso (service, workload, app, istio).

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

**Parámetros:**

| Parámetro    | Tipo   | Requerido | Descripción |
|--------------|--------|-----------|-------------|
| resourceType | string | Sí        | `service`, `workload`, `app`, `istio` |
| namespaces   | string | No        | Namespaces separados por comas (vacío = todos accesibles) |
| resourceName | string | No        | Nombre del recurso (si va vacío, lista todos) |
| clusterName  | string | No        | Cluster (default: config Kiali) |
| rate_interval / rateInterval | string | No | Ej: `10m` (default `10m`) |
| query_time / queryTime       | string | No | Timestamp RFC3339 (default: ahora) |

---

## 3. get_traces

Obtiene un trace por `trace_id` o busca por `service_name` (opcionalmente solo con errores).

```bash
# Por trace_id
curl -X POST "$KIALI_URL/api/chat/mcp/get_traces" \
  -H "Content-Type: application/json" \
  -d '{
    "trace_id": "abc123def456"
  }'
```

```bash
# Por namespace y servicio
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

**Parámetros:**

| Parámetro        | Tipo    | Descripción |
|------------------|---------|-------------|
| trace_id         | string  | ID del trace (si se pasa, se ignoran namespace/service_name) |
| namespace        | string  | Namespace del servicio (requerido si no hay trace_id) |
| service_name     | string  | Nombre del servicio (requerido si no hay trace_id) |
| error_only       | boolean | Solo traces con errores (default false) |
| cluster_name     | string  | Cluster (default: config Kiali) |
| lookback_seconds | integer | Segundos hacia atrás al buscar por servicio (default 600) |
| limit            | integer | Máx. traces al buscar por servicio (default 10) |
| max_spans        | integer | Máx. spans por sección en el resumen (default 7) |

---

## 4. get_logs

Obtiene los logs de un Pod (o resuelve por nombre de workload).

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

**Parámetros:**

| Parámetro   | Tipo    | Requerido | Descripción |
|-------------|---------|-----------|-------------|
| namespace   | string  | Sí        | Namespace del Pod |
| name        | string  | Sí        | Nombre del Pod (o workload si no existe como Pod) |
| workload    | string  | No        | Override de nombre de workload |
| container   | string  | No        | Nombre del contenedor |
| tail        | integer | No        | Líneas desde el final (default 50, máx 200) |
| severity    | string  | No        | Filtro: `ERROR`, `WARN` o `ERROR,WARN` |
| previous    | boolean | No        | Logs del contenedor terminado anterior |
| cluster_name | string | No        | Cluster (default: config Kiali) |
| format      | string  | No        | `codeblock` o `plain` |

---

## 5. get_pod_performance

Resumen de uso de CPU/memoria del Pod vs requests/limits (Prometheus + spec del Pod).

```bash
# Por nombre de Pod
curl -X POST "$KIALI_URL/api/chat/mcp/get_pod_performance" \
  -H "Content-Type: application/json" \
  -d '{
    "namespace": "bookinfo",
    "podName": "reviews-v1-7d4b8c9f5-xk2lm"
  }'
```

```bash
# Por nombre de workload
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

**Parámetros:**

| Parámetro     | Tipo   | Requerido | Descripción |
|---------------|--------|-----------|-------------|
| namespace     | string | Sí        | Namespace del Pod |
| podName       | string | Sí*       | Nombre del Pod (*o workloadName) |
| workloadName  | string | Sí*       | Nombre del workload (Deployment/StatefulSet, etc.) |
| timeRange     | string | No        | Ventana Prometheus: `5m`, `10m`, `1h`, `1d` (default `10m`) |
| queryTime     | string | No        | Timestamp fin de la query RFC3339 (default: ahora) |
| clusterName   | string | No        | Cluster (default: config Kiali) |

---

## 6. manage_istio_config_read

Solo lectura: listar u obtener configuración Istio. Para crear, parchear o eliminar usar `manage_istio_config`.

```bash
# Listar objetos Istio (todos los namespaces)
curl -X POST "$KIALI_URL/api/chat/mcp/manage_istio_config_read" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "list"
  }'
```

```bash
# Listar en un namespace
curl -X POST "$KIALI_URL/api/chat/mcp/manage_istio_config_read" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "list",
    "namespace": "bookinfo",
    "cluster": "east"
  }'
```

```bash
# Obtener un objeto
curl -X POST "$KIALI_URL/api/chat/mcp/manage_istio_config_read" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "get",
    "namespace": "bookinfo",
    "group": "networking.istio.io",
    "version": "v1",
    "kind": "VirtualService",
    "object": "reviews"
  }'
```

**Parámetros:** `action` (requerido: `list` o `get`), `cluster`, `namespace`, `group`, `version`, `kind`, `object` (requeridos para `get`), `service_name` (solo para `list`).

---

## 7. manage_istio_config

Crear, parchear o eliminar configuración Istio. Para listar u obtener usar `manage_istio_config_read`.

```bash
# Crear (preview sin confirmed)
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
# Eliminar (con confirmación)
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

**Parámetros:** `action` (requerido: `create`, `patch`, `delete`), `confirmed`, `cluster`, `namespace`, `group`, `version`, `kind`, `object`, `data` (requerido para create/patch).

---

## 8. get_action_ui

Devuelve la acción para navegar en la UI de Kiali (gráfico, listado, detalle, overview).

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

**Parámetros:**

| Parámetro    | Tipo   | Requerido | Descripción |
|--------------|--------|-----------|-------------|
| resourceType | string | Sí        | `service`, `workload`, `app`, `istio`, `graph`, `overview` |
| namespaces   | string | No        | Namespaces separados por comas (vacío = todos) |
| resourceName | string | No        | Nombre del recurso para detalle |
| graph        | string | No        | Si resourceType=graph: `mesh` o `traffic` |
| graphType    | string | No        | `versionedApp`, `app`, `service`, `workload` (default versionedApp) |
| tab          | string | No        | Tab en detalle: `info`, `logs`, `metrics`, `in_metrics`, `out_metrics`, `traffic`, `traces`, `envoy` |
| clusterName  | string | No        | Cluster (default: config Kiali) |

---

## 9. get_citations

Devuelve enlaces a documentación según una lista de palabras clave.

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

**Parámetros:**

| Parámetro | Tipo   | Requerido | Descripción |
|-----------|--------|-----------|-------------|
| keywords  | string | Sí        | Palabras clave separadas por comas |
| domain    | string | No        | `kiali`, `istio`, `all` o vacío (todos) |

---

## Resumen de tools

| Tool                 | Descripción breve |
|----------------------|--------------------|
| get_mesh_graph       | Grafo del mesh por namespaces y tipo |
| get_resource_detail | Detalle/listado de service, workload, app, istio |
| get_traces           | Traces por trace_id o por servicio |
| get_logs             | Logs de un Pod (o workload resuelto a Pod) |
| get_pod_performance  | Uso CPU/memoria del Pod vs requests/limits |
| manage_istio_config_read | List/get config Istio (solo lectura) |
| manage_istio_config  | Create/patch/delete config Istio |
| get_action_ui        | Acción de navegación en la UI Kiali |
| get_citations        | Enlaces a documentación por keywords |

**Nota:** Las tools `get_action_ui` y `get_citations` están excluidas del listado para el chat AI (`ExcludedToolNames`) pero siguen siendo invocables vía API POST.
