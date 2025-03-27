#/bin/bash

# This deploys the fraud-detection demo

HACK_SCRIPT_DIR="$(cd $(dirname "${BASH_SOURCE[0]}") && pwd)"
source ${HACK_SCRIPT_DIR}/functions.sh

: ${AUTO_INJECTION:=true}
: ${AUTO_INJECTION_LABEL:="istio-injection=enabled"}
: ${CLIENT_EXE:=oc}
: ${DELETE_DEMO:=false}
: ${ISTIO_NAMESPACE:=istio-system}
: ${NAMESPACE:=fraud-detection}
: ${SOURCE:="https://raw.githubusercontent.com/kiali/demos/master"}

while [ $# -gt 0 ]; do
  key="$1"
  case $key in
    -ai|--auto-injection)
      AUTO_INJECTION="$2"
      shift;shift
      ;;
    -ail|--auto-injection-label)
      AUTO_INJECTION_LABEL="$2"
      shift;shift
      ;;
    -c|--client)
      CLIENT_EXE="$2"
      shift;shift
      ;;
    -d|--delete)
      DELETE_DEMO="$2"
      shift;shift
      ;;
    -in|--istio-namespace)
      ISTIO_NAMESPACE="$2"
      shift;shift
      ;;
    -h|--help)
      cat <<HELPMSG
Valid command line arguments:
  -ai|--auto-injection <true|false>: If you want sidecars to be auto-injected (default: true).
  -ail|--auto-injection-label <name=value>: If auto-injection is enabled, this is the label added to the namespace. For revision-based installs, you can use something like "istio.io/rev=default-v1-23-0". default: istio-injection=enabled).
  -c|--client: either 'oc' or 'kubectl'
  -d|--delete: either 'true' or 'false'. If 'true' the fraud detection demo will be deleted, not installed.
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
echo AUTO_INJECTION=${AUTO_INJECTION}
echo AUTO_INJECTION_LABEL=${AUTO_INJECTION_LABEL}
echo ISTIO_NAMESPACE=${ISTIO_NAMESPACE}
echo NAMESPACE=${NAMESPACE}
echo SOURCE=${SOURCE}

IS_OPENSHIFT="false"
if [[ "${CLIENT_EXE}" = *"oc" ]]; then
  IS_OPENSHIFT="true"
fi

echo "IS_OPENSHIFT=${IS_OPENSHIFT}"

# If we are to delete, remove everything and exit immediately after
if [ "${DELETE_DEMO}" == "true" ]; then
  if [ "${IS_OPENSHIFT}" == "true" ]; then
    $CLIENT_EXE delete network-attachment-definition istio-cni -n ${NAMESPACE}
    $CLIENT_EXE delete scc fraud-detection-scc
  fi
  ${CLIENT_EXE} delete namespace ${NAMESPACE}
  exit 0
fi

# Create and prepare the demo namespaces

if [ "${IS_OPENSHIFT}" == "true" ]; then
  $CLIENT_EXE new-project ${NAMESPACE}
else
  $CLIENT_EXE create namespace ${NAMESPACE}
fi

if [ "${IS_OPENSHIFT}" == "true" ]; then
  cat <<NAD | $CLIENT_EXE -n ${NAMESPACE} create -f -
apiVersion: "k8s.cni.cncf.io/v1"
kind: NetworkAttachmentDefinition
metadata:
  name: istio-cni
NAD
  cat <<SCC | $CLIENT_EXE apply -f -
apiVersion: security.openshift.io/v1
kind: SecurityContextConstraints
metadata:
  name: fraud-detection-scc
runAsUser:
  type: RunAsAny
seLinuxContext:
  type: RunAsAny
supplementalGroups:
  type: RunAsAny
priority: 9
users:
- "system:serviceaccount:${NAMESPACE}:default"
SCC
fi
   

if [ "${AUTO_INJECTION}" == "true" ]; then
  ${CLIENT_EXE} label namespace ${NAMESPACE} ${AUTO_INJECTION_LABEL}
fi

# Deploy the demo

${CLIENT_EXE} apply -f <(curl -L "${SOURCE}/fraud-detection/accounts.yaml") -n ${NAMESPACE}
${CLIENT_EXE} apply -f <(curl -L "${SOURCE}/fraud-detection/cards.yaml") -n ${NAMESPACE}
${CLIENT_EXE} apply -f <(curl -L "${SOURCE}/fraud-detection/bank.yaml") -n ${NAMESPACE}
${CLIENT_EXE} apply -f <(curl -L "${SOURCE}/fraud-detection/policies.yaml") -n ${NAMESPACE}
${CLIENT_EXE} apply -f <(curl -L "${SOURCE}/fraud-detection/claims.yaml") -n ${NAMESPACE}
${CLIENT_EXE} apply -f <(curl -L "${SOURCE}/fraud-detection/insurance.yaml") -n ${NAMESPACE}
${CLIENT_EXE} apply -f <(curl -L "${SOURCE}/fraud-detection/fraud.yaml") -n ${NAMESPACE}

if [ "${IS_OPENSHIFT}" == "true" ]; then
  $CLIENT_EXE adm policy add-scc-to-user anyuid -z default -n ${NAMESPACE}
fi

