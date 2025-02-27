#!/bin/bash

set -e

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
CUSTOM_INSTALL_SETTINGS=""
PATCH_FILE=""

# process command line args
while [[ $# -gt 0 ]]; do
  key="$1"
  case $key in
    -a|--addons)
      ADDONS="$2"
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
    -h|--help)
      cat <<HELPMSG
Valid command line arguments:
  -a|--addons <space-separated addon names>:
       The names of the addons you want to install along with the core Istio components.
       Make sure this value is space-separated. Valid addon names can be found in your Istio
       distribution directory samples/addons.
       Default: prometheus grafana jaeger
  -pf|--patch-file <name=value>:
       filepath to a yaml file of an Istio resource that will overlay the default Istio resource.
       --patch-file /path/to/patch-file.yaml
  -s|--set <name=value>:
       Override any part of the Istio yaml providing a yq compatible path for that field.
       Options specified with --set take precedence over --patch-file. Some examples you may want to use:
       --set '.spec.version="v1.22.4"'
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

helm upgrade sail-operator sail-operator \
  --install \
  --create-namespace \
  --namespace sail-operator \
  --repo https://istio-ecosystem.github.io/sail-operator

K8S_GATEWAY_API_VERSION=$(curl --head --silent "https://github.com/kubernetes-sigs/gateway-api/releases/latest" | grep "location: " | awk '{print $2}' | sed "s/.*tag\///g" | cat -v | sed "s/\^M//g")
echo "Installing Gateway API version ${K8S_GATEWAY_API_VERSION}"
kubectl apply -k "github.com/kubernetes-sigs/gateway-api/config/crd/experimental?ref=${K8S_GATEWAY_API_VERSION}"

ISTIO_YAML=$(
cat <<EOF
apiVersion: sailoperator.io/v1alpha1
kind: Istio
metadata:
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
          service: jaeger-collector.istio-system.svc.cluster.local
    global:
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

if [ -n "${PATCH_FILE}" ]; then
  base_yaml=$(mktemp)
  echo "$ISTIO_YAML" > "$base_yaml"
  ISTIO_YAML=$(yq -n "load(\"$base_yaml\") * load(\"$PATCH_FILE\")")
fi

if [ -n "${CUSTOM_INSTALL_SETTINGS}" ]; then
  ISTIO_YAML=$(printf "%s" "$ISTIO_YAML" | yq "$CUSTOM_INSTALL_SETTINGS")
fi

kubectl get ns istio-system || kubectl create ns istio-system

kubectl apply -f - <<<"$ISTIO_YAML"
kubectl wait --for=condition=Ready istios/default -n istio-system --timeout=300s

# Install addons
for addon in ${ADDONS}; do
  istio_version=$(kubectl get istios default -o jsonpath='{.spec.version}')
  # Verison comes in the form v1.23.0 but we want 1.23
  # Remove the 'v' and remove the .0 from 1.23.0 and we should be left with 1.23
  addon_version="${istio_version:1:4}"
  kubectl apply -n istio-system -f "https://raw.githubusercontent.com/istio/istio/refs/heads/release-$addon_version/samples/addons/$addon.yaml"
done

# Activate the otel tracer.
kubectl apply -f - <<EOF
apiVersion: telemetry.istio.io/v1
kind: Telemetry
metadata:
  name: otel-tracing
  namespace: istio-system
spec:
  tracing:
  - providers:
      - name: otel-tracing
    randomSamplingPercentage: 100
EOF
