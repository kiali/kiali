#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
cd "${SCRIPT_DIR}/.."

# -----------------------------------------------------------------------------
# Pretty output helpers (colors only when stdout is a TTY and NO_COLOR unset)
# -----------------------------------------------------------------------------
if [[ -t 1 ]] && [[ -z "${NO_COLOR:-}" ]]; then
  _bold="\033[1m"
  _cyan="\033[36m"
  _green="\033[32m"
  _yellow="\033[33m"
  _reset="\033[0m"
else
  _bold=""
  _cyan=""
  _green=""
  _yellow=""
  _reset=""
fi

section() {
  echo ""
  echo -e "${_bold}${_cyan}=== $* ===${_reset}"
}

step() {
  echo -e "${_bold}[*]${_reset} $*"
}

success() {
  echo -e "${_green}[OK]${_reset} $*"
}

wait_msg() {
  echo -e "${_yellow}[..]${_reset} $*"
}

# -----------------------------------------------------------------------------
# Parse KEY=value arguments and export as env vars
# -----------------------------------------------------------------------------
for arg in "$@"; do
  if [[ "$arg" == *=* ]]; then
    export "$arg"
  fi
done

# -----------------------------------------------------------------------------
# Defaults and validation
# -----------------------------------------------------------------------------
MCP_PLATFORM_DEFAULT="kubernetes"
KUBERNETES_MCP_SERVER_IMAGE="quay.io/containers/kubernetes_mcp_server:latest"
OPENSHIFT_MCP_SERVER_IMAGE="quay.io/redhat-user-workloads/crt-nshift-lightspeed-tenant/openshift-mcp-server@sha256:6d5ad04303cb9ce007c18420483b6005dd1c1154dceb1e3476f61f7eaaf38f6a"
IMAGE_DEFAULT="${KUBERNETES_MCP_SERVER_IMAGE}"
LIGHTSPEED_NAMESPACE=openshift-lightspeed

MCP="${MCP:-${MCP_PLATFORM_DEFAULT}}"
MCP_IMAGE="${MCP_IMAGE:-${IMAGE_DEFAULT}}"

if [[ -z "${API_TOKEN:-}" ]]; then
  echo -e "${_bold}Error:${_reset} API_TOKEN is required."
  echo "Usage: $0 MCP=kubernetes API_TOKEN=your_token"
  exit 1
fi

if [[ "$MCP" != "kubernetes" && "$MCP" != "openshift" ]]; then
  echo -e "${_bold}Usage:${_reset} $0 MCP=[kubernetes|openshift] API_TOKEN=your_token [MCP_IMAGE=image_url]"
  echo "  MCP=kubernetes  - default target platform"
  echo "  MCP=openshift   - use OpenShift-specific settings"
  echo "  MCP_IMAGE=url   - override MCP server image"
  exit 1
fi

if [[ "$MCP" == "kubernetes" ]]; then
  MCP_IMAGE="${KUBERNETES_MCP_SERVER_IMAGE}"
elif [[ "$MCP" == "openshift" ]]; then
  MCP_IMAGE="${OPENSHIFT_MCP_SERVER_IMAGE}"
fi

MCP_NAMESPACE=$MCP-mcp
export MCP_NAMESPACE
export MCP
export MCP_IMAGE

# -----------------------------------------------------------------------------
# Banner and configuration summary
# -----------------------------------------------------------------------------
section "MCP + LightSpeed installation"
step "MCP platform:  ${MCP}"
step "Namespace: ${MCP_NAMESPACE} (MCP), ${LIGHTSPEED_NAMESPACE} (LightSpeed)"
step "MCP image: ${MCP_IMAGE}"
echo ""

# -----------------------------------------------------------------------------
# MCP server namespace and config
# -----------------------------------------------------------------------------
section "MCP server (${MCP})"
step "Creating namespace ${MCP_NAMESPACE}..."
oc create ns $MCP_NAMESPACE 2>/dev/null || true
success "Namespace ${MCP_NAMESPACE} ready"

if [[ "$MCP" == "kubernetes" ]]; then
  CONFIG_FILE=$SCRIPT_DIR/ai/mcp/config.toml
else
  CONFIG_FILE=$SCRIPT_DIR/ai/mcp/openshift_config.toml
fi

step "Creating MCP server ConfigMap..."
oc create configmap $MCP-mcp-server-config --from-file=$CONFIG_FILE -n $MCP_NAMESPACE
success "ConfigMap ${MCP}-mcp-server-config created"

step "Deploying ${MCP}-mcp-server..."
if [[ "$MCP" == "kubernetes" ]]; then
  envsubst '${MCP} ${MCP_IMAGE} ${MCP_NAMESPACE}' < $SCRIPT_DIR/ai/mcp/deployment.yaml | \
    sed '/^        command:$/{n;/^          - "\/.*-mcp-server" *$/d}; /^        command:$/d' | \
    oc apply -n $MCP_NAMESPACE -f -
else
  envsubst '${MCP} ${MCP_IMAGE} ${MCP_NAMESPACE}' < $SCRIPT_DIR/ai/mcp/deployment.yaml | oc apply -n $MCP_NAMESPACE -f -
fi
success "Deployment ${MCP}-mcp-server applied"

step "Creating ServiceAccount and RBAC..."
envsubst '${MCP} ${MCP_NAMESPACE}' < $SCRIPT_DIR/ai/mcp/service_account.yaml | oc apply -n $MCP_NAMESPACE -f -
success "ServiceAccount and RBAC applied"

step "Creating Service and Route..."
envsubst '${MCP} ${MCP_NAMESPACE}' < $SCRIPT_DIR/ai/mcp/mcp_service.yaml | oc apply -n $MCP_NAMESPACE -f -
oc expose service $MCP-mcp-server -n $MCP_NAMESPACE 2>/dev/null || true
success "Service exposed"

# -----------------------------------------------------------------------------
# OpenShift LightSpeed operator and config
# -----------------------------------------------------------------------------
section "OpenShift LightSpeed"
step "Creating namespace ${LIGHTSPEED_NAMESPACE}..."
oc create ns $LIGHTSPEED_NAMESPACE 2>/dev/null || true
success "Namespace ${LIGHTSPEED_NAMESPACE} ready"

step "Creating credentials secret..."
oc create secret generic -n $LIGHTSPEED_NAMESPACE credentials --from-literal=apitoken=$API_TOKEN --dry-run=client -o yaml | oc apply -n $LIGHTSPEED_NAMESPACE -f - >/dev/null
success "Credentials secret configured"

step "Installing LightSpeed Operator (OperatorGroup + Subscription)..."
oc apply -f $SCRIPT_DIR/ai/lightspeed/operator_lightspeed_group.yaml -n $LIGHTSPEED_NAMESPACE
oc apply -f $SCRIPT_DIR/ai/lightspeed/subscription_lightspeed.yaml -n $LIGHTSPEED_NAMESPACE
success "Operator install requested"

wait_msg "Waiting for LightSpeed Operator to be Succeeded (this may take a few minutes)..."
until oc get csv -n $LIGHTSPEED_NAMESPACE 2>/dev/null | grep "^lightspeed-operator" | grep -q "Succeeded"; do
  echo -e "       ${_yellow}still installing... waiting 10s${_reset}"
  sleep 10
done
success "LightSpeed Operator is Succeeded"

step "Applying OLS config and Route..."
envsubst '${MCP} ${MCP_NAMESPACE}' < $SCRIPT_DIR/ai/lightspeed/osl_config.yaml | oc apply -n $LIGHTSPEED_NAMESPACE -f -
oc apply -f $SCRIPT_DIR/ai/lightspeed/route.yaml -n $LIGHTSPEED_NAMESPACE
success "OLS config and Route applied"

# -----------------------------------------------------------------------------
# Done
# -----------------------------------------------------------------------------
section "Installation complete"
echo -e "  MCP server:     ${_bold}${MCP}-mcp-server${_reset} in namespace ${MCP_NAMESPACE}"
echo -e "  LightSpeed:     namespace ${LIGHTSPEED_NAMESPACE} (operator + OLS config)"
echo ""
success "Done."
