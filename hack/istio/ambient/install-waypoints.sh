#!/bin/bash
##############################################################################
# install-waypoints.sh
#
# Installs 6 different namespaces with a pod calling a service and a waypoint proxy
# with different tags in each one to validate different waypoint implementations
#
##############################################################################

CLIENT_EXE="oc"

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
    -h|--help)
      cat <<HELPMSG
Valid command line arguments:
  -c|--client: either 'oc' or 'kubectl'
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

# Go to the main output directory and try to find an Istio there.
HACK_SCRIPT_DIR="$(cd $(dirname "${BASH_SOURCE[0]}") && pwd)"
OUTPUT_DIR="${OUTPUT_DIR:-${HACK_SCRIPT_DIR}/../../../_output}"

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

# Define waypoint namespaces
declare -a waypoint_namespaces=("waypoint-forservice" "waypoint-forworkload" "waypoint-forall" "waypoint-fornone" "waypoint-differentns" "waypoint-common-infrastructure" "waypoint-override")

# If we are to delete, remove everything and exit immediately after
if [ "${DELETE}" == "true" ]; then

  if [ "${IS_OPENSHIFT}" == "true" ]; then
    $CLIENT_EXE delete network-attachment-definition istio-cni -n waypoint-forservice
    $CLIENT_EXE delete scc waypoint-forservice-scc
    
    for namespace in "${waypoint_namespaces[@]}"; do
      ${CLIENT_EXE} delete project ${namespace}
    done
    exit 0
  else
    echo "Deleting Waypoint demos namespaces"
    
    for namespace in "${waypoint_namespaces[@]}"; do
      ${CLIENT_EXE} delete namespace ${namespace}
    done
    exit 0
  fi
fi

# Verify Gateway API
echo "Verifying that Gateway API is installed; if it is not then it will be installed now."
$CLIENT_EXE get crd gateways.gateway.networking.k8s.io &> /dev/null || \
  { $CLIENT_EXE kustomize "github.com/kubernetes-sigs/gateway-api/config/crd?ref=v1.3.0" | $CLIENT_EXE apply -f -; }

if [ "${IS_OPENSHIFT}" == "true" ]; then
  for namespace in "${waypoint_namespaces[@]}"; do
    $CLIENT_EXE new-project ${namespace}
  done
else
  for namespace in "${waypoint_namespaces[@]}"; do
    ${CLIENT_EXE} create ns ${namespace}
  done
fi


for namespace in "${waypoint_namespaces[@]}"; do
  ${CLIENT_EXE} label ns ${namespace} istio.io/dataplane-mode=ambient
done

# Create a waypoint for service
if [ "${IS_OPENSHIFT}" == "true" ]; then
  for namespace in "${waypoint_namespaces[@]}"; do
    apply_network_attachment ${namespace}
    $CLIENT_EXE adm policy add-scc-to-user anyuid -z default -n ${namespace}
  done

fi

${CLIENT_EXE} apply -f ${HACK_SCRIPT_DIR}/resources/echo-service.yaml -n waypoint-forservice
${CLIENT_EXE} apply -f ${HACK_SCRIPT_DIR}/resources/curl-pod.yaml -n waypoint-forservice
${CLIENT_EXE} apply -f ${HACK_SCRIPT_DIR}/resources/waypoint.yaml -n waypoint-forservice
${CLIENT_EXE} label ns waypoint-forservice istio.io/use-waypoint=waypoint

# Create a waypoint for workload and send requests to pod b
${CLIENT_EXE} apply -f ${HACK_SCRIPT_DIR}/resources/echo-service.yaml -n waypoint-forworkload
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
${CLIENT_EXE} apply -f ${HACK_SCRIPT_DIR}/resources/waypoint-for-workload.yaml -n waypoint-forworkload
${CLIENT_EXE} label pod -l app=echo-server istio.io/use-waypoint=bwaypoint -n waypoint-forworkload

# Create a waypoint for all
${CLIENT_EXE} apply -f ${HACK_SCRIPT_DIR}/resources/echo-service.yaml -n waypoint-forall
${CLIENT_EXE} apply -f ${HACK_SCRIPT_DIR}/resources/curl-pod.yaml -n waypoint-forall
${CLIENT_EXE} apply -f ${HACK_SCRIPT_DIR}/resources/waypoint-forall.yaml -n waypoint-forall
${CLIENT_EXE} label namespace waypoint-forall istio.io/use-waypoint=cgw

# Create a waypoint for none (No L7 traffic should be seen)
${CLIENT_EXE} apply -f ${HACK_SCRIPT_DIR}/resources/echo-service.yaml -n waypoint-fornone
${CLIENT_EXE} apply -f ${HACK_SCRIPT_DIR}/resources/curl-pod.yaml -n waypoint-fornone
${CLIENT_EXE} apply -f ${HACK_SCRIPT_DIR}/resources/waypoint-fornone.yaml -n waypoint-fornone
${CLIENT_EXE} label namespace waypoint-fornone istio.io/use-waypoint=waypoint

# Use a waypoint from another ns
${CLIENT_EXE} apply -f ${HACK_SCRIPT_DIR}/resources/echo-service.yaml -n waypoint-differentns
${CLIENT_EXE} apply -f ${HACK_SCRIPT_DIR}/resources/curl-pod.yaml -n waypoint-differentns
${CLIENT_EXE} apply -f ${HACK_SCRIPT_DIR}/resources/egress-gateway.yaml -n waypoint-common-infrastructure
${CLIENT_EXE} label namespace waypoint-differentns istio.io/use-waypoint=egress-gateway
${CLIENT_EXE} label namespace waypoint-differentns istio.io/use-waypoint-namespace=waypoint-common-infrastructure

# Override ns waypoint labeling a service
${CLIENT_EXE} apply -f ${HACK_SCRIPT_DIR}/resources/echo-service.yaml -n waypoint-override
${CLIENT_EXE} apply -f ${HACK_SCRIPT_DIR}/resources/curl-pod.yaml -n waypoint-override
${CLIENT_EXE} apply -f ${HACK_SCRIPT_DIR}/resources/waypoint.yaml -n waypoint-override
${CLIENT_EXE} label namespace waypoint-override istio.io/use-waypoint=waypoint
${CLIENT_EXE} apply -f ${HACK_SCRIPT_DIR}/resources/waypoint-override.yaml -n waypoint-override
${CLIENT_EXE} label svc echo-service -n waypoint-override istio.io/use-waypoint=use-this