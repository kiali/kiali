#!/bin/bash
##############################################################################
# install-waypoints.sh
#
# Installs 6 different namespaces with a pod calling a service and a waypoint proxy
# with different tags in each one to validate different waypoint implementations
#
##############################################################################

HACK_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source ${HACK_SCRIPT_DIR}/../functions.sh

CLIENT_EXE="oc"
: ${ARCH:=amd64}

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
    -h|--help)
      cat <<HELPMSG
Valid command line arguments:
  -a|--arch <amd64|ppc64le|s390x>: Images for given arch will be used (default: amd64).
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
HACK_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
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

ensure_gateway_api_crds

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

# Determine curl image version based on ARCH
if [ "${ARCH}" == "ppc64le" ] || [ "${ARCH}" == "s390x" ]; then
  CURL_IMAGE="quay.io/curl/curl:8.4.0"
else
  CURL_IMAGE="quay.io/curl/curl:8.16.0"
fi

# Create a waypoint for service
if [ "${IS_OPENSHIFT}" == "true" ]; then
  for namespace in "${waypoint_namespaces[@]}"; do
    apply_network_attachment ${namespace}
    $CLIENT_EXE adm policy add-scc-to-user anyuid -z default -n ${namespace}
  done

fi

${CLIENT_EXE} apply -f ${HACK_SCRIPT_DIR}/resources/echo-service.yaml -n waypoint-forservice
sed "s|\${CURL_IMAGE}|${CURL_IMAGE}|g" ${HACK_SCRIPT_DIR}/resources/curl-pod.yaml | ${CLIENT_EXE} apply -f - -n waypoint-forservice
${CLIENT_EXE} apply -f ${HACK_SCRIPT_DIR}/resources/waypoint.yaml -n waypoint-forservice
${CLIENT_EXE} label ns waypoint-forservice istio.io/use-waypoint=waypoint

# Waypoint-for-workload (istio.io/waypoint-for: workload): Istio only redirects traffic originally
# addressed to pod (or VM) IPs—not to a Kubernetes Service—even if the workload uses a waypoint
# (see https://istio.io/latest/docs/ambient/usage/waypoint/ ). So curl must target the echo pod IP.
# Gateway first, then echo with istio.io/use-waypoint on the pod template (survives pod restarts),
# then curl with that IP baked in. If echo restarts and gets a new IP, rollout-restart curl-client.
${CLIENT_EXE} apply -f ${HACK_SCRIPT_DIR}/resources/waypoint-for-workload.yaml -n waypoint-forworkload
${CLIENT_EXE} wait --for=condition=Ready pod -l gateway.networking.k8s.io/gateway-name=bwaypoint -n waypoint-forworkload --timeout=120s
${CLIENT_EXE} apply -f ${HACK_SCRIPT_DIR}/resources/echo-server-waypoint-forworkload.yaml -n waypoint-forworkload
${CLIENT_EXE} rollout status deployment/echo-server -n waypoint-forworkload --timeout=120s
POD_IP=$($CLIENT_EXE get pod -l app=echo-server -n waypoint-forworkload -o jsonpath="{.items[0].status.podIP}")
echo "Creating client in ns waypoint-forworkload with echo pod IP ${POD_IP}"
cat <<NAD | $CLIENT_EXE -n waypoint-forworkload apply -f -
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
                echo "Calling echo pod at ${POD_IP}..."
                if ! curl -sSf --connect-timeout 5 --max-time 15 "http://${POD_IP}/" >/dev/null; then
                  echo "[waypoint-forworkload] curl failed for baked-in echo pod IP ${POD_IP}. If echo-server was recreated, this IP is stale (curl Deployment args are fixed at apply time). Re-run this install script for waypoint-forworkload or patch/reapply curl-client with the current pod IP."
                fi
                sleep 5
              done
NAD
${CLIENT_EXE} rollout status deployment/curl-client -n waypoint-forworkload --timeout=120s

# Create a waypoint for all
${CLIENT_EXE} apply -f ${HACK_SCRIPT_DIR}/resources/echo-service.yaml -n waypoint-forall
sed "s|\${CURL_IMAGE}|${CURL_IMAGE}|g" ${HACK_SCRIPT_DIR}/resources/curl-pod.yaml | ${CLIENT_EXE} apply -f - -n waypoint-forall
${CLIENT_EXE} apply -f ${HACK_SCRIPT_DIR}/resources/waypoint-forall.yaml -n waypoint-forall
${CLIENT_EXE} label namespace waypoint-forall istio.io/use-waypoint=cgw

# Create a waypoint for none (No L7 traffic should be seen)
${CLIENT_EXE} apply -f ${HACK_SCRIPT_DIR}/resources/echo-service.yaml -n waypoint-fornone
sed "s|\${CURL_IMAGE}|${CURL_IMAGE}|g" ${HACK_SCRIPT_DIR}/resources/curl-pod.yaml | ${CLIENT_EXE} apply -f - -n waypoint-fornone
${CLIENT_EXE} apply -f ${HACK_SCRIPT_DIR}/resources/waypoint-fornone.yaml -n waypoint-fornone
${CLIENT_EXE} label namespace waypoint-fornone istio.io/use-waypoint=waypoint

# Use a waypoint from another ns
${CLIENT_EXE} apply -f ${HACK_SCRIPT_DIR}/resources/echo-service.yaml -n waypoint-differentns
sed "s|\${CURL_IMAGE}|${CURL_IMAGE}|g" ${HACK_SCRIPT_DIR}/resources/curl-pod.yaml | ${CLIENT_EXE} apply -f - -n waypoint-differentns
${CLIENT_EXE} apply -f ${HACK_SCRIPT_DIR}/resources/egress-gateway.yaml -n waypoint-common-infrastructure
${CLIENT_EXE} label namespace waypoint-differentns istio.io/use-waypoint=egress-gateway
${CLIENT_EXE} label namespace waypoint-differentns istio.io/use-waypoint-namespace=waypoint-common-infrastructure

# Override ns waypoint labeling a service
${CLIENT_EXE} apply -f ${HACK_SCRIPT_DIR}/resources/echo-service.yaml -n waypoint-override
sed "s|\${CURL_IMAGE}|${CURL_IMAGE}|g" ${HACK_SCRIPT_DIR}/resources/curl-pod.yaml | ${CLIENT_EXE} apply -f - -n waypoint-override
${CLIENT_EXE} apply -f ${HACK_SCRIPT_DIR}/resources/waypoint.yaml -n waypoint-override
${CLIENT_EXE} label namespace waypoint-override istio.io/use-waypoint=waypoint
${CLIENT_EXE} apply -f ${HACK_SCRIPT_DIR}/resources/waypoint-override.yaml -n waypoint-override
${CLIENT_EXE} label svc echo-service -n waypoint-override istio.io/use-waypoint=use-this