#!/bin/bash

# Install DEMO lab: Istio metric recording rules + sample production federator.
#
# For production, see:
#   https://kiali.io/docs/configuration/p8s-jaeger-grafana/prometheus/#recording-rules-and-federation
#
# This script patches the Istio add-on Prometheus in istio-system and deploys
# a sample prometheus-prod for learning/CI — not for real clusters.
#
# Usage:
#   ./hack/istio/metric-rules/install.sh [options]
#
# Options:
#   -c CLIENT     kubectl client (default: kubectl)
#   -n NAMESPACE  Istio namespace (default: istio-system)
#   --switch-kiali  Point Kiali at prometheus-prod after install (default: false)
#   --with-dashboards  Federate optional Perses dashboard metrics (default: false)
#   --edge-retention  Edge Prometheus retention (default: 6h)
#
# Prerequisites:
#   - Edge Prometheus deployment named "prometheus" in istio-system
#   - bookinfo or other demo apps generating istio_* metrics

set -euo pipefail

CLIENT_EXE="${CLIENT_EXE:-kubectl}"
ISTIO_NAMESPACE="${ISTIO_NAMESPACE:-istio-system}"
SWITCH_KIALI=false
WITH_DASHBOARDS=false
EDGE_RETENTION="6h"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

while [[ $# -gt 0 ]]; do
  case "$1" in
    -c) CLIENT_EXE="$2"; shift 2 ;;
    -n) ISTIO_NAMESPACE="$2"; shift 2 ;;
    --switch-kiali) SWITCH_KIALI=true; shift ;;
    --with-dashboards) WITH_DASHBOARDS=true; shift ;;
    --edge-retention) EDGE_RETENTION="$2"; shift 2 ;;
    -h|--help)
      sed -n '3,18p' "$0"
      exit 0
      ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

inf() { echo "[$(date +'%H:%M:%S')] $*"; }

inf "Applying recording rules to edge Prometheus configmap..."
${CLIENT_EXE} create configmap prometheus-recording-rules \
  --from-file=recording_rules.yml="${SCRIPT_DIR}/recording-rules.yml" \
  -n "${ISTIO_NAMESPACE}" \
  --dry-run=client -o yaml | ${CLIENT_EXE} apply -f -

# Patch recording_rules.yml into the existing prometheus configmap
${CLIENT_EXE} patch configmap prometheus -n "${ISTIO_NAMESPACE}" --type merge -p "$(python3 -c "
import json, sys
content = open('${SCRIPT_DIR}/recording-rules.yml').read()
print(json.dumps({'data': {'recording_rules.yml': content}}))
")"

inf "Setting edge Prometheus retention to ${EDGE_RETENTION}..."
${CLIENT_EXE} patch deployment prometheus -n "${ISTIO_NAMESPACE}" --type='json' \
  -p="[{\"op\": \"replace\", \"path\": \"/spec/template/spec/containers/1/args/0\", \"value\": \"--storage.tsdb.retention.time=${EDGE_RETENTION}\"}]"

if [[ "${WITH_DASHBOARDS}" == "true" ]]; then
  inf "Deploying production Prometheus (core + Perses dashboard federation)..."
  RENDER_ARGS=(--with-dashboards)
else
  inf "Deploying production Prometheus (core Kiali federation only)..."
  RENDER_ARGS=()
fi
python3 "${SCRIPT_DIR}/render-prometheus-prod.py" "${RENDER_ARGS[@]}" | ${CLIENT_EXE} apply -f -

inf "Waiting for prometheus-prod to be ready..."
${CLIENT_EXE} rollout status deployment/prometheus-prod -n "${ISTIO_NAMESPACE}" --timeout=120s

inf "Waiting for recording rules to produce workload:* series (up to 90s)..."
for _ in $(seq 1 18); do
  COUNT=$(${CLIENT_EXE} exec -n "${ISTIO_NAMESPACE}" deploy/prometheus -c prometheus-server -- \
    wget -qO- 'http://localhost:9090/api/v1/query?query=count({__name__=~"workload:istio_requests_total"})' 2>/dev/null \
    | python3 -c "import sys,json; d=json.load(sys.stdin); r=d.get('data',{}).get('result',[]); print(r[0]['value'][1] if r else '0')" 2>/dev/null || echo "0")
  if [[ "${COUNT}" != "0" ]]; then
    inf "Edge Prometheus has ${COUNT} workload:istio_requests_total series"
    break
  fi
  sleep 5
done

inf "Waiting for federation to populate production Prometheus (up to 90s)..."
for _ in $(seq 1 18); do
  COUNT=$(${CLIENT_EXE} exec -n "${ISTIO_NAMESPACE}" deploy/prometheus-prod -c prometheus -- \
    wget -qO- 'http://localhost:9090/api/v1/query?query=count(istio_requests_total)' 2>/dev/null \
    | python3 -c "import sys,json; d=json.load(sys.stdin); r=d.get('data',{}).get('result',[]); print(r[0]['value'][1] if r else '0')" 2>/dev/null || echo "0")
  if [[ "${COUNT}" != "0" ]]; then
    inf "Production Prometheus has ${COUNT} istio_requests_total series (federated + relabeled)"
    break
  fi
  sleep 5
done

if [[ "${SWITCH_KIALI}" == "true" ]]; then
  inf "Pointing Kiali at prometheus-prod..."
  ${SCRIPT_DIR}/switch-kiali-prometheus.sh -c "${CLIENT_EXE}" -n "${ISTIO_NAMESPACE}" prometheus-prod
fi

cat <<EOF

Install complete.
Federation tier: $([[ "${WITH_DASHBOARDS}" == "true" ]] && echo "core + Perses dashboards" || echo "core (Kiali) only")

Edge Prometheus (recording rules, short retention):
  kubectl port-forward -n ${ISTIO_NAMESPACE} svc/prometheus 9091:9090

Production Prometheus (federated aggregates, relabeled names):
  kubectl port-forward -n ${ISTIO_NAMESPACE} svc/prometheus-prod 9092:9090

Verify:
  # Edge: workload:* exists
  curl -s 'http://localhost:9091/api/v1/query?query=count(workload:istio_requests_total)'

  # Production: istio_* federated (no workload: prefix)
  curl -s 'http://localhost:9092/api/v1/query?query=count(istio_requests_total)'

  # Compare rates
  curl -s 'http://localhost:9091/api/v1/query?query=sum(rate(workload:istio_requests_total[5m]))'
  curl -s 'http://localhost:9092/api/v1/query?query=sum(rate(istio_requests_total[5m]))'

To point Kiali at production Prometheus:
  ${SCRIPT_DIR}/switch-kiali-prometheus.sh --switch-kiali

Or manually set external_services.prometheus.url to:
  http://prometheus-prod.${ISTIO_NAMESPACE}:9090

EOF
