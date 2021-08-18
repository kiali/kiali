#/bin/bash

# This enables deployment sidecar injection for Maistra.  The deployments should already exist in the target namespace.

# Given a namepace, prepare the deployments for injection
# This means:
# 1. Annotate all of the namespace's Deployments with the sidecar injection annotation
prepare_maistra() {
  local ns="${1}"

  for d in $(oc get deployments -n ${ns} -o name)
  do
    echo "Enabling sidecar injection for deployment: ${d}"
    oc patch ${d} -n ${ns} -p '{"spec":{"template":{"metadata":{"annotations":{"sidecar.istio.io/inject": "true"}}}}}' --type=merge
  done
}

while [ $# -gt 0 ]; do
  key="$1"
  case $key in
    -h|--help)
      cat <<HELPMSG
Valid command line arguments:
  -n|--namespace <name>: The namespace for which to enable injection on existing deployments. REQUIRED.
  -h|--help: this text
HELPMSG
      exit 1
      ;;
    -n|--namespace)
      NAMESPACE="$2"
      shift;shift
      ;;
    *)
      echo "Unknown argument [$key]. Aborting."
      exit 1
      ;;
  esac
done

IS_MAISTRA=$([ "$(oc get crd | grep servicemesh | wc -l)" -gt "0" ] && echo "true" || echo "false")
  
echo Will enable deployment injection using these settings:
echo IS_MAISTRA=${IS_MAISTRA}
echo NAMESPACE=${NAMESPACE}

[ -z "$NAMESPACE" ] && echo "You must specify --namespace" && exit 1
if [ "${IS_MAISTRA}" != "true" ]; then
  echo "This script only applies to Maistra"
  exit 1
fi

prepare_maistra "${NAMESPACE}"

