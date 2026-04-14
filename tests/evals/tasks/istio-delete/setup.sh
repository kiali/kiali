#!/usr/bin/env bash
set -euo pipefail
cat <<'EOF' | kubectl apply -f -
apiVersion: networking.istio.io/v1
kind: DestinationRule
metadata:
  namespace: bookinfo
  name: ratings
  labels:
    gevals.kiali.io/test: gevals-testing
spec:
  host: ratings.bookinfo.svc.cluster.local
  subsets:
  - name: v1
    labels:
      version: v1
---
apiVersion: networking.istio.io/v1
kind: VirtualService
metadata:
  namespace: bookinfo
  name: ratings
  labels:
    gevals.kiali.io/test: gevals-testing
spec:
  hosts:
  - ratings.bookinfo.svc.cluster.local
  http:
  - route:
    - destination:
        host: ratings.bookinfo.svc.cluster.local
        subset: v1
      weight: 100
    fault:
      abort:
        percentage:
          value: 100
        httpStatus: 503
EOF
