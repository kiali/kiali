#!/bin/bash

set -e

SCRIPT_DIR="$(cd $(dirname "${BASH_SOURCE[0]}") && pwd)"
source ${SCRIPT_DIR}/env.sh $*

# This script combines traces from the west cluster into the east cluster by sending traces through the istio-ingressgateway.
# It deploys an otel collector into the west cluster which gathers all traces and exports them to the east cluster.
# It opens a separate port on the istio-ingressgateway for zipkin so that the tracing setup doesn't conflict with
# the bookinfo gateway/traffic.

# This adds a port to the istio-ingressgateway service. This could probably be done through istioctl and passing the right combination
# of settings into the istioctl hack script but it's way simpler to just patch the service directly.
ingress_output=$(${CLIENT_EXE} get svc -n istio-system --context "${CLUSTER1_CONTEXT}" istio-ingressgateway -o jsonpath='{.spec.ports[?(@.name=="zipkin-http")]}')
# Check if the output is empty
if [ -z "$ingress_output" ]; then
    ${CLIENT_EXE} --context "${CLUSTER1_CONTEXT}" patch Service -n istio-system istio-ingressgateway --type=json -p '[{"op": "add", "path": "/spec/ports/-", "value": {"name": "zipkin-http", "port": 9411, "protocol": "TCP", "targetPort": 8080}}]'
fi

${CLIENT_EXE} --context "${CLUSTER1_CONTEXT}" apply -f - <<EOF
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: zipkin-ingress
  namespace: istio-system
spec:
  gateways:
  - zipkin-gateway
  hosts:
  - '*'
  http:
  - name: zipkin-route
    route:
    - destination:
        host: zipkin.istio-system.svc.cluster.local
        port:
          number: 9411
EOF

${CLIENT_EXE} --context "${CLUSTER1_CONTEXT}" apply -f - <<EOF
apiVersion: networking.istio.io/v1beta1
kind: Gateway
metadata:
  name: zipkin-gateway
  namespace: istio-system
spec:
  selector:
    istio: ingressgateway
  servers:
  - hosts:
    - '*'
    port:
      name: http
      number: 9411
      protocol: HTTP
EOF

ISTIO_INGRESS_IP=$(${CLIENT_EXE} --context "${CLUSTER1_CONTEXT}" get service -n istio-system istio-ingressgateway -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
helm repo add open-telemetry https://open-telemetry.github.io/opentelemetry-helm-charts
# Disable everything except zipkin. We can't rename the service so disable that too and create one ourselves.
helm --kube-context "${CLUSTER2_CONTEXT}" upgrade --install --namespace istio-system my-opentelemetry-collector open-telemetry/opentelemetry-collector -f - <<EOF
mode: deployment
service:
  enabled: false
image:
  repository: "otel/opentelemetry-collector-contrib"
config:
  exporters:
    logging: {}
    zipkin:
      endpoint: http://${ISTIO_INGRESS_IP}:9411/api/v2/spans
      tls:
        insecure: true
  receivers:
    jaeger: null
    prometheus: null
    otlp: null
    zipkin:
      endpoint: 0.0.0.0:9411
  service:
    pipelines:
      traces:
        receivers:
          - zipkin
        processors:
          - memory_limiter
          - batch
        exporters:
          - logging
          - zipkin
      metrics: null
      logs: null
ports:
  jaeger-compact:
    enabled: false
  jaeger-thrift:
    enabled: false
  jaeger-grpc:
    enabled: false
  otlp:
    enabled: false
  otlp-http:
    enabled: false
EOF

# Create a service for the collector named zipkin.istio-system to
# make it consistent with the normal istio tracing service.
${CLIENT_EXE} --context "${CLUSTER2_CONTEXT}" apply -f - <<EOF
apiVersion: v1
kind: Service
metadata:
  name: zipkin
  namespace: istio-system
spec:
  selector:
    app.kubernetes.io/name: opentelemetry-collector
  ports:
    - name: zipkin-port
      protocol: TCP
      port: 9411
      targetPort: 9411
EOF
