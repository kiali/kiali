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
# that the kubeconfig should provide permissions for. Read verbs (get, list,
# watch) are always required and failures are fatal. Write verbs (create,
# delete, patch) are checked based on the --view-only flag: if --view-only
# true, write permissions must NOT be present (having them is a fatal error);
# if --view-only false, write permissions must be present (missing them is a
# fatal error). If --view-only is not specified, write verb failures are
# reported as warnings only.
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
  --view-only true|false
        If true, write verbs (create, delete, patch) must NOT be granted - having them
        is a fatal error. If false, write verbs must be granted - missing them is a fatal
        error. If not specified, missing write verbs are reported as warnings only.
  --help
        Show this help message and exit.

Notes:
  Exactly one of --kubeconfig-file or --kubeconfig-secret must be specified.
EOF
}

KUBECONFIG_FILE=""
KUBECONFIG_SECRET_SPEC=""
KIALI_VERSION=""
VIEW_ONLY=""  # unset means "warn on missing write verbs"; true/false enforces write verb presence

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
    --view-only)
      if [[ $# -lt 2 ]]; then
        echo "Error: --view-only requires a true or false argument"
        exit 1
      fi
      if [[ "$2" != "true" && "$2" != "false" ]]; then
        echo "Error: --view-only must be 'true' or 'false'"
        exit 1
      fi
      VIEW_ONLY="$2"
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
echo "VIEW_ONLY=${VIEW_ONLY:-<not set - write verb failures will be warnings only>}"
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

# Build the resource list by processing each rule individually, respecting apiGroup scoping.
# When a rule has resources: ["*"], we only expand to resources that belong to the apiGroups
# listed in that specific rule — not all resources on the cluster.
rule_count=$(echo "$ROLE_YAML" | yq eval-all '. | select(.kind == "ClusterRole") | .rules | length' -)

# Build a map of "resource -> set of verbs" by processing each rule individually,
# respecting apiGroup scoping for wildcard resources.
declare -A RESOURCE_VERBS=()

for (( i=0; i<rule_count; i++ )); do
  mapfile -t rule_groups    < <(echo "$ROLE_YAML" | yq eval-all ". | select(.kind == \"ClusterRole\") | .rules[$i].apiGroups[]" -)
  mapfile -t rule_resources < <(echo "$ROLE_YAML" | yq eval-all ". | select(.kind == \"ClusterRole\") | .rules[$i].resources[]" -)
  mapfile -t rule_verbs     < <(echo "$ROLE_YAML" | yq eval-all ". | select(.kind == \"ClusterRole\") | .rules[$i].verbs[]" -)

  # Build a space-separated verb string for this rule
  verb_str="${rule_verbs[*]}"

  # Check if this rule has resourceNames restrictions
  resource_names_count=$(echo "$ROLE_YAML" | yq eval-all ". | select(.kind == \"ClusterRole\") | .rules[$i].resourceNames | length" - 2>/dev/null || echo "0")
  resource_name_arg=""
  if [[ "$resource_names_count" -gt 0 ]]; then
    # Use the first resourceName for the can-i check (checking one is sufficient to verify access)
    first_resource_name=$(echo "$ROLE_YAML" | yq eval-all ". | select(.kind == \"ClusterRole\") | .rules[$i].resourceNames[0]" - 2>/dev/null)
    resource_name_arg="/$first_resource_name"
  fi

  for resource in "${rule_resources[@]}"; do
    if [[ "$resource" == "*" ]]; then
      # Expand wildcard only within the apiGroups listed in this specific rule
      for group in "${rule_groups[@]}"; do
        mapfile -t group_resources < <(kubectl --kubeconfig="$KUBECONFIG_FILE" api-resources --api-group="$group" -o name 2>/dev/null)
        for gr in "${group_resources[@]}"; do
          RESOURCE_VERBS["$gr"]="${RESOURCE_VERBS[$gr]:-} $verb_str"
        done
      done
    else
      # Store resource with its optional resource name suffix for can-i checks
      key="${resource}${resource_name_arg}"
      RESOURCE_VERBS["$key"]="${RESOURCE_VERBS[$key]:-} $verb_str"
    fi
  done
done

if [[ ${#RESOURCE_VERBS[@]} -eq 0 ]]; then
  echo "Error: Could not retrieve resource list from ClusterRole"
  exit 1
fi

# Collect sorted resource list for display
mapfile -t RESOURCES < <(printf '%s\n' "${!RESOURCE_VERBS[@]}" | sort -u)

echo
echo "Resources to check (with their required verbs):"
for res in "${RESOURCES[@]}"; do
  sorted_verbs="$(printf '%s\n' ${RESOURCE_VERBS[$res]} | tr ' ' '\n' | sort -u | grep -v '^$' | tr '\n' ' ')"
  echo "  $res: $sorted_verbs"
done

overall_pass=true

# Determine the write-verb mode message for the header
if [[ "$VIEW_ONLY" == "true" ]]; then
  write_verb_note="Write verbs (create/delete/patch) must NOT be granted (--view-only true)."
elif [[ "$VIEW_ONLY" == "false" ]]; then
  write_verb_note="Write verbs (create/delete/patch) must be granted (--view-only false)."
else
  write_verb_note="Write verbs (create/delete/patch) are not enforced - failures reported as warnings only."
fi

echo
echo "=== Permission Checks ==="
echo "(Read verbs get/list/watch are always required. ${write_verb_note})"
for res in "${RESOURCES[@]}"; do
  # Split the stored verb string into individual words, deduplicate, drop blanks
  read -ra verbs_to_check <<< "$(printf '%s\n' ${RESOURCE_VERBS[$res]} | tr ' ' '\n' | sort -u | grep -v '^$' | tr '\n' ' ')"
  for verb in "${verbs_to_check[@]}"; do
    # Skip verbs that cannot be used with "auth can-i"
    if [[ "$verb" == "post" ]]; then
      continue
    fi

    is_write_verb=false
    if [[ "$verb" != "get" && "$verb" != "list" && "$verb" != "watch" ]]; then
      is_write_verb=true
    fi
    # tokenreviews/create is required even in view-only mode: it is used for user
    # token validation (authentication), not for modifying mesh data.
    if [[ "$res" == "tokenreviews" ]]; then
      is_write_verb=false
    fi

    echo -n "  Can $verb $res: "
    if output="$(kubectl --kubeconfig="$KUBECONFIG_FILE" auth can-i "$verb" "$res" --all-namespaces 2>&1 | tr '\n' ' ')"; then
      # Permission is granted
      if [[ "$res" == "pods/portforward" ]]; then
        echo "$output ✅ (optional)"
      elif [[ "$is_write_verb" == "true" && "$VIEW_ONLY" == "true" ]]; then
        # view-only mode: write access should NOT be present
        echo "$output ❌ (write access granted but --view-only true requires it to be denied)"
        overall_pass=false
      else
        echo "$output ✅"
      fi
    else
      # Permission is denied
      if [[ "$res" == "pods/portforward" ]]; then
        echo "$output ⚠️  (optional - only needed if port-forward UI feature is desired)"
      elif [[ "$is_write_verb" == "true" ]]; then
        if [[ "$VIEW_ONLY" == "false" ]]; then
          # full-access mode: write access must be present
          echo "$output ❌ (REQUIRED - --view-only false requires write access)"
          overall_pass=false
        elif [[ "$VIEW_ONLY" == "true" ]]; then
          # view-only mode: write access being denied is correct
          echo "$output ✅ (correctly denied for view-only)"
        else
          # unspecified: warn only
          echo "$output ⚠️  (optional - needed for write access)"
        fi
      else
        # Read verb denied: always fatal
        echo "$output ❌ (REQUIRED)"
        overall_pass=false
      fi
    fi
  done
done

echo
if [[ "$overall_pass" == "true" ]]; then
  echo "✅ All required permission checks passed."
else
  echo "❌ Some required permission checks failed. Review the output above."
  exit 1
fi
