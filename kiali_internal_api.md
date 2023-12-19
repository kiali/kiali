


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
| GET | /api/namespaces/{namespace}/apps | [app list](#app-list) |  |
| GET | /api/namespaces/{namespace}/apps/{app}/metrics | [app metrics](#app-metrics) |  |
  


###  auth

| Method  | URI     | Name   | Summary |
|---------|---------|--------|---------|
| GET | /api/authenticate | [authenticate](#authenticate) |  |
| GET | /api/auth/info | [authentication info](#authentication-info) |  |
| GET | /api/logout | [logout](#logout) |  |
| GET | /api/auth/openid_redirect | [openid redirect](#openid-redirect) |  |
| POST | /api/authenticate | [openshift check token](#openshift-check-token) |  |
  


###  certs

| Method  | URI     | Name   | Summary |
|---------|---------|--------|---------|
| GET | /api/istio/certs | [istio certs](#istio-certs) |  |
  


###  config

| Method  | URI     | Name   | Summary |
|---------|---------|--------|---------|
| GET | /api/istio/permissions | [get permissions](#get-permissions) |  |
| POST | /api/namespaces/{namespace}/istio/{object_type} | [istio config create](#istio-config-create) |  |
| DELETE | /api/namespaces/{namespace}/istio/{object_type}/{object} | [istio config delete](#istio-config-delete) |  |
| GET | /api/namespaces/{namespace}/istio/{object_type}/{object} | [istio config details](#istio-config-details) |  |
| GET | /api/namespaces/{namespace}/istio | [istio config list](#istio-config-list) |  |
| GET | /api/istio | [istio config list all](#istio-config-list-all) |  |
| PATCH | /api/namespaces/{namespace}/istio/{object_type}/{object} | [istio config update](#istio-config-update) | Endpoint to update the Istio Config of an Istio object used for templates and adapters using Json Merge Patch strategy. |
  


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
| GET | /api/jaeger | [jaeger info](#jaeger-info) |  |
  


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
| GET | /api/namespaces/{namespace}/health | [namespace health](#namespace-health) |  |
| GET | /api/namespaces | [namespace list](#namespace-list) |  |
| GET | /api/namespaces/{namespace}/metrics | [namespace metrics](#namespace-metrics) |  |
| PATCH | /api/namespaces/{namespace} | [namespace update](#namespace-update) | Endpoint to update the Namespace configuration using Json Merge Patch strategy. |
| GET | /api/namespaces/{namespace}/validations | [namespace validations](#namespace-validations) |  |
| GET | /api/istio/validations | [namespaces validations](#namespaces-validations) |  |
  


###  pods

| Method  | URI     | Name   | Summary |
|---------|---------|--------|---------|
| GET | /api/namespaces/{namespace}/pods/{pod} | [pod details](#pod-details) |  |
| GET | /api/namespaces/{namespace}/pods/{pod}/logs | [pod logs](#pod-logs) |  |
| GET | /api/namespaces/{namespace}/pods/{pod}/config_dump | [pod proxy dump](#pod-proxy-dump) |  |
| POST | /api/namespaces/{namespace}/pods/{pod}/logging | [pod proxy logging](#pod-proxy-logging) |  |
| GET | /api/namespaces/{namespace}/pods/{pod}/config_dump/{resource} | [pod proxy resource](#pod-proxy-resource) |  |
  


###  services

| Method  | URI     | Name   | Summary |
|---------|---------|--------|---------|
| GET | /api/namespaces/{namespace}/services/{service}/dashboard | [service dashboard](#service-dashboard) |  |
| GET | /api/namespaces/{namespace}/services/{service} | [service details](#service-details) |  |
| GET | /api/namespaces/{namespace}/services | [service list](#service-list) |  |
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
| GET | /api/namespaces/{namespace}/workloads | [workload list](#workload-list) |  |
| GET | /api/namespaces/{namespace}/workloads/{workload}/metrics | [workload metrics](#workload-metrics) |  |
| PATCH | /api/namespaces/{namespace}/workloads/{workload} | [workload update](#workload-update) | Endpoint to update the Workload configuration using Json Merge Patch strategy. |
  


## Paths

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
| version | `query` | string | `string` |  |  |  | Filters metrics by the specified version. |

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
GET /api/namespaces/{namespace}/apps
```

Endpoint to get the list of apps for a namespace

#### URI Schemes
  * http
  * https

#### Produces
  * application/json

#### Parameters

| Name | Source | Type | Go type | Separator | Required | Default | Description |
|------|--------|------|---------|-----------| :------: |---------|-------------|
| namespace | `path` | string | `string` |  | ✓ |  | The namespace name. |
| QueryTime | `query` | date-time (formatted string) | `strfmt.DateTime` |  |  |  | The time to use for the prometheus query |
| app | `query` | string | `string` |  |  |  |  |
| health | `query` | boolean | `bool` |  |  |  | Optional |
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
| version | `query` | string | `string` |  |  |  | Filters metrics by the specified version. |

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

Endpoint to get Jaeger spans for a given app

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
   
  

[][JaegerSpan](#jaeger-span)

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
| [200](#graph-aggregate-200) | OK | HTTP status code 200 and cytoscapejs Config in data |  | [schema](#graph-aggregate-200-schema) |
| [400](#graph-aggregate-400) | Bad Request | BadRequestError: the client request is incorrect |  | [schema](#graph-aggregate-400-schema) |
| [500](#graph-aggregate-500) | Internal Server Error | A Internal is the error message that means something has gone wrong |  | [schema](#graph-aggregate-500-schema) |

#### Responses


##### <span id="graph-aggregate-200"></span> 200 - HTTP status code 200 and cytoscapejs Config in data
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
| [200](#graph-aggregate-by-service-200) | OK | HTTP status code 200 and cytoscapejs Config in data |  | [schema](#graph-aggregate-by-service-200-schema) |
| [400](#graph-aggregate-by-service-400) | Bad Request | BadRequestError: the client request is incorrect |  | [schema](#graph-aggregate-by-service-400-schema) |
| [500](#graph-aggregate-by-service-500) | Internal Server Error | A Internal is the error message that means something has gone wrong |  | [schema](#graph-aggregate-by-service-500-schema) |

#### Responses


##### <span id="graph-aggregate-by-service-200"></span> 200 - HTTP status code 200 and cytoscapejs Config in data
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
| graphType | `query` | string | `string` |  | ✓ |  | Graph type. Available graph types: [app, versionedApp]. |
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
| [200](#graph-app-200) | OK | HTTP status code 200 and cytoscapejs Config in data |  | [schema](#graph-app-200-schema) |
| [400](#graph-app-400) | Bad Request | BadRequestError: the client request is incorrect |  | [schema](#graph-app-400-schema) |
| [500](#graph-app-500) | Internal Server Error | A Internal is the error message that means something has gone wrong |  | [schema](#graph-app-500-schema) |

#### Responses


##### <span id="graph-app-200"></span> 200 - HTTP status code 200 and cytoscapejs Config in data
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
| graphType | `query` | string | `string` |  | ✓ |  | Graph type. Available graph types: [app, versionedApp]. |
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
| [200](#graph-app-version-200) | OK | HTTP status code 200 and cytoscapejs Config in data |  | [schema](#graph-app-version-200-schema) |
| [400](#graph-app-version-400) | Bad Request | BadRequestError: the client request is incorrect |  | [schema](#graph-app-version-400-schema) |
| [500](#graph-app-version-500) | Internal Server Error | A Internal is the error message that means something has gone wrong |  | [schema](#graph-app-version-500-schema) |

#### Responses


##### <span id="graph-app-version-200"></span> 200 - HTTP status code 200 and cytoscapejs Config in data
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
| [200](#graph-namespaces-200) | OK | HTTP status code 200 and cytoscapejs Config in data |  | [schema](#graph-namespaces-200-schema) |
| [400](#graph-namespaces-400) | Bad Request | BadRequestError: the client request is incorrect |  | [schema](#graph-namespaces-400-schema) |
| [500](#graph-namespaces-500) | Internal Server Error | A Internal is the error message that means something has gone wrong |  | [schema](#graph-namespaces-500-schema) |

#### Responses


##### <span id="graph-namespaces-200"></span> 200 - HTTP status code 200 and cytoscapejs Config in data
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
| [200](#graph-service-200) | OK | HTTP status code 200 and cytoscapejs Config in data |  | [schema](#graph-service-200-schema) |
| [400](#graph-service-400) | Bad Request | BadRequestError: the client request is incorrect |  | [schema](#graph-service-400-schema) |
| [500](#graph-service-500) | Internal Server Error | A Internal is the error message that means something has gone wrong |  | [schema](#graph-service-500-schema) |

#### Responses


##### <span id="graph-service-200"></span> 200 - HTTP status code 200 and cytoscapejs Config in data
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
| [200](#graph-workload-200) | OK | HTTP status code 200 and cytoscapejs Config in data |  | [schema](#graph-workload-200-schema) |
| [400](#graph-workload-400) | Bad Request | BadRequestError: the client request is incorrect |  | [schema](#graph-workload-400-schema) |
| [500](#graph-workload-500) | Internal Server Error | A Internal is the error message that means something has gone wrong |  | [schema](#graph-workload-500-schema) |

#### Responses


##### <span id="graph-workload-200"></span> 200 - HTTP status code 200 and cytoscapejs Config in data
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



### <span id="istio-certs"></span> istio certs (*istioCerts*)

```
GET /api/istio/certs
```

Get certificates (internal) information used by Istio

#### URI Schemes
  * http
  * https

#### Produces
  * application/json

#### All responses
| Code | Status | Description | Has headers | Schema |
|------|--------|-------------|:-----------:|--------|
| [200](#istio-certs-200) | OK | Return a list of certificates information |  | [schema](#istio-certs-200-schema) |
| [500](#istio-certs-500) | Internal Server Error | A Internal is the error message that means something has gone wrong |  | [schema](#istio-certs-500-schema) |

#### Responses


##### <span id="istio-certs-200"></span> 200 - Return a list of certificates information
Status: OK

###### <span id="istio-certs-200-schema"></span> Schema
   
  

[][CertInfo](#cert-info)

##### <span id="istio-certs-500"></span> 500 - A Internal is the error message that means something has gone wrong
Status: Internal Server Error

###### <span id="istio-certs-500-schema"></span> Schema
   
  

[IstioCertsInternalServerErrorBody](#istio-certs-internal-server-error-body)

###### Inlined models

**<span id="istio-certs-internal-server-error-body"></span> IstioCertsInternalServerErrorBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `500`| HTTP status code | `500` |
| Message | string| `string` |  | |  |  |



### <span id="istio-config-create"></span> istio config create (*istioConfigCreate*)

```
POST /api/namespaces/{namespace}/istio/{object_type}
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
| namespace | `path` | string | `string` |  | ✓ |  | The namespace name. |
| object_type | `path` | string | `string` |  | ✓ |  | The Istio object type. |

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
DELETE /api/namespaces/{namespace}/istio/{object_type}/{object}
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
| namespace | `path` | string | `string` |  | ✓ |  | The namespace name. |
| object | `path` | string | `string` |  | ✓ |  | The Istio object name. |
| object_type | `path` | string | `string` |  | ✓ |  | The Istio object type. |

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
GET /api/namespaces/{namespace}/istio/{object_type}/{object}
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
| namespace | `path` | string | `string` |  | ✓ |  | The namespace name. |
| object | `path` | string | `string` |  | ✓ |  | The Istio object name. |
| object_type | `path` | string | `string` |  | ✓ |  | The Istio object type. |
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
PATCH /api/namespaces/{namespace}/istio/{object_type}/{object}
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
| object | `path` | string | `string` |  | ✓ |  | The Istio object name. |
| object_type | `path` | string | `string` |  | ✓ |  | The Istio object type. |

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



### <span id="jaeger-info"></span> jaeger info (*jaegerInfo*)

```
GET /api/jaeger
```

Get the jaeger URL and other descriptors

#### URI Schemes
  * http
  * https

#### Produces
  * application/json

#### All responses
| Code | Status | Description | Has headers | Schema |
|------|--------|-------------|:-----------:|--------|
| [200](#jaeger-info-200) | OK | Return all the descriptor data related to Jaeger |  | [schema](#jaeger-info-200-schema) |
| [404](#jaeger-info-404) | Not Found | A NotFoundError is the error message that is generated when server could not find what was requested. |  | [schema](#jaeger-info-404-schema) |
| [406](#jaeger-info-406) | Not Acceptable | A NotAcceptable is the error message that means request can't be accepted |  | [schema](#jaeger-info-406-schema) |

#### Responses


##### <span id="jaeger-info-200"></span> 200 - Return all the descriptor data related to Jaeger
Status: OK

###### <span id="jaeger-info-200-schema"></span> Schema
   
  

[TracingInfo](#jaeger-info)

##### <span id="jaeger-info-404"></span> 404 - A NotFoundError is the error message that is generated when server could not find what was requested.
Status: Not Found

###### <span id="jaeger-info-404-schema"></span> Schema
   
  

[JaegerInfoNotFoundBody](#jaeger-info-not-found-body)

##### <span id="jaeger-info-406"></span> 406 - A NotAcceptable is the error message that means request can't be accepted
Status: Not Acceptable

###### <span id="jaeger-info-406-schema"></span> Schema
   
  

[JaegerInfoNotAcceptableBody](#jaeger-info-not-acceptable-body)

###### Inlined models

**<span id="jaeger-info-not-acceptable-body"></span> JaegerInfoNotAcceptableBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `404`| HTTP status code | `404` |
| Message | string| `string` |  | |  |  |



**<span id="jaeger-info-not-found-body"></span> JaegerInfoNotFoundBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `404`| HTTP status code | `404` |
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



### <span id="namespace-health"></span> namespace health (*namespaceHealth*)

```
GET /api/namespaces/{namespace}/health
```

Get health for all objects in the given namespace

#### URI Schemes
  * http
  * https

#### Produces
  * application/json

#### Parameters

| Name | Source | Type | Go type | Separator | Required | Default | Description |
|------|--------|------|---------|-----------| :------: |---------|-------------|
| namespace | `path` | string | `string` |  | ✓ |  | The namespace scope |
| QueryTime | `query` | date-time (formatted string) | `strfmt.DateTime` |  |  |  | The time to use for the prometheus query |
| rateInterval | `query` | string | `string` |  |  | `"10m"` | The rate interval used for fetching error rate |
| type | `query` | string | `string` |  |  | `"app"` | The type of health, "app", "service" or "workload". |

#### All responses
| Code | Status | Description | Has headers | Schema |
|------|--------|-------------|:-----------:|--------|
| [200](#namespace-health-200) | OK | namespaceAppHealthResponse is a map of app name x health |  | [schema](#namespace-health-200-schema) |
| [400](#namespace-health-400) | Bad Request | BadRequestError: the client request is incorrect |  | [schema](#namespace-health-400-schema) |
| [500](#namespace-health-500) | Internal Server Error | A Internal is the error message that means something has gone wrong |  | [schema](#namespace-health-500-schema) |

#### Responses


##### <span id="namespace-health-200"></span> 200 - namespaceAppHealthResponse is a map of app name x health
Status: OK

###### <span id="namespace-health-200-schema"></span> Schema
   
  

[NamespaceAppHealth](#namespace-app-health)

##### <span id="namespace-health-400"></span> 400 - BadRequestError: the client request is incorrect
Status: Bad Request

###### <span id="namespace-health-400-schema"></span> Schema
   
  

[NamespaceHealthBadRequestBody](#namespace-health-bad-request-body)

##### <span id="namespace-health-500"></span> 500 - A Internal is the error message that means something has gone wrong
Status: Internal Server Error

###### <span id="namespace-health-500-schema"></span> Schema
   
  

[NamespaceHealthInternalServerErrorBody](#namespace-health-internal-server-error-body)

###### Inlined models

**<span id="namespace-health-bad-request-body"></span> NamespaceHealthBadRequestBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `400`| HTTP status code | `400` |
| Message | string| `string` |  | |  |  |



**<span id="namespace-health-internal-server-error-body"></span> NamespaceHealthInternalServerErrorBody**


  



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
| level | `query` | string | `string` |  | ✓ |  | The log level for the pod's proxy.
off ProxyLogLevelOff
trace ProxyLogLevelTrace
debug ProxyLogLevelDebug
info ProxyLogLevelInfo
warning ProxyLogLevelWarning
error ProxyLogLevelError
critical ProxyLogLevelCritical |

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
   
  

any

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
GET /api/namespaces/{namespace}/services
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
| QueryTime | `query` | date-time (formatted string) | `strfmt.DateTime` |  |  |  | The time to use for the prometheus query |
| health | `query` | boolean | `bool` |  |  |  | Optional |
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
| version | `query` | string | `string` |  |  |  | Filters metrics by the specified version. |

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

Endpoint to get Jaeger spans for a given service

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
   
  

[][JaegerSpan](#jaeger-span)

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
GET /api/namespaces/{namespace}/workloads
```

Endpoint to get the list of workloads for a namespace

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
| version | `query` | string | `string` |  |  |  | Filters metrics by the specified version. |

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

Endpoint to get Jaeger spans for a given workload

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
   
  

[][JaegerSpan](#jaeger-span)

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



### <span id="address-type"></span> AddressType


> A predefined CamelCase string identifier (currently limited to `IPAddress` or `Hostname`)
A domain-prefixed string identifier (like `acme.io/CustomAddressType`)

Values `IPAddress` and `Hostname` have Extended support.

The `NamedAddress` value has been deprecated in favor of implementation
specific domain-prefixed strings.

All other values, including domain-prefixed values have Custom support, which
are used in implementation-specific behaviors. Support for additional
predefined CamelCase identifiers may be added in future releases.

+kubebuilder:validation:MinLength=1
+kubebuilder:validation:MaxLength=253
+kubebuilder:validation:Pattern=`^Hostname|IPAddress|NamedAddress|[a-z0-9]([-a-z0-9]*[a-z0-9])?(\.[a-z0-9]([-a-z0-9]*[a-z0-9])?)*\/[A-Za-z0-9\/\-._~%!$&'()*+,;=:]+$`
  



| Name | Type | Go type | Default | Description | Example |
|------|------|---------| ------- |-------------|---------|
| AddressType | string| string | | A predefined CamelCase string identifier (currently limited to `IPAddress` or `Hostname`)
A domain-prefixed string identifier (like `acme.io/CustomAddressType`)

Values `IPAddress` and `Hostname` have Extended support.

The `NamedAddress` value has been deprecated in favor of implementation
specific domain-prefixed strings.

All other values, including domain-prefixed values have Custom support, which
are used in implementation-specific behaviors. Support for additional
predefined CamelCase identifiers may be added in future releases.

+kubebuilder:validation:MinLength=1
+kubebuilder:validation:MaxLength=253
+kubebuilder:validation:Pattern=`^Hostname|IPAddress|NamedAddress|[a-z0-9]([-a-z0-9]*[a-z0-9])?(\.[a-z0-9]([-a-z0-9]*[a-z0-9])?)*\/[A-Za-z0-9\/\-._~%!$&'()*+,;=:]+$` |  |



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
| namespace | [Namespace](#namespace)| `Namespace` | ✓ | |  |  |



### <span id="app-list-item"></span> AppListItem


> AppListItem has the necessary information to display the console app list
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| IstioReferences | [][IstioValidationKey](#istio-validation-key)| `[]*IstioValidationKey` |  | | Istio References |  |
| IstioSidecar | boolean| `bool` | ✓ | | Define if all Pods related to the Workloads of this app has an IstioSidecar deployed | `true` |
| Labels | map of string| `map[string]string` |  | | Labels for App |  |
| Name | string| `string` | ✓ | | Name of the application | `reviews` |
| health | [AppHealth](#app-health)| `AppHealth` |  | |  |  |



### <span id="authorization-policy"></span> AuthorizationPolicy


> <!-- crd generation tags
+cue-gen:AuthorizationPolicy:groupName:security.istio.io
+cue-gen:AuthorizationPolicy:version:v1beta1
+cue-gen:AuthorizationPolicy:storageVersion
+cue-gen:AuthorizationPolicy:annotations:helm.sh/resource-policy=keep
+cue-gen:AuthorizationPolicy:labels:app=istio-pilot,chart=istio,istio=security,heritage=Tiller,release=istio
+cue-gen:AuthorizationPolicy:subresource:status
+cue-gen:AuthorizationPolicy:scope:Namespaced
+cue-gen:AuthorizationPolicy:resource:categories=istio-io,security-istio-io,plural=authorizationpolicies
+cue-gen:AuthorizationPolicy:preserveUnknownFields:false
>

<!-- go code generation tags
+kubetype-gen
+kubetype-gen:groupVersion=security.istio.io/v1beta1
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
More info: http://kubernetes.io/docs/user-guide/annotations
+optional |  |
| CreationTimestamp | string| `string` |  | | CreationTimestamp is a timestamp representing the server time when this object was
created. It is not guaranteed to be set in happens-before order across separate operations.
Clients may not set this value. It is represented in RFC3339 form and is in UTC.

Populated by the system.
Read-only.
Null for lists.
More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
+optional |  |
| DeletionGracePeriodSeconds | int64 (formatted integer)| `int64` |  | | Number of seconds allowed for this object to gracefully terminate before
it will be removed from the system. Only set when deletionTimestamp is also set.
May only be shortened.
Read-only.
+optional |  |
| DeletionTimestamp | string| `string` |  | | DeletionTimestamp is RFC 3339 date and time at which this resource will be deleted. This
field is set by the server when a graceful deletion is requested by the user, and is not
directly settable by a client. The resource is expected to be deleted (no longer visible
from resource lists, and not reachable by name) after the time in this field, once the
finalizers list is empty. As long as the finalizers list contains items, deletion is blocked.
Once the deletionTimestamp is set, this value may not be unset or be set further into the
future, although it may be shortened or the resource may be deleted prior to this time.
For example, a user may request that a pod is deleted in 30 seconds. The Kubelet will react
by sending a graceful termination signal to the containers in the pod. After that 30 seconds,
the Kubelet will send a hard termination signal (SIGKILL) to the container and after cleanup,
remove the pod from the API. In the presence of network partitions, this object may still
exist after this timestamp, until an administrator or automated process can determine the
resource is fully terminated.
If not set, graceful deletion of the object has not been requested.

Populated by the system when a graceful deletion is requested.
Read-only.
More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
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
+patchStrategy=merge |  |
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
More info: http://kubernetes.io/docs/user-guide/labels
+optional |  |
| ManagedFields | [][ManagedFieldsEntry](#managed-fields-entry)| `[]*ManagedFieldsEntry` |  | | ManagedFields maps workflow-id and version to the set of fields
that are managed by that workflow. This is mostly for internal
housekeeping, and users typically shouldn't need to set or
understand this field. A workflow can be the user's name, a
controller's name, or the name of a specific apply path like
"ci-cd". The set of fields is always in the version that the
workflow used when modifying the object.

+optional |  |
| Name | string| `string` |  | | Name must be unique within a namespace. Is required when creating resources, although
some resources may allow a client to request the generation of an appropriate name
automatically. Name is primarily intended for creation idempotence and configuration
definition.
Cannot be updated.
More info: http://kubernetes.io/docs/user-guide/identifiers#names
+optional |  |
| Namespace | string| `string` |  | | Namespace defines the space within which each name must be unique. An empty namespace is
equivalent to the "default" namespace, but "default" is the canonical representation.
Not all objects are required to be scoped to a namespace - the value of this field for
those objects will be empty.

Must be a DNS_LABEL.
Cannot be updated.
More info: http://kubernetes.io/docs/user-guide/namespaces
+optional |  |
| OwnerReferences | [][OwnerReference](#owner-reference)| `[]*OwnerReference` |  | | List of objects depended by this object. If ALL objects in the list have
been deleted, this object will be garbage collected. If this object is managed by a controller,
then an entry in this list will point to this controller, with the controller field set to true.
There cannot be more than one managing controller.
+optional
+patchMergeKey=uid
+patchStrategy=merge |  |
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
| ZZZ_DeprecatedClusterName | string| `string` |  | | Deprecated: ClusterName is a legacy field that was always cleared by
the system and never used; it will be removed completely in 1.25.

The name in the go struct is changed to help clients detect
accidental use.

+optional |  |
| spec | [AuthorizationPolicy](#authorization-policy)| `AuthorizationPolicy` |  | |  |  |
| status | [IstioStatus](#istio-status)| `IstioStatus` |  | |  |  |
| uid | [UID](#uid)| `UID` |  | |  |  |



### <span id="backend-object-reference"></span> BackendObjectReference


> Note that when a namespace is specified, a ReferenceGrant object
is required in the referent namespace to allow that namespace's
owner to accept the reference. See the ReferenceGrant documentation
for details.

The API object must be valid in the cluster; the Group and Kind must
be registered in the cluster for this reference to be valid.

References to objects with invalid Group and Kind are not valid, and must
be rejected by the implementation, with appropriate Conditions set
on the containing object.
  





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
| Bootstrap | [interface{}](#interface)| `interface{}` |  | |  |  |



### <span id="cert-info"></span> CertInfo


> CertInfo contains the information for a given certificate
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Accessible | boolean| `bool` |  | |  |  |
| DNSNames | []string| `[]string` |  | |  |  |
| Error | string| `string` |  | |  |  |
| Issuer | string| `string` |  | |  |  |
| NotAfter | date-time (formatted string)| `strfmt.DateTime` |  | |  |  |
| NotBefore | date-time (formatted string)| `strfmt.DateTime` |  | |  |  |
| SecretName | string| `string` |  | |  |  |
| SecretNamespace | string| `string` |  | |  |  |



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
| LastTransitionTime | string| `string` |  | | lastTransitionTime is the last time the condition transitioned from one status to another.
This should be when the underlying condition changed.  If that is not known, then using the time when the API field changed is acceptable.
+required
+kubebuilder:validation:Required
+kubebuilder:validation:Type=string
+kubebuilder:validation:Format=date-time |  |
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
| IsProxy | boolean| `bool` |  | |  |  |
| IsReady | boolean| `bool` |  | |  |  |
| Name | string| `string` |  | |  |  |



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
+cue-gen:DestinationRule:version:v1beta1
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
+kubetype-gen:groupVersion=networking.istio.io/v1beta1
+genclient
+k8s:deepcopy-gen=true
>
<!-- istio code generation tags
+istio.io/sync-from:networking/v1alpha3/destination_rule.proto
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
More info: http://kubernetes.io/docs/user-guide/annotations
+optional |  |
| CreationTimestamp | string| `string` |  | | CreationTimestamp is a timestamp representing the server time when this object was
created. It is not guaranteed to be set in happens-before order across separate operations.
Clients may not set this value. It is represented in RFC3339 form and is in UTC.

Populated by the system.
Read-only.
Null for lists.
More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
+optional |  |
| DeletionGracePeriodSeconds | int64 (formatted integer)| `int64` |  | | Number of seconds allowed for this object to gracefully terminate before
it will be removed from the system. Only set when deletionTimestamp is also set.
May only be shortened.
Read-only.
+optional |  |
| DeletionTimestamp | string| `string` |  | | DeletionTimestamp is RFC 3339 date and time at which this resource will be deleted. This
field is set by the server when a graceful deletion is requested by the user, and is not
directly settable by a client. The resource is expected to be deleted (no longer visible
from resource lists, and not reachable by name) after the time in this field, once the
finalizers list is empty. As long as the finalizers list contains items, deletion is blocked.
Once the deletionTimestamp is set, this value may not be unset or be set further into the
future, although it may be shortened or the resource may be deleted prior to this time.
For example, a user may request that a pod is deleted in 30 seconds. The Kubelet will react
by sending a graceful termination signal to the containers in the pod. After that 30 seconds,
the Kubelet will send a hard termination signal (SIGKILL) to the container and after cleanup,
remove the pod from the API. In the presence of network partitions, this object may still
exist after this timestamp, until an administrator or automated process can determine the
resource is fully terminated.
If not set, graceful deletion of the object has not been requested.

Populated by the system when a graceful deletion is requested.
Read-only.
More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
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
+patchStrategy=merge |  |
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
More info: http://kubernetes.io/docs/user-guide/labels
+optional |  |
| ManagedFields | [][ManagedFieldsEntry](#managed-fields-entry)| `[]*ManagedFieldsEntry` |  | | ManagedFields maps workflow-id and version to the set of fields
that are managed by that workflow. This is mostly for internal
housekeeping, and users typically shouldn't need to set or
understand this field. A workflow can be the user's name, a
controller's name, or the name of a specific apply path like
"ci-cd". The set of fields is always in the version that the
workflow used when modifying the object.

+optional |  |
| Name | string| `string` |  | | Name must be unique within a namespace. Is required when creating resources, although
some resources may allow a client to request the generation of an appropriate name
automatically. Name is primarily intended for creation idempotence and configuration
definition.
Cannot be updated.
More info: http://kubernetes.io/docs/user-guide/identifiers#names
+optional |  |
| Namespace | string| `string` |  | | Namespace defines the space within which each name must be unique. An empty namespace is
equivalent to the "default" namespace, but "default" is the canonical representation.
Not all objects are required to be scoped to a namespace - the value of this field for
those objects will be empty.

Must be a DNS_LABEL.
Cannot be updated.
More info: http://kubernetes.io/docs/user-guide/namespaces
+optional |  |
| OwnerReferences | [][OwnerReference](#owner-reference)| `[]*OwnerReference` |  | | List of objects depended by this object. If ALL objects in the list have
been deleted, this object will be garbage collected. If this object is managed by a controller,
then an entry in this list will point to this controller, with the controller field set to true.
There cannot be more than one managing controller.
+optional
+patchMergeKey=uid
+patchStrategy=merge |  |
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
| ZZZ_DeprecatedClusterName | string| `string` |  | | Deprecated: ClusterName is a legacy field that was always cleared by
the system and never used; it will be removed completely in 1.25.

The name in the go struct is changed to help clients detect
accidental use.

+optional |  |
| spec | [DestinationRule](#destination-rule)| `DestinationRule` |  | |  |  |
| status | [IstioStatus](#istio-status)| `IstioStatus` |  | |  |  |
| uid | [UID](#uid)| `UID` |  | |  |  |



### <span id="edge-data"></span> EdgeData


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| DestPrincipal | string| `string` |  | | App Fields (not required by Cytoscape) |  |
| ID | string| `string` |  | | Cytoscape Fields |  |
| IsMTLS | string| `string` |  | |  |  |
| ResponseTime | string| `string` |  | |  |  |
| Source | string| `string` |  | |  |  |
| SourcePrincipal | string| `string` |  | |  |  |
| Target | string| `string` |  | |  |  |
| Throughput | string| `string` |  | |  |  |
| traffic | [ProtocolTraffic](#protocol-traffic)| `ProtocolTraffic` |  | |  |  |



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

### <span id="envoy-filter"></span> EnvoyFilter


> <!-- crd generation tags
+cue-gen:EnvoyFilter:groupName:networking.istio.io
+cue-gen:EnvoyFilter:version:v1alpha3
+cue-gen:EnvoyFilter:storageVersion
+cue-gen:EnvoyFilter:annotations:helm.sh/resource-policy=keep
+cue-gen:EnvoyFilter:labels:app=istio-pilot,chart=istio,heritage=Tiller,release=istio
+cue-gen:EnvoyFilter:subresource:status
+cue-gen:EnvoyFilter:scope:Namespaced
+cue-gen:EnvoyFilter:resource:categories=istio-io,networking-istio-io
+cue-gen:EnvoyFilter:preserveUnknownFields:configPatches.[].patch.value
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
More info: http://kubernetes.io/docs/user-guide/annotations
+optional |  |
| CreationTimestamp | string| `string` |  | | CreationTimestamp is a timestamp representing the server time when this object was
created. It is not guaranteed to be set in happens-before order across separate operations.
Clients may not set this value. It is represented in RFC3339 form and is in UTC.

Populated by the system.
Read-only.
Null for lists.
More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
+optional |  |
| DeletionGracePeriodSeconds | int64 (formatted integer)| `int64` |  | | Number of seconds allowed for this object to gracefully terminate before
it will be removed from the system. Only set when deletionTimestamp is also set.
May only be shortened.
Read-only.
+optional |  |
| DeletionTimestamp | string| `string` |  | | DeletionTimestamp is RFC 3339 date and time at which this resource will be deleted. This
field is set by the server when a graceful deletion is requested by the user, and is not
directly settable by a client. The resource is expected to be deleted (no longer visible
from resource lists, and not reachable by name) after the time in this field, once the
finalizers list is empty. As long as the finalizers list contains items, deletion is blocked.
Once the deletionTimestamp is set, this value may not be unset or be set further into the
future, although it may be shortened or the resource may be deleted prior to this time.
For example, a user may request that a pod is deleted in 30 seconds. The Kubelet will react
by sending a graceful termination signal to the containers in the pod. After that 30 seconds,
the Kubelet will send a hard termination signal (SIGKILL) to the container and after cleanup,
remove the pod from the API. In the presence of network partitions, this object may still
exist after this timestamp, until an administrator or automated process can determine the
resource is fully terminated.
If not set, graceful deletion of the object has not been requested.

Populated by the system when a graceful deletion is requested.
Read-only.
More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
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
+patchStrategy=merge |  |
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
More info: http://kubernetes.io/docs/user-guide/labels
+optional |  |
| ManagedFields | [][ManagedFieldsEntry](#managed-fields-entry)| `[]*ManagedFieldsEntry` |  | | ManagedFields maps workflow-id and version to the set of fields
that are managed by that workflow. This is mostly for internal
housekeeping, and users typically shouldn't need to set or
understand this field. A workflow can be the user's name, a
controller's name, or the name of a specific apply path like
"ci-cd". The set of fields is always in the version that the
workflow used when modifying the object.

+optional |  |
| Name | string| `string` |  | | Name must be unique within a namespace. Is required when creating resources, although
some resources may allow a client to request the generation of an appropriate name
automatically. Name is primarily intended for creation idempotence and configuration
definition.
Cannot be updated.
More info: http://kubernetes.io/docs/user-guide/identifiers#names
+optional |  |
| Namespace | string| `string` |  | | Namespace defines the space within which each name must be unique. An empty namespace is
equivalent to the "default" namespace, but "default" is the canonical representation.
Not all objects are required to be scoped to a namespace - the value of this field for
those objects will be empty.

Must be a DNS_LABEL.
Cannot be updated.
More info: http://kubernetes.io/docs/user-guide/namespaces
+optional |  |
| OwnerReferences | [][OwnerReference](#owner-reference)| `[]*OwnerReference` |  | | List of objects depended by this object. If ALL objects in the list have
been deleted, this object will be garbage collected. If this object is managed by a controller,
then an entry in this list will point to this controller, with the controller field set to true.
There cannot be more than one managing controller.
+optional
+patchMergeKey=uid
+patchStrategy=merge |  |
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
| ZZZ_DeprecatedClusterName | string| `string` |  | | Deprecated: ClusterName is a legacy field that was always cleared by
the system and never used; it will be removed completely in 1.25.

The name in the go struct is changed to help clients detect
accidental use.

+optional |  |
| spec | [EnvoyFilter](#envoy-filter)| `EnvoyFilter` |  | |  |  |
| status | [IstioStatus](#istio-status)| `IstioStatus` |  | |  |  |
| uid | [UID](#uid)| `UID` |  | |  |  |



### <span id="envoy-proxy-dump"></span> EnvoyProxyDump


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| bootstrap | [Bootstrap](#bootstrap)| `Bootstrap` |  | |  |  |
| clusters | [Clusters](#clusters)| `Clusters` |  | |  |  |
| config_dump | [ConfigDump](#config-dump)| `ConfigDump` |  | |  |  |
| listeners | [Listeners](#listeners)| `Listeners` |  | |  |  |
| routes | [Routes](#routes)| `Routes` |  | |  |  |



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



### <span id="gateway"></span> Gateway


> Gateway represents an instance of a service-traffic handling infrastructure
by binding Listeners to a set of IP addresses.
  





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
More info: http://kubernetes.io/docs/user-guide/annotations
+optional |  |
| CreationTimestamp | string| `string` |  | | CreationTimestamp is a timestamp representing the server time when this object was
created. It is not guaranteed to be set in happens-before order across separate operations.
Clients may not set this value. It is represented in RFC3339 form and is in UTC.

Populated by the system.
Read-only.
Null for lists.
More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
+optional |  |
| DeletionGracePeriodSeconds | int64 (formatted integer)| `int64` |  | | Number of seconds allowed for this object to gracefully terminate before
it will be removed from the system. Only set when deletionTimestamp is also set.
May only be shortened.
Read-only.
+optional |  |
| DeletionTimestamp | string| `string` |  | | DeletionTimestamp is RFC 3339 date and time at which this resource will be deleted. This
field is set by the server when a graceful deletion is requested by the user, and is not
directly settable by a client. The resource is expected to be deleted (no longer visible
from resource lists, and not reachable by name) after the time in this field, once the
finalizers list is empty. As long as the finalizers list contains items, deletion is blocked.
Once the deletionTimestamp is set, this value may not be unset or be set further into the
future, although it may be shortened or the resource may be deleted prior to this time.
For example, a user may request that a pod is deleted in 30 seconds. The Kubelet will react
by sending a graceful termination signal to the containers in the pod. After that 30 seconds,
the Kubelet will send a hard termination signal (SIGKILL) to the container and after cleanup,
remove the pod from the API. In the presence of network partitions, this object may still
exist after this timestamp, until an administrator or automated process can determine the
resource is fully terminated.
If not set, graceful deletion of the object has not been requested.

Populated by the system when a graceful deletion is requested.
Read-only.
More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
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
+patchStrategy=merge |  |
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
More info: http://kubernetes.io/docs/user-guide/labels
+optional |  |
| ManagedFields | [][ManagedFieldsEntry](#managed-fields-entry)| `[]*ManagedFieldsEntry` |  | | ManagedFields maps workflow-id and version to the set of fields
that are managed by that workflow. This is mostly for internal
housekeeping, and users typically shouldn't need to set or
understand this field. A workflow can be the user's name, a
controller's name, or the name of a specific apply path like
"ci-cd". The set of fields is always in the version that the
workflow used when modifying the object.

+optional |  |
| Name | string| `string` |  | | Name must be unique within a namespace. Is required when creating resources, although
some resources may allow a client to request the generation of an appropriate name
automatically. Name is primarily intended for creation idempotence and configuration
definition.
Cannot be updated.
More info: http://kubernetes.io/docs/user-guide/identifiers#names
+optional |  |
| Namespace | string| `string` |  | | Namespace defines the space within which each name must be unique. An empty namespace is
equivalent to the "default" namespace, but "default" is the canonical representation.
Not all objects are required to be scoped to a namespace - the value of this field for
those objects will be empty.

Must be a DNS_LABEL.
Cannot be updated.
More info: http://kubernetes.io/docs/user-guide/namespaces
+optional |  |
| OwnerReferences | [][OwnerReference](#owner-reference)| `[]*OwnerReference` |  | | List of objects depended by this object. If ALL objects in the list have
been deleted, this object will be garbage collected. If this object is managed by a controller,
then an entry in this list will point to this controller, with the controller field set to true.
There cannot be more than one managing controller.
+optional
+patchMergeKey=uid
+patchStrategy=merge |  |
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
| ZZZ_DeprecatedClusterName | string| `string` |  | | Deprecated: ClusterName is a legacy field that was always cleared by
the system and never used; it will be removed completely in 1.25.

The name in the go struct is changed to help clients detect
accidental use.

+optional |  |
| spec | [GatewaySpec](#gateway-spec)| `GatewaySpec` |  | |  |  |
| status | [GatewayStatus](#gateway-status)| `GatewayStatus` |  | |  |  |
| uid | [UID](#uid)| `UID` |  | |  |  |



### <span id="gateway-address"></span> GatewayAddress


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Value | string| `string` |  | | Value of the address. The validity of the values will depend
on the type and support by the controller.

Examples: `1.2.3.4`, `128::1`, `my-ip-address`.

+kubebuilder:validation:MinLength=1
+kubebuilder:validation:MaxLength=253 |  |
| type | [AddressType](#address-type)| `AddressType` |  | |  |  |



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



### <span id="gateway-spec"></span> GatewaySpec


> Not all possible combinations of options specified in the Spec are
valid. Some invalid configurations can be caught synchronously via a
webhook, but there are many cases that will require asynchronous
signaling via the GatewayStatus block.
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Addresses | [][GatewayAddress](#gateway-address)| `[]*GatewayAddress` |  | | Addresses requested for this Gateway. This is optional and behavior can
depend on the implementation. If a value is set in the spec and the
requested address is invalid or unavailable, the implementation MUST
indicate this in the associated entry in GatewayStatus.Addresses.

The Addresses field represents a request for the address(es) on the
"outside of the Gateway", that traffic bound for this Gateway will use.
This could be the IP address or hostname of an external load balancer or
other networking infrastructure, or some other address that traffic will
be sent to.

The .listener.hostname field is used to route traffic that has already
arrived at the Gateway to the correct in-cluster destination.

If no Addresses are specified, the implementation MAY schedule the
Gateway in an implementation-specific manner, assigning an appropriate
set of Addresses.

The implementation MUST bind all Listeners to every GatewayAddress that
it assigns to the Gateway and add a corresponding entry in
GatewayStatus.Addresses.

Support: Extended

+optional
+kubebuilder:validation:MaxItems=16 |  |
| Listeners | [][Listener](#listener)| `[]*Listener` |  | | Listeners associated with this Gateway. Listeners define
logical endpoints that are bound on this Gateway's addresses.
At least one Listener MUST be specified.

Each listener in a Gateway must have a unique combination of Hostname,
Port, and Protocol.

An implementation MAY group Listeners by Port and then collapse each
group of Listeners into a single Listener if the implementation
determines that the Listeners in the group are "compatible". An
implementation MAY also group together and collapse compatible
Listeners belonging to different Gateways.

For example, an implementation might consider Listeners to be
compatible with each other if all of the following conditions are
met:

1. Either each Listener within the group specifies the "HTTP"
Protocol or each Listener within the group specifies either
the "HTTPS" or "TLS" Protocol.

2. Each Listener within the group specifies a Hostname that is unique
within the group.

3. As a special case, one Listener within a group may omit Hostname,
in which case this Listener matches when no other Listener
matches.

If the implementation does collapse compatible Listeners, the
hostname provided in the incoming client request MUST be
matched to a Listener to find the correct set of Routes.
The incoming hostname MUST be matched using the Hostname
field for each Listener in order of most to least specific.
That is, exact matches must be processed before wildcard
matches.

If this field specifies multiple Listeners that have the same
Port value but are not compatible, the implementation must raise
a "Conflicted" condition in the Listener status.

Support: Core

+listType=map
+listMapKey=name
+kubebuilder:validation:MinItems=1
+kubebuilder:validation:MaxItems=64 |  |
| gatewayClassName | [ObjectName](#object-name)| `ObjectName` |  | |  |  |



### <span id="gateway-status"></span> GatewayStatus


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Addresses | [][GatewayAddress](#gateway-address)| `[]*GatewayAddress` |  | | Addresses lists the IP addresses that have actually been
bound to the Gateway. These addresses may differ from the
addresses in the Spec, e.g. if the Gateway automatically
assigns an address from a reserved pool.

+optional
+kubebuilder:validation:MaxItems=16 |  |
| Conditions | [][Condition](#condition)| `[]*Condition` |  | | Conditions describe the current conditions of the Gateway.

Implementations should prefer to express Gateway conditions
using the `GatewayConditionType` and `GatewayConditionReason`
constants so that operators and tools can converge on a common
vocabulary to describe Gateway state.

Known condition types are:

"Scheduled"
"Ready"

+optional
+listType=map
+listMapKey=type
+kubebuilder:validation:MaxItems=8
+kubebuilder:default={{type: "Scheduled", status: "Unknown", reason:"NotReconciled", message:"Waiting for controller", lastTransitionTime: "1970-01-01T00:00:00Z"}} |  |
| Listeners | [][ListenerStatus](#listener-status)| `[]*ListenerStatus` |  | | Listeners provide status for each unique listener port defined in the Spec.

+optional
+listType=map
+listMapKey=name
+kubebuilder:validation:MaxItems=64 |  |



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
"networking.k8s.io"
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
"networking.k8s.io"
"foo.example.com"

Invalid values include:

"example.com/bar" - "/" is an invalid character

+kubebuilder:validation:MaxLength=253
+kubebuilder:validation:Pattern=`^$|^[a-z0-9]([-a-z0-9]*[a-z0-9])?(\.[a-z0-9]([-a-z0-9]*[a-z0-9])?)*$` |  |



### <span id="http-backend-ref"></span> HTTPBackendRef


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Filters | [][HTTPRouteFilter](#http-route-filter)| `[]*HTTPRouteFilter` |  | | Filters defined at this level should be executed if and only if the
request is being forwarded to the backend defined here.

Support: Custom (For broader support of filters, use the Filters field
in HTTPRouteRule.)

+optional
+kubebuilder:validation:MaxItems=16 |  |
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


> Valid values include:

"Authorization"
"Set-Cookie"

Invalid values include:

":method" - ":" is an invalid character. This means that HTTP/2 pseudo
headers are not currently supported by this type.
"/invalid" - "/" is an invalid character

+kubebuilder:validation:MinLength=1
+kubebuilder:validation:MaxLength=256
+kubebuilder:validation:Pattern=`^[A-Za-z0-9!#$%&'*+\-.^_\x60|~]+$`
  



| Name | Type | Go type | Default | Description | Example |
|------|------|---------| ------- |-------------|---------|
| HTTPHeaderName | string| string | | Valid values include:

"Authorization"
"Set-Cookie"

Invalid values include:

":method" - ":" is an invalid character. This means that HTTP/2 pseudo
headers are not currently supported by this type.
"/invalid" - "/" is an invalid character

+kubebuilder:validation:MinLength=1
+kubebuilder:validation:MaxLength=256
+kubebuilder:validation:Pattern=`^[A-Za-z0-9!#$%&'*+\-.^_\x60|~]+$` |  |



### <span id="http-method"></span> HTTPMethod


> Note that values may be added to this enum, implementations
must ensure that unknown values will not cause a crash.

Unknown values here must result in the implementation setting the
Attached Condition for the Route to `status: False`, with a
Reason of `UnsupportedValue`.

+kubebuilder:validation:Enum=GET;HEAD;POST;PUT;DELETE;CONNECT;OPTIONS;TRACE;PATCH
  



| Name | Type | Go type | Default | Description | Example |
|------|------|---------| ------- |-------------|---------|
| HTTPMethod | string| string | | Note that values may be added to this enum, implementations
must ensure that unknown values will not cause a crash.

Unknown values here must result in the implementation setting the
Attached Condition for the Route to `status: False`, with a
Reason of `UnsupportedValue`.

+kubebuilder:validation:Enum=GET;HEAD;POST;PUT;DELETE;CONNECT;OPTIONS;TRACE;PATCH |  |



### <span id="http-path-match"></span> HTTPPathMatch


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Value | string| `string` |  | | Value of the HTTP path to match against.

+optional
+kubebuilder:default="/"
+kubebuilder:validation:MaxLength=1024 |  |
| type | [PathMatchType](#path-match-type)| `PathMatchType` |  | |  |  |



### <span id="http-path-modifier"></span> HTTPPathModifier


> <gateway:experimental>
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| ReplaceFullPath | string| `string` |  | | ReplaceFullPath specifies the value with which to replace the full path
of a request during a rewrite or redirect.

<gateway:experimental>
+kubebuilder:validation:MaxLength=1024
+optional |  |
| ReplacePrefixMatch | string| `string` |  | | ReplacePrefixMatch specifies the value with which to replace the prefix
match of a request during a rewrite or redirect. For example, a request
to "/foo/bar" with a prefix match of "/foo" would be modified to "/bar".

Note that this matches the behavior of the PathPrefix match type. This
matches full path elements. A path element refers to the list of labels
in the path split by the `/` separator. When specified, a trailing `/` is
ignored. For example, the paths `/abc`, `/abc/`, and `/abc/def` would all
match the prefix `/abc`, but the path `/abcd` would not.

<gateway:experimental>
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
| Name | string| `string` |  | | Name is the name of the HTTP query param to be matched. This must be an
exact string match. (See
https://tools.ietf.org/html/rfc7230#section-2.7.3).

If multiple entries specify equivalent query param names, only the first
entry with an equivalent name MUST be considered for a match. Subsequent
entries with an equivalent query param name MUST be ignored.

+kubebuilder:validation:MinLength=1
+kubebuilder:validation:MaxLength=256 |  |
| Value | string| `string` |  | | Value is the value of HTTP query param to be matched.

+kubebuilder:validation:MinLength=1
+kubebuilder:validation:MaxLength=1024 |  |
| type | [QueryParamMatchType](#query-param-match-type)| `QueryParamMatchType` |  | |  |  |



### <span id="http-request-header-filter"></span> HTTPRequestHeaderFilter


> HTTPRequestHeaderFilter defines configuration for the RequestHeaderModifier
filter.
  





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
value: "bar"

Output:
GET /foo HTTP/1.1
my-header: foo
my-header: bar

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



### <span id="http-request-mirror-filter"></span> HTTPRequestMirrorFilter


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| backendRef | [BackendObjectReference](#backend-object-reference)| `BackendObjectReference` |  | |  |  |



### <span id="http-request-redirect-filter"></span> HTTPRequestRedirectFilter


> HTTPRequestRedirect defines a filter that redirects a request. This filter
MUST NOT be used on the same Route rule as a HTTPURLRewrite filter.
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Scheme | string| `string` |  | | Scheme is the scheme to be used in the value of the `Location`
header in the response.
When empty, the scheme of the request is used.

Support: Extended

Note that values may be added to this enum, implementations
must ensure that unknown values will not cause a crash.

Unknown values here must result in the implementation setting the
Attached Condition for the Route to `status: False`, with a
Reason of `UnsupportedValue`.

+optional
+kubebuilder:validation:Enum=http;https |  |
| StatusCode | int64 (formatted integer)| `int64` |  | | StatusCode is the HTTP status code to be used in response.

Support: Core

Note that values may be added to this enum, implementations
must ensure that unknown values will not cause a crash.

Unknown values here must result in the implementation setting the
Attached Condition for the Route to `status: False`, with a
Reason of `UnsupportedValue`.

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
More info: http://kubernetes.io/docs/user-guide/annotations
+optional |  |
| CreationTimestamp | string| `string` |  | | CreationTimestamp is a timestamp representing the server time when this object was
created. It is not guaranteed to be set in happens-before order across separate operations.
Clients may not set this value. It is represented in RFC3339 form and is in UTC.

Populated by the system.
Read-only.
Null for lists.
More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
+optional |  |
| DeletionGracePeriodSeconds | int64 (formatted integer)| `int64` |  | | Number of seconds allowed for this object to gracefully terminate before
it will be removed from the system. Only set when deletionTimestamp is also set.
May only be shortened.
Read-only.
+optional |  |
| DeletionTimestamp | string| `string` |  | | DeletionTimestamp is RFC 3339 date and time at which this resource will be deleted. This
field is set by the server when a graceful deletion is requested by the user, and is not
directly settable by a client. The resource is expected to be deleted (no longer visible
from resource lists, and not reachable by name) after the time in this field, once the
finalizers list is empty. As long as the finalizers list contains items, deletion is blocked.
Once the deletionTimestamp is set, this value may not be unset or be set further into the
future, although it may be shortened or the resource may be deleted prior to this time.
For example, a user may request that a pod is deleted in 30 seconds. The Kubelet will react
by sending a graceful termination signal to the containers in the pod. After that 30 seconds,
the Kubelet will send a hard termination signal (SIGKILL) to the container and after cleanup,
remove the pod from the API. In the presence of network partitions, this object may still
exist after this timestamp, until an administrator or automated process can determine the
resource is fully terminated.
If not set, graceful deletion of the object has not been requested.

Populated by the system when a graceful deletion is requested.
Read-only.
More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
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
+patchStrategy=merge |  |
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
More info: http://kubernetes.io/docs/user-guide/labels
+optional |  |
| ManagedFields | [][ManagedFieldsEntry](#managed-fields-entry)| `[]*ManagedFieldsEntry` |  | | ManagedFields maps workflow-id and version to the set of fields
that are managed by that workflow. This is mostly for internal
housekeeping, and users typically shouldn't need to set or
understand this field. A workflow can be the user's name, a
controller's name, or the name of a specific apply path like
"ci-cd". The set of fields is always in the version that the
workflow used when modifying the object.

+optional |  |
| Name | string| `string` |  | | Name must be unique within a namespace. Is required when creating resources, although
some resources may allow a client to request the generation of an appropriate name
automatically. Name is primarily intended for creation idempotence and configuration
definition.
Cannot be updated.
More info: http://kubernetes.io/docs/user-guide/identifiers#names
+optional |  |
| Namespace | string| `string` |  | | Namespace defines the space within which each name must be unique. An empty namespace is
equivalent to the "default" namespace, but "default" is the canonical representation.
Not all objects are required to be scoped to a namespace - the value of this field for
those objects will be empty.

Must be a DNS_LABEL.
Cannot be updated.
More info: http://kubernetes.io/docs/user-guide/namespaces
+optional |  |
| OwnerReferences | [][OwnerReference](#owner-reference)| `[]*OwnerReference` |  | | List of objects depended by this object. If ALL objects in the list have
been deleted, this object will be garbage collected. If this object is managed by a controller,
then an entry in this list will point to this controller, with the controller field set to true.
There cannot be more than one managing controller.
+optional
+patchMergeKey=uid
+patchStrategy=merge |  |
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
| ZZZ_DeprecatedClusterName | string| `string` |  | | Deprecated: ClusterName is a legacy field that was always cleared by
the system and never used; it will be removed completely in 1.25.

The name in the go struct is changed to help clients detect
accidental use.

+optional |  |
| spec | [HTTPRouteSpec](#http-route-spec)| `HTTPRouteSpec` |  | |  |  |
| status | [HTTPRouteStatus](#http-route-status)| `HTTPRouteStatus` |  | |  |  |
| uid | [UID](#uid)| `UID` |  | |  |  |



### <span id="http-route-filter"></span> HTTPRouteFilter


> HTTPRouteFilter defines processing steps that must be completed during the
request or response lifecycle. HTTPRouteFilters are meant as an extension
point to express processing that may be done in Gateway implementations. Some
examples include request or response modification, implementing
authentication strategies, rate-limiting, and traffic shaping. API
guarantee/conformance is defined based on the type of the filter.
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| extensionRef | [LocalObjectReference](#local-object-reference)| `LocalObjectReference` |  | |  |  |
| requestHeaderModifier | [HTTPRequestHeaderFilter](#http-request-header-filter)| `HTTPRequestHeaderFilter` |  | |  |  |
| requestMirror | [HTTPRequestMirrorFilter](#http-request-mirror-filter)| `HTTPRequestMirrorFilter` |  | |  |  |
| requestRedirect | [HTTPRequestRedirectFilter](#http-request-redirect-filter)| `HTTPRequestRedirectFilter` |  | |  |  |
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

+listType=map
+listMapKey=name
+optional
+kubebuilder:validation:MaxItems=16 |  |
| method | [HTTPMethod](#http-method)| `HTTPMethod` |  | |  |  |
| path | [HTTPPathMatch](#http-path-match)| `HTTPPathMatch` |  | |  |  |



### <span id="http-route-rule"></span> HTTPRouteRule


> HTTPRouteRule defines semantics for matching an HTTP request based on
conditions (matches), processing it (filters), and forwarding the request to
an API object (backendRefs).
  





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

Support: Core for Kubernetes Service

Support: Custom for any other resource

Support for weight: Core

+optional
+kubebuilder:validation:MaxItems=16 |  |
| Filters | [][HTTPRouteFilter](#http-route-filter)| `[]*HTTPRouteFilter` |  | | Filters define the filters that are applied to requests that match
this rule.

The effects of ordering of multiple behaviors are currently unspecified.
This can change in the future based on feedback during the alpha stage.

Conformance-levels at this level are defined based on the type of filter:

ALL core filters MUST be supported by all implementations.
Implementers are encouraged to support extended filters.
Implementation-specific custom filters have no API guarantees across
implementations.

Specifying a core filter multiple times has unspecified or custom
conformance.

All filters are expected to be compatible with each other except for the
URLRewrite and RequestRedirect filters, which may not be combined. If an
implementation can not support other combinations of filters, they must clearly
document that limitation. In all cases where incompatible or unsupported
filters are specified, implementations MUST add a warning condition to status.

Support: Core

+optional
+kubebuilder:validation:MaxItems=16 |  |
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
MUST prioritize rules based on the following criteria, continuing on
ties. Precedence must be given to the Rule with the largest number
of:

Characters in a matching non-wildcard hostname.
Characters in a matching hostname.
Characters in a matching path.
Header matches.
Query param matches.

If ties still exist across multiple Routes, matching precedence MUST be
determined in order of the following criteria, continuing on ties:

The oldest Route based on creation timestamp.
The Route appearing first in alphabetical order by
"{namespace}/{name}".

If ties still exist within the Route that has been given precedence,
matching precedence MUST be granted to the first matching rule meeting
the above criteria.

When no rules matching a request have been successfully attached to the
parent a request is coming from, a HTTP 404 status code MUST be returned.

+optional
+kubebuilder:validation:MaxItems=8
+kubebuilder:default={{path:{ type: "PathPrefix", value: "/"}}} |  |



### <span id="http-route-spec"></span> HTTPRouteSpec


> HTTPRouteSpec defines the desired state of HTTPRoute
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Hostnames | [][Hostname](#hostname)| `[]Hostname` |  | | Hostnames defines a set of hostname that should match against the HTTP
Host header to select a HTTPRoute to process the request. This matches
the RFC 1123 definition of a hostname with 2 notable exceptions:

1. IPs are not allowed.
2. A hostname may be prefixed with a wildcard label (`*.`). The wildcard
label must appear by itself as the first label.

If a hostname is specified by both the Listener and HTTPRoute, there
must be at least one intersecting hostname for the HTTPRoute to be |  |
| ParentRefs | [][ParentReference](#parent-reference)| `[]*ParentReference` |  | | ParentRefs references the resources (usually Gateways) that a Route wants
to be attached to. Note that the referenced parent resource needs to
allow this for the attachment to be complete. For Gateways, that means
the Gateway needs to allow attachment from Routes of this kind and
namespace.

The only kind of parent resource with "Core" support is Gateway. This API
may be extended in the future to support additional kinds of parent
resources such as one of the route kinds.

It is invalid to reference an identical parent more than once. It is
valid to reference multiple distinct sections within the same parent
resource, such as 2 Listeners within a Gateway.

It is possible to separately reference multiple distinct objects that may
be collapsed by an implementation. For example, some implementations may
choose to merge compatible Gateway Listeners together. If that is the
case, the list of routes attached to those resources should also be
merged.

+optional
+kubebuilder:validation:MaxItems=32 |  |
| Rules | [][HTTPRouteRule](#http-route-rule)| `[]*HTTPRouteRule` |  | | Rules are a list of HTTP matchers, filters and actions.

+optional
+kubebuilder:validation:MaxItems=16
+kubebuilder:default={{matches: {{path: {type: "PathPrefix", value: "/"}}}}} |  |



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



### <span id="http-url-rewrite-filter"></span> HTTPURLRewriteFilter


> Support: Extended

<gateway:experimental>
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| hostname | [PreciseHostname](#precise-hostname)| `PreciseHostname` |  | |  |  |
| path | [HTTPPathModifier](#http-path-modifier)| `HTTPPathModifier` |  | |  |  |



### <span id="header-match-type"></span> HeaderMatchType


> "Exact"
"RegularExpression"

Note that values may be added to this enum, implementations
must ensure that unknown values will not cause a crash.

Unknown values here must result in the implementation setting the
Attached Condition for the Route to `status: False`, with a
Reason of `UnsupportedValue`.

+kubebuilder:validation:Enum=Exact;RegularExpression
  



| Name | Type | Go type | Default | Description | Example |
|------|------|---------| ------- |-------------|---------|
| HeaderMatchType | string| string | | "Exact"
"RegularExpression"

Note that values may be added to this enum, implementations
must ensure that unknown values will not cause a crash.

Unknown values here must result in the implementation setting the
Attached Condition for the Route to `status: False`, with a
Reason of `UnsupportedValue`.

+kubebuilder:validation:Enum=Exact;RegularExpression |  |



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



### <span id="istio-check"></span> IstioCheck


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | string| `string` | ✓ | | The check code used to identify a check | `KIA0001` |
| Message | string| `string` | ✓ | | Description of the check | `Weight sum should be 100` |
| Path | string| `string` |  | | String that describes where in the yaml file is the check located | `spec/http[0]/route` |
| severity | [SeverityLevel](#severity-level)| `SeverityLevel` | ✓ | |  |  |



### <span id="istio-component-status"></span> IstioComponentStatus


  

[][ComponentStatus](#component-status)

### <span id="istio-condition"></span> IstioCondition


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Message | string| `string` |  | | Human-readable message indicating details about last transition.
+optional |  |
| Reason | string| `string` |  | | Unique, one-word, CamelCase reason for the condition's last transition.
+optional |  |
| Status | string| `string` |  | | Status is the status of the condition.
Can be True, False, Unknown. |  |
| Type | string| `string` |  | | Type is the type of the condition. |  |
| last_probe_time | [Timestamp](#timestamp)| `Timestamp` |  | |  |  |
| last_transition_time | [Timestamp](#timestamp)| `Timestamp` |  | |  |  |



### <span id="istio-config-details"></span> IstioConfigDetails


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| IstioConfigHelpFields | [][IstioConfigHelp](#istio-config-help)| `[]*IstioConfigHelp` |  | |  |  |
| ObjectType | string| `string` |  | |  |  |
| authorizationPolicy | [AuthorizationPolicy](#authorization-policy)| `AuthorizationPolicy` |  | |  |  |
| destinationRule | [DestinationRule](#destination-rule)| `DestinationRule` |  | |  |  |
| envoyFilter | [EnvoyFilter](#envoy-filter)| `EnvoyFilter` |  | |  |  |
| gateway | [Gateway](#gateway)| `Gateway` |  | |  |  |
| k8sGateway | [Gateway](#gateway)| `Gateway` |  | |  |  |
| k8sHTTPRoute | [HTTPRoute](#http-route)| `HTTPRoute` |  | |  |  |
| namespace | [Namespace](#namespace)| `Namespace` |  | |  |  |
| peerAuthentication | [PeerAuthentication](#peer-authentication)| `PeerAuthentication` |  | |  |  |
| permissions | [ResourcePermissions](#resource-permissions)| `ResourcePermissions` |  | |  |  |
| references | [IstioReferences](#istio-references)| `IstioReferences` |  | |  |  |
| requestAuthentication | [RequestAuthentication](#request-authentication)| `RequestAuthentication` |  | |  |  |
| serviceEntry | [ServiceEntry](#service-entry)| `ServiceEntry` |  | |  |  |
| sidecar | [Sidecar](#sidecar)| `Sidecar` |  | |  |  |
| telemetry | [Telemetry](#telemetry)| `Telemetry` |  | |  |  |
| validation | [IstioValidation](#istio-validation)| `IstioValidation` |  | |  |  |
| virtualService | [VirtualService](#virtual-service)| `VirtualService` |  | |  |  |
| wasmPlugin | [WasmPlugin](#wasm-plugin)| `WasmPlugin` |  | |  |  |
| workloadEntry | [WorkloadEntry](#workload-entry)| `WorkloadEntry` |  | |  |  |
| workloadGroup | [WorkloadGroup](#workload-group)| `WorkloadGroup` |  | |  |  |



### <span id="istio-config-help"></span> IstioConfigHelp


> IstioConfigHelp represents a help message for a given Istio object type and field
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Message | string| `string` |  | |  |  |
| ObjectField | string| `string` |  | |  |  |



### <span id="istio-config-list"></span> IstioConfigList


> IstioConfigList istioConfigList
This type is used for returning a response of IstioConfigList
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| AuthorizationPolicies | [][AuthorizationPolicy](#authorization-policy)| `[]*AuthorizationPolicy` |  | |  |  |
| DestinationRules | [][DestinationRule](#destination-rule)| `[]*DestinationRule` |  | |  |  |
| EnvoyFilters | [][EnvoyFilter](#envoy-filter)| `[]*EnvoyFilter` |  | |  |  |
| Gateways | [][Gateway](#gateway)| `[]*Gateway` |  | |  |  |
| K8sGateways | [][Gateway](#gateway)| `[]*Gateway` |  | |  |  |
| K8sHTTPRoutes | [][HTTPRoute](#http-route)| `[]*HTTPRoute` |  | |  |  |
| K8sReferenceGrants | [][ReferenceGrant](#reference-grant)| `[]*ReferenceGrant` |  | |  |  |
| PeerAuthentications | [][PeerAuthentication](#peer-authentication)| `[]*PeerAuthentication` |  | |  |  |
| RequestAuthentications | [][RequestAuthentication](#request-authentication)| `[]*RequestAuthentication` |  | |  |  |
| ServiceEntries | [][ServiceEntry](#service-entry)| `[]*ServiceEntry` |  | |  |  |
| Sidecars | [][Sidecar](#sidecar)| `[]*Sidecar` |  | |  |  |
| Telemetries | [][Telemetry](#telemetry)| `[]*Telemetry` |  | |  |  |
| VirtualServices | [][VirtualService](#virtual-service)| `[]*VirtualService` |  | |  |  |
| WasmPlugins | [][WasmPlugin](#wasm-plugin)| `[]*WasmPlugin` |  | |  |  |
| WorkloadEntries | [][WorkloadEntry](#workload-entry)| `[]*WorkloadEntry` |  | |  |  |
| WorkloadGroups | [][WorkloadGroup](#workload-group)| `[]*WorkloadGroup` |  | |  |  |
| namespace | [Namespace](#namespace)| `Namespace` | ✓ | |  |  |
| validations | [IstioValidations](#istio-validations)| `IstioValidations` |  | |  |  |



### <span id="istio-config-permissions"></span> IstioConfigPermissions


> IstioConfigPermissions holds a map of ResourcesPermissions per namespace
  



[IstioConfigPermissions](#istio-config-permissions)

### <span id="istio-environment"></span> IstioEnvironment


> IstioEnvironment describes the Istio implementation environment
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| IstioAPIEnabled | boolean| `bool` |  | | Is api enabled |  |



### <span id="istio-reference"></span> IstioReference


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Name | string| `string` |  | |  |  |
| Namespace | string| `string` |  | |  |  |
| ObjectType | string| `string` |  | |  |  |



### <span id="istio-references"></span> IstioReferences


> IstioReferences represents a sets of different references
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| ObjectReferences | [][IstioReference](#istio-reference)| `[]*IstioReference` |  | | Related Istio objects |  |
| ServiceReferences | [][ServiceReference](#service-reference)| `[]*ServiceReference` |  | | Related Istio objects |  |
| WorkloadReferences | [][WorkloadReference](#workload-reference)| `[]*WorkloadReference` |  | | Related Istio objects |  |



### <span id="istio-status"></span> IstioStatus


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Conditions | [][IstioCondition](#istio-condition)| `[]*IstioCondition` |  | | Current service state of pod.
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



### <span id="istio-validation"></span> IstioValidation


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Checks | [][IstioCheck](#istio-check)| `[]*IstioCheck` |  | | Array of checks. It might be empty. |  |
| Name | string| `string` | ✓ | | Name of the object itself | `reviews` |
| ObjectType | string| `string` | ✓ | | Type of the object | `virtualservice` |
| References | [][IstioValidationKey](#istio-validation-key)| `[]*IstioValidationKey` |  | | Related objects (only validation errors) |  |
| Valid | boolean| `bool` | ✓ | | Represents validity of the object: in case of warning, validity remains as true | `false` |



### <span id="istio-validation-key"></span> IstioValidationKey


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Name | string| `string` |  | |  |  |
| Namespace | string| `string` |  | |  |  |
| ObjectType | string| `string` |  | |  |  |



### <span id="istio-validation-summary"></span> IstioValidationSummary


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Errors | int64 (formatted integer)| `int64` | ✓ | | Number of validations with error severity | `2` |
| ObjectCount | int64 (formatted integer)| `int64` | ✓ | | Number of Istio Objects analyzed | `6` |
| Warnings | int64 (formatted integer)| `int64` | ✓ | | Number of validations with warning severity | `4` |



### <span id="istio-validations"></span> IstioValidations


  

[interface{}](#interface)

### <span id="jaeger-info"></span> TracingInfo


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Enabled | boolean| `bool` |  | |  |  |
| Integration | boolean| `bool` |  | |  |  |
| NamespaceSelector | boolean| `bool` |  | |  |  |
| URL | string| `string` |  | |  |  |
| WhiteListIstioSystem | []string| `[]string` |  | |  |  |



### <span id="jaeger-span"></span> JaegerSpan


  



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



### <span id="key-value"></span> KeyValue


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Key | string| `string` |  | |  |  |
| Value | [interface{}](#interface)| `interface{}` |  | |  |  |
| type | [ValueType](#value-type)| `ValueType` |  | |  |  |



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



### <span id="listener"></span> Listener


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Address | string| `string` |  | |  |  |
| Destination | string| `string` |  | |  |  |
| Match | string| `string` |  | |  |  |
| Port | double (formatted number)| `float64` |  | |  |  |



### <span id="listener-status"></span> ListenerStatus


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| AttachedRoutes | int32 (formatted integer)| `int32` |  | | AttachedRoutes represents the total number of Routes that have been
successfully attached to this Listener. |  |
| Conditions | [][Condition](#condition)| `[]*Condition` |  | | Conditions describe the current condition of this listener.

+listType=map
+listMapKey=type
+kubebuilder:validation:MaxItems=8 |  |
| SupportedKinds | [][RouteGroupKind](#route-group-kind)| `[]*RouteGroupKind` |  | | SupportedKinds is the list indicating the Kinds supported by this
listener. This MUST represent the kinds an implementation supports for
that Listener configuration.

If kinds are specified in Spec that are not supported, they MUST NOT
appear in this list and an implementation MUST set the "ResolvedRefs"
condition to "False" with the "InvalidRouteKinds" reason. If both valid
and invalid Route kinds are specified, the implementation MUST
reference the valid Route kinds that have been specified.

+kubebuilder:validation:MaxItems=8 |  |
| name | [SectionName](#section-name)| `SectionName` |  | |  |  |



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
| MinTLS | string| `string` |  | |  |  |
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
| Time | string| `string` |  | | Time is the timestamp of when the ManagedFields entry was added. The
timestamp will also be updated if a field is added, the manager
changes any of the owned fields value or removes a field. The
timestamp does not update when a field is removed from the entry
because another manager took it over.
+optional |  |
| fieldsV1 | [FieldsV1](#fields-v1)| `FieldsV1` |  | |  |  |
| operation | [ManagedFieldsOperationType](#managed-fields-operation-type)| `ManagedFieldsOperationType` |  | |  |  |



### <span id="managed-fields-operation-type"></span> ManagedFieldsOperationType


  

| Name | Type | Go type | Default | Description | Example |
|------|------|---------| ------- |-------------|---------|
| ManagedFieldsOperationType | string| string | |  |  |



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
| Labels | map of string| `map[string]string` |  | | Labels for Namespace |  |
| Name | string| `string` | ✓ | | The id of the namespace. | `istio-system` |



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


> NamespaceAppHealth is an alias of map of app name x health
  



[NamespaceAppHealth](#namespace-app-health)

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
| HasMissingSC | boolean| `bool` |  | |  |  |
| HasRequestRouting | boolean| `bool` |  | |  |  |
| HasRequestTimeout | boolean| `bool` |  | |  |  |
| HasTCPTrafficShifting | boolean| `bool` |  | |  |  |
| HasTrafficShifting | boolean| `bool` |  | |  |  |
| HasWorkloadEntry | [][WEInfo](#w-e-info)| `[]*WEInfo` |  | |  |  |
| HealthData | [interface{}](#interface)| `interface{}` |  | |  |  |
| ID | string| `string` |  | | Cytoscape Fields |  |
| IsBox | string| `string` |  | |  |  |
| IsDead | boolean| `bool` |  | |  |  |
| IsIdle | boolean| `bool` |  | |  |  |
| IsInaccessible | boolean| `bool` |  | |  |  |
| IsOutside | boolean| `bool` |  | |  |  |
| IsRoot | boolean| `bool` |  | |  |  |
| Labels | map of string| `map[string]string` |  | |  |  |
| Namespace | string| `string` |  | |  |  |
| NodeType | string| `string` |  | | App Fields (not required by Cytoscape) |  |
| Parent | string| `string` |  | |  |  |
| Service | string| `string` |  | |  |  |
| Traffic | [][ProtocolTraffic](#protocol-traffic)| `[]*ProtocolTraffic` |  | |  |  |
| Version | string| `string` |  | |  |  |
| Workload | string| `string` |  | |  |  |
| hasHealthConfig | [HealthConfig](#health-config)| `HealthConfig` |  | |  |  |
| hasVS | [VSInfo](#v-s-info)| `VSInfo` |  | |  |  |
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
More info: http://kubernetes.io/docs/user-guide/identifiers#names |  |
| uid | [UID](#uid)| `UID` |  | |  |  |



### <span id="parent-reference"></span> ParentReference


> The API object must be valid in the cluster; the Group and Kind must
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


> "Exact"
"PathPrefix"
"RegularExpression"

PathPrefix and Exact paths must be syntactically valid:

Must begin with the `/` character
Must not contain consecutive `/` characters (e.g. `/foo///`, `//`).

Note that values may be added to this enum, implementations
must ensure that unknown values will not cause a crash.

Unknown values here must result in the implementation setting the
Attached Condition for the Route to `status: False`, with a
Reason of `UnsupportedValue`.

+kubebuilder:validation:Enum=Exact;PathPrefix;RegularExpression
  



| Name | Type | Go type | Default | Description | Example |
|------|------|---------| ------- |-------------|---------|
| PathMatchType | string| string | | "Exact"
"PathPrefix"
"RegularExpression"

PathPrefix and Exact paths must be syntactically valid:

Must begin with the `/` character
Must not contain consecutive `/` characters (e.g. `/foo///`, `//`).

Note that values may be added to this enum, implementations
must ensure that unknown values will not cause a crash.

Unknown values here must result in the implementation setting the
Attached Condition for the Route to `status: False`, with a
Reason of `UnsupportedValue`.

+kubebuilder:validation:Enum=Exact;PathPrefix;RegularExpression |  |



### <span id="peer-authentication"></span> PeerAuthentication


> Examples:

Policy to allow mTLS traffic for all workloads under namespace `foo`:
```yaml
apiVersion: security.istio.io/v1beta1
kind: PeerAuthentication
metadata:

name: default
namespace: foo

spec:

mtls:
mode: STRICT

```
For mesh level, put the policy in root-namespace according to your Istio installation.

Policies to allow both mTLS & plaintext traffic for all workloads under namespace `foo`, but
require mTLS for workload `finance`.
```yaml
apiVersion: security.istio.io/v1beta1
kind: PeerAuthentication
metadata:

name: default
namespace: foo

spec:

mtls:
mode: PERMISSIVE


apiVersion: security.istio.io/v1beta1
kind: PeerAuthentication
metadata:

name: default
namespace: foo

spec:

selector:
matchLabels:
app: finance
mtls:
mode: STRICT

```
Policy to allow mTLS strict for all workloads, but leave port 8080 to
plaintext:
```yaml
apiVersion: security.istio.io/v1beta1
kind: PeerAuthentication
metadata:

name: default
namespace: foo

spec:

selector:
matchLabels:
app: finance
mtls:
mode: STRICT
portLevelMtls:
8080:
mode: DISABLE

```
Policy to inherit mTLS mode from namespace (or mesh) settings, and overwrite
settings for port 8080
```yaml
apiVersion: security.istio.io/v1beta1
kind: PeerAuthentication
metadata:

name: default
namespace: foo

spec:

selector:
matchLabels:
app: finance
mtls:
mode: UNSET
portLevelMtls:
8080:
mode: DISABLE

```

<!-- crd generation tags
+cue-gen:PeerAuthentication:groupName:security.istio.io
+cue-gen:PeerAuthentication:version:v1beta1
+cue-gen:PeerAuthentication:storageVersion
+cue-gen:PeerAuthentication:annotations:helm.sh/resource-policy=keep
+cue-gen:PeerAuthentication:labels:app=istio-pilot,chart=istio,istio=security,heritage=Tiller,release=istio
+cue-gen:PeerAuthentication:subresource:status
+cue-gen:PeerAuthentication:scope:Namespaced
+cue-gen:PeerAuthentication:resource:categories=istio-io,security-istio-io,shortNames=pa
+cue-gen:PeerAuthentication:preserveUnknownFields:false
+cue-gen:PeerAuthentication:printerColumn:name=Mode,type=string,JSONPath=.spec.mtls.mode,description="Defines the mTLS mode used for peer authentication."
+cue-gen:PeerAuthentication:printerColumn:name=Age,type=date,JSONPath=.metadata.creationTimestamp,description="CreationTimestamp is a timestamp
representing the server time when this object was created. It is not guaranteed to be set in happens-before order across separate operations.
Clients may not set this value. It is represented in RFC3339 form and is in UTC.
Populated by the system. Read-only. Null for lists. More info: https://git.k8s.io/community/contributors/devel/api-conventions.md#metadata"
>

<!-- go code generation tags
+kubetype-gen
+kubetype-gen:groupVersion=security.istio.io/v1beta1
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
More info: http://kubernetes.io/docs/user-guide/annotations
+optional |  |
| CreationTimestamp | string| `string` |  | | CreationTimestamp is a timestamp representing the server time when this object was
created. It is not guaranteed to be set in happens-before order across separate operations.
Clients may not set this value. It is represented in RFC3339 form and is in UTC.

Populated by the system.
Read-only.
Null for lists.
More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
+optional |  |
| DeletionGracePeriodSeconds | int64 (formatted integer)| `int64` |  | | Number of seconds allowed for this object to gracefully terminate before
it will be removed from the system. Only set when deletionTimestamp is also set.
May only be shortened.
Read-only.
+optional |  |
| DeletionTimestamp | string| `string` |  | | DeletionTimestamp is RFC 3339 date and time at which this resource will be deleted. This
field is set by the server when a graceful deletion is requested by the user, and is not
directly settable by a client. The resource is expected to be deleted (no longer visible
from resource lists, and not reachable by name) after the time in this field, once the
finalizers list is empty. As long as the finalizers list contains items, deletion is blocked.
Once the deletionTimestamp is set, this value may not be unset or be set further into the
future, although it may be shortened or the resource may be deleted prior to this time.
For example, a user may request that a pod is deleted in 30 seconds. The Kubelet will react
by sending a graceful termination signal to the containers in the pod. After that 30 seconds,
the Kubelet will send a hard termination signal (SIGKILL) to the container and after cleanup,
remove the pod from the API. In the presence of network partitions, this object may still
exist after this timestamp, until an administrator or automated process can determine the
resource is fully terminated.
If not set, graceful deletion of the object has not been requested.

Populated by the system when a graceful deletion is requested.
Read-only.
More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
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
+patchStrategy=merge |  |
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
More info: http://kubernetes.io/docs/user-guide/labels
+optional |  |
| ManagedFields | [][ManagedFieldsEntry](#managed-fields-entry)| `[]*ManagedFieldsEntry` |  | | ManagedFields maps workflow-id and version to the set of fields
that are managed by that workflow. This is mostly for internal
housekeeping, and users typically shouldn't need to set or
understand this field. A workflow can be the user's name, a
controller's name, or the name of a specific apply path like
"ci-cd". The set of fields is always in the version that the
workflow used when modifying the object.

+optional |  |
| Name | string| `string` |  | | Name must be unique within a namespace. Is required when creating resources, although
some resources may allow a client to request the generation of an appropriate name
automatically. Name is primarily intended for creation idempotence and configuration
definition.
Cannot be updated.
More info: http://kubernetes.io/docs/user-guide/identifiers#names
+optional |  |
| Namespace | string| `string` |  | | Namespace defines the space within which each name must be unique. An empty namespace is
equivalent to the "default" namespace, but "default" is the canonical representation.
Not all objects are required to be scoped to a namespace - the value of this field for
those objects will be empty.

Must be a DNS_LABEL.
Cannot be updated.
More info: http://kubernetes.io/docs/user-guide/namespaces
+optional |  |
| OwnerReferences | [][OwnerReference](#owner-reference)| `[]*OwnerReference` |  | | List of objects depended by this object. If ALL objects in the list have
been deleted, this object will be garbage collected. If this object is managed by a controller,
then an entry in this list will point to this controller, with the controller field set to true.
There cannot be more than one managing controller.
+optional
+patchMergeKey=uid
+patchStrategy=merge |  |
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
| ZZZ_DeprecatedClusterName | string| `string` |  | | Deprecated: ClusterName is a legacy field that was always cleared by
the system and never used; it will be removed completely in 1.25.

The name in the go struct is changed to help clients detect
accidental use.

+optional |  |
| spec | [PeerAuthentication](#peer-authentication)| `PeerAuthentication` |  | |  |  |
| status | [IstioStatus](#istio-status)| `IstioStatus` |  | |  |  |
| uid | [UID](#uid)| `UID` |  | |  |  |



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
| IstioProtocol | string| `string` |  | |  |  |
| Name | string| `string` |  | |  |  |
| Port | int32 (formatted integer)| `int32` |  | |  |  |
| Protocol | string| `string` |  | |  |  |
| TLSMode | string| `string` |  | | TLSMode endpoint is injected with istio sidecar and ready to configure Istio mTLS
DisabledTLSModeLabel implies that this endpoint should receive traffic as is (mostly plaintext)
DisabledTLSModeLabel = "disabled"
IstioMutualTLSModeLabel implies that the endpoint is ready to receive Istio mTLS connections.
IstioMutualTLSModeLabel = "istio" |  |



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



### <span id="query-param-match-type"></span> QueryParamMatchType


> "Exact"
"RegularExpression"

Note that values may be added to this enum, implementations
must ensure that unknown values will not cause a crash.

Unknown values here must result in the implementation setting the
Attached Condition for the Route to `status: False`, with a
Reason of `UnsupportedValue`.

+kubebuilder:validation:Enum=Exact;RegularExpression
  



| Name | Type | Go type | Default | Description | Example |
|------|------|---------| ------- |-------------|---------|
| QueryParamMatchType | string| string | | "Exact"
"RegularExpression"

Note that values may be added to this enum, implementations
must ensure that unknown values will not cause a crash.

Unknown values here must result in the implementation setting the
Attached Condition for the Route to `status: False`, with a
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



### <span id="reference-type"></span> ReferenceType


> ReferenceType is the reference type of one span to another
  



| Name | Type | Go type | Default | Description | Example |
|------|------|---------| ------- |-------------|---------|
| ReferenceType | string| string | | ReferenceType is the reference type of one span to another |  |



### <span id="request-authentication"></span> RequestAuthentication


> Require JWT for all request for workloads that have label `app:httpbin`

```yaml
apiVersion: security.istio.io/v1beta1
kind: RequestAuthentication
metadata:

name: httpbin
namespace: foo

spec:

selector:
matchLabels:
app: httpbin
jwtRules:
issuer: "issuer-foo"
jwksUri: https://example.com/.well-known/jwks.json


apiVersion: security.istio.io/v1beta1
kind: AuthorizationPolicy
metadata:

name: httpbin
namespace: foo

spec:

selector:
matchLabels:
app: httpbin
rules:
from:
source:
requestPrincipals: ["*"]

```

A policy in the root namespace ("istio-system" by default) applies to workloads in all namespaces
in a mesh. The following policy makes all workloads only accept requests that contain a
valid JWT token.

```yaml
apiVersion: security.istio.io/v1beta1
kind: RequestAuthentication
metadata:

name: req-authn-for-all
namespace: istio-system

spec:

jwtRules:
issuer: "issuer-foo"
jwksUri: https://example.com/.well-known/jwks.json


apiVersion: security.istio.io/v1beta1
kind: AuthorizationPolicy
metadata:

name: require-jwt-for-all
namespace: istio-system

spec:

rules:
from:
source:
requestPrincipals: ["*"]

```

The next example shows how to set a different JWT requirement for a different `host`. The `RequestAuthentication`
declares it can accept JWTs issued by either `issuer-foo` or `issuer-bar` (the public key set is implicitly
set from the OpenID Connect spec).

```yaml
apiVersion: security.istio.io/v1beta1
kind: RequestAuthentication
metadata:

name: httpbin
namespace: foo

spec:

selector:
matchLabels:
app: httpbin
jwtRules:
issuer: "issuer-foo"
issuer: "issuer-bar"


apiVersion: security.istio.io/v1beta1
kind: AuthorizationPolicy
metadata:

name: httpbin
namespace: foo

spec:

selector:
matchLabels:
app: httpbin
rules:
from:
source:
requestPrincipals: ["issuer-foo/*"]
to:
operation:
hosts: ["example.com"]
from:
source:
requestPrincipals: ["issuer-bar/*"]
to:
operation:
hosts: ["another-host.com"]

```

You can fine tune the authorization policy to set different requirement per path. For example,
to require JWT on all paths, except /healthz, the same `RequestAuthentication` can be used, but the
authorization policy could be:

```yaml
apiVersion: security.istio.io/v1beta1
kind: AuthorizationPolicy
metadata:

name: httpbin
namespace: foo

spec:

selector:
matchLabels:
app: httpbin
rules:
from:
source:
requestPrincipals: ["*"]
to:
operation:
paths: ["/healthz"]

```

[Experimental] Routing based on derived [metadata](https://istio.io/latest/docs/reference/config/security/conditions/)
is now supported. A prefix '@' is used to denote a match against internal metadata instead of the headers in the request.
Currently this feature is only supported for the following metadata:

`request.auth.claims.{claim-name}[.{sub-claim}]*` which are extracted from validated JWT tokens. The claim name
currently does not support the `.` character. Examples: `request.auth.claims.sub` and `request.auth.claims.name.givenName`.

The use of matches against JWT claim metadata is only supported in Gateways. The following example shows:

RequestAuthentication to decode and validate a JWT. This also makes the `@request.auth.claims` available for use in the VirtualService.
AuthorizationPolicy to check for valid principals in the request. This makes the JWT required for the request.
VirtualService to route the request based on the "sub" claim.

```yaml
apiVersion: security.istio.io/v1beta1
kind: RequestAuthentication
metadata:

name: jwt-on-ingress
namespace: istio-system

spec:

selector:
matchLabels:
app: istio-ingressgateway
jwtRules:
issuer: "example.com"
jwksUri: https://example.com/.well-known/jwks.json


apiVersion: security.istio.io/v1beta1
kind: AuthorizationPolicy
metadata:

name: require-jwt
namespace: istio-system

spec:

selector:
matchLabels:
app: istio-ingressgateway
rules:
from:
source:
requestPrincipals: ["*"]


apiVersion: networking.istio.io/v1alpha3
kind: VirtualService
metadata:

name: route-jwt

spec:

hosts:
foo.prod.svc.cluster.local
gateways:
istio-ingressgateway
http:
name: "v2"
match:
headers:
"@request.auth.claims.sub":
exact: "dev"
route:
destination:
host: foo.prod.svc.cluster.local
subset: v2
name: "default"
route:
destination:
host: foo.prod.svc.cluster.local
subset: v1

```

<!-- crd generation tags
+cue-gen:RequestAuthentication:groupName:security.istio.io
+cue-gen:RequestAuthentication:version:v1beta1
+cue-gen:RequestAuthentication:storageVersion
+cue-gen:RequestAuthentication:annotations:helm.sh/resource-policy=keep
+cue-gen:RequestAuthentication:labels:app=istio-pilot,chart=istio,istio=security,heritage=Tiller,release=istio
+cue-gen:RequestAuthentication:subresource:status
+cue-gen:RequestAuthentication:scope:Namespaced
+cue-gen:RequestAuthentication:resource:categories=istio-io,security-istio-io,shortNames=ra
+cue-gen:RequestAuthentication:preserveUnknownFields:false
>

<!-- go code generation tags
+kubetype-gen
+kubetype-gen:groupVersion=security.istio.io/v1beta1
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
More info: http://kubernetes.io/docs/user-guide/annotations
+optional |  |
| CreationTimestamp | string| `string` |  | | CreationTimestamp is a timestamp representing the server time when this object was
created. It is not guaranteed to be set in happens-before order across separate operations.
Clients may not set this value. It is represented in RFC3339 form and is in UTC.

Populated by the system.
Read-only.
Null for lists.
More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
+optional |  |
| DeletionGracePeriodSeconds | int64 (formatted integer)| `int64` |  | | Number of seconds allowed for this object to gracefully terminate before
it will be removed from the system. Only set when deletionTimestamp is also set.
May only be shortened.
Read-only.
+optional |  |
| DeletionTimestamp | string| `string` |  | | DeletionTimestamp is RFC 3339 date and time at which this resource will be deleted. This
field is set by the server when a graceful deletion is requested by the user, and is not
directly settable by a client. The resource is expected to be deleted (no longer visible
from resource lists, and not reachable by name) after the time in this field, once the
finalizers list is empty. As long as the finalizers list contains items, deletion is blocked.
Once the deletionTimestamp is set, this value may not be unset or be set further into the
future, although it may be shortened or the resource may be deleted prior to this time.
For example, a user may request that a pod is deleted in 30 seconds. The Kubelet will react
by sending a graceful termination signal to the containers in the pod. After that 30 seconds,
the Kubelet will send a hard termination signal (SIGKILL) to the container and after cleanup,
remove the pod from the API. In the presence of network partitions, this object may still
exist after this timestamp, until an administrator or automated process can determine the
resource is fully terminated.
If not set, graceful deletion of the object has not been requested.

Populated by the system when a graceful deletion is requested.
Read-only.
More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
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
+patchStrategy=merge |  |
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
More info: http://kubernetes.io/docs/user-guide/labels
+optional |  |
| ManagedFields | [][ManagedFieldsEntry](#managed-fields-entry)| `[]*ManagedFieldsEntry` |  | | ManagedFields maps workflow-id and version to the set of fields
that are managed by that workflow. This is mostly for internal
housekeeping, and users typically shouldn't need to set or
understand this field. A workflow can be the user's name, a
controller's name, or the name of a specific apply path like
"ci-cd". The set of fields is always in the version that the
workflow used when modifying the object.

+optional |  |
| Name | string| `string` |  | | Name must be unique within a namespace. Is required when creating resources, although
some resources may allow a client to request the generation of an appropriate name
automatically. Name is primarily intended for creation idempotence and configuration
definition.
Cannot be updated.
More info: http://kubernetes.io/docs/user-guide/identifiers#names
+optional |  |
| Namespace | string| `string` |  | | Namespace defines the space within which each name must be unique. An empty namespace is
equivalent to the "default" namespace, but "default" is the canonical representation.
Not all objects are required to be scoped to a namespace - the value of this field for
those objects will be empty.

Must be a DNS_LABEL.
Cannot be updated.
More info: http://kubernetes.io/docs/user-guide/namespaces
+optional |  |
| OwnerReferences | [][OwnerReference](#owner-reference)| `[]*OwnerReference` |  | | List of objects depended by this object. If ALL objects in the list have
been deleted, this object will be garbage collected. If this object is managed by a controller,
then an entry in this list will point to this controller, with the controller field set to true.
There cannot be more than one managing controller.
+optional
+patchMergeKey=uid
+patchStrategy=merge |  |
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
| ZZZ_DeprecatedClusterName | string| `string` |  | | Deprecated: ClusterName is a legacy field that was always cleared by
the system and never used; it will be removed completely in 1.25.

The name in the go struct is changed to help clients detect
accidental use.

+optional |  |
| spec | [RequestAuthentication](#request-authentication)| `RequestAuthentication` |  | |  |  |
| status | [IstioStatus](#istio-status)| `IstioStatus` |  | |  |  |
| uid | [UID](#uid)| `UID` |  | |  |  |



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



### <span id="resource-permissions"></span> ResourcePermissions


> ResourcePermissions holds permission flags for an object type
True means allowed.
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Create | boolean| `bool` |  | |  |  |
| Delete | boolean| `bool` |  | |  |  |
| Update | boolean| `bool` |  | |  |  |



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



### <span id="route-group-kind"></span> RouteGroupKind


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| group | [Group](#group)| `Group` |  | |  |  |
| kind | [Kind](#kind)| `Kind` |  | |  |  |



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


> This validation is based off of the corresponding Kubernetes validation:
https://github.com/kubernetes/apimachinery/blob/02cfb53916346d085a6c6c7c66f882e3c6b0eca6/pkg/util/validation/validation.go#L208

Valid values include:

"example.com"
"foo.example.com"

Invalid values include:

"example.com/bar" - "/" is an invalid character

+kubebuilder:validation:Pattern=`^[a-z0-9]([-a-z0-9]*[a-z0-9])?(\.[a-z0-9]([-a-z0-9]*[a-z0-9])?)*$`
+kubebuilder:validation:MinLength=1
+kubebuilder:validation:MaxLength=253
  



| Name | Type | Go type | Default | Description | Example |
|------|------|---------| ------- |-------------|---------|
| SectionName | string| string | | This validation is based off of the corresponding Kubernetes validation:
https://github.com/kubernetes/apimachinery/blob/02cfb53916346d085a6c6c7c66f882e3c6b0eca6/pkg/util/validation/validation.go#L208

Valid values include:

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
| CreatedAt | string| `string` |  | |  |  |
| ExternalName | string| `string` |  | |  |  |
| HealthAnnotations | map of string| `map[string]string` |  | |  |  |
| Ip | string| `string` |  | |  |  |
| Labels | map of string| `map[string]string` |  | |  |  |
| Name | string| `string` |  | |  |  |
| ResourceVersion | string| `string` |  | |  |  |
| Selectors | map of string| `map[string]string` |  | |  |  |
| Type | string| `string` |  | |  |  |
| namespace | [Namespace](#namespace)| `Namespace` |  | |  |  |
| ports | [Ports](#ports)| `Ports` |  | |  |  |



### <span id="service-details"></span> ServiceDetails


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| DestinationRules | [][DestinationRule](#destination-rule)| `[]*DestinationRule` |  | |  |  |
| IstioSidecar | boolean| `bool` |  | |  |  |
| K8sHTTPRoutes | [][HTTPRoute](#http-route)| `[]*HTTPRoute` |  | |  |  |
| K8sReferenceGrants | [][ReferenceGrant](#reference-grant)| `[]*ReferenceGrant` |  | |  |  |
| ServiceEntries | [][ServiceEntry](#service-entry)| `[]*ServiceEntry` |  | |  |  |
| SubServices | [][ServiceOverview](#service-overview)| `[]*ServiceOverview` |  | | Services with same app labels (different versions or a single version) |  |
| VirtualServices | [][VirtualService](#virtual-service)| `[]*VirtualService` |  | |  |  |
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
+cue-gen:ServiceEntry:version:v1beta1
+cue-gen:ServiceEntry:annotations:helm.sh/resource-policy=keep
+cue-gen:ServiceEntry:labels:app=istio-pilot,chart=istio,heritage=Tiller,release=istio
+cue-gen:ServiceEntry:subresource:status
+cue-gen:ServiceEntry:scope:Namespaced
+cue-gen:ServiceEntry:resource:categories=istio-io,networking-istio-io,shortNames=se,plural=serviceentries
+cue-gen:ServiceEntry:printerColumn:name=Hosts,type=string,JSONPath=.spec.hosts,description="The hosts associated with the ServiceEntry"
+cue-gen:ServiceEntry:printerColumn:name=Location,type=string,JSONPath=.spec.location,description="Whether the service is external to the
mesh or part of the mesh (MESH_EXTERNAL or MESH_INTERNAL)"
+cue-gen:ServiceEntry:printerColumn:name=Resolution,type=string,JSONPath=.spec.resolution,description="Service discovery mode for the hosts
(NONE, STATIC, or DNS)"
+cue-gen:ServiceEntry:printerColumn:name=Age,type=date,JSONPath=.metadata.creationTimestamp,description="CreationTimestamp is a timestamp
representing the server time when this object was created. It is not guaranteed to be set in happens-before order across separate operations.
Clients may not set this value. It is represented in RFC3339 form and is in UTC.
Populated by the system. Read-only. Null for lists. More info: https://git.k8s.io/community/contributors/devel/api-conventions.md#metadata"
+cue-gen:ServiceEntry:preserveUnknownFields:false
>

<!-- go code generation tags
+kubetype-gen
+kubetype-gen:groupVersion=networking.istio.io/v1beta1
+genclient
+k8s:deepcopy-gen=true
>
<!-- istio code generation tags
+istio.io/sync-from:networking/v1alpha3/service_entry.proto
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
More info: http://kubernetes.io/docs/user-guide/annotations
+optional |  |
| CreationTimestamp | string| `string` |  | | CreationTimestamp is a timestamp representing the server time when this object was
created. It is not guaranteed to be set in happens-before order across separate operations.
Clients may not set this value. It is represented in RFC3339 form and is in UTC.

Populated by the system.
Read-only.
Null for lists.
More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
+optional |  |
| DeletionGracePeriodSeconds | int64 (formatted integer)| `int64` |  | | Number of seconds allowed for this object to gracefully terminate before
it will be removed from the system. Only set when deletionTimestamp is also set.
May only be shortened.
Read-only.
+optional |  |
| DeletionTimestamp | string| `string` |  | | DeletionTimestamp is RFC 3339 date and time at which this resource will be deleted. This
field is set by the server when a graceful deletion is requested by the user, and is not
directly settable by a client. The resource is expected to be deleted (no longer visible
from resource lists, and not reachable by name) after the time in this field, once the
finalizers list is empty. As long as the finalizers list contains items, deletion is blocked.
Once the deletionTimestamp is set, this value may not be unset or be set further into the
future, although it may be shortened or the resource may be deleted prior to this time.
For example, a user may request that a pod is deleted in 30 seconds. The Kubelet will react
by sending a graceful termination signal to the containers in the pod. After that 30 seconds,
the Kubelet will send a hard termination signal (SIGKILL) to the container and after cleanup,
remove the pod from the API. In the presence of network partitions, this object may still
exist after this timestamp, until an administrator or automated process can determine the
resource is fully terminated.
If not set, graceful deletion of the object has not been requested.

Populated by the system when a graceful deletion is requested.
Read-only.
More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
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
+patchStrategy=merge |  |
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
More info: http://kubernetes.io/docs/user-guide/labels
+optional |  |
| ManagedFields | [][ManagedFieldsEntry](#managed-fields-entry)| `[]*ManagedFieldsEntry` |  | | ManagedFields maps workflow-id and version to the set of fields
that are managed by that workflow. This is mostly for internal
housekeeping, and users typically shouldn't need to set or
understand this field. A workflow can be the user's name, a
controller's name, or the name of a specific apply path like
"ci-cd". The set of fields is always in the version that the
workflow used when modifying the object.

+optional |  |
| Name | string| `string` |  | | Name must be unique within a namespace. Is required when creating resources, although
some resources may allow a client to request the generation of an appropriate name
automatically. Name is primarily intended for creation idempotence and configuration
definition.
Cannot be updated.
More info: http://kubernetes.io/docs/user-guide/identifiers#names
+optional |  |
| Namespace | string| `string` |  | | Namespace defines the space within which each name must be unique. An empty namespace is
equivalent to the "default" namespace, but "default" is the canonical representation.
Not all objects are required to be scoped to a namespace - the value of this field for
those objects will be empty.

Must be a DNS_LABEL.
Cannot be updated.
More info: http://kubernetes.io/docs/user-guide/namespaces
+optional |  |
| OwnerReferences | [][OwnerReference](#owner-reference)| `[]*OwnerReference` |  | | List of objects depended by this object. If ALL objects in the list have
been deleted, this object will be garbage collected. If this object is managed by a controller,
then an entry in this list will point to this controller, with the controller field set to true.
There cannot be more than one managing controller.
+optional
+patchMergeKey=uid
+patchStrategy=merge |  |
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
| ZZZ_DeprecatedClusterName | string| `string` |  | | Deprecated: ClusterName is a legacy field that was always cleared by
the system and never used; it will be removed completely in 1.25.

The name in the go struct is changed to help clients detect
accidental use.

+optional |  |
| spec | [ServiceEntry](#service-entry)| `ServiceEntry` |  | |  |  |
| status | [IstioStatus](#istio-status)| `IstioStatus` |  | |  |  |
| uid | [UID](#uid)| `UID` |  | |  |  |



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
| Services | [][ServiceOverview](#service-overview)| `[]*ServiceOverview` |  | |  |  |
| namespace | [Namespace](#namespace)| `Namespace` |  | |  |  |
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
| AppLabel | boolean| `bool` | ✓ | | Has label app | `true` |
| HealthAnnotations | map of string| `map[string]string` |  | | Annotations of the service |  |
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



### <span id="service-reference"></span> ServiceReference


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Name | string| `string` |  | |  |  |
| Namespace | string| `string` |  | |  |  |



### <span id="severity-level"></span> SeverityLevel


  

| Name | Type | Go type | Default | Description | Example |
|------|------|---------| ------- |-------------|---------|
| SeverityLevel | string| string | |  |  |



### <span id="sidecar"></span> Sidecar


> <!-- crd generation tags
+cue-gen:Sidecar:groupName:networking.istio.io
+cue-gen:Sidecar:version:v1beta1
+cue-gen:Sidecar:annotations:helm.sh/resource-policy=keep
+cue-gen:Sidecar:labels:app=istio-pilot,chart=istio,heritage=Tiller,release=istio
+cue-gen:Sidecar:subresource:status
+cue-gen:Sidecar:scope:Namespaced
+cue-gen:Sidecar:resource:categories=istio-io,networking-istio-io
+cue-gen:Sidecar:preserveUnknownFields:false
>

<!-- go code generation tags
+kubetype-gen
+kubetype-gen:groupVersion=networking.istio.io/v1beta1
+genclient
+k8s:deepcopy-gen=true
>
<!-- istio code generation tags
+istio.io/sync-from:networking/v1alpha3/sidecar.proto
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
More info: http://kubernetes.io/docs/user-guide/annotations
+optional |  |
| CreationTimestamp | string| `string` |  | | CreationTimestamp is a timestamp representing the server time when this object was
created. It is not guaranteed to be set in happens-before order across separate operations.
Clients may not set this value. It is represented in RFC3339 form and is in UTC.

Populated by the system.
Read-only.
Null for lists.
More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
+optional |  |
| DeletionGracePeriodSeconds | int64 (formatted integer)| `int64` |  | | Number of seconds allowed for this object to gracefully terminate before
it will be removed from the system. Only set when deletionTimestamp is also set.
May only be shortened.
Read-only.
+optional |  |
| DeletionTimestamp | string| `string` |  | | DeletionTimestamp is RFC 3339 date and time at which this resource will be deleted. This
field is set by the server when a graceful deletion is requested by the user, and is not
directly settable by a client. The resource is expected to be deleted (no longer visible
from resource lists, and not reachable by name) after the time in this field, once the
finalizers list is empty. As long as the finalizers list contains items, deletion is blocked.
Once the deletionTimestamp is set, this value may not be unset or be set further into the
future, although it may be shortened or the resource may be deleted prior to this time.
For example, a user may request that a pod is deleted in 30 seconds. The Kubelet will react
by sending a graceful termination signal to the containers in the pod. After that 30 seconds,
the Kubelet will send a hard termination signal (SIGKILL) to the container and after cleanup,
remove the pod from the API. In the presence of network partitions, this object may still
exist after this timestamp, until an administrator or automated process can determine the
resource is fully terminated.
If not set, graceful deletion of the object has not been requested.

Populated by the system when a graceful deletion is requested.
Read-only.
More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
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
+patchStrategy=merge |  |
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
More info: http://kubernetes.io/docs/user-guide/labels
+optional |  |
| ManagedFields | [][ManagedFieldsEntry](#managed-fields-entry)| `[]*ManagedFieldsEntry` |  | | ManagedFields maps workflow-id and version to the set of fields
that are managed by that workflow. This is mostly for internal
housekeeping, and users typically shouldn't need to set or
understand this field. A workflow can be the user's name, a
controller's name, or the name of a specific apply path like
"ci-cd". The set of fields is always in the version that the
workflow used when modifying the object.

+optional |  |
| Name | string| `string` |  | | Name must be unique within a namespace. Is required when creating resources, although
some resources may allow a client to request the generation of an appropriate name
automatically. Name is primarily intended for creation idempotence and configuration
definition.
Cannot be updated.
More info: http://kubernetes.io/docs/user-guide/identifiers#names
+optional |  |
| Namespace | string| `string` |  | | Namespace defines the space within which each name must be unique. An empty namespace is
equivalent to the "default" namespace, but "default" is the canonical representation.
Not all objects are required to be scoped to a namespace - the value of this field for
those objects will be empty.

Must be a DNS_LABEL.
Cannot be updated.
More info: http://kubernetes.io/docs/user-guide/namespaces
+optional |  |
| OwnerReferences | [][OwnerReference](#owner-reference)| `[]*OwnerReference` |  | | List of objects depended by this object. If ALL objects in the list have
been deleted, this object will be garbage collected. If this object is managed by a controller,
then an entry in this list will point to this controller, with the controller field set to true.
There cannot be more than one managing controller.
+optional
+patchMergeKey=uid
+patchStrategy=merge |  |
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
| ZZZ_DeprecatedClusterName | string| `string` |  | | Deprecated: ClusterName is a legacy field that was always cleared by
the system and never used; it will be removed completely in 1.25.

The name in the go struct is changed to help clients detect
accidental use.

+optional |  |
| spec | [Sidecar](#sidecar)| `Sidecar` |  | |  |  |
| status | [IstioStatus](#istio-status)| `IstioStatus` |  | |  |  |
| uid | [UID](#uid)| `UID` |  | |  |  |



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



### <span id="target"></span> Target


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Kind | string| `string` |  | |  |  |
| Name | string| `string` |  | |  |  |
| Namespace | string| `string` |  | |  |  |



### <span id="telemetry"></span> Telemetry


> <!-- go code generation tags
+kubetype-gen
+kubetype-gen:groupVersion=telemetry.istio.io/v1alpha1
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
More info: http://kubernetes.io/docs/user-guide/annotations
+optional |  |
| CreationTimestamp | string| `string` |  | | CreationTimestamp is a timestamp representing the server time when this object was
created. It is not guaranteed to be set in happens-before order across separate operations.
Clients may not set this value. It is represented in RFC3339 form and is in UTC.

Populated by the system.
Read-only.
Null for lists.
More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
+optional |  |
| DeletionGracePeriodSeconds | int64 (formatted integer)| `int64` |  | | Number of seconds allowed for this object to gracefully terminate before
it will be removed from the system. Only set when deletionTimestamp is also set.
May only be shortened.
Read-only.
+optional |  |
| DeletionTimestamp | string| `string` |  | | DeletionTimestamp is RFC 3339 date and time at which this resource will be deleted. This
field is set by the server when a graceful deletion is requested by the user, and is not
directly settable by a client. The resource is expected to be deleted (no longer visible
from resource lists, and not reachable by name) after the time in this field, once the
finalizers list is empty. As long as the finalizers list contains items, deletion is blocked.
Once the deletionTimestamp is set, this value may not be unset or be set further into the
future, although it may be shortened or the resource may be deleted prior to this time.
For example, a user may request that a pod is deleted in 30 seconds. The Kubelet will react
by sending a graceful termination signal to the containers in the pod. After that 30 seconds,
the Kubelet will send a hard termination signal (SIGKILL) to the container and after cleanup,
remove the pod from the API. In the presence of network partitions, this object may still
exist after this timestamp, until an administrator or automated process can determine the
resource is fully terminated.
If not set, graceful deletion of the object has not been requested.

Populated by the system when a graceful deletion is requested.
Read-only.
More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
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
+patchStrategy=merge |  |
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
More info: http://kubernetes.io/docs/user-guide/labels
+optional |  |
| ManagedFields | [][ManagedFieldsEntry](#managed-fields-entry)| `[]*ManagedFieldsEntry` |  | | ManagedFields maps workflow-id and version to the set of fields
that are managed by that workflow. This is mostly for internal
housekeeping, and users typically shouldn't need to set or
understand this field. A workflow can be the user's name, a
controller's name, or the name of a specific apply path like
"ci-cd". The set of fields is always in the version that the
workflow used when modifying the object.

+optional |  |
| Name | string| `string` |  | | Name must be unique within a namespace. Is required when creating resources, although
some resources may allow a client to request the generation of an appropriate name
automatically. Name is primarily intended for creation idempotence and configuration
definition.
Cannot be updated.
More info: http://kubernetes.io/docs/user-guide/identifiers#names
+optional |  |
| Namespace | string| `string` |  | | Namespace defines the space within which each name must be unique. An empty namespace is
equivalent to the "default" namespace, but "default" is the canonical representation.
Not all objects are required to be scoped to a namespace - the value of this field for
those objects will be empty.

Must be a DNS_LABEL.
Cannot be updated.
More info: http://kubernetes.io/docs/user-guide/namespaces
+optional |  |
| OwnerReferences | [][OwnerReference](#owner-reference)| `[]*OwnerReference` |  | | List of objects depended by this object. If ALL objects in the list have
been deleted, this object will be garbage collected. If this object is managed by a controller,
then an entry in this list will point to this controller, with the controller field set to true.
There cannot be more than one managing controller.
+optional
+patchMergeKey=uid
+patchStrategy=merge |  |
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
| ZZZ_DeprecatedClusterName | string| `string` |  | | Deprecated: ClusterName is a legacy field that was always cleared by
the system and never used; it will be removed completely in 1.25.

The name in the go struct is changed to help clients detect
accidental use.

+optional |  |
| spec | [Telemetry](#telemetry)| `Telemetry` |  | |  |  |
| status | [IstioStatus](#istio-status)| `IstioStatus` |  | |  |  |
| uid | [UID](#uid)| `UID` |  | |  |  |



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
http://www.joda.org/joda-time/apidocs/org/joda/time/format/ISODateTimeFormat.html#dateTime%2D%2D
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
| Processes | map of [Process](#process)| `map[string]Process` |  | |  |  |
| Spans | [][Span](#span)| `[]*Span` |  | |  |  |
| Warnings | []string| `[]string` |  | |  |  |
| traceID | [TraceID](#trace-id)| `TraceID` |  | |  |  |



### <span id="trace-id"></span> TraceID


  

| Name | Type | Go type | Default | Description | Example |
|------|------|---------| ------- |-------------|---------|
| TraceID | string| string | |  |  |



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
+cue-gen:VirtualService:version:v1beta1
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
+kubetype-gen:groupVersion=networking.istio.io/v1beta1
+genclient
+k8s:deepcopy-gen=true
>
<!-- istio code generation tags
+istio.io/sync-from:networking/v1alpha3/virtual_service.proto
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
More info: http://kubernetes.io/docs/user-guide/annotations
+optional |  |
| CreationTimestamp | string| `string` |  | | CreationTimestamp is a timestamp representing the server time when this object was
created. It is not guaranteed to be set in happens-before order across separate operations.
Clients may not set this value. It is represented in RFC3339 form and is in UTC.

Populated by the system.
Read-only.
Null for lists.
More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
+optional |  |
| DeletionGracePeriodSeconds | int64 (formatted integer)| `int64` |  | | Number of seconds allowed for this object to gracefully terminate before
it will be removed from the system. Only set when deletionTimestamp is also set.
May only be shortened.
Read-only.
+optional |  |
| DeletionTimestamp | string| `string` |  | | DeletionTimestamp is RFC 3339 date and time at which this resource will be deleted. This
field is set by the server when a graceful deletion is requested by the user, and is not
directly settable by a client. The resource is expected to be deleted (no longer visible
from resource lists, and not reachable by name) after the time in this field, once the
finalizers list is empty. As long as the finalizers list contains items, deletion is blocked.
Once the deletionTimestamp is set, this value may not be unset or be set further into the
future, although it may be shortened or the resource may be deleted prior to this time.
For example, a user may request that a pod is deleted in 30 seconds. The Kubelet will react
by sending a graceful termination signal to the containers in the pod. After that 30 seconds,
the Kubelet will send a hard termination signal (SIGKILL) to the container and after cleanup,
remove the pod from the API. In the presence of network partitions, this object may still
exist after this timestamp, until an administrator or automated process can determine the
resource is fully terminated.
If not set, graceful deletion of the object has not been requested.

Populated by the system when a graceful deletion is requested.
Read-only.
More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
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
+patchStrategy=merge |  |
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
More info: http://kubernetes.io/docs/user-guide/labels
+optional |  |
| ManagedFields | [][ManagedFieldsEntry](#managed-fields-entry)| `[]*ManagedFieldsEntry` |  | | ManagedFields maps workflow-id and version to the set of fields
that are managed by that workflow. This is mostly for internal
housekeeping, and users typically shouldn't need to set or
understand this field. A workflow can be the user's name, a
controller's name, or the name of a specific apply path like
"ci-cd". The set of fields is always in the version that the
workflow used when modifying the object.

+optional |  |
| Name | string| `string` |  | | Name must be unique within a namespace. Is required when creating resources, although
some resources may allow a client to request the generation of an appropriate name
automatically. Name is primarily intended for creation idempotence and configuration
definition.
Cannot be updated.
More info: http://kubernetes.io/docs/user-guide/identifiers#names
+optional |  |
| Namespace | string| `string` |  | | Namespace defines the space within which each name must be unique. An empty namespace is
equivalent to the "default" namespace, but "default" is the canonical representation.
Not all objects are required to be scoped to a namespace - the value of this field for
those objects will be empty.

Must be a DNS_LABEL.
Cannot be updated.
More info: http://kubernetes.io/docs/user-guide/namespaces
+optional |  |
| OwnerReferences | [][OwnerReference](#owner-reference)| `[]*OwnerReference` |  | | List of objects depended by this object. If ALL objects in the list have
been deleted, this object will be garbage collected. If this object is managed by a controller,
then an entry in this list will point to this controller, with the controller field set to true.
There cannot be more than one managing controller.
+optional
+patchMergeKey=uid
+patchStrategy=merge |  |
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
| ZZZ_DeprecatedClusterName | string| `string` |  | | Deprecated: ClusterName is a legacy field that was always cleared by
the system and never used; it will be removed completely in 1.25.

The name in the go struct is changed to help clients detect
accidental use.

+optional |  |
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



### <span id="wasm-plugin"></span> WasmPlugin


> <!-- crd generation tags
+cue-gen:WasmPlugin:groupName:extensions.istio.io
+cue-gen:WasmPlugin:version:v1alpha1
+cue-gen:WasmPlugin:storageVersion
+cue-gen:WasmPlugin:annotations:helm.sh/resource-policy=keep
+cue-gen:WasmPlugin:labels:app=istio-pilot,chart=istio,heritage=Tiller,release=istio
+cue-gen:WasmPlugin:subresource:status
+cue-gen:WasmPlugin:scope:Namespaced
+cue-gen:WasmPlugin:resource:categories=istio-io,extensions-istio-io
+cue-gen:WasmPlugin:preserveUnknownFields:pluginConfig
+cue-gen:WasmPlugin:printerColumn:name=Age,type=date,JSONPath=.metadata.creationTimestamp,description="CreationTimestamp is a timestamp
representing the server time when this object was created. It is not guaranteed to be set in happens-before order across separate operations.
Clients may not set this value. It is represented in RFC3339 form and is in UTC.
Populated by the system. Read-only. Null for lists. More info: https://git.k8s.io/community/contributors/devel/api-conventions.md#metadata"
>

<!-- go code generation tags
+kubetype-gen
+kubetype-gen:groupVersion=extensions.istio.io/v1alpha1
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
More info: http://kubernetes.io/docs/user-guide/annotations
+optional |  |
| CreationTimestamp | string| `string` |  | | CreationTimestamp is a timestamp representing the server time when this object was
created. It is not guaranteed to be set in happens-before order across separate operations.
Clients may not set this value. It is represented in RFC3339 form and is in UTC.

Populated by the system.
Read-only.
Null for lists.
More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
+optional |  |
| DeletionGracePeriodSeconds | int64 (formatted integer)| `int64` |  | | Number of seconds allowed for this object to gracefully terminate before
it will be removed from the system. Only set when deletionTimestamp is also set.
May only be shortened.
Read-only.
+optional |  |
| DeletionTimestamp | string| `string` |  | | DeletionTimestamp is RFC 3339 date and time at which this resource will be deleted. This
field is set by the server when a graceful deletion is requested by the user, and is not
directly settable by a client. The resource is expected to be deleted (no longer visible
from resource lists, and not reachable by name) after the time in this field, once the
finalizers list is empty. As long as the finalizers list contains items, deletion is blocked.
Once the deletionTimestamp is set, this value may not be unset or be set further into the
future, although it may be shortened or the resource may be deleted prior to this time.
For example, a user may request that a pod is deleted in 30 seconds. The Kubelet will react
by sending a graceful termination signal to the containers in the pod. After that 30 seconds,
the Kubelet will send a hard termination signal (SIGKILL) to the container and after cleanup,
remove the pod from the API. In the presence of network partitions, this object may still
exist after this timestamp, until an administrator or automated process can determine the
resource is fully terminated.
If not set, graceful deletion of the object has not been requested.

Populated by the system when a graceful deletion is requested.
Read-only.
More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
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
+patchStrategy=merge |  |
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
More info: http://kubernetes.io/docs/user-guide/labels
+optional |  |
| ManagedFields | [][ManagedFieldsEntry](#managed-fields-entry)| `[]*ManagedFieldsEntry` |  | | ManagedFields maps workflow-id and version to the set of fields
that are managed by that workflow. This is mostly for internal
housekeeping, and users typically shouldn't need to set or
understand this field. A workflow can be the user's name, a
controller's name, or the name of a specific apply path like
"ci-cd". The set of fields is always in the version that the
workflow used when modifying the object.

+optional |  |
| Name | string| `string` |  | | Name must be unique within a namespace. Is required when creating resources, although
some resources may allow a client to request the generation of an appropriate name
automatically. Name is primarily intended for creation idempotence and configuration
definition.
Cannot be updated.
More info: http://kubernetes.io/docs/user-guide/identifiers#names
+optional |  |
| Namespace | string| `string` |  | | Namespace defines the space within which each name must be unique. An empty namespace is
equivalent to the "default" namespace, but "default" is the canonical representation.
Not all objects are required to be scoped to a namespace - the value of this field for
those objects will be empty.

Must be a DNS_LABEL.
Cannot be updated.
More info: http://kubernetes.io/docs/user-guide/namespaces
+optional |  |
| OwnerReferences | [][OwnerReference](#owner-reference)| `[]*OwnerReference` |  | | List of objects depended by this object. If ALL objects in the list have
been deleted, this object will be garbage collected. If this object is managed by a controller,
then an entry in this list will point to this controller, with the controller field set to true.
There cannot be more than one managing controller.
+optional
+patchMergeKey=uid
+patchStrategy=merge |  |
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
| ZZZ_DeprecatedClusterName | string| `string` |  | | Deprecated: ClusterName is a legacy field that was always cleared by
the system and never used; it will be removed completely in 1.25.

The name in the go struct is changed to help clients detect
accidental use.

+optional |  |
| spec | [WasmPlugin](#wasm-plugin)| `WasmPlugin` |  | |  |  |
| status | [IstioStatus](#istio-status)| `IstioStatus` |  | |  |  |
| uid | [UID](#uid)| `UID` |  | |  |  |



### <span id="workload"></span> Workload


> Workload has the details of a workload
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| AdditionalDetails | [][AdditionalItem](#additional-item)| `[]*AdditionalItem` |  | | Additional details to display, such as configured annotations |  |
| AppLabel | boolean| `bool` | ✓ | | Define if Pods related to this Workload has the label App | `true` |
| AvailableReplicas | int32 (formatted integer)| `int32` | ✓ | | Number of available replicas | `1` |
| CreatedAt | string| `string` | ✓ | | Creation timestamp (in RFC3339 format) | `2018-07-31T12:24:17Z` |
| CurrentReplicas | int32 (formatted integer)| `int32` | ✓ | | Number of current replicas pods that matches controller selector labels | `2` |
| DashboardAnnotations | map of string| `map[string]string` |  | | Dashboard annotations |  |
| DesiredReplicas | int32 (formatted integer)| `int32` | ✓ | | Number of desired replicas defined by the user in the controller Spec | `2` |
| HealthAnnotations | map of string| `map[string]string` |  | | HealthAnnotations |  |
| IstioInjectionAnnotation | boolean| `bool` |  | | Define if Workload has an explicit Istio policy annotation
Istio supports this as a label as well - this will be defined if the label is set, too.
If both annotation and label are set, if any is false, injection is disabled.
It's mapped as a pointer to show three values nil, true, false |  |
| IstioReferences | [][IstioValidationKey](#istio-validation-key)| `[]*IstioValidationKey` |  | | Istio References |  |
| IstioSidecar | boolean| `bool` | ✓ | | Define if Pods related to this Workload has an IstioSidecar deployed | `true` |
| Labels | map of string| `map[string]string` |  | | Workload labels |  |
| Name | string| `string` | ✓ | | Name of the workload | `reviews-v1` |
| PodCount | int64 (formatted integer)| `int64` | ✓ | | Number of current workload pods | `1` |
| ResourceVersion | string| `string` | ✓ | | Kubernetes ResourceVersion | `192892127` |
| Runtimes | [][Runtime](#runtime)| `[]*Runtime` |  | | Runtimes and associated dashboards |  |
| ServiceAccountNames | []string| `[]string` |  | | Names of the workload service accounts |  |
| Services | [][ServiceOverview](#service-overview)| `[]*ServiceOverview` |  | | Services that match workload selector |  |
| Type | string| `string` | ✓ | | Type of the workload | `deployment` |
| VersionLabel | boolean| `bool` | ✓ | | Define if Pods related to this Workload has the label Version | `true` |
| additionalDetailSample | [AdditionalItem](#additional-item)| `AdditionalItem` |  | |  |  |
| health | [WorkloadHealth](#workload-health)| `WorkloadHealth` |  | |  |  |
| pods | [Pods](#pods)| `Pods` |  | |  |  |
| validations | [IstioValidations](#istio-validations)| `IstioValidations` |  | |  |  |



### <span id="workload-entry"></span> WorkloadEntry


> <!-- crd generation tags
+cue-gen:WorkloadEntry:groupName:networking.istio.io
+cue-gen:WorkloadEntry:version:v1beta1
+cue-gen:WorkloadEntry:annotations:helm.sh/resource-policy=keep
+cue-gen:WorkloadEntry:labels:app=istio-pilot,chart=istio,heritage=Tiller,release=istio
+cue-gen:WorkloadEntry:subresource:status
+cue-gen:WorkloadEntry:scope:Namespaced
+cue-gen:WorkloadEntry:resource:categories=istio-io,networking-istio-io,shortNames=we,plural=workloadentries
+cue-gen:WorkloadEntry:printerColumn:name=Age,type=date,JSONPath=.metadata.creationTimestamp,description="CreationTimestamp is a timestamp
representing the server time when this object was created. It is not guaranteed to be set in happens-before order across separate operations.
Clients may not set this value. It is represented in RFC3339 form and is in UTC.
Populated by the system. Read-only. Null for lists. More info: https://git.k8s.io/community/contributors/devel/api-conventions.md#metadata"
+cue-gen:WorkloadEntry:printerColumn:name=Address,type=string,JSONPath=.spec.address,description="Address associated with the network endpoint."
+cue-gen:WorkloadEntry:preserveUnknownFields:false
>

<!-- go code generation tags
+kubetype-gen
+kubetype-gen:groupVersion=networking.istio.io/v1beta1
+genclient
+k8s:deepcopy-gen=true
>
<!-- istio code generation tags
+istio.io/sync-from:networking/v1alpha3/workload_entry.proto
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
More info: http://kubernetes.io/docs/user-guide/annotations
+optional |  |
| CreationTimestamp | string| `string` |  | | CreationTimestamp is a timestamp representing the server time when this object was
created. It is not guaranteed to be set in happens-before order across separate operations.
Clients may not set this value. It is represented in RFC3339 form and is in UTC.

Populated by the system.
Read-only.
Null for lists.
More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
+optional |  |
| DeletionGracePeriodSeconds | int64 (formatted integer)| `int64` |  | | Number of seconds allowed for this object to gracefully terminate before
it will be removed from the system. Only set when deletionTimestamp is also set.
May only be shortened.
Read-only.
+optional |  |
| DeletionTimestamp | string| `string` |  | | DeletionTimestamp is RFC 3339 date and time at which this resource will be deleted. This
field is set by the server when a graceful deletion is requested by the user, and is not
directly settable by a client. The resource is expected to be deleted (no longer visible
from resource lists, and not reachable by name) after the time in this field, once the
finalizers list is empty. As long as the finalizers list contains items, deletion is blocked.
Once the deletionTimestamp is set, this value may not be unset or be set further into the
future, although it may be shortened or the resource may be deleted prior to this time.
For example, a user may request that a pod is deleted in 30 seconds. The Kubelet will react
by sending a graceful termination signal to the containers in the pod. After that 30 seconds,
the Kubelet will send a hard termination signal (SIGKILL) to the container and after cleanup,
remove the pod from the API. In the presence of network partitions, this object may still
exist after this timestamp, until an administrator or automated process can determine the
resource is fully terminated.
If not set, graceful deletion of the object has not been requested.

Populated by the system when a graceful deletion is requested.
Read-only.
More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
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
+patchStrategy=merge |  |
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
More info: http://kubernetes.io/docs/user-guide/labels
+optional |  |
| ManagedFields | [][ManagedFieldsEntry](#managed-fields-entry)| `[]*ManagedFieldsEntry` |  | | ManagedFields maps workflow-id and version to the set of fields
that are managed by that workflow. This is mostly for internal
housekeeping, and users typically shouldn't need to set or
understand this field. A workflow can be the user's name, a
controller's name, or the name of a specific apply path like
"ci-cd". The set of fields is always in the version that the
workflow used when modifying the object.

+optional |  |
| Name | string| `string` |  | | Name must be unique within a namespace. Is required when creating resources, although
some resources may allow a client to request the generation of an appropriate name
automatically. Name is primarily intended for creation idempotence and configuration
definition.
Cannot be updated.
More info: http://kubernetes.io/docs/user-guide/identifiers#names
+optional |  |
| Namespace | string| `string` |  | | Namespace defines the space within which each name must be unique. An empty namespace is
equivalent to the "default" namespace, but "default" is the canonical representation.
Not all objects are required to be scoped to a namespace - the value of this field for
those objects will be empty.

Must be a DNS_LABEL.
Cannot be updated.
More info: http://kubernetes.io/docs/user-guide/namespaces
+optional |  |
| OwnerReferences | [][OwnerReference](#owner-reference)| `[]*OwnerReference` |  | | List of objects depended by this object. If ALL objects in the list have
been deleted, this object will be garbage collected. If this object is managed by a controller,
then an entry in this list will point to this controller, with the controller field set to true.
There cannot be more than one managing controller.
+optional
+patchMergeKey=uid
+patchStrategy=merge |  |
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
| ZZZ_DeprecatedClusterName | string| `string` |  | | Deprecated: ClusterName is a legacy field that was always cleared by
the system and never used; it will be removed completely in 1.25.

The name in the go struct is changed to help clients detect
accidental use.

+optional |  |
| spec | [WorkloadEntry](#workload-entry)| `WorkloadEntry` |  | |  |  |
| status | [IstioStatus](#istio-status)| `IstioStatus` |  | |  |  |
| uid | [UID](#uid)| `UID` |  | |  |  |



### <span id="workload-group"></span> WorkloadGroup


> <!-- crd generation tags
+cue-gen:WorkloadGroup:groupName:networking.istio.io
+cue-gen:WorkloadGroup:version:v1beta1
+cue-gen:WorkloadGroup:labels:app=istio-pilot,chart=istio,heritage=Tiller,release=istio
+cue-gen:WorkloadGroup:subresource:status
+cue-gen:WorkloadGroup:scope:Namespaced
+cue-gen:WorkloadGroup:resource:categories=istio-io,networking-istio-io,shortNames=wg,plural=workloadgroups
+cue-gen:WorkloadGroup:printerColumn:name=Age,type=date,JSONPath=.metadata.creationTimestamp,description="CreationTimestamp is a timestamp
representing the server time when this object was created. It is not guaranteed to be set in happens-before order across separate operations.
Clients may not set this value. It is represented in RFC3339 form and is in UTC.
Populated by the system. Read-only. Null for lists. More info: https://git.k8s.io/community/contributors/devel/api-conventions.md#metadata"
+cue-gen:WorkloadGroup:preserveUnknownFields:false
>

<!-- go code generation tags
+kubetype-gen
+kubetype-gen:groupVersion=networking.istio.io/v1beta1
+genclient
+k8s:deepcopy-gen=true
>
<!-- istio code generation tags
+istio.io/sync-from:networking/v1alpha3/workload_group.proto
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
More info: http://kubernetes.io/docs/user-guide/annotations
+optional |  |
| CreationTimestamp | string| `string` |  | | CreationTimestamp is a timestamp representing the server time when this object was
created. It is not guaranteed to be set in happens-before order across separate operations.
Clients may not set this value. It is represented in RFC3339 form and is in UTC.

Populated by the system.
Read-only.
Null for lists.
More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
+optional |  |
| DeletionGracePeriodSeconds | int64 (formatted integer)| `int64` |  | | Number of seconds allowed for this object to gracefully terminate before
it will be removed from the system. Only set when deletionTimestamp is also set.
May only be shortened.
Read-only.
+optional |  |
| DeletionTimestamp | string| `string` |  | | DeletionTimestamp is RFC 3339 date and time at which this resource will be deleted. This
field is set by the server when a graceful deletion is requested by the user, and is not
directly settable by a client. The resource is expected to be deleted (no longer visible
from resource lists, and not reachable by name) after the time in this field, once the
finalizers list is empty. As long as the finalizers list contains items, deletion is blocked.
Once the deletionTimestamp is set, this value may not be unset or be set further into the
future, although it may be shortened or the resource may be deleted prior to this time.
For example, a user may request that a pod is deleted in 30 seconds. The Kubelet will react
by sending a graceful termination signal to the containers in the pod. After that 30 seconds,
the Kubelet will send a hard termination signal (SIGKILL) to the container and after cleanup,
remove the pod from the API. In the presence of network partitions, this object may still
exist after this timestamp, until an administrator or automated process can determine the
resource is fully terminated.
If not set, graceful deletion of the object has not been requested.

Populated by the system when a graceful deletion is requested.
Read-only.
More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
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
+patchStrategy=merge |  |
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
More info: http://kubernetes.io/docs/user-guide/labels
+optional |  |
| ManagedFields | [][ManagedFieldsEntry](#managed-fields-entry)| `[]*ManagedFieldsEntry` |  | | ManagedFields maps workflow-id and version to the set of fields
that are managed by that workflow. This is mostly for internal
housekeeping, and users typically shouldn't need to set or
understand this field. A workflow can be the user's name, a
controller's name, or the name of a specific apply path like
"ci-cd". The set of fields is always in the version that the
workflow used when modifying the object.

+optional |  |
| Name | string| `string` |  | | Name must be unique within a namespace. Is required when creating resources, although
some resources may allow a client to request the generation of an appropriate name
automatically. Name is primarily intended for creation idempotence and configuration
definition.
Cannot be updated.
More info: http://kubernetes.io/docs/user-guide/identifiers#names
+optional |  |
| Namespace | string| `string` |  | | Namespace defines the space within which each name must be unique. An empty namespace is
equivalent to the "default" namespace, but "default" is the canonical representation.
Not all objects are required to be scoped to a namespace - the value of this field for
those objects will be empty.

Must be a DNS_LABEL.
Cannot be updated.
More info: http://kubernetes.io/docs/user-guide/namespaces
+optional |  |
| OwnerReferences | [][OwnerReference](#owner-reference)| `[]*OwnerReference` |  | | List of objects depended by this object. If ALL objects in the list have
been deleted, this object will be garbage collected. If this object is managed by a controller,
then an entry in this list will point to this controller, with the controller field set to true.
There cannot be more than one managing controller.
+optional
+patchMergeKey=uid
+patchStrategy=merge |  |
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
| ZZZ_DeprecatedClusterName | string| `string` |  | | Deprecated: ClusterName is a legacy field that was always cleared by
the system and never used; it will be removed completely in 1.25.

The name in the go struct is changed to help clients detect
accidental use.

+optional |  |
| spec | [WorkloadGroup](#workload-group)| `WorkloadGroup` |  | |  |  |
| status | [IstioStatus](#istio-status)| `IstioStatus` |  | |  |  |
| uid | [UID](#uid)| `UID` |  | |  |  |



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
| IstioSidecar | boolean| `bool` | ✓ | | Define if all Pods related to the Workload has an IstioSidecar deployed | `true` |
| Labels | map of string| `map[string]string` |  | | Labels for Workload |  |
| ServiceAccountNames | []string| `[]string` | ✓ | | List of service accounts involved in this application |  |
| WorkloadName | string| `string` | ✓ | | Name of a workload member of an application | `reviews-v1` |



### <span id="workload-list"></span> WorkloadList


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Workloads | [][WorkloadListItem](#workload-list-item)| `[]*WorkloadListItem` | ✓ | | Workloads for a given namespace |  |
| namespace | [Namespace](#namespace)| `Namespace` | ✓ | |  |  |
| validations | [IstioValidations](#istio-validations)| `IstioValidations` |  | |  |  |



### <span id="workload-list-item"></span> WorkloadListItem


> WorkloadListItem has the necessary information to display the console workload list
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| AppLabel | boolean| `bool` | ✓ | | Define if Pods related to this Workload has the label App | `true` |
| CreatedAt | string| `string` | ✓ | | Creation timestamp (in RFC3339 format) | `2018-07-31T12:24:17Z` |
| DashboardAnnotations | map of string| `map[string]string` |  | | Dashboard annotations |  |
| HealthAnnotations | map of string| `map[string]string` |  | | HealthAnnotations |  |
| IstioInjectionAnnotation | boolean| `bool` |  | | Define if Workload has an explicit Istio policy annotation
Istio supports this as a label as well - this will be defined if the label is set, too.
If both annotation and label are set, if any is false, injection is disabled.
It's mapped as a pointer to show three values nil, true, false |  |
| IstioReferences | [][IstioValidationKey](#istio-validation-key)| `[]*IstioValidationKey` |  | | Istio References |  |
| IstioSidecar | boolean| `bool` | ✓ | | Define if Pods related to this Workload has an IstioSidecar deployed | `true` |
| Labels | map of string| `map[string]string` |  | | Workload labels |  |
| Name | string| `string` | ✓ | | Name of the workload | `reviews-v1` |
| PodCount | int64 (formatted integer)| `int64` | ✓ | | Number of current workload pods | `1` |
| ResourceVersion | string| `string` | ✓ | | Kubernetes ResourceVersion | `192892127` |
| ServiceAccountNames | []string| `[]string` |  | | Names of the workload service accounts |  |
| Type | string| `string` | ✓ | | Type of the workload | `deployment` |
| VersionLabel | boolean| `bool` | ✓ | | Define if Pods related to this Workload has the label Version | `true` |
| additionalDetailSample | [AdditionalItem](#additional-item)| `AdditionalItem` |  | |  |  |
| health | [WorkloadHealth](#workload-health)| `WorkloadHealth` |  | |  |  |



### <span id="workload-overviews"></span> WorkloadOverviews


  

[][WorkloadListItem](#workload-list-item)

### <span id="workload-reference"></span> WorkloadReference


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Name | string| `string` |  | |  |  |
| Namespace | string| `string` |  | |  |  |



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


