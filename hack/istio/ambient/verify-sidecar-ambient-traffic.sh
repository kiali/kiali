#!/bin/bash
##############################################################################
# verify-sidecar-ambient-traffic.sh
#
# Diagnostics for the test-sidecar <-> test-ambient demo: topology readiness,
# application-level HTTP, and Prometheus L4 vs L7 telemetry on each path.
#
##############################################################################

AMBIENT_NS="test-ambient"
CLIENT_EXE="kubectl"
ISTIO_NAMESPACE="istio-system"
SIDECAR_NS="test-sidecar"

while [ $# -gt 0 ]; do
  key="$1"
  case $key in
    -c|--client)
      CLIENT_EXE="$2"
      shift;shift
      ;;
    -h|--help)
      cat <<HELPMSG
Valid command line arguments:
  -c|--client: either 'oc' or 'kubectl'
  -h|--help: this text
HELPMSG
      exit 1
      ;;
    *)
      echo "Unknown argument [$key]. Aborting."
      exit 1
      ;;
  esac
done

CLIENT_EXE=$(which "${CLIENT_EXE}" 2>/dev/null) || true
if [ -z "${CLIENT_EXE}" ]; then
  echo "ERROR: cluster client not found in PATH"
  exit 1
fi

section() {
  echo ""
  echo "=== ${1} ==="
}

subsection() {
  echo "-- ${1}"
}

run_client() {
  ${CLIENT_EXE} "$@"
}

prometheus_query() {
  local encoded_query="$1"
  local label="$2"
  subsection "${label}"
  if ! run_client get deployment prometheus -n "${ISTIO_NAMESPACE}" &>/dev/null; then
    echo "prometheus deployment not found in ${ISTIO_NAMESPACE}"
    return 0
  fi
  local payload
  payload=$(run_client exec -n "${ISTIO_NAMESPACE}" deploy/prometheus -- \
    wget -qO- "http://127.0.0.1:9090/api/v1/query?query=${encoded_query}" 2>/dev/null || true)
  if [ -z "${payload}" ]; then
    echo "query failed or returned empty"
    return 0
  fi
  if ! echo "${payload}" | jq -e '.data.result | length > 0' >/dev/null 2>&1; then
    echo "no series (rate may be 0 or labels do not match yet)"
    echo "${payload}" | jq -c '.data.result' 2>/dev/null || echo "${payload}"
    return 0
  fi
  echo "${payload}" | jq -r '.data.result[] | "\(.metric | to_entries | map("\(.key)=\(.value)") | join(",")) rate=\(.value[1])"' 2>/dev/null \
    || echo "${payload}"
}

section "Sidecar↔ambient topology"
subsection "Namespace labels"
run_client get ns "${SIDECAR_NS}" -o jsonpath='test-sidecar labels: {.metadata.labels}{"\n"}' 2>/dev/null \
  || echo "namespace ${SIDECAR_NS} missing"
run_client get ns "${AMBIENT_NS}" -o jsonpath='test-ambient labels: {.metadata.labels}{"\n"}' 2>/dev/null \
  || echo "namespace ${AMBIENT_NS} missing"

subsection "Deployments"
run_client get deploy -n "${SIDECAR_NS}" 2>/dev/null || true
run_client get deploy -n "${AMBIENT_NS}" 2>/dev/null || true

subsection "Pods"
run_client get pods -n "${SIDECAR_NS}" -o wide 2>/dev/null || true
run_client get pods -n "${AMBIENT_NS}" -o wide 2>/dev/null || true

subsection "Ambient enrollment (ambient.istio.io/redirection on curl-client)"
run_client get pod -n "${AMBIENT_NS}" -l app=curl-client \
  -o jsonpath='{range .items[*]}{.metadata.name}{" redirection="}{.metadata.annotations.ambient\.istio\.io/redirection}{" containers="}{.spec.containers[*].name}{"\n"}{end}' 2>/dev/null \
  || echo "ambient curl-client pod not found"

subsection "Sidecar injection (istio-proxy container on echo-server)"
run_client get pod -n "${SIDECAR_NS}" -l app=echo-server \
  -o jsonpath='{range .items[*]}{.metadata.name}{" containers="}{.spec.containers[*].name}{" proxy-ready="}{.status.containerStatuses[?(@.name=="istio-proxy")].ready}{"\n"}{end}' 2>/dev/null \
  || echo "sidecar echo-server pod not found"

subsection "echo-service ports (name + appProtocol)"
run_client get svc echo-service -n "${SIDECAR_NS}" -o jsonpath='test-sidecar echo-service ports: {.spec.ports}{"\n"}' 2>/dev/null \
  || echo "test-sidecar echo-service missing"
run_client get svc echo-service -n "${AMBIENT_NS}" -o jsonpath='test-ambient echo-service ports: {.spec.ports}{"\n"}' 2>/dev/null \
  || echo "test-ambient echo-service missing"

subsection "Endpoints"
run_client get endpoints echo-service -n "${SIDECAR_NS}" 2>/dev/null || true
run_client get endpoints echo-service -n "${AMBIENT_NS}" 2>/dev/null || true

subsection "Istio ambient components"
run_client get daemonset -n "${ISTIO_NAMESPACE}" -l app=ztunnel 2>/dev/null || \
  run_client get daemonset ztunnel -n "${ISTIO_NAMESPACE}" 2>/dev/null || \
  echo "ztunnel daemonset not found"
run_client get mutatingwebhookconfiguration -o name 2>/dev/null | grep -E 'sidecar-injector|istio-revision' || \
  echo "sidecar injector webhook not found"

if command -v istioctl >/dev/null 2>&1; then
  subsection "istioctl ztunnel workloads (test-ambient)"
  istioctl ztunnel-config workload -n "${AMBIENT_NS}" 2>/dev/null | head -20 || \
    echo "istioctl ztunnel-config workload failed"
fi

section "HTTP application checks (curl from client pods)"
subsection "ambient curl-client -> echo-service.test-sidecar (missing graph HTTP hops)"
run_client exec -n "${AMBIENT_NS}" deploy/curl-client -c curl-client -- \
  curl -sv --max-time 15 "http://echo-service.${SIDECAR_NS}/" 2>&1 | head -30 \
  || echo "exec/curl failed for ambient -> sidecar"

subsection "sidecar curl-client -> echo-service.test-ambient (graph HTTP hops present)"
run_client exec -n "${SIDECAR_NS}" deploy/curl-client -c curl-client -- \
  curl -sv --max-time 15 "http://echo-service.${AMBIENT_NS}/" 2>&1 | head -20 \
  || echo "exec/curl failed for sidecar -> ambient"

subsection "echo-server application logs (test-sidecar, last requests)"
run_client logs -n "${SIDECAR_NS}" deploy/echo-server -c echo-server --tail=15 2>/dev/null \
  || echo "echo-server logs unavailable"

subsection "curl-client generator logs"
run_client logs -n "${AMBIENT_NS}" -l app=curl-client --tail=10 2>/dev/null || true
run_client logs -n "${SIDECAR_NS}" -l app=curl-client --tail=10 2>/dev/null || true

section "Prometheus L4 vs L7 (istio-system/prometheus)"
# URL-encoded instant queries (5m rate window).
prometheus_query \
  'sum(rate(istio_tcp_sent_bytes_total%7Bsource_workload_namespace%3D%22test-ambient%22%2Csource_workload%3D%22curl-client%22%2Cdestination_service_namespace%3D%22test-sidecar%22%7D%5B5m%5D))' \
  "TCP bytes ambient->sidecar (ztunnel/L4 path)"
prometheus_query \
  'sum%20by%20(request_protocol%2Creporter)%20(rate(istio_requests_total%7Bsource_workload_namespace%3D%22test-ambient%22%2Csource_workload%3D%22curl-client%22%2Cdestination_service_namespace%3D%22test-sidecar%22%7D%5B5m%5D))' \
  "istio_requests_total ambient->sidecar by protocol/reporter"
prometheus_query \
  'sum%20by%20(request_protocol%2Creporter)%20(rate(istio_requests_total%7Bdestination_workload_namespace%3D%22test-sidecar%22%2Cdestination_workload%3D%22echo-server%22%7D%5B5m%5D))' \
  "istio_requests_total inbound to sidecar echo-server by protocol/reporter"
prometheus_query \
  'sum%20by%20(request_protocol%2Creporter)%20(rate(istio_requests_total%7Bsource_workload_namespace%3D%22test-sidecar%22%2Csource_workload%3D%22curl-client%22%2Cdestination_service_namespace%3D%22test-ambient%22%7D%5B5m%5D))' \
  "istio_requests_total sidecar->ambient by protocol/reporter (reference path)"

section "Sidecar proxy stats (echo-server istio-proxy)"
if run_client get deploy echo-server -n "${SIDECAR_NS}" &>/dev/null; then
  run_client exec -n "${SIDECAR_NS}" deploy/echo-server -c istio-proxy -- \
    curl -s localhost:15000/stats 2>/dev/null | grep -E 'listener.*http|downstream_rq|http\.|cluster\.outbound.*echo' | head -25 \
    || echo "istio-proxy stats unavailable"
else
  echo "echo-server deployment missing in ${SIDECAR_NS}"
fi

echo ""
echo "=== Diagnostic complete ==="
