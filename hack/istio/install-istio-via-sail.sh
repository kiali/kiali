#!/bin/bash

set -e

is_in_array() {
  local value1="$1"
  local value2="$2"
  shift 2
  local array
  read -r -a array <<< "$*"

  local found1=false
  local found2=false

  for item in "${array[@]}"; do
    [[ "$item" == "$value1" ]] && found1=true
    [[ "$item" == "$value2" ]] && found2=true
  done

  if $found1 && $found2; then
    return 0
  else
    return 1
  fi
}

ensure_command () {
  if ! command -v "$1" &> /dev/null; then
    echo "$1 is required but it is either not installed or not in the PATH."
    exit 1
  fi
}

# Ensures the Istio validating webhook caBundle matches the current istiod certificate.
# istiod updates the mutating webhook caBundle first; if the validating webhook has a stale
# or empty caBundle (e.g. from a previous installation), it is patched to match.
ensure_istiod_validating_webhook_cabundle() {
  local namespace="${1:-istio-system}"
  local timeout_seconds="${2:-120}"
  local sleep_seconds=5
  local elapsed=0
  local attempt=1
  local max_attempts=1
  local validator_config=""
  local validator_index=""
  local mutating_cabundle=""

  if [[ "${timeout_seconds}" =~ ^[0-9]+$ ]] && [ "${timeout_seconds}" -gt 0 ]; then
    max_attempts=$(((timeout_seconds + sleep_seconds - 1) / sleep_seconds))
  fi

  validator_config=$(kubectl get validatingwebhookconfigurations -o json | \
    jq -r '.items[] | select(any(.webhooks[]?; .name=="validation.istio.io" and .clientConfig.service.name=="istiod" and .clientConfig.service.namespace=="'"${namespace}"'")) | .metadata.name' | head -n1)
  if [ -z "${validator_config}" ]; then
    echo "WARNING: No Istio validating webhook configuration found in namespace [${namespace}]"
    return 0
  fi

  validator_index=$(kubectl get validatingwebhookconfiguration "${validator_config}" -o json | \
    jq -r '.webhooks | to_entries[] | select(.value.name=="validation.istio.io") | .key')
  if [ -z "${validator_index}" ]; then
    echo "WARNING: validation.istio.io webhook not found in configuration [${validator_config}]"
    return 0
  fi

  while [ "${elapsed}" -lt "${timeout_seconds}" ]; do
    mutating_cabundle=$(kubectl get mutatingwebhookconfigurations -o json | \
      jq -r '.items[] | .webhooks[]? | select(.clientConfig.service.name=="istiod" and .clientConfig.service.namespace=="'"${namespace}"'" and (.clientConfig.caBundle | length) > 0) | .clientConfig.caBundle' | head -n1)

    if [ -n "${mutating_cabundle}" ] && [ "${mutating_cabundle}" != "null" ]; then
      validator_cabundle=$(kubectl get validatingwebhookconfiguration "${validator_config}" -o json | \
        jq -r '.webhooks['"${validator_index}"'].clientConfig.caBundle // ""')

      if [ "${validator_cabundle}" == "${mutating_cabundle}" ]; then
        echo "Istio validating webhook caBundle is in sync with mutating webhook in [${validator_config}]"
        return 0
      fi

      echo "Istio validating webhook caBundle is stale or empty in [${validator_config}]; syncing from mutating webhook"
      kubectl patch validatingwebhookconfiguration "${validator_config}" --type='json' \
        -p="[{\"op\":\"replace\",\"path\":\"/webhooks/${validator_index}/clientConfig/caBundle\",\"value\":\"${mutating_cabundle}\"}]"

      validator_cabundle=$(kubectl get validatingwebhookconfiguration "${validator_config}" -o json | \
        jq -r '.webhooks['"${validator_index}"'].clientConfig.caBundle // ""')
      if [ "${validator_cabundle}" == "${mutating_cabundle}" ]; then
        echo "Istio validating webhook caBundle synced successfully in [${validator_config}]"
        return 0
      fi

      echo "ERROR: Istio validating webhook caBundle still does not match after patching in [${validator_config}]"
      return 1
    fi

    echo "Waiting for Istio mutating webhook caBundle in namespace [${namespace}] (${attempt}/${max_attempts})"
    sleep "${sleep_seconds}"
    elapsed=$((elapsed + sleep_seconds))
    attempt=$((attempt + 1))
  done

  echo "ERROR: Could not find a non-empty Istio mutating webhook caBundle in namespace [${namespace}]"
  return 1
}

requirements=("jq" "yq" "helm")
for req in "${requirements[@]}"; do
  ensure_command "$req"
done

ADDONS="prometheus grafana jaeger"
CONFIG_PROFILE=""
CUSTOM_INSTALL_SETTINGS=""
IPTABLES_BACKEND="auto"
PATCH_FILE=""
WAIT=true
MESH_ID=""
CLUSTER_NAME=""
NETWORK_ID=""

# Sail operator install source configuration.
# These can be provided via environment variables (preferred for multicluster scripts)
# or via command line args (useful for direct/manual usage).
SAIL_OPERATOR_HELM_REPO="${SAIL_OPERATOR_HELM_REPO:-https://istio-ecosystem.github.io/sail-operator}"
SAIL_OPERATOR_CHART_VERSION="${SAIL_OPERATOR_CHART_VERSION:-}"
SAIL_OPERATOR_GIT_REPO="${SAIL_OPERATOR_GIT_REPO:-https://github.com/istio-ecosystem/sail-operator.git}"
SAIL_OPERATOR_GIT_REF="${SAIL_OPERATOR_GIT_REF:-}"

# process command line args
while [[ $# -gt 0 ]]; do
  key="$1"
  case $key in
    -a|--addons)
      ADDONS="$2"
      shift;shift
      ;;
    -cp|--config-profile)
      CONFIG_PROFILE="$2"
      shift;shift
      ;;
    -pf|--patch-file)
      PATCH_FILE="$2"
      shift;shift
      ;;
    -s|--set)
      if [ -n "${CUSTOM_INSTALL_SETTINGS}" ]; then
        CUSTOM_INSTALL_SETTINGS="${CUSTOM_INSTALL_SETTINGS} | $2"
      else
        CUSTOM_INSTALL_SETTINGS="$2"
      fi
      shift;shift
      ;;
    -w|--wait)
      WAIT="$2"
      shift;shift
      ;;
    -m|--mesh-id)
      MESH_ID="$2"
      shift;shift
      ;;
    -cn|--cluster-name)
      CLUSTER_NAME="$2"
      shift;shift
      ;;
    -n|--network)
      NETWORK_ID="$2"
      shift;shift
      ;;
    -ib|--iptables-backend)
      if [ "${2}" == "auto" ] || [ "${2}" == "legacy" ] || [ "${2}" == "nft" ] || [ "${2}" == "default" ]; then
        IPTABLES_BACKEND="$2"
      else
        echo "ERROR: The --iptables-backend flag must be 'auto', 'legacy', 'nft', or 'default'"
        exit 1
      fi
      shift;shift
      ;;
    --sail-operator-helm-repo)
      SAIL_OPERATOR_HELM_REPO="$2"
      shift;shift
      ;;
    --sail-operator-chart-version)
      SAIL_OPERATOR_CHART_VERSION="$2"
      shift;shift
      ;;
    --sail-operator-git-repo)
      SAIL_OPERATOR_GIT_REPO="$2"
      shift;shift
      ;;
    --sail-operator-git-ref)
      SAIL_OPERATOR_GIT_REF="$2"
      shift;shift
      ;;
    -h|--help)
      cat <<HELPMSG
Valid command line arguments:
  -a|--addons <space-separated addon names>:
       The names of the addons you want to install along with the core Istio components.
       Make sure this value is space-separated. Valid addon names can be found in your Istio
       distribution directory samples/addons and tempo. tempo and jaeger are not allowed at once.
       Default: prometheus grafana jaeger
  -cp|--config-profile <name>:
       istio config profile. Just default and ambient are valid values.
  -pf|--patch-file <name=value>:
       filepath to a yaml file of an Istio resource that will overlay the default Istio resource.
       --patch-file /path/to/patch-file.yaml
  -s|--set <name=value>:
       Override any part of the Istio yaml providing a yq compatible path for that field.
       Options specified with --set take precedence over --patch-file. Some examples you may want to use:
       --set '.spec.version="v1.22.4"'
  -w|--wait <true|false>:
       If true, will wait until istiod is ready.
       Default: true
  -m|--mesh-id <mesh-id>:
       Mesh ID for multicluster setup. Required for multicluster configurations.
  -cn|--cluster-name <cluster-name>:
       Cluster name for multicluster setup. Required for multicluster configurations.
  -n|--network <network-id>:
       Network ID for multicluster setup. Required for multicluster configurations.
  -ib|--iptables-backend (auto|legacy|nft|default):
       Which iptables backend the Istio sidecar istio-init containers should use.
       'auto' runs a short-lived detection pod after Istio is installed (using the deployed
       proxyv2 image) and forces the legacy backend only if the cluster node kernels cannot
       use the nftables backend (e.g. some minikube kvm2 kernels ship without the nf_tables
       module, which crash-loops every sidecar-injected pod).
       'legacy' or 'nft' always forces that backend; 'default' never forces one (Istio's own
       detection decides). If the detection itself fails, the script exits with an error -
       pass 'legacy', 'nft' or 'default' to bypass the detection. Detection is also skipped
       if FORCE_IPTABLES_BINARY is already set in the Istio configuration (e.g. via --set
       or --patch-file), or on OpenShift (its nodes always support nftables).
       Default: auto
  --sail-operator-helm-repo <url>:
       Helm repository URL where the Sail Operator chart is hosted.
       Default: ${SAIL_OPERATOR_HELM_REPO}
  --sail-operator-chart-version <version>:
       Sail Operator Helm chart version to install (useful for RCs if published in the chart repo).
       Example: 1.27.0-rc.0
       Default: <latest>
  --sail-operator-git-repo <url>:
       Git repository URL for Sail Operator (used when --sail-operator-git-ref is set).
       Default: ${SAIL_OPERATOR_GIT_REPO}
  --sail-operator-git-ref <ref>:
       Install Sail Operator Helm chart directly from a git ref (branch or tag).
       This is useful to test Sail 'main/master' before a release is cut.
       Examples: main, master, v1.27.0-rc.0
       Default: <unset> (install from Helm repo)
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

if is_in_array "tempo" "jaeger" "${ADDONS}"; then
    echo "Tempo and Jaeger cannot be enabled at the same time"
    exit 1
fi

# Install Sail operator using one of two methods:
# 1. From a git ref (e.g., main/master branch or RC tag) - useful for testing unreleased versions
# 2. From a Helm repository (default) - standard installation method
if [ -n "${SAIL_OPERATOR_GIT_REF}" ]; then
  # Method 1: Install from git ref
  echo "Installing Sail operator from git ref: ${SAIL_OPERATOR_GIT_REF} (${SAIL_OPERATOR_GIT_REPO})"
  TEMP_DIR=$(mktemp -d)
  trap 'rm -rf "${TEMP_DIR}"' EXIT

  git clone --depth 1 --branch "${SAIL_OPERATOR_GIT_REF}" "${SAIL_OPERATOR_GIT_REPO}" "${TEMP_DIR}"

  helm upgrade sail-operator "${TEMP_DIR}/chart" \
    --install \
    --create-namespace \
    --namespace sail-operator \
    --wait
else
  # Method 2: Install from Helm repository (default)
  # Pin Sail operator chart version to match Istio major.minor so we install a compatible
  # operator. Without this, Helm installs the latest chart, which can break CI for older branches.
  ISTIO_MINOR=$(echo "${ISTIO_VERSION:-}" | cut -d. -f1-2)
  SAIL_CHART_VERSION=""

  # If user provided an explicit chart version, use it. Otherwise, auto-detect based on Istio version.
  if [ -n "${SAIL_OPERATOR_CHART_VERSION}" ]; then
    SAIL_CHART_VERSION="${SAIL_OPERATOR_CHART_VERSION}"
    echo "Using explicitly configured Sail operator chart version: ${SAIL_CHART_VERSION}"
  elif [ -n "${ISTIO_MINOR}" ]; then
    # Auto-detect latest compatible version for this Istio minor
    SAIL_INDEX=$(curl -sL "${SAIL_OPERATOR_HELM_REPO}/index.yaml" 2>/dev/null) || true
    if [ -n "${SAIL_INDEX}" ]; then
      SAIL_CHART_VERSION=$(echo "${SAIL_INDEX}" | yq '.entries.sail-operator[].version' - 2>/dev/null | grep -E "^${ISTIO_MINOR}\." | sort -V | tail -1) || true
    fi
    if [ -n "${SAIL_CHART_VERSION}" ]; then
      echo "Auto-detected Sail operator chart version ${SAIL_CHART_VERSION} for Istio ${ISTIO_VERSION:-}"
    fi
  fi

  helm upgrade sail-operator sail-operator \
    --install \
    --create-namespace \
    --namespace sail-operator \
    --wait \
    --repo "${SAIL_OPERATOR_HELM_REPO}" \
    ${SAIL_CHART_VERSION:+--version "$SAIL_CHART_VERSION"}
fi

# Pin Gateway API version based on Istio version:
case "${ISTIO_MINOR}" in
  1.23) K8S_GATEWAY_API_VERSION="v1.1.0" ;;
  1.26) K8S_GATEWAY_API_VERSION="v1.3.0" ;;
  *)    K8S_GATEWAY_API_VERSION=$(curl --head --silent "https://github.com/kubernetes-sigs/gateway-api/releases/latest" | grep "location: " | awk '{print $2}' | sed "s/.*tag\///g" | cat -v | sed "s/\^M//g") ;;
esac

echo "Verifying that Gateway API is installed; if it is not then Gateway API version ${K8S_GATEWAY_API_VERSION} will be installed now."
kubectl get crd gateways.gateway.networking.k8s.io &> /dev/null || \
  {
    echo "Installing Gateway API CRDs with retry logic..."
    RETRY_COUNT=0
    MAX_RETRIES=30
    RETRY_INTERVAL=60
    while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
      echo "Attempt $((RETRY_COUNT + 1))/$MAX_RETRIES: Installing Gateway API CRDs..."
      if kubectl kustomize "github.com/kubernetes-sigs/gateway-api/config/crd?ref=${K8S_GATEWAY_API_VERSION}" | kubectl apply -f -; then
        echo "Gateway API CRDs installed successfully."
        break
      else
        RETRY_COUNT=$((RETRY_COUNT + 1))
        if [ $RETRY_COUNT -lt $MAX_RETRIES ]; then
          echo "Failed to install Gateway API CRDs. Retrying in ${RETRY_INTERVAL} seconds..."
          sleep $RETRY_INTERVAL
        else
          echo "Failed to install Gateway API CRDs after $MAX_RETRIES attempts. Exiting."
          exit 1
        fi
      fi
    done
  }

K8S_GATEWAY_API_IE_VERSION=$(curl --head --silent "https://github.com/kubernetes-sigs/gateway-api-inference-extension/releases/latest" | grep "location: " | awk '{print $2}' | sed "s/.*tag\///g" | cat -v | sed "s/\^M//g")
echo "Verifying that Gateway API Inference Extension is installed; if it is not then Gateway API Inference Extension version ${K8S_GATEWAY_API_IE_VERSION} will be installed now."
kubectl get crd inferencepools.inference.networking.k8s.io &> /dev/null || \
  {
    echo "Installing Gateway API Inference Extension CRDs with retry logic..."
    RETRY_COUNT=0
    MAX_RETRIES=30
    RETRY_INTERVAL=60
    while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
      echo "Attempt $((RETRY_COUNT + 1))/$MAX_RETRIES: Installing Gateway API Inference Extension CRDs..."
      if kubectl kustomize "github.com/kubernetes-sigs/gateway-api-inference-extension/config/crd?ref=${K8S_GATEWAY_API_IE_VERSION}" | kubectl apply -f -; then
        echo "Gateway API Inference Extension CRDs installed successfully."
        break
      else
        RETRY_COUNT=$((RETRY_COUNT + 1))
        if [ $RETRY_COUNT -lt $MAX_RETRIES ]; then
          echo "Failed to install Gateway API Inference Extension CRDs. Retrying in ${RETRY_INTERVAL} seconds..."
          sleep $RETRY_INTERVAL
        else
          echo "Failed to install Gateway API Inference Extension CRDs after $MAX_RETRIES attempts. Exiting."
          exit 1
        fi
      fi
    done
  }

SERVICE="jaeger-collector.istio-system.svc.cluster.local"
if is_in_array "tempo" "tempo" "${ADDONS}"; then
  SERVICE=otel-collector.istio-system.svc.cluster.local
fi

if [ "${CONFIG_PROFILE}" == "ambient" ]; then
cniYAML=$(
cat <<EOF
apiVersion: sailoperator.io/v1
kind: IstioCNI
metadata:
  name: default
spec:
  values:
    cni:
      ambient:
        dnsCapture: true
  profile: ambient
  namespace: istio-cni
EOF
)

ztunnelYAML=$(
cat <<EOF
apiVersion: sailoperator.io/v1
kind: ZTunnel
metadata:
  name: default
spec:
  namespace: ztunnel
EOF
)

fi

ISTIO_YAML=$(
cat <<EOF
apiVersion: sailoperator.io/v1
kind: Istio
metadata:
  labels:
    kiali.io/testing: ""
  name: default
spec:
  namespace: istio-system
  updateStrategy:
    type: InPlace
  values:
    meshConfig:
      enableTracing: true
      extensionProviders:
      - name: otel-tracing
        opentelemetry:
          port: 4317
          service: ${SERVICE}
    global:
      meshID: ${MESH_ID:-mesh-default}
      network: ${NETWORK_ID:-network-default}
      proxy:
        resources:
          requests:
            cpu: 1m
            memory: 1Mi
      proxy_init:
        resources:
          requests:
            cpu: 1m
            memory: 1Mi
    pilot:
      resources:
        requests:
          cpu: 1m
          memory: 1Mi
EOF
)

if [ "${CONFIG_PROFILE}" == "ambient" ]; then
  # Configure ambient profile
  ISTIO_YAML=$(echo "$ISTIO_YAML" | yq eval '
    .spec.profile = "ambient" |
    .spec.values.pilot.trustedZtunnelNamespace = "ztunnel"
  ' -)

  # Add multicluster configuration if provided
  if [ -n "${CLUSTER_NAME}" ]; then
    ISTIO_YAML=$(echo "$ISTIO_YAML" | yq eval '
        .spec.values.global.multiCluster.clusterName = "'"${CLUSTER_NAME}"'" |
        .spec.values.pilot.env.AMBIENT_ENABLE_MULTI_NETWORK = "true" |
        .spec.values.pilot.env.AMBIENT_ENABLE_BAGGAGE = "true"
    ' -)
    ztunnelYAML=$(echo "$ztunnelYAML" | yq eval '
       .spec.values.ztunnel.multiCluster.clusterName = "'"${CLUSTER_NAME}"'" |
       .spec.values.ztunnel.network = "'"${NETWORK_ID:-network-default}"'"
    ' -)
  else
    ztunnelYAML=$(echo "$ztunnelYAML" | yq eval '
      .spec.values = {}
    ' -)
  fi
else
  ISTIO_YAML=$(echo "$ISTIO_YAML" | yq eval '
    .spec.values.global.multiCluster.clusterName = "cluster-default"
  ' -)
fi

if [ -n "${PATCH_FILE}" ]; then
  base_yaml=$(mktemp)
  echo "$ISTIO_YAML" > "$base_yaml"
  ISTIO_YAML=$(yq -n "load(\"$base_yaml\") * load(\"$PATCH_FILE\")")
fi

if [ -n "${CUSTOM_INSTALL_SETTINGS}" ]; then
  ISTIO_YAML=$(printf "%s" "$ISTIO_YAML" | yq "$CUSTOM_INSTALL_SETTINGS")
fi

REQUESTED_VERSION=$(yq '.spec.version // ""' <<< "$ISTIO_YAML")
if [ "${SAIL_OPERATOR_GIT_REF}" == "main" ]; then
  # When testing Sail main, let Sail choose its default supported version.
  ISTIO_YAML=$(echo "$ISTIO_YAML" | yq 'del(.spec.version)' -)
  echo "Sail operator git ref is 'main'; ignoring requested Istio version (${REQUESTED_VERSION:-<unset>}) and letting Sail select the default version."
elif [[ -n "$REQUESTED_VERSION" && "$REQUESTED_VERSION" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  MINOR="${REQUESTED_VERSION#v}"
  MINOR="${MINOR%.*}"
  SAIL_VERSION="v${MINOR}-latest"
  ISTIO_YAML=$(echo "$ISTIO_YAML" | yq ".spec.version = \"${SAIL_VERSION}\"" -)
  echo "Mapping Istio version ${REQUESTED_VERSION} to ${SAIL_VERSION} (Sail CRD only allows specific versions per minor; using -latest)"
fi

FINAL_VERSION="$(yq '.spec.version // ""' <<< "$ISTIO_YAML")"
if [ -n "${FINAL_VERSION}" ]; then
  echo "Sail Istio CR version to apply: ${FINAL_VERSION} (requested: ${REQUESTED_VERSION:-<unset>})"
else
  echo "Sail Istio CR spec.version is not set; Sail operator default version will be used."
fi

ISTIO_NAME=$(yq '.metadata.name' <<< "$ISTIO_YAML")
ISTIO_NAMESPACE=$(yq '.spec.namespace' <<< "$ISTIO_YAML")

kubectl get ns "${ISTIO_NAMESPACE}" || kubectl create ns "${ISTIO_NAMESPACE}"

# Label namespace with network if provided
if [ -n "${NETWORK_ID}" ]; then
  echo "Labeling namespace ${ISTIO_NAMESPACE} with network: ${NETWORK_ID}"
  kubectl label namespace "${ISTIO_NAMESPACE}" topology.istio.io/network="${NETWORK_ID}" --overwrite
fi

# Determine which iptables backend the Istio sidecar istio-init containers should use.
# Some minimal node kernels (e.g. certain minikube kvm2 kernels) ship without the nf_tables
# kernel module. Istio's istio-init defaults to the nftables iptables backend and fails there
# with "Could not fetch rule set generation id: Invalid argument", crash-looping every
# sidecar-injected pod. FORCE_IPTABLES_BINARY (read by istio-init and istio-cni, and passed to
# injected sidecars through meshConfig.defaultConfig.proxyMetadata) forces the legacy backend
# when nftables is unusable. The detection itself runs after Istio is installed (see below) so
# that the deployed istiod image can be used to build the detection pod image.
RUN_NFT_DETECTION="false"
if [ "${IPTABLES_BACKEND}" == "legacy" ] || [ "${IPTABLES_BACKEND}" == "nft" ]; then
  echo "Forcing the iptables backend of Istio sidecars to [${IPTABLES_BACKEND}]"
  ISTIO_YAML=$(printf "%s" "${ISTIO_YAML}" | yq ".spec.values.meshConfig.defaultConfig.proxyMetadata.FORCE_IPTABLES_BINARY = \"${IPTABLES_BACKEND}\"")
elif [ "${IPTABLES_BACKEND}" != "auto" ]; then
  echo "Not forcing an iptables backend for Istio sidecars (iptables-backend=${IPTABLES_BACKEND})"
elif kubectl api-versions | grep --quiet "route.openshift.io"; then
  echo "OpenShift cluster detected - its nodes always support the nftables iptables backend; skipping detection"
elif [ -n "$(printf "%s" "${ISTIO_YAML}" | yq '.spec.values.meshConfig.defaultConfig.proxyMetadata.FORCE_IPTABLES_BINARY // ""')" ]; then
  echo "FORCE_IPTABLES_BINARY is already set in the Istio configuration - skipping nftables detection"
else
  RUN_NFT_DETECTION="true"
fi

kubectl apply -f - <<<"$ISTIO_YAML"
if [ "${WAIT}" == "true" ]; then
  echo "Waiting for Istio to be ready..."
  kubectl wait --for=condition=Ready istios -l kiali.io/testing --timeout=300s
  ensure_istiod_validating_webhook_cabundle "${ISTIO_NAMESPACE}" 300
fi

if [ "${RUN_NFT_DETECTION}" == "true" ]; then
  # The detection pod needs an image containing the iptables binaries; build it from the
  # deployed istiod image (the proxyv2 image from the same hub/tag is what sidecars use).
  # Override with the IPTABLES_DETECT_IMAGE environment variable to use a different image.
  DETECT_IMAGE="${IPTABLES_DETECT_IMAGE:-}"
  if [ -z "${DETECT_IMAGE}" ]; then
    ISTIOD_IMAGE=""
    for _ in $(seq 1 30); do
      ISTIOD_IMAGE=$(kubectl get deployments -n "${ISTIO_NAMESPACE}" -l istio=pilot -o jsonpath='{.items[0].spec.template.spec.containers[0].image}' 2>/dev/null || true)
      [ -n "${ISTIOD_IMAGE}" ] && break
      sleep 2
    done
    DETECT_IMAGE=$(echo "${ISTIOD_IMAGE}" | sed 's|/pilot:|/proxyv2:|')
    if [ -z "${ISTIOD_IMAGE}" ] || [ "${DETECT_IMAGE}" == "${ISTIOD_IMAGE}" ]; then
      echo "ERROR: Could not determine a proxyv2 image from the istiod deployment [${ISTIOD_IMAGE:-not found}]."
      echo "       Fix the cause of the failure, or bypass the detection by explicitly choosing an"
      echo "       iptables backend via --iptables-backend (one of: legacy, nft, default)."
      exit 1
    fi
  fi
  DETECT_POD="kiali-nft-detect"
  DETECT_POD_YAML=$(cat <<DETECTPOD
apiVersion: v1
kind: Pod
metadata:
  name: ${DETECT_POD}
  namespace: ${ISTIO_NAMESPACE}
spec:
  restartPolicy: Never
  containers:
  - name: nft-detect
    image: ${DETECT_IMAGE}
    command: ["sh", "-c", "iptables-nft -L -n >/dev/null 2>&1 && echo NFT_SUPPORTED || echo NFT_UNSUPPORTED"]
    securityContext:
      capabilities:
        add: ["NET_ADMIN", "NET_RAW"]
DETECTPOD
)
  echo "Detecting whether the cluster nodes support the nftables iptables backend (image: ${DETECT_IMAGE})..."
  kubectl delete pod ${DETECT_POD} -n "${ISTIO_NAMESPACE}" --ignore-not-found=true >/dev/null 2>&1 || true
  # stderr is not suppressed so apply errors (e.g. RBAC or Pod Security denials) are visible
  if ! printf "%s" "${DETECT_POD_YAML}" | kubectl apply -f - >/dev/null; then
    echo "ERROR: Failed to create the nftables detection pod [${DETECT_POD}] in namespace [${ISTIO_NAMESPACE}]."
    echo "       Fix the cause of the failure, or bypass the detection by explicitly choosing an"
    echo "       iptables backend via --iptables-backend (one of: legacy, nft, default)."
    exit 1
  fi
  NFT_DETECT_RESULT=""
  for _ in $(seq 1 30); do
    NFT_DETECT_RESULT=$(kubectl logs -n "${ISTIO_NAMESPACE}" "${DETECT_POD}" 2>/dev/null | head -n1 || true)
    [ -n "${NFT_DETECT_RESULT}" ] && break
    sleep 2
  done
  if [ -z "${NFT_DETECT_RESULT}" ]; then
    # the pod never produced output - report why (e.g. ImagePullBackOff, scheduling failures, quota)
    DETECT_POD_PHASE=$(kubectl get pod "${DETECT_POD}" -n "${ISTIO_NAMESPACE}" -o jsonpath='{.status.phase}' 2>/dev/null || true)
    DETECT_POD_REASON=$(kubectl get pod "${DETECT_POD}" -n "${ISTIO_NAMESPACE}" -o jsonpath='{.status.containerStatuses[0].state.waiting.reason}' 2>/dev/null || true)
    kubectl delete pod "${DETECT_POD}" -n "${ISTIO_NAMESPACE}" --wait=false >/dev/null 2>&1 || true
    echo "ERROR: The nftables detection pod [${DETECT_POD}] did not produce any output"
    echo "       (pod phase: ${DETECT_POD_PHASE:-unknown}; waiting reason: ${DETECT_POD_REASON:-unknown})."
    echo "       Fix the cause of the failure, or bypass the detection by explicitly choosing an"
    echo "       iptables backend via --iptables-backend (one of: legacy, nft, default)."
    exit 1
  fi
  kubectl delete pod "${DETECT_POD}" -n "${ISTIO_NAMESPACE}" --wait=false >/dev/null 2>&1 || true
  if [[ "${NFT_DETECT_RESULT}" == *NFT_UNSUPPORTED* ]]; then
    echo "The nftables iptables backend is NOT usable on the cluster nodes - forcing Istio sidecars to use the legacy iptables backend"
    kubectl patch istios "${ISTIO_NAME}" --type merge -p '{"spec":{"values":{"meshConfig":{"defaultConfig":{"proxyMetadata":{"FORCE_IPTABLES_BINARY":"legacy"}}}}}}'
    # Wait until the mesh configuration (which feeds the sidecar injector) has picked it up.
    for _ in $(seq 1 30); do
      if kubectl get cm istio -n "${ISTIO_NAMESPACE}" -o jsonpath='{.data.mesh}' 2>/dev/null | grep --quiet FORCE_IPTABLES_BINARY; then
        echo "The Istio mesh configuration now forces the legacy iptables backend for sidecars"
        break
      fi
      sleep 2
    done
  elif [[ "${NFT_DETECT_RESULT}" == *NFT_SUPPORTED* ]]; then
    echo "The nftables iptables backend is usable on the cluster nodes"
  else
    echo "ERROR: Unexpected output from the nftables detection pod: [${NFT_DETECT_RESULT}]"
    echo "       Bypass the detection by explicitly choosing an iptables backend via"
    echo "       --iptables-backend (one of: legacy, nft, default)."
    exit 1
  fi
fi

if [ "${CONFIG_PROFILE}" == "ambient" ]; then
  echo "Installing CNI for Ambient"
  kubectl get ns "istio-cni" || kubectl create ns "istio-cni"
  if [ -n "${NETWORK_ID}" ]; then
    echo "Labeling namespace istio-cni with network: ${NETWORK_ID}"
    kubectl label namespace "istio-cni" topology.istio.io/network="${NETWORK_ID}" --overwrite
  fi

  kubectl apply -f - <<<"$cniYAML"

  echo "Installing ztunnel for Ambient (must be installed before CNI)"
  kubectl get ns "ztunnel" || kubectl create ns "ztunnel"
  if [ -n "${NETWORK_ID}" ]; then
      echo "Labeling namespace ztunnel with network: ${NETWORK_ID}"
      kubectl label namespace "ztunnel" topology.istio.io/network="${NETWORK_ID}" --overwrite
  fi

  echo "Applying ztunnel configuration..."
  echo "ZTunnel YAML:"
  echo "$ztunnelYAML"
  kubectl apply -f - <<<"$ztunnelYAML"
fi

# Install addons
for addon in ${ADDONS}; do
  if [ "${addon}" == "tempo" ]; then
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
    echo "Installing tempo"
    ${SCRIPT_DIR}/tempo/install-tempo-env.sh -c kubectl -ot true

    kubectl apply -f https://github.com/open-telemetry/opentelemetry-operator/releases/latest/download/opentelemetry-operator.yaml
    kubectl -n opentelemetry-operator-system wait deployment --all --for=condition=Available --timeout=5m
    # Wait 10 seconds until https://github.com/open-telemetry/opentelemetry-operator/issues/3194 is fixed.
    sleep 10
    kubectl apply -f ${SCRIPT_DIR}/tempo/resources/otel-collector.yaml
  else
    istio_version=$(kubectl get istios "${ISTIO_NAME}" -o jsonpath='{.spec.version}')
    # Verison comes in the form v1.23.0 but we want 1.23
    # Remove the 'v' and remove the .0 from 1.23.0 and we should be left with 1.23
    addon_version="${istio_version:1:4}"
    curl -s "https://raw.githubusercontent.com/istio/istio/refs/heads/release-$addon_version/samples/addons/$addon.yaml" | \
      yq "select(.metadata) | .metadata.namespace = \"${ISTIO_NAMESPACE}\"" - | \
      kubectl apply -n "${ISTIO_NAMESPACE}" -f -
  fi
done

# Activate the otel tracer if the extension provider is present in meshConfig
if [ "$(kubectl get istios default -o jsonpath='{.spec.values.meshConfig.extensionProviders[?(@.name=="otel-tracing")]}')" != "" ]; then
  kubectl apply -f - <<EOF
apiVersion: telemetry.istio.io/v1
kind: Telemetry
metadata:
  name: otel-tracing
  namespace: ${ISTIO_NAMESPACE}
spec:
  tracing:
  - providers:
      - name: otel-tracing
    randomSamplingPercentage: 100
EOF
fi
