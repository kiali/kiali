#!/bin/bash
##############################################################################
# wait-for-bookinfo.sh
# 
##############################################################################
set -e

oc patch kiali kiali -n kiali-operator --type=json '-p=[{"op": "add", "path": "/spec/deployment/accessible_namespaces/0", "value":"bookinfo"}]'
oc wait --for=condition=Successful kiali/kiali --timeout=120s -n kiali-operator
oc wait --for=condition=Ready pods --all -n bookinfo --timeout 60s || true
oc wait --for=condition=Ready pods --all -n bookinfo --timeout 60s
sleep 80
