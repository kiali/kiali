#!/bin/bash
##############################################################################
# install-waypoints.sh
#
# Installs 6 different namespaces with a pod calling a service and a waypoint proxy
# with different tags in each one to validate different waypoint implementations
#
##############################################################################

while [ $# -gt 0 ]; do
  key="$1"
  case $key in
    -d|--delete)
      DELETE="$2"
      shift;shift
      ;;
    -h|--help)
      cat <<HELPMSG
Valid command line arguments:
  -d|--delete: either 'true' or 'false'. If 'true' the waypoint namespaces demo will be deleted, not installed.
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

# Go to the main output directory and try to find an Istio there.
HACK_SCRIPT_DIR="$(cd $(dirname "${BASH_SOURCE[0]}") && pwd)"
CLIENT_EXE="kubectl"
OUTPUT_DIR="${OUTPUT_DIR:-${HACK_SCRIPT_DIR}/../../../_output}"

# If we are to delete, remove everything and exit immediately after
if [ "${DELETE}" == "true" ]; then
  echo "Deleting Waypoint demos namespaces"
  ${CLIENT_EXE} delete namespace waypoint-forservice
  ${CLIENT_EXE} delete namespace waypoint-forworkload
  ${CLIENT_EXE} delete namespace waypoint-forall
  ${CLIENT_EXE} delete namespace waypoint-fornone
  ${CLIENT_EXE} delete namespace waypoint-differentns
  ${CLIENT_EXE} delete namespace waypoint-override
  ${CLIENT_EXE} delete namespace waypoint-common-infrastructure
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

# Verify Gateway API
echo "Verifying that Gateway API is installed; if it is not then it will be installed now."
$CLIENT_EXE get crd gateways.gateway.networking.k8s.io &> /dev/null || \
  { $CLIENT_EXE kustomize "github.com/kubernetes-sigs/gateway-api/config/crd?ref=v1.3.0" | $CLIENT_EXE apply -f -; }

${CLIENT_EXE} create ns waypoint-forservice
${CLIENT_EXE} create ns waypoint-forworkload
${CLIENT_EXE} create ns waypoint-forall
${CLIENT_EXE} create ns waypoint-fornone
${CLIENT_EXE} create ns waypoint-differentns
${CLIENT_EXE} create ns waypoint-common-infrastructure
${CLIENT_EXE} create ns waypoint-override

${CLIENT_EXE} label ns waypoint-forservice istio.io/dataplane-mode=ambient
${CLIENT_EXE} label ns waypoint-forworkload istio.io/dataplane-mode=ambient
${CLIENT_EXE} label ns waypoint-forall istio.io/dataplane-mode=ambient
${CLIENT_EXE} label ns waypoint-fornone istio.io/dataplane-mode=ambient
${CLIENT_EXE} label ns waypoint-differentns istio.io/dataplane-mode=ambient
${CLIENT_EXE} label ns waypoint-override istio.io/dataplane-mode=ambient

# Create a waypoint for service
${CLIENT_EXE} apply -f ${HACK_SCRIPT_DIR}/echo-service.yaml -n waypoint-forservice
${CLIENT_EXE} apply -f ${HACK_SCRIPT_DIR}/curl-pod.yaml -n waypoint-forservice
${ISTIOCTL} waypoint apply -n waypoint-forservice --enroll-namespace

# Create a waypoint for workload and send requests to pod b
${CLIENT_EXE} apply -f ${HACK_SCRIPT_DIR}/echo-service.yaml -n waypoint-forworkload
${CLIENT_EXE} wait --for=condition=Ready pod/echo-server -n waypoint-forworkload --timeout=60s

sleep 15
# Update with echo-server IP
POD_IP=$($CLIENT_EXE get pod echo-server -n waypoint-forworkload -o jsonpath="{.status.podIP}")
echo "Creating client in ns waypoint-forworkload with podIP $POD_IP"
cat <<NAD | $CLIENT_EXE -n waypoint-forworkload apply -f -
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
        - while true; do
          echo "Calling echo-service...";
          curl -s http://$POD_IP
          sleep 5;
          done;
NAD
${ISTIOCTL} waypoint apply -n waypoint-forworkload --name bwaypoint --for workload
${CLIENT_EXE} label pod -l app=echo-server istio.io/use-waypoint=bwaypoint -n waypoint-forworkload

# Create a waypoint for all
${CLIENT_EXE} apply -f ${HACK_SCRIPT_DIR}/echo-service.yaml -n waypoint-forall
${CLIENT_EXE} apply -f ${HACK_SCRIPT_DIR}/curl-pod.yaml -n waypoint-forall
${ISTIOCTL} waypoint apply -n waypoint-forall --name cgw --for all
${CLIENT_EXE} label namespace waypoint-forall istio.io/use-waypoint=cgw

# Create a waypoint for none (No L7 traffic should be seen)
${CLIENT_EXE} apply -f ${HACK_SCRIPT_DIR}/echo-service.yaml -n waypoint-fornone
${CLIENT_EXE} apply -f ${HACK_SCRIPT_DIR}/curl-pod.yaml -n waypoint-fornone
${ISTIOCTL} waypoint apply -n waypoint-fornone --name waypoint --for none
${CLIENT_EXE} label namespace waypoint-fornone istio.io/use-waypoint=waypoint

# Use a waypoint from another ns
${CLIENT_EXE} apply -f ${HACK_SCRIPT_DIR}/echo-service.yaml -n waypoint-differentns
${CLIENT_EXE} apply -f ${HACK_SCRIPT_DIR}/curl-pod.yaml -n waypoint-differentns
${CLIENT_EXE} apply -f ${HACK_SCRIPT_DIR}/egress-gateway.yaml -n waypoint-common-infrastructure
${CLIENT_EXE} label namespace waypoint-differentns istio.io/use-waypoint=egress-gateway
${CLIENT_EXE} label namespace waypoint-differentns istio.io/use-waypoint-namespace=waypoint-common-infrastructure

# Override ns waypoint labeling a service
${CLIENT_EXE} apply -f ${HACK_SCRIPT_DIR}/echo-service.yaml -n waypoint-override
${CLIENT_EXE} apply -f ${HACK_SCRIPT_DIR}/curl-pod.yaml -n waypoint-override
${ISTIOCTL} waypoint apply -n waypoint-override --enroll-namespace
${ISTIOCTL} waypoint apply -n waypoint-override --name use-this
${CLIENT_EXE} label svc echo-service -n waypoint-override istio.io/use-waypoint=use-this