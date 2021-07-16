#/bin/bash

# This deploys the fraud-detection demo

: ${CLIENT_EXE:=oc}
: ${DELETE_DEMO:=false}
: ${ENABLE_INJECTION:=true}
: ${NAMESPACE:=fraud-detection}
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
    -h|--help)
      cat <<HELPMSG
Valid command line arguments:
  -c|--client: either 'oc' or 'kubectl'
  -d|--delete: either 'true' or 'false'. If 'true' the fraud detection demo will be deleted, not installed.
  -ei|--enable-injection: either 'true' or 'false' (default is true). If 'true' auto-inject proxies for the workloads.
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
echo NAMESPACE=${NAMESPACE}
echo SOURCE=${SOURCE}

IS_OPENSHIFT="false"
IS_MAISTRA="false"
if [[ "${CLIENT_EXE}" = *"oc" ]]; then
  IS_OPENSHIFT="true"
  IS_MAISTRA=$([ "$(oc get crd | grep servicemesh | wc -l)" -gt "0" ] && echo "true" || echo "false")
fi

echo "IS_OPENSHIFT=${IS_OPENSHIFT}"
echo "IS_MAISTRA=${IS_MAISTRA}"

if [ "${DELETE_DEMO}" == "true" ]; then
  if [ "${IS_OPENSHIFT}" == "true" ]; then
    if [ "${IS_MAISTRA}" != "true" ]; then
      $CLIENT_EXE delete network-attachment-definition istio-cni -n ${NAMESPACE}
    fi
    $CLIENT_EXE delete security-context-constraints fraud-detection-scc -n ${NAMESPACE}
  fi
  ${CLIENT_EXE} delete namespace ${NAMESPACE}
  exit 0
fi

# Create and prepare the demo namespaces

if [[ "${IS_OPENSHIFT}" == "true" ]]; then
  $CLIENT_EXE new-project ${NAMESPACE}
else
  $CLIENT_EXE create namespace ${NAMESPACE}
fi

if [ "${ENABLE_INJECTION}" == "true" ]; then
  ${CLIENT_EXE} label namespace ${NAMESPACE} istio-injection=enabled
fi

# Deploy the demo

${CLIENT_EXE} apply -f <(curl -L "${SOURCE}/fraud-detection/accounts.yaml") -n ${NAMESPACE}
${CLIENT_EXE} apply -f <(curl -L "${SOURCE}/fraud-detection/cards.yaml") -n ${NAMESPACE}
${CLIENT_EXE} apply -f <(curl -L "${SOURCE}/fraud-detection/bank.yaml") -n ${NAMESPACE}
${CLIENT_EXE} apply -f <(curl -L "${SOURCE}/fraud-detection/policies.yaml") -n ${NAMESPACE}
${CLIENT_EXE} apply -f <(curl -L "${SOURCE}/fraud-detection/claims.yaml") -n ${NAMESPACE}
${CLIENT_EXE} apply -f <(curl -L "${SOURCE}/fraud-detection/insurance.yaml") -n ${NAMESPACE}
${CLIENT_EXE} apply -f <(curl -L "${SOURCE}/fraud-detection/fraud.yaml") -n ${NAMESPACE}

if [[ "${IS_OPENSHIFT}" = "true" ]]; then
  if [[ "${IS_MAISTRA}" != "true" ]]; then
    cat <<NAD | $CLIENT_EXE -n ${NAMESPACE} create -f -
apiVersion: "k8s.cni.cncf.io/v1"
kind: NetworkAttachmentDefinition
metadata:
  name: istio-cni
NAD
  fi  

  cat <<SCC | $CLIENT_EXE -n ${NAMESPACE} create -f -
apiVersion: security.openshift.io/v1
kind: SecurityContextConstraints
metadata:
  name: fraud-detection-scc
  type: RunAsAny
seLinuxContext:
  type: RunAsAny
supplementalGroups:
  type: RunAsAny
users:
- "system:serviceaccount:${NAMESPACE}:default"
SCC
fi

