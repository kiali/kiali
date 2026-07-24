#!/bin/bash
#
# Creates OpenShift users and groups via the htpasswd identity provider.
#
# This script is additive — running it multiple times adds new users and groups
# without affecting existing ones. Existing users have their passwords updated
# if specified again. Deleting is also surgical — only the specified users are
# removed from htpasswd and their groups. Groups are deleted only if they become
# empty after removing the user.
#
# Usage:
#   ./hack/openshift-create-test-users.sh --context <kubecontext> \
#     --user alice:alicepw:people,women \
#     --user bob:bobpw:people,men
#
# Each --user value is formatted as: name:password:group1,group2,...
# Groups are created if they don't exist. Users are added to the htpasswd
# identity provider. If the IDP doesn't exist in the OAuth cluster config,
# the script creates it automatically.
#
# Options:
#   --context <name>     Optional. The kubecontext to use. Defaults to the current context.
#   --user <spec>        Required (at least one). Format: name:password:group1,group2
#   --idp-name <name>    Optional. Name of the htpasswd IDP. Default: my_htpasswd_provider
#   --role <name>        Optional. ClusterRole to bind to each user. If the named role doesn't
#                        exist, a default one granting namespace get/list and pods/log get is
#                        created. Default: kiali-test-user
#   --no-rbac            Skip RBAC creation (don't create ClusterRole or bindings).
#   --delete             Delete the specified users and groups instead of creating them.
#   --help               Show this help message.

set -euo pipefail

CONTEXT=""
IDP_NAME="my_htpasswd_provider"
ROLE_NAME="kiali-test-user"
NO_RBAC=false
DELETE_MODE=false
declare -a USER_SPECS=()

usage() {
  sed -n '3,/^$/p' "$0" | sed 's/^# \?//'
  exit "${1:-0}"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --context)
      CONTEXT="$2"; shift 2 ;;
    --user)
      USER_SPECS+=("$2"); shift 2 ;;
    --idp-name)
      IDP_NAME="$2"; shift 2 ;;
    --role)
      ROLE_NAME="$2"; shift 2 ;;
    --no-rbac)
      NO_RBAC=true; shift ;;
    --delete)
      DELETE_MODE=true; shift ;;
    --help|-h)
      usage 0 ;;
    *)
      echo "ERROR: Unknown argument: $1" >&2; usage 1 ;;
  esac
done

if [[ -z "$CONTEXT" ]]; then
  CONTEXT=$(oc config current-context)
  echo "No --context specified, using current context: ${CONTEXT}"
fi

if [[ ${#USER_SPECS[@]} -eq 0 ]]; then
  echo "ERROR: at least one --user is required" >&2
  usage 1
fi

OC="oc --context=${CONTEXT}"

if ! $OC whoami &>/dev/null; then
  echo "ERROR: Cannot connect to cluster with context '${CONTEXT}'. Either the context is invalid or you are not logged in." >&2
  exit 1
fi

# Parse user specs into arrays
declare -a USERNAMES=()
declare -a PASSWORDS=()
declare -a USER_GROUPS=()

for spec in "${USER_SPECS[@]}"; do
  IFS=':' read -r name password groups <<< "$spec"
  if [[ -z "$name" || -z "$password" ]]; then
    echo "ERROR: Invalid --user spec '${spec}'. Format: name:password:group1,group2" >&2
    exit 1
  fi
  USERNAMES+=("$name")
  PASSWORDS+=("$password")
  USER_GROUPS+=("$groups")
done

# Collect all unique groups
declare -A ALL_GROUPS=()
for groups in "${USER_GROUPS[@]}"; do
  IFS=',' read -ra group_arr <<< "$groups"
  for g in "${group_arr[@]}"; do
    [[ -n "$g" ]] && ALL_GROUPS["$g"]=1
  done
done

if [[ "$DELETE_MODE" == "true" ]]; then
  echo "=== Deleting users and groups (context: ${CONTEXT}) ==="

  # Get htpasswd secret
  SECRET_NAME=$($OC get oauth cluster -o jsonpath="{.spec.identityProviders[?(@.name==\"${IDP_NAME}\")].htpasswd.fileData.name}" 2>/dev/null)
  if [[ -n "$SECRET_NAME" ]]; then
    TMPFILE=$(mktemp)
    $OC get secret "$SECRET_NAME" -n openshift-config -o jsonpath='{.data.htpasswd}' | base64 -d > "$TMPFILE"
    for name in "${USERNAMES[@]}"; do
      htpasswd -D "$TMPFILE" "$name" 2>/dev/null && echo "Removed $name from htpasswd" || true
      $OC delete user "$name" --ignore-not-found 2>/dev/null
      $OC delete identity "${IDP_NAME}:${name}" --ignore-not-found 2>/dev/null
    done
    $OC create secret generic "$SECRET_NAME" \
      --from-file=htpasswd="$TMPFILE" \
      -n openshift-config --dry-run=client -o yaml | $OC apply -f -
    rm -f "$TMPFILE"
  fi

  # Remove users from groups; delete group if it becomes empty
  for i in "${!USERNAMES[@]}"; do
    IFS=',' read -ra group_arr <<< "${USER_GROUPS[$i]}"
    for g in "${group_arr[@]}"; do
      [[ -z "$g" ]] && continue
      $OC adm groups remove-users "$g" "${USERNAMES[$i]}" 2>/dev/null && echo "Removed ${USERNAMES[$i]} from group $g" || true
      # Check if group is now empty and delete it if so
      MEMBERS=$($OC get group "$g" -o jsonpath='{.users}' 2>/dev/null || echo "")
      if [[ "$MEMBERS" == "[]" || -z "$MEMBERS" ]]; then
        $OC delete group "$g" --ignore-not-found 2>/dev/null && echo "Deleted empty group: $g" || true
      fi
    done
  done

  # Remove ClusterRoleBindings for each user
  if [[ "$NO_RBAC" == "false" ]]; then
    for name in "${USERNAMES[@]}"; do
      $OC delete clusterrolebinding "${ROLE_NAME}-${name}" --ignore-not-found 2>/dev/null && echo "Deleted ClusterRoleBinding: ${ROLE_NAME}-${name}"
    done
  fi

  echo "Done."
  exit 0
fi

# === CREATE MODE ===
echo "=== Creating users and groups (context: ${CONTEXT}) ==="

# Get the htpasswd secret name from the OAuth config
SECRET_NAME=$($OC get oauth cluster -o jsonpath="{.spec.identityProviders[?(@.name==\"${IDP_NAME}\")].htpasswd.fileData.name}" 2>/dev/null)
if [[ -z "$SECRET_NAME" ]]; then
  echo "HTPasswd IDP '${IDP_NAME}' not found in OAuth config. Creating it..."
  SECRET_NAME="${IDP_NAME}-secret"

  # Create empty htpasswd secret
  TMPFILE=$(mktemp)
  touch "$TMPFILE"
  $OC create secret generic "$SECRET_NAME" \
    --from-file=htpasswd="$TMPFILE" \
    -n openshift-config
  rm -f "$TMPFILE"

  # Patch the OAuth config to add the IDP
  $OC patch oauth cluster --type json -p "[{
    \"op\": \"add\",
    \"path\": \"/spec/identityProviders/-\",
    \"value\": {
      \"name\": \"${IDP_NAME}\",
      \"type\": \"HTPasswd\",
      \"mappingMethod\": \"claim\",
      \"htpasswd\": {
        \"fileData\": {
          \"name\": \"${SECRET_NAME}\"
        }
      }
    }
  }]"
  echo "Created IDP '${IDP_NAME}' with secret '${SECRET_NAME}'"
fi

# Download existing htpasswd and add users
TMPFILE=$(mktemp)
$OC get secret "$SECRET_NAME" -n openshift-config -o jsonpath='{.data.htpasswd}' | base64 -d > "$TMPFILE"

for i in "${!USERNAMES[@]}"; do
  htpasswd -bB "$TMPFILE" "${USERNAMES[$i]}" "${PASSWORDS[$i]}"
done

# Update the secret
$OC create secret generic "$SECRET_NAME" \
  --from-file=htpasswd="$TMPFILE" \
  -n openshift-config --dry-run=client -o yaml | $OC apply -f -
rm -f "$TMPFILE"

echo "HTPasswd secret updated. OAuth pods will roll out automatically."

# Create groups
for g in "${!ALL_GROUPS[@]}"; do
  $OC adm groups new "$g" 2>/dev/null && echo "Created group: $g" || echo "Group already exists: $g"
done

# Add users to groups
for i in "${!USERNAMES[@]}"; do
  IFS=',' read -ra group_arr <<< "${USER_GROUPS[$i]}"
  for g in "${group_arr[@]}"; do
    [[ -n "$g" ]] && $OC adm groups add-users "$g" "${USERNAMES[$i]}" 2>/dev/null
  done
done

# Create RBAC: ClusterRole (if needed) and per-user ClusterRoleBindings
if [[ "$NO_RBAC" == "false" ]]; then
  if ! $OC get clusterrole "$ROLE_NAME" &>/dev/null; then
    echo "Creating ClusterRole '${ROLE_NAME}' with basic Kiali read permissions..."
    $OC apply -f - <<EOF
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: ${ROLE_NAME}
  labels:
    app.kubernetes.io/managed-by: kiali-hack-script
rules:
- apiGroups: [""]
  resources:
  - namespaces
  - pods/log
  verbs:
  - get
  - list
EOF
  else
    echo "ClusterRole '${ROLE_NAME}' already exists — reusing."
  fi

  for name in "${USERNAMES[@]}"; do
    $OC apply -f - <<EOF
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: ${ROLE_NAME}-${name}
  labels:
    app.kubernetes.io/managed-by: kiali-hack-script
subjects:
- kind: User
  name: ${name}
  apiGroup: rbac.authorization.k8s.io
roleRef:
  kind: ClusterRole
  name: ${ROLE_NAME}
  apiGroup: rbac.authorization.k8s.io
EOF
    echo "  Bound '${name}' to ClusterRole '${ROLE_NAME}'"
  done
fi

echo ""
echo "=== Summary ==="
echo "Users created:"
for i in "${!USERNAMES[@]}"; do
  echo "  ${USERNAMES[$i]} (groups: ${USER_GROUPS[$i]})"
done
echo ""
echo "Groups:"
$OC get groups 2>/dev/null | grep -E "^(NAME|$(IFS='|'; echo "${!ALL_GROUPS[*]}"))" || true
echo ""
echo "Note: OAuth pods are rolling out. Users may take ~30s to become active."
