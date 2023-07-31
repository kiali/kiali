#!/bin/bash

infomsg() {
  echo "[INFO] ${1}"
}

TEST_SUITE="all"

# process command line args
while [[ $# -gt 0 ]]; do
  key="$1"
  case $key in
    -ts|--test-suite)
      TEST_SUITE="${2}"
      if [ "${TEST_SUITE}" != "backend" -a "${TEST_SUITE}" != "frontend" -a "${TEST_SUITE}" != "backend-multi-cluster" -a "${TEST_SUITE}" != "frontend-multi-cluster" ]; then
        echo "--test-suite option must be one of 'backend', 'frontend', 'backend-multi-cluster', 'frontend-multi-cluster', or 'all'"
        exit 1
      fi
      shift;shift
      ;;
    -h|--help)
      cat <<HELPMSG
Valid command line arguments:
  -ts|--test-suite <backend|frontend|backend-multi-cluster|frontend-multi-cluster|all>
    Which test suite to run.
    Default: all
  -h|--help:
       this message
HELPMSG
      exit 1
      ;;
    *)
      echo "ERROR: Unknown argument [$key]. Aborting."
      exit 1
      ;;
  esac
done

# print out our settings for debug purposes
cat <<EOM
=== SETTINGS ===
TEST_SUITE=$TEST_SUITE
=== SETTINGS ===
EOM

set -e

# Determine where this script is and make it the cwd
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"

infomsg "Running ${TEST_SUITE} integration tests"
if [ "${TEST_SUITE}" == "backend" ]; then
  "${SCRIPT_DIR}"/setup-kind-in-ci.sh

  ISTIO_INGRESS_IP="$(kubectl get svc istio-ingressgateway -n istio-system -o=jsonpath='{.status.loadBalancer.ingress[0].ip}')"

  # Install demo apps
  "${SCRIPT_DIR}"/istio/install-testing-demos.sh -c "kubectl" -g "${ISTIO_INGRESS_IP}"
  
  URL="http://${ISTIO_INGRESS_IP}/kiali"
  echo "kiali_url=$URL"
  export URL

  # Ensure kiali pods are healthy before running tests
  kubectl wait --for=condition=Ready pods -l app.kubernetes.io/name=kiali -n istio-system

  # Run backend integration tests
  cd "${SCRIPT_DIR}"/../tests/integration/tests
  go test -v
elif [ "${TEST_SUITE}" == "backend-multi-cluster" ]; then
  "${SCRIPT_DIR}"/setup-kind-in-ci.sh --multicluster "true"
  
  # Get Kiali URL
  ISTIO_INGRESS_IP="$(kubectl get svc istio-ingressgateway -n istio-system -o=jsonpath='{.status.loadBalancer.ingress[0].ip}')"
  URL="http://${ISTIO_INGRESS_IP}/kiali"
  echo "kiali_url=$URL"
  export URL

  cd "${SCRIPT_DIR}"/../tests/integration/tests
  go test -v
elif [ "${TEST_SUITE}" == "frontend" ]; then
  "${SCRIPT_DIR}"/setup-kind-in-ci.sh --auth-strategy token
  
  ISTIO_INGRESS_IP="$(kubectl get svc istio-ingressgateway -n istio-system -o=jsonpath='{.status.loadBalancer.ingress[0].ip}')"
  # Install demo apps
  "${SCRIPT_DIR}"/istio/install-testing-demos.sh -c "kubectl" -g "${ISTIO_INGRESS_IP}"

  # Get Kiali URL
  KIALI_URL="http://${ISTIO_INGRESS_IP}/kiali"
  export CYPRESS_BASE_URL="${KIALI_URL}"
  export CYPRESS_NUM_TESTS_KEPT_IN_MEMORY=0
  # Recorded video is unusable due to low resources in CI: https://github.com/cypress-io/cypress/issues/4722
  export CYPRESS_VIDEO=false
  
  # Ensure kiali pods are healthy before running tests
  kubectl wait --for=condition=Ready pods -l app.kubernetes.io/name=kiali -n istio-system
  
  cd "${SCRIPT_DIR}"/../frontend
  yarn run cypress:run
elif [ "${TEST_SUITE}" == "frontend-multi-cluster" ]; then
  "${SCRIPT_DIR}"/setup-kind-in-ci.sh --multicluster "true"

  # Get Kiali URL
  KIALI_URL="http://$(kubectl --context kind-east get svc istio-ingressgateway -n istio-system -o=jsonpath='{.status.loadBalancer.ingress[0].ip}')/kiali"
  export CYPRESS_BASE_URL="${KIALI_URL}"
  export CYPRESS_NUM_TESTS_KEPT_IN_MEMORY=0
  # Recorded video is unusable due to low resources in CI: https://github.com/cypress-io/cypress/issues/4722
  export CYPRESS_VIDEO=false

  cd "${SCRIPT_DIR}"/../frontend
  yarn run cypress:run:multi-cluster
fi
