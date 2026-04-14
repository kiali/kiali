#!/usr/bin/env bash   
kubectl patch deployment details-v1 -n bookinfo -p '{"spec": {"template": {"metadata": {"annotations": {"sidecar.istio.io/inject": "true"}}}}}'
