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
AMBIENT_NS="ambient"
CLIENT_EXE="kubectl"
HACK_SCRIPT_DIR="$(cd $(dirname "${BASH_SOURCE[0]}") && pwd)"
OUTPUT_DIR="${OUTPUT_DIR:-${HACK_SCRIPT_DIR}/../../../_output}"
SIDECAR_NS="sidecar"
WAYPOINT="false"

while [ $# -gt 0 ]; do
  key="$1"
  case $key in
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

ALL_ISTIOS=$(ls -dt1 ${OUTPUT_DIR}/istio-*)
if [ "$?" != "0" ]; then
  ${HACK_SCRIPT_DIR}/../download-istio.sh
  if [ "$?" != "0" ]; then
    echo "ERROR: You do not have Istio installed and it cannot be downloaded"
    exit 1
  fi
fi
# use the Istio release that was last downloaded (that's the -t option to ls)
ISTIO_DIR=$(ls -dt1 ${OUTPUT_DIR}/istio-* | head -n1)

if [ ! -d "${ISTIO_DIR}" ]; then
   echo "ERROR: Istio cannot be found at: ${ISTIO_DIR}"
   exit 1
fi

echo "Istio is found here: ${ISTIO_DIR}"
if [[ -x "${ISTIO_DIR}/bin/istioctl" ]]; then
  echo "istioctl is found here: ${ISTIO_DIR}/bin/istioctl"
  ISTIOCTL="${ISTIO_DIR}/bin/istioctl"
  ${ISTIOCTL} version
else
  echo "ERROR: istioctl is NOT found at ${ISTIO_DIR}/bin/istioctl"
  exit 1
fi

${CLIENT_EXE} create ns ${SIDECAR_NS}
${CLIENT_EXE} create ns ${AMBIENT_NS}

${CLIENT_EXE} label ns ${SIDECAR_NS} istio-injection=enabled
${CLIENT_EXE} label ns ${AMBIENT_NS} istio.io/dataplane-mode=ambient

# Create the echo service
${CLIENT_EXE} apply -f ${HACK_SCRIPT_DIR}/echo-service.yaml -n ${AMBIENT_NS}
${CLIENT_EXE} apply -f ${HACK_SCRIPT_DIR}/echo-service.yaml -n ${SIDECAR_NS}

# Create the echo service
cat <<NAD | ${CLIENT_EXE} -n sidecar apply -f -
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
    - while true; do echo "Calling echo-service..."; curl -s http://echo-service.ambient sleep 5; done;
NAD

cat <<NAD | ${CLIENT_EXE} -n ambient apply -f -
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
    - while true; do echo "Calling echo-service..."; curl -s http://echo-service.sidecar sleep 5; done;
NAD

# Use waypoint?
if [ "${WAYPOINT}" == "true" ]; then
  $CLIENT_EXE get crd gateways.gateway.networking.k8s.io &> /dev/null || \
          { $CLIENT_EXE kustomize "github.com/kubernetes-sigs/gateway-api/config/crd/experimental?ref=v1.2.0" | $CLIENT_EXE apply -f -; }
  ${ISTIOCTL} waypoint apply -n ${AMBIENT_NS} --enroll-namespace
fi

