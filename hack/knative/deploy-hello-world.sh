#!/bin/bash -e

NAMESPACE=${NAMESPACE:-knative-examples}
ROOT="$( cd "$(dirname "$0")" ; pwd -P )"

istiooc delete -n $NAMESPACE -f $ROOT/service.yaml || true
istiooc apply -n $NAMESPACE -f $ROOT/service.yaml
