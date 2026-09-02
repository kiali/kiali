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
#   --with-kiali-metrics  Enable Kiali self-monitoring federation (default: false)
#   --kiali-edge MODE  Kiali edge: istio (shared) or dedicated (default: istio)
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
WITH_KIALI_METRICS=false
KIALI_EDGE="istio"
EDGE_RETENTION="6h"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

while [[ $# -gt 0 ]]; do
  case "$1" in
    -c) CLIENT_EXE="$2"; shift 2 ;;
    -n) ISTIO_NAMESPACE="$2"; shift 2 ;;
    --switch-kiali) SWITCH_KIALI=true; shift ;;
    --with-dashboards) WITH_DASHBOARDS=true; shift ;;
    --with-kiali-metrics) WITH_KIALI_METRICS=true; shift ;;
    --kiali-edge)
      KIALI_EDGE="$2"
      if [[ "${KIALI_EDGE}" != "istio" && "${KIALI_EDGE}" != "dedicated" ]]; then
        echo "Invalid --kiali-edge value: ${KIALI_EDGE} (use istio or dedicated)"
        exit 1
      fi
      shift 2
      ;;
    --edge-retention) EDGE_RETENTION="$2"; shift 2 ;;
    -h|--help)
      sed -n '3,22p' "$0"
      exit 0
      ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

if [[ "${KIALI_EDGE}" == "dedicated" && "${WITH_KIALI_METRICS}" != "true" ]]; then
  echo "Error: --kiali-edge=dedicated requires --with-kiali-metrics"
  exit 1
fi

inf() { echo "[$(date +'%H:%M:%S')] $*"; }

MERGE_ARGS=()
if [[ "${WITH_KIALI_METRICS}" == "true" && "${KIALI_EDGE}" == "istio" ]]; then
  MERGE_ARGS=(--with-kiali)
  inf "Applying Istio + Kiali recording rules to shared edge Prometheus..."
else
  inf "Applying Istio recording rules to edge Prometheus..."
fi

RECORDING_RULES_CONTENT="$(python3 "${SCRIPT_DIR}/merge-recording-rules.py" "${MERGE_ARGS[@]}")"

inf "Patching edge Prometheus configmap..."
${CLIENT_EXE} create configmap prometheus-recording-rules \
  --from-file=recording_rules.yml=<(printf '%s\n' "${RECORDING_RULES_CONTENT}") \
  -n "${ISTIO_NAMESPACE}" \
  --dry-run=client -o yaml | ${CLIENT_EXE} apply -f -

${CLIENT_EXE} patch configmap prometheus -n "${ISTIO_NAMESPACE}" --type merge -p "$(python3 -c "
import json, sys
print(json.dumps({'data': {'recording_rules.yml': sys.stdin.read()}}))
" <<< "${RECORDING_RULES_CONTENT}")"

if [[ "${WITH_KIALI_METRICS}" == "true" && "${KIALI_EDGE}" == "dedicated" ]]; then
  inf "Deploying dedicated Kiali edge Prometheus..."
  python3 "${SCRIPT_DIR}/render-prometheus-kiali-edge.py" | ${CLIENT_EXE} apply -f -
  inf "Waiting for prometheus-kiali-edge to be ready..."
  ${CLIENT_EXE} rollout status deployment/prometheus-kiali-edge -n "${ISTIO_NAMESPACE}" --timeout=120s
fi

inf "Setting edge Prometheus retention to ${EDGE_RETENTION}..."
${CLIENT_EXE} patch deployment prometheus -n "${ISTIO_NAMESPACE}" --type='json' \
  -p="[{\"op\": \"replace\", \"path\": \"/spec/template/spec/containers/1/args/0\", \"value\": \"--storage.tsdb.retention.time=${EDGE_RETENTION}\"}]"

RENDER_ARGS=()
if [[ "${WITH_DASHBOARDS}" == "true" ]]; then
  RENDER_ARGS+=(--with-dashboards)
fi
if [[ "${WITH_KIALI_METRICS}" == "true" ]]; then
  RENDER_ARGS+=(--with-kiali-metrics --kiali-edge "${KIALI_EDGE}")
fi

if [[ "${#RENDER_ARGS[@]}" -gt 0 ]]; then
  inf "Deploying production Prometheus (${RENDER_ARGS[*]})..."
else
  inf "Deploying production Prometheus (core Kiali federation only)..."
fi
python3 "${SCRIPT_DIR}/render-prometheus-prod.py" "${RENDER_ARGS[@]}" | ${CLIENT_EXE} apply -f -

inf "Restarting prometheus-prod to load updated federation config..."
${CLIENT_EXE} rollout restart deployment/prometheus-prod -n "${ISTIO_NAMESPACE}"

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

if [[ "${WITH_KIALI_METRICS}" == "true" ]]; then
  if [[ "${KIALI_EDGE}" == "dedicated" ]]; then
    KIALI_EDGE_DEPLOY="prometheus-kiali-edge"
    KIALI_EDGE_CONTAINER="prometheus"
  else
    KIALI_EDGE_DEPLOY="prometheus"
    KIALI_EDGE_CONTAINER="prometheus-server"
  fi
  inf "Waiting for Kiali recording rules on ${KIALI_EDGE_DEPLOY} (up to 90s)..."
  for _ in $(seq 1 18); do
    COUNT=$(${CLIENT_EXE} exec -n "${ISTIO_NAMESPACE}" deploy/"${KIALI_EDGE_DEPLOY}" -c "${KIALI_EDGE_CONTAINER}" -- \
      wget -qO- 'http://localhost:9090/api/v1/query?query=count({__name__=~"kiali:kiali_.*"})' 2>/dev/null \
      | python3 -c "import sys,json; d=json.load(sys.stdin); r=d.get('data',{}).get('result',[]); print(r[0]['value'][1] if r else '0')" 2>/dev/null || echo "0")
    if [[ "${COUNT}" != "0" ]]; then
      inf "${KIALI_EDGE_DEPLOY} has ${COUNT} kiali:kiali_* series"
      break
    fi
    sleep 5
  done
fi

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

if [[ "${WITH_KIALI_METRICS}" == "true" ]]; then
  inf "Waiting for Kiali metrics federation to production (up to 90s)..."
  for _ in $(seq 1 18); do
    COUNT=$(${CLIENT_EXE} exec -n "${ISTIO_NAMESPACE}" deploy/prometheus-prod -c prometheus -- \
      wget -qO- 'http://localhost:9090/api/v1/query?query=count({__name__=~"kiali_.*"})' 2>/dev/null \
      | python3 -c "import sys,json; d=json.load(sys.stdin); r=d.get('data',{}).get('result',[]); print(r[0]['value'][1] if r else '0')" 2>/dev/null || echo "0")
    if [[ "${COUNT}" != "0" ]]; then
      inf "Production Prometheus has ${COUNT} kiali_* series (federated + relabeled)"
      break
    fi
    sleep 5
  done
fi

if [[ "${SWITCH_KIALI}" == "true" ]]; then
  inf "Pointing Kiali at prometheus-prod..."
  ${SCRIPT_DIR}/switch-kiali-prometheus.sh -c "${CLIENT_EXE}" -n "${ISTIO_NAMESPACE}" prometheus-prod
fi

FEDERATION_TIER="core (Kiali) only"
if [[ "${WITH_DASHBOARDS}" == "true" && "${WITH_KIALI_METRICS}" == "true" ]]; then
  FEDERATION_TIER="core + Perses dashboards + Kiali self-monitoring (${KIALI_EDGE} edge)"
elif [[ "${WITH_DASHBOARDS}" == "true" ]]; then
  FEDERATION_TIER="core + Perses dashboards"
elif [[ "${WITH_KIALI_METRICS}" == "true" ]]; then
  FEDERATION_TIER="core + Kiali self-monitoring (${KIALI_EDGE} edge)"
fi

cat <<EOF

Install complete.
Federation tier: ${FEDERATION_TIER}

Edge Prometheus (Istio recording rules, short retention):
  kubectl port-forward -n ${ISTIO_NAMESPACE} svc/prometheus 9091:9090

Production Prometheus (federated aggregates, relabeled names):
  kubectl port-forward -n ${ISTIO_NAMESPACE} svc/prometheus-prod 9092:9090
EOF

if [[ "${WITH_KIALI_METRICS}" == "true" && "${KIALI_EDGE}" == "dedicated" ]]; then
  cat <<EOF

Dedicated Kiali edge Prometheus (kiali recording rules only):
  kubectl port-forward -n ${ISTIO_NAMESPACE} svc/prometheus-kiali-edge 9093:9090
EOF
fi

cat <<EOF

Verify:
  # Edge: workload:* exists
  curl -s 'http://localhost:9091/api/v1/query?query=count(workload:istio_requests_total)'

  # Production: istio_* federated (no workload: prefix)
  curl -s 'http://localhost:9092/api/v1/query?query=count(istio_requests_total)'

  # Compare rates
  curl -s 'http://localhost:9091/api/v1/query?query=sum(rate(workload:istio_requests_total[5m]))'
  curl -s 'http://localhost:9092/api/v1/query?query=sum(rate(istio_requests_total[5m]))'
EOF

if [[ "${WITH_KIALI_METRICS}" == "true" ]]; then
  cat <<EOF

  # Kiali metrics on production (no kiali: prefix)
  curl -s 'http://localhost:9092/api/v1/query?query=count({__name__=~"kiali_.*"})'
EOF
fi

cat <<EOF

To point Kiali at production Prometheus:
  ${SCRIPT_DIR}/switch-kiali-prometheus.sh prometheus-prod

Or manually set external_services.prometheus.url to:
  http://prometheus-prod.${ISTIO_NAMESPACE}:9090

EOF
