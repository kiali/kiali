#!/bin/bash

# Install DEMO lab: Istio metric recording rules + sample Federated Prometheus.
#
# For operator integration (real clusters), see:
#   https://kiali.io/docs/configuration/p8s-jaeger-grafana/prometheus/#recording-rules-and-federation
#
# This script patches the Istio add-on Edge Prometheus in istio-system and deploys
# a sample prometheus-federated for learning/CI — not for real clusters.
#
# Usage:
#   ./hack/istio/metric-rules/demo/install.sh [options]
#
# Options:
#   -c CLIENT     kubectl client (default: kubectl)
#   -n NAMESPACE  Istio namespace (default: istio-system)
#   --switch-kiali  Point Kiali at Federated Prometheus after install (default: false)
#   --with-dashboards  Federate optional Perses dashboard metrics (default: false)
#   --with-kiali-metrics  Enable Kiali self-monitoring federation (default: false)
#   --kiali-edge MODE  Kiali edge: istio (shared) or dedicated (default: istio)
#   --edge-retention  Edge Prometheus retention (default: 6h)
#
# Prerequisites:
#   - Istio Prometheus add-on: deployment and configmap named "prometheus" in istio-system
#   - prometheus.yml must include rule_files referencing recording_rules.yml (the add-on
#     ships with rule_files: [/etc/config/recording_rules.yml]; other Prometheus layouts
#     are not supported by this script — merge rules manually for production)
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
      sed -n '3,26p' "$0"
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
err() { echo "Error: $*" >&2; exit 1; }

inf "Checking Edge Prometheus prerequisites..."
if ! ${CLIENT_EXE} get deployment prometheus -n "${ISTIO_NAMESPACE}" &>/dev/null; then
  err "deployment/prometheus not found in ${ISTIO_NAMESPACE}. This script requires the Istio Prometheus add-on."
fi
if ! ${CLIENT_EXE} get configmap prometheus -n "${ISTIO_NAMESPACE}" &>/dev/null; then
  err "configmap/prometheus not found in ${ISTIO_NAMESPACE}."
fi

PROMETHEUS_YML="$(${CLIENT_EXE} get configmap prometheus -n "${ISTIO_NAMESPACE}" \
  -o jsonpath='{.data.prometheus\.yml}' 2>/dev/null || true)"
if [[ -z "${PROMETHEUS_YML}" ]]; then
  err "configmap/prometheus has no prometheus.yml data key."
fi
if ! printf '%s' "${PROMETHEUS_YML}" | python3 -c "
import sys
text = sys.stdin.read()
if 'rule_files' not in text:
    raise SystemExit('missing rule_files')
if 'recording_rules' not in text:
    raise SystemExit('missing recording_rules reference')
"; then
  err "$(cat <<EOF
Edge Prometheus prometheus.yml must include rule_files referencing recording_rules.yml.
The Istio add-on ships with:
  rule_files:
  - /etc/config/recording_rules.yml
This script patches configmap/prometheus data.recording_rules.yml only.
For other Prometheus layouts, merge core-recording-rules.yml manually — see README.md.
EOF
)"
fi
if [[ "$(${CLIENT_EXE} get configmap prometheus -n "${ISTIO_NAMESPACE}" \
  -o go-template='{{if index .data "recording_rules.yml"}}yes{{end}}')" != "yes" ]]; then
  err "configmap/prometheus has no recording_rules.yml data key (required for the add-on mount at /etc/config/recording_rules.yml)."
fi
inf "Edge Prometheus prerequisites OK (rule_files references recording_rules.yml)."

MERGE_ARGS=()
if [[ "${WITH_KIALI_METRICS}" == "true" && "${KIALI_EDGE}" == "istio" ]]; then
  MERGE_ARGS=(--with-kiali)
  inf "Applying Istio + Kiali recording rules to shared edge Prometheus..."
else
  inf "Applying Istio recording rules to edge Prometheus..."
fi

RECORDING_RULES_CONTENT="$(python3 "${SCRIPT_DIR}/merge-recording-rules.py" "${MERGE_ARGS[@]}")"

inf "Patching edge Prometheus configmap (data.recording_rules.yml)..."
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
  inf "Deploying Federated Prometheus (${RENDER_ARGS[*]})..."
else
  inf "Deploying Federated Prometheus (core Kiali federation only)..."
fi
python3 "${SCRIPT_DIR}/render-prometheus-federated.py" "${RENDER_ARGS[@]}" | ${CLIENT_EXE} apply -f -

inf "Restarting prometheus-federated to load updated federation config..."
${CLIENT_EXE} rollout restart deployment/prometheus-federated -n "${ISTIO_NAMESPACE}"

inf "Waiting for prometheus-federated to be ready..."
${CLIENT_EXE} rollout status deployment/prometheus-federated -n "${ISTIO_NAMESPACE}" --timeout=120s

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

inf "Waiting for federation to populate Federated Prometheus (up to 90s)..."
for _ in $(seq 1 18); do
  COUNT=$(${CLIENT_EXE} exec -n "${ISTIO_NAMESPACE}" deploy/prometheus-federated -c prometheus -- \
    wget -qO- 'http://localhost:9090/api/v1/query?query=count(istio_requests_total)' 2>/dev/null \
    | python3 -c "import sys,json; d=json.load(sys.stdin); r=d.get('data',{}).get('result',[]); print(r[0]['value'][1] if r else '0')" 2>/dev/null || echo "0")
  if [[ "${COUNT}" != "0" ]]; then
    inf "Federated Prometheus has ${COUNT} istio_requests_total series (federated + relabeled)"
    break
  fi
  sleep 5
done

if [[ "${WITH_KIALI_METRICS}" == "true" ]]; then
  inf "Waiting for Kiali metrics federation to Federated Prometheus (up to 90s)..."
  for _ in $(seq 1 18); do
    COUNT=$(${CLIENT_EXE} exec -n "${ISTIO_NAMESPACE}" deploy/prometheus-federated -c prometheus -- \
      wget -qO- 'http://localhost:9090/api/v1/query?query=count({__name__=~"kiali_.*"})' 2>/dev/null \
      | python3 -c "import sys,json; d=json.load(sys.stdin); r=d.get('data',{}).get('result',[]); print(r[0]['value'][1] if r else '0')" 2>/dev/null || echo "0")
    if [[ "${COUNT}" != "0" ]]; then
      inf "Federated Prometheus has ${COUNT} kiali_* series (federated + relabeled)"
      break
    fi
    sleep 5
  done
fi

if [[ "${SWITCH_KIALI}" == "true" ]]; then
  inf "Pointing Kiali at prometheus-federated..."
  ${SCRIPT_DIR}/switch-kiali-prometheus.sh -c "${CLIENT_EXE}" -n "${ISTIO_NAMESPACE}" prometheus-federated
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

Federated Prometheus (long retention; Kiali query target):
  kubectl port-forward -n ${ISTIO_NAMESPACE} svc/prometheus-federated 9092:9090
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

  # Federated: istio_* relabeled (no workload: prefix)
  curl -s 'http://localhost:9092/api/v1/query?query=count(istio_requests_total)'

  # Compare rates
  curl -s 'http://localhost:9091/api/v1/query?query=sum(rate(workload:istio_requests_total[5m]))'
  curl -s 'http://localhost:9092/api/v1/query?query=sum(rate(istio_requests_total[5m]))'
EOF

if [[ "${WITH_KIALI_METRICS}" == "true" ]]; then
  cat <<EOF

  # Kiali metrics on Federated Prometheus (no kiali: prefix)
  curl -s 'http://localhost:9092/api/v1/query?query=count({__name__=~"kiali_.*"})'
EOF
fi

cat <<EOF

To point Kiali at Federated Prometheus:
  ${SCRIPT_DIR}/switch-kiali-prometheus.sh prometheus-federated

Or manually set external_services.prometheus.url to:
  http://prometheus-federated.${ISTIO_NAMESPACE}:9090

EOF
