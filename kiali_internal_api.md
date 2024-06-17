


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
| GET | /api/auth/openshift_redirect | [openshift redirect](#openshift-redirect) |  |
  


###  certs

| Method  | URI     | Name   | Summary |
|---------|---------|--------|---------|
| GET | /api/istio/certs | [istio certs](#istio-certs) |  |
  


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
| GET | /api/tracing | [tracing info](#tracing-info) |  |
  


###  kiali

| Method  | URI     | Name   | Summary |
|---------|---------|--------|---------|
| GET | /api/config | [get config](#get-config) |  |
| GET | /api/crippled | [get crippled features](#get-crippled-features) |  |
| GET | /api/healthz | [healthz](#healthz) |  |
| GET | /api | [root](#root) |  |
  


###  mesh

| Method  | URI     | Name   | Summary |
|---------|---------|--------|---------|
| GET | /api/mesh | [configuration](#configuration) |  |
  


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
| GET | /api/mesh/graph | [mesh graph](#mesh-graph) |  |
  


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



### <span id="configuration"></span> configuration (*configuration*)

```
GET /api/mesh
```

Get Mesh status and configuration

#### URI Schemes
  * http
  * https

#### Produces
  * application/json

#### All responses
| Code | Status | Description | Has headers | Schema |
|------|--------|-------------|:-----------:|--------|
| [200](#configuration-200) | OK | Response of the mesh query |  | [schema](#configuration-200-schema) |
| [400](#configuration-400) | Bad Request | BadRequestError: the client request is incorrect |  | [schema](#configuration-400-schema) |
| [500](#configuration-500) | Internal Server Error | A Internal is the error message that means something has gone wrong |  | [schema](#configuration-500-schema) |

#### Responses


##### <span id="configuration-200"></span> 200 - Response of the mesh query
Status: OK

###### <span id="configuration-200-schema"></span> Schema
   
  

[Mesh](#mesh)

##### <span id="configuration-400"></span> 400 - BadRequestError: the client request is incorrect
Status: Bad Request

###### <span id="configuration-400-schema"></span> Schema
   
  

[ConfigurationBadRequestBody](#configuration-bad-request-body)

##### <span id="configuration-500"></span> 500 - A Internal is the error message that means something has gone wrong
Status: Internal Server Error

###### <span id="configuration-500-schema"></span> Schema
   
  

[ConfigurationInternalServerErrorBody](#configuration-internal-server-error-body)

###### Inlined models

**<span id="configuration-bad-request-body"></span> ConfigurationBadRequestBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `400`| HTTP status code | `400` |
| Message | string| `string` |  | |  |  |



**<span id="configuration-internal-server-error-body"></span> ConfigurationInternalServerErrorBody**


  



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
| [200](#mesh-graph-200) | OK | HTTP status code 200 and cytoscapejs Config in data |  | [schema](#mesh-graph-200-schema) |
| [400](#mesh-graph-400) | Bad Request | BadRequestError: the client request is incorrect |  | [schema](#mesh-graph-400-schema) |
| [500](#mesh-graph-500) | Internal Server Error | A Internal is the error message that means something has gone wrong |  | [schema](#mesh-graph-500-schema) |

#### Responses


##### <span id="mesh-graph-200"></span> 200 - HTTP status code 200 and cytoscapejs Config in data
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



### <span id="openshift-redirect"></span> openshift redirect (*openshiftRedirect*)

```
GET /api/auth/openshift_redirect
```

Endpoint to redirect the browser of the user to the authentication
endpoint of the configured openshift provider.

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
| [200](#openshift-redirect-200) | OK | NoContent: the response is empty |  | [schema](#openshift-redirect-200-schema) |
| [500](#openshift-redirect-500) | Internal Server Error | A Internal is the error message that means something has gone wrong |  | [schema](#openshift-redirect-500-schema) |

#### Responses


##### <span id="openshift-redirect-200"></span> 200 - NoContent: the response is empty
Status: OK

###### <span id="openshift-redirect-200-schema"></span> Schema
   
  

[OpenshiftRedirectOKBody](#openshift-redirect-o-k-body)

##### <span id="openshift-redirect-500"></span> 500 - A Internal is the error message that means something has gone wrong
Status: Internal Server Error

###### <span id="openshift-redirect-500-schema"></span> Schema
   
  

[OpenshiftRedirectInternalServerErrorBody](#openshift-redirect-internal-server-error-body)

###### Inlined models

**<span id="openshift-redirect-internal-server-error-body"></span> OpenshiftRedirectInternalServerErrorBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `500`| HTTP status code | `500` |
| Message | string| `string` |  | |  |  |



**<span id="openshift-redirect-o-k-body"></span> OpenshiftRedirectOKBody**


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Code | int32 (formatted integer)| `int32` |  | `204`| HTTP status code | `204` |
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
| duration | `query` | string | `string` |  |  |  | Query time-range duration (Golang string duration). Duration starts on</br>`sinceTime` if set, or the time for the first log message if not set. |
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
| level | `query` | string | `string` |  | ✓ |  | The log level for the pod's proxy.</br>off ProxyLogLevelOff</br>trace ProxyLogLevelTrace</br>debug ProxyLogLevelDebug</br>info ProxyLogLevelInfo</br>warning ProxyLogLevelWarning</br>error ProxyLogLevelError</br>critical ProxyLogLevelCritical |

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

All other values, including domain-prefixed values have Implementation-specific support,
which are used in implementation-specific behaviors. Support for additional
predefined CamelCase identifiers may be added in future releases.

+kubebuilder:validation:MinLength=1
+kubebuilder:validation:MaxLength=253
+kubebuilder:validation:Pattern=`^Hostname|IPAddress|NamedAddress|[a-z0-9]([-a-z0-9]*[a-z0-9])?(\.[a-z0-9]([-a-z0-9]*[a-z0-9])?)*\/[A-Za-z0-9\/\-._~%!$&'()*+,;=:]+$`
  



| Name | Type | Go type | Default | Description | Example |
|------|------|---------| ------- |-------------|---------|
| AddressType | string| string | | A predefined CamelCase string identifier (currently limited to `IPAddress` or `Hostname`)</br>A domain-prefixed string identifier (like `acme.io/CustomAddressType`)</br></br>Values `IPAddress` and `Hostname` have Extended support.</br></br>The `NamedAddress` value has been deprecated in favor of implementation</br>specific domain-prefixed strings.</br></br>All other values, including domain-prefixed values have Implementation-specific support,</br>which are used in implementation-specific behaviors. Support for additional</br>predefined CamelCase identifiers may be added in future releases.</br></br>+kubebuilder:validation:MinLength=1</br>+kubebuilder:validation:MaxLength=253</br>+kubebuilder:validation:Pattern=`^Hostname|IPAddress|NamedAddress|[a-z0-9]([-a-z0-9]*[a-z0-9])?(\.[a-z0-9]([-a-z0-9]*[a-z0-9])?)*\/[A-Za-z0-9\/\-._~%!$&'()*+,;=:]+$` |  |



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



### <span id="annotation-value"></span> AnnotationValue


> +kubebuilder:validation:MinLength=0
+kubebuilder:validation:MaxLength=4096
  



| Name | Type | Go type | Default | Description | Example |
|------|------|---------| ------- |-------------|---------|
| AnnotationValue | string| string | | +kubebuilder:validation:MinLength=0</br>+kubebuilder:validation:MaxLength=4096 |  |



### <span id="app"></span> App


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Cluster | string| `string` |  | | Cluster of the application | `east` |
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
| IstioAmbient | boolean| `bool` | ✓ | | Define if any pod has the Ambient annotation | `true` |
| IstioReferences | [][IstioValidationKey](#istio-validation-key)| `[]*IstioValidationKey` |  | | Istio References |  |
| IstioSidecar | boolean| `bool` | ✓ | | Define if all Pods related to the Workloads of this app has an IstioSidecar deployed | `true` |
| Labels | map of string| `map[string]string` |  | | Labels for App |  |
| Name | string| `string` | ✓ | | Name of the application | `reviews` |
| Namespace | string| `string` |  | | Namespace of the application |  |
| health | [AppHealth](#app-health)| `AppHealth` |  | |  |  |



### <span id="authorization-policy"></span> AuthorizationPolicy


> <!-- crd generation tags
+cue-gen:AuthorizationPolicy:groupName:security.istio.io
+cue-gen:AuthorizationPolicy:version:v1
+cue-gen:AuthorizationPolicy:annotations:helm.sh/resource-policy=keep
+cue-gen:AuthorizationPolicy:labels:app=istio-pilot,chart=istio,istio=security,heritage=Tiller,release=istio
+cue-gen:AuthorizationPolicy:subresource:status
+cue-gen:AuthorizationPolicy:scope:Namespaced
+cue-gen:AuthorizationPolicy:resource:categories=istio-io,security-istio-io,shortNames=ap,plural=authorizationpolicies
+cue-gen:AuthorizationPolicy:preserveUnknownFields:false
+cue-gen:AuthorizationPolicy:printerColumn:name=Action,type=string,JSONPath=.spec.action,description="The operation to take."
+cue-gen:AuthorizationPolicy:printerColumn:name=Age,type=date,JSONPath=.metadata.creationTimestamp,description="CreationTimestamp is a timestamp
representing the server time when this object was created. It is not guaranteed to be set in happens-before order across separate operations.
Clients may not set this value. It is represented in RFC3339 form and is in UTC.
Populated by the system. Read-only. Null for lists. More info: https://git.k8s.io/community/contributors/devel/api-conventions.md#metadata"
>

<!-- go code generation tags
+kubetype-gen
+kubetype-gen:groupVersion=security.istio.io/v1
+genclient
+k8s:deepcopy-gen=true
>
<!-- istio code generation tags
+istio.io/sync-from:security/v1beta1/authorization_policy.proto
>
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| APIVersion | string| `string` |  | | APIVersion defines the versioned schema of this representation of an object.</br>Servers should convert recognized schemas to the latest internal value, and</br>may reject unrecognized values.</br>More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#resources</br>+optional |  |
| Annotations | map of string| `map[string]string` |  | | Annotations is an unstructured key value map stored with a resource that may be</br>set by external tools to store and retrieve arbitrary metadata. They are not</br>queryable and should be preserved when modifying objects.</br>More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/annotations</br>+optional |  |
| CreationTimestamp | string| `string` |  | | CreationTimestamp is a timestamp representing the server time when this object was</br>created. It is not guaranteed to be set in happens-before order across separate operations.</br>Clients may not set this value. It is represented in RFC3339 form and is in UTC.</br></br>Populated by the system.</br>Read-only.</br>Null for lists.</br>More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata</br>+optional |  |
| DeletionGracePeriodSeconds | int64 (formatted integer)| `int64` |  | | Number of seconds allowed for this object to gracefully terminate before</br>it will be removed from the system. Only set when deletionTimestamp is also set.</br>May only be shortened.</br>Read-only.</br>+optional |  |
| DeletionTimestamp | string| `string` |  | | DeletionTimestamp is RFC 3339 date and time at which this resource will be deleted. This</br>field is set by the server when a graceful deletion is requested by the user, and is not</br>directly settable by a client. The resource is expected to be deleted (no longer visible</br>from resource lists, and not reachable by name) after the time in this field, once the</br>finalizers list is empty. As long as the finalizers list contains items, deletion is blocked.</br>Once the deletionTimestamp is set, this value may not be unset or be set further into the</br>future, although it may be shortened or the resource may be deleted prior to this time.</br>For example, a user may request that a pod is deleted in 30 seconds. The Kubelet will react</br>by sending a graceful termination signal to the containers in the pod. After that 30 seconds,</br>the Kubelet will send a hard termination signal (SIGKILL) to the container and after cleanup,</br>remove the pod from the API. In the presence of network partitions, this object may still</br>exist after this timestamp, until an administrator or automated process can determine the</br>resource is fully terminated.</br>If not set, graceful deletion of the object has not been requested.</br></br>Populated by the system when a graceful deletion is requested.</br>Read-only.</br>More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata</br>+optional |  |
| Finalizers | []string| `[]string` |  | | Must be empty before the object is deleted from the registry. Each entry</br>is an identifier for the responsible component that will remove the entry</br>from the list. If the deletionTimestamp of the object is non-nil, entries</br>in this list can only be removed.</br>Finalizers may be processed and removed in any order.  Order is NOT enforced</br>because it introduces significant risk of stuck finalizers.</br>finalizers is a shared field, any actor with permission can reorder it.</br>If the finalizer list is processed in order, then this can lead to a situation</br>in which the component responsible for the first finalizer in the list is</br>waiting for a signal (field value, external system, or other) produced by a</br>component responsible for a finalizer later in the list, resulting in a deadlock.</br>Without enforced ordering finalizers are free to order amongst themselves and</br>are not vulnerable to ordering changes in the list.</br>+optional</br>+patchStrategy=merge</br>+listType=set |  |
| GenerateName | string| `string` |  | | GenerateName is an optional prefix, used by the server, to generate a unique</br>name ONLY IF the Name field has not been provided.</br>If this field is used, the name returned to the client will be different</br>than the name passed. This value will also be combined with a unique suffix.</br>The provided value has the same validation rules as the Name field,</br>and may be truncated by the length of the suffix required to make the value</br>unique on the server.</br></br>If this field is specified and the generated name exists, the server will return a 409.</br></br>Applied only if Name is not specified.</br>More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#idempotency</br>+optional |  |
| Generation | int64 (formatted integer)| `int64` |  | | A sequence number representing a specific generation of the desired state.</br>Populated by the system. Read-only.</br>+optional |  |
| Kind | string| `string` |  | | Kind is a string value representing the REST resource this object represents.</br>Servers may infer this from the endpoint the client submits requests to.</br>Cannot be updated.</br>In CamelCase.</br>More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds</br>+optional |  |
| Labels | map of string| `map[string]string` |  | | Map of string keys and values that can be used to organize and categorize</br>(scope and select) objects. May match selectors of replication controllers</br>and services.</br>More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/labels</br>+optional |  |
| ManagedFields | [][ManagedFieldsEntry](#managed-fields-entry)| `[]*ManagedFieldsEntry` |  | | ManagedFields maps workflow-id and version to the set of fields</br>that are managed by that workflow. This is mostly for internal</br>housekeeping, and users typically shouldn't need to set or</br>understand this field. A workflow can be the user's name, a</br>controller's name, or the name of a specific apply path like</br>"ci-cd". The set of fields is always in the version that the</br>workflow used when modifying the object.</br></br>+optional</br>+listType=atomic |  |
| Name | string| `string` |  | | Name must be unique within a namespace. Is required when creating resources, although</br>some resources may allow a client to request the generation of an appropriate name</br>automatically. Name is primarily intended for creation idempotence and configuration</br>definition.</br>Cannot be updated.</br>More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names#names</br>+optional |  |
| Namespace | string| `string` |  | | Namespace defines the space within which each name must be unique. An empty namespace is</br>equivalent to the "default" namespace, but "default" is the canonical representation.</br>Not all objects are required to be scoped to a namespace - the value of this field for</br>those objects will be empty.</br></br>Must be a DNS_LABEL.</br>Cannot be updated.</br>More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/namespaces</br>+optional |  |
| OwnerReferences | [][OwnerReference](#owner-reference)| `[]*OwnerReference` |  | | List of objects depended by this object. If ALL objects in the list have</br>been deleted, this object will be garbage collected. If this object is managed by a controller,</br>then an entry in this list will point to this controller, with the controller field set to true.</br>There cannot be more than one managing controller.</br>+optional</br>+patchMergeKey=uid</br>+patchStrategy=merge</br>+listType=map</br>+listMapKey=uid |  |
| ResourceVersion | string| `string` |  | | An opaque value that represents the internal version of this object that can</br>be used by clients to determine when objects have changed. May be used for optimistic</br>concurrency, change detection, and the watch operation on a resource or set of resources.</br>Clients must treat these values as opaque and passed unmodified back to the server.</br>They may only be valid for a particular resource or set of resources.</br></br>Populated by the system.</br>Read-only.</br>Value must be treated as opaque by clients and .</br>More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#concurrency-control-and-consistency</br>+optional |  |
| SelfLink | string| `string` |  | | Deprecated: selfLink is a legacy read-only field that is no longer populated by the system.</br>+optional |  |
| spec | [AuthorizationPolicy](#authorization-policy)| `AuthorizationPolicy` |  | |  |  |
| status | [IstioStatus](#istio-status)| `IstioStatus` |  | |  |  |
| uid | [UID](#uid)| `UID` |  | |  |  |



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



### <span id="backend-ref"></span> BackendRef


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

Note that when the BackendTLSPolicy object is enabled by the implementation,
there are some extra rules about validity to consider here. See the fields
where this struct is used for more information about the exact behavior.
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Weight | int32 (formatted integer)| `int32` |  | | Weight specifies the proportion of requests forwarded to the referenced</br>backend. This is computed as weight/(sum of all weights in this</br>BackendRefs list). For non-zero values, there may be some epsilon from</br>the exact proportion defined here depending on the precision an</br>implementation supports. Weight is not a percentage and the sum of</br>weights does not need to equal 100.</br></br>If only one backend is specified and it has a weight greater than 0, 100%</br>of the traffic is forwarded to that backend. If weight is set to 0, no</br>traffic should be forwarded for this entry. If unspecified, weight</br>defaults to 1.</br></br>Support for this field varies based on the context where used.</br></br>+optional</br>+kubebuilder:default=1</br>+kubebuilder:validation:Minimum=0</br>+kubebuilder:validation:Maximum=1000000 |  |
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


> Cluster holds some metadata about a cluster that is
part of the mesh.
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Accessible | boolean| `bool` |  | | Accessible specifies if the cluster is accessible or not. Clusters that are manually specified in the Kiali config</br>but do not have an associated remote cluster secret are considered not accessible. This is helpful when you have</br>two disconnected Kialis and want to link them without giving them access to each other. |  |
| ApiEndpoint | string| `string` |  | | ApiEndpoint is the URL where the Kubernetes/Cluster API Server can be contacted |  |
| IsKialiHome | boolean| `bool` |  | | IsKialiHome specifies if this cluster is hosting this Kiali instance (and the observed Mesh Control Plane) |  |
| KialiInstances | [][KialiInstance](#kiali-instance)| `[]*KialiInstance` |  | | KialiInstances is the list of Kialis discovered in the cluster. |  |
| Name | string| `string` |  | | Name specifies the CLUSTER_ID as known by the Control Plane |  |
| Network | string| `string` |  | | Network specifies the logical NETWORK_ID as known by the Control Plane |  |
| SecretName | string| `string` |  | | SecretName is the name of the kubernetes "remote cluster secret" that was mounted to the file system and where data of this cluster was resolved |  |



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
| LastTransitionTime | string| `string` |  | | lastTransitionTime is the last time the condition transitioned from one status to another.</br>This should be when the underlying condition changed.  If that is not known, then using the time when the API field changed is acceptable.</br>+required</br>+kubebuilder:validation:Required</br>+kubebuilder:validation:Type=string</br>+kubebuilder:validation:Format=date-time |  |
| Message | string| `string` |  | | message is a human readable message indicating details about the transition.</br>This may be an empty string.</br>+required</br>+kubebuilder:validation:Required</br>+kubebuilder:validation:MaxLength=32768 |  |
| ObservedGeneration | int64 (formatted integer)| `int64` |  | | observedGeneration represents the .metadata.generation that the condition was set based upon.</br>For instance, if .metadata.generation is currently 12, but the .status.conditions[x].observedGeneration is 9, the condition is out of date</br>with respect to the current state of the instance.</br>+optional</br>+kubebuilder:validation:Minimum=0 |  |
| Reason | string| `string` |  | | reason contains a programmatic identifier indicating the reason for the condition's last transition.</br>Producers of specific condition types may define expected values and meanings for this field,</br>and whether the values are considered a guaranteed API.</br>The value should be a CamelCase string.</br>This field may not be empty.</br>+required</br>+kubebuilder:validation:Required</br>+kubebuilder:validation:MaxLength=1024</br>+kubebuilder:validation:MinLength=1</br>+kubebuilder:validation:Pattern=`^[A-Za-z]([A-Za-z0-9_,:]*[A-Za-z0-9_])?$` |  |
| Type | string| `string` |  | | type of condition in CamelCase or in foo.example.com/CamelCase.</br></br>Many .condition.type values are consistent across resources like Available, but because arbitrary conditions can be</br>useful (see .node.status.conditions), the ability to deconflict is important.</br>The regex it matches is (dns1123SubdomainFmt/)?(qualifiedNameFmt)</br>+required</br>+kubebuilder:validation:Required</br>+kubebuilder:validation:Pattern=`^([a-z0-9]([-a-z0-9]*[a-z0-9])?(\.[a-z0-9]([-a-z0-9]*[a-z0-9])?)*/)?(([A-Za-z0-9][-A-Za-z0-9_.]*)?[A-Za-z0-9])$`</br>+kubebuilder:validation:MaxLength=316 |  |
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
| Cluster | [Cluster](#cluster)| `Cluster` |  | |  |  |
| Config | [ControlPlaneConfiguration](#control-plane-configuration)| `ControlPlaneConfiguration` |  | |  |  |
| ExternalControlPlane | boolean| `bool` |  | | ExternalControlPlane indicates if the controlplane is managing an external cluster. |  |
| ID | string| `string` |  | | ID is the control plane ID as known by istiod. |  |
| IstiodName | string| `string` |  | | IstiodName is the control plane name |  |
| IstiodNamespace | string| `string` |  | | IstiodNamespace is the namespace name of the deployed control plane |  |
| ManagedClusters | [][Cluster](#cluster)| `[]*Cluster` |  | | ManagedClusters are the clusters that this controlplane manages.</br>This could include the cluster that the controlplane is running on. |  |
| ManagesExternal | boolean| `bool` |  | | ManagesExternal indicates if the controlplane manages an external cluster.</br>It could also manage the cluster that it is running on. |  |
| Revision | string| `string` |  | | Revision is the revision of the controlplane.</br>Can be empty when it's the default revision. |  |
| Version | [ExternalServiceInfo](#external-service-info)| `ExternalServiceInfo` |  | |  |  |



### <span id="control-plane-configuration"></span> ControlPlaneConfiguration


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| DefaultConfig | [interface{}](#interface)| `interface{}` |  | |  |  |
| DisableMixerHttpReports | boolean| `bool` |  | |  |  |
| DiscoverySelectors | [][LabelSelector](#label-selector)| `[]*LabelSelector` |  | |  |  |
| EnableAutoMtls | boolean| `bool` |  | |  |  |
| MeshMTLS | [interface{}](#interface)| `interface{}` |  | |  |  |
| Network | string| `string` |  | | Network is the name of the network that the controlplane is using. |  |
| OutboundTrafficPolicy | [OutboundPolicy](#outbound-policy)| `OutboundPolicy` |  | |  |  |
| TrustDomain | string| `string` |  | |  |  |



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
+cue-gen:DestinationRule:version:v1
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
+kubetype-gen:groupVersion=networking.istio.io/v1
+genclient
+k8s:deepcopy-gen=true
>
<!-- istio code generation tags
+istio.io/sync-from:networking/v1alpha3/destination_rule.proto
>
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| APIVersion | string| `string` |  | | APIVersion defines the versioned schema of this representation of an object.</br>Servers should convert recognized schemas to the latest internal value, and</br>may reject unrecognized values.</br>More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#resources</br>+optional |  |
| Annotations | map of string| `map[string]string` |  | | Annotations is an unstructured key value map stored with a resource that may be</br>set by external tools to store and retrieve arbitrary metadata. They are not</br>queryable and should be preserved when modifying objects.</br>More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/annotations</br>+optional |  |
| CreationTimestamp | string| `string` |  | | CreationTimestamp is a timestamp representing the server time when this object was</br>created. It is not guaranteed to be set in happens-before order across separate operations.</br>Clients may not set this value. It is represented in RFC3339 form and is in UTC.</br></br>Populated by the system.</br>Read-only.</br>Null for lists.</br>More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata</br>+optional |  |
| DeletionGracePeriodSeconds | int64 (formatted integer)| `int64` |  | | Number of seconds allowed for this object to gracefully terminate before</br>it will be removed from the system. Only set when deletionTimestamp is also set.</br>May only be shortened.</br>Read-only.</br>+optional |  |
| DeletionTimestamp | string| `string` |  | | DeletionTimestamp is RFC 3339 date and time at which this resource will be deleted. This</br>field is set by the server when a graceful deletion is requested by the user, and is not</br>directly settable by a client. The resource is expected to be deleted (no longer visible</br>from resource lists, and not reachable by name) after the time in this field, once the</br>finalizers list is empty. As long as the finalizers list contains items, deletion is blocked.</br>Once the deletionTimestamp is set, this value may not be unset or be set further into the</br>future, although it may be shortened or the resource may be deleted prior to this time.</br>For example, a user may request that a pod is deleted in 30 seconds. The Kubelet will react</br>by sending a graceful termination signal to the containers in the pod. After that 30 seconds,</br>the Kubelet will send a hard termination signal (SIGKILL) to the container and after cleanup,</br>remove the pod from the API. In the presence of network partitions, this object may still</br>exist after this timestamp, until an administrator or automated process can determine the</br>resource is fully terminated.</br>If not set, graceful deletion of the object has not been requested.</br></br>Populated by the system when a graceful deletion is requested.</br>Read-only.</br>More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata</br>+optional |  |
| Finalizers | []string| `[]string` |  | | Must be empty before the object is deleted from the registry. Each entry</br>is an identifier for the responsible component that will remove the entry</br>from the list. If the deletionTimestamp of the object is non-nil, entries</br>in this list can only be removed.</br>Finalizers may be processed and removed in any order.  Order is NOT enforced</br>because it introduces significant risk of stuck finalizers.</br>finalizers is a shared field, any actor with permission can reorder it.</br>If the finalizer list is processed in order, then this can lead to a situation</br>in which the component responsible for the first finalizer in the list is</br>waiting for a signal (field value, external system, or other) produced by a</br>component responsible for a finalizer later in the list, resulting in a deadlock.</br>Without enforced ordering finalizers are free to order amongst themselves and</br>are not vulnerable to ordering changes in the list.</br>+optional</br>+patchStrategy=merge</br>+listType=set |  |
| GenerateName | string| `string` |  | | GenerateName is an optional prefix, used by the server, to generate a unique</br>name ONLY IF the Name field has not been provided.</br>If this field is used, the name returned to the client will be different</br>than the name passed. This value will also be combined with a unique suffix.</br>The provided value has the same validation rules as the Name field,</br>and may be truncated by the length of the suffix required to make the value</br>unique on the server.</br></br>If this field is specified and the generated name exists, the server will return a 409.</br></br>Applied only if Name is not specified.</br>More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#idempotency</br>+optional |  |
| Generation | int64 (formatted integer)| `int64` |  | | A sequence number representing a specific generation of the desired state.</br>Populated by the system. Read-only.</br>+optional |  |
| Kind | string| `string` |  | | Kind is a string value representing the REST resource this object represents.</br>Servers may infer this from the endpoint the client submits requests to.</br>Cannot be updated.</br>In CamelCase.</br>More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds</br>+optional |  |
| Labels | map of string| `map[string]string` |  | | Map of string keys and values that can be used to organize and categorize</br>(scope and select) objects. May match selectors of replication controllers</br>and services.</br>More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/labels</br>+optional |  |
| ManagedFields | [][ManagedFieldsEntry](#managed-fields-entry)| `[]*ManagedFieldsEntry` |  | | ManagedFields maps workflow-id and version to the set of fields</br>that are managed by that workflow. This is mostly for internal</br>housekeeping, and users typically shouldn't need to set or</br>understand this field. A workflow can be the user's name, a</br>controller's name, or the name of a specific apply path like</br>"ci-cd". The set of fields is always in the version that the</br>workflow used when modifying the object.</br></br>+optional</br>+listType=atomic |  |
| Name | string| `string` |  | | Name must be unique within a namespace. Is required when creating resources, although</br>some resources may allow a client to request the generation of an appropriate name</br>automatically. Name is primarily intended for creation idempotence and configuration</br>definition.</br>Cannot be updated.</br>More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names#names</br>+optional |  |
| Namespace | string| `string` |  | | Namespace defines the space within which each name must be unique. An empty namespace is</br>equivalent to the "default" namespace, but "default" is the canonical representation.</br>Not all objects are required to be scoped to a namespace - the value of this field for</br>those objects will be empty.</br></br>Must be a DNS_LABEL.</br>Cannot be updated.</br>More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/namespaces</br>+optional |  |
| OwnerReferences | [][OwnerReference](#owner-reference)| `[]*OwnerReference` |  | | List of objects depended by this object. If ALL objects in the list have</br>been deleted, this object will be garbage collected. If this object is managed by a controller,</br>then an entry in this list will point to this controller, with the controller field set to true.</br>There cannot be more than one managing controller.</br>+optional</br>+patchMergeKey=uid</br>+patchStrategy=merge</br>+listType=map</br>+listMapKey=uid |  |
| ResourceVersion | string| `string` |  | | An opaque value that represents the internal version of this object that can</br>be used by clients to determine when objects have changed. May be used for optimistic</br>concurrency, change detection, and the watch operation on a resource or set of resources.</br>Clients must treat these values as opaque and passed unmodified back to the server.</br>They may only be valid for a particular resource or set of resources.</br></br>Populated by the system.</br>Read-only.</br>Value must be treated as opaque by clients and .</br>More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#concurrency-control-and-consistency</br>+optional |  |
| SelfLink | string| `string` |  | | Deprecated: selfLink is a legacy read-only field that is no longer populated by the system.</br>+optional |  |
| spec | [DestinationRule](#destination-rule)| `DestinationRule` |  | |  |  |
| status | [IstioStatus](#istio-status)| `IstioStatus` |  | |  |  |
| uid | [UID](#uid)| `UID` |  | |  |  |



### <span id="duration"></span> Duration


> +kubebuilder:validation:Pattern=`^([0-9]{1,5}(h|m|s|ms)){1,4}$`
  



| Name | Type | Go type | Default | Description | Example |
|------|------|---------| ------- |-------------|---------|
| Duration | string| string | | +kubebuilder:validation:Pattern=`^([0-9]{1,5}(h|m|s|ms)){1,4}$` |  |



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
| APIVersion | string| `string` |  | | APIVersion defines the versioned schema of this representation of an object.</br>Servers should convert recognized schemas to the latest internal value, and</br>may reject unrecognized values.</br>More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#resources</br>+optional |  |
| Annotations | map of string| `map[string]string` |  | | Annotations is an unstructured key value map stored with a resource that may be</br>set by external tools to store and retrieve arbitrary metadata. They are not</br>queryable and should be preserved when modifying objects.</br>More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/annotations</br>+optional |  |
| CreationTimestamp | string| `string` |  | | CreationTimestamp is a timestamp representing the server time when this object was</br>created. It is not guaranteed to be set in happens-before order across separate operations.</br>Clients may not set this value. It is represented in RFC3339 form and is in UTC.</br></br>Populated by the system.</br>Read-only.</br>Null for lists.</br>More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata</br>+optional |  |
| DeletionGracePeriodSeconds | int64 (formatted integer)| `int64` |  | | Number of seconds allowed for this object to gracefully terminate before</br>it will be removed from the system. Only set when deletionTimestamp is also set.</br>May only be shortened.</br>Read-only.</br>+optional |  |
| DeletionTimestamp | string| `string` |  | | DeletionTimestamp is RFC 3339 date and time at which this resource will be deleted. This</br>field is set by the server when a graceful deletion is requested by the user, and is not</br>directly settable by a client. The resource is expected to be deleted (no longer visible</br>from resource lists, and not reachable by name) after the time in this field, once the</br>finalizers list is empty. As long as the finalizers list contains items, deletion is blocked.</br>Once the deletionTimestamp is set, this value may not be unset or be set further into the</br>future, although it may be shortened or the resource may be deleted prior to this time.</br>For example, a user may request that a pod is deleted in 30 seconds. The Kubelet will react</br>by sending a graceful termination signal to the containers in the pod. After that 30 seconds,</br>the Kubelet will send a hard termination signal (SIGKILL) to the container and after cleanup,</br>remove the pod from the API. In the presence of network partitions, this object may still</br>exist after this timestamp, until an administrator or automated process can determine the</br>resource is fully terminated.</br>If not set, graceful deletion of the object has not been requested.</br></br>Populated by the system when a graceful deletion is requested.</br>Read-only.</br>More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata</br>+optional |  |
| Finalizers | []string| `[]string` |  | | Must be empty before the object is deleted from the registry. Each entry</br>is an identifier for the responsible component that will remove the entry</br>from the list. If the deletionTimestamp of the object is non-nil, entries</br>in this list can only be removed.</br>Finalizers may be processed and removed in any order.  Order is NOT enforced</br>because it introduces significant risk of stuck finalizers.</br>finalizers is a shared field, any actor with permission can reorder it.</br>If the finalizer list is processed in order, then this can lead to a situation</br>in which the component responsible for the first finalizer in the list is</br>waiting for a signal (field value, external system, or other) produced by a</br>component responsible for a finalizer later in the list, resulting in a deadlock.</br>Without enforced ordering finalizers are free to order amongst themselves and</br>are not vulnerable to ordering changes in the list.</br>+optional</br>+patchStrategy=merge</br>+listType=set |  |
| GenerateName | string| `string` |  | | GenerateName is an optional prefix, used by the server, to generate a unique</br>name ONLY IF the Name field has not been provided.</br>If this field is used, the name returned to the client will be different</br>than the name passed. This value will also be combined with a unique suffix.</br>The provided value has the same validation rules as the Name field,</br>and may be truncated by the length of the suffix required to make the value</br>unique on the server.</br></br>If this field is specified and the generated name exists, the server will return a 409.</br></br>Applied only if Name is not specified.</br>More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#idempotency</br>+optional |  |
| Generation | int64 (formatted integer)| `int64` |  | | A sequence number representing a specific generation of the desired state.</br>Populated by the system. Read-only.</br>+optional |  |
| Kind | string| `string` |  | | Kind is a string value representing the REST resource this object represents.</br>Servers may infer this from the endpoint the client submits requests to.</br>Cannot be updated.</br>In CamelCase.</br>More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds</br>+optional |  |
| Labels | map of string| `map[string]string` |  | | Map of string keys and values that can be used to organize and categorize</br>(scope and select) objects. May match selectors of replication controllers</br>and services.</br>More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/labels</br>+optional |  |
| ManagedFields | [][ManagedFieldsEntry](#managed-fields-entry)| `[]*ManagedFieldsEntry` |  | | ManagedFields maps workflow-id and version to the set of fields</br>that are managed by that workflow. This is mostly for internal</br>housekeeping, and users typically shouldn't need to set or</br>understand this field. A workflow can be the user's name, a</br>controller's name, or the name of a specific apply path like</br>"ci-cd". The set of fields is always in the version that the</br>workflow used when modifying the object.</br></br>+optional</br>+listType=atomic |  |
| Name | string| `string` |  | | Name must be unique within a namespace. Is required when creating resources, although</br>some resources may allow a client to request the generation of an appropriate name</br>automatically. Name is primarily intended for creation idempotence and configuration</br>definition.</br>Cannot be updated.</br>More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names#names</br>+optional |  |
| Namespace | string| `string` |  | | Namespace defines the space within which each name must be unique. An empty namespace is</br>equivalent to the "default" namespace, but "default" is the canonical representation.</br>Not all objects are required to be scoped to a namespace - the value of this field for</br>those objects will be empty.</br></br>Must be a DNS_LABEL.</br>Cannot be updated.</br>More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/namespaces</br>+optional |  |
| OwnerReferences | [][OwnerReference](#owner-reference)| `[]*OwnerReference` |  | | List of objects depended by this object. If ALL objects in the list have</br>been deleted, this object will be garbage collected. If this object is managed by a controller,</br>then an entry in this list will point to this controller, with the controller field set to true.</br>There cannot be more than one managing controller.</br>+optional</br>+patchMergeKey=uid</br>+patchStrategy=merge</br>+listType=map</br>+listMapKey=uid |  |
| ResourceVersion | string| `string` |  | | An opaque value that represents the internal version of this object that can</br>be used by clients to determine when objects have changed. May be used for optimistic</br>concurrency, change detection, and the watch operation on a resource or set of resources.</br>Clients must treat these values as opaque and passed unmodified back to the server.</br>They may only be valid for a particular resource or set of resources.</br></br>Populated by the system.</br>Read-only.</br>Value must be treated as opaque by clients and .</br>More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#concurrency-control-and-consistency</br>+optional |  |
| SelfLink | string| `string` |  | | Deprecated: selfLink is a legacy read-only field that is no longer populated by the system.</br>+optional |  |
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
| Filters | [][GRPCRouteFilter](#g-rpc-route-filter)| `[]*GRPCRouteFilter` |  | | Filters defined at this level MUST be executed if and only if the</br>request is being forwarded to the backend defined here.</br></br>Support: Implementation-specific (For broader support of filters, use the</br>Filters field in GRPCRouteRule.)</br></br>+optional</br>+kubebuilder:validation:MaxItems=16</br>+kubebuilder:validation:XValidation:message="RequestHeaderModifier filter cannot be repeated",rule="self.filter(f, f.type == 'RequestHeaderModifier').size() <= 1"</br>+kubebuilder:validation:XValidation:message="ResponseHeaderModifier filter cannot be repeated",rule="self.filter(f, f.type == 'ResponseHeaderModifier').size() <= 1" |  |
| Weight | int32 (formatted integer)| `int32` |  | | Weight specifies the proportion of requests forwarded to the referenced</br>backend. This is computed as weight/(sum of all weights in this</br>BackendRefs list). For non-zero values, there may be some epsilon from</br>the exact proportion defined here depending on the precision an</br>implementation supports. Weight is not a percentage and the sum of</br>weights does not need to equal 100.</br></br>If only one backend is specified and it has a weight greater than 0, 100%</br>of the traffic is forwarded to that backend. If weight is set to 0, no</br>traffic should be forwarded for this entry. If unspecified, weight</br>defaults to 1.</br></br>Support for this field varies based on the context where used.</br></br>+optional</br>+kubebuilder:default=1</br>+kubebuilder:validation:Minimum=0</br>+kubebuilder:validation:Maximum=1000000 |  |
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
| Value | string| `string` |  | | Value is the value of the gRPC Header to be matched.</br></br>+kubebuilder:validation:MinLength=1</br>+kubebuilder:validation:MaxLength=4096 |  |
| name | [GRPCHeaderName](#g-rpc-header-name)| `GRPCHeaderName` |  | |  |  |
| type | [HeaderMatchType](#header-match-type)| `HeaderMatchType` |  | |  |  |



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
| Method | string| `string` |  | | Value of the method to match against. If left empty or omitted, will</br>match all services.</br></br>At least one of Service and Method MUST be a non-empty string.</br></br>+optional</br>+kubebuilder:validation:MaxLength=1024 |  |
| Service | string| `string` |  | | Value of the service to match against. If left empty or omitted, will</br>match any service.</br></br>At least one of Service and Method MUST be a non-empty string.</br></br>+optional</br>+kubebuilder:validation:MaxLength=1024 |  |
| type | [GRPCMethodMatchType](#g-rpc-method-match-type)| `GRPCMethodMatchType` |  | |  |  |



### <span id="g-rpc-method-match-type"></span> GRPCMethodMatchType


> "Exact" - Core
"RegularExpression" - Implementation Specific

Exact methods MUST be syntactically valid:

Must not contain `/` character

+kubebuilder:validation:Enum=Exact;RegularExpression
  



| Name | Type | Go type | Default | Description | Example |
|------|------|---------| ------- |-------------|---------|
| GRPCMethodMatchType | string| string | | "Exact" - Core</br>"RegularExpression" - Implementation Specific</br></br>Exact methods MUST be syntactically valid:</br></br>Must not contain `/` character</br></br>+kubebuilder:validation:Enum=Exact;RegularExpression |  |



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
| APIVersion | string| `string` |  | | APIVersion defines the versioned schema of this representation of an object.</br>Servers should convert recognized schemas to the latest internal value, and</br>may reject unrecognized values.</br>More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#resources</br>+optional |  |
| Annotations | map of string| `map[string]string` |  | | Annotations is an unstructured key value map stored with a resource that may be</br>set by external tools to store and retrieve arbitrary metadata. They are not</br>queryable and should be preserved when modifying objects.</br>More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/annotations</br>+optional |  |
| CreationTimestamp | string| `string` |  | | CreationTimestamp is a timestamp representing the server time when this object was</br>created. It is not guaranteed to be set in happens-before order across separate operations.</br>Clients may not set this value. It is represented in RFC3339 form and is in UTC.</br></br>Populated by the system.</br>Read-only.</br>Null for lists.</br>More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata</br>+optional |  |
| DeletionGracePeriodSeconds | int64 (formatted integer)| `int64` |  | | Number of seconds allowed for this object to gracefully terminate before</br>it will be removed from the system. Only set when deletionTimestamp is also set.</br>May only be shortened.</br>Read-only.</br>+optional |  |
| DeletionTimestamp | string| `string` |  | | DeletionTimestamp is RFC 3339 date and time at which this resource will be deleted. This</br>field is set by the server when a graceful deletion is requested by the user, and is not</br>directly settable by a client. The resource is expected to be deleted (no longer visible</br>from resource lists, and not reachable by name) after the time in this field, once the</br>finalizers list is empty. As long as the finalizers list contains items, deletion is blocked.</br>Once the deletionTimestamp is set, this value may not be unset or be set further into the</br>future, although it may be shortened or the resource may be deleted prior to this time.</br>For example, a user may request that a pod is deleted in 30 seconds. The Kubelet will react</br>by sending a graceful termination signal to the containers in the pod. After that 30 seconds,</br>the Kubelet will send a hard termination signal (SIGKILL) to the container and after cleanup,</br>remove the pod from the API. In the presence of network partitions, this object may still</br>exist after this timestamp, until an administrator or automated process can determine the</br>resource is fully terminated.</br>If not set, graceful deletion of the object has not been requested.</br></br>Populated by the system when a graceful deletion is requested.</br>Read-only.</br>More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata</br>+optional |  |
| Finalizers | []string| `[]string` |  | | Must be empty before the object is deleted from the registry. Each entry</br>is an identifier for the responsible component that will remove the entry</br>from the list. If the deletionTimestamp of the object is non-nil, entries</br>in this list can only be removed.</br>Finalizers may be processed and removed in any order.  Order is NOT enforced</br>because it introduces significant risk of stuck finalizers.</br>finalizers is a shared field, any actor with permission can reorder it.</br>If the finalizer list is processed in order, then this can lead to a situation</br>in which the component responsible for the first finalizer in the list is</br>waiting for a signal (field value, external system, or other) produced by a</br>component responsible for a finalizer later in the list, resulting in a deadlock.</br>Without enforced ordering finalizers are free to order amongst themselves and</br>are not vulnerable to ordering changes in the list.</br>+optional</br>+patchStrategy=merge</br>+listType=set |  |
| GenerateName | string| `string` |  | | GenerateName is an optional prefix, used by the server, to generate a unique</br>name ONLY IF the Name field has not been provided.</br>If this field is used, the name returned to the client will be different</br>than the name passed. This value will also be combined with a unique suffix.</br>The provided value has the same validation rules as the Name field,</br>and may be truncated by the length of the suffix required to make the value</br>unique on the server.</br></br>If this field is specified and the generated name exists, the server will return a 409.</br></br>Applied only if Name is not specified.</br>More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#idempotency</br>+optional |  |
| Generation | int64 (formatted integer)| `int64` |  | | A sequence number representing a specific generation of the desired state.</br>Populated by the system. Read-only.</br>+optional |  |
| Kind | string| `string` |  | | Kind is a string value representing the REST resource this object represents.</br>Servers may infer this from the endpoint the client submits requests to.</br>Cannot be updated.</br>In CamelCase.</br>More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds</br>+optional |  |
| Labels | map of string| `map[string]string` |  | | Map of string keys and values that can be used to organize and categorize</br>(scope and select) objects. May match selectors of replication controllers</br>and services.</br>More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/labels</br>+optional |  |
| ManagedFields | [][ManagedFieldsEntry](#managed-fields-entry)| `[]*ManagedFieldsEntry` |  | | ManagedFields maps workflow-id and version to the set of fields</br>that are managed by that workflow. This is mostly for internal</br>housekeeping, and users typically shouldn't need to set or</br>understand this field. A workflow can be the user's name, a</br>controller's name, or the name of a specific apply path like</br>"ci-cd". The set of fields is always in the version that the</br>workflow used when modifying the object.</br></br>+optional</br>+listType=atomic |  |
| Name | string| `string` |  | | Name must be unique within a namespace. Is required when creating resources, although</br>some resources may allow a client to request the generation of an appropriate name</br>automatically. Name is primarily intended for creation idempotence and configuration</br>definition.</br>Cannot be updated.</br>More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names#names</br>+optional |  |
| Namespace | string| `string` |  | | Namespace defines the space within which each name must be unique. An empty namespace is</br>equivalent to the "default" namespace, but "default" is the canonical representation.</br>Not all objects are required to be scoped to a namespace - the value of this field for</br>those objects will be empty.</br></br>Must be a DNS_LABEL.</br>Cannot be updated.</br>More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/namespaces</br>+optional |  |
| OwnerReferences | [][OwnerReference](#owner-reference)| `[]*OwnerReference` |  | | List of objects depended by this object. If ALL objects in the list have</br>been deleted, this object will be garbage collected. If this object is managed by a controller,</br>then an entry in this list will point to this controller, with the controller field set to true.</br>There cannot be more than one managing controller.</br>+optional</br>+patchMergeKey=uid</br>+patchStrategy=merge</br>+listType=map</br>+listMapKey=uid |  |
| ResourceVersion | string| `string` |  | | An opaque value that represents the internal version of this object that can</br>be used by clients to determine when objects have changed. May be used for optimistic</br>concurrency, change detection, and the watch operation on a resource or set of resources.</br>Clients must treat these values as opaque and passed unmodified back to the server.</br>They may only be valid for a particular resource or set of resources.</br></br>Populated by the system.</br>Read-only.</br>Value must be treated as opaque by clients and .</br>More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#concurrency-control-and-consistency</br>+optional |  |
| SelfLink | string| `string` |  | | Deprecated: selfLink is a legacy read-only field that is no longer populated by the system.</br>+optional |  |
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
| Headers | [][GRPCHeaderMatch](#g-rpc-header-match)| `[]*GRPCHeaderMatch` |  | | Headers specifies gRPC request header matchers. Multiple match values are</br>ANDed together, meaning, a request MUST match all the specified headers</br>to select the route.</br></br>+listType=map</br>+listMapKey=name</br>+optional</br>+kubebuilder:validation:MaxItems=16 |  |
| method | [GRPCMethodMatch](#g-rpc-method-match)| `GRPCMethodMatch` |  | |  |  |



### <span id="g-rpc-route-rule"></span> GRPCRouteRule


> GRPCRouteRule defines the semantics for matching a gRPC request based on
conditions (matches), processing it (filters), and forwarding the request to
an API object (backendRefs).
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| BackendRefs | [][GRPCBackendRef](#g-rpc-backend-ref)| `[]*GRPCBackendRef` |  | | BackendRefs defines the backend(s) where matching requests should be</br>sent.</br></br>Failure behavior here depends on how many BackendRefs are specified and</br>how many are invalid.</br></br>If *all* entries in BackendRefs are invalid, and there are also no filters</br>specified in this route rule, *all* traffic which matches this rule MUST</br>receive an `UNAVAILABLE` status.</br></br>See the GRPCBackendRef definition for the rules about what makes a single</br>GRPCBackendRef invalid.</br></br>When a GRPCBackendRef is invalid, `UNAVAILABLE` statuses MUST be returned for</br>requests that would have otherwise been routed to an invalid backend. If</br>multiple backends are specified, and some are invalid, the proportion of</br>requests that would otherwise have been routed to an invalid backend</br>MUST receive an `UNAVAILABLE` status.</br></br>For example, if two backends are specified with equal weights, and one is</br>invalid, 50 percent of traffic MUST receive an `UNAVAILABLE` status.</br>Implementations may choose how that 50 percent is determined.</br></br>Support: Core for Kubernetes Service</br></br>Support: Implementation-specific for any other resource</br></br>Support for weight: Core</br></br>+optional</br>+kubebuilder:validation:MaxItems=16 |  |
| Filters | [][GRPCRouteFilter](#g-rpc-route-filter)| `[]*GRPCRouteFilter` |  | | Filters define the filters that are applied to requests that match</br>this rule.</br></br>The effects of ordering of multiple behaviors are currently unspecified.</br>This can change in the future based on feedback during the alpha stage.</br></br>Conformance-levels at this level are defined based on the type of filter:</br></br>ALL core filters MUST be supported by all implementations that support</br>GRPCRoute.</br>Implementers are encouraged to support extended filters.</br>Implementation-specific custom filters have no API guarantees across</br>implementations.</br></br>Specifying the same filter multiple times is not supported unless explicitly</br>indicated in the filter.</br></br>If an implementation can not support a combination of filters, it must clearly</br>document that limitation. In cases where incompatible or unsupported</br>filters are specified and cause the `Accepted` condition to be set to status</br>`False`, implementations may use the `IncompatibleFilters` reason to specify</br>this configuration error.</br></br>Support: Core</br></br>+optional</br>+kubebuilder:validation:MaxItems=16</br>+kubebuilder:validation:XValidation:message="RequestHeaderModifier filter cannot be repeated",rule="self.filter(f, f.type == 'RequestHeaderModifier').size() <= 1"</br>+kubebuilder:validation:XValidation:message="ResponseHeaderModifier filter cannot be repeated",rule="self.filter(f, f.type == 'ResponseHeaderModifier').size() <= 1" |  |
| Matches | [][GRPCRouteMatch](#g-rpc-route-match)| `[]*GRPCRouteMatch` |  | | Matches define conditions used for matching the rule against incoming</br>gRPC requests. Each match is independent, i.e. this rule will be matched</br>if **any** one of the matches is satisfied.</br></br>For example, take the following matches configuration:</br></br>```</br>matches:</br>method:</br>service: foo.bar</br>headers:</br>values:</br>version: 2</br>method:</br>service: foo.bar.v2</br>```</br></br>For a request to match against this rule, it MUST satisfy</br>EITHER of the two conditions:</br></br>service of foo.bar AND contains the header `version: 2`</br>service of foo.bar.v2</br></br>See the documentation for GRPCRouteMatch on how to specify multiple</br>match conditions to be ANDed together.</br></br>If no matches are specified, the implementation MUST match every gRPC request.</br></br>Proxy or Load Balancer routing configuration generated from GRPCRoutes</br>MUST prioritize rules based on the following criteria, continuing on</br>ties. Merging MUST not be done between GRPCRoutes and HTTPRoutes.</br>Precedence MUST be given to the rule with the largest number of:</br></br>Characters in a matching non-wildcard hostname.</br>Characters in a matching hostname.</br>Characters in a matching service.</br>Characters in a matching method.</br>Header matches.</br></br>If ties still exist across multiple Routes, matching precedence MUST be</br>determined in order of the following criteria, continuing on ties:</br></br>The oldest Route based on creation timestamp.</br>The Route appearing first in alphabetical order by</br>"{namespace}/{name}".</br></br>If ties still exist within the Route that has been given precedence,</br>matching precedence MUST be granted to the first matching rule meeting</br>the above criteria.</br></br>+optional</br>+kubebuilder:validation:MaxItems=8 |  |
| sessionPersistence | [SessionPersistence](#session-persistence)| `SessionPersistence` |  | |  |  |



### <span id="g-rpc-route-spec"></span> GRPCRouteSpec


> GRPCRouteSpec defines the desired state of GRPCRoute
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Hostnames | [][Hostname](#hostname)| `[]Hostname` |  | | Hostnames defines a set of hostnames to match against the GRPC</br>Host header to select a GRPCRoute to process the request. This matches</br>the RFC 1123 definition of a hostname with 2 notable exceptions:</br></br>1. IPs are not allowed.</br>2. A hostname may be prefixed with a wildcard label (`*.`). The wildcard</br>label MUST appear by itself as the first label.</br></br>If a hostname is specified by both the Listener and GRPCRoute, there</br>MUST be at least one intersecting hostname for the GRPCRoute to be |  |
| ParentRefs | [][ParentReference](#parent-reference)| `[]*ParentReference` |  | | ParentRefs references the resources (usually Gateways) that a Route wants</br>to be attached to. Note that the referenced parent resource needs to</br>allow this for the attachment to be complete. For Gateways, that means</br>the Gateway needs to allow attachment from Routes of this kind and</br>namespace. For Services, that means the Service must either be in the same</br>namespace for a "producer" route, or the mesh implementation must support</br>and allow "consumer" routes for the referenced Service. ReferenceGrant is</br>not applicable for governing ParentRefs to Services - it is not possible to</br>create a "producer" route for a Service in a different namespace from the</br>Route.</br></br>There are two kinds of parent resources with "Core" support:</br></br>Gateway (Gateway conformance profile)</br>Service (Mesh conformance profile, ClusterIP Services only)</br></br>This API may be extended in the future to support additional kinds of parent</br>resources.</br></br>ParentRefs must be _distinct_. This means either that:</br></br>They select different objects.  If this is the case, then parentRef</br>entries are distinct. In terms of fields, this means that the</br>multi-part key defined by `group`, `kind`, `namespace`, and `name` must</br>be unique across all parentRef entries in the Route.</br>They do not select different objects, but for each optional field used,</br>each ParentRef that selects the same object must set the same set of</br>optional fields to different values. If one ParentRef sets a</br>combination of optional fields, all must set the same combination.</br></br>Some examples:</br></br>If one ParentRef sets `sectionName`, all ParentRefs referencing the</br>same object must also set `sectionName`.</br>If one ParentRef sets `port`, all ParentRefs referencing the same</br>object must also set `port`.</br>If one ParentRef sets `sectionName` and `port`, all ParentRefs</br>referencing the same object must also set `sectionName` and `port`.</br></br>It is possible to separately reference multiple distinct objects that may</br>be collapsed by an implementation. For example, some implementations may</br>choose to merge compatible Gateway Listeners together. If that is the</br>case, the list of routes attached to those resources should also be</br>merged.</br></br>Note that for ParentRefs that cross namespace boundaries, there are specific</br>rules. Cross-namespace references are only valid if they are explicitly</br>allowed by something in the namespace they are referring to. For example,</br>Gateway has the AllowedRoutes field, and ReferenceGrant provides a</br>generic way to enable other kinds of cross-namespace reference.</br></br><gateway:experimental:description></br>ParentRefs from a Route to a Service in the same namespace are "producer"</br>routes, which apply default routing rules to inbound connections from</br>any namespace to the Service.</br></br>ParentRefs from a Route to a Service in a different namespace are</br>"consumer" routes, and these routing rules are only applied to outbound</br>connections originating from the same namespace as the Route, for which</br>the intended destination of the connections are a Service targeted as a</br>ParentRef of the Route.</br></gateway:experimental:description></br></br>+optional</br>+kubebuilder:validation:MaxItems=32</br><gateway:standard:validation:XValidation:message="sectionName must be specified when parentRefs includes 2 or more references to the same parent",rule="self.all(p1, self.all(p2, p1.group == p2.group && p1.kind == p2.kind && p1.name == p2.name && (((!has(p1.__namespace__) || p1.__namespace__ == '') && (!has(p2.__namespace__) || p2.__namespace__ == '')) || (has(p1.__namespace__) && has(p2.__namespace__) && p1.__namespace__ == p2.__namespace__ )) ? ((!has(p1.sectionName) || p1.sectionName == '') == (!has(p2.sectionName) || p2.sectionName == '')) : true))"></br><gateway:standard:validation:XValidation:message="sectionName must be unique when parentRefs includes 2 or more references to the same parent",rule="self.all(p1, self.exists_one(p2, p1.group == p2.group && p1.kind == p2.kind && p1.name == p2.name && (((!has(p1.__namespace__) || p1.__namespace__ == '') && (!has(p2.__namespace__) || p2.__namespace__ == '')) || (has(p1.__namespace__) && has(p2.__namespace__) && p1.__namespace__ == p2.__namespace__ )) && (((!has(p1.sectionName) || p1.sectionName == '') && (!has(p2.sectionName) || p2.sectionName == '')) || (has(p1.sectionName) && has(p2.sectionName) && p1.sectionName == p2.sectionName))))"></br><gateway:experimental:validation:XValidation:message="sectionName or port must be specified when parentRefs includes 2 or more references to the same parent",rule="self.all(p1, self.all(p2, p1.group == p2.group && p1.kind == p2.kind && p1.name == p2.name && (((!has(p1.__namespace__) || p1.__namespace__ == '') && (!has(p2.__namespace__) || p2.__namespace__ == '')) || (has(p1.__namespace__) && has(p2.__namespace__) && p1.__namespace__ == p2.__namespace__)) ? ((!has(p1.sectionName) || p1.sectionName == '') == (!has(p2.sectionName) || p2.sectionName == '') && (!has(p1.port) || p1.port == 0) == (!has(p2.port) || p2.port == 0)): true))"></br><gateway:experimental:validation:XValidation:message="sectionName or port must be unique when parentRefs includes 2 or more references to the same parent",rule="self.all(p1, self.exists_one(p2, p1.group == p2.group && p1.kind == p2.kind && p1.name == p2.name && (((!has(p1.__namespace__) || p1.__namespace__ == '') && (!has(p2.__namespace__) || p2.__namespace__ == '')) || (has(p1.__namespace__) && has(p2.__namespace__) && p1.__namespace__ == p2.__namespace__ )) && (((!has(p1.sectionName) || p1.sectionName == '') && (!has(p2.sectionName) || p2.sectionName == '')) || ( has(p1.sectionName) && has(p2.sectionName) && p1.sectionName == p2.sectionName)) && (((!has(p1.port) || p1.port == 0) && (!has(p2.port) || p2.port == 0)) || (has(p1.port) && has(p2.port) && p1.port == p2.port))))"> |  |
| Rules | [][GRPCRouteRule](#g-rpc-route-rule)| `[]*GRPCRouteRule` |  | | Rules are a list of GRPC matchers, filters and actions.</br></br>+optional</br>+kubebuilder:validation:MaxItems=16 |  |



### <span id="g-rpc-route-status"></span> GRPCRouteStatus


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Parents | [][RouteParentStatus](#route-parent-status)| `[]*RouteParentStatus` |  | | Parents is a list of parent resources (usually Gateways) that are</br>associated with the route, and the status of the route with respect to</br>each parent. When this route attaches to a parent, the controller that</br>manages the parent must add an entry to this list when the controller</br>first sees the route and should update the entry as appropriate when the</br>route or gateway is modified.</br></br>Note that parent references that cannot be resolved by an implementation</br>of this API will not be added to this list. Implementations of this API</br>can only populate Route status for the Gateways/parent resources they are</br>responsible for.</br></br>A maximum of 32 Gateways will be represented in this list. An empty list</br>means the route has not been attached to any Gateway.</br></br>+kubebuilder:validation:MaxItems=32 |  |



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
| APIVersion | string| `string` |  | | APIVersion defines the versioned schema of this representation of an object.</br>Servers should convert recognized schemas to the latest internal value, and</br>may reject unrecognized values.</br>More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#resources</br>+optional |  |
| Annotations | map of string| `map[string]string` |  | | Annotations is an unstructured key value map stored with a resource that may be</br>set by external tools to store and retrieve arbitrary metadata. They are not</br>queryable and should be preserved when modifying objects.</br>More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/annotations</br>+optional |  |
| CreationTimestamp | string| `string` |  | | CreationTimestamp is a timestamp representing the server time when this object was</br>created. It is not guaranteed to be set in happens-before order across separate operations.</br>Clients may not set this value. It is represented in RFC3339 form and is in UTC.</br></br>Populated by the system.</br>Read-only.</br>Null for lists.</br>More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata</br>+optional |  |
| DeletionGracePeriodSeconds | int64 (formatted integer)| `int64` |  | | Number of seconds allowed for this object to gracefully terminate before</br>it will be removed from the system. Only set when deletionTimestamp is also set.</br>May only be shortened.</br>Read-only.</br>+optional |  |
| DeletionTimestamp | string| `string` |  | | DeletionTimestamp is RFC 3339 date and time at which this resource will be deleted. This</br>field is set by the server when a graceful deletion is requested by the user, and is not</br>directly settable by a client. The resource is expected to be deleted (no longer visible</br>from resource lists, and not reachable by name) after the time in this field, once the</br>finalizers list is empty. As long as the finalizers list contains items, deletion is blocked.</br>Once the deletionTimestamp is set, this value may not be unset or be set further into the</br>future, although it may be shortened or the resource may be deleted prior to this time.</br>For example, a user may request that a pod is deleted in 30 seconds. The Kubelet will react</br>by sending a graceful termination signal to the containers in the pod. After that 30 seconds,</br>the Kubelet will send a hard termination signal (SIGKILL) to the container and after cleanup,</br>remove the pod from the API. In the presence of network partitions, this object may still</br>exist after this timestamp, until an administrator or automated process can determine the</br>resource is fully terminated.</br>If not set, graceful deletion of the object has not been requested.</br></br>Populated by the system when a graceful deletion is requested.</br>Read-only.</br>More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata</br>+optional |  |
| Finalizers | []string| `[]string` |  | | Must be empty before the object is deleted from the registry. Each entry</br>is an identifier for the responsible component that will remove the entry</br>from the list. If the deletionTimestamp of the object is non-nil, entries</br>in this list can only be removed.</br>Finalizers may be processed and removed in any order.  Order is NOT enforced</br>because it introduces significant risk of stuck finalizers.</br>finalizers is a shared field, any actor with permission can reorder it.</br>If the finalizer list is processed in order, then this can lead to a situation</br>in which the component responsible for the first finalizer in the list is</br>waiting for a signal (field value, external system, or other) produced by a</br>component responsible for a finalizer later in the list, resulting in a deadlock.</br>Without enforced ordering finalizers are free to order amongst themselves and</br>are not vulnerable to ordering changes in the list.</br>+optional</br>+patchStrategy=merge</br>+listType=set |  |
| GenerateName | string| `string` |  | | GenerateName is an optional prefix, used by the server, to generate a unique</br>name ONLY IF the Name field has not been provided.</br>If this field is used, the name returned to the client will be different</br>than the name passed. This value will also be combined with a unique suffix.</br>The provided value has the same validation rules as the Name field,</br>and may be truncated by the length of the suffix required to make the value</br>unique on the server.</br></br>If this field is specified and the generated name exists, the server will return a 409.</br></br>Applied only if Name is not specified.</br>More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#idempotency</br>+optional |  |
| Generation | int64 (formatted integer)| `int64` |  | | A sequence number representing a specific generation of the desired state.</br>Populated by the system. Read-only.</br>+optional |  |
| Kind | string| `string` |  | | Kind is a string value representing the REST resource this object represents.</br>Servers may infer this from the endpoint the client submits requests to.</br>Cannot be updated.</br>In CamelCase.</br>More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds</br>+optional |  |
| Labels | map of string| `map[string]string` |  | | Map of string keys and values that can be used to organize and categorize</br>(scope and select) objects. May match selectors of replication controllers</br>and services.</br>More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/labels</br>+optional |  |
| ManagedFields | [][ManagedFieldsEntry](#managed-fields-entry)| `[]*ManagedFieldsEntry` |  | | ManagedFields maps workflow-id and version to the set of fields</br>that are managed by that workflow. This is mostly for internal</br>housekeeping, and users typically shouldn't need to set or</br>understand this field. A workflow can be the user's name, a</br>controller's name, or the name of a specific apply path like</br>"ci-cd". The set of fields is always in the version that the</br>workflow used when modifying the object.</br></br>+optional</br>+listType=atomic |  |
| Name | string| `string` |  | | Name must be unique within a namespace. Is required when creating resources, although</br>some resources may allow a client to request the generation of an appropriate name</br>automatically. Name is primarily intended for creation idempotence and configuration</br>definition.</br>Cannot be updated.</br>More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names#names</br>+optional |  |
| Namespace | string| `string` |  | | Namespace defines the space within which each name must be unique. An empty namespace is</br>equivalent to the "default" namespace, but "default" is the canonical representation.</br>Not all objects are required to be scoped to a namespace - the value of this field for</br>those objects will be empty.</br></br>Must be a DNS_LABEL.</br>Cannot be updated.</br>More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/namespaces</br>+optional |  |
| OwnerReferences | [][OwnerReference](#owner-reference)| `[]*OwnerReference` |  | | List of objects depended by this object. If ALL objects in the list have</br>been deleted, this object will be garbage collected. If this object is managed by a controller,</br>then an entry in this list will point to this controller, with the controller field set to true.</br>There cannot be more than one managing controller.</br>+optional</br>+patchMergeKey=uid</br>+patchStrategy=merge</br>+listType=map</br>+listMapKey=uid |  |
| ResourceVersion | string| `string` |  | | An opaque value that represents the internal version of this object that can</br>be used by clients to determine when objects have changed. May be used for optimistic</br>concurrency, change detection, and the watch operation on a resource or set of resources.</br>Clients must treat these values as opaque and passed unmodified back to the server.</br>They may only be valid for a particular resource or set of resources.</br></br>Populated by the system.</br>Read-only.</br>Value must be treated as opaque by clients and .</br>More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#concurrency-control-and-consistency</br>+optional |  |
| SelfLink | string| `string` |  | | Deprecated: selfLink is a legacy read-only field that is no longer populated by the system.</br>+optional |  |
| spec | [GatewaySpec](#gateway-spec)| `GatewaySpec` |  | |  |  |
| status | [GatewayStatus](#gateway-status)| `GatewayStatus` |  | |  |  |
| uid | [UID](#uid)| `UID` |  | |  |  |



### <span id="gateway-address"></span> GatewayAddress


> +kubebuilder:validation:XValidation:message="Hostname value must only contain valid characters (matching ^(\\*\\.)?[a-z0-9]([-a-z0-9]*[a-z0-9])?(\\.[a-z0-9]([-a-z0-9]*[a-z0-9])?)*$)",rule="self.type == 'Hostname' ? self.value.matches(r\"\"\"^(\\*\\.)?[a-z0-9]([-a-z0-9]*[a-z0-9])?(\\.[a-z0-9]([-a-z0-9]*[a-z0-9])?)*$\"\"\"): true"
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Value | string| `string` |  | | Value of the address. The validity of the values will depend</br>on the type and support by the controller.</br></br>Examples: `1.2.3.4`, `128::1`, `my-ip-address`.</br></br>+kubebuilder:validation:MinLength=1</br>+kubebuilder:validation:MaxLength=253 |  |
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
| GatewayController | string| string | | Valid values include:</br></br>"example.com/bar"</br></br>Invalid values include:</br></br>"example.com" - must include path</br>"foo.example.com" - must include path</br></br>+kubebuilder:validation:MinLength=1</br>+kubebuilder:validation:MaxLength=253</br>+kubebuilder:validation:Pattern=`^[a-z0-9]([-a-z0-9]*[a-z0-9])?(\.[a-z0-9]([-a-z0-9]*[a-z0-9])?)*\/[A-Za-z0-9\/\-._~%!$&'()*+,;=:]+$` |  |



### <span id="gateway-infrastructure"></span> GatewayInfrastructure


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Annotations | map of [AnnotationValue](#annotation-value)| `map[string]AnnotationValue` |  | | Annotations that SHOULD be applied to any resources created in response to this Gateway.</br></br>For implementations creating other Kubernetes objects, this should be the `metadata.annotations` field on resources.</br>For other implementations, this refers to any relevant (implementation specific) "annotations" concepts.</br></br>An implementation may chose to add additional implementation-specific annotations as they see fit.</br></br>Support: Extended</br></br>+optional</br>+kubebuilder:validation:MaxProperties=8 |  |
| Labels | map of [AnnotationValue](#annotation-value)| `map[string]AnnotationValue` |  | | Labels that SHOULD be applied to any resources created in response to this Gateway.</br></br>For implementations creating other Kubernetes objects, this should be the `metadata.labels` field on resources.</br>For other implementations, this refers to any relevant (implementation specific) "labels" concepts.</br></br>An implementation may chose to add additional implementation-specific labels as they see fit.</br></br>Support: Extended</br></br>+optional</br>+kubebuilder:validation:MaxProperties=8 |  |
| parametersRef | [LocalParametersReference](#local-parameters-reference)| `LocalParametersReference` |  | |  |  |



### <span id="gateway-spec"></span> GatewaySpec


> Not all possible combinations of options specified in the Spec are
valid. Some invalid configurations can be caught synchronously via CRD
validation, but there are many cases that will require asynchronous
signaling via the GatewayStatus block.
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Addresses | [][GatewayAddress](#gateway-address)| `[]*GatewayAddress` |  | | Addresses requested for this Gateway. This is optional and behavior can</br>depend on the implementation. If a value is set in the spec and the</br>requested address is invalid or unavailable, the implementation MUST</br>indicate this in the associated entry in GatewayStatus.Addresses.</br></br>The Addresses field represents a request for the address(es) on the</br>"outside of the Gateway", that traffic bound for this Gateway will use.</br>This could be the IP address or hostname of an external load balancer or</br>other networking infrastructure, or some other address that traffic will</br>be sent to.</br></br>If no Addresses are specified, the implementation MAY schedule the</br>Gateway in an implementation-specific manner, assigning an appropriate</br>set of Addresses.</br></br>The implementation MUST bind all Listeners to every GatewayAddress that</br>it assigns to the Gateway and add a corresponding entry in</br>GatewayStatus.Addresses.</br></br>Support: Extended</br></br>+optional</br><gateway:validateIPAddress></br>+kubebuilder:validation:MaxItems=16</br>+kubebuilder:validation:XValidation:message="IPAddress values must be unique",rule="self.all(a1, a1.type == 'IPAddress' ? self.exists_one(a2, a2.type == a1.type && a2.value == a1.value) : true )"</br>+kubebuilder:validation:XValidation:message="Hostname values must be unique",rule="self.all(a1, a1.type == 'Hostname' ? self.exists_one(a2, a2.type == a1.type && a2.value == a1.value) : true )" |  |
| Listeners | [][Listener](#listener)| `[]*Listener` |  | | Listeners associated with this Gateway. Listeners define</br>logical endpoints that are bound on this Gateway's addresses.</br>At least one Listener MUST be specified.</br></br>Each Listener in a set of Listeners (for example, in a single Gateway)</br>MUST be _distinct_, in that a traffic flow MUST be able to be assigned to</br>exactly one listener. (This section uses "set of Listeners" rather than</br>"Listeners in a single Gateway" because implementations MAY merge configuration</br>from multiple Gateways onto a single data plane, and these rules _also_</br>apply in that case).</br></br>Practically, this means that each listener in a set MUST have a unique</br>combination of Port, Protocol, and, if supported by the protocol, Hostname.</br></br>Some combinations of port, protocol, and TLS settings are considered</br>Core support and MUST be supported by implementations based on their</br>targeted conformance profile:</br></br>HTTP Profile</br></br>1. HTTPRoute, Port: 80, Protocol: HTTP</br>2. HTTPRoute, Port: 443, Protocol: HTTPS, TLS Mode: Terminate, TLS keypair provided</br></br>TLS Profile</br></br>1. TLSRoute, Port: 443, Protocol: TLS, TLS Mode: Passthrough</br></br>"Distinct" Listeners have the following property:</br></br>The implementation can match inbound requests to a single distinct</br>Listener. When multiple Listeners share values for fields (for</br>example, two Listeners with the same Port value), the implementation</br>can match requests to only one of the Listeners using other</br>Listener fields.</br></br>For example, the following Listener scenarios are distinct:</br></br>1. Multiple Listeners with the same Port that all use the "HTTP"</br>Protocol that all have unique Hostname values.</br>2. Multiple Listeners with the same Port that use either the "HTTPS" or</br>"TLS" Protocol that all have unique Hostname values.</br>3. A mixture of "TCP" and "UDP" Protocol Listeners, where no Listener</br>with the same Protocol has the same Port value.</br></br>Some fields in the Listener struct have possible values that affect</br>whether the Listener is distinct. Hostname is particularly relevant</br>for HTTP or HTTPS protocols.</br></br>When using the Hostname value to select between same-Port, same-Protocol</br>Listeners, the Hostname value must be different on each Listener for the</br>Listener to be distinct.</br></br>When the Listeners are distinct based on Hostname, inbound request</br>hostnames MUST match from the most specific to least specific Hostname</br>values to choose the correct Listener and its associated set of Routes.</br></br>Exact matches must be processed before wildcard matches, and wildcard</br>matches must be processed before fallback (empty Hostname value)</br>matches. For example, `"foo.example.com"` takes precedence over</br>`"*.example.com"`, and `"*.example.com"` takes precedence over `""`.</br></br>Additionally, if there are multiple wildcard entries, more specific</br>wildcard entries must be processed before less specific wildcard entries.</br>For example, `"*.foo.example.com"` takes precedence over `"*.example.com"`.</br>The precise definition here is that the higher the number of dots in the</br>hostname to the right of the wildcard character, the higher the precedence.</br></br>The wildcard character will match any number of characters _and dots_ to</br>the left, however, so `"*.example.com"` will match both</br>`"foo.bar.example.com"` _and_ `"bar.example.com"`.</br></br>If a set of Listeners contains Listeners that are not distinct, then those</br>Listeners are Conflicted, and the implementation MUST set the "Conflicted"</br>condition in the Listener Status to "True".</br></br>Implementations MAY choose to accept a Gateway with some Conflicted</br>Listeners only if they only accept the partial Listener set that contains</br>no Conflicted Listeners. To put this another way, implementations may</br>accept a partial Listener set only if they throw out *all* the conflicting</br>Listeners. No picking one of the conflicting listeners as the winner.</br>This also means that the Gateway must have at least one non-conflicting</br>Listener in this case, otherwise it violates the requirement that at</br>least one Listener must be present.</br></br>The implementation MUST set a "ListenersNotValid" condition on the</br>Gateway Status when the Gateway contains Conflicted Listeners whether or</br>not they accept the Gateway. That Condition SHOULD clearly</br>indicate in the Message which Listeners are conflicted, and which are</br>Accepted. Additionally, the Listener status for those listeners SHOULD</br>indicate which Listeners are conflicted and not Accepted.</br></br>A Gateway's Listeners are considered "compatible" if:</br></br>1. They are distinct.</br>2. The implementation can serve them in compliance with the Addresses</br>requirement that all Listeners are available on all assigned</br>addresses.</br></br>Compatible combinations in Extended support are expected to vary across</br>implementations. A combination that is compatible for one implementation</br>may not be compatible for another.</br></br>For example, an implementation that cannot serve both TCP and UDP listeners</br>on the same address, or cannot mix HTTPS and generic TLS listens on the same port</br>would not consider those cases compatible, even though they are distinct.</br></br>Note that requests SHOULD match at most one Listener. For example, if</br>Listeners are defined for "foo.example.com" and "*.example.com", a</br>request to "foo.example.com" SHOULD only be routed using routes attached</br>to the "foo.example.com" Listener (and not the "*.example.com" Listener).</br>This concept is known as "Listener Isolation". Implementations that do</br>not support Listener Isolation MUST clearly document this.</br></br>Implementations MAY merge separate Gateways onto a single set of</br>Addresses if all Listeners across all Gateways are compatible.</br></br>Support: Core</br></br>+listType=map</br>+listMapKey=name</br>+kubebuilder:validation:MinItems=1</br>+kubebuilder:validation:MaxItems=64</br>+kubebuilder:validation:XValidation:message="tls must not be specified for protocols ['HTTP', 'TCP', 'UDP']",rule="self.all(l, l.protocol in ['HTTP', 'TCP', 'UDP'] ? !has(l.tls) : true)"</br>+kubebuilder:validation:XValidation:message="tls mode must be Terminate for protocol HTTPS",rule="self.all(l, (l.protocol == 'HTTPS' && has(l.tls)) ? (l.tls.mode == '' || l.tls.mode == 'Terminate') : true)"</br>+kubebuilder:validation:XValidation:message="hostname must not be specified for protocols ['TCP', 'UDP']",rule="self.all(l, l.protocol in ['TCP', 'UDP']  ? (!has(l.hostname) || l.hostname == '') : true)"</br>+kubebuilder:validation:XValidation:message="Listener name must be unique within the Gateway",rule="self.all(l1, self.exists_one(l2, l1.name == l2.name))"</br>+kubebuilder:validation:XValidation:message="Combination of port, protocol and hostname must be unique for each listener",rule="self.all(l1, self.exists_one(l2, l1.port == l2.port && l1.protocol == l2.protocol && (has(l1.hostname) && has(l2.hostname) ? l1.hostname == l2.hostname : !has(l1.hostname) && !has(l2.hostname))))" |  |
| gatewayClassName | [ObjectName](#object-name)| `ObjectName` |  | |  |  |
| infrastructure | [GatewayInfrastructure](#gateway-infrastructure)| `GatewayInfrastructure` |  | |  |  |



### <span id="gateway-status"></span> GatewayStatus


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Addresses | [][GatewayStatusAddress](#gateway-status-address)| `[]*GatewayStatusAddress` |  | | Addresses lists the network addresses that have been bound to the</br>Gateway.</br></br>This list may differ from the addresses provided in the spec under some</br>conditions:</br></br>no addresses are specified, all addresses are dynamically assigned</br>a combination of specified and dynamic addresses are assigned</br>a specified address was unusable (e.g. already in use)</br></br>+optional</br><gateway:validateIPAddress></br>+kubebuilder:validation:MaxItems=16 |  |
| Conditions | [][Condition](#condition)| `[]*Condition` |  | | Conditions describe the current conditions of the Gateway.</br></br>Implementations should prefer to express Gateway conditions</br>using the `GatewayConditionType` and `GatewayConditionReason`</br>constants so that operators and tools can converge on a common</br>vocabulary to describe Gateway state.</br></br>Known condition types are:</br></br>"Accepted"</br>"Programmed"</br>"Ready"</br></br>+optional</br>+listType=map</br>+listMapKey=type</br>+kubebuilder:validation:MaxItems=8</br>+kubebuilder:default={{type: "Accepted", status: "Unknown", reason:"Pending", message:"Waiting for controller", lastTransitionTime: "1970-01-01T00:00:00Z"},{type: "Programmed", status: "Unknown", reason:"Pending", message:"Waiting for controller", lastTransitionTime: "1970-01-01T00:00:00Z"}} |  |
| Listeners | [][ListenerStatus](#listener-status)| `[]*ListenerStatus` |  | | Listeners provide status for each unique listener port defined in the Spec.</br></br>+optional</br>+listType=map</br>+listMapKey=name</br>+kubebuilder:validation:MaxItems=64 |  |



### <span id="gateway-status-address"></span> GatewayStatusAddress


> +kubebuilder:validation:XValidation:message="Hostname value must only contain valid characters (matching ^(\\*\\.)?[a-z0-9]([-a-z0-9]*[a-z0-9])?(\\.[a-z0-9]([-a-z0-9]*[a-z0-9])?)*$)",rule="self.type == 'Hostname' ? self.value.matches(r\"\"\"^(\\*\\.)?[a-z0-9]([-a-z0-9]*[a-z0-9])?(\\.[a-z0-9]([-a-z0-9]*[a-z0-9])?)*$\"\"\"): true"
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Value | string| `string` |  | | Value of the address. The validity of the values will depend</br>on the type and support by the controller.</br></br>Examples: `1.2.3.4`, `128::1`, `my-ip-address`.</br></br>+kubebuilder:validation:MinLength=1</br>+kubebuilder:validation:MaxLength=253 |  |
| type | [AddressType](#address-type)| `AddressType` |  | |  |  |



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
| Group | string| string | | This validation is based off of the corresponding Kubernetes validation:</br>https://github.com/kubernetes/apimachinery/blob/02cfb53916346d085a6c6c7c66f882e3c6b0eca6/pkg/util/validation/validation.go#L208</br></br>Valid values include:</br></br>"" - empty string implies core Kubernetes API group</br>"gateway.networking.k8s.io"</br>"foo.example.com"</br></br>Invalid values include:</br></br>"example.com/bar" - "/" is an invalid character</br></br>+kubebuilder:validation:MaxLength=253</br>+kubebuilder:validation:Pattern=`^$|^[a-z0-9]([-a-z0-9]*[a-z0-9])?(\.[a-z0-9]([-a-z0-9]*[a-z0-9])?)*$` |  |



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
| Filters | [][HTTPRouteFilter](#http-route-filter)| `[]*HTTPRouteFilter` |  | | Filters defined at this level should be executed if and only if the</br>request is being forwarded to the backend defined here.</br></br>Support: Implementation-specific (For broader support of filters, use the</br>Filters field in HTTPRouteRule.)</br></br>+optional</br>+kubebuilder:validation:MaxItems=16</br>+kubebuilder:validation:XValidation:message="May specify either httpRouteFilterRequestRedirect or httpRouteFilterRequestRewrite, but not both",rule="!(self.exists(f, f.type == 'RequestRedirect') && self.exists(f, f.type == 'URLRewrite'))"</br>+kubebuilder:validation:XValidation:message="May specify either httpRouteFilterRequestRedirect or httpRouteFilterRequestRewrite, but not both",rule="!(self.exists(f, f.type == 'RequestRedirect') && self.exists(f, f.type == 'URLRewrite'))"</br>+kubebuilder:validation:XValidation:message="RequestHeaderModifier filter cannot be repeated",rule="self.filter(f, f.type == 'RequestHeaderModifier').size() <= 1"</br>+kubebuilder:validation:XValidation:message="ResponseHeaderModifier filter cannot be repeated",rule="self.filter(f, f.type == 'ResponseHeaderModifier').size() <= 1"</br>+kubebuilder:validation:XValidation:message="RequestRedirect filter cannot be repeated",rule="self.filter(f, f.type == 'RequestRedirect').size() <= 1"</br>+kubebuilder:validation:XValidation:message="URLRewrite filter cannot be repeated",rule="self.filter(f, f.type == 'URLRewrite').size() <= 1" |  |
| Weight | int32 (formatted integer)| `int32` |  | | Weight specifies the proportion of requests forwarded to the referenced</br>backend. This is computed as weight/(sum of all weights in this</br>BackendRefs list). For non-zero values, there may be some epsilon from</br>the exact proportion defined here depending on the precision an</br>implementation supports. Weight is not a percentage and the sum of</br>weights does not need to equal 100.</br></br>If only one backend is specified and it has a weight greater than 0, 100%</br>of the traffic is forwarded to that backend. If weight is set to 0, no</br>traffic should be forwarded for this entry. If unspecified, weight</br>defaults to 1.</br></br>Support for this field varies based on the context where used.</br></br>+optional</br>+kubebuilder:default=1</br>+kubebuilder:validation:Minimum=0</br>+kubebuilder:validation:Maximum=1000000 |  |
| group | [Group](#group)| `Group` |  | |  |  |
| kind | [Kind](#kind)| `Kind` |  | |  |  |
| name | [ObjectName](#object-name)| `ObjectName` |  | |  |  |
| namespace | [Namespace](#namespace)| `Namespace` |  | |  |  |
| port | [PortNumber](#port-number)| `PortNumber` |  | |  |  |



### <span id="http-header"></span> HTTPHeader


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Value | string| `string` |  | | Value is the value of HTTP Header to be matched.</br></br>+kubebuilder:validation:MinLength=1</br>+kubebuilder:validation:MaxLength=4096 |  |
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
| Add | [][HTTPHeader](#http-header)| `[]*HTTPHeader` |  | | Add adds the given header(s) (name, value) to the request</br>before the action. It appends to any existing values associated</br>with the header name.</br></br>Input:</br>GET /foo HTTP/1.1</br>my-header: foo</br></br>Config:</br>add:</br>name: "my-header"</br>value: "bar,baz"</br></br>Output:</br>GET /foo HTTP/1.1</br>my-header: foo,bar,baz</br></br>+optional</br>+listType=map</br>+listMapKey=name</br>+kubebuilder:validation:MaxItems=16 |  |
| Remove | []string| `[]string` |  | | Remove the given header(s) from the HTTP request before the action. The</br>value of Remove is a list of HTTP header names. Note that the header</br>names are case-insensitive (see</br>https://datatracker.ietf.org/doc/html/rfc2616#section-4.2).</br></br>Input:</br>GET /foo HTTP/1.1</br>my-header1: foo</br>my-header2: bar</br>my-header3: baz</br></br>Config:</br>remove: ["my-header1", "my-header3"]</br></br>Output:</br>GET /foo HTTP/1.1</br>my-header2: bar</br></br>+optional</br>+listType=set</br>+kubebuilder:validation:MaxItems=16 |  |
| Set | [][HTTPHeader](#http-header)| `[]*HTTPHeader` |  | | Set overwrites the request with the given header (name, value)</br>before the action.</br></br>Input:</br>GET /foo HTTP/1.1</br>my-header: foo</br></br>Config:</br>set:</br>name: "my-header"</br>value: "bar"</br></br>Output:</br>GET /foo HTTP/1.1</br>my-header: bar</br></br>+optional</br>+listType=map</br>+listMapKey=name</br>+kubebuilder:validation:MaxItems=16 |  |



### <span id="http-header-match"></span> HTTPHeaderMatch


> HTTPHeaderMatch describes how to select a HTTP route by matching HTTP request
headers.
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Value | string| `string` |  | | Value is the value of HTTP Header to be matched.</br></br>+kubebuilder:validation:MinLength=1</br>+kubebuilder:validation:MaxLength=4096 |  |
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
| HTTPMethod | string| string | | Note that values may be added to this enum, implementations</br>must ensure that unknown values will not cause a crash.</br></br>Unknown values here must result in the implementation setting the</br>Accepted Condition for the Route to `status: False`, with a</br>Reason of `UnsupportedValue`.</br></br>+kubebuilder:validation:Enum=GET;HEAD;POST;PUT;DELETE;CONNECT;OPTIONS;TRACE;PATCH |  |



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
| Value | string| `string` |  | | Value of the HTTP path to match against.</br></br>+optional</br>+kubebuilder:default="/"</br>+kubebuilder:validation:MaxLength=1024 |  |
| type | [PathMatchType](#path-match-type)| `PathMatchType` |  | |  |  |



### <span id="http-path-modifier"></span> HTTPPathModifier


> +kubebuilder:validation:XValidation:message="replaceFullPath must be specified when type is set to 'ReplaceFullPath'",rule="self.type == 'ReplaceFullPath' ? has(self.replaceFullPath) : true"
+kubebuilder:validation:XValidation:message="type must be 'ReplaceFullPath' when replaceFullPath is set",rule="has(self.replaceFullPath) ? self.type == 'ReplaceFullPath' : true"
+kubebuilder:validation:XValidation:message="replacePrefixMatch must be specified when type is set to 'ReplacePrefixMatch'",rule="self.type == 'ReplacePrefixMatch' ? has(self.replacePrefixMatch) : true"
+kubebuilder:validation:XValidation:message="type must be 'ReplacePrefixMatch' when replacePrefixMatch is set",rule="has(self.replacePrefixMatch) ? self.type == 'ReplacePrefixMatch' : true"
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| ReplaceFullPath | string| `string` |  | | ReplaceFullPath specifies the value with which to replace the full path</br>of a request during a rewrite or redirect.</br></br>+kubebuilder:validation:MaxLength=1024</br>+optional |  |
| ReplacePrefixMatch | string| `string` |  | | ReplacePrefixMatch specifies the value with which to replace the prefix</br>match of a request during a rewrite or redirect. For example, a request</br>to "/foo/bar" with a prefix match of "/foo" and a ReplacePrefixMatch</br>of "/xyz" would be modified to "/xyz/bar".</br></br>Note that this matches the behavior of the PathPrefix match type. This</br>matches full path elements. A path element refers to the list of labels</br>in the path split by the `/` separator. When specified, a trailing `/` is</br>ignored. For example, the paths `/abc`, `/abc/`, and `/abc/def` would all</br>match the prefix `/abc`, but the path `/abcd` would not.</br></br>ReplacePrefixMatch is only compatible with a `PathPrefix` HTTPRouteMatch.</br>Using any other HTTPRouteMatch type on the same HTTPRouteRule will result in</br>the implementation setting the Accepted Condition for the Route to `status: False`.</br></br>Request Path | Prefix Match | Replace Prefix | Modified Path</br>--------------|----------------|----------</br>foo/bar     | /foo         | /xyz           | /xyz/bar</br>foo/bar     | /foo         | /xyz/          | /xyz/bar</br>foo/bar     | /foo/        | /xyz           | /xyz/bar</br>foo/bar     | /foo/        | /xyz/          | /xyz/bar</br>foo         | /foo         | /xyz           | /xyz</br>foo/        | /foo         | /xyz           | /xyz/</br>foo/bar     | /foo         | <empty string> | /bar</br>foo/        | /foo         | <empty string> | /</br>foo         | /foo         | <empty string> | /</br>foo/        | /foo         | /              | /</br>foo         | /foo         | /              | /</br></br>+kubebuilder:validation:MaxLength=1024</br>+optional |  |
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
| Value | string| `string` |  | | Value is the value of HTTP query param to be matched.</br></br>+kubebuilder:validation:MinLength=1</br>+kubebuilder:validation:MaxLength=1024 |  |
| name | [HTTPHeaderName](#http-header-name)| `HTTPHeaderName` |  | |  |  |
| type | [QueryParamMatchType](#query-param-match-type)| `QueryParamMatchType` |  | |  |  |



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
| Scheme | string| `string` |  | | Scheme is the scheme to be used in the value of the `Location` header in</br>the response. When empty, the scheme of the request is used.</br></br>Scheme redirects can affect the port of the redirect, for more information,</br>refer to the documentation for the port field of this filter.</br></br>Note that values may be added to this enum, implementations</br>must ensure that unknown values will not cause a crash.</br></br>Unknown values here must result in the implementation setting the</br>Accepted Condition for the Route to `status: False`, with a</br>Reason of `UnsupportedValue`.</br></br>Support: Extended</br></br>+optional</br>+kubebuilder:validation:Enum=http;https |  |
| StatusCode | int64 (formatted integer)| `int64` |  | | StatusCode is the HTTP status code to be used in response.</br></br>Note that values may be added to this enum, implementations</br>must ensure that unknown values will not cause a crash.</br></br>Unknown values here must result in the implementation setting the</br>Accepted Condition for the Route to `status: False`, with a</br>Reason of `UnsupportedValue`.</br></br>Support: Core</br></br>+optional</br>+kubebuilder:default=302</br>+kubebuilder:validation:Enum=301;302 |  |
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
| APIVersion | string| `string` |  | | APIVersion defines the versioned schema of this representation of an object.</br>Servers should convert recognized schemas to the latest internal value, and</br>may reject unrecognized values.</br>More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#resources</br>+optional |  |
| Annotations | map of string| `map[string]string` |  | | Annotations is an unstructured key value map stored with a resource that may be</br>set by external tools to store and retrieve arbitrary metadata. They are not</br>queryable and should be preserved when modifying objects.</br>More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/annotations</br>+optional |  |
| CreationTimestamp | string| `string` |  | | CreationTimestamp is a timestamp representing the server time when this object was</br>created. It is not guaranteed to be set in happens-before order across separate operations.</br>Clients may not set this value. It is represented in RFC3339 form and is in UTC.</br></br>Populated by the system.</br>Read-only.</br>Null for lists.</br>More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata</br>+optional |  |
| DeletionGracePeriodSeconds | int64 (formatted integer)| `int64` |  | | Number of seconds allowed for this object to gracefully terminate before</br>it will be removed from the system. Only set when deletionTimestamp is also set.</br>May only be shortened.</br>Read-only.</br>+optional |  |
| DeletionTimestamp | string| `string` |  | | DeletionTimestamp is RFC 3339 date and time at which this resource will be deleted. This</br>field is set by the server when a graceful deletion is requested by the user, and is not</br>directly settable by a client. The resource is expected to be deleted (no longer visible</br>from resource lists, and not reachable by name) after the time in this field, once the</br>finalizers list is empty. As long as the finalizers list contains items, deletion is blocked.</br>Once the deletionTimestamp is set, this value may not be unset or be set further into the</br>future, although it may be shortened or the resource may be deleted prior to this time.</br>For example, a user may request that a pod is deleted in 30 seconds. The Kubelet will react</br>by sending a graceful termination signal to the containers in the pod. After that 30 seconds,</br>the Kubelet will send a hard termination signal (SIGKILL) to the container and after cleanup,</br>remove the pod from the API. In the presence of network partitions, this object may still</br>exist after this timestamp, until an administrator or automated process can determine the</br>resource is fully terminated.</br>If not set, graceful deletion of the object has not been requested.</br></br>Populated by the system when a graceful deletion is requested.</br>Read-only.</br>More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata</br>+optional |  |
| Finalizers | []string| `[]string` |  | | Must be empty before the object is deleted from the registry. Each entry</br>is an identifier for the responsible component that will remove the entry</br>from the list. If the deletionTimestamp of the object is non-nil, entries</br>in this list can only be removed.</br>Finalizers may be processed and removed in any order.  Order is NOT enforced</br>because it introduces significant risk of stuck finalizers.</br>finalizers is a shared field, any actor with permission can reorder it.</br>If the finalizer list is processed in order, then this can lead to a situation</br>in which the component responsible for the first finalizer in the list is</br>waiting for a signal (field value, external system, or other) produced by a</br>component responsible for a finalizer later in the list, resulting in a deadlock.</br>Without enforced ordering finalizers are free to order amongst themselves and</br>are not vulnerable to ordering changes in the list.</br>+optional</br>+patchStrategy=merge</br>+listType=set |  |
| GenerateName | string| `string` |  | | GenerateName is an optional prefix, used by the server, to generate a unique</br>name ONLY IF the Name field has not been provided.</br>If this field is used, the name returned to the client will be different</br>than the name passed. This value will also be combined with a unique suffix.</br>The provided value has the same validation rules as the Name field,</br>and may be truncated by the length of the suffix required to make the value</br>unique on the server.</br></br>If this field is specified and the generated name exists, the server will return a 409.</br></br>Applied only if Name is not specified.</br>More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#idempotency</br>+optional |  |
| Generation | int64 (formatted integer)| `int64` |  | | A sequence number representing a specific generation of the desired state.</br>Populated by the system. Read-only.</br>+optional |  |
| Kind | string| `string` |  | | Kind is a string value representing the REST resource this object represents.</br>Servers may infer this from the endpoint the client submits requests to.</br>Cannot be updated.</br>In CamelCase.</br>More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds</br>+optional |  |
| Labels | map of string| `map[string]string` |  | | Map of string keys and values that can be used to organize and categorize</br>(scope and select) objects. May match selectors of replication controllers</br>and services.</br>More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/labels</br>+optional |  |
| ManagedFields | [][ManagedFieldsEntry](#managed-fields-entry)| `[]*ManagedFieldsEntry` |  | | ManagedFields maps workflow-id and version to the set of fields</br>that are managed by that workflow. This is mostly for internal</br>housekeeping, and users typically shouldn't need to set or</br>understand this field. A workflow can be the user's name, a</br>controller's name, or the name of a specific apply path like</br>"ci-cd". The set of fields is always in the version that the</br>workflow used when modifying the object.</br></br>+optional</br>+listType=atomic |  |
| Name | string| `string` |  | | Name must be unique within a namespace. Is required when creating resources, although</br>some resources may allow a client to request the generation of an appropriate name</br>automatically. Name is primarily intended for creation idempotence and configuration</br>definition.</br>Cannot be updated.</br>More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names#names</br>+optional |  |
| Namespace | string| `string` |  | | Namespace defines the space within which each name must be unique. An empty namespace is</br>equivalent to the "default" namespace, but "default" is the canonical representation.</br>Not all objects are required to be scoped to a namespace - the value of this field for</br>those objects will be empty.</br></br>Must be a DNS_LABEL.</br>Cannot be updated.</br>More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/namespaces</br>+optional |  |
| OwnerReferences | [][OwnerReference](#owner-reference)| `[]*OwnerReference` |  | | List of objects depended by this object. If ALL objects in the list have</br>been deleted, this object will be garbage collected. If this object is managed by a controller,</br>then an entry in this list will point to this controller, with the controller field set to true.</br>There cannot be more than one managing controller.</br>+optional</br>+patchMergeKey=uid</br>+patchStrategy=merge</br>+listType=map</br>+listMapKey=uid |  |
| ResourceVersion | string| `string` |  | | An opaque value that represents the internal version of this object that can</br>be used by clients to determine when objects have changed. May be used for optimistic</br>concurrency, change detection, and the watch operation on a resource or set of resources.</br>Clients must treat these values as opaque and passed unmodified back to the server.</br>They may only be valid for a particular resource or set of resources.</br></br>Populated by the system.</br>Read-only.</br>Value must be treated as opaque by clients and .</br>More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#concurrency-control-and-consistency</br>+optional |  |
| SelfLink | string| `string` |  | | Deprecated: selfLink is a legacy read-only field that is no longer populated by the system.</br>+optional |  |
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
| Headers | [][HTTPHeaderMatch](#http-header-match)| `[]*HTTPHeaderMatch` |  | | Headers specifies HTTP request header matchers. Multiple match values are</br>ANDed together, meaning, a request must match all the specified headers</br>to select the route.</br></br>+listType=map</br>+listMapKey=name</br>+optional</br>+kubebuilder:validation:MaxItems=16 |  |
| QueryParams | [][HTTPQueryParamMatch](#http-query-param-match)| `[]*HTTPQueryParamMatch` |  | | QueryParams specifies HTTP query parameter matchers. Multiple match</br>values are ANDed together, meaning, a request must match all the</br>specified query parameters to select the route.</br></br>Support: Extended</br></br>+listType=map</br>+listMapKey=name</br>+optional</br>+kubebuilder:validation:MaxItems=16 |  |
| method | [HTTPMethod](#http-method)| `HTTPMethod` |  | |  |  |
| path | [HTTPPathMatch](#http-path-match)| `HTTPPathMatch` |  | |  |  |



### <span id="http-route-rule"></span> HTTPRouteRule


> +kubebuilder:validation:XValidation:message="RequestRedirect filter must not be used together with backendRefs",rule="(has(self.backendRefs) && size(self.backendRefs) > 0) ? (!has(self.filters) || self.filters.all(f, !has(f.requestRedirect))): true"
+kubebuilder:validation:XValidation:message="When using RequestRedirect filter with path.replacePrefixMatch, exactly one PathPrefix match must be specified",rule="(has(self.filters) && self.filters.exists_one(f, has(f.requestRedirect) && has(f.requestRedirect.path) && f.requestRedirect.path.type == 'ReplacePrefixMatch' && has(f.requestRedirect.path.replacePrefixMatch))) ? ((size(self.matches) != 1 || !has(self.matches[0].path) || self.matches[0].path.type != 'PathPrefix') ? false : true) : true"
+kubebuilder:validation:XValidation:message="When using URLRewrite filter with path.replacePrefixMatch, exactly one PathPrefix match must be specified",rule="(has(self.filters) && self.filters.exists_one(f, has(f.urlRewrite) && has(f.urlRewrite.path) && f.urlRewrite.path.type == 'ReplacePrefixMatch' && has(f.urlRewrite.path.replacePrefixMatch))) ? ((size(self.matches) != 1 || !has(self.matches[0].path) || self.matches[0].path.type != 'PathPrefix') ? false : true) : true"
+kubebuilder:validation:XValidation:message="Within backendRefs, when using RequestRedirect filter with path.replacePrefixMatch, exactly one PathPrefix match must be specified",rule="(has(self.backendRefs) && self.backendRefs.exists_one(b, (has(b.filters) && b.filters.exists_one(f, has(f.requestRedirect) && has(f.requestRedirect.path) && f.requestRedirect.path.type == 'ReplacePrefixMatch' && has(f.requestRedirect.path.replacePrefixMatch))) )) ? ((size(self.matches) != 1 || !has(self.matches[0].path) || self.matches[0].path.type != 'PathPrefix') ? false : true) : true"
+kubebuilder:validation:XValidation:message="Within backendRefs, When using URLRewrite filter with path.replacePrefixMatch, exactly one PathPrefix match must be specified",rule="(has(self.backendRefs) && self.backendRefs.exists_one(b, (has(b.filters) && b.filters.exists_one(f, has(f.urlRewrite) && has(f.urlRewrite.path) && f.urlRewrite.path.type == 'ReplacePrefixMatch' && has(f.urlRewrite.path.replacePrefixMatch))) )) ? ((size(self.matches) != 1 || !has(self.matches[0].path) || self.matches[0].path.type != 'PathPrefix') ? false : true) : true"
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| BackendRefs | [][HTTPBackendRef](#http-backend-ref)| `[]*HTTPBackendRef` |  | | BackendRefs defines the backend(s) where matching requests should be</br>sent.</br></br>Failure behavior here depends on how many BackendRefs are specified and</br>how many are invalid.</br></br>If *all* entries in BackendRefs are invalid, and there are also no filters</br>specified in this route rule, *all* traffic which matches this rule MUST</br>receive a 500 status code.</br></br>See the HTTPBackendRef definition for the rules about what makes a single</br>HTTPBackendRef invalid.</br></br>When a HTTPBackendRef is invalid, 500 status codes MUST be returned for</br>requests that would have otherwise been routed to an invalid backend. If</br>multiple backends are specified, and some are invalid, the proportion of</br>requests that would otherwise have been routed to an invalid backend</br>MUST receive a 500 status code.</br></br>For example, if two backends are specified with equal weights, and one is</br>invalid, 50 percent of traffic must receive a 500. Implementations may</br>choose how that 50 percent is determined.</br></br>Support: Core for Kubernetes Service</br></br>Support: Extended for Kubernetes ServiceImport</br></br>Support: Implementation-specific for any other resource</br></br>Support for weight: Core</br></br>+optional</br>+kubebuilder:validation:MaxItems=16 |  |
| Filters | [][HTTPRouteFilter](#http-route-filter)| `[]*HTTPRouteFilter` |  | | Filters define the filters that are applied to requests that match</br>this rule.</br></br>Wherever possible, implementations SHOULD implement filters in the order</br>they are specified.</br></br>Implementations MAY choose to implement this ordering strictly, rejecting</br>any combination or order of filters that can not be supported. If implementations</br>choose a strict interpretation of filter ordering, they MUST clearly document</br>that behavior.</br></br>To reject an invalid combination or order of filters, implementations SHOULD</br>consider the Route Rules with this configuration invalid. If all Route Rules</br>in a Route are invalid, the entire Route would be considered invalid. If only</br>a portion of Route Rules are invalid, implementations MUST set the</br>"PartiallyInvalid" condition for the Route.</br></br>Conformance-levels at this level are defined based on the type of filter:</br></br>ALL core filters MUST be supported by all implementations.</br>Implementers are encouraged to support extended filters.</br>Implementation-specific custom filters have no API guarantees across</br>implementations.</br></br>Specifying the same filter multiple times is not supported unless explicitly</br>indicated in the filter.</br></br>All filters are expected to be compatible with each other except for the</br>URLRewrite and RequestRedirect filters, which may not be combined. If an</br>implementation can not support other combinations of filters, they must clearly</br>document that limitation. In cases where incompatible or unsupported</br>filters are specified and cause the `Accepted` condition to be set to status</br>`False`, implementations may use the `IncompatibleFilters` reason to specify</br>this configuration error.</br></br>Support: Core</br></br>+optional</br>+kubebuilder:validation:MaxItems=16</br>+kubebuilder:validation:XValidation:message="May specify either httpRouteFilterRequestRedirect or httpRouteFilterRequestRewrite, but not both",rule="!(self.exists(f, f.type == 'RequestRedirect') && self.exists(f, f.type == 'URLRewrite'))"</br>+kubebuilder:validation:XValidation:message="RequestHeaderModifier filter cannot be repeated",rule="self.filter(f, f.type == 'RequestHeaderModifier').size() <= 1"</br>+kubebuilder:validation:XValidation:message="ResponseHeaderModifier filter cannot be repeated",rule="self.filter(f, f.type == 'ResponseHeaderModifier').size() <= 1"</br>+kubebuilder:validation:XValidation:message="RequestRedirect filter cannot be repeated",rule="self.filter(f, f.type == 'RequestRedirect').size() <= 1"</br>+kubebuilder:validation:XValidation:message="URLRewrite filter cannot be repeated",rule="self.filter(f, f.type == 'URLRewrite').size() <= 1" |  |
| Matches | [][HTTPRouteMatch](#http-route-match)| `[]*HTTPRouteMatch` |  | | Matches define conditions used for matching the rule against incoming</br>HTTP requests. Each match is independent, i.e. this rule will be matched</br>if **any** one of the matches is satisfied.</br></br>For example, take the following matches configuration:</br></br>```</br>matches:</br>path:</br>value: "/foo"</br>headers:</br>name: "version"</br>value: "v2"</br>path:</br>value: "/v2/foo"</br>```</br></br>For a request to match against this rule, a request must satisfy</br>EITHER of the two conditions:</br></br>path prefixed with `/foo` AND contains the header `version: v2`</br>path prefix of `/v2/foo`</br></br>See the documentation for HTTPRouteMatch on how to specify multiple</br>match conditions that should be ANDed together.</br></br>If no matches are specified, the default is a prefix</br>path match on "/", which has the effect of matching every</br>HTTP request.</br></br>Proxy or Load Balancer routing configuration generated from HTTPRoutes</br>MUST prioritize matches based on the following criteria, continuing on</br>ties. Across all rules specified on applicable Routes, precedence must be</br>given to the match having:</br></br>"Exact" path match.</br>"Prefix" path match with largest number of characters.</br>Method match.</br>Largest number of header matches.</br>Largest number of query param matches.</br></br>Note: The precedence of RegularExpression path matches are implementation-specific.</br></br>If ties still exist across multiple Routes, matching precedence MUST be</br>determined in order of the following criteria, continuing on ties:</br></br>The oldest Route based on creation timestamp.</br>The Route appearing first in alphabetical order by</br>"{namespace}/{name}".</br></br>If ties still exist within an HTTPRoute, matching precedence MUST be granted</br>to the FIRST matching rule (in list order) with a match meeting the above</br>criteria.</br></br>When no rules matching a request have been successfully attached to the</br>parent a request is coming from, a HTTP 404 status code MUST be returned.</br></br>+optional</br>+kubebuilder:validation:MaxItems=8</br>+kubebuilder:default={{path:{ type: "PathPrefix", value: "/"}}} |  |
| sessionPersistence | [SessionPersistence](#session-persistence)| `SessionPersistence` |  | |  |  |
| timeouts | [HTTPRouteTimeouts](#http-route-timeouts)| `HTTPRouteTimeouts` |  | |  |  |



### <span id="http-route-spec"></span> HTTPRouteSpec


> HTTPRouteSpec defines the desired state of HTTPRoute
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Hostnames | [][Hostname](#hostname)| `[]Hostname` |  | | Hostnames defines a set of hostnames that should match against the HTTP Host</br>header to select a HTTPRoute used to process the request. Implementations</br>MUST ignore any port value specified in the HTTP Host header while</br>performing a match and (absent of any applicable header modification</br>configuration) MUST forward this header unmodified to the backend.</br></br>Valid values for Hostnames are determined by RFC 1123 definition of a</br>hostname with 2 notable exceptions:</br></br>1. IPs are not allowed.</br>2. A hostname may be prefixed with a wildcard label (`*.`). The wildcard</br>label must appear by itself as the first label.</br></br>If a hostname is specified by both the Listener and HTTPRoute, there</br>must be at least one intersecting hostname for the HTTPRoute to be |  |
| ParentRefs | [][ParentReference](#parent-reference)| `[]*ParentReference` |  | | ParentRefs references the resources (usually Gateways) that a Route wants</br>to be attached to. Note that the referenced parent resource needs to</br>allow this for the attachment to be complete. For Gateways, that means</br>the Gateway needs to allow attachment from Routes of this kind and</br>namespace. For Services, that means the Service must either be in the same</br>namespace for a "producer" route, or the mesh implementation must support</br>and allow "consumer" routes for the referenced Service. ReferenceGrant is</br>not applicable for governing ParentRefs to Services - it is not possible to</br>create a "producer" route for a Service in a different namespace from the</br>Route.</br></br>There are two kinds of parent resources with "Core" support:</br></br>Gateway (Gateway conformance profile)</br>Service (Mesh conformance profile, ClusterIP Services only)</br></br>This API may be extended in the future to support additional kinds of parent</br>resources.</br></br>ParentRefs must be _distinct_. This means either that:</br></br>They select different objects.  If this is the case, then parentRef</br>entries are distinct. In terms of fields, this means that the</br>multi-part key defined by `group`, `kind`, `namespace`, and `name` must</br>be unique across all parentRef entries in the Route.</br>They do not select different objects, but for each optional field used,</br>each ParentRef that selects the same object must set the same set of</br>optional fields to different values. If one ParentRef sets a</br>combination of optional fields, all must set the same combination.</br></br>Some examples:</br></br>If one ParentRef sets `sectionName`, all ParentRefs referencing the</br>same object must also set `sectionName`.</br>If one ParentRef sets `port`, all ParentRefs referencing the same</br>object must also set `port`.</br>If one ParentRef sets `sectionName` and `port`, all ParentRefs</br>referencing the same object must also set `sectionName` and `port`.</br></br>It is possible to separately reference multiple distinct objects that may</br>be collapsed by an implementation. For example, some implementations may</br>choose to merge compatible Gateway Listeners together. If that is the</br>case, the list of routes attached to those resources should also be</br>merged.</br></br>Note that for ParentRefs that cross namespace boundaries, there are specific</br>rules. Cross-namespace references are only valid if they are explicitly</br>allowed by something in the namespace they are referring to. For example,</br>Gateway has the AllowedRoutes field, and ReferenceGrant provides a</br>generic way to enable other kinds of cross-namespace reference.</br></br><gateway:experimental:description></br>ParentRefs from a Route to a Service in the same namespace are "producer"</br>routes, which apply default routing rules to inbound connections from</br>any namespace to the Service.</br></br>ParentRefs from a Route to a Service in a different namespace are</br>"consumer" routes, and these routing rules are only applied to outbound</br>connections originating from the same namespace as the Route, for which</br>the intended destination of the connections are a Service targeted as a</br>ParentRef of the Route.</br></gateway:experimental:description></br></br>+optional</br>+kubebuilder:validation:MaxItems=32</br><gateway:standard:validation:XValidation:message="sectionName must be specified when parentRefs includes 2 or more references to the same parent",rule="self.all(p1, self.all(p2, p1.group == p2.group && p1.kind == p2.kind && p1.name == p2.name && (((!has(p1.__namespace__) || p1.__namespace__ == '') && (!has(p2.__namespace__) || p2.__namespace__ == '')) || (has(p1.__namespace__) && has(p2.__namespace__) && p1.__namespace__ == p2.__namespace__ )) ? ((!has(p1.sectionName) || p1.sectionName == '') == (!has(p2.sectionName) || p2.sectionName == '')) : true))"></br><gateway:standard:validation:XValidation:message="sectionName must be unique when parentRefs includes 2 or more references to the same parent",rule="self.all(p1, self.exists_one(p2, p1.group == p2.group && p1.kind == p2.kind && p1.name == p2.name && (((!has(p1.__namespace__) || p1.__namespace__ == '') && (!has(p2.__namespace__) || p2.__namespace__ == '')) || (has(p1.__namespace__) && has(p2.__namespace__) && p1.__namespace__ == p2.__namespace__ )) && (((!has(p1.sectionName) || p1.sectionName == '') && (!has(p2.sectionName) || p2.sectionName == '')) || (has(p1.sectionName) && has(p2.sectionName) && p1.sectionName == p2.sectionName))))"></br><gateway:experimental:validation:XValidation:message="sectionName or port must be specified when parentRefs includes 2 or more references to the same parent",rule="self.all(p1, self.all(p2, p1.group == p2.group && p1.kind == p2.kind && p1.name == p2.name && (((!has(p1.__namespace__) || p1.__namespace__ == '') && (!has(p2.__namespace__) || p2.__namespace__ == '')) || (has(p1.__namespace__) && has(p2.__namespace__) && p1.__namespace__ == p2.__namespace__)) ? ((!has(p1.sectionName) || p1.sectionName == '') == (!has(p2.sectionName) || p2.sectionName == '') && (!has(p1.port) || p1.port == 0) == (!has(p2.port) || p2.port == 0)): true))"></br><gateway:experimental:validation:XValidation:message="sectionName or port must be unique when parentRefs includes 2 or more references to the same parent",rule="self.all(p1, self.exists_one(p2, p1.group == p2.group && p1.kind == p2.kind && p1.name == p2.name && (((!has(p1.__namespace__) || p1.__namespace__ == '') && (!has(p2.__namespace__) || p2.__namespace__ == '')) || (has(p1.__namespace__) && has(p2.__namespace__) && p1.__namespace__ == p2.__namespace__ )) && (((!has(p1.sectionName) || p1.sectionName == '') && (!has(p2.sectionName) || p2.sectionName == '')) || ( has(p1.sectionName) && has(p2.sectionName) && p1.sectionName == p2.sectionName)) && (((!has(p1.port) || p1.port == 0) && (!has(p2.port) || p2.port == 0)) || (has(p1.port) && has(p2.port) && p1.port == p2.port))))"> |  |
| Rules | [][HTTPRouteRule](#http-route-rule)| `[]*HTTPRouteRule` |  | | Rules are a list of HTTP matchers, filters and actions.</br></br>+optional</br>+kubebuilder:validation:MaxItems=16</br>+kubebuilder:default={{matches: {{path: {type: "PathPrefix", value: "/"}}}}} |  |



### <span id="http-route-status"></span> HTTPRouteStatus


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Parents | [][RouteParentStatus](#route-parent-status)| `[]*RouteParentStatus` |  | | Parents is a list of parent resources (usually Gateways) that are</br>associated with the route, and the status of the route with respect to</br>each parent. When this route attaches to a parent, the controller that</br>manages the parent must add an entry to this list when the controller</br>first sees the route and should update the entry as appropriate when the</br>route or gateway is modified.</br></br>Note that parent references that cannot be resolved by an implementation</br>of this API will not be added to this list. Implementations of this API</br>can only populate Route status for the Gateways/parent resources they are</br>responsible for.</br></br>A maximum of 32 Gateways will be represented in this list. An empty list</br>means the route has not been attached to any Gateway.</br></br>+kubebuilder:validation:MaxItems=32 |  |



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
| HeaderMatchType | string| string | | "Exact" - Core</br>"RegularExpression" - Implementation Specific</br></br>Note that values may be added to this enum, implementations</br>must ensure that unknown values will not cause a crash.</br></br>Unknown values here must result in the implementation setting the</br>Accepted Condition for the Route to `status: False`, with a</br>Reason of `UnsupportedValue`.</br></br>+kubebuilder:validation:Enum=Exact;RegularExpression |  |



### <span id="header-name"></span> HeaderName


> +kubebuilder:validation:MinLength=1
+kubebuilder:validation:MaxLength=256
+kubebuilder:validation:Pattern=`^[A-Za-z0-9!#$%&'*+\-.^_\x60|~]+$`
+k8s:deepcopy-gen=false
  



| Name | Type | Go type | Default | Description | Example |
|------|------|---------| ------- |-------------|---------|
| HeaderName | string| string | | +kubebuilder:validation:MinLength=1</br>+kubebuilder:validation:MaxLength=256</br>+kubebuilder:validation:Pattern=`^[A-Za-z0-9!#$%&'*+\-.^_\x60|~]+$`</br>+k8s:deepcopy-gen=false |  |



### <span id="health-config"></span> HealthConfig


> HealthConfig maps annotations information for health
  



[HealthConfig](#health-config)

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

+kubebuilder:validation:MinLength=1
+kubebuilder:validation:MaxLength=253
+kubebuilder:validation:Pattern=`^(\*\.)?[a-z0-9]([-a-z0-9]*[a-z0-9])?(\.[a-z0-9]([-a-z0-9]*[a-z0-9])?)*$`
  



| Name | Type | Go type | Default | Description | Example |
|------|------|---------| ------- |-------------|---------|
| Hostname | string| string | | 1. IPs are not allowed.</br>2. A hostname may be prefixed with a wildcard label (`*.`). The wildcard</br>label must appear by itself as the first label.</br></br>Hostname can be "precise" which is a domain name without the terminating</br>dot of a network host (e.g. "foo.example.com") or "wildcard", which is a</br>domain name prefixed with a single wildcard label (e.g. `*.example.com`).</br></br>Note that as per RFC1035 and RFC1123, a *label* must consist of lower case</br>alphanumeric characters or '-', and must start and end with an alphanumeric</br>character. No other punctuation is allowed.</br></br>+kubebuilder:validation:MinLength=1</br>+kubebuilder:validation:MaxLength=253</br>+kubebuilder:validation:Pattern=`^(\*\.)?[a-z0-9]([-a-z0-9]*[a-z0-9])?(\.[a-z0-9]([-a-z0-9]*[a-z0-9])?)*$` |  |



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
| Message | string| `string` |  | | Human-readable message indicating details about last transition.</br>+optional |  |
| Reason | string| `string` |  | | Unique, one-word, CamelCase reason for the condition's last transition.</br>+optional |  |
| Status | string| `string` |  | | Status is the status of the condition.</br>Can be True, False, Unknown. |  |
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
| k8sGRPCRoute | [GRPCRoute](#g-rpc-route)| `GRPCRoute` |  | |  |  |
| k8sGateway | [Gateway](#gateway)| `Gateway` |  | |  |  |
| k8sHTTPRoute | [HTTPRoute](#http-route)| `HTTPRoute` |  | |  |  |
| k8sReferenceGrant | [ReferenceGrant](#reference-grant)| `ReferenceGrant` |  | |  |  |
| k8sTCPRoute | [TCPRoute](#tcp-route)| `TCPRoute` |  | |  |  |
| k8sTLSRoute | [TLSRoute](#tls-route)| `TLSRoute` |  | |  |  |
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
| K8sGRPCRoutes | [][GRPCRoute](#g-rpc-route)| `[]*GRPCRoute` |  | |  |  |
| K8sGateways | [][Gateway](#gateway)| `[]*Gateway` |  | |  |  |
| K8sHTTPRoutes | [][HTTPRoute](#http-route)| `[]*HTTPRoute` |  | |  |  |
| K8sReferenceGrants | [][ReferenceGrant](#reference-grant)| `[]*ReferenceGrant` |  | |  |  |
| K8sTCPRoutes | [][TCPRoute](#tcp-route)| `[]*TCPRoute` |  | |  |  |
| K8sTLSRoutes | [][TLSRoute](#tls-route)| `[]*TLSRoute` |  | |  |  |
| PeerAuthentications | [][PeerAuthentication](#peer-authentication)| `[]*PeerAuthentication` |  | |  |  |
| RequestAuthentications | [][RequestAuthentication](#request-authentication)| `[]*RequestAuthentication` |  | |  |  |
| ServiceEntries | [][ServiceEntry](#service-entry)| `[]*ServiceEntry` |  | |  |  |
| Sidecars | [][Sidecar](#sidecar)| `[]*Sidecar` |  | |  |  |
| Telemetries | [][Telemetry](#telemetry)| `[]*Telemetry` |  | |  |  |
| VirtualServices | [][VirtualService](#virtual-service)| `[]*VirtualService` |  | |  |  |
| WasmPlugins | [][WasmPlugin](#wasm-plugin)| `[]*WasmPlugin` |  | |  |  |
| WorkloadEntries | [][WorkloadEntry](#workload-entry)| `[]*WorkloadEntry` |  | |  |  |
| WorkloadGroups | [][WorkloadGroup](#workload-group)| `[]*WorkloadGroup` |  | |  |  |
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
| Conditions | [][IstioCondition](#istio-condition)| `[]*IstioCondition` |  | | Current service state of pod.</br>More info: https://istio.io/docs/reference/config/config-status/</br>+optional</br>+patchMergeKey=type</br>+patchStrategy=merge |  |
| ObservedGeneration | int64 (formatted integer)| `int64` |  | | Resource Generation to which the Reconciled Condition refers.</br>When this value is not equal to the object's metadata generation, reconciled condition  calculation for the current</br>generation is still in progress.  See https://istio.io/latest/docs/reference/config/config-status/ for more info.</br>+optional |  |
| ValidationMessages | [][AnalysisMessageBase](#analysis-message-base)| `[]*AnalysisMessageBase` |  | | Includes any errors or warnings detected by Istio's analyzers.</br>+optional</br>+patchMergeKey=type</br>+patchStrategy=merge |  |



### <span id="istio-validation"></span> IstioValidation


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Checks | [][IstioCheck](#istio-check)| `[]*IstioCheck` |  | | Array of checks. It might be empty. |  |
| Cluster | string| `string` | ✓ | | Cluster of the object | `east` |
| Name | string| `string` | ✓ | | Name of the object itself | `reviews` |
| Namespace | string| `string` | ✓ | | Namespace of the object | `bookinfo` |
| ObjectType | string| `string` | ✓ | | Type of the object | `virtualservice` |
| References | [][IstioValidationKey](#istio-validation-key)| `[]*IstioValidationKey` |  | | Related objects (only validation errors) |  |
| Valid | boolean| `bool` | ✓ | | Represents validity of the object: in case of warning, validity remains as true | `false` |



### <span id="istio-validation-key"></span> IstioValidationKey


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Cluster | string| `string` |  | |  |  |
| Name | string| `string` |  | |  |  |
| Namespace | string| `string` |  | |  |  |
| ObjectType | string| `string` |  | |  |  |



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
| OperatorResource | string| `string` |  | | OperatorResource contains the namespace and the name of the Kiali CR that the user</br>created to install Kiali via the operator. This can be blank if the operator wasn't used</br>to install Kiali. This resource is populated from annotations in the Service. It has</br>the format "namespace/resource_name". |  |
| ServiceName | string| `string` |  | | ServiceName is the name of the Kubernetes service associated to the Kiali installation. The Kiali Service is the</br>entity that is looked for in order to determine if a Kiali instance is available. |  |
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
| Kind | string| string | | Valid values include:</br></br>"Service"</br>"HTTPRoute"</br></br>Invalid values include:</br></br>"invalid/kind" - "/" is an invalid character</br></br>+kubebuilder:validation:MinLength=1</br>+kubebuilder:validation:MaxLength=63</br>+kubebuilder:validation:Pattern=`^[a-zA-Z]([-a-zA-Z0-9]*[a-zA-Z0-9])?$` |  |



### <span id="label-selector"></span> LabelSelector


> A label selector is a label query over a set of resources. The result of matchLabels and
matchExpressions are ANDed. An empty label selector matches all objects. A null
label selector matches no objects.
+structType=atomic
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| MatchExpressions | [][LabelSelectorRequirement](#label-selector-requirement)| `[]*LabelSelectorRequirement` |  | | matchExpressions is a list of label selector requirements. The requirements are ANDed.</br>+optional</br>+listType=atomic |  |
| MatchLabels | map of string| `map[string]string` |  | | matchLabels is a map of {key,value} pairs. A single {key,value} in the matchLabels</br>map is equivalent to an element of matchExpressions, whose key field is "key", the</br>operator is "In", and the values array contains only "value". The requirements are ANDed.</br>+optional |  |



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
| Values | []string| `[]string` |  | | values is an array of string values. If the operator is In or NotIn,</br>the values array must be non-empty. If the operator is Exists or DoesNotExist,</br>the values array must be empty. This array is replaced during a strategic</br>merge patch.</br>+optional</br>+listType=atomic |  |
| operator | [LabelSelectorOperator](#label-selector-operator)| `LabelSelectorOperator` |  | |  |  |



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
| AttachedRoutes | int32 (formatted integer)| `int32` |  | | AttachedRoutes represents the total number of Routes that have been</br>successfully attached to this Listener.</br></br>Successful attachment of a Route to a Listener is based solely on the</br>combination of the AllowedRoutes field on the corresponding Listener</br>and the Route's ParentRefs field. A Route is successfully attached to</br>a Listener when it is selected by the Listener's AllowedRoutes field</br>AND the Route has a valid ParentRef selecting the whole Gateway</br>resource or a specific Listener as a parent resource (more detail on</br>attachment semantics can be found in the documentation on the various</br>Route kinds ParentRefs fields). Listener or Route status does not impact</br>successful attachment, i.e. the AttachedRoutes field count MUST be set</br>for Listeners with condition Accepted: false and MUST count successfully</br>attached Routes that may themselves have Accepted: false conditions.</br></br>Uses for this field include troubleshooting Route attachment and</br>measuring blast radius/impact of changes to a Listener. |  |
| Conditions | [][Condition](#condition)| `[]*Condition` |  | | Conditions describe the current condition of this listener.</br></br>+listType=map</br>+listMapKey=type</br>+kubebuilder:validation:MaxItems=8 |  |
| SupportedKinds | [][RouteGroupKind](#route-group-kind)| `[]*RouteGroupKind` |  | | SupportedKinds is the list indicating the Kinds supported by this</br>listener. This MUST represent the kinds an implementation supports for</br>that Listener configuration.</br></br>If kinds are specified in Spec that are not supported, they MUST NOT</br>appear in this list and an implementation MUST set the "ResolvedRefs"</br>condition to "False" with the "InvalidRouteKinds" reason. If both valid</br>and invalid Route kinds are specified, the implementation MUST</br>reference the valid Route kinds that have been specified.</br></br>+kubebuilder:validation:MaxItems=8 |  |
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



### <span id="local-parameters-reference"></span> LocalParametersReference


> LocalParametersReference identifies an API object containing controller-specific
configuration resource within the namespace.
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Name | string| `string` |  | | Name is the name of the referent.</br></br>+kubebuilder:validation:MinLength=1</br>+kubebuilder:validation:MaxLength=253 |  |
| group | [Group](#group)| `Group` |  | |  |  |
| kind | [Kind](#kind)| `Kind` |  | |  |  |



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
| APIVersion | string| `string` |  | | APIVersion defines the version of this resource that this field set</br>applies to. The format is "group/version" just like the top-level</br>APIVersion field. It is necessary to track the version of a field</br>set because it cannot be automatically converted. |  |
| FieldsType | string| `string` |  | | FieldsType is the discriminator for the different fields format and version.</br>There is currently only one possible value: "FieldsV1" |  |
| Manager | string| `string` |  | | Manager is an identifier of the workflow managing these fields. |  |
| Subresource | string| `string` |  | | Subresource is the name of the subresource used to update that object, or</br>empty string if the object was updated through the main resource. The</br>value of this field is used to distinguish between managers, even if they</br>share the same name. For example, a status update will be distinct from a</br>regular update using the same manager name.</br>Note that the APIVersion field is not related to the Subresource field and</br>it always corresponds to the version of the main resource. |  |
| Time | string| `string` |  | | Time is the timestamp of when the ManagedFields entry was added. The</br>timestamp will also be updated if a field is added, the manager</br>changes any of the owned fields value or removes a field. The</br>timestamp does not update when a field is removed from the entry</br>because another manager took it over.</br>+optional |  |
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
| Namespace | string| string | | This validation is based off of the corresponding Kubernetes validation:</br>https://github.com/kubernetes/apimachinery/blob/02cfb53916346d085a6c6c7c66f882e3c6b0eca6/pkg/util/validation/validation.go#L187</br></br>This is used for Namespace name validation here:</br>https://github.com/kubernetes/apimachinery/blob/02cfb53916346d085a6c6c7c66f882e3c6b0eca6/pkg/api/validation/generic.go#L63</br></br>Valid values include:</br></br>"example"</br></br>Invalid values include:</br></br>"example.com" - "." is an invalid character</br></br>+kubebuilder:validation:Pattern=`^[a-z0-9]([-a-z0-9]*[a-z0-9])?$`</br>+kubebuilder:validation:MinLength=1</br>+kubebuilder:validation:MaxLength=63 |  |



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
| ID | string| `string` |  | | Cytoscape Fields |  |
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
| ObjectName | string| string | | +kubebuilder:validation:MinLength=1</br>+kubebuilder:validation:MaxLength=253 |  |



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
| BlockOwnerDeletion | boolean| `bool` |  | | If true, AND if the owner has the "foregroundDeletion" finalizer, then</br>the owner cannot be deleted from the key-value store until this</br>reference is removed.</br>See https://kubernetes.io/docs/concepts/architecture/garbage-collection/#foreground-deletion</br>for how the garbage collector interacts with this field and enforces the foreground deletion.</br>Defaults to false.</br>To set this field, a user needs "delete" permission of the owner,</br>otherwise 422 (Unprocessable Entity) will be returned.</br>+optional |  |
| Controller | boolean| `bool` |  | | If true, this reference points to the managing controller.</br>+optional |  |
| Kind | string| `string` |  | | Kind of the referent.</br>More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds |  |
| Name | string| `string` |  | | Name of the referent.</br>More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names#names |  |
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
| PathMatchType | string| string | | "Exact" - Core</br>"PathPrefix" - Core</br>"RegularExpression" - Implementation Specific</br></br>PathPrefix and Exact paths must be syntactically valid:</br></br>Must begin with the `/` character</br>Must not contain consecutive `/` characters (e.g. `/foo///`, `//`).</br></br>Note that values may be added to this enum, implementations</br>must ensure that unknown values will not cause a crash.</br></br>Unknown values here must result in the implementation setting the</br>Accepted Condition for the Route to `status: False`, with a</br>Reason of `UnsupportedValue`.</br></br>+kubebuilder:validation:Enum=Exact;PathPrefix;RegularExpression |  |



### <span id="peer-authentication"></span> PeerAuthentication


> Examples:

Policy to allow mTLS traffic for all workloads under namespace `foo`:
```yaml
apiVersion: security.istio.io/v1
kind: PeerAuthentication
metadata:

name: default
namespace: foo

spec:

mtls:
mode: STRICT

```
For mesh level, put the policy in root-namespace according to your Istio installation.

Policies to allow both mTLS and plaintext traffic for all workloads under namespace `foo`, but
require mTLS for workload `finance`.
```yaml
apiVersion: security.istio.io/v1
kind: PeerAuthentication
metadata:

name: default
namespace: foo

spec:

mtls:
mode: PERMISSIVE


apiVersion: security.istio.io/v1
kind: PeerAuthentication
metadata:

name: finance
namespace: foo

spec:

selector:
matchLabels:
app: finance
mtls:
mode: STRICT

```
Policy that enables strict mTLS for all `finance` workloads, but leaves the port `8080` to
plaintext. Note the port value in the `portLevelMtls` field refers to the port
of the workload, not the port of the Kubernetes service.
```yaml
apiVersion: security.istio.io/v1
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
Policy that inherits mTLS mode from namespace (or mesh) settings, and disables
mTLS for workload port `8080`.
```yaml
apiVersion: security.istio.io/v1
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
+cue-gen:PeerAuthentication:version:v1
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
+kubetype-gen:groupVersion=security.istio.io/v1
+genclient
+k8s:deepcopy-gen=true
>
<!-- istio code generation tags
+istio.io/sync-from:security/v1beta1/peer_authentication.proto
>
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| APIVersion | string| `string` |  | | APIVersion defines the versioned schema of this representation of an object.</br>Servers should convert recognized schemas to the latest internal value, and</br>may reject unrecognized values.</br>More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#resources</br>+optional |  |
| Annotations | map of string| `map[string]string` |  | | Annotations is an unstructured key value map stored with a resource that may be</br>set by external tools to store and retrieve arbitrary metadata. They are not</br>queryable and should be preserved when modifying objects.</br>More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/annotations</br>+optional |  |
| CreationTimestamp | string| `string` |  | | CreationTimestamp is a timestamp representing the server time when this object was</br>created. It is not guaranteed to be set in happens-before order across separate operations.</br>Clients may not set this value. It is represented in RFC3339 form and is in UTC.</br></br>Populated by the system.</br>Read-only.</br>Null for lists.</br>More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata</br>+optional |  |
| DeletionGracePeriodSeconds | int64 (formatted integer)| `int64` |  | | Number of seconds allowed for this object to gracefully terminate before</br>it will be removed from the system. Only set when deletionTimestamp is also set.</br>May only be shortened.</br>Read-only.</br>+optional |  |
| DeletionTimestamp | string| `string` |  | | DeletionTimestamp is RFC 3339 date and time at which this resource will be deleted. This</br>field is set by the server when a graceful deletion is requested by the user, and is not</br>directly settable by a client. The resource is expected to be deleted (no longer visible</br>from resource lists, and not reachable by name) after the time in this field, once the</br>finalizers list is empty. As long as the finalizers list contains items, deletion is blocked.</br>Once the deletionTimestamp is set, this value may not be unset or be set further into the</br>future, although it may be shortened or the resource may be deleted prior to this time.</br>For example, a user may request that a pod is deleted in 30 seconds. The Kubelet will react</br>by sending a graceful termination signal to the containers in the pod. After that 30 seconds,</br>the Kubelet will send a hard termination signal (SIGKILL) to the container and after cleanup,</br>remove the pod from the API. In the presence of network partitions, this object may still</br>exist after this timestamp, until an administrator or automated process can determine the</br>resource is fully terminated.</br>If not set, graceful deletion of the object has not been requested.</br></br>Populated by the system when a graceful deletion is requested.</br>Read-only.</br>More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata</br>+optional |  |
| Finalizers | []string| `[]string` |  | | Must be empty before the object is deleted from the registry. Each entry</br>is an identifier for the responsible component that will remove the entry</br>from the list. If the deletionTimestamp of the object is non-nil, entries</br>in this list can only be removed.</br>Finalizers may be processed and removed in any order.  Order is NOT enforced</br>because it introduces significant risk of stuck finalizers.</br>finalizers is a shared field, any actor with permission can reorder it.</br>If the finalizer list is processed in order, then this can lead to a situation</br>in which the component responsible for the first finalizer in the list is</br>waiting for a signal (field value, external system, or other) produced by a</br>component responsible for a finalizer later in the list, resulting in a deadlock.</br>Without enforced ordering finalizers are free to order amongst themselves and</br>are not vulnerable to ordering changes in the list.</br>+optional</br>+patchStrategy=merge</br>+listType=set |  |
| GenerateName | string| `string` |  | | GenerateName is an optional prefix, used by the server, to generate a unique</br>name ONLY IF the Name field has not been provided.</br>If this field is used, the name returned to the client will be different</br>than the name passed. This value will also be combined with a unique suffix.</br>The provided value has the same validation rules as the Name field,</br>and may be truncated by the length of the suffix required to make the value</br>unique on the server.</br></br>If this field is specified and the generated name exists, the server will return a 409.</br></br>Applied only if Name is not specified.</br>More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#idempotency</br>+optional |  |
| Generation | int64 (formatted integer)| `int64` |  | | A sequence number representing a specific generation of the desired state.</br>Populated by the system. Read-only.</br>+optional |  |
| Kind | string| `string` |  | | Kind is a string value representing the REST resource this object represents.</br>Servers may infer this from the endpoint the client submits requests to.</br>Cannot be updated.</br>In CamelCase.</br>More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds</br>+optional |  |
| Labels | map of string| `map[string]string` |  | | Map of string keys and values that can be used to organize and categorize</br>(scope and select) objects. May match selectors of replication controllers</br>and services.</br>More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/labels</br>+optional |  |
| ManagedFields | [][ManagedFieldsEntry](#managed-fields-entry)| `[]*ManagedFieldsEntry` |  | | ManagedFields maps workflow-id and version to the set of fields</br>that are managed by that workflow. This is mostly for internal</br>housekeeping, and users typically shouldn't need to set or</br>understand this field. A workflow can be the user's name, a</br>controller's name, or the name of a specific apply path like</br>"ci-cd". The set of fields is always in the version that the</br>workflow used when modifying the object.</br></br>+optional</br>+listType=atomic |  |
| Name | string| `string` |  | | Name must be unique within a namespace. Is required when creating resources, although</br>some resources may allow a client to request the generation of an appropriate name</br>automatically. Name is primarily intended for creation idempotence and configuration</br>definition.</br>Cannot be updated.</br>More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names#names</br>+optional |  |
| Namespace | string| `string` |  | | Namespace defines the space within which each name must be unique. An empty namespace is</br>equivalent to the "default" namespace, but "default" is the canonical representation.</br>Not all objects are required to be scoped to a namespace - the value of this field for</br>those objects will be empty.</br></br>Must be a DNS_LABEL.</br>Cannot be updated.</br>More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/namespaces</br>+optional |  |
| OwnerReferences | [][OwnerReference](#owner-reference)| `[]*OwnerReference` |  | | List of objects depended by this object. If ALL objects in the list have</br>been deleted, this object will be garbage collected. If this object is managed by a controller,</br>then an entry in this list will point to this controller, with the controller field set to true.</br>There cannot be more than one managing controller.</br>+optional</br>+patchMergeKey=uid</br>+patchStrategy=merge</br>+listType=map</br>+listMapKey=uid |  |
| ResourceVersion | string| `string` |  | | An opaque value that represents the internal version of this object that can</br>be used by clients to determine when objects have changed. May be used for optimistic</br>concurrency, change detection, and the watch operation on a resource or set of resources.</br>Clients must treat these values as opaque and passed unmodified back to the server.</br>They may only be valid for a particular resource or set of resources.</br></br>Populated by the system.</br>Read-only.</br>Value must be treated as opaque by clients and .</br>More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#concurrency-control-and-consistency</br>+optional |  |
| SelfLink | string| `string` |  | | Deprecated: selfLink is a legacy read-only field that is no longer populated by the system.</br>+optional |  |
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
| Name | string| `string` |  | |  |  |
| Port | int32 (formatted integer)| `int32` |  | |  |  |
| Protocol | string| `string` |  | |  |  |



### <span id="port-number"></span> PortNumber


> +kubebuilder:validation:Minimum=1
+kubebuilder:validation:Maximum=65535
  



| Name | Type | Go type | Default | Description | Example |
|------|------|---------| ------- |-------------|---------|
| PortNumber | int32 (formatted integer)| int32 | | +kubebuilder:validation:Minimum=1</br>+kubebuilder:validation:Maximum=65535 |  |



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
| PreciseHostname | string| string | | Note that as per RFC1035 and RFC1123, a *label* must consist of lower case</br>alphanumeric characters or '-', and must start and end with an alphanumeric</br>character. No other punctuation is allowed.</br></br>+kubebuilder:validation:MinLength=1</br>+kubebuilder:validation:MaxLength=253</br>+kubebuilder:validation:Pattern=`^[a-z0-9]([-a-z0-9]*[a-z0-9])?(\.[a-z0-9]([-a-z0-9]*[a-z0-9])?)*$` |  |



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
| QueryParamMatchType | string| string | | "Exact" - Core</br>"RegularExpression" - Implementation Specific</br></br>Note that values may be added to this enum, implementations</br>must ensure that unknown values will not cause a crash.</br></br>Unknown values here must result in the implementation setting the</br>Accepted Condition for the Route to `status: False`, with a</br>Reason of `UnsupportedValue`.</br></br>+kubebuilder:validation:Enum=Exact;RegularExpression |  |



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
| APIVersion | string| `string` |  | | APIVersion defines the versioned schema of this representation of an object.</br>Servers should convert recognized schemas to the latest internal value, and</br>may reject unrecognized values.</br>More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#resources</br>+optional |  |
| Annotations | map of string| `map[string]string` |  | | Annotations is an unstructured key value map stored with a resource that may be</br>set by external tools to store and retrieve arbitrary metadata. They are not</br>queryable and should be preserved when modifying objects.</br>More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/annotations</br>+optional |  |
| CreationTimestamp | string| `string` |  | | CreationTimestamp is a timestamp representing the server time when this object was</br>created. It is not guaranteed to be set in happens-before order across separate operations.</br>Clients may not set this value. It is represented in RFC3339 form and is in UTC.</br></br>Populated by the system.</br>Read-only.</br>Null for lists.</br>More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata</br>+optional |  |
| DeletionGracePeriodSeconds | int64 (formatted integer)| `int64` |  | | Number of seconds allowed for this object to gracefully terminate before</br>it will be removed from the system. Only set when deletionTimestamp is also set.</br>May only be shortened.</br>Read-only.</br>+optional |  |
| DeletionTimestamp | string| `string` |  | | DeletionTimestamp is RFC 3339 date and time at which this resource will be deleted. This</br>field is set by the server when a graceful deletion is requested by the user, and is not</br>directly settable by a client. The resource is expected to be deleted (no longer visible</br>from resource lists, and not reachable by name) after the time in this field, once the</br>finalizers list is empty. As long as the finalizers list contains items, deletion is blocked.</br>Once the deletionTimestamp is set, this value may not be unset or be set further into the</br>future, although it may be shortened or the resource may be deleted prior to this time.</br>For example, a user may request that a pod is deleted in 30 seconds. The Kubelet will react</br>by sending a graceful termination signal to the containers in the pod. After that 30 seconds,</br>the Kubelet will send a hard termination signal (SIGKILL) to the container and after cleanup,</br>remove the pod from the API. In the presence of network partitions, this object may still</br>exist after this timestamp, until an administrator or automated process can determine the</br>resource is fully terminated.</br>If not set, graceful deletion of the object has not been requested.</br></br>Populated by the system when a graceful deletion is requested.</br>Read-only.</br>More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata</br>+optional |  |
| Finalizers | []string| `[]string` |  | | Must be empty before the object is deleted from the registry. Each entry</br>is an identifier for the responsible component that will remove the entry</br>from the list. If the deletionTimestamp of the object is non-nil, entries</br>in this list can only be removed.</br>Finalizers may be processed and removed in any order.  Order is NOT enforced</br>because it introduces significant risk of stuck finalizers.</br>finalizers is a shared field, any actor with permission can reorder it.</br>If the finalizer list is processed in order, then this can lead to a situation</br>in which the component responsible for the first finalizer in the list is</br>waiting for a signal (field value, external system, or other) produced by a</br>component responsible for a finalizer later in the list, resulting in a deadlock.</br>Without enforced ordering finalizers are free to order amongst themselves and</br>are not vulnerable to ordering changes in the list.</br>+optional</br>+patchStrategy=merge</br>+listType=set |  |
| GenerateName | string| `string` |  | | GenerateName is an optional prefix, used by the server, to generate a unique</br>name ONLY IF the Name field has not been provided.</br>If this field is used, the name returned to the client will be different</br>than the name passed. This value will also be combined with a unique suffix.</br>The provided value has the same validation rules as the Name field,</br>and may be truncated by the length of the suffix required to make the value</br>unique on the server.</br></br>If this field is specified and the generated name exists, the server will return a 409.</br></br>Applied only if Name is not specified.</br>More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#idempotency</br>+optional |  |
| Generation | int64 (formatted integer)| `int64` |  | | A sequence number representing a specific generation of the desired state.</br>Populated by the system. Read-only.</br>+optional |  |
| Kind | string| `string` |  | | Kind is a string value representing the REST resource this object represents.</br>Servers may infer this from the endpoint the client submits requests to.</br>Cannot be updated.</br>In CamelCase.</br>More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds</br>+optional |  |
| Labels | map of string| `map[string]string` |  | | Map of string keys and values that can be used to organize and categorize</br>(scope and select) objects. May match selectors of replication controllers</br>and services.</br>More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/labels</br>+optional |  |
| ManagedFields | [][ManagedFieldsEntry](#managed-fields-entry)| `[]*ManagedFieldsEntry` |  | | ManagedFields maps workflow-id and version to the set of fields</br>that are managed by that workflow. This is mostly for internal</br>housekeeping, and users typically shouldn't need to set or</br>understand this field. A workflow can be the user's name, a</br>controller's name, or the name of a specific apply path like</br>"ci-cd". The set of fields is always in the version that the</br>workflow used when modifying the object.</br></br>+optional</br>+listType=atomic |  |
| Name | string| `string` |  | | Name must be unique within a namespace. Is required when creating resources, although</br>some resources may allow a client to request the generation of an appropriate name</br>automatically. Name is primarily intended for creation idempotence and configuration</br>definition.</br>Cannot be updated.</br>More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names#names</br>+optional |  |
| Namespace | string| `string` |  | | Namespace defines the space within which each name must be unique. An empty namespace is</br>equivalent to the "default" namespace, but "default" is the canonical representation.</br>Not all objects are required to be scoped to a namespace - the value of this field for</br>those objects will be empty.</br></br>Must be a DNS_LABEL.</br>Cannot be updated.</br>More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/namespaces</br>+optional |  |
| OwnerReferences | [][OwnerReference](#owner-reference)| `[]*OwnerReference` |  | | List of objects depended by this object. If ALL objects in the list have</br>been deleted, this object will be garbage collected. If this object is managed by a controller,</br>then an entry in this list will point to this controller, with the controller field set to true.</br>There cannot be more than one managing controller.</br>+optional</br>+patchMergeKey=uid</br>+patchStrategy=merge</br>+listType=map</br>+listMapKey=uid |  |
| ResourceVersion | string| `string` |  | | An opaque value that represents the internal version of this object that can</br>be used by clients to determine when objects have changed. May be used for optimistic</br>concurrency, change detection, and the watch operation on a resource or set of resources.</br>Clients must treat these values as opaque and passed unmodified back to the server.</br>They may only be valid for a particular resource or set of resources.</br></br>Populated by the system.</br>Read-only.</br>Value must be treated as opaque by clients and .</br>More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#concurrency-control-and-consistency</br>+optional |  |
| SelfLink | string| `string` |  | | Deprecated: selfLink is a legacy read-only field that is no longer populated by the system.</br>+optional |  |
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
| From | [][ReferenceGrantFrom](#reference-grant-from)| `[]*ReferenceGrantFrom` |  | | From describes the trusted namespaces and kinds that can reference the</br>resources described in "To". Each entry in this list MUST be considered</br>to be an additional place that references can be valid from, or to put</br>this another way, entries MUST be combined using OR.</br></br>Support: Core</br></br>+kubebuilder:validation:MinItems=1</br>+kubebuilder:validation:MaxItems=16 |  |
| To | [][ReferenceGrantTo](#reference-grant-to)| `[]*ReferenceGrantTo` |  | | To describes the resources that may be referenced by the resources</br>described in "From". Each entry in this list MUST be considered to be an</br>additional place that references can be valid to, or to put this another</br>way, entries MUST be combined using OR.</br></br>Support: Core</br></br>+kubebuilder:validation:MinItems=1</br>+kubebuilder:validation:MaxItems=16 |  |



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



### <span id="request-authentication"></span> RequestAuthentication


> Require JWT for all request for workloads that have label `app:httpbin`

```yaml
apiVersion: security.istio.io/v1
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


apiVersion: security.istio.io/v1
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
apiVersion: security.istio.io/v1
kind: RequestAuthentication
metadata:

name: req-authn-for-all
namespace: istio-system

spec:

jwtRules:
issuer: "issuer-foo"
jwksUri: https://example.com/.well-known/jwks.json


apiVersion: security.istio.io/v1
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
apiVersion: security.istio.io/v1
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


apiVersion: security.istio.io/v1
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
apiVersion: security.istio.io/v1
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

`request.auth.claims.{claim-name}[.{nested-claim}]*` which are extracted from validated JWT tokens.
Use the `.` or `[]` as a separator for nested claim names.
Examples: `request.auth.claims.sub`, `request.auth.claims.name.givenName` and `request.auth.claims[foo.com/name]`.
For more information, see [JWT claim based routing](https://istio.io/latest/docs/tasks/security/authentication/jwt-route/).

The use of matches against JWT claim metadata is only supported in Gateways. The following example shows:

RequestAuthentication to decode and validate a JWT. This also makes the `@request.auth.claims` available for use in the VirtualService.
AuthorizationPolicy to check for valid principals in the request. This makes the JWT required for the request.
VirtualService to route the request based on the "sub" claim.

```yaml
apiVersion: security.istio.io/v1
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


apiVersion: security.istio.io/v1
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
+cue-gen:RequestAuthentication:version:v1
+cue-gen:RequestAuthentication:annotations:helm.sh/resource-policy=keep
+cue-gen:RequestAuthentication:labels:app=istio-pilot,chart=istio,istio=security,heritage=Tiller,release=istio
+cue-gen:RequestAuthentication:subresource:status
+cue-gen:RequestAuthentication:scope:Namespaced
+cue-gen:RequestAuthentication:resource:categories=istio-io,security-istio-io,shortNames=ra
+cue-gen:RequestAuthentication:preserveUnknownFields:false
>

<!-- go code generation tags
+kubetype-gen
+kubetype-gen:groupVersion=security.istio.io/v1
+genclient
+k8s:deepcopy-gen=true
>
<!-- istio code generation tags
+istio.io/sync-from:security/v1beta1/request_authentication.proto
>
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| APIVersion | string| `string` |  | | APIVersion defines the versioned schema of this representation of an object.</br>Servers should convert recognized schemas to the latest internal value, and</br>may reject unrecognized values.</br>More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#resources</br>+optional |  |
| Annotations | map of string| `map[string]string` |  | | Annotations is an unstructured key value map stored with a resource that may be</br>set by external tools to store and retrieve arbitrary metadata. They are not</br>queryable and should be preserved when modifying objects.</br>More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/annotations</br>+optional |  |
| CreationTimestamp | string| `string` |  | | CreationTimestamp is a timestamp representing the server time when this object was</br>created. It is not guaranteed to be set in happens-before order across separate operations.</br>Clients may not set this value. It is represented in RFC3339 form and is in UTC.</br></br>Populated by the system.</br>Read-only.</br>Null for lists.</br>More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata</br>+optional |  |
| DeletionGracePeriodSeconds | int64 (formatted integer)| `int64` |  | | Number of seconds allowed for this object to gracefully terminate before</br>it will be removed from the system. Only set when deletionTimestamp is also set.</br>May only be shortened.</br>Read-only.</br>+optional |  |
| DeletionTimestamp | string| `string` |  | | DeletionTimestamp is RFC 3339 date and time at which this resource will be deleted. This</br>field is set by the server when a graceful deletion is requested by the user, and is not</br>directly settable by a client. The resource is expected to be deleted (no longer visible</br>from resource lists, and not reachable by name) after the time in this field, once the</br>finalizers list is empty. As long as the finalizers list contains items, deletion is blocked.</br>Once the deletionTimestamp is set, this value may not be unset or be set further into the</br>future, although it may be shortened or the resource may be deleted prior to this time.</br>For example, a user may request that a pod is deleted in 30 seconds. The Kubelet will react</br>by sending a graceful termination signal to the containers in the pod. After that 30 seconds,</br>the Kubelet will send a hard termination signal (SIGKILL) to the container and after cleanup,</br>remove the pod from the API. In the presence of network partitions, this object may still</br>exist after this timestamp, until an administrator or automated process can determine the</br>resource is fully terminated.</br>If not set, graceful deletion of the object has not been requested.</br></br>Populated by the system when a graceful deletion is requested.</br>Read-only.</br>More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata</br>+optional |  |
| Finalizers | []string| `[]string` |  | | Must be empty before the object is deleted from the registry. Each entry</br>is an identifier for the responsible component that will remove the entry</br>from the list. If the deletionTimestamp of the object is non-nil, entries</br>in this list can only be removed.</br>Finalizers may be processed and removed in any order.  Order is NOT enforced</br>because it introduces significant risk of stuck finalizers.</br>finalizers is a shared field, any actor with permission can reorder it.</br>If the finalizer list is processed in order, then this can lead to a situation</br>in which the component responsible for the first finalizer in the list is</br>waiting for a signal (field value, external system, or other) produced by a</br>component responsible for a finalizer later in the list, resulting in a deadlock.</br>Without enforced ordering finalizers are free to order amongst themselves and</br>are not vulnerable to ordering changes in the list.</br>+optional</br>+patchStrategy=merge</br>+listType=set |  |
| GenerateName | string| `string` |  | | GenerateName is an optional prefix, used by the server, to generate a unique</br>name ONLY IF the Name field has not been provided.</br>If this field is used, the name returned to the client will be different</br>than the name passed. This value will also be combined with a unique suffix.</br>The provided value has the same validation rules as the Name field,</br>and may be truncated by the length of the suffix required to make the value</br>unique on the server.</br></br>If this field is specified and the generated name exists, the server will return a 409.</br></br>Applied only if Name is not specified.</br>More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#idempotency</br>+optional |  |
| Generation | int64 (formatted integer)| `int64` |  | | A sequence number representing a specific generation of the desired state.</br>Populated by the system. Read-only.</br>+optional |  |
| Kind | string| `string` |  | | Kind is a string value representing the REST resource this object represents.</br>Servers may infer this from the endpoint the client submits requests to.</br>Cannot be updated.</br>In CamelCase.</br>More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds</br>+optional |  |
| Labels | map of string| `map[string]string` |  | | Map of string keys and values that can be used to organize and categorize</br>(scope and select) objects. May match selectors of replication controllers</br>and services.</br>More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/labels</br>+optional |  |
| ManagedFields | [][ManagedFieldsEntry](#managed-fields-entry)| `[]*ManagedFieldsEntry` |  | | ManagedFields maps workflow-id and version to the set of fields</br>that are managed by that workflow. This is mostly for internal</br>housekeeping, and users typically shouldn't need to set or</br>understand this field. A workflow can be the user's name, a</br>controller's name, or the name of a specific apply path like</br>"ci-cd". The set of fields is always in the version that the</br>workflow used when modifying the object.</br></br>+optional</br>+listType=atomic |  |
| Name | string| `string` |  | | Name must be unique within a namespace. Is required when creating resources, although</br>some resources may allow a client to request the generation of an appropriate name</br>automatically. Name is primarily intended for creation idempotence and configuration</br>definition.</br>Cannot be updated.</br>More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names#names</br>+optional |  |
| Namespace | string| `string` |  | | Namespace defines the space within which each name must be unique. An empty namespace is</br>equivalent to the "default" namespace, but "default" is the canonical representation.</br>Not all objects are required to be scoped to a namespace - the value of this field for</br>those objects will be empty.</br></br>Must be a DNS_LABEL.</br>Cannot be updated.</br>More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/namespaces</br>+optional |  |
| OwnerReferences | [][OwnerReference](#owner-reference)| `[]*OwnerReference` |  | | List of objects depended by this object. If ALL objects in the list have</br>been deleted, this object will be garbage collected. If this object is managed by a controller,</br>then an entry in this list will point to this controller, with the controller field set to true.</br>There cannot be more than one managing controller.</br>+optional</br>+patchMergeKey=uid</br>+patchStrategy=merge</br>+listType=map</br>+listMapKey=uid |  |
| ResourceVersion | string| `string` |  | | An opaque value that represents the internal version of this object that can</br>be used by clients to determine when objects have changed. May be used for optimistic</br>concurrency, change detection, and the watch operation on a resource or set of resources.</br>Clients must treat these values as opaque and passed unmodified back to the server.</br>They may only be valid for a particular resource or set of resources.</br></br>Populated by the system.</br>Read-only.</br>Value must be treated as opaque by clients and .</br>More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#concurrency-control-and-consistency</br>+optional |  |
| SelfLink | string| `string` |  | | Deprecated: selfLink is a legacy read-only field that is no longer populated by the system.</br>+optional |  |
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
| Conditions | [][Condition](#condition)| `[]*Condition` |  | | Conditions describes the status of the route with respect to the Gateway.</br>Note that the route's availability is also subject to the Gateway's own</br>status conditions and listener status.</br></br>If the Route's ParentRef specifies an existing Gateway that supports</br>Routes of this kind AND that Gateway's controller has sufficient access,</br>then that Gateway's controller MUST set the "Accepted" condition on the</br>Route, to indicate whether the route has been accepted or rejected by the</br>Gateway, and why.</br></br>A Route MUST be considered "Accepted" if at least one of the Route's</br>rules is implemented by the Gateway.</br></br>There are a number of cases where the "Accepted" condition may not be set</br>due to lack of controller visibility, that includes when:</br></br>The Route refers to a non-existent parent.</br>The Route is of a type that the controller does not support.</br>The Route is in a namespace the controller does not have access to.</br></br>+listType=map</br>+listMapKey=type</br>+kubebuilder:validation:MinItems=1</br>+kubebuilder:validation:MaxItems=8 |  |
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
| SectionName | string| string | | In the following resources, SectionName is interpreted as the following:</br></br>Gateway: Listener name</br>HTTPRoute: HTTPRouteRule name</br>Service: Port name</br></br>Section names can have a variety of forms, including RFC 1123 subdomains,</br>RFC 1123 labels, or RFC 1035 labels.</br></br>This validation is based off of the corresponding Kubernetes validation:</br>https://github.com/kubernetes/apimachinery/blob/02cfb53916346d085a6c6c7c66f882e3c6b0eca6/pkg/util/validation/validation.go#L208</br></br>Valid values include:</br></br>"example"</br>"foo-example"</br>"example.com"</br>"foo.example.com"</br></br>Invalid values include:</br></br>"example.com/bar" - "/" is an invalid character</br></br>+kubebuilder:validation:Pattern=`^[a-z0-9]([-a-z0-9]*[a-z0-9])?(\.[a-z0-9]([-a-z0-9]*[a-z0-9])?)*$`</br>+kubebuilder:validation:MinLength=1</br>+kubebuilder:validation:MaxLength=253 |  |



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
| IstioSidecar | boolean| `bool` |  | |  |  |
| K8sHTTPRoutes | [][HTTPRoute](#http-route)| `[]*HTTPRoute` |  | |  |  |
| K8sReferenceGrants | [][ReferenceGrant](#reference-grant)| `[]*ReferenceGrant` |  | |  |  |
| ServiceEntries | [][ServiceEntry](#service-entry)| `[]*ServiceEntry` |  | |  |  |
| SubServices | [][ServiceOverview](#service-overview)| `[]*ServiceOverview` |  | |  |  |
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
+cue-gen:ServiceEntry:version:v1
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
>

<!-- go code generation tags
+kubetype-gen
+kubetype-gen:groupVersion=networking.istio.io/v1
+genclient
+k8s:deepcopy-gen=true
>
<!-- istio code generation tags
+istio.io/sync-from:networking/v1alpha3/service_entry.proto
>
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| APIVersion | string| `string` |  | | APIVersion defines the versioned schema of this representation of an object.</br>Servers should convert recognized schemas to the latest internal value, and</br>may reject unrecognized values.</br>More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#resources</br>+optional |  |
| Annotations | map of string| `map[string]string` |  | | Annotations is an unstructured key value map stored with a resource that may be</br>set by external tools to store and retrieve arbitrary metadata. They are not</br>queryable and should be preserved when modifying objects.</br>More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/annotations</br>+optional |  |
| CreationTimestamp | string| `string` |  | | CreationTimestamp is a timestamp representing the server time when this object was</br>created. It is not guaranteed to be set in happens-before order across separate operations.</br>Clients may not set this value. It is represented in RFC3339 form and is in UTC.</br></br>Populated by the system.</br>Read-only.</br>Null for lists.</br>More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata</br>+optional |  |
| DeletionGracePeriodSeconds | int64 (formatted integer)| `int64` |  | | Number of seconds allowed for this object to gracefully terminate before</br>it will be removed from the system. Only set when deletionTimestamp is also set.</br>May only be shortened.</br>Read-only.</br>+optional |  |
| DeletionTimestamp | string| `string` |  | | DeletionTimestamp is RFC 3339 date and time at which this resource will be deleted. This</br>field is set by the server when a graceful deletion is requested by the user, and is not</br>directly settable by a client. The resource is expected to be deleted (no longer visible</br>from resource lists, and not reachable by name) after the time in this field, once the</br>finalizers list is empty. As long as the finalizers list contains items, deletion is blocked.</br>Once the deletionTimestamp is set, this value may not be unset or be set further into the</br>future, although it may be shortened or the resource may be deleted prior to this time.</br>For example, a user may request that a pod is deleted in 30 seconds. The Kubelet will react</br>by sending a graceful termination signal to the containers in the pod. After that 30 seconds,</br>the Kubelet will send a hard termination signal (SIGKILL) to the container and after cleanup,</br>remove the pod from the API. In the presence of network partitions, this object may still</br>exist after this timestamp, until an administrator or automated process can determine the</br>resource is fully terminated.</br>If not set, graceful deletion of the object has not been requested.</br></br>Populated by the system when a graceful deletion is requested.</br>Read-only.</br>More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata</br>+optional |  |
| Finalizers | []string| `[]string` |  | | Must be empty before the object is deleted from the registry. Each entry</br>is an identifier for the responsible component that will remove the entry</br>from the list. If the deletionTimestamp of the object is non-nil, entries</br>in this list can only be removed.</br>Finalizers may be processed and removed in any order.  Order is NOT enforced</br>because it introduces significant risk of stuck finalizers.</br>finalizers is a shared field, any actor with permission can reorder it.</br>If the finalizer list is processed in order, then this can lead to a situation</br>in which the component responsible for the first finalizer in the list is</br>waiting for a signal (field value, external system, or other) produced by a</br>component responsible for a finalizer later in the list, resulting in a deadlock.</br>Without enforced ordering finalizers are free to order amongst themselves and</br>are not vulnerable to ordering changes in the list.</br>+optional</br>+patchStrategy=merge</br>+listType=set |  |
| GenerateName | string| `string` |  | | GenerateName is an optional prefix, used by the server, to generate a unique</br>name ONLY IF the Name field has not been provided.</br>If this field is used, the name returned to the client will be different</br>than the name passed. This value will also be combined with a unique suffix.</br>The provided value has the same validation rules as the Name field,</br>and may be truncated by the length of the suffix required to make the value</br>unique on the server.</br></br>If this field is specified and the generated name exists, the server will return a 409.</br></br>Applied only if Name is not specified.</br>More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#idempotency</br>+optional |  |
| Generation | int64 (formatted integer)| `int64` |  | | A sequence number representing a specific generation of the desired state.</br>Populated by the system. Read-only.</br>+optional |  |
| Kind | string| `string` |  | | Kind is a string value representing the REST resource this object represents.</br>Servers may infer this from the endpoint the client submits requests to.</br>Cannot be updated.</br>In CamelCase.</br>More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds</br>+optional |  |
| Labels | map of string| `map[string]string` |  | | Map of string keys and values that can be used to organize and categorize</br>(scope and select) objects. May match selectors of replication controllers</br>and services.</br>More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/labels</br>+optional |  |
| ManagedFields | [][ManagedFieldsEntry](#managed-fields-entry)| `[]*ManagedFieldsEntry` |  | | ManagedFields maps workflow-id and version to the set of fields</br>that are managed by that workflow. This is mostly for internal</br>housekeeping, and users typically shouldn't need to set or</br>understand this field. A workflow can be the user's name, a</br>controller's name, or the name of a specific apply path like</br>"ci-cd". The set of fields is always in the version that the</br>workflow used when modifying the object.</br></br>+optional</br>+listType=atomic |  |
| Name | string| `string` |  | | Name must be unique within a namespace. Is required when creating resources, although</br>some resources may allow a client to request the generation of an appropriate name</br>automatically. Name is primarily intended for creation idempotence and configuration</br>definition.</br>Cannot be updated.</br>More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names#names</br>+optional |  |
| Namespace | string| `string` |  | | Namespace defines the space within which each name must be unique. An empty namespace is</br>equivalent to the "default" namespace, but "default" is the canonical representation.</br>Not all objects are required to be scoped to a namespace - the value of this field for</br>those objects will be empty.</br></br>Must be a DNS_LABEL.</br>Cannot be updated.</br>More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/namespaces</br>+optional |  |
| OwnerReferences | [][OwnerReference](#owner-reference)| `[]*OwnerReference` |  | | List of objects depended by this object. If ALL objects in the list have</br>been deleted, this object will be garbage collected. If this object is managed by a controller,</br>then an entry in this list will point to this controller, with the controller field set to true.</br>There cannot be more than one managing controller.</br>+optional</br>+patchMergeKey=uid</br>+patchStrategy=merge</br>+listType=map</br>+listMapKey=uid |  |
| ResourceVersion | string| `string` |  | | An opaque value that represents the internal version of this object that can</br>be used by clients to determine when objects have changed. May be used for optimistic</br>concurrency, change detection, and the watch operation on a resource or set of resources.</br>Clients must treat these values as opaque and passed unmodified back to the server.</br>They may only be valid for a particular resource or set of resources.</br></br>Populated by the system.</br>Read-only.</br>Value must be treated as opaque by clients and .</br>More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#concurrency-control-and-consistency</br>+optional |  |
| SelfLink | string| `string` |  | | Deprecated: selfLink is a legacy read-only field that is no longer populated by the system.</br>+optional |  |
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
| IstioAmbient | boolean| `bool` | ✓ | | Check if it has Ambient enabled | `true` |
| IstioReferences | [][IstioValidationKey](#istio-validation-key)| `[]*IstioValidationKey` |  | | Istio References |  |
| IstioSidecar | boolean| `bool` | ✓ | | Define if Pods related to this Service has an IstioSidecar deployed | `true` |
| KialiWizard | string| `string` |  | | Kiali Wizard scenario, if any |  |
| Labels | map of string| `map[string]string` |  | | Labels for Service |  |
| Name | string| `string` | ✓ | | Name of the Service | `reviews-v1` |
| Namespace | string| `string` |  | | Namespace of the Service |  |
| Ports | map of int64 (formatted integer)| `map[string]int64` |  | | Names and Ports of Service |  |
| Selector | map of string| `map[string]string` |  | | Selector for Service |  |
| ServiceRegistry | string| `string` |  | | ServiceRegistry values:</br>Kubernetes: 	is a service registry backed by k8s API server</br>External: 	is a service registry for externally provided ServiceEntries</br>Federation:  special case when registry is provided from a federated environment |  |
| additionalDetailSample | [AdditionalItem](#additional-item)| `AdditionalItem` |  | |  |  |
| health | [ServiceHealth](#service-health)| `ServiceHealth` |  | |  |  |



### <span id="service-reference"></span> ServiceReference


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Name | string| `string` |  | |  |  |
| Namespace | string| `string` |  | |  |  |



### <span id="session-persistence"></span> SessionPersistence


> +kubebuilder:validation:XValidation:message="AbsoluteTimeout must be specified when cookie lifetimeType is Permanent",rule="!has(self.cookieConfig.lifetimeType) || self.cookieConfig.lifetimeType != 'Permanent' || has(self.absoluteTimeout)"
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| SessionName | string| `string` |  | | SessionName defines the name of the persistent session token</br>which may be reflected in the cookie or the header. Users</br>should avoid reusing session names to prevent unintended</br>consequences, such as rejection or unpredictable behavior.</br></br>Support: Implementation-specific</br></br>+optional</br>+kubebuilder:validation:MaxLength=128 |  |
| absoluteTimeout | [Duration](#duration)| `Duration` |  | |  |  |
| cookieConfig | [CookieConfig](#cookie-config)| `CookieConfig` |  | |  |  |
| idleTimeout | [Duration](#duration)| `Duration` |  | |  |  |
| type | [SessionPersistenceType](#session-persistence-type)| `SessionPersistenceType` |  | |  |  |



### <span id="session-persistence-type"></span> SessionPersistenceType


> +kubebuilder:validation:Enum=Cookie;Header
  



| Name | Type | Go type | Default | Description | Example |
|------|------|---------| ------- |-------------|---------|
| SessionPersistenceType | string| string | | +kubebuilder:validation:Enum=Cookie;Header |  |



### <span id="severity-level"></span> SeverityLevel


  

| Name | Type | Go type | Default | Description | Example |
|------|------|---------| ------- |-------------|---------|
| SeverityLevel | string| string | |  |  |



### <span id="sidecar"></span> Sidecar


> <!-- crd generation tags
+cue-gen:Sidecar:groupName:networking.istio.io
+cue-gen:Sidecar:version:v1
+cue-gen:Sidecar:annotations:helm.sh/resource-policy=keep
+cue-gen:Sidecar:labels:app=istio-pilot,chart=istio,heritage=Tiller,release=istio
+cue-gen:Sidecar:subresource:status
+cue-gen:Sidecar:scope:Namespaced
+cue-gen:Sidecar:resource:categories=istio-io,networking-istio-io
+cue-gen:Sidecar:preserveUnknownFields:false
>

<!-- go code generation tags
+kubetype-gen
+kubetype-gen:groupVersion=networking.istio.io/v1
+genclient
+k8s:deepcopy-gen=true
>
<!-- istio code generation tags
+istio.io/sync-from:networking/v1alpha3/sidecar.proto
>
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| APIVersion | string| `string` |  | | APIVersion defines the versioned schema of this representation of an object.</br>Servers should convert recognized schemas to the latest internal value, and</br>may reject unrecognized values.</br>More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#resources</br>+optional |  |
| Annotations | map of string| `map[string]string` |  | | Annotations is an unstructured key value map stored with a resource that may be</br>set by external tools to store and retrieve arbitrary metadata. They are not</br>queryable and should be preserved when modifying objects.</br>More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/annotations</br>+optional |  |
| CreationTimestamp | string| `string` |  | | CreationTimestamp is a timestamp representing the server time when this object was</br>created. It is not guaranteed to be set in happens-before order across separate operations.</br>Clients may not set this value. It is represented in RFC3339 form and is in UTC.</br></br>Populated by the system.</br>Read-only.</br>Null for lists.</br>More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata</br>+optional |  |
| DeletionGracePeriodSeconds | int64 (formatted integer)| `int64` |  | | Number of seconds allowed for this object to gracefully terminate before</br>it will be removed from the system. Only set when deletionTimestamp is also set.</br>May only be shortened.</br>Read-only.</br>+optional |  |
| DeletionTimestamp | string| `string` |  | | DeletionTimestamp is RFC 3339 date and time at which this resource will be deleted. This</br>field is set by the server when a graceful deletion is requested by the user, and is not</br>directly settable by a client. The resource is expected to be deleted (no longer visible</br>from resource lists, and not reachable by name) after the time in this field, once the</br>finalizers list is empty. As long as the finalizers list contains items, deletion is blocked.</br>Once the deletionTimestamp is set, this value may not be unset or be set further into the</br>future, although it may be shortened or the resource may be deleted prior to this time.</br>For example, a user may request that a pod is deleted in 30 seconds. The Kubelet will react</br>by sending a graceful termination signal to the containers in the pod. After that 30 seconds,</br>the Kubelet will send a hard termination signal (SIGKILL) to the container and after cleanup,</br>remove the pod from the API. In the presence of network partitions, this object may still</br>exist after this timestamp, until an administrator or automated process can determine the</br>resource is fully terminated.</br>If not set, graceful deletion of the object has not been requested.</br></br>Populated by the system when a graceful deletion is requested.</br>Read-only.</br>More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata</br>+optional |  |
| Finalizers | []string| `[]string` |  | | Must be empty before the object is deleted from the registry. Each entry</br>is an identifier for the responsible component that will remove the entry</br>from the list. If the deletionTimestamp of the object is non-nil, entries</br>in this list can only be removed.</br>Finalizers may be processed and removed in any order.  Order is NOT enforced</br>because it introduces significant risk of stuck finalizers.</br>finalizers is a shared field, any actor with permission can reorder it.</br>If the finalizer list is processed in order, then this can lead to a situation</br>in which the component responsible for the first finalizer in the list is</br>waiting for a signal (field value, external system, or other) produced by a</br>component responsible for a finalizer later in the list, resulting in a deadlock.</br>Without enforced ordering finalizers are free to order amongst themselves and</br>are not vulnerable to ordering changes in the list.</br>+optional</br>+patchStrategy=merge</br>+listType=set |  |
| GenerateName | string| `string` |  | | GenerateName is an optional prefix, used by the server, to generate a unique</br>name ONLY IF the Name field has not been provided.</br>If this field is used, the name returned to the client will be different</br>than the name passed. This value will also be combined with a unique suffix.</br>The provided value has the same validation rules as the Name field,</br>and may be truncated by the length of the suffix required to make the value</br>unique on the server.</br></br>If this field is specified and the generated name exists, the server will return a 409.</br></br>Applied only if Name is not specified.</br>More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#idempotency</br>+optional |  |
| Generation | int64 (formatted integer)| `int64` |  | | A sequence number representing a specific generation of the desired state.</br>Populated by the system. Read-only.</br>+optional |  |
| Kind | string| `string` |  | | Kind is a string value representing the REST resource this object represents.</br>Servers may infer this from the endpoint the client submits requests to.</br>Cannot be updated.</br>In CamelCase.</br>More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds</br>+optional |  |
| Labels | map of string| `map[string]string` |  | | Map of string keys and values that can be used to organize and categorize</br>(scope and select) objects. May match selectors of replication controllers</br>and services.</br>More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/labels</br>+optional |  |
| ManagedFields | [][ManagedFieldsEntry](#managed-fields-entry)| `[]*ManagedFieldsEntry` |  | | ManagedFields maps workflow-id and version to the set of fields</br>that are managed by that workflow. This is mostly for internal</br>housekeeping, and users typically shouldn't need to set or</br>understand this field. A workflow can be the user's name, a</br>controller's name, or the name of a specific apply path like</br>"ci-cd". The set of fields is always in the version that the</br>workflow used when modifying the object.</br></br>+optional</br>+listType=atomic |  |
| Name | string| `string` |  | | Name must be unique within a namespace. Is required when creating resources, although</br>some resources may allow a client to request the generation of an appropriate name</br>automatically. Name is primarily intended for creation idempotence and configuration</br>definition.</br>Cannot be updated.</br>More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names#names</br>+optional |  |
| Namespace | string| `string` |  | | Namespace defines the space within which each name must be unique. An empty namespace is</br>equivalent to the "default" namespace, but "default" is the canonical representation.</br>Not all objects are required to be scoped to a namespace - the value of this field for</br>those objects will be empty.</br></br>Must be a DNS_LABEL.</br>Cannot be updated.</br>More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/namespaces</br>+optional |  |
| OwnerReferences | [][OwnerReference](#owner-reference)| `[]*OwnerReference` |  | | List of objects depended by this object. If ALL objects in the list have</br>been deleted, this object will be garbage collected. If this object is managed by a controller,</br>then an entry in this list will point to this controller, with the controller field set to true.</br>There cannot be more than one managing controller.</br>+optional</br>+patchMergeKey=uid</br>+patchStrategy=merge</br>+listType=map</br>+listMapKey=uid |  |
| ResourceVersion | string| `string` |  | | An opaque value that represents the internal version of this object that can</br>be used by clients to determine when objects have changed. May be used for optimistic</br>concurrency, change detection, and the watch operation on a resource or set of resources.</br>Clients must treat these values as opaque and passed unmodified back to the server.</br>They may only be valid for a particular resource or set of resources.</br></br>Populated by the system.</br>Read-only.</br>Value must be treated as opaque by clients and .</br>More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#concurrency-control-and-consistency</br>+optional |  |
| SelfLink | string| `string` |  | | Deprecated: selfLink is a legacy read-only field that is no longer populated by the system.</br>+optional |  |
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
| Status | map of string| `map[string]string` | ✓ | | The state of Kiali</br>A hash of key,values with versions of Kiali and state |  |
| WarningMessages | []string| `[]string` |  | | An array of warningMessages. CAUTION: Please read the doc comments the in AddWarningMessages func. |  |
| istioEnvironment | [IstioEnvironment](#istio-environment)| `IstioEnvironment` | ✓ | |  |  |



### <span id="tcp-route"></span> TCPRoute


> TCPRoute provides a way to route TCP requests. When combined with a Gateway
listener, it can be used to forward connections on the port specified by the
listener to a set of backends specified by the TCPRoute.
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| APIVersion | string| `string` |  | | APIVersion defines the versioned schema of this representation of an object.</br>Servers should convert recognized schemas to the latest internal value, and</br>may reject unrecognized values.</br>More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#resources</br>+optional |  |
| Annotations | map of string| `map[string]string` |  | | Annotations is an unstructured key value map stored with a resource that may be</br>set by external tools to store and retrieve arbitrary metadata. They are not</br>queryable and should be preserved when modifying objects.</br>More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/annotations</br>+optional |  |
| CreationTimestamp | string| `string` |  | | CreationTimestamp is a timestamp representing the server time when this object was</br>created. It is not guaranteed to be set in happens-before order across separate operations.</br>Clients may not set this value. It is represented in RFC3339 form and is in UTC.</br></br>Populated by the system.</br>Read-only.</br>Null for lists.</br>More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata</br>+optional |  |
| DeletionGracePeriodSeconds | int64 (formatted integer)| `int64` |  | | Number of seconds allowed for this object to gracefully terminate before</br>it will be removed from the system. Only set when deletionTimestamp is also set.</br>May only be shortened.</br>Read-only.</br>+optional |  |
| DeletionTimestamp | string| `string` |  | | DeletionTimestamp is RFC 3339 date and time at which this resource will be deleted. This</br>field is set by the server when a graceful deletion is requested by the user, and is not</br>directly settable by a client. The resource is expected to be deleted (no longer visible</br>from resource lists, and not reachable by name) after the time in this field, once the</br>finalizers list is empty. As long as the finalizers list contains items, deletion is blocked.</br>Once the deletionTimestamp is set, this value may not be unset or be set further into the</br>future, although it may be shortened or the resource may be deleted prior to this time.</br>For example, a user may request that a pod is deleted in 30 seconds. The Kubelet will react</br>by sending a graceful termination signal to the containers in the pod. After that 30 seconds,</br>the Kubelet will send a hard termination signal (SIGKILL) to the container and after cleanup,</br>remove the pod from the API. In the presence of network partitions, this object may still</br>exist after this timestamp, until an administrator or automated process can determine the</br>resource is fully terminated.</br>If not set, graceful deletion of the object has not been requested.</br></br>Populated by the system when a graceful deletion is requested.</br>Read-only.</br>More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata</br>+optional |  |
| Finalizers | []string| `[]string` |  | | Must be empty before the object is deleted from the registry. Each entry</br>is an identifier for the responsible component that will remove the entry</br>from the list. If the deletionTimestamp of the object is non-nil, entries</br>in this list can only be removed.</br>Finalizers may be processed and removed in any order.  Order is NOT enforced</br>because it introduces significant risk of stuck finalizers.</br>finalizers is a shared field, any actor with permission can reorder it.</br>If the finalizer list is processed in order, then this can lead to a situation</br>in which the component responsible for the first finalizer in the list is</br>waiting for a signal (field value, external system, or other) produced by a</br>component responsible for a finalizer later in the list, resulting in a deadlock.</br>Without enforced ordering finalizers are free to order amongst themselves and</br>are not vulnerable to ordering changes in the list.</br>+optional</br>+patchStrategy=merge</br>+listType=set |  |
| GenerateName | string| `string` |  | | GenerateName is an optional prefix, used by the server, to generate a unique</br>name ONLY IF the Name field has not been provided.</br>If this field is used, the name returned to the client will be different</br>than the name passed. This value will also be combined with a unique suffix.</br>The provided value has the same validation rules as the Name field,</br>and may be truncated by the length of the suffix required to make the value</br>unique on the server.</br></br>If this field is specified and the generated name exists, the server will return a 409.</br></br>Applied only if Name is not specified.</br>More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#idempotency</br>+optional |  |
| Generation | int64 (formatted integer)| `int64` |  | | A sequence number representing a specific generation of the desired state.</br>Populated by the system. Read-only.</br>+optional |  |
| Kind | string| `string` |  | | Kind is a string value representing the REST resource this object represents.</br>Servers may infer this from the endpoint the client submits requests to.</br>Cannot be updated.</br>In CamelCase.</br>More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds</br>+optional |  |
| Labels | map of string| `map[string]string` |  | | Map of string keys and values that can be used to organize and categorize</br>(scope and select) objects. May match selectors of replication controllers</br>and services.</br>More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/labels</br>+optional |  |
| ManagedFields | [][ManagedFieldsEntry](#managed-fields-entry)| `[]*ManagedFieldsEntry` |  | | ManagedFields maps workflow-id and version to the set of fields</br>that are managed by that workflow. This is mostly for internal</br>housekeeping, and users typically shouldn't need to set or</br>understand this field. A workflow can be the user's name, a</br>controller's name, or the name of a specific apply path like</br>"ci-cd". The set of fields is always in the version that the</br>workflow used when modifying the object.</br></br>+optional</br>+listType=atomic |  |
| Name | string| `string` |  | | Name must be unique within a namespace. Is required when creating resources, although</br>some resources may allow a client to request the generation of an appropriate name</br>automatically. Name is primarily intended for creation idempotence and configuration</br>definition.</br>Cannot be updated.</br>More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names#names</br>+optional |  |
| Namespace | string| `string` |  | | Namespace defines the space within which each name must be unique. An empty namespace is</br>equivalent to the "default" namespace, but "default" is the canonical representation.</br>Not all objects are required to be scoped to a namespace - the value of this field for</br>those objects will be empty.</br></br>Must be a DNS_LABEL.</br>Cannot be updated.</br>More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/namespaces</br>+optional |  |
| OwnerReferences | [][OwnerReference](#owner-reference)| `[]*OwnerReference` |  | | List of objects depended by this object. If ALL objects in the list have</br>been deleted, this object will be garbage collected. If this object is managed by a controller,</br>then an entry in this list will point to this controller, with the controller field set to true.</br>There cannot be more than one managing controller.</br>+optional</br>+patchMergeKey=uid</br>+patchStrategy=merge</br>+listType=map</br>+listMapKey=uid |  |
| ResourceVersion | string| `string` |  | | An opaque value that represents the internal version of this object that can</br>be used by clients to determine when objects have changed. May be used for optimistic</br>concurrency, change detection, and the watch operation on a resource or set of resources.</br>Clients must treat these values as opaque and passed unmodified back to the server.</br>They may only be valid for a particular resource or set of resources.</br></br>Populated by the system.</br>Read-only.</br>Value must be treated as opaque by clients and .</br>More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#concurrency-control-and-consistency</br>+optional |  |
| SelfLink | string| `string` |  | | Deprecated: selfLink is a legacy read-only field that is no longer populated by the system.</br>+optional |  |
| spec | [TCPRouteSpec](#tcp-route-spec)| `TCPRouteSpec` |  | |  |  |
| status | [TCPRouteStatus](#tcp-route-status)| `TCPRouteStatus` |  | |  |  |
| uid | [UID](#uid)| `UID` |  | |  |  |



### <span id="tcp-route-rule"></span> TCPRouteRule


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| BackendRefs | [][BackendRef](#backend-ref)| `[]*BackendRef` |  | | BackendRefs defines the backend(s) where matching requests should be</br>sent. If unspecified or invalid (refers to a non-existent resource or a</br>Service with no endpoints), the underlying implementation MUST actively</br>reject connection attempts to this backend. Connection rejections must</br>respect weight; if an invalid backend is requested to have 80% of</br>connections, then 80% of connections must be rejected instead.</br></br>Support: Core for Kubernetes Service</br></br>Support: Extended for Kubernetes ServiceImport</br></br>Support: Implementation-specific for any other resource</br></br>Support for weight: Extended</br></br>+kubebuilder:validation:MinItems=1</br>+kubebuilder:validation:MaxItems=16 |  |



### <span id="tcp-route-spec"></span> TCPRouteSpec


> TCPRouteSpec defines the desired state of TCPRoute
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| ParentRefs | [][ParentReference](#parent-reference)| `[]*ParentReference` |  | | ParentRefs references the resources (usually Gateways) that a Route wants</br>to be attached to. Note that the referenced parent resource needs to</br>allow this for the attachment to be complete. For Gateways, that means</br>the Gateway needs to allow attachment from Routes of this kind and</br>namespace. For Services, that means the Service must either be in the same</br>namespace for a "producer" route, or the mesh implementation must support</br>and allow "consumer" routes for the referenced Service. ReferenceGrant is</br>not applicable for governing ParentRefs to Services - it is not possible to</br>create a "producer" route for a Service in a different namespace from the</br>Route.</br></br>There are two kinds of parent resources with "Core" support:</br></br>Gateway (Gateway conformance profile)</br>Service (Mesh conformance profile, ClusterIP Services only)</br></br>This API may be extended in the future to support additional kinds of parent</br>resources.</br></br>ParentRefs must be _distinct_. This means either that:</br></br>They select different objects.  If this is the case, then parentRef</br>entries are distinct. In terms of fields, this means that the</br>multi-part key defined by `group`, `kind`, `namespace`, and `name` must</br>be unique across all parentRef entries in the Route.</br>They do not select different objects, but for each optional field used,</br>each ParentRef that selects the same object must set the same set of</br>optional fields to different values. If one ParentRef sets a</br>combination of optional fields, all must set the same combination.</br></br>Some examples:</br></br>If one ParentRef sets `sectionName`, all ParentRefs referencing the</br>same object must also set `sectionName`.</br>If one ParentRef sets `port`, all ParentRefs referencing the same</br>object must also set `port`.</br>If one ParentRef sets `sectionName` and `port`, all ParentRefs</br>referencing the same object must also set `sectionName` and `port`.</br></br>It is possible to separately reference multiple distinct objects that may</br>be collapsed by an implementation. For example, some implementations may</br>choose to merge compatible Gateway Listeners together. If that is the</br>case, the list of routes attached to those resources should also be</br>merged.</br></br>Note that for ParentRefs that cross namespace boundaries, there are specific</br>rules. Cross-namespace references are only valid if they are explicitly</br>allowed by something in the namespace they are referring to. For example,</br>Gateway has the AllowedRoutes field, and ReferenceGrant provides a</br>generic way to enable other kinds of cross-namespace reference.</br></br><gateway:experimental:description></br>ParentRefs from a Route to a Service in the same namespace are "producer"</br>routes, which apply default routing rules to inbound connections from</br>any namespace to the Service.</br></br>ParentRefs from a Route to a Service in a different namespace are</br>"consumer" routes, and these routing rules are only applied to outbound</br>connections originating from the same namespace as the Route, for which</br>the intended destination of the connections are a Service targeted as a</br>ParentRef of the Route.</br></gateway:experimental:description></br></br>+optional</br>+kubebuilder:validation:MaxItems=32</br><gateway:standard:validation:XValidation:message="sectionName must be specified when parentRefs includes 2 or more references to the same parent",rule="self.all(p1, self.all(p2, p1.group == p2.group && p1.kind == p2.kind && p1.name == p2.name && (((!has(p1.__namespace__) || p1.__namespace__ == '') && (!has(p2.__namespace__) || p2.__namespace__ == '')) || (has(p1.__namespace__) && has(p2.__namespace__) && p1.__namespace__ == p2.__namespace__ )) ? ((!has(p1.sectionName) || p1.sectionName == '') == (!has(p2.sectionName) || p2.sectionName == '')) : true))"></br><gateway:standard:validation:XValidation:message="sectionName must be unique when parentRefs includes 2 or more references to the same parent",rule="self.all(p1, self.exists_one(p2, p1.group == p2.group && p1.kind == p2.kind && p1.name == p2.name && (((!has(p1.__namespace__) || p1.__namespace__ == '') && (!has(p2.__namespace__) || p2.__namespace__ == '')) || (has(p1.__namespace__) && has(p2.__namespace__) && p1.__namespace__ == p2.__namespace__ )) && (((!has(p1.sectionName) || p1.sectionName == '') && (!has(p2.sectionName) || p2.sectionName == '')) || (has(p1.sectionName) && has(p2.sectionName) && p1.sectionName == p2.sectionName))))"></br><gateway:experimental:validation:XValidation:message="sectionName or port must be specified when parentRefs includes 2 or more references to the same parent",rule="self.all(p1, self.all(p2, p1.group == p2.group && p1.kind == p2.kind && p1.name == p2.name && (((!has(p1.__namespace__) || p1.__namespace__ == '') && (!has(p2.__namespace__) || p2.__namespace__ == '')) || (has(p1.__namespace__) && has(p2.__namespace__) && p1.__namespace__ == p2.__namespace__)) ? ((!has(p1.sectionName) || p1.sectionName == '') == (!has(p2.sectionName) || p2.sectionName == '') && (!has(p1.port) || p1.port == 0) == (!has(p2.port) || p2.port == 0)): true))"></br><gateway:experimental:validation:XValidation:message="sectionName or port must be unique when parentRefs includes 2 or more references to the same parent",rule="self.all(p1, self.exists_one(p2, p1.group == p2.group && p1.kind == p2.kind && p1.name == p2.name && (((!has(p1.__namespace__) || p1.__namespace__ == '') && (!has(p2.__namespace__) || p2.__namespace__ == '')) || (has(p1.__namespace__) && has(p2.__namespace__) && p1.__namespace__ == p2.__namespace__ )) && (((!has(p1.sectionName) || p1.sectionName == '') && (!has(p2.sectionName) || p2.sectionName == '')) || ( has(p1.sectionName) && has(p2.sectionName) && p1.sectionName == p2.sectionName)) && (((!has(p1.port) || p1.port == 0) && (!has(p2.port) || p2.port == 0)) || (has(p1.port) && has(p2.port) && p1.port == p2.port))))"> |  |
| Rules | [][TCPRouteRule](#tcp-route-rule)| `[]*TCPRouteRule` |  | | Rules are a list of TCP matchers and actions.</br></br>+kubebuilder:validation:MinItems=1</br>+kubebuilder:validation:MaxItems=16 |  |



### <span id="tcp-route-status"></span> TCPRouteStatus


> TCPRouteStatus defines the observed state of TCPRoute
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Parents | [][RouteParentStatus](#route-parent-status)| `[]*RouteParentStatus` |  | | Parents is a list of parent resources (usually Gateways) that are</br>associated with the route, and the status of the route with respect to</br>each parent. When this route attaches to a parent, the controller that</br>manages the parent must add an entry to this list when the controller</br>first sees the route and should update the entry as appropriate when the</br>route or gateway is modified.</br></br>Note that parent references that cannot be resolved by an implementation</br>of this API will not be added to this list. Implementations of this API</br>can only populate Route status for the Gateways/parent resources they are</br>responsible for.</br></br>A maximum of 32 Gateways will be represented in this list. An empty list</br>means the route has not been attached to any Gateway.</br></br>+kubebuilder:validation:MaxItems=32 |  |



### <span id="tls-route"></span> TLSRoute


> If you need to forward traffic to a single target for a TLS listener, you
could choose to use a TCPRoute with a TLS listener.
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| APIVersion | string| `string` |  | | APIVersion defines the versioned schema of this representation of an object.</br>Servers should convert recognized schemas to the latest internal value, and</br>may reject unrecognized values.</br>More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#resources</br>+optional |  |
| Annotations | map of string| `map[string]string` |  | | Annotations is an unstructured key value map stored with a resource that may be</br>set by external tools to store and retrieve arbitrary metadata. They are not</br>queryable and should be preserved when modifying objects.</br>More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/annotations</br>+optional |  |
| CreationTimestamp | string| `string` |  | | CreationTimestamp is a timestamp representing the server time when this object was</br>created. It is not guaranteed to be set in happens-before order across separate operations.</br>Clients may not set this value. It is represented in RFC3339 form and is in UTC.</br></br>Populated by the system.</br>Read-only.</br>Null for lists.</br>More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata</br>+optional |  |
| DeletionGracePeriodSeconds | int64 (formatted integer)| `int64` |  | | Number of seconds allowed for this object to gracefully terminate before</br>it will be removed from the system. Only set when deletionTimestamp is also set.</br>May only be shortened.</br>Read-only.</br>+optional |  |
| DeletionTimestamp | string| `string` |  | | DeletionTimestamp is RFC 3339 date and time at which this resource will be deleted. This</br>field is set by the server when a graceful deletion is requested by the user, and is not</br>directly settable by a client. The resource is expected to be deleted (no longer visible</br>from resource lists, and not reachable by name) after the time in this field, once the</br>finalizers list is empty. As long as the finalizers list contains items, deletion is blocked.</br>Once the deletionTimestamp is set, this value may not be unset or be set further into the</br>future, although it may be shortened or the resource may be deleted prior to this time.</br>For example, a user may request that a pod is deleted in 30 seconds. The Kubelet will react</br>by sending a graceful termination signal to the containers in the pod. After that 30 seconds,</br>the Kubelet will send a hard termination signal (SIGKILL) to the container and after cleanup,</br>remove the pod from the API. In the presence of network partitions, this object may still</br>exist after this timestamp, until an administrator or automated process can determine the</br>resource is fully terminated.</br>If not set, graceful deletion of the object has not been requested.</br></br>Populated by the system when a graceful deletion is requested.</br>Read-only.</br>More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata</br>+optional |  |
| Finalizers | []string| `[]string` |  | | Must be empty before the object is deleted from the registry. Each entry</br>is an identifier for the responsible component that will remove the entry</br>from the list. If the deletionTimestamp of the object is non-nil, entries</br>in this list can only be removed.</br>Finalizers may be processed and removed in any order.  Order is NOT enforced</br>because it introduces significant risk of stuck finalizers.</br>finalizers is a shared field, any actor with permission can reorder it.</br>If the finalizer list is processed in order, then this can lead to a situation</br>in which the component responsible for the first finalizer in the list is</br>waiting for a signal (field value, external system, or other) produced by a</br>component responsible for a finalizer later in the list, resulting in a deadlock.</br>Without enforced ordering finalizers are free to order amongst themselves and</br>are not vulnerable to ordering changes in the list.</br>+optional</br>+patchStrategy=merge</br>+listType=set |  |
| GenerateName | string| `string` |  | | GenerateName is an optional prefix, used by the server, to generate a unique</br>name ONLY IF the Name field has not been provided.</br>If this field is used, the name returned to the client will be different</br>than the name passed. This value will also be combined with a unique suffix.</br>The provided value has the same validation rules as the Name field,</br>and may be truncated by the length of the suffix required to make the value</br>unique on the server.</br></br>If this field is specified and the generated name exists, the server will return a 409.</br></br>Applied only if Name is not specified.</br>More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#idempotency</br>+optional |  |
| Generation | int64 (formatted integer)| `int64` |  | | A sequence number representing a specific generation of the desired state.</br>Populated by the system. Read-only.</br>+optional |  |
| Kind | string| `string` |  | | Kind is a string value representing the REST resource this object represents.</br>Servers may infer this from the endpoint the client submits requests to.</br>Cannot be updated.</br>In CamelCase.</br>More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds</br>+optional |  |
| Labels | map of string| `map[string]string` |  | | Map of string keys and values that can be used to organize and categorize</br>(scope and select) objects. May match selectors of replication controllers</br>and services.</br>More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/labels</br>+optional |  |
| ManagedFields | [][ManagedFieldsEntry](#managed-fields-entry)| `[]*ManagedFieldsEntry` |  | | ManagedFields maps workflow-id and version to the set of fields</br>that are managed by that workflow. This is mostly for internal</br>housekeeping, and users typically shouldn't need to set or</br>understand this field. A workflow can be the user's name, a</br>controller's name, or the name of a specific apply path like</br>"ci-cd". The set of fields is always in the version that the</br>workflow used when modifying the object.</br></br>+optional</br>+listType=atomic |  |
| Name | string| `string` |  | | Name must be unique within a namespace. Is required when creating resources, although</br>some resources may allow a client to request the generation of an appropriate name</br>automatically. Name is primarily intended for creation idempotence and configuration</br>definition.</br>Cannot be updated.</br>More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names#names</br>+optional |  |
| Namespace | string| `string` |  | | Namespace defines the space within which each name must be unique. An empty namespace is</br>equivalent to the "default" namespace, but "default" is the canonical representation.</br>Not all objects are required to be scoped to a namespace - the value of this field for</br>those objects will be empty.</br></br>Must be a DNS_LABEL.</br>Cannot be updated.</br>More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/namespaces</br>+optional |  |
| OwnerReferences | [][OwnerReference](#owner-reference)| `[]*OwnerReference` |  | | List of objects depended by this object. If ALL objects in the list have</br>been deleted, this object will be garbage collected. If this object is managed by a controller,</br>then an entry in this list will point to this controller, with the controller field set to true.</br>There cannot be more than one managing controller.</br>+optional</br>+patchMergeKey=uid</br>+patchStrategy=merge</br>+listType=map</br>+listMapKey=uid |  |
| ResourceVersion | string| `string` |  | | An opaque value that represents the internal version of this object that can</br>be used by clients to determine when objects have changed. May be used for optimistic</br>concurrency, change detection, and the watch operation on a resource or set of resources.</br>Clients must treat these values as opaque and passed unmodified back to the server.</br>They may only be valid for a particular resource or set of resources.</br></br>Populated by the system.</br>Read-only.</br>Value must be treated as opaque by clients and .</br>More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#concurrency-control-and-consistency</br>+optional |  |
| SelfLink | string| `string` |  | | Deprecated: selfLink is a legacy read-only field that is no longer populated by the system.</br>+optional |  |
| spec | [TLSRouteSpec](#tls-route-spec)| `TLSRouteSpec` |  | |  |  |
| status | [TLSRouteStatus](#tls-route-status)| `TLSRouteStatus` |  | |  |  |
| uid | [UID](#uid)| `UID` |  | |  |  |



### <span id="tls-route-rule"></span> TLSRouteRule


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| BackendRefs | [][BackendRef](#backend-ref)| `[]*BackendRef` |  | | BackendRefs defines the backend(s) where matching requests should be</br>sent. If unspecified or invalid (refers to a non-existent resource or</br>a Service with no endpoints), the rule performs no forwarding; if no</br>filters are specified that would result in a response being sent, the</br>underlying implementation must actively reject request attempts to this</br>backend, by rejecting the connection or returning a 500 status code.</br>Request rejections must respect weight; if an invalid backend is</br>requested to have 80% of requests, then 80% of requests must be rejected</br>instead.</br></br>Support: Core for Kubernetes Service</br></br>Support: Extended for Kubernetes ServiceImport</br></br>Support: Implementation-specific for any other resource</br></br>Support for weight: Extended</br></br>+kubebuilder:validation:MinItems=1</br>+kubebuilder:validation:MaxItems=16 |  |



### <span id="tls-route-spec"></span> TLSRouteSpec


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Hostnames | [][Hostname](#hostname)| `[]Hostname` |  | | Hostnames defines a set of SNI names that should match against the</br>SNI attribute of TLS ClientHello message in TLS handshake. This matches</br>the RFC 1123 definition of a hostname with 2 notable exceptions:</br></br>1. IPs are not allowed in SNI names per RFC 6066.</br>2. A hostname may be prefixed with a wildcard label (`*.`). The wildcard</br>label must appear by itself as the first label.</br></br>If a hostname is specified by both the Listener and TLSRoute, there</br>must be at least one intersecting hostname for the TLSRoute to be |  |
| ParentRefs | [][ParentReference](#parent-reference)| `[]*ParentReference` |  | | ParentRefs references the resources (usually Gateways) that a Route wants</br>to be attached to. Note that the referenced parent resource needs to</br>allow this for the attachment to be complete. For Gateways, that means</br>the Gateway needs to allow attachment from Routes of this kind and</br>namespace. For Services, that means the Service must either be in the same</br>namespace for a "producer" route, or the mesh implementation must support</br>and allow "consumer" routes for the referenced Service. ReferenceGrant is</br>not applicable for governing ParentRefs to Services - it is not possible to</br>create a "producer" route for a Service in a different namespace from the</br>Route.</br></br>There are two kinds of parent resources with "Core" support:</br></br>Gateway (Gateway conformance profile)</br>Service (Mesh conformance profile, ClusterIP Services only)</br></br>This API may be extended in the future to support additional kinds of parent</br>resources.</br></br>ParentRefs must be _distinct_. This means either that:</br></br>They select different objects.  If this is the case, then parentRef</br>entries are distinct. In terms of fields, this means that the</br>multi-part key defined by `group`, `kind`, `namespace`, and `name` must</br>be unique across all parentRef entries in the Route.</br>They do not select different objects, but for each optional field used,</br>each ParentRef that selects the same object must set the same set of</br>optional fields to different values. If one ParentRef sets a</br>combination of optional fields, all must set the same combination.</br></br>Some examples:</br></br>If one ParentRef sets `sectionName`, all ParentRefs referencing the</br>same object must also set `sectionName`.</br>If one ParentRef sets `port`, all ParentRefs referencing the same</br>object must also set `port`.</br>If one ParentRef sets `sectionName` and `port`, all ParentRefs</br>referencing the same object must also set `sectionName` and `port`.</br></br>It is possible to separately reference multiple distinct objects that may</br>be collapsed by an implementation. For example, some implementations may</br>choose to merge compatible Gateway Listeners together. If that is the</br>case, the list of routes attached to those resources should also be</br>merged.</br></br>Note that for ParentRefs that cross namespace boundaries, there are specific</br>rules. Cross-namespace references are only valid if they are explicitly</br>allowed by something in the namespace they are referring to. For example,</br>Gateway has the AllowedRoutes field, and ReferenceGrant provides a</br>generic way to enable other kinds of cross-namespace reference.</br></br><gateway:experimental:description></br>ParentRefs from a Route to a Service in the same namespace are "producer"</br>routes, which apply default routing rules to inbound connections from</br>any namespace to the Service.</br></br>ParentRefs from a Route to a Service in a different namespace are</br>"consumer" routes, and these routing rules are only applied to outbound</br>connections originating from the same namespace as the Route, for which</br>the intended destination of the connections are a Service targeted as a</br>ParentRef of the Route.</br></gateway:experimental:description></br></br>+optional</br>+kubebuilder:validation:MaxItems=32</br><gateway:standard:validation:XValidation:message="sectionName must be specified when parentRefs includes 2 or more references to the same parent",rule="self.all(p1, self.all(p2, p1.group == p2.group && p1.kind == p2.kind && p1.name == p2.name && (((!has(p1.__namespace__) || p1.__namespace__ == '') && (!has(p2.__namespace__) || p2.__namespace__ == '')) || (has(p1.__namespace__) && has(p2.__namespace__) && p1.__namespace__ == p2.__namespace__ )) ? ((!has(p1.sectionName) || p1.sectionName == '') == (!has(p2.sectionName) || p2.sectionName == '')) : true))"></br><gateway:standard:validation:XValidation:message="sectionName must be unique when parentRefs includes 2 or more references to the same parent",rule="self.all(p1, self.exists_one(p2, p1.group == p2.group && p1.kind == p2.kind && p1.name == p2.name && (((!has(p1.__namespace__) || p1.__namespace__ == '') && (!has(p2.__namespace__) || p2.__namespace__ == '')) || (has(p1.__namespace__) && has(p2.__namespace__) && p1.__namespace__ == p2.__namespace__ )) && (((!has(p1.sectionName) || p1.sectionName == '') && (!has(p2.sectionName) || p2.sectionName == '')) || (has(p1.sectionName) && has(p2.sectionName) && p1.sectionName == p2.sectionName))))"></br><gateway:experimental:validation:XValidation:message="sectionName or port must be specified when parentRefs includes 2 or more references to the same parent",rule="self.all(p1, self.all(p2, p1.group == p2.group && p1.kind == p2.kind && p1.name == p2.name && (((!has(p1.__namespace__) || p1.__namespace__ == '') && (!has(p2.__namespace__) || p2.__namespace__ == '')) || (has(p1.__namespace__) && has(p2.__namespace__) && p1.__namespace__ == p2.__namespace__)) ? ((!has(p1.sectionName) || p1.sectionName == '') == (!has(p2.sectionName) || p2.sectionName == '') && (!has(p1.port) || p1.port == 0) == (!has(p2.port) || p2.port == 0)): true))"></br><gateway:experimental:validation:XValidation:message="sectionName or port must be unique when parentRefs includes 2 or more references to the same parent",rule="self.all(p1, self.exists_one(p2, p1.group == p2.group && p1.kind == p2.kind && p1.name == p2.name && (((!has(p1.__namespace__) || p1.__namespace__ == '') && (!has(p2.__namespace__) || p2.__namespace__ == '')) || (has(p1.__namespace__) && has(p2.__namespace__) && p1.__namespace__ == p2.__namespace__ )) && (((!has(p1.sectionName) || p1.sectionName == '') && (!has(p2.sectionName) || p2.sectionName == '')) || ( has(p1.sectionName) && has(p2.sectionName) && p1.sectionName == p2.sectionName)) && (((!has(p1.port) || p1.port == 0) && (!has(p2.port) || p2.port == 0)) || (has(p1.port) && has(p2.port) && p1.port == p2.port))))"> |  |
| Rules | [][TLSRouteRule](#tls-route-rule)| `[]*TLSRouteRule` |  | | Rules are a list of TLS matchers and actions.</br></br>+kubebuilder:validation:MinItems=1</br>+kubebuilder:validation:MaxItems=16 |  |



### <span id="tls-route-status"></span> TLSRouteStatus


> TLSRouteStatus defines the observed state of TLSRoute
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Parents | [][RouteParentStatus](#route-parent-status)| `[]*RouteParentStatus` |  | | Parents is a list of parent resources (usually Gateways) that are</br>associated with the route, and the status of the route with respect to</br>each parent. When this route attaches to a parent, the controller that</br>manages the parent must add an entry to this list when the controller</br>first sees the route and should update the entry as appropriate when the</br>route or gateway is modified.</br></br>Note that parent references that cannot be resolved by an implementation</br>of this API will not be added to this list. Implementations of this API</br>can only populate Route status for the Gateways/parent resources they are</br>responsible for.</br></br>A maximum of 32 Gateways will be represented in this list. An empty list</br>means the route has not been attached to any Gateway.</br></br>+kubebuilder:validation:MaxItems=32 |  |



### <span id="target"></span> Target


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| Cluster | string| `string` |  | |  |  |
| Kind | string| `string` |  | |  |  |
| Name | string| `string` |  | |  |  |
| Namespace | string| `string` |  | |  |  |



### <span id="telemetry"></span> Telemetry


> <!-- go code generation tags
+kubetype-gen
+kubetype-gen:groupVersion=telemetry.istio.io/v1
+genclient
+k8s:deepcopy-gen=true
>
>
<!-- istio code generation tags
+istio.io/sync-from:telemetry/v1alpha1/telemetry.proto
>
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| APIVersion | string| `string` |  | | APIVersion defines the versioned schema of this representation of an object.</br>Servers should convert recognized schemas to the latest internal value, and</br>may reject unrecognized values.</br>More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#resources</br>+optional |  |
| Annotations | map of string| `map[string]string` |  | | Annotations is an unstructured key value map stored with a resource that may be</br>set by external tools to store and retrieve arbitrary metadata. They are not</br>queryable and should be preserved when modifying objects.</br>More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/annotations</br>+optional |  |
| CreationTimestamp | string| `string` |  | | CreationTimestamp is a timestamp representing the server time when this object was</br>created. It is not guaranteed to be set in happens-before order across separate operations.</br>Clients may not set this value. It is represented in RFC3339 form and is in UTC.</br></br>Populated by the system.</br>Read-only.</br>Null for lists.</br>More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata</br>+optional |  |
| DeletionGracePeriodSeconds | int64 (formatted integer)| `int64` |  | | Number of seconds allowed for this object to gracefully terminate before</br>it will be removed from the system. Only set when deletionTimestamp is also set.</br>May only be shortened.</br>Read-only.</br>+optional |  |
| DeletionTimestamp | string| `string` |  | | DeletionTimestamp is RFC 3339 date and time at which this resource will be deleted. This</br>field is set by the server when a graceful deletion is requested by the user, and is not</br>directly settable by a client. The resource is expected to be deleted (no longer visible</br>from resource lists, and not reachable by name) after the time in this field, once the</br>finalizers list is empty. As long as the finalizers list contains items, deletion is blocked.</br>Once the deletionTimestamp is set, this value may not be unset or be set further into the</br>future, although it may be shortened or the resource may be deleted prior to this time.</br>For example, a user may request that a pod is deleted in 30 seconds. The Kubelet will react</br>by sending a graceful termination signal to the containers in the pod. After that 30 seconds,</br>the Kubelet will send a hard termination signal (SIGKILL) to the container and after cleanup,</br>remove the pod from the API. In the presence of network partitions, this object may still</br>exist after this timestamp, until an administrator or automated process can determine the</br>resource is fully terminated.</br>If not set, graceful deletion of the object has not been requested.</br></br>Populated by the system when a graceful deletion is requested.</br>Read-only.</br>More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata</br>+optional |  |
| Finalizers | []string| `[]string` |  | | Must be empty before the object is deleted from the registry. Each entry</br>is an identifier for the responsible component that will remove the entry</br>from the list. If the deletionTimestamp of the object is non-nil, entries</br>in this list can only be removed.</br>Finalizers may be processed and removed in any order.  Order is NOT enforced</br>because it introduces significant risk of stuck finalizers.</br>finalizers is a shared field, any actor with permission can reorder it.</br>If the finalizer list is processed in order, then this can lead to a situation</br>in which the component responsible for the first finalizer in the list is</br>waiting for a signal (field value, external system, or other) produced by a</br>component responsible for a finalizer later in the list, resulting in a deadlock.</br>Without enforced ordering finalizers are free to order amongst themselves and</br>are not vulnerable to ordering changes in the list.</br>+optional</br>+patchStrategy=merge</br>+listType=set |  |
| GenerateName | string| `string` |  | | GenerateName is an optional prefix, used by the server, to generate a unique</br>name ONLY IF the Name field has not been provided.</br>If this field is used, the name returned to the client will be different</br>than the name passed. This value will also be combined with a unique suffix.</br>The provided value has the same validation rules as the Name field,</br>and may be truncated by the length of the suffix required to make the value</br>unique on the server.</br></br>If this field is specified and the generated name exists, the server will return a 409.</br></br>Applied only if Name is not specified.</br>More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#idempotency</br>+optional |  |
| Generation | int64 (formatted integer)| `int64` |  | | A sequence number representing a specific generation of the desired state.</br>Populated by the system. Read-only.</br>+optional |  |
| Kind | string| `string` |  | | Kind is a string value representing the REST resource this object represents.</br>Servers may infer this from the endpoint the client submits requests to.</br>Cannot be updated.</br>In CamelCase.</br>More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds</br>+optional |  |
| Labels | map of string| `map[string]string` |  | | Map of string keys and values that can be used to organize and categorize</br>(scope and select) objects. May match selectors of replication controllers</br>and services.</br>More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/labels</br>+optional |  |
| ManagedFields | [][ManagedFieldsEntry](#managed-fields-entry)| `[]*ManagedFieldsEntry` |  | | ManagedFields maps workflow-id and version to the set of fields</br>that are managed by that workflow. This is mostly for internal</br>housekeeping, and users typically shouldn't need to set or</br>understand this field. A workflow can be the user's name, a</br>controller's name, or the name of a specific apply path like</br>"ci-cd". The set of fields is always in the version that the</br>workflow used when modifying the object.</br></br>+optional</br>+listType=atomic |  |
| Name | string| `string` |  | | Name must be unique within a namespace. Is required when creating resources, although</br>some resources may allow a client to request the generation of an appropriate name</br>automatically. Name is primarily intended for creation idempotence and configuration</br>definition.</br>Cannot be updated.</br>More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names#names</br>+optional |  |
| Namespace | string| `string` |  | | Namespace defines the space within which each name must be unique. An empty namespace is</br>equivalent to the "default" namespace, but "default" is the canonical representation.</br>Not all objects are required to be scoped to a namespace - the value of this field for</br>those objects will be empty.</br></br>Must be a DNS_LABEL.</br>Cannot be updated.</br>More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/namespaces</br>+optional |  |
| OwnerReferences | [][OwnerReference](#owner-reference)| `[]*OwnerReference` |  | | List of objects depended by this object. If ALL objects in the list have</br>been deleted, this object will be garbage collected. If this object is managed by a controller,</br>then an entry in this list will point to this controller, with the controller field set to true.</br>There cannot be more than one managing controller.</br>+optional</br>+patchMergeKey=uid</br>+patchStrategy=merge</br>+listType=map</br>+listMapKey=uid |  |
| ResourceVersion | string| `string` |  | | An opaque value that represents the internal version of this object that can</br>be used by clients to determine when objects have changed. May be used for optimistic</br>concurrency, change detection, and the watch operation on a resource or set of resources.</br>Clients must treat these values as opaque and passed unmodified back to the server.</br>They may only be valid for a particular resource or set of resources.</br></br>Populated by the system.</br>Read-only.</br>Value must be treated as opaque by clients and .</br>More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#concurrency-control-and-consistency</br>+optional |  |
| SelfLink | string| `string` |  | | Deprecated: selfLink is a legacy read-only field that is no longer populated by the system.</br>+optional |  |
| spec | [Telemetry](#telemetry)| `Telemetry` |  | |  |  |
| status | [IstioStatus](#istio-status)| `IstioStatus` |  | |  |  |
| uid | [UID](#uid)| `UID` |  | |  |  |



### <span id="tempo-config"></span> TempoConfig


  



**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| DatasourceUID | string| `string` |  | |  |  |
| OrgID | string| `string` |  | |  |  |



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
| Nanos | int32 (formatted integer)| `int32` |  | | Non-negative fractions of a second at nanosecond resolution. Negative</br>second values with fractions must still have non-negative nanos values</br>that count forward in time. Must be from 0 to 999,999,999</br>inclusive. |  |
| Seconds | int64 (formatted integer)| `int64` |  | | Represents seconds of UTC time since Unix epoch</br>1970-01-01T00:00:00Z. Must be from 0001-01-01T00:00:00Z to</br>9999-12-31T23:59:59Z inclusive. |  |



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
| UID | string| string | | UID is a type that holds unique ID values, including UUIDs.  Because we</br>don't ONLY use UUIDs, this is an alias to string.  Being a type captures</br>intent and helps make sure that UIDs and names do not get conflated. |  |



### <span id="user-session-data"></span> UserSessionData


> UserSessionData userSessionData
This is used for returning the token
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| ExpiresOn | date-time (formatted string)| `strfmt.DateTime` | ✓ | | The expired time for the token</br>A string with the Datetime when the token will be expired | `Thu, 07 Mar 2019 17:50:26 +0000` |
| Username | string| `string` | ✓ | | The username for the token</br>A string with the user's username | `admin` |



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
+cue-gen:VirtualService:version:v1
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
+kubetype-gen:groupVersion=networking.istio.io/v1
+genclient
+k8s:deepcopy-gen=true
>
<!-- istio code generation tags
+istio.io/sync-from:networking/v1alpha3/virtual_service.proto
>
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| APIVersion | string| `string` |  | | APIVersion defines the versioned schema of this representation of an object.</br>Servers should convert recognized schemas to the latest internal value, and</br>may reject unrecognized values.</br>More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#resources</br>+optional |  |
| Annotations | map of string| `map[string]string` |  | | Annotations is an unstructured key value map stored with a resource that may be</br>set by external tools to store and retrieve arbitrary metadata. They are not</br>queryable and should be preserved when modifying objects.</br>More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/annotations</br>+optional |  |
| CreationTimestamp | string| `string` |  | | CreationTimestamp is a timestamp representing the server time when this object was</br>created. It is not guaranteed to be set in happens-before order across separate operations.</br>Clients may not set this value. It is represented in RFC3339 form and is in UTC.</br></br>Populated by the system.</br>Read-only.</br>Null for lists.</br>More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata</br>+optional |  |
| DeletionGracePeriodSeconds | int64 (formatted integer)| `int64` |  | | Number of seconds allowed for this object to gracefully terminate before</br>it will be removed from the system. Only set when deletionTimestamp is also set.</br>May only be shortened.</br>Read-only.</br>+optional |  |
| DeletionTimestamp | string| `string` |  | | DeletionTimestamp is RFC 3339 date and time at which this resource will be deleted. This</br>field is set by the server when a graceful deletion is requested by the user, and is not</br>directly settable by a client. The resource is expected to be deleted (no longer visible</br>from resource lists, and not reachable by name) after the time in this field, once the</br>finalizers list is empty. As long as the finalizers list contains items, deletion is blocked.</br>Once the deletionTimestamp is set, this value may not be unset or be set further into the</br>future, although it may be shortened or the resource may be deleted prior to this time.</br>For example, a user may request that a pod is deleted in 30 seconds. The Kubelet will react</br>by sending a graceful termination signal to the containers in the pod. After that 30 seconds,</br>the Kubelet will send a hard termination signal (SIGKILL) to the container and after cleanup,</br>remove the pod from the API. In the presence of network partitions, this object may still</br>exist after this timestamp, until an administrator or automated process can determine the</br>resource is fully terminated.</br>If not set, graceful deletion of the object has not been requested.</br></br>Populated by the system when a graceful deletion is requested.</br>Read-only.</br>More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata</br>+optional |  |
| Finalizers | []string| `[]string` |  | | Must be empty before the object is deleted from the registry. Each entry</br>is an identifier for the responsible component that will remove the entry</br>from the list. If the deletionTimestamp of the object is non-nil, entries</br>in this list can only be removed.</br>Finalizers may be processed and removed in any order.  Order is NOT enforced</br>because it introduces significant risk of stuck finalizers.</br>finalizers is a shared field, any actor with permission can reorder it.</br>If the finalizer list is processed in order, then this can lead to a situation</br>in which the component responsible for the first finalizer in the list is</br>waiting for a signal (field value, external system, or other) produced by a</br>component responsible for a finalizer later in the list, resulting in a deadlock.</br>Without enforced ordering finalizers are free to order amongst themselves and</br>are not vulnerable to ordering changes in the list.</br>+optional</br>+patchStrategy=merge</br>+listType=set |  |
| GenerateName | string| `string` |  | | GenerateName is an optional prefix, used by the server, to generate a unique</br>name ONLY IF the Name field has not been provided.</br>If this field is used, the name returned to the client will be different</br>than the name passed. This value will also be combined with a unique suffix.</br>The provided value has the same validation rules as the Name field,</br>and may be truncated by the length of the suffix required to make the value</br>unique on the server.</br></br>If this field is specified and the generated name exists, the server will return a 409.</br></br>Applied only if Name is not specified.</br>More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#idempotency</br>+optional |  |
| Generation | int64 (formatted integer)| `int64` |  | | A sequence number representing a specific generation of the desired state.</br>Populated by the system. Read-only.</br>+optional |  |
| Kind | string| `string` |  | | Kind is a string value representing the REST resource this object represents.</br>Servers may infer this from the endpoint the client submits requests to.</br>Cannot be updated.</br>In CamelCase.</br>More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds</br>+optional |  |
| Labels | map of string| `map[string]string` |  | | Map of string keys and values that can be used to organize and categorize</br>(scope and select) objects. May match selectors of replication controllers</br>and services.</br>More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/labels</br>+optional |  |
| ManagedFields | [][ManagedFieldsEntry](#managed-fields-entry)| `[]*ManagedFieldsEntry` |  | | ManagedFields maps workflow-id and version to the set of fields</br>that are managed by that workflow. This is mostly for internal</br>housekeeping, and users typically shouldn't need to set or</br>understand this field. A workflow can be the user's name, a</br>controller's name, or the name of a specific apply path like</br>"ci-cd". The set of fields is always in the version that the</br>workflow used when modifying the object.</br></br>+optional</br>+listType=atomic |  |
| Name | string| `string` |  | | Name must be unique within a namespace. Is required when creating resources, although</br>some resources may allow a client to request the generation of an appropriate name</br>automatically. Name is primarily intended for creation idempotence and configuration</br>definition.</br>Cannot be updated.</br>More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names#names</br>+optional |  |
| Namespace | string| `string` |  | | Namespace defines the space within which each name must be unique. An empty namespace is</br>equivalent to the "default" namespace, but "default" is the canonical representation.</br>Not all objects are required to be scoped to a namespace - the value of this field for</br>those objects will be empty.</br></br>Must be a DNS_LABEL.</br>Cannot be updated.</br>More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/namespaces</br>+optional |  |
| OwnerReferences | [][OwnerReference](#owner-reference)| `[]*OwnerReference` |  | | List of objects depended by this object. If ALL objects in the list have</br>been deleted, this object will be garbage collected. If this object is managed by a controller,</br>then an entry in this list will point to this controller, with the controller field set to true.</br>There cannot be more than one managing controller.</br>+optional</br>+patchMergeKey=uid</br>+patchStrategy=merge</br>+listType=map</br>+listMapKey=uid |  |
| ResourceVersion | string| `string` |  | | An opaque value that represents the internal version of this object that can</br>be used by clients to determine when objects have changed. May be used for optimistic</br>concurrency, change detection, and the watch operation on a resource or set of resources.</br>Clients must treat these values as opaque and passed unmodified back to the server.</br>They may only be valid for a particular resource or set of resources.</br></br>Populated by the system.</br>Read-only.</br>Value must be treated as opaque by clients and .</br>More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#concurrency-control-and-consistency</br>+optional |  |
| SelfLink | string| `string` |  | | Deprecated: selfLink is a legacy read-only field that is no longer populated by the system.</br>+optional |  |
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
+cue-gen:WasmPlugin:spec:required
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
| APIVersion | string| `string` |  | | APIVersion defines the versioned schema of this representation of an object.</br>Servers should convert recognized schemas to the latest internal value, and</br>may reject unrecognized values.</br>More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#resources</br>+optional |  |
| Annotations | map of string| `map[string]string` |  | | Annotations is an unstructured key value map stored with a resource that may be</br>set by external tools to store and retrieve arbitrary metadata. They are not</br>queryable and should be preserved when modifying objects.</br>More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/annotations</br>+optional |  |
| CreationTimestamp | string| `string` |  | | CreationTimestamp is a timestamp representing the server time when this object was</br>created. It is not guaranteed to be set in happens-before order across separate operations.</br>Clients may not set this value. It is represented in RFC3339 form and is in UTC.</br></br>Populated by the system.</br>Read-only.</br>Null for lists.</br>More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata</br>+optional |  |
| DeletionGracePeriodSeconds | int64 (formatted integer)| `int64` |  | | Number of seconds allowed for this object to gracefully terminate before</br>it will be removed from the system. Only set when deletionTimestamp is also set.</br>May only be shortened.</br>Read-only.</br>+optional |  |
| DeletionTimestamp | string| `string` |  | | DeletionTimestamp is RFC 3339 date and time at which this resource will be deleted. This</br>field is set by the server when a graceful deletion is requested by the user, and is not</br>directly settable by a client. The resource is expected to be deleted (no longer visible</br>from resource lists, and not reachable by name) after the time in this field, once the</br>finalizers list is empty. As long as the finalizers list contains items, deletion is blocked.</br>Once the deletionTimestamp is set, this value may not be unset or be set further into the</br>future, although it may be shortened or the resource may be deleted prior to this time.</br>For example, a user may request that a pod is deleted in 30 seconds. The Kubelet will react</br>by sending a graceful termination signal to the containers in the pod. After that 30 seconds,</br>the Kubelet will send a hard termination signal (SIGKILL) to the container and after cleanup,</br>remove the pod from the API. In the presence of network partitions, this object may still</br>exist after this timestamp, until an administrator or automated process can determine the</br>resource is fully terminated.</br>If not set, graceful deletion of the object has not been requested.</br></br>Populated by the system when a graceful deletion is requested.</br>Read-only.</br>More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata</br>+optional |  |
| Finalizers | []string| `[]string` |  | | Must be empty before the object is deleted from the registry. Each entry</br>is an identifier for the responsible component that will remove the entry</br>from the list. If the deletionTimestamp of the object is non-nil, entries</br>in this list can only be removed.</br>Finalizers may be processed and removed in any order.  Order is NOT enforced</br>because it introduces significant risk of stuck finalizers.</br>finalizers is a shared field, any actor with permission can reorder it.</br>If the finalizer list is processed in order, then this can lead to a situation</br>in which the component responsible for the first finalizer in the list is</br>waiting for a signal (field value, external system, or other) produced by a</br>component responsible for a finalizer later in the list, resulting in a deadlock.</br>Without enforced ordering finalizers are free to order amongst themselves and</br>are not vulnerable to ordering changes in the list.</br>+optional</br>+patchStrategy=merge</br>+listType=set |  |
| GenerateName | string| `string` |  | | GenerateName is an optional prefix, used by the server, to generate a unique</br>name ONLY IF the Name field has not been provided.</br>If this field is used, the name returned to the client will be different</br>than the name passed. This value will also be combined with a unique suffix.</br>The provided value has the same validation rules as the Name field,</br>and may be truncated by the length of the suffix required to make the value</br>unique on the server.</br></br>If this field is specified and the generated name exists, the server will return a 409.</br></br>Applied only if Name is not specified.</br>More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#idempotency</br>+optional |  |
| Generation | int64 (formatted integer)| `int64` |  | | A sequence number representing a specific generation of the desired state.</br>Populated by the system. Read-only.</br>+optional |  |
| Kind | string| `string` |  | | Kind is a string value representing the REST resource this object represents.</br>Servers may infer this from the endpoint the client submits requests to.</br>Cannot be updated.</br>In CamelCase.</br>More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds</br>+optional |  |
| Labels | map of string| `map[string]string` |  | | Map of string keys and values that can be used to organize and categorize</br>(scope and select) objects. May match selectors of replication controllers</br>and services.</br>More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/labels</br>+optional |  |
| ManagedFields | [][ManagedFieldsEntry](#managed-fields-entry)| `[]*ManagedFieldsEntry` |  | | ManagedFields maps workflow-id and version to the set of fields</br>that are managed by that workflow. This is mostly for internal</br>housekeeping, and users typically shouldn't need to set or</br>understand this field. A workflow can be the user's name, a</br>controller's name, or the name of a specific apply path like</br>"ci-cd". The set of fields is always in the version that the</br>workflow used when modifying the object.</br></br>+optional</br>+listType=atomic |  |
| Name | string| `string` |  | | Name must be unique within a namespace. Is required when creating resources, although</br>some resources may allow a client to request the generation of an appropriate name</br>automatically. Name is primarily intended for creation idempotence and configuration</br>definition.</br>Cannot be updated.</br>More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names#names</br>+optional |  |
| Namespace | string| `string` |  | | Namespace defines the space within which each name must be unique. An empty namespace is</br>equivalent to the "default" namespace, but "default" is the canonical representation.</br>Not all objects are required to be scoped to a namespace - the value of this field for</br>those objects will be empty.</br></br>Must be a DNS_LABEL.</br>Cannot be updated.</br>More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/namespaces</br>+optional |  |
| OwnerReferences | [][OwnerReference](#owner-reference)| `[]*OwnerReference` |  | | List of objects depended by this object. If ALL objects in the list have</br>been deleted, this object will be garbage collected. If this object is managed by a controller,</br>then an entry in this list will point to this controller, with the controller field set to true.</br>There cannot be more than one managing controller.</br>+optional</br>+patchMergeKey=uid</br>+patchStrategy=merge</br>+listType=map</br>+listMapKey=uid |  |
| ResourceVersion | string| `string` |  | | An opaque value that represents the internal version of this object that can</br>be used by clients to determine when objects have changed. May be used for optimistic</br>concurrency, change detection, and the watch operation on a resource or set of resources.</br>Clients must treat these values as opaque and passed unmodified back to the server.</br>They may only be valid for a particular resource or set of resources.</br></br>Populated by the system.</br>Read-only.</br>Value must be treated as opaque by clients and .</br>More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#concurrency-control-and-consistency</br>+optional |  |
| SelfLink | string| `string` |  | | Deprecated: selfLink is a legacy read-only field that is no longer populated by the system.</br>+optional |  |
| spec | [WasmPlugin](#wasm-plugin)| `WasmPlugin` |  | |  |  |
| status | [IstioStatus](#istio-status)| `IstioStatus` |  | |  |  |
| uid | [UID](#uid)| `UID` |  | |  |  |



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
| IstioAmbient | boolean| `bool` | ✓ | | Define if Pods related to this Workload has an IstioAmbient deployed | `true` |
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
| Type | string| `string` | ✓ | | Type of the workload | `deployment` |
| VersionLabel | boolean| `bool` | ✓ | | Define if Pods related to this Workload has the label Version | `true` |
| WaypointWorkloads | [][Workload](#workload)| `[]*Workload` |  | | Ambient waypoint workloads |  |
| additionalDetailSample | [AdditionalItem](#additional-item)| `AdditionalItem` |  | |  |  |
| health | [WorkloadHealth](#workload-health)| `WorkloadHealth` |  | |  |  |
| pods | [Pods](#pods)| `Pods` |  | |  |  |
| validations | [IstioValidations](#istio-validations)| `IstioValidations` |  | |  |  |



### <span id="workload-entry"></span> WorkloadEntry


> <!-- crd generation tags
+cue-gen:WorkloadEntry:groupName:networking.istio.io
+cue-gen:WorkloadEntry:version:v1
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
+kubetype-gen:groupVersion=networking.istio.io/v1
+genclient
+k8s:deepcopy-gen=true
>
<!-- istio code generation tags
+istio.io/sync-from:networking/v1alpha3/workload_entry.proto
>
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| APIVersion | string| `string` |  | | APIVersion defines the versioned schema of this representation of an object.</br>Servers should convert recognized schemas to the latest internal value, and</br>may reject unrecognized values.</br>More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#resources</br>+optional |  |
| Annotations | map of string| `map[string]string` |  | | Annotations is an unstructured key value map stored with a resource that may be</br>set by external tools to store and retrieve arbitrary metadata. They are not</br>queryable and should be preserved when modifying objects.</br>More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/annotations</br>+optional |  |
| CreationTimestamp | string| `string` |  | | CreationTimestamp is a timestamp representing the server time when this object was</br>created. It is not guaranteed to be set in happens-before order across separate operations.</br>Clients may not set this value. It is represented in RFC3339 form and is in UTC.</br></br>Populated by the system.</br>Read-only.</br>Null for lists.</br>More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata</br>+optional |  |
| DeletionGracePeriodSeconds | int64 (formatted integer)| `int64` |  | | Number of seconds allowed for this object to gracefully terminate before</br>it will be removed from the system. Only set when deletionTimestamp is also set.</br>May only be shortened.</br>Read-only.</br>+optional |  |
| DeletionTimestamp | string| `string` |  | | DeletionTimestamp is RFC 3339 date and time at which this resource will be deleted. This</br>field is set by the server when a graceful deletion is requested by the user, and is not</br>directly settable by a client. The resource is expected to be deleted (no longer visible</br>from resource lists, and not reachable by name) after the time in this field, once the</br>finalizers list is empty. As long as the finalizers list contains items, deletion is blocked.</br>Once the deletionTimestamp is set, this value may not be unset or be set further into the</br>future, although it may be shortened or the resource may be deleted prior to this time.</br>For example, a user may request that a pod is deleted in 30 seconds. The Kubelet will react</br>by sending a graceful termination signal to the containers in the pod. After that 30 seconds,</br>the Kubelet will send a hard termination signal (SIGKILL) to the container and after cleanup,</br>remove the pod from the API. In the presence of network partitions, this object may still</br>exist after this timestamp, until an administrator or automated process can determine the</br>resource is fully terminated.</br>If not set, graceful deletion of the object has not been requested.</br></br>Populated by the system when a graceful deletion is requested.</br>Read-only.</br>More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata</br>+optional |  |
| Finalizers | []string| `[]string` |  | | Must be empty before the object is deleted from the registry. Each entry</br>is an identifier for the responsible component that will remove the entry</br>from the list. If the deletionTimestamp of the object is non-nil, entries</br>in this list can only be removed.</br>Finalizers may be processed and removed in any order.  Order is NOT enforced</br>because it introduces significant risk of stuck finalizers.</br>finalizers is a shared field, any actor with permission can reorder it.</br>If the finalizer list is processed in order, then this can lead to a situation</br>in which the component responsible for the first finalizer in the list is</br>waiting for a signal (field value, external system, or other) produced by a</br>component responsible for a finalizer later in the list, resulting in a deadlock.</br>Without enforced ordering finalizers are free to order amongst themselves and</br>are not vulnerable to ordering changes in the list.</br>+optional</br>+patchStrategy=merge</br>+listType=set |  |
| GenerateName | string| `string` |  | | GenerateName is an optional prefix, used by the server, to generate a unique</br>name ONLY IF the Name field has not been provided.</br>If this field is used, the name returned to the client will be different</br>than the name passed. This value will also be combined with a unique suffix.</br>The provided value has the same validation rules as the Name field,</br>and may be truncated by the length of the suffix required to make the value</br>unique on the server.</br></br>If this field is specified and the generated name exists, the server will return a 409.</br></br>Applied only if Name is not specified.</br>More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#idempotency</br>+optional |  |
| Generation | int64 (formatted integer)| `int64` |  | | A sequence number representing a specific generation of the desired state.</br>Populated by the system. Read-only.</br>+optional |  |
| Kind | string| `string` |  | | Kind is a string value representing the REST resource this object represents.</br>Servers may infer this from the endpoint the client submits requests to.</br>Cannot be updated.</br>In CamelCase.</br>More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds</br>+optional |  |
| Labels | map of string| `map[string]string` |  | | Map of string keys and values that can be used to organize and categorize</br>(scope and select) objects. May match selectors of replication controllers</br>and services.</br>More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/labels</br>+optional |  |
| ManagedFields | [][ManagedFieldsEntry](#managed-fields-entry)| `[]*ManagedFieldsEntry` |  | | ManagedFields maps workflow-id and version to the set of fields</br>that are managed by that workflow. This is mostly for internal</br>housekeeping, and users typically shouldn't need to set or</br>understand this field. A workflow can be the user's name, a</br>controller's name, or the name of a specific apply path like</br>"ci-cd". The set of fields is always in the version that the</br>workflow used when modifying the object.</br></br>+optional</br>+listType=atomic |  |
| Name | string| `string` |  | | Name must be unique within a namespace. Is required when creating resources, although</br>some resources may allow a client to request the generation of an appropriate name</br>automatically. Name is primarily intended for creation idempotence and configuration</br>definition.</br>Cannot be updated.</br>More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names#names</br>+optional |  |
| Namespace | string| `string` |  | | Namespace defines the space within which each name must be unique. An empty namespace is</br>equivalent to the "default" namespace, but "default" is the canonical representation.</br>Not all objects are required to be scoped to a namespace - the value of this field for</br>those objects will be empty.</br></br>Must be a DNS_LABEL.</br>Cannot be updated.</br>More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/namespaces</br>+optional |  |
| OwnerReferences | [][OwnerReference](#owner-reference)| `[]*OwnerReference` |  | | List of objects depended by this object. If ALL objects in the list have</br>been deleted, this object will be garbage collected. If this object is managed by a controller,</br>then an entry in this list will point to this controller, with the controller field set to true.</br>There cannot be more than one managing controller.</br>+optional</br>+patchMergeKey=uid</br>+patchStrategy=merge</br>+listType=map</br>+listMapKey=uid |  |
| ResourceVersion | string| `string` |  | | An opaque value that represents the internal version of this object that can</br>be used by clients to determine when objects have changed. May be used for optimistic</br>concurrency, change detection, and the watch operation on a resource or set of resources.</br>Clients must treat these values as opaque and passed unmodified back to the server.</br>They may only be valid for a particular resource or set of resources.</br></br>Populated by the system.</br>Read-only.</br>Value must be treated as opaque by clients and .</br>More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#concurrency-control-and-consistency</br>+optional |  |
| SelfLink | string| `string` |  | | Deprecated: selfLink is a legacy read-only field that is no longer populated by the system.</br>+optional |  |
| spec | [WorkloadEntry](#workload-entry)| `WorkloadEntry` |  | |  |  |
| status | [IstioStatus](#istio-status)| `IstioStatus` |  | |  |  |
| uid | [UID](#uid)| `UID` |  | |  |  |



### <span id="workload-group"></span> WorkloadGroup


> <!-- crd generation tags
+cue-gen:WorkloadGroup:groupName:networking.istio.io
+cue-gen:WorkloadGroup:version:v1
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
+kubetype-gen:groupVersion=networking.istio.io/v1
+genclient
+k8s:deepcopy-gen=true
>
<!-- istio code generation tags
+istio.io/sync-from:networking/v1alpha3/workload_group.proto
>
  





**Properties**

| Name | Type | Go type | Required | Default | Description | Example |
|------|------|---------|:--------:| ------- |-------------|---------|
| APIVersion | string| `string` |  | | APIVersion defines the versioned schema of this representation of an object.</br>Servers should convert recognized schemas to the latest internal value, and</br>may reject unrecognized values.</br>More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#resources</br>+optional |  |
| Annotations | map of string| `map[string]string` |  | | Annotations is an unstructured key value map stored with a resource that may be</br>set by external tools to store and retrieve arbitrary metadata. They are not</br>queryable and should be preserved when modifying objects.</br>More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/annotations</br>+optional |  |
| CreationTimestamp | string| `string` |  | | CreationTimestamp is a timestamp representing the server time when this object was</br>created. It is not guaranteed to be set in happens-before order across separate operations.</br>Clients may not set this value. It is represented in RFC3339 form and is in UTC.</br></br>Populated by the system.</br>Read-only.</br>Null for lists.</br>More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata</br>+optional |  |
| DeletionGracePeriodSeconds | int64 (formatted integer)| `int64` |  | | Number of seconds allowed for this object to gracefully terminate before</br>it will be removed from the system. Only set when deletionTimestamp is also set.</br>May only be shortened.</br>Read-only.</br>+optional |  |
| DeletionTimestamp | string| `string` |  | | DeletionTimestamp is RFC 3339 date and time at which this resource will be deleted. This</br>field is set by the server when a graceful deletion is requested by the user, and is not</br>directly settable by a client. The resource is expected to be deleted (no longer visible</br>from resource lists, and not reachable by name) after the time in this field, once the</br>finalizers list is empty. As long as the finalizers list contains items, deletion is blocked.</br>Once the deletionTimestamp is set, this value may not be unset or be set further into the</br>future, although it may be shortened or the resource may be deleted prior to this time.</br>For example, a user may request that a pod is deleted in 30 seconds. The Kubelet will react</br>by sending a graceful termination signal to the containers in the pod. After that 30 seconds,</br>the Kubelet will send a hard termination signal (SIGKILL) to the container and after cleanup,</br>remove the pod from the API. In the presence of network partitions, this object may still</br>exist after this timestamp, until an administrator or automated process can determine the</br>resource is fully terminated.</br>If not set, graceful deletion of the object has not been requested.</br></br>Populated by the system when a graceful deletion is requested.</br>Read-only.</br>More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata</br>+optional |  |
| Finalizers | []string| `[]string` |  | | Must be empty before the object is deleted from the registry. Each entry</br>is an identifier for the responsible component that will remove the entry</br>from the list. If the deletionTimestamp of the object is non-nil, entries</br>in this list can only be removed.</br>Finalizers may be processed and removed in any order.  Order is NOT enforced</br>because it introduces significant risk of stuck finalizers.</br>finalizers is a shared field, any actor with permission can reorder it.</br>If the finalizer list is processed in order, then this can lead to a situation</br>in which the component responsible for the first finalizer in the list is</br>waiting for a signal (field value, external system, or other) produced by a</br>component responsible for a finalizer later in the list, resulting in a deadlock.</br>Without enforced ordering finalizers are free to order amongst themselves and</br>are not vulnerable to ordering changes in the list.</br>+optional</br>+patchStrategy=merge</br>+listType=set |  |
| GenerateName | string| `string` |  | | GenerateName is an optional prefix, used by the server, to generate a unique</br>name ONLY IF the Name field has not been provided.</br>If this field is used, the name returned to the client will be different</br>than the name passed. This value will also be combined with a unique suffix.</br>The provided value has the same validation rules as the Name field,</br>and may be truncated by the length of the suffix required to make the value</br>unique on the server.</br></br>If this field is specified and the generated name exists, the server will return a 409.</br></br>Applied only if Name is not specified.</br>More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#idempotency</br>+optional |  |
| Generation | int64 (formatted integer)| `int64` |  | | A sequence number representing a specific generation of the desired state.</br>Populated by the system. Read-only.</br>+optional |  |
| Kind | string| `string` |  | | Kind is a string value representing the REST resource this object represents.</br>Servers may infer this from the endpoint the client submits requests to.</br>Cannot be updated.</br>In CamelCase.</br>More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds</br>+optional |  |
| Labels | map of string| `map[string]string` |  | | Map of string keys and values that can be used to organize and categorize</br>(scope and select) objects. May match selectors of replication controllers</br>and services.</br>More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/labels</br>+optional |  |
| ManagedFields | [][ManagedFieldsEntry](#managed-fields-entry)| `[]*ManagedFieldsEntry` |  | | ManagedFields maps workflow-id and version to the set of fields</br>that are managed by that workflow. This is mostly for internal</br>housekeeping, and users typically shouldn't need to set or</br>understand this field. A workflow can be the user's name, a</br>controller's name, or the name of a specific apply path like</br>"ci-cd". The set of fields is always in the version that the</br>workflow used when modifying the object.</br></br>+optional</br>+listType=atomic |  |
| Name | string| `string` |  | | Name must be unique within a namespace. Is required when creating resources, although</br>some resources may allow a client to request the generation of an appropriate name</br>automatically. Name is primarily intended for creation idempotence and configuration</br>definition.</br>Cannot be updated.</br>More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names#names</br>+optional |  |
| Namespace | string| `string` |  | | Namespace defines the space within which each name must be unique. An empty namespace is</br>equivalent to the "default" namespace, but "default" is the canonical representation.</br>Not all objects are required to be scoped to a namespace - the value of this field for</br>those objects will be empty.</br></br>Must be a DNS_LABEL.</br>Cannot be updated.</br>More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/namespaces</br>+optional |  |
| OwnerReferences | [][OwnerReference](#owner-reference)| `[]*OwnerReference` |  | | List of objects depended by this object. If ALL objects in the list have</br>been deleted, this object will be garbage collected. If this object is managed by a controller,</br>then an entry in this list will point to this controller, with the controller field set to true.</br>There cannot be more than one managing controller.</br>+optional</br>+patchMergeKey=uid</br>+patchStrategy=merge</br>+listType=map</br>+listMapKey=uid |  |
| ResourceVersion | string| `string` |  | | An opaque value that represents the internal version of this object that can</br>be used by clients to determine when objects have changed. May be used for optimistic</br>concurrency, change detection, and the watch operation on a resource or set of resources.</br>Clients must treat these values as opaque and passed unmodified back to the server.</br>They may only be valid for a particular resource or set of resources.</br></br>Populated by the system.</br>Read-only.</br>Value must be treated as opaque by clients and .</br>More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#concurrency-control-and-consistency</br>+optional |  |
| SelfLink | string| `string` |  | | Deprecated: selfLink is a legacy read-only field that is no longer populated by the system.</br>+optional |  |
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
| IstioAmbient | boolean| `bool` | ✓ | | Define if belongs to a namespace labeled as ambient | `true` |
| IstioSidecar | boolean| `bool` | ✓ | | Define if all Pods related to the Workload has an IstioSidecar deployed | `true` |
| Labels | map of string| `map[string]string` |  | | Labels for Workload |  |
| ServiceAccountNames | []string| `[]string` | ✓ | | List of service accounts involved in this application |  |
| WorkloadName | string| `string` | ✓ | | Name of a workload member of an application | `reviews-v1` |



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
| IstioAmbient | boolean| `bool` | ✓ | | Define if Pods related to this Workload has an IstioAmbient deployed | `true` |
| IstioInjectionAnnotation | boolean| `bool` |  | | Define if Workload has an explicit Istio policy annotation</br>Istio supports this as a label as well - this will be defined if the label is set, too.</br>If both annotation and label are set, if any is false, injection is disabled.</br>It's mapped as a pointer to show three values nil, true, false |  |
| IstioReferences | [][IstioValidationKey](#istio-validation-key)| `[]*IstioValidationKey` |  | | Istio References |  |
| IstioSidecar | boolean| `bool` | ✓ | | Define if Pods related to this Workload has an IstioSidecar deployed | `true` |
| Labels | map of string| `map[string]string` |  | | Workload labels |  |
| Name | string| `string` | ✓ | | Name of the workload | `reviews-v1` |
| Namespace | string| `string` |  | | Namespace of the workload |  |
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


