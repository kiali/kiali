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

set -u

while [[ $# -gt 0 ]]; do
  key="$1"
  case $key in
    -kc|--kubernetes-context)  K8S_CONTEXT="$2";   shift;shift ;;
    -lp|--local-port)          LOCAL_PORT="$2";    shift;shift ;;
    -rp|--remote-port)         REMOTE_PORT="$2";   shift;shift ;;
    -h|--help )
      cat <<HELPMSG
$0 [option...]
Valid options:
  -kc|--kubernetes-context
      The kubectl context to use when connecting to the k8s cluster.
      Default: the current kubectl context
  -lp|--local-port
      The local port the proxy will listen to.
      Your local machine must not have anything bound to this port.
      Default: 20001
  -rp|--remote-port
      The remote port to forward to. This is the port Kiali is listening to.
      Default: 20001
HELPMSG
      exit 1
      ;;
    *)
      echo "ERROR: Unknown argument [$key]. Aborting."
      exit 1
      ;;
  esac
done

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
LOCAL_PORT=${LOCAL_PORT:-20001}
REMOTE_PORT=${REMOTE_PORT:-20001}

# optionally takes a single argument - a kube context name (e.g. "kind-east" or "minikube")
CONTEXT_ARG=""
if [ "${K8S_CONTEXT:-}" != "" ]; then
  echo "Using context: ${K8S_CONTEXT}"
  CONTEXT_ARG="--context ${K8S_CONTEXT}"
else
  echo "Using current context: $(${CLIENT_EXE} config current-context)"
fi

echo "Forwarding local port [${LOCAL_PORT}] to Kiali server port [${REMOTE_PORT}]. This runs in foreground, press Control-C to kill it."
echo "To access Kiali, point your browser to http://localhost:${LOCAL_PORT}/kiali/console"

${CLIENT_EXE} ${CONTEXT_ARG} -n ${ISTIO_NAMESPACE} port-forward $(${CLIENT_EXE} ${CONTEXT_ARG} -n ${ISTIO_NAMESPACE} get pod -l app.kubernetes.io/name=kiali -o jsonpath='{.items[0].metadata.name}') ${LOCAL_PORT}:${REMOTE_PORT}

