#!/bin/bash
##############################################################################
# install-sidecars-ambient.sh
#
# Installs 2 different namespaces: One with istio-injection enabled and other
# with Ambient annotations.
# Ambient workload will send traffic to sidecar
# Sidecar workload will send traffic to ambient
#
##############################################################################

# Go to the main output directory and try to find an Istio there.
AMBIENT_NS="test-ambient"
: ${ARCH:=amd64}
CLIENT_EXE="oc"
HACK_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source ${HACK_SCRIPT_DIR}/../functions.sh
OUTPUT_DIR="${OUTPUT_DIR:-${HACK_SCRIPT_DIR}/../../../_output}"
SIDECAR_NS="test-sidecar"
WAYPOINT="false"

while [ $# -gt 0 ]; do
  key="$1"
  case $key in
    -a|--arch)
      ARCH="$2"
      shift;shift
      ;;
    -c|--client)
      CLIENT_EXE="$2"
      shift;shift
      ;;
    -d|--delete)
      DELETE="$2"
      shift;shift
      ;;
    -w|--waypoint)
      WAYPOINT="$2"
      shift;shift
      ;;
    -h|--help)
      cat <<HELPMSG
Valid command line arguments:
  -a|--arch <amd64|ppc64le|s390x>: Images for given arch will be used (default: amd64).
  -c|--client: either 'oc' or 'kubectl'
  -d|--delete: either 'true' or 'false'. If 'true' the namespaces demo will be deleted, not installed.
  -w|--waypoint: Install a waypoint proxy in the ambient namespace. By default is false.
  -h|--help: this text
HELPMSG
      exit 1
      ;;
    *)
      echo "Unknown argument [$key]. Aborting."
      exit 1
      ;;
  esac
done

# If we are to delete, remove everything and exit immediately after
if [ "${DELETE}" == "true" ]; then
  if [ "${IS_OPENSHIFT}" == "true" ]; then
    echo "Deleting Waypoint demos namespaces"
    ${CLIENT_EXE} delete project ${SIDECAR_NS}
    ${CLIENT_EXE} delete project ${AMBIENT_NS}
    exit 0
  else
    echo "Deleting ambient-sidecar demo namespaces"
    ${CLIENT_EXE} delete namespace ${SIDECAR_NS}
    ${CLIENT_EXE} delete namespace ${AMBIENT_NS}
    exit 0
  fi
fi

apply_network_attachment() {
  NAME=$1
  cat <<NAD | $CLIENT_EXE -n ${NAME} apply -f -
apiVersion: "k8s.cni.cncf.io/v1"
kind: NetworkAttachmentDefinition
metadata:
  name: istio-cni
NAD
  cat <<SCC | $CLIENT_EXE apply -f -
apiVersion: security.openshift.io/v1
kind: SecurityContextConstraints
metadata:
  name: ${NAME}-scc
runAsUser:
  type: RunAsAny
seLinuxContext:
  type: RunAsAny
supplementalGroups:
  type: RunAsAny
priority: 9
users:
- "system:serviceaccount:${NAME}:default"
- "system:serviceaccount:${NAME}:${NAME}"
SCC
}

CLIENT_EXE=`which ${CLIENT_EXE}`
if [ "$?" = "0" ]; then
  echo "The cluster client executable is found here: ${CLIENT_EXE}"
else
  echo "You must install the cluster client ${CLIENT_EXE} in your PATH before you can continue"
  exit 1
fi

IS_OPENSHIFT="false"
if [[ "${CLIENT_EXE}" = *"oc" ]]; then
  IS_OPENSHIFT="true"
fi

if [ "${IS_OPENSHIFT}" == "true" ]; then
  $CLIENT_EXE new-project ${SIDECAR_NS}
  $CLIENT_EXE new-project ${AMBIENT_NS}
  apply_network_attachment ${SIDECAR_NS}
  $CLIENT_EXE adm policy add-scc-to-user anyuid -z default -n ${SIDECAR_NS}
  apply_network_attachment ${AMBIENT_NS}
  $CLIENT_EXE adm policy add-scc-to-user anyuid -z default -n ${AMBIENT_NS}
else
  ${CLIENT_EXE} create ns ${SIDECAR_NS}
  ${CLIENT_EXE} create ns ${AMBIENT_NS}
fi

${CLIENT_EXE} label ns ${SIDECAR_NS} istio-injection=enabled
${CLIENT_EXE} label ns ${AMBIENT_NS} istio.io/dataplane-mode=ambient

wait_for_sidecar_injector() {
  echo "Waiting for Istio sidecar injector webhook..."
  local elapsed=0
  local timeout=60
  while [ "${elapsed}" -lt "${timeout}" ]; do
    local cfgs
    cfgs=$(${CLIENT_EXE} get mutatingwebhookconfiguration -o jsonpath='{range .items[*]}{.metadata.name}{"\n"}{end}' 2>/dev/null | grep -E 'sidecar-injector|istio-revision' || true)
    if [ -n "${cfgs}" ]; then
      echo "Found sidecar injector webhook: ${cfgs}"
      return 0
    fi
    sleep 2
    elapsed=$((elapsed + 2))
  done
  echo "WARNING: sidecar injector MutatingWebhookConfiguration not found; pods may start without sidecars"
}

# Confirm every running pod in the namespace has an istio-proxy container.
# Pods created before the injector was ready stay Ready without a sidecar, so
# restart deployments once if injection was missed.
ensure_sidecar_injected() {
  local ns="$1"
  local attempt
  for attempt in 1 2; do
    local missing=""
    local pod containers
    while read -r pod containers; do
      [ -z "${pod}" ] && continue
      if [[ " ${containers} " != *" istio-proxy "* ]]; then
        missing="${missing} ${pod}"
      fi
    done < <(${CLIENT_EXE} get pods -n "${ns}" --field-selector=status.phase!=Succeeded -o jsonpath='{range .items[*]}{.metadata.name}{" "}{.spec.containers[*].name}{"\n"}{end}')

    if [ -z "${missing// }" ]; then
      echo "All pods in ${ns} have an istio-proxy sidecar"
      return 0
    fi

    echo "Pods in ${ns} missing istio-proxy:${missing}"
    if [ "${attempt}" = "1" ]; then
      echo "Restarting deployments in ${ns} so the sidecar injector can attach"
      ${CLIENT_EXE} rollout restart deployment -n "${ns}"
      ${CLIENT_EXE} rollout status deployment -n "${ns}" --timeout=180s
    fi
  done

  echo "ERROR: pods in ${ns} still missing istio-proxy after restart"
  ${CLIENT_EXE} get pods -n "${ns}" -o wide
  exit 1
}

wait_for_sidecar_injector

# Determine curl image version based on ARCH
if [ "${ARCH}" == "ppc64le" ] || [ "${ARCH}" == "s390x" ]; then
  CURL_IMAGE="quay.io/curl/curl:8.4.0"
else
  CURL_IMAGE="quay.io/curl/curl:8.16.0"
fi

# Create the echo service
${CLIENT_EXE} apply -f ${HACK_SCRIPT_DIR}/resources/echo-service.yaml -n ${AMBIENT_NS}
${CLIENT_EXE} apply -f ${HACK_SCRIPT_DIR}/resources/echo-service.yaml -n ${SIDECAR_NS}

# Create the curl client deployment for sidecar namespace.
# Timeouts match waypoint-forworkload: hung curls otherwise stall the loop for minutes.
cat <<NAD | ${CLIENT_EXE} -n ${SIDECAR_NS} apply -f -
apiVersion: apps/v1
kind: Deployment
metadata:
  name: curl-client
  labels:
    app: curl-client
spec:
  replicas: 1
  selector:
    matchLabels:
      app: curl-client
  template:
    metadata:
      labels:
        app: curl-client
    spec:
      containers:
      - name: curl-client
        image: ${CURL_IMAGE}
        command: ["/bin/sh", "-c"]
        args:
        - |
          while true; do
            echo "Calling echo-service.test-ambient..."
            if ! curl -sSf --connect-timeout 5 --max-time 15 "http://echo-service.test-ambient/" >/dev/null; then
              echo "[test-sidecar] curl failed for echo-service.test-ambient"
            fi
            sleep 5
          done
NAD

# Create the curl client deployment for ambient namespace
cat <<NAD | ${CLIENT_EXE} -n ${AMBIENT_NS} apply -f -
apiVersion: apps/v1
kind: Deployment
metadata:
  name: curl-client
  labels:
    app: curl-client
spec:
  replicas: 1
  selector:
    matchLabels:
      app: curl-client
  template:
    metadata:
      labels:
        app: curl-client
    spec:
      containers:
      - name: curl-client
        image: ${CURL_IMAGE}
        command: ["/bin/sh", "-c"]
        args:
        - |
          while true; do
            echo "Calling echo-service.test-sidecar..."
            if ! curl -sSf --connect-timeout 5 --max-time 15 "http://echo-service.test-sidecar/" >/dev/null; then
              echo "[test-ambient] curl failed for echo-service.test-sidecar"
            fi
            sleep 5
          done
NAD

for ns in ${SIDECAR_NS} ${AMBIENT_NS}; do
  ${CLIENT_EXE} rollout status deployment/echo-server -n "${ns}" --timeout=180s
  ${CLIENT_EXE} rollout status deployment/curl-client -n "${ns}" --timeout=180s
done
ensure_sidecar_injected "${SIDECAR_NS}"

# Use waypoint?
if [ "${WAYPOINT}" == "true" ]; then
  ensure_gateway_api_crds
  ${CLIENT_EXE} apply -f ${HACK_SCRIPT_DIR}/resources/waypoint.yaml -n ${AMBIENT_NS}
  ${CLIENT_EXE} label ns ${AMBIENT_NS} istio.io/use-waypoint=waypoint
fi

