#!/bin/bash

infomsg() {
  echo "[INFO] ${1}"
}

# Suites
BACKEND="backend"
BACKEND_EXTERNAL_CONTROLPLANE="backend-external-controlplane"
FRONTEND="frontend"
FRONTEND_PRIMARY_REMOTE="frontend-primary-remote"
FRONTEND_MULTI_PRIMARY="frontend-multi-primary"
FRONTEND_TEMPO="frontend-tempo"
#

ISTIO_VERSION=""
TEST_SUITE="${BACKEND}"
SETUP_ONLY="false"
TESTS_ONLY="false"

# process command line args
while [[ $# -gt 0 ]]; do
  key="$1"
  case $key in
    -iv|--istio-version)
      ISTIO_VERSION="${2}"
      shift;shift
      ;;
    -so|--setup-only)
      SETUP_ONLY="${2}"
      if [ "${SETUP_ONLY}" != "true" -a "${SETUP_ONLY}" != "false" ]; then
        echo "--setup-only option must be one of 'true' or 'false'"
        exit 1
      fi
      shift;shift
      ;;
    -to|--tests-only)
      TESTS_ONLY="${2}"
      if [ "${TESTS_ONLY}" != "true" -a "${TESTS_ONLY}" != "false" ]; then
        echo "--tests-only option must be one of 'true' or 'false'"
        exit 1
      fi
      shift;shift
      ;;
    -ts|--test-suite)
      TEST_SUITE="${2}"
      if [ "${TEST_SUITE}" != "${BACKEND}" -a "${TEST_SUITE}" != "${BACKEND_EXTERNAL_CONTROLPLANE}" -a "${TEST_SUITE}" != "${FRONTEND}" -a "${TEST_SUITE}" != "${FRONTEND_PRIMARY_REMOTE}" -a "${TEST_SUITE}" != "${FRONTEND_MULTI_PRIMARY}" -a "${TEST_SUITE}" != "${FRONTEND_TEMPO}" ]; then
        echo "--test-suite option must be one of '${BACKEND}', '${BACKEND_EXTERNAL_CONTROLPLANE}', '${FRONTEND}', '${FRONTEND_PRIMARY_REMOTE}', or '${FRONTEND_MULTI_PRIMARY}' or '${FRONTEND_TEMPO}'"
        exit 1
      fi
      shift;shift
      ;;
    -h|--help)
      cat <<HELPMSG
Valid command line arguments:
  -iv|--istio-version <version>
    Which Istio version to test with. For releases, specify "#.#.#". For dev builds, specify in the form "#.#-dev"
    Default: The latest release
  -so|--setup-only <true|false>
    If true, only setup the test environment and exit without running the tests.
    Default: false
  -to|--tests-only <true|false>
    If true, only run the tests and skip the setup.
    Default: false
  -ts|--test-suite <${BACKEND}|${BACKEND_EXTERNAL_CONTROLPLANE}|${FRONTEND}|${FRONTEND_PRIMARY_REMOTE}|${FRONTEND_MULTI_PRIMARY}|${FRONTEND_TEMPO}>
    Which test suite to run.
    Default: ${BACKEND}
  -h|--help:
    This message

NOTE: When running the multi-cluster tests locally, it might be necessary to
edit some kernel settings to allow for the kind clusters to be created.

The following settings added to your sysctl config file should work (the filename will be something like '/etc/sysctl.d/local.conf' - refer to your operating system 'man sysctl' docs to determine which file should be changed):
fs.inotify.max_user_watches=524288
fs.inotify.max_user_instances=512
HELPMSG
      exit 1
      ;;
    *)
      echo "ERROR: Unknown argument [$key]. Aborting."
      exit 1
      ;;
  esac
done

if [ "${SETUP_ONLY}" == "true" -a "${TESTS_ONLY}" == "true" ]; then
  echo "ERROR: --setup-only and --tests-only cannot both be true. Aborting."
  exit 1
fi

# print out our settings for debug purposes
cat <<EOM
=== SETTINGS ===
ISTIO_VERSION=$ISTIO_VERSION
SETUP_ONLY=$SETUP_ONLY
TESTS_ONLY=$TESTS_ONLY
TEST_SUITE=$TEST_SUITE
=== SETTINGS ===
EOM

set -e

if [ -n "${ISTIO_VERSION}" ]; then
  ISTIO_VERSION_ARG="--istio-version ${ISTIO_VERSION}"
else
  ISTIO_VERSION_ARG=""
fi

# Determine where this script is and make it the cwd
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"

# This is used in multiple places and you need to call 'setKialiURL' first.
KIALI_URL=""
# Generate the kiali url. Will wait for kiali service's ingress to have an ip so this can timeout.
setKialiURL() {
  kubectl wait --for=jsonpath='{.status.loadBalancer.ingress}' -n istio-system service/kiali
  local ingress_ip="$(kubectl get svc kiali -n istio-system -o=jsonpath='{.status.loadBalancer.ingress[0].ip}')"
  KIALI_URL="http://${ingress_ip}/kiali"
}

ensureCypressInstalled() {
  cd "${SCRIPT_DIR}"/../frontend
  if ! yarn cypress --help &> /dev/null; then
    echo "cypress binary was not detected in your PATH. Did you install the frontend directory? Before running the frontend tests you must run 'make build-ui'."
    exit 1
  fi
  cd -
}

ensureKialiServerReady() {
  infomsg "Waiting for Kiali server pods to be healthy"
  kubectl rollout status deployment/kiali -n istio-system --timeout=120s

  # Ensure the server is responding to health checks externally.
  # It can take a minute for the Kube service and ingress to sync
  # and wire up the endpoints.
  setKialiURL
  infomsg "Waiting for Kiali server to respond externally to health checks at ${KIALI_URL}"
  local start_time=$(date +%s)
  local end_time=$((start_time + 30))
  while true; do
    if curl -k -s --fail "${KIALI_URL}/healthz"; then
      break
    fi
    local now=$(date +%s)
    if [ "${now}" -gt "${end_time}" ]; then
      infomsg "Timed out waiting for Kiali server to respond to health checks"
      kubectl logs -l app=kiali -n istio-system
      exit 1
    fi
    sleep 1
  done
  infomsg "Kiali server is healthy"
}

ensureKialiTracesReady() {
  infomsg "Waiting for Kiali to have traces"
  local start_time=$(date +%s)
  local end_time=$((start_time + 60))

  # Get traces from the last 5m
  local traces_date=$((($(date +%s) - 300) * 1000))
  local trace_url="${KIALI_URL}/api/namespaces/bookinfo/workloads/productpage-v1/traces?startMicros=${traces_date}&tags=&limit=100"
  infomsg "Traces url: ${trace_url}"
  while true; do
    result=$(curl -k -s --fail "$trace_url" \
        -H 'Accept: application/json, text/plain, */*' \
        -H 'Content-Type: application/json' | jq -r '.data')

    if [ "$result" == "[]" ]; then
      local now=$(date +%s)
      if [ "${now}" -gt "${end_time}" ]; then
        echo "Timed out waiting for Kiali to get any trace"
        break
      fi
      sleep 1
    else
      break
    fi

  done
}

ensureMulticlusterApplicationsAreHealthy() {
  local start_time=$(date +%s)
  local timeout=300
  local url="${KIALI_URL}/api/clusters/apps?namespaces=bookinfo&clusterName=west&health=true&istioResources=true&rateInterval=60s"

  while true; do
    local current_time=$(date +%s)
    local elapsed=$((current_time - start_time))

    if [ "$elapsed" -ge "$timeout" ]; then
      infomsg "Timeout reached without meeting the condition."
      exit 1
    fi

    response=$(curl -s "$url")
    has_http_200=$(echo "$response" | jq '[.applications[] | select(.name=="reviews" and .cluster=="west" and .health.requests.inbound.http."200" > 0)] | length > 0')

    if [ "$has_http_200" = "true" ]; then
      infomsg "'reviews' app in 'west' cluster is healthy enough."
      return 0
    else
      infomsg "'reviews' app in 'west' cluster is not healthy yet, checking again in 10 seconds..."
    fi

    sleep 10
  done
}

infomsg "Running ${TEST_SUITE} integration tests"
if [ "${TEST_SUITE}" == "${BACKEND}" ]; then
  if [ "${TESTS_ONLY}" == "false" ]; then
    "${SCRIPT_DIR}"/setup-kind-in-ci.sh ${ISTIO_VERSION_ARG}

    ISTIO_INGRESS_IP="$(kubectl get svc istio-ingressgateway -n istio-system -o=jsonpath='{.status.loadBalancer.ingress[0].ip}')"

    # Install demo apps
    "${SCRIPT_DIR}"/istio/install-testing-demos.sh -c "kubectl" -g "${ISTIO_INGRESS_IP}"

    ensureKialiServerReady
    
    # This envvar is used by the backend tests
    export URL="${KIALI_URL}"
  fi

  if [ "${SETUP_ONLY}" == "true" ]; then
    exit 0
  fi

  # Run backend multicluster integration tests
  cd "${SCRIPT_DIR}"/../tests/integration/tests
  go test -v -failfast
elif [ "${TEST_SUITE}" == "${BACKEND_EXTERNAL_CONTROLPLANE}" ]; then
  if [ "${TESTS_ONLY}" == "false" ]; then
    export CLUSTER1_CONTEXT=kind-controlplane
    export CLUSTER2_CONTEXT=kind-dataplane
    "${SCRIPT_DIR}"/setup-kind-in-ci.sh --multicluster "external-controlplane" ${ISTIO_VERSION_ARG}

    ISTIO_INGRESS_IP="$(kubectl get svc istio-ingressgateway -n istio-system -o=jsonpath='{.status.loadBalancer.ingress[0].ip}')"

    # Switch to the dataplane cluster before installing the demo apps because
    # that's where all the workloads should be in the external controlplane deployment.
    kubectl config use-context "${CLUSTER2_CONTEXT}"
    "${SCRIPT_DIR}/istio/install-bookinfo-demo.sh" -c kubectl -tg -in istio-system -g "${ISTIO_DIR}/samples/bookinfo/gateway-api/bookinfo-gateway.yaml"

    # Switch back to controlplane since that is where kiali is installed.
    kubectl config use-context "${CLUSTER1_CONTEXT}"
    ensureKialiServerReady
    
    # This envvar is used by the backend tests
    export URL="${KIALI_URL}"
  fi

  if [ "${SETUP_ONLY}" == "true" ]; then
    exit 0
  fi

  # Run backend multicluster integration tests
  cd "${SCRIPT_DIR}"/../tests/integration/multicluster/
  go test -v -failfast
elif [ "${TEST_SUITE}" == "${FRONTEND}" ]; then
  ensureCypressInstalled
  
  if [ "${TESTS_ONLY}" == "false" ]; then
    "${SCRIPT_DIR}"/setup-kind-in-ci.sh --auth-strategy token ${ISTIO_VERSION_ARG}

    ISTIO_INGRESS_IP="$(kubectl get svc istio-ingressgateway -n istio-system -o=jsonpath='{.status.loadBalancer.ingress[0].ip}')"
    # Install demo apps
    "${SCRIPT_DIR}"/istio/install-testing-demos.sh -c "kubectl" -g "${ISTIO_INGRESS_IP}"
  fi

  ensureKialiServerReady

  export CYPRESS_BASE_URL="${KIALI_URL}"
  export CYPRESS_NUM_TESTS_KEPT_IN_MEMORY=0
  # Recorded video is unusable due to low resources in CI: https://github.com/cypress-io/cypress/issues/4722
  export CYPRESS_VIDEO=false

  if [ "${SETUP_ONLY}" == "true" ]; then
    exit 0
  fi

  cd "${SCRIPT_DIR}"/../frontend
  yarn run cypress:run
elif [ "${TEST_SUITE}" == "${FRONTEND_PRIMARY_REMOTE}" ]; then
  ensureCypressInstalled
  
  if [ "${TESTS_ONLY}" == "false" ]; then
    "${SCRIPT_DIR}"/setup-kind-in-ci.sh --multicluster "primary-remote" ${ISTIO_VERSION_ARG}
  fi

  ensureKialiServerReady
  ensureMulticlusterApplicationsAreHealthy

  export CYPRESS_BASE_URL="${KIALI_URL}"
  export CYPRESS_CLUSTER1_CONTEXT="kind-east"
  export CYPRESS_CLUSTER2_CONTEXT="kind-west"
  export CYPRESS_NUM_TESTS_KEPT_IN_MEMORY=0
  # Recorded video is unusable due to low resources in CI: https://github.com/cypress-io/cypress/issues/4722
  export CYPRESS_VIDEO=false

  if [ "${SETUP_ONLY}" == "true" ]; then
    exit 0
  fi

  cd "${SCRIPT_DIR}"/../frontend
  yarn run cypress:run:multi-cluster
elif [ "${TEST_SUITE}" == "${FRONTEND_MULTI_PRIMARY}" ]; then
  ensureCypressInstalled

  if [ "${TESTS_ONLY}" == "false" ]; then
    "${SCRIPT_DIR}"/setup-kind-in-ci.sh --multicluster "multi-primary" ${ISTIO_VERSION_ARG}
  fi
  
  ensureKialiServerReady
  ensureMulticlusterApplicationsAreHealthy

  export CYPRESS_BASE_URL="${KIALI_URL}"
  export CYPRESS_CLUSTER1_CONTEXT="kind-east"
  export CYPRESS_CLUSTER2_CONTEXT="kind-west"
  export CYPRESS_NUM_TESTS_KEPT_IN_MEMORY=0
  export CYPRESS_VIDEO=false

  if [ "${SETUP_ONLY}" == "true" ]; then
    exit 0
  fi

  cd "${SCRIPT_DIR}"/../frontend
  yarn run cypress:run:multi-primary
elif [ "${TEST_SUITE}" == "${FRONTEND_TEMPO}" ]; then
  ensureCypressInstalled

  if [ "${TESTS_ONLY}" == "false" ]; then
    "${SCRIPT_DIR}"/setup-kind-in-ci.sh --tempo true --auth-strategy token ${ISTIO_VERSION_ARG}
    ISTIO_INGRESS_IP="$(kubectl get svc istio-ingressgateway -n istio-system -o=jsonpath='{.status.loadBalancer.ingress[0].ip}')"
    # Install demo apps
    "${SCRIPT_DIR}"/istio/install-testing-demos.sh -c "kubectl" -g "${ISTIO_INGRESS_IP}"
  fi

  ensureKialiServerReady

  export CYPRESS_BASE_URL="${KIALI_URL}"
  export CYPRESS_NUM_TESTS_KEPT_IN_MEMORY=0
  # Recorded video is unusable due to low resources in CI: https://github.com/cypress-io/cypress/issues/4722
  export CYPRESS_VIDEO=false

  if [ "${SETUP_ONLY}" == "true" ]; then
    exit 0
  fi

  cd "${SCRIPT_DIR}"/../frontend
  yarn run cypress:run:tracing
fi
