#!/bin/bash

# Switch Kiali prometheus.url between Edge and Federated Prometheus instances.

set -euo pipefail

CLIENT_EXE="${CLIENT_EXE:-kubectl}"
ISTIO_NAMESPACE="${ISTIO_NAMESPACE:-istio-system}"
TARGET="prometheus-federated"

while [[ $# -gt 0 ]]; do
  case "$1" in
    -c) CLIENT_EXE="$2"; shift 2 ;;
    -n) ISTIO_NAMESPACE="$2"; shift 2 ;;
    prometheus|edge) TARGET="prometheus"; shift ;;
    prometheus-federated|federated) TARGET="prometheus-federated"; shift ;;
    -h|--help)
      echo "Usage: $0 [-c kubectl] [-n istio-system] [prometheus|prometheus-federated]"
      exit 0
      ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

case "${TARGET}" in
  prometheus) SERVICE="prometheus" ;;
  prometheus-federated) SERVICE="prometheus-federated" ;;
  *) echo "Unknown target: ${TARGET}"; exit 1 ;;
esac

URL="http://${SERVICE}.${ISTIO_NAMESPACE}:9090"

${CLIENT_EXE} get configmap kiali -n "${ISTIO_NAMESPACE}" -o yaml \
  | sed "s|url: http://prometheus[^[:space:]]*|url: ${URL}|" \
  | ${CLIENT_EXE} apply -f -

${CLIENT_EXE} rollout restart deployment/kiali -n "${ISTIO_NAMESPACE}"
${CLIENT_EXE} rollout status deployment/kiali -n "${ISTIO_NAMESPACE}" --timeout=120s

echo "Kiali prometheus.url set to ${URL}"
