#!/usr/bin/env bash
set -euo pipefail
kubectl patch deployment ratings-v1 -n bookinfo -p '{"spec":{"strategy":{"rollingUpdate":{"maxSurge":"25%","maxUnavailable":"100%"}}}}'
kubectl set image deployment/ratings-v1 ratings=examples/ratings-v1:non-existent-tag -n bookinfo
kubectl scale deployment/ratings-v1 --replicas=3 -n bookinfo
kubectl rollout restart deployment/ratings-v1 -n bookinfo
sleep 60 # Wait for the resources to be created and health applied
