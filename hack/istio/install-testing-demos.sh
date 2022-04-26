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
    -h|--help)
      cat <<HELPMSG
Valid command line arguments:
  -c|--client: either 'oc' or 'kubectl'
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

# Installed demos should be the exact same for both environments.
# Only the args passed to the scripts differ from each other.
if [[ "${IS_OPENSHIFT}" = "true" ]]; then
  echo "Deploying bookinfo demo..."
  "${SCRIPT_DIR}/install-bookinfo-demo.sh" -tg
  echo "Deploying error rates demo..."
  "${SCRIPT_DIR}/install-error-rates-demo.sh" 
else 
  echo "Deploying bookinfo demo..."
  "${SCRIPT_DIR}/install-bookinfo-demo.sh" -c kubectl -tg
  echo "Deploying error rates demo..."
  "${SCRIPT_DIR}/install-error-rates-demo.sh" -c kubectl
fi

for namespace in bookinfo alpha beta
do
  wait_for_workloads "${namespace}"
done
