#!/bin/bash

##############################################################################
# install-testing-demos.sh
#
# Installs all the demo applications needed for cypress testing.
# Works on both openshift and non-openshift environments.
##############################################################################

set -e

SCRIPT_DIR="$(cd $(dirname "${BASH_SOURCE[0]}") && pwd)"

: ${CLIENT_EXE:=oc}

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
    -h|--help)
      cat <<HELPMSG
Valid command line arguments:
  -c|--client: either 'oc' or 'kubectl'
  -d|--delete: if 'true' demos will be deleted; otherwise, they will be installed
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
    "${SCRIPT_DIR}/install-bookinfo-demo.sh" -c kubectl -tg
    echo "Deploying error rates demo..."
    "${SCRIPT_DIR}/install-error-rates-demo.sh" -c kubectl
  fi

  echo "Installing the 'sleep' app in the 'default' namespace..."
  ${CLIENT_EXE} apply -n default -f ${SCRIPT_DIR}/../../_output/istio-*/samples/sleep/sleep.yaml

  # Some front-end tests have conflicts with the wildcard host in the bookinfo-gateway. Patch it with the host resolved for the traffic generator.
  ISTIO_INGRESS_HOST=$(${CLIENT_EXE} get cm -n bookinfo traffic-generator-config -o jsonpath='{.data.route}' | sed 's|.*//\([^\:]*\).*/.*|\1|')
  ${CLIENT_EXE} patch VirtualService bookinfo -n bookinfo --type json -p "[{\"op\": \"replace\", \"path\": \"/spec/hosts/0\", \"value\": \"${ISTIO_INGRESS_HOST}\"}]"

  for namespace in bookinfo alpha beta
  do
    wait_for_workloads "${namespace}"
  done

else
  # Delete everything - don't abort on error, just keep going and try to delete everything
  set +e

  echo "Deleting the 'sleep' app in the 'default' namespace..."
  ${CLIENT_EXE} delete -n default -f ${SCRIPT_DIR}/../../_output/istio-*/samples/sleep/sleep.yaml

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
