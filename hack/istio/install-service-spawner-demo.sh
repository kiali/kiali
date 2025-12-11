#!/bin/bash

##############################################################################
# install-service-spawner-demo.sh
#
# Installs the kiali service spawner demo application
# https://github.com/kiali/demos/tree/master/service-spawner
# Works on both openshift and non-openshift environments.
##############################################################################

: ${AUTO_INJECTION:=true}
: ${AUTO_INJECTION_LABEL:="istio-injection=enabled"}
: ${CLIENT_EXE:=oc}
: ${DELETE_DEMOS:=false}
: ${NAMESPACE:=}
: ${SSPAWNER:=service-spawner}
: ${BASE_URL:=https://raw.githubusercontent.com/kiali/demos/master}
: ${NUM_SPAWNS:=10}
: ${MODE:=sidecar}

# Find istioctl (needed for ambient mode waypoint)
find_istioctl() {
  if [ -z "${ISTIOCTL:-}" ]; then
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
    ISTIO_DIR=$(ls -dt1 ${SCRIPT_DIR}/../../_output/istio-* 2>/dev/null | head -n1)
    if [ -n "${ISTIO_DIR}" ] && [ -x "${ISTIO_DIR}/bin/istioctl" ]; then
      ISTIOCTL="${ISTIO_DIR}/bin/istioctl"
    elif command -v istioctl &> /dev/null; then
      ISTIOCTL="istioctl"
    else
      ISTIOCTL=""
    fi
  fi
}

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

install_service_spawner_demo() {

  if [ "${IS_OPENSHIFT}" == "true" ]; then
    ${CLIENT_EXE} new-project ${NAMESPACE}
    apply_network_attachment ${NAMESPACE}
    $CLIENT_EXE adm policy add-scc-to-user anyuid -z default -n ${NAMESPACE}
  else
    ${CLIENT_EXE} create ns ${NAMESPACE}
  fi

  # Label namespace based on mode
  if [ "${MODE}" == "ambient" ]; then
    echo "Configuring namespace for Istio Ambient mode..."
    ${CLIENT_EXE} label namespace ${NAMESPACE} istio.io/dataplane-mode=ambient --overwrite=true
  elif [ "${AUTO_INJECTION}" == "true" ]; then
    echo "Configuring namespace for Istio Sidecar mode with auto-injection..."
    ${CLIENT_EXE} label namespace ${NAMESPACE} ${AUTO_INJECTION_LABEL} --overwrite=true
  fi

  for (( c=0; c<$NUM_SPAWNS; c++ ))
  do
    next=$(($c+1))
    if [[ $next -eq NUM_SPAWNS ]]; then
      next=0
    fi
    curl -L ${BASE_URL}/service-spawner/deployment-tpl.yaml -o deployment-tpl.yaml
    cat deployment-tpl.yaml \
          | sed -e "s:this-service:service-$c:g" \
          | sed -e "s:target-service:http\://service-$next:g" \
          | sed -e "s:this-namespace:${NAMESPACE}:g" \
          | sed -e "s:quay.io/jotak/nginx-hello:nginxdemos/nginx-hello:g" \
          > tmp-$c.yaml
    ${CLIENT_EXE} apply -f tmp-${c}.yaml -n ${NAMESPACE}
  done
  rm deployment-tpl.yaml
  for (( c=0; c<$NUM_SPAWNS; c++ ))
  do
      rm tmp-${c}.yaml
  done

  # Create waypoint for ambient mode
  if [ "${MODE}" == "ambient" ]; then
    echo "Creating waypoint proxy for ambient mode..."
    find_istioctl
    if [ -n "${ISTIOCTL}" ]; then
      echo "Using istioctl: ${ISTIOCTL}"
      if ${ISTIOCTL} waypoint apply -n ${NAMESPACE} --enroll-namespace; then
        echo "Waypoint proxy created successfully"
        echo "Waiting for waypoint to be ready..."
        sleep 5
        for i in {1..30}; do
          WAYPOINT_POD=$(${CLIENT_EXE} get pods -n ${NAMESPACE} -l gateway.istio.io/managed=istio.io-waypoint -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")
          if [ -n "${WAYPOINT_POD}" ]; then
            echo "Waypoint pod found: ${WAYPOINT_POD}"
            ${CLIENT_EXE} wait --for=condition=Ready pod/${WAYPOINT_POD} -n ${NAMESPACE} --timeout=60s && break || true
          fi
          sleep 2
        done
      else
        echo "WARNING: Failed to create waypoint proxy. Traffic will still flow but without L7 processing."
      fi
    else
      echo "WARNING: istioctl not found. Cannot create waypoint proxy for ambient mode."
      echo "Please install istioctl or set ISTIOCTL environment variable."
    fi
  fi
}

while [ $# -gt 0 ]; do
  key="$1"
  case $key in
    -ai|--auto-injection)
      AUTO_INJECTION="$2"
      shift;shift
      ;;
    -ail|--auto-injection-label)
      AUTO_INJECTION_LABEL="$2"
      shift;shift
      ;;
    -c|--client)
      CLIENT_EXE="$2"
      shift;shift
      ;;
    -m|--mode)
      MODE="$2"
      if [ "${MODE}" != "sidecar" -a "${MODE}" != "ambient" ]; then
        echo "ERROR: --mode must be either 'sidecar' or 'ambient'"
        exit 1
      fi
      shift;shift
      ;;
    -ns|--namespace)
      NAMESPACE="$2"
      shift;shift
      ;;
    -n|-spawns)
      NUM_SPAWNS="$2"
      shift;shift
      ;;
    -d|-delete)
      DELETE_DEMOS="$2"
      shift;shift
      ;;
    -h|--help)
      cat <<HELPMSG
Valid command line arguments:
  -ai|--auto-injection <true|false>: If you want sidecars to be auto-injected (default: true). Only applies to sidecar mode.
  -ail|--auto-injection-label <name=value>: If auto-injection is enabled, this is the label added to the namespace. For revision-based installs, you can use something like "istio.io/rev=default-v1-23-0". default: istio-injection=enabled). Only applies to sidecar mode.
  -c|--client: either 'oc' or 'kubectl'
  -m|--mode <sidecar|ambient>: Istio dataplane mode (default: sidecar)
    - sidecar: Uses traditional sidecar injection with istio-injection label
    - ambient: Uses Istio Ambient mode with istio.io/dataplane-mode=ambient label and waypoint proxy
  -ns|--namespace <name>: Namespace to use (default: service-spawner)
  -n|--spawns: Number of spawns. Default: 10
  -d|--delete: if 'true' demos will be deleted; otherwise, they will be installed
  -h|--help: this text

Examples:
  # Install with sidecar mode (default)
  ./install-service-spawner-demo.sh -n 10 -c kubectl

  # Install with ambient mode in custom namespace
  ./install-service-spawner-demo.sh -n 10 -c kubectl --mode ambient --namespace my-ambient-test

  # Compare sidecar vs ambient side-by-side
  ./install-service-spawner-demo.sh -n 5 -c kubectl --mode sidecar --namespace spawner-sidecar
  ./install-service-spawner-demo.sh -n 5 -c kubectl --mode ambient --namespace spawner-ambient

  # Delete
  ./install-service-spawner-demo.sh -d true -c kubectl --namespace my-ambient-test
HELPMSG
      exit 1
      ;;
    *)
      echo "Unknown argument [$key]. Aborting."
      exit 1
      ;;
  esac
done

# Use default namespace if not specified
if [ -z "${NAMESPACE}" ]; then
  NAMESPACE="${SSPAWNER}"
fi

IS_OPENSHIFT="false"
if [[ "${CLIENT_EXE}" = *"oc" ]]; then
  IS_OPENSHIFT="true"
fi

echo "=== SETTINGS ==="
echo "CLIENT_EXE=${CLIENT_EXE}"
echo "IS_OPENSHIFT=${IS_OPENSHIFT}"
echo "NAMESPACE=${NAMESPACE}"
echo "MODE=${MODE}"
echo "NUM_SPAWNS=${NUM_SPAWNS}"
if [ "${MODE}" == "sidecar" ]; then
  echo "AUTO_INJECTION=${AUTO_INJECTION}"
  if [ "${AUTO_INJECTION}" == "true" ]; then
    echo "AUTO_INJECTION_LABEL=${AUTO_INJECTION_LABEL}"
  fi
fi
echo "================"

if [ "${DELETE_DEMOS}" != "true" ]; then
  echo "Installing service-spawner app in the '${NAMESPACE}' namespace..."
  install_service_spawner_demo
else
  echo "Deleting service-spawner app in the '${NAMESPACE}' namespace..."

  ${CLIENT_EXE} delete all -l project=service-spawner -n ${NAMESPACE}

  if [ "${IS_OPENSHIFT}" == "true" ]; then
    $CLIENT_EXE delete network-attachment-definition istio-cni -n ${NAMESPACE}
    $CLIENT_EXE delete scc ${NAMESPACE}-scc

    ${CLIENT_EXE} delete project ${NAMESPACE}
  else
    ${CLIENT_EXE} delete ns ${NAMESPACE} --ignore-not-found=true
  fi
fi
