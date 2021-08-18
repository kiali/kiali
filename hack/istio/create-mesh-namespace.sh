#/bin/bash

# This creates/deletes a mesh-enabled namespace/project

# Given a namepace, prepare it for inclusion in Maistra's control plane
# This means:
# 1. Create a SMM
prepare_maistra() {
  local ns="${1}"

  cat <<EOM | ${CLIENT_EXE} apply -f -
apiVersion: maistra.io/v1
kind: ServiceMeshMember
metadata:
  name: default
  namespace: ${ns}
spec:
  controlPlaneRef:
    namespace: ${ISTIO_NAMESPACE}
    name: "$(${CLIENT_EXE} get smcp -n ${ISTIO_NAMESPACE} -o jsonpath='{.items[0].metadata.name}' )"
EOM
}

: ${CLIENT_EXE:=oc}
: ${DELETE_NAMESPACE:=false}
: ${ENABLE_INJECTION:=true}
: ${ISTIO_NAMESPACE:=istio-system}
: ${SERVICE_ACCOUNTS:="default"}

while [ $# -gt 0 ]; do
  key="$1"
  case $key in
    -c|--client)
      CLIENT_EXE="$2"
      shift;shift
      ;;
    -d|--delete)
      DELETE_NAMESPACE="$2"
      shift;shift
      ;;
    -ei|--enable-injection)
      ENABLE_INJECTION="$2"
      shift;shift
      ;;
    -in|--istio-namespace)
      ISTIO_NAMESPACE="$2"
      shift;shift
      ;;
    -h|--help)
      cat <<HELPMSG
Valid command line arguments:
  -c|--client: either 'oc' or 'kubectl'
  -d|--delete: either 'true' or 'false'. If 'true' the namespace will be deleted, not installed.
  -ei|--enable-injection: either 'true' or 'false' (default is true). If 'true' auto-inject proxies for the workloads.
  -in|--istio-namespace <name>: Where the Istio control plane is installed (default: istio-system).
  -n|--namespace <name>: The namespace to be created or deleted. REQUIRED.
  -sa|--service-accounts
      The service accounts to use for adding users to the SecurityContextConstraints.
      You can specify more than one service account separated with spaces.
      Default: "default"
  -h|--help: this text
HELPMSG
      exit 1
      ;;
    -n|--namespace)
      NAMESPACE="$2"
      shift;shift
      ;;
    -sa|--service-accounts)
      SERVICE_ACCOUNTS="$2"
      shift;shift
      ;;
    *)
      echo "Unknown argument [$key]. Aborting."
      exit 1
      ;;
  esac
done

echo Will create namespace using these settings:
echo CLIENT_EXE=${CLIENT_EXE}
echo DELETE_NAMESPACE=${DELETE_NAMESPACE}
echo ENABLE_INJECTION=${ENABLE_INJECTION}
echo ISTIO_NAMESPACE=${ISTIO_NAMESPACE}
echo NAMESPACE=${NAMESPACE}
echo SERVICE_ACCOUNTS=${SERVICE_ACCOUNTS}

[ -z "$NAMESPACE" ] && echo "You must specify --namespace" && exit 1

IS_OPENSHIFT="false"
IS_MAISTRA="false"
if [[ "${CLIENT_EXE}" = *"oc" ]]; then
  IS_OPENSHIFT="true"
  IS_MAISTRA=$([ "$(oc get crd | grep servicemesh | wc -l)" -gt "0" ] && echo "true" || echo "false")
fi

echo "IS_OPENSHIFT=${IS_OPENSHIFT}"
echo "IS_MAISTRA=${IS_MAISTRA}"

# If we are to delete, remove everything and exit immediately after
if [ "${DELETE_NAMESPACE}" == "true" ]; then
  echo "Deleting namespace ${NAMESPACE}..."
  if [ "${IS_OPENSHIFT}" == "true" ]; then
    if [ "${IS_MAISTRA}" != "true" ]; then
      $CLIENT_EXE delete network-attachment-definition istio-cni -n ${NAMESPACE}
    else
      $CLIENT_EXE delete smm default -n ${NAMESPACE}
    fi
    $CLIENT_EXE delete scc "${NAMESPACE}-scc"
  fi
  ${CLIENT_EXE} delete namespace ${NAMESPACE}
  exit 0
fi

# Create and prepare the demo namespaces

if [ "${IS_OPENSHIFT}" == "true" ]; then
  $CLIENT_EXE new-project ${NAMESPACE}
else
  $CLIENT_EXE create namespace ${NAMESPACE}
fi

if [ "${ENABLE_INJECTION}" == "true" ]; then
  ${CLIENT_EXE} label namespace ${NAMESPACE} istio-injection=enabled
fi

if [ "${IS_MAISTRA}" == "true" ]; then
  prepare_maistra "${NAMESPACE}"
fi

if [ "${IS_OPENSHIFT}" == "true" ]; then
  if [ "${IS_MAISTRA}" != "true" ]; then
    cat <<NAD | $CLIENT_EXE -n ${NAMESPACE} create -f -
apiVersion: "k8s.cni.cncf.io/v1"
kind: NetworkAttachmentDefinition
metadata:
  name: istio-cni
NAD
  fi

  USERS=""
  for sa in ${SERVICE_ACCOUNTS}; do
    USERS=$(printf "%s\n- system:serviceaccount:%s:%s" "${USERS}" ${NAMESPACE} ${sa})
  done

  cat <<SCC | $CLIENT_EXE apply -f -
apiVersion: security.openshift.io/v1
kind: SecurityContextConstraints
metadata:
  name: "${NAMESPACE}-scc"
runAsUser:
  type: RunAsAny
seLinuxContext:
  type: RunAsAny
supplementalGroups:
  type: RunAsAny
users:${USERS}
SCC
fi

