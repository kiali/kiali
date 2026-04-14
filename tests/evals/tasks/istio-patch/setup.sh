#!/usr/bin/env bash
set -euo pipefail
cat <<'EOF' | kubectl apply -f -
kind: DestinationRule
apiVersion: networking.istio.io/v1
metadata:
  namespace: bookinfo
  name: reviews
  labels:
    gevals.kiali.io/test: gevals-testing
  annotations: ~
spec:
  host: reviews.bookinfo.svc.cluster.local
  subsets:
  - name: v1
    labels:
      version: v1
  - name: v2
    labels:
      version: v2
  - name: v3
    labels:
      version: v3
  trafficPolicy: ~

---

kind: VirtualService
apiVersion: networking.istio.io/v1
metadata:
  namespace: bookinfo
  name: reviews
  labels:
    gevals.kiali.io/test: gevals-testing
spec:
  http:
  - route:
    - destination:
        host: reviews.bookinfo.svc.cluster.local
        subset: v1
      weight: 0
    - destination:
        host: reviews.bookinfo.svc.cluster.local
        subset: v2
      weight: 0
    - destination:
        host: reviews.bookinfo.svc.cluster.local
        subset: v3
      weight: 100
  hosts:
  - reviews.bookinfo.svc.cluster.local
  gateways: ~
EOF
