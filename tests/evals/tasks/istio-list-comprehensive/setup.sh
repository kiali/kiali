#!/usr/bin/env bash
set -euo pipefail

# Create multiple VirtualServices (10)
for i in {1..10}; do
cat <<EOF | kubectl apply -f -
apiVersion: networking.istio.io/v1
kind: VirtualService
metadata:
  name: service-${i}-vs
  namespace: bookinfo
  labels:
    gevals.kiali.io/test: gevals-testing
spec:
  hosts:
  - "service-${i}.bookinfo.svc.cluster.local"
  http:
  - route:
    - destination:
        host: service-${i}
        port:
          number: 8080
EOF
done

# Create multiple DestinationRules (10)
for i in {1..10}; do
cat <<EOF | kubectl apply -f -
apiVersion: networking.istio.io/v1
kind: DestinationRule
metadata:
  name: service-${i}-dr
  namespace: bookinfo
  labels:
    gevals.kiali.io/test: gevals-testing
spec:
  host: service-${i}.bookinfo.svc.cluster.local
  trafficPolicy:
    connectionPool:
      tcp:
        maxConnections: 100
      http:
        http1MaxPendingRequests: 50
        http2MaxRequests: 100
  subsets:
  - name: v1
    labels:
      version: v1
  - name: v2
    labels:
      version: v2
EOF
done

# Create multiple Gateways (5)
for i in {1..5}; do
cat <<EOF | kubectl apply -f -
apiVersion: networking.istio.io/v1
kind: Gateway
metadata:
  name: gateway-${i}
  namespace: bookinfo
  labels:
    gevals.kiali.io/test: gevals-testing
spec:
  selector:
    istio: ingressgateway
  servers:
  - port:
      number: 80
      name: http
      protocol: HTTP
    hosts:
    - "service-${i}.example.com"
EOF
done

# Create multiple ServiceEntries (5)
for i in {1..5}; do
cat <<EOF | kubectl apply -f -
apiVersion: networking.istio.io/v1
kind: ServiceEntry
metadata:
  name: external-service-${i}
  namespace: bookinfo
  labels:
    gevals.kiali.io/test: gevals-testing
spec:
  hosts:
  - external-${i}.example.com
  ports:
  - number: 443
    name: https
    protocol: HTTPS
  location: MESH_EXTERNAL
  resolution: DNS
EOF
done

# Create one VirtualService with intentional validation error
cat <<'EOF' | kubectl apply -f -
apiVersion: networking.istio.io/v1
kind: VirtualService
metadata:
  name: invalid-vs
  namespace: bookinfo
  labels:
    gevals.kiali.io/test: gevals-testing
spec:
  hosts:
  - "invalid-service"
  gateways:
  - non-existent-gateway
  http:
  - route:
    - destination:
        host: invalid-service
        subset: non-existent-subset
EOF

echo "Created 10 VirtualServices, 10 DestinationRules, 5 Gateways, and 5 ServiceEntries in bookinfo namespace"
