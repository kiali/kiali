#!/usr/bin/env bash
set -euo pipefail
cat <<'EOF' | kubectl apply -f -
apiVersion: networking.istio.io/v1alpha3
kind: VirtualService
metadata:
  name: productpage-forced-failure
  namespace: bookinfo
  labels:
    gevals.kiali.io/test: gevals-testing
spec:
  hosts:
  - "productpage"
  - "productpage-bookinfo.apps-crc.testing" 
  gateways:
  - bookinfo-gateway
  - mesh # Para que afecte también si un microservicio llama a otro internamente
  http:
  - fault:
      abort:
        httpStatus: 500
        percentage:
          value: 100
    route:
    - destination:
        host: productpage
        subset: v1
EOF
