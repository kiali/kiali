#!/bin/bash

set -e

is_in_array() {
  local value1="$1"
  local value2="$2"
  shift 2
  local array=($@)

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

requirements=("yq" "helm")
for req in "${requirements[@]}"; do
  ensure_command "$req"
done

ADDONS="prometheus grafana jaeger"
CONFIG_PROFILE=""
CUSTOM_INSTALL_SETTINGS=""
PATCH_FILE=""
WAIT=true
MESH_ID=""
CLUSTER_NAME=""
NETWORK_ID=""

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

helm upgrade sail-operator sail-operator \
  --install \
  --create-namespace \
  --namespace sail-operator \
  --wait \
  --repo https://istio-ecosystem.github.io/sail-operator

# Pin based on Istio version:
ISTIO_MINOR=$(echo "${ISTIO_VERSION:-}" | cut -d. -f1-2)
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
        .spec.values.pilot.env.AMBIENT_ENABLE_MULTI_NETWORK = "true"
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

ISTIO_NAME=$(yq '.metadata.name' <<< "$ISTIO_YAML")
ISTIO_NAMESPACE=$(yq '.spec.namespace' <<< "$ISTIO_YAML")

kubectl get ns "${ISTIO_NAMESPACE}" || kubectl create ns "${ISTIO_NAMESPACE}"

# Label namespace with network if provided
if [ -n "${NETWORK_ID}" ]; then
  echo "Labeling namespace ${ISTIO_NAMESPACE} with network: ${NETWORK_ID}"
  kubectl label namespace "${ISTIO_NAMESPACE}" topology.istio.io/network="${NETWORK_ID}" --overwrite
fi

kubectl apply -f - <<<"$ISTIO_YAML"
if [ "${WAIT}" == "true" ]; then
  kubectl wait --for=condition=Ready istios -l kiali.io/testing --timeout=300s
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
