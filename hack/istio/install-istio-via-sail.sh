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

K8S_GATEWAY_API_VERSION=$(curl --head --silent "https://github.com/kubernetes-sigs/gateway-api/releases/latest" | grep "location: " | awk '{print $2}' | sed "s/.*tag\///g" | cat -v | sed "s/\^M//g")
echo "Verifying that Gateway API is installed; if it is not then Gateway API version ${K8S_GATEWAY_API_VERSION} will be installed now."
kubectl get crd gateways.gateway.networking.k8s.io &> /dev/null || \
  { kubectl kustomize "github.com/kubernetes-sigs/gateway-api/config/crd?ref=${K8S_GATEWAY_API_VERSION}" | kubectl apply -f -; }

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
apiVersion: sailoperator.io/v1alpha1
kind: ZTunnel
metadata:
  name: default
spec:
  profile: ambient
  namespace: ztunnel
  values: {}
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
      meshID: mesh-default
      network: network-default
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
  ISTIO_YAML=$(echo "$ISTIO_YAML" | yq eval '
    .spec.profile = "ambient" |
    .spec.values.pilot.trustedZtunnelNamespace = "ztunnel"
  ' -)
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

kubectl apply -f - <<<"$ISTIO_YAML"
if [ "${WAIT}" == "true" ]; then
  kubectl wait --for=condition=Ready istios -l kiali.io/testing --timeout=300s
fi

if [ "${CONFIG_PROFILE}" == "ambient" ]; then
  echo "Installing CNI for Ambient"
  kubectl get ns "istio-cni" || kubectl create ns "istio-cni"
  kubectl apply -f - <<<"$cniYAML"

  echo "Create ztunnel namespace"
  kubectl get ns "ztunnel" || kubectl create ns "ztunnel"
  kubectl apply -f - <<<"$ztunnelYAML"
fi

# Install addons
for addon in ${ADDONS}; do
  if [ "${addon}" == "tempo" ]; then
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
    echo "Installing tempo"
    ${SCRIPT_DIR}/tempo/install-tempo-env.sh -c kubectl -ot true

    kubectl apply -f https://github.com/open-telemetry/opentelemetry-operator/releases/latest/download/opentelemetry-operator.yaml
    kubectl wait pods --all -n opentelemetry-operator-system --for=condition=Ready --timeout=5m
    # Wait 10 seconds until https://github.com/open-telemetry/opentelemetry-operator/issues/3194 is fixed.
    sleep 10
    kubectl apply -f ${SCRIPT_DIR}/tempo/otel-collector.yaml
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
