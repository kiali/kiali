#!/bin/bash
# shellcheck disable=SC2155

##############################################################################
# setup-mcp.sh
#
# Installs a Kubernetes or OpenShift MCP (Model Context Protocol) server
# into a dedicated namespace on a cluster that already has Istio and Kiali
# running.
#
# The script deploys one of two MCP server images:
#   kubernetes  - quay.io/containers/kubernetes_mcp_server
#   openshift   - quay.io/redhat-user-workloads/crt-nshift-lightspeed-tenant/openshift-mcp-server
#
# Prerequisites:
#   - A running Kubernetes/OpenShift cluster accessible via kubectl / oc
#   - Istio installed in istio-system (istiod deployment must be Running)
#   - Kiali installed in istio-system (kiali deployment must be Running)
#
# Usage:
#   ./setup-mcp.sh [options] install-mcp
#   ./setup-mcp.sh [options] uninstall-mcp
#   ./setup-mcp.sh [options] status-mcp
#
##############################################################################

set -e

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &>/dev/null && pwd)"

##############################################################################
# Default values
##############################################################################

DEFAULT_CLIENT_EXE="kubectl"
DEFAULT_MCP_PROVIDER="kubernetes"
DEFAULT_MCP_VERSION="latest"
DEFAULT_ISTIO_NAMESPACE="istio-system"
DEFAULT_TIMEOUT="300"

KUBERNETES_MCP_SERVER_IMAGE="quay.io/containers/kubernetes_mcp_server"
OPENSHIFT_MCP_SERVER_IMAGE="quay.io/redhat-user-workloads/crt-nshift-lightspeed-tenant/openshift-mcp-server"

# Runtime variables
_VERBOSE="false"

##############################################################################
# Helper Functions
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

# Verify that Istio and Kiali pods are Running in istio-system.
# Accepts any pod whose name starts with "istiod" or "kiali" and whose
# STATUS column is "Running".
ensure_kiali_installed() {
  infomsg "Checking that Istio and Kiali are installed in namespace [${ISTIO_NAMESPACE}]..."

  # --- Istio check ---
  local istiod_running
  istiod_running=$(${CLIENT_EXE} get pods -n "${ISTIO_NAMESPACE}" \
    --field-selector=status.phase=Running \
    -o jsonpath='{.items[*].metadata.name}' 2>/dev/null \
    | tr ' ' '\n' | grep -c '^istiod' || true)

  if [ "${istiod_running}" -eq 0 ]; then
    errormsg "No running istiod pod found in namespace [${ISTIO_NAMESPACE}]."
    errormsg "Please install Istio before running this script."
    return 1
  fi
  debug "Found ${istiod_running} running istiod pod(s) in [${ISTIO_NAMESPACE}]"

  # --- Kiali check ---
  local kiali_running
  kiali_running=$(${CLIENT_EXE} get pods -n "${ISTIO_NAMESPACE}" \
    --field-selector=status.phase=Running \
    -o jsonpath='{.items[*].metadata.name}' 2>/dev/null \
    | tr ' ' '\n' | grep -c '^kiali' || true)

  if [ "${kiali_running}" -eq 0 ]; then
    errormsg "No running kiali pod found in namespace [${ISTIO_NAMESPACE}]."
    errormsg "Please install Kiali before running this script."
    return 1
  fi
  debug "Found ${kiali_running} running kiali pod(s) in [${ISTIO_NAMESPACE}]"

  infomsg "Istio and Kiali are installed and running."
  return 0
}

# Create the MCP provider namespace if it does not already exist.
# The namespace name follows the pattern: <MCP_PROVIDER>-mcp
# e.g. kubernetes-mcp or openshift-mcp
ensure_mcp_ns() {
  local ns="${MCP_PROVIDER}-mcp"
  debug "Checking namespace [${ns}]..."

  if ${CLIENT_EXE} get namespace "${ns}" &>/dev/null; then
    infomsg "Namespace [${ns}] already exists."
  else
    infomsg "Namespace [${ns}] not found — creating it..."
    ${CLIENT_EXE} create namespace "${ns}"
    infomsg "Namespace [${ns}] created."
  fi
}

##############################################################################
# Resolve provider-specific values
##############################################################################

resolve_mcp_image() {
  case "${MCP_PROVIDER}" in
    kubernetes)
      echo "${KUBERNETES_MCP_SERVER_IMAGE}:${MCP_VERSION}"
      ;;
    openshift)
      echo "${OPENSHIFT_MCP_SERVER_IMAGE}:${MCP_VERSION}"
      ;;
    *)
      errormsg "Unknown MCP_PROVIDER [${MCP_PROVIDER}]. Valid values: kubernetes, openshift."
      exit 1
      ;;
  esac
}

# Returns the toolset name used in config.toml for the chosen provider:
#   kubernetes → kiali
#   openshift  → ossm
resolve_toolset_name() {
  case "${MCP_PROVIDER}" in
    kubernetes) echo "kiali" ;;
    openshift)  echo "ossm"  ;;
  esac
}

# Returns the container entrypoint command for the chosen provider:
#   kubernetes → /app/kubernetes-mcp-server
#   openshift  → /openshift-mcp-server
resolve_mcp_cmd() {
  case "${MCP_PROVIDER}" in
    kubernetes) echo "/app/kubernetes-mcp-server" ;;
    openshift)  echo "/openshift-mcp-server"      ;;
  esac
}

##############################################################################
# Deployment management
##############################################################################

create_mcp_deployment() {
  local ns="${MCP_PROVIDER}-mcp"
  local template="${SCRIPT_DIR}/mcp/deployment/deployment.yaml"

  if [ ! -f "${template}" ]; then
    errormsg "Deployment template not found: ${template}"
    return 1
  fi

  infomsg "Creating MCP deployment from [${template}] (provider=${MCP_PROVIDER}, image=${MCP_IMAGE})..."
  debug "Deployment ${MCP_PROVIDER}-mcp-server in namespace [${ns}]"

  local tmp_deploy
  tmp_deploy="$(mktemp /tmp/mcp-deployment.XXXXXX.yaml)"
  trap 'rm -f "${tmp_deploy}"' RETURN

  # Export the two placeholder variables the template references.
  # MCP_SERVER_IMAGE maps to MCP_IMAGE so the template stays decoupled from
  # the internal variable name.
  export MCP_PROVIDER
  export MCP_SERVER_IMAGE="${MCP_IMAGE}"
  export MCP_SERVER_CMD="$(resolve_mcp_cmd)"

  envsubst '${MCP_PROVIDER} ${MCP_SERVER_IMAGE} ${MCP_SERVER_CMD}' < "${template}" > "${tmp_deploy}"

  ${CLIENT_EXE} apply -f "${tmp_deploy}" -n "${ns}"

  infomsg "Deployment [${MCP_PROVIDER}-mcp-server] created/updated in namespace [${ns}]."
}

create_mcp_service_account() {
  local ns="${MCP_PROVIDER}-mcp"
  local template="${SCRIPT_DIR}/mcp/deployment/service_account.yaml"

  if [ ! -f "${template}" ]; then
    errormsg "ServiceAccount template not found: ${template}"
    return 1
  fi

  infomsg "Creating MCP service account from [${template}] (provider=${MCP_PROVIDER})..."
  debug "ServiceAccount ${MCP_PROVIDER}-mcp-server in namespace [${ns}]"

  local tmp_sa
  tmp_sa="$(mktemp /tmp/mcp-service-account.XXXXXX.yaml)"
  trap 'rm -f "${tmp_sa}"' RETURN

  export MCP_PROVIDER
  envsubst '${MCP_PROVIDER}' < "${template}" > "${tmp_sa}"

  ${CLIENT_EXE} apply -f "${tmp_sa}" -n "${ns}"

  infomsg "ServiceAccount [${MCP_PROVIDER}-mcp-server] created/updated in namespace [${ns}]."
}

create_mcp_service() {
  local ns="${MCP_PROVIDER}-mcp"
  local template="${SCRIPT_DIR}/mcp/deployment/mcp_service.yaml"

  if [ ! -f "${template}" ]; then
    errormsg "Service template not found: ${template}"
    return 1
  fi

  infomsg "Creating MCP service from [${template}] (provider=${MCP_PROVIDER})..."
  debug "Service ${MCP_PROVIDER}-mcp-server in namespace [${ns}]"

  local tmp_svc
  tmp_svc="$(mktemp /tmp/mcp-service.XXXXXX.yaml)"
  trap 'rm -f "${tmp_svc}"' RETURN

  export MCP_PROVIDER
  envsubst '${MCP_PROVIDER}' < "${template}" > "${tmp_svc}"

  ${CLIENT_EXE} apply -f "${tmp_svc}" -n "${ns}"

  infomsg "Service [${MCP_PROVIDER}-mcp-server] created/updated in namespace [${ns}]."
}

##############################################################################
# Config file management
##############################################################################

# Creates (or updates) the mcp-config ConfigMap from the provider-specific
# template file (config_kubernetes.toml or config_openshift.toml).
# The only dynamic placeholder in those files is ${KIALI_URL}, which is
# substituted at apply time via envsubst so the istio namespace is respected.
create_mcp_config() {
  local ns="${MCP_PROVIDER}-mcp"
  local template="${SCRIPT_DIR}/mcp/deployment/config_${MCP_PROVIDER}.toml"

  if [ ! -f "${template}" ]; then
    errormsg "Config template not found: ${template}"
    return 1
  fi

  export KIALI_URL="https://kiali.${ISTIO_NAMESPACE}:20001/"
  infomsg "Creating MCP config from [${template}] (kiali=${KIALI_URL})..."
  debug "ConfigMap mcp-config in namespace [${ns}]"

  # envsubst only expands ${KIALI_URL} — all other dollar signs in the file
  # are passed through unchanged.  Write to a temp file so --from-file can
  # read the substituted content; the temp file is removed on exit.
  local tmp_config
  tmp_config="$(mktemp /tmp/mcp-config.XXXXXX.toml)"
  trap 'rm -f "${tmp_config}"' RETURN

  envsubst '${KIALI_URL}' < "${template}" > "${tmp_config}"

  ${CLIENT_EXE} create configmap mcp-config \
    --from-file=config.toml="${tmp_config}" \
    -n "${ns}" \
    --dry-run=client -o yaml \
    | ${CLIENT_EXE} apply -f -

  infomsg "ConfigMap [mcp-config] created/updated in namespace [${ns}]."
}

##############################################################################
# Commands
##############################################################################

# Grants cluster-admin to the MCP service account (OpenShift only).
# On plain Kubernetes this step is skipped — the ClusterRole/ClusterRoleBinding
# created by service_account.yaml is sufficient.
grant_mcp_cluster_admin() {
  local ns="${MCP_PROVIDER}-mcp"
  local svc_account="${MCP_PROVIDER}-mcp-server"
  local crb_name="${svc_account}-admin"

  infomsg "Granting cluster-admin to service account [${svc_account}] in namespace [${ns}]..."

  # ClusterRoleBinding — standard Kubernetes RBAC, works with both kubectl and oc
  if ! ${CLIENT_EXE} get clusterrolebinding "${crb_name}" &>/dev/null; then
    ${CLIENT_EXE} create clusterrolebinding "${crb_name}" \
      --clusterrole=cluster-admin \
      --user="${svc_account}"
  else
    debug "ClusterRoleBinding [${crb_name}] already exists"
  fi

  # oc adm policy is OpenShift-only; on plain Kubernetes the ClusterRoleBinding above is sufficient
  if [ "$(basename "${CLIENT_EXE}")" == "oc" ]; then
    ${CLIENT_EXE} adm policy add-cluster-role-to-user cluster-admin \
      "system:serviceaccount:${ns}:${svc_account}"
  fi

  infomsg "cluster-admin granted to [system:serviceaccount:${ns}:${svc_account}]."
}

# Exposes the MCP service and returns the reachable endpoint URL.
#   oc  → creates/reuses an OpenShift Route and returns its HTTP URL
#   kubectl → returns the ClusterIP:port (no external exposure needed for in-cluster use)
expose_mcp_service() {
  local ns="${MCP_PROVIDER}-mcp"
  local svc="${MCP_PROVIDER}-mcp-server"

  if [ "$(basename "${CLIENT_EXE}")" == "oc" ]; then
    # Create the Route only if it does not already exist
    if ! ${CLIENT_EXE} get route "${svc}" -n "${ns}" &>/dev/null; then
      infomsg "Exposing service [${svc}] as an OpenShift Route..."
      ${CLIENT_EXE} expose service "${svc}" -n "${ns}"
    else
      debug "Route [${svc}] already exists in namespace [${ns}]"
    fi

    local host
    host="$(${CLIENT_EXE} get route "${svc}" -n "${ns}" \
      -o jsonpath='{.spec.host}' 2>/dev/null)"
    echo "http://${host}"
  else
    # kubectl — return the ClusterIP:port for in-cluster access
    local cluster_ip
    cluster_ip="$(${CLIENT_EXE} get service "${svc}" -n "${ns}" \
      -o jsonpath='{.spec.clusterIP}' 2>/dev/null)"
    echo "http://${cluster_ip}:8080"
  fi
}

install_mcp() {
  local ns="${MCP_PROVIDER}-mcp"

  ensure_kiali_installed || exit 1

  infomsg "Installing ${MCP_PROVIDER} MCP ${MCP_VERSION}"
  infomsg "  Namespace : ${ns}"
  infomsg "  Image     : ${MCP_IMAGE}"
  infomsg "  Istio Namespace : ${ISTIO_NAMESPACE}"
  infomsg "  Client Exe : ${CLIENT_EXE}"
  infomsg "  MCP Provider : ${MCP_PROVIDER}"
  infomsg "  MCP Version : ${MCP_VERSION}"
  infomsg "  --------------------------------------------------------------------------------"
  infomsg "  "
  ensure_mcp_ns
  create_mcp_service_account
  create_mcp_config
  create_mcp_deployment
  create_mcp_service
  grant_mcp_cluster_admin

  local mcp_endpoint
  mcp_endpoint="$(expose_mcp_service)"

  infomsg "  --------------------------------------------------------------------------------"
  infomsg "  "
  infomsg "  MCP installation complete!"
  infomsg "  "
  infomsg "  MCP endpoint : ${mcp_endpoint}"
  infomsg "  "
  infomsg "  To check status: $0 status-mcp"
  infomsg "  To uninstall: $0 uninstall-mcp"
  infomsg "  "
}

uninstall_mcp() {
  local ns="${MCP_PROVIDER}-mcp"
  infomsg "Uninstalling ${MCP_PROVIDER} MCP from namespace [${ns}]..."

  if ! ${CLIENT_EXE} get namespace "${ns}" &>/dev/null; then
    warnmsg "Namespace [${ns}] does not exist — nothing to uninstall."
    return 0
  fi

  ${CLIENT_EXE} delete deployment "${MCP_PROVIDER}-mcp-server"    -n "${ns}" --ignore-not-found
  ${CLIENT_EXE} delete service    "${MCP_PROVIDER}-mcp-server"    -n "${ns}" --ignore-not-found
  if [ "$(basename "${CLIENT_EXE}")" == "oc" ]; then
    ${CLIENT_EXE} delete route "${MCP_PROVIDER}-mcp-server" -n "${ns}" --ignore-not-found
  fi
  ${CLIENT_EXE} delete configmap  mcp-config                      -n "${ns}" --ignore-not-found
  ${CLIENT_EXE} delete clusterrolebinding "${MCP_PROVIDER}-mcp-server"       --ignore-not-found
  ${CLIENT_EXE} delete clusterrolebinding "${MCP_PROVIDER}-mcp-server-admin" --ignore-not-found
  ${CLIENT_EXE} delete clusterrolebinding "${MCP_PROVIDER}-mcp-server:system:auth-delegator" --ignore-not-found
  ${CLIENT_EXE} delete clusterrole        "${MCP_PROVIDER}-mcp-server" --ignore-not-found
  ${CLIENT_EXE} delete serviceaccount     "${MCP_PROVIDER}-mcp-server" -n "${ns}" --ignore-not-found

  infomsg "Deleting namespace [${ns}]..."
  ${CLIENT_EXE} delete namespace "${ns}" --ignore-not-found

  infomsg "MCP server removed from [${ns}]."
}

status_mcp() {
  local ns="${MCP_PROVIDER}-mcp"
  local svc="${MCP_PROVIDER}-mcp-server"

  infomsg "========================================================"
  infomsg "  MCP Status  (provider=${MCP_PROVIDER}, namespace=${ns})"
  infomsg "========================================================"

  if ! ${CLIENT_EXE} get namespace "${ns}" &>/dev/null; then
    infomsg "  Namespace  : NOT FOUND — MCP is not installed."
    return 0
  fi
  infomsg "  Namespace  : ${ns} (exists)"

  # --- Deployment ---
  echo ""
  infomsg "[ Deployment ]"
  if ${CLIENT_EXE} get deployment "${svc}" -n "${ns}" &>/dev/null; then
    ${CLIENT_EXE} get deployment "${svc}" -n "${ns}"
  else
    warnmsg "  Deployment [${svc}] not found."
  fi

  # --- Pods ---
  echo ""
  infomsg "[ Pods ]"
  ${CLIENT_EXE} get pods -n "${ns}" -o wide 2>/dev/null || warnmsg "  No pods found."

  # --- Service ---
  echo ""
  infomsg "[ Service ]"
  if ${CLIENT_EXE} get service "${svc}" -n "${ns}" &>/dev/null; then
    ${CLIENT_EXE} get service "${svc}" -n "${ns}"
  else
    warnmsg "  Service [${svc}] not found."
  fi

  # --- ConfigMap ---
  echo ""
  infomsg "[ ConfigMap ]"
  if ${CLIENT_EXE} get configmap mcp-config -n "${ns}" &>/dev/null; then
    infomsg "  mcp-config : present"
  else
    warnmsg "  mcp-config : NOT FOUND"
  fi

  # --- Endpoint ---
  echo ""
  infomsg "[ Endpoint ]"
  if [ "$(basename "${CLIENT_EXE}")" == "oc" ]; then
    if ${CLIENT_EXE} get route "${svc}" -n "${ns}" &>/dev/null; then
      local host
      host="$(${CLIENT_EXE} get route "${svc}" -n "${ns}" \
        -o jsonpath='{.spec.host}' 2>/dev/null)"
      infomsg "  Route : http://${host}"
    else
      warnmsg "  Route [${svc}] not found — run install-mcp to create it."
    fi
  else
    local cluster_ip
    cluster_ip="$(${CLIENT_EXE} get service "${svc}" -n "${ns}" \
      -o jsonpath='{.spec.clusterIP}' 2>/dev/null)"
    if [ -n "${cluster_ip}" ]; then
      infomsg "  ClusterIP : http://${cluster_ip}:8080"
    else
      warnmsg "  Service ClusterIP not available."
    fi
  fi

  infomsg "========================================================"
}

##############################################################################
# Argument Parsing
##############################################################################

while [ "$#" -gt 0 ]; do
  key="$1"
  case ${key} in
    install-mcp)   _CMD="install-mcp";   shift ;;
    uninstall-mcp) _CMD="uninstall-mcp"; shift ;;
    status-mcp)    _CMD="status-mcp";    shift ;;
    -ce|--client-exe)
      CLIENT_EXE="$2"; shift; shift ;;
    -p|--provider)
      MCP_PROVIDER="$2"; shift; shift ;;
    -mv|--mcp-version)
      MCP_VERSION="$2"; shift; shift ;;
    -in|--istio-namespace)
      ISTIO_NAMESPACE="$2"; shift; shift ;;
    -t|--timeout)
      TIMEOUT="$2"; shift; shift ;;
    -v|--verbose)
      _VERBOSE="true"; shift ;;
    -h|--help)
      cat <<HELPMSG

$0 [options] command

Installs a Kubernetes or OpenShift MCP server on a cluster that already has
Istio and Kiali running in the istio-system namespace.

Valid options:
  -ce|--client-exe <path>
      The path to the kubectl or oc executable.
      Default: ${DEFAULT_CLIENT_EXE}
  -p|--provider <kubernetes|openshift>
      The MCP server provider to install.
      Default: ${DEFAULT_MCP_PROVIDER}
  -mv|--mcp-version <version>
      The MCP server image tag (e.g. latest, v0.1.2).
      Default: ${DEFAULT_MCP_VERSION}
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
  install-mcp    Install the MCP server into <provider>-mcp namespace.
  uninstall-mcp  Remove the MCP server.
  status-mcp     Show the current status of the MCP server pods.

Examples:
  # Install with defaults (kubernetes provider, latest tag)
  $0 install-mcp

  # Install OpenShift MCP server
  $0 --provider openshift install-mcp

  # Install a specific version with oc
  $0 --client-exe oc --provider openshift --mcp-version v0.2.0 install-mcp

  # Check status
  $0 status-mcp

  # Uninstall
  $0 --provider openshift uninstall-mcp

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
: "${MCP_PROVIDER:=${DEFAULT_MCP_PROVIDER}}"
: "${MCP_VERSION:=${DEFAULT_MCP_VERSION}}"
: "${ISTIO_NAMESPACE:=${DEFAULT_ISTIO_NAMESPACE}}"
: "${TIMEOUT:=${DEFAULT_TIMEOUT}}"

# Resolve the final image reference once, after all variables are set.
# Every function that needs the image uses MCP_IMAGE directly.
MCP_IMAGE="$(resolve_mcp_image)"

##############################################################################
# Validate provider
##############################################################################

case "${MCP_PROVIDER}" in
  kubernetes|openshift) ;;
  *)
    errormsg "Invalid provider [${MCP_PROVIDER}]. Valid values: kubernetes, openshift."
    exit 1
    ;;
esac

##############################################################################
# Debug output
##############################################################################

debug "CLIENT_EXE=${CLIENT_EXE}"
debug "MCP_PROVIDER=${MCP_PROVIDER}"
debug "MCP_VERSION=${MCP_VERSION}"
debug "ISTIO_NAMESPACE=${ISTIO_NAMESPACE}"
debug "TIMEOUT=${TIMEOUT}"
debug "MCP_NAMESPACE=${MCP_PROVIDER}-mcp"
debug "MCP_IMAGE=${MCP_IMAGE}"
debug "TOOLSET=$(resolve_toolset_name)"
debug "MCP_SERVER_CMD=$(resolve_mcp_cmd)"

##############################################################################
# Main
##############################################################################

if [ -z "${_CMD}" ]; then
  errormsg "Missing command. Use -h for help."
  exit 1
fi

case ${_CMD} in
  install-mcp)
    install_mcp
    ;;
  uninstall-mcp)
    uninstall_mcp
    ;;
  status-mcp)
    status_mcp
    ;;
  *)
    errormsg "Unknown command: ${_CMD}"
    exit 1
    ;;
esac
