#!/bin/bash

# Remove demo Federated Prometheus and restore Edge Prometheus recording rules to empty.
#
# Deletes demo deployments by label (not static YAML paths) because install.sh renders
# ConfigMap data dynamically via render-prometheus-federated.py.

set -euo pipefail

CLIENT_EXE="${CLIENT_EXE:-kubectl}"
ISTIO_NAMESPACE="${ISTIO_NAMESPACE:-istio-system}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    -c) CLIENT_EXE="$2"; shift 2 ;;
    -n) ISTIO_NAMESPACE="$2"; shift 2 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

delete_demo_stack() {
  local app_label="$1"
  echo "Removing ${app_label} (deployment, service, configmap)..."
  ${CLIENT_EXE} delete deployment,service,configmap \
    -n "${ISTIO_NAMESPACE}" \
    -l "app=${app_label}" \
    --ignore-not-found
}

delete_demo_stack prometheus-federated
delete_demo_stack prometheus-kiali-edge

echo "Removing legacy prometheus-recording-rules configmap (unused by current install)..."
${CLIENT_EXE} delete configmap prometheus-recording-rules -n "${ISTIO_NAMESPACE}" --ignore-not-found

echo "Clearing edge recording rules..."
${CLIENT_EXE} patch configmap prometheus -n "${ISTIO_NAMESPACE}" --type merge -p '{"data":{"recording_rules.yml":"{}\n"}}'

echo "Restoring edge retention to 15d..."
${CLIENT_EXE} patch deployment prometheus -n "${ISTIO_NAMESPACE}" --type='json' \
  -p='[{"op": "replace", "path": "/spec/template/spec/containers/1/args/0", "value": "--storage.tsdb.retention.time=15d"}]' \
  2>/dev/null || true

echo "Done. Switch Kiali back to Edge Prometheus if needed:"
echo "  $(dirname "$0")/switch-kiali-prometheus.sh prometheus"
