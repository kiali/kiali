# LightSpeed Provider

Integration of [OpenShift LightSpeed](https://github.com/openshift/lightspeed-service) as an AI provider in Kiali.

## Table of Contents

- [Overview](#overview)
- [Configuration](#configuration)
- [Network Access](#network-access)
- [API Reference](#api-reference)

## Overview

The LightSpeed provider connects Kiali's AI chat feature to a running
[lightspeed-service](https://github.com/openshift/lightspeed-service) instance. Unlike other
providers, LightSpeed has no model selection or API key configuration in Kiali — authentication is
handled per-request using the Kiali user's Kubernetes bearer token, and model selection is managed
entirely by the LightSpeed service itself.

## Configuration

Add a `lightspeed` provider to `chat_ai.providers` in your Kiali configuration. Only `endpoint` is
required:

```yaml
chat_ai:
  enabled: true
  default_provider: "LightSpeed"
  providers:
    - name: "LightSpeed"
      description: "OpenShift LightSpeed"
      type: "lightspeed"
      endpoint: "http://127.0.0.1:8080/"
      enabled: true
```

| Field        | Required | Description                                             |
|--------------|----------|---------------------------------------------------------|
| `name`       | yes      | Display name shown in the Kiali UI                      |
| `type`       | yes      | Must be `lightspeed`                                    |
| `endpoint`   | yes      | Base URL of the running lightspeed-service instance     |
| `enabled`    | yes      | Set to `true` to activate the provider                  |
| `description`| no       | Optional description shown in the Kiali UI              |

## Network Access

By default, LightSpeed's network policy only allows traffic from within the
`openshift-lightspeed` namespace, so Kiali (running in `istio-system`) cannot reach the service
directly. There are two ways to solve this:

### Option 1 — Create an OpenShift Route

Expose the LightSpeed service via a Route and use the resulting external URL as the `endpoint`
in your Kiali configuration. This is the simpler option if your cluster already has a working
ingress setup.

### Option 2 — Allow `istio-system` via NetworkPolicy

Apply the following `NetworkPolicy` in the `openshift-lightspeed` namespace to allow any
namespace labelled `allow-lightspeed=true` to reach the service on port 8443:

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-labeled-namespaces-to-lightspeed
  namespace: openshift-lightspeed
spec:
  podSelector:
    matchLabels:
      app.kubernetes.io/name: lightspeed-service-api
  policyTypes:
    - Ingress
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              allow-lightspeed: "true"
      ports:
        - protocol: TCP
          port: 8443
```

Then grant access to `istio-system`:

```bash
oc label namespace istio-system allow-lightspeed=true
```

To revoke access later:

```bash
oc label namespace istio-system allow-lightspeed-
```

## API Reference

The provider communicates with the LightSpeed service using its streaming query endpoint.
See the full OpenAPI specification at:
[lightspeed-service/docs/openapi.json](https://github.com/openshift/lightspeed-service/blob/main/docs/openapi.json)

For local development setup — running the MCP server and the LightSpeed service container —
see [DEVELOPMENT.md](./DEVELOPMENT.md).
