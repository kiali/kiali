---
id: kiali
summary: 'The console for Istio service mesh: see traffic, health and configuration across clusters, and change mesh configuration with guided actions.'
category: observability
tags:
- istio
- service-mesh
- kubernetes
- observability
authors:
- name: The Kiali project
  url: https://kiali.io
license: Apache-2.0
languages:
- en
- es
- ko
- zh
limitations:
- 'Kiali keeps no copy of the mesh: Kubernetes and Istio own the running resources, and Kiali reads the clusters, Prometheus and the tracing backend whenever it shows something'
- 'People sign in with an identity they already have: a Kubernetes token, an OpenID or OpenShift account, or an authenticating proxy in front of Kiali'
- What a person sees and may change in a cluster is what their Kubernetes roles allow there
- Traffic, metrics and request-based health need Prometheus; traces need a tracing backend
- Preferences are saved in the person's browser, not with Kiali
- Chat conversations live in the browser tab and in Kiali's memory, and Kiali forgets them after a period of disuse or when it restarts
- The AI chatbot is a developer preview, and its answers come from the language model provider the person picks
references:
- kind: doc
  role: context
  target: README.adoc
  title: Kiali README
- kind: doc
  role: intent
  target: https://kiali.io/docs
  title: Kiali documentation
- kind: doc
  role: context
  target: kiali_internal_api.md
  title: The Kiali API serves the Kiali UI only
---

# Kiali

Kiali is the management console for an Istio service mesh. People who run or
build on a mesh use it to see which services talk to which, how healthy that
traffic is, how the mesh's control planes and namespaces are set up and whether
the Istio configuration is valid, across one or many clusters. From the same
console they change the mesh: they write Istio configuration, shift and route
traffic between versions, enroll namespaces and workloads in the mesh, and ask
an optional AI chatbot about what they are looking at.

## Intent

Make an Istio mesh understandable and safely adjustable for the people
responsible for it, without asking them to read raw telemetry or YAML first.
