#!/usr/bin/env bash

##############################################################################
# This script checks the permissions of a given kubeconfig to ensure it
# has the necessary permissions so Kiali can use it to access a remote
# cluster.
#
# The kubeconfig must be provided as either a kubeconfig file or
# found within a secret (thus you can generate a Kiali remote cluster secret
# and use this script to confirm its validity). See the options
# --kubeconfig-file and --kubeconfig-secret.
#
# You must tell the script what version of Kiali you want to test with.
# See the option --kiali-version.
#
# This script will perform auth can-i checks on resources
# that the kubeconfig should provide permissions for.
#
# You must have `helm` and `yq` installed in order to use this script.
#
# If you are connected to a cluster with a kubeconfig that you think can be
# used as a Kiali remote cluster config, you can store it as a secret and
# then test that to see if it is a valid Kiali remote cluster secret:
#
# 1. Save your current kubeconfig context to a file:
#    kubectl config view --minify --raw > ./active-context-kubeconfig.yaml
#
# 2. Create a secret with that kubeconfig file:
#    kubectl create secret generic mycluster-secret \
#      --namespace default \
#      --from-file=mycluster=./active-context-kubeconfig.yaml
#
# 3. Use this test script to verify the permissions are correct:
#    ./verify-kiali-permissions.sh \
#      --kubeconfig-secret default:mycluster-secret:mycluster \
#      --kiali-version v2.9.0
#
# 4. Once testing is complete, remove the kubeconfig file and delete the secret:
#    rm ./active-context-kubeconfig.yaml
#    kubectl delete secret --namespace default mycluster-secret
##############################################################################

set -euo pipefail

print_help() {
  cat <<EOF
Usage: $0 [OPTIONS]

Options:
  --kubeconfig-file FILE
        Path to a kubeconfig file.
  --kubeconfig-secret NS:NAME:KEY
        Specify kubeconfig as a Kubernetes secret with namespace, secret name, and secret key.
        Format: --kubeconfig-secret <namespace>:<secretName>:<secretKey>
  --kiali-version vX.Y.Z
        Kiali version whose needed permissions will be checked (e.g. v2.9.0).
        Required.
  --help
        Show this help message and exit.

Notes:
  Exactly one of --kubeconfig-file or --kubeconfig-secret must be specified.
EOF
}

KUBECONFIG_FILE=""
KUBECONFIG_SECRET_SPEC=""
KIALI_VERSION=""

if [[ $# -eq 0 ]]; then
  print_help
  exit 1
fi

while [[ $# -gt 0 ]]; do
  case "$1" in
    --kubeconfig-file)
      if [[ $# -lt 2 ]]; then
        echo "Error: --kubeconfig-file requires a file path argument"
        exit 1
      fi
      KUBECONFIG_FILE="$2"
      shift 2
      ;;
    --kubeconfig-secret)
      if [[ $# -lt 2 ]]; then
        echo "Error: --kubeconfig-secret requires a secret spec argument"
        exit 1
      fi
      KUBECONFIG_SECRET_SPEC="$2"
      shift 2
      ;;
    --kiali-version)
      if [[ $# -lt 2 ]]; then
        echo "Error: --kiali-version requires a version argument"
        exit 1
      fi
      KIALI_VERSION="$2"
      # Validate version format: must be X.Y.Z or vX.Y.Z
      if [[ ! "$KIALI_VERSION" =~ ^v?[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
        echo "Error: --kiali-version must be in the form X.Y.Z (optionally prefixed with 'v')"
        exit 1
      fi
      shift 2
      ;;
    --help)
      print_help
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      print_help
      exit 1
      ;;
  esac
done

# Validate required --kiali-version
if [[ -z "$KIALI_VERSION" ]]; then
  echo "Error: --kiali-version is required"
  print_help
  exit 1
fi

# Validate exclusive kubeconfig input
if [[ -n "$KUBECONFIG_FILE" && -n "$KUBECONFIG_SECRET_SPEC" ]]; then
  echo "Error: Cannot specify both --kubeconfig-file and --kubeconfig-secret"
  exit 1
fi

if [[ -z "$KUBECONFIG_FILE" && -z "$KUBECONFIG_SECRET_SPEC" ]]; then
  echo "Error: Must specify exactly one of --kubeconfig-file or --kubeconfig-secret"
  exit 1
fi

# Parse secret spec if provided
if [[ -n "$KUBECONFIG_SECRET_SPEC" ]]; then
  if ! [[ "$KUBECONFIG_SECRET_SPEC" =~ ^[^:]+:[^:]+:[^:]+$ ]]; then
    echo "Error: --kubeconfig-secret must be in format <namespace>:<secretName>:<secretKey>"
    exit 1
  fi
  IFS=':' read -r KUBECONFIG_SECRET_NS KUBECONFIG_SECRET_NAME KUBECONFIG_SECRET_KEY <<< "$KUBECONFIG_SECRET_SPEC"

  TMP_KUBECONFIG="$(mktemp)"
  trap 'rm -f "$TMP_KUBECONFIG"' EXIT
  kubectl get secret "$KUBECONFIG_SECRET_NAME" -n "$KUBECONFIG_SECRET_NS" -o "jsonpath={.data.${KUBECONFIG_SECRET_KEY}}" | base64 -d > "$TMP_KUBECONFIG"
  KUBECONFIG_FILE="$TMP_KUBECONFIG"
fi

# Normalize KIALI_VERSION to have "v" prefix
if [[ "$KIALI_VERSION" != v* ]]; then
  KIALI_VERSION="v$KIALI_VERSION"
fi

if [ ! -f "$KUBECONFIG_FILE" ]; then
  echo "Kubeconfig file [$KUBECONFIG_FILE] does not exist."
  exit 1
fi

echo "=== SETTINGS ==="
echo "KUBECONFIG_FILE=$KUBECONFIG_FILE"
echo "KUBECONFIG_SECRET_SPEC=${KUBECONFIG_SECRET_SPEC:-<not set>}"
echo "KIALI_VERSION=$KIALI_VERSION"
echo "================"

if ! command -v helm &>/dev/null; then
  echo "Error: 'helm' is required but not found in PATH."
  exit 1
fi

if ! command -v yq &>/dev/null; then
  echo "Error: 'yq' is required but not found in PATH."
  exit 1
fi

# Ensure Kiali Helm repo is added and updated
helm repo add kiali https://kiali.org/helm-charts --force-update

ROLE_YAML=$(helm template kiali-server kiali/kiali-server --version "$KIALI_VERSION" --set auth.strategy=anonymous --show-only templates/role.yaml)

# Extract all resources from ClusterRole rules
mapfile -t RESOURCES_ARR < <(echo "$ROLE_YAML" | yq eval-all '. | select(.kind == "ClusterRole") | .rules[].resources[]' - | sort -u)

# Initialize an array to hold final resource list
declare -a RESOURCES_FINAL=()

for resource in "${RESOURCES_ARR[@]}"; do
  if [[ "$resource" == "*" ]]; then
    # If resource is "*", get all resource kinds from API server via kubectl
    # This gets all resource kinds (including CRDs) available
    mapfile -t all_resources < <(kubectl --kubeconfig="$KUBECONFIG_FILE" api-resources -o name)
    RESOURCES_FINAL+=("${all_resources[@]}")
  else
    RESOURCES_FINAL+=("$resource")
  fi
done

# Remove duplicates from final resource list
IFS=$'\n' RESOURCES=($(sort -u <<<"${RESOURCES_FINAL[*]}"))
unset IFS

if [[ ${#RESOURCES[@]} -eq 0 ]]; then
  echo "Error: Could not retrieve resource list from ClusterRole"
  exit 1
fi

echo
echo "Resources to check:"
printf '%s\n' "${RESOURCES[@]}"

for verb in get list watch; do
  echo
  echo "🔍 Checking permission: $verb"
  for res in "${RESOURCES[@]}"; do
    echo -n "  Can $verb $res: "
    if output="$(kubectl --kubeconfig="$KUBECONFIG_FILE" auth can-i "$verb" "$res" --all-namespaces 2>&1 | tr '\n' ' ')"; then
      echo "$output ✅"
    else
      echo "$output ❌"
    fi
  done
done
