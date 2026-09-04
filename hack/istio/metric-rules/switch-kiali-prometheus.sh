#!/bin/bash

# Switch Kiali prometheus.url between edge and production Prometheus instances.

set -euo pipefail

CLIENT_EXE="${CLIENT_EXE:-kubectl}"
ISTIO_NAMESPACE="${ISTIO_NAMESPACE:-istio-system}"
TARGET="prometheus-prod"

while [[ $# -gt 0 ]]; do
  case "$1" in
    -c) CLIENT_EXE="$2"; shift 2 ;;
    -n) ISTIO_NAMESPACE="$2"; shift 2 ;;
    prometheus|prometheus-prod|edge|prod) TARGET="$1"; shift ;;
    -h|--help)
      echo "Usage: $0 [-c kubectl] [-n istio-system] [prometheus|prometheus-prod]"
      exit 0
      ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

case "${TARGET}" in
  prometheus|edge) SERVICE="prometheus" ;;
  prometheus-prod|prod) SERVICE="prometheus-prod" ;;
  *) echo "Unknown target: ${TARGET}"; exit 1 ;;
esac

URL="http://${SERVICE}.${ISTIO_NAMESPACE}:9090"

${CLIENT_EXE} get configmap kiali -n "${ISTIO_NAMESPACE}" -o yaml \
  | sed "s|url: http://prometheus[^[:space:]]*|url: ${URL}|" \
  | ${CLIENT_EXE} apply -f -

${CLIENT_EXE} rollout restart deployment/kiali -n "${ISTIO_NAMESPACE}"
${CLIENT_EXE} rollout status deployment/kiali -n "${ISTIO_NAMESPACE}" --timeout=120s

echo "Kiali prometheus.url set to ${URL}"
