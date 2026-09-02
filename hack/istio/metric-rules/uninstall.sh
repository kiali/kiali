#!/bin/bash

# Remove production Prometheus and restore edge Prometheus recording rules to empty.

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

echo "Removing prometheus-prod..."
${CLIENT_EXE} delete -f "$(dirname "$0")/prometheus-prod.yaml" --ignore-not-found

echo "Removing prometheus-kiali-edge..."
${CLIENT_EXE} delete -f "$(dirname "$0")/prometheus-kiali-edge.yaml" --ignore-not-found

echo "Clearing edge recording rules..."
${CLIENT_EXE} patch configmap prometheus -n "${ISTIO_NAMESPACE}" --type merge -p '{"data":{"recording_rules.yml":"{}\n"}}'

echo "Restoring edge retention to 15d..."
${CLIENT_EXE} patch deployment prometheus -n "${ISTIO_NAMESPACE}" --type='json' \
  -p='[{"op": "replace", "path": "/spec/template/spec/containers/1/args/0", "value": "--storage.tsdb.retention.time=15d"}]' \
  2>/dev/null || true

echo "Done. Switch Kiali back to edge Prometheus if needed:"
echo "  $(dirname "$0")/switch-kiali-prometheus.sh prometheus"
