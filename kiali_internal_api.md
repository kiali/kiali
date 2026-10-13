


# Kiali
# Kiali Project, The Console for Istio Service Mesh

NOTE! The Kiali API is not for public use and is not supported for any use outside Kiali's own tooling.
The API can and will change from version to version with no guarantee of backwards compatibility.

To generate this API document, run from the repository root:

make swagger-doc

The generated doc's Version field uses the Makefile VERSION variable (default in the root Makefile).
  

## Informations

### Version

v2.34.0-SNAPSHOT

## Content negotiation

### URI Schemes
  * http
  * https

### Consumes
  * application/json

### Produces
  * application/html
  * application/json

## Access control

### Security Schemes

#### authorization



> **Type**: basic

## All endpoints

###  aggregates

| Method  | URI     | Name   | Summary |
|---------|---------|--------|---------|
| GET | /api/namespaces/{namespace}/aggregates/{aggregate}/{aggregateValue}/metrics | [aggregate metrics](#aggregate-metrics) |  |
  


###  apps

| Method  | URI     | Name   | Summary |
|---------|---------|--------|---------|
| GET | /api/namespaces/{namespace}/apps/{app}/dashboard | [app dashboard](#app-dashboard) |  |
| GET | /api/namespaces/{namespace}/apps/{app} | [app details](#app-details) |  |
| GET | /api/namespaces/{namespace}/apps/{app}/health/history | [app health status history](#app-health-status-history) |  |
| GET | /api/clusters/apps | [app list](#app-list) |  |
| GET | /api/namespaces/{namespace}/apps/{app}/metrics | [app metrics](#app-metrics) |  |
  


###  auth

| Method  | URI     | Name   | Summary |
|---------|---------|--------|---------|
| GET | /api/authenticate | [authenticate](#authenticate) |  |
| GET | /api/auth/info | [authentication info](#authentication-info) |  |
| GET | /api/logout | [logout](#logout) |  |
| GET | /api/auth/openid_redirect | [openid redirect](#openid-redirect) |  |
| POST | /api/authenticate | [openshift check token](#openshift-check-token) |  |
  


###  chat

| Method  | URI     | Name   | Summary |
|---------|---------|--------|---------|
| POST | /api/chat/mcp/{tool_name} | [m c p tools](#m-c-p-tools) |  |
| POST | /api/chat/{provider}/{model}/ai | [ai chat a i](#ai-chat-a-i) |  |
| GET | /api/chat/session/usage | [ai chat session usage](#ai-chat-session-usage) |  |
| GET | /api/chat/prompts | [chat prompts](#chat-prompts) |  |
  


###  cluster

| Method  | URI     | Name   | Summary |
|---------|---------|--------|---------|
| GET | /api/clusters/health | [health](#health) |  |
  


###  cluster_name

| Method  | URI     | Name   | Summary |
|---------|---------|--------|---------|
| GET | /api/clusters/metrics | [clusters metrics](#clusters-metrics) |  |
  


###  config

| Method  | URI     | Name   | Summary |
|---------|---------|--------|---------|
| GET | /api/istio/permissions | [get permissions](#get-permissions) |  |
| POST | /api/namespaces/{namespace}/istio/{group}/{version}/{kind} | [istio config create](#istio-config-create) |  |
| DELETE | /api/namespaces/{namespace}/istio/{group}/{version}/{kind}/{object} | [istio config delete](#istio-config-delete) |  |
| GET | /api/namespaces/{namespace}/istio/{group}/{version}/{kind}/{object} | [istio config details](#istio-config-details) |  |
| GET | /api/namespaces/{namespace}/istio | [istio config list](#istio-config-list) |  |
| GET | /api/istio | [istio config list all](#istio-config-list-all) |  |
| PATCH | /api/namespaces/{namespace}/istio/{group}/{version}/{kind}/{object} | [istio config update](#istio-config-update) | Endpoint to update the Istio Config of an Istio object used for templates and adapters using Json Merge Patch strategy. |
  


###  controlplanes

| Method  | URI     | Name   | Summary |
|---------|---------|--------|---------|
| GET | /api/namespaces/{namespace}/controlplanes/{controlplane}/metrics | [control plane metrics](#control-plane-metrics) |  |
  


###  dashboards

| Method  | URI     | Name   | Summary |
|---------|---------|--------|---------|
| GET | /api/namespaces/{namespace}/customdashboard/{dashboard} | [custom dashboard](#custom-dashboard) |  |
  


###  graphs

| Method  | URI     | Name   | Summary |
|---------|---------|--------|---------|
| GET | /api/namespaces/{namespace}/aggregates/{aggregate}/{aggregateValue}/graph | [graph aggregate](#graph-aggregate) |  |
| GET | /api/namespaces/{namespace}/aggregates/{aggregate}/{aggregateValue}/{service}/graph | [graph aggregate by service](#graph-aggregate-by-service) |  |
| GET | /api/namespaces/{namespace}/applications/{app}/graph | [graph app](#graph-app) |  |
| GET | /api/namespaces/{namespace}/applications/{app}/versions/{version}/graph | [graph app version](#graph-app-version) |  |
| GET | /api/namespaces/graph | [graph namespaces](#graph-namespaces) | The backing JSON for a namespaces graph. |
| GET | /api/namespaces/{namespace}/services/{service}/graph | [graph service](#graph-service) | The backing JSON for a service node detail graph. |
| GET | /api/namespaces/{namespace}/workloads/{workload}/graph | [graph workload](#graph-workload) | The backing JSON for a workload node detail graph. |
  


###  integrations

| Method  | URI     | Name   | Summary |
|---------|---------|--------|---------|
| GET | /api/grafana | [grafana info](#grafana-info) |  |
| GET | /api/perses | [perses info](#perses-info) |  |
| GET | /api/tracing | [tracing info](#tracing-info) |  |
  


###  kiali

| Method  | URI     | Name   | Summary |
|---------|---------|--------|---------|
| GET | /api/config | [get config](#get-config) |  |
| GET | /api/config/disabled | [get disabled features](#get-disabled-features) |  |
| GET | /api/healthz | [healthz](#healthz) |  |
| GET | /api | [root](#root) |  |
  


###  namespaces

| Method  | URI     | Name   | Summary |
|---------|---------|--------|---------|
| GET | /api/namespaces/{namespace}/health/history | [namespace health status history](#namespace-health-status-history) |  |
| GET | /api/namespaces/{namespace}/info | [namespace info](#namespace-info) |  |
| GET | /api/namespaces | [namespace list](#namespace-list) |  |
| GET | /api/namespaces/{namespace}/metrics | [namespace metrics](#namespace-metrics) |  |
| PATCH | /api/namespaces/{namespace} | [namespace update](#namespace-update) | Endpoint to update the Namespace configuration using Json Merge Patch strategy. |
| GET | /api/namespaces/{namespace}/validations | [namespace validations](#namespace-validations) |  |
| GET | /api/istio/validations | [namespaces validations](#namespaces-validations) |  |
  


###  operations

| Method  | URI     | Name   | Summary |
|---------|---------|--------|---------|
| DELETE | /api/chat/conversations | [chat conversations](#chat-conversations) |  |
| GET | /api/mesh/controlplanes | [controlplanes](#controlplanes) |  |
| GET | /api/mesh/graph | [mesh graph](#mesh-graph) |  |
  


###  overview

| Method  | URI     | Name   | Summary |
|---------|---------|--------|---------|
| GET | /api/overview/metrics/apps/rates | [overview app rates](#overview-app-rates) |  |
| GET | /api/overview/metrics/services/latency | [overview service latencies](#overview-service-latencies) |  |
| GET | /api/overview/metrics/services/rates | [overview service rates](#overview-service-rates) |  |
| GET | /api/overview/metrics/services/throughput | [overview service throughput](#overview-service-throughput) |  |
  


###  pods

| Method  | URI     | Name   | Summary |
|---------|---------|--------|---------|
| GET | /api/namespaces/{namespace}/pods/{pod} | [pod details](#pod-details) |  |
| GET | /api/namespaces/{namespace}/pods/{pod}/logs | [pod logs](#pod-logs) |  |
| GET | /api/namespaces/{namespace}/pods/{pod}/config_dump | [pod proxy dump](#pod-proxy-dump) |  |
| POST | /api/namespaces/{namespace}/pods/{pod}/logging | [pod proxy logging](#pod-proxy-logging) |  |
| GET | /api/namespaces/{namespace}/pods/{pod}/config_dump/{resource} | [pod proxy resource](#pod-proxy-resource) |  |
| GET | /api/namespaces/{namespace}/pods/{pod}/config_dump_ztunnel | [ztunnel config dump](#ztunnel-config-dump) |  |
  


###  resource

| Method  | URI     | Name   | Summary |
|---------|---------|--------|---------|
| GET | /api/namespaces/{namespace}/{app}/usage_metrics | [usage metrics](#usage-metrics) |  |
  


###  services

| Method  | URI     | Name   | Summary |
|---------|---------|--------|---------|
| GET | /api/namespaces/{namespace}/services/{service}/dashboard | [service dashboard](#service-dashboard) |  |
| GET | /api/namespaces/{namespace}/services/{service} | [service details](#service-details) |  |
| GET | /api/namespaces/{namespace}/services/{service}/health/history | [service health status history](#service-health-status-history) |  |
| GET | /api/clusters/services | [service list](#service-list) |  |
| GET | /api/namespaces/{namespace}/services/{service}/metrics | [service metrics](#service-metrics) |  |
| PATCH | /api/namespaces/{namespace}/services/{service} | [service update](#service-update) | Endpoint to update the Service configuration using Json Merge Patch strategy. |
  


###  stats

| Method  | URI     | Name   | Summary |
|---------|---------|--------|---------|
| POST | /api/stats/metrics | [metrics stats](#metrics-stats) |  |
  


###  status

| Method  | URI     | Name   | Summary |
|---------|---------|--------|---------|
| GET | /api/status | [get status](#get-status) |  |
| GET | /api/istio/status | [istio status](#istio-status) |  |
  


###  test

| Method  | URI     | Name   | Summary |
|---------|---------|--------|---------|
| GET | /api/test/metrics/graph/cache | [test graph cache metrics](#test-graph-cache-metrics) |  |
  


###  test_metrics

| Method  | URI     | Name   | Summary |
|---------|---------|--------|---------|
| GET | /api/test/metrics/health/cache | [test health cache metrics](#test-health-cache-metrics) |  |
| GET | /api/test/metrics/health/status | [test health status metrics](#test-health-status-metrics) |  |
  


###  tlsops

| Method  | URI     | Name   | Summary |
|---------|---------|--------|---------|
| GET | /api/clusters/tls | [clusters Tls](#clusters-tls) |  |
| GET | /api/mesh/tls | [mesh Tls](#mesh-tls) |  |
| GET | /api/namespaces/{namespace}/tls | [namespace Tls](#namespace-tls) |  |
  


###  traces

| Method  | URI     | Name   | Summary |
|---------|---------|--------|---------|
| GET | /api/namespaces/{namespace}/apps/{app}/spans | [app spans](#app-spans) |  |
| GET | /api/namespaces/{namespace}/apps/{app}/traces | [app traces](#app-traces) |  |
| GET | /api/namespaces/{namespace}/apps/{app}/errortraces | [error traces](#error-traces) |  |
| GET | /api/namespaces/{namespace}/services/{service}/spans | [service spans](#service-spans) |  |
| GET | /api/namespaces/{namespace}/services/{service}/traces | [service traces](#service-traces) |  |
| GET | /api/traces/{traceID} | [trace details](#trace-details) |  |
| GET | /api/namespaces/{namespace}/workloads/{workload}/spans | [workload spans](#workload-spans) |  |
| GET | /api/namespaces/{namespace}/workloads/{workload}/traces | [workload traces](#workload-traces) |  |
  


###  tracing

| Method  | URI     | Name   | Summary |
|---------|---------|--------|---------|
| POST | /api/tracing/check | [tracing check](#tracing-check) |  |
| GET | /api/tracing/diagnose | [tracing diagnose](#tracing-diagnose) |  |
  


###  workloads

| Method  | URI     | Name   | Summary |
|---------|---------|--------|---------|
| GET | /api/namespaces/{namespace}/workloads/{workload}/dashboard | [workload dashboard](#workload-dashboard) |  |
| GET | /api/namespaces/{namespace}/workloads/{workload} | [workload details](#workload-details) |  |
| GET | /api/namespaces/{namespace}/workloads/{workload}/envoymemory | [workload envoy memory](#workload-envoy-memory) |  |
| GET | /api/namespaces/{namespace}/workloads/{workload}/health/history | [workload health status history](#workload-health-status-history) |  |
| GET | /api/clusters/workloads | [workload list](#workload-list) |  |
| GET | /api/namespaces/{namespace}/workloads/{workload}/metrics | [workload metrics](#workload-metrics) |  |
| PATCH | /api/namespaces/{namespace}/workloads/{workload} | [workload update](#workload-update) | Endpoint to update the Workload configuration using Json Merge Patch strategy. |
| GET | /api/namespaces/{namespace}/ztunnel/{workload}/dashboard | [ztunnel dashboard](#ztunnel-dashboard) |  |
  


## Paths

### <span id="chat-conversations"></span> chat conversations (*ChatConversations*)

```
DELETE /api/chat/conversations
```

Endpoint to delete AI chat conversations

#### URI Schemes
  * http
  * https

#### Produces
  * application/json

#### All responses
| Code | Status | Description | Has headers | Schema |
|------|--------|-------------|:-----------:|--------|
| [200](#chat-conversations-200) | OK | NoContent: the response is empty |  | [schema](#chat-conversations-200-schema) |
| [400](#chat-conversations-400) | Bad Request | BadRequestError: the client request is incorrect |  | [schema](#chat-conversations-400-schema) |
| [500](#chat-conversations-500) | Internal Server Error | A Internal is the error message that means something has gone wrong |  | [schema](#chat-conversations-500-schema) |

#### Responses


##### <span id="chat-conversations-200"></span> 200 - NoContent: the response is empty
Status: OK

###### <span id="chat-conversations-200-schema"></span> Schema
   
  

[ChatConversationsOKBody](#chat-conversations-o-k-body)

##### <span id="chat-conversations-400"></span> 400 - BadRequestError: the client request is incorrect
Status: Bad Request

###### <span id="chat-conversations-400-schema"></span> Schema
   
  

[ChatConversationsBadRequestBody](#chat-conversations-bad-request-body)

##### <span id="chat-conversations-500"></span> 500 - A Internal is the error message that means something has gone wrong
Status: Internal Server Error

###### <span id="chat-conversations-500-schema"></span> Schema
   
  

[ChatConversationsInternalServerErrorBody](#chat-conversations-internal-server-error-body)

###### Inlined models

**<span id="chat-conversations-bad-request-body"></span> ChatConversationsBadRequestBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `400`| HTTP status code | `400` |
| Message | string| `string` |  | |  |  |



**<span id="chat-conversations-internal-server-error-body"></span> ChatConversationsInternalServerErrorBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `500`| HTTP status code | `500` |
| Message | string| `string` |  | |  |  |



**<span id="chat-conversations-o-k-body"></span> ChatConversationsOKBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `204`| HTTP status code | `204` |
| Message | string| `string` |  | |  |  |



### <span id="clusters-tls"></span> clusters Tls (*ClustersTls*)

```
GET /api/clusters/tls
```

Get TLS statuses for given namespaces of the given cluster

#### URI Schemes
  * http
  * https

#### Produces
  * application/json

#### All responses
| Code | Status | Description | Has headers | Schema |
|------|--------|-------------|:-----------:|--------|
| [200](#clusters-tls-200) | OK | Response of the cluster TLS query |  | [schema](#clusters-tls-200-schema) |
| [400](#clusters-tls-400) | Bad Request | BadRequestError: the client request is incorrect |  | [schema](#clusters-tls-400-schema) |
| [500](#clusters-tls-500) | Internal Server Error | A Internal is the error message that means something has gone wrong |  | [schema](#clusters-tls-500-schema) |

#### Responses


##### <span id="clusters-tls-200"></span> 200 - Response of the cluster TLS query
Status: OK

###### <span id="clusters-tls-200-schema"></span> Schema
   
  

[MTLSStatus](#m-tls-status)

##### <span id="clusters-tls-400"></span> 400 - BadRequestError: the client request is incorrect
Status: Bad Request

###### <span id="clusters-tls-400-schema"></span> Schema
   
  

[ClustersTLSBadRequestBody](#clusters-tls-bad-request-body)

##### <span id="clusters-tls-500"></span> 500 - A Internal is the error message that means something has gone wrong
Status: Internal Server Error

###### <span id="clusters-tls-500-schema"></span> Schema
   
  

[ClustersTLSInternalServerErrorBody](#clusters-tls-internal-server-error-body)

###### Inlined models

**<span id="clusters-tls-bad-request-body"></span> ClustersTLSBadRequestBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `400`| HTTP status code | `400` |
| Message | string| `string` |  | |  |  |



**<span id="clusters-tls-internal-server-error-body"></span> ClustersTLSInternalServerErrorBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `500`| HTTP status code | `500` |
| Message | string| `string` |  | |  |  |



### <span id="health"></span> health (*Health*)

```
GET /api/clusters/health
```

Get health for all objects in namespaces of the given cluster

#### URI Schemes
  * http
  * https

#### Produces
  * application/json

#### All responses
| Code | Status | Description | Has headers | Schema |
|------|--------|-------------|:-----------:|--------|
| [200](#health-200) | OK | Response of the cluster namespace health query |  | [schema](#health-200-schema) |
| [400](#health-400) | Bad Request | BadRequestError: the client request is incorrect |  | [schema](#health-400-schema) |
| [500](#health-500) | Internal Server Error | A Internal is the error message that means something has gone wrong |  | [schema](#health-500-schema) |

#### Responses


##### <span id="health-200"></span> 200 - Response of the cluster namespace health query
Status: OK

###### <span id="health-200-schema"></span> Schema
   
  

[ClustersNamespaceHealth](#clusters-namespace-health)

##### <span id="health-400"></span> 400 - BadRequestError: the client request is incorrect
Status: Bad Request

###### <span id="health-400-schema"></span> Schema
   
  

[HealthBadRequestBody](#health-bad-request-body)

##### <span id="health-500"></span> 500 - A Internal is the error message that means something has gone wrong
Status: Internal Server Error

###### <span id="health-500-schema"></span> Schema
   
  

[HealthInternalServerErrorBody](#health-internal-server-error-body)

###### Inlined models

**<span id="health-bad-request-body"></span> HealthBadRequestBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `400`| HTTP status code | `400` |
| Message | string| `string` |  | |  |  |



**<span id="health-internal-server-error-body"></span> HealthInternalServerErrorBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `500`| HTTP status code | `500` |
| Message | string| `string` |  | |  |  |



### <span id="m-c-p-tools"></span> m c p tools (*MCPTools*)

```
POST /api/chat/mcp/{tool_name}
```

Endpoint to call MCP tool

#### URI Schemes
  * http
  * https

#### Produces
  * application/json

#### Parameters

| Name | Source | Type | Go type | Separator | Required | Default | Description |
|------|--------|------|---------|-----------| :------: |---------|-------------|
| tool_name | `path` | string | `string` |  | ✓ |  | The MCP tool name. |

#### All responses
| Code | Status | Description | Has headers | Schema |
|------|--------|-------------|:-----------:|--------|
| [200](#m-c-p-tools-200) | OK | NoContent: the response is empty |  | [schema](#m-c-p-tools-200-schema) |
| [400](#m-c-p-tools-400) | Bad Request | BadRequestError: the client request is incorrect |  | [schema](#m-c-p-tools-400-schema) |
| [404](#m-c-p-tools-404) | Not Found | A NotFoundError is the error message that is generated when server could not find what was requested. |  | [schema](#m-c-p-tools-404-schema) |
| [500](#m-c-p-tools-500) | Internal Server Error | A Internal is the error message that means something has gone wrong |  | [schema](#m-c-p-tools-500-schema) |

#### Responses


##### <span id="m-c-p-tools-200"></span> 200 - NoContent: the response is empty
Status: OK

###### <span id="m-c-p-tools-200-schema"></span> Schema
   
  

[MCPToolsOKBody](#m-c-p-tools-o-k-body)

##### <span id="m-c-p-tools-400"></span> 400 - BadRequestError: the client request is incorrect
Status: Bad Request

###### <span id="m-c-p-tools-400-schema"></span> Schema
   
  

[MCPToolsBadRequestBody](#m-c-p-tools-bad-request-body)

##### <span id="m-c-p-tools-404"></span> 404 - A NotFoundError is the error message that is generated when server could not find what was requested.
Status: Not Found

###### <span id="m-c-p-tools-404-schema"></span> Schema
   
  

[MCPToolsNotFoundBody](#m-c-p-tools-not-found-body)

##### <span id="m-c-p-tools-500"></span> 500 - A Internal is the error message that means something has gone wrong
Status: Internal Server Error

###### <span id="m-c-p-tools-500-schema"></span> Schema
   
  

[MCPToolsInternalServerErrorBody](#m-c-p-tools-internal-server-error-body)

###### Inlined models

**<span id="m-c-p-tools-bad-request-body"></span> MCPToolsBadRequestBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `400`| HTTP status code | `400` |
| Message | string| `string` |  | |  |  |



**<span id="m-c-p-tools-internal-server-error-body"></span> MCPToolsInternalServerErrorBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `500`| HTTP status code | `500` |
| Message | string| `string` |  | |  |  |



**<span id="m-c-p-tools-not-found-body"></span> MCPToolsNotFoundBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `404`| HTTP status code | `404` |
| Message | string| `string` |  | |  |  |



**<span id="m-c-p-tools-o-k-body"></span> MCPToolsOKBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `204`| HTTP status code | `204` |
| Message | string| `string` |  | |  |  |



### <span id="aggregate-metrics"></span> aggregate metrics (*aggregateMetrics*)

```
GET /api/namespaces/{namespace}/aggregates/{aggregate}/{aggregateValue}/metrics
```

Endpoint to fetch metrics to be displayed, related to a single aggregate

#### URI Schemes
  * http
  * https

#### Produces
  * application/json

#### Parameters

| Name | Source | Type | Go type | Separator | Required | Default | Description |
|------|--------|------|---------|-----------| :------: |---------|-------------|
| aggregate | `path` | string | `string` |  | ✓ |  | The aggregate name (label). |
| aggregateValue | `path` | string | `string` |  | ✓ |  | The aggregate value (label value). |
| namespace | `path` | string | `string` |  | ✓ |  | The namespace name. |
| avg | `query` | boolean | `bool` |  |  | `true` | Flag for fetching histogram average. Default is true. |
| byLabels[] | `query` | []string | `[]string` |  |  |  | List of labels to use for grouping metrics (via Prometheus 'by' clause). |
| direction | `query` | string | `string` |  |  | `"outbound"` | Traffic direction: 'inbound' or 'outbound'. |
| duration | `query` | int64 (formatted integer) | `int64` |  |  | `1800` | Duration of the query period, in seconds. |
| filters[] | `query` | []string | `[]string` |  |  |  | List of metrics to fetch. Fetch all metrics when empty. List entries are Kiali internal metric names. |
| quantiles[] | `query` | []string | `[]string` |  |  |  | List of quantiles to fetch. Fetch no quantiles when empty. Ex: [0.5, 0.95, 0.99]. |
| rateFunc | `query` | string | `string` |  |  | `"rate"` | Prometheus function used to calculate rate: 'rate' or 'irate'. |
| rateInterval | `query` | string | `string` |  |  | `"1m"` | Interval used for rate and histogram calculation. |
| reporter | `query` | string | `string` |  |  | `"source"` | Istio telemetry reporter: 'source' or 'destination'. |
| requestProtocol | `query` | string | `string` |  |  | `"all protocols"` | Desired request protocol for the telemetry: For example, 'http' or 'grpc'. |
| step | `query` | int64 (formatted integer) | `int64` |  |  | `15` | Step between [graph] datapoints, in seconds. |
| version | `query` | string | `string` |  |  |  | Filters metrics by the specified version |

#### All responses
| Code | Status | Description | Has headers | Schema |
|------|--------|-------------|:-----------:|--------|
| [200](#aggregate-metrics-200) | OK | Metrics response model |  | [schema](#aggregate-metrics-200-schema) |
| [400](#aggregate-metrics-400) | Bad Request | BadRequestError: the client request is incorrect |  | [schema](#aggregate-metrics-400-schema) |
| [403](#aggregate-metrics-403) | Forbidden | ForbiddenError: the client is not allowed to access the requested namespace |  | [schema](#aggregate-metrics-403-schema) |
| [503](#aggregate-metrics-503) | Service Unavailable | A Internal is the error message that means something has gone wrong |  | [schema](#aggregate-metrics-503-schema) |

#### Responses


##### <span id="aggregate-metrics-200"></span> 200 - Metrics response model
Status: OK

###### <span id="aggregate-metrics-200-schema"></span> Schema
   
  

map of [Metric](#metric)

##### <span id="aggregate-metrics-400"></span> 400 - BadRequestError: the client request is incorrect
Status: Bad Request

###### <span id="aggregate-metrics-400-schema"></span> Schema
   
  

[AggregateMetricsBadRequestBody](#aggregate-metrics-bad-request-body)

##### <span id="aggregate-metrics-403"></span> 403 - ForbiddenError: the client is not allowed to access the requested namespace
Status: Forbidden

###### <span id="aggregate-metrics-403-schema"></span> Schema
   
  

[AggregateMetricsForbiddenBody](#aggregate-metrics-forbidden-body)

##### <span id="aggregate-metrics-503"></span> 503 - A Internal is the error message that means something has gone wrong
Status: Service Unavailable

###### <span id="aggregate-metrics-503-schema"></span> Schema
   
  

[AggregateMetricsServiceUnavailableBody](#aggregate-metrics-service-unavailable-body)

###### Inlined models

**<span id="aggregate-metrics-bad-request-body"></span> AggregateMetricsBadRequestBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `400`| HTTP status code | `400` |
| Message | string| `string` |  | |  |  |



**<span id="aggregate-metrics-forbidden-body"></span> AggregateMetricsForbiddenBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `403`| HTTP status code | `403` |
| Message | string| `string` |  | |  |  |



**<span id="aggregate-metrics-service-unavailable-body"></span> AggregateMetricsServiceUnavailableBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `503`| HTTP status code | `503` |
| Message | string| `string` |  | |  |  |



### <span id="ai-chat-a-i"></span> ai chat a i (*aiChatAI*)

```
POST /api/chat/{provider}/{model}/ai
```

Endpoint to chat with AI

#### URI Schemes
  * http
  * https

#### Produces
  * application/json

#### Parameters

| Name | Source | Type | Go type | Separator | Required | Default | Description |
|------|--------|------|---------|-----------| :------: |---------|-------------|
| model | `path` | string | `string` |  | ✓ |  | The AI model name. |
| provider | `path` | string | `string` |  | ✓ |  | The AI provider name. |

#### All responses
| Code | Status | Description | Has headers | Schema |
|------|--------|-------------|:-----------:|--------|
| [200](#ai-chat-a-i-200) | OK | NoContent: the response is empty |  | [schema](#ai-chat-a-i-200-schema) |
| [400](#ai-chat-a-i-400) | Bad Request | BadRequestError: the client request is incorrect |  | [schema](#ai-chat-a-i-400-schema) |
| [404](#ai-chat-a-i-404) | Not Found | A NotFoundError is the error message that is generated when server could not find what was requested. |  | [schema](#ai-chat-a-i-404-schema) |
| [500](#ai-chat-a-i-500) | Internal Server Error | A Internal is the error message that means something has gone wrong |  | [schema](#ai-chat-a-i-500-schema) |

#### Responses


##### <span id="ai-chat-a-i-200"></span> 200 - NoContent: the response is empty
Status: OK

###### <span id="ai-chat-a-i-200-schema"></span> Schema
   
  

[AiChatAIOKBody](#ai-chat-a-i-o-k-body)

##### <span id="ai-chat-a-i-400"></span> 400 - BadRequestError: the client request is incorrect
Status: Bad Request

###### <span id="ai-chat-a-i-400-schema"></span> Schema
   
  

[AiChatAIBadRequestBody](#ai-chat-a-i-bad-request-body)

##### <span id="ai-chat-a-i-404"></span> 404 - A NotFoundError is the error message that is generated when server could not find what was requested.
Status: Not Found

###### <span id="ai-chat-a-i-404-schema"></span> Schema
   
  

[AiChatAINotFoundBody](#ai-chat-a-i-not-found-body)

##### <span id="ai-chat-a-i-500"></span> 500 - A Internal is the error message that means something has gone wrong
Status: Internal Server Error

###### <span id="ai-chat-a-i-500-schema"></span> Schema
   
  

[AiChatAIInternalServerErrorBody](#ai-chat-a-i-internal-server-error-body)

###### Inlined models

**<span id="ai-chat-a-i-bad-request-body"></span> AiChatAIBadRequestBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `400`| HTTP status code | `400` |
| Message | string| `string` |  | |  |  |



**<span id="ai-chat-a-i-internal-server-error-body"></span> AiChatAIInternalServerErrorBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `500`| HTTP status code | `500` |
| Message | string| `string` |  | |  |  |



**<span id="ai-chat-a-i-not-found-body"></span> AiChatAINotFoundBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `404`| HTTP status code | `404` |
| Message | string| `string` |  | |  |  |



**<span id="ai-chat-a-i-o-k-body"></span> AiChatAIOKBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `204`| HTTP status code | `204` |
| Message | string| `string` |  | |  |  |



### <span id="ai-chat-session-usage"></span> ai chat session usage (*aiChatSessionUsage*)

```
GET /api/chat/session/usage
```

Endpoint to get token usage statistics for the current user session

#### URI Schemes
  * http
  * https

#### Produces
  * application/json

#### All responses
| Code | Status | Description | Has headers | Schema |
|------|--------|-------------|:-----------:|--------|
| [200](#ai-chat-session-usage-200) | OK | NoContent: the response is empty |  | [schema](#ai-chat-session-usage-200-schema) |
| [400](#ai-chat-session-usage-400) | Bad Request | BadRequestError: the client request is incorrect |  | [schema](#ai-chat-session-usage-400-schema) |
| [500](#ai-chat-session-usage-500) | Internal Server Error | A Internal is the error message that means something has gone wrong |  | [schema](#ai-chat-session-usage-500-schema) |

#### Responses


##### <span id="ai-chat-session-usage-200"></span> 200 - NoContent: the response is empty
Status: OK

###### <span id="ai-chat-session-usage-200-schema"></span> Schema
   
  

[AiChatSessionUsageOKBody](#ai-chat-session-usage-o-k-body)

##### <span id="ai-chat-session-usage-400"></span> 400 - BadRequestError: the client request is incorrect
Status: Bad Request

###### <span id="ai-chat-session-usage-400-schema"></span> Schema
   
  

[AiChatSessionUsageBadRequestBody](#ai-chat-session-usage-bad-request-body)

##### <span id="ai-chat-session-usage-500"></span> 500 - A Internal is the error message that means something has gone wrong
Status: Internal Server Error

###### <span id="ai-chat-session-usage-500-schema"></span> Schema
   
  

[AiChatSessionUsageInternalServerErrorBody](#ai-chat-session-usage-internal-server-error-body)

###### Inlined models

**<span id="ai-chat-session-usage-bad-request-body"></span> AiChatSessionUsageBadRequestBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `400`| HTTP status code | `400` |
| Message | string| `string` |  | |  |  |



**<span id="ai-chat-session-usage-internal-server-error-body"></span> AiChatSessionUsageInternalServerErrorBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `500`| HTTP status code | `500` |
| Message | string| `string` |  | |  |  |



**<span id="ai-chat-session-usage-o-k-body"></span> AiChatSessionUsageOKBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `204`| HTTP status code | `204` |
| Message | string| `string` |  | |  |  |



### <span id="app-dashboard"></span> app dashboard (*appDashboard*)

```
GET /api/namespaces/{namespace}/apps/{app}/dashboard
```

Endpoint to fetch dashboard to be displayed, related to a single app

#### URI Schemes
  * http
  * https

#### Produces
  * application/json

#### Parameters

| Name | Source | Type | Go type | Separator | Required | Default | Description |
|------|--------|------|---------|-----------| :------: |---------|-------------|
| app | `path` | string | `string` |  | ✓ |  | The app name (label value). |
| namespace | `path` | string | `string` |  | ✓ |  | The namespace name. |
| avg | `query` | boolean | `bool` |  |  | `true` | Flag for fetching histogram average. Default is true. |
| byLabels[] | `query` | []string | `[]string` |  |  |  | List of labels to use for grouping metrics (via Prometheus 'by' clause). |
| direction | `query` | string | `string` |  |  | `"outbound"` | Traffic direction: 'inbound' or 'outbound'. |
| duration | `query` | int64 (formatted integer) | `int64` |  |  | `1800` | Duration of the query period, in seconds. |
| quantiles[] | `query` | []string | `[]string` |  |  |  | List of quantiles to fetch. Fetch no quantiles when empty. Ex: [0.5, 0.95, 0.99]. |
| rateFunc | `query` | string | `string` |  |  | `"rate"` | Prometheus function used to calculate rate: 'rate' or 'irate'. |
| rateInterval | `query` | string | `string` |  |  | `"1m"` | Interval used for rate and histogram calculation. |
| reporter | `query` | string | `string` |  |  | `"source"` | Istio telemetry reporter: 'source' or 'destination'. |
| requestProtocol | `query` | string | `string` |  |  | `"all protocols"` | Desired request protocol for the telemetry: For example, 'http' or 'grpc'. |
| step | `query` | int64 (formatted integer) | `int64` |  |  | `15` | Step between [graph] datapoints, in seconds. |

#### All responses
| Code | Status | Description | Has headers | Schema |
|------|--------|-------------|:-----------:|--------|
| [200](#app-dashboard-200) | OK | Dashboard response model |  | [schema](#app-dashboard-200-schema) |
| [400](#app-dashboard-400) | Bad Request | BadRequestError: the client request is incorrect |  | [schema](#app-dashboard-400-schema) |
| [403](#app-dashboard-403) | Forbidden | ForbiddenError: the client is not allowed to access the requested namespace |  | [schema](#app-dashboard-403-schema) |
| [503](#app-dashboard-503) | Service Unavailable | A Internal is the error message that means something has gone wrong |  | [schema](#app-dashboard-503-schema) |

#### Responses


##### <span id="app-dashboard-200"></span> 200 - Dashboard response model
Status: OK

###### <span id="app-dashboard-200-schema"></span> Schema
   
  

[MonitoringDashboard](#monitoring-dashboard)

##### <span id="app-dashboard-400"></span> 400 - BadRequestError: the client request is incorrect
Status: Bad Request

###### <span id="app-dashboard-400-schema"></span> Schema
   
  

[AppDashboardBadRequestBody](#app-dashboard-bad-request-body)

##### <span id="app-dashboard-403"></span> 403 - ForbiddenError: the client is not allowed to access the requested namespace
Status: Forbidden

###### <span id="app-dashboard-403-schema"></span> Schema
   
  

[AppDashboardForbiddenBody](#app-dashboard-forbidden-body)

##### <span id="app-dashboard-503"></span> 503 - A Internal is the error message that means something has gone wrong
Status: Service Unavailable

###### <span id="app-dashboard-503-schema"></span> Schema
   
  

[AppDashboardServiceUnavailableBody](#app-dashboard-service-unavailable-body)

###### Inlined models

**<span id="app-dashboard-bad-request-body"></span> AppDashboardBadRequestBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `400`| HTTP status code | `400` |
| Message | string| `string` |  | |  |  |



**<span id="app-dashboard-forbidden-body"></span> AppDashboardForbiddenBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `403`| HTTP status code | `403` |
| Message | string| `string` |  | |  |  |



**<span id="app-dashboard-service-unavailable-body"></span> AppDashboardServiceUnavailableBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `503`| HTTP status code | `503` |
| Message | string| `string` |  | |  |  |



### <span id="app-details"></span> app details (*appDetails*)

```
GET /api/namespaces/{namespace}/apps/{app}
```

Endpoint to get the app details

#### URI Schemes
  * http
  * https

#### Produces
  * application/json

#### Parameters

| Name | Source | Type | Go type | Separator | Required | Default | Description |
|------|--------|------|---------|-----------| :------: |---------|-------------|
| app | `path` | string | `string` |  | ✓ |  | The app name (label value). |
| namespace | `path` | string | `string` |  | ✓ |  | The namespace name. |

#### All responses
| Code | Status | Description | Has headers | Schema |
|------|--------|-------------|:-----------:|--------|
| [200](#app-details-200) | OK | Detailed information of an specific app |  | [schema](#app-details-200-schema) |
| [403](#app-details-403) | Forbidden | ForbiddenError: the client is not allowed to access the requested namespace |  | [schema](#app-details-403-schema) |
| [404](#app-details-404) | Not Found | A NotFoundError is the error message that is generated when server could not find what was requested. |  | [schema](#app-details-404-schema) |
| [500](#app-details-500) | Internal Server Error | A Internal is the error message that means something has gone wrong |  | [schema](#app-details-500-schema) |

#### Responses


##### <span id="app-details-200"></span> 200 - Detailed information of an specific app
Status: OK

###### <span id="app-details-200-schema"></span> Schema
   
  

[App](#app)

##### <span id="app-details-403"></span> 403 - ForbiddenError: the client is not allowed to access the requested namespace
Status: Forbidden

###### <span id="app-details-403-schema"></span> Schema
   
  

[AppDetailsForbiddenBody](#app-details-forbidden-body)

##### <span id="app-details-404"></span> 404 - A NotFoundError is the error message that is generated when server could not find what was requested.
Status: Not Found

###### <span id="app-details-404-schema"></span> Schema
   
  

[AppDetailsNotFoundBody](#app-details-not-found-body)

##### <span id="app-details-500"></span> 500 - A Internal is the error message that means something has gone wrong
Status: Internal Server Error

###### <span id="app-details-500-schema"></span> Schema
   
  

[AppDetailsInternalServerErrorBody](#app-details-internal-server-error-body)

###### Inlined models

**<span id="app-details-forbidden-body"></span> AppDetailsForbiddenBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `403`| HTTP status code | `403` |
| Message | string| `string` |  | |  |  |



**<span id="app-details-internal-server-error-body"></span> AppDetailsInternalServerErrorBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `500`| HTTP status code | `500` |
| Message | string| `string` |  | |  |  |



**<span id="app-details-not-found-body"></span> AppDetailsNotFoundBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `404`| HTTP status code | `404` |
| Message | string| `string` |  | |  |  |



### <span id="app-health-status-history"></span> app health status history (*appHealthStatusHistory*)

```
GET /api/namespaces/{namespace}/apps/{app}/health/history
```

Endpoint to fetch kiali_health_status time series for an app

#### URI Schemes
  * http
  * https

#### Produces
  * application/json

#### Parameters

| Name | Source | Type | Go type | Separator | Required | Default | Description |
|------|--------|------|---------|-----------| :------: |---------|-------------|
| app | `path` | string | `string` |  | ✓ |  | The app name (label value). |
| namespace | `path` | string | `string` |  | ✓ |  | The namespace name. |
| clusterName | `query` | string | `string` |  |  |  | Cluster name |
| duration | `query` | int64 (formatted integer) | `int64` |  |  | `1800` | Duration of the query period, in seconds. |
| queryTime | `query` | string | `string` |  |  | `"now"` | Unix time (seconds) for query such that time range is [queryTime-duration..queryTime]. Default is now. |
| step | `query` | int64 (formatted integer) | `int64` |  |  | `15` | Step between datapoints, in seconds. |

#### All responses
| Code | Status | Description | Has headers | Schema |
|------|--------|-------------|:-----------:|--------|
| [200](#app-health-status-history-200) | OK | Metrics response model |  | [schema](#app-health-status-history-200-schema) |
| [400](#app-health-status-history-400) | Bad Request | BadRequestError: the client request is incorrect |  | [schema](#app-health-status-history-400-schema) |
| [403](#app-health-status-history-403) | Forbidden | ForbiddenError: the client is not allowed to access the requested namespace |  | [schema](#app-health-status-history-403-schema) |
| [503](#app-health-status-history-503) | Service Unavailable | A Internal is the error message that means something has gone wrong |  | [schema](#app-health-status-history-503-schema) |

#### Responses


##### <span id="app-health-status-history-200"></span> 200 - Metrics response model
Status: OK

###### <span id="app-health-status-history-200-schema"></span> Schema
   
  

map of [Metric](#metric)

##### <span id="app-health-status-history-400"></span> 400 - BadRequestError: the client request is incorrect
Status: Bad Request

###### <span id="app-health-status-history-400-schema"></span> Schema
   
  

[AppHealthStatusHistoryBadRequestBody](#app-health-status-history-bad-request-body)

##### <span id="app-health-status-history-403"></span> 403 - ForbiddenError: the client is not allowed to access the requested namespace
Status: Forbidden

###### <span id="app-health-status-history-403-schema"></span> Schema
   
  

[AppHealthStatusHistoryForbiddenBody](#app-health-status-history-forbidden-body)

##### <span id="app-health-status-history-503"></span> 503 - A Internal is the error message that means something has gone wrong
Status: Service Unavailable

###### <span id="app-health-status-history-503-schema"></span> Schema
   
  

[AppHealthStatusHistoryServiceUnavailableBody](#app-health-status-history-service-unavailable-body)

###### Inlined models

**<span id="app-health-status-history-bad-request-body"></span> AppHealthStatusHistoryBadRequestBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `400`| HTTP status code | `400` |
| Message | string| `string` |  | |  |  |



**<span id="app-health-status-history-forbidden-body"></span> AppHealthStatusHistoryForbiddenBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `403`| HTTP status code | `403` |
| Message | string| `string` |  | |  |  |



**<span id="app-health-status-history-service-unavailable-body"></span> AppHealthStatusHistoryServiceUnavailableBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `503`| HTTP status code | `503` |
| Message | string| `string` |  | |  |  |



### <span id="app-list"></span> app list (*appList*)

```
GET /api/clusters/apps
```

Endpoint to get the list of apps for a cluster

#### URI Schemes
  * http
  * https

#### Produces
  * application/json

#### Parameters

| Name | Source | Type | Go type | Separator | Required | Default | Description |
|------|--------|------|---------|-----------| :------: |---------|-------------|
| QueryTime | `query` | date-time (formatted string) | `strfmt.DateTime` |  |  |  | The time to use for the prometheus query |
| app | `query` | string | `string` |  |  |  |  |
| clusterName | `query` | string | `string` |  |  |  | Cluster name |
| health | `query` | boolean | `bool` |  |  |  | Optional |
| istioResources | `query` | boolean | `bool` |  |  |  |  |
| namespace | `query` | string | `string` |  | ✓ |  | The namespace name. |
| rateInterval | `query` | string | `string` |  |  | `"5m (matches health_config.compute.duration)"` | The rate interval used for fetching error rate |

#### All responses
| Code | Status | Description | Has headers | Schema |
|------|--------|-------------|:-----------:|--------|
| [200](#app-list-200) | OK | Listing all apps in the namespace |  | [schema](#app-list-200-schema) |
| [500](#app-list-500) | Internal Server Error | A Internal is the error message that means something has gone wrong |  | [schema](#app-list-500-schema) |

#### Responses


##### <span id="app-list-200"></span> 200 - Listing all apps in the namespace
Status: OK

###### <span id="app-list-200-schema"></span> Schema
   
  

[AppList](#app-list)

##### <span id="app-list-500"></span> 500 - A Internal is the error message that means something has gone wrong
Status: Internal Server Error

###### <span id="app-list-500-schema"></span> Schema
   
  

[AppListInternalServerErrorBody](#app-list-internal-server-error-body)

###### Inlined models

**<span id="app-list-internal-server-error-body"></span> AppListInternalServerErrorBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `500`| HTTP status code | `500` |
| Message | string| `string` |  | |  |  |



### <span id="app-metrics"></span> app metrics (*appMetrics*)

```
GET /api/namespaces/{namespace}/apps/{app}/metrics
```

Endpoint to fetch metrics to be displayed, related to a single app

#### URI Schemes
  * http
  * https

#### Produces
  * application/json

#### Parameters

| Name | Source | Type | Go type | Separator | Required | Default | Description |
|------|--------|------|---------|-----------| :------: |---------|-------------|
| app | `path` | string | `string` |  | ✓ |  | The app name (label value). |
| namespace | `path` | string | `string` |  | ✓ |  | The namespace name. |
| avg | `query` | boolean | `bool` |  |  | `true` | Flag for fetching histogram average. Default is true. |
| byLabels[] | `query` | []string | `[]string` |  |  |  | List of labels to use for grouping metrics (via Prometheus 'by' clause). |
| direction | `query` | string | `string` |  |  | `"outbound"` | Traffic direction: 'inbound' or 'outbound'. |
| duration | `query` | int64 (formatted integer) | `int64` |  |  | `1800` | Duration of the query period, in seconds. |
| filters[] | `query` | []string | `[]string` |  |  |  | List of metrics to fetch. Fetch all metrics when empty. List entries are Kiali internal metric names. |
| quantiles[] | `query` | []string | `[]string` |  |  |  | List of quantiles to fetch. Fetch no quantiles when empty. Ex: [0.5, 0.95, 0.99]. |
| rateFunc | `query` | string | `string` |  |  | `"rate"` | Prometheus function used to calculate rate: 'rate' or 'irate'. |
| rateInterval | `query` | string | `string` |  |  | `"1m"` | Interval used for rate and histogram calculation. |
| reporter | `query` | string | `string` |  |  | `"source"` | Istio telemetry reporter: 'source' or 'destination'. |
| requestProtocol | `query` | string | `string` |  |  | `"all protocols"` | Desired request protocol for the telemetry: For example, 'http' or 'grpc'. |
| step | `query` | int64 (formatted integer) | `int64` |  |  | `15` | Step between [graph] datapoints, in seconds. |
| version | `query` | string | `string` |  |  |  | Filters metrics by the specified version |

#### All responses
| Code | Status | Description | Has headers | Schema |
|------|--------|-------------|:-----------:|--------|
| [200](#app-metrics-200) | OK | Metrics response model |  | [schema](#app-metrics-200-schema) |
| [400](#app-metrics-400) | Bad Request | BadRequestError: the client request is incorrect |  | [schema](#app-metrics-400-schema) |
| [403](#app-metrics-403) | Forbidden | ForbiddenError: the client is not allowed to access the requested namespace |  | [schema](#app-metrics-403-schema) |
| [503](#app-metrics-503) | Service Unavailable | A Internal is the error message that means something has gone wrong |  | [schema](#app-metrics-503-schema) |

#### Responses


##### <span id="app-metrics-200"></span> 200 - Metrics response model
Status: OK

###### <span id="app-metrics-200-schema"></span> Schema
   
  

map of [Metric](#metric)

##### <span id="app-metrics-400"></span> 400 - BadRequestError: the client request is incorrect
Status: Bad Request

###### <span id="app-metrics-400-schema"></span> Schema
   
  

[AppMetricsBadRequestBody](#app-metrics-bad-request-body)

##### <span id="app-metrics-403"></span> 403 - ForbiddenError: the client is not allowed to access the requested namespace
Status: Forbidden

###### <span id="app-metrics-403-schema"></span> Schema
   
  

[AppMetricsForbiddenBody](#app-metrics-forbidden-body)

##### <span id="app-metrics-503"></span> 503 - A Internal is the error message that means something has gone wrong
Status: Service Unavailable

###### <span id="app-metrics-503-schema"></span> Schema
   
  

[AppMetricsServiceUnavailableBody](#app-metrics-service-unavailable-body)

###### Inlined models

**<span id="app-metrics-bad-request-body"></span> AppMetricsBadRequestBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `400`| HTTP status code | `400` |
| Message | string| `string` |  | |  |  |



**<span id="app-metrics-forbidden-body"></span> AppMetricsForbiddenBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `403`| HTTP status code | `403` |
| Message | string| `string` |  | |  |  |



**<span id="app-metrics-service-unavailable-body"></span> AppMetricsServiceUnavailableBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `503`| HTTP status code | `503` |
| Message | string| `string` |  | |  |  |



### <span id="app-spans"></span> app spans (*appSpans*)

```
GET /api/namespaces/{namespace}/apps/{app}/spans
```

Endpoint to get Tracing spans for a given app

#### URI Schemes
  * http
  * https

#### Produces
  * application/json

#### Parameters

| Name | Source | Type | Go type | Separator | Required | Default | Description |
|------|--------|------|---------|-----------| :------: |---------|-------------|
| app | `path` | string | `string` |  | ✓ |  | The app name (label value). |
| namespace | `path` | string | `string` |  | ✓ |  | The namespace name. |

#### All responses
| Code | Status | Description | Has headers | Schema |
|------|--------|-------------|:-----------:|--------|
| [200](#app-spans-200) | OK | Listing all the information related to a Span |  | [schema](#app-spans-200-schema) |
| [403](#app-spans-403) | Forbidden | ForbiddenError: the client is not allowed to access the requested namespace |  | [schema](#app-spans-403-schema) |
| [500](#app-spans-500) | Internal Server Error | A Internal is the error message that means something has gone wrong |  | [schema](#app-spans-500-schema) |

#### Responses


##### <span id="app-spans-200"></span> 200 - Listing all the information related to a Span
Status: OK

###### <span id="app-spans-200-schema"></span> Schema
   
  

[][TracingSpan](#tracing-span)

##### <span id="app-spans-403"></span> 403 - ForbiddenError: the client is not allowed to access the requested namespace
Status: Forbidden

###### <span id="app-spans-403-schema"></span> Schema
   
  

[AppSpansForbiddenBody](#app-spans-forbidden-body)

##### <span id="app-spans-500"></span> 500 - A Internal is the error message that means something has gone wrong
Status: Internal Server Error

###### <span id="app-spans-500-schema"></span> Schema
   
  

[AppSpansInternalServerErrorBody](#app-spans-internal-server-error-body)

###### Inlined models

**<span id="app-spans-forbidden-body"></span> AppSpansForbiddenBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `403`| HTTP status code | `403` |
| Message | string| `string` |  | |  |  |



**<span id="app-spans-internal-server-error-body"></span> AppSpansInternalServerErrorBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `500`| HTTP status code | `500` |
| Message | string| `string` |  | |  |  |



### <span id="app-traces"></span> app traces (*appTraces*)

```
GET /api/namespaces/{namespace}/apps/{app}/traces
```

Endpoint to get the traces of a given app

#### URI Schemes
  * http
  * https

#### Produces
  * application/json

#### Parameters

| Name | Source | Type | Go type | Separator | Required | Default | Description |
|------|--------|------|---------|-----------| :------: |---------|-------------|
| app | `path` | string | `string` |  | ✓ |  | The app name (label value). |
| namespace | `path` | string | `string` |  | ✓ |  | The namespace name. |

#### All responses
| Code | Status | Description | Has headers | Schema |
|------|--------|-------------|:-----------:|--------|
| [200](#app-traces-200) | OK | Listing all the information related to a Trace |  | [schema](#app-traces-200-schema) |
| [403](#app-traces-403) | Forbidden | ForbiddenError: the client is not allowed to access the requested namespace |  | [schema](#app-traces-403-schema) |
| [404](#app-traces-404) | Not Found | A NotFoundError is the error message that is generated when server could not find what was requested. |  | [schema](#app-traces-404-schema) |
| [500](#app-traces-500) | Internal Server Error | A Internal is the error message that means something has gone wrong |  | [schema](#app-traces-500-schema) |

#### Responses


##### <span id="app-traces-200"></span> 200 - Listing all the information related to a Trace
Status: OK

###### <span id="app-traces-200-schema"></span> Schema
   
  

[][Trace](#trace)

##### <span id="app-traces-403"></span> 403 - ForbiddenError: the client is not allowed to access the requested namespace
Status: Forbidden

###### <span id="app-traces-403-schema"></span> Schema
   
  

[AppTracesForbiddenBody](#app-traces-forbidden-body)

##### <span id="app-traces-404"></span> 404 - A NotFoundError is the error message that is generated when server could not find what was requested.
Status: Not Found

###### <span id="app-traces-404-schema"></span> Schema
   
  

[AppTracesNotFoundBody](#app-traces-not-found-body)

##### <span id="app-traces-500"></span> 500 - A Internal is the error message that means something has gone wrong
Status: Internal Server Error

###### <span id="app-traces-500-schema"></span> Schema
   
  

[AppTracesInternalServerErrorBody](#app-traces-internal-server-error-body)

###### Inlined models

**<span id="app-traces-forbidden-body"></span> AppTracesForbiddenBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `403`| HTTP status code | `403` |
| Message | string| `string` |  | |  |  |



**<span id="app-traces-internal-server-error-body"></span> AppTracesInternalServerErrorBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `500`| HTTP status code | `500` |
| Message | string| `string` |  | |  |  |



**<span id="app-traces-not-found-body"></span> AppTracesNotFoundBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `404`| HTTP status code | `404` |
| Message | string| `string` |  | |  |  |



### <span id="authenticate"></span> authenticate (*authenticate*)

```
GET /api/authenticate
```

Endpoint to authenticate the user

#### URI Schemes
  * http
  * https

#### Produces
  * application/json

#### Security Requirements
  * authorization

#### All responses
| Code | Status | Description | Has headers | Schema |
|------|--------|-------------|:-----------:|--------|
| [200](#authenticate-200) | OK | HTTP status code 200 and userGenerated model in data |  | [schema](#authenticate-200-schema) |
| [500](#authenticate-500) | Internal Server Error | A Internal is the error message that means something has gone wrong |  | [schema](#authenticate-500-schema) |

#### Responses


##### <span id="authenticate-200"></span> 200 - HTTP status code 200 and userGenerated model in data
Status: OK

###### <span id="authenticate-200-schema"></span> Schema
   
  

[UserSessionData](#user-session-data)

##### <span id="authenticate-500"></span> 500 - A Internal is the error message that means something has gone wrong
Status: Internal Server Error

###### <span id="authenticate-500-schema"></span> Schema
   
  

[AuthenticateInternalServerErrorBody](#authenticate-internal-server-error-body)

###### Inlined models

**<span id="authenticate-internal-server-error-body"></span> AuthenticateInternalServerErrorBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `500`| HTTP status code | `500` |
| Message | string| `string` |  | |  |  |



### <span id="authentication-info"></span> authentication info (*authenticationInfo*)

```
GET /api/auth/info
```

Endpoint to get login info, such as strategy, authorization endpoints
for OAuth providers and so on.

#### URI Schemes
  * http
  * https

#### Consumes
  * application/json

#### Produces
  * application/json

#### All responses
| Code | Status | Description | Has headers | Schema |
|------|--------|-------------|:-----------:|--------|
| [200](#authentication-info-200) | OK | Return the information necessary to handle login | ✓ | [schema](#authentication-info-200-schema) |
| [500](#authentication-info-500) | Internal Server Error | A Internal is the error message that means something has gone wrong |  | [schema](#authentication-info-500-schema) |

#### Responses


##### <span id="authentication-info-200"></span> 200 - Return the information necessary to handle login
Status: OK

###### <span id="authentication-info-200-schema"></span> Schema

###### Response headers

| Name | Type | Go type | Separator | Default | Description |
|------|------|---------|-----------|---------|-------------|
| AuthorizationEndpoint | string | `string` |  |  |  |
| Strategy | string | `string` |  |  |  |

##### <span id="authentication-info-500"></span> 500 - A Internal is the error message that means something has gone wrong
Status: Internal Server Error

###### <span id="authentication-info-500-schema"></span> Schema
   
  

[AuthenticationInfoInternalServerErrorBody](#authentication-info-internal-server-error-body)

###### Inlined models

**<span id="authentication-info-internal-server-error-body"></span> AuthenticationInfoInternalServerErrorBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `500`| HTTP status code | `500` |
| Message | string| `string` |  | |  |  |



### <span id="chat-prompts"></span> chat prompts (*chatPrompts*)

```
GET /api/chat/prompts
```

Endpoint to list built-in chatbot prompt suggestions

#### URI Schemes
  * http
  * https

#### Produces
  * application/json

#### All responses
| Code | Status | Description | Has headers | Schema |
|------|--------|-------------|:-----------:|--------|
| [500](#chat-prompts-500) | Internal Server Error | A Internal is the error message that means something has gone wrong |  | [schema](#chat-prompts-500-schema) |

#### Responses


##### <span id="chat-prompts-500"></span> 500 - A Internal is the error message that means something has gone wrong
Status: Internal Server Error

###### <span id="chat-prompts-500-schema"></span> Schema
   
  

[ChatPromptsInternalServerErrorBody](#chat-prompts-internal-server-error-body)

###### Inlined models

**<span id="chat-prompts-internal-server-error-body"></span> ChatPromptsInternalServerErrorBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `500`| HTTP status code | `500` |
| Message | string| `string` |  | |  |  |



### <span id="clusters-metrics"></span> clusters metrics (*clustersMetrics*)

```
GET /api/clusters/metrics
```

Endpoint to fetch metrics to be displayed, related to all provided namespaces of provided cluster

#### URI Schemes
  * http
  * https

#### Produces
  * application/json

#### All responses
| Code | Status | Description | Has headers | Schema |
|------|--------|-------------|:-----------:|--------|
| [200](#clusters-metrics-200) | OK | Metrics response model |  | [schema](#clusters-metrics-200-schema) |
| [400](#clusters-metrics-400) | Bad Request | BadRequestError: the client request is incorrect |  | [schema](#clusters-metrics-400-schema) |
| [503](#clusters-metrics-503) | Service Unavailable | A Internal is the error message that means something has gone wrong |  | [schema](#clusters-metrics-503-schema) |

#### Responses


##### <span id="clusters-metrics-200"></span> 200 - Metrics response model
Status: OK

###### <span id="clusters-metrics-200-schema"></span> Schema
   
  

map of [Metric](#metric)

##### <span id="clusters-metrics-400"></span> 400 - BadRequestError: the client request is incorrect
Status: Bad Request

###### <span id="clusters-metrics-400-schema"></span> Schema
   
  

[ClustersMetricsBadRequestBody](#clusters-metrics-bad-request-body)

##### <span id="clusters-metrics-503"></span> 503 - A Internal is the error message that means something has gone wrong
Status: Service Unavailable

###### <span id="clusters-metrics-503-schema"></span> Schema
   
  

[ClustersMetricsServiceUnavailableBody](#clusters-metrics-service-unavailable-body)

###### Inlined models

**<span id="clusters-metrics-bad-request-body"></span> ClustersMetricsBadRequestBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `400`| HTTP status code | `400` |
| Message | string| `string` |  | |  |  |



**<span id="clusters-metrics-service-unavailable-body"></span> ClustersMetricsServiceUnavailableBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `503`| HTTP status code | `503` |
| Message | string| `string` |  | |  |  |



### <span id="control-plane-metrics"></span> control plane metrics (*controlPlaneMetrics*)

```
GET /api/namespaces/{namespace}/controlplanes/{controlplane}/metrics
```

Endpoint to fetch metrics to be displayed, related to a single control plane

#### URI Schemes
  * http
  * https

#### Produces
  * application/json

#### Parameters

| Name | Source | Type | Go type | Separator | Required | Default | Description |
|------|--------|------|---------|-----------| :------: |---------|-------------|
| controlplane | `path` | string | `string` |  | ✓ |  | The control plane for metric collection, etc. |
| namespace | `path` | string | `string` |  | ✓ |  | The namespace name. |

#### All responses
| Code | Status | Description | Has headers | Schema |
|------|--------|-------------|:-----------:|--------|
| [200](#control-plane-metrics-200) | OK | Metrics response model |  | [schema](#control-plane-metrics-200-schema) |
| [400](#control-plane-metrics-400) | Bad Request | BadRequestError: the client request is incorrect |  | [schema](#control-plane-metrics-400-schema) |
| [403](#control-plane-metrics-403) | Forbidden | ForbiddenError: the client is not allowed to access the requested namespace |  | [schema](#control-plane-metrics-403-schema) |
| [503](#control-plane-metrics-503) | Service Unavailable | A Internal is the error message that means something has gone wrong |  | [schema](#control-plane-metrics-503-schema) |

#### Responses


##### <span id="control-plane-metrics-200"></span> 200 - Metrics response model
Status: OK

###### <span id="control-plane-metrics-200-schema"></span> Schema
   
  

map of [Metric](#metric)

##### <span id="control-plane-metrics-400"></span> 400 - BadRequestError: the client request is incorrect
Status: Bad Request

###### <span id="control-plane-metrics-400-schema"></span> Schema
   
  

[ControlPlaneMetricsBadRequestBody](#control-plane-metrics-bad-request-body)

##### <span id="control-plane-metrics-403"></span> 403 - ForbiddenError: the client is not allowed to access the requested namespace
Status: Forbidden

###### <span id="control-plane-metrics-403-schema"></span> Schema
   
  

[ControlPlaneMetricsForbiddenBody](#control-plane-metrics-forbidden-body)

##### <span id="control-plane-metrics-503"></span> 503 - A Internal is the error message that means something has gone wrong
Status: Service Unavailable

###### <span id="control-plane-metrics-503-schema"></span> Schema
   
  

[ControlPlaneMetricsServiceUnavailableBody](#control-plane-metrics-service-unavailable-body)

###### Inlined models

**<span id="control-plane-metrics-bad-request-body"></span> ControlPlaneMetricsBadRequestBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `400`| HTTP status code | `400` |
| Message | string| `string` |  | |  |  |



**<span id="control-plane-metrics-forbidden-body"></span> ControlPlaneMetricsForbiddenBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `403`| HTTP status code | `403` |
| Message | string| `string` |  | |  |  |



**<span id="control-plane-metrics-service-unavailable-body"></span> ControlPlaneMetricsServiceUnavailableBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `503`| HTTP status code | `503` |
| Message | string| `string` |  | |  |  |



### <span id="controlplanes"></span> controlplanes (*controlplanes*)

```
GET /api/mesh/controlplanes
```

The backing JSON for mesh controlplanes

#### URI Schemes
  * http
  * https

#### Produces
  * application/json

#### All responses
| Code | Status | Description | Has headers | Schema |
|------|--------|-------------|:-----------:|--------|
| [200](#controlplanes-200) | OK | HTTP status code 200 and graph Config in data |  | [schema](#controlplanes-200-schema) |
| [400](#controlplanes-400) | Bad Request | BadRequestError: the client request is incorrect |  | [schema](#controlplanes-400-schema) |
| [500](#controlplanes-500) | Internal Server Error | A Internal is the error message that means something has gone wrong |  | [schema](#controlplanes-500-schema) |

#### Responses


##### <span id="controlplanes-200"></span> 200 - HTTP status code 200 and graph Config in data
Status: OK

###### <span id="controlplanes-200-schema"></span> Schema
   
  

[CommonConfig](#common-config)

##### <span id="controlplanes-400"></span> 400 - BadRequestError: the client request is incorrect
Status: Bad Request

###### <span id="controlplanes-400-schema"></span> Schema
   
  

[ControlplanesBadRequestBody](#controlplanes-bad-request-body)

##### <span id="controlplanes-500"></span> 500 - A Internal is the error message that means something has gone wrong
Status: Internal Server Error

###### <span id="controlplanes-500-schema"></span> Schema
   
  

[ControlplanesInternalServerErrorBody](#controlplanes-internal-server-error-body)

###### Inlined models

**<span id="controlplanes-bad-request-body"></span> ControlplanesBadRequestBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `400`| HTTP status code | `400` |
| Message | string| `string` |  | |  |  |



**<span id="controlplanes-internal-server-error-body"></span> ControlplanesInternalServerErrorBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `500`| HTTP status code | `500` |
| Message | string| `string` |  | |  |  |



### <span id="custom-dashboard"></span> custom dashboard (*customDashboard*)

```
GET /api/namespaces/{namespace}/customdashboard/{dashboard}
```

Endpoint to fetch a custom dashboard

#### URI Schemes
  * http
  * https

#### Produces
  * application/json

#### Parameters

| Name | Source | Type | Go type | Separator | Required | Default | Description |
|------|--------|------|---------|-----------| :------: |---------|-------------|
| dashboard | `path` | string | `string` |  | ✓ |  | The dashboard resource name. |
| namespace | `path` | string | `string` |  | ✓ |  | The namespace name. |
| additionalLabels | `query` | string | `string` |  |  |  | In custom dashboards, additional labels that are made available for grouping in the UI, regardless which aggregations are defined in the MonitoringDashboard CR |
| avg | `query` | boolean | `bool` |  |  | `true` | Flag for fetching histogram average. Default is true. |
| byLabels[] | `query` | []string | `[]string` |  |  |  | List of labels to use for grouping metrics (via Prometheus 'by' clause). |
| duration | `query` | int64 (formatted integer) | `int64` |  |  | `1800` | Duration of the query period, in seconds. |
| labelsFilters | `query` | string | `string` |  |  |  | In custom dashboards, labels filters to use when fetching metrics, formatted as key:value pairs. Ex: "app:foo,version:bar". |
| quantiles[] | `query` | []string | `[]string` |  |  |  | List of quantiles to fetch. Fetch no quantiles when empty. Ex: [0.5, 0.95, 0.99]. |
| rateFunc | `query` | string | `string` |  |  | `"rate"` | Prometheus function used to calculate rate: 'rate' or 'irate'. |
| rateInterval | `query` | string | `string` |  |  | `"1m"` | Interval used for rate and histogram calculation. |
| step | `query` | int64 (formatted integer) | `int64` |  |  | `15` | Step between [graph] datapoints, in seconds. |

#### All responses
| Code | Status | Description | Has headers | Schema |
|------|--------|-------------|:-----------:|--------|
| [200](#custom-dashboard-200) | OK | Dashboard response model |  | [schema](#custom-dashboard-200-schema) |
| [400](#custom-dashboard-400) | Bad Request | BadRequestError: the client request is incorrect |  | [schema](#custom-dashboard-400-schema) |
| [403](#custom-dashboard-403) | Forbidden | ForbiddenError: the client is not allowed to access the requested namespace |  | [schema](#custom-dashboard-403-schema) |
| [503](#custom-dashboard-503) | Service Unavailable | A Internal is the error message that means something has gone wrong |  | [schema](#custom-dashboard-503-schema) |

#### Responses


##### <span id="custom-dashboard-200"></span> 200 - Dashboard response model
Status: OK

###### <span id="custom-dashboard-200-schema"></span> Schema
   
  

[MonitoringDashboard](#monitoring-dashboard)

##### <span id="custom-dashboard-400"></span> 400 - BadRequestError: the client request is incorrect
Status: Bad Request

###### <span id="custom-dashboard-400-schema"></span> Schema
   
  

[CustomDashboardBadRequestBody](#custom-dashboard-bad-request-body)

##### <span id="custom-dashboard-403"></span> 403 - ForbiddenError: the client is not allowed to access the requested namespace
Status: Forbidden

###### <span id="custom-dashboard-403-schema"></span> Schema
   
  

[CustomDashboardForbiddenBody](#custom-dashboard-forbidden-body)

##### <span id="custom-dashboard-503"></span> 503 - A Internal is the error message that means something has gone wrong
Status: Service Unavailable

###### <span id="custom-dashboard-503-schema"></span> Schema
   
  

[CustomDashboardServiceUnavailableBody](#custom-dashboard-service-unavailable-body)

###### Inlined models

**<span id="custom-dashboard-bad-request-body"></span> CustomDashboardBadRequestBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `400`| HTTP status code | `400` |
| Message | string| `string` |  | |  |  |



**<span id="custom-dashboard-forbidden-body"></span> CustomDashboardForbiddenBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `403`| HTTP status code | `403` |
| Message | string| `string` |  | |  |  |



**<span id="custom-dashboard-service-unavailable-body"></span> CustomDashboardServiceUnavailableBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `503`| HTTP status code | `503` |
| Message | string| `string` |  | |  |  |



### <span id="error-traces"></span> error traces (*errorTraces*)

```
GET /api/namespaces/{namespace}/apps/{app}/errortraces
```

Endpoint to get the number of traces in error for a given service

#### URI Schemes
  * http
  * https

#### Produces
  * application/json

#### Parameters

| Name | Source | Type | Go type | Separator | Required | Default | Description |
|------|--------|------|---------|-----------| :------: |---------|-------------|
| app | `path` | string | `string` |  | ✓ |  | The app name (label value). |
| namespace | `path` | string | `string` |  | ✓ |  | The namespace name. |

#### All responses
| Code | Status | Description | Has headers | Schema |
|------|--------|-------------|:-----------:|--------|
| [200](#error-traces-200) | OK | Number of traces in error |  | [schema](#error-traces-200-schema) |
| [403](#error-traces-403) | Forbidden | ForbiddenError: the client is not allowed to access the requested namespace |  | [schema](#error-traces-403-schema) |
| [404](#error-traces-404) | Not Found | A NotFoundError is the error message that is generated when server could not find what was requested. |  | [schema](#error-traces-404-schema) |
| [500](#error-traces-500) | Internal Server Error | A Internal is the error message that means something has gone wrong |  | [schema](#error-traces-500-schema) |

#### Responses


##### <span id="error-traces-200"></span> 200 - Number of traces in error
Status: OK

###### <span id="error-traces-200-schema"></span> Schema
   
  



##### <span id="error-traces-403"></span> 403 - ForbiddenError: the client is not allowed to access the requested namespace
Status: Forbidden

###### <span id="error-traces-403-schema"></span> Schema
   
  

[ErrorTracesForbiddenBody](#error-traces-forbidden-body)

##### <span id="error-traces-404"></span> 404 - A NotFoundError is the error message that is generated when server could not find what was requested.
Status: Not Found

###### <span id="error-traces-404-schema"></span> Schema
   
  

[ErrorTracesNotFoundBody](#error-traces-not-found-body)

##### <span id="error-traces-500"></span> 500 - A Internal is the error message that means something has gone wrong
Status: Internal Server Error

###### <span id="error-traces-500-schema"></span> Schema
   
  

[ErrorTracesInternalServerErrorBody](#error-traces-internal-server-error-body)

###### Inlined models

**<span id="error-traces-forbidden-body"></span> ErrorTracesForbiddenBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `403`| HTTP status code | `403` |
| Message | string| `string` |  | |  |  |



**<span id="error-traces-internal-server-error-body"></span> ErrorTracesInternalServerErrorBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `500`| HTTP status code | `500` |
| Message | string| `string` |  | |  |  |



**<span id="error-traces-not-found-body"></span> ErrorTracesNotFoundBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `404`| HTTP status code | `404` |
| Message | string| `string` |  | |  |  |



### <span id="get-config"></span> get config (*getConfig*)

```
GET /api/config
```

Endpoint to get the config of Kiali

#### URI Schemes
  * http
  * https

#### Produces
  * application/json

#### All responses
| Code | Status | Description | Has headers | Schema |
|------|--------|-------------|:-----------:|--------|
| [200](#get-config-200) | OK | HTTP status code 200 and statusInfo model in data |  | [schema](#get-config-200-schema) |
| [500](#get-config-500) | Internal Server Error | A Internal is the error message that means something has gone wrong |  | [schema](#get-config-500-schema) |

#### Responses


##### <span id="get-config-200"></span> 200 - HTTP status code 200 and statusInfo model in data
Status: OK

###### <span id="get-config-200-schema"></span> Schema
   
  

[StatusInfo](#status-info)

##### <span id="get-config-500"></span> 500 - A Internal is the error message that means something has gone wrong
Status: Internal Server Error

###### <span id="get-config-500-schema"></span> Schema
   
  

[GetConfigInternalServerErrorBody](#get-config-internal-server-error-body)

###### Inlined models

**<span id="get-config-internal-server-error-body"></span> GetConfigInternalServerErrorBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `500`| HTTP status code | `500` |
| Message | string| `string` |  | |  |  |



### <span id="get-disabled-features"></span> get disabled features (*getDisabledFeatures*)

```
GET /api/config/disabled
```

Endpoint to get the disabled features of Kiali

#### URI Schemes
  * http
  * https

#### Produces
  * application/json

#### All responses
| Code | Status | Description | Has headers | Schema |
|------|--------|-------------|:-----------:|--------|
| [500](#get-disabled-features-500) | Internal Server Error | A Internal is the error message that means something has gone wrong |  | [schema](#get-disabled-features-500-schema) |

#### Responses


##### <span id="get-disabled-features-500"></span> 500 - A Internal is the error message that means something has gone wrong
Status: Internal Server Error

###### <span id="get-disabled-features-500-schema"></span> Schema
   
  

[GetDisabledFeaturesInternalServerErrorBody](#get-disabled-features-internal-server-error-body)

###### Inlined models

**<span id="get-disabled-features-internal-server-error-body"></span> GetDisabledFeaturesInternalServerErrorBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `500`| HTTP status code | `500` |
| Message | string| `string` |  | |  |  |



### <span id="get-permissions"></span> get permissions (*getPermissions*)

```
GET /api/istio/permissions
```

Endpoint to get the caller permissions on new Istio Config objects

#### URI Schemes
  * http
  * https

#### Produces
  * application/json

#### All responses
| Code | Status | Description | Has headers | Schema |
|------|--------|-------------|:-----------:|--------|
| [200](#get-permissions-200) | OK | Return caller permissions per namespace and Istio Config type |  | [schema](#get-permissions-200-schema) |
| [500](#get-permissions-500) | Internal Server Error | A Internal is the error message that means something has gone wrong |  | [schema](#get-permissions-500-schema) |

#### Responses


##### <span id="get-permissions-200"></span> 200 - Return caller permissions per namespace and Istio Config type
Status: OK

###### <span id="get-permissions-200-schema"></span> Schema
   
  

[IstioConfigPermissions](#istio-config-permissions)

##### <span id="get-permissions-500"></span> 500 - A Internal is the error message that means something has gone wrong
Status: Internal Server Error

###### <span id="get-permissions-500-schema"></span> Schema
   
  

[GetPermissionsInternalServerErrorBody](#get-permissions-internal-server-error-body)

###### Inlined models

**<span id="get-permissions-internal-server-error-body"></span> GetPermissionsInternalServerErrorBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `500`| HTTP status code | `500` |
| Message | string| `string` |  | |  |  |



### <span id="get-status"></span> get status (*getStatus*)

```
GET /api/status
```

Endpoint to get the status of Kiali

#### URI Schemes
  * http
  * https

#### Produces
  * application/json

#### All responses
| Code | Status | Description | Has headers | Schema |
|------|--------|-------------|:-----------:|--------|
| [200](#get-status-200) | OK | HTTP status code 200 and statusInfo model in data |  | [schema](#get-status-200-schema) |
| [500](#get-status-500) | Internal Server Error | A Internal is the error message that means something has gone wrong |  | [schema](#get-status-500-schema) |

#### Responses


##### <span id="get-status-200"></span> 200 - HTTP status code 200 and statusInfo model in data
Status: OK

###### <span id="get-status-200-schema"></span> Schema
   
  

[StatusInfo](#status-info)

##### <span id="get-status-500"></span> 500 - A Internal is the error message that means something has gone wrong
Status: Internal Server Error

###### <span id="get-status-500-schema"></span> Schema
   
  

[GetStatusInternalServerErrorBody](#get-status-internal-server-error-body)

###### Inlined models

**<span id="get-status-internal-server-error-body"></span> GetStatusInternalServerErrorBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `500`| HTTP status code | `500` |
| Message | string| `string` |  | |  |  |



### <span id="grafana-info"></span> grafana info (*grafanaInfo*)

```
GET /api/grafana
```

Get the grafana URL and other descriptors

#### URI Schemes
  * http
  * https

#### Produces
  * application/json

#### All responses
| Code | Status | Description | Has headers | Schema |
|------|--------|-------------|:-----------:|--------|
| [200](#grafana-info-200) | OK | Return all the descriptor data related to Grafana |  | [schema](#grafana-info-200-schema) |
| [204](#grafana-info-204) | No Content | NoContent: the response is empty |  | [schema](#grafana-info-204-schema) |
| [500](#grafana-info-500) | Internal Server Error | A Internal is the error message that means something has gone wrong |  | [schema](#grafana-info-500-schema) |
| [503](#grafana-info-503) | Service Unavailable | A Internal is the error message that means something has gone wrong |  | [schema](#grafana-info-503-schema) |

#### Responses


##### <span id="grafana-info-200"></span> 200 - Return all the descriptor data related to Grafana
Status: OK

###### <span id="grafana-info-200-schema"></span> Schema
   
  

[GrafanaInfo](#grafana-info)

##### <span id="grafana-info-204"></span> 204 - NoContent: the response is empty
Status: No Content

###### <span id="grafana-info-204-schema"></span> Schema
   
  

[GrafanaInfoNoContentBody](#grafana-info-no-content-body)

##### <span id="grafana-info-500"></span> 500 - A Internal is the error message that means something has gone wrong
Status: Internal Server Error

###### <span id="grafana-info-500-schema"></span> Schema
   
  

[GrafanaInfoInternalServerErrorBody](#grafana-info-internal-server-error-body)

##### <span id="grafana-info-503"></span> 503 - A Internal is the error message that means something has gone wrong
Status: Service Unavailable

###### <span id="grafana-info-503-schema"></span> Schema
   
  

[GrafanaInfoServiceUnavailableBody](#grafana-info-service-unavailable-body)

###### Inlined models

**<span id="grafana-info-internal-server-error-body"></span> GrafanaInfoInternalServerErrorBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `500`| HTTP status code | `500` |
| Message | string| `string` |  | |  |  |



**<span id="grafana-info-no-content-body"></span> GrafanaInfoNoContentBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `204`| HTTP status code | `204` |
| Message | string| `string` |  | |  |  |



**<span id="grafana-info-service-unavailable-body"></span> GrafanaInfoServiceUnavailableBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `503`| HTTP status code | `503` |
| Message | string| `string` |  | |  |  |



### <span id="graph-aggregate"></span> graph aggregate (*graphAggregate*)

```
GET /api/namespaces/{namespace}/aggregates/{aggregate}/{aggregateValue}/graph
```

The backing JSON for an aggregate node detail graph. (supported graphTypes: app | versionedApp | workload)

#### URI Schemes
  * http
  * https

#### Produces
  * application/json

#### Parameters

| Name | Source | Type | Go type | Separator | Required | Default | Description |
|------|--------|------|---------|-----------| :------: |---------|-------------|
| aggregate | `path` | string | `string` |  | ✓ |  | The aggregate name (label). |
| aggregateValue | `path` | string | `string` |  | ✓ |  | The aggregate value (label value). |
| namespace | `path` | string | `string` |  | ✓ |  | The namespace name. |
| container | `query` | string | `string` |  |  |  | The cluster name. If not supplied queries/results will not be constrained by cluster. |

#### All responses
| Code | Status | Description | Has headers | Schema |
|------|--------|-------------|:-----------:|--------|
| [200](#graph-aggregate-200) | OK | HTTP status code 200 and graph Config in data |  | [schema](#graph-aggregate-200-schema) |
| [400](#graph-aggregate-400) | Bad Request | BadRequestError: the client request is incorrect |  | [schema](#graph-aggregate-400-schema) |
| [403](#graph-aggregate-403) | Forbidden | ForbiddenError: the client is not allowed to access the requested namespace |  | [schema](#graph-aggregate-403-schema) |
| [500](#graph-aggregate-500) | Internal Server Error | A Internal is the error message that means something has gone wrong |  | [schema](#graph-aggregate-500-schema) |

#### Responses


##### <span id="graph-aggregate-200"></span> 200 - HTTP status code 200 and graph Config in data
Status: OK

###### <span id="graph-aggregate-200-schema"></span> Schema
   
  

[CommonConfig](#common-config)

##### <span id="graph-aggregate-400"></span> 400 - BadRequestError: the client request is incorrect
Status: Bad Request

###### <span id="graph-aggregate-400-schema"></span> Schema
   
  

[GraphAggregateBadRequestBody](#graph-aggregate-bad-request-body)

##### <span id="graph-aggregate-403"></span> 403 - ForbiddenError: the client is not allowed to access the requested namespace
Status: Forbidden

###### <span id="graph-aggregate-403-schema"></span> Schema
   
  

[GraphAggregateForbiddenBody](#graph-aggregate-forbidden-body)

##### <span id="graph-aggregate-500"></span> 500 - A Internal is the error message that means something has gone wrong
Status: Internal Server Error

###### <span id="graph-aggregate-500-schema"></span> Schema
   
  

[GraphAggregateInternalServerErrorBody](#graph-aggregate-internal-server-error-body)

###### Inlined models

**<span id="graph-aggregate-bad-request-body"></span> GraphAggregateBadRequestBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `400`| HTTP status code | `400` |
| Message | string| `string` |  | |  |  |



**<span id="graph-aggregate-forbidden-body"></span> GraphAggregateForbiddenBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `403`| HTTP status code | `403` |
| Message | string| `string` |  | |  |  |



**<span id="graph-aggregate-internal-server-error-body"></span> GraphAggregateInternalServerErrorBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `500`| HTTP status code | `500` |
| Message | string| `string` |  | |  |  |



### <span id="graph-aggregate-by-service"></span> graph aggregate by service (*graphAggregateByService*)

```
GET /api/namespaces/{namespace}/aggregates/{aggregate}/{aggregateValue}/{service}/graph
```

The backing JSON for an aggregate node detail graph, specific to a service. (supported graphTypes: app | versionedApp | workload)

#### URI Schemes
  * http
  * https

#### Produces
  * application/json

#### Parameters

| Name | Source | Type | Go type | Separator | Required | Default | Description |
|------|--------|------|---------|-----------| :------: |---------|-------------|
| aggregate | `path` | string | `string` |  | ✓ |  | The aggregate name (label). |
| aggregateValue | `path` | string | `string` |  | ✓ |  | The aggregate value (label value). |
| namespace | `path` | string | `string` |  | ✓ |  | The namespace name. |
| service | `path` | string | `string` |  | ✓ |  | The service name. |
| container | `query` | string | `string` |  |  |  | The cluster name. If not supplied queries/results will not be constrained by cluster. |

#### All responses
| Code | Status | Description | Has headers | Schema |
|------|--------|-------------|:-----------:|--------|
| [200](#graph-aggregate-by-service-200) | OK | HTTP status code 200 and graph Config in data |  | [schema](#graph-aggregate-by-service-200-schema) |
| [400](#graph-aggregate-by-service-400) | Bad Request | BadRequestError: the client request is incorrect |  | [schema](#graph-aggregate-by-service-400-schema) |
| [403](#graph-aggregate-by-service-403) | Forbidden | ForbiddenError: the client is not allowed to access the requested namespace |  | [schema](#graph-aggregate-by-service-403-schema) |
| [500](#graph-aggregate-by-service-500) | Internal Server Error | A Internal is the error message that means something has gone wrong |  | [schema](#graph-aggregate-by-service-500-schema) |

#### Responses


##### <span id="graph-aggregate-by-service-200"></span> 200 - HTTP status code 200 and graph Config in data
Status: OK

###### <span id="graph-aggregate-by-service-200-schema"></span> Schema
   
  

[CommonConfig](#common-config)

##### <span id="graph-aggregate-by-service-400"></span> 400 - BadRequestError: the client request is incorrect
Status: Bad Request

###### <span id="graph-aggregate-by-service-400-schema"></span> Schema
   
  

[GraphAggregateByServiceBadRequestBody](#graph-aggregate-by-service-bad-request-body)

##### <span id="graph-aggregate-by-service-403"></span> 403 - ForbiddenError: the client is not allowed to access the requested namespace
Status: Forbidden

###### <span id="graph-aggregate-by-service-403-schema"></span> Schema
   
  

[GraphAggregateByServiceForbiddenBody](#graph-aggregate-by-service-forbidden-body)

##### <span id="graph-aggregate-by-service-500"></span> 500 - A Internal is the error message that means something has gone wrong
Status: Internal Server Error

###### <span id="graph-aggregate-by-service-500-schema"></span> Schema
   
  

[GraphAggregateByServiceInternalServerErrorBody](#graph-aggregate-by-service-internal-server-error-body)

###### Inlined models

**<span id="graph-aggregate-by-service-bad-request-body"></span> GraphAggregateByServiceBadRequestBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `400`| HTTP status code | `400` |
| Message | string| `string` |  | |  |  |



**<span id="graph-aggregate-by-service-forbidden-body"></span> GraphAggregateByServiceForbiddenBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `403`| HTTP status code | `403` |
| Message | string| `string` |  | |  |  |



**<span id="graph-aggregate-by-service-internal-server-error-body"></span> GraphAggregateByServiceInternalServerErrorBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `500`| HTTP status code | `500` |
| Message | string| `string` |  | |  |  |



### <span id="graph-app"></span> graph app (*graphApp*)

```
GET /api/namespaces/{namespace}/applications/{app}/graph
```

The backing JSON for an app node detail graph. (supported graphTypes: app | versionedApp)

#### URI Schemes
  * http
  * https

#### Produces
  * application/json

#### Parameters

| Name | Source | Type | Go type | Separator | Required | Default | Description |
|------|--------|------|---------|-----------| :------: |---------|-------------|
| app | `path` | string | `string` |  | ✓ |  | The app name (label value). |
| namespace | `path` | string | `string` |  | ✓ |  | The namespace name. |
| appenders | `query` | string | `string` |  |  | `"aggregateNode,deadNode,healthConfig,idleNode,istio,responseTime,securityPolicy,serviceEntry,sidecarsCheck,throughput"` | Comma-separated list of Appenders to run. Available appenders: [aggregateNode, deadNode, healthConfig, idleNode, istio, responseTime, securityPolicy, serviceEntry, sidecarsCheck, throughput]. |
| boxBy | `query` | string | `string` |  |  |  | Comma-separated list of desired node boxing. Available boxings: [app, cluster, namespace]. |
| container | `query` | string | `string` |  |  |  | The cluster name. If not supplied queries/results will not be constrained by cluster. |
| duration | `query` | string | `string` |  |  | `"10m"` | Query time-range duration (Golang string duration). |
| includeIdleEdges | `query` | string | `string` |  |  | `"false"` | Flag for including edges that have no request traffic for the time period. |
| injectServiceNodes | `query` | string | `string` |  |  | `"false"` | Flag for injecting the requested service node between source and destination nodes. |
| queryTime | `query` | string | `string` |  |  | `"now"` | Unix time (seconds) for query such that time range is [queryTime-duration..queryTime]. Default is now. |
| rateGrpc | `query` | string | `string` |  |  | `"requests"` | How to calculate gRPC traffic rate. One of: none | received (i.e. response_messages) | requests | sent (i.e. request_messages) | total (i.e. sent+received). |
| rateHttp | `query` | string | `string` |  |  | `"requests"` | How to calculate HTTP traffic rate. One of: none | requests. |
| rateTcp | `query` | string | `string` |  |  | `"sent"` | How to calculate TCP traffic rate. One of: none | received (i.e. received_bytes) | sent (i.e. sent_bytes) | total (i.e. sent+received). |
| responseTime | `query` | string | `string` |  |  | `"95"` | Used only with responseTime appender. One of: avg | 50 | 95 | 99. |
| throughput | `query` | string | `string` |  |  | `"request"` | Used only with throughput appender. One of: request | response. |

#### All responses
| Code | Status | Description | Has headers | Schema |
|------|--------|-------------|:-----------:|--------|
| [200](#graph-app-200) | OK | HTTP status code 200 and graph Config in data |  | [schema](#graph-app-200-schema) |
| [400](#graph-app-400) | Bad Request | BadRequestError: the client request is incorrect |  | [schema](#graph-app-400-schema) |
| [403](#graph-app-403) | Forbidden | ForbiddenError: the client is not allowed to access the requested namespace |  | [schema](#graph-app-403-schema) |
| [500](#graph-app-500) | Internal Server Error | A Internal is the error message that means something has gone wrong |  | [schema](#graph-app-500-schema) |

#### Responses


##### <span id="graph-app-200"></span> 200 - HTTP status code 200 and graph Config in data
Status: OK

###### <span id="graph-app-200-schema"></span> Schema
   
  

[CommonConfig](#common-config)

##### <span id="graph-app-400"></span> 400 - BadRequestError: the client request is incorrect
Status: Bad Request

###### <span id="graph-app-400-schema"></span> Schema
   
  

[GraphAppBadRequestBody](#graph-app-bad-request-body)

##### <span id="graph-app-403"></span> 403 - ForbiddenError: the client is not allowed to access the requested namespace
Status: Forbidden

###### <span id="graph-app-403-schema"></span> Schema
   
  

[GraphAppForbiddenBody](#graph-app-forbidden-body)

##### <span id="graph-app-500"></span> 500 - A Internal is the error message that means something has gone wrong
Status: Internal Server Error

###### <span id="graph-app-500-schema"></span> Schema
   
  

[GraphAppInternalServerErrorBody](#graph-app-internal-server-error-body)

###### Inlined models

**<span id="graph-app-bad-request-body"></span> GraphAppBadRequestBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `400`| HTTP status code | `400` |
| Message | string| `string` |  | |  |  |



**<span id="graph-app-forbidden-body"></span> GraphAppForbiddenBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `403`| HTTP status code | `403` |
| Message | string| `string` |  | |  |  |



**<span id="graph-app-internal-server-error-body"></span> GraphAppInternalServerErrorBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `500`| HTTP status code | `500` |
| Message | string| `string` |  | |  |  |



### <span id="graph-app-version"></span> graph app version (*graphAppVersion*)

```
GET /api/namespaces/{namespace}/applications/{app}/versions/{version}/graph
```

The backing JSON for a versioned app node detail graph. (supported graphTypes: app | versionedApp)

#### URI Schemes
  * http
  * https

#### Produces
  * application/json

#### Parameters

| Name | Source | Type | Go type | Separator | Required | Default | Description |
|------|--------|------|---------|-----------| :------: |---------|-------------|
| app | `path` | string | `string` |  | ✓ |  | The app name (label value). |
| namespace | `path` | string | `string` |  | ✓ |  | The namespace name. |
| version | `path` | string | `string` |  | ✓ |  | The app version (label value). |
| appenders | `query` | string | `string` |  |  | `"aggregateNode,deadNode,healthConfig,idleNode,istio,responseTime,securityPolicy,serviceEntry,sidecarsCheck,throughput"` | Comma-separated list of Appenders to run. Available appenders: [aggregateNode, deadNode, healthConfig, idleNode, istio, responseTime, securityPolicy, serviceEntry, sidecarsCheck, throughput]. |
| boxBy | `query` | string | `string` |  |  |  | Comma-separated list of desired node boxing. Available boxings: [app, cluster, namespace]. |
| container | `query` | string | `string` |  |  |  | The cluster name. If not supplied queries/results will not be constrained by cluster. |
| duration | `query` | string | `string` |  |  | `"10m"` | Query time-range duration (Golang string duration). |
| includeIdleEdges | `query` | string | `string` |  |  | `"false"` | Flag for including edges that have no request traffic for the time period. |
| injectServiceNodes | `query` | string | `string` |  |  | `"false"` | Flag for injecting the requested service node between source and destination nodes. |
| queryTime | `query` | string | `string` |  |  | `"now"` | Unix time (seconds) for query such that time range is [queryTime-duration..queryTime]. Default is now. |
| rateGrpc | `query` | string | `string` |  |  | `"requests"` | How to calculate gRPC traffic rate. One of: none | received (i.e. response_messages) | requests | sent (i.e. request_messages) | total (i.e. sent+received). |
| rateHttp | `query` | string | `string` |  |  | `"requests"` | How to calculate HTTP traffic rate. One of: none | requests. |
| rateTcp | `query` | string | `string` |  |  | `"sent"` | How to calculate TCP traffic rate. One of: none | received (i.e. received_bytes) | sent (i.e. sent_bytes) | total (i.e. sent+received). |
| responseTime | `query` | string | `string` |  |  | `"95"` | Used only with responseTime appender. One of: avg | 50 | 95 | 99. |
| throughput | `query` | string | `string` |  |  | `"request"` | Used only with throughput appender. One of: request | response. |

#### All responses
| Code | Status | Description | Has headers | Schema |
|------|--------|-------------|:-----------:|--------|
| [200](#graph-app-version-200) | OK | HTTP status code 200 and graph Config in data |  | [schema](#graph-app-version-200-schema) |
| [400](#graph-app-version-400) | Bad Request | BadRequestError: the client request is incorrect |  | [schema](#graph-app-version-400-schema) |
| [403](#graph-app-version-403) | Forbidden | ForbiddenError: the client is not allowed to access the requested namespace |  | [schema](#graph-app-version-403-schema) |
| [500](#graph-app-version-500) | Internal Server Error | A Internal is the error message that means something has gone wrong |  | [schema](#graph-app-version-500-schema) |

#### Responses


##### <span id="graph-app-version-200"></span> 200 - HTTP status code 200 and graph Config in data
Status: OK

###### <span id="graph-app-version-200-schema"></span> Schema
   
  

[CommonConfig](#common-config)

##### <span id="graph-app-version-400"></span> 400 - BadRequestError: the client request is incorrect
Status: Bad Request

###### <span id="graph-app-version-400-schema"></span> Schema
   
  

[GraphAppVersionBadRequestBody](#graph-app-version-bad-request-body)

##### <span id="graph-app-version-403"></span> 403 - ForbiddenError: the client is not allowed to access the requested namespace
Status: Forbidden

###### <span id="graph-app-version-403-schema"></span> Schema
   
  

[GraphAppVersionForbiddenBody](#graph-app-version-forbidden-body)

##### <span id="graph-app-version-500"></span> 500 - A Internal is the error message that means something has gone wrong
Status: Internal Server Error

###### <span id="graph-app-version-500-schema"></span> Schema
   
  

[GraphAppVersionInternalServerErrorBody](#graph-app-version-internal-server-error-body)

###### Inlined models

**<span id="graph-app-version-bad-request-body"></span> GraphAppVersionBadRequestBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `400`| HTTP status code | `400` |
| Message | string| `string` |  | |  |  |



**<span id="graph-app-version-forbidden-body"></span> GraphAppVersionForbiddenBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `403`| HTTP status code | `403` |
| Message | string| `string` |  | |  |  |



**<span id="graph-app-version-internal-server-error-body"></span> GraphAppVersionInternalServerErrorBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `500`| HTTP status code | `500` |
| Message | string| `string` |  | |  |  |



### <span id="graph-namespaces"></span> The backing JSON for a namespaces graph. (*graphNamespaces*)

```
GET /api/namespaces/graph
```

#### URI Schemes
  * http
  * https

#### Produces
  * application/json

#### Parameters

| Name | Source | Type | Go type | Separator | Required | Default | Description |
|------|--------|------|---------|-----------| :------: |---------|-------------|
| appenders | `query` | string | `string` |  |  | `"aggregateNode,deadNode,healthConfig,idleNode,istio,responseTime,securityPolicy,serviceEntry,sidecarsCheck,throughput"` | Comma-separated list of Appenders to run. Available appenders: [aggregateNode, deadNode, healthConfig, idleNode, istio, responseTime, securityPolicy, serviceEntry, sidecarsCheck, throughput]. |
| boxBy | `query` | string | `string` |  |  |  | Comma-separated list of desired node boxing. Available boxings: [app, cluster, namespace]. |
| duration | `query` | string | `string` |  |  | `"10m"` | Query time-range duration (Golang string duration). |
| graphType | `query` | string | `string` |  |  | `"workload"` | Graph type. Available graph types: [app, service, versionedApp, workload]. |
| includeIdleEdges | `query` | string | `string` |  |  | `"false"` | Flag for including edges that have no request traffic for the time period. |
| injectServiceNodes | `query` | string | `string` |  |  | `"false"` | Flag for injecting the requested service node between source and destination nodes. |
| namespaces | `query` | string | `string` |  | ✓ |  | Comma-separated list of namespaces to include in the graph. The namespaces must be accessible to the client. |
| queryTime | `query` | string | `string` |  |  | `"now"` | Unix time (seconds) for query such that time range is [queryTime-duration..queryTime]. Default is now. |
| rateGrpc | `query` | string | `string` |  |  | `"requests"` | How to calculate gRPC traffic rate. One of: none | received (i.e. response_messages) | requests | sent (i.e. request_messages) | total (i.e. sent+received). |
| rateHttp | `query` | string | `string` |  |  | `"requests"` | How to calculate HTTP traffic rate. One of: none | requests. |
| rateTcp | `query` | string | `string` |  |  | `"sent"` | How to calculate TCP traffic rate. One of: none | received (i.e. received_bytes) | sent (i.e. sent_bytes) | total (i.e. sent+received). |
| responseTime | `query` | string | `string` |  |  | `"95"` | Used only with responseTime appender. One of: avg | 50 | 95 | 99. |
| throughput | `query` | string | `string` |  |  | `"request"` | Used only with throughput appender. One of: request | response. |

#### All responses
| Code | Status | Description | Has headers | Schema |
|------|--------|-------------|:-----------:|--------|
| [200](#graph-namespaces-200) | OK | HTTP status code 200 and graph Config in data |  | [schema](#graph-namespaces-200-schema) |
| [400](#graph-namespaces-400) | Bad Request | BadRequestError: the client request is incorrect |  | [schema](#graph-namespaces-400-schema) |
| [500](#graph-namespaces-500) | Internal Server Error | A Internal is the error message that means something has gone wrong |  | [schema](#graph-namespaces-500-schema) |

#### Responses


##### <span id="graph-namespaces-200"></span> 200 - HTTP status code 200 and graph Config in data
Status: OK

###### <span id="graph-namespaces-200-schema"></span> Schema
   
  

[CommonConfig](#common-config)

##### <span id="graph-namespaces-400"></span> 400 - BadRequestError: the client request is incorrect
Status: Bad Request

###### <span id="graph-namespaces-400-schema"></span> Schema
   
  

[GraphNamespacesBadRequestBody](#graph-namespaces-bad-request-body)

##### <span id="graph-namespaces-500"></span> 500 - A Internal is the error message that means something has gone wrong
Status: Internal Server Error

###### <span id="graph-namespaces-500-schema"></span> Schema
   
  

[GraphNamespacesInternalServerErrorBody](#graph-namespaces-internal-server-error-body)

###### Inlined models

**<span id="graph-namespaces-bad-request-body"></span> GraphNamespacesBadRequestBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `400`| HTTP status code | `400` |
| Message | string| `string` |  | |  |  |



**<span id="graph-namespaces-internal-server-error-body"></span> GraphNamespacesInternalServerErrorBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `500`| HTTP status code | `500` |
| Message | string| `string` |  | |  |  |



### <span id="graph-service"></span> The backing JSON for a service node detail graph. (*graphService*)

```
GET /api/namespaces/{namespace}/services/{service}/graph
```

#### URI Schemes
  * http
  * https

#### Produces
  * application/json

#### Parameters

| Name | Source | Type | Go type | Separator | Required | Default | Description |
|------|--------|------|---------|-----------| :------: |---------|-------------|
| namespace | `path` | string | `string` |  | ✓ |  | The namespace name. |
| service | `path` | string | `string` |  | ✓ |  | The service name. |
| appenders | `query` | string | `string` |  |  | `"aggregateNode,deadNode,healthConfig,idleNode,istio,responseTime,securityPolicy,serviceEntry,sidecarsCheck,throughput"` | Comma-separated list of Appenders to run. Available appenders: [aggregateNode, deadNode, healthConfig, idleNode, istio, responseTime, securityPolicy, serviceEntry, sidecarsCheck, throughput]. |
| boxBy | `query` | string | `string` |  |  |  | Comma-separated list of desired node boxing. Available boxings: [app, cluster, namespace]. |
| container | `query` | string | `string` |  |  |  | The cluster name. If not supplied queries/results will not be constrained by cluster. |
| duration | `query` | string | `string` |  |  | `"10m"` | Query time-range duration (Golang string duration). |
| graphType | `query` | string | `string` |  |  | `"workload"` | Graph type. Available graph types: [app, service, versionedApp, workload]. |
| queryTime | `query` | string | `string` |  |  | `"now"` | Unix time (seconds) for query such that time range is [queryTime-duration..queryTime]. Default is now. |
| rateGrpc | `query` | string | `string` |  |  | `"requests"` | How to calculate gRPC traffic rate. One of: none | received (i.e. response_messages) | requests | sent (i.e. request_messages) | total (i.e. sent+received). |
| rateHttp | `query` | string | `string` |  |  | `"requests"` | How to calculate HTTP traffic rate. One of: none | requests. |
| rateTcp | `query` | string | `string` |  |  | `"sent"` | How to calculate TCP traffic rate. One of: none | received (i.e. received_bytes) | sent (i.e. sent_bytes) | total (i.e. sent+received). |
| responseTime | `query` | string | `string` |  |  | `"95"` | Used only with responseTime appender. One of: avg | 50 | 95 | 99. |
| throughput | `query` | string | `string` |  |  | `"request"` | Used only with throughput appender. One of: request | response. |

#### All responses
| Code | Status | Description | Has headers | Schema |
|------|--------|-------------|:-----------:|--------|
| [200](#graph-service-200) | OK | HTTP status code 200 and graph Config in data |  | [schema](#graph-service-200-schema) |
| [400](#graph-service-400) | Bad Request | BadRequestError: the client request is incorrect |  | [schema](#graph-service-400-schema) |
| [403](#graph-service-403) | Forbidden | ForbiddenError: the client is not allowed to access the requested namespace |  | [schema](#graph-service-403-schema) |
| [500](#graph-service-500) | Internal Server Error | A Internal is the error message that means something has gone wrong |  | [schema](#graph-service-500-schema) |

#### Responses


##### <span id="graph-service-200"></span> 200 - HTTP status code 200 and graph Config in data
Status: OK

###### <span id="graph-service-200-schema"></span> Schema
   
  

[CommonConfig](#common-config)

##### <span id="graph-service-400"></span> 400 - BadRequestError: the client request is incorrect
Status: Bad Request

###### <span id="graph-service-400-schema"></span> Schema
   
  

[GraphServiceBadRequestBody](#graph-service-bad-request-body)

##### <span id="graph-service-403"></span> 403 - ForbiddenError: the client is not allowed to access the requested namespace
Status: Forbidden

###### <span id="graph-service-403-schema"></span> Schema
   
  

[GraphServiceForbiddenBody](#graph-service-forbidden-body)

##### <span id="graph-service-500"></span> 500 - A Internal is the error message that means something has gone wrong
Status: Internal Server Error

###### <span id="graph-service-500-schema"></span> Schema
   
  

[GraphServiceInternalServerErrorBody](#graph-service-internal-server-error-body)

###### Inlined models

**<span id="graph-service-bad-request-body"></span> GraphServiceBadRequestBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `400`| HTTP status code | `400` |
| Message | string| `string` |  | |  |  |



**<span id="graph-service-forbidden-body"></span> GraphServiceForbiddenBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `403`| HTTP status code | `403` |
| Message | string| `string` |  | |  |  |



**<span id="graph-service-internal-server-error-body"></span> GraphServiceInternalServerErrorBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `500`| HTTP status code | `500` |
| Message | string| `string` |  | |  |  |



### <span id="graph-workload"></span> The backing JSON for a workload node detail graph. (*graphWorkload*)

```
GET /api/namespaces/{namespace}/workloads/{workload}/graph
```

#### URI Schemes
  * http
  * https

#### Produces
  * application/json

#### Parameters

| Name | Source | Type | Go type | Separator | Required | Default | Description |
|------|--------|------|---------|-----------| :------: |---------|-------------|
| namespace | `path` | string | `string` |  | ✓ |  | The namespace name. |
| workload | `path` | string | `string` |  | ✓ |  | The workload name. |
| appenders | `query` | string | `string` |  |  | `"aggregateNode,deadNode,healthConfig,idleNode,istio,responseTime,securityPolicy,serviceEntry,sidecarsCheck,throughput"` | Comma-separated list of Appenders to run. Available appenders: [aggregateNode, deadNode, healthConfig, idleNode, istio, responseTime, securityPolicy, serviceEntry, sidecarsCheck, throughput]. |
| boxBy | `query` | string | `string` |  |  |  | Comma-separated list of desired node boxing. Available boxings: [app, cluster, namespace]. |
| container | `query` | string | `string` |  |  |  | The cluster name. If not supplied queries/results will not be constrained by cluster. |
| duration | `query` | string | `string` |  |  | `"10m"` | Query time-range duration (Golang string duration). |
| graphType | `query` | string | `string` |  |  | `"workload"` | Graph type. Available graph types: [app, service, versionedApp, workload]. |
| includeIdleEdges | `query` | string | `string` |  |  | `"false"` | Flag for including edges that have no request traffic for the time period. |
| injectServiceNodes | `query` | string | `string` |  |  | `"false"` | Flag for injecting the requested service node between source and destination nodes. |
| queryTime | `query` | string | `string` |  |  | `"now"` | Unix time (seconds) for query such that time range is [queryTime-duration..queryTime]. Default is now. |
| rateGrpc | `query` | string | `string` |  |  | `"requests"` | How to calculate gRPC traffic rate. One of: none | received (i.e. response_messages) | requests | sent (i.e. request_messages) | total (i.e. sent+received). |
| rateHttp | `query` | string | `string` |  |  | `"requests"` | How to calculate HTTP traffic rate. One of: none | requests. |
| rateTcp | `query` | string | `string` |  |  | `"sent"` | How to calculate TCP traffic rate. One of: none | received (i.e. received_bytes) | sent (i.e. sent_bytes) | total (i.e. sent+received). |
| responseTime | `query` | string | `string` |  |  | `"95"` | Used only with responseTime appender. One of: avg | 50 | 95 | 99. |
| throughput | `query` | string | `string` |  |  | `"request"` | Used only with throughput appender. One of: request | response. |

#### All responses
| Code | Status | Description | Has headers | Schema |
|------|--------|-------------|:-----------:|--------|
| [200](#graph-workload-200) | OK | HTTP status code 200 and graph Config in data |  | [schema](#graph-workload-200-schema) |
| [400](#graph-workload-400) | Bad Request | BadRequestError: the client request is incorrect |  | [schema](#graph-workload-400-schema) |
| [403](#graph-workload-403) | Forbidden | ForbiddenError: the client is not allowed to access the requested namespace |  | [schema](#graph-workload-403-schema) |
| [500](#graph-workload-500) | Internal Server Error | A Internal is the error message that means something has gone wrong |  | [schema](#graph-workload-500-schema) |

#### Responses


##### <span id="graph-workload-200"></span> 200 - HTTP status code 200 and graph Config in data
Status: OK

###### <span id="graph-workload-200-schema"></span> Schema
   
  

[CommonConfig](#common-config)

##### <span id="graph-workload-400"></span> 400 - BadRequestError: the client request is incorrect
Status: Bad Request

###### <span id="graph-workload-400-schema"></span> Schema
   
  

[GraphWorkloadBadRequestBody](#graph-workload-bad-request-body)

##### <span id="graph-workload-403"></span> 403 - ForbiddenError: the client is not allowed to access the requested namespace
Status: Forbidden

###### <span id="graph-workload-403-schema"></span> Schema
   
  

[GraphWorkloadForbiddenBody](#graph-workload-forbidden-body)

##### <span id="graph-workload-500"></span> 500 - A Internal is the error message that means something has gone wrong
Status: Internal Server Error

###### <span id="graph-workload-500-schema"></span> Schema
   
  

[GraphWorkloadInternalServerErrorBody](#graph-workload-internal-server-error-body)

###### Inlined models

**<span id="graph-workload-bad-request-body"></span> GraphWorkloadBadRequestBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `400`| HTTP status code | `400` |
| Message | string| `string` |  | |  |  |



**<span id="graph-workload-forbidden-body"></span> GraphWorkloadForbiddenBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `403`| HTTP status code | `403` |
| Message | string| `string` |  | |  |  |



**<span id="graph-workload-internal-server-error-body"></span> GraphWorkloadInternalServerErrorBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `500`| HTTP status code | `500` |
| Message | string| `string` |  | |  |  |



### <span id="healthz"></span> healthz (*healthz*)

```
GET /api/healthz
```

Endpoint to get the health of Kiali

#### URI Schemes
  * http
  * https

#### Produces
  * application/json

#### All responses
| Code | Status | Description | Has headers | Schema |
|------|--------|-------------|:-----------:|--------|
| [500](#healthz-500) | Internal Server Error | A Internal is the error message that means something has gone wrong |  | [schema](#healthz-500-schema) |

#### Responses


##### <span id="healthz-500"></span> 500 - A Internal is the error message that means something has gone wrong
Status: Internal Server Error

###### <span id="healthz-500-schema"></span> Schema
   
  

[HealthzInternalServerErrorBody](#healthz-internal-server-error-body)

###### Inlined models

**<span id="healthz-internal-server-error-body"></span> HealthzInternalServerErrorBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `500`| HTTP status code | `500` |
| Message | string| `string` |  | |  |  |



### <span id="istio-config-create"></span> istio config create (*istioConfigCreate*)

```
POST /api/namespaces/{namespace}/istio/{group}/{version}/{kind}
```

Endpoint to create an Istio object by using an Istio Config item

#### URI Schemes
  * http
  * https

#### Produces
  * application/json

#### Parameters

| Name | Source | Type | Go type | Separator | Required | Default | Description |
|------|--------|------|---------|-----------| :------: |---------|-------------|
| group | `path` | string | `string` |  | ✓ |  | The GVK group in a group/value/kind specification. |
| kind | `path` | string | `string` |  | ✓ |  | The GVK kind in a group/value/kind specification. |
| namespace | `path` | string | `string` |  | ✓ |  | The namespace name. |
| version | `path` | string | `string` |  | ✓ |  | The GVK version in a group/value/kind specification. |

#### All responses
| Code | Status | Description | Has headers | Schema |
|------|--------|-------------|:-----------:|--------|
| [200](#istio-config-create-200) | OK | IstioConfig details of an specific Istio Object |  | [schema](#istio-config-create-200-schema) |
| [201](#istio-config-create-201) | Created | IstioConfig details of an specific Istio Object |  | [schema](#istio-config-create-201-schema) |
| [403](#istio-config-create-403) | Forbidden | ForbiddenError: the client is not allowed to access the requested namespace |  | [schema](#istio-config-create-403-schema) |
| [404](#istio-config-create-404) | Not Found | A NotFoundError is the error message that is generated when server could not find what was requested. |  | [schema](#istio-config-create-404-schema) |
| [500](#istio-config-create-500) | Internal Server Error | A Internal is the error message that means something has gone wrong |  | [schema](#istio-config-create-500-schema) |

#### Responses


##### <span id="istio-config-create-200"></span> 200 - IstioConfig details of an specific Istio Object
Status: OK

###### <span id="istio-config-create-200-schema"></span> Schema
   
  

[IstioConfigDetails](#istio-config-details)

##### <span id="istio-config-create-201"></span> 201 - IstioConfig details of an specific Istio Object
Status: Created

###### <span id="istio-config-create-201-schema"></span> Schema
   
  

[IstioConfigDetails](#istio-config-details)

##### <span id="istio-config-create-403"></span> 403 - ForbiddenError: the client is not allowed to access the requested namespace
Status: Forbidden

###### <span id="istio-config-create-403-schema"></span> Schema
   
  

[IstioConfigCreateForbiddenBody](#istio-config-create-forbidden-body)

##### <span id="istio-config-create-404"></span> 404 - A NotFoundError is the error message that is generated when server could not find what was requested.
Status: Not Found

###### <span id="istio-config-create-404-schema"></span> Schema
   
  

[IstioConfigCreateNotFoundBody](#istio-config-create-not-found-body)

##### <span id="istio-config-create-500"></span> 500 - A Internal is the error message that means something has gone wrong
Status: Internal Server Error

###### <span id="istio-config-create-500-schema"></span> Schema
   
  

[IstioConfigCreateInternalServerErrorBody](#istio-config-create-internal-server-error-body)

###### Inlined models

**<span id="istio-config-create-forbidden-body"></span> IstioConfigCreateForbiddenBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `403`| HTTP status code | `403` |
| Message | string| `string` |  | |  |  |



**<span id="istio-config-create-internal-server-error-body"></span> IstioConfigCreateInternalServerErrorBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `500`| HTTP status code | `500` |
| Message | string| `string` |  | |  |  |



**<span id="istio-config-create-not-found-body"></span> IstioConfigCreateNotFoundBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `404`| HTTP status code | `404` |
| Message | string| `string` |  | |  |  |



### <span id="istio-config-delete"></span> istio config delete (*istioConfigDelete*)

```
DELETE /api/namespaces/{namespace}/istio/{group}/{version}/{kind}/{object}
```

Endpoint to delete the Istio Config of an (arbitrary) Istio object

#### URI Schemes
  * http
  * https

#### Produces
  * application/json

#### Parameters

| Name | Source | Type | Go type | Separator | Required | Default | Description |
|------|--------|------|---------|-----------| :------: |---------|-------------|
| group | `path` | string | `string` |  | ✓ |  | The GVK group in a group/value/kind specification. |
| kind | `path` | string | `string` |  | ✓ |  | The GVK kind in a group/value/kind specification. |
| namespace | `path` | string | `string` |  | ✓ |  | The namespace name. |
| object | `path` | string | `string` |  | ✓ |  | The Istio object name. |
| version | `path` | string | `string` |  | ✓ |  | The GVK version in a group/value/kind specification. |

#### All responses
| Code | Status | Description | Has headers | Schema |
|------|--------|-------------|:-----------:|--------|
| [403](#istio-config-delete-403) | Forbidden | ForbiddenError: the client is not allowed to access the requested namespace |  | [schema](#istio-config-delete-403-schema) |
| [404](#istio-config-delete-404) | Not Found | A NotFoundError is the error message that is generated when server could not find what was requested. |  | [schema](#istio-config-delete-404-schema) |
| [500](#istio-config-delete-500) | Internal Server Error | A Internal is the error message that means something has gone wrong |  | [schema](#istio-config-delete-500-schema) |

#### Responses


##### <span id="istio-config-delete-403"></span> 403 - ForbiddenError: the client is not allowed to access the requested namespace
Status: Forbidden

###### <span id="istio-config-delete-403-schema"></span> Schema
   
  

[IstioConfigDeleteForbiddenBody](#istio-config-delete-forbidden-body)

##### <span id="istio-config-delete-404"></span> 404 - A NotFoundError is the error message that is generated when server could not find what was requested.
Status: Not Found

###### <span id="istio-config-delete-404-schema"></span> Schema
   
  

[IstioConfigDeleteNotFoundBody](#istio-config-delete-not-found-body)

##### <span id="istio-config-delete-500"></span> 500 - A Internal is the error message that means something has gone wrong
Status: Internal Server Error

###### <span id="istio-config-delete-500-schema"></span> Schema
   
  

[IstioConfigDeleteInternalServerErrorBody](#istio-config-delete-internal-server-error-body)

###### Inlined models

**<span id="istio-config-delete-forbidden-body"></span> IstioConfigDeleteForbiddenBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `403`| HTTP status code | `403` |
| Message | string| `string` |  | |  |  |



**<span id="istio-config-delete-internal-server-error-body"></span> IstioConfigDeleteInternalServerErrorBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `500`| HTTP status code | `500` |
| Message | string| `string` |  | |  |  |



**<span id="istio-config-delete-not-found-body"></span> IstioConfigDeleteNotFoundBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `404`| HTTP status code | `404` |
| Message | string| `string` |  | |  |  |



### <span id="istio-config-details"></span> istio config details (*istioConfigDetails*)

```
GET /api/namespaces/{namespace}/istio/{group}/{version}/{kind}/{object}
```

Endpoint to get the Istio Config of an Istio object

#### URI Schemes
  * http
  * https

#### Produces
  * application/json

#### Parameters

| Name | Source | Type | Go type | Separator | Required | Default | Description |
|------|--------|------|---------|-----------| :------: |---------|-------------|
| group | `path` | string | `string` |  | ✓ |  | The GVK group in a group/value/kind specification. |
| kind | `path` | string | `string` |  | ✓ |  | The GVK kind in a group/value/kind specification. |
| namespace | `path` | string | `string` |  | ✓ |  | The namespace name. |
| object | `path` | string | `string` |  | ✓ |  | The Istio object name. |
| version | `path` | string | `string` |  | ✓ |  | The GVK version in a group/value/kind specification. |
| validate | `query` | string | `string` |  |  |  | Enable validation or not |

#### All responses
| Code | Status | Description | Has headers | Schema |
|------|--------|-------------|:-----------:|--------|
| [200](#istio-config-details-200) | OK | IstioConfig details of an specific Istio Object |  | [schema](#istio-config-details-200-schema) |
| [400](#istio-config-details-400) | Bad Request | BadRequestError: the client request is incorrect |  | [schema](#istio-config-details-400-schema) |
| [403](#istio-config-details-403) | Forbidden | ForbiddenError: the client is not allowed to access the requested namespace |  | [schema](#istio-config-details-403-schema) |
| [404](#istio-config-details-404) | Not Found | A NotFoundError is the error message that is generated when server could not find what was requested. |  | [schema](#istio-config-details-404-schema) |
| [500](#istio-config-details-500) | Internal Server Error | A Internal is the error message that means something has gone wrong |  | [schema](#istio-config-details-500-schema) |

#### Responses


##### <span id="istio-config-details-200"></span> 200 - IstioConfig details of an specific Istio Object
Status: OK

###### <span id="istio-config-details-200-schema"></span> Schema
   
  

[IstioConfigDetails](#istio-config-details)

##### <span id="istio-config-details-400"></span> 400 - BadRequestError: the client request is incorrect
Status: Bad Request

###### <span id="istio-config-details-400-schema"></span> Schema
   
  

[IstioConfigDetailsBadRequestBody](#istio-config-details-bad-request-body)

##### <span id="istio-config-details-403"></span> 403 - ForbiddenError: the client is not allowed to access the requested namespace
Status: Forbidden

###### <span id="istio-config-details-403-schema"></span> Schema
   
  

[IstioConfigDetailsForbiddenBody](#istio-config-details-forbidden-body)

##### <span id="istio-config-details-404"></span> 404 - A NotFoundError is the error message that is generated when server could not find what was requested.
Status: Not Found

###### <span id="istio-config-details-404-schema"></span> Schema
   
  

[IstioConfigDetailsNotFoundBody](#istio-config-details-not-found-body)

##### <span id="istio-config-details-500"></span> 500 - A Internal is the error message that means something has gone wrong
Status: Internal Server Error

###### <span id="istio-config-details-500-schema"></span> Schema
   
  

[IstioConfigDetailsInternalServerErrorBody](#istio-config-details-internal-server-error-body)

###### Inlined models

**<span id="istio-config-details-bad-request-body"></span> IstioConfigDetailsBadRequestBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `400`| HTTP status code | `400` |
| Message | string| `string` |  | |  |  |



**<span id="istio-config-details-forbidden-body"></span> IstioConfigDetailsForbiddenBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `403`| HTTP status code | `403` |
| Message | string| `string` |  | |  |  |



**<span id="istio-config-details-internal-server-error-body"></span> IstioConfigDetailsInternalServerErrorBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `500`| HTTP status code | `500` |
| Message | string| `string` |  | |  |  |



**<span id="istio-config-details-not-found-body"></span> IstioConfigDetailsNotFoundBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `404`| HTTP status code | `404` |
| Message | string| `string` |  | |  |  |



### <span id="istio-config-list"></span> istio config list (*istioConfigList*)

```
GET /api/namespaces/{namespace}/istio
```

Endpoint to get the list of Istio Config of a namespace

#### URI Schemes
  * http
  * https

#### Produces
  * application/json

#### Parameters

| Name | Source | Type | Go type | Separator | Required | Default | Description |
|------|--------|------|---------|-----------| :------: |---------|-------------|
| namespace | `path` | string | `string` |  | ✓ |  | The namespace name. |
| validate | `query` | string | `string` |  |  |  | Enable validation or not |

#### All responses
| Code | Status | Description | Has headers | Schema |
|------|--------|-------------|:-----------:|--------|
| [200](#istio-config-list-200) | OK | HTTP status code 200 and IstioConfigList model in data |  | [schema](#istio-config-list-200-schema) |
| [403](#istio-config-list-403) | Forbidden | ForbiddenError: the client is not allowed to access the requested namespace |  | [schema](#istio-config-list-403-schema) |
| [500](#istio-config-list-500) | Internal Server Error | A Internal is the error message that means something has gone wrong |  | [schema](#istio-config-list-500-schema) |

#### Responses


##### <span id="istio-config-list-200"></span> 200 - HTTP status code 200 and IstioConfigList model in data
Status: OK

###### <span id="istio-config-list-200-schema"></span> Schema
   
  

[IstioConfigList](#istio-config-list)

##### <span id="istio-config-list-403"></span> 403 - ForbiddenError: the client is not allowed to access the requested namespace
Status: Forbidden

###### <span id="istio-config-list-403-schema"></span> Schema
   
  

[IstioConfigListForbiddenBody](#istio-config-list-forbidden-body)

##### <span id="istio-config-list-500"></span> 500 - A Internal is the error message that means something has gone wrong
Status: Internal Server Error

###### <span id="istio-config-list-500-schema"></span> Schema
   
  

[IstioConfigListInternalServerErrorBody](#istio-config-list-internal-server-error-body)

###### Inlined models

**<span id="istio-config-list-forbidden-body"></span> IstioConfigListForbiddenBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `403`| HTTP status code | `403` |
| Message | string| `string` |  | |  |  |



**<span id="istio-config-list-internal-server-error-body"></span> IstioConfigListInternalServerErrorBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `500`| HTTP status code | `500` |
| Message | string| `string` |  | |  |  |



### <span id="istio-config-list-all"></span> istio config list all (*istioConfigListAll*)

```
GET /api/istio
```

Endpoint to get the list of Istio Config of all namespaces

#### URI Schemes
  * http
  * https

#### Produces
  * application/json

#### All responses
| Code | Status | Description | Has headers | Schema |
|------|--------|-------------|:-----------:|--------|
| [200](#istio-config-list-all-200) | OK | HTTP status code 200 and IstioConfigList model in data |  | [schema](#istio-config-list-all-200-schema) |
| [500](#istio-config-list-all-500) | Internal Server Error | A Internal is the error message that means something has gone wrong |  | [schema](#istio-config-list-all-500-schema) |

#### Responses


##### <span id="istio-config-list-all-200"></span> 200 - HTTP status code 200 and IstioConfigList model in data
Status: OK

###### <span id="istio-config-list-all-200-schema"></span> Schema
   
  

[IstioConfigList](#istio-config-list)

##### <span id="istio-config-list-all-500"></span> 500 - A Internal is the error message that means something has gone wrong
Status: Internal Server Error

###### <span id="istio-config-list-all-500-schema"></span> Schema
   
  

[IstioConfigListAllInternalServerErrorBody](#istio-config-list-all-internal-server-error-body)

###### Inlined models

**<span id="istio-config-list-all-internal-server-error-body"></span> IstioConfigListAllInternalServerErrorBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `500`| HTTP status code | `500` |
| Message | string| `string` |  | |  |  |



### <span id="istio-config-update"></span> Endpoint to update the Istio Config of an Istio object used for templates and adapters using Json Merge Patch strategy. (*istioConfigUpdate*)

```
PATCH /api/namespaces/{namespace}/istio/{group}/{version}/{kind}/{object}
```

#### URI Schemes
  * http
  * https

#### Consumes
  * application/json

#### Produces
  * application/json

#### Parameters

| Name | Source | Type | Go type | Separator | Required | Default | Description |
|------|--------|------|---------|-----------| :------: |---------|-------------|
| group | `path` | string | `string` |  | ✓ |  | The GVK group in a group/value/kind specification. |
| kind | `path` | string | `string` |  | ✓ |  | The GVK kind in a group/value/kind specification. |
| namespace | `path` | string | `string` |  | ✓ |  | The namespace name. |
| object | `path` | string | `string` |  | ✓ |  | The Istio object name. |
| version | `path` | string | `string` |  | ✓ |  | The GVK version in a group/value/kind specification. |

#### All responses
| Code | Status | Description | Has headers | Schema |
|------|--------|-------------|:-----------:|--------|
| [200](#istio-config-update-200) | OK | IstioConfig details of an specific Istio Object |  | [schema](#istio-config-update-200-schema) |
| [400](#istio-config-update-400) | Bad Request | BadRequestError: the client request is incorrect |  | [schema](#istio-config-update-400-schema) |
| [403](#istio-config-update-403) | Forbidden | ForbiddenError: the client is not allowed to access the requested namespace |  | [schema](#istio-config-update-403-schema) |
| [404](#istio-config-update-404) | Not Found | A NotFoundError is the error message that is generated when server could not find what was requested. |  | [schema](#istio-config-update-404-schema) |
| [500](#istio-config-update-500) | Internal Server Error | A Internal is the error message that means something has gone wrong |  | [schema](#istio-config-update-500-schema) |

#### Responses


##### <span id="istio-config-update-200"></span> 200 - IstioConfig details of an specific Istio Object
Status: OK

###### <span id="istio-config-update-200-schema"></span> Schema
   
  

[IstioConfigDetails](#istio-config-details)

##### <span id="istio-config-update-400"></span> 400 - BadRequestError: the client request is incorrect
Status: Bad Request

###### <span id="istio-config-update-400-schema"></span> Schema
   
  

[IstioConfigUpdateBadRequestBody](#istio-config-update-bad-request-body)

##### <span id="istio-config-update-403"></span> 403 - ForbiddenError: the client is not allowed to access the requested namespace
Status: Forbidden

###### <span id="istio-config-update-403-schema"></span> Schema
   
  

[IstioConfigUpdateForbiddenBody](#istio-config-update-forbidden-body)

##### <span id="istio-config-update-404"></span> 404 - A NotFoundError is the error message that is generated when server could not find what was requested.
Status: Not Found

###### <span id="istio-config-update-404-schema"></span> Schema
   
  

[IstioConfigUpdateNotFoundBody](#istio-config-update-not-found-body)

##### <span id="istio-config-update-500"></span> 500 - A Internal is the error message that means something has gone wrong
Status: Internal Server Error

###### <span id="istio-config-update-500-schema"></span> Schema
   
  

[IstioConfigUpdateInternalServerErrorBody](#istio-config-update-internal-server-error-body)

###### Inlined models

**<span id="istio-config-update-bad-request-body"></span> IstioConfigUpdateBadRequestBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `400`| HTTP status code | `400` |
| Message | string| `string` |  | |  |  |



**<span id="istio-config-update-forbidden-body"></span> IstioConfigUpdateForbiddenBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `403`| HTTP status code | `403` |
| Message | string| `string` |  | |  |  |



**<span id="istio-config-update-internal-server-error-body"></span> IstioConfigUpdateInternalServerErrorBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `500`| HTTP status code | `500` |
| Message | string| `string` |  | |  |  |



**<span id="istio-config-update-not-found-body"></span> IstioConfigUpdateNotFoundBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `404`| HTTP status code | `404` |
| Message | string| `string` |  | |  |  |



### <span id="istio-status"></span> istio status (*istioStatus*)

```
GET /api/istio/status
```

Get the status of each components needed in the control plane

#### URI Schemes
  * http
  * https

#### Produces
  * application/json

#### All responses
| Code | Status | Description | Has headers | Schema |
|------|--------|-------------|:-----------:|--------|
| [200](#istio-status-200) | OK | Return a list of Istio components along its status |  | [schema](#istio-status-200-schema) |
| [400](#istio-status-400) | Bad Request | BadRequestError: the client request is incorrect |  | [schema](#istio-status-400-schema) |
| [500](#istio-status-500) | Internal Server Error | A Internal is the error message that means something has gone wrong |  | [schema](#istio-status-500-schema) |

#### Responses


##### <span id="istio-status-200"></span> 200 - Return a list of Istio components along its status
Status: OK

###### <span id="istio-status-200-schema"></span> Schema
   
  


 [IstioComponentStatus](#istio-component-status)

##### <span id="istio-status-400"></span> 400 - BadRequestError: the client request is incorrect
Status: Bad Request

###### <span id="istio-status-400-schema"></span> Schema
   
  

[IstioStatusBadRequestBody](#istio-status-bad-request-body)

##### <span id="istio-status-500"></span> 500 - A Internal is the error message that means something has gone wrong
Status: Internal Server Error

###### <span id="istio-status-500-schema"></span> Schema
   
  

[IstioStatusInternalServerErrorBody](#istio-status-internal-server-error-body)

###### Inlined models

**<span id="istio-status-bad-request-body"></span> IstioStatusBadRequestBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `400`| HTTP status code | `400` |
| Message | string| `string` |  | |  |  |



**<span id="istio-status-internal-server-error-body"></span> IstioStatusInternalServerErrorBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `500`| HTTP status code | `500` |
| Message | string| `string` |  | |  |  |



### <span id="logout"></span> logout (*logout*)

```
GET /api/logout
```

Endpoint to logout an user (unset the session cookie)

#### URI Schemes
  * http
  * https

#### All responses
| Code | Status | Description | Has headers | Schema |
|------|--------|-------------|:-----------:|--------|
| [204](#logout-204) | No Content | NoContent: the response is empty |  | [schema](#logout-204-schema) |

#### Responses


##### <span id="logout-204"></span> 204 - NoContent: the response is empty
Status: No Content

###### <span id="logout-204-schema"></span> Schema
   
  

[LogoutNoContentBody](#logout-no-content-body)

###### Inlined models

**<span id="logout-no-content-body"></span> LogoutNoContentBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `204`| HTTP status code | `204` |
| Message | string| `string` |  | |  |  |



### <span id="mesh-graph"></span> mesh graph (*meshGraph*)

```
GET /api/mesh/graph
```

The backing JSON for a mesh graph

#### URI Schemes
  * http
  * https

#### Produces
  * application/json

#### All responses
| Code | Status | Description | Has headers | Schema |
|------|--------|-------------|:-----------:|--------|
| [200](#mesh-graph-200) | OK | HTTP status code 200 and graph Config in data |  | [schema](#mesh-graph-200-schema) |
| [400](#mesh-graph-400) | Bad Request | BadRequestError: the client request is incorrect |  | [schema](#mesh-graph-400-schema) |
| [500](#mesh-graph-500) | Internal Server Error | A Internal is the error message that means something has gone wrong |  | [schema](#mesh-graph-500-schema) |

#### Responses


##### <span id="mesh-graph-200"></span> 200 - HTTP status code 200 and graph Config in data
Status: OK

###### <span id="mesh-graph-200-schema"></span> Schema
   
  

[CommonConfig](#common-config)

##### <span id="mesh-graph-400"></span> 400 - BadRequestError: the client request is incorrect
Status: Bad Request

###### <span id="mesh-graph-400-schema"></span> Schema
   
  

[MeshGraphBadRequestBody](#mesh-graph-bad-request-body)

##### <span id="mesh-graph-500"></span> 500 - A Internal is the error message that means something has gone wrong
Status: Internal Server Error

###### <span id="mesh-graph-500-schema"></span> Schema
   
  

[MeshGraphInternalServerErrorBody](#mesh-graph-internal-server-error-body)

###### Inlined models

**<span id="mesh-graph-bad-request-body"></span> MeshGraphBadRequestBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `400`| HTTP status code | `400` |
| Message | string| `string` |  | |  |  |



**<span id="mesh-graph-internal-server-error-body"></span> MeshGraphInternalServerErrorBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `500`| HTTP status code | `500` |
| Message | string| `string` |  | |  |  |



### <span id="mesh-tls"></span> mesh Tls (*meshTls*)

```
GET /api/mesh/tls
```

Get TLS status for the whole mesh

#### URI Schemes
  * http
  * https

#### Produces
  * application/json

#### All responses
| Code | Status | Description | Has headers | Schema |
|------|--------|-------------|:-----------:|--------|
| [200](#mesh-tls-200) | OK | Return the mTLS status of the whole Mesh |  | [schema](#mesh-tls-200-schema) |
| [400](#mesh-tls-400) | Bad Request | BadRequestError: the client request is incorrect |  | [schema](#mesh-tls-400-schema) |
| [500](#mesh-tls-500) | Internal Server Error | A Internal is the error message that means something has gone wrong |  | [schema](#mesh-tls-500-schema) |

#### Responses


##### <span id="mesh-tls-200"></span> 200 - Return the mTLS status of the whole Mesh
Status: OK

###### <span id="mesh-tls-200-schema"></span> Schema
   
  

[MTLSStatus](#m-tls-status)

##### <span id="mesh-tls-400"></span> 400 - BadRequestError: the client request is incorrect
Status: Bad Request

###### <span id="mesh-tls-400-schema"></span> Schema
   
  

[MeshTLSBadRequestBody](#mesh-tls-bad-request-body)

##### <span id="mesh-tls-500"></span> 500 - A Internal is the error message that means something has gone wrong
Status: Internal Server Error

###### <span id="mesh-tls-500-schema"></span> Schema
   
  

[MeshTLSInternalServerErrorBody](#mesh-tls-internal-server-error-body)

###### Inlined models

**<span id="mesh-tls-bad-request-body"></span> MeshTLSBadRequestBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `400`| HTTP status code | `400` |
| Message | string| `string` |  | |  |  |



**<span id="mesh-tls-internal-server-error-body"></span> MeshTLSInternalServerErrorBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `500`| HTTP status code | `500` |
| Message | string| `string` |  | |  |  |



### <span id="metrics-stats"></span> metrics stats (*metricsStats*)

```
POST /api/stats/metrics
```

Produces metrics statistics

#### URI Schemes
  * http
  * https

#### Produces
  * application/json

#### Parameters

| Name | Source | Type | Go type | Separator | Required | Default | Description |
|------|--------|------|---------|-----------| :------: |---------|-------------|
| Body | `body` | [MetricsStatsQueries](#metrics-stats-queries) | `models.MetricsStatsQueries` | |  | |  |

#### All responses
| Code | Status | Description | Has headers | Schema |
|------|--------|-------------|:-----------:|--------|
| [200](#metrics-stats-200) | OK | Response of the metrics stats query |  | [schema](#metrics-stats-200-schema) |
| [400](#metrics-stats-400) | Bad Request | BadRequestError: the client request is incorrect |  | [schema](#metrics-stats-400-schema) |
| [500](#metrics-stats-500) | Internal Server Error | A Internal is the error message that means something has gone wrong |  | [schema](#metrics-stats-500-schema) |
| [503](#metrics-stats-503) | Service Unavailable | A Internal is the error message that means something has gone wrong |  | [schema](#metrics-stats-503-schema) |

#### Responses


##### <span id="metrics-stats-200"></span> 200 - Response of the metrics stats query
Status: OK

###### <span id="metrics-stats-200-schema"></span> Schema
   
  

[MetricsStats](#metrics-stats)

##### <span id="metrics-stats-400"></span> 400 - BadRequestError: the client request is incorrect
Status: Bad Request

###### <span id="metrics-stats-400-schema"></span> Schema
   
  

[MetricsStatsBadRequestBody](#metrics-stats-bad-request-body)

##### <span id="metrics-stats-500"></span> 500 - A Internal is the error message that means something has gone wrong
Status: Internal Server Error

###### <span id="metrics-stats-500-schema"></span> Schema
   
  

[MetricsStatsInternalServerErrorBody](#metrics-stats-internal-server-error-body)

##### <span id="metrics-stats-503"></span> 503 - A Internal is the error message that means something has gone wrong
Status: Service Unavailable

###### <span id="metrics-stats-503-schema"></span> Schema
   
  

[MetricsStatsServiceUnavailableBody](#metrics-stats-service-unavailable-body)

###### Inlined models

**<span id="metrics-stats-bad-request-body"></span> MetricsStatsBadRequestBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `400`| HTTP status code | `400` |
| Message | string| `string` |  | |  |  |



**<span id="metrics-stats-internal-server-error-body"></span> MetricsStatsInternalServerErrorBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `500`| HTTP status code | `500` |
| Message | string| `string` |  | |  |  |



**<span id="metrics-stats-service-unavailable-body"></span> MetricsStatsServiceUnavailableBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `503`| HTTP status code | `503` |
| Message | string| `string` |  | |  |  |



### <span id="namespace-health-status-history"></span> namespace health status history (*namespaceHealthStatusHistory*)

```
GET /api/namespaces/{namespace}/health/history
```

Endpoint to fetch kiali_health_status time series for a namespace

#### URI Schemes
  * http
  * https

#### Produces
  * application/json

#### Parameters

| Name | Source | Type | Go type | Separator | Required | Default | Description |
|------|--------|------|---------|-----------| :------: |---------|-------------|
| namespace | `path` | string | `string` |  | ✓ |  | The namespace name. |
| clusterName | `query` | string | `string` |  |  |  | Cluster name |
| duration | `query` | int64 (formatted integer) | `int64` |  |  | `1800` | Duration of the query period, in seconds. |
| queryTime | `query` | string | `string` |  |  | `"now"` | Unix time (seconds) for query such that time range is [queryTime-duration..queryTime]. Default is now. |
| step | `query` | int64 (formatted integer) | `int64` |  |  | `15` | Step between datapoints, in seconds. |

#### All responses
| Code | Status | Description | Has headers | Schema |
|------|--------|-------------|:-----------:|--------|
| [200](#namespace-health-status-history-200) | OK | Metrics response model |  | [schema](#namespace-health-status-history-200-schema) |
| [400](#namespace-health-status-history-400) | Bad Request | BadRequestError: the client request is incorrect |  | [schema](#namespace-health-status-history-400-schema) |
| [403](#namespace-health-status-history-403) | Forbidden | ForbiddenError: the client is not allowed to access the requested namespace |  | [schema](#namespace-health-status-history-403-schema) |
| [503](#namespace-health-status-history-503) | Service Unavailable | A Internal is the error message that means something has gone wrong |  | [schema](#namespace-health-status-history-503-schema) |

#### Responses


##### <span id="namespace-health-status-history-200"></span> 200 - Metrics response model
Status: OK

###### <span id="namespace-health-status-history-200-schema"></span> Schema
   
  

map of [Metric](#metric)

##### <span id="namespace-health-status-history-400"></span> 400 - BadRequestError: the client request is incorrect
Status: Bad Request

###### <span id="namespace-health-status-history-400-schema"></span> Schema
   
  

[NamespaceHealthStatusHistoryBadRequestBody](#namespace-health-status-history-bad-request-body)

##### <span id="namespace-health-status-history-403"></span> 403 - ForbiddenError: the client is not allowed to access the requested namespace
Status: Forbidden

###### <span id="namespace-health-status-history-403-schema"></span> Schema
   
  

[NamespaceHealthStatusHistoryForbiddenBody](#namespace-health-status-history-forbidden-body)

##### <span id="namespace-health-status-history-503"></span> 503 - A Internal is the error message that means something has gone wrong
Status: Service Unavailable

###### <span id="namespace-health-status-history-503-schema"></span> Schema
   
  

[NamespaceHealthStatusHistoryServiceUnavailableBody](#namespace-health-status-history-service-unavailable-body)

###### Inlined models

**<span id="namespace-health-status-history-bad-request-body"></span> NamespaceHealthStatusHistoryBadRequestBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `400`| HTTP status code | `400` |
| Message | string| `string` |  | |  |  |



**<span id="namespace-health-status-history-forbidden-body"></span> NamespaceHealthStatusHistoryForbiddenBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `403`| HTTP status code | `403` |
| Message | string| `string` |  | |  |  |



**<span id="namespace-health-status-history-service-unavailable-body"></span> NamespaceHealthStatusHistoryServiceUnavailableBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `503`| HTTP status code | `503` |
| Message | string| `string` |  | |  |  |



### <span id="namespace-info"></span> namespace info (*namespaceInfo*)

```
GET /api/namespaces/{namespace}/info
```

Endpoint to get info about a single namespace

#### URI Schemes
  * http
  * https

#### Produces
  * application/json

#### Parameters

| Name | Source | Type | Go type | Separator | Required | Default | Description |
|------|--------|------|---------|-----------| :------: |---------|-------------|
| namespace | `path` | string | `string` |  | ✓ |  | The namespace name. |

#### All responses
| Code | Status | Description | Has headers | Schema |
|------|--------|-------------|:-----------:|--------|
| [200](#namespace-info-200) | OK | List of Namespaces |  | [schema](#namespace-info-200-schema) |
| [403](#namespace-info-403) | Forbidden | ForbiddenError: the client is not allowed to access the requested namespace |  | [schema](#namespace-info-403-schema) |
| [500](#namespace-info-500) | Internal Server Error | A Internal is the error message that means something has gone wrong |  | [schema](#namespace-info-500-schema) |

#### Responses


##### <span id="namespace-info-200"></span> 200 - List of Namespaces
Status: OK

###### <span id="namespace-info-200-schema"></span> Schema
   
  

[][Namespace](#namespace)

##### <span id="namespace-info-403"></span> 403 - ForbiddenError: the client is not allowed to access the requested namespace
Status: Forbidden

###### <span id="namespace-info-403-schema"></span> Schema
   
  

[NamespaceInfoForbiddenBody](#namespace-info-forbidden-body)

##### <span id="namespace-info-500"></span> 500 - A Internal is the error message that means something has gone wrong
Status: Internal Server Error

###### <span id="namespace-info-500-schema"></span> Schema
   
  

[NamespaceInfoInternalServerErrorBody](#namespace-info-internal-server-error-body)

###### Inlined models

**<span id="namespace-info-forbidden-body"></span> NamespaceInfoForbiddenBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `403`| HTTP status code | `403` |
| Message | string| `string` |  | |  |  |



**<span id="namespace-info-internal-server-error-body"></span> NamespaceInfoInternalServerErrorBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `500`| HTTP status code | `500` |
| Message | string| `string` |  | |  |  |



### <span id="namespace-list"></span> namespace list (*namespaceList*)

```
GET /api/namespaces
```

Endpoint to get the list of the available namespaces

#### URI Schemes
  * http
  * https

#### Produces
  * application/json

#### All responses
| Code | Status | Description | Has headers | Schema |
|------|--------|-------------|:-----------:|--------|
| [200](#namespace-list-200) | OK | List of Namespaces |  | [schema](#namespace-list-200-schema) |
| [500](#namespace-list-500) | Internal Server Error | A Internal is the error message that means something has gone wrong |  | [schema](#namespace-list-500-schema) |

#### Responses


##### <span id="namespace-list-200"></span> 200 - List of Namespaces
Status: OK

###### <span id="namespace-list-200-schema"></span> Schema
   
  

[][Namespace](#namespace)

##### <span id="namespace-list-500"></span> 500 - A Internal is the error message that means something has gone wrong
Status: Internal Server Error

###### <span id="namespace-list-500-schema"></span> Schema
   
  

[NamespaceListInternalServerErrorBody](#namespace-list-internal-server-error-body)

###### Inlined models

**<span id="namespace-list-internal-server-error-body"></span> NamespaceListInternalServerErrorBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `500`| HTTP status code | `500` |
| Message | string| `string` |  | |  |  |



### <span id="namespace-metrics"></span> namespace metrics (*namespaceMetrics*)

```
GET /api/namespaces/{namespace}/metrics
```

Endpoint to fetch metrics to be displayed, related to a namespace

#### URI Schemes
  * http
  * https

#### Produces
  * application/json

#### Parameters

| Name | Source | Type | Go type | Separator | Required | Default | Description |
|------|--------|------|---------|-----------| :------: |---------|-------------|
| namespace | `path` | string | `string` |  | ✓ |  | The namespace name. |

#### All responses
| Code | Status | Description | Has headers | Schema |
|------|--------|-------------|:-----------:|--------|
| [200](#namespace-metrics-200) | OK | Metrics response model |  | [schema](#namespace-metrics-200-schema) |
| [400](#namespace-metrics-400) | Bad Request | BadRequestError: the client request is incorrect |  | [schema](#namespace-metrics-400-schema) |
| [403](#namespace-metrics-403) | Forbidden | ForbiddenError: the client is not allowed to access the requested namespace |  | [schema](#namespace-metrics-403-schema) |
| [503](#namespace-metrics-503) | Service Unavailable | A Internal is the error message that means something has gone wrong |  | [schema](#namespace-metrics-503-schema) |

#### Responses


##### <span id="namespace-metrics-200"></span> 200 - Metrics response model
Status: OK

###### <span id="namespace-metrics-200-schema"></span> Schema
   
  

map of [Metric](#metric)

##### <span id="namespace-metrics-400"></span> 400 - BadRequestError: the client request is incorrect
Status: Bad Request

###### <span id="namespace-metrics-400-schema"></span> Schema
   
  

[NamespaceMetricsBadRequestBody](#namespace-metrics-bad-request-body)

##### <span id="namespace-metrics-403"></span> 403 - ForbiddenError: the client is not allowed to access the requested namespace
Status: Forbidden

###### <span id="namespace-metrics-403-schema"></span> Schema
   
  

[NamespaceMetricsForbiddenBody](#namespace-metrics-forbidden-body)

##### <span id="namespace-metrics-503"></span> 503 - A Internal is the error message that means something has gone wrong
Status: Service Unavailable

###### <span id="namespace-metrics-503-schema"></span> Schema
   
  

[NamespaceMetricsServiceUnavailableBody](#namespace-metrics-service-unavailable-body)

###### Inlined models

**<span id="namespace-metrics-bad-request-body"></span> NamespaceMetricsBadRequestBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `400`| HTTP status code | `400` |
| Message | string| `string` |  | |  |  |



**<span id="namespace-metrics-forbidden-body"></span> NamespaceMetricsForbiddenBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `403`| HTTP status code | `403` |
| Message | string| `string` |  | |  |  |



**<span id="namespace-metrics-service-unavailable-body"></span> NamespaceMetricsServiceUnavailableBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `503`| HTTP status code | `503` |
| Message | string| `string` |  | |  |  |



### <span id="namespace-tls"></span> namespace Tls (*namespaceTls*)

```
GET /api/namespaces/{namespace}/tls
```

Get TLS status for the given namespace

#### URI Schemes
  * http
  * https

#### Produces
  * application/json

#### Parameters

| Name | Source | Type | Go type | Separator | Required | Default | Description |
|------|--------|------|---------|-----------| :------: |---------|-------------|
| namespace | `path` | string | `string` |  | ✓ |  | The namespace name. |

#### All responses
| Code | Status | Description | Has headers | Schema |
|------|--------|-------------|:-----------:|--------|
| [200](#namespace-tls-200) | OK | Return the mTLS status of a specific Namespace |  | [schema](#namespace-tls-200-schema) |
| [400](#namespace-tls-400) | Bad Request | BadRequestError: the client request is incorrect |  | [schema](#namespace-tls-400-schema) |
| [403](#namespace-tls-403) | Forbidden | ForbiddenError: the client is not allowed to access the requested namespace |  | [schema](#namespace-tls-403-schema) |
| [500](#namespace-tls-500) | Internal Server Error | A Internal is the error message that means something has gone wrong |  | [schema](#namespace-tls-500-schema) |

#### Responses


##### <span id="namespace-tls-200"></span> 200 - Return the mTLS status of a specific Namespace
Status: OK

###### <span id="namespace-tls-200-schema"></span> Schema
   
  

[MTLSStatus](#m-tls-status)

##### <span id="namespace-tls-400"></span> 400 - BadRequestError: the client request is incorrect
Status: Bad Request

###### <span id="namespace-tls-400-schema"></span> Schema
   
  

[NamespaceTLSBadRequestBody](#namespace-tls-bad-request-body)

##### <span id="namespace-tls-403"></span> 403 - ForbiddenError: the client is not allowed to access the requested namespace
Status: Forbidden

###### <span id="namespace-tls-403-schema"></span> Schema
   
  

[NamespaceTLSForbiddenBody](#namespace-tls-forbidden-body)

##### <span id="namespace-tls-500"></span> 500 - A Internal is the error message that means something has gone wrong
Status: Internal Server Error

###### <span id="namespace-tls-500-schema"></span> Schema
   
  

[NamespaceTLSInternalServerErrorBody](#namespace-tls-internal-server-error-body)

###### Inlined models

**<span id="namespace-tls-bad-request-body"></span> NamespaceTLSBadRequestBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `400`| HTTP status code | `400` |
| Message | string| `string` |  | |  |  |



**<span id="namespace-tls-forbidden-body"></span> NamespaceTLSForbiddenBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `403`| HTTP status code | `403` |
| Message | string| `string` |  | |  |  |



**<span id="namespace-tls-internal-server-error-body"></span> NamespaceTLSInternalServerErrorBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `500`| HTTP status code | `500` |
| Message | string| `string` |  | |  |  |



### <span id="namespace-update"></span> Endpoint to update the Namespace configuration using Json Merge Patch strategy. (*namespaceUpdate*)

```
PATCH /api/namespaces/{namespace}
```

#### URI Schemes
  * http
  * https

#### Consumes
  * application/json

#### Produces
  * application/json

#### Parameters

| Name | Source | Type | Go type | Separator | Required | Default | Description |
|------|--------|------|---------|-----------| :------: |---------|-------------|
| namespace | `path` | string | `string` |  | ✓ |  | The namespace name. |

#### All responses
| Code | Status | Description | Has headers | Schema |
|------|--------|-------------|:-----------:|--------|
| [200](#namespace-update-200) | OK | namespaceResponse is a basic namespace |  | [schema](#namespace-update-200-schema) |
| [400](#namespace-update-400) | Bad Request | BadRequestError: the client request is incorrect |  | [schema](#namespace-update-400-schema) |
| [403](#namespace-update-403) | Forbidden | ForbiddenError: the client is not allowed to access the requested namespace |  | [schema](#namespace-update-403-schema) |
| [404](#namespace-update-404) | Not Found | A NotFoundError is the error message that is generated when server could not find what was requested. |  | [schema](#namespace-update-404-schema) |
| [500](#namespace-update-500) | Internal Server Error | A Internal is the error message that means something has gone wrong |  | [schema](#namespace-update-500-schema) |

#### Responses


##### <span id="namespace-update-200"></span> 200 - namespaceResponse is a basic namespace
Status: OK

###### <span id="namespace-update-200-schema"></span> Schema
   
  

[Namespace](#namespace)

##### <span id="namespace-update-400"></span> 400 - BadRequestError: the client request is incorrect
Status: Bad Request

###### <span id="namespace-update-400-schema"></span> Schema
   
  

[NamespaceUpdateBadRequestBody](#namespace-update-bad-request-body)

##### <span id="namespace-update-403"></span> 403 - ForbiddenError: the client is not allowed to access the requested namespace
Status: Forbidden

###### <span id="namespace-update-403-schema"></span> Schema
   
  

[NamespaceUpdateForbiddenBody](#namespace-update-forbidden-body)

##### <span id="namespace-update-404"></span> 404 - A NotFoundError is the error message that is generated when server could not find what was requested.
Status: Not Found

###### <span id="namespace-update-404-schema"></span> Schema
   
  

[NamespaceUpdateNotFoundBody](#namespace-update-not-found-body)

##### <span id="namespace-update-500"></span> 500 - A Internal is the error message that means something has gone wrong
Status: Internal Server Error

###### <span id="namespace-update-500-schema"></span> Schema
   
  

[NamespaceUpdateInternalServerErrorBody](#namespace-update-internal-server-error-body)

###### Inlined models

**<span id="namespace-update-bad-request-body"></span> NamespaceUpdateBadRequestBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `400`| HTTP status code | `400` |
| Message | string| `string` |  | |  |  |



**<span id="namespace-update-forbidden-body"></span> NamespaceUpdateForbiddenBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `403`| HTTP status code | `403` |
| Message | string| `string` |  | |  |  |



**<span id="namespace-update-internal-server-error-body"></span> NamespaceUpdateInternalServerErrorBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `500`| HTTP status code | `500` |
| Message | string| `string` |  | |  |  |



**<span id="namespace-update-not-found-body"></span> NamespaceUpdateNotFoundBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `404`| HTTP status code | `404` |
| Message | string| `string` |  | |  |  |



### <span id="namespace-validations"></span> namespace validations (*namespaceValidations*)

```
GET /api/namespaces/{namespace}/validations
```

Get validation summary for all objects in the given namespace

#### URI Schemes
  * http
  * https

#### Produces
  * application/json

#### Parameters

| Name | Source | Type | Go type | Separator | Required | Default | Description |
|------|--------|------|---------|-----------| :------: |---------|-------------|
| namespace | `path` | string | `string` |  | ✓ |  | The namespace name. |

#### All responses
| Code | Status | Description | Has headers | Schema |
|------|--------|-------------|:-----------:|--------|
| [200](#namespace-validations-200) | OK | Return the validation status of a specific Namespace |  | [schema](#namespace-validations-200-schema) |
| [400](#namespace-validations-400) | Bad Request | BadRequestError: the client request is incorrect |  | [schema](#namespace-validations-400-schema) |
| [403](#namespace-validations-403) | Forbidden | ForbiddenError: the client is not allowed to access the requested namespace |  | [schema](#namespace-validations-403-schema) |
| [500](#namespace-validations-500) | Internal Server Error | A Internal is the error message that means something has gone wrong |  | [schema](#namespace-validations-500-schema) |

#### Responses


##### <span id="namespace-validations-200"></span> 200 - Return the validation status of a specific Namespace
Status: OK

###### <span id="namespace-validations-200-schema"></span> Schema
   
  

[IstioValidationSummary](#istio-validation-summary)

##### <span id="namespace-validations-400"></span> 400 - BadRequestError: the client request is incorrect
Status: Bad Request

###### <span id="namespace-validations-400-schema"></span> Schema
   
  

[NamespaceValidationsBadRequestBody](#namespace-validations-bad-request-body)

##### <span id="namespace-validations-403"></span> 403 - ForbiddenError: the client is not allowed to access the requested namespace
Status: Forbidden

###### <span id="namespace-validations-403-schema"></span> Schema
   
  

[NamespaceValidationsForbiddenBody](#namespace-validations-forbidden-body)

##### <span id="namespace-validations-500"></span> 500 - A Internal is the error message that means something has gone wrong
Status: Internal Server Error

###### <span id="namespace-validations-500-schema"></span> Schema
   
  

[NamespaceValidationsInternalServerErrorBody](#namespace-validations-internal-server-error-body)

###### Inlined models

**<span id="namespace-validations-bad-request-body"></span> NamespaceValidationsBadRequestBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `400`| HTTP status code | `400` |
| Message | string| `string` |  | |  |  |



**<span id="namespace-validations-forbidden-body"></span> NamespaceValidationsForbiddenBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `403`| HTTP status code | `403` |
| Message | string| `string` |  | |  |  |



**<span id="namespace-validations-internal-server-error-body"></span> NamespaceValidationsInternalServerErrorBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `500`| HTTP status code | `500` |
| Message | string| `string` |  | |  |  |



### <span id="namespaces-validations"></span> namespaces validations (*namespacesValidations*)

```
GET /api/istio/validations
```

Get validation summary for all objects in the given namespaces

#### URI Schemes
  * http
  * https

#### Produces
  * application/json

#### All responses
| Code | Status | Description | Has headers | Schema |
|------|--------|-------------|:-----------:|--------|
| [200](#namespaces-validations-200) | OK | Return the validation status of a specific Namespace |  | [schema](#namespaces-validations-200-schema) |
| [400](#namespaces-validations-400) | Bad Request | BadRequestError: the client request is incorrect |  | [schema](#namespaces-validations-400-schema) |
| [500](#namespaces-validations-500) | Internal Server Error | A Internal is the error message that means something has gone wrong |  | [schema](#namespaces-validations-500-schema) |

#### Responses


##### <span id="namespaces-validations-200"></span> 200 - Return the validation status of a specific Namespace
Status: OK

###### <span id="namespaces-validations-200-schema"></span> Schema
   
  

[IstioValidationSummary](#istio-validation-summary)

##### <span id="namespaces-validations-400"></span> 400 - BadRequestError: the client request is incorrect
Status: Bad Request

###### <span id="namespaces-validations-400-schema"></span> Schema
   
  

[NamespacesValidationsBadRequestBody](#namespaces-validations-bad-request-body)

##### <span id="namespaces-validations-500"></span> 500 - A Internal is the error message that means something has gone wrong
Status: Internal Server Error

###### <span id="namespaces-validations-500-schema"></span> Schema
   
  

[NamespacesValidationsInternalServerErrorBody](#namespaces-validations-internal-server-error-body)

###### Inlined models

**<span id="namespaces-validations-bad-request-body"></span> NamespacesValidationsBadRequestBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `400`| HTTP status code | `400` |
| Message | string| `string` |  | |  |  |



**<span id="namespaces-validations-internal-server-error-body"></span> NamespacesValidationsInternalServerErrorBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `500`| HTTP status code | `500` |
| Message | string| `string` |  | |  |  |



### <span id="openid-redirect"></span> openid redirect (*openidRedirect*)

```
GET /api/auth/openid_redirect
```

Endpoint to redirect the browser of the user to the authentication
endpoint of the configured OpenId provider.

#### URI Schemes
  * http
  * https

#### Consumes
  * application/json

#### Produces
  * application/html

#### All responses
| Code | Status | Description | Has headers | Schema |
|------|--------|-------------|:-----------:|--------|
| [200](#openid-redirect-200) | OK | NoContent: the response is empty |  | [schema](#openid-redirect-200-schema) |
| [500](#openid-redirect-500) | Internal Server Error | A Internal is the error message that means something has gone wrong |  | [schema](#openid-redirect-500-schema) |

#### Responses


##### <span id="openid-redirect-200"></span> 200 - NoContent: the response is empty
Status: OK

###### <span id="openid-redirect-200-schema"></span> Schema
   
  

[OpenidRedirectOKBody](#openid-redirect-o-k-body)

##### <span id="openid-redirect-500"></span> 500 - A Internal is the error message that means something has gone wrong
Status: Internal Server Error

###### <span id="openid-redirect-500-schema"></span> Schema
   
  

[OpenidRedirectInternalServerErrorBody](#openid-redirect-internal-server-error-body)

###### Inlined models

**<span id="openid-redirect-internal-server-error-body"></span> OpenidRedirectInternalServerErrorBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `500`| HTTP status code | `500` |
| Message | string| `string` |  | |  |  |



**<span id="openid-redirect-o-k-body"></span> OpenidRedirectOKBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `204`| HTTP status code | `204` |
| Message | string| `string` |  | |  |  |



### <span id="openshift-check-token"></span> openshift check token (*openshiftCheckToken*)

```
POST /api/authenticate
```

Endpoint to check if a token from Openshift is working correctly

#### URI Schemes
  * http
  * https

#### Produces
  * application/json

#### All responses
| Code | Status | Description | Has headers | Schema |
|------|--------|-------------|:-----------:|--------|
| [200](#openshift-check-token-200) | OK | HTTP status code 200 and userGenerated model in data |  | [schema](#openshift-check-token-200-schema) |
| [500](#openshift-check-token-500) | Internal Server Error | A Internal is the error message that means something has gone wrong |  | [schema](#openshift-check-token-500-schema) |

#### Responses


##### <span id="openshift-check-token-200"></span> 200 - HTTP status code 200 and userGenerated model in data
Status: OK

###### <span id="openshift-check-token-200-schema"></span> Schema
   
  

[UserSessionData](#user-session-data)

##### <span id="openshift-check-token-500"></span> 500 - A Internal is the error message that means something has gone wrong
Status: Internal Server Error

###### <span id="openshift-check-token-500-schema"></span> Schema
   
  

[OpenshiftCheckTokenInternalServerErrorBody](#openshift-check-token-internal-server-error-body)

###### Inlined models

**<span id="openshift-check-token-internal-server-error-body"></span> OpenshiftCheckTokenInternalServerErrorBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `500`| HTTP status code | `500` |
| Message | string| `string` |  | |  |  |



### <span id="overview-app-rates"></span> overview app rates (*overviewAppRates*)

```
GET /api/overview/metrics/apps/rates
```

Endpoint to fetch app request rates across all clusters and namespaces

#### URI Schemes
  * http
  * https

#### Produces
  * application/json

#### All responses
| Code | Status | Description | Has headers | Schema |
|------|--------|-------------|:-----------:|--------|
| [400](#overview-app-rates-400) | Bad Request | BadRequestError: the client request is incorrect |  | [schema](#overview-app-rates-400-schema) |
| [503](#overview-app-rates-503) | Service Unavailable | A Internal is the error message that means something has gone wrong |  | [schema](#overview-app-rates-503-schema) |

#### Responses


##### <span id="overview-app-rates-400"></span> 400 - BadRequestError: the client request is incorrect
Status: Bad Request

###### <span id="overview-app-rates-400-schema"></span> Schema
   
  

[OverviewAppRatesBadRequestBody](#overview-app-rates-bad-request-body)

##### <span id="overview-app-rates-503"></span> 503 - A Internal is the error message that means something has gone wrong
Status: Service Unavailable

###### <span id="overview-app-rates-503-schema"></span> Schema
   
  

[OverviewAppRatesServiceUnavailableBody](#overview-app-rates-service-unavailable-body)

###### Inlined models

**<span id="overview-app-rates-bad-request-body"></span> OverviewAppRatesBadRequestBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `400`| HTTP status code | `400` |
| Message | string| `string` |  | |  |  |



**<span id="overview-app-rates-service-unavailable-body"></span> OverviewAppRatesServiceUnavailableBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `503`| HTTP status code | `503` |
| Message | string| `string` |  | |  |  |



### <span id="overview-service-latencies"></span> overview service latencies (*overviewServiceLatencies*)

```
GET /api/overview/metrics/services/latency
```

Endpoint to fetch top service latencies (p95) across all clusters and namespaces

#### URI Schemes
  * http
  * https

#### Produces
  * application/json

#### All responses
| Code | Status | Description | Has headers | Schema |
|------|--------|-------------|:-----------:|--------|
| [400](#overview-service-latencies-400) | Bad Request | BadRequestError: the client request is incorrect |  | [schema](#overview-service-latencies-400-schema) |
| [503](#overview-service-latencies-503) | Service Unavailable | A Internal is the error message that means something has gone wrong |  | [schema](#overview-service-latencies-503-schema) |

#### Responses


##### <span id="overview-service-latencies-400"></span> 400 - BadRequestError: the client request is incorrect
Status: Bad Request

###### <span id="overview-service-latencies-400-schema"></span> Schema
   
  

[OverviewServiceLatenciesBadRequestBody](#overview-service-latencies-bad-request-body)

##### <span id="overview-service-latencies-503"></span> 503 - A Internal is the error message that means something has gone wrong
Status: Service Unavailable

###### <span id="overview-service-latencies-503-schema"></span> Schema
   
  

[OverviewServiceLatenciesServiceUnavailableBody](#overview-service-latencies-service-unavailable-body)

###### Inlined models

**<span id="overview-service-latencies-bad-request-body"></span> OverviewServiceLatenciesBadRequestBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `400`| HTTP status code | `400` |
| Message | string| `string` |  | |  |  |



**<span id="overview-service-latencies-service-unavailable-body"></span> OverviewServiceLatenciesServiceUnavailableBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `503`| HTTP status code | `503` |
| Message | string| `string` |  | |  |  |



### <span id="overview-service-rates"></span> overview service rates (*overviewServiceRates*)

```
GET /api/overview/metrics/services/rates
```

Endpoint to fetch top service error rates across all clusters and namespaces

#### URI Schemes
  * http
  * https

#### Produces
  * application/json

#### All responses
| Code | Status | Description | Has headers | Schema |
|------|--------|-------------|:-----------:|--------|
| [400](#overview-service-rates-400) | Bad Request | BadRequestError: the client request is incorrect |  | [schema](#overview-service-rates-400-schema) |
| [503](#overview-service-rates-503) | Service Unavailable | A Internal is the error message that means something has gone wrong |  | [schema](#overview-service-rates-503-schema) |

#### Responses


##### <span id="overview-service-rates-400"></span> 400 - BadRequestError: the client request is incorrect
Status: Bad Request

###### <span id="overview-service-rates-400-schema"></span> Schema
   
  

[OverviewServiceRatesBadRequestBody](#overview-service-rates-bad-request-body)

##### <span id="overview-service-rates-503"></span> 503 - A Internal is the error message that means something has gone wrong
Status: Service Unavailable

###### <span id="overview-service-rates-503-schema"></span> Schema
   
  

[OverviewServiceRatesServiceUnavailableBody](#overview-service-rates-service-unavailable-body)

###### Inlined models

**<span id="overview-service-rates-bad-request-body"></span> OverviewServiceRatesBadRequestBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `400`| HTTP status code | `400` |
| Message | string| `string` |  | |  |  |



**<span id="overview-service-rates-service-unavailable-body"></span> OverviewServiceRatesServiceUnavailableBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `503`| HTTP status code | `503` |
| Message | string| `string` |  | |  |  |



### <span id="overview-service-throughput"></span> overview service throughput (*overviewServiceThroughput*)

```
GET /api/overview/metrics/services/throughput
```

Endpoint to fetch top service throughput (bytes/s) across all clusters and namespaces

#### URI Schemes
  * http
  * https

#### Produces
  * application/json

#### All responses
| Code | Status | Description | Has headers | Schema |
|------|--------|-------------|:-----------:|--------|
| [400](#overview-service-throughput-400) | Bad Request | BadRequestError: the client request is incorrect |  | [schema](#overview-service-throughput-400-schema) |
| [503](#overview-service-throughput-503) | Service Unavailable | A Internal is the error message that means something has gone wrong |  | [schema](#overview-service-throughput-503-schema) |

#### Responses


##### <span id="overview-service-throughput-400"></span> 400 - BadRequestError: the client request is incorrect
Status: Bad Request

###### <span id="overview-service-throughput-400-schema"></span> Schema
   
  

[OverviewServiceThroughputBadRequestBody](#overview-service-throughput-bad-request-body)

##### <span id="overview-service-throughput-503"></span> 503 - A Internal is the error message that means something has gone wrong
Status: Service Unavailable

###### <span id="overview-service-throughput-503-schema"></span> Schema
   
  

[OverviewServiceThroughputServiceUnavailableBody](#overview-service-throughput-service-unavailable-body)

###### Inlined models

**<span id="overview-service-throughput-bad-request-body"></span> OverviewServiceThroughputBadRequestBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `400`| HTTP status code | `400` |
| Message | string| `string` |  | |  |  |



**<span id="overview-service-throughput-service-unavailable-body"></span> OverviewServiceThroughputServiceUnavailableBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `503`| HTTP status code | `503` |
| Message | string| `string` |  | |  |  |



### <span id="perses-info"></span> perses info (*persesInfo*)

```
GET /api/perses
```

Get the perses URL and other descriptors

#### URI Schemes
  * http
  * https

#### Produces
  * application/json

#### All responses
| Code | Status | Description | Has headers | Schema |
|------|--------|-------------|:-----------:|--------|
| [200](#perses-info-200) | OK | Response of the perses info query |  | [schema](#perses-info-200-schema) |
| [204](#perses-info-204) | No Content | NoContent: the response is empty |  | [schema](#perses-info-204-schema) |
| [500](#perses-info-500) | Internal Server Error | A Internal is the error message that means something has gone wrong |  | [schema](#perses-info-500-schema) |
| [503](#perses-info-503) | Service Unavailable | A Internal is the error message that means something has gone wrong |  | [schema](#perses-info-503-schema) |

#### Responses


##### <span id="perses-info-200"></span> 200 - Response of the perses info query
Status: OK

###### <span id="perses-info-200-schema"></span> Schema
   
  

[PersesInfo](#perses-info)

##### <span id="perses-info-204"></span> 204 - NoContent: the response is empty
Status: No Content

###### <span id="perses-info-204-schema"></span> Schema
   
  

[PersesInfoNoContentBody](#perses-info-no-content-body)

##### <span id="perses-info-500"></span> 500 - A Internal is the error message that means something has gone wrong
Status: Internal Server Error

###### <span id="perses-info-500-schema"></span> Schema
   
  

[PersesInfoInternalServerErrorBody](#perses-info-internal-server-error-body)

##### <span id="perses-info-503"></span> 503 - A Internal is the error message that means something has gone wrong
Status: Service Unavailable

###### <span id="perses-info-503-schema"></span> Schema
   
  

[PersesInfoServiceUnavailableBody](#perses-info-service-unavailable-body)

###### Inlined models

**<span id="perses-info-internal-server-error-body"></span> PersesInfoInternalServerErrorBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `500`| HTTP status code | `500` |
| Message | string| `string` |  | |  |  |



**<span id="perses-info-no-content-body"></span> PersesInfoNoContentBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `204`| HTTP status code | `204` |
| Message | string| `string` |  | |  |  |



**<span id="perses-info-service-unavailable-body"></span> PersesInfoServiceUnavailableBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `503`| HTTP status code | `503` |
| Message | string| `string` |  | |  |  |



### <span id="pod-details"></span> pod details (*podDetails*)

```
GET /api/namespaces/{namespace}/pods/{pod}
```

Endpoint to get pod details

#### URI Schemes
  * http
  * https

#### Produces
  * application/json

#### Parameters

| Name | Source | Type | Go type | Separator | Required | Default | Description |
|------|--------|------|---------|-----------| :------: |---------|-------------|
| namespace | `path` | string | `string` |  | ✓ |  | The namespace name. |
| pod | `path` | string | `string` |  | ✓ |  | The pod name. |

#### All responses
| Code | Status | Description | Has headers | Schema |
|------|--------|-------------|:-----------:|--------|
| [200](#pod-details-200) | OK | Listing all the information related to a workload |  | [schema](#pod-details-200-schema) |
| [403](#pod-details-403) | Forbidden | ForbiddenError: the client is not allowed to access the requested namespace |  | [schema](#pod-details-403-schema) |
| [404](#pod-details-404) | Not Found | A NotFoundError is the error message that is generated when server could not find what was requested. |  | [schema](#pod-details-404-schema) |
| [500](#pod-details-500) | Internal Server Error | A Internal is the error message that means something has gone wrong |  | [schema](#pod-details-500-schema) |

#### Responses


##### <span id="pod-details-200"></span> 200 - Listing all the information related to a workload
Status: OK

###### <span id="pod-details-200-schema"></span> Schema
   
  

[ModelsWorkload](#models-workload)

##### <span id="pod-details-403"></span> 403 - ForbiddenError: the client is not allowed to access the requested namespace
Status: Forbidden

###### <span id="pod-details-403-schema"></span> Schema
   
  

[PodDetailsForbiddenBody](#pod-details-forbidden-body)

##### <span id="pod-details-404"></span> 404 - A NotFoundError is the error message that is generated when server could not find what was requested.
Status: Not Found

###### <span id="pod-details-404-schema"></span> Schema
   
  

[PodDetailsNotFoundBody](#pod-details-not-found-body)

##### <span id="pod-details-500"></span> 500 - A Internal is the error message that means something has gone wrong
Status: Internal Server Error

###### <span id="pod-details-500-schema"></span> Schema
   
  

[PodDetailsInternalServerErrorBody](#pod-details-internal-server-error-body)

###### Inlined models

**<span id="pod-details-forbidden-body"></span> PodDetailsForbiddenBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `403`| HTTP status code | `403` |
| Message | string| `string` |  | |  |  |



**<span id="pod-details-internal-server-error-body"></span> PodDetailsInternalServerErrorBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `500`| HTTP status code | `500` |
| Message | string| `string` |  | |  |  |



**<span id="pod-details-not-found-body"></span> PodDetailsNotFoundBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `404`| HTTP status code | `404` |
| Message | string| `string` |  | |  |  |



### <span id="pod-logs"></span> pod logs (*podLogs*)

```
GET /api/namespaces/{namespace}/pods/{pod}/logs
```

Endpoint to get pod logs

#### URI Schemes
  * http
  * https

#### Produces
  * application/json

#### Parameters

| Name | Source | Type | Go type | Separator | Required | Default | Description |
|------|--------|------|---------|-----------| :------: |---------|-------------|
| namespace | `path` | string | `string` |  | ✓ |  | The namespace name. |
| pod | `path` | string | `string` |  | ✓ |  | The pod name. |
| container | `query` | string | `string` |  |  |  | The pod container name. Optional for single-container pod. Otherwise required. |
| duration | `query` | string | `string` |  |  |  | Query time-range duration (Golang string duration). Duration starts on</br>`sinceTime` if set, or the time for the first log message if not set. |
| sinceTime | `query` | string | `string` |  |  |  | The start time for fetching logs. UNIX time in seconds. Default is all logs. |

#### All responses
| Code | Status | Description | Has headers | Schema |
|------|--------|-------------|:-----------:|--------|
| [200](#pod-logs-200) | OK | Listing all the information related to a workload |  | [schema](#pod-logs-200-schema) |
| [403](#pod-logs-403) | Forbidden | ForbiddenError: the client is not allowed to access the requested namespace |  | [schema](#pod-logs-403-schema) |
| [404](#pod-logs-404) | Not Found | A NotFoundError is the error message that is generated when server could not find what was requested. |  | [schema](#pod-logs-404-schema) |
| [500](#pod-logs-500) | Internal Server Error | A Internal is the error message that means something has gone wrong |  | [schema](#pod-logs-500-schema) |

#### Responses


##### <span id="pod-logs-200"></span> 200 - Listing all the information related to a workload
Status: OK

###### <span id="pod-logs-200-schema"></span> Schema
   
  

[ModelsWorkload](#models-workload)

##### <span id="pod-logs-403"></span> 403 - ForbiddenError: the client is not allowed to access the requested namespace
Status: Forbidden

###### <span id="pod-logs-403-schema"></span> Schema
   
  

[PodLogsForbiddenBody](#pod-logs-forbidden-body)

##### <span id="pod-logs-404"></span> 404 - A NotFoundError is the error message that is generated when server could not find what was requested.
Status: Not Found

###### <span id="pod-logs-404-schema"></span> Schema
   
  

[PodLogsNotFoundBody](#pod-logs-not-found-body)

##### <span id="pod-logs-500"></span> 500 - A Internal is the error message that means something has gone wrong
Status: Internal Server Error

###### <span id="pod-logs-500-schema"></span> Schema
   
  

[PodLogsInternalServerErrorBody](#pod-logs-internal-server-error-body)

###### Inlined models

**<span id="pod-logs-forbidden-body"></span> PodLogsForbiddenBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `403`| HTTP status code | `403` |
| Message | string| `string` |  | |  |  |



**<span id="pod-logs-internal-server-error-body"></span> PodLogsInternalServerErrorBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `500`| HTTP status code | `500` |
| Message | string| `string` |  | |  |  |



**<span id="pod-logs-not-found-body"></span> PodLogsNotFoundBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `404`| HTTP status code | `404` |
| Message | string| `string` |  | |  |  |



### <span id="pod-proxy-dump"></span> pod proxy dump (*podProxyDump*)

```
GET /api/namespaces/{namespace}/pods/{pod}/config_dump
```

Endpoint to get pod proxy dump

#### URI Schemes
  * http
  * https

#### Produces
  * application/json

#### Parameters

| Name | Source | Type | Go type | Separator | Required | Default | Description |
|------|--------|------|---------|-----------| :------: |---------|-------------|
| namespace | `path` | string | `string` |  | ✓ |  | The namespace name. |
| pod | `path` | string | `string` |  | ✓ |  | The pod name. |

#### All responses
| Code | Status | Description | Has headers | Schema |
|------|--------|-------------|:-----------:|--------|
| [200](#pod-proxy-dump-200) | OK | Return a dump of the configuration of a given envoy proxy |  | [schema](#pod-proxy-dump-200-schema) |
| [403](#pod-proxy-dump-403) | Forbidden | ForbiddenError: the client is not allowed to access the requested namespace |  | [schema](#pod-proxy-dump-403-schema) |
| [404](#pod-proxy-dump-404) | Not Found | A NotFoundError is the error message that is generated when server could not find what was requested. |  | [schema](#pod-proxy-dump-404-schema) |
| [500](#pod-proxy-dump-500) | Internal Server Error | A Internal is the error message that means something has gone wrong |  | [schema](#pod-proxy-dump-500-schema) |

#### Responses


##### <span id="pod-proxy-dump-200"></span> 200 - Return a dump of the configuration of a given envoy proxy
Status: OK

###### <span id="pod-proxy-dump-200-schema"></span> Schema
   
  

[EnvoyProxyDump](#envoy-proxy-dump)

##### <span id="pod-proxy-dump-403"></span> 403 - ForbiddenError: the client is not allowed to access the requested namespace
Status: Forbidden

###### <span id="pod-proxy-dump-403-schema"></span> Schema
   
  

[PodProxyDumpForbiddenBody](#pod-proxy-dump-forbidden-body)

##### <span id="pod-proxy-dump-404"></span> 404 - A NotFoundError is the error message that is generated when server could not find what was requested.
Status: Not Found

###### <span id="pod-proxy-dump-404-schema"></span> Schema
   
  

[PodProxyDumpNotFoundBody](#pod-proxy-dump-not-found-body)

##### <span id="pod-proxy-dump-500"></span> 500 - A Internal is the error message that means something has gone wrong
Status: Internal Server Error

###### <span id="pod-proxy-dump-500-schema"></span> Schema
   
  

[PodProxyDumpInternalServerErrorBody](#pod-proxy-dump-internal-server-error-body)

###### Inlined models

**<span id="pod-proxy-dump-forbidden-body"></span> PodProxyDumpForbiddenBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `403`| HTTP status code | `403` |
| Message | string| `string` |  | |  |  |



**<span id="pod-proxy-dump-internal-server-error-body"></span> PodProxyDumpInternalServerErrorBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `500`| HTTP status code | `500` |
| Message | string| `string` |  | |  |  |



**<span id="pod-proxy-dump-not-found-body"></span> PodProxyDumpNotFoundBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `404`| HTTP status code | `404` |
| Message | string| `string` |  | |  |  |



### <span id="pod-proxy-logging"></span> pod proxy logging (*podProxyLogging*)

```
POST /api/namespaces/{namespace}/pods/{pod}/logging
```

Endpoint to set pod proxy log level

#### URI Schemes
  * http
  * https

#### Produces
  * application/json

#### Parameters

| Name | Source | Type | Go type | Separator | Required | Default | Description |
|------|--------|------|---------|-----------| :------: |---------|-------------|
| namespace | `path` | string | `string` |  | ✓ |  | The namespace name. |
| pod | `path` | string | `string` |  | ✓ |  | The pod name. |
| level | `query` | string | `string` |  | ✓ |  | The log level for the pod's proxy.</br>off ProxyLogLevelOff</br>trace ProxyLogLevelTrace</br>debug ProxyLogLevelDebug</br>info ProxyLogLevelInfo</br>warning ProxyLogLevelWarning</br>error ProxyLogLevelError</br>critical ProxyLogLevelCritical |

#### All responses
| Code | Status | Description | Has headers | Schema |
|------|--------|-------------|:-----------:|--------|
| [200](#pod-proxy-logging-200) | OK | NoContent: the response is empty |  | [schema](#pod-proxy-logging-200-schema) |
| [400](#pod-proxy-logging-400) | Bad Request | BadRequestError: the client request is incorrect |  | [schema](#pod-proxy-logging-400-schema) |
| [403](#pod-proxy-logging-403) | Forbidden | ForbiddenError: the client is not allowed to access the requested namespace |  | [schema](#pod-proxy-logging-403-schema) |
| [404](#pod-proxy-logging-404) | Not Found | A NotFoundError is the error message that is generated when server could not find what was requested. |  | [schema](#pod-proxy-logging-404-schema) |
| [500](#pod-proxy-logging-500) | Internal Server Error | A Internal is the error message that means something has gone wrong |  | [schema](#pod-proxy-logging-500-schema) |

#### Responses


##### <span id="pod-proxy-logging-200"></span> 200 - NoContent: the response is empty
Status: OK

###### <span id="pod-proxy-logging-200-schema"></span> Schema
   
  

[PodProxyLoggingOKBody](#pod-proxy-logging-o-k-body)

##### <span id="pod-proxy-logging-400"></span> 400 - BadRequestError: the client request is incorrect
Status: Bad Request

###### <span id="pod-proxy-logging-400-schema"></span> Schema
   
  

[PodProxyLoggingBadRequestBody](#pod-proxy-logging-bad-request-body)

##### <span id="pod-proxy-logging-403"></span> 403 - ForbiddenError: the client is not allowed to access the requested namespace
Status: Forbidden

###### <span id="pod-proxy-logging-403-schema"></span> Schema
   
  

[PodProxyLoggingForbiddenBody](#pod-proxy-logging-forbidden-body)

##### <span id="pod-proxy-logging-404"></span> 404 - A NotFoundError is the error message that is generated when server could not find what was requested.
Status: Not Found

###### <span id="pod-proxy-logging-404-schema"></span> Schema
   
  

[PodProxyLoggingNotFoundBody](#pod-proxy-logging-not-found-body)

##### <span id="pod-proxy-logging-500"></span> 500 - A Internal is the error message that means something has gone wrong
Status: Internal Server Error

###### <span id="pod-proxy-logging-500-schema"></span> Schema
   
  

[PodProxyLoggingInternalServerErrorBody](#pod-proxy-logging-internal-server-error-body)

###### Inlined models

**<span id="pod-proxy-logging-bad-request-body"></span> PodProxyLoggingBadRequestBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `400`| HTTP status code | `400` |
| Message | string| `string` |  | |  |  |



**<span id="pod-proxy-logging-forbidden-body"></span> PodProxyLoggingForbiddenBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `403`| HTTP status code | `403` |
| Message | string| `string` |  | |  |  |



**<span id="pod-proxy-logging-internal-server-error-body"></span> PodProxyLoggingInternalServerErrorBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `500`| HTTP status code | `500` |
| Message | string| `string` |  | |  |  |



**<span id="pod-proxy-logging-not-found-body"></span> PodProxyLoggingNotFoundBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `404`| HTTP status code | `404` |
| Message | string| `string` |  | |  |  |



**<span id="pod-proxy-logging-o-k-body"></span> PodProxyLoggingOKBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `204`| HTTP status code | `204` |
| Message | string| `string` |  | |  |  |



### <span id="pod-proxy-resource"></span> pod proxy resource (*podProxyResource*)

```
GET /api/namespaces/{namespace}/pods/{pod}/config_dump/{resource}
```

Endpoint to get pod resource entries

#### URI Schemes
  * http
  * https

#### Produces
  * application/json

#### Parameters

| Name | Source | Type | Go type | Separator | Required | Default | Description |
|------|--------|------|---------|-----------| :------: |---------|-------------|
| namespace | `path` | string | `string` |  | ✓ |  | The namespace name. |
| pod | `path` | string | `string` |  | ✓ |  | The pod name. |
| resource | `path` | string | `string` |  | ✓ |  | The discovery service resource |

#### All responses
| Code | Status | Description | Has headers | Schema |
|------|--------|-------------|:-----------:|--------|
| [200](#pod-proxy-resource-200) | OK | Return a dump of the configuration of a given envoy proxy |  | [schema](#pod-proxy-resource-200-schema) |
| [403](#pod-proxy-resource-403) | Forbidden | ForbiddenError: the client is not allowed to access the requested namespace |  | [schema](#pod-proxy-resource-403-schema) |
| [404](#pod-proxy-resource-404) | Not Found | A NotFoundError is the error message that is generated when server could not find what was requested. |  | [schema](#pod-proxy-resource-404-schema) |
| [500](#pod-proxy-resource-500) | Internal Server Error | A Internal is the error message that means something has gone wrong |  | [schema](#pod-proxy-resource-500-schema) |

#### Responses


##### <span id="pod-proxy-resource-200"></span> 200 - Return a dump of the configuration of a given envoy proxy
Status: OK

###### <span id="pod-proxy-resource-200-schema"></span> Schema
   
  

map of any 

##### <span id="pod-proxy-resource-403"></span> 403 - ForbiddenError: the client is not allowed to access the requested namespace
Status: Forbidden

###### <span id="pod-proxy-resource-403-schema"></span> Schema
   
  

[PodProxyResourceForbiddenBody](#pod-proxy-resource-forbidden-body)

##### <span id="pod-proxy-resource-404"></span> 404 - A NotFoundError is the error message that is generated when server could not find what was requested.
Status: Not Found

###### <span id="pod-proxy-resource-404-schema"></span> Schema
   
  

[PodProxyResourceNotFoundBody](#pod-proxy-resource-not-found-body)

##### <span id="pod-proxy-resource-500"></span> 500 - A Internal is the error message that means something has gone wrong
Status: Internal Server Error

###### <span id="pod-proxy-resource-500-schema"></span> Schema
   
  

[PodProxyResourceInternalServerErrorBody](#pod-proxy-resource-internal-server-error-body)

###### Inlined models

**<span id="pod-proxy-resource-forbidden-body"></span> PodProxyResourceForbiddenBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `403`| HTTP status code | `403` |
| Message | string| `string` |  | |  |  |



**<span id="pod-proxy-resource-internal-server-error-body"></span> PodProxyResourceInternalServerErrorBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `500`| HTTP status code | `500` |
| Message | string| `string` |  | |  |  |



**<span id="pod-proxy-resource-not-found-body"></span> PodProxyResourceNotFoundBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `404`| HTTP status code | `404` |
| Message | string| `string` |  | |  |  |



### <span id="root"></span> root (*root*)

```
GET /api
```

Endpoint to get the status of Kiali

#### URI Schemes
  * http
  * https

#### Produces
  * application/json

#### All responses
| Code | Status | Description | Has headers | Schema |
|------|--------|-------------|:-----------:|--------|
| [200](#root-200) | OK | HTTP status code 200 and statusInfo model in data |  | [schema](#root-200-schema) |
| [500](#root-500) | Internal Server Error | A Internal is the error message that means something has gone wrong |  | [schema](#root-500-schema) |

#### Responses


##### <span id="root-200"></span> 200 - HTTP status code 200 and statusInfo model in data
Status: OK

###### <span id="root-200-schema"></span> Schema
   
  

[StatusInfo](#status-info)

##### <span id="root-500"></span> 500 - A Internal is the error message that means something has gone wrong
Status: Internal Server Error

###### <span id="root-500-schema"></span> Schema
   
  

[RootInternalServerErrorBody](#root-internal-server-error-body)

###### Inlined models

**<span id="root-internal-server-error-body"></span> RootInternalServerErrorBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `500`| HTTP status code | `500` |
| Message | string| `string` |  | |  |  |



### <span id="service-dashboard"></span> service dashboard (*serviceDashboard*)

```
GET /api/namespaces/{namespace}/services/{service}/dashboard
```

Endpoint to fetch dashboard to be displayed, related to a single service

#### URI Schemes
  * http
  * https

#### Produces
  * application/json

#### Parameters

| Name | Source | Type | Go type | Separator | Required | Default | Description |
|------|--------|------|---------|-----------| :------: |---------|-------------|
| namespace | `path` | string | `string` |  | ✓ |  | The namespace name. |
| service | `path` | string | `string` |  | ✓ |  | The service name. |
| avg | `query` | boolean | `bool` |  |  | `true` | Flag for fetching histogram average. Default is true. |
| byLabels[] | `query` | []string | `[]string` |  |  |  | List of labels to use for grouping metrics (via Prometheus 'by' clause). |
| direction | `query` | string | `string` |  |  | `"outbound"` | Traffic direction: 'inbound' or 'outbound'. |
| duration | `query` | int64 (formatted integer) | `int64` |  |  | `1800` | Duration of the query period, in seconds. |
| quantiles[] | `query` | []string | `[]string` |  |  |  | List of quantiles to fetch. Fetch no quantiles when empty. Ex: [0.5, 0.95, 0.99]. |
| rateFunc | `query` | string | `string` |  |  | `"rate"` | Prometheus function used to calculate rate: 'rate' or 'irate'. |
| rateInterval | `query` | string | `string` |  |  | `"1m"` | Interval used for rate and histogram calculation. |
| reporter | `query` | string | `string` |  |  | `"source"` | Istio telemetry reporter: 'source' or 'destination'. |
| requestProtocol | `query` | string | `string` |  |  | `"all protocols"` | Desired request protocol for the telemetry: For example, 'http' or 'grpc'. |
| step | `query` | int64 (formatted integer) | `int64` |  |  | `15` | Step between [graph] datapoints, in seconds. |

#### All responses
| Code | Status | Description | Has headers | Schema |
|------|--------|-------------|:-----------:|--------|
| [200](#service-dashboard-200) | OK | Dashboard response model |  | [schema](#service-dashboard-200-schema) |
| [400](#service-dashboard-400) | Bad Request | BadRequestError: the client request is incorrect |  | [schema](#service-dashboard-400-schema) |
| [403](#service-dashboard-403) | Forbidden | ForbiddenError: the client is not allowed to access the requested namespace |  | [schema](#service-dashboard-403-schema) |
| [503](#service-dashboard-503) | Service Unavailable | A Internal is the error message that means something has gone wrong |  | [schema](#service-dashboard-503-schema) |

#### Responses


##### <span id="service-dashboard-200"></span> 200 - Dashboard response model
Status: OK

###### <span id="service-dashboard-200-schema"></span> Schema
   
  

[MonitoringDashboard](#monitoring-dashboard)

##### <span id="service-dashboard-400"></span> 400 - BadRequestError: the client request is incorrect
Status: Bad Request

###### <span id="service-dashboard-400-schema"></span> Schema
   
  

[ServiceDashboardBadRequestBody](#service-dashboard-bad-request-body)

##### <span id="service-dashboard-403"></span> 403 - ForbiddenError: the client is not allowed to access the requested namespace
Status: Forbidden

###### <span id="service-dashboard-403-schema"></span> Schema
   
  

[ServiceDashboardForbiddenBody](#service-dashboard-forbidden-body)

##### <span id="service-dashboard-503"></span> 503 - A Internal is the error message that means something has gone wrong
Status: Service Unavailable

###### <span id="service-dashboard-503-schema"></span> Schema
   
  

[ServiceDashboardServiceUnavailableBody](#service-dashboard-service-unavailable-body)

###### Inlined models

**<span id="service-dashboard-bad-request-body"></span> ServiceDashboardBadRequestBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `400`| HTTP status code | `400` |
| Message | string| `string` |  | |  |  |



**<span id="service-dashboard-forbidden-body"></span> ServiceDashboardForbiddenBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `403`| HTTP status code | `403` |
| Message | string| `string` |  | |  |  |



**<span id="service-dashboard-service-unavailable-body"></span> ServiceDashboardServiceUnavailableBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `503`| HTTP status code | `503` |
| Message | string| `string` |  | |  |  |



### <span id="service-details"></span> service details (*serviceDetails*)

```
GET /api/namespaces/{namespace}/services/{service}
```

Endpoint to get the details of a given service

#### URI Schemes
  * http
  * https

#### Produces
  * application/json

#### Parameters

| Name | Source | Type | Go type | Separator | Required | Default | Description |
|------|--------|------|---------|-----------| :------: |---------|-------------|
| namespace | `path` | string | `string` |  | ✓ |  | The namespace name. |
| service | `path` | string | `string` |  | ✓ |  | The service name. |
| validate | `query` | string | `string` |  |  |  | Enable validation or not |

#### All responses
| Code | Status | Description | Has headers | Schema |
|------|--------|-------------|:-----------:|--------|
| [200](#service-details-200) | OK | Listing all the information related to a workload |  | [schema](#service-details-200-schema) |
| [403](#service-details-403) | Forbidden | ForbiddenError: the client is not allowed to access the requested namespace |  | [schema](#service-details-403-schema) |
| [404](#service-details-404) | Not Found | A NotFoundError is the error message that is generated when server could not find what was requested. |  | [schema](#service-details-404-schema) |
| [500](#service-details-500) | Internal Server Error | A Internal is the error message that means something has gone wrong |  | [schema](#service-details-500-schema) |

#### Responses


##### <span id="service-details-200"></span> 200 - Listing all the information related to a workload
Status: OK

###### <span id="service-details-200-schema"></span> Schema
   
  

[ServiceDetails](#service-details)

##### <span id="service-details-403"></span> 403 - ForbiddenError: the client is not allowed to access the requested namespace
Status: Forbidden

###### <span id="service-details-403-schema"></span> Schema
   
  

[ServiceDetailsForbiddenBody](#service-details-forbidden-body)

##### <span id="service-details-404"></span> 404 - A NotFoundError is the error message that is generated when server could not find what was requested.
Status: Not Found

###### <span id="service-details-404-schema"></span> Schema
   
  

[ServiceDetailsNotFoundBody](#service-details-not-found-body)

##### <span id="service-details-500"></span> 500 - A Internal is the error message that means something has gone wrong
Status: Internal Server Error

###### <span id="service-details-500-schema"></span> Schema
   
  

[ServiceDetailsInternalServerErrorBody](#service-details-internal-server-error-body)

###### Inlined models

**<span id="service-details-forbidden-body"></span> ServiceDetailsForbiddenBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `403`| HTTP status code | `403` |
| Message | string| `string` |  | |  |  |



**<span id="service-details-internal-server-error-body"></span> ServiceDetailsInternalServerErrorBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `500`| HTTP status code | `500` |
| Message | string| `string` |  | |  |  |



**<span id="service-details-not-found-body"></span> ServiceDetailsNotFoundBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `404`| HTTP status code | `404` |
| Message | string| `string` |  | |  |  |



### <span id="service-health-status-history"></span> service health status history (*serviceHealthStatusHistory*)

```
GET /api/namespaces/{namespace}/services/{service}/health/history
```

Endpoint to fetch kiali_health_status time series for a service

#### URI Schemes
  * http
  * https

#### Produces
  * application/json

#### Parameters

| Name | Source | Type | Go type | Separator | Required | Default | Description |
|------|--------|------|---------|-----------| :------: |---------|-------------|
| namespace | `path` | string | `string` |  | ✓ |  | The namespace name. |
| service | `path` | string | `string` |  | ✓ |  | The service name. |
| clusterName | `query` | string | `string` |  |  |  | Cluster name |
| duration | `query` | int64 (formatted integer) | `int64` |  |  | `1800` | Duration of the query period, in seconds. |
| queryTime | `query` | string | `string` |  |  | `"now"` | Unix time (seconds) for query such that time range is [queryTime-duration..queryTime]. Default is now. |
| step | `query` | int64 (formatted integer) | `int64` |  |  | `15` | Step between datapoints, in seconds. |

#### All responses
| Code | Status | Description | Has headers | Schema |
|------|--------|-------------|:-----------:|--------|
| [200](#service-health-status-history-200) | OK | Metrics response model |  | [schema](#service-health-status-history-200-schema) |
| [400](#service-health-status-history-400) | Bad Request | BadRequestError: the client request is incorrect |  | [schema](#service-health-status-history-400-schema) |
| [403](#service-health-status-history-403) | Forbidden | ForbiddenError: the client is not allowed to access the requested namespace |  | [schema](#service-health-status-history-403-schema) |
| [503](#service-health-status-history-503) | Service Unavailable | A Internal is the error message that means something has gone wrong |  | [schema](#service-health-status-history-503-schema) |

#### Responses


##### <span id="service-health-status-history-200"></span> 200 - Metrics response model
Status: OK

###### <span id="service-health-status-history-200-schema"></span> Schema
   
  

map of [Metric](#metric)

##### <span id="service-health-status-history-400"></span> 400 - BadRequestError: the client request is incorrect
Status: Bad Request

###### <span id="service-health-status-history-400-schema"></span> Schema
   
  

[ServiceHealthStatusHistoryBadRequestBody](#service-health-status-history-bad-request-body)

##### <span id="service-health-status-history-403"></span> 403 - ForbiddenError: the client is not allowed to access the requested namespace
Status: Forbidden

###### <span id="service-health-status-history-403-schema"></span> Schema
   
  

[ServiceHealthStatusHistoryForbiddenBody](#service-health-status-history-forbidden-body)

##### <span id="service-health-status-history-503"></span> 503 - A Internal is the error message that means something has gone wrong
Status: Service Unavailable

###### <span id="service-health-status-history-503-schema"></span> Schema
   
  

[ServiceHealthStatusHistoryServiceUnavailableBody](#service-health-status-history-service-unavailable-body)

###### Inlined models

**<span id="service-health-status-history-bad-request-body"></span> ServiceHealthStatusHistoryBadRequestBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `400`| HTTP status code | `400` |
| Message | string| `string` |  | |  |  |



**<span id="service-health-status-history-forbidden-body"></span> ServiceHealthStatusHistoryForbiddenBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `403`| HTTP status code | `403` |
| Message | string| `string` |  | |  |  |



**<span id="service-health-status-history-service-unavailable-body"></span> ServiceHealthStatusHistoryServiceUnavailableBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `503`| HTTP status code | `503` |
| Message | string| `string` |  | |  |  |



### <span id="service-list"></span> service list (*serviceList*)

```
GET /api/clusters/services
```

Endpoint to get the list of services for a given cluster

#### URI Schemes
  * http
  * https

#### Produces
  * application/json

#### Parameters

| Name | Source | Type | Go type | Separator | Required | Default | Description |
|------|--------|------|---------|-----------| :------: |---------|-------------|
| QueryTime | `query` | date-time (formatted string) | `strfmt.DateTime` |  |  |  | The time to use for the prometheus query |
| clusterName | `query` | string | `string` |  |  |  | Cluster name |
| health | `query` | boolean | `bool` |  |  |  | Optional |
| istioResources | `query` | boolean | `bool` |  |  |  |  |
| namespace | `query` | string | `string` |  | ✓ |  | The namespace name. |
| onlyDefinitions | `query` | boolean | `bool` |  |  |  |  |
| rateInterval | `query` | string | `string` |  |  | `"5m (matches health_config.compute.duration)"` | The rate interval used for fetching error rate |

#### All responses
| Code | Status | Description | Has headers | Schema |
|------|--------|-------------|:-----------:|--------|
| [200](#service-list-200) | OK | Listing all services in the namespace |  | [schema](#service-list-200-schema) |
| [500](#service-list-500) | Internal Server Error | A Internal is the error message that means something has gone wrong |  | [schema](#service-list-500-schema) |

#### Responses


##### <span id="service-list-200"></span> 200 - Listing all services in the namespace
Status: OK

###### <span id="service-list-200-schema"></span> Schema
   
  

[ServiceList](#service-list)

##### <span id="service-list-500"></span> 500 - A Internal is the error message that means something has gone wrong
Status: Internal Server Error

###### <span id="service-list-500-schema"></span> Schema
   
  

[ServiceListInternalServerErrorBody](#service-list-internal-server-error-body)

###### Inlined models

**<span id="service-list-internal-server-error-body"></span> ServiceListInternalServerErrorBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `500`| HTTP status code | `500` |
| Message | string| `string` |  | |  |  |



### <span id="service-metrics"></span> service metrics (*serviceMetrics*)

```
GET /api/namespaces/{namespace}/services/{service}/metrics
```

Endpoint to fetch metrics to be displayed, related to a single service

#### URI Schemes
  * http
  * https

#### Produces
  * application/json

#### Parameters

| Name | Source | Type | Go type | Separator | Required | Default | Description |
|------|--------|------|---------|-----------| :------: |---------|-------------|
| namespace | `path` | string | `string` |  | ✓ |  | The namespace name. |
| service | `path` | string | `string` |  | ✓ |  | The service name. |
| avg | `query` | boolean | `bool` |  |  | `true` | Flag for fetching histogram average. Default is true. |
| byLabels[] | `query` | []string | `[]string` |  |  |  | List of labels to use for grouping metrics (via Prometheus 'by' clause). |
| direction | `query` | string | `string` |  |  | `"outbound"` | Traffic direction: 'inbound' or 'outbound'. |
| duration | `query` | int64 (formatted integer) | `int64` |  |  | `1800` | Duration of the query period, in seconds. |
| filters[] | `query` | []string | `[]string` |  |  |  | List of metrics to fetch. Fetch all metrics when empty. List entries are Kiali internal metric names. |
| quantiles[] | `query` | []string | `[]string` |  |  |  | List of quantiles to fetch. Fetch no quantiles when empty. Ex: [0.5, 0.95, 0.99]. |
| rateFunc | `query` | string | `string` |  |  | `"rate"` | Prometheus function used to calculate rate: 'rate' or 'irate'. |
| rateInterval | `query` | string | `string` |  |  | `"1m"` | Interval used for rate and histogram calculation. |
| reporter | `query` | string | `string` |  |  | `"source"` | Istio telemetry reporter: 'source' or 'destination'. |
| requestProtocol | `query` | string | `string` |  |  | `"all protocols"` | Desired request protocol for the telemetry: For example, 'http' or 'grpc'. |
| step | `query` | int64 (formatted integer) | `int64` |  |  | `15` | Step between [graph] datapoints, in seconds. |
| version | `query` | string | `string` |  |  |  | Filters metrics by the specified version |

#### All responses
| Code | Status | Description | Has headers | Schema |
|------|--------|-------------|:-----------:|--------|
| [200](#service-metrics-200) | OK | Metrics response model |  | [schema](#service-metrics-200-schema) |
| [400](#service-metrics-400) | Bad Request | BadRequestError: the client request is incorrect |  | [schema](#service-metrics-400-schema) |
| [403](#service-metrics-403) | Forbidden | ForbiddenError: the client is not allowed to access the requested namespace |  | [schema](#service-metrics-403-schema) |
| [503](#service-metrics-503) | Service Unavailable | A Internal is the error message that means something has gone wrong |  | [schema](#service-metrics-503-schema) |

#### Responses


##### <span id="service-metrics-200"></span> 200 - Metrics response model
Status: OK

###### <span id="service-metrics-200-schema"></span> Schema
   
  

map of [Metric](#metric)

##### <span id="service-metrics-400"></span> 400 - BadRequestError: the client request is incorrect
Status: Bad Request

###### <span id="service-metrics-400-schema"></span> Schema
   
  

[ServiceMetricsBadRequestBody](#service-metrics-bad-request-body)

##### <span id="service-metrics-403"></span> 403 - ForbiddenError: the client is not allowed to access the requested namespace
Status: Forbidden

###### <span id="service-metrics-403-schema"></span> Schema
   
  

[ServiceMetricsForbiddenBody](#service-metrics-forbidden-body)

##### <span id="service-metrics-503"></span> 503 - A Internal is the error message that means something has gone wrong
Status: Service Unavailable

###### <span id="service-metrics-503-schema"></span> Schema
   
  

[ServiceMetricsServiceUnavailableBody](#service-metrics-service-unavailable-body)

###### Inlined models

**<span id="service-metrics-bad-request-body"></span> ServiceMetricsBadRequestBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `400`| HTTP status code | `400` |
| Message | string| `string` |  | |  |  |



**<span id="service-metrics-forbidden-body"></span> ServiceMetricsForbiddenBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `403`| HTTP status code | `403` |
| Message | string| `string` |  | |  |  |



**<span id="service-metrics-service-unavailable-body"></span> ServiceMetricsServiceUnavailableBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `503`| HTTP status code | `503` |
| Message | string| `string` |  | |  |  |



### <span id="service-spans"></span> service spans (*serviceSpans*)

```
GET /api/namespaces/{namespace}/services/{service}/spans
```

Endpoint to get Tracing spans for a given service

#### URI Schemes
  * http
  * https

#### Produces
  * application/json

#### Parameters

| Name | Source | Type | Go type | Separator | Required | Default | Description |
|------|--------|------|---------|-----------| :------: |---------|-------------|
| namespace | `path` | string | `string` |  | ✓ |  | The namespace name. |
| service | `path` | string | `string` |  | ✓ |  | The service name. |

#### All responses
| Code | Status | Description | Has headers | Schema |
|------|--------|-------------|:-----------:|--------|
| [200](#service-spans-200) | OK | Listing all the information related to a Span |  | [schema](#service-spans-200-schema) |
| [403](#service-spans-403) | Forbidden | ForbiddenError: the client is not allowed to access the requested namespace |  | [schema](#service-spans-403-schema) |
| [500](#service-spans-500) | Internal Server Error | A Internal is the error message that means something has gone wrong |  | [schema](#service-spans-500-schema) |

#### Responses


##### <span id="service-spans-200"></span> 200 - Listing all the information related to a Span
Status: OK

###### <span id="service-spans-200-schema"></span> Schema
   
  

[][TracingSpan](#tracing-span)

##### <span id="service-spans-403"></span> 403 - ForbiddenError: the client is not allowed to access the requested namespace
Status: Forbidden

###### <span id="service-spans-403-schema"></span> Schema
   
  

[ServiceSpansForbiddenBody](#service-spans-forbidden-body)

##### <span id="service-spans-500"></span> 500 - A Internal is the error message that means something has gone wrong
Status: Internal Server Error

###### <span id="service-spans-500-schema"></span> Schema
   
  

[ServiceSpansInternalServerErrorBody](#service-spans-internal-server-error-body)

###### Inlined models

**<span id="service-spans-forbidden-body"></span> ServiceSpansForbiddenBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `403`| HTTP status code | `403` |
| Message | string| `string` |  | |  |  |



**<span id="service-spans-internal-server-error-body"></span> ServiceSpansInternalServerErrorBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `500`| HTTP status code | `500` |
| Message | string| `string` |  | |  |  |



### <span id="service-traces"></span> service traces (*serviceTraces*)

```
GET /api/namespaces/{namespace}/services/{service}/traces
```

Endpoint to get the traces of a given service

#### URI Schemes
  * http
  * https

#### Produces
  * application/json

#### Parameters

| Name | Source | Type | Go type | Separator | Required | Default | Description |
|------|--------|------|---------|-----------| :------: |---------|-------------|
| namespace | `path` | string | `string` |  | ✓ |  | The namespace name. |
| service | `path` | string | `string` |  | ✓ |  | The service name. |

#### All responses
| Code | Status | Description | Has headers | Schema |
|------|--------|-------------|:-----------:|--------|
| [200](#service-traces-200) | OK | Listing all the information related to a Trace |  | [schema](#service-traces-200-schema) |
| [403](#service-traces-403) | Forbidden | ForbiddenError: the client is not allowed to access the requested namespace |  | [schema](#service-traces-403-schema) |
| [404](#service-traces-404) | Not Found | A NotFoundError is the error message that is generated when server could not find what was requested. |  | [schema](#service-traces-404-schema) |
| [500](#service-traces-500) | Internal Server Error | A Internal is the error message that means something has gone wrong |  | [schema](#service-traces-500-schema) |

#### Responses


##### <span id="service-traces-200"></span> 200 - Listing all the information related to a Trace
Status: OK

###### <span id="service-traces-200-schema"></span> Schema
   
  

[][Trace](#trace)

##### <span id="service-traces-403"></span> 403 - ForbiddenError: the client is not allowed to access the requested namespace
Status: Forbidden

###### <span id="service-traces-403-schema"></span> Schema
   
  

[ServiceTracesForbiddenBody](#service-traces-forbidden-body)

##### <span id="service-traces-404"></span> 404 - A NotFoundError is the error message that is generated when server could not find what was requested.
Status: Not Found

###### <span id="service-traces-404-schema"></span> Schema
   
  

[ServiceTracesNotFoundBody](#service-traces-not-found-body)

##### <span id="service-traces-500"></span> 500 - A Internal is the error message that means something has gone wrong
Status: Internal Server Error

###### <span id="service-traces-500-schema"></span> Schema
   
  

[ServiceTracesInternalServerErrorBody](#service-traces-internal-server-error-body)

###### Inlined models

**<span id="service-traces-forbidden-body"></span> ServiceTracesForbiddenBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `403`| HTTP status code | `403` |
| Message | string| `string` |  | |  |  |



**<span id="service-traces-internal-server-error-body"></span> ServiceTracesInternalServerErrorBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `500`| HTTP status code | `500` |
| Message | string| `string` |  | |  |  |



**<span id="service-traces-not-found-body"></span> ServiceTracesNotFoundBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `404`| HTTP status code | `404` |
| Message | string| `string` |  | |  |  |



### <span id="service-update"></span> Endpoint to update the Service configuration using Json Merge Patch strategy. (*serviceUpdate*)

```
PATCH /api/namespaces/{namespace}/services/{service}
```

#### URI Schemes
  * http
  * https

#### Consumes
  * application/json

#### Produces
  * application/json

#### Parameters

| Name | Source | Type | Go type | Separator | Required | Default | Description |
|------|--------|------|---------|-----------| :------: |---------|-------------|
| namespace | `path` | string | `string` |  | ✓ |  | The namespace name. |
| service | `path` | string | `string` |  | ✓ |  | The service name. |
| validate | `query` | string | `string` |  |  |  | Enable validation or not |

#### All responses
| Code | Status | Description | Has headers | Schema |
|------|--------|-------------|:-----------:|--------|
| [200](#service-update-200) | OK | Listing all the information related to a workload |  | [schema](#service-update-200-schema) |
| [400](#service-update-400) | Bad Request | BadRequestError: the client request is incorrect |  | [schema](#service-update-400-schema) |
| [403](#service-update-403) | Forbidden | ForbiddenError: the client is not allowed to access the requested namespace |  | [schema](#service-update-403-schema) |
| [404](#service-update-404) | Not Found | A NotFoundError is the error message that is generated when server could not find what was requested. |  | [schema](#service-update-404-schema) |
| [500](#service-update-500) | Internal Server Error | A Internal is the error message that means something has gone wrong |  | [schema](#service-update-500-schema) |

#### Responses


##### <span id="service-update-200"></span> 200 - Listing all the information related to a workload
Status: OK

###### <span id="service-update-200-schema"></span> Schema
   
  

[ServiceDetails](#service-details)

##### <span id="service-update-400"></span> 400 - BadRequestError: the client request is incorrect
Status: Bad Request

###### <span id="service-update-400-schema"></span> Schema
   
  

[ServiceUpdateBadRequestBody](#service-update-bad-request-body)

##### <span id="service-update-403"></span> 403 - ForbiddenError: the client is not allowed to access the requested namespace
Status: Forbidden

###### <span id="service-update-403-schema"></span> Schema
   
  

[ServiceUpdateForbiddenBody](#service-update-forbidden-body)

##### <span id="service-update-404"></span> 404 - A NotFoundError is the error message that is generated when server could not find what was requested.
Status: Not Found

###### <span id="service-update-404-schema"></span> Schema
   
  

[ServiceUpdateNotFoundBody](#service-update-not-found-body)

##### <span id="service-update-500"></span> 500 - A Internal is the error message that means something has gone wrong
Status: Internal Server Error

###### <span id="service-update-500-schema"></span> Schema
   
  

[ServiceUpdateInternalServerErrorBody](#service-update-internal-server-error-body)

###### Inlined models

**<span id="service-update-bad-request-body"></span> ServiceUpdateBadRequestBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `400`| HTTP status code | `400` |
| Message | string| `string` |  | |  |  |



**<span id="service-update-forbidden-body"></span> ServiceUpdateForbiddenBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `403`| HTTP status code | `403` |
| Message | string| `string` |  | |  |  |



**<span id="service-update-internal-server-error-body"></span> ServiceUpdateInternalServerErrorBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `500`| HTTP status code | `500` |
| Message | string| `string` |  | |  |  |



**<span id="service-update-not-found-body"></span> ServiceUpdateNotFoundBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `404`| HTTP status code | `404` |
| Message | string| `string` |  | |  |  |



### <span id="test-graph-cache-metrics"></span> test graph cache metrics (*testGraphCacheMetrics*)

```
GET /api/test/metrics/graph/cache
```

Endpoint to get Kiali's graph cache metrics

#### URI Schemes
  * http
  * https

#### Produces
  * application/json

#### All responses
| Code | Status | Description | Has headers | Schema |
|------|--------|-------------|:-----------:|--------|
| [200](#test-graph-cache-metrics-200) | OK | Response of the graph cache metrics test endpoint |  | [schema](#test-graph-cache-metrics-200-schema) |

#### Responses


##### <span id="test-graph-cache-metrics-200"></span> 200 - Response of the graph cache metrics test endpoint
Status: OK

###### <span id="test-graph-cache-metrics-200-schema"></span> Schema
   
  

[GraphCacheMetrics](#graph-cache-metrics)

### <span id="test-health-cache-metrics"></span> test health cache metrics (*testHealthCacheMetrics*)

```
GET /api/test/metrics/health/cache
```

Endpoint to get Kiali's health cache metrics for testing purposes

#### URI Schemes
  * http
  * https

#### Produces
  * application/json

#### All responses
| Code | Status | Description | Has headers | Schema |
|------|--------|-------------|:-----------:|--------|
| [200](#test-health-cache-metrics-200) | OK | Response of the health cache metrics test endpoint |  | [schema](#test-health-cache-metrics-200-schema) |

#### Responses


##### <span id="test-health-cache-metrics-200"></span> 200 - Response of the health cache metrics test endpoint
Status: OK

###### <span id="test-health-cache-metrics-200-schema"></span> Schema
   
  

[HealthCacheMetrics](#health-cache-metrics)

### <span id="test-health-status-metrics"></span> test health status metrics (*testHealthStatusMetrics*)

```
GET /api/test/metrics/health/status
```

Endpoint to get Kiali's health status metrics for testing purposes

#### URI Schemes
  * http
  * https

#### Produces
  * application/json

#### All responses
| Code | Status | Description | Has headers | Schema |
|------|--------|-------------|:-----------:|--------|
| [200](#test-health-status-metrics-200) | OK | Response of the health status metrics test endpoint |  | [schema](#test-health-status-metrics-200-schema) |

#### Responses


##### <span id="test-health-status-metrics-200"></span> 200 - Response of the health status metrics test endpoint
Status: OK

###### <span id="test-health-status-metrics-200-schema"></span> Schema
   
  

[HealthStatusMetrics](#health-status-metrics)

### <span id="trace-details"></span> trace details (*traceDetails*)

```
GET /api/traces/{traceID}
```

Endpoint to get a specific trace from ID

#### URI Schemes
  * http
  * https

#### Produces
  * application/json

#### Parameters

| Name | Source | Type | Go type | Separator | Required | Default | Description |
|------|--------|------|---------|-----------| :------: |---------|-------------|
| traceID | `path` | string | `string` |  | ✓ |  | The trace ID. |

#### All responses
| Code | Status | Description | Has headers | Schema |
|------|--------|-------------|:-----------:|--------|
| [200](#trace-details-200) | OK | Listing all the information related to a Trace |  | [schema](#trace-details-200-schema) |
| [404](#trace-details-404) | Not Found | A NotFoundError is the error message that is generated when server could not find what was requested. |  | [schema](#trace-details-404-schema) |
| [500](#trace-details-500) | Internal Server Error | A Internal is the error message that means something has gone wrong |  | [schema](#trace-details-500-schema) |

#### Responses


##### <span id="trace-details-200"></span> 200 - Listing all the information related to a Trace
Status: OK

###### <span id="trace-details-200-schema"></span> Schema
   
  

[][Trace](#trace)

##### <span id="trace-details-404"></span> 404 - A NotFoundError is the error message that is generated when server could not find what was requested.
Status: Not Found

###### <span id="trace-details-404-schema"></span> Schema
   
  

[TraceDetailsNotFoundBody](#trace-details-not-found-body)

##### <span id="trace-details-500"></span> 500 - A Internal is the error message that means something has gone wrong
Status: Internal Server Error

###### <span id="trace-details-500-schema"></span> Schema
   
  

[TraceDetailsInternalServerErrorBody](#trace-details-internal-server-error-body)

###### Inlined models

**<span id="trace-details-internal-server-error-body"></span> TraceDetailsInternalServerErrorBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `500`| HTTP status code | `500` |
| Message | string| `string` |  | |  |  |



**<span id="trace-details-not-found-body"></span> TraceDetailsNotFoundBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `404`| HTTP status code | `404` |
| Message | string| `string` |  | |  |  |



### <span id="tracing-check"></span> tracing check (*tracingCheck*)

```
POST /api/tracing/check
```

Endpoint to test a specific configuration for tracing

#### URI Schemes
  * http
  * https

#### Produces
  * application/json

#### All responses
| Code | Status | Description | Has headers | Schema |
|------|--------|-------------|:-----------:|--------|
| [200](#tracing-check-200) | OK | Response of the configuration validation query |  | [schema](#tracing-check-200-schema) |
| [500](#tracing-check-500) | Internal Server Error | A Internal is the error message that means something has gone wrong |  | [schema](#tracing-check-500-schema) |

#### Responses


##### <span id="tracing-check-200"></span> 200 - Response of the configuration validation query
Status: OK

###### <span id="tracing-check-200-schema"></span> Schema
   
  

[ConfigurationValidation](#configuration-validation)

##### <span id="tracing-check-500"></span> 500 - A Internal is the error message that means something has gone wrong
Status: Internal Server Error

###### <span id="tracing-check-500-schema"></span> Schema
   
  

[TracingCheckInternalServerErrorBody](#tracing-check-internal-server-error-body)

###### Inlined models

**<span id="tracing-check-internal-server-error-body"></span> TracingCheckInternalServerErrorBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `500`| HTTP status code | `500` |
| Message | string| `string` |  | |  |  |



### <span id="tracing-diagnose"></span> tracing diagnose (*tracingDiagnose*)

```
GET /api/tracing/diagnose
```

Endpoint to get a diagnose for the tracing endpoint

#### URI Schemes
  * http
  * https

#### Produces
  * application/json

#### All responses
| Code | Status | Description | Has headers | Schema |
|------|--------|-------------|:-----------:|--------|
| [200](#tracing-diagnose-200) | OK | Response of the tracing diagnose query |  | [schema](#tracing-diagnose-200-schema) |
| [500](#tracing-diagnose-500) | Internal Server Error | A Internal is the error message that means something has gone wrong |  | [schema](#tracing-diagnose-500-schema) |

#### Responses


##### <span id="tracing-diagnose-200"></span> 200 - Response of the tracing diagnose query
Status: OK

###### <span id="tracing-diagnose-200-schema"></span> Schema
   
  

[TracingDiagnose](#tracing-diagnose)

##### <span id="tracing-diagnose-500"></span> 500 - A Internal is the error message that means something has gone wrong
Status: Internal Server Error

###### <span id="tracing-diagnose-500-schema"></span> Schema
   
  

[TracingDiagnoseInternalServerErrorBody](#tracing-diagnose-internal-server-error-body)

###### Inlined models

**<span id="tracing-diagnose-internal-server-error-body"></span> TracingDiagnoseInternalServerErrorBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `500`| HTTP status code | `500` |
| Message | string| `string` |  | |  |  |



### <span id="tracing-info"></span> tracing info (*tracingInfo*)

```
GET /api/tracing
```

Get the tracing URL and other descriptors

#### URI Schemes
  * http
  * https

#### Produces
  * application/json

#### All responses
| Code | Status | Description | Has headers | Schema |
|------|--------|-------------|:-----------:|--------|
| [200](#tracing-info-200) | OK | Response of the tracing info query |  | [schema](#tracing-info-200-schema) |
| [404](#tracing-info-404) | Not Found | A NotFoundError is the error message that is generated when server could not find what was requested. |  | [schema](#tracing-info-404-schema) |
| [406](#tracing-info-406) | Not Acceptable | A NotAcceptable is the error message that means request can't be accepted |  | [schema](#tracing-info-406-schema) |

#### Responses


##### <span id="tracing-info-200"></span> 200 - Response of the tracing info query
Status: OK

###### <span id="tracing-info-200-schema"></span> Schema
   
  

[TracingInfo](#tracing-info)

##### <span id="tracing-info-404"></span> 404 - A NotFoundError is the error message that is generated when server could not find what was requested.
Status: Not Found

###### <span id="tracing-info-404-schema"></span> Schema
   
  

[TracingInfoNotFoundBody](#tracing-info-not-found-body)

##### <span id="tracing-info-406"></span> 406 - A NotAcceptable is the error message that means request can't be accepted
Status: Not Acceptable

###### <span id="tracing-info-406-schema"></span> Schema
   
  

[TracingInfoNotAcceptableBody](#tracing-info-not-acceptable-body)

###### Inlined models

**<span id="tracing-info-not-acceptable-body"></span> TracingInfoNotAcceptableBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `404`| HTTP status code | `404` |
| Message | string| `string` |  | |  |  |



**<span id="tracing-info-not-found-body"></span> TracingInfoNotFoundBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `404`| HTTP status code | `404` |
| Message | string| `string` |  | |  |  |



### <span id="usage-metrics"></span> usage metrics (*usageMetrics*)

```
GET /api/namespaces/{namespace}/{app}/usage_metrics
```

Endpoint to fetch metrics to be displayed, related to cpu and memory usage

#### URI Schemes
  * http
  * https

#### Produces
  * application/json

#### Parameters

| Name | Source | Type | Go type | Separator | Required | Default | Description |
|------|--------|------|---------|-----------| :------: |---------|-------------|
| app | `path` | string | `string` |  | ✓ |  | The app name (label value). |
| namespace | `path` | string | `string` |  | ✓ |  | The namespace name. |

#### All responses
| Code | Status | Description | Has headers | Schema |
|------|--------|-------------|:-----------:|--------|
| [200](#usage-metrics-200) | OK | Metrics response model |  | [schema](#usage-metrics-200-schema) |
| [400](#usage-metrics-400) | Bad Request | BadRequestError: the client request is incorrect |  | [schema](#usage-metrics-400-schema) |
| [403](#usage-metrics-403) | Forbidden | ForbiddenError: the client is not allowed to access the requested namespace |  | [schema](#usage-metrics-403-schema) |
| [503](#usage-metrics-503) | Service Unavailable | A Internal is the error message that means something has gone wrong |  | [schema](#usage-metrics-503-schema) |

#### Responses


##### <span id="usage-metrics-200"></span> 200 - Metrics response model
Status: OK

###### <span id="usage-metrics-200-schema"></span> Schema
   
  

map of [Metric](#metric)

##### <span id="usage-metrics-400"></span> 400 - BadRequestError: the client request is incorrect
Status: Bad Request

###### <span id="usage-metrics-400-schema"></span> Schema
   
  

[UsageMetricsBadRequestBody](#usage-metrics-bad-request-body)

##### <span id="usage-metrics-403"></span> 403 - ForbiddenError: the client is not allowed to access the requested namespace
Status: Forbidden

###### <span id="usage-metrics-403-schema"></span> Schema
   
  

[UsageMetricsForbiddenBody](#usage-metrics-forbidden-body)

##### <span id="usage-metrics-503"></span> 503 - A Internal is the error message that means something has gone wrong
Status: Service Unavailable

###### <span id="usage-metrics-503-schema"></span> Schema
   
  

[UsageMetricsServiceUnavailableBody](#usage-metrics-service-unavailable-body)

###### Inlined models

**<span id="usage-metrics-bad-request-body"></span> UsageMetricsBadRequestBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `400`| HTTP status code | `400` |
| Message | string| `string` |  | |  |  |



**<span id="usage-metrics-forbidden-body"></span> UsageMetricsForbiddenBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `403`| HTTP status code | `403` |
| Message | string| `string` |  | |  |  |



**<span id="usage-metrics-service-unavailable-body"></span> UsageMetricsServiceUnavailableBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `503`| HTTP status code | `503` |
| Message | string| `string` |  | |  |  |



### <span id="workload-dashboard"></span> workload dashboard (*workloadDashboard*)

```
GET /api/namespaces/{namespace}/workloads/{workload}/dashboard
```

Endpoint to fetch dashboard to be displayed, related to a single workload

#### URI Schemes
  * http
  * https

#### Produces
  * application/json

#### Parameters

| Name | Source | Type | Go type | Separator | Required | Default | Description |
|------|--------|------|---------|-----------| :------: |---------|-------------|
| namespace | `path` | string | `string` |  | ✓ |  | The namespace name. |
| workload | `path` | string | `string` |  | ✓ |  | The workload name. |
| avg | `query` | boolean | `bool` |  |  | `true` | Flag for fetching histogram average. Default is true. |
| byLabels[] | `query` | []string | `[]string` |  |  |  | List of labels to use for grouping metrics (via Prometheus 'by' clause). |
| direction | `query` | string | `string` |  |  | `"outbound"` | Traffic direction: 'inbound' or 'outbound'. |
| duration | `query` | int64 (formatted integer) | `int64` |  |  | `1800` | Duration of the query period, in seconds. |
| quantiles[] | `query` | []string | `[]string` |  |  |  | List of quantiles to fetch. Fetch no quantiles when empty. Ex: [0.5, 0.95, 0.99]. |
| rateFunc | `query` | string | `string` |  |  | `"rate"` | Prometheus function used to calculate rate: 'rate' or 'irate'. |
| rateInterval | `query` | string | `string` |  |  | `"1m"` | Interval used for rate and histogram calculation. |
| reporter | `query` | string | `string` |  |  | `"source"` | Istio telemetry reporter: 'source' or 'destination'. |
| requestProtocol | `query` | string | `string` |  |  | `"all protocols"` | Desired request protocol for the telemetry: For example, 'http' or 'grpc'. |
| step | `query` | int64 (formatted integer) | `int64` |  |  | `15` | Step between [graph] datapoints, in seconds. |

#### All responses
| Code | Status | Description | Has headers | Schema |
|------|--------|-------------|:-----------:|--------|
| [200](#workload-dashboard-200) | OK | Dashboard response model |  | [schema](#workload-dashboard-200-schema) |
| [400](#workload-dashboard-400) | Bad Request | BadRequestError: the client request is incorrect |  | [schema](#workload-dashboard-400-schema) |
| [403](#workload-dashboard-403) | Forbidden | ForbiddenError: the client is not allowed to access the requested namespace |  | [schema](#workload-dashboard-403-schema) |
| [503](#workload-dashboard-503) | Service Unavailable | A Internal is the error message that means something has gone wrong |  | [schema](#workload-dashboard-503-schema) |

#### Responses


##### <span id="workload-dashboard-200"></span> 200 - Dashboard response model
Status: OK

###### <span id="workload-dashboard-200-schema"></span> Schema
   
  

[MonitoringDashboard](#monitoring-dashboard)

##### <span id="workload-dashboard-400"></span> 400 - BadRequestError: the client request is incorrect
Status: Bad Request

###### <span id="workload-dashboard-400-schema"></span> Schema
   
  

[WorkloadDashboardBadRequestBody](#workload-dashboard-bad-request-body)

##### <span id="workload-dashboard-403"></span> 403 - ForbiddenError: the client is not allowed to access the requested namespace
Status: Forbidden

###### <span id="workload-dashboard-403-schema"></span> Schema
   
  

[WorkloadDashboardForbiddenBody](#workload-dashboard-forbidden-body)

##### <span id="workload-dashboard-503"></span> 503 - A Internal is the error message that means something has gone wrong
Status: Service Unavailable

###### <span id="workload-dashboard-503-schema"></span> Schema
   
  

[WorkloadDashboardServiceUnavailableBody](#workload-dashboard-service-unavailable-body)

###### Inlined models

**<span id="workload-dashboard-bad-request-body"></span> WorkloadDashboardBadRequestBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `400`| HTTP status code | `400` |
| Message | string| `string` |  | |  |  |



**<span id="workload-dashboard-forbidden-body"></span> WorkloadDashboardForbiddenBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `403`| HTTP status code | `403` |
| Message | string| `string` |  | |  |  |



**<span id="workload-dashboard-service-unavailable-body"></span> WorkloadDashboardServiceUnavailableBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `503`| HTTP status code | `503` |
| Message | string| `string` |  | |  |  |



### <span id="workload-details"></span> workload details (*workloadDetails*)

```
GET /api/namespaces/{namespace}/workloads/{workload}
```

Endpoint to get the workload details

#### URI Schemes
  * http
  * https

#### Produces
  * application/json

#### Parameters

| Name | Source | Type | Go type | Separator | Required | Default | Description |
|------|--------|------|---------|-----------| :------: |---------|-------------|
| namespace | `path` | string | `string` |  | ✓ |  | The namespace name. |
| workload | `path` | string | `string` |  | ✓ |  | The workload name. |

#### All responses
| Code | Status | Description | Has headers | Schema |
|------|--------|-------------|:-----------:|--------|
| [200](#workload-details-200) | OK | Listing all the information related to a workload |  | [schema](#workload-details-200-schema) |
| [403](#workload-details-403) | Forbidden | ForbiddenError: the client is not allowed to access the requested namespace |  | [schema](#workload-details-403-schema) |
| [404](#workload-details-404) | Not Found | A NotFoundError is the error message that is generated when server could not find what was requested. |  | [schema](#workload-details-404-schema) |
| [500](#workload-details-500) | Internal Server Error | A Internal is the error message that means something has gone wrong |  | [schema](#workload-details-500-schema) |

#### Responses


##### <span id="workload-details-200"></span> 200 - Listing all the information related to a workload
Status: OK

###### <span id="workload-details-200-schema"></span> Schema
   
  

[ModelsWorkload](#models-workload)

##### <span id="workload-details-403"></span> 403 - ForbiddenError: the client is not allowed to access the requested namespace
Status: Forbidden

###### <span id="workload-details-403-schema"></span> Schema
   
  

[WorkloadDetailsForbiddenBody](#workload-details-forbidden-body)

##### <span id="workload-details-404"></span> 404 - A NotFoundError is the error message that is generated when server could not find what was requested.
Status: Not Found

###### <span id="workload-details-404-schema"></span> Schema
   
  

[WorkloadDetailsNotFoundBody](#workload-details-not-found-body)

##### <span id="workload-details-500"></span> 500 - A Internal is the error message that means something has gone wrong
Status: Internal Server Error

###### <span id="workload-details-500-schema"></span> Schema
   
  

[WorkloadDetailsInternalServerErrorBody](#workload-details-internal-server-error-body)

###### Inlined models

**<span id="workload-details-forbidden-body"></span> WorkloadDetailsForbiddenBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `403`| HTTP status code | `403` |
| Message | string| `string` |  | |  |  |



**<span id="workload-details-internal-server-error-body"></span> WorkloadDetailsInternalServerErrorBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `500`| HTTP status code | `500` |
| Message | string| `string` |  | |  |  |



**<span id="workload-details-not-found-body"></span> WorkloadDetailsNotFoundBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `404`| HTTP status code | `404` |
| Message | string| `string` |  | |  |  |



### <span id="workload-envoy-memory"></span> workload envoy memory (*workloadEnvoyMemory*)

```
GET /api/namespaces/{namespace}/workloads/{workload}/envoymemory
```

Endpoint to fetch Envoy proxy memory diagnostics for a workload

#### URI Schemes
  * http
  * https

#### Produces
  * application/json

#### Parameters

| Name | Source | Type | Go type | Separator | Required | Default | Description |
|------|--------|------|---------|-----------| :------: |---------|-------------|
| namespace | `path` | string | `string` |  | ✓ |  | The namespace name. |
| workload | `path` | string | `string` |  | ✓ |  | The workload name. |
| avg | `query` | boolean | `bool` |  |  | `true` | Flag for fetching histogram average. Default is true. |
| byLabels[] | `query` | []string | `[]string` |  |  |  | List of labels to use for grouping metrics (via Prometheus 'by' clause). |
| direction | `query` | string | `string` |  |  | `"outbound"` | Traffic direction: 'inbound' or 'outbound'. |
| duration | `query` | int64 (formatted integer) | `int64` |  |  | `1800` | Duration of the query period, in seconds. |
| filters[] | `query` | []string | `[]string` |  |  |  | List of metrics to fetch. Fetch all metrics when empty. List entries are Kiali internal metric names. |
| quantiles[] | `query` | []string | `[]string` |  |  |  | List of quantiles to fetch. Fetch no quantiles when empty. Ex: [0.5, 0.95, 0.99]. |
| rateFunc | `query` | string | `string` |  |  | `"rate"` | Prometheus function used to calculate rate: 'rate' or 'irate'. |
| rateInterval | `query` | string | `string` |  |  | `"1m"` | Interval used for rate and histogram calculation. |
| reporter | `query` | string | `string` |  |  | `"source"` | Istio telemetry reporter: 'source' or 'destination'. |
| requestProtocol | `query` | string | `string` |  |  | `"all protocols"` | Desired request protocol for the telemetry: For example, 'http' or 'grpc'. |
| step | `query` | int64 (formatted integer) | `int64` |  |  | `15` | Step between [graph] datapoints, in seconds. |
| version | `query` | string | `string` |  |  |  | Filters metrics by the specified version |

#### All responses
| Code | Status | Description | Has headers | Schema |
|------|--------|-------------|:-----------:|--------|
| [200](#workload-envoy-memory-200) | OK | Envoy memory diagnostics for a workload |  | [schema](#workload-envoy-memory-200-schema) |
| [400](#workload-envoy-memory-400) | Bad Request | BadRequestError: the client request is incorrect |  | [schema](#workload-envoy-memory-400-schema) |
| [404](#workload-envoy-memory-404) | Not Found | A NotFoundError is the error message that is generated when server could not find what was requested. |  | [schema](#workload-envoy-memory-404-schema) |
| [503](#workload-envoy-memory-503) | Service Unavailable | A Internal is the error message that means something has gone wrong |  | [schema](#workload-envoy-memory-503-schema) |

#### Responses


##### <span id="workload-envoy-memory-200"></span> 200 - Envoy memory diagnostics for a workload
Status: OK

###### <span id="workload-envoy-memory-200-schema"></span> Schema
   
  

[EnvoyMemorySummary](#envoy-memory-summary)

##### <span id="workload-envoy-memory-400"></span> 400 - BadRequestError: the client request is incorrect
Status: Bad Request

###### <span id="workload-envoy-memory-400-schema"></span> Schema
   
  

[WorkloadEnvoyMemoryBadRequestBody](#workload-envoy-memory-bad-request-body)

##### <span id="workload-envoy-memory-404"></span> 404 - A NotFoundError is the error message that is generated when server could not find what was requested.
Status: Not Found

###### <span id="workload-envoy-memory-404-schema"></span> Schema
   
  

[WorkloadEnvoyMemoryNotFoundBody](#workload-envoy-memory-not-found-body)

##### <span id="workload-envoy-memory-503"></span> 503 - A Internal is the error message that means something has gone wrong
Status: Service Unavailable

###### <span id="workload-envoy-memory-503-schema"></span> Schema
   
  

[WorkloadEnvoyMemoryServiceUnavailableBody](#workload-envoy-memory-service-unavailable-body)

###### Inlined models

**<span id="workload-envoy-memory-bad-request-body"></span> WorkloadEnvoyMemoryBadRequestBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `400`| HTTP status code | `400` |
| Message | string| `string` |  | |  |  |



**<span id="workload-envoy-memory-not-found-body"></span> WorkloadEnvoyMemoryNotFoundBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `404`| HTTP status code | `404` |
| Message | string| `string` |  | |  |  |



**<span id="workload-envoy-memory-service-unavailable-body"></span> WorkloadEnvoyMemoryServiceUnavailableBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `503`| HTTP status code | `503` |
| Message | string| `string` |  | |  |  |



### <span id="workload-health-status-history"></span> workload health status history (*workloadHealthStatusHistory*)

```
GET /api/namespaces/{namespace}/workloads/{workload}/health/history
```

Endpoint to fetch kiali_health_status time series for a workload

#### URI Schemes
  * http
  * https

#### Produces
  * application/json

#### Parameters

| Name | Source | Type | Go type | Separator | Required | Default | Description |
|------|--------|------|---------|-----------| :------: |---------|-------------|
| namespace | `path` | string | `string` |  | ✓ |  | The namespace name. |
| workload | `path` | string | `string` |  | ✓ |  | The workload name. |
| clusterName | `query` | string | `string` |  |  |  | Cluster name |
| duration | `query` | int64 (formatted integer) | `int64` |  |  | `1800` | Duration of the query period, in seconds. |
| queryTime | `query` | string | `string` |  |  | `"now"` | Unix time (seconds) for query such that time range is [queryTime-duration..queryTime]. Default is now. |
| step | `query` | int64 (formatted integer) | `int64` |  |  | `15` | Step between datapoints, in seconds. |

#### All responses
| Code | Status | Description | Has headers | Schema |
|------|--------|-------------|:-----------:|--------|
| [200](#workload-health-status-history-200) | OK | Metrics response model |  | [schema](#workload-health-status-history-200-schema) |
| [400](#workload-health-status-history-400) | Bad Request | BadRequestError: the client request is incorrect |  | [schema](#workload-health-status-history-400-schema) |
| [403](#workload-health-status-history-403) | Forbidden | ForbiddenError: the client is not allowed to access the requested namespace |  | [schema](#workload-health-status-history-403-schema) |
| [503](#workload-health-status-history-503) | Service Unavailable | A Internal is the error message that means something has gone wrong |  | [schema](#workload-health-status-history-503-schema) |

#### Responses


##### <span id="workload-health-status-history-200"></span> 200 - Metrics response model
Status: OK

###### <span id="workload-health-status-history-200-schema"></span> Schema
   
  

map of [Metric](#metric)

##### <span id="workload-health-status-history-400"></span> 400 - BadRequestError: the client request is incorrect
Status: Bad Request

###### <span id="workload-health-status-history-400-schema"></span> Schema
   
  

[WorkloadHealthStatusHistoryBadRequestBody](#workload-health-status-history-bad-request-body)

##### <span id="workload-health-status-history-403"></span> 403 - ForbiddenError: the client is not allowed to access the requested namespace
Status: Forbidden

###### <span id="workload-health-status-history-403-schema"></span> Schema
   
  

[WorkloadHealthStatusHistoryForbiddenBody](#workload-health-status-history-forbidden-body)

##### <span id="workload-health-status-history-503"></span> 503 - A Internal is the error message that means something has gone wrong
Status: Service Unavailable

###### <span id="workload-health-status-history-503-schema"></span> Schema
   
  

[WorkloadHealthStatusHistoryServiceUnavailableBody](#workload-health-status-history-service-unavailable-body)

###### Inlined models

**<span id="workload-health-status-history-bad-request-body"></span> WorkloadHealthStatusHistoryBadRequestBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `400`| HTTP status code | `400` |
| Message | string| `string` |  | |  |  |



**<span id="workload-health-status-history-forbidden-body"></span> WorkloadHealthStatusHistoryForbiddenBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `403`| HTTP status code | `403` |
| Message | string| `string` |  | |  |  |



**<span id="workload-health-status-history-service-unavailable-body"></span> WorkloadHealthStatusHistoryServiceUnavailableBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `503`| HTTP status code | `503` |
| Message | string| `string` |  | |  |  |



### <span id="workload-list"></span> workload list (*workloadList*)

```
GET /api/clusters/workloads
```

Endpoint to get the list of workloads for a cluster

#### URI Schemes
  * http
  * https

#### Produces
  * application/json

#### Parameters

| Name | Source | Type | Go type | Separator | Required | Default | Description |
|------|--------|------|---------|-----------| :------: |---------|-------------|
| namespace | `query` | string | `string` |  | ✓ |  | The namespace name. |

#### All responses
| Code | Status | Description | Has headers | Schema |
|------|--------|-------------|:-----------:|--------|
| [200](#workload-list-200) | OK | Listing all workloads in the namespace |  | [schema](#workload-list-200-schema) |
| [500](#workload-list-500) | Internal Server Error | A Internal is the error message that means something has gone wrong |  | [schema](#workload-list-500-schema) |

#### Responses


##### <span id="workload-list-200"></span> 200 - Listing all workloads in the namespace
Status: OK

###### <span id="workload-list-200-schema"></span> Schema
   
  

[WorkloadList](#workload-list)

##### <span id="workload-list-500"></span> 500 - A Internal is the error message that means something has gone wrong
Status: Internal Server Error

###### <span id="workload-list-500-schema"></span> Schema
   
  

[WorkloadListInternalServerErrorBody](#workload-list-internal-server-error-body)

###### Inlined models

**<span id="workload-list-internal-server-error-body"></span> WorkloadListInternalServerErrorBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `500`| HTTP status code | `500` |
| Message | string| `string` |  | |  |  |



### <span id="workload-metrics"></span> workload metrics (*workloadMetrics*)

```
GET /api/namespaces/{namespace}/workloads/{workload}/metrics
```

Endpoint to fetch metrics to be displayed, related to a single workload

#### URI Schemes
  * http
  * https

#### Produces
  * application/json

#### Parameters

| Name | Source | Type | Go type | Separator | Required | Default | Description |
|------|--------|------|---------|-----------| :------: |---------|-------------|
| namespace | `path` | string | `string` |  | ✓ |  | The namespace name. |
| workload | `path` | string | `string` |  | ✓ |  | The workload name. |
| avg | `query` | boolean | `bool` |  |  | `true` | Flag for fetching histogram average. Default is true. |
| byLabels[] | `query` | []string | `[]string` |  |  |  | List of labels to use for grouping metrics (via Prometheus 'by' clause). |
| direction | `query` | string | `string` |  |  | `"outbound"` | Traffic direction: 'inbound' or 'outbound'. |
| duration | `query` | int64 (formatted integer) | `int64` |  |  | `1800` | Duration of the query period, in seconds. |
| filters[] | `query` | []string | `[]string` |  |  |  | List of metrics to fetch. Fetch all metrics when empty. List entries are Kiali internal metric names. |
| quantiles[] | `query` | []string | `[]string` |  |  |  | List of quantiles to fetch. Fetch no quantiles when empty. Ex: [0.5, 0.95, 0.99]. |
| rateFunc | `query` | string | `string` |  |  | `"rate"` | Prometheus function used to calculate rate: 'rate' or 'irate'. |
| rateInterval | `query` | string | `string` |  |  | `"1m"` | Interval used for rate and histogram calculation. |
| reporter | `query` | string | `string` |  |  | `"source"` | Istio telemetry reporter: 'source' or 'destination'. |
| requestProtocol | `query` | string | `string` |  |  | `"all protocols"` | Desired request protocol for the telemetry: For example, 'http' or 'grpc'. |
| step | `query` | int64 (formatted integer) | `int64` |  |  | `15` | Step between [graph] datapoints, in seconds. |
| version | `query` | string | `string` |  |  |  | Filters metrics by the specified version |

#### All responses
| Code | Status | Description | Has headers | Schema |
|------|--------|-------------|:-----------:|--------|
| [200](#workload-metrics-200) | OK | Metrics response model |  | [schema](#workload-metrics-200-schema) |
| [400](#workload-metrics-400) | Bad Request | BadRequestError: the client request is incorrect |  | [schema](#workload-metrics-400-schema) |
| [403](#workload-metrics-403) | Forbidden | ForbiddenError: the client is not allowed to access the requested namespace |  | [schema](#workload-metrics-403-schema) |
| [503](#workload-metrics-503) | Service Unavailable | A Internal is the error message that means something has gone wrong |  | [schema](#workload-metrics-503-schema) |

#### Responses


##### <span id="workload-metrics-200"></span> 200 - Metrics response model
Status: OK

###### <span id="workload-metrics-200-schema"></span> Schema
   
  

map of [Metric](#metric)

##### <span id="workload-metrics-400"></span> 400 - BadRequestError: the client request is incorrect
Status: Bad Request

###### <span id="workload-metrics-400-schema"></span> Schema
   
  

[WorkloadMetricsBadRequestBody](#workload-metrics-bad-request-body)

##### <span id="workload-metrics-403"></span> 403 - ForbiddenError: the client is not allowed to access the requested namespace
Status: Forbidden

###### <span id="workload-metrics-403-schema"></span> Schema
   
  

[WorkloadMetricsForbiddenBody](#workload-metrics-forbidden-body)

##### <span id="workload-metrics-503"></span> 503 - A Internal is the error message that means something has gone wrong
Status: Service Unavailable

###### <span id="workload-metrics-503-schema"></span> Schema
   
  

[WorkloadMetricsServiceUnavailableBody](#workload-metrics-service-unavailable-body)

###### Inlined models

**<span id="workload-metrics-bad-request-body"></span> WorkloadMetricsBadRequestBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `400`| HTTP status code | `400` |
| Message | string| `string` |  | |  |  |



**<span id="workload-metrics-forbidden-body"></span> WorkloadMetricsForbiddenBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `403`| HTTP status code | `403` |
| Message | string| `string` |  | |  |  |



**<span id="workload-metrics-service-unavailable-body"></span> WorkloadMetricsServiceUnavailableBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `503`| HTTP status code | `503` |
| Message | string| `string` |  | |  |  |



### <span id="workload-spans"></span> workload spans (*workloadSpans*)

```
GET /api/namespaces/{namespace}/workloads/{workload}/spans
```

Endpoint to get Tracing spans for a given workload

#### URI Schemes
  * http
  * https

#### Produces
  * application/json

#### Parameters

| Name | Source | Type | Go type | Separator | Required | Default | Description |
|------|--------|------|---------|-----------| :------: |---------|-------------|
| namespace | `path` | string | `string` |  | ✓ |  | The namespace name. |
| workload | `path` | string | `string` |  | ✓ |  | The workload name. |

#### All responses
| Code | Status | Description | Has headers | Schema |
|------|--------|-------------|:-----------:|--------|
| [200](#workload-spans-200) | OK | Listing all the information related to a Span |  | [schema](#workload-spans-200-schema) |
| [403](#workload-spans-403) | Forbidden | ForbiddenError: the client is not allowed to access the requested namespace |  | [schema](#workload-spans-403-schema) |
| [500](#workload-spans-500) | Internal Server Error | A Internal is the error message that means something has gone wrong |  | [schema](#workload-spans-500-schema) |

#### Responses


##### <span id="workload-spans-200"></span> 200 - Listing all the information related to a Span
Status: OK

###### <span id="workload-spans-200-schema"></span> Schema
   
  

[][TracingSpan](#tracing-span)

##### <span id="workload-spans-403"></span> 403 - ForbiddenError: the client is not allowed to access the requested namespace
Status: Forbidden

###### <span id="workload-spans-403-schema"></span> Schema
   
  

[WorkloadSpansForbiddenBody](#workload-spans-forbidden-body)

##### <span id="workload-spans-500"></span> 500 - A Internal is the error message that means something has gone wrong
Status: Internal Server Error

###### <span id="workload-spans-500-schema"></span> Schema
   
  

[WorkloadSpansInternalServerErrorBody](#workload-spans-internal-server-error-body)

###### Inlined models

**<span id="workload-spans-forbidden-body"></span> WorkloadSpansForbiddenBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `403`| HTTP status code | `403` |
| Message | string| `string` |  | |  |  |



**<span id="workload-spans-internal-server-error-body"></span> WorkloadSpansInternalServerErrorBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `500`| HTTP status code | `500` |
| Message | string| `string` |  | |  |  |



### <span id="workload-traces"></span> workload traces (*workloadTraces*)

```
GET /api/namespaces/{namespace}/workloads/{workload}/traces
```

Endpoint to get the traces of a given workload

#### URI Schemes
  * http
  * https

#### Produces
  * application/json

#### Parameters

| Name | Source | Type | Go type | Separator | Required | Default | Description |
|------|--------|------|---------|-----------| :------: |---------|-------------|
| namespace | `path` | string | `string` |  | ✓ |  | The namespace name. |
| workload | `path` | string | `string` |  | ✓ |  | The workload name. |

#### All responses
| Code | Status | Description | Has headers | Schema |
|------|--------|-------------|:-----------:|--------|
| [200](#workload-traces-200) | OK | Listing all the information related to a Trace |  | [schema](#workload-traces-200-schema) |
| [403](#workload-traces-403) | Forbidden | ForbiddenError: the client is not allowed to access the requested namespace |  | [schema](#workload-traces-403-schema) |
| [404](#workload-traces-404) | Not Found | A NotFoundError is the error message that is generated when server could not find what was requested. |  | [schema](#workload-traces-404-schema) |
| [500](#workload-traces-500) | Internal Server Error | A Internal is the error message that means something has gone wrong |  | [schema](#workload-traces-500-schema) |

#### Responses


##### <span id="workload-traces-200"></span> 200 - Listing all the information related to a Trace
Status: OK

###### <span id="workload-traces-200-schema"></span> Schema
   
  

[][Trace](#trace)

##### <span id="workload-traces-403"></span> 403 - ForbiddenError: the client is not allowed to access the requested namespace
Status: Forbidden

###### <span id="workload-traces-403-schema"></span> Schema
   
  

[WorkloadTracesForbiddenBody](#workload-traces-forbidden-body)

##### <span id="workload-traces-404"></span> 404 - A NotFoundError is the error message that is generated when server could not find what was requested.
Status: Not Found

###### <span id="workload-traces-404-schema"></span> Schema
   
  

[WorkloadTracesNotFoundBody](#workload-traces-not-found-body)

##### <span id="workload-traces-500"></span> 500 - A Internal is the error message that means something has gone wrong
Status: Internal Server Error

###### <span id="workload-traces-500-schema"></span> Schema
   
  

[WorkloadTracesInternalServerErrorBody](#workload-traces-internal-server-error-body)

###### Inlined models

**<span id="workload-traces-forbidden-body"></span> WorkloadTracesForbiddenBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `403`| HTTP status code | `403` |
| Message | string| `string` |  | |  |  |



**<span id="workload-traces-internal-server-error-body"></span> WorkloadTracesInternalServerErrorBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `500`| HTTP status code | `500` |
| Message | string| `string` |  | |  |  |



**<span id="workload-traces-not-found-body"></span> WorkloadTracesNotFoundBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `404`| HTTP status code | `404` |
| Message | string| `string` |  | |  |  |



### <span id="workload-update"></span> Endpoint to update the Workload configuration using Json Merge Patch strategy. (*workloadUpdate*)

```
PATCH /api/namespaces/{namespace}/workloads/{workload}
```

#### URI Schemes
  * http
  * https

#### Consumes
  * application/json

#### Produces
  * application/json

#### Parameters

| Name | Source | Type | Go type | Separator | Required | Default | Description |
|------|--------|------|---------|-----------| :------: |---------|-------------|
| namespace | `path` | string | `string` |  | ✓ |  | The namespace name. |
| workload | `path` | string | `string` |  | ✓ |  | The workload name. |

#### All responses
| Code | Status | Description | Has headers | Schema |
|------|--------|-------------|:-----------:|--------|
| [200](#workload-update-200) | OK | Listing all the information related to a workload |  | [schema](#workload-update-200-schema) |
| [400](#workload-update-400) | Bad Request | BadRequestError: the client request is incorrect |  | [schema](#workload-update-400-schema) |
| [403](#workload-update-403) | Forbidden | ForbiddenError: the client is not allowed to access the requested namespace |  | [schema](#workload-update-403-schema) |
| [404](#workload-update-404) | Not Found | A NotFoundError is the error message that is generated when server could not find what was requested. |  | [schema](#workload-update-404-schema) |
| [500](#workload-update-500) | Internal Server Error | A Internal is the error message that means something has gone wrong |  | [schema](#workload-update-500-schema) |

#### Responses


##### <span id="workload-update-200"></span> 200 - Listing all the information related to a workload
Status: OK

###### <span id="workload-update-200-schema"></span> Schema
   
  

[ModelsWorkload](#models-workload)

##### <span id="workload-update-400"></span> 400 - BadRequestError: the client request is incorrect
Status: Bad Request

###### <span id="workload-update-400-schema"></span> Schema
   
  

[WorkloadUpdateBadRequestBody](#workload-update-bad-request-body)

##### <span id="workload-update-403"></span> 403 - ForbiddenError: the client is not allowed to access the requested namespace
Status: Forbidden

###### <span id="workload-update-403-schema"></span> Schema
   
  

[WorkloadUpdateForbiddenBody](#workload-update-forbidden-body)

##### <span id="workload-update-404"></span> 404 - A NotFoundError is the error message that is generated when server could not find what was requested.
Status: Not Found

###### <span id="workload-update-404-schema"></span> Schema
   
  

[WorkloadUpdateNotFoundBody](#workload-update-not-found-body)

##### <span id="workload-update-500"></span> 500 - A Internal is the error message that means something has gone wrong
Status: Internal Server Error

###### <span id="workload-update-500-schema"></span> Schema
   
  

[WorkloadUpdateInternalServerErrorBody](#workload-update-internal-server-error-body)

###### Inlined models

**<span id="workload-update-bad-request-body"></span> WorkloadUpdateBadRequestBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `400`| HTTP status code | `400` |
| Message | string| `string` |  | |  |  |



**<span id="workload-update-forbidden-body"></span> WorkloadUpdateForbiddenBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `403`| HTTP status code | `403` |
| Message | string| `string` |  | |  |  |



**<span id="workload-update-internal-server-error-body"></span> WorkloadUpdateInternalServerErrorBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `500`| HTTP status code | `500` |
| Message | string| `string` |  | |  |  |



**<span id="workload-update-not-found-body"></span> WorkloadUpdateNotFoundBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `404`| HTTP status code | `404` |
| Message | string| `string` |  | |  |  |



### <span id="ztunnel-config-dump"></span> ztunnel config dump (*ztunnelConfigDump*)

```
GET /api/namespaces/{namespace}/pods/{pod}/config_dump_ztunnel
```

Endpoint to get ztunnel pod config dump

#### URI Schemes
  * http
  * https

#### Produces
  * application/json

#### Parameters

| Name | Source | Type | Go type | Separator | Required | Default | Description |
|------|--------|------|---------|-----------| :------: |---------|-------------|
| namespace | `path` | string | `string` |  | ✓ |  | The namespace name. |
| pod | `path` | string | `string` |  | ✓ |  | The pod name. |

#### All responses
| Code | Status | Description | Has headers | Schema |
|------|--------|-------------|:-----------:|--------|
| [200](#ztunnel-config-dump-200) | OK | Response of the ztunnel config dump query |  | [schema](#ztunnel-config-dump-200-schema) |
| [403](#ztunnel-config-dump-403) | Forbidden | ForbiddenError: the client is not allowed to access the requested namespace |  | [schema](#ztunnel-config-dump-403-schema) |
| [404](#ztunnel-config-dump-404) | Not Found | A NotFoundError is the error message that is generated when server could not find what was requested. |  | [schema](#ztunnel-config-dump-404-schema) |
| [500](#ztunnel-config-dump-500) | Internal Server Error | A Internal is the error message that means something has gone wrong |  | [schema](#ztunnel-config-dump-500-schema) |

#### Responses


##### <span id="ztunnel-config-dump-200"></span> 200 - Response of the ztunnel config dump query
Status: OK

###### <span id="ztunnel-config-dump-200-schema"></span> Schema
   
  

[ZtunnelConfigDump](#ztunnel-config-dump)

##### <span id="ztunnel-config-dump-403"></span> 403 - ForbiddenError: the client is not allowed to access the requested namespace
Status: Forbidden

###### <span id="ztunnel-config-dump-403-schema"></span> Schema
   
  

[ZtunnelConfigDumpForbiddenBody](#ztunnel-config-dump-forbidden-body)

##### <span id="ztunnel-config-dump-404"></span> 404 - A NotFoundError is the error message that is generated when server could not find what was requested.
Status: Not Found

###### <span id="ztunnel-config-dump-404-schema"></span> Schema
   
  

[ZtunnelConfigDumpNotFoundBody](#ztunnel-config-dump-not-found-body)

##### <span id="ztunnel-config-dump-500"></span> 500 - A Internal is the error message that means something has gone wrong
Status: Internal Server Error

###### <span id="ztunnel-config-dump-500-schema"></span> Schema
   
  

[ZtunnelConfigDumpInternalServerErrorBody](#ztunnel-config-dump-internal-server-error-body)

###### Inlined models

**<span id="ztunnel-config-dump-forbidden-body"></span> ZtunnelConfigDumpForbiddenBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `403`| HTTP status code | `403` |
| Message | string| `string` |  | |  |  |



**<span id="ztunnel-config-dump-internal-server-error-body"></span> ZtunnelConfigDumpInternalServerErrorBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `500`| HTTP status code | `500` |
| Message | string| `string` |  | |  |  |



**<span id="ztunnel-config-dump-not-found-body"></span> ZtunnelConfigDumpNotFoundBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `404`| HTTP status code | `404` |
| Message | string| `string` |  | |  |  |



### <span id="ztunnel-dashboard"></span> ztunnel dashboard (*ztunnelDashboard*)

```
GET /api/namespaces/{namespace}/ztunnel/{workload}/dashboard
```

Endpoint to fetch dashboard to be displayed, related to a ztunnel workload

#### URI Schemes
  * http
  * https

#### Produces
  * application/json

#### Parameters

| Name | Source | Type | Go type | Separator | Required | Default | Description |
|------|--------|------|---------|-----------| :------: |---------|-------------|
| namespace | `path` | string | `string` |  | ✓ |  | The namespace name. |
| workload | `path` | string | `string` |  | ✓ |  | The workload name. |

#### All responses
| Code | Status | Description | Has headers | Schema |
|------|--------|-------------|:-----------:|--------|
| [200](#ztunnel-dashboard-200) | OK | Dashboard response model |  | [schema](#ztunnel-dashboard-200-schema) |
| [400](#ztunnel-dashboard-400) | Bad Request | BadRequestError: the client request is incorrect |  | [schema](#ztunnel-dashboard-400-schema) |
| [403](#ztunnel-dashboard-403) | Forbidden | ForbiddenError: the client is not allowed to access the requested namespace |  | [schema](#ztunnel-dashboard-403-schema) |
| [503](#ztunnel-dashboard-503) | Service Unavailable | A Internal is the error message that means something has gone wrong |  | [schema](#ztunnel-dashboard-503-schema) |

#### Responses


##### <span id="ztunnel-dashboard-200"></span> 200 - Dashboard response model
Status: OK

###### <span id="ztunnel-dashboard-200-schema"></span> Schema
   
  

[MonitoringDashboard](#monitoring-dashboard)

##### <span id="ztunnel-dashboard-400"></span> 400 - BadRequestError: the client request is incorrect
Status: Bad Request

###### <span id="ztunnel-dashboard-400-schema"></span> Schema
   
  

[ZtunnelDashboardBadRequestBody](#ztunnel-dashboard-bad-request-body)

##### <span id="ztunnel-dashboard-403"></span> 403 - ForbiddenError: the client is not allowed to access the requested namespace
Status: Forbidden

###### <span id="ztunnel-dashboard-403-schema"></span> Schema
   
  

[ZtunnelDashboardForbiddenBody](#ztunnel-dashboard-forbidden-body)

##### <span id="ztunnel-dashboard-503"></span> 503 - A Internal is the error message that means something has gone wrong
Status: Service Unavailable

###### <span id="ztunnel-dashboard-503-schema"></span> Schema
   
  

[ZtunnelDashboardServiceUnavailableBody](#ztunnel-dashboard-service-unavailable-body)

###### Inlined models

**<span id="ztunnel-dashboard-bad-request-body"></span> ZtunnelDashboardBadRequestBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `400`| HTTP status code | `400` |
| Message | string| `string` |  | |  |  |



**<span id="ztunnel-dashboard-forbidden-body"></span> ZtunnelDashboardForbiddenBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `403`| HTTP status code | `403` |
| Message | string| `string` |  | |  |  |



**<span id="ztunnel-dashboard-service-unavailable-body"></span> ZtunnelDashboardServiceUnavailableBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `503`| HTTP status code | `503` |
| Message | string| `string` |  | |  |  |



## Models

### <span id="api-v1-group"></span> APIV1Group


> This validation is based off of the corresponding Kubernetes validation:
https://github.com/kubernetes/apimachinery/blob/02cfb53916346d085a6c6c7c66f882e3c6b0eca6/pkg/util/validation/validation.go#L208

Valid values include:

- "" - empty string implies core Kubernetes API group
- "gateway.networking.k8s.io"
- "foo.example.com"

Invalid values include:

- "example.com/bar" - "/" is an invalid character
  



| Name | Type | Go type | Default | Description | Example |
|------|------|---------| ------- |-------------|---------|
| APIV1Group | string| string | | This validation is based off of the corresponding Kubernetes validation:</br>https://github.com/kubernetes/apimachinery/blob/02cfb53916346d085a6c6c7c66f882e3c6b0eca6/pkg/util/validation/validation.go#L208</br></br>Valid values include:</br></br>- "" - empty string implies core Kubernetes API group</br>- "gateway.networking.k8s.io"</br>- "foo.example.com"</br></br>Invalid values include:</br></br>- "example.com/bar" - "/" is an invalid character |  |



### <span id="api-v1-kind"></span> APIV1Kind


> Valid values include:

- "Service"
- "HTTPRoute"

Invalid values include:

- "invalid/kind" - "/" is an invalid character
  



| Name | Type | Go type | Default | Description | Example |
|------|------|---------| ------- |-------------|---------|
| APIV1Kind | string| string | | Valid values include:</br></br>- "Service"</br>- "HTTPRoute"</br></br>Invalid values include:</br></br>- "invalid/kind" - "/" is an invalid character |  |



### <span id="api-v1-namespace"></span> APIV1Namespace


> This validation is based off of the corresponding Kubernetes validation:
https://github.com/kubernetes/apimachinery/blob/02cfb53916346d085a6c6c7c66f882e3c6b0eca6/pkg/util/validation/validation.go#L187

This is used for Namespace name validation here:
https://github.com/kubernetes/apimachinery/blob/02cfb53916346d085a6c6c7c66f882e3c6b0eca6/pkg/api/validation/generic.go#L63

Valid values include:

- "example"

Invalid values include:

- "example.com" - "." is an invalid character
  



| Name | Type | Go type | Default | Description | Example |
|------|------|---------| ------- |-------------|---------|
| APIV1Namespace | string| string | | This validation is based off of the corresponding Kubernetes validation:</br>https://github.com/kubernetes/apimachinery/blob/02cfb53916346d085a6c6c7c66f882e3c6b0eca6/pkg/util/validation/validation.go#L187</br></br>This is used for Namespace name validation here:</br>https://github.com/kubernetes/apimachinery/blob/02cfb53916346d085a6c6c7c66f882e3c6b0eca6/pkg/api/validation/generic.go#L63</br></br>Valid values include:</br></br>- "example"</br></br>Invalid values include:</br></br>- "example.com" - "." is an invalid character |  |



### <span id="api-v1-object-name"></span> APIV1ObjectName


> Object names can have a variety of forms, including RFC 1123 subdomains,
RFC 1123 labels, or RFC 1035 labels.
  



| Name | Type | Go type | Default | Description | Example |
|------|------|---------| ------- |-------------|---------|
| APIV1ObjectName | string| string | | Object names can have a variety of forms, including RFC 1123 subdomains,</br>RFC 1123 labels, or RFC 1035 labels. |  |



### <span id="api-v1-parent-reference"></span> APIV1ParentReference


> ParentReference identifies an API object. It is used to associate the InferencePool with a
parent resource, such as a Gateway.
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| group | [APIV1Group](#api-v1-group)| `APIV1Group` |  | |  |  |
| kind | [APIV1Kind](#api-v1-kind)| `APIV1Kind` |  | |  |  |
| name | [APIV1ObjectName](#api-v1-object-name)| `APIV1ObjectName` |  | |  |  |
| namespace | [APIV1Namespace](#api-v1-namespace)| `APIV1Namespace` |  | |  |  |



### <span id="additional-item"></span> AdditionalItem


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Icon | string| `string` |  | |  |  |
| Title | string| `string` |  | |  |  |
| Value | string| `string` |  | |  |  |



### <span id="addresses"></span> Addresses


  

[][ModelsAddress](#models-address)

### <span id="aggregation"></span> Aggregation


> Aggregation represents label's allowed aggregations, transformed from aggregation in MonitoringDashboard config resource
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| DisplayName | string| `string` |  | |  |  |
| Label | string| `string` |  | |  |  |
| SingleSelection | boolean| `bool` |  | |  |  |



### <span id="analysis-message-base"></span> AnalysisMessageBase


> AnalysisMessageBase describes some common information that is needed for all
messages. All information should be static with respect to the error code.
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| DocumentationUrl | string| `string` |  | | A url pointing to the Istio documentation for this specific error type.</br>Should be of the form</br>`^http(s)?://(preliminary\.)?istio.io/docs/reference/config/analysis/`</br>Required. |  |
| level | [AnalysisMessageBaseLevel](#analysis-message-base-level)| `AnalysisMessageBaseLevel` |  | |  |  |
| type | [AnalysisMessageBaseType](#analysis-message-base-type)| `AnalysisMessageBaseType` |  | |  |  |



### <span id="analysis-message-base-level"></span> AnalysisMessageBase_Level


> as well as leaving space in between to add more later
  



| Name | Type | Go type | Default | Description | Example |
|------|------|---------| ------- |-------------|---------|
| AnalysisMessageBase_Level | int32 (formatted integer)| int32 | | as well as leaving space in between to add more later |  |



### <span id="analysis-message-base-type"></span> AnalysisMessageBase_Type


> A unique identifier for the type of message. Name is intended to be
human-readable, code is intended to be machine readable. There should be a
one-to-one mapping between name and code. (i.e. do not re-use names or
codes between message types.)
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | string| `string` |  | | A 7 character code matching `^IST[0-9]{4}$` intended to uniquely identify</br>the message type. (e.g. "IST0001" is mapped to the "InternalError" message</br>type.) 0000-0100 are reserved. Required. |  |
| Name | string| `string` |  | | A human-readable name for the message type. e.g. "InternalError",</br>"PodMissingProxy". This should be the same for all messages of the same type.</br>Required. |  |



### <span id="apis-v1-group"></span> ApisV1Group


> This validation is based off of the corresponding Kubernetes validation:
https://github.com/kubernetes/apimachinery/blob/02cfb53916346d085a6c6c7c66f882e3c6b0eca6/pkg/util/validation/validation.go#L208

Valid values include:

- "" - empty string implies core Kubernetes API group
- "gateway.networking.k8s.io"
- "foo.example.com"

Invalid values include:

- "example.com/bar" - "/" is an invalid character
  



| Name | Type | Go type | Default | Description | Example |
|------|------|---------| ------- |-------------|---------|
| ApisV1Group | string| string | | This validation is based off of the corresponding Kubernetes validation:</br>https://github.com/kubernetes/apimachinery/blob/02cfb53916346d085a6c6c7c66f882e3c6b0eca6/pkg/util/validation/validation.go#L208</br></br>Valid values include:</br></br>- "" - empty string implies core Kubernetes API group</br>- "gateway.networking.k8s.io"</br>- "foo.example.com"</br></br>Invalid values include:</br></br>- "example.com/bar" - "/" is an invalid character |  |



### <span id="apis-v1-kind"></span> ApisV1Kind


> Valid values include:

- "Service"
- "HTTPRoute"

Invalid values include:

- "invalid/kind" - "/" is an invalid character
  



| Name | Type | Go type | Default | Description | Example |
|------|------|---------| ------- |-------------|---------|
| ApisV1Kind | string| string | | Valid values include:</br></br>- "Service"</br>- "HTTPRoute"</br></br>Invalid values include:</br></br>- "invalid/kind" - "/" is an invalid character |  |



### <span id="apis-v1-namespace"></span> ApisV1Namespace


> This validation is based off of the corresponding Kubernetes validation:
https://github.com/kubernetes/apimachinery/blob/02cfb53916346d085a6c6c7c66f882e3c6b0eca6/pkg/util/validation/validation.go#L187

This is used for Namespace name validation here:
https://github.com/kubernetes/apimachinery/blob/02cfb53916346d085a6c6c7c66f882e3c6b0eca6/pkg/api/validation/generic.go#L63

Valid values include:

- "example"

Invalid values include:

- "example.com" - "." is an invalid character
  



| Name | Type | Go type | Default | Description | Example |
|------|------|---------| ------- |-------------|---------|
| ApisV1Namespace | string| string | | This validation is based off of the corresponding Kubernetes validation:</br>https://github.com/kubernetes/apimachinery/blob/02cfb53916346d085a6c6c7c66f882e3c6b0eca6/pkg/util/validation/validation.go#L187</br></br>This is used for Namespace name validation here:</br>https://github.com/kubernetes/apimachinery/blob/02cfb53916346d085a6c6c7c66f882e3c6b0eca6/pkg/api/validation/generic.go#L63</br></br>Valid values include:</br></br>- "example"</br></br>Invalid values include:</br></br>- "example.com" - "." is an invalid character |  |



### <span id="apis-v1-object-name"></span> ApisV1ObjectName


> Object names can have a variety of forms, including RFC 1123 subdomains,
RFC 1123 labels, or RFC 1035 labels.
  



| Name | Type | Go type | Default | Description | Example |
|------|------|---------| ------- |-------------|---------|
| ApisV1ObjectName | string| string | | Object names can have a variety of forms, including RFC 1123 subdomains,</br>RFC 1123 labels, or RFC 1035 labels. |  |



### <span id="apis-v1-parent-reference"></span> ApisV1ParentReference


> - Gateway (Gateway conformance profile)
- Service (Mesh conformance profile, ClusterIP Services only)

This API may be extended in the future to support additional kinds of parent
resources.

The API object must be valid in the cluster; the Group and Kind must
be registered in the cluster for this reference to be valid.
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Port | int32 (formatted integer)| `int32` |  | | Port is the network port this Route targets. It can be interpreted</br>differently based on the type of parent resource.</br></br>When the parent resource is a Gateway, this targets all listeners</br>listening on the specified port that also support this kind of Route(and</br>select this Route). It's not recommended to set `Port` unless the</br>networking behaviors specified in a Route must apply to a specific port</br>as opposed to a listener(s) whose port(s) may be changed. When both Port</br>and SectionName are specified, the name and port of the selected listener</br>must match both specified values.</br></br><gateway:experimental:description></br>When the parent resource is a Service, this targets a specific port in the</br>Service spec. When both Port (experimental) and SectionName are specified,</br>the name and port of the selected port must match both specified values.</br></gateway:experimental:description></br></br>Implementations MAY choose to support other parent resources.</br>Implementations supporting other types of parent resources MUST clearly</br>document how/if Port is interpreted.</br></br>For the purpose of status, an attachment is considered successful as</br>long as the parent resource accepts it partially. For example, Gateway</br>listeners can restrict which Routes can attach to them by Route kind,</br>namespace, or hostname. If 1 of 2 Gateway listeners accept attachment</br>from the referencing Route, the Route MUST be considered successfully</br>attached. If no Gateway listeners accept attachment from this Route,</br>the Route MUST be considered detached from the Gateway.</br></br>Support: Extended |  |
| group | [ApisV1Group](#apis-v1-group)| `ApisV1Group` |  | |  |  |
| kind | [ApisV1Kind](#apis-v1-kind)| `ApisV1Kind` |  | |  |  |
| name | [ApisV1ObjectName](#apis-v1-object-name)| `ApisV1ObjectName` |  | |  |  |
| namespace | [ApisV1Namespace](#apis-v1-namespace)| `ApisV1Namespace` |  | |  |  |
| sectionName | [SectionName](#section-name)| `SectionName` |  | |  |  |



### <span id="app"></span> App


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Cluster | string| `string` |  | | Cluster of the application | `east` |
| IsAmbient | boolean| `bool` | ✓ | | Define if all the workloads are ambient | `true` |
| Name | string| `string` | ✓ | | Name of the application | `reviews` |
| Runtimes | [][Runtime](#runtime)| `[]*Runtime` |  | | Runtimes and associated dashboards |  |
| ServiceNames | []string| `[]string` | ✓ | | List of service names linked with an application |  |
| Workloads | [][WorkloadItem](#workload-item)| `[]*WorkloadItem` | ✓ | | Workloads for a given application |  |
| health | [AppHealth](#app-health)| `AppHealth` |  | |  |  |
| namespace | [Namespace](#namespace)| `Namespace` | ✓ | |  |  |



### <span id="app-health"></span> AppHealth


> AppHealth contains aggregated health from various sources, for a given app
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| WorkloadStatuses | [][WorkloadStatus](#workload-status)| `[]*WorkloadStatus` |  | |  |  |
| requests | [RequestHealth](#request-health)| `RequestHealth` |  | |  |  |
| status | [CalculatedHealthStatus](#calculated-health-status)| `CalculatedHealthStatus` |  | |  |  |



### <span id="app-list"></span> AppList


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Apps | [][AppListItem](#app-list-item)| `[]*AppListItem` | ✓ | | Applications for a given namespace |  |
| Cluster | string| `string` | ✓ | | Cluster where the apps live in | `east` |
| namespace | [Namespace](#namespace)| `Namespace` | ✓ | |  |  |



### <span id="app-list-item"></span> AppListItem


> AppListItem has the necessary information to display the console app list
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Cluster | string| `string` |  | | The kube cluster where this application is located. |  |
| IsAmbient | boolean| `bool` | ✓ | | Define if any pod has the Ambient annotation | `true` |
| IsGateway | boolean| `bool` | ✓ | | Define if Labels related to this Workload contains any Gateway label | `true` |
| IstioReferences | [][IstioValidationKey](#istio-validation-key)| `[]*IstioValidationKey` |  | | Istio References |  |
| IstioSidecar | boolean| `bool` | ✓ | | Define if all Pods related to the Workloads of this app has an IstioSidecar deployed | `true` |
| Labels | map of string| `map[string]string` |  | | Labels for App |  |
| Metrics | map of string| `map[string]string` |  | | Metrics for App |  |
| Name | string| `string` | ✓ | | Name of the application | `reviews` |
| Namespace | string| `string` |  | | Namespace of the application |  |
| health | [AppHealth](#app-health)| `AppHealth` |  | |  |  |



### <span id="app-protocol"></span> AppProtocol


  

| Name | Type | Go type | Default | Description | Example |
|------|------|---------| ------- |-------------|---------|
| AppProtocol | string| string | |  |  |



### <span id="authentication-policy"></span> AuthenticationPolicy


> It can be set for two different scopes, mesh-wide or set on a per-pod basis using the ProxyConfig annotation.
Mesh policy cannot be INHERIT.
  



| Name | Type | Go type | Default | Description | Example |
|------|------|---------| ------- |-------------|---------|
| AuthenticationPolicy | int32 (formatted integer)| int32 | | It can be set for two different scopes, mesh-wide or set on a per-pod basis using the ProxyConfig annotation.</br>Mesh policy cannot be INHERIT. |  |



### <span id="backend-object-reference"></span> BackendObjectReference


> Note that when a namespace different than the local namespace is specified, a
ReferenceGrant object is required in the referent namespace to allow that
namespace's owner to accept the reference. See the ReferenceGrant
documentation for details.

The API object must be valid in the cluster; the Group and Kind must
be registered in the cluster for this reference to be valid.

References to objects with invalid Group and Kind are not valid, and must
be rejected by the implementation, with appropriate Conditions set
on the containing object.

If the backend service requires TLS, use BackendTLSPolicy to tell the
implementation to supply the TLS details to be used to connect to that
backend.
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Port | int32 (formatted integer)| `int32` |  | | Port specifies the destination port number to use for this resource.</br>Port is required when the referent is a Kubernetes Service. In this</br>case, the port number is the service port number, not the target port.</br>For other resources, destination port might be derived from the referent</br>resource or this field. |  |
| group | [ApisV1Group](#apis-v1-group)| `ApisV1Group` |  | |  |  |
| kind | [ApisV1Kind](#apis-v1-kind)| `ApisV1Kind` |  | |  |  |
| name | [ApisV1ObjectName](#apis-v1-object-name)| `ApisV1ObjectName` |  | |  |  |
| namespace | [ApisV1Namespace](#apis-v1-namespace)| `ApisV1Namespace` |  | |  |  |



### <span id="bool-or-string"></span> BoolOrString


> Workaround to handle different data types from Istio 1.25 -> Istio 1.26
  



| Name | Type | Go type | Default | Description | Example |
|------|------|---------| ------- |-------------|---------|
| BoolOrString | string| string | | Workaround to handle different data types from Istio 1.25 -> Istio 1.26 |  |



### <span id="bool-value"></span> BoolValue


> The JSON representation for `BoolValue` is JSON `true` and `false`.

Not recommended for use in new APIs, but still useful for legacy APIs and
has no plan to be removed.
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Value | boolean| `bool` |  | | The bool value. |  |



### <span id="bootstrap"></span> Bootstrap


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Bootstrap | map of any | `map[string]any` |  | |  |  |



### <span id="c-o-r-s-origin"></span> CORSOrigin


> The CORSOrigin MUST NOT be a relative URI, and it MUST follow the URI syntax and
encoding rules specified in RFC3986.  The CORSOrigin MUST include both a
scheme ("http" or "https") and a scheme-specific-part, or it should be a single '*' character.
URIs that include an authority MUST include a fully qualified domain name or
IP address as the host.
  



| Name | Type | Go type | Default | Description | Example |
|------|------|---------| ------- |-------------|---------|
| CORSOrigin | string| string | | The CORSOrigin MUST NOT be a relative URI, and it MUST follow the URI syntax and</br>encoding rules specified in RFC3986.  The CORSOrigin MUST include both a</br>scheme ("http" or "https") and a scheme-specific-part, or it should be a single '*' character.</br>URIs that include an authority MUST include a fully qualified domain name or</br>IP address as the host. |  |



### <span id="calculated-health-status"></span> CalculatedHealthStatus


> CalculatedHealthStatus represents the calculated health status with additional context
This is populated by the backend's health calculation logic.
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| ErrorRatio | double (formatted number)| `float64` |  | |  |  |
| TotalRequestRate | double (formatted number)| `float64` |  | |  |  |
| status | [HealthStatus](#health-status)| `HealthStatus` |  | |  |  |



### <span id="cert-chain"></span> CertChain


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| ExpirationTime | string| `string` |  | |  |  |
| Pem | string| `string` |  | |  |  |
| SerialNumber | string| `string` |  | |  |  |
| ValidFrom | string| `string` |  | |  |  |



### <span id="chart"></span> Chart


> Chart is the model representing a custom chart, transformed from charts in MonitoringDashboard config resource
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| ChartType | string| `string` |  | |  |  |
| Error | string| `string` |  | |  |  |
| Max | int64 (formatted integer)| `int64` |  | |  |  |
| Metrics | [][Metric](#metric)| `[]*Metric` |  | |  |  |
| Min | int64 (formatted integer)| `int64` |  | |  |  |
| Name | string| `string` |  | |  |  |
| Spans | int64 (formatted integer)| `int64` |  | |  |  |
| StartCollapsed | boolean| `bool` |  | |  |  |
| Unit | string| `string` |  | |  |  |
| XAxis | string| `string` |  | |  |  |



### <span id="client-tls-settings"></span> ClientTLSSettings


> For example, the following rule configures a client to use mutual TLS
for connections to upstream database cluster.

```yaml
apiVersion: networking.istio.io/v1
kind: DestinationRule
metadata:


spec:

trafficPolicy:
tls:
mode: MUTUAL
clientCertificate: /etc/certs/myclientcert.pem
privateKey: /etc/certs/client_private_key.pem
caCertificates: /etc/certs/rootcacerts.pem

```

The following rule configures a client to use TLS when talking to a
foreign service whose domain matches *.foo.com.

```yaml
apiVersion: networking.istio.io/v1
kind: DestinationRule
metadata:


spec:

trafficPolicy:
tls:
mode: SIMPLE

```

The following rule configures a client to use Istio mutual TLS when talking
to rating services.

```yaml
apiVersion: networking.istio.io/v1
kind: DestinationRule
metadata:


spec:

trafficPolicy:
tls:
mode: ISTIO_MUTUAL

```
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| CaCertificates | string| `string` |  | | OPTIONAL: The path to the file containing certificate authority</br>certificates to use in verifying a presented server certificate. If</br>omitted, the proxy will verify the server's certificate using</br>the OS CA certificates.</br>Should be empty if mode is `ISTIO_MUTUAL`. |  |
| CaCrl | string| `string` |  | | OPTIONAL: The path to the file containing the certificate revocation list (CRL)</br>to use in verifying a presented server certificate. `CRL` is a list of certificates</br>that have been revoked by the CA (Certificate Authority) before their scheduled expiration date.</br>If specified, the proxy will verify if the presented certificate is part of the revoked list of certificates.</br>If omitted, the proxy will not verify the certificate against the `crl`. Note that if `credentialName` is set,</br>`CRL` cannot be specified using `caCrl`, rather it has to be specified inside the credential. |  |
| ClientCertificate | string| `string` |  | | REQUIRED if mode is `MUTUAL`. The path to the file holding the</br>client-side TLS certificate to use.</br>Should be empty if mode is `ISTIO_MUTUAL`. |  |
| CredentialName | string| `string` |  | | The name of the secret that holds the TLS certs for the</br>client including the CA certificates. This secret must exist in</br>the namespace of the proxy using the certificates.</br>An Opaque secret should contain the following keys and values:</br>`key: <privateKey>`, `cert: <clientCert>`, `cacert: <CACertificate>`,</br>`crl: <certificateRevocationList>`</br>Here CACertificate is used to verify the server certificate.</br>For mutual TLS, `cacert: <CACertificate>` can be provided in the</br>same secret or a separate secret named `<secret>-cacert`.</br>A TLS secret for client certificates with an additional</br>`ca.crt` key for CA certificates and `ca.crl` key for</br>certificate revocation list(CRL) is also supported.</br>Only one of client certificates and CA certificate</br>or credentialName can be specified.</br></br>**NOTE:** This field is applicable at sidecars only if</br>`DestinationRule` has a `workloadSelector` specified.</br>Otherwise the field will be applicable only at gateways, and</br>sidecars will continue to use the certificate paths. |  |
| PrivateKey | string| `string` |  | | REQUIRED if mode is `MUTUAL`. The path to the file holding the</br>client's private key.</br>Should be empty if mode is `ISTIO_MUTUAL`. |  |
| Sni | string| `string` |  | | SNI string to present to the server during TLS handshake.</br>If unspecified, SNI will be automatically set based on downstream HTTP</br>host/authority header for SIMPLE and MUTUAL TLS modes. |  |
| SubjectAltNames | []string| `[]string` |  | | A list of alternate names to verify the subject identity in the</br>certificate. If specified, the proxy will verify that the server</br>certificate's subject alt name matches one of the specified values.</br>If specified, this list overrides the value of `subjectAltNames`</br>from the `ServiceEntry`. If unspecified, automatic validation of upstream</br>presented certificate for new upstream connections will be done based on the</br>downstream HTTP host/authority header. |  |
| insecure_skip_verify | [BoolValue](#bool-value)| `BoolValue` |  | |  |  |
| mode | [ClientTLSSettingsTLSmode](#client-tls-settings-t-l-smode)| `ClientTLSSettingsTLSmode` |  | |  |  |



### <span id="client-tls-settings-t-l-smode"></span> ClientTLSSettings_TLSmode


> TLS connection mode
  



| Name | Type | Go type | Default | Description | Example |
|------|------|---------| ------- |-------------|---------|
| ClientTLSSettings_TLSmode | int32 (formatted integer)| int32 | | TLS connection mode |  |



### <span id="cluster"></span> Cluster


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| DestinationRule | string| `string` |  | |  |  |
| Direction | string| `string` |  | |  |  |
| Port | int64 (formatted integer)| `int64` |  | |  |  |
| Subset | string| `string` |  | |  |  |
| Type | string| `string` |  | |  |  |
| service_fqdn | [Host](#host)| `Host` |  | |  |  |



### <span id="clusters"></span> Clusters


  

[][Cluster](#cluster)

### <span id="clusters-namespace-health"></span> ClustersNamespaceHealth


> ClustersNamespaceHealth is a map NamespaceHealth for namespaces of given clusters
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| AppHealth | map of [NamespaceAppHealth](#namespace-app-health)| `map[string]NamespaceAppHealth` |  | |  |  |
| NamespaceHealth | map of [NamespaceHealthAggregate](#namespace-health-aggregate)| `map[string]NamespaceHealthAggregate` |  | |  |  |
| ServiceHealth | map of [NamespaceServiceHealth](#namespace-service-health)| `map[string]NamespaceServiceHealth` |  | |  |  |
| WorkloadHealth | map of [NamespaceWorkloadHealth](#namespace-workload-health)| `map[string]NamespaceWorkloadHealth` |  | |  |  |



### <span id="common-config"></span> CommonConfig


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Duration | int64 (formatted integer)| `int64` |  | |  |  |
| GraphType | string| `string` |  | |  |  |
| Timestamp | int64 (formatted integer)| `int64` |  | |  |  |
| elements | [Elements](#elements)| `Elements` |  | |  |  |



### <span id="component-status"></span> ComponentStatus


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Cluster | string| `string` |  | | Cluster where this component is deployed.</br>Can be the name of external cluster |  |
| IsCore | boolean| `bool` | ✓ | | When true, the component is necessary for Istio to function. Otherwise, it is an addon. | `true` |
| MeshId | string| `string` |  | | Mesh name or ID that this component belongs to.</br>This is derived from the control plane's MeshId or TrustDomain.</br>Empty if the mesh information cannot be determined. |  |
| Name | string| `string` | ✓ | | The workload name of the Istio component. | `istio-ingressgateway` |
| Status | string| `string` | ✓ | | The status of an Istio component. | `Not Found` |



### <span id="condition"></span> Condition


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| LastTransitionTime | string| `string` |  | | lastTransitionTime is the last time the condition transitioned from one status to another.</br>This should be when the underlying condition changed.  If that is not known, then using the time when the API field changed is acceptable. |  |
| Message | string| `string` |  | | message is a human readable message indicating details about the transition.</br>This may be an empty string. |  |
| ObservedGeneration | int64 (formatted integer)| `int64` |  | | observedGeneration represents the .metadata.generation that the condition was set based upon.</br>For instance, if .metadata.generation is currently 12, but the .status.conditions[x].observedGeneration is 9, the condition is out of date</br>with respect to the current state of the instance. |  |
| Reason | string| `string` |  | | reason contains a programmatic identifier indicating the reason for the condition's last transition.</br>Producers of specific condition types may define expected values and meanings for this field,</br>and whether the values are considered a guaranteed API.</br>The value should be a CamelCase string.</br>This field may not be empty. |  |
| Type | string| `string` |  | | type of condition in CamelCase or in foo.example.com/CamelCase. |  |
| status | [ConditionStatus](#condition-status)| `ConditionStatus` |  | |  |  |



### <span id="condition-status"></span> ConditionStatus


  

| Name | Type | Go type | Default | Description | Example |
|------|------|---------| ------- |-------------|---------|
| ConditionStatus | string| string | |  |  |



### <span id="config-dump"></span> ConfigDump


> Root of ConfigDump
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Configs | [][any](#any)| `[]any` |  | |  |  |



### <span id="config-source"></span> ConfigSource


> ConfigSource describes information about a configuration store inside a
mesh. A single control plane instance can interact with one or more data
sources.
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Address | string| `string` |  | | Address of the server implementing the Istio Mesh Configuration</br>protocol (MCP). Can be IP address or a fully qualified DNS name.</br>Use xds:// to specify a grpc-based xds backend, k8s:// to specify a k8s controller or</br>fs:/// to specify a file-based backend with absolute path to the directory. |  |
| SubscribedResources | [][Resource](#resource)| `[]Resource` |  | | Describes the source of configuration, if nothing is specified default is MCP |  |
| tls_settings | [ClientTLSSettings](#client-tls-settings)| `ClientTLSSettings` |  | |  |  |



### <span id="configuration-validation"></span> ConfigurationValidation


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Error | string| `string` |  | |  |  |
| Message | string| `string` |  | |  |  |



### <span id="connection-pool-settings"></span> ConnectionPoolSettings


> For example, the following rule sets a limit of 100 connections to redis
service called myredissrv with a connect timeout of 30ms

```yaml
apiVersion: networking.istio.io/v1
kind: DestinationRule
metadata:


spec:

trafficPolicy:
connectionPool:
tcp:
maxConnections: 100
connectTimeout: 30ms
tcpKeepalive:
time: 7200s
interval: 75s

```
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| http | [ConnectionPoolSettingsHTTPSettings](#connection-pool-settings-http-settings)| `ConnectionPoolSettingsHTTPSettings` |  | |  |  |
| tcp | [ConnectionPoolSettingsTCPSettings](#connection-pool-settings-tcp-settings)| `ConnectionPoolSettingsTCPSettings` |  | |  |  |



### <span id="connection-pool-settings-http-settings"></span> ConnectionPoolSettings_HTTPSettings


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Http1MaxPendingRequests | int32 (formatted integer)| `int32` |  | | Maximum number of requests that will be queued while waiting for</br>a ready connection pool connection. Default 2^32-1.</br>Refer to [Envoy Circuit Breaking](https://www.envoyproxy.io/docs/envoy/latest/intro/arch_overview/upstream/circuit_breaking)</br>under which conditions a new connection is created for HTTP/2.</br>Please note that this is applicable to both HTTP/1.1 and HTTP/2. |  |
| Http2MaxRequests | int32 (formatted integer)| `int32` |  | | Maximum number of active requests to a destination. Default 2^32-1.</br>Please note that this is applicable to both HTTP/1.1 and HTTP/2. |  |
| MaxConcurrentStreams | int32 (formatted integer)| `int32` |  | | The maximum number of concurrent streams allowed for a peer on one HTTP/2 connection.</br>Defaults to 2^31-1. |  |
| MaxRequestsPerConnection | int32 (formatted integer)| `int32` |  | | Maximum number of requests per connection to a backend. Setting this</br>parameter to 1 disables keep alive. Default 0, meaning "unlimited",</br>up to 2^29. |  |
| MaxRetries | int32 (formatted integer)| `int32` |  | | Maximum number of retries that can be outstanding to all hosts in a</br>cluster at a given time. Defaults to 2^32-1. |  |
| UseClientProtocol | boolean| `bool` |  | | If set to true, client protocol will be preserved while initiating connection to backend.</br>Note that when this is set to true, `h2UpgradePolicy` will be ineffective i.e. the client</br>connections will not be upgraded to http2. |  |
| h2_upgrade_policy | [ConnectionPoolSettingsHTTPSettingsH2UpgradePolicy](#connection-pool-settings-http-settings-h2-upgrade-policy)| `ConnectionPoolSettingsHTTPSettingsH2UpgradePolicy` |  | |  |  |
| idle_timeout | [DurationpbDuration](#durationpb-duration)| `DurationpbDuration` |  | |  |  |



### <span id="connection-pool-settings-http-settings-h2-upgrade-policy"></span> ConnectionPoolSettings_HTTPSettings_H2UpgradePolicy


  

| Name | Type | Go type | Default | Description | Example |
|------|------|---------| ------- |-------------|---------|
| ConnectionPoolSettings_HTTPSettings_H2UpgradePolicy | int32 (formatted integer)| int32 | |  |  |



### <span id="connection-pool-settings-tcp-settings"></span> ConnectionPoolSettings_TCPSettings


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| MaxConnections | int32 (formatted integer)| `int32` |  | | Maximum number of HTTP1 /TCP connections to a destination host. Default 2^32-1. |  |
| connect_timeout | [DurationpbDuration](#durationpb-duration)| `DurationpbDuration` |  | |  |  |
| idle_timeout | [DurationpbDuration](#durationpb-duration)| `DurationpbDuration` |  | |  |  |
| max_connection_duration | [DurationpbDuration](#durationpb-duration)| `DurationpbDuration` |  | |  |  |
| tcp_keepalive | [ConnectionPoolSettingsTCPSettingsTCPKeepalive](#connection-pool-settings-tcp-settings-tcp-keepalive)| `ConnectionPoolSettingsTCPSettingsTCPKeepalive` |  | |  |  |



### <span id="connection-pool-settings-tcp-settings-tcp-keepalive"></span> ConnectionPoolSettings_TCPSettings_TcpKeepalive


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Probes | uint32 (formatted integer)| `uint32` |  | | Maximum number of keepalive probes to send without response before</br>deciding the connection is dead. Default is to use the OS level configuration</br>(unless overridden, Linux defaults to 9.) |  |
| interval | [DurationpbDuration](#durationpb-duration)| `DurationpbDuration` |  | |  |  |
| time | [DurationpbDuration](#durationpb-duration)| `DurationpbDuration` |  | |  |  |



### <span id="container-info"></span> ContainerInfo


> ContainerInfo holds container name and image
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Image | string| `string` |  | |  |  |
| IsAmbient | boolean| `bool` |  | |  |  |
| IsProxy | boolean| `bool` |  | |  |  |
| IsReady | boolean| `bool` |  | |  |  |
| Name | string| `string` |  | |  |  |



### <span id="control-plane"></span> ControlPlane


> It's expected to manage the cluster that it is deployed in.
It has configuration for all the clusters/namespaces associated with it.
TODO: Should maybe consolidate the pilot discovery env vars under its
own section/struct: https://istio.io/latest/docs/reference/commands/pilot-discovery/#envvars.
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| ConfigWarning | string| `string` |  | | ConfigWarning describes configuration sources that Kiali could not load. |  |
| ExternalControlPlane | boolean| `bool` |  | | ExternalControlPlane indicates if the controlplane is managing an external cluster. |  |
| ID | string| `string` |  | | ID is the control plane ID as known by istiod. |  |
| IstiodName | string| `string` |  | | IstiodName is the control plane name |  |
| IstiodNamespace | string| `string` |  | | IstiodNamespace is the namespace name of the deployed control plane |  |
| ManagedClusters | [][KubeCluster](#kube-cluster)| `[]*KubeCluster` |  | | ManagedClusters are the clusters that this controlplane manages.</br>This could include the cluster that the controlplane is running on. |  |
| ManagedNamespaces | [][Namespace](#namespace)| `[]*Namespace` |  | | ManagedNamespaces are the namespaces that the controlplane is managing.</br>More specifically, it is a namespace with either injection enabled</br>or ambient enabled and it matches this controlplane's revision either</br>directly or through a tag. |  |
| ManagesExternal | boolean| `bool` |  | | ManagesExternal indicates if the controlplane manages an external cluster.</br>It could also manage the cluster that it is running on. |  |
| MonitoringPort | int64 (formatted integer)| `int64` |  | | MonitoringPort is the port used for monitoring metrics, parsed from the --monitoringAddr argument.</br>Defaults to 15014 if not specified or in invalid format. |  |
| Revision | string| `string` |  | | Revision is the revision of the controlplane.</br>Can be empty when it's the default revision. |  |
| RootNamespace | string| `string` |  | | RootNamespace is the root namespace name of the deployed control plane, if not set in MeshConfig then it</br>defaults to IstiodNamespace. See https://istio.io/latest/docs/reference/config/istio.mesh.v1alpha1/#MeshConfig-root_namespace |  |
| Status | string| `string` |  | | Status is the status of the controlplane as reported by kiali.</br>It includes the deployment status and whether kiali can connect</br>to the controlplane or not. |  |
| cluster | [KubeCluster](#kube-cluster)| `KubeCluster` |  | |  |  |
| config | [ControlPlaneConfiguration](#control-plane-configuration)| `ControlPlaneConfiguration` |  | |  |  |
| resources | [ResourceRequirements](#resource-requirements)| `ResourceRequirements` |  | |  |  |
| tag | [Tag](#tag)| `Tag` |  | |  |  |
| thresholds | [IstiodThresholds](#istiod-thresholds)| `IstiodThresholds` |  | |  |  |
| version | [ExternalServiceInfo](#external-service-info)| `ExternalServiceInfo` |  | |  |  |



### <span id="control-plane-configuration"></span> ControlPlaneConfiguration


> This is used primarly consumed by the frontend. If you just want the mesh config for the controlplane
then use controlPlane.MeshConfig.
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Certificates | [][ModelsCertificate](#models-certificate)| `[]*ModelsCertificate` |  | | Certificates are the certificates in use by the controlplane. |  |
| Network | string| `string` |  | | Network is the name of the network that the controlplane is using. |  |
| effectiveConfig | [MeshConfigSource](#mesh-config-source)| `MeshConfigSource` |  | |  |  |
| fileConfig | [MeshConfigSource](#mesh-config-source)| `MeshConfigSource` |  | |  |  |
| sharedConfig | [MeshConfigSource](#mesh-config-source)| `MeshConfigSource` |  | |  |  |
| standardConfig | [MeshConfigSource](#mesh-config-source)| `MeshConfigSource` |  | |  |  |



### <span id="controller-name"></span> ControllerName


> Valid values include:

- "example.com/bar"

Invalid values include:

- "example.com" - must include path
- "foo.example.com" - must include path
  



| Name | Type | Go type | Default | Description | Example |
|------|------|---------| ------- |-------------|---------|
| ControllerName | string| string | | Valid values include:</br></br>- "example.com/bar"</br></br>Invalid values include:</br></br>- "example.com" - must include path</br>- "foo.example.com" - must include path |  |



### <span id="cookie-config"></span> CookieConfig


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| lifetimeType | [CookieLifetimeType](#cookie-lifetime-type)| `CookieLifetimeType` |  | |  |  |



### <span id="cookie-lifetime-type"></span> CookieLifetimeType


  

| Name | Type | Go type | Default | Description | Example |
|------|------|---------| ------- |-------------|---------|
| CookieLifetimeType | string| string | |  |  |



### <span id="cors-policy"></span> CorsPolicy


> ```yaml
apiVersion: networking.istio.io/v1
kind: VirtualService
metadata:


spec:

hosts:
- ratings.prod.svc.cluster.local
http:
- route:
- destination:
subset: v1
corsPolicy:
allowOrigins:
- exact: https://example.com
allowMethods:
- POST
- GET
allowCredentials: false
allowHeaders:
- X-Foo-Bar
maxAge: "24h"

```
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| AllowHeaders | []string| `[]string` |  | | List of HTTP headers that can be used when requesting the</br>resource. Serialized to Access-Control-Allow-Headers header. |  |
| AllowMethods | []string| `[]string` |  | | List of HTTP methods allowed to access the resource. The content will</br>be serialized into the Access-Control-Allow-Methods header. |  |
| AllowOrigin | []string| `[]string` |  | | The list of origins that are allowed to perform CORS requests. The</br>content will be serialized into the Access-Control-Allow-Origin</br>header. Wildcard * will allow all origins.</br>$hide_from_docs</br></br>Deprecated: Marked as deprecated in networking/v1alpha3/virtual_service.proto. |  |
| AllowOrigins | [][StringMatch](#string-match)| `[]*StringMatch` |  | | String patterns that match allowed origins.</br>An origin is allowed if any of the string matchers match.</br>If a match is found, then the outgoing Access-Control-Allow-Origin would be set to the origin as provided by the client. |  |
| ExposeHeaders | []string| `[]string` |  | | A list of HTTP headers that the browsers are allowed to</br>access. Serialized into Access-Control-Expose-Headers header. |  |
| allow_credentials | [BoolValue](#bool-value)| `BoolValue` |  | |  |  |
| max_age | [DurationpbDuration](#durationpb-duration)| `DurationpbDuration` |  | |  |  |
| unmatched_preflights | [CorsPolicyUnmatchedPreflights](#cors-policy-unmatched-preflights)| `CorsPolicyUnmatchedPreflights` |  | |  |  |



### <span id="cors-policy-unmatched-preflights"></span> CorsPolicy_UnmatchedPreflights


  

| Name | Type | Go type | Default | Description | Example |
|------|------|---------| ------- |-------------|---------|
| CorsPolicy_UnmatchedPreflights | int32 (formatted integer)| int32 | |  |  |



### <span id="dns-resolver-config"></span> DNSResolverConfig


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Domain | string| `string` |  | |  |  |
| NameServers | [][NameServer](#name-server)| `[]*NameServer` |  | |  |  |
| Search | []string| `[]string` |  | |  |  |



### <span id="dns-resolver-options"></span> DNSResolverOptions


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Attempts | int64 (formatted integer)| `int64` |  | |  |  |
| AuthenticData | boolean| `bool` |  | |  |  |
| CacheSize | int64 (formatted integer)| `int64` |  | |  |  |
| CheckNames | boolean| `bool` |  | |  |  |
| Edns0 | boolean| `bool` |  | |  |  |
| IpStrategy | string| `string` |  | |  |  |
| Ndots | int64 (formatted integer)| `int64` |  | |  |  |
| NegativeMaxTtl | string| `string` |  | |  |  |
| NegativeMinTtl | string| `string` |  | |  |  |
| NumConcurrentReqs | int64 (formatted integer)| `int64` |  | |  |  |
| PositiveMaxTtl | string| `string` |  | |  |  |
| PositiveMinTtl | string| `string` |  | |  |  |
| PreserveIntermediates | boolean| `bool` |  | |  |  |
| RecursionDesired | boolean| `bool` |  | |  |  |
| Rotate | boolean| `bool` |  | |  |  |
| ServerOrderingStrategy | string| `string` |  | |  |  |
| ShuffleDnsServers | boolean| `bool` |  | |  |  |
| TryTcpOnError | boolean| `bool` |  | |  |  |
| Validate | boolean| `bool` |  | |  |  |
| timeout | [TimeDuration](#time-duration)| `TimeDuration` |  | |  |  |
| use_hosts_file | [BoolOrString](#bool-or-string)| `BoolOrString` |  | |  |  |



### <span id="dashboard-ref"></span> DashboardRef


> DashboardRef holds template name and title for a custom dashboard
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Template | string| `string` |  | |  |  |
| Title | string| `string` |  | |  |  |



### <span id="datapoint"></span> Datapoint


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Timestamp | int64 (formatted integer)| `int64` |  | |  |  |
| Value | double (formatted number)| `float64` |  | |  |  |



### <span id="delegate"></span> Delegate


> ```yaml
apiVersion: networking.istio.io/v1
kind: VirtualService
metadata:


spec:

hosts:
- "bookinfo.com"
gateways:
- mygateway
http:
- match:
- uri:
prefix: "/productpage"
delegate:
namespace: nsA
- match:
- uri:
prefix: "/reviews"
delegate:
namespace: nsB

```

```yaml
apiVersion: networking.istio.io/v1
kind: VirtualService
metadata:

namespace: nsA

spec:

http:
- match:
- uri:
prefix: "/productpage/v1/"
route:
- destination:
- route:
- destination:

```

```yaml
apiVersion: networking.istio.io/v1
kind: VirtualService
metadata:

namespace: nsB

spec:

http:
- route:
- destination:

```
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Name | string| `string` |  | | Name specifies the name of the delegate VirtualService. |  |
| Namespace | string| `string` |  | | Namespace specifies the namespace where the delegate VirtualService resides.</br>By default, it is same to the root's. |  |



### <span id="destination"></span> Destination


> *Note for Kubernetes users*: When short names are used (e.g. "reviews"
instead of "reviews.default.svc.cluster.local"), Istio will interpret
the short name based on the namespace of the rule, not the service. A
rule in the "default" namespace containing a host "reviews" will be
interpreted as "reviews.default.svc.cluster.local", irrespective of the
actual namespace associated with the reviews service. _To avoid potential
misconfigurations, it is recommended to always use fully qualified
domain names over short names._

The following Kubernetes example routes all traffic by default to pods
of the reviews service with label "version: v1" (i.e., subset v1), and
some to subset v2, in a Kubernetes environment.

```yaml
apiVersion: networking.istio.io/v1
kind: VirtualService
metadata:

namespace: foo

spec:

hosts:
- reviews # interpreted as reviews.foo.svc.cluster.local
http:
- match:
- uri:
prefix: "/wpcatalog"
- uri:
prefix: "/consumercatalog"
rewrite:
uri: "/newcatalog"
route:
- destination:
subset: v2
- route:
- destination:
subset: v1

```

# And the associated DestinationRule

```yaml
apiVersion: networking.istio.io/v1
kind: DestinationRule
metadata:

namespace: foo

spec:

subsets:
- name: v1
labels:
- name: v2
labels:

```

The following VirtualService sets a timeout of 5s for all calls to
productpage.prod.svc.cluster.local service in Kubernetes. Notice that
there are no subsets defined in this rule. Istio will fetch all
instances of productpage.prod.svc.cluster.local service from the service
registry and populate the sidecar's load balancing pool. Also, notice
that this rule is set in the istio-system namespace but uses the fully
qualified domain name of the productpage service,
productpage.prod.svc.cluster.local. Therefore the rule's namespace does
not have an impact in resolving the name of the productpage service.

```yaml
apiVersion: networking.istio.io/v1
kind: VirtualService
metadata:

namespace: istio-system

spec:

hosts:
- productpage.prod.svc.cluster.local # ignores rule namespace
http:
- timeout: 5s
route:
- destination:

```

To control routing for traffic bound to services outside the mesh, external
services must first be added to Istio's internal service registry using the
ServiceEntry resource. VirtualServices can then be defined to control traffic
bound to these external services. For example, the following rules define a
Service for wikipedia.org and set a timeout of 5s for HTTP requests.

```yaml
apiVersion: networking.istio.io/v1
kind: ServiceEntry
metadata:


spec:

hosts:
- wikipedia.org
location: MESH_EXTERNAL
ports:
- number: 80
protocol: HTTP
resolution: DNS
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Host | string| `string` |  | | The name of a service from the service registry. Service</br>names are looked up from the platform's service registry (e.g.,</br>Kubernetes services, Consul services, etc.) and from the hosts</br>declared by [ServiceEntry](https://istio.io/docs/reference/config/networking/service-entry/#ServiceEntry). Traffic forwarded to</br>destinations that are not found in either of the two, will be dropped.</br></br>*Note for Kubernetes users*: When short names are used (e.g. "reviews"</br>instead of "reviews.default.svc.cluster.local"), Istio will interpret</br>the short name based on the namespace of the rule, not the service. A</br>rule in the "default" namespace containing a host "reviews" will be</br>interpreted as "reviews.default.svc.cluster.local", irrespective of</br>the actual namespace associated with the reviews service. To avoid</br>potential misconfiguration, it is recommended to always use fully</br>qualified domain names over short names. |  |
| Subset | string| `string` |  | | The name of a subset within the service. Applicable only to services</br>within the mesh. The subset must be defined in a corresponding</br>DestinationRule. |  |
| port | [PortSelector](#port-selector)| `PortSelector` |  | |  |  |



### <span id="double-value"></span> DoubleValue


> The JSON representation for `DoubleValue` is JSON number.

Not recommended for use in new APIs, but still useful for legacy APIs and
has no plan to be removed.
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Value | double (formatted number)| `float64` |  | | The double value. |  |



### <span id="durationpb-duration"></span> DurationpbDuration


> # Examples

Example 1: Compute Duration from two Timestamps in pseudo code.

Timestamp start = ...;
Timestamp end = ...;
Duration duration = ...;

duration.seconds = end.seconds - start.seconds;
duration.nanos = end.nanos - start.nanos;

if (duration.seconds < 0 && duration.nanos > 0) {
duration.seconds += 1;
duration.nanos -= 1000000000;
} else if (duration.seconds > 0 && duration.nanos < 0) {
duration.seconds -= 1;
duration.nanos += 1000000000;
}

Example 2: Compute Timestamp from Timestamp + Duration in pseudo code.

Timestamp start = ...;
Duration duration = ...;
Timestamp end = ...;

end.seconds = start.seconds + duration.seconds;
end.nanos = start.nanos + duration.nanos;

if (end.nanos < 0) {
end.seconds -= 1;
end.nanos += 1000000000;
} else if (end.nanos >= 1000000000) {
end.seconds += 1;
end.nanos -= 1000000000;
}

Example 3: Compute Duration from datetime.timedelta in Python.

td = datetime.timedelta(days=3, minutes=10)
duration = Duration()
duration.FromTimedelta(td)

# JSON Mapping

In JSON format, the Duration type is encoded as a string rather than an
object, where the string ends in the suffix "s" (indicating seconds) and
is preceded by the number of seconds, with nanoseconds expressed as
fractional seconds. For example, 3 seconds with 0 nanoseconds should be
encoded in JSON format as "3s", while 3 seconds and 1 nanosecond should
be expressed in JSON format as "3.000000001s", and 3 seconds and 1
microsecond should be expressed in JSON format as "3.000001s".
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Nanos | int32 (formatted integer)| `int32` |  | | Signed fractions of a second at nanosecond resolution of the span</br>of time. Durations less than one second are represented with a 0</br>`seconds` field and a positive or negative `nanos` field. For durations</br>of one second or more, a non-zero value for the `nanos` field must be</br>of the same sign as the `seconds` field. Must be from -999,999,999</br>to +999,999,999 inclusive. |  |
| Seconds | int64 (formatted integer)| `int64` |  | | Signed seconds of the span of time. Must be from -315,576,000,000</br>to +315,576,000,000 inclusive. Note: these bounds are computed from:</br>60 sec/min * 60 min/hr * 24 hr/day * 365.25 days/year * 10000 years |  |



### <span id="edge-data"></span> EdgeData


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| DestPrincipal | string| `string` |  | |  |  |
| HealthStatus | string| `string` |  | |  |  |
| ID | string| `string` |  | |  |  |
| IsMTLS | string| `string` |  | |  |  |
| ResponseTime | string| `string` |  | |  |  |
| Source | string| `string` |  | |  |  |
| SourcePrincipal | string| `string` |  | |  |  |
| Target | string| `string` |  | |  |  |
| Throughput | string| `string` |  | |  |  |
| traffic | [ProtocolTraffic](#protocol-traffic)| `ProtocolTraffic` |  | |  |  |
| waypoint | [WaypointEdge](#waypoint-edge)| `WaypointEdge` |  | |  |  |



### <span id="edge-wrapper"></span> EdgeWrapper


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| data | [EdgeData](#edge-data)| `EdgeData` |  | |  |  |



### <span id="elements"></span> Elements


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Edges | [][EdgeWrapper](#edge-wrapper)| `[]*EdgeWrapper` |  | |  |  |
| Nodes | [][NodeWrapper](#node-wrapper)| `[]*NodeWrapper` |  | |  |  |



### <span id="endpoint-picker-failure-mode"></span> EndpointPickerFailureMode


> EndpointPickerFailureMode defines the options for how the parent handles the case when the
Endpoint Picker extension is non-responsive.
  



| Name | Type | Go type | Default | Description | Example |
|------|------|---------| ------- |-------------|---------|
| EndpointPickerFailureMode | string| string | | EndpointPickerFailureMode defines the options for how the parent handles the case when the</br>Endpoint Picker extension is non-responsive. |  |



### <span id="endpoint-picker-ref"></span> EndpointPickerRef


> EndpointPickerRef specifies a reference to an Endpoint Picker extension and its
associated configuration.
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| failureMode | [EndpointPickerFailureMode](#endpoint-picker-failure-mode)| `EndpointPickerFailureMode` |  | |  |  |
| group | [APIV1Group](#api-v1-group)| `APIV1Group` |  | |  |  |
| kind | [APIV1Kind](#api-v1-kind)| `APIV1Kind` |  | |  |  |
| name | [APIV1ObjectName](#api-v1-object-name)| `APIV1ObjectName` |  | |  |  |
| port | [V1Port](#v1-port)| `V1Port` |  | |  |  |



### <span id="endpoints"></span> Endpoints


  

[][ModelsEndpoint](#models-endpoint)

### <span id="envoy-memory-cause"></span> EnvoyMemoryCause


  

| Name | Type | Go type | Default | Description | Example |
|------|------|---------| ------- |-------------|---------|
| EnvoyMemoryCause | string| string | |  |  |



### <span id="envoy-memory-summary"></span> EnvoyMemorySummary


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| ActiveClustersMax | int64 (formatted integer)| `int64` |  | |  |  |
| ActiveConnections | int64 (formatted integer)| `int64` |  | |  |  |
| ConfigCountsPod | string| `string` |  | |  |  |
| LargeConfigClustersThreshold | int64 (formatted integer)| `int64` |  | |  |  |
| MemoryLimitBytes | int64 (formatted integer)| `int64` |  | |  |  |
| MemoryMaxBytes | int64 (formatted integer)| `int64` |  | |  |  |
| MemoryThresholdBytes | int64 (formatted integer)| `int64` |  | |  |  |
| MemoryUsedPercent | double (formatted number)| `float64` |  | |  |  |
| RequestRate | double (formatted number)| `float64` |  | |  |  |
| RoughConfigMemoryBytes | int64 (formatted integer)| `int64` |  | |  |  |
| TrafficIsByteRate | boolean| `bool` |  | |  |  |
| cause | [EnvoyMemoryCause](#envoy-memory-cause)| `EnvoyMemoryCause` |  | |  |  |
| proxyType | [EnvoyProxyType](#envoy-proxy-type)| `EnvoyProxyType` |  | |  |  |



### <span id="envoy-proxy-dump"></span> EnvoyProxyDump


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| bootstrap | [Bootstrap](#bootstrap)| `Bootstrap` |  | |  |  |
| clusters | [Clusters](#clusters)| `Clusters` |  | |  |  |
| config_dump | [ConfigDump](#config-dump)| `ConfigDump` |  | |  |  |
| listeners | [Listeners](#listeners)| `Listeners` |  | |  |  |
| routes | [Routes](#routes)| `Routes` |  | |  |  |



### <span id="envoy-proxy-type"></span> EnvoyProxyType


  

| Name | Type | Go type | Default | Description | Example |
|------|------|---------| ------- |-------------|---------|
| EnvoyProxyType | string| string | |  |  |



### <span id="ext-info"></span> ExtInfo


> ExtInfo contains client-side info about the extension
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Name | string| `string` |  | |  |  |
| URL | string| `string` |  | | URL is an optional URL that links to the extension's own external UI |  |



### <span id="external-kiali-instance"></span> ExternalKialiInstance


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Cluster | [KubeCluster](#kube-cluster)| `KubeCluster` |  | |  |  |
| Kiali | [KialiInstance](#kiali-instance)| `KialiInstance` |  | |  |  |



### <span id="external-link"></span> ExternalLink


> ExternalLink provides links to external dashboards (e.g. to Grafana)
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Name | string| `string` |  | |  |  |
| URL | string| `string` |  | |  |  |
| variables | [MonitoringDashboardExternalLinkVariables](#monitoring-dashboard-external-link-variables)| `MonitoringDashboardExternalLinkVariables` |  | |  |  |



### <span id="external-service-info"></span> ExternalServiceInfo


> Status response model
This is used for returning a response of Kiali Status
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Name | string| `string` | ✓ | | The name of the service | `Istio` |
| Url | string| `string` |  | | The service url | `jaeger-query-istio-system.127.0.0.1.nip.io` |
| Version | string| `string` |  | | The installed version of the service | `0.8.0` |
| tempoConfig | [TempoConfig](#tempo-config)| `TempoConfig` |  | |  |  |



### <span id="fields-v1"></span> FieldsV1


> Each key is either a '.' representing the field itself, and will always map to an empty set,
or a string representing a sub-field or item. The string will follow one of these four formats:
'f:<name>', where <name> is the name of a field in a struct, or key in a map
'v:<value>', where <value> is the exact json formatted value of a list item
'i:<index>', where <index> is position of a item in a list
'k:<keys>', where <keys> is a map of  a list item's key fields to their unique values
If a key maps to an empty Fields value, the field that key represents is part of the set.

The exact format is defined in sigs.k8s.io/structured-merge-diff
  



[any](#any)

### <span id="file-path"></span> FilePath


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| File | string| `string` |  | |  |  |



### <span id="format"></span> Format


  

| Name | Type | Go type | Default | Description | Example |
|------|------|---------| ------- |-------------|---------|
| Format | string| string | |  |  |



### <span id="forward-body-config"></span> ForwardBodyConfig


> If empty or unset, do not forward the body.
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| MaxSize | uint16 (formatted integer)| `uint16` |  | | MaxSize specifies how large in bytes the largest body that will be buffered</br>and sent to the authorization server. If the body size is larger than</br>`maxSize`, then the body sent to the authorization server must be</br>truncated to `maxSize` bytes.</br></br>Experimental note: This behavior needs to be checked against</br>various dataplanes; it may need to be changed.</br>See https://github.com/kubernetes-sigs/gateway-api/pull/4001#discussion_r2291405746</br>for more.</br></br>If 0, the body will not be sent to the authorization server. |  |



### <span id="forward-client-cert-details"></span> ForwardClientCertDetails


> ForwardClientCertDetails controls how the x-forwarded-client-cert (XFCC)
header is handled by a proxy.
See [Envoy XFCC](https://www.envoyproxy.io/docs/envoy/latest/api-v3/extensions/filters/network/http_connection_manager/v3/http_connection_manager.proto.html#enum-extensions-filters-network-http-connection-manager-v3-httpconnectionmanager-forwardclientcertdetails)
header handling for more details.
  



| Name | Type | Go type | Default | Description | Example |
|------|------|---------| ------- |-------------|---------|
| ForwardClientCertDetails | int32 (formatted integer)| int32 | | ForwardClientCertDetails controls how the x-forwarded-client-cert (XFCC)</br>header is handled by a proxy.</br>See [Envoy XFCC](https://www.envoyproxy.io/docs/envoy/latest/api-v3/extensions/filters/network/http_connection_manager/v3/http_connection_manager.proto.html#enum-extensions-filters-network-http-connection-manager-v3-httpconnectionmanager-forwardclientcertdetails)</br>header handling for more details. |  |



### <span id="fraction"></span> Fraction


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Denominator | int32 (formatted integer)| `int32` |  | |  |  |
| Numerator | int32 (formatted integer)| `int32` |  | |  |  |



### <span id="g-rpc-auth-config"></span> GRPCAuthConfig


> Requests and responses are defined in the protobufs explained at:
https://www.envoyproxy.io/docs/envoy/latest/api-v3/service/auth/v3/external_auth.proto
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| AllowedRequestHeaders | []string| `[]string` |  | | AllowedRequestHeaders specifies what headers from the client request</br>will be sent to the authorization server.</br></br>If this list is empty, then all headers must be sent.</br></br>If the list has entries, only those entries must be sent. |  |



### <span id="g-rpc-backend-ref"></span> GRPCBackendRef


> Note that when a namespace different than the local namespace is specified, a
ReferenceGrant object is required in the referent namespace to allow that
namespace's owner to accept the reference. See the ReferenceGrant
documentation for details.

<gateway:experimental:description>

When the BackendRef points to a Kubernetes Service, implementations SHOULD
honor the appProtocol field if it is set for the target Service Port.

Implementations supporting appProtocol SHOULD recognize the Kubernetes
Standard Application Protocols defined in KEP-3726.

If a Service appProtocol isn't specified, an implementation MAY infer the
backend protocol through its own means. Implementations MAY infer the
protocol from the Route type referring to the backend Service.

If a Route is not able to send traffic to the backend using the specified
protocol then the backend is considered invalid. Implementations MUST set the
"ResolvedRefs" condition to "False" with the "UnsupportedProtocol" reason.

</gateway:experimental:description>
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Filters | [][GRPCRouteFilter](#g-rpc-route-filter)| `[]*GRPCRouteFilter` |  | | Filters defined at this level MUST be executed if and only if the</br>request is being forwarded to the backend defined here.</br></br>Support: Implementation-specific (For broader support of filters, use the</br>Filters field in GRPCRouteRule.) |  |
| Port | int32 (formatted integer)| `int32` |  | | Port specifies the destination port number to use for this resource.</br>Port is required when the referent is a Kubernetes Service. In this</br>case, the port number is the service port number, not the target port.</br>For other resources, destination port might be derived from the referent</br>resource or this field. |  |
| Weight | int32 (formatted integer)| `int32` |  | | Weight specifies the proportion of requests forwarded to the referenced</br>backend. This is computed as weight/(sum of all weights in this</br>BackendRefs list). For non-zero values, there may be some epsilon from</br>the exact proportion defined here depending on the precision an</br>implementation supports. Weight is not a percentage and the sum of</br>weights does not need to equal 100.</br></br>If only one backend is specified and it has a weight greater than 0, 100%</br>of the traffic is forwarded to that backend. If weight is set to 0, no</br>traffic should be forwarded for this entry. If unspecified, weight</br>defaults to 1.</br></br>Support for this field varies based on the context where used. |  |
| group | [ApisV1Group](#apis-v1-group)| `ApisV1Group` |  | |  |  |
| kind | [ApisV1Kind](#apis-v1-kind)| `ApisV1Kind` |  | |  |  |
| name | [ApisV1ObjectName](#apis-v1-object-name)| `ApisV1ObjectName` |  | |  |  |
| namespace | [ApisV1Namespace](#apis-v1-namespace)| `ApisV1Namespace` |  | |  |  |



### <span id="g-rpc-header-match"></span> GRPCHeaderMatch


> GRPCHeaderMatch describes how to select a gRPC route by matching gRPC request
headers.
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Value | string| `string` |  | | Value is the value of the gRPC Header to be matched. |  |
| name | [GRPCHeaderName](#g-rpc-header-name)| `GRPCHeaderName` |  | |  |  |
| type | [GRPCHeaderMatchType](#g-rpc-header-match-type)| `GRPCHeaderMatchType` |  | |  |  |



### <span id="g-rpc-header-match-type"></span> GRPCHeaderMatchType


> - "Exact" - Core
- "RegularExpression" - Implementation Specific

Note that new values may be added to this enum in future releases of the API,
implementations MUST ensure that unknown values will not cause a crash.

Unknown values here MUST result in the implementation setting the Accepted
Condition for the Route to `status: False`, with a Reason of
`UnsupportedValue`.
  



| Name | Type | Go type | Default | Description | Example |
|------|------|---------| ------- |-------------|---------|
| GRPCHeaderMatchType | string| string | | - "Exact" - Core</br>- "RegularExpression" - Implementation Specific</br></br>Note that new values may be added to this enum in future releases of the API,</br>implementations MUST ensure that unknown values will not cause a crash.</br></br>Unknown values here MUST result in the implementation setting the Accepted</br>Condition for the Route to `status: False`, with a Reason of</br>`UnsupportedValue`. |  |



### <span id="g-rpc-header-name"></span> GRPCHeaderName


  

[HeaderName](#header-name)

#### Inlined models

### <span id="g-rpc-method-match"></span> GRPCMethodMatch


> At least one of Service and Method MUST be a non-empty string.
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Method | string| `string` |  | | Value of the method to match against. If left empty or omitted, will</br>match all services.</br></br>At least one of Service and Method MUST be a non-empty string. |  |
| Service | string| `string` |  | | Value of the service to match against. If left empty or omitted, will</br>match any service.</br></br>At least one of Service and Method MUST be a non-empty string. |  |
| type | [GRPCMethodMatchType](#g-rpc-method-match-type)| `GRPCMethodMatchType` |  | |  |  |



### <span id="g-rpc-method-match-type"></span> GRPCMethodMatchType


> - "Exact" - Core
- "RegularExpression" - Implementation Specific

Exact methods MUST be syntactically valid:

- Must not contain `/` character
  



| Name | Type | Go type | Default | Description | Example |
|------|------|---------| ------- |-------------|---------|
| GRPCMethodMatchType | string| string | | - "Exact" - Core</br>- "RegularExpression" - Implementation Specific</br></br>Exact methods MUST be syntactically valid:</br></br>- Must not contain `/` character |  |



### <span id="g-rpc-route"></span> GRPCRoute


> GRPCRoute falls under extended support within the Gateway API. Within the
following specification, the word "MUST" indicates that an implementation
supporting GRPCRoute must conform to the indicated requirement, but an
implementation not supporting this route type need not follow the requirement
unless explicitly indicated.

Implementations supporting `GRPCRoute` with the `HTTPS` `ProtocolType` MUST
accept HTTP/2 connections without an initial upgrade from HTTP/1.1, i.e. via
ALPN. If the implementation does not support this, then it MUST set the
"Accepted" condition to "False" for the affected listener with a reason of
"UnsupportedProtocol".  Implementations MAY also accept HTTP/2 connections
with an upgrade from HTTP/1.

Implementations supporting `GRPCRoute` with the `HTTP` `ProtocolType` MUST
support HTTP/2 over cleartext TCP (h2c,
https://www.rfc-editor.org/rfc/rfc7540#section-3.1) without an initial
upgrade from HTTP/1.1, i.e. with prior knowledge
(https://www.rfc-editor.org/rfc/rfc7540#section-3.4). If the implementation
does not support this, then it MUST set the "Accepted" condition to "False"
for the affected listener with a reason of "UnsupportedProtocol".
Implementations MAY also accept HTTP/2 connections with an upgrade from
HTTP/1, i.e. without prior knowledge.
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| APIVersion | string| `string` |  | | APIVersion defines the versioned schema of this representation of an object.</br>Servers should convert recognized schemas to the latest internal value, and</br>may reject unrecognized values.</br>More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#resources |  |
| Kind | string| `string` |  | | Kind is a string value representing the REST resource this object represents.</br>Servers may infer this from the endpoint the client submits requests to.</br>Cannot be updated.</br>In CamelCase.</br>More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds |  |
| metadata | [ObjectMeta](#object-meta)| `ObjectMeta` |  | |  |  |
| spec | [GRPCRouteSpec](#g-rpc-route-spec)| `GRPCRouteSpec` |  | |  |  |
| status | [GRPCRouteStatus](#g-rpc-route-status)| `GRPCRouteStatus` |  | |  |  |



### <span id="g-rpc-route-filter"></span> GRPCRouteFilter


> GRPCRouteFilter defines processing steps that must be completed during the
request or response lifecycle. GRPCRouteFilters are meant as an extension
point to express processing that may be done in Gateway implementations. Some
examples include request or response modification, implementing
authentication strategies, rate-limiting, and traffic shaping. API
guarantee/conformance is defined based on the type of the filter.
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| extensionRef | [LocalObjectReference](#local-object-reference)| `LocalObjectReference` |  | |  |  |
| requestHeaderModifier | [HTTPHeaderFilter](#http-header-filter)| `HTTPHeaderFilter` |  | |  |  |
| requestMirror | [HTTPRequestMirrorFilter](#http-request-mirror-filter)| `HTTPRequestMirrorFilter` |  | |  |  |
| responseHeaderModifier | [HTTPHeaderFilter](#http-header-filter)| `HTTPHeaderFilter` |  | |  |  |
| type | [GRPCRouteFilterType](#g-rpc-route-filter-type)| `GRPCRouteFilterType` |  | |  |  |



### <span id="g-rpc-route-filter-type"></span> GRPCRouteFilterType


  

| Name | Type | Go type | Default | Description | Example |
|------|------|---------| ------- |-------------|---------|
| GRPCRouteFilterType | string| string | |  |  |



### <span id="g-rpc-route-match"></span> GRPCRouteMatch


> For example, the match below will match a gRPC request only if its service
is `foo` AND it contains the `version: v1` header:

```
matches:
- method:
type: Exact
service: "foo"
- headers:
value "v1"

```
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Headers | [][GRPCHeaderMatch](#g-rpc-header-match)| `[]*GRPCHeaderMatch` |  | | Headers specifies gRPC request header matchers. Multiple match values are</br>ANDed together, meaning, a request MUST match all the specified headers</br>to select the route. |  |
| method | [GRPCMethodMatch](#g-rpc-method-match)| `GRPCMethodMatch` |  | |  |  |



### <span id="g-rpc-route-rule"></span> GRPCRouteRule


> GRPCRouteRule defines the semantics for matching a gRPC request based on
conditions (matches), processing it (filters), and forwarding the request to
an API object (backendRefs).
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| BackendRefs | [][GRPCBackendRef](#g-rpc-backend-ref)| `[]*GRPCBackendRef` |  | | BackendRefs defines the backend(s) where matching requests should be</br>sent.</br></br>Failure behavior here depends on how many BackendRefs are specified and</br>how many are invalid.</br></br>If *all* entries in BackendRefs are invalid, and there are also no filters</br>specified in this route rule, *all* traffic which matches this rule MUST</br>receive an `UNAVAILABLE` status.</br></br>See the GRPCBackendRef definition for the rules about what makes a single</br>GRPCBackendRef invalid.</br></br>When a GRPCBackendRef is invalid, `UNAVAILABLE` statuses MUST be returned for</br>requests that would have otherwise been routed to an invalid backend. If</br>multiple backends are specified, and some are invalid, the proportion of</br>requests that would otherwise have been routed to an invalid backend</br>MUST receive an `UNAVAILABLE` status.</br></br>For example, if two backends are specified with equal weights, and one is</br>invalid, 50 percent of traffic MUST receive an `UNAVAILABLE` status.</br>Implementations may choose how that 50 percent is determined.</br></br>Support: Core for Kubernetes Service</br></br>Support: Implementation-specific for any other resource</br></br>Support for weight: Core |  |
| Filters | [][GRPCRouteFilter](#g-rpc-route-filter)| `[]*GRPCRouteFilter` |  | | Filters define the filters that are applied to requests that match</br>this rule.</br></br>The effects of ordering of multiple behaviors are currently unspecified.</br>This can change in the future based on feedback during the alpha stage.</br></br>Conformance-levels at this level are defined based on the type of filter:</br></br>- ALL core filters MUST be supported by all implementations that support</br>GRPCRoute.</br>- Implementers are encouraged to support extended filters.</br>- Implementation-specific custom filters have no API guarantees across</br>implementations.</br></br>Specifying the same filter multiple times is not supported unless explicitly</br>indicated in the filter.</br></br>If an implementation cannot support a combination of filters, it must clearly</br>document that limitation. In cases where incompatible or unsupported</br>filters are specified and cause the `Accepted` condition to be set to status</br>`False`, implementations may use the `IncompatibleFilters` reason to specify</br>this configuration error.</br></br>Support: Core |  |
| Matches | [][GRPCRouteMatch](#g-rpc-route-match)| `[]*GRPCRouteMatch` |  | | Matches define conditions used for matching the rule against incoming</br>gRPC requests. Each match is independent, i.e. this rule will be matched</br>if **any** one of the matches is satisfied.</br></br>For example, take the following matches configuration:</br></br>```</br>matches:</br>- method:</br>service: foo.bar</br>headers:</br>values:</br>- method:</br>service: foo.bar.v2</br>```</br></br>For a request to match against this rule, it MUST satisfy</br>EITHER of the two conditions:</br></br>- service of foo.bar AND contains the header `version: 2`</br>- service of foo.bar.v2</br></br>See the documentation for GRPCRouteMatch on how to specify multiple</br>match conditions to be ANDed together.</br></br>If no matches are specified, the implementation MUST match every gRPC request.</br></br>Proxy or Load Balancer routing configuration generated from GRPCRoutes</br>MUST prioritize rules based on the following criteria, continuing on</br>ties. Merging MUST not be done between GRPCRoutes and HTTPRoutes.</br>Precedence MUST be given to the rule with the largest number of:</br></br>- Characters in a matching non-wildcard hostname.</br>- Characters in a matching hostname.</br>- Characters in a matching service.</br>- Characters in a matching method.</br>- Header matches.</br></br>If ties still exist across multiple Routes, matching precedence MUST be</br>determined in order of the following criteria, continuing on ties:</br></br>- The oldest Route based on creation timestamp.</br>- The Route appearing first in alphabetical order by</br>"{namespace}/{name}".</br></br>If ties still exist within the Route that has been given precedence,</br>matching precedence MUST be granted to the first matching rule meeting</br>the above criteria. |  |
| name | [SectionName](#section-name)| `SectionName` |  | |  |  |
| sessionPersistence | [SessionPersistence](#session-persistence)| `SessionPersistence` |  | |  |  |



### <span id="g-rpc-route-spec"></span> GRPCRouteSpec


> GRPCRouteSpec defines the desired state of GRPCRoute
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Hostnames | [][Hostname](#hostname)| `[]Hostname` |  | | Hostnames defines a set of hostnames to match against the GRPC</br>Host header to select a GRPCRoute to process the request. This matches</br>the RFC 1123 definition of a hostname with 2 notable exceptions:</br></br>1. IPs are not allowed.</br>2. A hostname may be prefixed with a wildcard label (`*.`). The wildcard</br>label MUST appear by itself as the first label.</br></br>If a hostname is specified by both the Listener and GRPCRoute, there</br>MUST be at least one intersecting hostname for the GRPCRoute to be</br>attached to the Listener. For example:</br></br>- A Listener with `test.example.com` as the hostname matches GRPCRoutes</br>that have either not specified any hostnames, or have specified at</br>least one of `test.example.com` or `*.example.com`.</br>- A Listener with `*.example.com` as the hostname matches GRPCRoutes</br>that have either not specified any hostnames or have specified at least</br>one hostname that matches the Listener hostname. For example,</br>`test.example.com` and `*.example.com` would both match. On the other</br>hand, `example.com` and `test.example.net` would not match.</br></br>Hostnames that are prefixed with a wildcard label (`*.`) are interpreted</br>as a suffix match. That means that a match for `*.example.com` would match</br>both `test.example.com`, and `foo.test.example.com`, but not `example.com`.</br></br>If both the Listener and GRPCRoute have specified hostnames, any</br>GRPCRoute hostnames that do not match the Listener hostname MUST be</br>ignored. For example, if a Listener specified `*.example.com`, and the</br>GRPCRoute specified `test.example.com` and `test.example.net`,</br>`test.example.net` MUST NOT be considered for a match.</br></br>If both the Listener and GRPCRoute have specified hostnames, and none</br>match with the criteria above, then the GRPCRoute MUST NOT be accepted by</br>the implementation. The implementation MUST raise an 'Accepted' Condition</br>with a status of `False` in the corresponding RouteParentStatus.</br></br>If a Route (A) of type HTTPRoute or GRPCRoute is attached to a</br>Listener and that listener already has another Route (B) of the other</br>type attached and the intersection of the hostnames of A and B is</br>non-empty, then the implementation MUST accept exactly one of these two</br>routes, determined by the following criteria, in order:</br></br>- The oldest Route based on creation timestamp.</br>- The Route appearing first in alphabetical order by</br>"{namespace}/{name}".</br></br>The rejected Route MUST raise an 'Accepted' condition with a status of</br>'False' in the corresponding RouteParentStatus.</br></br>Support: Core |  |
| ParentRefs | [][ApisV1ParentReference](#apis-v1-parent-reference)| `[]*ApisV1ParentReference` |  | | ParentRefs references the resources (usually Gateways) that a Route wants</br>to be attached to. Note that the referenced parent resource needs to</br>allow this for the attachment to be complete. For Gateways, that means</br>the Gateway needs to allow attachment from Routes of this kind and</br>namespace. For Services, that means the Service must either be in the same</br>namespace for a "producer" route, or the mesh implementation must support</br>and allow "consumer" routes for the referenced Service. ReferenceGrant is</br>not applicable for governing ParentRefs to Services - it is not possible to</br>create a "producer" route for a Service in a different namespace from the</br>Route.</br></br>There are two kinds of parent resources with "Core" support:</br></br>- Gateway (Gateway conformance profile)</br>- Service (Mesh conformance profile, ClusterIP Services only)</br></br>This API may be extended in the future to support additional kinds of parent</br>resources.</br></br>ParentRefs must be _distinct_. This means either that:</br></br>- They select different objects.  If this is the case, then parentRef</br>entries are distinct. In terms of fields, this means that the</br>multi-part key defined by `group`, `kind`, `namespace`, and `name` must</br>be unique across all parentRef entries in the Route.</br>- They do not select different objects, but for each optional field used,</br>each ParentRef that selects the same object must set the same set of</br>optional fields to different values. If one ParentRef sets a</br>combination of optional fields, all must set the same combination.</br></br>Some examples:</br></br>- If one ParentRef sets `sectionName`, all ParentRefs referencing the</br>same object must also set `sectionName`.</br>- If one ParentRef sets `port`, all ParentRefs referencing the same</br>object must also set `port`.</br>- If one ParentRef sets `sectionName` and `port`, all ParentRefs</br>referencing the same object must also set `sectionName` and `port`.</br></br>It is possible to separately reference multiple distinct objects that may</br>be collapsed by an implementation. For example, some implementations may</br>choose to merge compatible Gateway Listeners together. If that is the</br>case, the list of routes attached to those resources should also be</br>merged.</br></br>Note that for ParentRefs that cross namespace boundaries, there are specific</br>rules. Cross-namespace references are only valid if they are explicitly</br>allowed by something in the namespace they are referring to. For example,</br>Gateway has the AllowedRoutes field, and ReferenceGrant provides a</br>generic way to enable other kinds of cross-namespace reference.</br></br><gateway:experimental:description></br>ParentRefs from a Route to a Service in the same namespace are "producer"</br>routes, which apply default routing rules to inbound connections from</br>any namespace to the Service.</br></br>ParentRefs from a Route to a Service in a different namespace are</br>"consumer" routes, and these routing rules are only applied to outbound</br>connections originating from the same namespace as the Route, for which</br>the intended destination of the connections are a Service targeted as a</br>ParentRef of the Route.</br></gateway:experimental:description></br></br><gateway:util:excludeFromCRD></br>Ensures that when the same parent is referenced more than once, each reference</br>carries a distinct, non-empty sectionName. The first rule enforces consistency</br>(all refs specify sectionName or none do), the second enforces uniqueness.</br></gateway:util:excludeFromCRD></br><gateway:standard:validation:XValidation:message="sectionName must be specified when parentRefs includes 2 or more references to the same parent",rule="self.all(p1, self.all(p2, p1.group == p2.group && p1.kind == p2.kind && p1.name == p2.name && (((!has(p1.__namespace__) || p1.__namespace__ == '') && (!has(p2.__namespace__) || p2.__namespace__ == '')) || (has(p1.__namespace__) && has(p2.__namespace__) && p1.__namespace__ == p2.__namespace__ )) ? ((!has(p1.sectionName) || p1.sectionName == '') == (!has(p2.sectionName) || p2.sectionName == '')) : true))"></br><gateway:standard:validation:XValidation:message="sectionName must be unique when parentRefs includes 2 or more references to the same parent",rule="self.all(p1, self.exists_one(p2, p1.group == p2.group && p1.kind == p2.kind && p1.name == p2.name && (((!has(p1.__namespace__) || p1.__namespace__ == '') && (!has(p2.__namespace__) || p2.__namespace__ == '')) || (has(p1.__namespace__) && has(p2.__namespace__) && p1.__namespace__ == p2.__namespace__ )) && (((!has(p1.sectionName) || p1.sectionName == '') && (!has(p2.sectionName) || p2.sectionName == '')) || (has(p1.sectionName) && has(p2.sectionName) && p1.sectionName == p2.sectionName))))"></br><gateway:util:excludeFromCRD></br>Experimental variants of the above rules that additionally require the combination</br>of sectionName and port to be consistently specified and unique across refs.</br></gateway:util:excludeFromCRD></br><gateway:experimental:validation:XValidation:message="sectionName or port must be specified when parentRefs includes 2 or more references to the same parent",rule="self.all(p1, self.all(p2, p1.group == p2.group && p1.kind == p2.kind && p1.name == p2.name && (((!has(p1.__namespace__) || p1.__namespace__ == '') && (!has(p2.__namespace__) || p2.__namespace__ == '')) || (has(p1.__namespace__) && has(p2.__namespace__) && p1.__namespace__ == p2.__namespace__)) ? ((!has(p1.sectionName) || p1.sectionName == '') == (!has(p2.sectionName) || p2.sectionName == '') && (!has(p1.port) || p1.port == 0) == (!has(p2.port) || p2.port == 0)): true))"></br><gateway:experimental:validation:XValidation:message="sectionName or port must be unique when parentRefs includes 2 or more references to the same parent",rule="self.all(p1, self.exists_one(p2, p1.group == p2.group && p1.kind == p2.kind && p1.name == p2.name && (((!has(p1.__namespace__) || p1.__namespace__ == '') && (!has(p2.__namespace__) || p2.__namespace__ == '')) || (has(p1.__namespace__) && has(p2.__namespace__) && p1.__namespace__ == p2.__namespace__ )) && (((!has(p1.sectionName) || p1.sectionName == '') && (!has(p2.sectionName) || p2.sectionName == '')) || ( has(p1.sectionName) && has(p2.sectionName) && p1.sectionName == p2.sectionName)) && (((!has(p1.port) || p1.port == 0) && (!has(p2.port) || p2.port == 0)) || (has(p1.port) && has(p2.port) && p1.port == p2.port))))"> |  |
| Rules | [][GRPCRouteRule](#g-rpc-route-rule)| `[]*GRPCRouteRule` |  | | Rules are a list of GRPC matchers, filters and actions.</br></br><gateway:experimental:validation:XValidation:message="Rule name must be unique within the route",rule="self.all(l1, !has(l1.name) || self.exists_one(l2, has(l2.name) && l1.name == l2.name))"> |  |
| useDefaultGateways | [GatewayDefaultScope](#gateway-default-scope)| `GatewayDefaultScope` |  | |  |  |



### <span id="g-rpc-route-status"></span> GRPCRouteStatus


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Parents | [][RouteParentStatus](#route-parent-status)| `[]*RouteParentStatus` |  | | Parents is a list of parent resources (usually Gateways) that are</br>associated with the route, and the status of the route with respect to</br>each parent. When this route attaches to a parent, the controller that</br>manages the parent must add an entry to this list when the controller</br>first sees the route and should update the entry as appropriate when the</br>route or gateway is modified.</br></br>Note that parent references that cannot be resolved by an implementation</br>of this API will not be added to this list. Implementations of this API</br>can only populate Route status for the Gateways/parent resources they are</br>responsible for.</br></br>A maximum of 32 Gateways will be represented in this list. An empty list</br>means the route has not been attached to any Gateway.</br></br><gateway:util:excludeFromCRD></br>Notes for implementors:</br></br>While parents is not a listType `map`, this is due to the fact that the</br>list key is not scalar, and Kubernetes is unable to represent this.</br></br>Parent status MUST be considered to be namespaced by the combination of</br>the parentRef and controllerName fields, and implementations should keep</br>the following rules in mind when updating this status:</br></br>- Implementations MUST update only entries that have a matching value of</br>`controllerName` for that implementation.</br>- Implementations MUST NOT update entries with non-matching `controllerName`</br>fields.</br>- Implementations MUST treat each `parentRef`` in the Route separately and</br>update its status based on the relationship with that parent.</br>- Implementations MUST perform a read-modify-write cycle on this field</br>before modifying it. That is, when modifying this field, implementations</br>must be confident they have fetched the most recent version of this field,</br>and ensure that changes they make are on that recent version.</br></br></gateway:util:excludeFromCRD> |  |



### <span id="g-w-info"></span> GWInfo


> GWInfo contains the resolved gateway configuration if the node represents an Istio gateway
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| egressInfo | [GWInfoIngress](#g-w-info-ingress)| `GWInfoIngress` |  | |  |  |
| gatewayAPIInfo | [GWInfoIngress](#g-w-info-ingress)| `GWInfoIngress` |  | |  |  |
| ingressInfo | [GWInfoIngress](#g-w-info-ingress)| `GWInfoIngress` |  | |  |  |



### <span id="g-w-info-ingress"></span> GWInfoIngress


> GWInfoIngress contains the resolved gateway configuration if the node represents an Istio ingress gateway
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Hostnames | []string| `[]string` |  | | Hostnames is the list of hosts being served by the associated Istio gateways. |  |



### <span id="gateway-controller"></span> GatewayController


> Valid values include:

- "example.com/bar"

Invalid values include:

- "example.com" - must include path
- "foo.example.com" - must include path
  



| Name | Type | Go type | Default | Description | Example |
|------|------|---------| ------- |-------------|---------|
| GatewayController | string| string | | Valid values include:</br></br>- "example.com/bar"</br></br>Invalid values include:</br></br>- "example.com" - must include path</br>- "foo.example.com" - must include path |  |



### <span id="gateway-default-scope"></span> GatewayDefaultScope


> GatewayDefaultScope defines the set of default scopes that a Gateway
can claim, for use in any Route type. At present the only supported
scopes are "All" and "None". "None" is a special scope which
explicitly means that the Route MUST NOT attached to any default
Gateway.
  



| Name | Type | Go type | Default | Description | Example |
|------|------|---------| ------- |-------------|---------|
| GatewayDefaultScope | string| string | | GatewayDefaultScope defines the set of default scopes that a Gateway</br>can claim, for use in any Route type. At present the only supported</br>scopes are "All" and "None". "None" is a special scope which</br>explicitly means that the Route MUST NOT attached to any default</br>Gateway. |  |



### <span id="grafana-info"></span> GrafanaInfo


> GrafanaInfo provides information to access Grafana dashboards
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| DatasourceUID | string| `string` |  | |  |  |
| ExternalLinks | [][ExternalLink](#external-link)| `[]*ExternalLink` |  | |  |  |



### <span id="graph-cache-metrics"></span> GraphCacheMetrics


> This is useful for testing and monitoring without having to scrape the Prometheus metrics endpoint.
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| GraphCacheEvictions | double (formatted number)| `float64` |  | |  |  |
| GraphCacheHits | double (formatted number)| `float64` |  | |  |  |
| GraphCacheMisses | double (formatted number)| `float64` |  | |  |  |



### <span id="group-version-kind"></span> GroupVersionKind


> GroupVersionKind unambiguously identifies a kind.  It doesn't anonymously include GroupVersion
to avoid automatic coercion.  It doesn't use a GroupVersion to avoid custom marshalling
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Group | string| `string` |  | |  |  |
| Kind | string| `string` |  | |  |  |
| Version | string| `string` |  | |  |  |



### <span id="http-auth-config"></span> HTTPAuthConfig


> HTTPAuthConfig contains configuration for communication with HTTP-speaking
backends.
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| AllowedRequestHeaders | []string| `[]string` |  | | AllowedRequestHeaders specifies what additional headers from the client request</br>will be sent to the authorization server.</br></br>The following headers must always be sent to the authorization server,</br>regardless of this setting:</br></br>- `Host`</br>- `Method`</br>- `Path`</br>- `Content-Length`</br>- `Authorization`</br></br>If this list is empty, then only those headers must be sent.</br></br>Note that `Content-Length` has a special behavior, in that the length</br>sent must be correct for the actual request to the external authorization</br>server - that is, it must reflect the actual number of bytes sent in the</br>body of the request to the authorization server.</br></br>So if the `forwardBody` stanza is unset, or `forwardBody.maxSize` is set</br>to `0`, then `Content-Length` must be `0`. If `forwardBody.maxSize` is set</br>to anything other than `0`, then the `Content-Length` of the authorization</br>request must be set to the actual number of bytes forwarded. |  |
| AllowedResponseHeaders | []string| `[]string` |  | | AllowedResponseHeaders specifies what headers from the authorization response</br>will be copied into the request to the backend.</br></br>If this list is empty, then all headers from the authorization server</br>except Authority or Host must be copied. |  |
| Path | string| `string` |  | | Path sets the prefix that paths from the client request will have added</br>when forwarded to the authorization server.</br></br>When empty or unspecified, no prefix is added.</br></br>Valid values are the same as the "value" regex for path values in the `match`</br>stanza, and the validation regex will screen out invalid paths in the same way.</br>Even with the validation, implementations MUST sanitize this input before using it</br>directly. |  |



### <span id="http-backend-ref"></span> HTTPBackendRef


> Note that when a namespace different than the local namespace is specified, a
ReferenceGrant object is required in the referent namespace to allow that
namespace's owner to accept the reference. See the ReferenceGrant
documentation for details.

<gateway:experimental:description>

When the BackendRef points to a Kubernetes Service, implementations SHOULD
honor the appProtocol field if it is set for the target Service Port.

Implementations supporting appProtocol SHOULD recognize the Kubernetes
Standard Application Protocols defined in KEP-3726.

If a Service appProtocol isn't specified, an implementation MAY infer the
backend protocol through its own means. Implementations MAY infer the
protocol from the Route type referring to the backend Service.

If a Route is not able to send traffic to the backend using the specified
protocol then the backend is considered invalid. Implementations MUST set the
"ResolvedRefs" condition to "False" with the "UnsupportedProtocol" reason.

</gateway:experimental:description>
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Filters | [][HTTPRouteFilter](#http-route-filter)| `[]*HTTPRouteFilter` |  | | Filters defined at this level should be executed if and only if the</br>request is being forwarded to the backend defined here.</br></br>Support: Implementation-specific (For broader support of filters, use the</br>Filters field in HTTPRouteRule.) |  |
| Port | int32 (formatted integer)| `int32` |  | | Port specifies the destination port number to use for this resource.</br>Port is required when the referent is a Kubernetes Service. In this</br>case, the port number is the service port number, not the target port.</br>For other resources, destination port might be derived from the referent</br>resource or this field. |  |
| Weight | int32 (formatted integer)| `int32` |  | | Weight specifies the proportion of requests forwarded to the referenced</br>backend. This is computed as weight/(sum of all weights in this</br>BackendRefs list). For non-zero values, there may be some epsilon from</br>the exact proportion defined here depending on the precision an</br>implementation supports. Weight is not a percentage and the sum of</br>weights does not need to equal 100.</br></br>If only one backend is specified and it has a weight greater than 0, 100%</br>of the traffic is forwarded to that backend. If weight is set to 0, no</br>traffic should be forwarded for this entry. If unspecified, weight</br>defaults to 1.</br></br>Support for this field varies based on the context where used. |  |
| group | [ApisV1Group](#apis-v1-group)| `ApisV1Group` |  | |  |  |
| kind | [ApisV1Kind](#apis-v1-kind)| `ApisV1Kind` |  | |  |  |
| name | [ApisV1ObjectName](#apis-v1-object-name)| `ApisV1ObjectName` |  | |  |  |
| namespace | [ApisV1Namespace](#apis-v1-namespace)| `ApisV1Namespace` |  | |  |  |



### <span id="http-body"></span> HTTPBody


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Specifier | [IsHTTPBodySpecifier](#is-http-body-specifier)| `IsHTTPBodySpecifier` |  | |  |  |



### <span id="http-c-o-r-s-filter"></span> HTTPCORSFilter


> HTTPCORSFilter defines a filter that that configures Cross-Origin Request
Sharing (CORS).
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| AllowCredentials | boolean| `bool` |  | | AllowCredentials indicates whether the actual cross-origin request allows</br>to include credentials.</br></br>When set to true, the gateway will include the `Access-Control-Allow-Credentials`</br>response header with value true (case-sensitive).</br></br>When set to false or omitted the gateway will omit the header</br>`Access-Control-Allow-Credentials` entirely (this is the standard CORS</br>behavior).</br></br>Support: Extended |  |
| AllowHeaders | [][HTTPHeaderName](#http-header-name)| `[]HTTPHeaderName` |  | | AllowHeaders indicates which HTTP request headers are supported for</br>accessing the requested resource.</br></br>Header names are not case-sensitive.</br></br>Multiple header names in the value of the `Access-Control-Allow-Headers`</br>response header are separated by a comma (",").</br></br>When the `allowHeaders` field is configured with one or more headers, the</br>gateway must return the `Access-Control-Allow-Headers` response header</br>which value is present in the `allowHeaders` field.</br></br>If any header name in the `Access-Control-Request-Headers` request header</br>is not included in the list of header names specified by the response</br>header `Access-Control-Allow-Headers`, it will present an error on the</br>client side.</br></br>If any header name in the `Access-Control-Allow-Headers` response header</br>does not recognize by the client, it will also occur an error on the</br>client side.</br></br>A wildcard indicates that the requests with all HTTP headers are allowed.</br></br>If the configuration contains the wildcard `*` in `allowHeaders` and</br>`allowCredentials` is set to `false`, the `Access-Control-Allow-Headers`</br>response header may either contain the wildcard `*` or echo the value</br>of the `Access-Control-Request-Headers` request header.</br></br>If the configuration contains the wildcard `*` in `allowHeaders` and</br>`allowCredentials` is set to `true`, the gateway must not return `*`</br>in the `Access-Control-Allow-Headers` response header. Instead, it must</br>return one or more header names matching the value of the</br>`Access-Control-Request-Headers` request header.</br>If the `Access-Control-Request-Headers` header is not present in the</br>request, the gateway must omit the `Access-Control-Allow-Headers`</br>response header.</br></br>Support: Extended |  |
| AllowMethods | [][HTTPMethodWithWildcard](#http-method-with-wildcard)| `[]HTTPMethodWithWildcard` |  | | AllowMethods indicates which HTTP methods are supported for accessing the</br>requested resource.</br></br>Valid values are any method defined by RFC9110, along with the special</br>value `*`, which represents all HTTP methods are allowed.</br></br>Method names are case-sensitive, so these values are also case-sensitive.</br>(See https://www.rfc-editor.org/rfc/rfc2616#section-5.1.1)</br></br>Multiple method names in the value of the `Access-Control-Allow-Methods`</br>response header are separated by a comma (",").</br></br>A CORS-safelisted method is a method that is `GET`, `HEAD`, or `POST`.</br>(See https://fetch.spec.whatwg.org/#cors-safelisted-method) The</br>CORS-safelisted methods are always allowed, regardless of whether they</br>are specified in the `allowMethods` field.</br></br>When the `allowMethods` field is configured with one or more methods, the</br>gateway must return the `Access-Control-Allow-Methods` response header</br>which value is present in the `allowMethods` field.</br></br>If the HTTP method of the `Access-Control-Request-Method` request header</br>is not included in the list of methods specified by the response header</br>`Access-Control-Allow-Methods`, it will present an error on the client</br>side.</br></br>If the configuration contains the wildcard `*` in `allowMethods` and</br>`allowCredentials` is set to `false`, the `Access-Control-Allow-Methods`</br>response header may either contain the wildcard `*` or echo the value</br>of the `Access-Control-Request-Method` request header.</br></br>If the configuration contains the wildcard `*` in `allowMethods` and</br>`allowCredentials` is set to `true`, the gateway must not return `*`</br>in the `Access-Control-Allow-Methods` response header. Instead, it must</br>return a single HTTP method matching the value of the</br>`Access-Control-Request-Method` request header.</br>If the `Access-Control-Request-Method` header is not present in the request,</br>the gateway must omit the `Access-Control-Allow-Methods` response header.</br></br>Support: Extended |  |
| AllowOrigins | [][CORSOrigin](#c-o-r-s-origin)| `[]CORSOrigin` |  | | AllowOrigins indicates whether the response can be shared with requested</br>resource from the given `Origin`.</br></br>The `Origin` consists of a scheme and a host, with an optional port, and</br>takes the form `<scheme>://<host>(:<port>)`.</br></br>Valid values for scheme are: `http` and `https`.</br></br>Valid values for port are any integer between 1 and 65535 (the list of</br>available TCP/UDP ports). Note that, if not included, port `80` is</br>assumed for `http` scheme origins, and port `443` is assumed for `https`</br>origins. This may affect origin matching.</br></br>The host part of the origin may contain the wildcard character `*`. These</br>wildcard characters behave as follows:</br></br>- `*` is a greedy match to the _left_, including any number of</br>DNS labels to the left of its position. This also means that</br>`*` will include any number of period `.` characters to the</br>left of its position.</br>- A wildcard by itself matches all hosts.</br></br>An origin value that includes _only_ the `*` character indicates requests</br>from all `Origin`s are allowed.</br></br>When the `allowOrigins` field is configured with multiple origins, it</br>means the server supports clients from multiple origins. If the request</br>`Origin` matches the configured allowed origins, the gateway must return</br>the given `Origin` and sets value of the header</br>`Access-Control-Allow-Origin` same as the `Origin` header provided by the</br>client.</br></br>The status code of a successful response to a "preflight" request is</br>always an OK status (i.e., 204 or 200).</br></br>If the request `Origin` does not match the configured allowed origins,</br>the gateway returns 204/200 response but doesn't set the relevant</br>cross-origin response headers. Alternatively, the gateway responds with</br>403 status to the "preflight" request is denied, coupled with omitting</br>the CORS headers. The cross-origin request fails on the client side.</br>Therefore, the client doesn't attempt the actual cross-origin request.</br></br>Conversely, if the request `Origin` matches one of the configured</br>allowed origins, the gateway sets the response header</br>`Access-Control-Allow-Origin` to the same value as the `Origin`</br>header provided by the client.</br></br>If the configuration contains the wildcard `*` in `allowOrigins` and</br>`allowCredentials` is set to `false`, the `Access-Control-Allow-Origin`</br>response header may either contain the wildcard `*` or echo the value</br>of the `Origin` request header.</br></br>If the configuration contains the wildcard `*` in `allowOrigins` and</br>`allowCredentials` is set to `true`, the gateway must not return `*`</br>in the `Access-Control-Allow-Origin` response header. Instead, it must</br>return a single origin matching the value of the `Origin` request header.</br></br>Support: Extended |  |
| ExposeHeaders | [][HTTPHeaderName](#http-header-name)| `[]HTTPHeaderName` |  | | ExposeHeaders indicates which HTTP response headers can be exposed</br>to client-side scripts in response to a cross-origin request.</br></br>A CORS-safelisted response header is an HTTP header in a CORS response</br>that it is considered safe to expose to the client scripts.</br>The CORS-safelisted response headers include the following headers:</br>`Cache-Control`</br>`Content-Language`</br>`Content-Length`</br>`Content-Type`</br>`Expires`</br>`Last-Modified`</br>`Pragma`</br>(See https://fetch.spec.whatwg.org/#cors-safelisted-response-header-name)</br>The CORS-safelisted response headers are exposed to client by default.</br></br>When an HTTP header name is specified using the `exposeHeaders` field,</br>this additional header will be exposed as part of the response to the</br>client.</br></br>Header names are not case-sensitive.</br></br>Multiple header names in the value of the `Access-Control-Expose-Headers`</br>response header are separated by a comma (",").</br></br>A wildcard indicates that the responses with all HTTP headers are exposed</br>to clients.</br></br>If the configuration contains the wildcard `*` in `exposeHeaders` and</br>`allowCredentials` is set to `false`, the `Access-Control-Expose-Headers`</br>response header can contain the wildcard `*`.</br></br>If the configuration contains the wildcard `*` in `exposeHeaders` and</br>`allowCredentials` is set to `true`, the gateway cannot use the `*`</br>in the `Access-Control-Expose-Headers` response header.</br></br>Support: Extended |  |
| MaxAge | int32 (formatted integer)| `int32` |  | | MaxAge indicates the duration (in seconds) for the client to cache the</br>results of a "preflight" request.</br></br>The information provided by the `Access-Control-Allow-Methods` and</br>`Access-Control-Allow-Headers` response headers can be cached by the</br>client until the time specified by `Access-Control-Max-Age` elapses.</br></br>The default value of `Access-Control-Max-Age` response header is 5</br>(seconds).</br></br>When the `MaxAge` field is unspecified, the gateway sets the response</br>header "Access-Control-Max-Age: 5" by default. |  |



### <span id="http-direct-response"></span> HTTPDirectResponse


> ```yaml
apiVersion: networking.istio.io/v1
kind: VirtualService
metadata:


spec:

hosts:
- ratings.prod.svc.cluster.local
http:
- match:
- uri:
exact: /v1/getProductRatings
directResponse:
status: 503
body:
string: "unknown error"
...

```

It is also possible to specify a binary response body.
This is mostly useful for non text-based protocols such as gRPC.

```yaml
apiVersion: networking.istio.io/v1
kind: VirtualService
metadata:


spec:

hosts:
- ratings.prod.svc.cluster.local
http:
- match:
- uri:
exact: /v1/getProductRatings
directResponse:
status: 503
body:
bytes: "dW5rbm93biBlcnJvcg==" # "unknown error" in base64
...

```

It is good practice to add headers in the HTTPRoute
as well as the direct_response, for example to specify
the returned Content-Type.

```yaml
apiVersion: networking.istio.io/v1
kind: VirtualService
metadata:


spec:

hosts:
- ratings.prod.svc.cluster.local
http:
- match:
- uri:
exact: /v1/getProductRatings
directResponse:
status: 503
body:
string: "{\"error\": \"unknown error\"}"
headers:
response:
set:
content-type: "text/plain"
...

```
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Status | uint32 (formatted integer)| `uint32` |  | | Specifies the HTTP response status to be returned. |  |
| body | [HTTPBody](#http-body)| `HTTPBody` |  | |  |  |



### <span id="http-external-auth-filter"></span> HTTPExternalAuthFilter


> Support: Extended
Feature Name: HTTPRouteExternalAuth
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| backendRef | [BackendObjectReference](#backend-object-reference)| `BackendObjectReference` |  | |  |  |
| forwardBody | [ForwardBodyConfig](#forward-body-config)| `ForwardBodyConfig` |  | |  |  |
| grpc | [GRPCAuthConfig](#g-rpc-auth-config)| `GRPCAuthConfig` |  | |  |  |
| http | [HTTPAuthConfig](#http-auth-config)| `HTTPAuthConfig` |  | |  |  |
| protocol | [HTTPRouteExternalAuthProtocol](#http-route-external-auth-protocol)| `HTTPRouteExternalAuthProtocol` |  | |  |  |



### <span id="http-fault-injection"></span> HTTPFaultInjection


> *Note:* Delay and abort faults are independent of one another, even if
both are specified simultaneously.
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| abort | [HTTPFaultInjectionAbort](#http-fault-injection-abort)| `HTTPFaultInjectionAbort` |  | |  |  |
| delay | [HTTPFaultInjectionDelay](#http-fault-injection-delay)| `HTTPFaultInjectionDelay` |  | |  |  |



### <span id="http-fault-injection-abort"></span> HTTPFaultInjection_Abort


> ```yaml
apiVersion: networking.istio.io/v1
kind: VirtualService
metadata:


spec:

hosts:
- ratings.prod.svc.cluster.local
http:
- route:
- destination:
subset: v1
fault:
abort:
percentage:
value: 0.1
httpStatus: 400

```

The _httpStatus_ field is used to indicate the HTTP status code to
return to the caller. The optional _percentage_ field can be used to only
abort a certain percentage of requests. If not specified, no request will be
aborted.
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| ErrorType | [IsHTTPFaultInjectionAbortErrorType](#is-http-fault-injection-abort-error-type)| `IsHTTPFaultInjectionAbortErrorType` |  | |  |  |
| percentage | [Percent](#percent)| `Percent` |  | |  |  |



### <span id="http-fault-injection-delay"></span> HTTPFaultInjection_Delay


> ```yaml
apiVersion: networking.istio.io/v1
kind: VirtualService
metadata:


spec:

hosts:
- reviews.prod.svc.cluster.local
http:
- match:
- sourceLabels:
env: prod
route:
- destination:
subset: v1
fault:
delay:
percentage:
value: 0.1
fixedDelay: 5s

```

The _fixedDelay_ field is used to indicate the amount of delay in seconds.
The optional _percentage_ field can be used to only delay a certain
percentage of requests. If left unspecified, no request will be delayed.
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| HttpDelayType | [IsHTTPFaultInjectionDelayHTTPDelayType](#is-http-fault-injection-delay-http-delay-type)| `IsHTTPFaultInjectionDelayHTTPDelayType` |  | |  |  |
| Percent | int32 (formatted integer)| `int32` |  | | Percentage of requests on which the delay will be injected (0-100).</br>Use of integer `percent` value is deprecated. Use the double `percentage`</br>field instead.</br></br>Deprecated: Marked as deprecated in networking/v1alpha3/virtual_service.proto. |  |
| percentage | [Percent](#percent)| `Percent` |  | |  |  |



### <span id="http-header"></span> HTTPHeader


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Value | string| `string` |  | | Value is the value of HTTP Header to be matched.</br><gateway:experimental:description></br>Must consist of printable US-ASCII characters, optionally separated</br>by single tabs or spaces. See: https://tools.ietf.org/html/rfc7230#section-3.2</br></gateway:experimental:description></br></br><gateway:experimental:validation:Pattern=`^[!-~]+([\t ]?[!-~]+)*$`> |  |
| name | [HTTPHeaderName](#http-header-name)| `HTTPHeaderName` |  | |  |  |



### <span id="http-header-filter"></span> HTTPHeaderFilter


> HTTPHeaderFilter defines a filter that modifies the headers of an HTTP
request or response. Only one action for a given header name is
permitted. Filters specifying multiple actions of the same or different
type for any one header name are invalid. Configuration to set or add
multiple values for a header must use RFC 7230 header value formatting,
separating each value with a comma.
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Add | [][HTTPHeader](#http-header)| `[]*HTTPHeader` |  | | Add adds the given header(s) (name, value) to the request</br>before the action. It appends to any existing values associated</br>with the header name.</br></br>Input:</br>GET /foo HTTP/1.1</br>my-header: foo</br></br>Config:</br>add:</br>- name: "my-header"</br>value: "bar,baz"</br></br>Output:</br>GET /foo HTTP/1.1</br>my-header: foo,bar,baz |  |
| Remove | []string| `[]string` |  | | Remove the given header(s) from the HTTP request before the action. The</br>value of Remove is a list of HTTP header names. Note that the header</br>names are case-insensitive (see</br>https://datatracker.ietf.org/doc/html/rfc2616#section-4.2).</br></br>Input:</br>GET /foo HTTP/1.1</br>my-header1: foo</br>my-header2: bar</br>my-header3: baz</br></br>Config:</br>remove: ["my-header1", "my-header3"]</br></br>Output:</br>GET /foo HTTP/1.1</br>my-header2: bar |  |
| Set | [][HTTPHeader](#http-header)| `[]*HTTPHeader` |  | | Set overwrites the request with the given header (name, value)</br>before the action.</br></br>Input:</br>GET /foo HTTP/1.1</br>my-header: foo</br></br>Config:</br>set:</br>- name: "my-header"</br>value: "bar"</br></br>Output:</br>GET /foo HTTP/1.1</br>my-header: bar |  |



### <span id="http-header-match"></span> HTTPHeaderMatch


> HTTPHeaderMatch describes how to select a HTTP route by matching HTTP request
headers.
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Value | string| `string` |  | | Value is the value of HTTP Header to be matched.</br><gateway:experimental:description></br>Must consist of printable US-ASCII characters, optionally separated</br>by single tabs or spaces. See: https://tools.ietf.org/html/rfc7230#section-3.2</br></gateway:experimental:description></br></br><gateway:experimental:validation:Pattern=`^[!-~]+([\t ]?[!-~]+)*$`> |  |
| name | [HTTPHeaderName](#http-header-name)| `HTTPHeaderName` |  | |  |  |
| type | [HeaderMatchType](#header-match-type)| `HeaderMatchType` |  | |  |  |



### <span id="http-header-name"></span> HTTPHeaderName


  

[HeaderName](#header-name)

#### Inlined models

### <span id="http-match-request"></span> HTTPMatchRequest


> ```yaml
apiVersion: networking.istio.io/v1
kind: VirtualService
metadata:


spec:

hosts:
- ratings.prod.svc.cluster.local
http:
- match:
- headers:
end-user:
exact: jason
uri:
prefix: "/ratings/v2/"
ignoreUriCase: true
route:
- destination:

```

HTTPMatchRequest CANNOT be empty.
**Note:**
1. If a root VirtualService have matched any property (path, header etc.) by regex, delegate VirtualServices should not have any other matches on the same property.
2. If a delegate VirtualService have matched any property (path, header etc.) by regex, root VirtualServices should not have any other matches on the same property.
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Gateways | []string| `[]string` |  | | Names of gateways where the rule should be applied. Gateway names</br>in the top-level `gateways` field of the VirtualService (if any) are overridden. The gateway</br>match is independent of sourceLabels. |  |
| Headers | map of [StringMatch](#string-match)| `map[string]StringMatch` |  | | The header keys must be lowercase and use hyphen as the separator,</br>e.g. _x-request-id_.</br></br>Header values are case-sensitive and formatted as follows:</br></br>- `exact: "value"` for exact string match</br></br>- `prefix: "value"` for prefix-based match</br></br>- `regex: "value"` for [RE2 style regex-based match](https://github.com/google/re2/wiki/Syntax).</br></br>If the value is empty and only the name of header is specified, presence of the header is checked.</br>To provide an empty value, use `{}`, for example:</br></br>```</br>- match:</br>- headers:</br>myheader: {}</br></br>```</br>**Note:** The keys `uri`, `scheme`, `method`, and `authority` will be ignored. |  |
| IgnoreUriCase | boolean| `bool` |  | | Flag to specify whether the URI matching should be case-insensitive.</br></br>**Note:** The case will be ignored only in the case of `exact` and `prefix`</br>URI matches. |  |
| Name | string| `string` |  | | The name assigned to a match. The match's name will be</br>concatenated with the parent route's name and will be logged in</br>the access logs for requests matching this route. |  |
| Port | uint32 (formatted integer)| `uint32` |  | | Specifies the ports on the host that is being addressed. Many services</br>only expose a single port or label ports with the protocols they support,</br>in these cases it is not required to explicitly select the port. |  |
| QueryParams | map of [StringMatch](#string-match)| `map[string]StringMatch` |  | | Query parameters for matching.</br></br>Ex:</br></br>- For a query parameter like "?key=true", the map key would be "key" and</br>the string match could be defined as `exact: "true"`.</br></br>- For a query parameter like "?key", the map key would be "key" and the</br>string match could be defined as `exact: ""`.</br></br>- For a query parameter like "?key=abc" or "?key=abx", the map key would be "key" and the</br>string match could be defined as `prefix: "ab"`.</br></br>- For a query parameter like "?key=123", the map key would be "key" and the</br>string match could be defined as `regex: "\d+$"`. Note that this</br>configuration will only match values like "123" but not "a123" or "123a". |  |
| SourceLabels | map of string| `map[string]string` |  | | One or more labels that constrain the applicability of a rule to source (client) workloads</br>with the given labels. If the VirtualService has a list of gateways specified</br>in the top-level `gateways` field, it must include the reserved gateway</br>`mesh` for this field to be applicable.</br></br>**Note:** This is not a runtime match, but is a selector; it filters which workloads the</br>VirtualService applies to. |  |
| SourceNamespace | string| `string` |  | | Source namespace constraining the applicability of a rule to workloads in that namespace.</br>If the VirtualService has a list of gateways specified in the top-level `gateways` field,</br>it must include the reserved gateway `mesh` for this field to be applicable.</br></br>**Note:** This is not a runtime match, but is a selector; it filters which workloads the</br>VirtualService applies to. |  |
| StatPrefix | string| `string` |  | | The human readable prefix to use when emitting statistics for this route.</br>The statistics are generated with prefix route.<stat_prefix>.</br>This should be set for highly critical routes that one wishes to get "per-route" statistics on.</br>This prefix is only for proxy-level statistics (envoy_*) and not service-level (istio_*) statistics.</br>Refer to https://www.envoyproxy.io/docs/envoy/latest/api-v3/config/route/v3/route_components.proto#envoy-v3-api-field-config-route-v3-route-stat-prefix</br>for statistics that are generated when this is configured. |  |
| WithoutHeaders | map of [StringMatch](#string-match)| `map[string]StringMatch` |  | | withoutHeader has the same syntax with the header, but has opposite meaning.</br>If a header is matched with a matching rule among withoutHeader, the traffic becomes not matched one. |  |
| authority | [StringMatch](#string-match)| `StringMatch` |  | |  |  |
| method | [StringMatch](#string-match)| `StringMatch` |  | |  |  |
| scheme | [StringMatch](#string-match)| `StringMatch` |  | |  |  |
| uri | [StringMatch](#string-match)| `StringMatch` |  | |  |  |



### <span id="http-method"></span> HTTPMethod


> Note that values may be added to this enum, implementations
must ensure that unknown values will not cause a crash.

Unknown values here must result in the implementation setting the
Accepted Condition for the Route to `status: False`, with a
Reason of `UnsupportedValue`.
  



| Name | Type | Go type | Default | Description | Example |
|------|------|---------| ------- |-------------|---------|
| HTTPMethod | string| string | | Note that values may be added to this enum, implementations</br>must ensure that unknown values will not cause a crash.</br></br>Unknown values here must result in the implementation setting the</br>Accepted Condition for the Route to `status: False`, with a</br>Reason of `UnsupportedValue`. |  |



### <span id="http-method-with-wildcard"></span> HTTPMethodWithWildcard


  

| Name | Type | Go type | Default | Description | Example |
|------|------|---------| ------- |-------------|---------|
| HTTPMethodWithWildcard | string| string | |  |  |



### <span id="http-mirror-policy"></span> HTTPMirrorPolicy


> HTTPMirrorPolicy can be used to specify the destinations to mirror HTTP traffic in addition
to the original destination. Mirrored traffic is on a
best effort basis where the sidecar/gateway will not wait for the
mirrored destinations to respond before returning the response from the
original destination. Statistics will be generated for the mirrored
destination.
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| destination | [Destination](#destination)| `Destination` |  | |  |  |
| percentage | [Percent](#percent)| `Percent` |  | |  |  |



### <span id="http-path-match"></span> HTTPPathMatch


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Value | string| `string` |  | | Value of the HTTP path to match against. |  |
| type | [PathMatchType](#path-match-type)| `PathMatchType` |  | |  |  |



### <span id="http-path-modifier"></span> HTTPPathModifier


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| ReplaceFullPath | string| `string` |  | | ReplaceFullPath specifies the value with which to replace the full path</br>of a request during a rewrite or redirect. |  |
| ReplacePrefixMatch | string| `string` |  | | ReplacePrefixMatch specifies the value with which to replace the prefix</br>match of a request during a rewrite or redirect. For example, a request</br>to "/foo/bar" with a prefix match of "/foo" and a ReplacePrefixMatch</br>of "/xyz" would be modified to "/xyz/bar".</br></br>Note that this matches the behavior of the PathPrefix match type. This</br>matches full path elements. A path element refers to the list of labels</br>in the path split by the `/` separator. When specified, a trailing `/` is</br>ignored. For example, the paths `/abc`, `/abc/`, and `/abc/def` would all</br>match the prefix `/abc`, but the path `/abcd` would not.</br></br>ReplacePrefixMatch is only compatible with a `PathPrefix` HTTPRouteMatch.</br>Using any other HTTPRouteMatch type on the same HTTPRouteRule will result in</br>the implementation setting the Accepted Condition for the Route to `status: False`.</br></br>Request Path | Prefix Match | Replace Prefix | Modified Path</br>-------------|--------------|----------------|----------</br>foo/bar     | /foo         | /xyz           | /xyz/bar</br>foo/bar     | /foo         | /xyz/          | /xyz/bar</br>foo/bar     | /foo/        | /xyz           | /xyz/bar</br>foo/bar     | /foo/        | /xyz/          | /xyz/bar</br>foo         | /foo         | /xyz           | /xyz</br>foo/        | /foo         | /xyz           | /xyz/</br>foo/bar     | /foo         | <empty string> | /bar</br>foo/        | /foo         | <empty string> | /</br>foo         | /foo         | <empty string> | /</br>foo/        | /foo         | /              | /</br>foo         | /foo         | /              | / |  |
| type | [HTTPPathModifierType](#http-path-modifier-type)| `HTTPPathModifierType` |  | |  |  |



### <span id="http-path-modifier-type"></span> HTTPPathModifierType


  

| Name | Type | Go type | Default | Description | Example |
|------|------|---------| ------- |-------------|---------|
| HTTPPathModifierType | string| string | |  |  |



### <span id="http-query-param-match"></span> HTTPQueryParamMatch


> HTTPQueryParamMatch describes how to select a HTTP route by matching HTTP
query parameters.
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Value | string| `string` |  | | Value is the value of HTTP query param to be matched. |  |
| name | [HTTPHeaderName](#http-header-name)| `HTTPHeaderName` |  | |  |  |
| type | [QueryParamMatchType](#query-param-match-type)| `QueryParamMatchType` |  | |  |  |



### <span id="http-redirect"></span> HTTPRedirect


> ```yaml
apiVersion: networking.istio.io/v1
kind: VirtualService
metadata:


spec:

hosts:
- ratings.prod.svc.cluster.local
http:
- match:
- uri:
exact: /v1/getProductRatings
redirect:
uri: /v1/bookRatings
authority: newratings.default.svc.cluster.local
...

```
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Authority | string| `string` |  | | On a redirect, overwrite the Authority/Host portion of the URL with</br>this value. |  |
| RedirectCode | uint32 (formatted integer)| `uint32` |  | | On a redirect, Specifies the HTTP status code to use in the redirect</br>response. The default response code is MOVED_PERMANENTLY (301). |  |
| RedirectPort | [IsHTTPRedirectRedirectPort](#is-http-redirect-redirect-port)| `IsHTTPRedirectRedirectPort` |  | |  |  |
| Scheme | string| `string` |  | | On a redirect, overwrite the scheme portion of the URL with this value.</br>For example, `http` or `https`.</br>If unset, the original scheme will be used.</br>If `derivePort` is set to `FROM_PROTOCOL_DEFAULT`, this will impact the port used as well |  |
| Uri | string| `string` |  | | On a redirect, overwrite the Path portion of the URL with this</br>value. Note that the entire path will be replaced, irrespective of the</br>request URI being matched as an exact path or prefix. |  |



### <span id="http-request-mirror-filter"></span> HTTPRequestMirrorFilter


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Percent | int32 (formatted integer)| `int32` |  | | Percent represents the percentage of requests that should be</br>mirrored to BackendRef. Its minimum value is 0 (indicating 0% of</br>requests) and its maximum value is 100 (indicating 100% of requests).</br></br>Only one of Fraction or Percent may be specified. If neither field</br>is specified, 100% of requests will be mirrored. |  |
| backendRef | [BackendObjectReference](#backend-object-reference)| `BackendObjectReference` |  | |  |  |
| fraction | [Fraction](#fraction)| `Fraction` |  | |  |  |



### <span id="http-request-redirect-filter"></span> HTTPRequestRedirectFilter


> HTTPRequestRedirect defines a filter that redirects a request. This filter
MUST NOT be used on the same Route rule as a HTTPURLRewrite filter.
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Port | int32 (formatted integer)| `int32` |  | | Port is the port to be used in the value of the `Location`</br>header in the response.</br></br>If no port is specified, the redirect port MUST be derived using the</br>following rules:</br></br>- If redirect scheme is not-empty, the redirect port MUST be the well-known</br>port associated with the redirect scheme. Specifically "http" to port 80</br>and "https" to port 443. If the redirect scheme does not have a</br>well-known port, the listener port of the Gateway SHOULD be used.</br>- If redirect scheme is empty, the redirect port MUST be the Gateway</br>Listener port.</br></br>Implementations SHOULD NOT add the port number in the 'Location'</br>header in the following cases:</br></br>- A Location header that will use HTTP (whether that is determined via</br>the Listener protocol or the Scheme field) _and_ use port 80.</br>- A Location header that will use HTTPS (whether that is determined via</br>the Listener protocol or the Scheme field) _and_ use port 443.</br></br>Support: Extended |  |
| Scheme | string| `string` |  | | Scheme is the scheme to be used in the value of the `Location` header in</br>the response. When empty, the scheme of the request is used.</br></br>Scheme redirects can affect the port of the redirect, for more information,</br>refer to the documentation for the port field of this filter.</br></br>Note that values may be added to this enum, implementations</br>must ensure that unknown values will not cause a crash.</br></br>Unknown values here must result in the implementation setting the</br>Accepted Condition for the Route to `status: False`, with a</br>Reason of `UnsupportedValue`.</br></br>Support: Extended |  |
| StatusCode | int64 (formatted integer)| `int64` |  | | StatusCode is the HTTP status code to be used in response.</br></br>Note that values may be added to this enum, implementations</br>must ensure that unknown values will not cause a crash.</br></br>Unknown values here must result in the implementation setting the</br>Accepted Condition for the Route to `status: False`, with a</br>Reason of `UnsupportedValue`.</br></br>Support: Core |  |
| hostname | [PreciseHostname](#precise-hostname)| `PreciseHostname` |  | |  |  |
| path | [HTTPPathModifier](#http-path-modifier)| `HTTPPathModifier` |  | |  |  |



### <span id="http-retry"></span> HTTPRetry


> ```yaml
apiVersion: networking.istio.io/v1
kind: VirtualService
metadata:


spec:

hosts:
- ratings.prod.svc.cluster.local
http:
- route:
- destination:
subset: v1
retries:
attempts: 3
perTryTimeout: 2s
retryOn: gateway-error,connect-failure,refused-stream

```
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Attempts | int32 (formatted integer)| `int32` |  | | Number of retries to be allowed for a given request. The interval</br>between retries will be determined automatically (25ms+). When request</br>`timeout` of the [HTTP route](https://istio.io/docs/reference/config/networking/virtual-service/#HTTPRoute)</br>or `per_try_timeout` is configured, the actual number of retries attempted also depends on</br>the specified request `timeout` and `per_try_timeout` values. MUST be >= 0. If `0`, retries will be disabled.</br>The maximum possible number of requests made will be 1 + `attempts`. |  |
| RetryOn | string| `string` |  | | Specifies the conditions under which retry takes place.</br>One or more policies can be specified using a ‘,’ delimited list.</br>See the [retry policies](https://www.envoyproxy.io/docs/envoy/latest/configuration/http/http_filters/router_filter#x-envoy-retry-on)</br>and [gRPC retry policies](https://www.envoyproxy.io/docs/envoy/latest/configuration/http/http_filters/router_filter#x-envoy-retry-grpc-on) for more details.</br></br>In addition to the policies specified above, a list of HTTP status codes can be passed, such as `retryOn: "503,reset"`.</br>Note these status codes refer to the actual responses received from the destination.</br>For example, if a connection is reset, Istio will translate this to 503 for it's response.</br>However, the destination did not return a 503 error, so this would not match `"503"` (it would, however, match `"reset"`).</br></br>If not specified, this defaults to `connect-failure,refused-stream,unavailable,cancelled`. |  |
| backoff | [DurationpbDuration](#durationpb-duration)| `DurationpbDuration` |  | |  |  |
| per_try_timeout | [DurationpbDuration](#durationpb-duration)| `DurationpbDuration` |  | |  |  |
| retry_ignore_previous_hosts | [BoolValue](#bool-value)| `BoolValue` |  | |  |  |
| retry_remote_localities | [BoolValue](#bool-value)| `BoolValue` |  | |  |  |



### <span id="http-rewrite"></span> HTTPRewrite


> ```yaml
apiVersion: networking.istio.io/v1
kind: VirtualService
metadata:


spec:

hosts:
- ratings.prod.svc.cluster.local
http:
- match:
- uri:
prefix: /ratings
rewrite:
uri: /v1/bookRatings
route:
- destination:
subset: v1

```
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Authority | string| `string` |  | | rewrite the Authority/Host header with this value. |  |
| Uri | string| `string` |  | | rewrite the path (or the prefix) portion of the URI with this</br>value. If the original URI was matched based on prefix, the value</br>provided in this field will replace the corresponding matched prefix. |  |
| uri_regex_rewrite | [RegexRewrite](#regex-rewrite)| `RegexRewrite` |  | |  |  |



### <span id="http-route-destination"></span> HTTPRouteDestination


> ```yaml
apiVersion: networking.istio.io/v1
kind: VirtualService
metadata:


spec:

hosts:
- reviews.prod.svc.cluster.local
http:
- route:
- destination:
subset: v2
weight: 25
- destination:
subset: v1
weight: 75

```

# And the associated DestinationRule

```yaml
apiVersion: networking.istio.io/v1
kind: DestinationRule
metadata:


spec:

subsets:
- name: v1
labels:
- name: v2
labels:

```

Traffic can also be split across two entirely different services without
having to define new subsets. For example, the following rule forwards 25% of
traffic to reviews.com to dev.reviews.com

```yaml
apiVersion: networking.istio.io/v1
kind: VirtualService
metadata:


spec:

hosts:
- reviews.com
http:
- route:
- destination:
weight: 25
- destination:
weight: 75

```
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Weight | int32 (formatted integer)| `int32` |  | | Weight specifies the relative proportion of traffic to be forwarded to the destination. A destination will receive `weight/(sum of all weights)` requests.</br>If there is only one destination in a rule, it will receive all traffic.</br>Otherwise, if weight is `0`, the destination will not receive any traffic. |  |
| destination | [Destination](#destination)| `Destination` |  | |  |  |
| headers | [Headers](#headers)| `Headers` |  | |  |  |



### <span id="http-route-external-auth-protocol"></span> HTTPRouteExternalAuthProtocol


> Valid values are supplied as constants below.
  



| Name | Type | Go type | Default | Description | Example |
|------|------|---------| ------- |-------------|---------|
| HTTPRouteExternalAuthProtocol | string| string | | Valid values are supplied as constants below. |  |



### <span id="http-route-filter"></span> HTTPRouteFilter


> <gateway:experimental:validation:XValidation:message="filter.externalAuth must be nil if the filter.type is not ExternalAuth",rule="!(has(self.externalAuth) && self.type != 'ExternalAuth')">
<gateway:experimental:validation:XValidation:message="filter.externalAuth must be specified for ExternalAuth filter.type",rule="!(!has(self.externalAuth) && self.type == 'ExternalAuth')">
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| cors | [HTTPCORSFilter](#http-c-o-r-s-filter)| `HTTPCORSFilter` |  | |  |  |
| extensionRef | [LocalObjectReference](#local-object-reference)| `LocalObjectReference` |  | |  |  |
| externalAuth | [HTTPExternalAuthFilter](#http-external-auth-filter)| `HTTPExternalAuthFilter` |  | |  |  |
| requestHeaderModifier | [HTTPHeaderFilter](#http-header-filter)| `HTTPHeaderFilter` |  | |  |  |
| requestMirror | [HTTPRequestMirrorFilter](#http-request-mirror-filter)| `HTTPRequestMirrorFilter` |  | |  |  |
| requestRedirect | [HTTPRequestRedirectFilter](#http-request-redirect-filter)| `HTTPRequestRedirectFilter` |  | |  |  |
| responseHeaderModifier | [HTTPHeaderFilter](#http-header-filter)| `HTTPHeaderFilter` |  | |  |  |
| type | [HTTPRouteFilterType](#http-route-filter-type)| `HTTPRouteFilterType` |  | |  |  |
| urlRewrite | [HTTPURLRewriteFilter](#http-url-rewrite-filter)| `HTTPURLRewriteFilter` |  | |  |  |



### <span id="http-route-filter-type"></span> HTTPRouteFilterType


  

| Name | Type | Go type | Default | Description | Example |
|------|------|---------| ------- |-------------|---------|
| HTTPRouteFilterType | string| string | |  |  |



### <span id="http-route-match"></span> HTTPRouteMatch


> For example, the match below will match a HTTP request only if its path
starts with `/foo` AND it contains the `version: v1` header:

```
match:

path:
value: "/foo"
headers:
- name: "version"
value "v1"

```
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Headers | [][HTTPHeaderMatch](#http-header-match)| `[]*HTTPHeaderMatch` |  | | Headers specifies HTTP request header matchers. Multiple match values are</br>ANDed together, meaning, a request must match all the specified headers</br>to select the route. |  |
| QueryParams | [][HTTPQueryParamMatch](#http-query-param-match)| `[]*HTTPQueryParamMatch` |  | | QueryParams specifies HTTP query parameter matchers. Multiple match</br>values are ANDed together, meaning, a request must match all the</br>specified query parameters to select the route.</br></br>Support: Extended |  |
| method | [HTTPMethod](#http-method)| `HTTPMethod` |  | |  |  |
| path | [HTTPPathMatch](#http-path-match)| `HTTPPathMatch` |  | |  |  |



### <span id="http-route-retry"></span> HTTPRouteRetry


> Implementations SHOULD retry on connection errors (disconnect, reset, timeout,
TCP failure) if a retry stanza is configured.
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Attempts | int64 (formatted integer)| `int64` |  | | Attempts specifies the maximum number of times an individual request</br>from the gateway to a backend should be retried.</br></br>If the maximum number of retries has been attempted without a successful</br>response from the backend, the Gateway MUST return an error.</br></br>When this field is unspecified, the number of times to attempt to retry</br>a backend request is implementation-specific.</br></br>Support: Extended |  |
| Codes | [][HTTPRouteRetryStatusCode](#http-route-retry-status-code)| `[]HTTPRouteRetryStatusCode` |  | | Codes defines the HTTP response status codes for which a backend request</br>should be retried.</br></br>Support: Extended |  |
| backoff | [V1Duration](#v1-duration)| `V1Duration` |  | |  |  |



### <span id="http-route-retry-status-code"></span> HTTPRouteRetryStatusCode


> Implementations MUST support the following status codes as retriable:

- 500
- 502
- 503
- 504

Implementations MAY support specifying additional discrete values in the
500-599 range.

Implementations MAY support specifying discrete values in the 400-499 range,
which are often inadvisable to retry.

<gateway:experimental>
  



| Name | Type | Go type | Default | Description | Example |
|------|------|---------| ------- |-------------|---------|
| HTTPRouteRetryStatusCode | int64 (formatted integer)| int64 | | Implementations MUST support the following status codes as retriable:</br></br>- 500</br>- 502</br>- 503</br>- 504</br></br>Implementations MAY support specifying additional discrete values in the</br>500-599 range.</br></br>Implementations MAY support specifying discrete values in the 400-499 range,</br>which are often inadvisable to retry.</br></br><gateway:experimental> |  |



### <span id="http-route-rule"></span> HTTPRouteRule


> HTTPRouteRule defines semantics for matching an HTTP request based on
conditions (matches), processing it (filters), and forwarding the request to
an API object (backendRefs).
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| BackendRefs | [][HTTPBackendRef](#http-backend-ref)| `[]*HTTPBackendRef` |  | | BackendRefs defines the backend(s) where matching requests should be</br>sent.</br></br>Failure behavior here depends on how many BackendRefs are specified and</br>how many are invalid.</br></br>If *all* entries in BackendRefs are invalid, and there are also no filters</br>specified in this route rule, *all* traffic which matches this rule MUST</br>receive a 500 status code.</br></br>See the HTTPBackendRef definition for the rules about what makes a single</br>HTTPBackendRef invalid.</br></br>When a HTTPBackendRef is invalid, 500 status codes MUST be returned for</br>requests that would have otherwise been routed to an invalid backend. If</br>multiple backends are specified, and some are invalid, the proportion of</br>requests that would otherwise have been routed to an invalid backend</br>MUST receive a 500 status code.</br></br>For example, if two backends are specified with equal weights, and one is</br>invalid, 50 percent of traffic must receive a 500. Implementations may</br>choose how that 50 percent is determined.</br></br>When a HTTPBackendRef refers to a Service that has no ready endpoints,</br>implementations SHOULD return a 503 for requests to that backend instead.</br>If an implementation chooses to do this, all of the above rules for 500 responses</br>MUST also apply for responses that return a 503.</br></br>Support: Core for Kubernetes Service</br></br>Support: Extended for Kubernetes ServiceImport</br></br>Support: Implementation-specific for any other resource</br></br>Support for weight: Core |  |
| Filters | [][HTTPRouteFilter](#http-route-filter)| `[]*HTTPRouteFilter` |  | | Filters define the filters that are applied to requests that match</br>this rule.</br></br>Wherever possible, implementations SHOULD implement filters in the order</br>they are specified.</br></br>Implementations MAY choose to implement this ordering strictly, rejecting</br>any combination or order of filters that cannot be supported. If implementations</br>choose a strict interpretation of filter ordering, they MUST clearly document</br>that behavior.</br></br>To reject an invalid combination or order of filters, implementations SHOULD</br>consider the Route Rules with this configuration invalid. If all Route Rules</br>in a Route are invalid, the entire Route would be considered invalid. If only</br>a portion of Route Rules are invalid, implementations MUST set the</br>"PartiallyInvalid" condition for the Route.</br></br>Conformance-levels at this level are defined based on the type of filter:</br></br>- ALL core filters MUST be supported by all implementations.</br>- Implementers are encouraged to support extended filters.</br>- Implementation-specific custom filters have no API guarantees across</br>implementations.</br></br>Specifying the same filter multiple times is not supported unless explicitly</br>indicated in the filter.</br></br>All filters are expected to be compatible with each other except for the</br>URLRewrite and RequestRedirect filters, which may not be combined. If an</br>implementation cannot support other combinations of filters, they must clearly</br>document that limitation. In cases where incompatible or unsupported</br>filters are specified and cause the `Accepted` condition to be set to status</br>`False`, implementations may use the `IncompatibleFilters` reason to specify</br>this configuration error.</br></br>Support: Core |  |
| Matches | [][HTTPRouteMatch](#http-route-match)| `[]*HTTPRouteMatch` |  | | Matches define conditions used for matching the rule against incoming</br>HTTP requests. Each match is independent, i.e. this rule will be matched</br>if **any** one of the matches is satisfied.</br></br>For example, take the following matches configuration:</br></br>```</br>matches:</br>- path:</br>value: "/foo"</br>headers:</br>- name: "version"</br>value: "v2"</br>- path:</br>value: "/v2/foo"</br>```</br></br>For a request to match against this rule, a request must satisfy</br>EITHER of the two conditions:</br></br>- path prefixed with `/foo` AND contains the header `version: v2`</br>- path prefix of `/v2/foo`</br></br>See the documentation for HTTPRouteMatch on how to specify multiple</br>match conditions that should be ANDed together.</br></br>If no matches are specified, the default is a prefix</br>path match on "/", which has the effect of matching every</br>HTTP request.</br></br>Proxy or Load Balancer routing configuration generated from HTTPRoutes</br>MUST prioritize matches based on the following criteria, continuing on</br>ties. Across all rules specified on applicable Routes, precedence must be</br>given to the match having:</br></br>- "Exact" path match.</br>- "Prefix" path match with largest number of characters.</br>- Method match.</br>- Largest number of header matches.</br>- Largest number of query param matches.</br></br>Note: The precedence of RegularExpression path matches are implementation-specific.</br></br>If ties still exist across multiple Routes, matching precedence MUST be</br>determined in order of the following criteria, continuing on ties:</br></br>- The oldest Route based on creation timestamp.</br>- The Route appearing first in alphabetical order by</br>"{namespace}/{name}".</br></br>If ties still exist within an HTTPRoute, matching precedence MUST be granted</br>to the FIRST matching rule (in list order) with a match meeting the above</br>criteria.</br></br>When no rules matching a request have been successfully attached to the</br>parent a request is coming from, a HTTP 404 status code MUST be returned. |  |
| name | [SectionName](#section-name)| `SectionName` |  | |  |  |
| retry | [HTTPRouteRetry](#http-route-retry)| `HTTPRouteRetry` |  | |  |  |
| sessionPersistence | [SessionPersistence](#session-persistence)| `SessionPersistence` |  | |  |  |
| timeouts | [HTTPRouteTimeouts](#http-route-timeouts)| `HTTPRouteTimeouts` |  | |  |  |



### <span id="http-route-spec"></span> HTTPRouteSpec


> HTTPRouteSpec defines the desired state of HTTPRoute
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Hostnames | [][Hostname](#hostname)| `[]Hostname` |  | | Hostnames defines a set of hostnames that should match against the HTTP Host</br>header to select a HTTPRoute used to process the request. Implementations</br>MUST ignore any port value specified in the HTTP Host header while</br>performing a match and (absent of any applicable header modification</br>configuration) MUST forward this header unmodified to the backend.</br></br>Valid values for Hostnames are determined by RFC 1123 definition of a</br>hostname with 2 notable exceptions:</br></br>1. IPs are not allowed.</br>2. A hostname may be prefixed with a wildcard label (`*.`). The wildcard</br>label must appear by itself as the first label.</br></br>If a hostname is specified by both the Listener and HTTPRoute, there</br>must be at least one intersecting hostname for the HTTPRoute to be</br>attached to the Listener. For example:</br></br>- A Listener with `test.example.com` as the hostname matches HTTPRoutes</br>that have either not specified any hostnames, or have specified at</br>least one of `test.example.com` or `*.example.com`.</br>- A Listener with `*.example.com` as the hostname matches HTTPRoutes</br>that have either not specified any hostnames or have specified at least</br>one hostname that matches the Listener hostname. For example,</br>`*.example.com`, `test.example.com`, and `foo.test.example.com` would</br>all match. On the other hand, `example.com` and `test.example.net` would</br>not match.</br></br>Hostnames that are prefixed with a wildcard label (`*.`) are interpreted</br>as a suffix match. That means that a match for `*.example.com` would match</br>both `test.example.com`, and `foo.test.example.com`, but not `example.com`.</br></br>If both the Listener and HTTPRoute have specified hostnames, any</br>HTTPRoute hostnames that do not match the Listener hostname MUST be</br>ignored. For example, if a Listener specified `*.example.com`, and the</br>HTTPRoute specified `test.example.com` and `test.example.net`,</br>`test.example.net` must not be considered for a match.</br></br>If both the Listener and HTTPRoute have specified hostnames, and none</br>match with the criteria above, then the HTTPRoute is not accepted. The</br>implementation must raise an 'Accepted' Condition with a status of</br>`False` in the corresponding RouteParentStatus.</br></br>In the event that multiple HTTPRoutes specify intersecting hostnames (e.g.</br>overlapping wildcard matching and exact matching hostnames), precedence must</br>be given to rules from the HTTPRoute with the largest number of:</br></br>- Characters in a matching non-wildcard hostname.</br>- Characters in a matching hostname.</br></br>If ties exist across multiple Routes, the matching precedence rules for</br>HTTPRouteMatches takes over.</br></br>Support: Core |  |
| ParentRefs | [][ApisV1ParentReference](#apis-v1-parent-reference)| `[]*ApisV1ParentReference` |  | | ParentRefs references the resources (usually Gateways) that a Route wants</br>to be attached to. Note that the referenced parent resource needs to</br>allow this for the attachment to be complete. For Gateways, that means</br>the Gateway needs to allow attachment from Routes of this kind and</br>namespace. For Services, that means the Service must either be in the same</br>namespace for a "producer" route, or the mesh implementation must support</br>and allow "consumer" routes for the referenced Service. ReferenceGrant is</br>not applicable for governing ParentRefs to Services - it is not possible to</br>create a "producer" route for a Service in a different namespace from the</br>Route.</br></br>There are two kinds of parent resources with "Core" support:</br></br>- Gateway (Gateway conformance profile)</br>- Service (Mesh conformance profile, ClusterIP Services only)</br></br>This API may be extended in the future to support additional kinds of parent</br>resources.</br></br>ParentRefs must be _distinct_. This means either that:</br></br>- They select different objects.  If this is the case, then parentRef</br>entries are distinct. In terms of fields, this means that the</br>multi-part key defined by `group`, `kind`, `namespace`, and `name` must</br>be unique across all parentRef entries in the Route.</br>- They do not select different objects, but for each optional field used,</br>each ParentRef that selects the same object must set the same set of</br>optional fields to different values. If one ParentRef sets a</br>combination of optional fields, all must set the same combination.</br></br>Some examples:</br></br>- If one ParentRef sets `sectionName`, all ParentRefs referencing the</br>same object must also set `sectionName`.</br>- If one ParentRef sets `port`, all ParentRefs referencing the same</br>object must also set `port`.</br>- If one ParentRef sets `sectionName` and `port`, all ParentRefs</br>referencing the same object must also set `sectionName` and `port`.</br></br>It is possible to separately reference multiple distinct objects that may</br>be collapsed by an implementation. For example, some implementations may</br>choose to merge compatible Gateway Listeners together. If that is the</br>case, the list of routes attached to those resources should also be</br>merged.</br></br>Note that for ParentRefs that cross namespace boundaries, there are specific</br>rules. Cross-namespace references are only valid if they are explicitly</br>allowed by something in the namespace they are referring to. For example,</br>Gateway has the AllowedRoutes field, and ReferenceGrant provides a</br>generic way to enable other kinds of cross-namespace reference.</br></br><gateway:experimental:description></br>ParentRefs from a Route to a Service in the same namespace are "producer"</br>routes, which apply default routing rules to inbound connections from</br>any namespace to the Service.</br></br>ParentRefs from a Route to a Service in a different namespace are</br>"consumer" routes, and these routing rules are only applied to outbound</br>connections originating from the same namespace as the Route, for which</br>the intended destination of the connections are a Service targeted as a</br>ParentRef of the Route.</br></gateway:experimental:description></br></br><gateway:util:excludeFromCRD></br>Ensures that when the same parent is referenced more than once, each reference</br>carries a distinct, non-empty sectionName. The first rule enforces consistency</br>(all refs specify sectionName or none do), the second enforces uniqueness.</br></gateway:util:excludeFromCRD></br><gateway:standard:validation:XValidation:message="sectionName must be specified when parentRefs includes 2 or more references to the same parent",rule="self.all(p1, self.all(p2, p1.group == p2.group && p1.kind == p2.kind && p1.name == p2.name && (((!has(p1.__namespace__) || p1.__namespace__ == '') && (!has(p2.__namespace__) || p2.__namespace__ == '')) || (has(p1.__namespace__) && has(p2.__namespace__) && p1.__namespace__ == p2.__namespace__ )) ? ((!has(p1.sectionName) || p1.sectionName == '') == (!has(p2.sectionName) || p2.sectionName == '')) : true))"></br><gateway:standard:validation:XValidation:message="sectionName must be unique when parentRefs includes 2 or more references to the same parent",rule="self.all(p1, self.exists_one(p2, p1.group == p2.group && p1.kind == p2.kind && p1.name == p2.name && (((!has(p1.__namespace__) || p1.__namespace__ == '') && (!has(p2.__namespace__) || p2.__namespace__ == '')) || (has(p1.__namespace__) && has(p2.__namespace__) && p1.__namespace__ == p2.__namespace__ )) && (((!has(p1.sectionName) || p1.sectionName == '') && (!has(p2.sectionName) || p2.sectionName == '')) || (has(p1.sectionName) && has(p2.sectionName) && p1.sectionName == p2.sectionName))))"></br><gateway:util:excludeFromCRD></br>Experimental variants of the above rules that additionally require the combination</br>of sectionName and port to be consistently specified and unique across refs.</br></gateway:util:excludeFromCRD></br><gateway:experimental:validation:XValidation:message="sectionName or port must be specified when parentRefs includes 2 or more references to the same parent",rule="self.all(p1, self.all(p2, p1.group == p2.group && p1.kind == p2.kind && p1.name == p2.name && (((!has(p1.__namespace__) || p1.__namespace__ == '') && (!has(p2.__namespace__) || p2.__namespace__ == '')) || (has(p1.__namespace__) && has(p2.__namespace__) && p1.__namespace__ == p2.__namespace__)) ? ((!has(p1.sectionName) || p1.sectionName == '') == (!has(p2.sectionName) || p2.sectionName == '') && (!has(p1.port) || p1.port == 0) == (!has(p2.port) || p2.port == 0)): true))"></br><gateway:experimental:validation:XValidation:message="sectionName or port must be unique when parentRefs includes 2 or more references to the same parent",rule="self.all(p1, self.exists_one(p2, p1.group == p2.group && p1.kind == p2.kind && p1.name == p2.name && (((!has(p1.__namespace__) || p1.__namespace__ == '') && (!has(p2.__namespace__) || p2.__namespace__ == '')) || (has(p1.__namespace__) && has(p2.__namespace__) && p1.__namespace__ == p2.__namespace__ )) && (((!has(p1.sectionName) || p1.sectionName == '') && (!has(p2.sectionName) || p2.sectionName == '')) || ( has(p1.sectionName) && has(p2.sectionName) && p1.sectionName == p2.sectionName)) && (((!has(p1.port) || p1.port == 0) && (!has(p2.port) || p2.port == 0)) || (has(p1.port) && has(p2.port) && p1.port == p2.port))))"> |  |
| Rules | [][HTTPRouteRule](#http-route-rule)| `[]*HTTPRouteRule` |  | | Rules are a list of HTTP matchers, filters and actions.</br></br><gateway:experimental:validation:XValidation:message="Rule name must be unique within the route",rule="self.all(l1, !has(l1.name) || self.exists_one(l2, has(l2.name) && l1.name == l2.name))"></br><gateway:util:excludeFromCRD></br>Validates that the total number of matches across all rules does not exceed 128.</br>CEL does not support aggregate functions like sum() over lists, so each of the</br>(up to 16) rules is checked individually and their match counts are summed explicitly.</br></gateway:util:excludeFromCRD> |  |
| useDefaultGateways | [GatewayDefaultScope](#gateway-default-scope)| `GatewayDefaultScope` |  | |  |  |



### <span id="http-route-status"></span> HTTPRouteStatus


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Parents | [][RouteParentStatus](#route-parent-status)| `[]*RouteParentStatus` |  | | Parents is a list of parent resources (usually Gateways) that are</br>associated with the route, and the status of the route with respect to</br>each parent. When this route attaches to a parent, the controller that</br>manages the parent must add an entry to this list when the controller</br>first sees the route and should update the entry as appropriate when the</br>route or gateway is modified.</br></br>Note that parent references that cannot be resolved by an implementation</br>of this API will not be added to this list. Implementations of this API</br>can only populate Route status for the Gateways/parent resources they are</br>responsible for.</br></br>A maximum of 32 Gateways will be represented in this list. An empty list</br>means the route has not been attached to any Gateway.</br></br><gateway:util:excludeFromCRD></br>Notes for implementors:</br></br>While parents is not a listType `map`, this is due to the fact that the</br>list key is not scalar, and Kubernetes is unable to represent this.</br></br>Parent status MUST be considered to be namespaced by the combination of</br>the parentRef and controllerName fields, and implementations should keep</br>the following rules in mind when updating this status:</br></br>- Implementations MUST update only entries that have a matching value of</br>`controllerName` for that implementation.</br>- Implementations MUST NOT update entries with non-matching `controllerName`</br>fields.</br>- Implementations MUST treat each `parentRef`` in the Route separately and</br>update its status based on the relationship with that parent.</br>- Implementations MUST perform a read-modify-write cycle on this field</br>before modifying it. That is, when modifying this field, implementations</br>must be confident they have fetched the most recent version of this field,</br>and ensure that changes they make are on that recent version.</br></br></gateway:util:excludeFromCRD> |  |



### <span id="http-route-timeouts"></span> HTTPRouteTimeouts


> Timeout values are represented with Gateway API Duration formatting.
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| backendRequest | [V1Duration](#v1-duration)| `V1Duration` |  | |  |  |
| request | [V1Duration](#v1-duration)| `V1Duration` |  | |  |  |



### <span id="http-url-rewrite-filter"></span> HTTPURLRewriteFilter


> Support: Extended
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| hostname | [PreciseHostname](#precise-hostname)| `PreciseHostname` |  | |  |  |
| path | [HTTPPathModifier](#http-path-modifier)| `HTTPPathModifier` |  | |  |  |



### <span id="header-match-type"></span> HeaderMatchType


> - "Exact" - Core
- "RegularExpression" - Implementation Specific

Note that values may be added to this enum, implementations
must ensure that unknown values will not cause a crash.

Unknown values here must result in the implementation setting the
Accepted Condition for the Route to `status: False`, with a
Reason of `UnsupportedValue`.
  



| Name | Type | Go type | Default | Description | Example |
|------|------|---------| ------- |-------------|---------|
| HeaderMatchType | string| string | | - "Exact" - Core</br>- "RegularExpression" - Implementation Specific</br></br>Note that values may be added to this enum, implementations</br>must ensure that unknown values will not cause a crash.</br></br>Unknown values here must result in the implementation setting the</br>Accepted Condition for the Route to `status: False`, with a</br>Reason of `UnsupportedValue`. |  |



### <span id="header-name"></span> HeaderName


  

| Name | Type | Go type | Default | Description | Example |
|------|------|---------| ------- |-------------|---------|
| HeaderName | string| string | |  |  |



### <span id="headers"></span> Headers


> ```yaml
apiVersion: networking.istio.io/v1
kind: VirtualService
metadata:


spec:

hosts:
- reviews.prod.svc.cluster.local
http:
- headers:
request:
set:
test: "true"
route:
- destination:
subset: v2
weight: 25
- destination:
subset: v1
headers:
response:
remove:
- foo
weight: 75

```
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| request | [HeadersHeaderOperations](#headers-header-operations)| `HeadersHeaderOperations` |  | |  |  |
| response | [HeadersHeaderOperations](#headers-header-operations)| `HeadersHeaderOperations` |  | |  |  |



### <span id="headers-header-operations"></span> Headers_HeaderOperations


> HeaderOperations Describes the header manipulations to apply
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Add | map of string| `map[string]string` |  | | Append the given values to the headers specified by keys</br>(will create a comma-separated list of values) |  |
| Remove | []string| `[]string` |  | | Remove the specified headers |  |
| Set | map of string| `map[string]string` |  | | Overwrite the headers specified by key with the given values |  |



### <span id="health-cache-metrics"></span> HealthCacheMetrics


> This is useful for testing and monitoring without having to scrape the Prometheus metrics endpoint.
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| HealthCacheHits | double (formatted number)| `float64` |  | |  |  |
| HealthCacheMisses | double (formatted number)| `float64` |  | |  |  |



### <span id="health-status"></span> HealthStatus


> HealthStatus represents the calculated health status of an entity
  



| Name | Type | Go type | Default | Description | Example |
|------|------|---------| ------- |-------------|---------|
| HealthStatus | string| string | | HealthStatus represents the calculated health status of an entity |  |



### <span id="health-status-metric-item"></span> HealthStatusMetricItem


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Cluster | string| `string` |  | |  |  |
| HealthType | string| `string` |  | |  |  |
| Name | string| `string` |  | |  |  |
| Namespace | string| `string` |  | |  |  |
| Value | double (formatted number)| `float64` |  | |  |  |



### <span id="health-status-metrics"></span> HealthStatusMetrics


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Metrics | [][HealthStatusMetricItem](#health-status-metric-item)| `[]*HealthStatusMetricItem` |  | |  |  |



### <span id="host"></span> Host


> Host represents the FQDN format for Istio hostnames
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Cluster | string| `string` |  | |  |  |
| CompleteInput | boolean| `bool` |  | | CompleteInput is true when Service, Namespace and Cluster fields are present.</br>It is true for simple service names and FQDN services.</br>It is false for service.namespace format and service entries. |  |
| Namespace | string| `string` |  | |  |  |
| Service | string| `string` |  | |  |  |



### <span id="hostname"></span> Hostname


> 1. IPs are not allowed.
2. A hostname may be prefixed with a wildcard label (`*.`). The wildcard
label must appear by itself as the first label.

Hostname can be "precise" which is a domain name without the terminating
dot of a network host (e.g. "foo.example.com") or "wildcard", which is a
domain name prefixed with a single wildcard label (e.g. `*.example.com`).

Note that as per RFC1035 and RFC1123, a *label* must consist of lower case
alphanumeric characters or '-', and must start and end with an alphanumeric
character. No other punctuation is allowed.
  



| Name | Type | Go type | Default | Description | Example |
|------|------|---------| ------- |-------------|---------|
| Hostname | string| string | | 1. IPs are not allowed.</br>2. A hostname may be prefixed with a wildcard label (`*.`). The wildcard</br>label must appear by itself as the first label.</br></br>Hostname can be "precise" which is a domain name without the terminating</br>dot of a network host (e.g. "foo.example.com") or "wildcard", which is a</br>domain name prefixed with a single wildcard label (e.g. `*.example.com`).</br></br>Note that as per RFC1035 and RFC1123, a *label* must consist of lower case</br>alphanumeric characters or '-', and must start and end with an alphanumeric</br>character. No other punctuation is allowed. |  |



### <span id="ip-family"></span> IPFamily


> IPFamily represents the IP Family (IPv4 or IPv6). This type is used
to express the family of an IP expressed by a type (e.g. service.spec.ipFamilies).
  



| Name | Type | Go type | Default | Description | Example |
|------|------|---------| ------- |-------------|---------|
| IPFamily | string| string | | IPFamily represents the IP Family (IPv4 or IPv6). This type is used</br>to express the family of an IP expressed by a type (e.g. service.spec.ipFamilies). |  |



### <span id="inference-pool"></span> InferencePool


> TODO: change the annotation once it gets officially approved
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| APIVersion | string| `string` |  | | APIVersion defines the versioned schema of this representation of an object.</br>Servers should convert recognized schemas to the latest internal value, and</br>may reject unrecognized values.</br>More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#resources |  |
| Kind | string| `string` |  | | Kind is a string value representing the REST resource this object represents.</br>Servers may infer this from the endpoint the client submits requests to.</br>Cannot be updated.</br>In CamelCase.</br>More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds |  |
| metadata | [ObjectMeta](#object-meta)| `ObjectMeta` |  | |  |  |
| spec | [InferencePoolSpec](#inference-pool-spec)| `InferencePoolSpec` |  | |  |  |
| status | [InferencePoolStatus](#inference-pool-status)| `InferencePoolStatus` |  | |  |  |



### <span id="inference-pool-spec"></span> InferencePoolSpec


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| TargetPorts | [][V1Port](#v1-port)| `[]*V1Port` |  | | TargetPorts defines a list of ports that are exposed by this InferencePool.</br>Every port will be treated as a distinctive endpoint by EPP,</br>addressable as a 'podIP:portNumber' combination. |  |
| appProtocol | [AppProtocol](#app-protocol)| `AppProtocol` |  | |  |  |
| endpointPickerRef | [EndpointPickerRef](#endpoint-picker-ref)| `EndpointPickerRef` |  | |  |  |
| selector | [V1LabelSelector](#v1-label-selector)| `V1LabelSelector` |  | |  |  |



### <span id="inference-pool-status"></span> InferencePoolStatus


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Parents | [][ParentStatus](#parent-status)| `[]*ParentStatus` |  | | Parents is a list of parent resources, typically Gateways, that are associated with</br>the InferencePool, and the status of the InferencePool with respect to each parent.</br></br>A controller that manages the InferencePool, must add an entry for each parent it manages</br>and remove the parent entry when the controller no longer considers the InferencePool to</br>be associated with that parent.</br></br>A maximum of 32 parents will be represented in this list. When the list is empty,</br>it indicates that the InferencePool is not associated with any parents. |  |



### <span id="int32-value"></span> Int32Value


> The JSON representation for `Int32Value` is JSON number.

Not recommended for use in new APIs, but still useful for legacy APIs and
has no plan to be removed.
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Value | int32 (formatted integer)| `int32` |  | | The int32 value. |  |



### <span id="istio-component-status"></span> IstioComponentStatus


  

[][ComponentStatus](#component-status)

### <span id="istio-condition"></span> IstioCondition


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Message | string| `string` |  | | Human-readable message indicating details about last transition. |  |
| ObservedGeneration | int64 (formatted integer)| `int64` |  | | Resource Generation to which the Condition refers. |  |
| Reason | string| `string` |  | | Unique, one-word, CamelCase reason for the condition's last transition. |  |
| Status | string| `string` |  | | Status is the status of the condition.</br>Can be True, False, Unknown. |  |
| Type | string| `string` |  | | Type is the type of the condition. |  |
| last_probe_time | [Timestamp](#timestamp)| `Timestamp` |  | |  |  |
| last_transition_time | [Timestamp](#timestamp)| `Timestamp` |  | |  |  |



### <span id="istio-config-details"></span> IstioConfigDetails


  

[any](#any)

### <span id="istio-config-list"></span> IstioConfigList


> IstioConfigList istioConfigList
This type is used for returning a response of IstioConfigList
  



[any](#any)

### <span id="istio-config-permissions"></span> IstioConfigPermissions


> IstioConfigPermissions holds a map of ResourcesPermissions per namespace
  



[IstioConfigPermissions](#istio-config-permissions)

### <span id="istio-environment"></span> IstioEnvironment


> IstioEnvironment describes the Istio implementation environment
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| IstioAPIEnabled | boolean| `bool` |  | | Is api enabled |  |



### <span id="istio-status"></span> IstioStatus


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Conditions | [][IstioCondition](#istio-condition)| `[]*IstioCondition` |  | | Current service state of the resource. |  |
| ObservedGeneration | int64 (formatted integer)| `int64` |  | | $hide_from_docs</br>Deprecated. IstioCondition observed_generation will show the resource generation for which the condition was generated.</br>Resource Generation to which the Reconciled Condition refers.</br>When this value is not equal to the object's metadata generation, reconciled condition  calculation for the current</br>generation is still in progress. |  |
| ValidationMessages | [][AnalysisMessageBase](#analysis-message-base)| `[]*AnalysisMessageBase` |  | | Includes any errors or warnings detected by Istio's analyzers. |  |



### <span id="istio-validation-key"></span> IstioValidationKey


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Cluster | string| `string` |  | |  |  |
| Name | string| `string` |  | |  |  |
| Namespace | string| `string` |  | |  |  |
| objectGVK | [GroupVersionKind](#group-version-kind)| `GroupVersionKind` |  | |  |  |



### <span id="istio-validation-summary"></span> IstioValidationSummary


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Cluster | string| `string` | ✓ | | Cluster of the Istio Objects. | `east` |
| Errors | int64 (formatted integer)| `int64` | ✓ | | Number of validations with error severity | `2` |
| Namespace | string| `string` | ✓ | | Namespace of the Istio Objects. | `bookinfo` |
| ObjectCount | int64 (formatted integer)| `int64` | ✓ | | Number of Istio Objects analyzed | `6` |
| Warnings | int64 (formatted integer)| `int64` | ✓ | | Number of validations with warning severity | `4` |



### <span id="istio-validations"></span> IstioValidations


  

[any](#any)

### <span id="istiod-thresholds"></span> IstiodThresholds


> IstiodThresholds contains the resource limits configured in Istiod
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| CPU | double (formatted number)| `float64` |  | |  |  |
| Memory | double (formatted number)| `float64` |  | |  |  |



### <span id="json-reference"></span> JSONReference


> Reference is a reference from one span to another
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| refType | [ReferenceType](#reference-type)| `ReferenceType` |  | |  |  |
| spanID | [SpanID](#span-id)| `SpanID` |  | |  |  |
| traceID | [TraceID](#trace-id)| `TraceID` |  | |  |  |



### <span id="key-value"></span> KeyValue


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Key | string| `string` |  | |  |  |
| Value | [any](#any)| `any` |  | |  |  |
| type | [ValueType](#value-type)| `ValueType` |  | |  |  |



### <span id="kiali-instance"></span> KialiInstance


> KialiInstance represents a Kiali installation. It holds some data about
where and how Kiali was deployed.
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Namespace | string| `string` |  | | Namespace is the name of the namespace where is Kiali installed on. |  |
| OperatorResource | string| `string` |  | | OperatorResource contains the namespace and the name of the Kiali CR that the user</br>created to install Kiali via the operator. This can be blank if the operator wasn't used</br>to install Kiali. This resource is populated from annotations in the Service. It has</br>the format "namespace/resource_name". |  |
| ServiceName | string| `string` |  | | ServiceName is the name of the Kubernetes service associated to the Kiali installation. The Kiali Service is the</br>entity that is looked for in order to determine if a Kiali instance is available. |  |
| Url | string| `string` |  | | Url is the URI that can be used to access Kiali. |  |
| Version | string| `string` |  | | Version is the Kiali version as reported by annotations in the Service. |  |



### <span id="kube-cluster"></span> KubeCluster


> Cluster holds some metadata about a Kubernetes cluster that is
part of the mesh.
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Accessible | boolean| `bool` |  | | Accessible specifies if the cluster is accessible or not. Clusters that are manually specified in the Kiali config</br>but do not have an associated remote cluster secret are considered not accessible. This is helpful when you have</br>two disconnected Kialis and want to link them without giving them access to each other. |  |
| ApiEndpoint | string| `string` |  | | ApiEndpoint is the URL where the Kubernetes/Cluster API Server can be contacted |  |
| IsKialiHome | boolean| `bool` |  | | IsKialiHome specifies if this cluster is hosting this Kiali instance (and the observed Mesh Control Plane) |  |
| KialiInstances | [][KialiInstance](#kiali-instance)| `[]*KialiInstance` |  | | KialiInstances is the list of Kialis discovered in the cluster. |  |
| Name | string| `string` |  | | Name specifies the CLUSTER_ID as known by the Control Plane |  |
| SecretName | string| `string` |  | | SecretName is the name of the kubernetes "remote cluster secret" that was mounted to the file system and where data of this cluster was resolved |  |



### <span id="kubernetes-address"></span> KubernetesAddress


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Localhost | [][any](#any)| `[]any` |  | |  |  |



### <span id="kubernetes-certificate"></span> KubernetesCertificate


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| CertChain | [][CertChain](#cert-chain)| `[]*CertChain` |  | |  |  |
| Identity | string| `string` |  | |  |  |
| State | string| `string` |  | |  |  |



### <span id="kubernetes-config"></span> KubernetesConfig


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| AltCaHostname | string| `string` |  | |  |  |
| AltXdsHostname | string| `string` |  | |  |  |
| CaAddress | string| `string` |  | |  |  |
| ClusterDomain | string| `string` |  | |  |  |
| ClusterID | string| `string` |  | |  |  |
| ConnectionWindowSize | int64 (formatted integer)| `int64` |  | |  |  |
| DNSProxy | boolean| `bool` |  | |  |  |
| FakeCa | boolean| `bool` |  | |  |  |
| FakeSelfInbound | boolean| `bool` |  | |  |  |
| FrameSize | int64 (formatted integer)| `int64` |  | |  |  |
| IllegalPorts | []int64 (formatted integer)| `[]int64` |  | |  |  |
| InPodPortReuse | boolean| `bool` |  | |  |  |
| InPodUds | string| `string` |  | |  |  |
| InboundAddr | string| `string` |  | |  |  |
| InboundPlaintextAddr | string| `string` |  | |  |  |
| LocalNode | string| `string` |  | |  |  |
| Network | string| `string` |  | |  |  |
| NumWorkerThreads | int64 (formatted integer)| `int64` |  | |  |  |
| OutboundAddr | string| `string` |  | |  |  |
| PacketMark | int64 (formatted integer)| `int64` |  | |  |  |
| PoolMaxStreamsPerConn | int64 (formatted integer)| `int64` |  | |  |  |
| Proxy | boolean| `bool` |  | |  |  |
| ProxyArgs | string| `string` |  | |  |  |
| ProxyMetadata | map of string| `map[string]string` |  | |  |  |
| ProxyMode | string| `string` |  | |  |  |
| ProxyWorkloadInfo | string| `string` |  | |  |  |
| RequireOriginalSource | string| `string` |  | |  |  |
| Socks5Addr | string| `string` |  | |  |  |
| WindowSize | int64 (formatted integer)| `int64` |  | |  |  |
| XdsAddress | string| `string` |  | |  |  |
| XdsOnDemand | boolean| `bool` |  | |  |  |
| adminAddr | [KubernetesAddress](#kubernetes-address)| `KubernetesAddress` |  | |  |  |
| caRootCert | [FilePath](#file-path)| `FilePath` |  | |  |  |
| dnsProxyAddr | [KubernetesAddress](#kubernetes-address)| `KubernetesAddress` |  | |  |  |
| dnsResolverCfg | [DNSResolverConfig](#dns-resolver-config)| `DNSResolverConfig` |  | |  |  |
| dnsResolverOpts | [DNSResolverOptions](#dns-resolver-options)| `DNSResolverOptions` |  | |  |  |
| poolUnusedReleaseTimeout | [TimeDuration](#time-duration)| `TimeDuration` |  | |  |  |
| readinessAddr | [SocketAddress](#socket-address)| `SocketAddress` |  | |  |  |
| secretTtl | [TimeDuration](#time-duration)| `TimeDuration` |  | |  |  |
| selfTerminationDeadline | [TimeDuration](#time-duration)| `TimeDuration` |  | |  |  |
| statsAddr | [SocketAddress](#socket-address)| `SocketAddress` |  | |  |  |
| xdsRootCert | [FilePath](#file-path)| `FilePath` |  | |  |  |



### <span id="kubernetes-endpoint"></span> KubernetesEndpoint


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Port | map of int64 (formatted integer)| `map[string]int64` |  | |  |  |
| Status | string| `string` |  | |  |  |
| WorkloadUid | string| `string` |  | |  |  |



### <span id="kubernetes-service"></span> KubernetesService


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Endpoints | map of [KubernetesEndpoint](#kubernetes-endpoint)| `map[string]KubernetesEndpoint` |  | |  |  |
| Hostname | string| `string` |  | |  |  |
| IpFamilies | string| `string` |  | |  |  |
| Name | string| `string` |  | |  |  |
| Namespace | string| `string` |  | |  |  |
| Ports | map of int64 (formatted integer)| `map[string]int64` |  | |  |  |
| SubjectAltNames | []string| `[]string` |  | |  |  |
| Vips | []string| `[]string` |  | |  |  |
| waypoint | [Waypoint](#waypoint)| `Waypoint` |  | |  |  |



### <span id="kubernetes-workload"></span> KubernetesWorkload


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| CanonicalName | string| `string` |  | |  |  |
| CanonicalRevision | string| `string` |  | |  |  |
| ClusterID | string| `string` |  | |  |  |
| Name | string| `string` |  | |  |  |
| Namespace | string| `string` |  | |  |  |
| NetworkMode | string| `string` |  | |  |  |
| Node | string| `string` |  | |  |  |
| Protocol | string| `string` |  | |  |  |
| ServiceAccount | string| `string` |  | |  |  |
| Services | []string| `[]string` |  | |  |  |
| Status | string| `string` |  | |  |  |
| TrustDomain | string| `string` |  | |  |  |
| Uid | string| `string` |  | |  |  |
| WorkloadIps | []string| `[]string` |  | |  |  |
| WorkloadName | string| `string` |  | |  |  |
| WorkloadType | string| `string` |  | |  |  |



### <span id="l4-match-attributes"></span> L4MatchAttributes


> L4 connection match attributes. Note that L4 connection matching support
is incomplete.
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| DestinationSubnets | []string| `[]string` |  | | IPv4 or IPv6 ip addresses of destination with optional subnet.  E.g.,</br>a.b.c.d/xx form or just a.b.c.d. |  |
| Gateways | []string| `[]string` |  | | Names of gateways where the rule should be applied. Gateway names</br>in the top-level `gateways` field of the VirtualService (if any) are overridden. The gateway</br>match is independent of sourceLabels. |  |
| Port | uint32 (formatted integer)| `uint32` |  | | Specifies the port on the host that is being addressed. Many services</br>only expose a single port or label ports with the protocols they support,</br>in these cases it is not required to explicitly select the port. |  |
| SourceLabels | map of string| `map[string]string` |  | | One or more labels that constrain the applicability of a rule to</br>workloads with the given labels. If the VirtualService has a list of</br>gateways specified in the top-level `gateways` field, it should include the reserved gateway</br>`mesh` in order for this field to be applicable.</br></br>**Note:** This is not a runtime match, but is a selector; it filters which workloads the</br>VirtualService applies to. |  |
| SourceNamespace | string| `string` |  | | Source namespace constraining the applicability of a rule to workloads in that namespace.</br>If the VirtualService has a list of gateways specified in the top-level `gateways` field,</br>it must include the reserved gateway `mesh` for this field to be applicable.</br></br>**Note:** This is not a runtime match, but is a selector; it filters which workloads the</br>VirtualService applies to. |  |
| SourceSubnet | string| `string` |  | | IPv4 or IPv6 ip address of source with optional subnet. E.g., a.b.c.d/xx</br>form or just a.b.c.d</br>$hide_from_docs |  |



### <span id="label-selector-requirement"></span> LabelSelectorRequirement


> A label selector requirement is a selector that contains values, a key, and an operator that
relates the key and values.
Copied from Kubernetes to avoid expensive dependency on Kubernetes libraries.
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Key | string| `string` |  | | key is the label key that the selector applies to. |  |
| Operator | string| `string` |  | | operator represents a key's relationship to a set of values.</br>Valid operators are In, NotIn, Exists and DoesNotExist. |  |
| Values | []string| `[]string` |  | | values is an array of string values. If the operator is In or NotIn,</br>the values array must be non-empty. If the operator is Exists or DoesNotExist,</br>the values array must be empty. This array is replaced during a strategic</br>merge patch. |  |



### <span id="label-value"></span> LabelValue


> Valid values include:

- MyValue
- my.name
- 123-my-value
  



| Name | Type | Go type | Default | Description | Example |
|------|------|---------| ------- |-------------|---------|
| LabelValue | string| string | | Valid values include:</br></br>- MyValue</br>- my.name</br>- 123-my-value |  |



### <span id="listener"></span> Listener


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Address | string| `string` |  | |  |  |
| Destination | string| `string` |  | |  |  |
| Match | string| `string` |  | |  |  |
| Port | double (formatted number)| `float64` |  | |  |  |



### <span id="listeners"></span> Listeners


  

[][Listener](#listener)

### <span id="load-balancer-settings"></span> LoadBalancerSettings


> For example, the following rule uses a round robin load balancing policy
for all traffic going to the ratings service.

```yaml
apiVersion: networking.istio.io/v1
kind: DestinationRule
metadata:


spec:

trafficPolicy:
loadBalancer:
simple: ROUND_ROBIN

```

The following example sets up sticky sessions for the ratings service
hashing-based load balancer for the same ratings service using the
the User cookie as the hash key.

```yaml
apiVersion: networking.istio.io/v1
kind: DestinationRule
metadata:


spec:

trafficPolicy:
loadBalancer:
consistentHash:
httpCookie:
ttl: 0s

```
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| LbPolicy | [IsLoadBalancerSettingsLbPolicy](#is-load-balancer-settings-lb-policy)| `IsLoadBalancerSettingsLbPolicy` |  | |  |  |
| locality_lb_setting | [LocalityLoadBalancerSetting](#locality-load-balancer-setting)| `LocalityLoadBalancerSetting` |  | |  |  |
| warmup | [WarmupConfiguration](#warmup-configuration)| `WarmupConfiguration` |  | |  |  |
| warmup_duration_secs | [DurationpbDuration](#durationpb-duration)| `DurationpbDuration` |  | |  |  |



### <span id="local-object-reference"></span> LocalObjectReference


> References to objects with invalid Group and Kind are not valid, and must
be rejected by the implementation, with appropriate Conditions set
on the containing object.
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| group | [ApisV1Group](#apis-v1-group)| `ApisV1Group` |  | |  |  |
| kind | [ApisV1Kind](#apis-v1-kind)| `ApisV1Kind` |  | |  |  |
| name | [ApisV1ObjectName](#apis-v1-object-name)| `ApisV1ObjectName` |  | |  |  |



### <span id="locality-load-balancer-setting"></span> LocalityLoadBalancerSetting


> Given a mesh with workloads and their service deployed to "us-west/zone1/\*"
and "us-west/zone2/\*". This example specifies that when traffic accessing a
service originates from workloads in "us-west/zone1/\*", 80% of the traffic
will be sent to endpoints in "us-west/zone1/\*", i.e the same zone, and the
remaining 20% will go to endpoints in "us-west/zone2/\*". This setup is
intended to favor routing traffic to endpoints in the same locality.
A similar setting is specified for traffic originating in "us-west/zone2/\*".

```yaml

distribute:
- from: us-west/zone1/*
to:
"us-west/zone1/*": 80
"us-west/zone2/*": 20
- from: us-west/zone2/*
to:
"us-west/zone1/*": 20
"us-west/zone2/*": 80

```

If the goal of the operator is not to distribute load across zones and
regions but rather to restrict the regionality of failover to meet other
operational requirements an operator can set a 'failover' policy instead of
a 'distribute' policy.

The following example sets up a locality failover policy for regions.
Assume a service resides in zones within us-east, us-west & eu-west
this example specifies that when endpoints within us-east become unhealthy
traffic should failover to endpoints in any zone or sub-zone within eu-west
and similarly us-west should failover to us-east.

```yaml

failover:
- from: us-east
to: eu-west
- from: us-west
to: us-east

```
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Distribute | [][LocalityLoadBalancerSettingDistribute](#locality-load-balancer-setting-distribute)| `[]*LocalityLoadBalancerSettingDistribute` |  | | Optional: only one of distribute, failover or failoverPriority can be set.</br>Explicitly specify loadbalancing weight across different zones and geographical locations.</br>Refer to [Locality weighted load balancing](https://www.envoyproxy.io/docs/envoy/latest/intro/arch_overview/upstream/load_balancing/locality_weight)</br>If empty, the locality weight is set according to the endpoints number within it. |  |
| Failover | [][LocalityLoadBalancerSettingFailover](#locality-load-balancer-setting-failover)| `[]*LocalityLoadBalancerSettingFailover` |  | | Optional: only one of distribute, failover or failoverPriority can be set.</br>Explicitly specify the region traffic will land on when endpoints in local region becomes unhealthy.</br>Should be used together with OutlierDetection to detect unhealthy endpoints.</br>Note: if no OutlierDetection specified, this will not take effect. |  |
| FailoverPriority | []string| `[]string` |  | | failoverPriority is an ordered list of labels used to sort endpoints to do priority based load balancing.</br>This is to support traffic failover across different groups of endpoints.</br>Two kinds of labels can be specified:</br></br>- Specify only label keys `[key1, key2, key3]`, istio would compare the label values of client with endpoints.</br>Suppose there are total N label keys `[key1, key2, key3, ...keyN]` specified:</br></br>1. Endpoints matching all N labels with the client proxy have priority P(0) i.e. the highest priority.</br>2. Endpoints matching the first N-1 labels with the client proxy have priority P(1) i.e. second highest priority.</br>3. By extension of this logic, endpoints matching only the first label with the client proxy has priority P(N-1) i.e. second lowest priority.</br>4. All the other endpoints have priority P(N) i.e. lowest priority.</br></br>- Specify labels with key and value `[key1=value1, key2=value2, key3=value3]`, istio would compare the labels with endpoints.</br>Suppose there are total N labels `[key1=value1, key2=value2, key3=value3, ...keyN=valueN]` specified:</br></br>1. Endpoints matching all N labels have priority P(0) i.e. the highest priority.</br>2. Endpoints matching the first N-1 labels have priority P(1) i.e. second highest priority.</br>3. By extension of this logic, endpoints matching only the first label has priority P(N-1) i.e. second lowest priority.</br>4. All the other endpoints have priority P(N) i.e. lowest priority.</br></br>Note: For a label to be considered for match, the previous labels must match, i.e. nth label would be considered matched only if first n-1 labels match.</br></br>It can be any label specified on both client and server workloads.</br>The following labels which have special semantic meaning are also supported:</br></br>- `topology.istio.io/network` is used to match the network metadata of an endpoint, which can be specified by pod/namespace label `topology.istio.io/network`, sidecar env `ISTIO_META_NETWORK` or MeshNetworks.</br>- `topology.istio.io/cluster` is used to match the clusterID of an endpoint, which can be specified by pod label `topology.istio.io/cluster` or pod env `ISTIO_META_CLUSTER_ID`.</br>- `topology.kubernetes.io/region` is used to match the region metadata of an endpoint, which maps to Kubernetes node label `topology.kubernetes.io/region` or the deprecated label `failure-domain.beta.kubernetes.io/region`.</br>- `topology.kubernetes.io/zone` is used to match the zone metadata of an endpoint, which maps to Kubernetes node label `topology.kubernetes.io/zone` or the deprecated label `failure-domain.beta.kubernetes.io/zone`.</br>- `topology.istio.io/subzone` is used to match the subzone metadata of an endpoint, which maps to Istio node label `topology.istio.io/subzone`.</br>- `kubernetes.io/hostname` is used to match the current node of an endpoint, which maps to Kubernetes node label `kubernetes.io/hostname`.</br></br>The below topology config indicates the following priority levels:</br></br>```yaml</br>failoverPriority:</br>- "topology.istio.io/network"</br>- "topology.kubernetes.io/region"</br>- "topology.kubernetes.io/zone"</br>- "topology.istio.io/subzone"</br>```</br></br>1. endpoints match same [network, region, zone, subzone] label with the client proxy have the highest priority.</br>2. endpoints have same [network, region, zone] label but different [subzone] label with the client proxy have the second highest priority.</br>3. endpoints have same [network, region] label but different [zone] label with the client proxy have the third highest priority.</br>4. endpoints have same [network] but different [region] labels with the client proxy have the fourth highest priority.</br>5. all the other endpoints have the same lowest priority.</br></br>Suppose a service associated endpoints reside in multi clusters, the below example represents:</br>1. endpoints in `clusterA` and has `version=v1` label have P(0) priority.</br>2. endpoints not in `clusterA` but has `version=v1` label have P(1) priority.</br>2. all the other endpoints have P(2) priority.</br></br>```yaml</br>failoverPriority:</br>- "version=v1"</br>- "topology.istio.io/cluster=clusterA"</br>```</br></br>Optional: only one of distribute, failover or failoverPriority can be set.</br>And it should be used together with `OutlierDetection` to detect unhealthy endpoints, otherwise has no effect. |  |
| enabled | [BoolValue](#bool-value)| `BoolValue` |  | |  |  |



### <span id="locality-load-balancer-setting-distribute"></span> LocalityLoadBalancerSetting_Distribute


> `*` - matches all localities

`us-west/*` - all zones and sub-zones within the us-west region

`us-west/zone-1/*` - all sub-zones within us-west/zone-1
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| From | string| `string` |  | | Originating locality, '/' separated, e.g. 'region/zone/sub_zone'. |  |
| To | map of uint32 (formatted integer)| `map[string]uint32` |  | | Map of upstream localities to traffic distribution weights. The sum of</br>all weights should be 100. Any locality not present will</br>receive no traffic. |  |



### <span id="locality-load-balancer-setting-failover"></span> LocalityLoadBalancerSetting_Failover


> Specify the traffic failover policy across regions. Since zone and sub-zone
failover is supported by default this only needs to be specified for
regions when the operator needs to constrain traffic failover so that
the default behavior of failing over to any endpoint globally does not
apply. This is useful when failing over traffic across regions would not
improve service health or may need to be restricted for other reasons
like regulatory controls.
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| From | string| `string` |  | | Originating region. |  |
| To | string| `string` |  | | Destination region the traffic will fail over to when endpoints in</br>the 'from' region becomes unhealthy. |  |



### <span id="log"></span> Log


> Log is a log emitted in a span
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Fields | [][KeyValue](#key-value)| `[]*KeyValue` |  | |  |  |
| Timestamp | uint64 (formatted integer)| `uint64` |  | |  |  |



### <span id="log-line"></span> LogLine


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Result | string| `string` |  | |  |  |
| Test | string| `string` |  | |  |  |
| Time | date-time (formatted string)| `strfmt.DateTime` |  | |  |  |



### <span id="m-tls-status"></span> MTLSStatus


> MTLSStatus describes the current mTLS status of a mesh entity
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| AutoMTLSEnabled | boolean| `bool` |  | |  |  |
| Cluster | string| `string` |  | |  |  |
| MinTLS | string| `string` |  | |  |  |
| Namespace | string| `string` |  | |  |  |
| Status | string| `string` | ✓ | | mTLS status: MTLS_ENABLED, MTLS_PARTIALLY_ENABLED, MTLS_NOT_ENABLED, MTLS_DISABLED, UNSET, MTLS_VALIDATION_ERROR | `MTLS_ENABLED` |



### <span id="managed-fields-entry"></span> ManagedFieldsEntry


> ManagedFieldsEntry is a workflow-id, a FieldSet and the group version of the resource
that the fieldset applies to.
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| APIVersion | string| `string` |  | | APIVersion defines the version of this resource that this field set</br>applies to. The format is "group/version" just like the top-level</br>APIVersion field. It is necessary to track the version of a field</br>set because it cannot be automatically converted. |  |
| FieldsType | string| `string` |  | | FieldsType is the discriminator for the different fields format and version.</br>There is currently only one possible value: "FieldsV1" |  |
| Manager | string| `string` |  | | Manager is an identifier of the workflow managing these fields. |  |
| Subresource | string| `string` |  | | Subresource is the name of the subresource used to update that object, or</br>empty string if the object was updated through the main resource. The</br>value of this field is used to distinguish between managers, even if they</br>share the same name. For example, a status update will be distinct from a</br>regular update using the same manager name.</br>Note that the APIVersion field is not related to the Subresource field and</br>it always corresponds to the version of the main resource. |  |
| Time | string| `string` |  | | Time is the timestamp of when the ManagedFields entry was added. The</br>timestamp will also be updated if a field is added, the manager</br>changes any of the owned fields value or removes a field. The</br>timestamp does not update when a field is removed from the entry</br>because another manager took it over. |  |
| fieldsV1 | [FieldsV1](#fields-v1)| `FieldsV1` |  | |  |  |
| operation | [ManagedFieldsOperationType](#managed-fields-operation-type)| `ManagedFieldsOperationType` |  | |  |  |



### <span id="managed-fields-operation-type"></span> ManagedFieldsOperationType


  

| Name | Type | Go type | Default | Description | Example |
|------|------|---------| ------- |-------------|---------|
| ManagedFieldsOperationType | string| string | |  |  |



### <span id="mesh"></span> Mesh


> There can be multiple primaries on a single cluster when istio revisions are used. A single
primary can also manage multiple clusters (primary-remote deployment).
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| ControlPlanes | [][ControlPlane](#control-plane)| `[]*ControlPlane` |  | | ControlPlanes that share the same mesh ID. |  |
| ExternalKiali | [ExternalKialiInstance](#external-kiali-instance)| `ExternalKialiInstance` |  | |  |  |



### <span id="mesh-config"></span> MeshConfig


> MeshConfig wraps the istio.MeshConfig solely to override json Marshaling
for some fields. See MarshalJSON for more details.
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| AccessLogFile | string| `string` |  | | File address for the proxy access log (e.g. /dev/stdout).</br>Empty value disables access logging. |  |
| AccessLogFormat | string| `string` |  | | Format for the proxy access log</br>Empty value results in proxy's default access log format |  |
| CaCertificates | [][MeshConfigCertificateData](#mesh-config-certificate-data)| `[]*MeshConfigCertificateData` |  | | The extra root certificates for workload-to-workload communication.</br>The plugin certificates (the 'cacerts' secret) or self-signed certificates (the 'istio-ca-secret' secret)</br>are automatically added by Istiod.</br>The CA certificate that signs the workload certificates is automatically added by Istio Agent. |  |
| Certificates | [][V1alpha1Certificate](#v1alpha1-certificate)| `[]*V1alpha1Certificate` |  | | $hide_from_docs</br>Configure the provision of certificates.</br></br>Note: Deprecated, please refer to Cert-Manager or other cert provisioning solutions to sign DNS certificates.</br></br>Deprecated: Marked as deprecated in mesh/v1alpha1/config.proto. |  |
| ConfigSources | [][ConfigSource](#config-source)| `[]*ConfigSource` |  | | ConfigSource describes a source of configuration data for networking</br>rules, and other Istio configuration artifacts. Multiple data sources</br>can be configured for a single control plane. |  |
| DefaultDestinationRuleExportTo | []string| `[]string` |  | | The default value for the `DestinationRule.exportTo` field. Has the same</br>syntax as `defaultServiceExportTo`.</br></br>If not set the system will use "*" as the default value which implies that</br>destination rules are exported to all namespaces |  |
| DefaultServiceExportTo | []string| `[]string` |  | | The default value for the ServiceEntry.exportTo field and services</br>imported through container registry integrations, e.g. this applies to</br>Kubernetes Service resources. The value is a list of namespace names and</br>reserved namespace aliases. The allowed namespace aliases are:</br>```</br>- - All Namespaces</br>. - Current Namespace</br>~ - No Namespace</br>```</br>If not set the system will use "*" as the default value which implies that</br>services are exported to all namespaces.</br></br>`All namespaces` is a reasonable default for implementations that don't</br>need to restrict access or visibility of services across namespace</br>boundaries. If that requirement is present it is generally good practice to</br>make the default `Current namespace` so that services are only visible</br>within their own namespaces by default. Operators can then expand the</br>visibility of services to other namespaces as needed. Use of `No Namespace`</br>is expected to be rare but can have utility for deployments where</br>dependency management needs to be precise even within the scope of a single</br>namespace.</br></br>For further discussion see the reference documentation for `ServiceEntry`,</br>`Sidecar`, and `Gateway`. |  |
| DefaultVirtualServiceExportTo | []string| `[]string` |  | | The default value for the VirtualService.exportTo field. Has the same</br>syntax as `defaultServiceExportTo`.</br></br>If not set the system will use "*" as the default value which implies that</br>virtual services are exported to all namespaces |  |
| DisableEnvoyListenerLog | boolean| `bool` |  | | This flag disables Envoy Listener logs.</br>See [Listener Access Log](https://www.envoyproxy.io/docs/envoy/latest/api-v3/config/listener/v3/listener.proto#envoy-v3-api-field-config-listener-v3-listener-access-log)</br>Istio Enables Envoy's listener access logs on "NoRoute" response flag.</br>Default value is `false`. |  |
| DiscoverySelectors | [][V1alpha1LabelSelector](#v1alpha1-label-selector)| `[]*V1alpha1LabelSelector` |  | | A list of Kubernetes selectors that specify the set of namespaces that Istio considers when</br>computing configuration updates for sidecars. This can be used to reduce Istio's computational load</br>by limiting the number of entities (including services, pods, and endpoints) that are watched and processed.</br>If omitted, Istio will use the default behavior of processing all namespaces in the cluster.</br>Elements in the list are disjunctive (OR semantics), i.e. a namespace will be included if it matches any selector.</br>The following example selects any namespace that matches either below:</br>1. The namespace has both of these labels: `env: prod` and `region: us-east1`</br>2. The namespace has label `app` equal to `cassandra` or `spark`.</br>```yaml</br>discoverySelectors:</br>- matchLabels:</br>env: prod</br>region: us-east1</br>- matchExpressions:</br>- key: app</br>operator: In</br>values:</br>- cassandra</br>- spark</br></br>```</br>Refer to the [Kubernetes selector docs](https://kubernetes.io/docs/concepts/overview/working-with-objects/labels/#label-selectors)</br>for additional detail on selector semantics. |  |
| EnableEnvoyAccessLogService | boolean| `bool` |  | | This flag enables Envoy's gRPC Access Log Service.</br>See [Access Log Service](https://www.envoyproxy.io/docs/envoy/latest/api-v3/extensions/access_loggers/grpc/v3/als.proto)</br>for details about Envoy's gRPC Access Log Service API.</br>Default value is `false`. |  |
| EnableTracing | boolean| `bool` |  | | Flag to control generation of trace spans and request IDs.</br>Requires a trace span collector defined in the proxy configuration. |  |
| ExtensionProviders | [][MeshConfigExtensionProvider](#mesh-config-extension-provider)| `[]*MeshConfigExtensionProvider` |  | | Defines a list of extension providers that extend Istio's functionality. For example, the AuthorizationPolicy</br>can be used with an extension provider to delegate the authorization decision to a custom authorization system. |  |
| InboundClusterStatName | string| `string` |  | | Name to be used while emitting statistics for inbound clusters. The same pattern is used while computing stat prefix for</br>network filters like TCP and Redis.</br>By default, Istio emits statistics with the pattern `inbound|<port>|<port-name>|<service-FQDN>`.</br>For example `inbound|7443|grpc-reviews|reviews.prod.svc.cluster.local`. This can be used to override that pattern.</br></br>A Pattern can be composed of various pre-defined variables. The following variables are supported.</br></br>- `%SERVICE%` - Will be substituted with short hostname of the service.</br>- `%SERVICE_NAME%` - Will be substituted with name of the service.</br>- `%SERVICE_FQDN%` - Will be substituted with FQDN of the service.</br>- `%SERVICE_PORT%` - Will be substituted with port of the service.</br>- `%TARGET_PORT%`  - Will be substituted with the target port of the service.</br>- `%SERVICE_PORT_NAME%` - Will be substituted with port name of the service.</br></br>Following are some examples of supported patterns for reviews:</br></br>- `%SERVICE_FQDN%_%SERVICE_PORT%` will use reviews.prod.svc.cluster.local_7443 as the stats name.</br>- `%SERVICE%` will use reviews.prod as the stats name. |  |
| IngressClass | string| `string` |  | | Class of ingress resources to be processed by Istio ingress</br>controller. This corresponds to the value of</br>`kubernetes.io/ingress.class` annotation. |  |
| IngressSelector | string| `string` |  | | Defines which gateway deployment to use as the Ingress controller. This field corresponds to</br>the Gateway.selector field, and will be set as `istio: INGRESS_SELECTOR`.</br>By default, `ingressgateway` is used, which will select the default IngressGateway as it has the</br>`istio: ingressgateway` labels.</br>It is recommended that this is the same value as ingressService. |  |
| IngressService | string| `string` |  | | Name of the Kubernetes service used for the istio ingress controller.</br>If no ingress controller is specified, the default value `istio-ingressgateway` is used. |  |
| OutboundClusterStatName | string| `string` |  | | Name to be used while emitting statistics for outbound clusters. The same pattern is used while computing stat prefix for</br>network filters like TCP and Redis.</br>By default, Istio emits statistics with the pattern `outbound|<port>|<subsetname>|<service-FQDN>`.</br>For example `outbound|8080|v2|reviews.prod.svc.cluster.local`. This can be used to override that pattern.</br></br>A Pattern can be composed of various pre-defined variables. The following variables are supported.</br></br>- `%SERVICE%` - Will be substituted with short hostname of the service.</br>- `%SERVICE_NAME%` - Will be substituted with name of the service.</br>- `%SERVICE_FQDN%` - Will be substituted with FQDN of the service.</br>- `%SERVICE_PORT%` - Will be substituted with port of the service.</br>- `%SERVICE_PORT_NAME%` - Will be substituted with port name of the service.</br>- `%SUBSET_NAME%` - Will be substituted with subset.</br></br>Following are some examples of supported patterns for reviews:</br></br>- `%SERVICE_FQDN%_%SERVICE_PORT%` will use `reviews.prod.svc.cluster.local_7443` as the stats name.</br>- `%SERVICE%` will use reviews.prod as the stats name. |  |
| ProxyHttpPort | int32 (formatted integer)| `int32` |  | | Port on which Envoy should listen for HTTP PROXY requests if set. |  |
| ProxyInboundListenPort | int32 (formatted integer)| `int32` |  | | Port on which Envoy should listen for all inbound traffic to the pod/vm will be captured to.</br>Default port is 15006. |  |
| ProxyListenPort | int32 (formatted integer)| `int32` |  | | Port on which Envoy should listen for all outbound traffic to other services.</br>Default port is 15001. |  |
| RootNamespace | string| `string` |  | | The namespace to treat as the administrative root namespace for</br>Istio configuration. When processing a leaf namespace Istio will search for</br>declarations in that namespace first and if none are found it will</br>search in the root namespace. Any matching declaration found in the root</br>namespace is processed as if it were declared in the leaf namespace.</br></br>The precise semantics of this processing are documented on each resource</br>type. |  |
| ServiceScopeConfigs | [][MeshConfigServiceScopeConfigs](#mesh-config-service-scope-configs)| `[]*MeshConfigServiceScopeConfigs` |  | | Scope to be applied to select services. |  |
| ServiceSettings | [][MeshConfigServiceSettings](#mesh-config-service-settings)| `[]*MeshConfigServiceSettings` |  | | $hide_from_docs</br>Settings to be applied to select services. |  |
| TrustDomain | string| `string` |  | | The trust domain corresponds to the trust root of a system.</br>Refer to [SPIFFE-ID](https://github.com/spiffe/spiffe/blob/master/standards/SPIFFE-ID.md#21-trust-domain) |  |
| TrustDomainAliases | []string| `[]string` |  | | The trust domain aliases represent the aliases of `trustDomain`.</br>For example, if we have</br>```yaml</br>trustDomain: td1</br>trustDomainAliases: ["td2", "td3"]</br>```</br>Any service with the identity `td1/ns/foo/sa/a-service-account`, `td2/ns/foo/sa/a-service-account`,</br>or `td3/ns/foo/sa/a-service-account` will be treated the same in the Istio mesh. |  |
| access_log_encoding | [MeshConfigAccessLogEncoding](#mesh-config-access-log-encoding)| `MeshConfigAccessLogEncoding` |  | |  |  |
| ca | [MeshConfigCA](#mesh-config-c-a)| `MeshConfigCA` |  | |  |  |
| connect_timeout | [DurationpbDuration](#durationpb-duration)| `DurationpbDuration` |  | |  |  |
| default_config | [ProxyConfig](#proxy-config)| `ProxyConfig` |  | |  |  |
| default_http_retry_policy | [HTTPRetry](#http-retry)| `HTTPRetry` |  | |  |  |
| default_providers | [MeshConfigDefaultProviders](#mesh-config-default-providers)| `MeshConfigDefaultProviders` |  | |  |  |
| dns_refresh_rate | [DurationpbDuration](#durationpb-duration)| `DurationpbDuration` |  | |  |  |
| enable_auto_mtls | [BoolValue](#bool-value)| `BoolValue` |  | |  |  |
| enable_prometheus_merge | [BoolValue](#bool-value)| `BoolValue` |  | |  |  |
| h2_upgrade_policy | [MeshConfigH2UpgradePolicy](#mesh-config-h2-upgrade-policy)| `MeshConfigH2UpgradePolicy` |  | |  |  |
| hbone_idle_timeout | [DurationpbDuration](#durationpb-duration)| `DurationpbDuration` |  | |  |  |
| inbound_traffic_policy | [MeshConfigInboundTrafficPolicy](#mesh-config-inbound-traffic-policy)| `MeshConfigInboundTrafficPolicy` |  | |  |  |
| ingress_controller_mode | [MeshConfigIngressControllerMode](#mesh-config-ingress-controller-mode)| `MeshConfigIngressControllerMode` |  | |  |  |
| locality_lb_setting | [LocalityLoadBalancerSetting](#locality-load-balancer-setting)| `LocalityLoadBalancerSetting` |  | |  |  |
| mesh_mTLS | [MeshConfigTLSConfig](#mesh-config-tls-config)| `MeshConfigTLSConfig` |  | |  |  |
| outbound_traffic_policy | [MeshConfigOutboundTrafficPolicy](#mesh-config-outbound-traffic-policy)| `MeshConfigOutboundTrafficPolicy` |  | |  |  |
| path_normalization | [MeshConfigProxyPathNormalization](#mesh-config-proxy-path-normalization)| `MeshConfigProxyPathNormalization` |  | |  |  |
| protocol_detection_timeout | [DurationpbDuration](#durationpb-duration)| `DurationpbDuration` |  | |  |  |
| tcp_keepalive | [ConnectionPoolSettingsTCPSettingsTCPKeepalive](#connection-pool-settings-tcp-settings-tcp-keepalive)| `ConnectionPoolSettingsTCPSettingsTCPKeepalive` |  | |  |  |
| tls_defaults | [MeshConfigTLSConfig](#mesh-config-tls-config)| `MeshConfigTLSConfig` |  | |  |  |
| verify_certificate_at_client | [BoolValue](#bool-value)| `BoolValue` |  | |  |  |



### <span id="mesh-config-map"></span> MeshConfigMap


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| mesh | [MeshConfig](#mesh-config)| `MeshConfig` |  | |  |  |
| meshNetworks | [MeshNetworks](#mesh-networks)| `MeshNetworks` |  | |  |  |



### <span id="mesh-config-source"></span> MeshConfigSource


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Cluster | string| `string` |  | | Cluster of the configmap. |  |
| Name | string| `string` |  | | Name of the configmap. |  |
| Namespace | string| `string` |  | | Namespace of the configmap. |  |
| Path | string| `string` |  | | Path is set when the configuration is loaded from a file mounted into istiod. |  |
| configMap | [MeshConfigMap](#mesh-config-map)| `MeshConfigMap` |  | |  |  |



### <span id="mesh-config-access-log-encoding"></span> MeshConfig_AccessLogEncoding


  

| Name | Type | Go type | Default | Description | Example |
|------|------|---------| ------- |-------------|---------|
| MeshConfig_AccessLogEncoding | int32 (formatted integer)| int32 | |  |  |



### <span id="mesh-config-c-a"></span> MeshConfig_CA


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Address | string| `string` |  | | REQUIRED. Address of the CA server implementing the Istio CA gRPC API.</br>Can be IP address or a fully qualified DNS name with port</br>Eg: custom-ca.default.svc.cluster.local:8932, 192.168.23.2:9000 |  |
| IstiodSide | boolean| `bool` |  | `true`| Use istiodSide to specify CA Server integrate to Istiod side or Agent side |  |
| request_timeout | [DurationpbDuration](#durationpb-duration)| `DurationpbDuration` |  | |  |  |
| tls_settings | [ClientTLSSettings](#client-tls-settings)| `ClientTLSSettings` |  | |  |  |



### <span id="mesh-config-certificate-data"></span> MeshConfig_CertificateData


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| CertSigners | []string| `[]string` |  | | Optional. Specify the kubernetes signers (External CA) that use this trustAnchor</br>when Istiod is acting as RA(registration authority)</br>If set, they are used for these signers. Otherwise, this trustAnchor is used for all signers. |  |
| CertificateData | [IsMeshConfigCertificateDataCertificateData](#is-mesh-config-certificate-data-certificate-data)| `IsMeshConfigCertificateDataCertificateData` |  | |  |  |
| TrustDomains | []string| `[]string` |  | | Optional. Specify the list of trust domains to which this trustAnchor data belongs.</br>If set, they are used for these trust domains. Otherwise, this trustAnchor is used for default trust domain</br>and its aliases.</br>Note that we can have multiple trustAnchor data for a same trustDomain.</br>In that case, trustAnchors with a same trust domain will be merged and used together to verify peer certificates.</br>If neither certSigners nor trustDomains is set, this trustAnchor is used for all trust domains and all signers.</br>If only trustDomains is set, this trustAnchor is used for these trustDomains and all signers.</br>If only certSigners is set, this trustAnchor is used for these certSigners and all trust domains.</br>If both certSigners and trustDomains is set, this trustAnchor is only used for these signers and trust domains. |  |



### <span id="mesh-config-default-providers"></span> MeshConfig_DefaultProviders


> These names must match a provider defined in `extensionProviders` that is
one of the supported tracing providers.
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| AccessLogging | []string| `[]string` |  | | Name of the default provider(s) for access logging. |  |
| Metrics | []string| `[]string` |  | | Name of the default provider(s) for metrics. |  |
| Tracing | []string| `[]string` |  | | Name of the default provider(s) for tracing. |  |



### <span id="mesh-config-extension-provider"></span> MeshConfig_ExtensionProvider


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Name | string| `string` |  | | REQUIRED. A unique name identifying the extension provider. |  |
| Provider | [IsMeshConfigExtensionProviderProvider](#is-mesh-config-extension-provider-provider)| `IsMeshConfigExtensionProviderProvider` |  | |  |  |



### <span id="mesh-config-h2-upgrade-policy"></span> MeshConfig_H2UpgradePolicy


  

| Name | Type | Go type | Default | Description | Example |
|------|------|---------| ------- |-------------|---------|
| MeshConfig_H2UpgradePolicy | int32 (formatted integer)| int32 | |  |  |



### <span id="mesh-config-inbound-traffic-policy"></span> MeshConfig_InboundTrafficPolicy


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| mode | [MeshConfigInboundTrafficPolicyMode](#mesh-config-inbound-traffic-policy-mode)| `MeshConfigInboundTrafficPolicyMode` |  | |  |  |



### <span id="mesh-config-inbound-traffic-policy-mode"></span> MeshConfig_InboundTrafficPolicy_Mode


  

| Name | Type | Go type | Default | Description | Example |
|------|------|---------| ------- |-------------|---------|
| MeshConfig_InboundTrafficPolicy_Mode | int32 (formatted integer)| int32 | |  |  |



### <span id="mesh-config-ingress-controller-mode"></span> MeshConfig_IngressControllerMode


  

| Name | Type | Go type | Default | Description | Example |
|------|------|---------| ------- |-------------|---------|
| MeshConfig_IngressControllerMode | int32 (formatted integer)| int32 | |  |  |



### <span id="mesh-config-outbound-traffic-policy"></span> MeshConfig_OutboundTrafficPolicy


> `OutboundTrafficPolicy` sets the default behavior of the sidecar for
handling unknown outbound traffic from the application.
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| mode | [MeshConfigOutboundTrafficPolicyMode](#mesh-config-outbound-traffic-policy-mode)| `MeshConfigOutboundTrafficPolicyMode` |  | |  |  |
| tls | [ClientTLSSettings](#client-tls-settings)| `ClientTLSSettings` |  | |  |  |



### <span id="mesh-config-outbound-traffic-policy-mode"></span> MeshConfig_OutboundTrafficPolicy_Mode


  

| Name | Type | Go type | Default | Description | Example |
|------|------|---------| ------- |-------------|---------|
| MeshConfig_OutboundTrafficPolicy_Mode | int32 (formatted integer)| int32 | |  |  |



### <span id="mesh-config-proxy-path-normalization"></span> MeshConfig_ProxyPathNormalization


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| normalization | [MeshConfigProxyPathNormalizationNormalizationType](#mesh-config-proxy-path-normalization-normalization-type)| `MeshConfigProxyPathNormalizationNormalizationType` |  | |  |  |



### <span id="mesh-config-proxy-path-normalization-normalization-type"></span> MeshConfig_ProxyPathNormalization_NormalizationType


  

| Name | Type | Go type | Default | Description | Example |
|------|------|---------| ------- |-------------|---------|
| MeshConfig_ProxyPathNormalization_NormalizationType | int32 (formatted integer)| int32 | |  |  |



### <span id="mesh-config-service-scope-configs"></span> MeshConfig_ServiceScopeConfigs


> For example, the following configures the scope of all services with the "istio.io/global" label
in matching namespaces to be available globally:

```yaml
serviceScopeConfigs:
- namespacesSelector:
matchExpressions:
- key: istio.io/global
operator: In
values: [true]
servicesSelector:
matchExpressions:
- key: istio.io/global
operator: Exists
scope: GLOBAL

```
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| namespace_selector | [V1alpha1LabelSelector](#v1alpha1-label-selector)| `V1alpha1LabelSelector` |  | |  |  |
| scope | [MeshConfigServiceScopeConfigsScope](#mesh-config-service-scope-configs-scope)| `MeshConfigServiceScopeConfigsScope` |  | |  |  |
| services_selector | [V1alpha1LabelSelector](#v1alpha1-label-selector)| `V1alpha1LabelSelector` |  | |  |  |



### <span id="mesh-config-service-scope-configs-scope"></span> MeshConfig_ServiceScopeConfigs_Scope


> The scope of the matching service. Used to determine if the service is available locally
(cluster local) or globally (mesh-wide).
  



| Name | Type | Go type | Default | Description | Example |
|------|------|---------| ------- |-------------|---------|
| MeshConfig_ServiceScopeConfigs_Scope | int32 (formatted integer)| int32 | | The scope of the matching service. Used to determine if the service is available locally</br>(cluster local) or globally (mesh-wide). |  |



### <span id="mesh-config-service-settings"></span> MeshConfig_ServiceSettings


> For example, the following configures all services in namespace "foo" as well as the
"bar" service in namespace "baz" to be considered cluster-local:

```yaml
serviceSettings:
- settings:
clusterLocal: true
hosts:
- "*.foo.svc.cluster.local"
- "bar.baz.svc.cluster.local"

```

When in ambient mode, if ServiceSettings are defined they will be considered in addition to the
ServiceScopeConfigs. If a service is defined by ServiceSetting to be cluster local and matches a
global service scope selector, the service will be considered cluster local. If a service is
considered global by ServiceSettings and does not match a global service scope selector
the serive will be considered local. Local scope takes precedence over global scope. Since
ServiceScopeConfigs is local by default, all services are considered local unless it is considered
global by ServiceSettings AND ServiceScopeConfigs.
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Hosts | []string| `[]string` |  | | The services to which the Settings should be applied. Services are selected using the hostname</br>matching rules used by DestinationRule.</br></br>For example: foo.bar.svc.cluster.local, *.baz.svc.cluster.local |  |
| settings | [MeshConfigServiceSettingsSettings](#mesh-config-service-settings-settings)| `MeshConfigServiceSettingsSettings` |  | |  |  |



### <span id="mesh-config-service-settings-settings"></span> MeshConfig_ServiceSettings_Settings


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| ClusterLocal | boolean| `bool` |  | | If true, specifies that the client and service endpoints must reside in the same cluster.</br>By default, in multi-cluster deployments, the Istio control plane assumes all service</br>endpoints to be reachable from any client in any of the clusters which are part of the</br>mesh. This configuration option limits the set of service endpoints visible to a client</br>to be cluster scoped.</br></br>There are some common scenarios when this can be useful:</br></br>- A service (or group of services) is inherently local to the cluster and has local storage</br>for that cluster. For example, the kube-system namespace (e.g. the Kube API Server).</br>- A mesh administrator wants to slowly migrate services to Istio. They might start by first</br>having services cluster-local and then slowly transition them to mesh-wide. They could do</br>this service-by-service (e.g. mysvc.myns.svc.cluster.local) or as a group</br>(e.g. *.myns.svc.cluster.local).</br></br>By default Istio will consider kubernetes.default.svc (i.e. the API Server) as well as all</br>services in the kube-system namespace to be cluster-local, unless explicitly overridden here. |  |



### <span id="mesh-config-tls-config"></span> MeshConfig_TLSConfig


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| CipherSuites | []string| `[]string` |  | | Optional: If specified, the TLS connection will only support the specified cipher list when negotiating TLS 1.0-1.2.</br>If not specified, the following cipher suites will be used:</br>```</br>ECDHE-ECDSA-AES256-GCM-SHA384</br>ECDHE-RSA-AES256-GCM-SHA384</br>ECDHE-ECDSA-AES128-GCM-SHA256</br>ECDHE-RSA-AES128-GCM-SHA256</br>AES256-GCM-SHA384</br>AES128-GCM-SHA256</br>``` |  |
| EcdhCurves | []string| `[]string` |  | | Optional: If specified, the TLS connection will only support the specified ECDH curves for the DH key exchange.</br>If not specified, the default curves enforced by Envoy will be used. For details about the default curves, refer to</br>[Ecdh Curves](https://www.envoyproxy.io/docs/envoy/latest/api-v3/extensions/transport_sockets/tls/v3/common.proto). |  |
| min_protocol_version | [MeshConfigTLSConfigTLSProtocol](#mesh-config-tls-config-tls-protocol)| `MeshConfigTLSConfigTLSProtocol` |  | |  |  |



### <span id="mesh-config-tls-config-tls-protocol"></span> MeshConfig_TLSConfig_TLSProtocol


  

| Name | Type | Go type | Default | Description | Example |
|------|------|---------| ------- |-------------|---------|
| MeshConfig_TLSConfig_TLSProtocol | int32 (formatted integer)| int32 | |  |  |



### <span id="mesh-networks"></span> MeshNetworks


> MeshNetworks(file/config map):

```yaml
networks:

network1:
endpoints:
- fromRegistry: registry1 #must match kubeconfig name in Kubernetes secret
- fromCidr: 192.168.100.0/22 #a VM network for example
gateways:
- registryServiceName: istio-ingressgateway.istio-system.svc.cluster.local
port: 15443
locality: us-east-1a
- address: 192.168.100.1
port: 15443
locality: us-east-1a

```

If `ENABLE_HCM_INTERNAL_NETWORKS` is set to true, MeshNetworks can be used to
to explicitly define the networks in Envoy's internal address configuration.
Envoy uses the IPs in the `internalAddressConfig` to decide whether or not to sanitize
Envoy headers. If the IP address is listed as internal, the Envoy headers are not
sanitized. As of Envoy 1.33, the default value for `internalAddressConfig` is set to
an empty set. Previously, the default value was the set of all private IPs. Setting
the `internalAddressConfig` to all private IPs (via Envoy's previous default behavior
or via the MeshNetworks) will leave users with an Istio Ingress Gateway potentially
vulnerable to `x-envoy` header manipulation by external sources. More information about
this vulnerability can be found here:
https://github.com/envoyproxy/envoy/security/advisories/GHSA-ffhv-fvxq-r6mf
To preserve headers, you must explicitly configure MeshNetworks and set
`ENABLE_HCM_INTERNAL_NETWORKS` to true. Envoy's `internalAddressConfig` will be set to
the endpointed specified by `fromCidr`.
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Networks | map of [Network](#network)| `map[string]Network` |  | | The set of networks inside this mesh. Each network should</br>have a unique name and information about how to infer the endpoints in</br>the network as well as the gateways associated with the network. |  |



### <span id="metric"></span> Metric


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Datapoints | [][Datapoint](#datapoint)| `[]*Datapoint` |  | |  |  |
| Labels | map of string| `map[string]string` |  | |  |  |
| Name | string| `string` |  | |  |  |
| Stat | string| `string` |  | |  |  |



### <span id="metrics-stats"></span> MetricsStats


> MetricsStats contains opinionated statistics on metrics on a single target. Currently limited to response times (avg/percentiles over interval)
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| ResponseTimes | [][Stat](#stat)| `[]*Stat` |  | |  |  |



### <span id="metrics-stats-queries"></span> MetricsStatsQueries


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Queries | [][MetricsStatsQuery](#metrics-stats-query)| `[]*MetricsStatsQuery` |  | |  |  |



### <span id="metrics-stats-query"></span> MetricsStatsQuery


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Avg | boolean| `bool` |  | |  |  |
| Direction | string| `string` |  | |  |  |
| PeerTarget | [Target](#target)| `Target` |  | |  |  |
| Quantiles | []string| `[]string` |  | |  |  |
| RawInterval | string| `string` |  | |  |  |
| RawQueryTime | int64 (formatted integer)| `int64` |  | |  |  |
| Reporters | []string| `[]string` |  | |  |  |
| Target | [Target](#target)| `Target` |  | |  |  |



### <span id="models-address"></span> ModelsAddress


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| IP | string| `string` |  | |  |  |
| Kind | string| `string` |  | |  |  |
| Name | string| `string` |  | |  |  |



### <span id="models-certificate"></span> ModelsCertificate


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Accessible | boolean| `bool` |  | |  |  |
| ClusterName | string| `string` |  | |  |  |
| ConfigMapName | string| `string` |  | |  |  |
| DNSNames | []string| `[]string` |  | |  |  |
| Error | string| `string` |  | |  |  |
| Issuer | string| `string` |  | |  |  |
| NotAfter | date-time (formatted string)| `strfmt.DateTime` |  | |  |  |
| NotBefore | date-time (formatted string)| `strfmt.DateTime` |  | |  |  |



### <span id="models-endpoint"></span> ModelsEndpoint


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| addresses | [Addresses](#addresses)| `Addresses` |  | |  |  |
| ports | [Ports](#ports)| `Ports` |  | |  |  |



### <span id="models-port"></span> ModelsPort


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Name | string| `string` |  | |  |  |
| Port | int32 (formatted integer)| `int32` |  | |  |  |
| Protocol | string| `string` |  | |  |  |



### <span id="models-reference"></span> ModelsReference


> Reference holds some information on the pod creator
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Kind | string| `string` |  | |  |  |
| Name | string| `string` |  | |  |  |



### <span id="models-service"></span> ModelsService


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| AdditionalDetails | [][AdditionalItem](#additional-item)| `[]*AdditionalItem` |  | |  |  |
| Annotations | map of string| `map[string]string` |  | |  |  |
| Cluster | string| `string` |  | |  |  |
| CreatedAt | string| `string` |  | |  |  |
| ExternalName | string| `string` |  | |  |  |
| HealthAnnotations | map of string| `map[string]string` |  | |  |  |
| Ip | string| `string` |  | |  |  |
| IpFamilies | [][IPFamily](#ip-family)| `[]IPFamily` |  | |  |  |
| Ips | []string| `[]string` |  | |  |  |
| Labels | map of string| `map[string]string` |  | |  |  |
| Name | string| `string` |  | |  |  |
| Namespace | string| `string` |  | |  |  |
| ResourceVersion | string| `string` |  | |  |  |
| Selectors | map of string| `map[string]string` |  | |  |  |
| Type | string| `string` |  | |  |  |
| ports | [Ports](#ports)| `Ports` |  | |  |  |



### <span id="models-workload"></span> ModelsWorkload


> Workload has the details of a workload
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| AdditionalDetails | [][AdditionalItem](#additional-item)| `[]*AdditionalItem` |  | | Additional details to display, such as configured annotations |  |
| Annotations | map of string| `map[string]string` |  | | Annotations of Deployment |  |
| AppLabel | boolean| `bool` | ✓ | | Define if Pods related to this Workload has the label App | `true` |
| AvailableReplicas | int32 (formatted integer)| `int32` | ✓ | | Number of available replicas | `1` |
| Cluster | string| `string` |  | | The kube cluster where this workload is located. |  |
| CreatedAt | string| `string` | ✓ | | Creation timestamp (in RFC3339 format) | `2018-07-31T12:24:17Z` |
| CurrentReplicas | int32 (formatted integer)| `int32` | ✓ | | Number of current replicas pods that matches controller selector labels | `2` |
| DashboardAnnotations | map of string| `map[string]string` |  | | Dashboard annotations |  |
| DesiredReplicas | int32 (formatted integer)| `int32` | ✓ | | Number of desired replicas defined by the user in the controller Spec | `2` |
| HealthAnnotations | map of string| `map[string]string` |  | | HealthAnnotations |  |
| IsAmbient | boolean| `bool` | ✓ | | Define if Pods related to this Workload has an IsAmbient deployed | `true` |
| IsGateway | boolean| `bool` | ✓ | | Define if this Workload is a gateway (but not a waypoint) | `true` |
| IsWaypoint | boolean| `bool` | ✓ | | Define if this Workload is an ambient waypoint | `true` |
| IsZtunnel | boolean| `bool` | ✓ | | Define if this Workload is an ambient ztunnel | `true` |
| IstioInjectionAnnotation | boolean| `bool` |  | | Define if Workload has an explicit Istio policy annotation</br>Istio supports this as a label as well - this will be defined if the label is set, too.</br>If both annotation and label are set, if any is false, injection is disabled.</br>It's mapped as a pointer to show three values nil, true, false |  |
| IstioReferences | [][IstioValidationKey](#istio-validation-key)| `[]*IstioValidationKey` |  | | Istio References |  |
| IstioSidecar | boolean| `bool` | ✓ | | Define if Pods related to this Workload has an IstioSidecar deployed | `true` |
| Labels | map of string| `map[string]string` |  | | Workload labels |  |
| Name | string| `string` | ✓ | | Name of the workload | `reviews-v1` |
| Namespace | string| `string` |  | | Namespace of the workload |  |
| PodCount | int64 (formatted integer)| `int64` | ✓ | | Number of current workload pods | `1` |
| ResourceVersion | string| `string` | ✓ | | Kubernetes ResourceVersion | `192892127` |
| Runtimes | [][Runtime](#runtime)| `[]*Runtime` |  | | Runtimes and associated dashboards |  |
| ServiceAccountNames | []string| `[]string` |  | | Names of the workload service accounts |  |
| Services | [][ServiceOverview](#service-overview)| `[]*ServiceOverview` |  | | Services that match workload selector |  |
| TemplateAnnotations | map of string| `map[string]string` |  | | TemplateAnnotations are the annotations on the pod template if the workload</br>has a pod template. |  |
| TemplateLabels | map of string| `map[string]string` |  | | TemplateLabels are the labels on the pod template if the workload</br>has a pod template. |  |
| ValidationKey | string| `string` |  | | ValidationKey is a pre-calculated key string: "cluster:namespace:name" |  |
| ValidationVersion | string| `string` |  | | ValidationVersion is a pre-calculated string representing the workload "version", basically</br>the workload information that, if changed, requires re-validation (including per-object ignore</br>rules and resolved waypoint references used by ambient checkers such as KIA1313). |  |
| VersionLabel | boolean| `bool` | ✓ | | Define if Pods related to this Workload has the label Version | `true` |
| WaypointServices | [][ServiceReferenceInfo](#service-reference-info)| `[]*ServiceReferenceInfo` |  | | Ambient waypoint services |  |
| WaypointWorkloads | [][WorkloadReferenceInfo](#workload-reference-info)| `[]*WorkloadReferenceInfo` |  | | Ambient waypoint workloads |  |
| additionalDetailSample | [AdditionalItem](#additional-item)| `AdditionalItem` |  | |  |  |
| gvk | [GroupVersionKind](#group-version-kind)| `GroupVersionKind` | ✓ | |  |  |
| health | [WorkloadHealth](#workload-health)| `WorkloadHealth` |  | |  |  |
| pods | [Pods](#pods)| `Pods` |  | |  |  |
| spireInfo | [SpireInfo](#spire-info)| `SpireInfo` |  | |  |  |
| validations | [IstioValidations](#istio-validations)| `IstioValidations` |  | |  |  |
| workloadEntries | [WorkloadEntries](#workload-entries)| `WorkloadEntries` |  | |  |  |



### <span id="models-workload-entry"></span> ModelsWorkloadEntry


> WorkloadEntry describes networking_v1.WorkloadEntry for Kiali, used in WorkloadGroups
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Annotations | map of string| `map[string]string` |  | |  |  |
| AppLabel | boolean| `bool` |  | |  |  |
| CreatedAt | string| `string` |  | |  |  |
| Labels | map of string| `map[string]string` |  | |  |  |
| Name | string| `string` |  | |  |  |
| ServiceAccountName | string| `string` |  | |  |  |
| Status | string| `string` |  | |  |  |
| StatusReason | string| `string` |  | |  |  |
| VersionLabel | boolean| `bool` |  | |  |  |



### <span id="monitoring-dashboard"></span> MonitoringDashboard


> MonitoringDashboard is the model representing custom monitoring dashboard, transformed from MonitoringDashboard config resource
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Aggregations | [][Aggregation](#aggregation)| `[]*Aggregation` |  | |  |  |
| Charts | [][Chart](#chart)| `[]*Chart` |  | |  |  |
| ExternalLinks | [][ExternalLink](#external-link)| `[]*ExternalLink` |  | |  |  |
| Name | string| `string` |  | |  |  |
| Rows | int64 (formatted integer)| `int64` |  | |  |  |
| Title | string| `string` |  | |  |  |



### <span id="monitoring-dashboard-external-link-variables"></span> MonitoringDashboardExternalLinkVariables


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| App | string| `string` |  | |  |  |
| Datasource | string| `string` |  | |  |  |
| Namespace | string| `string` |  | |  |  |
| Service | string| `string` |  | |  |  |
| Version | string| `string` |  | |  |  |
| Workload | string| `string` |  | |  |  |



### <span id="name-server"></span> NameServer


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| BindAddr | string| `string` |  | |  |  |
| Protocol | string| `string` |  | |  |  |
| SocketAddr | string| `string` |  | |  |  |
| TlsDnsName | string| `string` |  | |  |  |
| TrustNegativeResponses | boolean| `bool` |  | |  |  |



### <span id="namespace"></span> Namespace


> A Namespace provide a scope for names
This type is used to describe a set of objects.
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Annotations | map of string| `map[string]string` |  | | Specific annotations used in Kiali |  |
| Cluster | string| `string` | ✓ | | The name of the cluster | `east` |
| IsAmbient | boolean| `bool` | ✓ | | If has the Ambient annotations |  |
| IsControlPlane | boolean| `bool` | ✓ | | If the namespace is a control plane |  |
| Labels | map of string| `map[string]string` |  | | Labels for Namespace |  |
| Name | string| `string` | ✓ | | The id of the namespace. | `istio-system` |
| Revision | string| `string` |  | | Revision managing this namespace.</br>If the namespace has 'istio-injection: enabled' label,</br>it will be set to the 'default' revision. Otherwise</br>it matches on istio.io/rev. Note that his can also</br>be a Tag and not the actual revision. |  |



### <span id="namespace-app-health"></span> NamespaceAppHealth


> NamespaceAppsHealth is a list of app name x health for a given namespace
  



[NamespaceAppHealth](#namespace-app-health)

### <span id="namespace-health-aggregate"></span> NamespaceHealthAggregate


> NamespaceHealthAggregate is the pre-aggregated namespace health returned with cluster health (matches frontend)
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| WorstStatus | string| `string` |  | |  |  |
| statusApp | [NamespaceHealthBucket](#namespace-health-bucket)| `NamespaceHealthBucket` |  | |  |  |
| statusService | [NamespaceHealthBucket](#namespace-health-bucket)| `NamespaceHealthBucket` |  | |  |  |
| statusWorkload | [NamespaceHealthBucket](#namespace-health-bucket)| `NamespaceHealthBucket` |  | |  |  |



### <span id="namespace-health-bucket"></span> NamespaceHealthBucket


> NamespaceHealthBucket buckets entity names by health status (matches frontend NamespaceStatus)
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| InError | []string| `[]string` |  | |  |  |
| InNotReady | []string| `[]string` |  | |  |  |
| InSuccess | []string| `[]string` |  | |  |  |
| InWarning | []string| `[]string` |  | |  |  |
| NotAvailable | []string| `[]string` |  | |  |  |



### <span id="namespace-service-health"></span> NamespaceServiceHealth


> NamespaceServicesHealth is a list of service name x health for a given namespace
  



[NamespaceServiceHealth](#namespace-service-health)

### <span id="namespace-workload-health"></span> NamespaceWorkloadHealth


> NamespaceWorkloadsHealth is a list of workload name x health for a given namespace
  



[NamespaceWorkloadHealth](#namespace-workload-health)

### <span id="network"></span> Network


> Network provides information about the endpoints in a routable L3
network. A single routable L3 network can have one or more service
registries. Note that the network has no relation to the locality of the
endpoint. The endpoint locality will be obtained from the service
registry.
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Endpoints | [][NetworkNetworkEndpoints](#network-network-endpoints)| `[]*NetworkNetworkEndpoints` |  | | The list of endpoints in the network (obtained through the</br>constituent service registries or from CIDR ranges). All endpoints in</br>the network are directly accessible to one another. |  |
| Gateways | [][NetworkIstioNetworkGateway](#network-istio-network-gateway)| `[]*NetworkIstioNetworkGateway` |  | | Set of gateways associated with the network. |  |



### <span id="network-istio-network-gateway"></span> Network_IstioNetworkGateway


> The gateway associated with this network. Traffic from remote networks
will arrive at the specified gateway:port. All incoming traffic must
use mTLS.
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Gw | [IsNetworkIstioNetworkGatewayGw](#is-network-istio-network-gateway-gw)| `IsNetworkIstioNetworkGatewayGw` |  | |  |  |
| Locality | string| `string` |  | | The locality associated with an explicitly specified gateway (i.e. ip) |  |
| Port | uint32 (formatted integer)| `uint32` |  | | The port associated with the gateway. |  |



### <span id="network-network-endpoints"></span> Network_NetworkEndpoints


> 1. Implicitly: If the registry explicitly provides information about
the network to which the endpoint belongs to. In some cases, its
possible to indicate the network associated with the endpoint by
adding the `ISTIO_META_NETWORK` environment variable to the sidecar.

2. Explicitly:

a. By matching the registry name with one of the "fromRegistry"
in the mesh config. A "fromRegistry" can only be assigned to a
single network.

b. By matching the IP against one of the CIDR ranges in a mesh
config network. The CIDR ranges must not overlap and be assigned to
a single network.

(2) will override (1) if both are present.
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Ne | [IsNetworkNetworkEndpointsNe](#is-network-network-endpoints-ne)| `IsNetworkNetworkEndpointsNe` |  | |  |  |



### <span id="node-data"></span> NodeData


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Aggregate | string| `string` |  | |  |  |
| App | string| `string` |  | |  |  |
| Cluster | string| `string` |  | |  |  |
| DestServices | [][ServiceName](#service-name)| `[]*ServiceName` |  | |  |  |
| HasCB | boolean| `bool` |  | |  |  |
| HasFaultInjection | boolean| `bool` |  | |  |  |
| HasIngressWaypoint | boolean| `bool` |  | |  |  |
| HasMirroring | boolean| `bool` |  | |  |  |
| HasRequestRouting | boolean| `bool` |  | |  |  |
| HasRequestTimeout | boolean| `bool` |  | |  |  |
| HasTCPTrafficShifting | boolean| `bool` |  | |  |  |
| HasTrafficShifting | boolean| `bool` |  | |  |  |
| HasWorkloadEntry | [][WEInfo](#w-e-info)| `[]*WEInfo` |  | |  |  |
| HealthData | [any](#any)| `any` |  | |  |  |
| ID | string| `string` |  | |  |  |
| IsAmbient | boolean| `bool` |  | |  |  |
| IsBox | string| `string` |  | |  |  |
| IsDead | boolean| `bool` |  | |  |  |
| IsIdle | boolean| `bool` |  | |  |  |
| IsInaccessible | boolean| `bool` |  | |  |  |
| IsInjected | boolean| `bool` |  | |  |  |
| IsK8sGatewayAPI | boolean| `bool` |  | |  |  |
| IsOutOfMesh | boolean| `bool` |  | |  |  |
| IsOutside | boolean| `bool` |  | |  |  |
| IsRoot | boolean| `bool` |  | |  |  |
| IsWaypoint | boolean| `bool` |  | |  |  |
| Labels | map of string| `map[string]string` |  | |  |  |
| Namespace | string| `string` |  | |  |  |
| NodeType | string| `string` |  | |  |  |
| Parent | string| `string` |  | |  |  |
| Service | string| `string` |  | |  |  |
| Traffic | [][ProtocolTraffic](#protocol-traffic)| `[]*ProtocolTraffic` |  | |  |  |
| Version | string| `string` |  | |  |  |
| Workload | string| `string` |  | |  |  |
| hasVS | [VSInfo](#v-s-info)| `VSInfo` |  | |  |  |
| isExtension | [ExtInfo](#ext-info)| `ExtInfo` |  | |  |  |
| isGateway | [GWInfo](#g-w-info)| `GWInfo` |  | |  |  |
| isServiceEntry | [SEInfo](#s-e-info)| `SEInfo` |  | |  |  |



### <span id="node-wrapper"></span> NodeWrapper


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| data | [NodeData](#node-data)| `NodeData` |  | |  |  |



### <span id="object-meta"></span> ObjectMeta


> ObjectMeta is metadata that all persisted resources must have, which includes all objects
users must create.
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Annotations | map of string| `map[string]string` |  | | Annotations is an unstructured key value map stored with a resource that may be</br>set by external tools to store and retrieve arbitrary metadata. They are not</br>queryable and should be preserved when modifying objects.</br>More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/annotations |  |
| CreationTimestamp | string| `string` |  | | CreationTimestamp is a timestamp representing the server time when this object was</br>created. It is not guaranteed to be set in happens-before order across separate operations.</br>Clients may not set this value. It is represented in RFC3339 form and is in UTC.</br></br>Populated by the system.</br>Read-only.</br>Null for lists.</br>More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata |  |
| DeletionGracePeriodSeconds | int64 (formatted integer)| `int64` |  | | Number of seconds allowed for this object to gracefully terminate before</br>it will be removed from the system. Only set when deletionTimestamp is also set.</br>May only be shortened.</br>Read-only. |  |
| DeletionTimestamp | string| `string` |  | | DeletionTimestamp is RFC 3339 date and time at which this resource will be deleted. This</br>field is set by the server when a graceful deletion is requested by the user, and is not</br>directly settable by a client. The resource is expected to be deleted (no longer visible</br>from resource lists, and not reachable by name) after the time in this field, once the</br>finalizers list is empty. As long as the finalizers list contains items, deletion is blocked.</br>Once the deletionTimestamp is set, this value may not be unset or be set further into the</br>future, although it may be shortened or the resource may be deleted prior to this time.</br>For example, a user may request that a pod is deleted in 30 seconds. The Kubelet will react</br>by sending a graceful termination signal to the containers in the pod. After that 30 seconds,</br>the Kubelet will send a hard termination signal (SIGKILL) to the container and after cleanup,</br>remove the pod from the API. In the presence of network partitions, this object may still</br>exist after this timestamp, until an administrator or automated process can determine the</br>resource is fully terminated.</br>If not set, graceful deletion of the object has not been requested.</br></br>Populated by the system when a graceful deletion is requested.</br>Read-only.</br>More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata |  |
| Finalizers | []string| `[]string` |  | | Must be empty before the object is deleted from the registry. Each entry</br>is an identifier for the responsible component that will remove the entry</br>from the list. If the deletionTimestamp of the object is non-nil, entries</br>in this list can only be removed.</br>Finalizers may be processed and removed in any order.  Order is NOT enforced</br>because it introduces significant risk of stuck finalizers.</br>finalizers is a shared field, any actor with permission can reorder it.</br>If the finalizer list is processed in order, then this can lead to a situation</br>in which the component responsible for the first finalizer in the list is</br>waiting for a signal (field value, external system, or other) produced by a</br>component responsible for a finalizer later in the list, resulting in a deadlock.</br>Without enforced ordering finalizers are free to order amongst themselves and</br>are not vulnerable to ordering changes in the list. |  |
| GenerateName | string| `string` |  | | GenerateName is an optional prefix, used by the server, to generate a unique</br>name ONLY IF the Name field has not been provided.</br>If this field is used, the name returned to the client will be different</br>than the name passed. This value will also be combined with a unique suffix.</br>The provided value has the same validation rules as the Name field,</br>and may be truncated by the length of the suffix required to make the value</br>unique on the server.</br></br>If this field is specified and the generated name exists, the server will return a 409.</br></br>Applied only if Name is not specified.</br>More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#idempotency |  |
| Generation | int64 (formatted integer)| `int64` |  | | A sequence number representing a specific generation of the desired state.</br>Populated by the system. Read-only. |  |
| Labels | map of string| `map[string]string` |  | | Map of string keys and values that can be used to organize and categorize</br>(scope and select) objects. May match selectors of replication controllers</br>and services.</br>More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/labels |  |
| ManagedFields | [][ManagedFieldsEntry](#managed-fields-entry)| `[]*ManagedFieldsEntry` |  | | ManagedFields maps workflow-id and version to the set of fields</br>that are managed by that workflow. This is mostly for internal</br>housekeeping, and users typically shouldn't need to set or</br>understand this field. A workflow can be the user's name, a</br>controller's name, or the name of a specific apply path like</br>"ci-cd". The set of fields is always in the version that the</br>workflow used when modifying the object. |  |
| Name | string| `string` |  | | Name must be unique within a namespace. Is required when creating resources, although</br>some resources may allow a client to request the generation of an appropriate name</br>automatically. Name is primarily intended for creation idempotence and configuration</br>definition.</br>Cannot be updated.</br>More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names#names |  |
| Namespace | string| `string` |  | | Namespace defines the space within which each name must be unique. An empty namespace is</br>equivalent to the "default" namespace, but "default" is the canonical representation.</br>Not all objects are required to be scoped to a namespace - the value of this field for</br>those objects will be empty.</br></br>Must be a DNS_LABEL.</br>Cannot be updated.</br>More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/namespaces |  |
| OwnerReferences | [][OwnerReference](#owner-reference)| `[]*OwnerReference` |  | | List of objects depended by this object. If ALL objects in the list have</br>been deleted, this object will be garbage collected. If this object is managed by a controller,</br>then an entry in this list will point to this controller, with the controller field set to true.</br>There cannot be more than one managing controller. |  |
| ResourceVersion | string| `string` |  | | An opaque value that represents the internal version of this object that can</br>be used by clients to determine when objects have changed. May be used for optimistic</br>concurrency, change detection, and the watch operation on a resource or set of resources.</br>Clients must treat these values as opaque and passed unmodified back to the server.</br>They may only be valid for a particular resource or set of resources.</br></br>Populated by the system.</br>Read-only.</br>Value must be treated as opaque by clients and .</br>More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#concurrency-control-and-consistency |  |
| SelfLink | string| `string` |  | | Deprecated: selfLink is a legacy read-only field that is no longer populated by the system. |  |
| uid | [UID](#uid)| `UID` |  | |  |  |



### <span id="outlier-detection"></span> OutlierDetection


> The following rule sets a connection pool size of 100 HTTP1 connections
with no more than 10 req/connection to the "reviews" service. In addition,
it sets a limit of 1000 concurrent HTTP/2 requests and configures upstream
hosts to be scanned every 5 mins so that any host that fails 7 consecutive
times with a 502, 503, or 504 error code will be ejected for 15 minutes.

```yaml
apiVersion: networking.istio.io/v1
kind: DestinationRule
metadata:


spec:

trafficPolicy:
connectionPool:
tcp:
maxConnections: 100
http:
http2MaxRequests: 1000
maxRequestsPerConnection: 10
outlierDetection:
consecutive5xxErrors: 7
interval: 5m
baseEjectionTime: 15m

```
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| ConsecutiveErrors | int32 (formatted integer)| `int32` |  | | Number of errors before a host is ejected from the connection</br>pool. Defaults to 5. When the upstream host is accessed over HTTP, a</br>502, 503, or 504 return code qualifies as an error. When the upstream host</br>is accessed over an opaque TCP connection, connect timeouts and</br>connection error/failure events qualify as an error.</br>$hide_from_docs</br></br>Deprecated: Marked as deprecated in networking/v1alpha3/destination_rule.proto. |  |
| MaxEjectionPercent | int32 (formatted integer)| `int32` |  | | Maximum % of hosts in the load balancing pool for the upstream</br>service that can be ejected. Defaults to 10%. |  |
| MinHealthPercent | int32 (formatted integer)| `int32` |  | | Outlier detection will be enabled as long as the associated load balancing</br>pool has at least `minHealthPercent` hosts in healthy mode. When the</br>percentage of healthy hosts in the load balancing pool drops below this</br>threshold, outlier detection will be disabled and the proxy will load balance</br>across all hosts in the pool (healthy and unhealthy). The threshold can be</br>disabled by setting it to 0%. The default is 0% as it's not typically</br>applicable in k8s environments with few pods per service. |  |
| SplitExternalLocalOriginErrors | boolean| `bool` |  | | Determines whether to distinguish local origin failures from external errors. If set to true</br>`consecutiveLocalOriginFailures` is taken into account for outlier detection calculations.</br>This should be used when you want to derive the outlier detection status based on the errors</br>seen locally such as failure to connect, timeout while connecting etc. rather than the status code</br>returned by upstream service. This is especially useful when the upstream service explicitly returns</br>a 5xx for some requests and you want to ignore those responses from upstream service while determining</br>the outlier detection status of a host.</br>Defaults to false. |  |
| base_ejection_time | [DurationpbDuration](#durationpb-duration)| `DurationpbDuration` |  | |  |  |
| consecutive_5xx_errors | [UInt32Value](#u-int32-value)| `UInt32Value` |  | |  |  |
| consecutive_gateway_errors | [UInt32Value](#u-int32-value)| `UInt32Value` |  | |  |  |
| consecutive_local_origin_failures | [UInt32Value](#u-int32-value)| `UInt32Value` |  | |  |  |
| interval | [DurationpbDuration](#durationpb-duration)| `DurationpbDuration` |  | |  |  |



### <span id="owner-reference"></span> OwnerReference


> OwnerReference contains enough information to let you identify an owning
object. An owning object must be in the same namespace as the dependent, or
be cluster-scoped, so there is no namespace field.
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| APIVersion | string| `string` |  | | API version of the referent. |  |
| BlockOwnerDeletion | boolean| `bool` |  | | If true, AND if the owner has the "foregroundDeletion" finalizer, then</br>the owner cannot be deleted from the key-value store until this</br>reference is removed.</br>See https://kubernetes.io/docs/concepts/architecture/garbage-collection/#foreground-deletion</br>for how the garbage collector interacts with this field and enforces the foreground deletion.</br>Defaults to false.</br>To set this field, a user needs "delete" permission of the owner,</br>otherwise 422 (Unprocessable Entity) will be returned. |  |
| Controller | boolean| `bool` |  | | If true, this reference points to the managing controller. |  |
| Kind | string| `string` |  | | Kind of the referent.</br>More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds |  |
| Name | string| `string` |  | | Name of the referent.</br>More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names#names |  |
| uid | [UID](#uid)| `UID` |  | |  |  |



### <span id="parent-status"></span> ParentStatus


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Conditions | [][Condition](#condition)| `[]*Condition` |  | | Conditions is a list of status conditions that provide information about the observed</br>state of the InferencePool. This field is required to be set by the controller that</br>manages the InferencePool.</br></br>Supported condition types are:</br></br>- "Accepted"</br>- "ResolvedRefs" |  |
| controllerName | [ControllerName](#controller-name)| `ControllerName` |  | |  |  |
| parentRef | [APIV1ParentReference](#api-v1-parent-reference)| `APIV1ParentReference` |  | |  |  |



### <span id="path-match-type"></span> PathMatchType


> - "Exact" - Core
- "PathPrefix" - Core
- "RegularExpression" - Implementation Specific

PathPrefix and Exact paths must be syntactically valid:

- Must begin with the `/` character
- Must not contain consecutive `/` characters (e.g. `/foo///`, `//`).

Note that values may be added to this enum, implementations
must ensure that unknown values will not cause a crash.

Unknown values here must result in the implementation setting the
Accepted Condition for the Route to `status: False`, with a
Reason of `UnsupportedValue`.
  



| Name | Type | Go type | Default | Description | Example |
|------|------|---------| ------- |-------------|---------|
| PathMatchType | string| string | | - "Exact" - Core</br>- "PathPrefix" - Core</br>- "RegularExpression" - Implementation Specific</br></br>PathPrefix and Exact paths must be syntactically valid:</br></br>- Must begin with the `/` character</br>- Must not contain consecutive `/` characters (e.g. `/foo///`, `//`).</br></br>Note that values may be added to this enum, implementations</br>must ensure that unknown values will not cause a crash.</br></br>Unknown values here must result in the implementation setting the</br>Accepted Condition for the Route to `status: False`, with a</br>Reason of `UnsupportedValue`. |  |



### <span id="percent"></span> Percent


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Value | double (formatted number)| `float64` |  | |  |  |



### <span id="perses-info"></span> PersesInfo


> PersesInfo provides information to access Perses dashboards
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| ExternalLinks | [][ExternalLink](#external-link)| `[]*ExternalLink` |  | |  |  |
| Project | string| `string` |  | |  |  |
| URLFormat | string| `string` |  | |  |  |



### <span id="pod"></span> Pod


> Pod holds a subset of v1.Pod data that is meaningful in Kiali
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Annotations | map of string| `map[string]string` |  | |  |  |
| AppLabel | boolean| `bool` |  | |  |  |
| Containers | [][ContainerInfo](#container-info)| `[]*ContainerInfo` |  | |  |  |
| CreatedAt | string| `string` |  | |  |  |
| CreatedBy | [][ModelsReference](#models-reference)| `[]*ModelsReference` |  | |  |  |
| IstioContainers | [][ContainerInfo](#container-info)| `[]*ContainerInfo` |  | |  |  |
| IstioInitContainers | [][ContainerInfo](#container-info)| `[]*ContainerInfo` |  | |  |  |
| Labels | map of string| `map[string]string` |  | |  |  |
| Name | string| `string` |  | |  |  |
| Protocol | string| `string` |  | |  |  |
| ServiceAccountName | string| `string` |  | |  |  |
| Status | string| `string` |  | |  |  |
| StatusMessage | string| `string` |  | |  |  |
| StatusReason | string| `string` |  | |  |  |
| VersionLabel | boolean| `bool` |  | |  |  |
| proxyStatus | [ProxyStatus](#proxy-status)| `ProxyStatus` |  | |  |  |



### <span id="pods"></span> Pods


> Pods alias for list of Pod structs
  



[][Pod](#pod)

### <span id="port-number"></span> PortNumber


  

| Name | Type | Go type | Default | Description | Example |
|------|------|---------| ------- |-------------|---------|
| PortNumber | int32 (formatted integer)| int32 | |  |  |



### <span id="port-selector"></span> PortSelector


> PortSelector specifies the number of a port to be used for
matching or selection for final routing.
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Number | uint32 (formatted integer)| `uint32` |  | | Valid port number |  |



### <span id="ports"></span> Ports


  

[][ModelsPort](#models-port)

### <span id="precise-hostname"></span> PreciseHostname


> Note that as per RFC1035 and RFC1123, a *label* must consist of lower case
alphanumeric characters or '-', and must start and end with an alphanumeric
character. No other punctuation is allowed.
  



| Name | Type | Go type | Default | Description | Example |
|------|------|---------| ------- |-------------|---------|
| PreciseHostname | string| string | | Note that as per RFC1035 and RFC1123, a *label* must consist of lower case</br>alphanumeric characters or '-', and must start and end with an alphanumeric</br>character. No other punctuation is allowed. |  |



### <span id="private-key-provider"></span> PrivateKeyProvider


> PrivateKeyProvider defines private key configuration for gateways and sidecars. This can be configured
mesh-wide or individual per-workload basis.
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Provider | [IsPrivateKeyProviderProvider](#is-private-key-provider-provider)| `IsPrivateKeyProviderProvider` |  | |  |  |



### <span id="process"></span> Process


> Process is the process emitting a set of spans
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| ServiceName | string| `string` |  | |  |  |
| Tags | [][KeyValue](#key-value)| `[]*KeyValue` |  | |  |  |



### <span id="process-id"></span> ProcessID


  

| Name | Type | Go type | Default | Description | Example |
|------|------|---------| ------- |-------------|---------|
| ProcessID | string| string | |  |  |



### <span id="protocol-traffic"></span> ProtocolTraffic


> ProtocolTraffic supplies all of the traffic information for a single protocol
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Protocol | string| `string` |  | |  |  |
| Rates | map of string| `map[string]string` |  | |  |  |
| responses | [Responses](#responses)| `Responses` |  | |  |  |



### <span id="proxy-config"></span> ProxyConfig


> ```
meshConfig:

defaultConfig:
discoveryAddress: istiod:15012

```

This can also be configured on a per-workload basis by configuring the `proxy.istio.io/config` annotation on the pod. For example:

```
annotations:

proxy.istio.io/config: |
discoveryAddress: istiod:15012

```

If both are configured, the two are merged with per field semantics; the field set in annotation will fully replace the field from mesh config defaults.
This is different than a deep merge provided by protobuf.
For example, `"tracing": { "sampling": 5 }` would completely override a setting configuring a tracing provider
such as `"tracing": { "zipkin": { "address": "..." } }`.

Note: fields in ProxyConfig are not dynamically configured; changes will require restart of workloads to take effect.
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| AvailabilityZone | string| `string` |  | | $hide_from_docs</br></br>Deprecated: Marked as deprecated in mesh/v1alpha1/proxy.proto. |  |
| BinaryPath | string| `string` |  | | Path to the proxy binary |  |
| CaCertificatesPem | []string| `[]string` |  | | The PEM data of the extra root certificates for workload-to-workload communication.</br>This includes the certificates defined in MeshConfig and any other certificates that Istiod uses as CA.</br>The plugin certificates (the 'cacerts' secret), self-signed certificates (the 'istio-ca-secret' secret)</br>are added automatically by Istiod. |  |
| ClusterName | [IsProxyConfigClusterName](#is-proxy-config-cluster-name)| `IsProxyConfigClusterName` |  | |  |  |
| ConfigPath | string| `string` |  | | Path to the generated configuration file directory.</br>Proxy agent generates the actual configuration and stores it in this directory. |  |
| CustomConfigFile | string| `string` |  | | File path of custom proxy configuration, currently used by proxies</br>in front of istiod. |  |
| DiscoveryAddress | string| `string` |  | | Address of the discovery service exposing xDS with mTLS connection.</br>The inject configuration may override this value. |  |
| EnvoyMetricsServiceAddress | string| `string` |  | | $hide_from_docs</br></br>Deprecated: Marked as deprecated in mesh/v1alpha1/proxy.proto. |  |
| ExtraStatTags | []string| `[]string` |  | | An additional list of tags to extract from the in-proxy Istio telemetry. These extra tags can be</br>added by configuring the telemetry extension. Each additional tag needs to be present in this list.</br>Extra tags emitted by the telemetry extensions must be listed here so that they can be processed</br>and exposed as Prometheus metrics.</br>Deprecated: `istio.stats` is a native filter now, this field is no longer needed. |  |
| FileFlushMinSizeKb | uint32 (formatted integer)| `uint32` |  | | File flush buffer size for envoy flushes buffers to disk in kilobytes.</br>Defaults to 64.</br>Optional. |  |
| MeshId | string| `string` |  | | The unique identifier for the [service mesh](https://istio.io/docs/reference/glossary/#service-mesh)</br>All control planes running in the same service mesh should specify the same mesh ID.</br>Mesh ID is used to label telemetry reports for cases where telemetry from multiple meshes is mixed together. |  |
| ProxyAdminPort | int32 (formatted integer)| `int32` |  | | Port on which Envoy should listen for administrative commands.</br>Default port is `15000`. |  |
| ProxyBootstrapTemplatePath | string| `string` |  | | Path to the proxy bootstrap template file |  |
| ProxyMetadata | map of string| `map[string]string` |  | | Additional environment variables for the proxy.</br>Names starting with `ISTIO_META_` will be included in the generated bootstrap and sent to the XDS server. |  |
| RuntimeValues | map of string| `map[string]string` |  | | Envoy [runtime configuration](https://www.envoyproxy.io/docs/envoy/latest/intro/arch_overview/operations/runtime) to set during bootstrapping.</br>This enables setting experimental, unsafe, unsupported, and deprecated features that should be used with extreme caution. |  |
| StatNameLength | int32 (formatted integer)| `int32` |  | | Maximum length of name field in Envoy's metrics. The length of the name field</br>is determined by the length of a name field in a service and the set of labels that</br>comprise a particular version of the service. The default value is set to 189 characters.</br>Envoy's internal metrics take up 67 characters, for a total of 256 character name per metric.</br>Increase the value of this field if you find that the metrics from Envoys are truncated. |  |
| StatsdUdpAddress | string| `string` |  | | IP Address and Port of a statsd UDP listener (e.g. `10.75.241.127:9125`). |  |
| StatusPort | int32 (formatted integer)| `int32` |  | | Port on which the agent should listen for administrative commands such as readiness probe.</br>Default is set to port `15020`. |  |
| ZipkinAddress | string| `string` |  | | Address of the Zipkin service (e.g. _zipkin:9411_).</br>DEPRECATED: Use [tracing][istio.mesh.v1alpha1.ProxyConfig.tracing] instead.</br></br>Deprecated: Marked as deprecated in mesh/v1alpha1/proxy.proto. |  |
| concurrency | [Int32Value](#int32-value)| `Int32Value` |  | |  |  |
| control_plane_auth_policy | [AuthenticationPolicy](#authentication-policy)| `AuthenticationPolicy` |  | |  |  |
| discovery_refresh_delay | [DurationpbDuration](#durationpb-duration)| `DurationpbDuration` |  | |  |  |
| drain_duration | [DurationpbDuration](#durationpb-duration)| `DurationpbDuration` |  | |  |  |
| envoy_access_log_service | [RemoteService](#remote-service)| `RemoteService` |  | |  |  |
| envoy_metrics_service | [RemoteService](#remote-service)| `RemoteService` |  | |  |  |
| file_flush_interval | [DurationpbDuration](#durationpb-duration)| `DurationpbDuration` |  | |  |  |
| gateway_topology | [Topology](#topology)| `Topology` |  | |  |  |
| hold_application_until_proxy_starts | [BoolValue](#bool-value)| `BoolValue` |  | |  |  |
| image | [ProxyImage](#proxy-image)| `ProxyImage` |  | |  |  |
| interception_mode | [ProxyConfigInboundInterceptionMode](#proxy-config-inbound-interception-mode)| `ProxyConfigInboundInterceptionMode` |  | |  |  |
| private_key_provider | [PrivateKeyProvider](#private-key-provider)| `PrivateKeyProvider` |  | |  |  |
| proxy_headers | [ProxyConfigProxyHeaders](#proxy-config-proxy-headers)| `ProxyConfigProxyHeaders` |  | |  |  |
| proxy_stats_matcher | [ProxyConfigProxyStatsMatcher](#proxy-config-proxy-stats-matcher)| `ProxyConfigProxyStatsMatcher` |  | |  |  |
| readiness_probe | [ReadinessProbe](#readiness-probe)| `ReadinessProbe` |  | |  |  |
| sds | [SDS](#s-d-s)| `SDS` |  | |  |  |
| stats_compression | [BoolValue](#bool-value)| `BoolValue` |  | |  |  |
| termination_drain_duration | [DurationpbDuration](#durationpb-duration)| `DurationpbDuration` |  | |  |  |
| tracing | [Tracing](#tracing)| `Tracing` |  | |  |  |



### <span id="proxy-config-inbound-interception-mode"></span> ProxyConfig_InboundInterceptionMode


> This setting has no effect on outbound traffic: iptables `REDIRECT` is always used for
outbound connections.
  



| Name | Type | Go type | Default | Description | Example |
|------|------|---------| ------- |-------------|---------|
| ProxyConfig_InboundInterceptionMode | int32 (formatted integer)| int32 | | This setting has no effect on outbound traffic: iptables `REDIRECT` is always used for</br>outbound connections. |  |



### <span id="proxy-config-proxy-headers"></span> ProxyConfig_ProxyHeaders


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| attempt_count | [ProxyConfigProxyHeadersAttemptCount](#proxy-config-proxy-headers-attempt-count)| `ProxyConfigProxyHeadersAttemptCount` |  | |  |  |
| envoy_debug_headers | [ProxyConfigProxyHeadersEnvoyDebugHeaders](#proxy-config-proxy-headers-envoy-debug-headers)| `ProxyConfigProxyHeadersEnvoyDebugHeaders` |  | |  |  |
| forwarded_client_cert | [ForwardClientCertDetails](#forward-client-cert-details)| `ForwardClientCertDetails` |  | |  |  |
| metadata_exchange_headers | [ProxyConfigProxyHeadersMetadataExchangeHeaders](#proxy-config-proxy-headers-metadata-exchange-headers)| `ProxyConfigProxyHeadersMetadataExchangeHeaders` |  | |  |  |
| preserve_http1_header_case | [BoolValue](#bool-value)| `BoolValue` |  | |  |  |
| request_id | [ProxyConfigProxyHeadersRequestID](#proxy-config-proxy-headers-request-id)| `ProxyConfigProxyHeadersRequestID` |  | |  |  |
| server | [ProxyConfigProxyHeadersServer](#proxy-config-proxy-headers-server)| `ProxyConfigProxyHeadersServer` |  | |  |  |
| set_current_client_cert_details | [ProxyConfigProxyHeadersSetCurrentClientCertDetails](#proxy-config-proxy-headers-set-current-client-cert-details)| `ProxyConfigProxyHeadersSetCurrentClientCertDetails` |  | |  |  |
| x_forwarded_host | [ProxyConfigProxyHeadersXForwardedHost](#proxy-config-proxy-headers-x-forwarded-host)| `ProxyConfigProxyHeadersXForwardedHost` |  | |  |  |
| x_forwarded_port | [ProxyConfigProxyHeadersXForwardedPort](#proxy-config-proxy-headers-x-forwarded-port)| `ProxyConfigProxyHeadersXForwardedPort` |  | |  |  |



### <span id="proxy-config-proxy-headers-attempt-count"></span> ProxyConfig_ProxyHeaders_AttemptCount


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| disabled | [BoolValue](#bool-value)| `BoolValue` |  | |  |  |



### <span id="proxy-config-proxy-headers-envoy-debug-headers"></span> ProxyConfig_ProxyHeaders_EnvoyDebugHeaders


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| disabled | [BoolValue](#bool-value)| `BoolValue` |  | |  |  |



### <span id="proxy-config-proxy-headers-metadata-exchange-headers"></span> ProxyConfig_ProxyHeaders_MetadataExchangeHeaders


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| mode | [ProxyConfigProxyHeadersMetadataExchangeMode](#proxy-config-proxy-headers-metadata-exchange-mode)| `ProxyConfigProxyHeadersMetadataExchangeMode` |  | |  |  |



### <span id="proxy-config-proxy-headers-metadata-exchange-mode"></span> ProxyConfig_ProxyHeaders_MetadataExchangeMode


  

| Name | Type | Go type | Default | Description | Example |
|------|------|---------| ------- |-------------|---------|
| ProxyConfig_ProxyHeaders_MetadataExchangeMode | int32 (formatted integer)| int32 | |  |  |



### <span id="proxy-config-proxy-headers-request-id"></span> ProxyConfig_ProxyHeaders_RequestId


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| disabled | [BoolValue](#bool-value)| `BoolValue` |  | |  |  |



### <span id="proxy-config-proxy-headers-server"></span> ProxyConfig_ProxyHeaders_Server


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Value | string| `string` |  | | If set, and the server header is enabled, this value will be set as the server header. By default, `istio-envoy` will be used. |  |
| disabled | [BoolValue](#bool-value)| `BoolValue` |  | |  |  |



### <span id="proxy-config-proxy-headers-set-current-client-cert-details"></span> ProxyConfig_ProxyHeaders_SetCurrentClientCertDetails


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| cert | [BoolValue](#bool-value)| `BoolValue` |  | |  |  |
| chain | [BoolValue](#bool-value)| `BoolValue` |  | |  |  |
| dns | [BoolValue](#bool-value)| `BoolValue` |  | |  |  |
| subject | [BoolValue](#bool-value)| `BoolValue` |  | |  |  |
| uri | [BoolValue](#bool-value)| `BoolValue` |  | |  |  |



### <span id="proxy-config-proxy-headers-x-forwarded-host"></span> ProxyConfig_ProxyHeaders_XForwardedHost


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| enabled | [BoolValue](#bool-value)| `BoolValue` |  | |  |  |



### <span id="proxy-config-proxy-headers-x-forwarded-port"></span> ProxyConfig_ProxyHeaders_XForwardedPort


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| enabled | [BoolValue](#bool-value)| `BoolValue` |  | |  |  |



### <span id="proxy-config-proxy-stats-matcher"></span> ProxyConfig_ProxyStatsMatcher


> Proxy stats name matchers for stats creation. Note this is in addition to
the minimum Envoy stats that Istio generates by default.
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| InclusionPrefixes | []string| `[]string` |  | | Proxy stats name prefix matcher for inclusion. |  |
| InclusionRegexps | []string| `[]string` |  | | Proxy stats name regexps matcher for inclusion. |  |
| InclusionSuffixes | []string| `[]string` |  | | Proxy stats name suffix matcher for inclusion. |  |



### <span id="proxy-image"></span> ProxyImage


> format: `${hub}/${image_name}/${tag}-${image_type}`,
This information was previously part of the Values API.
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| ImageType | string| `string` |  | | The image type of the image.</br>Istio publishes default, debug, and distroless images.</br>Other values are allowed if those image types (example: centos) are published to the specified hub.</br>supported values: default, debug, distroless. |  |



### <span id="proxy-status"></span> ProxyStatus


> In healthy scenarios all variables should be true.
If at least one variable is false, then the proxy isn't fully sync'ed with pilot.
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| CDS | string| `string` |  | |  |  |
| EDS | string| `string` |  | |  |  |
| LDS | string| `string` |  | |  |  |
| RDS | string| `string` |  | |  |  |



### <span id="quantity"></span> Quantity


> The serialization format is:

```
<quantity>        ::= <signedNumber><suffix>

(Note that <suffix> may be empty, from the "" case in <decimalSI>.)

<digit>           ::= 0 | 1 | ... | 9
<digits>          ::= <digit> | <digit><digits>
<number>          ::= <digits> | <digits>.<digits> | <digits>. | .<digits>
<sign>            ::= "+" | "-"
<signedNumber>    ::= <number> | <sign><number>
<suffix>          ::= <binarySI> | <decimalExponent> | <decimalSI>
<binarySI>        ::= Ki | Mi | Gi | Ti | Pi | Ei

(International System of units; See: http://physics.nist.gov/cuu/Units/binary.html)

<decimalSI>       ::= m | "" | k | M | G | T | P | E

(Note that 1024 = 1Ki but 1000 = 1k; I didn't choose the capitalization.)

<decimalExponent> ::= "e" <signedNumber> | "E" <signedNumber>
```

No matter which of the three exponent forms is used, no quantity may represent
a number greater than 2^63-1 in magnitude, nor may it have more than 3 decimal
places. Numbers larger or more precise will be capped or rounded up.
(E.g.: 0.1m will rounded up to 1m.)
This may be extended in the future if we require larger or smaller quantities.

When a Quantity is parsed from a string, it will remember the type of suffix
it had, and will use the same type again when it is serialized.

Before serializing, Quantity will be put in "canonical form".
This means that Exponent/suffix will be adjusted up or down (with a
corresponding increase or decrease in Mantissa) such that:

- No precision is lost
- No fractional digits will be emitted
- The exponent (or suffix) is as large as possible.

The sign will be omitted unless the number is negative.
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Format | [Format](#format)| `Format` |  | |  |  |



### <span id="query-param-match-type"></span> QueryParamMatchType


> - "Exact" - Core
- "RegularExpression" - Implementation Specific

Note that values may be added to this enum, implementations
must ensure that unknown values will not cause a crash.

Unknown values here must result in the implementation setting the
Accepted Condition for the Route to `status: False`, with a
Reason of `UnsupportedValue`.
  



| Name | Type | Go type | Default | Description | Example |
|------|------|---------| ------- |-------------|---------|
| QueryParamMatchType | string| string | | - "Exact" - Core</br>- "RegularExpression" - Implementation Specific</br></br>Note that values may be added to this enum, implementations</br>must ensure that unknown values will not cause a crash.</br></br>Unknown values here must result in the implementation setting the</br>Accepted Condition for the Route to `status: False`, with a</br>Reason of `UnsupportedValue`. |  |



### <span id="readiness-probe"></span> ReadinessProbe


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| FailureThreshold | int32 (formatted integer)| `int32` |  | | Minimum consecutive failures for the probe to be considered failed after having succeeded.</br>Defaults to 3 seconds. |  |
| HealthCheckMethod | [IsReadinessProbeHealthCheckMethod](#is-readiness-probe-health-check-method)| `IsReadinessProbeHealthCheckMethod` |  | |  |  |
| InitialDelaySeconds | int32 (formatted integer)| `int32` |  | | Number of seconds after the container has started before readiness probes are initiated. |  |
| PeriodSeconds | int32 (formatted integer)| `int32` |  | | How often (in seconds) to perform the probe.</br>Default to 10 seconds. Minimum value is 1 second. |  |
| SuccessThreshold | int32 (formatted integer)| `int32` |  | | Minimum consecutive successes for the probe to be considered successful after having failed.</br>Defaults to 1 second. |  |
| TimeoutSeconds | int32 (formatted integer)| `int32` |  | | Number of seconds after which the probe times out.</br>Defaults to 1 second. Minimum value is 1 second. |  |



### <span id="reference-grant-from"></span> ReferenceGrantFrom


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| group | [ApisV1Group](#apis-v1-group)| `ApisV1Group` |  | |  |  |
| kind | [ApisV1Kind](#apis-v1-kind)| `ApisV1Kind` |  | |  |  |
| namespace | [ApisV1Namespace](#apis-v1-namespace)| `ApisV1Namespace` |  | |  |  |



### <span id="reference-grant-spec"></span> ReferenceGrantSpec


> ReferenceGrantSpec identifies a cross namespace relationship that is trusted
for Gateway API.
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| From | [][ReferenceGrantFrom](#reference-grant-from)| `[]*ReferenceGrantFrom` |  | | From describes the trusted namespaces and kinds that can reference the</br>resources described in "To". Each entry in this list MUST be considered</br>to be an additional place that references can be valid from, or to put</br>this another way, entries MUST be combined using OR.</br></br>Support: Core |  |
| To | [][ReferenceGrantTo](#reference-grant-to)| `[]*ReferenceGrantTo` |  | | To describes the resources that may be referenced by the resources</br>described in "From". Each entry in this list MUST be considered to be an</br>additional place that references can be valid to, or to put this another</br>way, entries MUST be combined using OR.</br></br>Support: Core |  |



### <span id="reference-grant-to"></span> ReferenceGrantTo


> ReferenceGrantTo describes what Kinds are allowed as targets of the
references.
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| group | [ApisV1Group](#apis-v1-group)| `ApisV1Group` |  | |  |  |
| kind | [ApisV1Kind](#apis-v1-kind)| `ApisV1Kind` |  | |  |  |
| name | [ApisV1ObjectName](#apis-v1-object-name)| `ApisV1ObjectName` |  | |  |  |



### <span id="reference-type"></span> ReferenceType


> ReferenceType is the reference type of one span to another
  



| Name | Type | Go type | Default | Description | Example |
|------|------|---------| ------- |-------------|---------|
| ReferenceType | string| string | | ReferenceType is the reference type of one span to another |  |



### <span id="regex-rewrite"></span> RegexRewrite


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Match | string| `string` |  | | [RE2 style regex-based match](https://github.com/google/re2/wiki/Syntax). |  |
| Rewrite | string| `string` |  | | The string that should replace into matching portions of original URI.</br>Capture groups in the pattern can be referenced in the new URI. |  |



### <span id="remote-service"></span> RemoteService


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Address | string| `string` |  | | Address of a remove service used for various purposes (access log</br>receiver, metrics receiver, etc.). Can be IP address or a fully</br>qualified DNS name. |  |
| tcp_keepalive | [ConnectionPoolSettingsTCPSettingsTCPKeepalive](#connection-pool-settings-tcp-settings-tcp-keepalive)| `ConnectionPoolSettingsTCPSettingsTCPKeepalive` |  | |  |  |
| tls_settings | [ClientTLSSettings](#client-tls-settings)| `ClientTLSSettings` |  | |  |  |



### <span id="request-health"></span> RequestHealth


> RequestHealth holds several stats about recent request errors
- Inbound//Outbound are the rates of requests by protocol and status_code.
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| HealthAnnotations | map of string| `map[string]string` |  | |  |  |
| Inbound | map of [map[string]float64](#map-string-float64)| `map[string]map[string]float64` |  | |  |  |
| Outbound | map of [map[string]float64](#map-string-float64)| `map[string]map[string]float64` |  | |  |  |



### <span id="resource"></span> Resource


> Resource describes the source of configuration
  



| Name | Type | Go type | Default | Description | Example |
|------|------|---------| ------- |-------------|---------|
| Resource | int32 (formatted integer)| int32 | | Resource describes the source of configuration |  |



### <span id="resource-claim"></span> ResourceClaim


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Name | string| `string` |  | | Name must match the name of one entry in pod.spec.resourceClaims of</br>the Pod where this field is used. It makes that resource available</br>inside a container. |  |
| Request | string| `string` |  | | Request is the name chosen for a request in the referenced claim.</br>If empty, everything from the claim is made available, otherwise</br>only the result of this request. |  |



### <span id="resource-list"></span> ResourceList


  

[ResourceList](#resource-list)

### <span id="resource-permissions"></span> ResourcePermissions


> ResourcePermissions holds permission flags for an object type
True means allowed.
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Create | boolean| `bool` |  | |  |  |
| Delete | boolean| `bool` |  | |  |  |
| Update | boolean| `bool` |  | |  |  |



### <span id="resource-requirements"></span> ResourceRequirements


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Claims | [][ResourceClaim](#resource-claim)| `[]*ResourceClaim` |  | | Claims lists the names of resources, defined in spec.resourceClaims,</br>that are used by this container.</br></br>This field depends on the</br>DynamicResourceAllocation feature gate.</br></br>This field is immutable. It can only be set for containers. |  |
| limits | [ResourceList](#resource-list)| `ResourceList` |  | |  |  |
| requests | [ResourceList](#resource-list)| `ResourceList` |  | |  |  |



### <span id="resources-permissions"></span> ResourcesPermissions


> ResourcesPermissions holds a map of permission flags per resource
  



[ResourcesPermissions](#resources-permissions)

### <span id="response-detail"></span> ResponseDetail


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| flags | [ResponseFlags](#response-flags)| `ResponseFlags` |  | |  |  |
| hosts | [ResponseHosts](#response-hosts)| `ResponseHosts` |  | |  |  |



### <span id="response-flags"></span> ResponseFlags


  

[ResponseFlags](#response-flags)

### <span id="response-hosts"></span> ResponseHosts


> "200" : {
"www.google.com" : "80.0",
"www.yahoo.com"  : "20.0"
}, ...
  



[ResponseHosts](#response-hosts)

### <span id="responses"></span> Responses


> Responses maps responseCodes to detailed information for that code
  



[Responses](#responses)

### <span id="route"></span> Route


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Match | string| `string` |  | |  |  |
| Name | string| `string` |  | |  |  |
| VirtualService | string| `string` |  | |  |  |
| domains | [Host](#host)| `Host` |  | |  |  |



### <span id="route-destination"></span> RouteDestination


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Weight | int32 (formatted integer)| `int32` |  | | Weight specifies the relative proportion of traffic to be forwarded to the destination. A destination will receive `weight/(sum of all weights)` requests.</br>If there is only one destination in a rule, it will receive all traffic.</br>Otherwise, if weight is `0`, the destination will not receive any traffic. |  |
| destination | [Destination](#destination)| `Destination` |  | |  |  |



### <span id="route-parent-status"></span> RouteParentStatus


> RouteParentStatus describes the status of a route with respect to an
associated Parent.
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Conditions | [][Condition](#condition)| `[]*Condition` |  | | Conditions describes the status of the route with respect to the Gateway.</br>Note that the route's availability is also subject to the Gateway's own</br>status conditions and listener status.</br></br>If the Route's ParentRef specifies an existing Gateway that supports</br>Routes of this kind AND that Gateway's controller has sufficient access,</br>then that Gateway's controller MUST set the "Accepted" condition on the</br>Route, to indicate whether the route has been accepted or rejected by the</br>Gateway, and why.</br></br>A Route MUST be considered "Accepted" if at least one of the Route's</br>rules is implemented by the Gateway.</br></br>There are a number of cases where the "Accepted" condition may not be set</br>due to lack of controller visibility, that includes when:</br></br>- The Route refers to a nonexistent parent.</br>- The Route is of a type that the controller does not support.</br>- The Route is in a namespace to which the controller does not have access.</br></br><gateway:util:excludeFromCRD></br></br>Notes for implementors:</br></br>Conditions are a listType `map`, which means that they function like a</br>map with a key of the `type` field _in the k8s apiserver_.</br></br>This means that implementations must obey some rules when updating this</br>section.</br></br>- Implementations MUST perform a read-modify-write cycle on this field</br>before modifying it. That is, when modifying this field, implementations</br>must be confident they have fetched the most recent version of this field,</br>and ensure that changes they make are on that recent version.</br>- Implementations MUST NOT remove or reorder Conditions that they are not</br>directly responsible for. For example, if an implementation sees a Condition</br>with type `special.io/SomeField`, it MUST NOT remove, change or update that</br>Condition.</br>- Implementations MUST always _merge_ changes into Conditions of the same Type,</br>rather than creating more than one Condition of the same Type.</br>- Implementations MUST always update the `observedGeneration` field of the</br>Condition to the `metadata.generation` of the Gateway at the time of update creation.</br>- If the `observedGeneration` of a Condition is _greater than_ the value the</br>implementation knows about, then it MUST NOT perform the update on that Condition,</br>but must wait for a future reconciliation and status update. (The assumption is that</br>the implementation's copy of the object is stale and an update will be re-triggered</br>if relevant.)</br></br></gateway:util:excludeFromCRD> |  |
| controllerName | [GatewayController](#gateway-controller)| `GatewayController` |  | |  |  |
| parentRef | [ApisV1ParentReference](#apis-v1-parent-reference)| `ApisV1ParentReference` |  | |  |  |



### <span id="routes"></span> Routes


  

[][Route](#route)

### <span id="runtime"></span> Runtime


> Runtime holds the runtime title and associated dashboard template(s)
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| DashboardRefs | [][DashboardRef](#dashboard-ref)| `[]*DashboardRef` |  | |  |  |
| Name | string| `string` |  | |  |  |



### <span id="s-d-s"></span> SDS


> For workload, its values are set in sidecar injector(passed as arguments to istio-proxy container).
For pilot/mixer, it's passed as arguments to istio-proxy container in pilot/mixer deployment yaml files directly.
$hide_from_docs
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Enabled | boolean| `bool` |  | | True if SDS is enabled. |  |
| K8SSaJwtPath | string| `string` |  | | Path of k8s service account JWT path. |  |



### <span id="s-e-info"></span> SEInfo


> SEInfo provides static information about the service entry
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Hosts | []string| `[]string` |  | |  |  |
| Location | string| `string` |  | |  |  |
| Namespace | string| `string` |  | |  |  |



### <span id="section-name"></span> SectionName


> In the following resources, SectionName is interpreted as the following:

- Gateway: Listener name
- HTTPRoute: HTTPRouteRule name
- Service: Port name

Section names can have a variety of forms, including RFC 1123 subdomains,
RFC 1123 labels, or RFC 1035 labels.

This validation is based off of the corresponding Kubernetes validation:
https://github.com/kubernetes/apimachinery/blob/02cfb53916346d085a6c6c7c66f882e3c6b0eca6/pkg/util/validation/validation.go#L208

Valid values include:

- "example"
- "foo-example"
- "example.com"
- "foo.example.com"

Invalid values include:

- "example.com/bar" - "/" is an invalid character
  



| Name | Type | Go type | Default | Description | Example |
|------|------|---------| ------- |-------------|---------|
| SectionName | string| string | | In the following resources, SectionName is interpreted as the following:</br></br>- Gateway: Listener name</br>- HTTPRoute: HTTPRouteRule name</br>- Service: Port name</br></br>Section names can have a variety of forms, including RFC 1123 subdomains,</br>RFC 1123 labels, or RFC 1035 labels.</br></br>This validation is based off of the corresponding Kubernetes validation:</br>https://github.com/kubernetes/apimachinery/blob/02cfb53916346d085a6c6c7c66f882e3c6b0eca6/pkg/util/validation/validation.go#L208</br></br>Valid values include:</br></br>- "example"</br>- "foo-example"</br>- "example.com"</br>- "foo.example.com"</br></br>Invalid values include:</br></br>- "example.com/bar" - "/" is an invalid character |  |



### <span id="service-details"></span> ServiceDetails


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| DestinationRules | [][V1DestinationRule](#v1-destination-rule)| `[]*V1DestinationRule` |  | |  |  |
| IsAmbient | boolean| `bool` |  | |  |  |
| IstioSidecar | boolean| `bool` |  | |  |  |
| K8sGRPCRoutes | [][GRPCRoute](#g-rpc-route)| `[]*GRPCRoute` |  | |  |  |
| K8sHTTPRoutes | [][V1HTTPRoute](#v1-http-route)| `[]*V1HTTPRoute` |  | |  |  |
| K8sInferencePools | [][InferencePool](#inference-pool)| `[]*InferencePool` |  | |  |  |
| K8sReferenceGrants | [][V1beta1ReferenceGrant](#v1beta1-reference-grant)| `[]*V1beta1ReferenceGrant` |  | |  |  |
| ServiceEntries | [][V1ServiceEntry](#v1-service-entry)| `[]*V1ServiceEntry` |  | |  |  |
| SubServices | [][ServiceOverview](#service-overview)| `[]*ServiceOverview` |  | |  |  |
| VirtualServices | [][V1VirtualService](#v1-virtual-service)| `[]*V1VirtualService` |  | |  |  |
| WaypointWorkloads | [][WorkloadReferenceInfo](#workload-reference-info)| `[]*WorkloadReferenceInfo` |  | |  |  |
| endpoints | [Endpoints](#endpoints)| `Endpoints` |  | |  |  |
| health | [ServiceHealth](#service-health)| `ServiceHealth` |  | |  |  |
| istioPermissions | [ResourcePermissions](#resource-permissions)| `ResourcePermissions` |  | |  |  |
| namespaceMTLS | [MTLSStatus](#m-tls-status)| `MTLSStatus` |  | |  |  |
| service | [ModelsService](#models-service)| `ModelsService` |  | |  |  |
| validations | [IstioValidations](#istio-validations)| `IstioValidations` |  | |  |  |
| workloads | [WorkloadOverviews](#workload-overviews)| `WorkloadOverviews` |  | |  |  |



### <span id="service-entry-address"></span> ServiceEntryAddress


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Host | string| `string` |  | | The host name associated with this address |  |
| Value | string| `string` |  | | The address (e.g. 192.168.0.2) |  |



### <span id="service-entry-status"></span> ServiceEntryStatus


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Addresses | [][ServiceEntryAddress](#service-entry-address)| `[]*ServiceEntryAddress` |  | | List of addresses which were assigned to this ServiceEntry. |  |
| Conditions | [][IstioCondition](#istio-condition)| `[]*IstioCondition` |  | | Current service state of ServiceEntry. |  |
| ObservedGeneration | int64 (formatted integer)| `int64` |  | | Resource Generation to which the Reconciled Condition refers.</br>When this value is not equal to the object's metadata generation, reconciled condition  calculation for the current</br>generation is still in progress. |  |
| ValidationMessages | [][AnalysisMessageBase](#analysis-message-base)| `[]*AnalysisMessageBase` |  | | Includes any errors or warnings detected by Istio's analyzers. |  |



### <span id="service-entry-location"></span> ServiceEntry_Location


> Location specifies whether the service is part of Istio mesh or
outside the mesh.  Location determines the behavior of several
features, such as service-to-service mTLS authentication, policy
enforcement, etc.
  



| Name | Type | Go type | Default | Description | Example |
|------|------|---------| ------- |-------------|---------|
| ServiceEntry_Location | int32 (formatted integer)| int32 | | Location specifies whether the service is part of Istio mesh or</br>outside the mesh.  Location determines the behavior of several</br>features, such as service-to-service mTLS authentication, policy</br>enforcement, etc. |  |



### <span id="service-entry-resolution"></span> ServiceEntry_Resolution


> Resolution determines how the proxy will resolve the IP addresses of
the network endpoints associated with the service, so that it can
route to one of them. The resolution mode specified here has no impact
on how the application resolves the IP address associated with the
service. The application may still have to use DNS to resolve the
service to an IP so that the outbound traffic can be captured by the
Proxy. Alternatively, for HTTP services, the application could
directly communicate with the proxy (e.g., by setting HTTP_PROXY) to
talk to these services.
  



| Name | Type | Go type | Default | Description | Example |
|------|------|---------| ------- |-------------|---------|
| ServiceEntry_Resolution | int32 (formatted integer)| int32 | | Resolution determines how the proxy will resolve the IP addresses of</br>the network endpoints associated with the service, so that it can</br>route to one of them. The resolution mode specified here has no impact</br>on how the application resolves the IP address associated with the</br>service. The application may still have to use DNS to resolve the</br>service to an IP so that the outbound traffic can be captured by the</br>Proxy. Alternatively, for HTTP services, the application could</br>directly communicate with the proxy (e.g., by setting HTTP_PROXY) to</br>talk to these services. |  |



### <span id="service-health"></span> ServiceHealth


> ServiceHealth contains aggregated health from various sources, for a given service
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| requests | [RequestHealth](#request-health)| `RequestHealth` |  | |  |  |
| status | [CalculatedHealthStatus](#calculated-health-status)| `CalculatedHealthStatus` |  | |  |  |



### <span id="service-list"></span> ServiceList


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Namespace | string| `string` |  | |  |  |
| Services | [][ServiceOverview](#service-overview)| `[]*ServiceOverview` |  | |  |  |
| validations | [IstioValidations](#istio-validations)| `IstioValidations` |  | |  |  |



### <span id="service-name"></span> ServiceName


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Cluster | string| `string` |  | |  |  |
| Name | string| `string` |  | |  |  |
| Namespace | string| `string` |  | |  |  |



### <span id="service-overview"></span> ServiceOverview


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Annotations | map of string| `map[string]string` |  | | Annotations of Deployment |  |
| AppLabel | boolean| `bool` | ✓ | | Has label app | `true` |
| Cluster | string| `string` |  | | The kube cluster where this service is located. |  |
| HealthAnnotations | map of string| `map[string]string` |  | | Annotations of the service |  |
| IsAmbient | boolean| `bool` | ✓ | | Check if it has Ambient enabled | `true` |
| IstioReferences | [][IstioValidationKey](#istio-validation-key)| `[]*IstioValidationKey` |  | | Istio References |  |
| IstioSidecar | boolean| `bool` | ✓ | | Define if Pods related to this Service has an IstioSidecar deployed | `true` |
| KialiWizard | string| `string` |  | | Kiali Wizard scenario, if any |  |
| Labels | map of string| `map[string]string` |  | | Labels for Service |  |
| Name | string| `string` | ✓ | | Name of the Service | `reviews-v1` |
| Namespace | string| `string` |  | | Namespace of the Service |  |
| Ports | map of int64 (formatted integer)| `map[string]int64` |  | | Names and Ports of Service |  |
| Selector | map of string| `map[string]string` |  | | Selector for Service |  |
| ServiceRegistry | string| `string` |  | | ServiceRegistry values:</br>Kubernetes: 	is a service registry backed by k8s API server</br>External: 	is a service registry for externally provided ServiceEntries |  |
| additionalDetailSample | [AdditionalItem](#additional-item)| `AdditionalItem` |  | |  |  |
| health | [ServiceHealth](#service-health)| `ServiceHealth` |  | |  |  |



### <span id="service-port"></span> ServicePort


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Name | string| `string` |  | | Label assigned to the port. |  |
| Number | uint32 (formatted integer)| `uint32` |  | | A valid non-negative integer port number. |  |
| Protocol | string| `string` |  | | The protocol exposed on the port.</br>MUST be one of HTTP|HTTPS|GRPC|HTTP2|MONGO|TCP|TLS.</br>TLS implies the connection will be routed based on the SNI header to</br>the destination without terminating the TLS connection. |  |
| TargetPort | uint32 (formatted integer)| `uint32` |  | | The port number on the endpoint where the traffic will be</br>received. If unset, default to `number`. |  |



### <span id="service-reference-info"></span> ServiceReferenceInfo


> Used, for example, to link services to Ambient waypoint proxies
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Cluster | string| `string` |  | | Cluster |  |
| LabelType | string| `string` |  | | LabelType in case of waypoint workloads,</br>Where the label comes from (namespace, workload or service) | `namespace` |
| Name | string| `string` | ✓ | | Name for the service |  |
| Namespace | string| `string` | ✓ | | Namespace where the workload live in | `bookinfo` |



### <span id="session-persistence"></span> SessionPersistence


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| SessionName | string| `string` |  | | SessionName defines the name of the persistent session token</br>which may be reflected in the cookie or the header. Users</br>should avoid reusing session names to prevent unintended</br>consequences, such as rejection or unpredictable behavior.</br></br>Support: Implementation-specific |  |
| absoluteTimeout | [V1Duration](#v1-duration)| `V1Duration` |  | |  |  |
| cookieConfig | [CookieConfig](#cookie-config)| `CookieConfig` |  | |  |  |
| type | [SessionPersistenceType](#session-persistence-type)| `SessionPersistenceType` |  | |  |  |



### <span id="session-persistence-type"></span> SessionPersistenceType


  

| Name | Type | Go type | Default | Description | Example |
|------|------|---------| ------- |-------------|---------|
| SessionPersistenceType | string| string | |  |  |



### <span id="socket-address"></span> SocketAddress


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| SocketAddr | string| `string` |  | |  |  |



### <span id="span"></span> Span


> Span is a span denoting a piece of work in some infrastructure
When converting to UI model, ParentSpanID and Process should be dereferenced into
References and ProcessID, respectively.
When converting to ES model, ProcessID and Warnings should be omitted. Even if
included, ES with dynamic settings off will automatically ignore unneeded fields.
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Duration | uint64 (formatted integer)| `uint64` |  | |  |  |
| Flags | uint32 (formatted integer)| `uint32` |  | |  |  |
| Logs | [][Log](#log)| `[]*Log` |  | |  |  |
| OperationName | string| `string` |  | |  |  |
| References | [][JSONReference](#json-reference)| `[]*JSONReference` |  | |  |  |
| StartTime | uint64 (formatted integer)| `uint64` |  | |  |  |
| Tags | [][KeyValue](#key-value)| `[]*KeyValue` |  | |  |  |
| Warnings | []string| `[]string` |  | |  |  |
| parentSpanID | [SpanID](#span-id)| `SpanID` |  | |  |  |
| process | [Process](#process)| `Process` |  | |  |  |
| processID | [ProcessID](#process-id)| `ProcessID` |  | |  |  |
| spanID | [SpanID](#span-id)| `SpanID` |  | |  |  |
| traceID | [TraceID](#trace-id)| `TraceID` |  | |  |  |



### <span id="span-id"></span> SpanID


> SpanID is the id of a span
  



| Name | Type | Go type | Default | Description | Example |
|------|------|---------| ------- |-------------|---------|
| SpanID | string| string | | SpanID is the id of a span |  |



### <span id="spire-info"></span> SpireInfo


> SpireInfo contains SPIRE-related information for a workload
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| IsSpireManaged | boolean| `bool` |  | | Indicates if the workload is SPIRE-managed |  |
| IsSpireServer | boolean| `bool` |  | | Indicates if the workload is a SPIRE Server/Agent (Server, Agent, Driver, Provider) |  |
| ManagedIdentityMatches | [][SpireManagedIdentityMatch](#spire-managed-identity-match)| `[]*SpireManagedIdentityMatch` |  | | Ordered list of match types and their key-value pairs that indicate SPIRE-managed identity</br>Preserves the order of detection (priority: Annotations, TemplateLabels/Labels, PodLabels) |  |



### <span id="spire-managed-identity-match"></span> SpireManagedIdentityMatch


> SpireManagedIdentityMatch represents a single match that indicates SPIRE-managed identity
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| MatchType | string| `string` |  | | Match type: "Annotations", "Labels", "PodLabels" |  |
| MatchValue | string| `string` |  | | Key-value pair string (e.g., "inject.istio.io/templates: spire") |  |



### <span id="stat"></span> Stat


> Stat holds arbitrary stat name & value
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Name | string| `string` |  | |  |  |
| Value | double (formatted number)| `float64` |  | |  |  |



### <span id="status-info"></span> StatusInfo


> StatusInfo statusInfo
This is used for returning a response of Kiali Status
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| ExternalServices | [][ExternalServiceInfo](#external-service-info)| `[]*ExternalServiceInfo` |  | | An array of external services installed |  |
| Status | map of string| `map[string]string` | ✓ | | The state of Kiali</br>A hash of key,values with versions of Kiali and state |  |
| WarningMessages | []string| `[]string` |  | | An array of warningMessages. CAUTION: Please read the doc comments the in AddWarningMessages func. |  |
| istioEnvironment | [IstioEnvironment](#istio-environment)| `IstioEnvironment` | ✓ | |  |  |



### <span id="string-match"></span> StringMatch


> Describes how to match a given string in HTTP headers. `exact` and `prefix` matching is
case-sensitive. `regex` matching supports case-insensitive matches.
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| MatchType | [IsStringMatchMatchType](#is-string-match-match-type)| `IsStringMatchMatchType` |  | |  |  |



### <span id="subset"></span> Subset


> ```yaml
apiVersion: networking.istio.io/v1
kind: DestinationRule
metadata:


spec:

trafficPolicy:
loadBalancer:
simple: LEAST_REQUEST
subsets:
- name: testversion
labels:
trafficPolicy:
loadBalancer:
simple: ROUND_ROBIN

```

**Note:** Policies specified for subsets will not take effect until
a route rule explicitly sends traffic to this subset.

One or more labels are typically required to identify the subset destination,
however, when the corresponding DestinationRule represents a host that
supports multiple SNI hosts (e.g., an egress gateway), a subset without labels
may be meaningful. In this case a traffic policy with [ClientTLSSettings](#ClientTLSSettings)
can be used to identify a specific SNI host corresponding to the named subset.
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Labels | map of string| `map[string]string` |  | | Labels apply a filter over the endpoints of a service in the</br>service registry. See route rules for examples of usage. |  |
| Name | string| `string` |  | | Name of the subset. The service name and the subset name can</br>be used for traffic splitting in a route rule. |  |
| traffic_policy | [TrafficPolicy](#traffic-policy)| `TrafficPolicy` |  | |  |  |



### <span id="tcp-route"></span> TCPRoute


> ```yaml
apiVersion: networking.istio.io/v1
kind: VirtualService
metadata:


spec:

hosts:
- mongo.prod.svc.cluster.local
tcp:
- match:
- port: 27017
route:
- destination:
port:
number: 5555

```
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Match | [][L4MatchAttributes](#l4-match-attributes)| `[]*L4MatchAttributes` |  | | Match conditions to be satisfied for the rule to be</br>activated. All conditions inside a single match block have AND</br>semantics, while the list of match blocks have OR semantics. The rule</br>is matched if any one of the match blocks succeed. |  |
| Route | [][RouteDestination](#route-destination)| `[]*RouteDestination` |  | | The destination to which the connection should be forwarded to. |  |



### <span id="tls-match-attributes"></span> TLSMatchAttributes


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| DestinationSubnets | []string| `[]string` |  | | IPv4 or IPv6 ip addresses of destination with optional subnet.  E.g.,</br>a.b.c.d/xx form or just a.b.c.d. |  |
| Gateways | []string| `[]string` |  | | Names of gateways where the rule should be applied. Gateway names</br>in the top-level `gateways` field of the VirtualService (if any) are overridden. The gateway</br>match is independent of sourceLabels. |  |
| Port | uint32 (formatted integer)| `uint32` |  | | Specifies the port on the host that is being addressed. Many services</br>only expose a single port or label ports with the protocols they</br>support, in these cases it is not required to explicitly select the</br>port. |  |
| SniHosts | []string| `[]string` |  | | SNI (server name indicator) to match on. Wildcard prefixes</br>can be used in the SNI value, e.g., *.com will match foo.example.com</br>as well as example.com. An SNI value must be a subset (i.e., fall</br>within the domain) of the corresponding virtual service's hosts. |  |
| SourceLabels | map of string| `map[string]string` |  | | One or more labels that constrain the applicability of a rule to</br>workloads with the given labels. If the VirtualService has a list of</br>gateways specified in the top-level `gateways` field, it should include the reserved gateway</br>`mesh` in order for this field to be applicable.</br></br>**Note:** This is not a runtime match, but is a selector; it filters which workloads the</br>VirtualService applies to. |  |
| SourceNamespace | string| `string` |  | | Source namespace constraining the applicability of a rule to workloads in that namespace.</br>If the VirtualService has a list of gateways specified in the top-level `gateways` field,</br>it must include the reserved gateway `mesh` for this field to be applicable.</br></br>**Note:** This is not a runtime match, but is a selector; it filters which workloads the</br>VirtualService applies to. |  |



### <span id="tls-route"></span> TLSRoute


> ```yaml
apiVersion: networking.istio.io/v1
kind: VirtualService
metadata:


spec:

hosts:
- "*.bookinfo.com"
gateways:
- mygateway
tls:
- match:
- port: 443
sniHosts:
- login.bookinfo.com
route:
- destination:
- match:
- port: 443
sniHosts:
- reviews.bookinfo.com
route:
- destination:

```
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Match | [][TLSMatchAttributes](#tls-match-attributes)| `[]*TLSMatchAttributes` |  | | Match conditions to be satisfied for the rule to be</br>activated. All conditions inside a single match block have AND</br>semantics, while the list of match blocks have OR semantics. The rule</br>is matched if any one of the match blocks succeed. |  |
| Route | [][RouteDestination](#route-destination)| `[]*RouteDestination` |  | | The destination to which the connection should be forwarded to. |  |



### <span id="tag"></span> Tag


> It allows you to keep your dataplane revision labels stable
while changing the controlplane revision so that you don't
need to update all your namespace labels each time you upgrade
your controlplane.
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Cluster | string| `string` |  | | Cluster is the cluster that the tag is associated with. |  |
| Name | string| `string` |  | | Name is the name of the tag. |  |
| Revision | string| `string` |  | | Revision is the revision of the controlplane associated with this tag. |  |



### <span id="target"></span> Target


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Cluster | string| `string` |  | |  |  |
| Kind | string| `string` |  | |  |  |
| Name | string| `string` |  | |  |  |
| Namespace | string| `string` |  | |  |  |



### <span id="tempo-config"></span> TempoConfig


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| CacheCapacity | int64 (formatted integer)| `int64` |  | |  |  |
| CacheEnabled | boolean| `bool` |  | |  |  |
| DatasourceUID | string| `string` |  | |  |  |
| Name | string| `string` |  | |  |  |
| Namespace | string| `string` |  | |  |  |
| OrgID | string| `string` |  | |  |  |
| Tenant | string| `string` |  | |  |  |
| URLFormat | string| `string` |  | |  |  |



### <span id="time-duration"></span> TimeDuration


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Nanos | int64 (formatted integer)| `int64` |  | |  |  |
| Secs | int64 (formatted integer)| `int64` |  | |  |  |



### <span id="timestamp"></span> Timestamp


> All minutes are 60 seconds long. Leap seconds are "smeared" so that no leap
second table is needed for interpretation, using a [24-hour linear
smear](https://developers.google.com/time/smear).

The range is from 0001-01-01T00:00:00Z to 9999-12-31T23:59:59.999999999Z. By
restricting to that range, we ensure that we can convert to and from [RFC
3339](https://www.ietf.org/rfc/rfc3339.txt) date strings.

# Examples

Example 1: Compute Timestamp from POSIX `time()`.

Timestamp timestamp;
timestamp.set_seconds(time(NULL));
timestamp.set_nanos(0);

Example 2: Compute Timestamp from POSIX `gettimeofday()`.

struct timeval tv;
gettimeofday(&tv, NULL);

Timestamp timestamp;
timestamp.set_seconds(tv.tv_sec);
timestamp.set_nanos(tv.tv_usec * 1000);

Example 3: Compute Timestamp from Win32 `GetSystemTimeAsFileTime()`.

FILETIME ft;
GetSystemTimeAsFileTime(&ft);
UINT64 ticks = (((UINT64)ft.dwHighDateTime) << 32) | ft.dwLowDateTime;

A Windows tick is 100 nanoseconds. Windows epoch 1601-01-01T00:00:00Z
is 11644473600 seconds before Unix epoch 1970-01-01T00:00:00Z.
Timestamp timestamp;
timestamp.set_seconds((INT64) ((ticks / 10000000) - 11644473600LL));
timestamp.set_nanos((INT32) ((ticks % 10000000) * 100));

Example 4: Compute Timestamp from Java `System.currentTimeMillis()`.

long millis = System.currentTimeMillis();

Timestamp timestamp = Timestamp.newBuilder().setSeconds(millis / 1000)
.setNanos((int) ((millis % 1000) * 1000000)).build();

Example 5: Compute Timestamp from Java `Instant.now()`.

Instant now = Instant.now();

Timestamp timestamp =
Timestamp.newBuilder().setSeconds(now.getEpochSecond())
.setNanos(now.getNano()).build();

Example 6: Compute Timestamp from current time in Python.

timestamp = Timestamp()
timestamp.GetCurrentTime()

# JSON Mapping

In JSON format, the Timestamp type is encoded as a string in the
[RFC 3339](https://www.ietf.org/rfc/rfc3339.txt) format. That is, the
format is "{year}-{month}-{day}T{hour}:{min}:{sec}[.{frac_sec}]Z"
where {year} is always expressed using four digits while {month}, {day},
{hour}, {min}, and {sec} are zero-padded to two digits each. The fractional
seconds, which can go up to 9 digits (i.e. up to 1 nanosecond resolution),
are optional. The "Z" suffix indicates the timezone ("UTC"); the timezone
is required. A proto3 JSON serializer should always use UTC (as indicated by
"Z") when printing the Timestamp type and a proto3 JSON parser should be
able to accept both UTC and other timezones (as indicated by an offset).

For example, "2017-01-15T01:30:15.01Z" encodes 15.01 seconds past
01:30 UTC on January 15, 2017.

In JavaScript, one can convert a Date object to this format using the
standard
[toISOString()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/toISOString)
method. In Python, a standard `datetime.datetime` object can be converted
to this format using
[`strftime`](https://docs.python.org/2/library/time.html#time.strftime) with
the time format spec '%Y-%m-%dT%H:%M:%S.%fZ'. Likewise, in Java, one can use
the Joda Time's [`ISODateTimeFormat.dateTime()`](
http://joda-time.sourceforge.net/apidocs/org/joda/time/format/ISODateTimeFormat.html#dateTime()
) to obtain a formatter capable of generating timestamps in this format.
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Nanos | int32 (formatted integer)| `int32` |  | | Non-negative fractions of a second at nanosecond resolution. This field is</br>the nanosecond portion of the duration, not an alternative to seconds.</br>Negative second values with fractions must still have non-negative nanos</br>values that count forward in time. Must be between 0 and 999,999,999</br>inclusive. |  |
| Seconds | int64 (formatted integer)| `int64` |  | | Represents seconds of UTC time since Unix epoch 1970-01-01T00:00:00Z. Must</br>be between -315576000000 and 315576000000 inclusive (which corresponds to</br>0001-01-01T00:00:00Z to 9999-12-31T23:59:59Z). |  |



### <span id="topology"></span> Topology


> Topology describes the configuration for relative location of a proxy with
respect to intermediate trusted proxies and the client. These settings
control how the client attributes are retrieved from the incoming traffic by
the gateway proxy and propagated to the upstream services in the cluster.
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| NumTrustedProxies | uint32 (formatted integer)| `uint32` |  | | Number of trusted proxies deployed in front of the Istio gateway proxy.</br>When this option is set to value N greater than zero, the trusted client</br>address is assumed to be the Nth address from the right end of the</br>X-Forwarded-For (XFF) header from the incoming request. If the</br>X-Forwarded-For (XFF) header is missing or has fewer than N addresses, the</br>gateway proxy falls back to using the immediate downstream connection's</br>source address as the trusted client address.</br>Note that the gateway proxy will append the downstream connection's source</br>address to the X-Forwarded-For (XFF) address and set the</br>X-Envoy-External-Address header to the trusted client address before</br>forwarding it to the upstream services in the cluster.</br>The default value of numTrustedProxies is 0.</br>See [Envoy XFF](https://www.envoyproxy.io/docs/envoy/latest/configuration/http/http_conn_man/headers#config-http-conn-man-headers-x-forwarded-for)</br>header handling for more details. |  |
| forward_client_cert_details | [ForwardClientCertDetails](#forward-client-cert-details)| `ForwardClientCertDetails` |  | |  |  |
| proxy_protocol | [TopologyProxyProtocolConfiguration](#topology-proxy-protocol-configuration)| `TopologyProxyProtocolConfiguration` |  | |  |  |



### <span id="topology-proxy-protocol-configuration"></span> Topology_ProxyProtocolConfiguration


  

[any](#any)

### <span id="trace"></span> Trace


> Trace is a list of spans
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Matched | int64 (formatted integer)| `int64` |  | |  |  |
| Processes | map of [Process](#process)| `map[string]Process` |  | |  |  |
| Spans | [][Span](#span)| `[]*Span` |  | |  |  |
| Warnings | []string| `[]string` |  | |  |  |
| traceID | [TraceID](#trace-id)| `TraceID` |  | |  |  |



### <span id="trace-id"></span> TraceID


  

| Name | Type | Go type | Default | Description | Example |
|------|------|---------| ------- |-------------|---------|
| TraceID | string| string | |  |  |



### <span id="tracing"></span> Tracing


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| CustomTags | map of [TracingCustomTag](#tracing-custom-tag)| `map[string]TracingCustomTag` |  | | Configures the custom tags to be added to active span by all proxies (i.e. sidecars</br>and gateways).</br>The key represents the name of the tag.</br>Ex:</br>```yaml</br>custom_tags:</br></br>new_tag_name:</br>header:</br>default_value: defaulted-value-from-custom-header</br></br>```</br>$hide_from_docs |  |
| MaxPathTagLength | uint32 (formatted integer)| `uint32` |  | | Configures the maximum length of the request path to extract and include in the</br>HttpUrl tag. Used to truncate length request paths to meet the needs of tracing</br>backend. If not set, then a length of 256 will be used.</br>$hide_from_docs |  |
| Sampling | double (formatted number)| `float64` |  | | The percentage of requests (0.0 - 100.0) that will be randomly selected for trace generation,</br>if not requested by the client or not forced. Default is 1.0. |  |
| Tracer | [IsTracingTracer](#is-tracing-tracer)| `IsTracingTracer` |  | |  |  |
| enable_istio_tags | [BoolValue](#bool-value)| `BoolValue` |  | |  |  |
| tls_settings | [ClientTLSSettings](#client-tls-settings)| `ClientTLSSettings` |  | |  |  |



### <span id="tracing-diagnose"></span> TracingDiagnose


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int64 (formatted integer)| `int64` |  | |  |  |
| LogLine | [][LogLine](#log-line)| `[]*LogLine` |  | |  |  |
| Message | string| `string` |  | |  |  |
| ValidConfig | [][ValidConfig](#valid-config)| `[]*ValidConfig` |  | |  |  |



### <span id="tracing-info"></span> TracingInfo


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Enabled | boolean| `bool` |  | |  |  |
| Integration | boolean| `bool` |  | |  |  |
| InternalURL | string| `string` |  | |  |  |
| NamespaceSelector | boolean| `bool` |  | |  |  |
| Provider | string| `string` |  | |  |  |
| URL | string| `string` |  | |  |  |
| UseWaypointName | boolean| `bool` |  | |  |  |
| WhiteListIstioSystem | []string| `[]string` |  | |  |  |
| tempoConfig | [TempoConfig](#tempo-config)| `TempoConfig` |  | |  |  |



### <span id="tracing-span"></span> TracingSpan


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Duration | uint64 (formatted integer)| `uint64` |  | |  |  |
| Flags | uint32 (formatted integer)| `uint32` |  | |  |  |
| Logs | [][Log](#log)| `[]*Log` |  | |  |  |
| OperationName | string| `string` |  | |  |  |
| References | [][JSONReference](#json-reference)| `[]*JSONReference` |  | |  |  |
| StartTime | uint64 (formatted integer)| `uint64` |  | |  |  |
| Tags | [][KeyValue](#key-value)| `[]*KeyValue` |  | |  |  |
| TraceSize | int64 (formatted integer)| `int64` |  | |  |  |
| Warnings | []string| `[]string` |  | |  |  |
| parentSpanID | [SpanID](#span-id)| `SpanID` |  | |  |  |
| process | [Process](#process)| `Process` |  | |  |  |
| processID | [ProcessID](#process-id)| `ProcessID` |  | |  |  |
| spanID | [SpanID](#span-id)| `SpanID` |  | |  |  |
| traceID | [TraceID](#trace-id)| `TraceID` |  | |  |  |



### <span id="tracing-custom-tag"></span> Tracing_CustomTag


> Tags can be generated via literals, environment variables or an incoming request header.
$hide_from_docs
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Type | [IsTracingCustomTagType](#is-tracing-custom-tag-type)| `IsTracingCustomTagType` |  | |  |  |



### <span id="traffic-policy"></span> TrafficPolicy


> Traffic policies to apply for a specific destination, across all
destination ports. See DestinationRule for examples.
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| PortLevelSettings | [][TrafficPolicyPortTrafficPolicy](#traffic-policy-port-traffic-policy)| `[]*TrafficPolicyPortTrafficPolicy` |  | | Traffic policies specific to individual ports. Note that port level</br>settings will override the destination-level settings. Traffic</br>settings specified at the destination-level will not be inherited when</br>overridden by port-level settings, i.e. default values will be applied</br>to fields omitted in port-level traffic policies. |  |
| connection_pool | [ConnectionPoolSettings](#connection-pool-settings)| `ConnectionPoolSettings` |  | |  |  |
| load_balancer | [LoadBalancerSettings](#load-balancer-settings)| `LoadBalancerSettings` |  | |  |  |
| outlier_detection | [OutlierDetection](#outlier-detection)| `OutlierDetection` |  | |  |  |
| proxy_protocol | [TrafficPolicyProxyProtocol](#traffic-policy-proxy-protocol)| `TrafficPolicyProxyProtocol` |  | |  |  |
| retry_budget | [TrafficPolicyRetryBudget](#traffic-policy-retry-budget)| `TrafficPolicyRetryBudget` |  | |  |  |
| tls | [ClientTLSSettings](#client-tls-settings)| `ClientTLSSettings` |  | |  |  |
| tunnel | [TrafficPolicyTunnelSettings](#traffic-policy-tunnel-settings)| `TrafficPolicyTunnelSettings` |  | |  |  |



### <span id="traffic-policy-port-traffic-policy"></span> TrafficPolicy_PortTrafficPolicy


> Traffic policies that apply to specific ports of the service
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| connection_pool | [ConnectionPoolSettings](#connection-pool-settings)| `ConnectionPoolSettings` |  | |  |  |
| load_balancer | [LoadBalancerSettings](#load-balancer-settings)| `LoadBalancerSettings` |  | |  |  |
| outlier_detection | [OutlierDetection](#outlier-detection)| `OutlierDetection` |  | |  |  |
| port | [PortSelector](#port-selector)| `PortSelector` |  | |  |  |
| tls | [ClientTLSSettings](#client-tls-settings)| `ClientTLSSettings` |  | |  |  |



### <span id="traffic-policy-proxy-protocol"></span> TrafficPolicy_ProxyProtocol


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| version | [TrafficPolicyProxyProtocolVERSION](#traffic-policy-proxy-protocol-v-e-r-s-i-o-n)| `TrafficPolicyProxyProtocolVERSION` |  | |  |  |



### <span id="traffic-policy-proxy-protocol-v-e-r-s-i-o-n"></span> TrafficPolicy_ProxyProtocol_VERSION


  

| Name | Type | Go type | Default | Description | Example |
|------|------|---------| ------- |-------------|---------|
| TrafficPolicy_ProxyProtocol_VERSION | int32 (formatted integer)| int32 | |  |  |



### <span id="traffic-policy-retry-budget"></span> TrafficPolicy_RetryBudget


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| MinRetryConcurrency | uint32 (formatted integer)| `uint32` |  | | Specifies the minimum retry concurrency allowed for the retry budget.</br>For example, a budget of 20% with a minimum retry concurrency of 3</br>will allow 5 active retries while there are 25 active requests.</br>If there are 2 active requests, there are still 3 active retries</br>allowed because of the minimum retry concurrency.</br></br>Defaults to 3. |  |
| percent | [DoubleValue](#double-value)| `DoubleValue` |  | |  |  |



### <span id="traffic-policy-tunnel-settings"></span> TrafficPolicy_TunnelSettings


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Protocol | string| `string` |  | | Specifies which protocol to use for tunneling the downstream connection.</br>Supported protocols are:</br>- CONNECT - uses HTTP CONNECT;</br>- POST - uses HTTP POST.</br></br>CONNECT is used by default if not specified.</br></br>HTTP version for upstream requests is determined by the service protocol defined for the proxy. |  |
| TargetHost | string| `string` |  | | Specifies a host to which the downstream connection is tunneled.</br>Target host must be an FQDN or IP address. |  |
| TargetPort | uint32 (formatted integer)| `uint32` |  | | Specifies a port to which the downstream connection is tunneled. |  |



### <span id="uid"></span> UID


> UID is a type that holds unique ID values, including UUIDs.  Because we
don't ONLY use UUIDs, this is an alias to string.  Being a type captures
intent and helps make sure that UIDs and names do not get conflated.
  



| Name | Type | Go type | Default | Description | Example |
|------|------|---------| ------- |-------------|---------|
| UID | string| string | | UID is a type that holds unique ID values, including UUIDs.  Because we</br>don't ONLY use UUIDs, this is an alias to string.  Being a type captures</br>intent and helps make sure that UIDs and names do not get conflated. |  |



### <span id="u-int32-value"></span> UInt32Value


> The JSON representation for `UInt32Value` is JSON number.

Not recommended for use in new APIs, but still useful for legacy APIs and
has no plan to be removed.
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Value | uint32 (formatted integer)| `uint32` |  | | The uint32 value. |  |



### <span id="user-session-data"></span> UserSessionData


> UserSessionData userSessionData
This is used for returning the token
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| ExpiresOn | date-time (formatted string)| `strfmt.DateTime` | ✓ | | The expired time for the token</br>A string with the Datetime when the token will be expired | `Thu, 07 Mar 2019 17:50:26 +0000` |
| Username | string| `string` | ✓ | | The username for the token</br>A string with the user's username | `admin` |



### <span id="v1-destination-rule"></span> V1DestinationRule


> <!-- crd generation tags
representing the server time when this object was created. It is not guaranteed to be set in happens-before order across separate operations.
Clients may not set this value. It is represented in RFC3339 form and is in UTC.
Populated by the system. Read-only. Null for lists. For more information, see [Kubernetes API Conventions](https://github.com/kubernetes/community/blob/master/contributors/devel/sig-architecture/api-conventions.md#metadata)"
-->

<!-- go code generation tags
-->
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| APIVersion | string| `string` |  | | APIVersion defines the versioned schema of this representation of an object.</br>Servers should convert recognized schemas to the latest internal value, and</br>may reject unrecognized values.</br>More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#resources |  |
| Kind | string| `string` |  | | Kind is a string value representing the REST resource this object represents.</br>Servers may infer this from the endpoint the client submits requests to.</br>Cannot be updated.</br>In CamelCase.</br>More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds |  |
| metadata | [ObjectMeta](#object-meta)| `ObjectMeta` |  | |  |  |
| spec | [V1alpha3DestinationRule](#v1alpha3-destination-rule)| `V1alpha3DestinationRule` |  | |  |  |
| status | [IstioStatus](#istio-status)| `IstioStatus` |  | |  |  |



### <span id="v1-duration"></span> V1Duration


> Duration is a string value representing a duration in time. The format is as specified
in GEP-2257, a strict subset of the syntax parsed by Golang time.ParseDuration.
  



| Name | Type | Go type | Default | Description | Example |
|------|------|---------| ------- |-------------|---------|
| V1Duration | string| string | | Duration is a string value representing a duration in time. The format is as specified</br>in GEP-2257, a strict subset of the syntax parsed by Golang time.ParseDuration. |  |



### <span id="v1-http-route"></span> V1HTTPRoute


> HTTPRoute provides a way to route HTTP requests. This includes the capability
to match requests by hostname, path, header, or query param. Filters can be
used to specify additional processing steps. Backends specify where matching
requests should be routed.
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| APIVersion | string| `string` |  | | APIVersion defines the versioned schema of this representation of an object.</br>Servers should convert recognized schemas to the latest internal value, and</br>may reject unrecognized values.</br>More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#resources |  |
| Kind | string| `string` |  | | Kind is a string value representing the REST resource this object represents.</br>Servers may infer this from the endpoint the client submits requests to.</br>Cannot be updated.</br>In CamelCase.</br>More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds |  |
| metadata | [ObjectMeta](#object-meta)| `ObjectMeta` |  | |  |  |
| spec | [HTTPRouteSpec](#http-route-spec)| `HTTPRouteSpec` |  | |  |  |
| status | [HTTPRouteStatus](#http-route-status)| `HTTPRouteStatus` |  | |  |  |



### <span id="v1-label-selector"></span> V1LabelSelector


> This simplified version uses only the matchLabels field.
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| MatchLabels | map of [LabelValue](#label-value)| `map[string]LabelValue` |  | | MatchLabels contains a set of required {key,value} pairs.</br>An object must match every label in this map to be selected.</br>The matching logic is an AND operation on all entries. |  |



### <span id="v1-port"></span> V1Port


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| number | [PortNumber](#port-number)| `PortNumber` |  | |  |  |



### <span id="v1-reference-grant"></span> V1ReferenceGrant


> Each ReferenceGrant can be used to represent a unique trust relationship.
Additional Reference Grants can be used to add to the set of trusted
sources of inbound references for the namespace they are defined within.

All cross-namespace references in Gateway API (with the exception of cross-namespace
Gateway-route attachment) require a ReferenceGrant.

ReferenceGrant is a form of runtime verification allowing users to assert
which cross-namespace object references are permitted. Implementations that
support ReferenceGrant MUST NOT permit cross-namespace references which have
no grant, and MUST respond to the removal of a grant by revoking the access
that the grant allowed.
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| APIVersion | string| `string` |  | | APIVersion defines the versioned schema of this representation of an object.</br>Servers should convert recognized schemas to the latest internal value, and</br>may reject unrecognized values.</br>More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#resources |  |
| Kind | string| `string` |  | | Kind is a string value representing the REST resource this object represents.</br>Servers may infer this from the endpoint the client submits requests to.</br>Cannot be updated.</br>In CamelCase.</br>More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds |  |
| metadata | [ObjectMeta](#object-meta)| `ObjectMeta` |  | |  |  |
| spec | [ReferenceGrantSpec](#reference-grant-spec)| `ReferenceGrantSpec` |  | |  |  |



### <span id="v1-service-entry"></span> V1ServiceEntry


> <!-- crd generation tags
mesh or part of the mesh (MESH_EXTERNAL or MESH_INTERNAL)"
(NONE, STATIC, or DNS)"
representing the server time when this object was created. It is not guaranteed to be set in happens-before order across separate operations.
Clients may not set this value. It is represented in RFC3339 form and is in UTC.
Populated by the system. Read-only. Null for lists. More info: https://git.k8s.io/community/contributors/devel/api-conventions.md#metadata"
-->

<!-- go code generation tags
istiostatus-override: ServiceEntryStatus: istio.io/api/networking/v1alpha3
-->
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| APIVersion | string| `string` |  | | APIVersion defines the versioned schema of this representation of an object.</br>Servers should convert recognized schemas to the latest internal value, and</br>may reject unrecognized values.</br>More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#resources |  |
| Kind | string| `string` |  | | Kind is a string value representing the REST resource this object represents.</br>Servers may infer this from the endpoint the client submits requests to.</br>Cannot be updated.</br>In CamelCase.</br>More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds |  |
| metadata | [ObjectMeta](#object-meta)| `ObjectMeta` |  | |  |  |
| spec | [V1alpha3ServiceEntry](#v1alpha3-service-entry)| `V1alpha3ServiceEntry` |  | |  |  |
| status | [ServiceEntryStatus](#service-entry-status)| `ServiceEntryStatus` |  | |  |  |



### <span id="v1-virtual-service"></span> V1VirtualService


> <!-- crd generation tags
that should apply these routes"
representing the server time when this object was created. It is not guaranteed to be set in happens-before order across separate operations.
Clients may not set this value. It is represented in RFC3339 form and is in UTC.
Populated by the system. Read-only. Null for lists. More info: https://git.k8s.io/community/contributors/devel/api-conventions.md#metadata"
-->

<!-- go code generation tags
-->
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| APIVersion | string| `string` |  | | APIVersion defines the versioned schema of this representation of an object.</br>Servers should convert recognized schemas to the latest internal value, and</br>may reject unrecognized values.</br>More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#resources |  |
| Kind | string| `string` |  | | Kind is a string value representing the REST resource this object represents.</br>Servers may infer this from the endpoint the client submits requests to.</br>Cannot be updated.</br>In CamelCase.</br>More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds |  |
| metadata | [ObjectMeta](#object-meta)| `ObjectMeta` |  | |  |  |
| spec | [V1alpha3VirtualService](#v1alpha3-virtual-service)| `V1alpha3VirtualService` |  | |  |  |
| status | [IstioStatus](#istio-status)| `IstioStatus` |  | |  |  |



### <span id="v1alpha1-certificate"></span> V1alpha1Certificate


> secretNamespace: istio-system
dnsNames:
- galley.istio-system.svc
- galley.mydomain.com
}

```
Example 2: key and cert stored in a directory
```
{ dnsNames:
- pilot.istio-system
- pilot.istio-system.svc
- pilot.mydomain.com
}

```
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| DnsNames | []string| `[]string` |  | | The DNS names for the certificate. A certificate may contain</br>multiple DNS names. |  |
| SecretName | string| `string` |  | | Name of the secret the certificate and its key will be stored into.</br>If it is empty, it will not be stored into a secret.</br>Instead, the certificate and its key will be stored into a hard-coded directory. |  |



### <span id="v1alpha1-label-selector"></span> V1alpha1LabelSelector


> A label selector requirement is a selector that contains values, a key, and an operator that
relates the key and values.
Copied from Kubernetes to avoid expensive dependency on Kubernetes libraries.
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| MatchExpressions | [][LabelSelectorRequirement](#label-selector-requirement)| `[]*LabelSelectorRequirement` |  | | matchExpressions is a list of label selector requirements. The requirements are ANDed. |  |
| MatchLabels | map of string| `map[string]string` |  | | matchLabels is a map of {key,value} pairs. A single {key,value} in the matchLabels</br>map is equivalent to an element of matchExpressions, whose key field is "key", the</br>operator is "In", and the values array contains only "value". The requirements are ANDed. |  |



### <span id="v1alpha3-destination-rule"></span> V1alpha3DestinationRule


> <!-- crd generation tags
representing the server time when this object was created. It is not guaranteed to be set in happens-before order across separate operations.
Clients may not set this value. It is represented in RFC3339 form and is in UTC.
Populated by the system. Read-only. Null for lists. For more information, see [Kubernetes API Conventions](https://github.com/kubernetes/community/blob/master/contributors/devel/sig-architecture/api-conventions.md#metadata)"
-->

<!-- go code generation tags
-->
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| ExportTo | []string| `[]string` |  | | A list of namespaces to which this destination rule is exported.</br>The resolution of a destination rule to apply to a service occurs in the</br>context of a hierarchy of namespaces. Exporting a destination rule allows</br>it to be included in the resolution hierarchy for services in</br>other namespaces. This feature provides a mechanism for service owners</br>and mesh administrators to control the visibility of destination rules</br>across namespace boundaries.</br></br>If no namespaces are specified then the destination rule is exported to all</br>namespaces by default.</br></br>The value "." is reserved and defines an export to the same namespace that</br>the destination rule is declared in. Similarly, the value "*" is reserved and</br>defines an export to all namespaces. |  |
| Host | string| `string` |  | | The name of a service from the service registry. Service</br>names are looked up from the platform's service registry (e.g.,</br>Kubernetes services, Consul services, etc.) and from the hosts</br>declared by [ServiceEntries](https://istio.io/docs/reference/config/networking/service-entry/#ServiceEntry). Rules defined for</br>services that do not exist in the service registry will be ignored.</br></br>*Note for Kubernetes users*: When short names are used (e.g. "reviews"</br>instead of "reviews.default.svc.cluster.local"), Istio will interpret</br>the short name based on the namespace of the rule, not the service. A</br>rule in the "default" namespace containing a host "reviews" will be</br>interpreted as "reviews.default.svc.cluster.local", irrespective of</br>the actual namespace associated with the reviews service. To avoid</br>potential misconfigurations, it is recommended to always use fully</br>qualified domain names over short names.</br></br>Note that the host field applies to both HTTP and TCP services. |  |
| Subsets | [][Subset](#subset)| `[]*Subset` |  | | One or more named sets that represent individual versions of a</br>service. Traffic policies can be overridden at subset level. |  |
| traffic_policy | [TrafficPolicy](#traffic-policy)| `TrafficPolicy` |  | |  |  |
| workload_selector | [V1beta1WorkloadSelector](#v1beta1-workload-selector)| `V1beta1WorkloadSelector` |  | |  |  |



### <span id="v1alpha3-http-route"></span> V1alpha3HTTPRoute


> Describes match conditions and actions for routing HTTP/1.1, HTTP2, and
gRPC traffic. See VirtualService for usage examples.
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Match | [][HTTPMatchRequest](#http-match-request)| `[]*HTTPMatchRequest` |  | | Match conditions to be satisfied for the rule to be</br>activated. All conditions inside a single match block have AND</br>semantics, while the list of match blocks have OR semantics. The rule</br>is matched if any one of the match blocks succeed. |  |
| Mirrors | [][HTTPMirrorPolicy](#http-mirror-policy)| `[]*HTTPMirrorPolicy` |  | | Specifies the destinations to mirror HTTP traffic in addition</br>to the original destination. Mirrored traffic is on a</br>best effort basis where the sidecar/gateway will not wait for the</br>mirrored destinations to respond before returning the response from the</br>original destination. Statistics will be generated for the mirrored</br>destination. |  |
| Name | string| `string` |  | | The name assigned to the route for debugging purposes. The</br>route's name will be concatenated with the match's name and will</br>be logged in the access logs for requests matching this</br>route/match. |  |
| Route | [][HTTPRouteDestination](#http-route-destination)| `[]*HTTPRouteDestination` |  | | A HTTP rule can either return a direct_response, redirect or forward (default) traffic.</br>The forwarding target can be one of several versions of a service (see</br>glossary in beginning of document). Weights associated with the</br>service version determine the proportion of traffic it receives. |  |
| cors_policy | [CorsPolicy](#cors-policy)| `CorsPolicy` |  | |  |  |
| delegate | [Delegate](#delegate)| `Delegate` |  | |  |  |
| direct_response | [HTTPDirectResponse](#http-direct-response)| `HTTPDirectResponse` |  | |  |  |
| fault | [HTTPFaultInjection](#http-fault-injection)| `HTTPFaultInjection` |  | |  |  |
| headers | [Headers](#headers)| `Headers` |  | |  |  |
| mirror | [Destination](#destination)| `Destination` |  | |  |  |
| mirror_percent | [UInt32Value](#u-int32-value)| `UInt32Value` |  | |  |  |
| mirror_percentage | [Percent](#percent)| `Percent` |  | |  |  |
| redirect | [HTTPRedirect](#http-redirect)| `HTTPRedirect` |  | |  |  |
| retries | [HTTPRetry](#http-retry)| `HTTPRetry` |  | |  |  |
| rewrite | [HTTPRewrite](#http-rewrite)| `HTTPRewrite` |  | |  |  |
| timeout | [DurationpbDuration](#durationpb-duration)| `DurationpbDuration` |  | |  |  |



### <span id="v1alpha3-service-entry"></span> V1alpha3ServiceEntry


> <!-- crd generation tags
mesh or part of the mesh (MESH_EXTERNAL or MESH_INTERNAL)"
(NONE, STATIC, or DNS)"
representing the server time when this object was created. It is not guaranteed to be set in happens-before order across separate operations.
Clients may not set this value. It is represented in RFC3339 form and is in UTC.
Populated by the system. Read-only. Null for lists. More info: https://git.k8s.io/community/contributors/devel/api-conventions.md#metadata"
-->

<!-- go code generation tags
istiostatus-override: ServiceEntryStatus: istio.io/api/networking/v1alpha3
-->
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Addresses | []string| `[]string` |  | | The virtual IP addresses associated with the service. Could be CIDR</br>prefix. For HTTP traffic, generated route configurations will include http route</br>domains for both the `addresses` and `hosts` field values and the destination will</br>be identified based on the HTTP Host/Authority header.</br>If one or more IP addresses are specified,</br>the incoming traffic will be identified as belonging to this service</br>if the destination IP matches the IP/CIDRs specified in the addresses</br>field. If the Addresses field is empty, traffic will be identified</br>solely based on the destination port. In such scenarios, the port on</br>which the service is being accessed must not be shared by any other</br>service in the mesh. In other words, the sidecar will behave as a</br>simple TCP proxy, forwarding incoming traffic on a specified port to</br>the specified destination endpoint IP/host. Unix domain socket</br>addresses are not supported in this field. Although the API allows</br>specifying addresses in a list, multiple addresses will not be used by a single host.</br>This means manual specification of dual-stack addressing is not supported. |  |
| Endpoints | [][V1alpha3WorkloadEntry](#v1alpha3-workload-entry)| `[]*V1alpha3WorkloadEntry` |  | | One or more endpoints associated with the service. Only one of</br>`endpoints` or `workloadSelector` can be specified. |  |
| ExportTo | []string| `[]string` |  | | A list of namespaces to which this service is exported. Exporting a service</br>allows it to be used by sidecars, gateways and virtual services defined in</br>other namespaces. This feature provides a mechanism for service owners</br>and mesh administrators to control the visibility of services across</br>namespace boundaries.</br></br>If no namespaces are specified then the service is exported to all</br>namespaces by default.</br></br>The value "." is reserved and defines an export to the same namespace that</br>the service is declared in. Similarly the value "*" is reserved and</br>defines an export to all namespaces.</br></br>For a Kubernetes Service, the equivalent effect can be achieved by setting</br>the annotation "networking.istio.io/exportTo" to a comma-separated list</br>of namespace names.</br></br>**Note:** Ztunnel and Waypoint proxies not support this field and will read it at "*". |  |
| Hosts | []string| `[]string` |  | | The hosts associated with the ServiceEntry. Could be a DNS</br>name with wildcard prefix.</br></br>1. The hosts field is used to select matching hosts in VirtualServices and DestinationRules.</br>2. For HTTP traffic the HTTP Host/Authority header will be matched against the hosts field.</br>3. For HTTPs or TLS traffic containing Server Name Indication (SNI), the SNI value</br>will be matched against the hosts field.</br></br>**NOTE 1:** When resolution is set to type DNS and no endpoints</br>are specified, the host field will be used as the DNS name of the</br>endpoint to route traffic to.</br></br>**NOTE 2:** If the hostname matches with the name of a service</br>from another service registry such as Kubernetes that also</br>supplies its own set of endpoints, the ServiceEntry will be</br>treated as a decorator of the existing Kubernetes</br>service. Properties in the service entry will be added to the</br>Kubernetes service if applicable. Currently, only the following</br>additional properties will be considered by `istiod`:</br></br>1. subjectAltNames: In addition to verifying the SANs of the</br>service accounts associated with the pods of the service, the</br>SANs specified here will also be verified.</br></br>**NOTE 3:** Ztunnel and Waypoint proxies do not support wildcard hosts. |  |
| Ports | [][ServicePort](#service-port)| `[]*ServicePort` |  | | The ports associated with the external service. If the</br>Endpoints are Unix domain socket addresses, there must be exactly one</br>port. |  |
| SubjectAltNames | []string| `[]string` |  | | If specified, the proxy will verify that the server certificate's</br>subject alternate name matches one of the specified values.</br></br>NOTE: When using the workloadEntry with workloadSelectors, the</br>service account specified in the workloadEntry will also be used</br>to derive the additional subject alternate names that should be</br>verified. |  |
| location | [ServiceEntryLocation](#service-entry-location)| `ServiceEntryLocation` |  | |  |  |
| resolution | [ServiceEntryResolution](#service-entry-resolution)| `ServiceEntryResolution` |  | |  |  |
| workload_selector | [V1alpha3WorkloadSelector](#v1alpha3-workload-selector)| `V1alpha3WorkloadSelector` |  | |  |  |



### <span id="v1alpha3-virtual-service"></span> V1alpha3VirtualService


> <!-- crd generation tags
that should apply these routes"
representing the server time when this object was created. It is not guaranteed to be set in happens-before order across separate operations.
Clients may not set this value. It is represented in RFC3339 form and is in UTC.
Populated by the system. Read-only. Null for lists. More info: https://git.k8s.io/community/contributors/devel/api-conventions.md#metadata"
-->

<!-- go code generation tags
-->
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| ExportTo | []string| `[]string` |  | | A list of namespaces to which this virtual service is exported. Exporting a</br>virtual service allows it to be used by sidecars and gateways defined in</br>other namespaces. This feature provides a mechanism for service owners</br>and mesh administrators to control the visibility of virtual services</br>across namespace boundaries.</br></br>If no namespaces are specified then the virtual service is exported to all</br>namespaces by default.</br></br>The value "." is reserved and defines an export to the same namespace that</br>the virtual service is declared in. Similarly the value "*" is reserved and</br>defines an export to all namespaces. |  |
| Gateways | []string| `[]string` |  | | The names of gateways and sidecars that should apply these routes.</br>Gateways in other namespaces may be referred to by</br>`<gateway namespace>/<gateway name>`; specifying a gateway with no</br>namespace qualifier is the same as specifying the VirtualService's</br>namespace. A single VirtualService is used for sidecars inside the mesh as</br>well as for one or more gateways. The selection condition imposed by this</br>field can be overridden using the source field in the match conditions</br>of protocol-specific routes. The reserved word `mesh` is used to imply</br>all the sidecars in the mesh. When this field is omitted, the default</br>gateway (`mesh`) will be used, which would apply the rule to all</br>sidecars in the mesh. If a list of gateway names is provided, the</br>rules will apply only to the gateways. To apply the rules to both</br>gateways and sidecars, specify `mesh` as one of the gateway names. |  |
| Hosts | []string| `[]string` |  | | The destination hosts to which traffic is being sent. Could</br>be a DNS name with wildcard prefix or an IP address.  Depending on the</br>platform, short-names can also be used instead of a FQDN (i.e. has no</br>dots in the name). In such a scenario, the FQDN of the host would be</br>derived based on the underlying platform.</br></br>A single VirtualService can be used to describe all the traffic</br>properties of the corresponding hosts, including those for multiple</br>HTTP and TCP ports. Alternatively, the traffic properties of a host</br>can be defined using more than one VirtualService, with certain</br>caveats. Refer to the</br>[Operations Guide](https://istio.io/docs/ops/best-practices/traffic-management/#split-virtual-services)</br>for details.</br></br>*Note for Kubernetes users*: When short names are used (e.g. "reviews"</br>instead of "reviews.default.svc.cluster.local"), Istio will interpret</br>the short name based on the namespace of the rule, not the service. A</br>rule in the "default" namespace containing a host "reviews" will be</br>interpreted as "reviews.default.svc.cluster.local", irrespective of</br>the actual namespace associated with the reviews service. _To avoid</br>potential misconfigurations, it is recommended to always use fully</br>qualified domain names over short names._</br></br>The hosts field applies to both HTTP and TCP services. Service inside</br>the mesh, i.e., those found in the service registry, must always be</br>referred to using their alphanumeric names. IP addresses are allowed</br>only for services defined via the Gateway.</br></br>*Note*: It must be empty for a delegate VirtualService. |  |
| Http | [][V1alpha3HTTPRoute](#v1alpha3-http-route)| `[]*V1alpha3HTTPRoute` |  | | An ordered list of route rules for HTTP traffic. HTTP routes will be</br>applied to platform service ports using HTTP/HTTP2/GRPC protocols, gateway</br>ports with protocol HTTP/HTTP2/GRPC/TLS-terminated-HTTPS and service</br>entry ports using HTTP/HTTP2/GRPC protocols.  The first rule matching</br>an incoming request is used. |  |
| Tcp | [][TCPRoute](#tcp-route)| `[]*TCPRoute` |  | | An ordered list of route rules for opaque TCP traffic. TCP routes will</br>be applied to any port that is not a HTTP or TLS port. The first rule</br>matching an incoming request is used. |  |
| Tls | [][TLSRoute](#tls-route)| `[]*TLSRoute` |  | | An ordered list of route rule for non-terminated TLS & HTTPS</br>traffic. Routing is typically performed using the SNI value presented</br>by the ClientHello message. TLS routes will be applied to platform</br>service ports named 'https-*', 'tls-*', unterminated gateway ports using</br>HTTPS/TLS protocols (i.e. with "passthrough" TLS mode) and service</br>entry ports using HTTPS/TLS protocols.  The first rule matching an</br>incoming request is used.  NOTE: Traffic 'https-*' or 'tls-*' ports</br>without associated virtual service will be treated as opaque TCP</br>traffic. |  |



### <span id="v1alpha3-workload-entry"></span> V1alpha3WorkloadEntry


> <!-- crd generation tags
representing the server time when this object was created. It is not guaranteed to be set in happens-before order across separate operations.
Clients may not set this value. It is represented in RFC3339 form and is in UTC.
Populated by the system. Read-only. Null for lists. More info: https://git.k8s.io/community/contributors/devel/api-conventions.md#metadata"
-->

<!-- go code generation tags
-->
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Address | string| `string` |  | | Address associated with the network endpoint without the</br>port.  Domain names can be used if and only if the resolution is set</br>to DNS, and must be fully-qualified without wildcards. Use the form</br>unix:///absolute/path/to/socket for Unix domain socket endpoints.</br>If address is empty, network must be specified. |  |
| Labels | map of string| `map[string]string` |  | | One or more labels associated with the endpoint. |  |
| Locality | string| `string` |  | | The locality associated with the endpoint. A locality corresponds</br>to a failure domain (e.g., country/region/zone). Arbitrary failure</br>domain hierarchies can be represented by separating each</br>encapsulating failure domain by /. For example, the locality of an</br>an endpoint in US, in US-East-1 region, within availability zone</br>az-1, in data center rack r11 can be represented as</br>us/us-east-1/az-1/r11. Istio will configure the sidecar to route to</br>endpoints within the same locality as the sidecar. If none of the</br>endpoints in the locality are available, endpoints parent locality</br>(but within the same network ID) will be chosen. For example, if</br>there are two endpoints in same network (networkID "n1"), say e1</br>with locality us/us-east-1/az-1/r11 and e2 with locality</br>us/us-east-1/az-2/r12, a sidecar from us/us-east-1/az-1/r11 locality</br>will prefer e1 from the same locality over e2 from a different</br>locality. Endpoint e2 could be the IP associated with a gateway</br>(that bridges networks n1 and n2), or the IP associated with a</br>standard service endpoint. |  |
| Network | string| `string` |  | | Network enables Istio to group endpoints resident in the same L3</br>domain/network. All endpoints in the same network are assumed to be</br>directly reachable from one another. When endpoints in different</br>networks cannot reach each other directly, an Istio Gateway can be</br>used to establish connectivity (usually using the</br>`AUTO_PASSTHROUGH` mode in a Gateway Server). This is</br>an advanced configuration used typically for spanning an Istio mesh</br>over multiple clusters. Required if address is not provided. |  |
| Ports | map of uint32 (formatted integer)| `map[string]uint32` |  | | Set of ports associated with the endpoint. If the port map is</br>specified, it must be a map of servicePortName to this endpoint's</br>port, such that traffic to the service port will be forwarded to</br>the endpoint port that maps to the service's portName. If</br>omitted, and the targetPort is specified as part of the service's</br>port specification, traffic to the service port will be forwarded</br>to one of the endpoints on the specified `targetPort`. If both</br>the targetPort and endpoint's port map are not specified, traffic</br>to a service port will be forwarded to one of the endpoints on</br>the same port.</br></br>**NOTE 1:** Do not use for `unix://` addresses.</br></br>**NOTE 2:** endpoint port map takes precedence over targetPort. |  |
| ServiceAccount | string| `string` |  | | The service account associated with the workload if a sidecar</br>is present in the workload. The service account must be present</br>in the same namespace as the configuration ( WorkloadEntry or a</br>ServiceEntry) |  |
| Weight | uint32 (formatted integer)| `uint32` |  | | The load balancing weight associated with the endpoint. Endpoints</br>with higher weights will receive proportionally higher traffic. |  |



### <span id="v1alpha3-workload-selector"></span> V1alpha3WorkloadSelector


> `WorkloadSelector` specifies the criteria used to determine if the
`Gateway`, `Sidecar`, `EnvoyFilter`, `ServiceEntry`, or `DestinationRule`
configuration can be applied to a proxy. The matching criteria
includes the metadata associated with a proxy, workload instance
info such as labels attached to the pod/VM, or any other info that
the proxy provides to Istio during the initial handshake. If
multiple conditions are specified, all conditions need to match in
order for the workload instance to be selected. Currently, only
label based selection mechanism is supported.
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Labels | map of string| `map[string]string` |  | | One or more labels that indicate a specific set of pods/VMs</br>on which the configuration should be applied. The scope of</br>label search is restricted to the configuration namespace in which the</br>the resource is present. |  |



### <span id="v1beta1-reference-grant"></span> V1beta1ReferenceGrant


> Each ReferenceGrant can be used to represent a unique trust relationship.
Additional Reference Grants can be used to add to the set of trusted
sources of inbound references for the namespace they are defined within.

All cross-namespace references in Gateway API (with the exception of cross-namespace
Gateway-route attachment) require a ReferenceGrant.

ReferenceGrant is a form of runtime verification allowing users to assert
which cross-namespace object references are permitted. Implementations that
support ReferenceGrant MUST NOT permit cross-namespace references which have
no grant, and MUST respond to the removal of a grant by revoking the access
that the grant allowed.
  




* composed type [V1ReferenceGrant](#v1-reference-grant)

### <span id="v1beta1-workload-selector"></span> V1beta1WorkloadSelector


> WorkloadSelector specifies the criteria used to determine if a policy can be applied
to a proxy. The matching criteria includes the metadata associated with a proxy,
workload instance info such as labels attached to the pod/VM, or any other info
that the proxy provides to Istio during the initial handshake. If multiple conditions are
specified, all conditions need to match in order for the workload instance to be
selected. Currently, only label based selection mechanism is supported.
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| MatchLabels | map of string| `map[string]string` |  | | One or more labels that indicate a specific set of pods/VMs</br>on which a policy should be applied. The scope of label search is restricted to</br>the configuration namespace in which the resource is present. |  |



### <span id="v-s-info"></span> VSInfo


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Hostnames | []string| `[]string` |  | | Hostnames is the list of hostnames configured in the associated VSs |  |



### <span id="valid-config"></span> ValidConfig


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| AuthType | string| `string` |  | |  |  |
| NamespaceSelector | boolean| `bool` |  | |  |  |
| Provider | string| `string` |  | |  |  |
| Url | string| `string` |  | |  |  |
| UseGRPC | boolean| `bool` |  | |  |  |
| Warning | string| `string` |  | |  |  |



### <span id="value-type"></span> ValueType


  

| Name | Type | Go type | Default | Description | Example |
|------|------|---------| ------- |-------------|---------|
| ValueType | string| string | |  |  |



### <span id="w-e-info"></span> WEInfo


> WEInfo provides static information about a workload entry
associated with a workload node.
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Name | string| `string` | ✓ | | Name of the workload entry object |  |



### <span id="warmup-configuration"></span> WarmupConfiguration


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| aggression | [DoubleValue](#double-value)| `DoubleValue` |  | |  |  |
| duration | [DurationpbDuration](#durationpb-duration)| `DurationpbDuration` |  | |  |  |
| minimum_percent | [DoubleValue](#double-value)| `DoubleValue` |  | |  |  |



### <span id="waypoint"></span> Waypoint


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Destination | string| `string` |  | |  |  |
| HboneMtlsPort | int64 (formatted integer)| `int64` |  | |  |  |



### <span id="waypoint-edge"></span> WaypointEdge


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Direction | string| `string` |  | |  |  |
| fromEdge | [EdgeData](#edge-data)| `EdgeData` |  | |  |  |



### <span id="workload-entries"></span> WorkloadEntries


  

[][ModelsWorkloadEntry](#models-workload-entry)

### <span id="workload-health"></span> WorkloadHealth


> WorkloadHealth contains aggregated health from various sources, for a given workload
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| requests | [RequestHealth](#request-health)| `RequestHealth` |  | |  |  |
| status | [CalculatedHealthStatus](#calculated-health-status)| `CalculatedHealthStatus` |  | |  |  |
| workloadStatus | [WorkloadStatus](#workload-status)| `WorkloadStatus` |  | |  |  |



### <span id="workload-item"></span> WorkloadItem


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| IsAmbient | boolean| `bool` | ✓ | | Define if belongs to a namespace labeled as ambient | `true` |
| IstioSidecar | boolean| `bool` | ✓ | | Define if all Pods related to the Workload has an IstioSidecar deployed | `true` |
| Labels | map of string| `map[string]string` |  | | Labels for Workload |  |
| Namespace | string| `string` | ✓ | | Namespace of a workload member of an application | `bookinfo` |
| ServiceAccountNames | []string| `[]string` | ✓ | | List of service accounts involved in this application |  |
| WaypointWorkloads | [][WorkloadReferenceInfo](#workload-reference-info)| `[]*WorkloadReferenceInfo` |  | | Ambient waypoint workloads |  |
| WorkloadName | string| `string` | ✓ | | Name of a workload member of an application | `reviews-v1` |
| gvk | [GroupVersionKind](#group-version-kind)| `GroupVersionKind` | ✓ | |  |  |
| spireInfo | [SpireInfo](#spire-info)| `SpireInfo` |  | |  |  |



### <span id="workload-list"></span> WorkloadList


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Namespace | string| `string` | ✓ | | Namespace where the workloads live in | `bookinfo` |
| Workloads | [][WorkloadListItem](#workload-list-item)| `[]*WorkloadListItem` | ✓ | | Workloads for a given namespace |  |
| validations | [IstioValidations](#istio-validations)| `IstioValidations` |  | |  |  |



### <span id="workload-list-item"></span> WorkloadListItem


> WorkloadListItem has the necessary information to display the console workload list
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Annotations | map of string| `map[string]string` |  | | Annotations of Deployment |  |
| AppLabel | boolean| `bool` | ✓ | | Define if Pods related to this Workload has the label App | `true` |
| Cluster | string| `string` |  | | The kube cluster where this workload is located. |  |
| CreatedAt | string| `string` | ✓ | | Creation timestamp (in RFC3339 format) | `2018-07-31T12:24:17Z` |
| DashboardAnnotations | map of string| `map[string]string` |  | | Dashboard annotations |  |
| HealthAnnotations | map of string| `map[string]string` |  | | HealthAnnotations |  |
| IsAmbient | boolean| `bool` | ✓ | | Define if Pods related to this Workload has an IsAmbient deployed | `true` |
| IsGateway | boolean| `bool` | ✓ | | Define if this Workload is a gateway (but not a waypoint) | `true` |
| IsWaypoint | boolean| `bool` | ✓ | | Define if this Workload is an ambient waypoint | `true` |
| IsZtunnel | boolean| `bool` | ✓ | | Define if this Workload is an ambient ztunnel | `true` |
| IstioInjectionAnnotation | boolean| `bool` |  | | Define if Workload has an explicit Istio policy annotation</br>Istio supports this as a label as well - this will be defined if the label is set, too.</br>If both annotation and label are set, if any is false, injection is disabled.</br>It's mapped as a pointer to show three values nil, true, false |  |
| IstioReferences | [][IstioValidationKey](#istio-validation-key)| `[]*IstioValidationKey` |  | | Istio References |  |
| IstioSidecar | boolean| `bool` | ✓ | | Define if Pods related to this Workload has an IstioSidecar deployed | `true` |
| Labels | map of string| `map[string]string` |  | | Workload labels |  |
| Name | string| `string` | ✓ | | Name of the workload | `reviews-v1` |
| Namespace | string| `string` |  | | Namespace of the workload |  |
| PodCount | int64 (formatted integer)| `int64` | ✓ | | Number of current workload pods | `1` |
| ResourceVersion | string| `string` | ✓ | | Kubernetes ResourceVersion | `192892127` |
| ServiceAccountNames | []string| `[]string` |  | | Names of the workload service accounts |  |
| TemplateAnnotations | map of string| `map[string]string` |  | | TemplateAnnotations are the annotations on the pod template if the workload</br>has a pod template. |  |
| TemplateLabels | map of string| `map[string]string` |  | | TemplateLabels are the labels on the pod template if the workload</br>has a pod template. |  |
| ValidationKey | string| `string` |  | | ValidationKey is a pre-calculated key string: "cluster:namespace:name" |  |
| ValidationVersion | string| `string` |  | | ValidationVersion is a pre-calculated string representing the workload "version", basically</br>the workload information that, if changed, requires re-validation (including per-object ignore</br>rules and resolved waypoint references used by ambient checkers such as KIA1313). |  |
| VersionLabel | boolean| `bool` | ✓ | | Define if Pods related to this Workload has the label Version | `true` |
| WaypointWorkloads | []string| `[]string` |  | | Names of the waypoint proxy workloads, if any |  |
| additionalDetailSample | [AdditionalItem](#additional-item)| `AdditionalItem` |  | |  |  |
| gvk | [GroupVersionKind](#group-version-kind)| `GroupVersionKind` | ✓ | |  |  |
| health | [WorkloadHealth](#workload-health)| `WorkloadHealth` |  | |  |  |
| spireInfo | [SpireInfo](#spire-info)| `SpireInfo` |  | |  |  |



### <span id="workload-overviews"></span> WorkloadOverviews


  

[][WorkloadListItem](#workload-list-item)

### <span id="workload-reference-info"></span> WorkloadReferenceInfo


> Used, for example, to link services to Ambient waypoint proxies
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Cluster | string| `string` |  | | Cluster |  |
| LabelType | string| `string` |  | | LabelType in case of waypoint workloads,</br>Where the label comes from (namespace, workload or service) | `namespace` |
| Labels | map of string| `map[string]string` |  | | Workload labels |  |
| Name | string| `string` | ✓ | | Name for the workload |  |
| Namespace | string| `string` | ✓ | | Namespace where the workload live in | `bookinfo` |
| Type | string| `string` |  | | In case of waypoints it can be service/workload | `workload/service` |



### <span id="workload-status"></span> WorkloadStatus


> WorkloadStatus gives
- number of desired replicas defined in the Spec of a controller
- number of current replicas that matches selector of a controller
- number of available replicas for a given workload
In healthy scenarios all variables should point same value.
When something wrong happens the different values can indicate an unhealthy situation.
i.e.
- desired = 1, current = 10, available = 0 would means that a user scaled down a workload from 10 to 1
- but in the operaton 10 pods showed problems, so no pod is available/ready but user will see 10 pods under a workload
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| AvailableReplicas | int32 (formatted integer)| `int32` |  | |  |  |
| CurrentReplicas | int32 (formatted integer)| `int32` |  | |  |  |
| DesiredReplicas | int32 (formatted integer)| `int32` |  | |  |  |
| Name | string| `string` |  | |  |  |
| SyncedProxies | int32 (formatted integer)| `int32` |  | |  |  |



### <span id="ztunnel-config-dump"></span> ZtunnelConfigDump


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Certificates | [][KubernetesCertificate](#kubernetes-certificate)| `[]*KubernetesCertificate` |  | |  |  |
| Policies | [][any](#any)| `[]any` |  | |  |  |
| Services | [][KubernetesService](#kubernetes-service)| `[]*KubernetesService` |  | |  |  |
| Workloads | [][KubernetesWorkload](#kubernetes-workload)| `[]*KubernetesWorkload` |  | |  |  |
| config | [KubernetesConfig](#kubernetes-config)| `KubernetesConfig` |  | |  |  |



### <span id="is-http-body-specifier"></span> isHTTPBody_Specifier


  

[any](#any)

### <span id="is-http-fault-injection-abort-error-type"></span> isHTTPFaultInjection_Abort_ErrorType


  

[any](#any)

### <span id="is-http-fault-injection-delay-http-delay-type"></span> isHTTPFaultInjection_Delay_HttpDelayType


  

[any](#any)

### <span id="is-http-redirect-redirect-port"></span> isHTTPRedirect_RedirectPort


  

[any](#any)

### <span id="is-load-balancer-settings-lb-policy"></span> isLoadBalancerSettings_LbPolicy


  

[any](#any)

### <span id="is-mesh-config-certificate-data-certificate-data"></span> isMeshConfig_CertificateData_CertificateData


  

[any](#any)

### <span id="is-mesh-config-extension-provider-provider"></span> isMeshConfig_ExtensionProvider_Provider


  

[any](#any)

### <span id="is-network-istio-network-gateway-gw"></span> isNetwork_IstioNetworkGateway_Gw


  

[any](#any)

### <span id="is-network-network-endpoints-ne"></span> isNetwork_NetworkEndpoints_Ne


  

[any](#any)

### <span id="is-private-key-provider-provider"></span> isPrivateKeyProvider_Provider


  

[any](#any)

### <span id="is-proxy-config-cluster-name"></span> isProxyConfig_ClusterName


  

[any](#any)

### <span id="is-readiness-probe-health-check-method"></span> isReadinessProbe_HealthCheckMethod


  

[any](#any)

### <span id="is-string-match-match-type"></span> isStringMatch_MatchType


  

[any](#any)

### <span id="is-tracing-custom-tag-type"></span> isTracing_CustomTag_Type


  

[any](#any)

### <span id="is-tracing-tracer"></span> isTracing_Tracer


  

[any](#any)
