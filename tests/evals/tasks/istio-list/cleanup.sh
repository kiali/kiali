#!/usr/bin/env bash  
set -euo pipefail
NS="bookinfo"
LABEL="gevals.kiali.io/test=gevals-testing"
kubectl delete virtualservice -n "$NS" -l "$LABEL" --ignore-not-found
