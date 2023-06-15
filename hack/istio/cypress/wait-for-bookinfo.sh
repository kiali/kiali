#!/bin/bash
##############################################################################
# wait-for-bookinfo.sh
# 
##############################################################################
set -e

oc wait --for=condition=Successful kiali/kiali --timeout=120s -n kiali-operator
oc wait --for=condition=Ready pods --all -n bookinfo --timeout 60s || true
oc wait --for=condition=Ready pods --all -n bookinfo --timeout 60s
sleep 80
