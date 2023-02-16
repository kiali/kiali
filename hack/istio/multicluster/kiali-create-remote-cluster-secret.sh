#/bin/bash

set -e
set -u

##############################################################################
# kiali-create-remote-cluster-secret.sh
#
# This creates/deletes the required resources on a remote cluster and then
# creates/deletes a secret on the Kiali home cluster (where Kiali is or
# will be installed). This remote cluster secret will enable Kiali to
# observe multiple clusters.
#
# You must have 'helm' installed and you must have connectivity to the
# public Kiali helm repository in order for this script to be able to
# access the Kiali Helm charts.
#
# Use "--dry-run true" to see what resources this script would create
# without having this script create anything to any cluster. The YAML
# for the resources to be created will be printed to stdout, with
# informational messages printed to stderr.
# If you use "--dry-run true" you can see just the resource YAML by piping
# stderr to /dev/null or some output file in order to isolate stdout.
# (e.g. kiali-create-remote-cluster-secret.sh --dry-run true 2>/dev/null)
# Note that you must be aware the resulting YAML of a dry run represent
# the new resources this script would have created in two different clusters
# (the remote cluster and the kiali cluster). Do not apply the resulting YAML
# to a single cluster - that will not do what you want in order for Kiali
# to work properly. The final secret that is output must be applied to the
# Kiali cluster; the other resources must be applied to the remote cluster.
#
# See --help for options.
##############################################################################

# Used to name all the resources on the remote cluster.
KIALI_RESOURCE_NAME="kiali-remote-access"

# The "Kiali Secret" is the remote cluster secret that is created in the
# namespace where Kiali is to be deployed.
KIALI_SECRET_LABEL_NAME_MULTICLUSTER="kiali.io/multiCluster"
KIALI_SECRET_ANNOTATION_NAME_CLUSTER="kiali.io/cluster"
KIALI_SECRET_NAME_PREFIX="kiali-remote-cluster-secret-"

DEFAULT_CLIENT_EXE="kubectl"
DEFAULT_DELETE="false"
DEFAULT_DRY_RUN="false"
DEFAULT_HELM="helm"
DEFAULT_KIALI_CLUSTER_CONTEXT="east"
DEFAULT_KIALI_CLUSTER_NAMESPACE="istio-system"
DEFAULT_KIALI_VERSION="latest"
DEFAULT_REMOTE_CLUSTER_CONTEXT="west"
DEFAULT_REMOTE_CLUSTER_NAMESPACE="kiali-access-ns"
DEFAULT_VIEW_ONLY="true"

: ${CLIENT_EXE:=${DEFAULT_CLIENT_EXE}}
: ${DELETE:=${DEFAULT_DELETE}}
: ${DRY_RUN:=${DEFAULT_DRY_RUN}}
: ${HELM:=${DEFAULT_HELM}}
: ${KIALI_CLUSTER_CONTEXT:=${DEFAULT_KIALI_CLUSTER_CONTEXT}}
: ${KIALI_CLUSTER_NAMESPACE:=${DEFAULT_KIALI_CLUSTER_NAMESPACE}}
: ${KIALI_VERSION:=${DEFAULT_KIALI_VERSION}}
: ${REMOTE_CLUSTER_CONTEXT:=${DEFAULT_REMOTE_CLUSTER_CONTEXT}}
: ${REMOTE_CLUSTER_NAMESPACE:=${DEFAULT_REMOTE_CLUSTER_NAMESPACE}}
: ${VIEW_ONLY:=${DEFAULT_VIEW_ONLY}}

DRY_RUN_ARG="--dry-run=none"

info() {
  # if we are in dry run, the only output we want to show on stdout is the resource yaml
  if [ "${DRY_RUN}" == "false" ]; then
    echo "INFO: $1"
  else
    echo "INFO(dry run): $1" 1>&2
  fi
}

error() {
  echo "ERROR: $1"
  exit 1
}

while [ $# -gt 0 ]; do
  key="$1"
  case $key in
    -c|--client)
      CLIENT_EXE="$2"
      shift;shift
      ;;
    -d|--delete)
      [ "${2:-}" != "true" -a "${2:-}" != "false" ] && error "--delete must be 'true' or 'false'"
      DELETE="$2"
      shift;shift
      ;;
    -dr|--dry-run)
      [ "${2:-}" != "true" -a "${2:-}" != "false" ] && error "--dry-run must be 'true' or 'false'"
      DRY_RUN="$2"
      if [ "${DRY_RUN}" == "true" ]; then
        DRY_RUN_ARG="--dry-run=client"
      else
        DRY_RUN_ARG="--dry-run=none"
      fi
      shift;shift
      ;;
    -helm|--helm)
      HELM="$2"
      shift;shift
      ;;
    -kcc|--kiali-cluster-context)
      KIALI_CLUSTER_CONTEXT="$2"
      shift;shift
      ;;
    -kcn|--kiali-cluster-namespace)
      KIALI_CLUSTER_NAMESPACE="$2"
      shift;shift
      ;;
    -kv|--kiali-version)
      KIALI_VERSION="$2"
      shift;shift
      ;;
    -rcc|--remote-cluster-context)
      REMOTE_CLUSTER_CONTEXT="$2"
      shift;shift
      ;;
    -rcn|--remote-cluster-namespace)
      REMOTE_CLUSTER_NAMESPACE="$2"
      shift;shift
      ;;
    -vo|--view-only)
      [ "${2:-}" != "true" -a "${2:-}" != "false" ] && error "--view-only must be 'true' or 'false'"
      VIEW_ONLY="$2"
      shift;shift
      ;;
    -h|--help)
      cat <<HELPMSG

Use this tool to help prepare Kiali for accessing multiple clusters.

This tool will create the required resources on a remote cluster and then it
will create a secret on the Kiali home cluster (where Kiali is or will be
installed).

This remote cluster secret will enable Kiali to observe multiple clusters.
This tool can also be used to delete those resources and the secret (see --delete).

Valid command line arguments:
  -c|--client: either 'oc' or 'kubectl'. Default: "${DEFAULT_CLIENT_EXE}"
  -d|--delete: either 'true' or 'false'. If 'true' the resources and secret
               will be deleted. Default: "${DEFAULT_DELETE}"
  -dr|--dry-run: if 'true' no resources will be created; the yaml will be output.
                 Default: "${DEFAULT_DRY_RUN}"
  -helm|--helm: the path to your Helm CLI executable. Default: "${DEFAULT_HELM}"
  -kcc|--kiali-cluster-context: the .kube context that is used to communicate
                                with the cluster where Kiali is installed.
                                Default: "${DEFAULT_KIALI_CLUSTER_CONTEXT}"
  -kcn|--kiali-cluster-namespace: the namespace where Kiali is installed.
                                  Default: "${DEFAULT_KIALI_CLUSTER_NAMESPACE}"
  -kv|--kiali-version: The version of Kiali that is installed. This is used to
                       determine what the role should look like. Pass in
                       "latest" to specify the latest version of Kiali.
                       Default: "${DEFAULT_KIALI_VERSION}"
  -rcc|--remote-cluster-context: the .kube context that is used to communicate
                                 with the remote cluster.
                                 Default: "${DEFAULT_REMOTE_CLUSTER_CONTEXT}"
  -rcn|--remote-cluster-namespace: the namespace where the resources will be
                                   created on the remote cluster.
                                   Default: "${DEFAULT_REMOTE_CLUSTER_NAMESPACE}"
  -vo|--view-only: if 'true' then the created service account/remote secret
                   will only provide a read-only view of the remote cluster.
                   Default: "${DEFAULT_VIEW_ONLY}"
  -h|--help: this text.
HELPMSG
      exit 1
      ;;
    *)
      error "Unknown argument [$key]. Aborting."
      ;;
  esac
done

info "=== SETTINGS ==="
info CLIENT_EXE=${CLIENT_EXE}
info DELETE=${DELETE}
info DRY_RUN=${DRY_RUN}
info HELM=${HELM}
info KIALI_CLUSTER_CONTEXT=${KIALI_CLUSTER_CONTEXT}
info KIALI_CLUSTER_NAMESPACE=${KIALI_CLUSTER_NAMESPACE}
info KIALI_VERSION=${KIALI_VERSION}
info REMOTE_CLUSTER_CONTEXT=${REMOTE_CLUSTER_CONTEXT}
info REMOTE_CLUSTER_NAMESPACE=${REMOTE_CLUSTER_NAMESPACE}
info VIEW_ONLY=${VIEW_ONLY}

# Make sure we have the client.
if ! which ${CLIENT_EXE} &>/dev/null; then
  error "Cannot find client '${CLIENT_EXE}'"
fi

# These are the two main client commands to be used to access the two clusters.
CLIENT_EXE_REMOTE_CLUSTER="${CLIENT_EXE} --context=${REMOTE_CLUSTER_CONTEXT}"
CLIENT_EXE_KIALI_CLUSTER="${CLIENT_EXE} --context=${KIALI_CLUSTER_CONTEXT}"

# Examine the local kubeconfig and extract the cluster name which is necessary data we need in order to create and delete the Kiali remote cluster secret.
REMOTE_CLUSTER_NAME="$(${CLIENT_EXE} config view -o jsonpath='{.contexts[?(@.name == "'${REMOTE_CLUSTER_CONTEXT}'")].context.cluster}' 2>/dev/null)"
if [ "${REMOTE_CLUSTER_NAME}" == "" ]; then
  error "Unable to determine the remote cluster name from the given remote cluster context [${REMOTE_CLUSTER_CONTEXT}]. Check that the context name you provided is correct."
fi

info REMOTE_CLUSTER_NAME=${REMOTE_CLUSTER_NAME}
KIALI_SECRET_FULL_NAME="${KIALI_SECRET_NAME_PREFIX}${REMOTE_CLUSTER_NAME}"

# If we are to delete, remove everything and exit immediately.
if [ "${DELETE}" == "true" ]; then
  info "Deleting remote cluster resources"
  ${CLIENT_EXE_REMOTE_CLUSTER} delete ${DRY_RUN_ARG} --ignore-not-found=true serviceaccount "${KIALI_RESOURCE_NAME}" -n "${REMOTE_CLUSTER_NAMESPACE}"
  ${CLIENT_EXE_REMOTE_CLUSTER} delete ${DRY_RUN_ARG} --ignore-not-found=true clusterrole -l "app.kubernetes.io/instance=${KIALI_RESOURCE_NAME}"
  ${CLIENT_EXE_REMOTE_CLUSTER} delete ${DRY_RUN_ARG} --ignore-not-found=true clusterrolebinding "${KIALI_RESOURCE_NAME}"

  info "Deleting Kiali cluster resources"
  ${CLIENT_EXE_KIALI_CLUSTER} delete ${DRY_RUN_ARG} --ignore-not-found=true secret "${KIALI_SECRET_FULL_NAME}" -n "${KIALI_CLUSTER_NAMESPACE}"
  exit 0
fi

# Examine the local kubeconfig and extract the rest of the necessary data we need in order to create the Kiali remote cluster secret.
REMOTE_CLUSTER_SERVER_URL="$(${CLIENT_EXE} config view -o jsonpath='{.clusters[?(@.name == "'${REMOTE_CLUSTER_NAME}'")].cluster.server}' 2>/dev/null)"
if [ "${REMOTE_CLUSTER_SERVER_URL}" == "" ]; then
  error "Unable to determine the remote cluster server URL from the kubeconfig remote cluster named [${REMOTE_CLUSTER_NAME}]. Check that the kubeconfig is correct."
else
  info REMOTE_CLUSTER_SERVER_URL=${REMOTE_CLUSTER_SERVER_URL}
fi

# The CA data can either be specified directly in the config or a CA file is defined that we then have to read
REMOTE_CLUSTER_CA_BYTES="$(${CLIENT_EXE} config view --raw=true -o jsonpath='{.clusters[?(@.name == "'${REMOTE_CLUSTER_NAME}'")].cluster.certificate-authority-data}' 2>/dev/null)"
if [ "${REMOTE_CLUSTER_CA_BYTES}" == "" ]; then
  REMOTE_CLUSTER_CA_FILE="$(${CLIENT_EXE} config view --raw=true -o jsonpath='{.clusters[?(@.name == "'${REMOTE_CLUSTER_NAME}'")].cluster.certificate-authority}' 2>/dev/null)"
  if [ ! -r "${REMOTE_CLUSTER_CA_FILE}" ]; then
    error "Unable to read the remote cluster CA bytes or file specified in the kubeconfig remote cluster named [${REMOTE_CLUSTER_NAME}]. Check that the kubeconfig is correct."
  else
    info REMOTE_CLUSTER_CA_FILE=${REMOTE_CLUSTER_CA_FILE}
  fi

  REMOTE_CLUSTER_CA_BYTES="$(cat ${REMOTE_CLUSTER_CA_FILE} 2>/dev/null | base64 --wrap=0 2>/dev/null)"
  if [ "${REMOTE_CLUSTER_CA_BYTES}" == "" ]; then
    error "Unable to get the remote cluster CA cert data from the CA file [${REMOTE_CLUSTER_CA_FILE}] specified in the kubeconfig remote cluster named [${REMOTE_CLUSTER_NAME}]. Check that the kubeconfig is correct."
  fi
fi

# We need helm for some of the commands below - make sure it is in PATH.
if ! which ${HELM} &>/dev/null; then
  error "Cannot find the Helm executable '${HELM}'; please install it."
fi

info "Create the remote cluster namespace [${REMOTE_CLUSTER_NAMESPACE}] if it doesn't exist"
${CLIENT_EXE_REMOTE_CLUSTER} get namespace "${REMOTE_CLUSTER_NAMESPACE}" &> /dev/null || \
  ${CLIENT_EXE_REMOTE_CLUSTER} create ${DRY_RUN_ARG} namespace "${REMOTE_CLUSTER_NAMESPACE}"

info "Create the remote cluster resources with the appropriate permissions for Kiali (view_only=${VIEW_ONLY})"
if [ "${VIEW_ONLY}" == "true" ]; then
  ROLE_TEMPLATE_NAME="role-viewer"
else
  ROLE_TEMPLATE_NAME="role"
fi

if [ "${KIALI_VERSION}" != "latest" ]; then
  HELM_VERSION_ARG="--version ${KIALI_VERSION}"
fi

HELM_TEMPLATE_OUTPUT="$(${HELM} template                  \
    ${HELM_VERSION_ARG:-}                                 \
    --namespace ${REMOTE_CLUSTER_NAMESPACE}               \
    --set deployment.instance_name=${KIALI_RESOURCE_NAME} \
    --set deployment.view_only_mode=${VIEW_ONLY}          \
    --set auth.strategy=anonymous                         \
    --show-only templates/serviceaccount.yaml             \
    --show-only templates/${ROLE_TEMPLATE_NAME}.yaml      \
    --show-only templates/rolebinding.yaml                \
    --repo https://kiali.org/helm-charts                  \
    kiali-server                                          \
    kiali-server)"

if [ "${DRY_RUN}" == "true" ]; then
  echo "${HELM_TEMPLATE_OUTPUT}"
else
  echo "${HELM_TEMPLATE_OUTPUT}" | ${CLIENT_EXE_REMOTE_CLUSTER} apply ${DRY_RUN_ARG} -f -
fi

# Create the SA token secret manually.
# See https://kubernetes.io/docs/tasks/configure-pod-container/configure-service-account/#manually-create-an-api-token-for-a-serviceaccount
# This may generate another token secret with an auto-generated suffix.
# This secret (and the auto-generated one) will automatically be deleted when the SA is deleted.
# TODO ephemeral time-based tokens are actually preferred; should we figure out how to use those instead?
REMOTE_SA_SECRET_YAML=$(cat <<EOF
---
apiVersion: v1
kind: Secret
metadata:
  name: ${KIALI_RESOURCE_NAME}
  namespace: ${REMOTE_CLUSTER_NAMESPACE}
  annotations:
    kubernetes.io/service-account.name: ${KIALI_RESOURCE_NAME}
type: kubernetes.io/service-account-token
...
EOF
)

if [ "${DRY_RUN}" == "true" ]; then
  echo "${REMOTE_SA_SECRET_YAML}"
else
  echo "${REMOTE_SA_SECRET_YAML}" | ${CLIENT_EXE_REMOTE_CLUSTER} apply ${DRY_RUN_ARG} -f -
fi

# We now have to wait for that secret to generate its token.
# This is the token that will give Kiali the ability to log
# into the remote cluster and access its resources with the
# permissions given to the new service account.

if [ "${DRY_RUN}" == "true" ]; then
  TOKEN="dry-run"
else
  # When we created the SA secret above, k8s may actually create another secret
  # with an added suffix in the name and assign that auto-generated secret to
  # the SA. In k8s 1.24 this auto-generation of secrets should no longer happen,
  # so do not rely on it. Use the secret we generate - a long-lived token should
  # be placed in it by k8s.
  # See: https://kubernetes.io/docs/reference/access-authn-authz/service-accounts-admin/#manual-secret-management-for-serviceaccounts
  # This commented code is how you can access that auto-generated secret.
  #for i in 1 2 3 4 5 6; do
  #  tokenSecret="$(${CLIENT_EXE_REMOTE_CLUSTER} get sa -n ${REMOTE_CLUSTER_NAMESPACE} ${KIALI_RESOURCE_NAME} -o jsonpath='{.secrets[0].name}' 2>/dev/null)" \
  #    && [ "${tokenSecret}" != "" ] \
  #    && break \
  #    || (info "Waiting for the SA secret to be created..." && sleep 5)
  #done
  #if [ "${tokenSecret}" == "" ]; then
  #  exit "There is no secret assigned yet to the remote cluster SA [${REMOTE_CLUSTER_NAMESPACE}/${KIALI_RESOURCE_NAME}]. Aborting."
  #fi
  tokenSecret="${KIALI_RESOURCE_NAME}"

  for i in 1 2 3 4 5 6; do
    encodedToken="$(${CLIENT_EXE_REMOTE_CLUSTER} get secrets -n ${REMOTE_CLUSTER_NAMESPACE} ${tokenSecret} -o jsonpath='{.data.token}' 2>/dev/null)" \
      && [ "${encodedToken}" != "" ] \
      && break \
      || (info "Waiting for the SA secret token to be created..." && sleep 5)
  done
  if [ "${encodedToken}" == "" ]; then
    exit "There is no token assigned yet to the remote cluster SA secret [${REMOTE_CLUSTER_NAMESPACE}/${tokenSecret}]. Aborting."
  fi

  TOKEN="$(echo ${encodedToken} | base64 -d)"
fi

# Now we are ready to create the kiali remote cluster secret.
info "Create the remote cluster secret in the Kiali cluster"

KIALI_SECRET_YAML=$(cat <<EOF
---
apiVersion: v1
kind: Secret
metadata:
  name: ${KIALI_SECRET_FULL_NAME}
  namespace: ${KIALI_CLUSTER_NAMESPACE}
  labels:
    ${KIALI_SECRET_LABEL_NAME_MULTICLUSTER}: "true"
  annotations:
    ${KIALI_SECRET_ANNOTATION_NAME_CLUSTER}: ${REMOTE_CLUSTER_NAME}
stringData:
  ${REMOTE_CLUSTER_NAME}: |
    apiVersion: v1
    kind: Config
    preferences: {}
    current-context: ${REMOTE_CLUSTER_NAME}
    contexts:
    - name: ${REMOTE_CLUSTER_NAME}
      context:
        cluster: ${REMOTE_CLUSTER_NAME}
        user: ${REMOTE_CLUSTER_NAME}
    users:
    - name: ${REMOTE_CLUSTER_NAME}
      user:
        token: ${TOKEN}
    clusters:
    - name: ${REMOTE_CLUSTER_NAME}
      cluster:
        server: ${REMOTE_CLUSTER_SERVER_URL}
        certificate-authority-data: ${REMOTE_CLUSTER_CA_BYTES}
...
EOF
)

if [ "${DRY_RUN}" == "true" ]; then
  echo "${KIALI_SECRET_YAML}"
else
  echo "${KIALI_SECRET_YAML}" | ${CLIENT_EXE_KIALI_CLUSTER} apply ${DRY_RUN_ARG} -f -
fi

info "A remote cluster secret named [${KIALI_CLUSTER_NAMESPACE}/${KIALI_SECRET_FULL_NAME}] has been created and can be used by Kiali to access the remote cluster."
exit 0
