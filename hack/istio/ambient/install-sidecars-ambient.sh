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
CLIENT_EXE="oc"
HACK_SCRIPT_DIR="$(cd $(dirname "${BASH_SOURCE[0]}") && pwd)"
OUTPUT_DIR="${OUTPUT_DIR:-${HACK_SCRIPT_DIR}/../../../_output}"
SIDECAR_NS="test-sidecar"
WAYPOINT="false"

while [ $# -gt 0 ]; do
  key="$1"
  case $key in
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
  echo "Deleting ambient-sidecar demo namespaces"
  ${CLIENT_EXE} delete namespace ${SIDECAR_NS}
  ${CLIENT_EXE} delete namespace ${AMBIENT_NS}
  exit 0
fi

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
else
  ${CLIENT_EXE} create ns ${SIDECAR_NS}
  ${CLIENT_EXE} create ns ${AMBIENT_NS}
fi

${CLIENT_EXE} label ns ${SIDECAR_NS} istio-injection=enabled
${CLIENT_EXE} label ns ${AMBIENT_NS} istio.io/dataplane-mode=ambient

# Create the echo service
${CLIENT_EXE} apply -f ${HACK_SCRIPT_DIR}/echo-service.yaml -n ${AMBIENT_NS}
${CLIENT_EXE} apply -f ${HACK_SCRIPT_DIR}/echo-service.yaml -n ${SIDECAR_NS}

# Create the echo service
cat <<NAD | ${CLIENT_EXE} -n ${SIDECAR_NS} apply -f -
apiVersion: v1
kind: Pod
metadata:
  name: curl-client
spec:
  containers:
  - name: curl-client
    image: curlimages/curl
    command: ["/bin/sh", "-c"]
    args:
    - while true; do echo "Calling echo-service..."; curl -s http://echo-service.test-ambient sleep 5; done;
NAD

cat <<NAD | ${CLIENT_EXE} -n ${AMBIENT_NS} apply -f -
apiVersion: v1
kind: Pod
metadata:
  name: curl-client
spec:
  containers:
  - name: curl-client
    image: curlimages/curl
    command: ["/bin/sh", "-c"]
    args:
    - while true; do echo "Calling echo-service..."; curl -s http://echo-service.test-sidecar sleep 5; done;
NAD

# Use waypoint?
if [ "${WAYPOINT}" == "true" ]; then
  echo "Verifying that Gateway API is installed; if it is not then it will be installed now."
  $CLIENT_EXE get crd gateways.gateway.networking.k8s.io &> /dev/null || \
    { $CLIENT_EXE kustomize "github.com/kubernetes-sigs/gateway-api/config/crd?ref=v1.3.0" | $CLIENT_EXE apply -f -; }
  ${CLIENT_EXE} apply -f ${HACK_SCRIPT_DIR}/resources/waypoint.yaml -n ${AMBIENT_NS}
  ${CLIENT_EXE} label ns ${AMBIENT_NS} istio.io/use-waypoint=waypoint
fi

