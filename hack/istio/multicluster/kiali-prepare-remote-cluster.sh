#!/bin/bash

set -e
set -u

##############################################################################
# kiali-prepare-remote-cluster.sh
#
# This creates/deletes the required resources on a remote cluster and then
# creates/deletes a secret on the Kiali home cluster (where Kiali
# is or will be installed).
#
# See --help for more details and valid options.
##############################################################################

# The "Kiali Secret" is the remote cluster secret that is created in the
# namespace where Kiali is to be deployed.
KIALI_SECRET_LABEL_NAME_MULTICLUSTER="kiali.io/multiCluster"
KIALI_SECRET_ANNOTATION_NAME_CLUSTER="kiali.io/cluster"
KIALI_SECRET_NAME_PREFIX="kiali-remote-cluster-secret-"

DEFAULT_ALLOW_SKIP_TLS_VERIFY="false"
DEFAULT_CLIENT_EXE="kubectl"
DEFAULT_DELETE="false"
DEFAULT_DRY_RUN="false"
DEFAULT_HELM="helm"
DEFAULT_KIALI_CLUSTER_CONTEXT="east"
DEFAULT_KIALI_CLUSTER_NAMESPACE="istio-system"
DEFAULT_KIALI_VERSION="latest"
DEFAULT_PROCESS_KIALI_SECRET="true"
DEFAULT_PROCESS_REMOTE_RESOURCES="true"
DEFAULT_REMOTE_CLUSTER_CONTEXT="west"
DEFAULT_REMOTE_CLUSTER_NAME=""
DEFAULT_REMOTE_CLUSTER_NAMESPACE="kiali-access-ns"
DEFAULT_REMOTE_CLUSTER_URL=""
DEFAULT_RESOURCE_NAME="kiali-remote-access"
DEFAULT_VIEW_ONLY="true"
DEFAULT_EXEC_AUTH_JSON=""

: ${ALLOW_SKIP_TLS_VERIFY:=${DEFAULT_ALLOW_SKIP_TLS_VERIFY}}
: ${CLIENT_EXE:=${DEFAULT_CLIENT_EXE}}
: ${DELETE:=${DEFAULT_DELETE}}
: ${DRY_RUN:=${DEFAULT_DRY_RUN}}
: ${HELM:=${DEFAULT_HELM}}
: ${KIALI_CLUSTER_CONTEXT:=${DEFAULT_KIALI_CLUSTER_CONTEXT}}
: ${KIALI_CLUSTER_NAMESPACE:=${DEFAULT_KIALI_CLUSTER_NAMESPACE}}
: ${KIALI_RESOURCE_NAME:=${DEFAULT_RESOURCE_NAME}}
: ${KIALI_VERSION:=${DEFAULT_KIALI_VERSION}}
: ${PROCESS_KIALI_SECRET:=${DEFAULT_PROCESS_KIALI_SECRET}}
: ${PROCESS_REMOTE_RESOURCES:=${DEFAULT_PROCESS_REMOTE_RESOURCES}}
: ${REMOTE_CLUSTER_CONTEXT:=${DEFAULT_REMOTE_CLUSTER_CONTEXT}}
: ${REMOTE_CLUSTER_NAMESPACE:=${DEFAULT_REMOTE_CLUSTER_NAMESPACE}}
: ${REMOTE_CLUSTER_NAME:=${DEFAULT_REMOTE_CLUSTER_NAME}}
: ${REMOTE_CLUSTER_URL:=${DEFAULT_REMOTE_CLUSTER_URL}}
: ${VIEW_ONLY:=${DEFAULT_VIEW_ONLY}}
: ${EXEC_AUTH_JSON:=${DEFAULT_EXEC_AUTH_JSON}}

DRY_RUN_ARG="--dry-run=none"

#
# info - dumps an info message to stdout or (if in a dry run) to stderr.
#

info() {
  # if we are in dry run, the only output we want to show on stdout is the resource yaml
  if [ "${DRY_RUN}" == "false" ]; then
    echo "INFO: $1"
  else
    echo "INFO(dry run): $1" 1>&2
  fi
}

#
# error - dumps an error message and exits immediately.
#

error() {
  echo "ERROR: $1"
  exit 1
}

#
# create_resources_in_remote_cluster - function to create the role/binding/SA/secret in the remote cluster.
#

create_resources_in_remote_cluster() {
  # We need helm for some of the commands below - make sure it is in PATH.
  if ! which ${HELM} &>/dev/null; then
    error "Cannot find the Helm executable '${HELM}'; please install it."
  fi

  IS_OPENSHIFT="false"
  if ${CLIENT_EXE_REMOTE_CLUSTER} api-versions | grep -q 'operator.openshift.io/v1'; then
    IS_OPENSHIFT="true"
  fi

  info "Create the remote cluster namespace [${REMOTE_CLUSTER_NAMESPACE}] if it doesn't exist"
  ${CLIENT_EXE_REMOTE_CLUSTER} get namespace "${REMOTE_CLUSTER_NAMESPACE}" &> /dev/null || \
    ${CLIENT_EXE_REMOTE_CLUSTER} create ${DRY_RUN_ARG} namespace "${REMOTE_CLUSTER_NAMESPACE}"

  info "Create the remote cluster resources with the appropriate permissions for Kiali (view_only=${VIEW_ONLY})"
  if [ "${VIEW_ONLY}" == "true" ]; then
    local role_template_name="role-viewer"
  else
    local role_template_name="role"
  fi

  if [ "${KIALI_VERSION}" != "latest" ]; then
    local helm_version_arg="--version ${KIALI_VERSION}"
  fi

  local helm_template_output="$(${HELM} template            \
      ${helm_version_arg:-}                                 \
      --namespace ${REMOTE_CLUSTER_NAMESPACE}               \
      --set isOpenShift=${IS_OPENSHIFT}                     \
      --set deployment.remote_cluster_resources_only=true   \
      --set deployment.instance_name=${KIALI_RESOURCE_NAME} \
      --set deployment.cluster_wide_access=true             \
      --set deployment.view_only_mode=${VIEW_ONLY}          \
      --set auth.strategy=anonymous                         \
      --repo https://kiali.org/helm-charts                  \
      kiali-server                                          \
      kiali-server)"

  if [ "${DRY_RUN}" == "true" ]; then
    echo "${helm_template_output}"
  else
    echo "${helm_template_output}" | ${CLIENT_EXE_REMOTE_CLUSTER} apply ${DRY_RUN_ARG} -f -
  fi

  # Create the SA token secret manually.
  # See https://kubernetes.io/docs/tasks/configure-pod-container/configure-service-account/#manually-create-an-api-token-for-a-serviceaccount
  # This may generate another token secret with an auto-generated suffix.
  # This secret (and the auto-generated one) will automatically be deleted when the SA is deleted.
  # TODO ephemeral time-based tokens are actually preferred; should we figure out how to use those instead?
  local remote_sa_secret_yaml=$(cat <<EOF
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
    echo "${remote_sa_secret_yaml}"
  else
    echo "${remote_sa_secret_yaml}" | ${CLIENT_EXE_REMOTE_CLUSTER} apply ${DRY_RUN_ARG} -f -
  fi
} # END create_resources_in_remote_cluster

#
# get_remote_cluster_token - Obtains the token that can be used to access the remote cluster using the remote SA.
#                            The result will be placed in the TOKEN variable.
#

get_remote_cluster_token() {
  # Wait for the remote cluster secret to generate its token. This is the token that will give Kiali the ability to log
  # into the remote cluster and access its resources with the permissions given to the new service account.
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
    #  token_secret="$(${CLIENT_EXE_REMOTE_CLUSTER} get sa -n ${REMOTE_CLUSTER_NAMESPACE} ${KIALI_RESOURCE_NAME} -o jsonpath='{.secrets[0].name}' 2>/dev/null)" \
    #    && [ "${token_secret}" != "" ] \
    #    && break \
    #    || (info "Waiting for the SA secret to be created..." && sleep 5)
    #done
    #if [ "${token_secret}" == "" ]; then
    #  exit "There is no secret assigned yet to the remote cluster SA [${REMOTE_CLUSTER_NAMESPACE}/${KIALI_RESOURCE_NAME}]. Aborting."
    #fi
    local token_secret="${KIALI_RESOURCE_NAME}"

    for i in 1 2 3 4 5 6; do
      local encoded_token="$(${CLIENT_EXE_REMOTE_CLUSTER} get secrets -n ${REMOTE_CLUSTER_NAMESPACE} ${token_secret} -o jsonpath='{.data.token}' 2>/dev/null)" \
        && [ "${encoded_token}" != "" ] \
        && break \
        || (info "Waiting for the remote cluster SA secret token to be created..." && sleep 5)
    done
    if [ "${encoded_token}" == "" ]; then
      error "$(cat <<ERRMSG
There is no token assigned yet to the remote cluster SA secret [${token_secret}] found in remote cluster namespace [${REMOTE_CLUSTER_NAMESPACE}].
If you do not have such a secret yet, you can create one in order to generate a token. For example:
${CLIENT_EXE_REMOTE_CLUSTER} apply -f - <<EOM
apiVersion: v1
kind: Secret
metadata:
  name: "${token_secret}"
  namespace: "${REMOTE_CLUSTER_NAMESPACE}"
  annotations:
    kubernetes.io/service-account.name: "${KIALI_RESOURCE_NAME}"
type: kubernetes.io/service-account-token
EOM
ERRMSG
)"
    fi
    TOKEN="$(echo ${encoded_token} | base64 -d)"
  fi
}

#
# create_kiali_remote_cluster_secret - creates the secret in the Kiali cluster so Kiali can access the remote cluster.
#

create_kiali_remote_cluster_secret() {
  info "Create the remote cluster secret in the Kiali cluster"

  # If the remote cluster URL was not provided by the user, then examine the local kubeconfig and extract the rest of the necessary data we need in order to create the Kiali remote cluster secret.
  local remote_cluster_server_url
  if [ "${REMOTE_CLUSTER_URL}" == "" ]; then
    remote_cluster_server_url="$(${CLIENT_EXE} config view -o jsonpath='{.clusters[?(@.name == "'${REMOTE_CLUSTER_NAME_FROM_CONTEXT}'")].cluster.server}' 2>/dev/null)"
  else
    remote_cluster_server_url="${REMOTE_CLUSTER_URL}"
  fi
  if [ "${remote_cluster_server_url}" == "" ]; then
    error "Unable to determine the remote cluster server URL from the kubeconfig remote cluster named [${REMOTE_CLUSTER_NAME_FROM_CONTEXT}]. Check that the kubeconfig is correct."
  else
    info remote_cluster_server_url=${remote_cluster_server_url}
  fi

  if [ "${ALLOW_SKIP_TLS_VERIFY}" != "true" ]; then
    # The CA data can either be specified directly in the config or a CA file is defined that we then have to read. Either way, get the CA bytes.
    # If we cannot find the CA bytes, it could be because it is configured with "insecure-skip-tls-verify: true". If so, use that unless we were told not to.
    # It is an error otherwise because we need the CA or we need to be allowed to skip the TLS verification.
    local remote_cluster_ca_bytes="$(${CLIENT_EXE} config view --raw=true -o jsonpath='{.clusters[?(@.name == "'${REMOTE_CLUSTER_NAME_FROM_CONTEXT}'")].cluster.certificate-authority-data}' 2>/dev/null)"
    if [ "${remote_cluster_ca_bytes}" == "" ]; then
      local ca_file="$(${CLIENT_EXE} config view --raw=true -o jsonpath='{.clusters[?(@.name == "'${REMOTE_CLUSTER_NAME_FROM_CONTEXT}'")].cluster.certificate-authority}' 2>/dev/null)"
      if [ ! -r "${ca_file}" ]; then
          info "WARNING: Unable to read the remote cluster CA bytes or file specified in the kubeconfig remote cluster named [${REMOTE_CLUSTER_NAME_FROM_CONTEXT}]."
      else
        info ca_file=${ca_file}
        remote_cluster_ca_bytes="$(cat ${ca_file} 2>/dev/null | base64 --wrap=0 2>/dev/null)"
        if [ "${remote_cluster_ca_bytes}" == "" ]; then
          info "WARNING: Unable to get the remote cluster CA cert data from the CA file [${ca_file}] specified in the kubeconfig remote cluster named [${REMOTE_CLUSTER_NAME_FROM_CONTEXT}]."
        fi
      fi
      if [ "${remote_cluster_ca_bytes}" == "" ]; then
        info "Obtaining the remote cluster CA cert data from the remote cluster itself"
        remote_cluster_ca_bytes="$(${CLIENT_EXE_REMOTE_CLUSTER} get configmap -n ${REMOTE_CLUSTER_NAMESPACE} kube-root-ca.crt -ojsonpath='{.data.ca\.crt}' | base64 --wrap=0 2>/dev/null)"
      fi
    fi
  fi

  if [ "${remote_cluster_ca_bytes:-}" == "" ]; then
    if [ "${ALLOW_SKIP_TLS_VERIFY}" == "true" ]; then
      info "Kiali will be allowed to insecurely skip TLS verification when connecting to the remote cluster named [${REMOTE_CLUSTER_NAME}]."
      local cert_auth_yaml="insecure-skip-tls-verify: true"
    else
      error "Cannot obtain the remote cluster CA cert data. You can allow for this insecure condition by passing in '--allow-skip-tls-verify true'"
    fi
  else
    local cert_auth_yaml="certificate-authority-data: ${remote_cluster_ca_bytes}"
  fi

  # Check if the REMOTE_CLUSTER_NAME matches the AWS EKS ARN regex pattern.
  # If it does, extract the cluster name from the ARN and assign it back to REMOTE_CLUSTER_NAME.
  AWS_REGION_REGEX='(us|eu|ap|sa|ca|me|af|il|us-gov)-(north|south|east|west|central|southeast|northeast)-[0-9]'
  AWS_EKS_ARN_REGEX="arn:aws:eks:${AWS_REGION_REGEX}:[0-9]{12}:cluster/([0-9A-Za-z][_A-Za-z0-9\-]{0,99})$"
  if echo "${REMOTE_CLUSTER_NAME}" | grep -Eq "${AWS_EKS_ARN_REGEX}"; then
      REMOTE_CLUSTER_NAME=$(echo "${REMOTE_CLUSTER_NAME}" | sed 's/^.*:cluster\/\(.*\)$/\1/')
  fi
  # a Secret stringData key must conform to Kubernetes naming rules. Othewise, this kind of error will result:
  #    a valid config key must consist of alphanumeric characters, '-', '_' or '.'
  #    (e.g. 'key.name',  or 'KEY_NAME',  or 'key-name', regex used for validation is '[-._a-zA-Z0-9]+')
  # Make sure the remote cluster name conforms to this syntax because it will be used as the key to the secret data.
  if ! echo "${REMOTE_CLUSTER_NAME}" | grep -Eq '^[-._a-zA-Z0-9]+$'; then
    error "The remote cluster name [${REMOTE_CLUSTER_NAME}] does not conform to Kubernetes rules for secret key data. Use --remote-cluster-name to specify a name that matches the regex '^[-._a-zA-Z0-9]+$'"
  fi

  if [ "${EXEC_AUTH_JSON}" != "" ]; then
    local user_auth=$(cat <<EOF
exec:
$(echo "${EXEC_AUTH_JSON}" | yq -P | sed "s/^/  /g")
EOF
)
  else
    # Get the token that is needed to access the remote cluster
    get_remote_cluster_token
    local user_auth="token: ${TOKEN}"
  fi

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
$(echo "${user_auth}" | sed "s/^/        /g")
    clusters:
    - name: ${REMOTE_CLUSTER_NAME}
      cluster:
        server: ${remote_cluster_server_url}
        ${cert_auth_yaml}
...
EOF
)

  if [ "${DRY_RUN}" == "true" ]; then
    echo "${KIALI_SECRET_YAML}"
  else
    echo "${KIALI_SECRET_YAML}" | ${CLIENT_EXE_KIALI_CLUSTER} apply ${DRY_RUN_ARG} -f -
  fi

  info "A remote cluster secret named [${KIALI_SECRET_FULL_NAME}] has been created in the Kiali cluster namespace [${KIALI_CLUSTER_NAMESPACE}]. It can be used by Kiali to access the remote cluster."
} # END create_kiali_remote_cluster_secret

#
# Process cmd line arguments
#

while [ $# -gt 0 ]; do
  key="$1"
  case $key in
    -astv|--allow-skip-tls-verify)
      [ "${2:-}" != "true" -a "${2:-}" != "false" ] && error "--allow-skip-tls-verify must be 'true' or 'false'"
      ALLOW_SKIP_TLS_VERIFY="$2"
      shift;shift
      ;;
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
    -krn|--kiali-resource-name)
      KIALI_RESOURCE_NAME="$2"
      shift;shift
      ;;
    -kv|--kiali-version)
      KIALI_VERSION="$2"
      shift;shift
      ;;
    -pks|--process-kiali-secret)
      [ "${2:-}" != "true" -a "${2:-}" != "false" ] && error "--process-kiali-secret must be 'true' or 'false'"
      PROCESS_KIALI_SECRET="$2"
      shift;shift
      ;;
    -prr|--process-remote-resources)
      [ "${2:-}" != "true" -a "${2:-}" != "false" ] && error "--process-remote-resources must be 'true' or 'false'"
      PROCESS_REMOTE_RESOURCES="$2"
      shift;shift
      ;;
    -rcc|--remote-cluster-context)
      REMOTE_CLUSTER_CONTEXT="$2"
      shift;shift
      ;;
    -rcn|--remote-cluster-name)
      REMOTE_CLUSTER_NAME="$2"
      shift;shift
      ;;
    -rcns|--remote-cluster-namespace)
      REMOTE_CLUSTER_NAMESPACE="$2"
      shift;shift
      ;;
    -rcu|--remote-cluster-url)
      REMOTE_CLUSTER_URL="$2"
      shift;shift
      ;;
    -vo|--view-only)
      [ "${2:-}" != "true" -a "${2:-}" != "false" ] && error "--view-only must be 'true' or 'false'"
      VIEW_ONLY="$2"
      shift;shift
      ;;
    -eaj|--exec-auth-json)
      EXEC_AUTH_JSON="$2"
      shift;shift
      ;;
    -h|--help)
      cat <<HELPMSG

Use this tool to help prepare Kiali for accessing multiple clusters.

This tool can create/delete the required resources on a remote cluster, and then
it can create/delete a "remote cluster secret" on the Kiali home cluster (where
Kiali is or will be installed). These remote cluster secrets will enable Kiali to
observe multiple clusters.

You must be logged into and have Kubernetes contexts configured for the clusters
this script needs to access (--remote-cluster-context and --kiali-cluster-context).
Your configured contexts can be found via "kubectl config get-contexts".

You must have 'helm' installed and you must have connectivity to the public Kiali
helm repository in order for this script to be able to access the Kiali Helm charts.

Use "--dry-run true" to review the resources this script would create without having
it actually create anything in any cluster. The YAML for the resources to
be created will be printed to stdout, with informational messages printed to stderr.
You can isolate the resource YAML by piping stderr to /dev/null or some output file
(e.g. kiali-prepare-remote-cluster.sh --dry-run true 2>/dev/null). Note that if you
ask the script to produce the remote cluster secret YAML (--process-kiali-secret)
in addition to the remote cluster resources YAML (--process-remote-resources),
the resulting output of a dry run represent all the resources that this script
would have created in two different clusters (the Kiali cluster and remote cluster).
In this case, do not manually apply the resulting YAML to a single cluster because
that will not do what you want. In order for Kiali to work properly, the final
remote cluster secret resource that is output by the dry run must be applied to the
Kiali cluster; the other resources must be applied to the remote cluster.

Valid command line arguments:
  -astv|--allow-skip-tls-verify: either 'true' or 'false'. If the cluster connection
                                 skips TLS verification (i.e. the context has
                                 insecure-skip-tls-verify set to true), and you
                                 agree with Kiali connecting to the remote cluster
                                 with the same insecure setting, you must set this
                                 to 'true' or else the script will abort.
                                 Default: "${DEFAULT_ALLOW_SKIP_TLS_VERIFY}"
  -c|--client: either 'oc' or 'kubectl'. Default: "${DEFAULT_CLIENT_EXE}"
  -d|--delete: either 'true' or 'false'. If 'true' the resources and/or secret
               will be deleted. Default: "${DEFAULT_DELETE}"
  -dr|--dry-run: if 'true' no resources will be created; the yaml will be output.
                 Default: "${DEFAULT_DRY_RUN}"
  -helm|--helm: the path to your Helm CLI executable. Default: "${DEFAULT_HELM}"
  -kcc|--kiali-cluster-context: the .kube context that is used to communicate
                                with the cluster where Kiali is installed.
                                This is needed only if you need to create
                                the Kiali secret (--process-kiali-secret true).
                                If 'current' then the current kube context
                                will be used. You cannot set both this
                                and --remote-cluster-context to the same value.
                                Default: "${DEFAULT_KIALI_CLUSTER_CONTEXT}"
  -kcn|--kiali-cluster-namespace: the namespace where Kiali is installed
                                  in the cluster defined by the Kiali cluster
                                  context (see --kiali-cluster-context).
                                  Default: "${DEFAULT_KIALI_CLUSTER_NAMESPACE}"
  -krn|--kiali-resource-name: used to name all the resources on the remote cluster.
                              Default: "${DEFAULT_RESOURCE_NAME}"
  -kv|--kiali-version: The version of Kiali that is installed. This is used to
                       determine what the role should look like. Pass in
                       "latest" to specify the latest version of Kiali.
                       Default: "${DEFAULT_KIALI_VERSION}"
  -pks|--process-kiali-secret: If 'true' the Kiali secret will be created in
                               (or deleted from, see --delete) the namespace where
                               Kiali is or will be (--kiali-cluster-namespace).
                               The remote cluster must have its resources
                               created (specifically, the Service Account
                               must be accessible) in order for the Kiali
                               secret to be created.
                               Default: "${DEFAULT_PROCESS_KIALI_SECRET}"
  -prr|--process-remote-resources: If 'true' the remote resources such as the
                                   roles/bindings/service account will be created
                                   in (or deleted from, see --delete) the remote
                                   cluster in the namespace defined via the
                                   --remote-cluster-namespace option.
                                   Default: "${DEFAULT_PROCESS_REMOTE_RESOURCES}"
  -rcc|--remote-cluster-context: the .kube context that is used to communicate
                                 with the remote cluster.
                                 If 'current' then the current kube context
                                 will be used. You cannot set both this
                                 and --kiali-cluster-context to the same value.
                                 Default: "${DEFAULT_REMOTE_CLUSTER_CONTEXT}"
  -rcn|--remote-cluster-name: the name to be assigned to the remote cluster. Kiali
                              will associate the remote cluster with this name.
                              Make sure it is the same name that Istio uses.
                              This must follow Kubernetes naming rules. Use
                              only alphanumeric and dash ('-') characters.
                              Default: the cluster name found in the remote
                                       cluster context
  -rcns|--remote-cluster-namespace: the namespace where the resources will be
                                    created on the remote cluster.
                                    Default: "${DEFAULT_REMOTE_CLUSTER_NAMESPACE}"
  -rcu|--remote_cluster_url: the URL to the Kubernetes API server for the remote cluster.
                             If empty, the local kubeconfig will be examined and the server
                             associated with the remote cluster context will be used.
                             Default: "${DEFAULT_REMOTE_CLUSTER_URL}"
  -vo|--view-only: if 'true' then the created service account/remote secret
                   will only provide a read-only view of the remote cluster.
                   Default: "${DEFAULT_VIEW_ONLY}"
  -eaj|--exec-auth-json: If you want to use exec auth for authentication,
                         specify ExecConfig in clientcmd/v1 in json format
                         To use this option, kiali's 'auth.strategy' must be
                         changed to 'anonymous'. 'yq' command is required.
                         (e.g. helm upgrade -n istio-system \\
                         --set auth.strategy="anonymous" kiali-server kiali/kiali-server)
                         Default: "${DEFAULT_EXEC_AUTH_JSON}"
  -h|--help: this text.
HELPMSG
      exit 1
      ;;
    *)
      error "Unknown argument [$key]. Aborting."
      ;;
  esac
done

#
# Dump the variables that are based on command line arguments
#

info "=== SETTINGS ==="
info CLIENT_EXE=${CLIENT_EXE}
info PROCESS_KIALI_SECRET=${PROCESS_KIALI_SECRET}
info PROCESS_REMOTE_RESOURCES=${PROCESS_REMOTE_RESOURCES}
info DELETE=${DELETE}
info DRY_RUN=${DRY_RUN}
info HELM=${HELM}
info KIALI_CLUSTER_CONTEXT=${KIALI_CLUSTER_CONTEXT}
info KIALI_CLUSTER_NAMESPACE=${KIALI_CLUSTER_NAMESPACE}
info KIALI_RESOURCE_NAME=${KIALI_RESOURCE_NAME}
info KIALI_VERSION=${KIALI_VERSION}
info REMOTE_CLUSTER_CONTEXT=${REMOTE_CLUSTER_CONTEXT}
info REMOTE_CLUSTER_NAME=${REMOTE_CLUSTER_NAME}
info REMOTE_CLUSTER_NAMESPACE=${REMOTE_CLUSTER_NAMESPACE}
info REMOTE_CLUSTER_URL=${REMOTE_CLUSTER_URL}
info VIEW_ONLY=${VIEW_ONLY}
info EXEC_AUTH_JSON="${EXEC_AUTH_JSON}"

#
# Main processing - get some additional information we need and then start creating (or deleting) resources.
#

# Make sure we have the client.
if ! which ${CLIENT_EXE} &>/dev/null; then
  error "Cannot find client '${CLIENT_EXE}'"
fi

# Ensure the two clusters aren't actually the same one since this probably is not what the user meant to do.
if [ "${REMOTE_CLUSTER_CONTEXT}" == "${KIALI_CLUSTER_CONTEXT}" ]; then
  error "You cannnot set both contexts to the same value [${REMOTE_CLUSTER_CONTEXT}]."
fi

# Determine the two main client commands to be used to access the two clusters.
# If using current context, don't use the --context arg; OpenShift will require
# you to pass credentials and we don't want that if you are already connected.
if [ "${REMOTE_CLUSTER_CONTEXT}" == "current" ]; then
  REMOTE_CLUSTER_CONTEXT="$(${CLIENT_EXE} config current-context)"
  CLIENT_EXE_REMOTE_CLUSTER="${CLIENT_EXE}"
else
  CLIENT_EXE_REMOTE_CLUSTER="${CLIENT_EXE} --context=${REMOTE_CLUSTER_CONTEXT}"
fi

if [ "${KIALI_CLUSTER_CONTEXT}" == "current" ]; then
  KIALI_CLUSTER_CONTEXT="$(${CLIENT_EXE} config current-context)"
  CLIENT_EXE_KIALI_CLUSTER="${CLIENT_EXE}"
else
  CLIENT_EXE_KIALI_CLUSTER="${CLIENT_EXE} --context=${KIALI_CLUSTER_CONTEXT}"
fi

# Find out the name of the cluster that is associated with the remote cluster's kube context
REMOTE_CLUSTER_NAME_FROM_CONTEXT="$(${CLIENT_EXE} config view -o jsonpath='{.contexts[?(@.name == "'${REMOTE_CLUSTER_CONTEXT}'")].context.cluster}' 2>/dev/null)"
if [ "${REMOTE_CLUSTER_NAME_FROM_CONTEXT}" == "" ]; then
  error "Unable to determine the remote cluster associated with the given remote cluster context [${REMOTE_CLUSTER_CONTEXT}]. Check that the context name you provided is correct."
fi

if [ "${REMOTE_CLUSTER_NAME}" == "" ]; then
  # The default cluster name will be the cluster name as found in the kube context.
  REMOTE_CLUSTER_NAME="${REMOTE_CLUSTER_NAME_FROM_CONTEXT}"
fi
info REMOTE_CLUSTER_NAME=${REMOTE_CLUSTER_NAME}

# the secret full name must be a valid k8s resource name - this isn't foolproof but change special characters to dash and uppercase to lowercase
KIALI_SECRET_FULL_NAME="${KIALI_SECRET_NAME_PREFIX}$(echo "${REMOTE_CLUSTER_NAME}" | sed -e 's/[^-a-zA-Z0-9]/-/g' -e 's/[A-Z]/\L&/g')"

# Create or delete the resources based on what the user wants to do
if [ "${DELETE}" == "true" ]; then
  if [ "${PROCESS_REMOTE_RESOURCES}" == "true" ]; then
    info "Deleting remote cluster resources"
    ${CLIENT_EXE_REMOTE_CLUSTER} delete ${DRY_RUN_ARG} --ignore-not-found=true serviceaccount "${KIALI_RESOURCE_NAME}" -n "${REMOTE_CLUSTER_NAMESPACE}"
    ${CLIENT_EXE_REMOTE_CLUSTER} delete ${DRY_RUN_ARG} --ignore-not-found=true clusterrole -l "app.kubernetes.io/instance=${KIALI_RESOURCE_NAME}"
    ${CLIENT_EXE_REMOTE_CLUSTER} delete ${DRY_RUN_ARG} --ignore-not-found=true clusterrolebinding "${KIALI_RESOURCE_NAME}"
  else
    info "Skipping the deletion of the remote resources."
  fi

  if [ "${PROCESS_KIALI_SECRET}" == "true" ]; then
    info "Deleting Kiali cluster resources"
    ${CLIENT_EXE_KIALI_CLUSTER} delete ${DRY_RUN_ARG} --ignore-not-found=true secret "${KIALI_SECRET_FULL_NAME}" -n "${KIALI_CLUSTER_NAMESPACE}"
  else
    info "Skipping the deletion of the Kiali remote cluster secret."
  fi
else
  if [ "${PROCESS_REMOTE_RESOURCES}" == "true" ]; then
    create_resources_in_remote_cluster
  else
    info "Skipping the creation of the remote resources."
  fi

  if [ "${PROCESS_KIALI_SECRET}" == "true" ]; then
    create_kiali_remote_cluster_secret
  else
    info "Skipping the creation of the Kiali remote cluster secret."
  fi
fi

exit 0
