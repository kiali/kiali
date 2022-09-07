#!/bin/bash

##############################################################################
# install-testing-demos.sh
#
# Installs all the demo applications needed for cypress testing.
# Works on both openshift and non-openshift environments.
##############################################################################

set -eu
  
install_sleep_app() {

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
users:
- "system:serviceaccount:sleep:default"
- "system:serviceaccount:sleep:sleep"
SCC
  fi

  ${CLIENT_EXE} apply -n sleep -f ${ISTIO_DIR}/samples/sleep/sleep.yaml

}

SCRIPT_DIR="$(cd $(dirname "${BASH_SOURCE[0]}") && pwd)"

# install the Istio release that was last downloaded (that's the -t option to ls)
ISTIO_DIR=$(ls -dt1 ${SCRIPT_DIR}/../../_output/istio-* | head -n1)

# only used when cluster is minikube
MINIKUBE_PROFILE="minikube"

: ${CLIENT_EXE:=oc}
: ${DELETE_DEMOS:=false}

while [ $# -gt 0 ]; do
  key="$1"
  case $key in
    -c|--client)
      CLIENT_EXE="$2"
      shift;shift
      ;;
    -d|--delete)
      DELETE_DEMOS="$2"
      shift;shift
      ;;
    -mp|--minikube-profile)
      MINIKUBE_PROFILE="$2"
      shift;shift
      ;;
    -h|--help)
      cat <<HELPMSG
Valid command line arguments:
  -c|--client: either 'oc' or 'kubectl'
  -d|--delete: if 'true' demos will be deleted; otherwise, they will be installed
  -mp|--minikube-profile <name>: If using minikube, this is the minikube profile name (default: minikube).
  -h|--help: this text
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

# Waits for workloads in the specified namespace to be ready
wait_for_workloads () {
  local namespace=$1
  local workloads=$(${CLIENT_EXE} get deployments -n $namespace -o jsonpath='{.items[*].metadata.name}')
  for workload in ${workloads}
  do
    echo "Waiting for workload: '${workload}' to be ready"
    ${CLIENT_EXE} rollout status deployment "${workload}" -n "${namespace}"
  done
}

if [ "${DELETE_DEMOS}" != "true" ]; then

  # Installed demos should be the exact same for both environments.
  # Only the args passed to the scripts differ from each other.
  if [ "${IS_OPENSHIFT}" == "true" ]; then
    echo "Deploying bookinfo demo ..."
    "${SCRIPT_DIR}/install-bookinfo-demo.sh" -tg
    echo "Deploying error rates demo ..."
    "${SCRIPT_DIR}/install-error-rates-demo.sh"
  else
    echo "Deploying bookinfo demo..."
    "${SCRIPT_DIR}/install-bookinfo-demo.sh" -c kubectl -mp ${MINIKUBE_PROFILE} -tg
    echo "Deploying error rates demo..."
    "${SCRIPT_DIR}/install-error-rates-demo.sh" -c kubectl
  fi

  echo "Installing the 'sleep' app in the 'sleep' namespace..."
  install_sleep_app

  # Some front-end tests have conflicts with the wildcard host in the bookinfo-gateway. Patch it with the host resolved for the traffic generator.
  ISTIO_INGRESS_HOST=$(${CLIENT_EXE} get cm -n bookinfo traffic-generator-config -o jsonpath='{.data.route}' | sed 's|.*//\([^\:]*\).*/.*|\1|')

  if [ -n "${ISTIO_INGRESS_HOST}" ]; then
    ${CLIENT_EXE} patch VirtualService bookinfo -n bookinfo --type json -p "[{\"op\": \"replace\", \"path\": \"/spec/hosts/0\", \"value\": \"${ISTIO_INGRESS_HOST}\"}]"
  fi

  for namespace in bookinfo alpha beta
  do
    wait_for_workloads "${namespace}"
  done

else
  # Delete everything - don't abort on error, just keep going and try to delete everything
  set +e

  echo "Deleting the 'sleep' app in the 'sleep' namespace..."
  ${CLIENT_EXE} delete -n sleep -f ${ISTIO_DIR}/samples/sleep/sleep.yaml
  if [ "${IS_OPENSHIFT}" == "true" ]; then
    ${CLIENT_EXE} delete network-attachment-definition istio-cni -n sleep
    ${CLIENT_EXE} delete scc sleep-scc
    ${CLIENT_EXE} delete project sleep
  fi
  ${CLIENT_EXE} delete namespace sleep

  if [ "${IS_OPENSHIFT}" == "true" ]; then
    echo "Deleting bookinfo demo ..."
    "${SCRIPT_DIR}/install-bookinfo-demo.sh" --delete-bookinfo true
    echo "Deleting error rates demo ..."
    "${SCRIPT_DIR}/install-error-rates-demo.sh" --delete true
  else
    echo "Deleting bookinfo demo..."
    "${SCRIPT_DIR}/install-bookinfo-demo.sh" --delete-bookinfo true -c kubectl
    echo "Deleting error rates demo..."
    "${SCRIPT_DIR}/install-error-rates-demo.sh" --delete true -c kubectl
  fi
fi
