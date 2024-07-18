# Kiali Extension Framework

1. [Summary](#summary)
2. [Motivation](#motivation)
3. [Solution](#solution)
4. [Roadmap](#roadmap)

# Summary

Provide a way to extend the Kiali graph using traffic metrics provided from a non-Istio source.

# Motivation

Sometimes in the past, and now more often, we’ve been asked if Kiali can be applied to other meshes, products, etc. This means that people like what Kiali does and wish either:

- They had a Kiali for their tool.
- That Kiali could expand its scope to incorporate their tool [to some degree].

Recently, we discussed integration between service mesh and the Skupper project to allow mesh apps to access remote services accessible via Skupper. This extension proposal would allow the Kiali graph to extend the mesh traffic with edges representing the Skupper portion of the traffic.

## Goals

- Provide a way for external metrics to be incorporated into the Kiali traffic graph without the need for custom code changes in Kiali.
- Stretch: Provide a way to navigate from Kiali to a 3rd party UI, from the extended graph nodes.

## Non-Goals

- To incorporate external information, outside of traffic, into Kiali (config, etc).

# Solution

The proposed solution is to add support for Kiali graph "Extensions". The Extension idea has a few parts:

- A set of supported Kiali-specific metrics that, when provided, can be used to extend the Kiali traffic graph.
- A new "Extensions" graph appender that can ingest the externally provided metrics.
- Supported configuration for registering Extensions in the Kiali CR.
- Supported route or annotation information for providing links from extension graph nodes to an external UI.

## Extension Metrics

The Extension metrics are defined below. These are **Kiali-specific** metrics that would be supplied by the extension integrating with Kiali. This is to allow Kiali to work generically, against a stable and supported metric API, and to protect the extension from needing to support their own metric API (in other words, they are free to change their own metrics, they need only to be able to provide Kiali with the expected standard metrics).

_Note that there was some consideration for making the Kiali-specific metrics OTel metrics, but the OTel metric spec does not yet seem suitable. The extension framework could support OTel in the future, if it becomes desirable._

Kiali will continue to work with only a single metrics back-end (e.g. Prometheus instance). The Istio metrics and extension metrics must reside in this single metrics repository. How this is accomplished is outside the scope of this KEP, but if the extension also utilizes Prometheus, it is fairly typical to use Prometheus Federation to import the extension metrics.

### Investigation of re-using Istio Metrics

One major alternative to the proposed solution was to re-use Istio metrics. The pros and cons of that approach are listed below. After evaluation, it was decided that the cons outweighed the pros. In particular, the Istio metrics are complex and would be more difficult to provide by the extensions. Also, it is safer to be disconnected from the Istio APIs and rely on our own.

- Pros:

  - The biggest pro is that we can re-use the code that we already have for Istio metrics. This prevents us from having to write new code that does nearly the same thing, for our own metrics. It also prevents additional queries to Prometheus.
  - We can still extend the Istio metrics with additional attributes.

- Cons:
  - Extensions may not logically be able to supply all of the required attributes, and may have to “fudge” values. Note that extensions may be more service-oriented than workload oriented.
  - We will end up with some extension-case coding in our main metric handling, and not be able to just locate code in a dedicated appender.
  - Extensions may not be required to supply all of the fields we expect from Istio.
  - Extensions could be disabled/unregistered, and have any metrics ignored. Note that for any bulk queries (possibly outside the graph code), it may not be possible to filter out extension metrics.
  - It’s a bit weird to tell the extending parties to supply Istio metrics, when they aren’t Istio.
  - The attribute names are not as simple as we would like them to be.
  - We lose some control over the extension handling. The biggest pro above may also be the biggest liability, we may just find that integrating metrics is too pervasive when seemingly our goal is to just add some inaccessible service nodes to the graph.
  - Istio’s histogram metrics use terrible bucketing.

## Kiali Extension Metrics

The overall design of these metrics is to supply information similar to, but more simple than, the Istio core metrics used by Kiali. We minimally need:

- Request metrics
  - HTTP, gRPC
- Throughput metrics
  - TCP bytes

We'd like to also support:

- ResponseTime metrics

### Kiali_ext_requests_total

- counter of requests

| Attribute        | Notes                                                                             |
| ---------------- | --------------------------------------------------------------------------------- |
| Extension        | configured extension name                                                         |
| Protocol         | http \| grpc                                                                      |
| Source_cluster   |                                                                                   |
| Source_namespace |                                                                                   |
| Source_name      |                                                                                   |
| Source_is_root   | this source is rooted in the kiali graph: true \| false                           |
| Reporter         | source \| dest \| combined - “combined” is preferred (i.e. only 1 TS per request) |
| Reporter_id      | pod id or other unique discriminator                                              |
| Dest_cluster     |                                                                                   |
| Dest_namespace   |                                                                                   |
| Dest_name        |                                                                                   |
| Security         | none \| mTLS                                                                      |
| Status_code      |                                                                                   |
| Flags            | optional, defaults to “”                                                          |

### Kiali_ext_tcp_sent_total

- counter of bytes

| Attribute        | Notes                                                                             |
| ---------------- | --------------------------------------------------------------------------------- |
| Extension        | configured extension name                                                         |
| Source_cluster   |                                                                                   |
| Source_namespace |                                                                                   |
| Source_name      |                                                                                   |
| Source_is_root   | this source is rooted in the kiali graph: true \| false                           |
| Reporter         | source \| dest \| combined - “combined” is preferred (i.e. only 1 TS per request) |
| Reporter_id      | pod id or other unique discriminator                                              |
| Dest_cluster     |                                                                                   |
| Dest_namespace   |                                                                                   |
| Dest_name        |                                                                                   |
| Security         | none \| mTLS                                                                      |
| Status_code      |                                                                                   |
| Flags            | optional, defaults to “”                                                          |

### Kiali_ext_tcp_received_total

| Attribute        | Notes                                                                             |
| ---------------- | --------------------------------------------------------------------------------- |
| Extension        | configured extension name                                                         |
| Source_cluster   |                                                                                   |
| Source_namespace |                                                                                   |
| Source_name      |                                                                                   |
| Source_is_root   | this source is rooted in the kiali graph: true \| false                           |
| Reporter         | source \| dest \| combined - “combined” is preferred (i.e. only 1 TS per request) |
| Reporter_id      | pod id or other unique discriminator                                              |
| Dest_cluster     |                                                                                   |
| Dest_namespace   |                                                                                   |
| Dest_name        |                                                                                   |
| Security         | none \| mTLS                                                                      |
| Status_code      |                                                                                   |
| Flags            | optional, defaults to “”                                                          |

### Kiali_ext_response_time_seconds

- histogram
- Buckets are prom defaults: [ .005, .01, .025, .05, .1, .25, .5, 1, 2.5, 5, 10 ]

| Attribute        | Notes                                                                             |
| ---------------- | --------------------------------------------------------------------------------- |
| Extension        | configured extension name                                                         |
| Protocol         | http \| grpc                                                                      |
| Source_cluster   |                                                                                   |
| Source_namespace |                                                                                   |
| Source_name      |                                                                                   |
| Source_is_root   | this source is rooted in the kiali graph: true \| false                           |
| Reporter         | source \| dest \| combined - “combined” is preferred (i.e. only 1 TS per request) |
| Reporter_id      | pod id or other unique discriminator                                              |
| Dest_cluster     |                                                                                   |
| Dest_namespace   |                                                                                   |
| Dest_name        |                                                                                   |
| Security         | none \| mTLS                                                                      |
| Status_code      |                                                                                   |
| Flags            | optional, defaults to “”                                                          |

## Kiali Extension Configuration

The primary extension code, a graph appender, is generic and owned by Kiali. The Extensions will look for and process extension data for each enabled extension registered in the Kiali CR. The appender would likely be always-on, and just do nothing if no extensions are configured or enabled.

```
spec:
  extensions:
    - enabled: true | false (default)
      name: <extension name>
```

## Kiali Extension UI URL linking

While the intent of Kiali extensions is to be able to extend the Kiali graph beyond the mesh, the information about those extended services will be limited. Users may want to investigate further. If an Extension provider has its own console UI, it can ensure that the Kiali user can link to that UI. For extension nodes, the graph side panel will provide a link to the external UI, if discovered. There are two mechanisms:

### OpenShift Routes

On OpenShift, Kiali will look for an OpenShift route on the service named the same as the external service (or app) node. Failing that match, Kiali will look for an OpenShift route on a service named for the extension itself. If no routes are found, it will fall back to the Annotation approach.

### Annotation

Kiali will look for the following annotation on the service named the same as the external service (or app) node. Failing that match, Kiali will look for the annotation on a service named for the extension itself.

```
extension.kiali.io/ui-url
```

# Roadmap

- [ ] POC (using Skupper as the extension)
