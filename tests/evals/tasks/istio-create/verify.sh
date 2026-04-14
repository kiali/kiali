#!/usr/bin/env bash
set -euo pipefail
NS="istio-system"
NAME="my-gateway"
if kubectl get gw "$NAME" -n "$NS" >/dev/null 2>&1; then
  echo "Verified: Gateway '$NAME' exists in namespace '$NS'."
else
  echo "Gateway '$NAME' not found in namespace '$NS'."
  exit 1
fi
