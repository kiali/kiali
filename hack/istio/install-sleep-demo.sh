#!/bin/bash
##############################################################################
# install-sleep-demo.sh
#
# Installs the Istio Sleep Sample Demo Application into your cluster
# (either Kubernetes or OpenShift).
#
# See --help for more details on options to this script.
#
##############################################################################

HACK_SCRIPT_DIR="$(cd $(dirname "${BASH_SOURCE[0]}") && pwd)"
source ${HACK_SCRIPT_DIR}/functions.sh

SCRIPT_DIR="$(cd $(dirname "${BASH_SOURCE[0]}") && pwd)"

# ISTIO_DIR is where the Istio download is installed and thus where the sleep demo files are found.
# CLIENT_EXE_NAME is going to either be "oc" or "kubectl"
ISTIO_DIR=
CLIENT_EXE="oc"
DELETE_SLEEP="false"
: ${ISTIO_NAMESPACE:=istio-system}
: ${ENABLE_INJECTION:=true}

# process command line args
while [[ $# -gt 0 ]]; do
  key="$1"
  case $key in
    -a|--arch)
      shift;shift
      ;;
    -ds|--delete-sleep)
      DELETE_SLEEP="$2"
      shift;shift
      ;;
    -id|--istio-dir)
      ISTIO_DIR="$2"
      shift;shift
      ;;
    -in|--istio-namespace)
      ISTIO_NAMESPACE="$2"
      shift;shift
      ;;
    -c|--client-exe)
      CLIENT_EXE="$2"
      shift;shift
      ;;
    -h|--help)
      cat <<HELPMSG
Valid command line arguments:
  -ds|--delete-sleep <true|false>: If true, uninstall sleep. If false, install sleep. (default: false).
  -id|--istio-dir <dir>: Where Istio has already been downloaded. If not found, this script aborts.
  -c|--client-exe <name>: Cluster client executable name - valid values are "kubectl" or "oc"
  -h|--help : this message
HELPMSG
      exit 1
      ;;
    *)
      echo "Unknown argument [$key]. Aborting."
      exit 1
      ;;
  esac
done

IS_OPENSHIFT="false"
if [[ "${CLIENT_EXE}" = *"oc" ]]; then
  IS_OPENSHIFT="true"
fi

echo "CLIENT_EXE=${CLIENT_EXE}"
echo "IS_OPENSHIFT=${IS_OPENSHIFT}"

if [ "${DELETE_SLEEP}" == "true" ]; then
  set +e

  echo "Deleting the 'sleep' app in the 'sleep' namespace..."
  ${CLIENT_EXE} delete -n sleep -f ${ISTIO_DIR}/samples/sleep/sleep.yaml
  if [ "${IS_OPENSHIFT}" == "true" ]; then
    ${CLIENT_EXE} delete network-attachment-definition istio-cni -n sleep
    ${CLIENT_EXE} delete scc sleep-scc
    ${CLIENT_EXE} delete project sleep
  fi
  ${CLIENT_EXE} delete namespace sleep
  exit 0

else
  echo "Installing the 'sleep' app in the 'sleep' namespace..."
  if [ "${ISTIO_DIR}" == "" ]; then
    ISTIO_DIR=$(ls -dt1 ${SCRIPT_DIR}/../../_output/istio-* | head -n1)
  fi

  if [ "${IS_OPENSHIFT}" == "true" ]; then
    ${CLIENT_EXE} get project "sleep" || ${CLIENT_EXE} new-project "sleep"
  else
    ${CLIENT_EXE} get ns sleep || ${CLIENT_EXE} create ns sleep
  fi

  ${CLIENT_EXE} label namespace "sleep" istio-injection=enabled --overwrite=true

  # For OpenShift 4.11, adds default service account in the current ns to use as a user
  if [ "${IS_OPENSHIFT}" == "true" ]; then
    ${CLIENT_EXE} adm policy add-scc-to-user anyuid system:serviceaccount:sleep:sleep
  fi

  if [ "${IS_OPENSHIFT}" == "true" ]; then
      cat <<NAD | $CLIENT_EXE -n sleep apply -f -
apiVersion: "k8s.cni.cncf.io/v1"
kind: NetworkAttachmentDefinition
metadata:
  name: istio-cni
NAD
    cat <<SCC | $CLIENT_EXE apply -n sleep -f -
apiVersion: security.openshift.io/v1
kind: SecurityContextConstraints
metadata:
  name: sleep-scc
runAsUser:
  type: RunAsAny
seLinuxContext:
  type: RunAsAny
supplementalGroups:
  type: RunAsAny
priority: 9
users:
- "system:serviceaccount:sleep:default"
- "system:serviceaccount:sleep:sleep"
SCC
  fi

  ${CLIENT_EXE} apply -n sleep -f ${ISTIO_DIR}/samples/sleep/sleep.yaml

  sleep 4

  echo "Sleep Demo should be installed and starting up - here are the pods and services"
  $CLIENT_EXE get services -n sleep
  $CLIENT_EXE get pods -n sleep

fi
