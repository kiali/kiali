#!/usr/bin/env bash
set -euo pipefail
NS="bookinfo"
LABEL="gevals.kiali.io/test=gevals-testing"
NAME="reviews"

if ! command -v jq >/dev/null 2>&1; then
  echo "jq is required for verification"
  exit 1
fi

# Fetch the VirtualService by label and name
vs_json="$(kubectl get virtualservice -n "$NS" -l "$LABEL" -o json)"
found="$(echo "$vs_json" | jq -r --arg name "$NAME" '.items[]? | select(.metadata.name==$name) | .metadata.name' | head -n1)"
if [[ "$found" != "$NAME" ]]; then
  echo "VirtualService '$NAME' with label '$LABEL' not found in namespace '$NS'"
  exit 1
fi

# Verify there is a route to subset v2 with weight 50
ok="$(echo "$vs_json" | jq -e --arg name "$NAME" '
  .items[]? | select(.metadata.name==$name)
  | any(.spec.http[]?.route[]?; (.destination.subset=="v2") and ((.weight // 0) == 50))
' >/dev/null && echo yes || echo no)"

if [[ "$ok" != "yes" ]]; then
  echo "VirtualService '$NAME' does not route subset v2 with weight 50"
  echo "Current routes:"
  echo "$vs_json" | jq -r --arg name "$NAME" '
    .items[]? | select(.metadata.name==$name)
    | .spec.http[]?.route[]? | {subset: .destination.subset, weight: .weight}
  '
  exit 1
fi
echo "Verified: VirtualService '$NAME' routes subset v2 with weight 50."
