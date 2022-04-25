#!/bin/bash

# This deploys the error rates demo

# Given a namepace, prepare it for inclusion in Maistra's control plane
# This means:
# 1. Create a SMM
# 2. Annotate all of the namespace's Deployments with the sidecar injection annotation if enabled
prepare_maistra() {
  local ns="${1}"

  cat <<EOM | ${CLIENT_EXE} apply -f -
apiVersion: maistra.io/v1
kind: ServiceMeshMember
metadata:
  name: default
  namespace: ${ns}
spec:
  controlPlaneRef:
    namespace: ${ISTIO_NAMESPACE}
    name: "$(${CLIENT_EXE} get smcp -n ${ISTIO_NAMESPACE} -o jsonpath='{.items[0].metadata.name}' )"
EOM

  if [ "${ENABLE_INJECTION}" == "true" ]; then
    for d in $(${CLIENT_EXE} get deployments -n ${ns} -o name)
    do
      echo "Enabling sidecar injection for deployment: ${d}"
      ${CLIENT_EXE} patch ${d} -n ${ns} -p '{"spec":{"template":{"metadata":{"annotations":{"sidecar.istio.io/inject": "true"}}}}}' --type=merge
    done
  fi
}

: ${CLIENT_EXE:=oc}
: ${DELETE_DEMO:=false}
: ${ENABLE_INJECTION:=true}
: ${ISTIO_NAMESPACE:=istio-system}
: ${NAMESPACE_ALPHA:=alpha}
: ${NAMESPACE_BETA:=beta}
: ${SOURCE:="https://raw.githubusercontent.com/kiali/demos/master"}

while [ $# -gt 0 ]; do
  key="$1"
  case $key in
    -c|--client)
      CLIENT_EXE="$2"
      shift;shift
      ;;
    -d|--delete)
      DELETE_DEMO="$2"
      shift;shift
      ;;
    -ei|--enable-injection)
      ENABLE_INJECTION="$2"
      shift;shift
      ;;
    -in|--istio-namespace)
      ISTIO_NAMESPACE="$2"
      shift;shift
      ;;
    -h|--help)
      cat <<HELPMSG
Valid command line arguments:
  -c|--client: either 'oc' or 'kubectl'
  -d|--delete: either 'true' or 'false'. If 'true' the demo will be deleted, not installed.
  -ei|--enable-injection: either 'true' or 'false' (default is true). If 'true' auto-inject proxies for the workloads.
  -in|--istio-namespace <name>: Where the Istio control plane is installed (default: istio-system).
  -h|--help: this text
  -s|--source: demo file source. For example: file:///home/me/demos Default: https://raw.githubusercontent.com/kiali/demos/master
HELPMSG
      exit 1
      ;;
    -s|--source)
      SOURCE="$2"
      shift;shift
      ;;
    *)
      echo "Unknown argument [$key]. Aborting."
      exit 1
      ;;
  esac
done

echo Will deploy Error Rates Demo using these settings:
echo CLIENT_EXE=${CLIENT_EXE}
echo DELETE_DEMO=${DELETE_DEMO}
echo ENABLE_INJECTION=${ENABLE_INJECTION}
echo ISTIO_NAMESPACE=${ISTIO_NAMESPACE}
echo NAMESPACE_ALPHA=${NAMESPACE_ALPHA}
echo NAMESPACE_BETA=${NAMESPACE_BETA}
echo SOURCE=${SOURCE}

IS_OPENSHIFT="false"
IS_MAISTRA="false"
if [[ "${CLIENT_EXE}" = *"oc" ]]; then
  IS_OPENSHIFT="true"
  IS_MAISTRA=$([ "$(oc get crd | grep servicemesh | wc -l)" -gt "0" ] && echo "true" || echo "false")
fi

echo "IS_OPENSHIFT=${IS_OPENSHIFT}"
echo "IS_MAISTRA=${IS_MAISTRA}"

# If we are to delete, remove everything and exit immediately after
if [ "${DELETE_DEMO}" == "true" ]; then
  echo "Deleting Error Rates Demo (the envoy filters, if previously created, will remain)"
  if [ "${IS_OPENSHIFT}" == "true" ]; then
    if [ "${IS_MAISTRA}" != "true" ]; then
      $CLIENT_EXE delete network-attachment-definition istio-cni -n ${NAMESPACE_ALPHA}
      $CLIENT_EXE delete network-attachment-definition istio-cni -n ${NAMESPACE_BETA}
    else
      $CLIENT_EXE delete smm default -n ${NAMESPACE_ALPHA}
      $CLIENT_EXE delete smm default -n ${NAMESPACE_BETA}
    fi
    $CLIENT_EXE delete scc error-rates-scc
  fi
  ${CLIENT_EXE} delete namespace ${NAMESPACE_ALPHA}
  ${CLIENT_EXE} delete namespace ${NAMESPACE_BETA}
  exit 0
fi

# Create and prepare the demo namespaces

if [ "${IS_OPENSHIFT}" == "true" ]; then
  $CLIENT_EXE new-project ${NAMESPACE_ALPHA}
  $CLIENT_EXE new-project ${NAMESPACE_BETA}
else
  $CLIENT_EXE create namespace ${NAMESPACE_ALPHA}
  $CLIENT_EXE create namespace ${NAMESPACE_BETA}
fi

if [ "${ENABLE_INJECTION}" == "true" ]; then
  ${CLIENT_EXE} label namespace ${NAMESPACE_ALPHA} istio-injection=enabled
  ${CLIENT_EXE} label namespace ${NAMESPACE_BETA} istio-injection=enabled
fi

# Deploy the demo

${CLIENT_EXE} apply -f <(curl -L "${SOURCE}/error-rates/alpha.yaml") -n ${NAMESPACE_ALPHA}
${CLIENT_EXE} apply -f <(curl -L "${SOURCE}/error-rates/beta.yaml") -n ${NAMESPACE_BETA}

if [ "${IS_MAISTRA}" == "true" ]; then
  prepare_maistra "${NAMESPACE_ALPHA}"
  prepare_maistra "${NAMESPACE_BETA}"
fi

if [ "${IS_OPENSHIFT}" == "true" ]; then
  if [ "${IS_MAISTRA}" != "true" ]; then
    cat <<NAD | $CLIENT_EXE -n ${NAMESPACE_ALPHA} create -f -
apiVersion: "k8s.cni.cncf.io/v1"
kind: NetworkAttachmentDefinition
metadata:
  name: istio-cni
NAD
    cat <<NAD | $CLIENT_EXE -n ${NAMESPACE_BETA} create -f -
apiVersion: "k8s.cni.cncf.io/v1"
kind: NetworkAttachmentDefinition
metadata:
  name: istio-cni
NAD
  fi
  cat <<SCC | $CLIENT_EXE apply -f -
apiVersion: security.openshift.io/v1
kind: SecurityContextConstraints
metadata:
  name: error-rates-scc
runAsUser:
  type: RunAsAny
seLinuxContext:
  type: RunAsAny
supplementalGroups:
  type: RunAsAny
users:
- "system:serviceaccount:${NAMESPACE_ALPHA}:default"
- "system:serviceaccount:${NAMESPACE_BETA}:default"
SCC
fi
