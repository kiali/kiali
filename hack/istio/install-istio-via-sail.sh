#!/bin/bash

set -e

if ! command -v yq &> /dev/null; then
  echo "yq is required but it is either not installed or not in the PATH."
  exit 1
fi

CUSTOM_INSTALL_SETTINGS=""
PATCH_FILE=""

# process command line args
while [[ $# -gt 0 ]]; do
  key="$1"
  case $key in
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
  -pf|--patch-file <name=value>:
       filepath to a yaml file of an 'Istio' resource that will overlay the default 'Istio' resource. 
       --patch-file /path/to/patch-file.yaml
  -s|--set <name=value>:
       Sets a name/value pair for a custom install setting. Some examples you may want to use:
       --set installPackagePath=/git/clone/istio.io/installer
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
  version: v1.23.0
  namespace: istio-system
  updateStrategy:
    type: InPlace
  values:
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
kubectl wait --for=condition=Ready istios/default -n istio-system

# Install addons
addons=("prometheus" "grafana" "jaeger")
for addon in "${addons[@]}"; do
  kubectl apply -n istio-system -f "https://raw.githubusercontent.com/istio/istio/refs/heads/release-1.23/samples/addons/$addon.yaml"
done
