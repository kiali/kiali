## MCP Tool `get_mesh_traffic_graph` - Compact Output Format

This PR refactors the output of the `get_mesh_traffic_graph` MCP tool from a UI-centric Cytoscape JSON format to an LLM-centric semantic format. The payload is reduced from ~3,000+ tokens to ~200 tokens.

---

### Before vs After

<details>
<summary>Before (~3,000+ tokens - raw Cytoscape graph + mesh status + full namespace objects)</summary>

```json
{
  "graph": {
    "timestamp": 1773842446,
    "duration": 600,
    "graphType": "versionedApp",
    "elements": {
      "nodes": [
        {
          "data": {
            "id": "a7f0ea966626a632f524c63ca4d794ed666f3415f3544b989474d27aad08c694",
            "nodeType": "box",
            "cluster": "Kubernetes",
            "namespace": "bookinfo",
            "app": "reviews",
            "healthData": {
              "requests": { "healthAnnotations": {}, "inbound": { "http": { "200": 0.294 } }, "outbound": {} },
              "workloadStatuses": []
            },
            "isBox": "app",
            "isInaccessible": true
          }
        },
        {
          "data": {
            "id": "e73d17c7ce69b6449aa320b78d088e1679f604d5ef299d5c7e4816193c90223d",
            "nodeType": "app",
            "cluster": "Kubernetes",
            "namespace": "bookinfo",
            "workload": "details-v1",
            "app": "details",
            "version": "v1",
            "destServices": [{ "cluster": "Kubernetes", "namespace": "bookinfo", "name": "details" }],
            "traffic": [{ "protocol": "http", "rates": { "httpIn": "0.98" } }],
            "healthData": {
              "requests": { "healthAnnotations": {}, "inbound": { "http": { "200": 0.979 } }, "outbound": {} },
              "workloadStatuses": []
            },
            "isInaccessible": true
          }
        },
        {
          "data": {
            "id": "97197b9ec9e8e4d6a49fc7e39ffcd7dd7d8ca4b6ccdef5a4c44671519d45bf42",
            "nodeType": "app",
            "cluster": "Kubernetes",
            "namespace": "bookinfo",
            "workload": "istio-ingressgateway",
            "app": "istio-ingressgateway",
            "version": "latest",
            "traffic": [{ "protocol": "http", "rates": { "httpOut": "0.98" } }],
            "healthData": { "...nested health data..." },
            "isInaccessible": true,
            "isRoot": true
          }
        },
        {
          "data": {
            "id": "efcc2ed361215b3c82e67fd0d0cb09899b9ee1e18dee32e8e828b487a7cb9343",
            "nodeType": "app",
            "workload": "productpage-v1",
            "app": "productpage",
            "version": "v1",
            "destServices": [{ "cluster": "Kubernetes", "namespace": "bookinfo", "name": "productpage" }],
            "traffic": [{ "protocol": "http", "rates": { "httpIn": "0.98", "httpOut": "1.95" } }],
            "healthData": { "...nested health data..." },
            "isInaccessible": true
          }
        },
        "...more nodes with SHA-256 hashes, nested healthData, destServices, etc..."
      ],
      "edges": [
        {
          "data": {
            "id": "f94f646cb6ccb03267fc6ae31e954ceeec3bbf40c0786084c9582e1ce6308a69",
            "source": "97197b9ec9e8e4d6a49fc7e39ffcd7dd7d8ca4b6ccdef5a4c44671519d45bf42",
            "target": "efcc2ed361215b3c82e67fd0d0cb09899b9ee1e18dee32e8e828b487a7cb9343",
            "destPrincipal": "spiffe://cluster.local/ns/bookinfo/sa/bookinfo-productpage",
            "healthStatus": "Healthy",
            "isMTLS": "100",
            "responseTime": "24",
            "sourcePrincipal": "spiffe://cluster.local/ns/bookinfo/sa/default",
            "throughput": "13686",
            "traffic": {
              "protocol": "http",
              "rates": { "http": "0.98", "httpPercentReq": "100.0" },
              "responses": {
                "200": {
                  "flags": { "-": "100.0" },
                  "hosts": { "productpage.bookinfo.svc.cluster.local": "100.0" }
                }
              }
            }
          }
        },
        "...more edges with hash-based source/target references..."
      ]
    }
  },
  "mesh_status": {
    "elements": {
      "nodes": [
        {
          "data": {
            "id": "...",
            "cluster": "_external_",
            "infraName": "External Deployments",
            "infraType": "cluster",
            "isExternal": true,
            "isInaccessible": true
          }
        },
        {
          "data": {
            "id": "...",
            "cluster": "kind-mcp-eval-cluster",
            "infraName": "istiod",
            "infraType": "istiod",
            "infraData": {
              "config": {
                "effectiveConfig": {
                  "configMap": {
                    "mesh": {
                      "accessLogFile": "/dev/stdout",
                      "defaultConfig": { "discoveryAddress": "istiod.istio-system.svc:15012" },
                      "trustDomain": "cluster.local",
                      "rootNamespace": "istio-system",
                      "extensionProviders": ["...full provider configs..."],
                      "defaultProviders": { "metrics": ["prometheus"] }
                    }
                  }
                },
                "certificates": ["...full cert details..."],
                "...hundreds more lines of istiod config..."
              }
            }
          }
        },
        "...Prometheus config, Grafana config, Jaeger config, Kiali config..."
      ],
      "edges": ["...infra edges..."]
    }
  },
  "namespaces": [
    {
      "name": "bookinfo",
      "cluster": "kind-mcp-eval-cluster",
      "isAmbient": false,
      "isControlPlane": false,
      "labels": {
        "istio-discovery": "enabled",
        "istio-injection": "enabled",
        "istio.io/rev": "default",
        "kubernetes.io/metadata.name": "bookinfo"
      },
      "annotations": null,
      "revision": "default"
    },
    {
      "name": "default",
      "cluster": "kind-mcp-eval-cluster",
      "labels": { "istio-injection": "enabled", "kubernetes.io/metadata.name": "default" }
    },
    {
      "name": "istio-system",
      "cluster": "kind-mcp-eval-cluster",
      "isControlPlane": true,
      "labels": { "kubernetes.io/metadata.name": "istio-system" }
    },
    {
      "name": "local-path-storage",
      "cluster": "kind-mcp-eval-cluster",
      "labels": { "kubernetes.io/metadata.name": "local-path-storage" },
      "annotations": { "kubectl.kubernetes.io/last-applied-configuration": "...long JSON..." }
    }
  ],
  "mesh_health_summary": {
    "overallStatus": "HEALTHY",
    "availability": 100,
    "totalErrorRate": 0,
    "namespaceCount": 1,
    "entityCounts": {
      "apps": { "total": 4, "healthy": 4, "degraded": 0, "unhealthy": 0, "notReady": 0 },
      "services": { "total": 0, "healthy": 0, "degraded": 0, "unhealthy": 0, "notReady": 0 },
      "workloads": { "total": 0, "healthy": 0, "degraded": 0, "unhealthy": 0, "notReady": 0 }
    },
    "namespaceSummary": {
      "bookinfo": {
        "status": "HEALTHY",
        "availability": 100,
        "errorRate": 0,
        "apps": { "total": 4, "healthy": 4, "degraded": 0, "unhealthy": 0, "notReady": 0 },
        "services": { "total": 0, "healthy": 0, "degraded": 0, "unhealthy": 0, "notReady": 0 },
        "workloads": { "total": 0, "healthy": 0, "degraded": 0, "unhealthy": 0, "notReady": 0 }
      }
    },
    "timestamp": "2026-03-18T14:00:47Z",
    "rateInterval": "10m"
  }
}
```

</details>

<details>
<summary>After (~200 tokens - semantic graph)</summary>

```json
{
  "graphType": "versionedApp",
  "namespaces": ["bookinfo"],
  "health": {
    "overallStatus": "HEALTHY",
    "availability": 100,
    "totalErrorRate": 0,
    "namespaceCount": 1,
    "entityCounts": {
      "apps": { "total": 4, "healthy": 4, "degraded": 0, "unhealthy": 0, "notReady": 0 },
      "services": { "total": 0, "healthy": 0, "degraded": 0, "unhealthy": 0, "notReady": 0 },
      "workloads": { "total": 0, "healthy": 0, "degraded": 0, "unhealthy": 0, "notReady": 0 }
    },
    "namespaceSummary": {
      "bookinfo": {
        "status": "HEALTHY",
        "availability": 100,
        "errorRate": 0,
        "apps": { "total": 4, "healthy": 4, "degraded": 0, "unhealthy": 0, "notReady": 0 }
      }
    },
    "timestamp": "2026-03-18T14:00:47Z",
    "rateInterval": "10m"
  },
  "nodes": [
    { "name": "istio-ingressgateway", "version": "latest", "type": "app" },
    { "name": "productpage", "version": "v1", "type": "app" },
    { "name": "details", "version": "v1", "type": "app" },
    { "name": "reviews", "version": "v1", "type": "app" },
    { "name": "reviews", "version": "v2", "type": "app" },
    { "name": "reviews", "version": "v3", "type": "app" },
    { "name": "ratings", "version": "v1", "type": "app" }
  ],
  "traffic": [
    {
      "source": "istio-ingressgateway (latest)",
      "target": "productpage (v1)",
      "protocol": "http",
      "throughput": "13686",
      "responseTimeMs": 24,
      "mTLS": true,
      "health": "Healthy"
    },
    {
      "source": "productpage (v1)",
      "target": "details (v1)",
      "protocol": "http",
      "throughput": "924",
      "responseTimeMs": 5,
      "mTLS": true,
      "health": "Healthy"
    },
    {
      "source": "productpage (v1)",
      "target": "reviews (v1)",
      "protocol": "http",
      "throughput": "338",
      "responseTimeMs": 2,
      "mTLS": true,
      "health": "Healthy"
    },
    {
      "source": "productpage (v1)",
      "target": "reviews (v3)",
      "protocol": "http",
      "throughput": "417",
      "responseTimeMs": 12,
      "mTLS": true,
      "health": "Healthy"
    },
    {
      "source": "productpage (v1)",
      "target": "reviews (v2)",
      "protocol": "http",
      "throughput": "434",
      "responseTimeMs": 11,
      "mTLS": true,
      "health": "Healthy"
    },
    {
      "source": "reviews (v3)",
      "target": "ratings (v1)",
      "protocol": "http",
      "throughput": "278",
      "responseTimeMs": 0,
      "mTLS": true,
      "health": "Healthy"
    },
    {
      "source": "reviews (v2)",
      "target": "ratings (v1)",
      "protocol": "http",
      "throughput": "290",
      "responseTimeMs": 0,
      "mTLS": true,
      "health": "Healthy"
    }
  ]
}
```

</details>

---

### What Was Removed (and Why)

| Removed Block | Why |
|---|---|
| **`mesh_status`** (entire block) | Contains Prometheus/Grafana/Jaeger/istiod internal configs, certificate details, extension providers. An LLM cannot use this to diagnose traffic issues. |
| **`namespaces`** (full namespace objects) | Replaced with a simple `["bookinfo"]` string array. Raw labels, annotations, and revision metadata are not needed for graph interpretation. |
| **Cytoscape hash IDs** (`a7f0ea96...`) | LLMs cannot read SHA-256 hashes. The transform resolves hashes on the backend and outputs human-readable names: `"productpage (v1)"`. |
| **Deeply nested traffic metrics** (`traffic.protocol.http.rates.httpPercentReq...`) | Flattened to top-level keys: `protocol`, `throughput`, `responseTimeMs`, `mTLS` (bool). |
| **Box/compound nodes** (`isBox: "app"`) | These are UI grouping constructs for Cytoscape rendering. Skipped entirely -- only real app/workload/service nodes are emitted. |
| **SPIFFE principals** (`destPrincipal`, `sourcePrincipal`) | Internal mTLS identity strings. Replaced with a simple `mTLS: true/false` boolean. |
| **Response breakdown** (`responses.200.flags.-...`) | Per-status-code per-flag per-host breakdown. The LLM only needs the edge-level health status. |
| **Node healthData** (per-node nested requests) | Removed from nodes. Health is available via the top-level `health` summary and per-edge `health` field. |

### What Was Kept

| Field | Purpose |
|---|---|
| `graphType` | So the LLM knows the granularity (versionedApp, app, workload, service) |
| `namespaces` | Simple list of which namespaces are in the graph |
| `health` | The pre-computed mesh health summary with overall status and per-namespace breakdown |
| `nodes` | Name + type + version for each real node |
| `traffic` | Source → target with protocol, throughput (bytes/s), response time (ms), mTLS, and health |

### Token Savings

~**90% reduction** -- from ~3,000+ tokens to ~200 tokens for a typical bookinfo namespace graph.
