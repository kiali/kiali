


# Kiali
# Kiali Project, The Console for Istio Service Mesh

NOTE! The Kiali API is not for public use and is not supported for any use outside of the Kiali UI itself.
The API can and will change from version to version with no guarantee of backwards compatibility.

To generate this API document:
```

> alias swagger='docker run --rm -it  --user $(id -u):$(id -g) -e GOCACHE=/tmp -e GOPATH=$(go env GOPATH):/go -v $HOME:$HOME -w $(pwd) quay.io/goswagger/swagger'
> swagger generate spec -o ./swagger.json
> swagger generate markdown --quiet --spec ./swagger.json --output ./kiali_internal_api.md

```
  

## Informations

### Version

_

## Content negotiation

### URI Schemes
  * http
  * https

### Consumes
  * application/json

### Produces
  * application/html
  * application/json

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
| GET | /api/tracing | [tracing info](#tracing-info) |  |
  


###  kiali

| Method  | URI     | Name   | Summary |
|---------|---------|--------|---------|
| GET | /api/config | [get config](#get-config) |  |
| GET | /api/crippled | [get crippled features](#get-crippled-features) |  |
| GET | /api/healthz | [healthz](#healthz) |  |
| GET | /api | [root](#root) |  |
  


###  namespaces

| Method  | URI     | Name   | Summary |
|---------|---------|--------|---------|
| GET | /api/namespaces/{namespace}/info | [namespace info](#namespace-info) |  |
| GET | /api/namespaces | [namespace list](#namespace-list) |  |
| GET | /api/namespaces/{namespace}/metrics | [namespace metrics](#namespace-metrics) |  |
| PATCH | /api/namespaces/{namespace} | [namespace update](#namespace-update) | Endpoint to update the Namespace configuration using Json Merge Patch strategy. |
| GET | /api/namespaces/{namespace}/validations | [namespace validations](#namespace-validations) |  |
| GET | /api/istio/validations | [namespaces validations](#namespaces-validations) |  |
  


###  operations

| Method  | URI     | Name   | Summary |
|---------|---------|--------|---------|
| GET | /api/mesh/controlplanes | [controlplanes](#controlplanes) |  |
| GET | /api/mesh/graph | [mesh graph](#mesh-graph) |  |
  


###  pods

| Method  | URI     | Name   | Summary |
|---------|---------|--------|---------|
| GET | /api/namespaces/{namespace}/pods/{pod} | [pod details](#pod-details) |  |
| GET | /api/namespaces/{namespace}/pods/{pod}/logs | [pod logs](#pod-logs) |  |
| GET | /api/namespaces/{namespace}/pods/{pod}/config_dump | [pod proxy dump](#pod-proxy-dump) |  |
| POST | /api/namespaces/{namespace}/pods/{pod}/logging | [pod proxy logging](#pod-proxy-logging) |  |
| GET | /api/namespaces/{namespace}/pods/{pod}/config_dump/{resource} | [pod proxy resource](#pod-proxy-resource) |  |
  


###  resource

| Method  | URI     | Name   | Summary |
|---------|---------|--------|---------|
| GET | /api/namespaces/{namespace}/{app}/usage_metrics | [usage metrics](#usage-metrics) |  |
  


###  services

| Method  | URI     | Name   | Summary |
|---------|---------|--------|---------|
| GET | /api/namespaces/{namespace}/services/{service}/dashboard | [service dashboard](#service-dashboard) |  |
| GET | /api/namespaces/{namespace}/services/{service} | [service details](#service-details) |  |
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
  


###  workloads

| Method  | URI     | Name   | Summary |
|---------|---------|--------|---------|
| GET | /api/namespaces/{namespace}/workloads/{workload}/dashboard | [workload dashboard](#workload-dashboard) |  |
| GET | /api/namespaces/{namespace}/workloads/{workload} | [workload details](#workload-details) |  |
| GET | /api/clusters/workloads | [workload list](#workload-list) |  |
| GET | /api/namespaces/{namespace}/workloads/{workload}/metrics | [workload metrics](#workload-metrics) |  |
| PATCH | /api/namespaces/{namespace}/workloads/{workload} | [workload update](#workload-update) | Endpoint to update the Workload configuration using Json Merge Patch strategy. |
| GET | /api/namespaces/{namespace}/ztunnel/{workload}/dashboard | [ztunnel dashboard](#ztunnel-dashboard) |  |
  


## Paths

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



**<span id="aggregate-metrics-service-unavailable-body"></span> AggregateMetricsServiceUnavailableBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `503`| HTTP status code | `503` |
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
| [404](#app-details-404) | Not Found | A NotFoundError is the error message that is generated when server could not find what was requested. |  | [schema](#app-details-404-schema) |
| [500](#app-details-500) | Internal Server Error | A Internal is the error message that means something has gone wrong |  | [schema](#app-details-500-schema) |

#### Responses


##### <span id="app-details-200"></span> 200 - Detailed information of an specific app
Status: OK

###### <span id="app-details-200-schema"></span> Schema
   
  

[App](#app)

##### <span id="app-details-404"></span> 404 - A NotFoundError is the error message that is generated when server could not find what was requested.
Status: Not Found

###### <span id="app-details-404-schema"></span> Schema
   
  

[AppDetailsNotFoundBody](#app-details-not-found-body)

##### <span id="app-details-500"></span> 500 - A Internal is the error message that means something has gone wrong
Status: Internal Server Error

###### <span id="app-details-500-schema"></span> Schema
   
  

[AppDetailsInternalServerErrorBody](#app-details-internal-server-error-body)

###### Inlined models

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
| rateInterval | `query` | string | `string` |  |  | `"10m"` | The rate interval used for fetching error rate |

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
| [500](#app-spans-500) | Internal Server Error | A Internal is the error message that means something has gone wrong |  | [schema](#app-spans-500-schema) |

#### Responses


##### <span id="app-spans-200"></span> 200 - Listing all the information related to a Span
Status: OK

###### <span id="app-spans-200-schema"></span> Schema
   
  

[][TracingSpan](#tracing-span)

##### <span id="app-spans-500"></span> 500 - A Internal is the error message that means something has gone wrong
Status: Internal Server Error

###### <span id="app-spans-500-schema"></span> Schema
   
  

[AppSpansInternalServerErrorBody](#app-spans-internal-server-error-body)

###### Inlined models

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
| [404](#app-traces-404) | Not Found | A NotFoundError is the error message that is generated when server could not find what was requested. |  | [schema](#app-traces-404-schema) |
| [500](#app-traces-500) | Internal Server Error | A Internal is the error message that means something has gone wrong |  | [schema](#app-traces-500-schema) |

#### Responses


##### <span id="app-traces-200"></span> 200 - Listing all the information related to a Trace
Status: OK

###### <span id="app-traces-200-schema"></span> Schema
   
  

[][Trace](#trace)

##### <span id="app-traces-404"></span> 404 - A NotFoundError is the error message that is generated when server could not find what was requested.
Status: Not Found

###### <span id="app-traces-404-schema"></span> Schema
   
  

[AppTracesNotFoundBody](#app-traces-not-found-body)

##### <span id="app-traces-500"></span> 500 - A Internal is the error message that means something has gone wrong
Status: Internal Server Error

###### <span id="app-traces-500-schema"></span> Schema
   
  

[AppTracesInternalServerErrorBody](#app-traces-internal-server-error-body)

###### Inlined models

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
  * authorization: password, user

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
   
  

[Config](#config)

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
| [404](#error-traces-404) | Not Found | A NotFoundError is the error message that is generated when server could not find what was requested. |  | [schema](#error-traces-404-schema) |
| [500](#error-traces-500) | Internal Server Error | A Internal is the error message that means something has gone wrong |  | [schema](#error-traces-500-schema) |

#### Responses


##### <span id="error-traces-200"></span> 200 - Number of traces in error
Status: OK

###### <span id="error-traces-200-schema"></span> Schema

##### <span id="error-traces-404"></span> 404 - A NotFoundError is the error message that is generated when server could not find what was requested.
Status: Not Found

###### <span id="error-traces-404-schema"></span> Schema
   
  

[ErrorTracesNotFoundBody](#error-traces-not-found-body)

##### <span id="error-traces-500"></span> 500 - A Internal is the error message that means something has gone wrong
Status: Internal Server Error

###### <span id="error-traces-500-schema"></span> Schema
   
  

[ErrorTracesInternalServerErrorBody](#error-traces-internal-server-error-body)

###### Inlined models

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



### <span id="get-crippled-features"></span> get crippled features (*getCrippledFeatures*)

```
GET /api/crippled
```

Endpoint to get the crippled features of Kiali

#### URI Schemes
  * http
  * https

#### Produces
  * application/json

#### All responses
| Code | Status | Description | Has headers | Schema |
|------|--------|-------------|:-----------:|--------|
| [200](#get-crippled-features-200) | OK | HTTP status code 200 and statusInfo model in data |  | [schema](#get-crippled-features-200-schema) |
| [500](#get-crippled-features-500) | Internal Server Error | A Internal is the error message that means something has gone wrong |  | [schema](#get-crippled-features-500-schema) |

#### Responses


##### <span id="get-crippled-features-200"></span> 200 - HTTP status code 200 and statusInfo model in data
Status: OK

###### <span id="get-crippled-features-200-schema"></span> Schema
   
  

[StatusInfo](#status-info)

##### <span id="get-crippled-features-500"></span> 500 - A Internal is the error message that means something has gone wrong
Status: Internal Server Error

###### <span id="get-crippled-features-500-schema"></span> Schema
   
  

[GetCrippledFeaturesInternalServerErrorBody](#get-crippled-features-internal-server-error-body)

###### Inlined models

**<span id="get-crippled-features-internal-server-error-body"></span> GetCrippledFeaturesInternalServerErrorBody**


  



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
| [500](#graph-aggregate-500) | Internal Server Error | A Internal is the error message that means something has gone wrong |  | [schema](#graph-aggregate-500-schema) |

#### Responses


##### <span id="graph-aggregate-200"></span> 200 - HTTP status code 200 and graph Config in data
Status: OK

###### <span id="graph-aggregate-200-schema"></span> Schema
   
  

[Config](#config)

##### <span id="graph-aggregate-400"></span> 400 - BadRequestError: the client request is incorrect
Status: Bad Request

###### <span id="graph-aggregate-400-schema"></span> Schema
   
  

[GraphAggregateBadRequestBody](#graph-aggregate-bad-request-body)

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
| [500](#graph-aggregate-by-service-500) | Internal Server Error | A Internal is the error message that means something has gone wrong |  | [schema](#graph-aggregate-by-service-500-schema) |

#### Responses


##### <span id="graph-aggregate-by-service-200"></span> 200 - HTTP status code 200 and graph Config in data
Status: OK

###### <span id="graph-aggregate-by-service-200-schema"></span> Schema
   
  

[Config](#config)

##### <span id="graph-aggregate-by-service-400"></span> 400 - BadRequestError: the client request is incorrect
Status: Bad Request

###### <span id="graph-aggregate-by-service-400-schema"></span> Schema
   
  

[GraphAggregateByServiceBadRequestBody](#graph-aggregate-by-service-bad-request-body)

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
| [500](#graph-app-500) | Internal Server Error | A Internal is the error message that means something has gone wrong |  | [schema](#graph-app-500-schema) |

#### Responses


##### <span id="graph-app-200"></span> 200 - HTTP status code 200 and graph Config in data
Status: OK

###### <span id="graph-app-200-schema"></span> Schema
   
  

[Config](#config)

##### <span id="graph-app-400"></span> 400 - BadRequestError: the client request is incorrect
Status: Bad Request

###### <span id="graph-app-400-schema"></span> Schema
   
  

[GraphAppBadRequestBody](#graph-app-bad-request-body)

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
| [500](#graph-app-version-500) | Internal Server Error | A Internal is the error message that means something has gone wrong |  | [schema](#graph-app-version-500-schema) |

#### Responses


##### <span id="graph-app-version-200"></span> 200 - HTTP status code 200 and graph Config in data
Status: OK

###### <span id="graph-app-version-200-schema"></span> Schema
   
  

[Config](#config)

##### <span id="graph-app-version-400"></span> 400 - BadRequestError: the client request is incorrect
Status: Bad Request

###### <span id="graph-app-version-400-schema"></span> Schema
   
  

[GraphAppVersionBadRequestBody](#graph-app-version-bad-request-body)

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
   
  

[Config](#config)

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
| [500](#graph-service-500) | Internal Server Error | A Internal is the error message that means something has gone wrong |  | [schema](#graph-service-500-schema) |

#### Responses


##### <span id="graph-service-200"></span> 200 - HTTP status code 200 and graph Config in data
Status: OK

###### <span id="graph-service-200-schema"></span> Schema
   
  

[Config](#config)

##### <span id="graph-service-400"></span> 400 - BadRequestError: the client request is incorrect
Status: Bad Request

###### <span id="graph-service-400-schema"></span> Schema
   
  

[GraphServiceBadRequestBody](#graph-service-bad-request-body)

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
| [500](#graph-workload-500) | Internal Server Error | A Internal is the error message that means something has gone wrong |  | [schema](#graph-workload-500-schema) |

#### Responses


##### <span id="graph-workload-200"></span> 200 - HTTP status code 200 and graph Config in data
Status: OK

###### <span id="graph-workload-200-schema"></span> Schema
   
  

[Config](#config)

##### <span id="graph-workload-400"></span> 400 - BadRequestError: the client request is incorrect
Status: Bad Request

###### <span id="graph-workload-400-schema"></span> Schema
   
  

[GraphWorkloadBadRequestBody](#graph-workload-bad-request-body)

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

##### <span id="istio-config-create-404"></span> 404 - A NotFoundError is the error message that is generated when server could not find what was requested.
Status: Not Found

###### <span id="istio-config-create-404-schema"></span> Schema
   
  

[IstioConfigCreateNotFoundBody](#istio-config-create-not-found-body)

##### <span id="istio-config-create-500"></span> 500 - A Internal is the error message that means something has gone wrong
Status: Internal Server Error

###### <span id="istio-config-create-500-schema"></span> Schema
   
  

[IstioConfigCreateInternalServerErrorBody](#istio-config-create-internal-server-error-body)

###### Inlined models

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
| [404](#istio-config-delete-404) | Not Found | A NotFoundError is the error message that is generated when server could not find what was requested. |  | [schema](#istio-config-delete-404-schema) |
| [500](#istio-config-delete-500) | Internal Server Error | A Internal is the error message that means something has gone wrong |  | [schema](#istio-config-delete-500-schema) |

#### Responses


##### <span id="istio-config-delete-404"></span> 404 - A NotFoundError is the error message that is generated when server could not find what was requested.
Status: Not Found

###### <span id="istio-config-delete-404-schema"></span> Schema
   
  

[IstioConfigDeleteNotFoundBody](#istio-config-delete-not-found-body)

##### <span id="istio-config-delete-500"></span> 500 - A Internal is the error message that means something has gone wrong
Status: Internal Server Error

###### <span id="istio-config-delete-500-schema"></span> Schema
   
  

[IstioConfigDeleteInternalServerErrorBody](#istio-config-delete-internal-server-error-body)

###### Inlined models

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
| [500](#istio-config-list-500) | Internal Server Error | A Internal is the error message that means something has gone wrong |  | [schema](#istio-config-list-500-schema) |

#### Responses


##### <span id="istio-config-list-200"></span> 200 - HTTP status code 200 and IstioConfigList model in data
Status: OK

###### <span id="istio-config-list-200-schema"></span> Schema
   
  

[IstioConfigList](#istio-config-list)

##### <span id="istio-config-list-500"></span> 500 - A Internal is the error message that means something has gone wrong
Status: Internal Server Error

###### <span id="istio-config-list-500-schema"></span> Schema
   
  

[IstioConfigListInternalServerErrorBody](#istio-config-list-internal-server-error-body)

###### Inlined models

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
   
  

[Config](#config)

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
| [500](#namespace-info-500) | Internal Server Error | A Internal is the error message that means something has gone wrong |  | [schema](#namespace-info-500-schema) |

#### Responses


##### <span id="namespace-info-200"></span> 200 - List of Namespaces
Status: OK

###### <span id="namespace-info-200-schema"></span> Schema
   
  

[][Namespace](#namespace)

##### <span id="namespace-info-500"></span> 500 - A Internal is the error message that means something has gone wrong
Status: Internal Server Error

###### <span id="namespace-info-500-schema"></span> Schema
   
  

[NamespaceInfoInternalServerErrorBody](#namespace-info-internal-server-error-body)

###### Inlined models

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
| [404](#pod-details-404) | Not Found | A NotFoundError is the error message that is generated when server could not find what was requested. |  | [schema](#pod-details-404-schema) |
| [500](#pod-details-500) | Internal Server Error | A Internal is the error message that means something has gone wrong |  | [schema](#pod-details-500-schema) |

#### Responses


##### <span id="pod-details-200"></span> 200 - Listing all the information related to a workload
Status: OK

###### <span id="pod-details-200-schema"></span> Schema
   
  

[Workload](#workload)

##### <span id="pod-details-404"></span> 404 - A NotFoundError is the error message that is generated when server could not find what was requested.
Status: Not Found

###### <span id="pod-details-404-schema"></span> Schema
   
  

[PodDetailsNotFoundBody](#pod-details-not-found-body)

##### <span id="pod-details-500"></span> 500 - A Internal is the error message that means something has gone wrong
Status: Internal Server Error

###### <span id="pod-details-500-schema"></span> Schema
   
  

[PodDetailsInternalServerErrorBody](#pod-details-internal-server-error-body)

###### Inlined models

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
| duration | `query` | string | `string` |  |  |  | Query time-range duration (Golang string duration). Duration starts on
`sinceTime` if set, or the time for the first log message if not set. |
| sinceTime | `query` | string | `string` |  |  |  | The start time for fetching logs. UNIX time in seconds. Default is all logs. |

#### All responses
| Code | Status | Description | Has headers | Schema |
|------|--------|-------------|:-----------:|--------|
| [200](#pod-logs-200) | OK | Listing all the information related to a workload |  | [schema](#pod-logs-200-schema) |
| [404](#pod-logs-404) | Not Found | A NotFoundError is the error message that is generated when server could not find what was requested. |  | [schema](#pod-logs-404-schema) |
| [500](#pod-logs-500) | Internal Server Error | A Internal is the error message that means something has gone wrong |  | [schema](#pod-logs-500-schema) |

#### Responses


##### <span id="pod-logs-200"></span> 200 - Listing all the information related to a workload
Status: OK

###### <span id="pod-logs-200-schema"></span> Schema
   
  

[Workload](#workload)

##### <span id="pod-logs-404"></span> 404 - A NotFoundError is the error message that is generated when server could not find what was requested.
Status: Not Found

###### <span id="pod-logs-404-schema"></span> Schema
   
  

[PodLogsNotFoundBody](#pod-logs-not-found-body)

##### <span id="pod-logs-500"></span> 500 - A Internal is the error message that means something has gone wrong
Status: Internal Server Error

###### <span id="pod-logs-500-schema"></span> Schema
   
  

[PodLogsInternalServerErrorBody](#pod-logs-internal-server-error-body)

###### Inlined models

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
| [404](#pod-proxy-dump-404) | Not Found | A NotFoundError is the error message that is generated when server could not find what was requested. |  | [schema](#pod-proxy-dump-404-schema) |
| [500](#pod-proxy-dump-500) | Internal Server Error | A Internal is the error message that means something has gone wrong |  | [schema](#pod-proxy-dump-500-schema) |

#### Responses


##### <span id="pod-proxy-dump-200"></span> 200 - Return a dump of the configuration of a given envoy proxy
Status: OK

###### <span id="pod-proxy-dump-200-schema"></span> Schema
   
  

[EnvoyProxyDump](#envoy-proxy-dump)

##### <span id="pod-proxy-dump-404"></span> 404 - A NotFoundError is the error message that is generated when server could not find what was requested.
Status: Not Found

###### <span id="pod-proxy-dump-404-schema"></span> Schema
   
  

[PodProxyDumpNotFoundBody](#pod-proxy-dump-not-found-body)

##### <span id="pod-proxy-dump-500"></span> 500 - A Internal is the error message that means something has gone wrong
Status: Internal Server Error

###### <span id="pod-proxy-dump-500-schema"></span> Schema
   
  

[PodProxyDumpInternalServerErrorBody](#pod-proxy-dump-internal-server-error-body)

###### Inlined models

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
| level | `query` | string | `string` |  | ✓ |  | The log level for the pod's proxy. |

#### All responses
| Code | Status | Description | Has headers | Schema |
|------|--------|-------------|:-----------:|--------|
| [200](#pod-proxy-logging-200) | OK | NoContent: the response is empty |  | [schema](#pod-proxy-logging-200-schema) |
| [400](#pod-proxy-logging-400) | Bad Request | BadRequestError: the client request is incorrect |  | [schema](#pod-proxy-logging-400-schema) |
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
| [404](#pod-proxy-resource-404) | Not Found | A NotFoundError is the error message that is generated when server could not find what was requested. |  | [schema](#pod-proxy-resource-404-schema) |
| [500](#pod-proxy-resource-500) | Internal Server Error | A Internal is the error message that means something has gone wrong |  | [schema](#pod-proxy-resource-500-schema) |

#### Responses


##### <span id="pod-proxy-resource-200"></span> 200 - Return a dump of the configuration of a given envoy proxy
Status: OK

###### <span id="pod-proxy-resource-200-schema"></span> Schema
   
  

map of any 

##### <span id="pod-proxy-resource-404"></span> 404 - A NotFoundError is the error message that is generated when server could not find what was requested.
Status: Not Found

###### <span id="pod-proxy-resource-404-schema"></span> Schema
   
  

[PodProxyResourceNotFoundBody](#pod-proxy-resource-not-found-body)

##### <span id="pod-proxy-resource-500"></span> 500 - A Internal is the error message that means something has gone wrong
Status: Internal Server Error

###### <span id="pod-proxy-resource-500-schema"></span> Schema
   
  

[PodProxyResourceInternalServerErrorBody](#pod-proxy-resource-internal-server-error-body)

###### Inlined models

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
| [404](#service-details-404) | Not Found | A NotFoundError is the error message that is generated when server could not find what was requested. |  | [schema](#service-details-404-schema) |
| [500](#service-details-500) | Internal Server Error | A Internal is the error message that means something has gone wrong |  | [schema](#service-details-500-schema) |

#### Responses


##### <span id="service-details-200"></span> 200 - Listing all the information related to a workload
Status: OK

###### <span id="service-details-200-schema"></span> Schema
   
  

[ServiceDetails](#service-details)

##### <span id="service-details-404"></span> 404 - A NotFoundError is the error message that is generated when server could not find what was requested.
Status: Not Found

###### <span id="service-details-404-schema"></span> Schema
   
  

[ServiceDetailsNotFoundBody](#service-details-not-found-body)

##### <span id="service-details-500"></span> 500 - A Internal is the error message that means something has gone wrong
Status: Internal Server Error

###### <span id="service-details-500-schema"></span> Schema
   
  

[ServiceDetailsInternalServerErrorBody](#service-details-internal-server-error-body)

###### Inlined models

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
| rateInterval | `query` | string | `string` |  |  | `"10m"` | The rate interval used for fetching error rate |

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
| [500](#service-spans-500) | Internal Server Error | A Internal is the error message that means something has gone wrong |  | [schema](#service-spans-500-schema) |

#### Responses


##### <span id="service-spans-200"></span> 200 - Listing all the information related to a Span
Status: OK

###### <span id="service-spans-200-schema"></span> Schema
   
  

[][TracingSpan](#tracing-span)

##### <span id="service-spans-500"></span> 500 - A Internal is the error message that means something has gone wrong
Status: Internal Server Error

###### <span id="service-spans-500-schema"></span> Schema
   
  

[ServiceSpansInternalServerErrorBody](#service-spans-internal-server-error-body)

###### Inlined models

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
| [404](#service-traces-404) | Not Found | A NotFoundError is the error message that is generated when server could not find what was requested. |  | [schema](#service-traces-404-schema) |
| [500](#service-traces-500) | Internal Server Error | A Internal is the error message that means something has gone wrong |  | [schema](#service-traces-500-schema) |

#### Responses


##### <span id="service-traces-200"></span> 200 - Listing all the information related to a Trace
Status: OK

###### <span id="service-traces-200-schema"></span> Schema
   
  

[][Trace](#trace)

##### <span id="service-traces-404"></span> 404 - A NotFoundError is the error message that is generated when server could not find what was requested.
Status: Not Found

###### <span id="service-traces-404-schema"></span> Schema
   
  

[ServiceTracesNotFoundBody](#service-traces-not-found-body)

##### <span id="service-traces-500"></span> 500 - A Internal is the error message that means something has gone wrong
Status: Internal Server Error

###### <span id="service-traces-500-schema"></span> Schema
   
  

[ServiceTracesInternalServerErrorBody](#service-traces-internal-server-error-body)

###### Inlined models

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
| [404](#workload-details-404) | Not Found | A NotFoundError is the error message that is generated when server could not find what was requested. |  | [schema](#workload-details-404-schema) |
| [500](#workload-details-500) | Internal Server Error | A Internal is the error message that means something has gone wrong |  | [schema](#workload-details-500-schema) |

#### Responses


##### <span id="workload-details-200"></span> 200 - Listing all the information related to a workload
Status: OK

###### <span id="workload-details-200-schema"></span> Schema
   
  

[Workload](#workload)

##### <span id="workload-details-404"></span> 404 - A NotFoundError is the error message that is generated when server could not find what was requested.
Status: Not Found

###### <span id="workload-details-404-schema"></span> Schema
   
  

[WorkloadDetailsNotFoundBody](#workload-details-not-found-body)

##### <span id="workload-details-500"></span> 500 - A Internal is the error message that means something has gone wrong
Status: Internal Server Error

###### <span id="workload-details-500-schema"></span> Schema
   
  

[WorkloadDetailsInternalServerErrorBody](#workload-details-internal-server-error-body)

###### Inlined models

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
| [500](#workload-spans-500) | Internal Server Error | A Internal is the error message that means something has gone wrong |  | [schema](#workload-spans-500-schema) |

#### Responses


##### <span id="workload-spans-200"></span> 200 - Listing all the information related to a Span
Status: OK

###### <span id="workload-spans-200-schema"></span> Schema
   
  

[][TracingSpan](#tracing-span)

##### <span id="workload-spans-500"></span> 500 - A Internal is the error message that means something has gone wrong
Status: Internal Server Error

###### <span id="workload-spans-500-schema"></span> Schema
   
  

[WorkloadSpansInternalServerErrorBody](#workload-spans-internal-server-error-body)

###### Inlined models

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
| [404](#workload-traces-404) | Not Found | A NotFoundError is the error message that is generated when server could not find what was requested. |  | [schema](#workload-traces-404-schema) |
| [500](#workload-traces-500) | Internal Server Error | A Internal is the error message that means something has gone wrong |  | [schema](#workload-traces-500-schema) |

#### Responses


##### <span id="workload-traces-200"></span> 200 - Listing all the information related to a Trace
Status: OK

###### <span id="workload-traces-200-schema"></span> Schema
   
  

[][Trace](#trace)

##### <span id="workload-traces-404"></span> 404 - A NotFoundError is the error message that is generated when server could not find what was requested.
Status: Not Found

###### <span id="workload-traces-404-schema"></span> Schema
   
  

[WorkloadTracesNotFoundBody](#workload-traces-not-found-body)

##### <span id="workload-traces-500"></span> 500 - A Internal is the error message that means something has gone wrong
Status: Internal Server Error

###### <span id="workload-traces-500-schema"></span> Schema
   
  

[WorkloadTracesInternalServerErrorBody](#workload-traces-internal-server-error-body)

###### Inlined models

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
| [404](#workload-update-404) | Not Found | A NotFoundError is the error message that is generated when server could not find what was requested. |  | [schema](#workload-update-404-schema) |
| [500](#workload-update-500) | Internal Server Error | A Internal is the error message that means something has gone wrong |  | [schema](#workload-update-500-schema) |

#### Responses


##### <span id="workload-update-200"></span> 200 - Listing all the information related to a workload
Status: OK

###### <span id="workload-update-200-schema"></span> Schema
   
  

[Workload](#workload)

##### <span id="workload-update-400"></span> 400 - BadRequestError: the client request is incorrect
Status: Bad Request

###### <span id="workload-update-400-schema"></span> Schema
   
  

[WorkloadUpdateBadRequestBody](#workload-update-bad-request-body)

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



**<span id="ztunnel-dashboard-service-unavailable-body"></span> ZtunnelDashboardServiceUnavailableBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `503`| HTTP status code | `503` |
| Message | string| `string` |  | |  |  |



## Models

### <span id="additional-item"></span> AdditionalItem


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Icon | string| `string` |  | |  |  |
| Title | string| `string` |  | |  |  |
| Value | string| `string` |  | |  |  |



### <span id="address"></span> Address


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| IP | string| `string` |  | |  |  |
| Kind | string| `string` |  | |  |  |
| Name | string| `string` |  | |  |  |
| Port | uint32 (formatted integer)| `uint32` |  | |  |  |



### <span id="addresses"></span> Addresses


  

[][Address](#address)

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
| DocumentationUrl | string| `string` |  | | A url pointing to the Istio documentation for this specific error type.
Should be of the form
`^http(s)?://(preliminary\.)?istio.io/docs/reference/config/analysis/`
Required. |  |
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
| Code | string| `string` |  | | A 7 character code matching `^IST[0-9]{4}$` intended to uniquely identify
the message type. (e.g. "IST0001" is mapped to the "InternalError" message
type.) 0000-0100 are reserved. Required. |  |
| Name | string| `string` |  | | A human-readable name for the message type. e.g. "InternalError",
"PodMissingProxy". This should be the same for all messages of the same type.
Required. |  |



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
| Name | string| `string` | ✓ | | Name of the application | `reviews` |
| Namespace | string| `string` |  | | Namespace of the application |  |
| health | [AppHealth](#app-health)| `AppHealth` |  | |  |  |



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

+kubebuilder:validation:XValidation:message="Must have port for Service reference",rule="(size(self.group) == 0 && self.kind == 'Service') ? has(self.port) : true"
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| group | [Group](#group)| `Group` |  | |  |  |
| kind | [Kind](#kind)| `Kind` |  | |  |  |
| name | [ObjectName](#object-name)| `ObjectName` |  | |  |  |
| namespace | [Namespace](#namespace)| `Namespace` |  | |  |  |
| port | [PortNumber](#port-number)| `PortNumber` |  | |  |  |



### <span id="bootstrap"></span> Bootstrap


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Bootstrap | map of any | `map[string]interface{}` |  | |  |  |



### <span id="cert-info"></span> CertInfo


> CertInfo contains the information for a given certificate
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Accessible | boolean| `bool` |  | |  |  |
| ClusterName | string| `string` |  | |  |  |
| ConfigMapName | string| `string` |  | |  |  |
| ConfigMapNamespace | string| `string` |  | |  |  |
| DNSNames | []string| `[]string` |  | |  |  |
| Error | string| `string` |  | |  |  |
| Issuer | string| `string` |  | |  |  |
| NotAfter | date-time (formatted string)| `strfmt.DateTime` |  | |  |  |
| NotBefore | date-time (formatted string)| `strfmt.DateTime` |  | |  |  |



### <span id="certificate"></span> Certificate


  



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
| ServiceHealth | map of [NamespaceServiceHealth](#namespace-service-health)| `map[string]NamespaceServiceHealth` |  | |  |  |
| WorkloadHealth | map of [NamespaceWorkloadHealth](#namespace-workload-health)| `map[string]NamespaceWorkloadHealth` |  | |  |  |



### <span id="component-status"></span> ComponentStatus


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| IsCore | boolean| `bool` | ✓ | | When true, the component is necessary for Istio to function. Otherwise, it is an addon. | `true` |
| Name | string| `string` | ✓ | | The workload name of the Istio component. | `istio-ingressgateway` |
| Status | string| `string` | ✓ | | The status of an Istio component. | `Not Found` |



### <span id="condition"></span> Condition


> This struct is intended for direct use as an array at the field path .status.conditions.  For example,

type FooStatus struct{
Represents the observations of a foo's current state.
Known .status.conditions.type are: "Available", "Progressing", and "Degraded"
+patchMergeKey=type
+patchStrategy=merge
+listType=map
+listMapKey=type
Conditions []metav1.Condition `json:"conditions,omitempty" patchStrategy:"merge" patchMergeKey:"type" protobuf:"bytes,1,rep,name=conditions"`

other fields
}
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Message | string| `string` |  | | message is a human readable message indicating details about the transition.
This may be an empty string.
+required
+kubebuilder:validation:Required
+kubebuilder:validation:MaxLength=32768 |  |
| ObservedGeneration | int64 (formatted integer)| `int64` |  | | observedGeneration represents the .metadata.generation that the condition was set based upon.
For instance, if .metadata.generation is currently 12, but the .status.conditions[x].observedGeneration is 9, the condition is out of date
with respect to the current state of the instance.
+optional
+kubebuilder:validation:Minimum=0 |  |
| Reason | string| `string` |  | | reason contains a programmatic identifier indicating the reason for the condition's last transition.
Producers of specific condition types may define expected values and meanings for this field,
and whether the values are considered a guaranteed API.
The value should be a CamelCase string.
This field may not be empty.
+required
+kubebuilder:validation:Required
+kubebuilder:validation:MaxLength=1024
+kubebuilder:validation:MinLength=1
+kubebuilder:validation:Pattern=`^[A-Za-z]([A-Za-z0-9_,:]*[A-Za-z0-9_])?$` |  |
| Type | string| `string` |  | | type of condition in CamelCase or in foo.example.com/CamelCase.

Many .condition.type values are consistent across resources like Available, but because arbitrary conditions can be
useful (see .node.status.conditions), the ability to deconflict is important.
The regex it matches is (dns1123SubdomainFmt/)?(qualifiedNameFmt)
+required
+kubebuilder:validation:Required
+kubebuilder:validation:Pattern=`^([a-z0-9]([-a-z0-9]*[a-z0-9])?(\.[a-z0-9]([-a-z0-9]*[a-z0-9])?)*/)?(([A-Za-z0-9][-A-Za-z0-9_.]*)?[A-Za-z0-9])$`
+kubebuilder:validation:MaxLength=316 |  |
| lastTransitionTime | [Time](#time)| `Time` |  | |  |  |
| status | [ConditionStatus](#condition-status)| `ConditionStatus` |  | |  |  |



### <span id="condition-status"></span> ConditionStatus


  

| Name | Type | Go type | Default | Description | Example |
|------|------|---------| ------- |-------------|---------|
| ConditionStatus | string| string | |  |  |



### <span id="config"></span> Config


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Duration | int64 (formatted integer)| `int64` |  | |  |  |
| GraphType | string| `string` |  | |  |  |
| Timestamp | int64 (formatted integer)| `int64` |  | |  |  |
| elements | [Elements](#elements)| `Elements` |  | |  |  |



### <span id="config-dump"></span> ConfigDump


> Root of ConfigDump
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Configs | [][interface{}](#interface)| `[]interface{}` |  | |  |  |



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
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| ExternalControlPlane | boolean| `bool` |  | | ExternalControlPlane indicates if the controlplane is managing an external cluster. |  |
| ID | string| `string` |  | | ID is the control plane ID as known by istiod. |  |
| IstiodName | string| `string` |  | | IstiodName is the control plane name |  |
| IstiodNamespace | string| `string` |  | | IstiodNamespace is the namespace name of the deployed control plane |  |
| ManagedClusters | [][KubeCluster](#kube-cluster)| `[]*KubeCluster` |  | | ManagedClusters are the clusters that this controlplane manages.
This could include the cluster that the controlplane is running on. |  |
| ManagedNamespaces | [][Namespace](#namespace)| `[]*Namespace` |  | | ManagedNamespaces are the namespaces that the controlplane is managing.
More specifically, it is a namespace with either injection enabled
or ambient enabled and it matches this controlplane's revision either
directly or through a tag. |  |
| ManagesExternal | boolean| `bool` |  | | ManagesExternal indicates if the controlplane manages an external cluster.
It could also manage the cluster that it is running on. |  |
| Revision | string| `string` |  | | Revision is the revision of the controlplane.
Can be empty when it's the default revision. |  |
| Status | string| `string` |  | | Status is the status of the controlplane as reported by kiali.
It includes the deployment status and whether kiali can connect
to the controlplane or not. |  |
| cluster | [KubeCluster](#kube-cluster)| `KubeCluster` |  | |  |  |
| config | [ControlPlaneConfiguration](#control-plane-configuration)| `ControlPlaneConfiguration` |  | |  |  |
| resources | [ResourceRequirements](#resource-requirements)| `ResourceRequirements` |  | |  |  |
| tag | [Tag](#tag)| `Tag` |  | |  |  |
| thresholds | [IstiodThresholds](#istiod-thresholds)| `IstiodThresholds` |  | |  |  |
| version | [ExternalServiceInfo](#external-service-info)| `ExternalServiceInfo` |  | |  |  |



### <span id="control-plane-configuration"></span> ControlPlaneConfiguration


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Certificates | [][Certificate](#certificate)| `[]*Certificate` |  | |  |  |
| ConfigMap | map of string| `map[string]string` |  | | Config Map |  |
| DefaultDestinationRuleExportTo | []string| `[]string` |  | | Default Export To fields, used when objects do not have ExportTo |  |
| DefaultServiceExportTo | []string| `[]string` |  | |  |  |
| DefaultVirtualServiceExportTo | []string| `[]string` |  | |  |  |
| DisableMixerHttpReports | boolean| `bool` |  | |  |  |
| DiscoverySelectors | [DiscoverySelectorsType](#discovery-selectors-type)| `DiscoverySelectorsType` |  | |  |  |
| EnableAutoMtls | boolean| `bool` |  | |  |  |
| MeshMTLS | [ControlPlaneConfigurationMeshMTLS](#control-plane-configuration-mesh-m-tls)| `ControlPlaneConfigurationMeshMTLS` |  | |  |  |
| Network | string| `string` |  | | Network is the name of the network that the controlplane is using. |  |
| TrustDomain | string| `string` |  | |  |  |
| defaultConfig | [DefaultConfig](#default-config)| `DefaultConfig` |  | |  |  |
| outboundTrafficPolicy | [OutboundPolicy](#outbound-policy)| `OutboundPolicy` |  | |  |  |



#### Inlined models

**<span id="default-config"></span> DefaultConfig**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| MeshId | string| `string` |  | |  |  |



**<span id="control-plane-configuration-mesh-m-tls"></span> ControlPlaneConfigurationMeshMTLS**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| MinProtocolVersion | string| `string` |  | |  |  |



### <span id="cookie-config"></span> CookieConfig


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| lifetimeType | [CookieLifetimeType](#cookie-lifetime-type)| `CookieLifetimeType` |  | |  |  |



### <span id="cookie-lifetime-type"></span> CookieLifetimeType


> +kubebuilder:validation:Enum=Permanent;Session
  



| Name | Type | Go type | Default | Description | Example |
|------|------|---------| ------- |-------------|---------|
| CookieLifetimeType | string| string | | +kubebuilder:validation:Enum=Permanent;Session |  |



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



### <span id="destination-rule"></span> DestinationRule


> <!-- crd generation tags
+cue-gen:DestinationRule:groupName:networking.istio.io
+cue-gen:DestinationRule:versions:v1beta1,v1alpha3,v1
+cue-gen:DestinationRule:annotations:helm.sh/resource-policy=keep
+cue-gen:DestinationRule:labels:app=istio-pilot,chart=istio,heritage=Tiller,release=istio
+cue-gen:DestinationRule:subresource:status
+cue-gen:DestinationRule:scope:Namespaced
+cue-gen:DestinationRule:resource:categories=istio-io,networking-istio-io,shortNames=dr
+cue-gen:DestinationRule:printerColumn:name=Host,type=string,JSONPath=.spec.host,description="The name of a service from the service registry"
+cue-gen:DestinationRule:printerColumn:name=Age,type=date,JSONPath=.metadata.creationTimestamp,description="CreationTimestamp is a timestamp
representing the server time when this object was created. It is not guaranteed to be set in happens-before order across separate operations.
Clients may not set this value. It is represented in RFC3339 form and is in UTC.
Populated by the system. Read-only. Null for lists. More info: https://git.k8s.io/community/contributors/devel/api-conventions.md#metadata"
+cue-gen:DestinationRule:preserveUnknownFields:false
>

<!-- go code generation tags
+kubetype-gen
+kubetype-gen:groupVersion=networking.istio.io/v1alpha3
+genclient
+k8s:deepcopy-gen=true
>
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| APIVersion | string| `string` |  | | APIVersion defines the versioned schema of this representation of an object.
Servers should convert recognized schemas to the latest internal value, and
may reject unrecognized values.
More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#resources
+optional |  |
| Annotations | map of string| `map[string]string` |  | | Annotations is an unstructured key value map stored with a resource that may be
set by external tools to store and retrieve arbitrary metadata. They are not
queryable and should be preserved when modifying objects.
More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/annotations
+optional |  |
| DeletionGracePeriodSeconds | int64 (formatted integer)| `int64` |  | | Number of seconds allowed for this object to gracefully terminate before
it will be removed from the system. Only set when deletionTimestamp is also set.
May only be shortened.
Read-only.
+optional |  |
| Finalizers | []string| `[]string` |  | | Must be empty before the object is deleted from the registry. Each entry
is an identifier for the responsible component that will remove the entry
from the list. If the deletionTimestamp of the object is non-nil, entries
in this list can only be removed.
Finalizers may be processed and removed in any order.  Order is NOT enforced
because it introduces significant risk of stuck finalizers.
finalizers is a shared field, any actor with permission can reorder it.
If the finalizer list is processed in order, then this can lead to a situation
in which the component responsible for the first finalizer in the list is
waiting for a signal (field value, external system, or other) produced by a
component responsible for a finalizer later in the list, resulting in a deadlock.
Without enforced ordering finalizers are free to order amongst themselves and
are not vulnerable to ordering changes in the list.
+optional
+patchStrategy=merge
+listType=set |  |
| GenerateName | string| `string` |  | | GenerateName is an optional prefix, used by the server, to generate a unique
name ONLY IF the Name field has not been provided.
If this field is used, the name returned to the client will be different
than the name passed. This value will also be combined with a unique suffix.
The provided value has the same validation rules as the Name field,
and may be truncated by the length of the suffix required to make the value
unique on the server.

If this field is specified and the generated name exists, the server will return a 409.

Applied only if Name is not specified.
More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#idempotency
+optional |  |
| Generation | int64 (formatted integer)| `int64` |  | | A sequence number representing a specific generation of the desired state.
Populated by the system. Read-only.
+optional |  |
| Kind | string| `string` |  | | Kind is a string value representing the REST resource this object represents.
Servers may infer this from the endpoint the client submits requests to.
Cannot be updated.
In CamelCase.
More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds
+optional |  |
| Labels | map of string| `map[string]string` |  | | Map of string keys and values that can be used to organize and categorize
(scope and select) objects. May match selectors of replication controllers
and services.
More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/labels
+optional |  |
| ManagedFields | [][ManagedFieldsEntry](#managed-fields-entry)| `[]*ManagedFieldsEntry` |  | | ManagedFields maps workflow-id and version to the set of fields
that are managed by that workflow. This is mostly for internal
housekeeping, and users typically shouldn't need to set or
understand this field. A workflow can be the user's name, a
controller's name, or the name of a specific apply path like
"ci-cd". The set of fields is always in the version that the
workflow used when modifying the object.

+optional
+listType=atomic |  |
| Name | string| `string` |  | | Name must be unique within a namespace. Is required when creating resources, although
some resources may allow a client to request the generation of an appropriate name
automatically. Name is primarily intended for creation idempotence and configuration
definition.
Cannot be updated.
More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names#names
+optional |  |
| Namespace | string| `string` |  | | Namespace defines the space within which each name must be unique. An empty namespace is
equivalent to the "default" namespace, but "default" is the canonical representation.
Not all objects are required to be scoped to a namespace - the value of this field for
those objects will be empty.

Must be a DNS_LABEL.
Cannot be updated.
More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/namespaces
+optional |  |
| OwnerReferences | [][OwnerReference](#owner-reference)| `[]*OwnerReference` |  | | List of objects depended by this object. If ALL objects in the list have
been deleted, this object will be garbage collected. If this object is managed by a controller,
then an entry in this list will point to this controller, with the controller field set to true.
There cannot be more than one managing controller.
+optional
+patchMergeKey=uid
+patchStrategy=merge
+listType=map
+listMapKey=uid |  |
| ResourceVersion | string| `string` |  | | An opaque value that represents the internal version of this object that can
be used by clients to determine when objects have changed. May be used for optimistic
concurrency, change detection, and the watch operation on a resource or set of resources.
Clients must treat these values as opaque and passed unmodified back to the server.
They may only be valid for a particular resource or set of resources.

Populated by the system.
Read-only.
Value must be treated as opaque by clients and .
More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#concurrency-control-and-consistency
+optional |  |
| SelfLink | string| `string` |  | | Deprecated: selfLink is a legacy read-only field that is no longer populated by the system.
+optional |  |
| creationTimestamp | [Time](#time)| `Time` |  | |  |  |
| deletionTimestamp | [Time](#time)| `Time` |  | |  |  |
| spec | [DestinationRule](#destination-rule)| `DestinationRule` |  | |  |  |
| status | [IstioStatus](#istio-status)| `IstioStatus` |  | |  |  |
| uid | [UID](#uid)| `UID` |  | |  |  |



### <span id="discovery-selector-type"></span> DiscoverySelectorType


> we need to play games with a custom unmarshaller/marshaller for metav1.LabelSelector because it has no yaml struct tags so
it is not processing it the way we want by default (it isn't using camelCase; the fields are lowercase - e.g. matchlabels/matchexpressions)
  




* composed type [LabelSelector](#label-selector)

### <span id="discovery-selectors-type"></span> DiscoverySelectorsType


> we need to play games with a custom unmarshaller/marshaller for metav1.LabelSelector because it has no yaml struct tags so
it is not processing it the way we want by default (it isn't using camelCase; the fields are lowercase - e.g. matchlabels/matchexpressions)
  



[][DiscoverySelectorType](#discovery-selector-type)

### <span id="duration"></span> Duration


> +kubebuilder:validation:Pattern=`^([0-9]{1,5}(h|m|s|ms)){1,4}$`
  



| Name | Type | Go type | Default | Description | Example |
|------|------|---------| ------- |-------------|---------|
| Duration | string| string | | +kubebuilder:validation:Pattern=`^([0-9]{1,5}(h|m|s|ms)){1,4}$` |  |



### <span id="edge-data"></span> EdgeData


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| DestPrincipal | string| `string` |  | |  |  |
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



### <span id="endpoint"></span> Endpoint


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| addresses | [Addresses](#addresses)| `Addresses` |  | |  |  |
| ports | [Ports](#ports)| `Ports` |  | |  |  |



### <span id="endpoints"></span> Endpoints


  

[][Endpoint](#endpoint)

### <span id="envoy-proxy-dump"></span> EnvoyProxyDump


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| bootstrap | [Bootstrap](#bootstrap)| `Bootstrap` |  | |  |  |
| clusters | [Clusters](#clusters)| `Clusters` |  | |  |  |
| config_dump | [ConfigDump](#config-dump)| `ConfigDump` |  | |  |  |
| listeners | [Listeners](#listeners)| `Listeners` |  | |  |  |
| routes | [Routes](#routes)| `Routes` |  | |  |  |



### <span id="ext-info"></span> ExtInfo


> ExtInfo contains client-side info about the extension
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Name | string| `string` |  | |  |  |
| URL | string| `string` |  | | URL is an optional URL that links to the extension's own external UI |  |



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
+protobuf.options.(gogoproto.goproto_stringer)=false
  



[interface{}](#interface)

### <span id="fraction"></span> Fraction


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Denominator | int32 (formatted integer)| `int32` |  | | +optional
+kubebuilder:default=100
+kubebuilder:validation:Minimum=1 |  |
| Numerator | int32 (formatted integer)| `int32` |  | | +kubebuilder:validation:Minimum=0 |  |



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
| Filters | [][GRPCRouteFilter](#g-rpc-route-filter)| `[]*GRPCRouteFilter` |  | | Filters defined at this level MUST be executed if and only if the
request is being forwarded to the backend defined here.

Support: Implementation-specific (For broader support of filters, use the
Filters field in GRPCRouteRule.)

+optional
+kubebuilder:validation:MaxItems=16
+kubebuilder:validation:XValidation:message="RequestHeaderModifier filter cannot be repeated",rule="self.filter(f, f.type == 'RequestHeaderModifier').size() <= 1"
+kubebuilder:validation:XValidation:message="ResponseHeaderModifier filter cannot be repeated",rule="self.filter(f, f.type == 'ResponseHeaderModifier').size() <= 1" |  |
| Weight | int32 (formatted integer)| `int32` |  | | Weight specifies the proportion of requests forwarded to the referenced
backend. This is computed as weight/(sum of all weights in this
BackendRefs list). For non-zero values, there may be some epsilon from
the exact proportion defined here depending on the precision an
implementation supports. Weight is not a percentage and the sum of
weights does not need to equal 100.

If only one backend is specified and it has a weight greater than 0, 100%
of the traffic is forwarded to that backend. If weight is set to 0, no
traffic should be forwarded for this entry. If unspecified, weight
defaults to 1.

Support for this field varies based on the context where used.

+optional
+kubebuilder:default=1
+kubebuilder:validation:Minimum=0
+kubebuilder:validation:Maximum=1000000 |  |
| group | [Group](#group)| `Group` |  | |  |  |
| kind | [Kind](#kind)| `Kind` |  | |  |  |
| name | [ObjectName](#object-name)| `ObjectName` |  | |  |  |
| namespace | [Namespace](#namespace)| `Namespace` |  | |  |  |
| port | [PortNumber](#port-number)| `PortNumber` |  | |  |  |



### <span id="g-rpc-header-match"></span> GRPCHeaderMatch


> GRPCHeaderMatch describes how to select a gRPC route by matching gRPC request
headers.
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Value | string| `string` |  | | Value is the value of the gRPC Header to be matched.

+kubebuilder:validation:MinLength=1
+kubebuilder:validation:MaxLength=4096 |  |
| name | [GRPCHeaderName](#g-rpc-header-name)| `GRPCHeaderName` |  | |  |  |
| type | [GRPCHeaderMatchType](#g-rpc-header-match-type)| `GRPCHeaderMatchType` |  | |  |  |



### <span id="g-rpc-header-match-type"></span> GRPCHeaderMatchType


> "Exact" - Core
"RegularExpression" - Implementation Specific

Note that new values may be added to this enum in future releases of the API,
implementations MUST ensure that unknown values will not cause a crash.

Unknown values here MUST result in the implementation setting the Accepted
Condition for the Route to `status: False`, with a Reason of
`UnsupportedValue`.

+kubebuilder:validation:Enum=Exact;RegularExpression
  



| Name | Type | Go type | Default | Description | Example |
|------|------|---------| ------- |-------------|---------|
| GRPCHeaderMatchType | string| string | | "Exact" - Core
"RegularExpression" - Implementation Specific

Note that new values may be added to this enum in future releases of the API,
implementations MUST ensure that unknown values will not cause a crash.

Unknown values here MUST result in the implementation setting the Accepted
Condition for the Route to `status: False`, with a Reason of
`UnsupportedValue`.

+kubebuilder:validation:Enum=Exact;RegularExpression |  |



### <span id="g-rpc-header-name"></span> GRPCHeaderName


  

[HeaderName](#header-name)

#### Inlined models

### <span id="g-rpc-method-match"></span> GRPCMethodMatch


> At least one of Service and Method MUST be a non-empty string.

+kubebuilder:validation:XValidation:message="One or both of 'service' or 'method' must be specified",rule="has(self.type) ? has(self.service) || has(self.method) : true"
+kubebuilder:validation:XValidation:message="service must only contain valid characters (matching ^(?i)\\.?[a-z_][a-z_0-9]*(\\.[a-z_][a-z_0-9]*)*$)",rule="(!has(self.type) || self.type == 'Exact') && has(self.service) ? self.service.matches(r\"\"\"^(?i)\\.?[a-z_][a-z_0-9]*(\\.[a-z_][a-z_0-9]*)*$\"\"\"): true"
+kubebuilder:validation:XValidation:message="method must only contain valid characters (matching ^[A-Za-z_][A-Za-z_0-9]*$)",rule="(!has(self.type) || self.type == 'Exact') && has(self.method) ? self.method.matches(r\"\"\"^[A-Za-z_][A-Za-z_0-9]*$\"\"\"): true"
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Method | string| `string` |  | | Value of the method to match against. If left empty or omitted, will
match all services.

At least one of Service and Method MUST be a non-empty string.

+optional
+kubebuilder:validation:MaxLength=1024 |  |
| Service | string| `string` |  | | Value of the service to match against. If left empty or omitted, will
match any service.

At least one of Service and Method MUST be a non-empty string.

+optional
+kubebuilder:validation:MaxLength=1024 |  |
| type | [GRPCMethodMatchType](#g-rpc-method-match-type)| `GRPCMethodMatchType` |  | |  |  |



### <span id="g-rpc-method-match-type"></span> GRPCMethodMatchType


> "Exact" - Core
"RegularExpression" - Implementation Specific

Exact methods MUST be syntactically valid:

Must not contain `/` character

+kubebuilder:validation:Enum=Exact;RegularExpression
  



| Name | Type | Go type | Default | Description | Example |
|------|------|---------| ------- |-------------|---------|
| GRPCMethodMatchType | string| string | | "Exact" - Core
"RegularExpression" - Implementation Specific

Exact methods MUST be syntactically valid:

Must not contain `/` character

+kubebuilder:validation:Enum=Exact;RegularExpression |  |



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
| APIVersion | string| `string` |  | | APIVersion defines the versioned schema of this representation of an object.
Servers should convert recognized schemas to the latest internal value, and
may reject unrecognized values.
More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#resources
+optional |  |
| Annotations | map of string| `map[string]string` |  | | Annotations is an unstructured key value map stored with a resource that may be
set by external tools to store and retrieve arbitrary metadata. They are not
queryable and should be preserved when modifying objects.
More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/annotations
+optional |  |
| DeletionGracePeriodSeconds | int64 (formatted integer)| `int64` |  | | Number of seconds allowed for this object to gracefully terminate before
it will be removed from the system. Only set when deletionTimestamp is also set.
May only be shortened.
Read-only.
+optional |  |
| Finalizers | []string| `[]string` |  | | Must be empty before the object is deleted from the registry. Each entry
is an identifier for the responsible component that will remove the entry
from the list. If the deletionTimestamp of the object is non-nil, entries
in this list can only be removed.
Finalizers may be processed and removed in any order.  Order is NOT enforced
because it introduces significant risk of stuck finalizers.
finalizers is a shared field, any actor with permission can reorder it.
If the finalizer list is processed in order, then this can lead to a situation
in which the component responsible for the first finalizer in the list is
waiting for a signal (field value, external system, or other) produced by a
component responsible for a finalizer later in the list, resulting in a deadlock.
Without enforced ordering finalizers are free to order amongst themselves and
are not vulnerable to ordering changes in the list.
+optional
+patchStrategy=merge
+listType=set |  |
| GenerateName | string| `string` |  | | GenerateName is an optional prefix, used by the server, to generate a unique
name ONLY IF the Name field has not been provided.
If this field is used, the name returned to the client will be different
than the name passed. This value will also be combined with a unique suffix.
The provided value has the same validation rules as the Name field,
and may be truncated by the length of the suffix required to make the value
unique on the server.

If this field is specified and the generated name exists, the server will return a 409.

Applied only if Name is not specified.
More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#idempotency
+optional |  |
| Generation | int64 (formatted integer)| `int64` |  | | A sequence number representing a specific generation of the desired state.
Populated by the system. Read-only.
+optional |  |
| Kind | string| `string` |  | | Kind is a string value representing the REST resource this object represents.
Servers may infer this from the endpoint the client submits requests to.
Cannot be updated.
In CamelCase.
More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds
+optional |  |
| Labels | map of string| `map[string]string` |  | | Map of string keys and values that can be used to organize and categorize
(scope and select) objects. May match selectors of replication controllers
and services.
More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/labels
+optional |  |
| ManagedFields | [][ManagedFieldsEntry](#managed-fields-entry)| `[]*ManagedFieldsEntry` |  | | ManagedFields maps workflow-id and version to the set of fields
that are managed by that workflow. This is mostly for internal
housekeeping, and users typically shouldn't need to set or
understand this field. A workflow can be the user's name, a
controller's name, or the name of a specific apply path like
"ci-cd". The set of fields is always in the version that the
workflow used when modifying the object.

+optional
+listType=atomic |  |
| Name | string| `string` |  | | Name must be unique within a namespace. Is required when creating resources, although
some resources may allow a client to request the generation of an appropriate name
automatically. Name is primarily intended for creation idempotence and configuration
definition.
Cannot be updated.
More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names#names
+optional |  |
| Namespace | string| `string` |  | | Namespace defines the space within which each name must be unique. An empty namespace is
equivalent to the "default" namespace, but "default" is the canonical representation.
Not all objects are required to be scoped to a namespace - the value of this field for
those objects will be empty.

Must be a DNS_LABEL.
Cannot be updated.
More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/namespaces
+optional |  |
| OwnerReferences | [][OwnerReference](#owner-reference)| `[]*OwnerReference` |  | | List of objects depended by this object. If ALL objects in the list have
been deleted, this object will be garbage collected. If this object is managed by a controller,
then an entry in this list will point to this controller, with the controller field set to true.
There cannot be more than one managing controller.
+optional
+patchMergeKey=uid
+patchStrategy=merge
+listType=map
+listMapKey=uid |  |
| ResourceVersion | string| `string` |  | | An opaque value that represents the internal version of this object that can
be used by clients to determine when objects have changed. May be used for optimistic
concurrency, change detection, and the watch operation on a resource or set of resources.
Clients must treat these values as opaque and passed unmodified back to the server.
They may only be valid for a particular resource or set of resources.

Populated by the system.
Read-only.
Value must be treated as opaque by clients and .
More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#concurrency-control-and-consistency
+optional |  |
| SelfLink | string| `string` |  | | Deprecated: selfLink is a legacy read-only field that is no longer populated by the system.
+optional |  |
| creationTimestamp | [Time](#time)| `Time` |  | |  |  |
| deletionTimestamp | [Time](#time)| `Time` |  | |  |  |
| spec | [GRPCRouteSpec](#g-rpc-route-spec)| `GRPCRouteSpec` |  | |  |  |
| status | [GRPCRouteStatus](#g-rpc-route-status)| `GRPCRouteStatus` |  | |  |  |
| uid | [UID](#uid)| `UID` |  | |  |  |



### <span id="g-rpc-route-filter"></span> GRPCRouteFilter


> +kubebuilder:validation:XValidation:message="filter.requestHeaderModifier must be nil if the filter.type is not RequestHeaderModifier",rule="!(has(self.requestHeaderModifier) && self.type != 'RequestHeaderModifier')"
+kubebuilder:validation:XValidation:message="filter.requestHeaderModifier must be specified for RequestHeaderModifier filter.type",rule="!(!has(self.requestHeaderModifier) && self.type == 'RequestHeaderModifier')"
+kubebuilder:validation:XValidation:message="filter.responseHeaderModifier must be nil if the filter.type is not ResponseHeaderModifier",rule="!(has(self.responseHeaderModifier) && self.type != 'ResponseHeaderModifier')"
+kubebuilder:validation:XValidation:message="filter.responseHeaderModifier must be specified for ResponseHeaderModifier filter.type",rule="!(!has(self.responseHeaderModifier) && self.type == 'ResponseHeaderModifier')"
+kubebuilder:validation:XValidation:message="filter.requestMirror must be nil if the filter.type is not RequestMirror",rule="!(has(self.requestMirror) && self.type != 'RequestMirror')"
+kubebuilder:validation:XValidation:message="filter.requestMirror must be specified for RequestMirror filter.type",rule="!(!has(self.requestMirror) && self.type == 'RequestMirror')"
+kubebuilder:validation:XValidation:message="filter.extensionRef must be nil if the filter.type is not ExtensionRef",rule="!(has(self.extensionRef) && self.type != 'ExtensionRef')"
+kubebuilder:validation:XValidation:message="filter.extensionRef must be specified for ExtensionRef filter.type",rule="!(!has(self.extensionRef) && self.type == 'ExtensionRef')"
  





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
method:
type: Exact
service: "foo"
headers:
name: "version"
value "v1"

```
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Headers | [][GRPCHeaderMatch](#g-rpc-header-match)| `[]*GRPCHeaderMatch` |  | | Headers specifies gRPC request header matchers. Multiple match values are
ANDed together, meaning, a request MUST match all the specified headers
to select the route.

+listType=map
+listMapKey=name
+optional
+kubebuilder:validation:MaxItems=16 |  |
| method | [GRPCMethodMatch](#g-rpc-method-match)| `GRPCMethodMatch` |  | |  |  |



### <span id="g-rpc-route-rule"></span> GRPCRouteRule


> GRPCRouteRule defines the semantics for matching a gRPC request based on
conditions (matches), processing it (filters), and forwarding the request to
an API object (backendRefs).
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| BackendRefs | [][GRPCBackendRef](#g-rpc-backend-ref)| `[]*GRPCBackendRef` |  | | BackendRefs defines the backend(s) where matching requests should be
sent.

Failure behavior here depends on how many BackendRefs are specified and
how many are invalid.

If *all* entries in BackendRefs are invalid, and there are also no filters
specified in this route rule, *all* traffic which matches this rule MUST
receive an `UNAVAILABLE` status.

See the GRPCBackendRef definition for the rules about what makes a single
GRPCBackendRef invalid.

When a GRPCBackendRef is invalid, `UNAVAILABLE` statuses MUST be returned for
requests that would have otherwise been routed to an invalid backend. If
multiple backends are specified, and some are invalid, the proportion of
requests that would otherwise have been routed to an invalid backend
MUST receive an `UNAVAILABLE` status.

For example, if two backends are specified with equal weights, and one is
invalid, 50 percent of traffic MUST receive an `UNAVAILABLE` status.
Implementations may choose how that 50 percent is determined.

Support: Core for Kubernetes Service

Support: Implementation-specific for any other resource

Support for weight: Core

+optional
+kubebuilder:validation:MaxItems=16 |  |
| Filters | [][GRPCRouteFilter](#g-rpc-route-filter)| `[]*GRPCRouteFilter` |  | | Filters define the filters that are applied to requests that match
this rule.

The effects of ordering of multiple behaviors are currently unspecified.
This can change in the future based on feedback during the alpha stage.

Conformance-levels at this level are defined based on the type of filter:

ALL core filters MUST be supported by all implementations that support
GRPCRoute.
Implementers are encouraged to support extended filters.
Implementation-specific custom filters have no API guarantees across
implementations.

Specifying the same filter multiple times is not supported unless explicitly
indicated in the filter.

If an implementation can not support a combination of filters, it must clearly
document that limitation. In cases where incompatible or unsupported
filters are specified and cause the `Accepted` condition to be set to status
`False`, implementations may use the `IncompatibleFilters` reason to specify
this configuration error.

Support: Core

+optional
+kubebuilder:validation:MaxItems=16
+kubebuilder:validation:XValidation:message="RequestHeaderModifier filter cannot be repeated",rule="self.filter(f, f.type == 'RequestHeaderModifier').size() <= 1"
+kubebuilder:validation:XValidation:message="ResponseHeaderModifier filter cannot be repeated",rule="self.filter(f, f.type == 'ResponseHeaderModifier').size() <= 1" |  |
| Matches | [][GRPCRouteMatch](#g-rpc-route-match)| `[]*GRPCRouteMatch` |  | | Matches define conditions used for matching the rule against incoming
gRPC requests. Each match is independent, i.e. this rule will be matched
if **any** one of the matches is satisfied.

For example, take the following matches configuration:

```
matches:
method:
service: foo.bar
headers:
values:
version: 2
method:
service: foo.bar.v2
```

For a request to match against this rule, it MUST satisfy
EITHER of the two conditions:

service of foo.bar AND contains the header `version: 2`
service of foo.bar.v2

See the documentation for GRPCRouteMatch on how to specify multiple
match conditions to be ANDed together.

If no matches are specified, the implementation MUST match every gRPC request.

Proxy or Load Balancer routing configuration generated from GRPCRoutes
MUST prioritize rules based on the following criteria, continuing on
ties. Merging MUST not be done between GRPCRoutes and HTTPRoutes.
Precedence MUST be given to the rule with the largest number of:

Characters in a matching non-wildcard hostname.
Characters in a matching hostname.
Characters in a matching service.
Characters in a matching method.
Header matches.

If ties still exist across multiple Routes, matching precedence MUST be
determined in order of the following criteria, continuing on ties:

The oldest Route based on creation timestamp.
The Route appearing first in alphabetical order by
"{namespace}/{name}".

If ties still exist within the Route that has been given precedence,
matching precedence MUST be granted to the first matching rule meeting
the above criteria.

+optional
+kubebuilder:validation:MaxItems=8 |  |
| name | [SectionName](#section-name)| `SectionName` |  | |  |  |
| sessionPersistence | [SessionPersistence](#session-persistence)| `SessionPersistence` |  | |  |  |



### <span id="g-rpc-route-spec"></span> GRPCRouteSpec


> GRPCRouteSpec defines the desired state of GRPCRoute
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Hostnames | [][Hostname](#hostname)| `[]Hostname` |  | | Hostnames defines a set of hostnames to match against the GRPC
Host header to select a GRPCRoute to process the request. This matches
the RFC 1123 definition of a hostname with 2 notable exceptions:

1. IPs are not allowed.
2. A hostname may be prefixed with a wildcard label (`*.`). The wildcard
label MUST appear by itself as the first label.

If a hostname is specified by both the Listener and GRPCRoute, there
MUST be at least one intersecting hostname for the GRPCRoute to be |  |
| ParentRefs | [][ParentReference](#parent-reference)| `[]*ParentReference` |  | | ParentRefs references the resources (usually Gateways) that a Route wants
to be attached to. Note that the referenced parent resource needs to
allow this for the attachment to be complete. For Gateways, that means
the Gateway needs to allow attachment from Routes of this kind and
namespace. For Services, that means the Service must either be in the same
namespace for a "producer" route, or the mesh implementation must support
and allow "consumer" routes for the referenced Service. ReferenceGrant is
not applicable for governing ParentRefs to Services - it is not possible to
create a "producer" route for a Service in a different namespace from the
Route.

There are two kinds of parent resources with "Core" support:

Gateway (Gateway conformance profile)
Service (Mesh conformance profile, ClusterIP Services only)

This API may be extended in the future to support additional kinds of parent
resources.

ParentRefs must be _distinct_. This means either that:

They select different objects.  If this is the case, then parentRef
entries are distinct. In terms of fields, this means that the
multi-part key defined by `group`, `kind`, `namespace`, and `name` must
be unique across all parentRef entries in the Route.
They do not select different objects, but for each optional field used,
each ParentRef that selects the same object must set the same set of
optional fields to different values. If one ParentRef sets a
combination of optional fields, all must set the same combination.

Some examples:

If one ParentRef sets `sectionName`, all ParentRefs referencing the
same object must also set `sectionName`.
If one ParentRef sets `port`, all ParentRefs referencing the same
object must also set `port`.
If one ParentRef sets `sectionName` and `port`, all ParentRefs
referencing the same object must also set `sectionName` and `port`.

It is possible to separately reference multiple distinct objects that may
be collapsed by an implementation. For example, some implementations may
choose to merge compatible Gateway Listeners together. If that is the
case, the list of routes attached to those resources should also be
merged.

Note that for ParentRefs that cross namespace boundaries, there are specific
rules. Cross-namespace references are only valid if they are explicitly
allowed by something in the namespace they are referring to. For example,
Gateway has the AllowedRoutes field, and ReferenceGrant provides a
generic way to enable other kinds of cross-namespace reference.

<gateway:experimental:description>
ParentRefs from a Route to a Service in the same namespace are "producer"
routes, which apply default routing rules to inbound connections from
any namespace to the Service.

ParentRefs from a Route to a Service in a different namespace are
"consumer" routes, and these routing rules are only applied to outbound
connections originating from the same namespace as the Route, for which
the intended destination of the connections are a Service targeted as a
ParentRef of the Route.
</gateway:experimental:description>

+optional
+kubebuilder:validation:MaxItems=32
<gateway:standard:validation:XValidation:message="sectionName must be specified when parentRefs includes 2 or more references to the same parent",rule="self.all(p1, self.all(p2, p1.group == p2.group && p1.kind == p2.kind && p1.name == p2.name && (((!has(p1.__namespace__) || p1.__namespace__ == '') && (!has(p2.__namespace__) || p2.__namespace__ == '')) || (has(p1.__namespace__) && has(p2.__namespace__) && p1.__namespace__ == p2.__namespace__ )) ? ((!has(p1.sectionName) || p1.sectionName == '') == (!has(p2.sectionName) || p2.sectionName == '')) : true))">
<gateway:standard:validation:XValidation:message="sectionName must be unique when parentRefs includes 2 or more references to the same parent",rule="self.all(p1, self.exists_one(p2, p1.group == p2.group && p1.kind == p2.kind && p1.name == p2.name && (((!has(p1.__namespace__) || p1.__namespace__ == '') && (!has(p2.__namespace__) || p2.__namespace__ == '')) || (has(p1.__namespace__) && has(p2.__namespace__) && p1.__namespace__ == p2.__namespace__ )) && (((!has(p1.sectionName) || p1.sectionName == '') && (!has(p2.sectionName) || p2.sectionName == '')) || (has(p1.sectionName) && has(p2.sectionName) && p1.sectionName == p2.sectionName))))">
<gateway:experimental:validation:XValidation:message="sectionName or port must be specified when parentRefs includes 2 or more references to the same parent",rule="self.all(p1, self.all(p2, p1.group == p2.group && p1.kind == p2.kind && p1.name == p2.name && (((!has(p1.__namespace__) || p1.__namespace__ == '') && (!has(p2.__namespace__) || p2.__namespace__ == '')) || (has(p1.__namespace__) && has(p2.__namespace__) && p1.__namespace__ == p2.__namespace__)) ? ((!has(p1.sectionName) || p1.sectionName == '') == (!has(p2.sectionName) || p2.sectionName == '') && (!has(p1.port) || p1.port == 0) == (!has(p2.port) || p2.port == 0)): true))">
<gateway:experimental:validation:XValidation:message="sectionName or port must be unique when parentRefs includes 2 or more references to the same parent",rule="self.all(p1, self.exists_one(p2, p1.group == p2.group && p1.kind == p2.kind && p1.name == p2.name && (((!has(p1.__namespace__) || p1.__namespace__ == '') && (!has(p2.__namespace__) || p2.__namespace__ == '')) || (has(p1.__namespace__) && has(p2.__namespace__) && p1.__namespace__ == p2.__namespace__ )) && (((!has(p1.sectionName) || p1.sectionName == '') && (!has(p2.sectionName) || p2.sectionName == '')) || ( has(p1.sectionName) && has(p2.sectionName) && p1.sectionName == p2.sectionName)) && (((!has(p1.port) || p1.port == 0) && (!has(p2.port) || p2.port == 0)) || (has(p1.port) && has(p2.port) && p1.port == p2.port))))"> |  |
| Rules | [][GRPCRouteRule](#g-rpc-route-rule)| `[]*GRPCRouteRule` |  | | Rules are a list of GRPC matchers, filters and actions.

+optional
+kubebuilder:validation:MaxItems=16
+kubebuilder:validation:XValidation:message="While 16 rules and 64 matches per rule are allowed, the total number of matches across all rules in a route must be less than 128",rule="(self.size() > 0 ? (has(self[0].matches) ? self[0].matches.size() : 0) : 0) + (self.size() > 1 ? (has(self[1].matches) ? self[1].matches.size() : 0) : 0) + (self.size() > 2 ? (has(self[2].matches) ? self[2].matches.size() : 0) : 0) + (self.size() > 3 ? (has(self[3].matches) ? self[3].matches.size() : 0) : 0) + (self.size() > 4 ? (has(self[4].matches) ? self[4].matches.size() : 0) : 0) + (self.size() > 5 ? (has(self[5].matches) ? self[5].matches.size() : 0) : 0) + (self.size() > 6 ? (has(self[6].matches) ? self[6].matches.size() : 0) : 0) + (self.size() > 7 ? (has(self[7].matches) ? self[7].matches.size() : 0) : 0) + (self.size() > 8 ? (has(self[8].matches) ? self[8].matches.size() : 0) : 0) + (self.size() > 9 ? (has(self[9].matches) ? self[9].matches.size() : 0) : 0) + (self.size() > 10 ? (has(self[10].matches) ? self[10].matches.size() : 0) : 0) + (self.size() > 11 ? (has(self[11].matches) ? self[11].matches.size() : 0) : 0) + (self.size() > 12 ? (has(self[12].matches) ? self[12].matches.size() : 0) : 0) + (self.size() > 13 ? (has(self[13].matches) ? self[13].matches.size() : 0) : 0) + (self.size() > 14 ? (has(self[14].matches) ? self[14].matches.size() : 0) : 0) + (self.size() > 15 ? (has(self[15].matches) ? self[15].matches.size() : 0) : 0) <= 128"
<gateway:experimental:validation:XValidation:message="Rule name must be unique within the route",rule="self.all(l1, !has(l1.name) || self.exists_one(l2, has(l2.name) && l1.name == l2.name))"> |  |



### <span id="g-rpc-route-status"></span> GRPCRouteStatus


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Parents | [][RouteParentStatus](#route-parent-status)| `[]*RouteParentStatus` |  | | Parents is a list of parent resources (usually Gateways) that are
associated with the route, and the status of the route with respect to
each parent. When this route attaches to a parent, the controller that
manages the parent must add an entry to this list when the controller
first sees the route and should update the entry as appropriate when the
route or gateway is modified.

Note that parent references that cannot be resolved by an implementation
of this API will not be added to this list. Implementations of this API
can only populate Route status for the Gateways/parent resources they are
responsible for.

A maximum of 32 Gateways will be represented in this list. An empty list
means the route has not been attached to any Gateway.

+kubebuilder:validation:MaxItems=32 |  |



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

"example.com/bar"

Invalid values include:

"example.com" - must include path
"foo.example.com" - must include path

+kubebuilder:validation:MinLength=1
+kubebuilder:validation:MaxLength=253
+kubebuilder:validation:Pattern=`^[a-z0-9]([-a-z0-9]*[a-z0-9])?(\.[a-z0-9]([-a-z0-9]*[a-z0-9])?)*\/[A-Za-z0-9\/\-._~%!$&'()*+,;=:]+$`
  



| Name | Type | Go type | Default | Description | Example |
|------|------|---------| ------- |-------------|---------|
| GatewayController | string| string | | Valid values include:

"example.com/bar"

Invalid values include:

"example.com" - must include path
"foo.example.com" - must include path

+kubebuilder:validation:MinLength=1
+kubebuilder:validation:MaxLength=253
+kubebuilder:validation:Pattern=`^[a-z0-9]([-a-z0-9]*[a-z0-9])?(\.[a-z0-9]([-a-z0-9]*[a-z0-9])?)*\/[A-Za-z0-9\/\-._~%!$&'()*+,;=:]+$` |  |



### <span id="grafana-info"></span> GrafanaInfo


> GrafanaInfo provides information to access Grafana dashboards
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| ExternalLinks | [][ExternalLink](#external-link)| `[]*ExternalLink` |  | |  |  |



### <span id="group"></span> Group


> This validation is based off of the corresponding Kubernetes validation:
https://github.com/kubernetes/apimachinery/blob/02cfb53916346d085a6c6c7c66f882e3c6b0eca6/pkg/util/validation/validation.go#L208

Valid values include:

"" - empty string implies core Kubernetes API group
"gateway.networking.k8s.io"
"foo.example.com"

Invalid values include:

"example.com/bar" - "/" is an invalid character

+kubebuilder:validation:MaxLength=253
+kubebuilder:validation:Pattern=`^$|^[a-z0-9]([-a-z0-9]*[a-z0-9])?(\.[a-z0-9]([-a-z0-9]*[a-z0-9])?)*$`
  



| Name | Type | Go type | Default | Description | Example |
|------|------|---------| ------- |-------------|---------|
| Group | string| string | | This validation is based off of the corresponding Kubernetes validation:
https://github.com/kubernetes/apimachinery/blob/02cfb53916346d085a6c6c7c66f882e3c6b0eca6/pkg/util/validation/validation.go#L208

Valid values include:

"" - empty string implies core Kubernetes API group
"gateway.networking.k8s.io"
"foo.example.com"

Invalid values include:

"example.com/bar" - "/" is an invalid character

+kubebuilder:validation:MaxLength=253
+kubebuilder:validation:Pattern=`^$|^[a-z0-9]([-a-z0-9]*[a-z0-9])?(\.[a-z0-9]([-a-z0-9]*[a-z0-9])?)*$` |  |



### <span id="group-version-kind"></span> GroupVersionKind


> GroupVersionKind unambiguously identifies a kind.  It doesn't anonymously include GroupVersion
to avoid automatic coercion.  It doesn't use a GroupVersion to avoid custom marshalling
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Group | string| `string` |  | |  |  |
| Kind | string| `string` |  | |  |  |
| Version | string| `string` |  | |  |  |



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
| Filters | [][HTTPRouteFilter](#http-route-filter)| `[]*HTTPRouteFilter` |  | | Filters defined at this level should be executed if and only if the
request is being forwarded to the backend defined here.

Support: Implementation-specific (For broader support of filters, use the
Filters field in HTTPRouteRule.)

+optional
+kubebuilder:validation:MaxItems=16
+kubebuilder:validation:XValidation:message="May specify either httpRouteFilterRequestRedirect or httpRouteFilterRequestRewrite, but not both",rule="!(self.exists(f, f.type == 'RequestRedirect') && self.exists(f, f.type == 'URLRewrite'))"
+kubebuilder:validation:XValidation:message="May specify either httpRouteFilterRequestRedirect or httpRouteFilterRequestRewrite, but not both",rule="!(self.exists(f, f.type == 'RequestRedirect') && self.exists(f, f.type == 'URLRewrite'))"
+kubebuilder:validation:XValidation:message="RequestHeaderModifier filter cannot be repeated",rule="self.filter(f, f.type == 'RequestHeaderModifier').size() <= 1"
+kubebuilder:validation:XValidation:message="ResponseHeaderModifier filter cannot be repeated",rule="self.filter(f, f.type == 'ResponseHeaderModifier').size() <= 1"
+kubebuilder:validation:XValidation:message="RequestRedirect filter cannot be repeated",rule="self.filter(f, f.type == 'RequestRedirect').size() <= 1"
+kubebuilder:validation:XValidation:message="URLRewrite filter cannot be repeated",rule="self.filter(f, f.type == 'URLRewrite').size() <= 1" |  |
| Weight | int32 (formatted integer)| `int32` |  | | Weight specifies the proportion of requests forwarded to the referenced
backend. This is computed as weight/(sum of all weights in this
BackendRefs list). For non-zero values, there may be some epsilon from
the exact proportion defined here depending on the precision an
implementation supports. Weight is not a percentage and the sum of
weights does not need to equal 100.

If only one backend is specified and it has a weight greater than 0, 100%
of the traffic is forwarded to that backend. If weight is set to 0, no
traffic should be forwarded for this entry. If unspecified, weight
defaults to 1.

Support for this field varies based on the context where used.

+optional
+kubebuilder:default=1
+kubebuilder:validation:Minimum=0
+kubebuilder:validation:Maximum=1000000 |  |
| group | [Group](#group)| `Group` |  | |  |  |
| kind | [Kind](#kind)| `Kind` |  | |  |  |
| name | [ObjectName](#object-name)| `ObjectName` |  | |  |  |
| namespace | [Namespace](#namespace)| `Namespace` |  | |  |  |
| port | [PortNumber](#port-number)| `PortNumber` |  | |  |  |



### <span id="http-header"></span> HTTPHeader


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Value | string| `string` |  | | Value is the value of HTTP Header to be matched.

+kubebuilder:validation:MinLength=1
+kubebuilder:validation:MaxLength=4096 |  |
| name | [HTTPHeaderName](#http-header-name)| `HTTPHeaderName` |  | |  |  |



### <span id="http-header-filter"></span> HTTPHeaderFilter


> HTTPHeaderFilter defines a filter that modifies the headers of an HTTP
request or response. Only one action for a given header name is permitted.
Filters specifying multiple actions of the same or different type for any one
header name are invalid and will be rejected by CRD validation.
Configuration to set or add multiple values for a header must use RFC 7230
header value formatting, separating each value with a comma.
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Add | [][HTTPHeader](#http-header)| `[]*HTTPHeader` |  | | Add adds the given header(s) (name, value) to the request
before the action. It appends to any existing values associated
with the header name.

Input:
GET /foo HTTP/1.1
my-header: foo

Config:
add:
name: "my-header"
value: "bar,baz"

Output:
GET /foo HTTP/1.1
my-header: foo,bar,baz

+optional
+listType=map
+listMapKey=name
+kubebuilder:validation:MaxItems=16 |  |
| Remove | []string| `[]string` |  | | Remove the given header(s) from the HTTP request before the action. The
value of Remove is a list of HTTP header names. Note that the header
names are case-insensitive (see
https://datatracker.ietf.org/doc/html/rfc2616#section-4.2).

Input:
GET /foo HTTP/1.1
my-header1: foo
my-header2: bar
my-header3: baz

Config:
remove: ["my-header1", "my-header3"]

Output:
GET /foo HTTP/1.1
my-header2: bar

+optional
+listType=set
+kubebuilder:validation:MaxItems=16 |  |
| Set | [][HTTPHeader](#http-header)| `[]*HTTPHeader` |  | | Set overwrites the request with the given header (name, value)
before the action.

Input:
GET /foo HTTP/1.1
my-header: foo

Config:
set:
name: "my-header"
value: "bar"

Output:
GET /foo HTTP/1.1
my-header: bar

+optional
+listType=map
+listMapKey=name
+kubebuilder:validation:MaxItems=16 |  |



### <span id="http-header-match"></span> HTTPHeaderMatch


> HTTPHeaderMatch describes how to select a HTTP route by matching HTTP request
headers.
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Value | string| `string` |  | | Value is the value of HTTP Header to be matched.

+kubebuilder:validation:MinLength=1
+kubebuilder:validation:MaxLength=4096 |  |
| name | [HTTPHeaderName](#http-header-name)| `HTTPHeaderName` |  | |  |  |
| type | [HeaderMatchType](#header-match-type)| `HeaderMatchType` |  | |  |  |



### <span id="http-header-name"></span> HTTPHeaderName


  

[HeaderName](#header-name)

#### Inlined models

### <span id="http-method"></span> HTTPMethod


> Note that values may be added to this enum, implementations
must ensure that unknown values will not cause a crash.

Unknown values here must result in the implementation setting the
Accepted Condition for the Route to `status: False`, with a
Reason of `UnsupportedValue`.

+kubebuilder:validation:Enum=GET;HEAD;POST;PUT;DELETE;CONNECT;OPTIONS;TRACE;PATCH
  



| Name | Type | Go type | Default | Description | Example |
|------|------|---------| ------- |-------------|---------|
| HTTPMethod | string| string | | Note that values may be added to this enum, implementations
must ensure that unknown values will not cause a crash.

Unknown values here must result in the implementation setting the
Accepted Condition for the Route to `status: False`, with a
Reason of `UnsupportedValue`.

+kubebuilder:validation:Enum=GET;HEAD;POST;PUT;DELETE;CONNECT;OPTIONS;TRACE;PATCH |  |



### <span id="http-path-match"></span> HTTPPathMatch


> +kubebuilder:validation:XValidation:message="value must be an absolute path and start with '/' when type one of ['Exact', 'PathPrefix']",rule="(self.type in ['Exact','PathPrefix']) ? self.value.startsWith('/') : true"
+kubebuilder:validation:XValidation:message="must not contain '//' when type one of ['Exact', 'PathPrefix']",rule="(self.type in ['Exact','PathPrefix']) ? !self.value.contains('//') : true"
+kubebuilder:validation:XValidation:message="must not contain '/./' when type one of ['Exact', 'PathPrefix']",rule="(self.type in ['Exact','PathPrefix']) ? !self.value.contains('/./') : true"
+kubebuilder:validation:XValidation:message="must not contain '/../' when type one of ['Exact', 'PathPrefix']",rule="(self.type in ['Exact','PathPrefix']) ? !self.value.contains('/../') : true"
+kubebuilder:validation:XValidation:message="must not contain '%2f' when type one of ['Exact', 'PathPrefix']",rule="(self.type in ['Exact','PathPrefix']) ? !self.value.contains('%2f') : true"
+kubebuilder:validation:XValidation:message="must not contain '%2F' when type one of ['Exact', 'PathPrefix']",rule="(self.type in ['Exact','PathPrefix']) ? !self.value.contains('%2F') : true"
+kubebuilder:validation:XValidation:message="must not contain '#' when type one of ['Exact', 'PathPrefix']",rule="(self.type in ['Exact','PathPrefix']) ? !self.value.contains('#') : true"
+kubebuilder:validation:XValidation:message="must not end with '/..' when type one of ['Exact', 'PathPrefix']",rule="(self.type in ['Exact','PathPrefix']) ? !self.value.endsWith('/..') : true"
+kubebuilder:validation:XValidation:message="must not end with '/.' when type one of ['Exact', 'PathPrefix']",rule="(self.type in ['Exact','PathPrefix']) ? !self.value.endsWith('/.') : true"
+kubebuilder:validation:XValidation:message="type must be one of ['Exact', 'PathPrefix', 'RegularExpression']",rule="self.type in ['Exact','PathPrefix'] || self.type == 'RegularExpression'"
+kubebuilder:validation:XValidation:message="must only contain valid characters (matching ^(?:[-A-Za-z0-9/._~!$&'()*+,;=:@]|[%][0-9a-fA-F]{2})+$) for types ['Exact', 'PathPrefix']",rule="(self.type in ['Exact','PathPrefix']) ? self.value.matches(r\"\"\"^(?:[-A-Za-z0-9/._~!$&'()*+,;=:@]|[%][0-9a-fA-F]{2})+$\"\"\") : true"
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Value | string| `string` |  | | Value of the HTTP path to match against.

+optional
+kubebuilder:default="/"
+kubebuilder:validation:MaxLength=1024 |  |
| type | [PathMatchType](#path-match-type)| `PathMatchType` |  | |  |  |



### <span id="http-path-modifier"></span> HTTPPathModifier


> +kubebuilder:validation:XValidation:message="replaceFullPath must be specified when type is set to 'ReplaceFullPath'",rule="self.type == 'ReplaceFullPath' ? has(self.replaceFullPath) : true"
+kubebuilder:validation:XValidation:message="type must be 'ReplaceFullPath' when replaceFullPath is set",rule="has(self.replaceFullPath) ? self.type == 'ReplaceFullPath' : true"
+kubebuilder:validation:XValidation:message="replacePrefixMatch must be specified when type is set to 'ReplacePrefixMatch'",rule="self.type == 'ReplacePrefixMatch' ? has(self.replacePrefixMatch) : true"
+kubebuilder:validation:XValidation:message="type must be 'ReplacePrefixMatch' when replacePrefixMatch is set",rule="has(self.replacePrefixMatch) ? self.type == 'ReplacePrefixMatch' : true"
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| ReplaceFullPath | string| `string` |  | | ReplaceFullPath specifies the value with which to replace the full path
of a request during a rewrite or redirect.

+kubebuilder:validation:MaxLength=1024
+optional |  |
| ReplacePrefixMatch | string| `string` |  | | ReplacePrefixMatch specifies the value with which to replace the prefix
match of a request during a rewrite or redirect. For example, a request
to "/foo/bar" with a prefix match of "/foo" and a ReplacePrefixMatch
of "/xyz" would be modified to "/xyz/bar".

Note that this matches the behavior of the PathPrefix match type. This
matches full path elements. A path element refers to the list of labels
in the path split by the `/` separator. When specified, a trailing `/` is
ignored. For example, the paths `/abc`, `/abc/`, and `/abc/def` would all
match the prefix `/abc`, but the path `/abcd` would not.

ReplacePrefixMatch is only compatible with a `PathPrefix` HTTPRouteMatch.
Using any other HTTPRouteMatch type on the same HTTPRouteRule will result in
the implementation setting the Accepted Condition for the Route to `status: False`.

Request Path | Prefix Match | Replace Prefix | Modified Path
--------------|----------------|----------
foo/bar     | /foo         | /xyz           | /xyz/bar
foo/bar     | /foo         | /xyz/          | /xyz/bar
foo/bar     | /foo/        | /xyz           | /xyz/bar
foo/bar     | /foo/        | /xyz/          | /xyz/bar
foo         | /foo         | /xyz           | /xyz
foo/        | /foo         | /xyz           | /xyz/
foo/bar     | /foo         | <empty string> | /bar
foo/        | /foo         | <empty string> | /
foo         | /foo         | <empty string> | /
foo/        | /foo         | /              | /
foo         | /foo         | /              | /

+kubebuilder:validation:MaxLength=1024
+optional |  |
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
| Value | string| `string` |  | | Value is the value of HTTP query param to be matched.

+kubebuilder:validation:MinLength=1
+kubebuilder:validation:MaxLength=1024 |  |
| name | [HTTPHeaderName](#http-header-name)| `HTTPHeaderName` |  | |  |  |
| type | [QueryParamMatchType](#query-param-match-type)| `QueryParamMatchType` |  | |  |  |



### <span id="http-request-mirror-filter"></span> HTTPRequestMirrorFilter


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Percent | int32 (formatted integer)| `int32` |  | | Percent represents the percentage of requests that should be
mirrored to BackendRef. Its minimum value is 0 (indicating 0% of
requests) and its maximum value is 100 (indicating 100% of requests).

Only one of Fraction or Percent may be specified. If neither field
is specified, 100% of requests will be mirrored.

+optional
+kubebuilder:validation:Minimum=0
+kubebuilder:validation:Maximum=100
<gateway:experimental> |  |
| backendRef | [BackendObjectReference](#backend-object-reference)| `BackendObjectReference` |  | |  |  |
| fraction | [Fraction](#fraction)| `Fraction` |  | |  |  |



### <span id="http-request-redirect-filter"></span> HTTPRequestRedirectFilter


> HTTPRequestRedirect defines a filter that redirects a request. This filter
MUST NOT be used on the same Route rule as a HTTPURLRewrite filter.
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Scheme | string| `string` |  | | Scheme is the scheme to be used in the value of the `Location` header in
the response. When empty, the scheme of the request is used.

Scheme redirects can affect the port of the redirect, for more information,
refer to the documentation for the port field of this filter.

Note that values may be added to this enum, implementations
must ensure that unknown values will not cause a crash.

Unknown values here must result in the implementation setting the
Accepted Condition for the Route to `status: False`, with a
Reason of `UnsupportedValue`.

Support: Extended

+optional
+kubebuilder:validation:Enum=http;https |  |
| StatusCode | int64 (formatted integer)| `int64` |  | | StatusCode is the HTTP status code to be used in response.

Note that values may be added to this enum, implementations
must ensure that unknown values will not cause a crash.

Unknown values here must result in the implementation setting the
Accepted Condition for the Route to `status: False`, with a
Reason of `UnsupportedValue`.

Support: Core

+optional
+kubebuilder:default=302
+kubebuilder:validation:Enum=301;302 |  |
| hostname | [PreciseHostname](#precise-hostname)| `PreciseHostname` |  | |  |  |
| path | [HTTPPathModifier](#http-path-modifier)| `HTTPPathModifier` |  | |  |  |
| port | [PortNumber](#port-number)| `PortNumber` |  | |  |  |



### <span id="http-route"></span> HTTPRoute


> HTTPRoute provides a way to route HTTP requests. This includes the capability
to match requests by hostname, path, header, or query param. Filters can be
used to specify additional processing steps. Backends specify where matching
requests should be routed.
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| APIVersion | string| `string` |  | | APIVersion defines the versioned schema of this representation of an object.
Servers should convert recognized schemas to the latest internal value, and
may reject unrecognized values.
More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#resources
+optional |  |
| Annotations | map of string| `map[string]string` |  | | Annotations is an unstructured key value map stored with a resource that may be
set by external tools to store and retrieve arbitrary metadata. They are not
queryable and should be preserved when modifying objects.
More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/annotations
+optional |  |
| DeletionGracePeriodSeconds | int64 (formatted integer)| `int64` |  | | Number of seconds allowed for this object to gracefully terminate before
it will be removed from the system. Only set when deletionTimestamp is also set.
May only be shortened.
Read-only.
+optional |  |
| Finalizers | []string| `[]string` |  | | Must be empty before the object is deleted from the registry. Each entry
is an identifier for the responsible component that will remove the entry
from the list. If the deletionTimestamp of the object is non-nil, entries
in this list can only be removed.
Finalizers may be processed and removed in any order.  Order is NOT enforced
because it introduces significant risk of stuck finalizers.
finalizers is a shared field, any actor with permission can reorder it.
If the finalizer list is processed in order, then this can lead to a situation
in which the component responsible for the first finalizer in the list is
waiting for a signal (field value, external system, or other) produced by a
component responsible for a finalizer later in the list, resulting in a deadlock.
Without enforced ordering finalizers are free to order amongst themselves and
are not vulnerable to ordering changes in the list.
+optional
+patchStrategy=merge
+listType=set |  |
| GenerateName | string| `string` |  | | GenerateName is an optional prefix, used by the server, to generate a unique
name ONLY IF the Name field has not been provided.
If this field is used, the name returned to the client will be different
than the name passed. This value will also be combined with a unique suffix.
The provided value has the same validation rules as the Name field,
and may be truncated by the length of the suffix required to make the value
unique on the server.

If this field is specified and the generated name exists, the server will return a 409.

Applied only if Name is not specified.
More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#idempotency
+optional |  |
| Generation | int64 (formatted integer)| `int64` |  | | A sequence number representing a specific generation of the desired state.
Populated by the system. Read-only.
+optional |  |
| Kind | string| `string` |  | | Kind is a string value representing the REST resource this object represents.
Servers may infer this from the endpoint the client submits requests to.
Cannot be updated.
In CamelCase.
More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds
+optional |  |
| Labels | map of string| `map[string]string` |  | | Map of string keys and values that can be used to organize and categorize
(scope and select) objects. May match selectors of replication controllers
and services.
More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/labels
+optional |  |
| ManagedFields | [][ManagedFieldsEntry](#managed-fields-entry)| `[]*ManagedFieldsEntry` |  | | ManagedFields maps workflow-id and version to the set of fields
that are managed by that workflow. This is mostly for internal
housekeeping, and users typically shouldn't need to set or
understand this field. A workflow can be the user's name, a
controller's name, or the name of a specific apply path like
"ci-cd". The set of fields is always in the version that the
workflow used when modifying the object.

+optional
+listType=atomic |  |
| Name | string| `string` |  | | Name must be unique within a namespace. Is required when creating resources, although
some resources may allow a client to request the generation of an appropriate name
automatically. Name is primarily intended for creation idempotence and configuration
definition.
Cannot be updated.
More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names#names
+optional |  |
| Namespace | string| `string` |  | | Namespace defines the space within which each name must be unique. An empty namespace is
equivalent to the "default" namespace, but "default" is the canonical representation.
Not all objects are required to be scoped to a namespace - the value of this field for
those objects will be empty.

Must be a DNS_LABEL.
Cannot be updated.
More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/namespaces
+optional |  |
| OwnerReferences | [][OwnerReference](#owner-reference)| `[]*OwnerReference` |  | | List of objects depended by this object. If ALL objects in the list have
been deleted, this object will be garbage collected. If this object is managed by a controller,
then an entry in this list will point to this controller, with the controller field set to true.
There cannot be more than one managing controller.
+optional
+patchMergeKey=uid
+patchStrategy=merge
+listType=map
+listMapKey=uid |  |
| ResourceVersion | string| `string` |  | | An opaque value that represents the internal version of this object that can
be used by clients to determine when objects have changed. May be used for optimistic
concurrency, change detection, and the watch operation on a resource or set of resources.
Clients must treat these values as opaque and passed unmodified back to the server.
They may only be valid for a particular resource or set of resources.

Populated by the system.
Read-only.
Value must be treated as opaque by clients and .
More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#concurrency-control-and-consistency
+optional |  |
| SelfLink | string| `string` |  | | Deprecated: selfLink is a legacy read-only field that is no longer populated by the system.
+optional |  |
| creationTimestamp | [Time](#time)| `Time` |  | |  |  |
| deletionTimestamp | [Time](#time)| `Time` |  | |  |  |
| spec | [HTTPRouteSpec](#http-route-spec)| `HTTPRouteSpec` |  | |  |  |
| status | [HTTPRouteStatus](#http-route-status)| `HTTPRouteStatus` |  | |  |  |
| uid | [UID](#uid)| `UID` |  | |  |  |



### <span id="http-route-filter"></span> HTTPRouteFilter


> +kubebuilder:validation:XValidation:message="filter.requestHeaderModifier must be nil if the filter.type is not RequestHeaderModifier",rule="!(has(self.requestHeaderModifier) && self.type != 'RequestHeaderModifier')"
+kubebuilder:validation:XValidation:message="filter.requestHeaderModifier must be specified for RequestHeaderModifier filter.type",rule="!(!has(self.requestHeaderModifier) && self.type == 'RequestHeaderModifier')"
+kubebuilder:validation:XValidation:message="filter.responseHeaderModifier must be nil if the filter.type is not ResponseHeaderModifier",rule="!(has(self.responseHeaderModifier) && self.type != 'ResponseHeaderModifier')"
+kubebuilder:validation:XValidation:message="filter.responseHeaderModifier must be specified for ResponseHeaderModifier filter.type",rule="!(!has(self.responseHeaderModifier) && self.type == 'ResponseHeaderModifier')"
+kubebuilder:validation:XValidation:message="filter.requestMirror must be nil if the filter.type is not RequestMirror",rule="!(has(self.requestMirror) && self.type != 'RequestMirror')"
+kubebuilder:validation:XValidation:message="filter.requestMirror must be specified for RequestMirror filter.type",rule="!(!has(self.requestMirror) && self.type == 'RequestMirror')"
+kubebuilder:validation:XValidation:message="filter.requestRedirect must be nil if the filter.type is not RequestRedirect",rule="!(has(self.requestRedirect) && self.type != 'RequestRedirect')"
+kubebuilder:validation:XValidation:message="filter.requestRedirect must be specified for RequestRedirect filter.type",rule="!(!has(self.requestRedirect) && self.type == 'RequestRedirect')"
+kubebuilder:validation:XValidation:message="filter.urlRewrite must be nil if the filter.type is not URLRewrite",rule="!(has(self.urlRewrite) && self.type != 'URLRewrite')"
+kubebuilder:validation:XValidation:message="filter.urlRewrite must be specified for URLRewrite filter.type",rule="!(!has(self.urlRewrite) && self.type == 'URLRewrite')"
+kubebuilder:validation:XValidation:message="filter.extensionRef must be nil if the filter.type is not ExtensionRef",rule="!(has(self.extensionRef) && self.type != 'ExtensionRef')"
+kubebuilder:validation:XValidation:message="filter.extensionRef must be specified for ExtensionRef filter.type",rule="!(!has(self.extensionRef) && self.type == 'ExtensionRef')"
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| extensionRef | [LocalObjectReference](#local-object-reference)| `LocalObjectReference` |  | |  |  |
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
name: "version"
value "v1"

```
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Headers | [][HTTPHeaderMatch](#http-header-match)| `[]*HTTPHeaderMatch` |  | | Headers specifies HTTP request header matchers. Multiple match values are
ANDed together, meaning, a request must match all the specified headers
to select the route.

+listType=map
+listMapKey=name
+optional
+kubebuilder:validation:MaxItems=16 |  |
| QueryParams | [][HTTPQueryParamMatch](#http-query-param-match)| `[]*HTTPQueryParamMatch` |  | | QueryParams specifies HTTP query parameter matchers. Multiple match
values are ANDed together, meaning, a request must match all the
specified query parameters to select the route.

Support: Extended

+listType=map
+listMapKey=name
+optional
+kubebuilder:validation:MaxItems=16 |  |
| method | [HTTPMethod](#http-method)| `HTTPMethod` |  | |  |  |
| path | [HTTPPathMatch](#http-path-match)| `HTTPPathMatch` |  | |  |  |



### <span id="http-route-retry"></span> HTTPRouteRetry


> Implementations SHOULD retry on connection errors (disconnect, reset, timeout,
TCP failure) if a retry stanza is configured.
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Attempts | int64 (formatted integer)| `int64` |  | | Attempts specifies the maxmimum number of times an individual request
from the gateway to a backend should be retried.

If the maximum number of retries has been attempted without a successful
response from the backend, the Gateway MUST return an error.

When this field is unspecified, the number of times to attempt to retry
a backend request is implementation-specific.

Support: Extended

+optional |  |
| Codes | [][HTTPRouteRetryStatusCode](#http-route-retry-status-code)| `[]HTTPRouteRetryStatusCode` |  | | Codes defines the HTTP response status codes for which a backend request
should be retried.

Support: Extended

+optional |  |
| backoff | [Duration](#duration)| `Duration` |  | |  |  |



### <span id="http-route-retry-status-code"></span> HTTPRouteRetryStatusCode


> Implementations MUST support the following status codes as retryable:

500
502
503
504

Implementations MAY support specifying additional discrete values in the
500-599 range.

Implementations MAY support specifying discrete values in the 400-499 range,
which are often inadvisable to retry.

+kubebuilder:validation:Minimum:=400
+kubebuilder:validation:Maximum:=599
<gateway:experimental>
  



| Name | Type | Go type | Default | Description | Example |
|------|------|---------| ------- |-------------|---------|
| HTTPRouteRetryStatusCode | int64 (formatted integer)| int64 | | Implementations MUST support the following status codes as retryable:

500
502
503
504

Implementations MAY support specifying additional discrete values in the
500-599 range.

Implementations MAY support specifying discrete values in the 400-499 range,
which are often inadvisable to retry.

+kubebuilder:validation:Minimum:=400
+kubebuilder:validation:Maximum:=599
<gateway:experimental> |  |



### <span id="http-route-rule"></span> HTTPRouteRule


> +kubebuilder:validation:XValidation:message="RequestRedirect filter must not be used together with backendRefs",rule="(has(self.backendRefs) && size(self.backendRefs) > 0) ? (!has(self.filters) || self.filters.all(f, !has(f.requestRedirect))): true"
+kubebuilder:validation:XValidation:message="When using RequestRedirect filter with path.replacePrefixMatch, exactly one PathPrefix match must be specified",rule="(has(self.filters) && self.filters.exists_one(f, has(f.requestRedirect) && has(f.requestRedirect.path) && f.requestRedirect.path.type == 'ReplacePrefixMatch' && has(f.requestRedirect.path.replacePrefixMatch))) ? ((size(self.matches) != 1 || !has(self.matches[0].path) || self.matches[0].path.type != 'PathPrefix') ? false : true) : true"
+kubebuilder:validation:XValidation:message="When using URLRewrite filter with path.replacePrefixMatch, exactly one PathPrefix match must be specified",rule="(has(self.filters) && self.filters.exists_one(f, has(f.urlRewrite) && has(f.urlRewrite.path) && f.urlRewrite.path.type == 'ReplacePrefixMatch' && has(f.urlRewrite.path.replacePrefixMatch))) ? ((size(self.matches) != 1 || !has(self.matches[0].path) || self.matches[0].path.type != 'PathPrefix') ? false : true) : true"
+kubebuilder:validation:XValidation:message="Within backendRefs, when using RequestRedirect filter with path.replacePrefixMatch, exactly one PathPrefix match must be specified",rule="(has(self.backendRefs) && self.backendRefs.exists_one(b, (has(b.filters) && b.filters.exists_one(f, has(f.requestRedirect) && has(f.requestRedirect.path) && f.requestRedirect.path.type == 'ReplacePrefixMatch' && has(f.requestRedirect.path.replacePrefixMatch))) )) ? ((size(self.matches) != 1 || !has(self.matches[0].path) || self.matches[0].path.type != 'PathPrefix') ? false : true) : true"
+kubebuilder:validation:XValidation:message="Within backendRefs, When using URLRewrite filter with path.replacePrefixMatch, exactly one PathPrefix match must be specified",rule="(has(self.backendRefs) && self.backendRefs.exists_one(b, (has(b.filters) && b.filters.exists_one(f, has(f.urlRewrite) && has(f.urlRewrite.path) && f.urlRewrite.path.type == 'ReplacePrefixMatch' && has(f.urlRewrite.path.replacePrefixMatch))) )) ? ((size(self.matches) != 1 || !has(self.matches[0].path) || self.matches[0].path.type != 'PathPrefix') ? false : true) : true"
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| BackendRefs | [][HTTPBackendRef](#http-backend-ref)| `[]*HTTPBackendRef` |  | | BackendRefs defines the backend(s) where matching requests should be
sent.

Failure behavior here depends on how many BackendRefs are specified and
how many are invalid.

If *all* entries in BackendRefs are invalid, and there are also no filters
specified in this route rule, *all* traffic which matches this rule MUST
receive a 500 status code.

See the HTTPBackendRef definition for the rules about what makes a single
HTTPBackendRef invalid.

When a HTTPBackendRef is invalid, 500 status codes MUST be returned for
requests that would have otherwise been routed to an invalid backend. If
multiple backends are specified, and some are invalid, the proportion of
requests that would otherwise have been routed to an invalid backend
MUST receive a 500 status code.

For example, if two backends are specified with equal weights, and one is
invalid, 50 percent of traffic must receive a 500. Implementations may
choose how that 50 percent is determined.

When a HTTPBackendRef refers to a Service that has no ready endpoints,
implementations SHOULD return a 503 for requests to that backend instead.
If an implementation chooses to do this, all of the above rules for 500 responses
MUST also apply for responses that return a 503.

Support: Core for Kubernetes Service

Support: Extended for Kubernetes ServiceImport

Support: Implementation-specific for any other resource

Support for weight: Core

+optional
+kubebuilder:validation:MaxItems=16 |  |
| Filters | [][HTTPRouteFilter](#http-route-filter)| `[]*HTTPRouteFilter` |  | | Filters define the filters that are applied to requests that match
this rule.

Wherever possible, implementations SHOULD implement filters in the order
they are specified.

Implementations MAY choose to implement this ordering strictly, rejecting
any combination or order of filters that can not be supported. If implementations
choose a strict interpretation of filter ordering, they MUST clearly document
that behavior.

To reject an invalid combination or order of filters, implementations SHOULD
consider the Route Rules with this configuration invalid. If all Route Rules
in a Route are invalid, the entire Route would be considered invalid. If only
a portion of Route Rules are invalid, implementations MUST set the
"PartiallyInvalid" condition for the Route.

Conformance-levels at this level are defined based on the type of filter:

ALL core filters MUST be supported by all implementations.
Implementers are encouraged to support extended filters.
Implementation-specific custom filters have no API guarantees across
implementations.

Specifying the same filter multiple times is not supported unless explicitly
indicated in the filter.

All filters are expected to be compatible with each other except for the
URLRewrite and RequestRedirect filters, which may not be combined. If an
implementation can not support other combinations of filters, they must clearly
document that limitation. In cases where incompatible or unsupported
filters are specified and cause the `Accepted` condition to be set to status
`False`, implementations may use the `IncompatibleFilters` reason to specify
this configuration error.

Support: Core

+optional
+kubebuilder:validation:MaxItems=16
+kubebuilder:validation:XValidation:message="May specify either httpRouteFilterRequestRedirect or httpRouteFilterRequestRewrite, but not both",rule="!(self.exists(f, f.type == 'RequestRedirect') && self.exists(f, f.type == 'URLRewrite'))"
+kubebuilder:validation:XValidation:message="RequestHeaderModifier filter cannot be repeated",rule="self.filter(f, f.type == 'RequestHeaderModifier').size() <= 1"
+kubebuilder:validation:XValidation:message="ResponseHeaderModifier filter cannot be repeated",rule="self.filter(f, f.type == 'ResponseHeaderModifier').size() <= 1"
+kubebuilder:validation:XValidation:message="RequestRedirect filter cannot be repeated",rule="self.filter(f, f.type == 'RequestRedirect').size() <= 1"
+kubebuilder:validation:XValidation:message="URLRewrite filter cannot be repeated",rule="self.filter(f, f.type == 'URLRewrite').size() <= 1" |  |
| Matches | [][HTTPRouteMatch](#http-route-match)| `[]*HTTPRouteMatch` |  | | Matches define conditions used for matching the rule against incoming
HTTP requests. Each match is independent, i.e. this rule will be matched
if **any** one of the matches is satisfied.

For example, take the following matches configuration:

```
matches:
path:
value: "/foo"
headers:
name: "version"
value: "v2"
path:
value: "/v2/foo"
```

For a request to match against this rule, a request must satisfy
EITHER of the two conditions:

path prefixed with `/foo` AND contains the header `version: v2`
path prefix of `/v2/foo`

See the documentation for HTTPRouteMatch on how to specify multiple
match conditions that should be ANDed together.

If no matches are specified, the default is a prefix
path match on "/", which has the effect of matching every
HTTP request.

Proxy or Load Balancer routing configuration generated from HTTPRoutes
MUST prioritize matches based on the following criteria, continuing on
ties. Across all rules specified on applicable Routes, precedence must be
given to the match having:

"Exact" path match.
"Prefix" path match with largest number of characters.
Method match.
Largest number of header matches.
Largest number of query param matches.

Note: The precedence of RegularExpression path matches are implementation-specific.

If ties still exist across multiple Routes, matching precedence MUST be
determined in order of the following criteria, continuing on ties:

The oldest Route based on creation timestamp.
The Route appearing first in alphabetical order by
"{namespace}/{name}".

If ties still exist within an HTTPRoute, matching precedence MUST be granted
to the FIRST matching rule (in list order) with a match meeting the above
criteria.

When no rules matching a request have been successfully attached to the
parent a request is coming from, a HTTP 404 status code MUST be returned.

+optional
+kubebuilder:validation:MaxItems=64
+kubebuilder:default={{path:{ type: "PathPrefix", value: "/"}}} |  |
| name | [SectionName](#section-name)| `SectionName` |  | |  |  |
| retry | [HTTPRouteRetry](#http-route-retry)| `HTTPRouteRetry` |  | |  |  |
| sessionPersistence | [SessionPersistence](#session-persistence)| `SessionPersistence` |  | |  |  |
| timeouts | [HTTPRouteTimeouts](#http-route-timeouts)| `HTTPRouteTimeouts` |  | |  |  |



### <span id="http-route-spec"></span> HTTPRouteSpec


> HTTPRouteSpec defines the desired state of HTTPRoute
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Hostnames | [][Hostname](#hostname)| `[]Hostname` |  | | Hostnames defines a set of hostnames that should match against the HTTP Host
header to select a HTTPRoute used to process the request. Implementations
MUST ignore any port value specified in the HTTP Host header while
performing a match and (absent of any applicable header modification
configuration) MUST forward this header unmodified to the backend.

Valid values for Hostnames are determined by RFC 1123 definition of a
hostname with 2 notable exceptions:

1. IPs are not allowed.
2. A hostname may be prefixed with a wildcard label (`*.`). The wildcard
label must appear by itself as the first label.

If a hostname is specified by both the Listener and HTTPRoute, there
must be at least one intersecting hostname for the HTTPRoute to be |  |
| ParentRefs | [][ParentReference](#parent-reference)| `[]*ParentReference` |  | | ParentRefs references the resources (usually Gateways) that a Route wants
to be attached to. Note that the referenced parent resource needs to
allow this for the attachment to be complete. For Gateways, that means
the Gateway needs to allow attachment from Routes of this kind and
namespace. For Services, that means the Service must either be in the same
namespace for a "producer" route, or the mesh implementation must support
and allow "consumer" routes for the referenced Service. ReferenceGrant is
not applicable for governing ParentRefs to Services - it is not possible to
create a "producer" route for a Service in a different namespace from the
Route.

There are two kinds of parent resources with "Core" support:

Gateway (Gateway conformance profile)
Service (Mesh conformance profile, ClusterIP Services only)

This API may be extended in the future to support additional kinds of parent
resources.

ParentRefs must be _distinct_. This means either that:

They select different objects.  If this is the case, then parentRef
entries are distinct. In terms of fields, this means that the
multi-part key defined by `group`, `kind`, `namespace`, and `name` must
be unique across all parentRef entries in the Route.
They do not select different objects, but for each optional field used,
each ParentRef that selects the same object must set the same set of
optional fields to different values. If one ParentRef sets a
combination of optional fields, all must set the same combination.

Some examples:

If one ParentRef sets `sectionName`, all ParentRefs referencing the
same object must also set `sectionName`.
If one ParentRef sets `port`, all ParentRefs referencing the same
object must also set `port`.
If one ParentRef sets `sectionName` and `port`, all ParentRefs
referencing the same object must also set `sectionName` and `port`.

It is possible to separately reference multiple distinct objects that may
be collapsed by an implementation. For example, some implementations may
choose to merge compatible Gateway Listeners together. If that is the
case, the list of routes attached to those resources should also be
merged.

Note that for ParentRefs that cross namespace boundaries, there are specific
rules. Cross-namespace references are only valid if they are explicitly
allowed by something in the namespace they are referring to. For example,
Gateway has the AllowedRoutes field, and ReferenceGrant provides a
generic way to enable other kinds of cross-namespace reference.

<gateway:experimental:description>
ParentRefs from a Route to a Service in the same namespace are "producer"
routes, which apply default routing rules to inbound connections from
any namespace to the Service.

ParentRefs from a Route to a Service in a different namespace are
"consumer" routes, and these routing rules are only applied to outbound
connections originating from the same namespace as the Route, for which
the intended destination of the connections are a Service targeted as a
ParentRef of the Route.
</gateway:experimental:description>

+optional
+kubebuilder:validation:MaxItems=32
<gateway:standard:validation:XValidation:message="sectionName must be specified when parentRefs includes 2 or more references to the same parent",rule="self.all(p1, self.all(p2, p1.group == p2.group && p1.kind == p2.kind && p1.name == p2.name && (((!has(p1.__namespace__) || p1.__namespace__ == '') && (!has(p2.__namespace__) || p2.__namespace__ == '')) || (has(p1.__namespace__) && has(p2.__namespace__) && p1.__namespace__ == p2.__namespace__ )) ? ((!has(p1.sectionName) || p1.sectionName == '') == (!has(p2.sectionName) || p2.sectionName == '')) : true))">
<gateway:standard:validation:XValidation:message="sectionName must be unique when parentRefs includes 2 or more references to the same parent",rule="self.all(p1, self.exists_one(p2, p1.group == p2.group && p1.kind == p2.kind && p1.name == p2.name && (((!has(p1.__namespace__) || p1.__namespace__ == '') && (!has(p2.__namespace__) || p2.__namespace__ == '')) || (has(p1.__namespace__) && has(p2.__namespace__) && p1.__namespace__ == p2.__namespace__ )) && (((!has(p1.sectionName) || p1.sectionName == '') && (!has(p2.sectionName) || p2.sectionName == '')) || (has(p1.sectionName) && has(p2.sectionName) && p1.sectionName == p2.sectionName))))">
<gateway:experimental:validation:XValidation:message="sectionName or port must be specified when parentRefs includes 2 or more references to the same parent",rule="self.all(p1, self.all(p2, p1.group == p2.group && p1.kind == p2.kind && p1.name == p2.name && (((!has(p1.__namespace__) || p1.__namespace__ == '') && (!has(p2.__namespace__) || p2.__namespace__ == '')) || (has(p1.__namespace__) && has(p2.__namespace__) && p1.__namespace__ == p2.__namespace__)) ? ((!has(p1.sectionName) || p1.sectionName == '') == (!has(p2.sectionName) || p2.sectionName == '') && (!has(p1.port) || p1.port == 0) == (!has(p2.port) || p2.port == 0)): true))">
<gateway:experimental:validation:XValidation:message="sectionName or port must be unique when parentRefs includes 2 or more references to the same parent",rule="self.all(p1, self.exists_one(p2, p1.group == p2.group && p1.kind == p2.kind && p1.name == p2.name && (((!has(p1.__namespace__) || p1.__namespace__ == '') && (!has(p2.__namespace__) || p2.__namespace__ == '')) || (has(p1.__namespace__) && has(p2.__namespace__) && p1.__namespace__ == p2.__namespace__ )) && (((!has(p1.sectionName) || p1.sectionName == '') && (!has(p2.sectionName) || p2.sectionName == '')) || ( has(p1.sectionName) && has(p2.sectionName) && p1.sectionName == p2.sectionName)) && (((!has(p1.port) || p1.port == 0) && (!has(p2.port) || p2.port == 0)) || (has(p1.port) && has(p2.port) && p1.port == p2.port))))"> |  |
| Rules | [][HTTPRouteRule](#http-route-rule)| `[]*HTTPRouteRule` |  | | Rules are a list of HTTP matchers, filters and actions.

+optional
<gateway:experimental:validation:XValidation:message="Rule name must be unique within the route",rule="self.all(l1, !has(l1.name) || self.exists_one(l2, has(l2.name) && l1.name == l2.name))">
+kubebuilder:validation:MaxItems=16
+kubebuilder:default={{matches: {{path: {type: "PathPrefix", value: "/"}}}}}
+kubebuilder:validation:XValidation:message="While 16 rules and 64 matches per rule are allowed, the total number of matches across all rules in a route must be less than 128",rule="(self.size() > 0 ? self[0].matches.size() : 0) + (self.size() > 1 ? self[1].matches.size() : 0) + (self.size() > 2 ? self[2].matches.size() : 0) + (self.size() > 3 ? self[3].matches.size() : 0) + (self.size() > 4 ? self[4].matches.size() : 0) + (self.size() > 5 ? self[5].matches.size() : 0) + (self.size() > 6 ? self[6].matches.size() : 0) + (self.size() > 7 ? self[7].matches.size() : 0) + (self.size() > 8 ? self[8].matches.size() : 0) + (self.size() > 9 ? self[9].matches.size() : 0) + (self.size() > 10 ? self[10].matches.size() : 0) + (self.size() > 11 ? self[11].matches.size() : 0) + (self.size() > 12 ? self[12].matches.size() : 0) + (self.size() > 13 ? self[13].matches.size() : 0) + (self.size() > 14 ? self[14].matches.size() : 0) + (self.size() > 15 ? self[15].matches.size() : 0) <= 128" |  |



### <span id="http-route-status"></span> HTTPRouteStatus


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Parents | [][RouteParentStatus](#route-parent-status)| `[]*RouteParentStatus` |  | | Parents is a list of parent resources (usually Gateways) that are
associated with the route, and the status of the route with respect to
each parent. When this route attaches to a parent, the controller that
manages the parent must add an entry to this list when the controller
first sees the route and should update the entry as appropriate when the
route or gateway is modified.

Note that parent references that cannot be resolved by an implementation
of this API will not be added to this list. Implementations of this API
can only populate Route status for the Gateways/parent resources they are
responsible for.

A maximum of 32 Gateways will be represented in this list. An empty list
means the route has not been attached to any Gateway.

+kubebuilder:validation:MaxItems=32 |  |



### <span id="http-route-timeouts"></span> HTTPRouteTimeouts


> +kubebuilder:validation:XValidation:message="backendRequest timeout cannot be longer than request timeout",rule="!(has(self.request) && has(self.backendRequest) && duration(self.request) != duration('0s') && duration(self.backendRequest) > duration(self.request))"
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| backendRequest | [Duration](#duration)| `Duration` |  | |  |  |
| request | [Duration](#duration)| `Duration` |  | |  |  |



### <span id="http-url-rewrite-filter"></span> HTTPURLRewriteFilter


> Support: Extended
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| hostname | [PreciseHostname](#precise-hostname)| `PreciseHostname` |  | |  |  |
| path | [HTTPPathModifier](#http-path-modifier)| `HTTPPathModifier` |  | |  |  |



### <span id="header-match-type"></span> HeaderMatchType


> "Exact" - Core
"RegularExpression" - Implementation Specific

Note that values may be added to this enum, implementations
must ensure that unknown values will not cause a crash.

Unknown values here must result in the implementation setting the
Accepted Condition for the Route to `status: False`, with a
Reason of `UnsupportedValue`.

+kubebuilder:validation:Enum=Exact;RegularExpression
  



| Name | Type | Go type | Default | Description | Example |
|------|------|---------| ------- |-------------|---------|
| HeaderMatchType | string| string | | "Exact" - Core
"RegularExpression" - Implementation Specific

Note that values may be added to this enum, implementations
must ensure that unknown values will not cause a crash.

Unknown values here must result in the implementation setting the
Accepted Condition for the Route to `status: False`, with a
Reason of `UnsupportedValue`.

+kubebuilder:validation:Enum=Exact;RegularExpression |  |



### <span id="header-name"></span> HeaderName


> +kubebuilder:validation:MinLength=1
+kubebuilder:validation:MaxLength=256
+kubebuilder:validation:Pattern=`^[A-Za-z0-9!#$%&'*+\-.^_\x60|~]+$`
+k8s:deepcopy-gen=false
  



| Name | Type | Go type | Default | Description | Example |
|------|------|---------| ------- |-------------|---------|
| HeaderName | string| string | | +kubebuilder:validation:MinLength=1
+kubebuilder:validation:MaxLength=256
+kubebuilder:validation:Pattern=`^[A-Za-z0-9!#$%&'*+\-.^_\x60|~]+$`
+k8s:deepcopy-gen=false |  |



### <span id="health-config"></span> HealthConfig


> HealthConfig maps annotations information for health
  



[HealthConfig](#health-config)

### <span id="host"></span> Host


> Host represents the FQDN format for Istio hostnames
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Cluster | string| `string` |  | |  |  |
| CompleteInput | boolean| `bool` |  | | CompleteInput is true when Service, Namespace and Cluster fields are present.
It is true for simple service names and FQDN services.
It is false for service.namespace format and service entries. |  |
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

+kubebuilder:validation:MinLength=1
+kubebuilder:validation:MaxLength=253
+kubebuilder:validation:Pattern=`^(\*\.)?[a-z0-9]([-a-z0-9]*[a-z0-9])?(\.[a-z0-9]([-a-z0-9]*[a-z0-9])?)*$`
  



| Name | Type | Go type | Default | Description | Example |
|------|------|---------| ------- |-------------|---------|
| Hostname | string| string | | 1. IPs are not allowed.
2. A hostname may be prefixed with a wildcard label (`*.`). The wildcard
label must appear by itself as the first label.

Hostname can be "precise" which is a domain name without the terminating
dot of a network host (e.g. "foo.example.com") or "wildcard", which is a
domain name prefixed with a single wildcard label (e.g. `*.example.com`).

Note that as per RFC1035 and RFC1123, a *label* must consist of lower case
alphanumeric characters or '-', and must start and end with an alphanumeric
character. No other punctuation is allowed.

+kubebuilder:validation:MinLength=1
+kubebuilder:validation:MaxLength=253
+kubebuilder:validation:Pattern=`^(\*\.)?[a-z0-9]([-a-z0-9]*[a-z0-9])?(\.[a-z0-9]([-a-z0-9]*[a-z0-9])?)*$` |  |



### <span id="ip-family"></span> IPFamily


> IPFamily represents the IP Family (IPv4 or IPv6). This type is used
to express the family of an IP expressed by a type (e.g. service.spec.ipFamilies).
+enum
  



| Name | Type | Go type | Default | Description | Example |
|------|------|---------| ------- |-------------|---------|
| IPFamily | string| string | | IPFamily represents the IP Family (IPv4 or IPv6). This type is used
to express the family of an IP expressed by a type (e.g. service.spec.ipFamilies).
+enum |  |



### <span id="istio-component-status"></span> IstioComponentStatus


  

[][ComponentStatus](#component-status)

### <span id="istio-condition"></span> IstioCondition


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Message | string| `string` |  | | Human-readable message indicating details about last transition.
+optional |  |
| ObservedGeneration | int64 (formatted integer)| `int64` |  | | Resource Generation to which the Condition refers.
+optional
+protoc-gen-crd:validation:XIntOrString |  |
| Reason | string| `string` |  | | Unique, one-word, CamelCase reason for the condition's last transition.
+optional |  |
| Status | string| `string` |  | | Status is the status of the condition.
Can be True, False, Unknown. |  |
| Type | string| `string` |  | | Type is the type of the condition. |  |
| last_probe_time | [Timestamp](#timestamp)| `Timestamp` |  | |  |  |
| last_transition_time | [Timestamp](#timestamp)| `Timestamp` |  | |  |  |



### <span id="istio-config-details"></span> IstioConfigDetails


  

[interface{}](#interface)

### <span id="istio-config-list"></span> IstioConfigList


> IstioConfigList istioConfigList
This type is used for returning a response of IstioConfigList
  



[interface{}](#interface)

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
| Conditions | [][IstioCondition](#istio-condition)| `[]*IstioCondition` |  | | Current service state of the resource.
More info: https://istio.io/docs/reference/config/config-status/
+optional
+patchMergeKey=type
+patchStrategy=merge |  |
| ObservedGeneration | int64 (formatted integer)| `int64` |  | | $hide_from_docs
Deprecated. IstioCondition observed_generation will show the resource generation for which the condition was generated.
Resource Generation to which the Reconciled Condition refers.
When this value is not equal to the object's metadata generation, reconciled condition  calculation for the current
generation is still in progress.  See https://istio.io/latest/docs/reference/config/config-status/ for more info.
+optional
+protoc-gen-crd:validation:XIntOrString |  |
| ValidationMessages | [][AnalysisMessageBase](#analysis-message-base)| `[]*AnalysisMessageBase` |  | | Includes any errors or warnings detected by Istio's analyzers.
+optional
+patchMergeKey=type
+patchStrategy=merge |  |



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


  

[interface{}](#interface)

### <span id="istiod-thresholds"></span> IstiodThresholds


> IstiodThresholds contains the resource limits configured in Istiod
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| CPU | double (formatted number)| `float64` |  | |  |  |
| Memory | double (formatted number)| `float64` |  | |  |  |



### <span id="key-value"></span> KeyValue


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Key | string| `string` |  | |  |  |
| Value | [interface{}](#interface)| `interface{}` |  | |  |  |
| type | [ValueType](#value-type)| `ValueType` |  | |  |  |



### <span id="kiali-instance"></span> KialiInstance


> KialiInstance represents a Kiali installation. It holds some data about
where and how Kiali was deployed.
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Namespace | string| `string` |  | | Namespace is the name of the namespace where is Kiali installed on. |  |
| OperatorResource | string| `string` |  | | OperatorResource contains the namespace and the name of the Kiali CR that the user
created to install Kiali via the operator. This can be blank if the operator wasn't used
to install Kiali. This resource is populated from annotations in the Service. It has
the format "namespace/resource_name". |  |
| ServiceName | string| `string` |  | | ServiceName is the name of the Kubernetes service associated to the Kiali installation. The Kiali Service is the
entity that is looked for in order to determine if a Kiali instance is available. |  |
| Url | string| `string` |  | | Url is the URI that can be used to access Kiali. |  |
| Version | string| `string` |  | | Version is the Kiali version as reported by annotations in the Service. |  |



### <span id="kind"></span> Kind


> Valid values include:

"Service"
"HTTPRoute"

Invalid values include:

"invalid/kind" - "/" is an invalid character

+kubebuilder:validation:MinLength=1
+kubebuilder:validation:MaxLength=63
+kubebuilder:validation:Pattern=`^[a-zA-Z]([-a-zA-Z0-9]*[a-zA-Z0-9])?$`
  



| Name | Type | Go type | Default | Description | Example |
|------|------|---------| ------- |-------------|---------|
| Kind | string| string | | Valid values include:

"Service"
"HTTPRoute"

Invalid values include:

"invalid/kind" - "/" is an invalid character

+kubebuilder:validation:MinLength=1
+kubebuilder:validation:MaxLength=63
+kubebuilder:validation:Pattern=`^[a-zA-Z]([-a-zA-Z0-9]*[a-zA-Z0-9])?$` |  |



### <span id="kube-cluster"></span> KubeCluster


> Cluster holds some metadata about a Kubernetes cluster that is
part of the mesh.
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Accessible | boolean| `bool` |  | | Accessible specifies if the cluster is accessible or not. Clusters that are manually specified in the Kiali config
but do not have an associated remote cluster secret are considered not accessible. This is helpful when you have
two disconnected Kialis and want to link them without giving them access to each other. |  |
| ApiEndpoint | string| `string` |  | | ApiEndpoint is the URL where the Kubernetes/Cluster API Server can be contacted |  |
| IsKialiHome | boolean| `bool` |  | | IsKialiHome specifies if this cluster is hosting this Kiali instance (and the observed Mesh Control Plane) |  |
| KialiInstances | [][KialiInstance](#kiali-instance)| `[]*KialiInstance` |  | | KialiInstances is the list of Kialis discovered in the cluster. |  |
| Name | string| `string` |  | | Name specifies the CLUSTER_ID as known by the Control Plane |  |
| SecretName | string| `string` |  | | SecretName is the name of the kubernetes "remote cluster secret" that was mounted to the file system and where data of this cluster was resolved |  |



### <span id="label-selector"></span> LabelSelector


> A label selector is a label query over a set of resources. The result of matchLabels and
matchExpressions are ANDed. An empty label selector matches all objects. A null
label selector matches no objects.
+structType=atomic
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| MatchExpressions | [][LabelSelectorRequirement](#label-selector-requirement)| `[]*LabelSelectorRequirement` |  | | matchExpressions is a list of label selector requirements. The requirements are ANDed.
+optional
+listType=atomic |  |
| MatchLabels | map of string| `map[string]string` |  | | matchLabels is a map of {key,value} pairs. A single {key,value} in the matchLabels
map is equivalent to an element of matchExpressions, whose key field is "key", the
operator is "In", and the values array contains only "value". The requirements are ANDed.
+optional |  |



### <span id="label-selector-operator"></span> LabelSelectorOperator


  

| Name | Type | Go type | Default | Description | Example |
|------|------|---------| ------- |-------------|---------|
| LabelSelectorOperator | string| string | |  |  |



### <span id="label-selector-requirement"></span> LabelSelectorRequirement


> A label selector requirement is a selector that contains values, a key, and an operator that
relates the key and values.
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Key | string| `string` |  | | key is the label key that the selector applies to. |  |
| Values | []string| `[]string` |  | | values is an array of string values. If the operator is In or NotIn,
the values array must be non-empty. If the operator is Exists or DoesNotExist,
the values array must be empty. This array is replaced during a strategic
merge patch.
+optional
+listType=atomic |  |
| operator | [LabelSelectorOperator](#label-selector-operator)| `LabelSelectorOperator` |  | |  |  |



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

### <span id="local-object-reference"></span> LocalObjectReference


> References to objects with invalid Group and Kind are not valid, and must
be rejected by the implementation, with appropriate Conditions set
on the containing object.
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| group | [Group](#group)| `Group` |  | |  |  |
| kind | [Kind](#kind)| `Kind` |  | |  |  |
| name | [ObjectName](#object-name)| `ObjectName` |  | |  |  |



### <span id="log"></span> Log


> Log is a log emitted in a span
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Fields | [][KeyValue](#key-value)| `[]*KeyValue` |  | |  |  |
| Timestamp | uint64 (formatted integer)| `uint64` |  | |  |  |



### <span id="m-tls-status"></span> MTLSStatus


> MTLSStatus describes the current mTLS status of a mesh entity
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| AutoMTLSEnabled | boolean| `bool` |  | |  |  |
| Cluster | string| `string` |  | |  |  |
| MinTLS | string| `string` |  | |  |  |
| Namespace | string| `string` |  | |  |  |
| Status | string| `string` | ✓ | | mTLS status: MTLS_ENABLED, MTLS_PARTIALLY_ENABLED, MTLS_NOT_ENABLED | `MTLS_ENABLED` |



### <span id="managed-fields-entry"></span> ManagedFieldsEntry


> ManagedFieldsEntry is a workflow-id, a FieldSet and the group version of the resource
that the fieldset applies to.
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| APIVersion | string| `string` |  | | APIVersion defines the version of this resource that this field set
applies to. The format is "group/version" just like the top-level
APIVersion field. It is necessary to track the version of a field
set because it cannot be automatically converted. |  |
| FieldsType | string| `string` |  | | FieldsType is the discriminator for the different fields format and version.
There is currently only one possible value: "FieldsV1" |  |
| Manager | string| `string` |  | | Manager is an identifier of the workflow managing these fields. |  |
| Subresource | string| `string` |  | | Subresource is the name of the subresource used to update that object, or
empty string if the object was updated through the main resource. The
value of this field is used to distinguish between managers, even if they
share the same name. For example, a status update will be distinct from a
regular update using the same manager name.
Note that the APIVersion field is not related to the Subresource field and
it always corresponds to the version of the main resource. |  |
| fieldsV1 | [FieldsV1](#fields-v1)| `FieldsV1` |  | |  |  |
| operation | [ManagedFieldsOperationType](#managed-fields-operation-type)| `ManagedFieldsOperationType` |  | |  |  |
| time | [Time](#time)| `Time` |  | |  |  |



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
| Target | [Target](#target)| `Target` |  | |  |  |



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
| Namespace | string| `string` |  | |  |  |
| Service | string| `string` |  | |  |  |
| Version | string| `string` |  | |  |  |
| Workload | string| `string` |  | |  |  |



### <span id="namespace"></span> Namespace


> A Namespace provide a scope for names
This type is used to describe a set of objects.
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Annotations | map of string| `map[string]string` |  | | Specific annotations used in Kiali |  |
| Cluster | string| `string` | ✓ | | The name of the cluster | `east` |
| IsAmbient | boolean| `bool` | ✓ | | If has the Ambient annotations |  |
| Labels | map of string| `map[string]string` |  | | Labels for Namespace |  |
| Name | string| `string` | ✓ | | The id of the namespace. | `istio-system` |
| Revision | string| `string` |  | | Revision managing this namespace.
If the namespace has 'istio-injection: enabled' label,
it will be set to the 'default' revision. Otherwise
it matches on istio.io/rev. Note that his can also
be a Tag and not the actual revision. |  |



### <span id="namespace"></span> Namespace


> This validation is based off of the corresponding Kubernetes validation:
https://github.com/kubernetes/apimachinery/blob/02cfb53916346d085a6c6c7c66f882e3c6b0eca6/pkg/util/validation/validation.go#L187

This is used for Namespace name validation here:
https://github.com/kubernetes/apimachinery/blob/02cfb53916346d085a6c6c7c66f882e3c6b0eca6/pkg/api/validation/generic.go#L63

Valid values include:

"example"

Invalid values include:

"example.com" - "." is an invalid character

+kubebuilder:validation:Pattern=`^[a-z0-9]([-a-z0-9]*[a-z0-9])?$`
+kubebuilder:validation:MinLength=1
+kubebuilder:validation:MaxLength=63
  



| Name | Type | Go type | Default | Description | Example |
|------|------|---------| ------- |-------------|---------|
| Namespace | string| string | | This validation is based off of the corresponding Kubernetes validation:
https://github.com/kubernetes/apimachinery/blob/02cfb53916346d085a6c6c7c66f882e3c6b0eca6/pkg/util/validation/validation.go#L187

This is used for Namespace name validation here:
https://github.com/kubernetes/apimachinery/blob/02cfb53916346d085a6c6c7c66f882e3c6b0eca6/pkg/api/validation/generic.go#L63

Valid values include:

"example"

Invalid values include:

"example.com" - "." is an invalid character

+kubebuilder:validation:Pattern=`^[a-z0-9]([-a-z0-9]*[a-z0-9])?$`
+kubebuilder:validation:MinLength=1
+kubebuilder:validation:MaxLength=63 |  |



### <span id="namespace-app-health"></span> NamespaceAppHealth


> NamespaceAppsHealth is a list of app name x health for a given namespace
  



[NamespaceAppHealth](#namespace-app-health)

### <span id="namespace-service-health"></span> NamespaceServiceHealth


> NamespaceServicesHealth is a list of service name x health for a given namespace
  



[NamespaceServiceHealth](#namespace-service-health)

### <span id="namespace-workload-health"></span> NamespaceWorkloadHealth


> NamespaceWorkloadsHealth is a list of workload name x health for a given namespace
  



[NamespaceWorkloadHealth](#namespace-workload-health)

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
| HasMirroring | boolean| `bool` |  | |  |  |
| HasRequestRouting | boolean| `bool` |  | |  |  |
| HasRequestTimeout | boolean| `bool` |  | |  |  |
| HasTCPTrafficShifting | boolean| `bool` |  | |  |  |
| HasTrafficShifting | boolean| `bool` |  | |  |  |
| HasWorkloadEntry | [][WEInfo](#w-e-info)| `[]*WEInfo` |  | |  |  |
| HealthData | [interface{}](#interface)| `interface{}` |  | |  |  |
| ID | string| `string` |  | |  |  |
| IsAmbient | boolean| `bool` |  | |  |  |
| IsBox | string| `string` |  | |  |  |
| IsDead | boolean| `bool` |  | |  |  |
| IsIdle | boolean| `bool` |  | |  |  |
| IsInaccessible | boolean| `bool` |  | |  |  |
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
| hasHealthConfig | [HealthConfig](#health-config)| `HealthConfig` |  | |  |  |
| hasVS | [VSInfo](#v-s-info)| `VSInfo` |  | |  |  |
| isExtension | [ExtInfo](#ext-info)| `ExtInfo` |  | |  |  |
| isGateway | [GWInfo](#g-w-info)| `GWInfo` |  | |  |  |
| isServiceEntry | [SEInfo](#s-e-info)| `SEInfo` |  | |  |  |



### <span id="node-wrapper"></span> NodeWrapper


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| data | [NodeData](#node-data)| `NodeData` |  | |  |  |



### <span id="object-name"></span> ObjectName


> +kubebuilder:validation:MinLength=1
+kubebuilder:validation:MaxLength=253
  



| Name | Type | Go type | Default | Description | Example |
|------|------|---------| ------- |-------------|---------|
| ObjectName | string| string | | +kubebuilder:validation:MinLength=1
+kubebuilder:validation:MaxLength=253 |  |



### <span id="outbound-policy"></span> OutboundPolicy


> OutboundPolicy contains information egress traffic permissions
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Mode | string| `string` |  | |  |  |



### <span id="owner-reference"></span> OwnerReference


> OwnerReference contains enough information to let you identify an owning
object. An owning object must be in the same namespace as the dependent, or
be cluster-scoped, so there is no namespace field.
+structType=atomic
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| APIVersion | string| `string` |  | | API version of the referent. |  |
| BlockOwnerDeletion | boolean| `bool` |  | | If true, AND if the owner has the "foregroundDeletion" finalizer, then
the owner cannot be deleted from the key-value store until this
reference is removed.
See https://kubernetes.io/docs/concepts/architecture/garbage-collection/#foreground-deletion
for how the garbage collector interacts with this field and enforces the foreground deletion.
Defaults to false.
To set this field, a user needs "delete" permission of the owner,
otherwise 422 (Unprocessable Entity) will be returned.
+optional |  |
| Controller | boolean| `bool` |  | | If true, this reference points to the managing controller.
+optional |  |
| Kind | string| `string` |  | | Kind of the referent.
More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds |  |
| Name | string| `string` |  | | Name of the referent.
More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names#names |  |
| uid | [UID](#uid)| `UID` |  | |  |  |



### <span id="parent-reference"></span> ParentReference


> Gateway (Gateway conformance profile)
Service (Mesh conformance profile, ClusterIP Services only)

This API may be extended in the future to support additional kinds of parent
resources.

The API object must be valid in the cluster; the Group and Kind must
be registered in the cluster for this reference to be valid.
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| group | [Group](#group)| `Group` |  | |  |  |
| kind | [Kind](#kind)| `Kind` |  | |  |  |
| name | [ObjectName](#object-name)| `ObjectName` |  | |  |  |
| namespace | [Namespace](#namespace)| `Namespace` |  | |  |  |
| port | [PortNumber](#port-number)| `PortNumber` |  | |  |  |
| sectionName | [SectionName](#section-name)| `SectionName` |  | |  |  |



### <span id="path-match-type"></span> PathMatchType


> "Exact" - Core
"PathPrefix" - Core
"RegularExpression" - Implementation Specific

PathPrefix and Exact paths must be syntactically valid:

Must begin with the `/` character
Must not contain consecutive `/` characters (e.g. `/foo///`, `//`).

Note that values may be added to this enum, implementations
must ensure that unknown values will not cause a crash.

Unknown values here must result in the implementation setting the
Accepted Condition for the Route to `status: False`, with a
Reason of `UnsupportedValue`.

+kubebuilder:validation:Enum=Exact;PathPrefix;RegularExpression
  



| Name | Type | Go type | Default | Description | Example |
|------|------|---------| ------- |-------------|---------|
| PathMatchType | string| string | | "Exact" - Core
"PathPrefix" - Core
"RegularExpression" - Implementation Specific

PathPrefix and Exact paths must be syntactically valid:

Must begin with the `/` character
Must not contain consecutive `/` characters (e.g. `/foo///`, `//`).

Note that values may be added to this enum, implementations
must ensure that unknown values will not cause a crash.

Unknown values here must result in the implementation setting the
Accepted Condition for the Route to `status: False`, with a
Reason of `UnsupportedValue`.

+kubebuilder:validation:Enum=Exact;PathPrefix;RegularExpression |  |



### <span id="pod"></span> Pod


> Pod holds a subset of v1.Pod data that is meaningful in Kiali
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Annotations | map of string| `map[string]string` |  | |  |  |
| AppLabel | boolean| `bool` |  | |  |  |
| Containers | [][ContainerInfo](#container-info)| `[]*ContainerInfo` |  | |  |  |
| CreatedAt | string| `string` |  | |  |  |
| CreatedBy | [][Reference](#reference)| `[]*Reference` |  | |  |  |
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

### <span id="port"></span> Port


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| AppProtocol | string| `string` |  | |  |  |
| Name | string| `string` |  | |  |  |
| Port | int32 (formatted integer)| `int32` |  | |  |  |
| Protocol | string| `string` |  | |  |  |



### <span id="port-number"></span> PortNumber


> +kubebuilder:validation:Minimum=1
+kubebuilder:validation:Maximum=65535
  



| Name | Type | Go type | Default | Description | Example |
|------|------|---------| ------- |-------------|---------|
| PortNumber | int32 (formatted integer)| int32 | | +kubebuilder:validation:Minimum=1
+kubebuilder:validation:Maximum=65535 |  |



### <span id="ports"></span> Ports


  

[][Port](#port)

### <span id="precise-hostname"></span> PreciseHostname


> Note that as per RFC1035 and RFC1123, a *label* must consist of lower case
alphanumeric characters or '-', and must start and end with an alphanumeric
character. No other punctuation is allowed.

+kubebuilder:validation:MinLength=1
+kubebuilder:validation:MaxLength=253
+kubebuilder:validation:Pattern=`^[a-z0-9]([-a-z0-9]*[a-z0-9])?(\.[a-z0-9]([-a-z0-9]*[a-z0-9])?)*$`
  



| Name | Type | Go type | Default | Description | Example |
|------|------|---------| ------- |-------------|---------|
| PreciseHostname | string| string | | Note that as per RFC1035 and RFC1123, a *label* must consist of lower case
alphanumeric characters or '-', and must start and end with an alphanumeric
character. No other punctuation is allowed.

+kubebuilder:validation:MinLength=1
+kubebuilder:validation:MaxLength=253
+kubebuilder:validation:Pattern=`^[a-z0-9]([-a-z0-9]*[a-z0-9])?(\.[a-z0-9]([-a-z0-9]*[a-z0-9])?)*$` |  |



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

No precision is lost
No fractional digits will be emitted
The exponent (or suffix) is as large as possible.

The sign will be omitted unless the number is negative.

Examples:

1.5 will be serialized as "1500m"
1.5Gi will be serialized as "1536Mi"

Note that the quantity will NEVER be internally represented by a
floating point number. That is the whole point of this exercise.

Non-canonical values will still parse as long as they are well formed,
but will be re-emitted in their canonical form. (So always use canonical
form, or don't diff.)

This format is intended to make it difficult to use these numbers without
writing some sort of special handling code in the hopes that that will
cause implementors to also use a fixed point implementation.

+protobuf=true
+protobuf.embed=string
+protobuf.options.marshal=false
+protobuf.options.(gogoproto.goproto_stringer)=false
+k8s:deepcopy-gen=true
+k8s:openapi-gen=true
  



[interface{}](#interface)

### <span id="query-param-match-type"></span> QueryParamMatchType


> "Exact" - Core
"RegularExpression" - Implementation Specific

Note that values may be added to this enum, implementations
must ensure that unknown values will not cause a crash.

Unknown values here must result in the implementation setting the
Accepted Condition for the Route to `status: False`, with a
Reason of `UnsupportedValue`.

+kubebuilder:validation:Enum=Exact;RegularExpression
  



| Name | Type | Go type | Default | Description | Example |
|------|------|---------| ------- |-------------|---------|
| QueryParamMatchType | string| string | | "Exact" - Core
"RegularExpression" - Implementation Specific

Note that values may be added to this enum, implementations
must ensure that unknown values will not cause a crash.

Unknown values here must result in the implementation setting the
Accepted Condition for the Route to `status: False`, with a
Reason of `UnsupportedValue`.

+kubebuilder:validation:Enum=Exact;RegularExpression |  |



### <span id="reference"></span> Reference


> Reference is a reference from one span to another
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| refType | [ReferenceType](#reference-type)| `ReferenceType` |  | |  |  |
| spanID | [SpanID](#span-id)| `SpanID` |  | |  |  |
| traceID | [TraceID](#trace-id)| `TraceID` |  | |  |  |



### <span id="reference-grant"></span> ReferenceGrant


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
| APIVersion | string| `string` |  | | APIVersion defines the versioned schema of this representation of an object.
Servers should convert recognized schemas to the latest internal value, and
may reject unrecognized values.
More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#resources
+optional |  |
| Annotations | map of string| `map[string]string` |  | | Annotations is an unstructured key value map stored with a resource that may be
set by external tools to store and retrieve arbitrary metadata. They are not
queryable and should be preserved when modifying objects.
More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/annotations
+optional |  |
| DeletionGracePeriodSeconds | int64 (formatted integer)| `int64` |  | | Number of seconds allowed for this object to gracefully terminate before
it will be removed from the system. Only set when deletionTimestamp is also set.
May only be shortened.
Read-only.
+optional |  |
| Finalizers | []string| `[]string` |  | | Must be empty before the object is deleted from the registry. Each entry
is an identifier for the responsible component that will remove the entry
from the list. If the deletionTimestamp of the object is non-nil, entries
in this list can only be removed.
Finalizers may be processed and removed in any order.  Order is NOT enforced
because it introduces significant risk of stuck finalizers.
finalizers is a shared field, any actor with permission can reorder it.
If the finalizer list is processed in order, then this can lead to a situation
in which the component responsible for the first finalizer in the list is
waiting for a signal (field value, external system, or other) produced by a
component responsible for a finalizer later in the list, resulting in a deadlock.
Without enforced ordering finalizers are free to order amongst themselves and
are not vulnerable to ordering changes in the list.
+optional
+patchStrategy=merge
+listType=set |  |
| GenerateName | string| `string` |  | | GenerateName is an optional prefix, used by the server, to generate a unique
name ONLY IF the Name field has not been provided.
If this field is used, the name returned to the client will be different
than the name passed. This value will also be combined with a unique suffix.
The provided value has the same validation rules as the Name field,
and may be truncated by the length of the suffix required to make the value
unique on the server.

If this field is specified and the generated name exists, the server will return a 409.

Applied only if Name is not specified.
More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#idempotency
+optional |  |
| Generation | int64 (formatted integer)| `int64` |  | | A sequence number representing a specific generation of the desired state.
Populated by the system. Read-only.
+optional |  |
| Kind | string| `string` |  | | Kind is a string value representing the REST resource this object represents.
Servers may infer this from the endpoint the client submits requests to.
Cannot be updated.
In CamelCase.
More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds
+optional |  |
| Labels | map of string| `map[string]string` |  | | Map of string keys and values that can be used to organize and categorize
(scope and select) objects. May match selectors of replication controllers
and services.
More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/labels
+optional |  |
| ManagedFields | [][ManagedFieldsEntry](#managed-fields-entry)| `[]*ManagedFieldsEntry` |  | | ManagedFields maps workflow-id and version to the set of fields
that are managed by that workflow. This is mostly for internal
housekeeping, and users typically shouldn't need to set or
understand this field. A workflow can be the user's name, a
controller's name, or the name of a specific apply path like
"ci-cd". The set of fields is always in the version that the
workflow used when modifying the object.

+optional
+listType=atomic |  |
| Name | string| `string` |  | | Name must be unique within a namespace. Is required when creating resources, although
some resources may allow a client to request the generation of an appropriate name
automatically. Name is primarily intended for creation idempotence and configuration
definition.
Cannot be updated.
More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names#names
+optional |  |
| Namespace | string| `string` |  | | Namespace defines the space within which each name must be unique. An empty namespace is
equivalent to the "default" namespace, but "default" is the canonical representation.
Not all objects are required to be scoped to a namespace - the value of this field for
those objects will be empty.

Must be a DNS_LABEL.
Cannot be updated.
More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/namespaces
+optional |  |
| OwnerReferences | [][OwnerReference](#owner-reference)| `[]*OwnerReference` |  | | List of objects depended by this object. If ALL objects in the list have
been deleted, this object will be garbage collected. If this object is managed by a controller,
then an entry in this list will point to this controller, with the controller field set to true.
There cannot be more than one managing controller.
+optional
+patchMergeKey=uid
+patchStrategy=merge
+listType=map
+listMapKey=uid |  |
| ResourceVersion | string| `string` |  | | An opaque value that represents the internal version of this object that can
be used by clients to determine when objects have changed. May be used for optimistic
concurrency, change detection, and the watch operation on a resource or set of resources.
Clients must treat these values as opaque and passed unmodified back to the server.
They may only be valid for a particular resource or set of resources.

Populated by the system.
Read-only.
Value must be treated as opaque by clients and .
More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#concurrency-control-and-consistency
+optional |  |
| SelfLink | string| `string` |  | | Deprecated: selfLink is a legacy read-only field that is no longer populated by the system.
+optional |  |
| creationTimestamp | [Time](#time)| `Time` |  | |  |  |
| deletionTimestamp | [Time](#time)| `Time` |  | |  |  |
| spec | [ReferenceGrantSpec](#reference-grant-spec)| `ReferenceGrantSpec` |  | |  |  |
| uid | [UID](#uid)| `UID` |  | |  |  |



### <span id="reference-grant-from"></span> ReferenceGrantFrom


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| group | [Group](#group)| `Group` |  | |  |  |
| kind | [Kind](#kind)| `Kind` |  | |  |  |
| namespace | [Namespace](#namespace)| `Namespace` |  | |  |  |



### <span id="reference-grant-spec"></span> ReferenceGrantSpec


> ReferenceGrantSpec identifies a cross namespace relationship that is trusted
for Gateway API.
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| From | [][ReferenceGrantFrom](#reference-grant-from)| `[]*ReferenceGrantFrom` |  | | From describes the trusted namespaces and kinds that can reference the
resources described in "To". Each entry in this list MUST be considered
to be an additional place that references can be valid from, or to put
this another way, entries MUST be combined using OR.

Support: Core

+kubebuilder:validation:MinItems=1
+kubebuilder:validation:MaxItems=16 |  |
| To | [][ReferenceGrantTo](#reference-grant-to)| `[]*ReferenceGrantTo` |  | | To describes the resources that may be referenced by the resources
described in "From". Each entry in this list MUST be considered to be an
additional place that references can be valid to, or to put this another
way, entries MUST be combined using OR.

Support: Core

+kubebuilder:validation:MinItems=1
+kubebuilder:validation:MaxItems=16 |  |



### <span id="reference-grant-to"></span> ReferenceGrantTo


> ReferenceGrantTo describes what Kinds are allowed as targets of the
references.
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| group | [Group](#group)| `Group` |  | |  |  |
| kind | [Kind](#kind)| `Kind` |  | |  |  |
| name | [ObjectName](#object-name)| `ObjectName` |  | |  |  |



### <span id="reference-type"></span> ReferenceType


> ReferenceType is the reference type of one span to another
  



| Name | Type | Go type | Default | Description | Example |
|------|------|---------| ------- |-------------|---------|
| ReferenceType | string| string | | ReferenceType is the reference type of one span to another |  |



### <span id="request-health"></span> RequestHealth


> RequestHealth holds several stats about recent request errors
Inbound//Outbound are the rates of requests by protocol and status_code.
Example:   Inbound: { "http": {"200": 1.5, "400": 2.3}, "grpc": {"1": 1.2} }
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| HealthAnnotations | map of string| `map[string]string` |  | |  |  |
| Inbound | map of [map[string]float64](#map-string-float64)| `map[string]map[string]float64` |  | |  |  |
| Outbound | map of [map[string]float64](#map-string-float64)| `map[string]map[string]float64` |  | |  |  |



### <span id="resource-claim"></span> ResourceClaim


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Name | string| `string` |  | | Name must match the name of one entry in pod.spec.resourceClaims of
the Pod where this field is used. It makes that resource available
inside a container. |  |
| Request | string| `string` |  | | Request is the name chosen for a request in the referenced claim.
If empty, everything from the claim is made available, otherwise
only the result of this request.

+optional |  |



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
| Claims | [][ResourceClaim](#resource-claim)| `[]*ResourceClaim` |  | | Claims lists the names of resources, defined in spec.resourceClaims,
that are used by this container.

This is an alpha field and requires enabling the
DynamicResourceAllocation feature gate.

This field is immutable. It can only be set for containers.

+listType=map
+listMapKey=name
+featureGate=DynamicResourceAllocation
+optional |  |
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



### <span id="route-parent-status"></span> RouteParentStatus


> RouteParentStatus describes the status of a route with respect to an
associated Parent.
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Conditions | [][Condition](#condition)| `[]*Condition` |  | | Conditions describes the status of the route with respect to the Gateway.
Note that the route's availability is also subject to the Gateway's own
status conditions and listener status.

If the Route's ParentRef specifies an existing Gateway that supports
Routes of this kind AND that Gateway's controller has sufficient access,
then that Gateway's controller MUST set the "Accepted" condition on the
Route, to indicate whether the route has been accepted or rejected by the
Gateway, and why.

A Route MUST be considered "Accepted" if at least one of the Route's
rules is implemented by the Gateway.

There are a number of cases where the "Accepted" condition may not be set
due to lack of controller visibility, that includes when:

The Route refers to a non-existent parent.
The Route is of a type that the controller does not support.
The Route is in a namespace the controller does not have access to.

+listType=map
+listMapKey=type
+kubebuilder:validation:MinItems=1
+kubebuilder:validation:MaxItems=8 |  |
| controllerName | [GatewayController](#gateway-controller)| `GatewayController` |  | |  |  |
| parentRef | [ParentReference](#parent-reference)| `ParentReference` |  | |  |  |



### <span id="routes"></span> Routes


  

[][Route](#route)

### <span id="runtime"></span> Runtime


> Runtime holds the runtime title and associated dashboard template(s)
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| DashboardRefs | [][DashboardRef](#dashboard-ref)| `[]*DashboardRef` |  | |  |  |
| Name | string| `string` |  | |  |  |



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

Gateway: Listener name
HTTPRoute: HTTPRouteRule name
Service: Port name

Section names can have a variety of forms, including RFC 1123 subdomains,
RFC 1123 labels, or RFC 1035 labels.

This validation is based off of the corresponding Kubernetes validation:
https://github.com/kubernetes/apimachinery/blob/02cfb53916346d085a6c6c7c66f882e3c6b0eca6/pkg/util/validation/validation.go#L208

Valid values include:

"example"
"foo-example"
"example.com"
"foo.example.com"

Invalid values include:

"example.com/bar" - "/" is an invalid character

+kubebuilder:validation:Pattern=`^[a-z0-9]([-a-z0-9]*[a-z0-9])?(\.[a-z0-9]([-a-z0-9]*[a-z0-9])?)*$`
+kubebuilder:validation:MinLength=1
+kubebuilder:validation:MaxLength=253
  



| Name | Type | Go type | Default | Description | Example |
|------|------|---------| ------- |-------------|---------|
| SectionName | string| string | | In the following resources, SectionName is interpreted as the following:

Gateway: Listener name
HTTPRoute: HTTPRouteRule name
Service: Port name

Section names can have a variety of forms, including RFC 1123 subdomains,
RFC 1123 labels, or RFC 1035 labels.

This validation is based off of the corresponding Kubernetes validation:
https://github.com/kubernetes/apimachinery/blob/02cfb53916346d085a6c6c7c66f882e3c6b0eca6/pkg/util/validation/validation.go#L208

Valid values include:

"example"
"foo-example"
"example.com"
"foo.example.com"

Invalid values include:

"example.com/bar" - "/" is an invalid character

+kubebuilder:validation:Pattern=`^[a-z0-9]([-a-z0-9]*[a-z0-9])?(\.[a-z0-9]([-a-z0-9]*[a-z0-9])?)*$`
+kubebuilder:validation:MinLength=1
+kubebuilder:validation:MaxLength=253 |  |



### <span id="service"></span> Service


  



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



### <span id="service-details"></span> ServiceDetails


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| DestinationRules | [][DestinationRule](#destination-rule)| `[]*DestinationRule` |  | |  |  |
| IsAmbient | boolean| `bool` |  | |  |  |
| IstioSidecar | boolean| `bool` |  | |  |  |
| K8sGRPCRoutes | [][GRPCRoute](#g-rpc-route)| `[]*GRPCRoute` |  | |  |  |
| K8sHTTPRoutes | [][HTTPRoute](#http-route)| `[]*HTTPRoute` |  | |  |  |
| K8sInferencePools | [][InferencePool](#inference-pool)| `[]*InferencePool` |  | |  |  |
| K8sReferenceGrants | [][ReferenceGrant](#reference-grant)| `[]*ReferenceGrant` |  | |  |  |
| ServiceEntries | [][ServiceEntry](#service-entry)| `[]*ServiceEntry` |  | |  |  |
| SubServices | [][ServiceOverview](#service-overview)| `[]*ServiceOverview` |  | |  |  |
| VirtualServices | [][VirtualService](#virtual-service)| `[]*VirtualService` |  | |  |  |
| WaypointWorkloads | [][WorkloadReferenceInfo](#workload-reference-info)| `[]*WorkloadReferenceInfo` |  | |  |  |
| endpoints | [Endpoints](#endpoints)| `Endpoints` |  | |  |  |
| health | [ServiceHealth](#service-health)| `ServiceHealth` |  | |  |  |
| istioPermissions | [ResourcePermissions](#resource-permissions)| `ResourcePermissions` |  | |  |  |
| namespaceMTLS | [MTLSStatus](#m-tls-status)| `MTLSStatus` |  | |  |  |
| service | [Service](#service)| `Service` |  | |  |  |
| validations | [IstioValidations](#istio-validations)| `IstioValidations` |  | |  |  |
| workloads | [WorkloadOverviews](#workload-overviews)| `WorkloadOverviews` |  | |  |  |



### <span id="service-entry"></span> ServiceEntry


> <!-- crd generation tags
+cue-gen:ServiceEntry:groupName:networking.istio.io
+cue-gen:ServiceEntry:versions:v1beta1,v1alpha3,v1
+cue-gen:ServiceEntry:annotations:helm.sh/resource-policy=keep
+cue-gen:ServiceEntry:labels:app=istio-pilot,chart=istio,heritage=Tiller,release=istio
+cue-gen:ServiceEntry:subresource:status
+cue-gen:ServiceEntry:scope:Namespaced
+cue-gen:ServiceEntry:resource:categories=istio-io,networking-istio-io,shortNames=se,plural=serviceentries
+cue-gen:ServiceEntry:printerColumn:name=Hosts,type=string,JSONPath=.spec.hosts,description="The hosts associated with the ServiceEntry"
+cue-gen:ServiceEntry:printerColumn:name=Location,type=string,JSONPath=.spec.location,description="Whether the service is external to the
mesh or part of the mesh (MESH_EXTERNAL or MESH_INTERNAL)"
+cue-gen:ServiceEntry:printerColumn:name=Resolution,type=string,JSONPath=.spec.resolution,description="Service resolution mode for the hosts
(NONE, STATIC, or DNS)"
+cue-gen:ServiceEntry:printerColumn:name=Age,type=date,JSONPath=.metadata.creationTimestamp,description="CreationTimestamp is a timestamp
representing the server time when this object was created. It is not guaranteed to be set in happens-before order across separate operations.
Clients may not set this value. It is represented in RFC3339 form and is in UTC.
Populated by the system. Read-only. Null for lists. More info: https://git.k8s.io/community/contributors/devel/api-conventions.md#metadata"
+cue-gen:ServiceEntry:preserveUnknownFields:false
+cue-gen:ServiceEntry:spec:required
>

<!-- go code generation tags
+kubetype-gen
+kubetype-gen:groupVersion=networking.istio.io/v1alpha3
+genclient
+k8s:deepcopy-gen=true
istiostatus-override: ServiceEntryStatus: istio.io/api/networking/v1alpha3
>
+kubebuilder:validation:XValidation:message="only one of WorkloadSelector or Endpoints can be set",rule="oneof(self.workloadSelector, self.endpoints)"
+kubebuilder:validation:XValidation:message="CIDR addresses are allowed only for NONE/STATIC resolution types",rule="!(default(self.addresses, []).exists(k, k.contains('/')) && !(default(self.resolution, 'NONE') in ['STATIC', 'NONE']))"
+kubebuilder:validation:XValidation:message="NONE mode cannot set endpoints",rule="default(self.resolution, 'NONE') == 'NONE' ? !has(self.endpoints) : true"
+kubebuilder:validation:XValidation:message="DNS_ROUND_ROBIN mode cannot have multiple endpoints",rule="default(self.resolution, ”) == 'DNS_ROUND_ROBIN' ? default(self.endpoints, []).size() <= 1 : true"
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| APIVersion | string| `string` |  | | APIVersion defines the versioned schema of this representation of an object.
Servers should convert recognized schemas to the latest internal value, and
may reject unrecognized values.
More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#resources
+optional |  |
| Annotations | map of string| `map[string]string` |  | | Annotations is an unstructured key value map stored with a resource that may be
set by external tools to store and retrieve arbitrary metadata. They are not
queryable and should be preserved when modifying objects.
More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/annotations
+optional |  |
| DeletionGracePeriodSeconds | int64 (formatted integer)| `int64` |  | | Number of seconds allowed for this object to gracefully terminate before
it will be removed from the system. Only set when deletionTimestamp is also set.
May only be shortened.
Read-only.
+optional |  |
| Finalizers | []string| `[]string` |  | | Must be empty before the object is deleted from the registry. Each entry
is an identifier for the responsible component that will remove the entry
from the list. If the deletionTimestamp of the object is non-nil, entries
in this list can only be removed.
Finalizers may be processed and removed in any order.  Order is NOT enforced
because it introduces significant risk of stuck finalizers.
finalizers is a shared field, any actor with permission can reorder it.
If the finalizer list is processed in order, then this can lead to a situation
in which the component responsible for the first finalizer in the list is
waiting for a signal (field value, external system, or other) produced by a
component responsible for a finalizer later in the list, resulting in a deadlock.
Without enforced ordering finalizers are free to order amongst themselves and
are not vulnerable to ordering changes in the list.
+optional
+patchStrategy=merge
+listType=set |  |
| GenerateName | string| `string` |  | | GenerateName is an optional prefix, used by the server, to generate a unique
name ONLY IF the Name field has not been provided.
If this field is used, the name returned to the client will be different
than the name passed. This value will also be combined with a unique suffix.
The provided value has the same validation rules as the Name field,
and may be truncated by the length of the suffix required to make the value
unique on the server.

If this field is specified and the generated name exists, the server will return a 409.

Applied only if Name is not specified.
More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#idempotency
+optional |  |
| Generation | int64 (formatted integer)| `int64` |  | | A sequence number representing a specific generation of the desired state.
Populated by the system. Read-only.
+optional |  |
| Kind | string| `string` |  | | Kind is a string value representing the REST resource this object represents.
Servers may infer this from the endpoint the client submits requests to.
Cannot be updated.
In CamelCase.
More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds
+optional |  |
| Labels | map of string| `map[string]string` |  | | Map of string keys and values that can be used to organize and categorize
(scope and select) objects. May match selectors of replication controllers
and services.
More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/labels
+optional |  |
| ManagedFields | [][ManagedFieldsEntry](#managed-fields-entry)| `[]*ManagedFieldsEntry` |  | | ManagedFields maps workflow-id and version to the set of fields
that are managed by that workflow. This is mostly for internal
housekeeping, and users typically shouldn't need to set or
understand this field. A workflow can be the user's name, a
controller's name, or the name of a specific apply path like
"ci-cd". The set of fields is always in the version that the
workflow used when modifying the object.

+optional
+listType=atomic |  |
| Name | string| `string` |  | | Name must be unique within a namespace. Is required when creating resources, although
some resources may allow a client to request the generation of an appropriate name
automatically. Name is primarily intended for creation idempotence and configuration
definition.
Cannot be updated.
More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names#names
+optional |  |
| Namespace | string| `string` |  | | Namespace defines the space within which each name must be unique. An empty namespace is
equivalent to the "default" namespace, but "default" is the canonical representation.
Not all objects are required to be scoped to a namespace - the value of this field for
those objects will be empty.

Must be a DNS_LABEL.
Cannot be updated.
More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/namespaces
+optional |  |
| OwnerReferences | [][OwnerReference](#owner-reference)| `[]*OwnerReference` |  | | List of objects depended by this object. If ALL objects in the list have
been deleted, this object will be garbage collected. If this object is managed by a controller,
then an entry in this list will point to this controller, with the controller field set to true.
There cannot be more than one managing controller.
+optional
+patchMergeKey=uid
+patchStrategy=merge
+listType=map
+listMapKey=uid |  |
| ResourceVersion | string| `string` |  | | An opaque value that represents the internal version of this object that can
be used by clients to determine when objects have changed. May be used for optimistic
concurrency, change detection, and the watch operation on a resource or set of resources.
Clients must treat these values as opaque and passed unmodified back to the server.
They may only be valid for a particular resource or set of resources.

Populated by the system.
Read-only.
Value must be treated as opaque by clients and .
More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#concurrency-control-and-consistency
+optional |  |
| SelfLink | string| `string` |  | | Deprecated: selfLink is a legacy read-only field that is no longer populated by the system.
+optional |  |
| creationTimestamp | [Time](#time)| `Time` |  | |  |  |
| deletionTimestamp | [Time](#time)| `Time` |  | |  |  |
| spec | [ServiceEntry](#service-entry)| `ServiceEntry` |  | |  |  |
| status | [ServiceEntryStatus](#service-entry-status)| `ServiceEntryStatus` |  | |  |  |
| uid | [UID](#uid)| `UID` |  | |  |  |



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
| Addresses | [][ServiceEntryAddress](#service-entry-address)| `[]*ServiceEntryAddress` |  | | List of addresses which were assigned to this ServiceEntry.
+optional |  |
| Conditions | [][IstioCondition](#istio-condition)| `[]*IstioCondition` |  | | Current service state of ServiceEntry.
More info: https://istio.io/docs/reference/config/config-status/
+optional
+patchMergeKey=type
+patchStrategy=merge |  |
| ObservedGeneration | int64 (formatted integer)| `int64` |  | | Resource Generation to which the Reconciled Condition refers.
When this value is not equal to the object's metadata generation, reconciled condition  calculation for the current
generation is still in progress.  See https://istio.io/latest/docs/reference/config/config-status/ for more info.
+optional |  |
| ValidationMessages | [][AnalysisMessageBase](#analysis-message-base)| `[]*AnalysisMessageBase` |  | | Includes any errors or warnings detected by Istio's analyzers.
+optional
+patchMergeKey=type
+patchStrategy=merge |  |



### <span id="service-health"></span> ServiceHealth


> ServiceHealth contains aggregated health from various sources, for a given service
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| requests | [RequestHealth](#request-health)| `RequestHealth` |  | |  |  |



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
| ServiceRegistry | string| `string` |  | | ServiceRegistry values:
Kubernetes: 	is a service registry backed by k8s API server
External: 	is a service registry for externally provided ServiceEntries
Federation:  special case when registry is provided from a federated environment |  |
| additionalDetailSample | [AdditionalItem](#additional-item)| `AdditionalItem` |  | |  |  |
| health | [ServiceHealth](#service-health)| `ServiceHealth` |  | |  |  |



### <span id="service-reference-info"></span> ServiceReferenceInfo


> Used, for example, to link services to Ambient waypoint proxies
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Cluster | string| `string` |  | | Cluster |  |
| LabelType | string| `string` |  | | LabelType in case of waypoint workloads,
Where the label comes from (namespace, workload or service) | `namespace` |
| Name | string| `string` | ✓ | | Name for the service |  |
| Namespace | string| `string` | ✓ | | Namespace where the workload live in | `bookinfo` |



### <span id="session-persistence"></span> SessionPersistence


> +kubebuilder:validation:XValidation:message="AbsoluteTimeout must be specified when cookie lifetimeType is Permanent",rule="!has(self.cookieConfig) || !has(self.cookieConfig.lifetimeType) || self.cookieConfig.lifetimeType != 'Permanent' || has(self.absoluteTimeout)"
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| SessionName | string| `string` |  | | SessionName defines the name of the persistent session token
which may be reflected in the cookie or the header. Users
should avoid reusing session names to prevent unintended
consequences, such as rejection or unpredictable behavior.

Support: Implementation-specific

+optional
+kubebuilder:validation:MaxLength=128 |  |
| absoluteTimeout | [Duration](#duration)| `Duration` |  | |  |  |
| cookieConfig | [CookieConfig](#cookie-config)| `CookieConfig` |  | |  |  |
| idleTimeout | [Duration](#duration)| `Duration` |  | |  |  |
| type | [SessionPersistenceType](#session-persistence-type)| `SessionPersistenceType` |  | |  |  |



### <span id="session-persistence-type"></span> SessionPersistenceType


> +kubebuilder:validation:Enum=Cookie;Header
  



| Name | Type | Go type | Default | Description | Example |
|------|------|---------| ------- |-------------|---------|
| SessionPersistenceType | string| string | | +kubebuilder:validation:Enum=Cookie;Header |  |



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
| References | [][Reference](#reference)| `[]*Reference` |  | |  |  |
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
| ExternalServices | [][ExternalServiceInfo](#external-service-info)| `[]*ExternalServiceInfo` | ✓ | | An array of external services installed |  |
| Status | map of string| `map[string]string` | ✓ | | The state of Kiali
A hash of key,values with versions of Kiali and state |  |
| WarningMessages | []string| `[]string` |  | | An array of warningMessages. CAUTION: Please read the doc comments the in AddWarningMessages func. |  |
| istioEnvironment | [IstioEnvironment](#istio-environment)| `IstioEnvironment` | ✓ | |  |  |



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
| OrgID | string| `string` |  | |  |  |
| URLFormat | string| `string` |  | |  |  |



### <span id="time"></span> Time


> +protobuf.options.marshal=false
+protobuf.as=Timestamp
+protobuf.options.(gogoproto.goproto_stringer)=false
  



[interface{}](#interface)

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
| Nanos | int32 (formatted integer)| `int32` |  | | Non-negative fractions of a second at nanosecond resolution. Negative
second values with fractions must still have non-negative nanos values
that count forward in time. Must be from 0 to 999,999,999
inclusive. |  |
| Seconds | int64 (formatted integer)| `int64` |  | | Represents seconds of UTC time since Unix epoch
1970-01-01T00:00:00Z. Must be from 0001-01-01T00:00:00Z to
9999-12-31T23:59:59Z inclusive. |  |



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



### <span id="tracing-info"></span> TracingInfo


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Enabled | boolean| `bool` |  | |  |  |
| Integration | boolean| `bool` |  | |  |  |
| NamespaceSelector | boolean| `bool` |  | |  |  |
| Provider | string| `string` |  | |  |  |
| URL | string| `string` |  | |  |  |
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
| References | [][Reference](#reference)| `[]*Reference` |  | |  |  |
| StartTime | uint64 (formatted integer)| `uint64` |  | |  |  |
| Tags | [][KeyValue](#key-value)| `[]*KeyValue` |  | |  |  |
| TraceSize | int64 (formatted integer)| `int64` |  | |  |  |
| Warnings | []string| `[]string` |  | |  |  |
| parentSpanID | [SpanID](#span-id)| `SpanID` |  | |  |  |
| process | [Process](#process)| `Process` |  | |  |  |
| processID | [ProcessID](#process-id)| `ProcessID` |  | |  |  |
| spanID | [SpanID](#span-id)| `SpanID` |  | |  |  |
| traceID | [TraceID](#trace-id)| `TraceID` |  | |  |  |



### <span id="uid"></span> UID


> UID is a type that holds unique ID values, including UUIDs.  Because we
don't ONLY use UUIDs, this is an alias to string.  Being a type captures
intent and helps make sure that UIDs and names do not get conflated.
  



| Name | Type | Go type | Default | Description | Example |
|------|------|---------| ------- |-------------|---------|
| UID | string| string | | UID is a type that holds unique ID values, including UUIDs.  Because we
don't ONLY use UUIDs, this is an alias to string.  Being a type captures
intent and helps make sure that UIDs and names do not get conflated. |  |



### <span id="user-session-data"></span> UserSessionData


> UserSessionData userSessionData
This is used for returning the token
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| ExpiresOn | date-time (formatted string)| `strfmt.DateTime` | ✓ | | The expired time for the token
A string with the Datetime when the token will be expired | `Thu, 07 Mar 2019 17:50:26 +0000` |
| Username | string| `string` | ✓ | | The username for the token
A string with the user's username | `admin` |



### <span id="v-s-info"></span> VSInfo


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Hostnames | []string| `[]string` |  | | Hostnames is the list of hostnames configured in the associated VSs |  |



### <span id="value-type"></span> ValueType


  

| Name | Type | Go type | Default | Description | Example |
|------|------|---------| ------- |-------------|---------|
| ValueType | string| string | |  |  |



### <span id="virtual-service"></span> VirtualService


> <!-- crd generation tags
+cue-gen:VirtualService:groupName:networking.istio.io
+cue-gen:VirtualService:versions:v1beta1,v1alpha3,v1
+cue-gen:VirtualService:annotations:helm.sh/resource-policy=keep
+cue-gen:VirtualService:labels:app=istio-pilot,chart=istio,heritage=Tiller,release=istio
+cue-gen:VirtualService:subresource:status
+cue-gen:VirtualService:scope:Namespaced
+cue-gen:VirtualService:resource:categories=istio-io,networking-istio-io,shortNames=vs
+cue-gen:VirtualService:printerColumn:name=Gateways,type=string,JSONPath=.spec.gateways,description="The names of gateways and sidecars
that should apply these routes"
+cue-gen:VirtualService:printerColumn:name=Hosts,type=string,JSONPath=.spec.hosts,description="The destination hosts to which traffic is being sent"
+cue-gen:VirtualService:printerColumn:name=Age,type=date,JSONPath=.metadata.creationTimestamp,description="CreationTimestamp is a timestamp
representing the server time when this object was created. It is not guaranteed to be set in happens-before order across separate operations.
Clients may not set this value. It is represented in RFC3339 form and is in UTC.
Populated by the system. Read-only. Null for lists. More info: https://git.k8s.io/community/contributors/devel/api-conventions.md#metadata"
+cue-gen:VirtualService:preserveUnknownFields:false
>

<!-- go code generation tags
+kubetype-gen
+kubetype-gen:groupVersion=networking.istio.io/v1alpha3
+genclient
+k8s:deepcopy-gen=true
>
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| APIVersion | string| `string` |  | | APIVersion defines the versioned schema of this representation of an object.
Servers should convert recognized schemas to the latest internal value, and
may reject unrecognized values.
More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#resources
+optional |  |
| Annotations | map of string| `map[string]string` |  | | Annotations is an unstructured key value map stored with a resource that may be
set by external tools to store and retrieve arbitrary metadata. They are not
queryable and should be preserved when modifying objects.
More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/annotations
+optional |  |
| DeletionGracePeriodSeconds | int64 (formatted integer)| `int64` |  | | Number of seconds allowed for this object to gracefully terminate before
it will be removed from the system. Only set when deletionTimestamp is also set.
May only be shortened.
Read-only.
+optional |  |
| Finalizers | []string| `[]string` |  | | Must be empty before the object is deleted from the registry. Each entry
is an identifier for the responsible component that will remove the entry
from the list. If the deletionTimestamp of the object is non-nil, entries
in this list can only be removed.
Finalizers may be processed and removed in any order.  Order is NOT enforced
because it introduces significant risk of stuck finalizers.
finalizers is a shared field, any actor with permission can reorder it.
If the finalizer list is processed in order, then this can lead to a situation
in which the component responsible for the first finalizer in the list is
waiting for a signal (field value, external system, or other) produced by a
component responsible for a finalizer later in the list, resulting in a deadlock.
Without enforced ordering finalizers are free to order amongst themselves and
are not vulnerable to ordering changes in the list.
+optional
+patchStrategy=merge
+listType=set |  |
| GenerateName | string| `string` |  | | GenerateName is an optional prefix, used by the server, to generate a unique
name ONLY IF the Name field has not been provided.
If this field is used, the name returned to the client will be different
than the name passed. This value will also be combined with a unique suffix.
The provided value has the same validation rules as the Name field,
and may be truncated by the length of the suffix required to make the value
unique on the server.

If this field is specified and the generated name exists, the server will return a 409.

Applied only if Name is not specified.
More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#idempotency
+optional |  |
| Generation | int64 (formatted integer)| `int64` |  | | A sequence number representing a specific generation of the desired state.
Populated by the system. Read-only.
+optional |  |
| Kind | string| `string` |  | | Kind is a string value representing the REST resource this object represents.
Servers may infer this from the endpoint the client submits requests to.
Cannot be updated.
In CamelCase.
More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds
+optional |  |
| Labels | map of string| `map[string]string` |  | | Map of string keys and values that can be used to organize and categorize
(scope and select) objects. May match selectors of replication controllers
and services.
More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/labels
+optional |  |
| ManagedFields | [][ManagedFieldsEntry](#managed-fields-entry)| `[]*ManagedFieldsEntry` |  | | ManagedFields maps workflow-id and version to the set of fields
that are managed by that workflow. This is mostly for internal
housekeeping, and users typically shouldn't need to set or
understand this field. A workflow can be the user's name, a
controller's name, or the name of a specific apply path like
"ci-cd". The set of fields is always in the version that the
workflow used when modifying the object.

+optional
+listType=atomic |  |
| Name | string| `string` |  | | Name must be unique within a namespace. Is required when creating resources, although
some resources may allow a client to request the generation of an appropriate name
automatically. Name is primarily intended for creation idempotence and configuration
definition.
Cannot be updated.
More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names#names
+optional |  |
| Namespace | string| `string` |  | | Namespace defines the space within which each name must be unique. An empty namespace is
equivalent to the "default" namespace, but "default" is the canonical representation.
Not all objects are required to be scoped to a namespace - the value of this field for
those objects will be empty.

Must be a DNS_LABEL.
Cannot be updated.
More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/namespaces
+optional |  |
| OwnerReferences | [][OwnerReference](#owner-reference)| `[]*OwnerReference` |  | | List of objects depended by this object. If ALL objects in the list have
been deleted, this object will be garbage collected. If this object is managed by a controller,
then an entry in this list will point to this controller, with the controller field set to true.
There cannot be more than one managing controller.
+optional
+patchMergeKey=uid
+patchStrategy=merge
+listType=map
+listMapKey=uid |  |
| ResourceVersion | string| `string` |  | | An opaque value that represents the internal version of this object that can
be used by clients to determine when objects have changed. May be used for optimistic
concurrency, change detection, and the watch operation on a resource or set of resources.
Clients must treat these values as opaque and passed unmodified back to the server.
They may only be valid for a particular resource or set of resources.

Populated by the system.
Read-only.
Value must be treated as opaque by clients and .
More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#concurrency-control-and-consistency
+optional |  |
| SelfLink | string| `string` |  | | Deprecated: selfLink is a legacy read-only field that is no longer populated by the system.
+optional |  |
| creationTimestamp | [Time](#time)| `Time` |  | |  |  |
| deletionTimestamp | [Time](#time)| `Time` |  | |  |  |
| spec | [VirtualService](#virtual-service)| `VirtualService` |  | |  |  |
| status | [IstioStatus](#istio-status)| `IstioStatus` |  | |  |  |
| uid | [UID](#uid)| `UID` |  | |  |  |



### <span id="w-e-info"></span> WEInfo


> WEInfo provides static information about a workload entry
associated with a workload node.
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Name | string| `string` | ✓ | | Name of the workload entry object |  |



### <span id="waypoint-edge"></span> WaypointEdge


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Direction | string| `string` |  | |  |  |
| fromEdge | [EdgeData](#edge-data)| `EdgeData` |  | |  |  |



### <span id="workload"></span> Workload


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
| IstioInjectionAnnotation | boolean| `bool` |  | | Define if Workload has an explicit Istio policy annotation
Istio supports this as a label as well - this will be defined if the label is set, too.
If both annotation and label are set, if any is false, injection is disabled.
It's mapped as a pointer to show three values nil, true, false |  |
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
| TemplateAnnotations | map of string| `map[string]string` |  | | TemplateAnnotations are the annotations on the pod template if the workload
has a pod template. |  |
| TemplateLabels | map of string| `map[string]string` |  | | TemplateLabels are the labels on the pod template if the workload
has a pod template. |  |
| ValidationKey | string| `string` |  | | ValidationKey is a pre-calculated key string: "cluster:namespace:name" |  |
| ValidationVersion | string| `string` |  | | ValidationVersion is a pre-calculated string representing the workload "version", basically
the workload information that, if changed, requires re-validation. |  |
| VersionLabel | boolean| `bool` | ✓ | | Define if Pods related to this Workload has the label Version | `true` |
| WaypointServices | [][ServiceReferenceInfo](#service-reference-info)| `[]*ServiceReferenceInfo` |  | | Ambient waypoint services |  |
| WaypointWorkloads | [][WorkloadReferenceInfo](#workload-reference-info)| `[]*WorkloadReferenceInfo` |  | | Ambient waypoint workloads |  |
| additionalDetailSample | [AdditionalItem](#additional-item)| `AdditionalItem` |  | |  |  |
| gvk | [GroupVersionKind](#group-version-kind)| `GroupVersionKind` | ✓ | |  |  |
| health | [WorkloadHealth](#workload-health)| `WorkloadHealth` |  | |  |  |
| pods | [Pods](#pods)| `Pods` |  | |  |  |
| validations | [IstioValidations](#istio-validations)| `IstioValidations` |  | |  |  |
| workloadEntries | [WorkloadEntries](#workload-entries)| `WorkloadEntries` |  | |  |  |



### <span id="workload-entries"></span> WorkloadEntries


  

[][WorkloadEntry](#workload-entry)

### <span id="workload-entry"></span> WorkloadEntry


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



### <span id="workload-health"></span> WorkloadHealth


> WorkloadHealth contains aggregated health from various sources, for a given workload
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| requests | [RequestHealth](#request-health)| `RequestHealth` |  | |  |  |
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
| workloadGVK | [GroupVersionKind](#group-version-kind)| `GroupVersionKind` | ✓ | |  |  |



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
| IstioInjectionAnnotation | boolean| `bool` |  | | Define if Workload has an explicit Istio policy annotation
Istio supports this as a label as well - this will be defined if the label is set, too.
If both annotation and label are set, if any is false, injection is disabled.
It's mapped as a pointer to show three values nil, true, false |  |
| IstioReferences | [][IstioValidationKey](#istio-validation-key)| `[]*IstioValidationKey` |  | | Istio References |  |
| IstioSidecar | boolean| `bool` | ✓ | | Define if Pods related to this Workload has an IstioSidecar deployed | `true` |
| Labels | map of string| `map[string]string` |  | | Workload labels |  |
| Name | string| `string` | ✓ | | Name of the workload | `reviews-v1` |
| Namespace | string| `string` |  | | Namespace of the workload |  |
| PodCount | int64 (formatted integer)| `int64` | ✓ | | Number of current workload pods | `1` |
| ResourceVersion | string| `string` | ✓ | | Kubernetes ResourceVersion | `192892127` |
| ServiceAccountNames | []string| `[]string` |  | | Names of the workload service accounts |  |
| TemplateAnnotations | map of string| `map[string]string` |  | | TemplateAnnotations are the annotations on the pod template if the workload
has a pod template. |  |
| TemplateLabels | map of string| `map[string]string` |  | | TemplateLabels are the labels on the pod template if the workload
has a pod template. |  |
| ValidationKey | string| `string` |  | | ValidationKey is a pre-calculated key string: "cluster:namespace:name" |  |
| ValidationVersion | string| `string` |  | | ValidationVersion is a pre-calculated string representing the workload "version", basically
the workload information that, if changed, requires re-validation. |  |
| VersionLabel | boolean| `bool` | ✓ | | Define if Pods related to this Workload has the label Version | `true` |
| WaypointWorkloads | []string| `[]string` |  | | Names of the waypoint proxy workloads, if any |  |
| additionalDetailSample | [AdditionalItem](#additional-item)| `AdditionalItem` |  | |  |  |
| gvk | [GroupVersionKind](#group-version-kind)| `GroupVersionKind` | ✓ | |  |  |
| health | [WorkloadHealth](#workload-health)| `WorkloadHealth` |  | |  |  |



### <span id="workload-overviews"></span> WorkloadOverviews


  

[][WorkloadListItem](#workload-list-item)

### <span id="workload-reference-info"></span> WorkloadReferenceInfo


> Used, for example, to link services to Ambient waypoint proxies
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Cluster | string| `string` |  | | Cluster |  |
| LabelType | string| `string` |  | | LabelType in case of waypoint workloads,
Where the label comes from (namespace, workload or service) | `namespace` |
| Labels | map of string| `map[string]string` |  | | Workload labels |  |
| Name | string| `string` | ✓ | | Name for the workload |  |
| Namespace | string| `string` | ✓ | | Namespace where the workload live in | `bookinfo` |
| Type | string| `string` |  | | In case of waypoints it can be service/workload | `workload/service` |



### <span id="workload-status"></span> WorkloadStatus


> WorkloadStatus gives
number of desired replicas defined in the Spec of a controller
number of current replicas that matches selector of a controller
number of available replicas for a given workload
In healthy scenarios all variables should point same value.
When something wrong happens the different values can indicate an unhealthy situation.
i.e.
desired = 1, current = 10, available = 0 would means that a user scaled down a workload from 10 to 1
but in the operaton 10 pods showed problems, so no pod is available/ready but user will see 10 pods under a workload
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| AvailableReplicas | int32 (formatted integer)| `int32` |  | |  |  |
| CurrentReplicas | int32 (formatted integer)| `int32` |  | |  |  |
| DesiredReplicas | int32 (formatted integer)| `int32` |  | |  |  |
| Name | string| `string` |  | |  |  |
| SyncedProxies | int32 (formatted integer)| `int32` |  | |  |  |


