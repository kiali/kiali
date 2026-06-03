#!/bin/bash
# shellcheck disable=SC2155

##############################################################################
# setup-lightspeed.sh
#
# Installs the OpenShift LightSpeed service API into a cluster that already
# has an MCP server deployed via setup-mcp.sh.
#
# The script first runs a discover step to detect which MCP variant is
# running (kubernetes-mcp or openshift-mcp) and refuses to proceed if no
# healthy MCP pod is found.
#
# The LightSpeed service is deployed directly (no OLM operator required).
#
# Usage:
#   ./setup-osl.sh [options] install-lightspeed
#   ./setup-osl.sh [options] uninstall-lightspeed
#   ./setup-osl.sh [options] status-lightspeed
#
##############################################################################

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &>/dev/null && pwd)"

##############################################################################
# Default values
##############################################################################

DEFAULT_CLIENT_EXE="oc"
DEFAULT_LIGHTSPEED_NAMESPACE="openshift-lightspeed"
DEFAULT_LIGHTSPEED_IMAGE="quay.io/openshift-lightspeed/lightspeed-service-api:latest"
DEFAULT_LIGHTSPEED_VERSION="v1.1.0"
DEFAULT_ISTIO_NAMESPACE="istio-system"
DEFAULT_TIMEOUT="300"
DEFAULT_OPENAI_TOKEN="<OPENAI_TOKEN>"
DEFAULT_LLM_PROVIDER_URL="https://api.openai.com/v1"
DEFAULT_LLM_MODEL="gpt-5.4-nano"

# Runtime variables
_VERBOSE="false"
# Populated by discover_mcp — which MCP variant is actually running
_MCP_PROVIDER=""
_MCP_NAMESPACE=""
_MCP_ENDPOINT=""

##############################################################################
# Helper functions
##############################################################################

infomsg() {
  echo "[INFO] ${1}"
}

errormsg() {
  echo "[ERROR] ${1}" >&2
}

debug() {
  if [ "${_VERBOSE}" == "true" ]; then
    echo "[DEBUG] ${1}"
  fi
}

warnmsg() {
  echo "[WARN] ${1}" >&2
}

##############################################################################
# Prerequisite Checking
##############################################################################

# Verifies that the openshift-monitoring namespace exists and has Running pods.
# Required for the full LightSpeed stack.
ensure_openshift_monitoring() {
  local monitoring_ns="openshift-monitoring"
  infomsg "Checking OpenShift monitoring (required for full LightSpeed)..."

  if ! ${CLIENT_EXE} get namespace "${monitoring_ns}" &>/dev/null; then
    errormsg "Namespace [${monitoring_ns}] not found."
    errormsg "OpenShift cluster monitoring is required for a full LightSpeed installation."
    return 1
  fi

  local running_pods
  running_pods=$(${CLIENT_EXE} get pods -n "${monitoring_ns}" \
    --field-selector=status.phase=Running \
    -o jsonpath='{.items[*].metadata.name}' 2>/dev/null \
    | tr ' ' '\n' | grep -c '.' || true)

  if [ "${running_pods}" -eq 0 ]; then
    errormsg "Namespace [${monitoring_ns}] exists but no Running pods were found."
    errormsg "Please ensure OpenShift cluster monitoring is healthy before proceeding."
    return 1
  fi

  infomsg "OpenShift monitoring is healthy (${running_pods} pod(s) running in [${monitoring_ns}])."
  return 0
}

##############################################################################
# Token validation
##############################################################################

# Verifies that OPENAI_TOKEN has been set to a real value.
# The default placeholder "<OPENAI_TOKEN>" means the user forgot to set it.
validate_openai_token() {
  if [ -z "${OPENAI_TOKEN}" ] || [ "${OPENAI_TOKEN}" == "${DEFAULT_OPENAI_TOKEN}" ]; then
    errormsg "OPENAI_TOKEN is not set or is still the default placeholder."
    errormsg "Please provide a valid OpenAI API token with:"
    errormsg "  --openai-token <your-token>"
    errormsg "  or export OPENAI_TOKEN=<your-token> before running this script."
    return 1
  fi
  debug "OPENAI_TOKEN is set (length=${#OPENAI_TOKEN})"
  return 0
}

validate_llm_settings() {
  if [ -z "${LLM_PROVIDER_URL}" ]; then
    errormsg "LLM_PROVIDER_URL is empty."
    errormsg "Please provide a valid OpenAI-compatible base URL with:"
    errormsg "  --llm-url <provider-base-url>"
    errormsg "  or export LLM_PROVIDER_URL=<provider-base-url> before running this script."
    return 1
  fi

  if [ -z "${LLM_MODEL}" ]; then
    errormsg "LLM_MODEL is empty."
    errormsg "Please provide a valid model name with:"
    errormsg "  --llm-model <model-name>"
    errormsg "  or export LLM_MODEL=<model-name> before running this script."
    return 1
  fi

  debug "LLM_PROVIDER_URL=${LLM_PROVIDER_URL}"
  debug "LLM_MODEL=${LLM_MODEL}"
  return 0
}

##############################################################################
# Discover step — detect which MCP server is running
##############################################################################

# Checks whether <ns> has at least one Running pod matching <name-prefix>.
_mcp_pod_running() {
  local ns="$1"
  local prefix="$2"
  local count
  count=$(${CLIENT_EXE} get pods -n "${ns}" \
    --field-selector=status.phase=Running \
    -o jsonpath='{.items[*].metadata.name}' 2>/dev/null \
    | tr ' ' '\n' | grep -c "^${prefix}" || true)
  [ "${count}" -gt 0 ]
}

# Returns the MCP service ClusterIP endpoint, or the Route host on OpenShift.
_mcp_endpoint() {
  local ns="$1"
  local svc="$2"

  if [ "$(basename "${CLIENT_EXE}")" == "oc" ]; then
    local host
    host="$(${CLIENT_EXE} get route "${svc}" -n "${ns}" \
      -o jsonpath='{.spec.host}' 2>/dev/null)"
    if [ -n "${host}" ]; then
      echo "http://${host}"
      return
    fi
  fi

  local cluster_ip
  cluster_ip="$(${CLIENT_EXE} get service "${svc}" -n "${ns}" \
    -o jsonpath='{.spec.clusterIP}' 2>/dev/null)"
  [ -n "${cluster_ip}" ] && echo "http://${cluster_ip}:8080"
}

# Probes the cluster for a running kubernetes-mcp or openshift-mcp server.
# On success sets _MCP_PROVIDER, _MCP_NAMESPACE, and _MCP_ENDPOINT.
# On failure prints an error and returns 1.
discover_mcp() {
  infomsg "Discovering MCP server..."

  local providers=("kubernetes" "openshift")
  for provider in "${providers[@]}"; do
    local ns="${provider}-mcp"
    local svc="${provider}-mcp-server"

    debug "Checking namespace [${ns}]..."

    if ! ${CLIENT_EXE} get namespace "${ns}" &>/dev/null; then
      debug "Namespace [${ns}] does not exist — skipping."
      continue
    fi

    if ! _mcp_pod_running "${ns}" "${svc}"; then
      warnmsg "Namespace [${ns}] exists but no Running pod found for [${svc}]."
      continue
    fi

    _MCP_PROVIDER="${provider}"
    _MCP_NAMESPACE="${ns}"
    _MCP_ENDPOINT="$(_mcp_endpoint "${ns}" "${svc}")"

    infomsg "MCP server detected:"
    infomsg "  Provider  : ${_MCP_PROVIDER}"
    infomsg "  Namespace : ${_MCP_NAMESPACE}"
    infomsg "  Endpoint  : ${_MCP_ENDPOINT}"
    return 0
  done

  errormsg "No running MCP server found."
  errormsg "LightSpeed requires a running MCP server to function."
  errormsg "Please install one first with:"
  errormsg "  ${SCRIPT_DIR}/../setup-mcp.sh install-mcp"
  errormsg "  ${SCRIPT_DIR}/../setup-mcp.sh --provider openshift install-mcp"
  return 1
}

##############################################################################
# Commands
##############################################################################

create_lightspeed_credentials() {
  local ns="${LIGHTSPEED_NAMESPACE}"
  infomsg "Creating credentials secret in namespace [${ns}]..."

  ${CLIENT_EXE} create secret generic credentials \
    --from-literal=apitoken="${OPENAI_TOKEN}" \
    -n "${ns}" \
    --dry-run=client -o yaml \
    | ${CLIENT_EXE} apply -f -

  infomsg "Secret [credentials] created/updated in namespace [${ns}]."
}

create_lightspeed_operator_group() {
  local ns="${LIGHTSPEED_NAMESPACE}"
  local template="${SCRIPT_DIR}/deployment/operator_lightspped_group.yaml"

  if [ ! -f "${template}" ]; then
    errormsg "OperatorGroup template not found: ${template}"
    return 1
  fi

  infomsg "Creating OperatorGroup in namespace [${ns}]..."

  local tmp_og
  tmp_og="$(mktemp /tmp/osl-operator-group.XXXXXX.yaml)"
  trap 'rm -f "${tmp_og}"' RETURN

  export LIGHTSPEED_NAMESPACE
  envsubst '${LIGHTSPEED_NAMESPACE}' < "${template}" > "${tmp_og}"

  ${CLIENT_EXE} apply -f "${tmp_og}" -n "${ns}"

  infomsg "OperatorGroup [my-operator-group] created/updated in namespace [${ns}]."
}

create_lightspeed_subscription() {
  local ns="${LIGHTSPEED_NAMESPACE}"
  local template="${SCRIPT_DIR}/deployment/subscription_lightspeed.yaml"

  if [ ! -f "${template}" ]; then
    errormsg "Subscription template not found: ${template}"
    return 1
  fi

  infomsg "Creating Subscription (operator version=${LIGHTSPEED_VERSION}) in namespace [${ns}]..."

  local tmp_sub
  tmp_sub="$(mktemp /tmp/osl-subscription.XXXXXX.yaml)"
  trap 'rm -f "${tmp_sub}"' RETURN

  export LIGHTSPEED_NAMESPACE
  export LIGHTSPEED_VERSION
  envsubst '${LIGHTSPEED_NAMESPACE} ${LIGHTSPEED_VERSION}' < "${template}" > "${tmp_sub}"

  ${CLIENT_EXE} apply -f "${tmp_sub}" -n "${ns}"

  infomsg "Subscription [lightspeed-operator.${LIGHTSPEED_VERSION}] created/updated in namespace [${ns}]."
}

create_osl_config() {
  local ns="${LIGHTSPEED_NAMESPACE}"
  local template="${SCRIPT_DIR}/deployment/osl_config.yaml"

  if [ ! -f "${template}" ]; then
    errormsg "OLSConfig template not found: ${template}"
    return 1
  fi

  infomsg "Creating OLSConfig (mcp=${_MCP_PROVIDER}, llm=${LLM_PROVIDER_URL}, model=${LLM_MODEL}) in namespace [${ns}]..."

  local tmp_cfg
  tmp_cfg="$(mktemp /tmp/osl-config.XXXXXX.yaml)"
  trap 'rm -f "${tmp_cfg}"' RETURN

  export MCP_PROVIDER="${_MCP_PROVIDER}"
  export LLM_PROVIDER_URL
  export LLM_MODEL
  envsubst '${MCP_PROVIDER} ${LLM_PROVIDER_URL} ${LLM_MODEL}' < "${template}" > "${tmp_cfg}"

  ${CLIENT_EXE} apply -f "${tmp_cfg}" -n "${ns}"

  infomsg "OLSConfig [cluster] created/updated in namespace [${ns}]."
}

create_lightspeed_network_policy() {
  local ns="${LIGHTSPEED_NAMESPACE}"
  local template="${SCRIPT_DIR}/deployment/allow-policy.yaml"

  if [ ! -f "${template}" ]; then
    errormsg "NetworkPolicy template not found: ${template}"
    return 1
  fi

  infomsg "Creating NetworkPolicy in namespace [${ns}]..."

  local tmp_np
  tmp_np="$(mktemp /tmp/osl-network-policy.XXXXXX.yaml)"
  trap 'rm -f "${tmp_np}"' RETURN

  export LIGHTSPEED_NAMESPACE
  export LIGHTSPEED_PORT="8443"
  envsubst '${LIGHTSPEED_NAMESPACE} ${LIGHTSPEED_PORT}' < "${template}" > "${tmp_np}"

  ${CLIENT_EXE} apply -f "${tmp_np}" -n "${ns}"

  infomsg "NetworkPolicy [allow-labeled-namespaces-to-lightspeed] created/updated in namespace [${ns}]."
}

label_istio_namespace() {
  infomsg "Granting [${ISTIO_NAMESPACE}] access to LightSpeed (allow-lightspeed=true)..."
  ${CLIENT_EXE} label namespace "${ISTIO_NAMESPACE}" allow-lightspeed=true --overwrite
  infomsg "Namespace [${ISTIO_NAMESPACE}] labelled with allow-lightspeed=true."
}

wait_for_lightspeed_operator() {
  local ns="${LIGHTSPEED_NAMESPACE}"
  local waited=0

  infomsg "Waiting for LightSpeed Operator to reach Succeeded phase (this may take a few minutes)..."

  while ! ${CLIENT_EXE} get csv -n "${ns}" 2>/dev/null \
      | grep "^lightspeed-operator" \
      | grep -q "Succeeded"; do

    if [ "${waited}" -ge "${TIMEOUT}" ]; then
      errormsg "Timeout (${TIMEOUT}s) waiting for LightSpeed Operator CSV to reach Succeeded."
      errormsg "Check the operator status with: ${CLIENT_EXE} get csv -n ${ns}"
      return 1
    fi

    debug "Lightspeed still installing... (${waited}s elapsed)"
    infomsg "  Lightspeed still installing... waiting 10s"
    sleep 10
    waited=$((waited + 10))
  done

  infomsg "LightSpeed Operator is ready (Succeeded)."
}

ensure_lightspeed_ns() {
  local ns="${LIGHTSPEED_NAMESPACE}"
  debug "Checking namespace [${ns}]..."

  if ${CLIENT_EXE} get namespace "${ns}" &>/dev/null; then
    infomsg "Namespace [${ns}] already exists."
  else
    infomsg "Namespace [${ns}] not found — creating it..."
    ${CLIENT_EXE} create namespace "${ns}"
    infomsg "Namespace [${ns}] created."
  fi
}

install_lightspeed() {
  validate_openai_token || exit 1
  validate_llm_settings || exit 1
  discover_mcp || exit 1  # MCP server discovery
  ensure_openshift_monitoring || exit 1

  local ns="${LIGHTSPEED_NAMESPACE}"

  infomsg "========================================================"
  infomsg "  Installing LightSpeed"
  infomsg "  Namespace  : ${ns}"
  infomsg "  Image      : ${LIGHTSPEED_IMAGE}"
  infomsg "  LLM URL    : ${LLM_PROVIDER_URL}"
  infomsg "  LLM Model  : ${LLM_MODEL}"
  infomsg "  MCP        : ${_MCP_PROVIDER} @ ${_MCP_ENDPOINT}"
  infomsg "========================================================"

  ensure_lightspeed_ns
  create_lightspeed_credentials

  create_lightspeed_operator_group
  create_lightspeed_subscription
  wait_for_lightspeed_operator
  create_osl_config
  create_lightspeed_network_policy
  label_istio_namespace

  infomsg "LightSpeed installation complete."
}

uninstall_lightspeed() {
  local ns="${LIGHTSPEED_NAMESPACE}"
  infomsg "Uninstalling LightSpeed from namespace [${ns}]..."

  if ! ${CLIENT_EXE} get namespace "${ns}" &>/dev/null; then
    warnmsg "Namespace [${ns}] does not exist — nothing to uninstall."
    return 0
  fi

  ${CLIENT_EXE} delete deployment lightspeed-app-server                                    -n "${ns}" --ignore-not-found
  ${CLIENT_EXE} delete configmap  olsconfig                                                -n "${ns}" --ignore-not-found
  ${CLIENT_EXE} delete olsconfig  cluster                                                  -n "${ns}" --ignore-not-found
  ${CLIENT_EXE} delete networkpolicy allow-labeled-namespaces-to-lightspeed               -n "${ns}" --ignore-not-found
  ${CLIENT_EXE} delete subscription lightspeed-operator                                   -n "${ns}" --ignore-not-found
  ${CLIENT_EXE} delete operatorgroup my-operator-group                                    -n "${ns}" --ignore-not-found
  ${CLIENT_EXE} delete secret credentials                                                 -n "${ns}" --ignore-not-found

  infomsg "Removing allow-lightspeed label from namespace [${ISTIO_NAMESPACE}]..."
  ${CLIENT_EXE} label namespace "${ISTIO_NAMESPACE}" allow-lightspeed- --ignore-not-found 2>/dev/null || true

  infomsg "Deleting namespace [${ns}]..."
  ${CLIENT_EXE} delete namespace "${ns}" --ignore-not-found

  infomsg "LightSpeed uninstalled from namespace [${ns}]."
}

status_lightspeed() {
  local ns="${LIGHTSPEED_NAMESPACE}"

  infomsg "========================================================"
  infomsg "  LightSpeed Status  (namespace=${ns})"
  infomsg "========================================================"

  if ! ${CLIENT_EXE} get namespace "${ns}" &>/dev/null; then
    infomsg "  Namespace : NOT FOUND — LightSpeed is not installed."
    return 0
  fi
  infomsg "  Namespace : ${ns} (exists)"

  # --- Deployment ---
  echo ""
  infomsg "[ Deployment ]"
  if ${CLIENT_EXE} get deployment lightspeed-app-server -n "${ns}" &>/dev/null; then
    ${CLIENT_EXE} get deployment lightspeed-app-server -n "${ns}"
  else
    warnmsg "  Deployment [lightspeed-app-server] not found."
  fi

  # --- Pods ---
  echo ""
  infomsg "[ Pods ]"
  ${CLIENT_EXE} get pods -n "${ns}" -o wide 2>/dev/null || warnmsg "  No pods found."

  # --- MCP discovery (informational) ---
  echo ""
  infomsg "[ MCP server ]"
  if discover_mcp 2>/dev/null; then
    infomsg "  ${_MCP_PROVIDER} MCP is running at ${_MCP_ENDPOINT}"
  else
    warnmsg "  No running MCP server detected."
  fi

  infomsg "========================================================"
}

##############################################################################
# Argument Parsing
##############################################################################

while [ "$#" -gt 0 ]; do
  key="$1"
  case ${key} in
    install-lightspeed)   _CMD="install-lightspeed";   shift ;;
    uninstall-lightspeed) _CMD="uninstall-lightspeed"; shift ;;
    status-lightspeed)    _CMD="status-lightspeed";    shift ;;
    -ce|--client-exe)
      CLIENT_EXE="$2"; shift; shift ;;
    -n|--namespace)
      LIGHTSPEED_NAMESPACE="$2"; shift; shift ;;
    -i|--image)
      LIGHTSPEED_IMAGE="$2"; shift; shift ;;
    -ot|--openai-token)
      OPENAI_TOKEN="$2"; shift; shift ;;
    --llm-url)
      LLM_PROVIDER_URL="$2"; shift; shift ;;
    --llm-model)
      LLM_MODEL="$2"; shift; shift ;;
    -lv|--lightspeed-version)
      LIGHTSPEED_VERSION="$2"; shift; shift ;;
    -in|--istio-namespace)
      ISTIO_NAMESPACE="$2"; shift; shift ;;
    -t|--timeout)
      TIMEOUT="$2"; shift; shift ;;
    -v|--verbose)
      _VERBOSE="true"; shift ;;
    -h|--help)
      cat <<HELPMSG

$0 [options] command

Installs the OpenShift LightSpeed service on a cluster that already has an
MCP server running (deployed via setup-mcp.sh).

The script auto-detects the running MCP variant (kubernetes or openshift)
and refuses to proceed if no healthy MCP pod is found.

Valid options:
  -ce|--client-exe <path>
      The path to the oc executable. Must be 'oc' — LightSpeed requires OpenShift.
      Default: ${DEFAULT_CLIENT_EXE}
  -n|--namespace <namespace>
      The namespace where LightSpeed will be installed.
      Default: ${DEFAULT_LIGHTSPEED_NAMESPACE}
  -i|--image <image>
      The LightSpeed container image to deploy.
      Default: ${DEFAULT_LIGHTSPEED_IMAGE}
  -lv|--lightspeed-version <version>
      The OLM operator version to install (sets startingCSV in the Subscription).
      Default: ${DEFAULT_LIGHTSPEED_VERSION}
  -ot|--openai-token <token>
      The API token used by the LightSpeed service. OpenAI and OpenAI-compatible
      providers are supported as long as the configured URL and model are valid.
      Can also be set via the OPENAI_TOKEN environment variable.
  --llm-url <url>
      Base URL of the OpenAI-compatible LLM provider.
      Default: ${DEFAULT_LLM_PROVIDER_URL}
  --llm-model <model>
      Default model configured in the OLSConfig.
      Default: ${DEFAULT_LLM_MODEL}
  -in|--istio-namespace <namespace>
      The namespace where Istio and Kiali are installed.
      Default: ${DEFAULT_ISTIO_NAMESPACE}
  -t|--timeout <seconds>
      Timeout in seconds for waiting on resources.
      Default: ${DEFAULT_TIMEOUT}
  -v|--verbose
      Enable verbose/debug output.
  -h|--help
      Display this help message.

Commands:
  install-lightspeed    Discover MCP and install the LightSpeed service.
  uninstall-lightspeed  Remove the LightSpeed service.
  status-lightspeed     Show the current status of LightSpeed and MCP.

Examples:
  # Install with defaults (auto-detects running MCP)
  $0 install-lightspeed

  # Install using oc with a custom image
  $0 --client-exe oc --image quay.io/openshift-lightspeed/lightspeed-service-api:v0.2.0 install-lightspeed

  # Install using Gemini's OpenAI-compatible endpoint
  $0 --openai-token <token> \
     --llm-url https://generativelanguage.googleapis.com/v1beta/openai \
     --llm-model gemini-2.5-pro \
     install-lightspeed

  # Check status
  $0 status-lightspeed

  # Uninstall
  $0 uninstall-lightspeed

HELPMSG
      exit 0
      ;;
    *)
      errormsg "Unknown argument [${key}]. Use -h for help."
      exit 1
      ;;
  esac
done

##############################################################################
# Apply defaults for unset variables
##############################################################################

: "${CLIENT_EXE:=${DEFAULT_CLIENT_EXE}}"
: "${LIGHTSPEED_NAMESPACE:=${DEFAULT_LIGHTSPEED_NAMESPACE}}"
: "${LIGHTSPEED_IMAGE:=${DEFAULT_LIGHTSPEED_IMAGE}}"
: "${LIGHTSPEED_VERSION:=${DEFAULT_LIGHTSPEED_VERSION}}"
: "${ISTIO_NAMESPACE:=${DEFAULT_ISTIO_NAMESPACE}}"
: "${OPENAI_TOKEN:=${DEFAULT_OPENAI_TOKEN}}"
: "${LLM_PROVIDER_URL:=${DEFAULT_LLM_PROVIDER_URL}}"
: "${LLM_MODEL:=${DEFAULT_LLM_MODEL}}"
: "${TIMEOUT:=${DEFAULT_TIMEOUT}}"

##############################################################################
# Enforce OpenShift client
##############################################################################

if [ "$(basename "${CLIENT_EXE}")" != "oc" ]; then
  errormsg "LightSpeed requires an OpenShift cluster and must be managed with 'oc'."
  errormsg "Current client: ${CLIENT_EXE}"
  errormsg "Please install 'oc' or pass --client-exe /path/to/oc."
  exit 1
fi

##############################################################################
# Debug output
##############################################################################

debug "CLIENT_EXE=${CLIENT_EXE}"
debug "LIGHTSPEED_NAMESPACE=${LIGHTSPEED_NAMESPACE}"
debug "LIGHTSPEED_IMAGE=${LIGHTSPEED_IMAGE}"
debug "LIGHTSPEED_VERSION=${LIGHTSPEED_VERSION}"
debug "OPENAI_TOKEN length=${#OPENAI_TOKEN}"
debug "LLM_PROVIDER_URL=${LLM_PROVIDER_URL}"
debug "LLM_MODEL=${LLM_MODEL}"
debug "TIMEOUT=${TIMEOUT}"

##############################################################################
# Main
##############################################################################

if [ -z "${_CMD}" ]; then
  errormsg "Missing command. Use -h for help."
  exit 1
fi

case ${_CMD} in
  install-lightspeed)
    install_lightspeed
    ;;
  uninstall-lightspeed)
    uninstall_lightspeed
    ;;
  status-lightspeed)
    status_lightspeed
    ;;
  *)
    errormsg "Unknown command: ${_CMD}"
    exit 1
    ;;
esac
