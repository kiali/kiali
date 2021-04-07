#!/bin/bash

##############################################################################
# kiali-port-forward.sh
#
# This is a convienence script that is useful when Kiali is installed
# in a local Kubernetes cluster such as minikube or kind.
# Once you have a Kiali installed on minikube or kind, use this to access
# the Kiali UI via port-forward.
#
# This assumes you have kubectl or oc in your path.
##############################################################################

if ! which kubectl > /dev/null 2>&1; then
  if ! which oc > /dev/null 2>&1; then
    echo "You must have either kubectl or oc in your PATH"
    exit 1
  else
    CLIENT_EXE="oc"
  fi
else
  CLIENT_EXE="kubectl"
fi

ISTIO_NAMESPACE=${ISTIO_NAMESPACE:-istio-system}
KIALI_PORT=${KIALI_PORT:-20001}

# optionally takes a single argument - a kube context name (e.g. "kind-east" or "minikube")
CONTEXT_ARG=""
if [ "${1}" != "" ]; then
  echo "Using context: ${1}"
  CONTEXT_ARG="--context ${1}"
else
  echo "Using current context: $(${CLIENT_EXE} config current-context)"
fi

echo "Forwarding port ${KIALI_PORT} to the Kiali server. This runs in foreground, press Control-C to kill it."
echo "To access Kiali, point your browser to http://localhost:${KIALI_PORT}/kiali/console"

${CLIENT_EXE} ${CONTEXT_ARG} -n ${ISTIO_NAMESPACE} port-forward $(${CLIENT_EXE} ${CONTEXT_ARG} -n ${ISTIO_NAMESPACE} get pod -l app.kubernetes.io/name=kiali -o jsonpath='{.items[0].metadata.name}') ${KIALI_PORT}:${KIALI_PORT}
