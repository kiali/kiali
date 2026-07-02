#!/usr/bin/env bash
set -euo pipefail

# Delete all resources created by this test
kubectl delete virtualservices,destinationrules,gateways,serviceentries \
  -n bookinfo \
  -l gevals.kiali.io/test=gevals-testing \
  --ignore-not-found=true

echo "Cleaned up comprehensive istio configuration test resources"
