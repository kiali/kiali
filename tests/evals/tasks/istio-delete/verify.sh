#!/usr/bin/env bash
NAMESPACE="${EVAL_NAMESPACE:-bookinfo}"
# Fail if any VirtualService still has fault injection (fault.abort or fault.delay).
# The agent may patch the VS to remove the fault block, so the VS can still exist.
vs_with_fault="$(kubectl get virtualservice -n "${NAMESPACE}" -o json \
  | jq -r '[.items[] | select(any(.spec.http[]?; (.fault != null) and ((.fault | has("abort")) or (.fault | has("delay"))))) | .metadata.name] | .[]?' 2>/dev/null || true)"
if [[ -n "${vs_with_fault}" ]]; then
  echo "VirtualService(s) still have fault injection (fault.abort or fault.delay): ${vs_with_fault}"
  exit 1
fi
