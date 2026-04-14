#!/usr/bin/env bash   
set -euo pipefail
# 1. Reset the strategy to default
kubectl patch deployment ratings-v1 -n bookinfo -p '{"spec":{"strategy":{"rollingUpdate":{"maxSurge":"25%","maxUnavailable":"25%"}}}}'

# 2. Fix the image and scale
kubectl set image deployment/ratings-v1 ratings=docker.io/istio/examples-bookinfo-ratings-v1:1.16.2 -n bookinfo
kubectl scale deployment/ratings-v1 --replicas=1 -n bookinfo
sleep 60 # Wait for the resources to be created and health applied
