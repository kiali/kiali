#!/bin/bash

infomsg() {
  echo "[INFO] ${1}"
}

# Suites
BACKEND="backend"
BACKEND_EXTERNAL_CONTROLPLANE="backend-external-controlplane"
FRONTEND="frontend"
FRONTEND_AMBIENT="frontend-ambient"
FRONTEND_PRIMARY_REMOTE="frontend-primary-remote"
FRONTEND_MULTI_PRIMARY="frontend-multi-primary"
FRONTEND_EXTERNAL_KIALI="frontend-external-kiali"
FRONTEND_TEMPO="frontend-tempo"
LOCAL="local"
CLUSTER_TYPE="kind"
HELM_CHARTS_DIR=""
ISTIO_VERSION=""
KEYCLOAK_LIMIT_MEMORY=""
KEYCLOAK_REQUESTS_MEMORY=""
SETUP_ONLY="false"
STERN="false"
TEMPO="false"
TEST_SUITE="${BACKEND}"
TESTS_ONLY="false"
WITH_VIDEO="false"

# process command line args
while [[ $# -gt 0 ]]; do
  key="$1"
  case $key in
    -ct|--cluster-type)
      CLUSTER_TYPE="${2}"
      if [ "${CLUSTER_TYPE}" != "kind" -a "${CLUSTER_TYPE}" != "minikube" ]; then
        echo "--cluster-type option must be one of 'kind' or 'minikube'"
        exit 1
      fi
      shift;shift
      ;;
    -hcd|--helm-charts-dir)
      HELM_CHARTS_DIR="${2}"
      shift;shift
      ;;
    -iv|--istio-version)
      ISTIO_VERSION="${2}"
      shift;shift
      ;;
    -klm|--keycloak-limit-memory)
      KEYCLOAK_LIMIT_MEMORY="${2}"
      shift;shift
      ;;
    -krm|--keycloak-requests-memory)
      KEYCLOAK_REQUESTS_MEMORY="${2}"
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
    -st|--stern)
      STERN="${2}"
      if [ "${STERN}" != "true" -a "${STERN}" != "false" ]; then
        echo "--stern option must be one of 'true' or 'false'"
        exit 1
      fi
      shift;shift
      ;;
    -t|--tempo)
      TEMPO="${2}"
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
      if [ "${TEST_SUITE}" != "${BACKEND}" -a "${TEST_SUITE}" != "${BACKEND_EXTERNAL_CONTROLPLANE}" -a "${TEST_SUITE}" != "${FRONTEND}" -a "${TEST_SUITE}" != "${FRONTEND_AMBIENT}" -a "${TEST_SUITE}" != "${FRONTEND_PRIMARY_REMOTE}" -a "${TEST_SUITE}" != "${FRONTEND_MULTI_PRIMARY}" -a "${TEST_SUITE}" != "${FRONTEND_EXTERNAL_KIALI}" -a "${TEST_SUITE}" != "${FRONTEND_TEMPO}" -a "${TEST_SUITE}" != "${LOCAL}" ]; then
        echo "--test-suite option must be one of '${BACKEND}', '${BACKEND_EXTERNAL_CONTROLPLANE}', '${FRONTEND}', '${FRONTEND_PRIMARY_REMOTE}', '${FRONTEND_MULTI_PRIMARY}', '${FRONTEND_EXTERNAL_KIALI}', '${FRONTEND_AMBIENT}', '${FRONTEND_TEMPO}' or '${LOCAL}'"
        exit 1
      fi
      shift;shift
      ;;
    -wv|--with-video)
      WITH_VIDEO="${2}"
      if [ "${WITH_VIDEO}" != "true" -a "${WITH_VIDEO}" != "false" ]; then
        echo "--with-video option must be one of 'true' or 'false'"
        exit 1
      fi
      shift;shift
      ;;
    -h|--help)
      cat <<HELPMSG
Valid command line arguments:
  -ct|--cluster-type <kind|minikube>
    Which cluster type to use for testing. 
    Default: kind
  -hcd|--helm-charts-dir
    The directory where the Helm charts are located. If not specified, the Helm charts for the target branch will be used.
  -iv|--istio-version <version>
    Which Istio version to test with. For releases, specify "#.#.#". For dev builds, specify in the form "#.#-dev"
    Default: The latest release
  -klm|--keycloak-limit-memory <value>
    Set the keycloak resources limit memory in the keycloak helm charts. Ex. 1Gi
  -krm|--keycloak-requests-memory <value>
    Set the keycloak resources requests memory in the keycloak helm charts. Ex. 1Gi
  -so|--setup-only <true|false>
    If true, only setup the test environment and exit without running the tests.
    Default: false
  -st|--stern <true|false> 
    If true, will setup stern logging binary. 
    Default: false
  -t|--tempo <true|false>
    If true, Tempo will be installed instead of Jaeger. Just for primary-remote suite
    Default: false
  -to|--tests-only <true|false>
    If true, only run the tests and skip the setup.
    Default: false
  -ts|--test-suite <${BACKEND}|${BACKEND_EXTERNAL_CONTROLPLANE}|${FRONTEND}|${FRONTEND_AMBIENT}|${FRONTEND_PRIMARY_REMOTE}|${FRONTEND_MULTI_PRIMARY}|${FRONTEND_EXTERNAL_KIALI}|${FRONTEND_TEMPO}|${LOCAL}>
    Which test suite to run.
    Default: ${BACKEND}
  -wv|--with-video <true|false>
    If true, will record video for the cypress test run.
    Default: ${WITH_VIDEO}
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
CLUSTER_TYPE=$CLUSTER_TYPE
HELM_CHARTS_DIR=$HELM_CHARTS_DIR
ISTIO_VERSION=$ISTIO_VERSION
KEYCLOAK_LIMIT_MEMORY=$KEYCLOAK_LIMIT_MEMORY
KEYCLOAK_REQUESTS_MEMORY=$KEYCLOAK_LIMIT_MEMORY
SETUP_ONLY=$SETUP_ONLY
STERN=$STERN
TESTS_ONLY=$TESTS_ONLY
TEST_SUITE=$TEST_SUITE
WITH_VIDEO=$WITH_VIDEO
TEMPO=$TEMPO
=== SETTINGS ===
EOM

set -e

if [ -n "${ISTIO_VERSION}" ]; then
  ISTIO_VERSION_ARG="--istio-version ${ISTIO_VERSION}"
else
  ISTIO_VERSION_ARG=""
fi

if [ -n "${HELM_CHARTS_DIR}" ]; then
  HELM_CHARTS_DIR_ARG="--helm-charts-dir ${HELM_CHARTS_DIR}"
else
  HELM_CHARTS_DIR_ARG=""
fi

# Determine where this script is and make it the cwd
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
source ${SCRIPT_DIR}/istio/functions.sh

# This is used in multiple places and you need to call 'setKialiURL' first.
KIALI_URL=""
# Generate the kiali url. Will wait for kiali service's ingress to have an ip so this can timeout.
setKialiURL() {
  kubectl wait --for=jsonpath='{.status.loadBalancer.ingress}' -n istio-system service/kiali
  local ingress_ip="$(kubectl get svc kiali -n istio-system -o=jsonpath='{.status.loadBalancer.ingress[0].ip}')"
  KIALI_URL="http://${ingress_ip}/kiali"
}

detectRaceConditions() {
  local kubecontext=$1

  local context_arg=${kubecontext:+--context ${kubecontext}}
  kubectl ${context_arg} logs -l app.kubernetes.io/name=kiali --tail=-1 --all-containers -n istio-system | grep -vzq "WARNING: DATA RACE"
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
  local end_time=$((start_time + 120))
  local multicluster=$1

  # Get traces from the last 5m
  local traces_date=$((($(date +%s) - 300) * 1000))
  local trace_url="${KIALI_URL}/api/namespaces/bookinfo/workloads/productpage-v1/traces?startMicros=${traces_date}&tags=&limit=100"
  if [ "$multicluster" == "true" ]; then
    echo "Multicluster request"
    trace_url="${KIALI_URL}/api/namespaces/bookinfo/workloads/reviews-v2/traces?startMicros=${traces_date}&tags=&limit=100&clusterName=west"
  fi

  infomsg "Traces url: ${trace_url}"
  while true; do
    result=$(curl -k -s --fail "$trace_url" \
        -H 'Accept: application/json, text/plain, */*' \
        -H 'Content-Type: application/json' | jq -r '.data')

    if [ "$result" == "[]" ]; then
      local now=$(date +%s)
      if [ "${now}" -gt "${end_time}" ]; then
        echo "Timed out waiting for Kiali to get any trace. Examine open telemetry collector logs below:"
        kubectl logs -l app.kubernetes.io/name=opentelemetry-collector --tail=-1 --context kind-west -n istio-system
        exit 1
      fi
      sleep 10
    else
      echo "Got traces."
      break
    fi

  done
}

ensureBookinfoGraphReady() {
  infomsg "Waiting for Kiali to have graph data"
  local start_time=$(date +%s)
  local end_time=$((start_time + 120))

  # Authenticate first
  local kiali_token=$(kubectl -n istio-system create token kiali)
  auth=$(curl --cookie-jar cookies.txt "${KIALI_URL}/api/authenticate" \
          -H 'Accept: application/json, text/plain, */*' \
          -H 'Content-Type: application/x-www-form-urlencoded' \
          --request POST \
          --data-raw "token=${kiali_token}")

  local graph_url="${KIALI_URL}/api/namespaces/graph?duration=120s&graphType=versionedApp&includeIdleEdges=false&injectServiceNodes=true&boxBy=cluster,namespace,app&waypoints=false&appenders=deadNode,istio,serviceEntry,meshCheck,workloadEntry,health,ambient&rateGrpc=requests&rateHttp=requests&rateTcp=sent&namespaces=bookinfo"
  infomsg "Graph url: ${graph_url}"
  while true; do
    result=$(curl -k -s --fail "$graph_url" \
        -H 'Accept: application/json, text/plain, */*' \
        -H 'Content-Type: application/json' -b cookies.txt | jq -r '.elements.nodes')

    if [ "$result" == "[]" ]; then
      local now=$(date +%s)
      if [ "${now}" -gt "${end_time}" ]; then
        echo "Timed out waiting for Kiali to get any graph data"
        break
      fi
      sleep 1
    else
      sleep 30
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
      infomsg "Response: ${response}"
      exit 1
    fi

    response=$(curl -s "$url")
    has_http_200=$(echo "$response" | jq '[.applications[]? | select(.name=="reviews" and .cluster=="west" and .health.requests.inbound.http."200" > 0)] | length > 0')

    if [ "$has_http_200" = "true" ]; then
      infomsg "'reviews' app in 'west' cluster is healthy enough."
      return 0
    else
      infomsg "'reviews' app in 'west' cluster is not healthy yet, checking again in 10 seconds..."
    fi

    sleep 10
  done
}

if [ "${STERN}" == "true" ]; then
  infomsg "Downloading stern binary ..."
  "${SCRIPT_DIR}"/stern/download-stern.sh
  export CYPRESS_STERN="true"
  infomsg "CYPRESS_STERN=${CYPRESS_STERN} exported."
fi

infomsg "Running ${TEST_SUITE} integration tests"
if [ "${TEST_SUITE}" == "${BACKEND}" ]; then
  if [ "${TESTS_ONLY}" == "false" ]; then
    "${SCRIPT_DIR}"/setup-kind-in-ci.sh --sail true ${ISTIO_VERSION_ARG} ${HELM_CHARTS_DIR_ARG}

    # Install demo apps
    "${SCRIPT_DIR}"/istio/install-testing-demos.sh -c "kubectl" --use-gateway-api true

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
  detectRaceConditions
elif [ "${TEST_SUITE}" == "${BACKEND_EXTERNAL_CONTROLPLANE}" ]; then
  if [ "${TESTS_ONLY}" == "false" ]; then
    if [ "${CLUSTER_TYPE}" == "kind" ]; then
      export CLUSTER1_CONTEXT=kind-controlplane
      export CLUSTER2_CONTEXT=kind-dataplane
      "${SCRIPT_DIR}"/setup-kind-in-ci.sh --multicluster "external-controlplane" ${ISTIO_VERSION_ARG} ${HELM_CHARTS_DIR_ARG}
    elif [ "${CLUSTER_TYPE}" == "minikube" ]; then
      export CLUSTER1_CONTEXT=controlplane
      export CLUSTER2_CONTEXT=dataplane
      "${SCRIPT_DIR}"/setup-minikube-in-ci.sh --multicluster "external-controlplane" ${ISTIO_VERSION_ARG} ${HELM_CHARTS_DIR_ARG}
    fi

    ISTIO_INGRESS_IP="$(kubectl get svc istio-ingressgateway -n istio-system -o=jsonpath='{.status.loadBalancer.ingress[0].ip}' --context="${CLUSTER1_CONTEXT}")"

    # Switch to the dataplane cluster before installing the demo apps because
    # that's where all the workloads should be in the external controlplane deployment.
    kubectl config use-context "${CLUSTER2_CONTEXT}"
    "${SCRIPT_DIR}/istio/install-bookinfo-demo.sh" -c kubectl -tg -in istio-system --auto-injection-label istio.io/rev=external-istiod

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
  detectRaceConditions "${CLUSTER1_CONTEXT}"
elif [ "${TEST_SUITE}" == "${FRONTEND}" ]; then
  ensureCypressInstalled
  
  if [ "${TESTS_ONLY}" == "false" ]; then
    "${SCRIPT_DIR}"/setup-kind-in-ci.sh --auth-strategy token --sail true ${ISTIO_VERSION_ARG} ${HELM_CHARTS_DIR_ARG}

    # Install demo apps
    "${SCRIPT_DIR}"/istio/install-testing-demos.sh -c "kubectl"
  fi

  ensureKialiServerReady

  export CYPRESS_BASE_URL="${KIALI_URL}"
  export CYPRESS_NUM_TESTS_KEPT_IN_MEMORY=0
  # Recorded video is unusable due to low resources in CI: https://github.com/cypress-io/cypress/issues/4722
  export CYPRESS_VIDEO="${WITH_VIDEO}"

  if [ "${SETUP_ONLY}" == "true" ]; then
    exit 0
  fi

  cd "${SCRIPT_DIR}"/../frontend
  yarn run cypress:run
  detectRaceConditions
elif [ "${TEST_SUITE}" == "${FRONTEND_AMBIENT}" ]; then

  ensureCypressInstalled
  ensureKialiTracesReady "true"

  if [ "${TESTS_ONLY}" == "false" ]; then
    "${SCRIPT_DIR}"/setup-kind-in-ci.sh --auth-strategy token ${ISTIO_VERSION_ARG} --ambient true --sail true ${HELM_CHARTS_DIR_ARG}

    # Install demo apps
    "${SCRIPT_DIR}"/istio/install-testing-demos.sh -c "kubectl" --ambient true --use-gateway-api true
  fi

  ensureKialiServerReady
  ensureBookinfoGraphReady

  export CYPRESS_BASE_URL="${KIALI_URL}"
  export CYPRESS_NUM_TESTS_KEPT_IN_MEMORY=0
  # Recorded video is unusable due to low resources in CI: https://github.com/cypress-io/cypress/issues/4722
  export CYPRESS_VIDEO="${WITH_VIDEO}"

  if [ "${SETUP_ONLY}" == "true" ]; then
    exit 0
  fi

  cd "${SCRIPT_DIR}"/../frontend

  # TODO: Remove when no support for Istio 1.23 is required
  # Replace by "yarn run cypress:run:ambient"
  if [ "${ISTIO_VERSION}" != "" ]; then
    set +e
    is_istio_version_eq_greater_than_expected "1.24.0" "${ISTIO_VERSION}"
    status=$?
    if [ "$status" -eq 0 ]; then
      yarn run cypress:run:ambient123
    else
      yarn run cypress:run:ambient
    fi
    set -e
  else
    yarn run cypress:run:ambient
  fi

  detectRaceConditions

elif [ "${TEST_SUITE}" == "${FRONTEND_PRIMARY_REMOTE}" ]; then
  ensureCypressInstalled
  
  if [ "${TESTS_ONLY}" == "false" ]; then
    "${SCRIPT_DIR}"/setup-kind-in-ci.sh --multicluster "primary-remote" ${ISTIO_VERSION_ARG} --tempo ${TEMPO} ${HELM_CHARTS_DIR_ARG}
  fi

  ensureKialiServerReady
  ensureMulticlusterApplicationsAreHealthy
  ensureKialiTracesReady "true"

  export CYPRESS_BASE_URL="${KIALI_URL}"
  export CYPRESS_CLUSTER1_CONTEXT="kind-east"
  export CYPRESS_CLUSTER2_CONTEXT="kind-west"
  export CYPRESS_NUM_TESTS_KEPT_IN_MEMORY=0
  # Recorded video is unusable due to low resources in CI: https://github.com/cypress-io/cypress/issues/4722
  export CYPRESS_VIDEO="${WITH_VIDEO}"
  export CYPRESS_USERNAME="kiali"
  export CYPRESS_PASSWD="kiali"

  if [ "${SETUP_ONLY}" == "true" ]; then
    exit 0
  fi

  cd "${SCRIPT_DIR}"/../frontend
  yarn run cypress:run:multi-cluster
  detectRaceConditions ${CYPRESS_CLUSTER1_CONTEXT}
elif [ "${TEST_SUITE}" == "${FRONTEND_MULTI_PRIMARY}" ]; then
  ensureCypressInstalled

  if [ -n "$KEYCLOAK_LIMIT_MEMORY" ]; then
      MEMORY_LIMIT_ARG="-klm $KEYCLOAK_LIMIT_MEMORY"
  else
      MEMORY_LIMIT_ARG=""
  fi
  if [ -n "$KEYCLOAK_REQUESTS_MEMORY" ]; then
     MEMORY_REQUEST_ARG="-krm $KEYCLOAK_REQUESTS_MEMORY"
  else
     MEMORY_REQUEST_ARG=""
  fi

  if [ "${TESTS_ONLY}" == "false" ]; then
    "${SCRIPT_DIR}"/setup-kind-in-ci.sh --multicluster "multi-primary" ${ISTIO_VERSION_ARG} --auth-strategy openid ${HELM_CHARTS_DIR_ARG} $MEMORY_LIMIT_ARG $MEMORY_REQUEST_ARG
  fi
  
  ensureKialiServerReady
  # We now need a kiali-aes-cookie to be able to talk to the API so checks for the applications
  # being healthy have moved into the frontend tests where it's easier to get the cookie.

  export CYPRESS_BASE_URL="${KIALI_URL}"
  export CYPRESS_CLUSTER1_CONTEXT="kind-east"
  export CYPRESS_CLUSTER2_CONTEXT="kind-west"
  export CYPRESS_NUM_TESTS_KEPT_IN_MEMORY=0
  export CYPRESS_VIDEO="${WITH_VIDEO}"
  export CYPRESS_AUTH_PROVIDER="keycloak"
  export CYPRESS_USERNAME="kiali"
  export CYPRESS_PASSWD="kiali"

  if [ "${SETUP_ONLY}" == "true" ]; then
    exit 0
  fi

  cd "${SCRIPT_DIR}"/../frontend
  yarn run cypress:run:multi-primary
  detectRaceConditions ${CYPRESS_CLUSTER1_CONTEXT}
elif [ "${TEST_SUITE}" == "${FRONTEND_EXTERNAL_KIALI}" ]; then
  ensureCypressInstalled

  if [ -n "$KEYCLOAK_LIMIT_MEMORY" ]; then
      MEMORY_LIMIT_ARG="-klm $KEYCLOAK_LIMIT_MEMORY"
  else
      MEMORY_LIMIT_ARG=""
  fi
  if [ -n "$KEYCLOAK_REQUESTS_MEMORY" ]; then
     MEMORY_REQUEST_ARG="-krm $KEYCLOAK_REQUESTS_MEMORY"
  else
     MEMORY_REQUEST_ARG=""
  fi

  if [ "${TESTS_ONLY}" == "false" ]; then
    "${SCRIPT_DIR}"/setup-kind-in-ci.sh --multicluster "external-kiali" ${ISTIO_VERSION_ARG} --auth-strategy openid --tempo ${TEMPO} ${HELM_CHARTS_DIR_ARG} $MEMORY_LIMIT_ARG $MEMORY_REQUEST_ARG
  fi

  ensureKialiServerReady

  export CYPRESS_BASE_URL="${KIALI_URL}"
  export CYPRESS_CLUSTER1_CONTEXT="kind-mgmt"
  export CYPRESS_CLUSTER2_CONTEXT="kind-mesh"
  export CYPRESS_NUM_TESTS_KEPT_IN_MEMORY=0
  # Recorded video is unusable due to low resources in CI: https://github.com/cypress-io/cypress/issues/4722
  export CYPRESS_VIDEO="${WITH_VIDEO}"
  export CYPRESS_USERNAME="kiali"
  export CYPRESS_PASSWD="kiali"

  if [ "${SETUP_ONLY}" == "true" ]; then
    exit 0
  fi

  cd "${SCRIPT_DIR}"/../frontend
  yarn run cypress:run:external-kiali
  detectRaceConditions ${CYPRESS_CLUSTER1_CONTEXT}
elif [ "${TEST_SUITE}" == "${FRONTEND_TEMPO}" ]; then
  ensureCypressInstalled

  if [ "${TESTS_ONLY}" == "false" ]; then
    "${SCRIPT_DIR}"/setup-kind-in-ci.sh --tempo true --sail true --auth-strategy token ${ISTIO_VERSION_ARG} ${HELM_CHARTS_DIR_ARG}

    # Install demo apps
    "${SCRIPT_DIR}"/istio/install-testing-demos.sh -c "kubectl" --use-gateway-api true
  fi

  ensureKialiServerReady

  export CYPRESS_BASE_URL="${KIALI_URL}"
  export CYPRESS_NUM_TESTS_KEPT_IN_MEMORY=0
  # Recorded video is unusable due to low resources in CI: https://github.com/cypress-io/cypress/issues/4722
  export CYPRESS_VIDEO="${WITH_VIDEO}"

  if [ "${SETUP_ONLY}" == "true" ]; then
    exit 0
  fi

  cd "${SCRIPT_DIR}"/../frontend
  yarn run cypress:run:tracing
  detectRaceConditions
elif [ "${TEST_SUITE}" == "${LOCAL}" ]; then
  ensureCypressInstalled

  GOPATH=$(go env GOPATH)
  if [ -z "${GOPATH}" ]; then
    echo "ERROR: Unable to determine GOPATH. Please ensure Go is properly installed."
    exit 1
  fi

  KIALI_BINARY="${GOPATH}/bin/kiali"
  if [ ! -f "${KIALI_BINARY}" ]; then
    echo "ERROR: Kiali binary not found at ${KIALI_BINARY}. Please build the kiali binary first."
    exit 1
  fi

  if [ "${TESTS_ONLY}" == "false" ]; then
    "${SCRIPT_DIR}"/setup-kind-in-ci.sh --auth-strategy token --sail true --deploy-kiali false ${ISTIO_VERSION_ARG} ${HELM_CHARTS_DIR_ARG}

    "${SCRIPT_DIR}"/istio/install-testing-demos.sh -c "kubectl"
  fi

  infomsg "Setup complete."

  if [ "${SETUP_ONLY}" == "true" ]; then
    exit 0
  fi

  # Start Kiali locally in the background
  infomsg "Starting Kiali locally in the background using binary: ${KIALI_BINARY}"
  "${KIALI_BINARY}" run --cluster-name-overrides kind-ci=cluster-default --port-forward-tracing --enable-tracing --port-forward-prom --port-forward-grafana --no-browser &
  KIALI_PID=$!
  
  # Set the local Kiali URL
  KIALI_URL="http://localhost:20001"

  # Give Kiali a few seconds to be healthy.
  sleep 5

  # Check to ensure the process is still running.
  if ! ps -p ${KIALI_PID} > /dev/null; then
    echo "Kiali process is not running. An error must have occurred. Check the logs above."
    exit 1
  fi

  export CYPRESS_BASE_URL="${KIALI_URL}"
  export CYPRESS_NUM_TESTS_KEPT_IN_MEMORY=0
  # Recorded video is unusable due to low resources in CI: https://github.com/cypress-io/cypress/issues/4722
  export CYPRESS_VIDEO="${WITH_VIDEO}"

  # Trap to ensure we clean up the Kiali process on exit
  trap "kill ${KIALI_PID} 2>/dev/null || true" EXIT

  cd "${SCRIPT_DIR}"/../frontend
  yarn run cypress:run:smoke
  
  kill ${KIALI_PID} 2>/dev/null || true
fi
