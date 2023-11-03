#/bin/bash

# This deploys the travel agency demo

HACK_SCRIPT_DIR="$(cd $(dirname "${BASH_SOURCE[0]}") && pwd)"
source ${HACK_SCRIPT_DIR}/functions.sh

: ${CLIENT_EXE:=oc}
: ${DELETE_DEMO:=false}
: ${ENABLE_INJECTION:=true}
: ${ENABLE_OPERATION_METRICS:=false}
: ${ISTIO_NAMESPACE:=istio-system}
: ${NAMESPACE_AGENCY:=travel-agency}
: ${NAMESPACE_CONTROL:=travel-control}
: ${NAMESPACE_PORTAL:=travel-portal}
: ${SHOW_GUI:=false}
: ${SOURCE:="https://raw.githubusercontent.com/kiali/demos/master"}

while [ $# -gt 0 ]; do
  key="$1"
  case $key in
    -c|--client)
      CLIENT_EXE="$2"
      shift;shift
      ;;
    -d|--delete)
      DELETE_DEMO="$2"
      shift;shift
      ;;
    -ei|--enable-injection)
      ENABLE_INJECTION="$2"
      shift;shift
      ;;
    -eo|--enable-operation-metrics)
      ENABLE_OPERATION_METRICS="$2"
      shift;shift
      ;;
    -in|--istio-namespace)
￼￼    ISTIO_NAMESPACE="$2"
￼￼    shift;shift
￼￼    ;;
    -s|--source)
      SOURCE="$2"
      shift;shift
      ;;
    -sg|--show-gui)
      SHOW_GUI="$2"
      shift;shift
      ;;
    -h|--help)
      cat <<HELPMSG
Valid command line arguments:
  -c|--client: either 'oc' or 'kubectl'
  -d|--delete: either 'true' or 'false'. If 'true' the travel agency demo will be deleted, not installed.
  -ei|--enable-injection: either 'true' or 'false' (default is true). If 'true' auto-inject proxies for the workloads.
  -eo|--enable-operation-metrics: either 'true' or 'false' (default is false).
  -in|--istio-namespace <name>: Where the Istio control plane is installed (default: istio-system).
  -s|--source: demo file source. For example: file:///home/me/demos Default: https://raw.githubusercontent.com/kiali/demos/master
  -sg|--show-gui: do not install anything, but bring up the travel agency GUI in a browser window
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

if [ "${SHOW_GUI}" == "true" ]; then
  echo "Will not install anything. Creating port-forward now. (control-c to exit)"
  echo "Point your browser to here: "
  echo "  http://localhost:8080"
  ${CLIENT_EXE} port-forward svc/control 8080:8080 -n travel-control
  exit 0
fi

echo Will deploy Travel Agency using these settings:
echo CLIENT_EXE=${CLIENT_EXE}
echo DELETE_DEMO=${DELETE_DEMO}
echo ENABLE_INJECTION=${ENABLE_INJECTION}
echo ENABLE_OPERATION_METRICS=${ENABLE_OPERATION_METRICS}
echo ISTIO_NAMESPACE=${ISTIO_NAMESPACE}
echo NAMESPACE_AGENCY=${NAMESPACE_AGENCY}
echo NAMESPACE_CONTROL=${NAMESPACE_CONTROL}
echo NAMESPACE_PORTAL=${NAMESPACE_PORTAL}
echo SOURCE=${SOURCE}

IS_OPENSHIFT="false"
if [[ "${CLIENT_EXE}" = *"oc" ]]; then
  IS_OPENSHIFT="true"
fi

echo "IS_OPENSHIFT=${IS_OPENSHIFT}"


# If we are to delete, remove everything and exit immediately after
if [ "${DELETE_DEMO}" == "true" ]; then
  echo "Deleting Travel Agency Demo (the envoy filters, if previously created, will remain)"
  if [ "${IS_OPENSHIFT}" == "true" ]; then
    ${CLIENT_EXE} delete network-attachment-definition istio-cni -n ${NAMESPACE_AGENCY}
    ${CLIENT_EXE} delete network-attachment-definition istio-cni -n ${NAMESPACE_PORTAL}
    ${CLIENT_EXE} delete network-attachment-definition istio-cni -n ${NAMESPACE_CONTROL}
    $CLIENT_EXE delete scc travel-scc
  fi
  ${CLIENT_EXE} delete namespace ${NAMESPACE_AGENCY}
  ${CLIENT_EXE} delete namespace ${NAMESPACE_PORTAL}
  ${CLIENT_EXE} delete namespace ${NAMESPACE_CONTROL}
  exit 0
fi

# Create and prepare the demo namespaces

if ! ${CLIENT_EXE} get namespace ${NAMESPACE_AGENCY} 2>/dev/null; then
  ${CLIENT_EXE} create namespace ${NAMESPACE_AGENCY}
  if [ "${ENABLE_INJECTION}" == "true" ]; then
    ${CLIENT_EXE} label namespace ${NAMESPACE_AGENCY} istio-injection=enabled
  fi
  if [ "${IS_OPENSHIFT}" == "true" ]; then
    cat <<NAD | $CLIENT_EXE -n ${NAMESPACE_AGENCY} create -f -
apiVersion: "k8s.cni.cncf.io/v1"
kind: NetworkAttachmentDefinition
metadata:
  name: istio-cni
NAD
  fi
fi

if ! ${CLIENT_EXE} get namespace ${NAMESPACE_PORTAL} 2>/dev/null; then
  ${CLIENT_EXE} create namespace ${NAMESPACE_PORTAL}
  if [ "${ENABLE_INJECTION}" == "true" ]; then
    ${CLIENT_EXE} label namespace ${NAMESPACE_PORTAL} istio-injection=enabled
  fi
  if [ "${IS_OPENSHIFT}" == "true" ]; then
    cat <<NAD | $CLIENT_EXE -n ${NAMESPACE_PORTAL} create -f -
apiVersion: "k8s.cni.cncf.io/v1"
kind: NetworkAttachmentDefinition
metadata:
  name: istio-cni
NAD
  fi
fi

if ! ${CLIENT_EXE} get namespace ${NAMESPACE_CONTROL} 2>/dev/null; then
  ${CLIENT_EXE} create namespace ${NAMESPACE_CONTROL}
  if [ "${ENABLE_INJECTION}" == "true" ]; then
    ${CLIENT_EXE} label namespace ${NAMESPACE_CONTROL} istio-injection=enabled
  fi
  if [ "${IS_OPENSHIFT}" == "true" ]; then
    cat <<NAD | $CLIENT_EXE -n ${NAMESPACE_CONTROL} create -f -
apiVersion: "k8s.cni.cncf.io/v1"
kind: NetworkAttachmentDefinition
metadata:
  name: istio-cni
NAD
  fi
fi

# Add SCC for OpenShift
if [ "${IS_OPENSHIFT}" == "true" ]; then
  ${CLIENT_EXE} adm policy add-scc-to-user anyuid -z default -n ${NAMESPACE_AGENCY}
  ${CLIENT_EXE} adm policy add-scc-to-user anyuid -z default -n ${NAMESPACE_PORTAL}
  ${CLIENT_EXE} adm policy add-scc-to-user anyuid -z default -n ${NAMESPACE_CONTROL}

  cat <<SCC | $CLIENT_EXE apply -f -
apiVersion: security.openshift.io/v1
kind: SecurityContextConstraints
metadata:
  name: travel-scc
runAsUser:
  type: RunAsAny
seLinuxContext:
  type: RunAsAny
supplementalGroups:
  type: RunAsAny
priority: 9
users:
- "system:serviceaccount:${NAMESPACE_AGENCY}:default"
- "system:serviceaccount:${NAMESPACE_PORTAL}:default"
- "system:serviceaccount:${NAMESPACE_CONTROL}:default"
SCC
fi

# Deploy the demo

${CLIENT_EXE} apply -f <(curl -L "${SOURCE}/travels/travel_agency.yaml") -n ${NAMESPACE_AGENCY}
${CLIENT_EXE} apply -f <(curl -L "${SOURCE}/travels/travel_portal.yaml") -n ${NAMESPACE_PORTAL}
${CLIENT_EXE} apply -f <(curl -L "${SOURCE}/travels/travel_control.yaml") -n ${NAMESPACE_CONTROL}

# Set up metric classification

if [ "${ENABLE_OPERATION_METRICS}" != "true" ]; then
  # No need to keep going - we are done and the user doesn't want to do anything else.
  exit 0
fi

cat <<OPMET | ${CLIENT_EXE} -n ${ISTIO_NAMESPACE} apply -f -
apiVersion: extensions.istio.io/v1alpha1
kind: WasmPlugin
metadata:
  name: attribgen-travelagency-travels
spec:
  selector:
    matchLabels:
      app: travels
  url: https://storage.googleapis.com/istio-build/proxy/attributegen-359dcd3a19f109c50e97517fe6b1e2676e870c4d.wasm
  imagePullPolicy: Always
  phase: AUTHN
  pluginConfig:
    attributes:
    - output_attribute: "istio_operationId"
      match:
        - value: "TravelQuote"
          condition: "request.url_path.matches('^/travels/[[:alpha:]]+$') && request.method == 'GET'"
        - value: "ListCities"
          condition: "request.url_path.matches('^/travels$') && request.method == 'GET'"
---
apiVersion: extensions.istio.io/v1alpha1
kind: WasmPlugin
metadata:
  name: attribgen-travelagency-hotels
spec:
  selector:
    matchLabels:
      app: hotels
  url: https://storage.googleapis.com/istio-build/proxy/attributegen-359dcd3a19f109c50e97517fe6b1e2676e870c4d.wasm
  imagePullPolicy: Always
  phase: AUTHN
  pluginConfig:
    attributes:
    - output_attribute: "istio_operationId"
      match:
        - value: "New"
          condition: "request.headers['user'] == 'new'"
        - value: "Registered"
          condition: "request.headers['user'] != 'new'"
---
apiVersion: extensions.istio.io/v1alpha1
kind: WasmPlugin
metadata:
  name: attribgen-travelagency-cars
spec:
  selector:
    matchLabels:
      app: cars
  url: https://storage.googleapis.com/istio-build/proxy/attributegen-359dcd3a19f109c50e97517fe6b1e2676e870c4d.wasm
  imagePullPolicy: Always
  phase: AUTHN
  pluginConfig:
    attributes:
    - output_attribute: "istio_operationId"
      match:
        - value: "New"
          condition: "request.headers['user'] == 'new'"
        - value: "Registered"
          condition: "request.headers['user'] != 'new'"
---
apiVersion: telemetry.istio.io/v1alpha1
kind: Telemetry
metadata:
  name: custom-tags
spec:
  metrics:
    - overrides:
        - match:
            metric: REQUEST_COUNT
            mode: CLIENT_AND_SERVER
          tagOverrides:
            request_operation:
              value: istio_operationId
      providers:
        - name: prometheus
OPMET
