#/bin/bash

# This deploys the travel agency demo

# Given a namepace, prepare it for inclusion in Maistra's control plane
# This means:
# 1. Create a SMM
# 2. Annotate all of the namespace's Deployments with the sidecar injection annotation if enabled
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

  if [ "${ENABLE_INJECTION}" == "true" ]; then
    for d in $(${CLIENT_EXE} get deployments -n ${ns} -o name)
    do
      echo "Enabling sidecar injection for deployment: ${d}"
      ${CLIENT_EXE} patch ${d} -n ${ns} -p '{"spec":{"template":{"metadata":{"annotations":{"sidecar.istio.io/inject": "true"}}}}}' --type=merge
    done
  fi
}

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
  -eo|--enable-operation-metrics: either 'true' or 'false' (default is false). Only works on Istio 1.10 installed in istio-system.
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
IS_MAISTRA="false"
if [[ "${CLIENT_EXE}" = *"oc" ]]; then
  IS_OPENSHIFT="true"
  IS_MAISTRA=$([ "$(oc get crd | grep servicemesh | wc -l)" -gt "0" ] && echo "true" || echo "false")
fi

echo "IS_OPENSHIFT=${IS_OPENSHIFT}"
echo "IS_MAISTRA=${IS_MAISTRA}"


# If we are to delete, remove everything and exit immediately after
if [ "${DELETE_DEMO}" == "true" ]; then
  echo "Deleting Travel Agency Demo (the envoy filters, if previously created, will remain)"
  if [ "${IS_OPENSHIFT}" == "true" ]; then
    if [ "${IS_MAISTRA}" != "true" ]; then
      ${CLIENT_EXE} delete network-attachment-definition istio-cni -n ${NAMESPACE_AGENCY}
      ${CLIENT_EXE} delete network-attachment-definition istio-cni -n ${NAMESPACE_PORTAL}
      ${CLIENT_EXE} delete network-attachment-definition istio-cni -n ${NAMESPACE_CONTROL}
    else
      $CLIENT_EXE delete smm default -n ${NAMESPACE_AGENCY}
      $CLIENT_EXE delete smm default -n ${NAMESPACE_PORTAL}
      $CLIENT_EXE delete smm default -n ${NAMESPACE_CONTROL}
    fi
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
    if [ "${IS_MAISTRA}" != "true" ]; then
      cat <<NAD | $CLIENT_EXE -n ${NAMESPACE_AGENCY} create -f -
apiVersion: "k8s.cni.cncf.io/v1"
kind: NetworkAttachmentDefinition
metadata:
  name: istio-cni
NAD
    fi
  fi
fi

if ! ${CLIENT_EXE} get namespace ${NAMESPACE_PORTAL} 2>/dev/null; then
  ${CLIENT_EXE} create namespace ${NAMESPACE_PORTAL}
  if [ "${ENABLE_INJECTION}" == "true" ]; then
    ${CLIENT_EXE} label namespace ${NAMESPACE_PORTAL} istio-injection=enabled
  fi
  if [ "${IS_OPENSHIFT}" == "true" ]; then
    if [ "${IS_MAISTRA}" != "true" ]; then
      cat <<NAD | $CLIENT_EXE -n ${NAMESPACE_PORTAL} create -f -
apiVersion: "k8s.cni.cncf.io/v1"
kind: NetworkAttachmentDefinition
metadata:
  name: istio-cni
NAD
    fi
  fi
fi

if ! ${CLIENT_EXE} get namespace ${NAMESPACE_CONTROL} 2>/dev/null; then
  ${CLIENT_EXE} create namespace ${NAMESPACE_CONTROL}
  if [ "${ENABLE_INJECTION}" == "true" ]; then
    ${CLIENT_EXE} label namespace ${NAMESPACE_CONTROL} istio-injection=enabled
  fi
  if [ "${IS_OPENSHIFT}" == "true" ]; then
    if [ "${IS_MAISTRA}" != "true" ]; then
      cat <<NAD | $CLIENT_EXE -n ${NAMESPACE_CONTROL} create -f -
apiVersion: "k8s.cni.cncf.io/v1"
kind: NetworkAttachmentDefinition
metadata:
  name: istio-cni
NAD
    fi
  fi
fi

# Deploy the demo

${CLIENT_EXE} apply -f <(curl -L "${SOURCE}/travels/travel_agency.yaml") -n ${NAMESPACE_AGENCY}
${CLIENT_EXE} apply -f <(curl -L "${SOURCE}/travels/travel_portal.yaml") -n ${NAMESPACE_PORTAL}
${CLIENT_EXE} apply -f <(curl -L "${SOURCE}/travels/travel_control.yaml") -n ${NAMESPACE_CONTROL}

if [ "${IS_MAISTRA}" == "true" ]; then
  prepare_maistra "${NAMESPACE_AGENCY}"
  prepare_maistra "${NAMESPACE_PORTAL}"
  prepare_maistra "${NAMESPACE_CONTROL}"
fi

# Add SCC for OpenShift
if [ "${IS_OPENSHIFT}" == "true" ]; then
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
users:
- "system:serviceaccount:${NAMESPACE_AGENCY}:default"
- "system:serviceaccount:${NAMESPACE_PORTAL}:default"
- "system:serviceaccount:${NAMESPACE_CONTROL}:default"
SCC
fi

# Set up metric classification

if [ "${ENABLE_OPERATION_METRICS}" != "true" ]; then
  # No need to keep going - we are done and the user doesn't want to do anything else.
  exit 0
fi

# This only works if you have Istio 1.10 installed, and it is in istio-system namespace.
${CLIENT_EXE} -n istio-system get envoyfilter stats-filter-1.10 -o yaml > stats-filter-1.10.yaml
cat <<EOF | patch -o - | ${CLIENT_EXE} -n istio-system apply -f - && rm stats-filter-1.10.yaml
--- stats-filter-1.10.yaml	2021-01-13 11:54:58.238566005 -0500
+++ stats-filter-1.10.yaml.new	2021-01-13 12:13:12.710918344 -0500
@@ -117,6 +117,18 @@
                           "source_cluster": "downstream_peer.cluster_id",
                           "destination_cluster": "node.metadata['CLUSTER_ID']"
                         }
+                      },
+                      {
+                        "name": "requests_total",
+                        "dimensions": {
+                          "request_operation": "istio_operationId"
+                        }
+                      },
+                      {
+                        "name": "request_duration_milliseconds",
+                        "dimensions": {
+                          "request_operation": "istio_operationId"
+                        }
                       }
                     ]
                   }
EOF

cat <<EOF | ${CLIENT_EXE} -n istio-system apply -f -
apiVersion: networking.istio.io/v1alpha3
kind: EnvoyFilter
metadata:
  name: attribgen-travelagency
spec:
  configPatches:
  - applyTo: HTTP_FILTER
    match:
      context: SIDECAR_INBOUND
      listener:
        filterChain:
          filter:
            name: "envoy.filters.network.http_connection_manager"
            subFilter:
              name: istio.stats
      proxy:
        proxyVersion: 1\.10.*
    patch:
      operation: INSERT_BEFORE
      value:
        name: istio.attributegen
        typed_config:
          '@type': type.googleapis.com/udpa.type.v1.TypedStruct
          type_url: type.googleapis.com/envoy.extensions.filters.http.wasm.v3.Wasm
          value:
            config:
              configuration:
                '@type': type.googleapis.com/google.protobuf.StringValue
                value: |
                  {
                    "attributes": [
                      {
                        "output_attribute": "istio_operationId",
                        "match": [
                          {
                            "value": "TravelQuote",
                            "condition": "request.url_path.matches('^/travels/[[:alpha:]]+$') && request.method == 'GET'"
                          },
                          {
                            "value": "ListCities",
                            "condition": "request.url_path.matches('^/travels$') && request.method == 'GET'"
                          }
                        ]
                      }
                    ]
                  }
              vm_config:
                code:
                  local:
                    inline_string: envoy.wasm.attributegen
                runtime: envoy.wasm.runtime.null
  workloadSelector:
    labels:
      app: travels
---
apiVersion: networking.istio.io/v1alpha3
kind: EnvoyFilter
metadata:
  name: attribgen-travelagency-hotels
spec:
  workloadSelector:
    labels:
      app: hotels
  configPatches:
  - applyTo: HTTP_FILTER
    match:
      context: SIDECAR_INBOUND
      proxy:
        proxyVersion: '1\.10.*'
      listener:
        filterChain:
          filter:
            name: "envoy.filters.network.http_connection_manager"
            subFilter:
              name: "istio.stats"
    patch:
      operation: INSERT_BEFORE
      value:
        name: istio.attributegen
        typed_config:
          "@type": type.googleapis.com/udpa.type.v1.TypedStruct
          type_url: type.googleapis.com/envoy.extensions.filters.http.wasm.v3.Wasm
          value:
            config:
              configuration:
                '@type': type.googleapis.com/google.protobuf.StringValue
                value: |
                  {
                    "attributes": [
                      {
                        "output_attribute": "istio_operationId",
                        "match": [
                          {
                            "value": "New",
                            "condition": "request.headers['user'] == 'new'"
                          },
                          {
                            "value": "Registered",
                            "condition": "request.headers['user'] != 'new'"
                          }
                        ]
                      }
                    ]
                  }
              vm_config:
                runtime: envoy.wasm.runtime.null
                code:
                  local: { inline_string: "envoy.wasm.attributegen" }
---
apiVersion: networking.istio.io/v1alpha3
kind: EnvoyFilter
metadata:
  name: attribgen-travelagency-cars
spec:
  workloadSelector:
    labels:
      app: cars
  configPatches:
  - applyTo: HTTP_FILTER
    match:
      context: SIDECAR_INBOUND
      proxy:
        proxyVersion: '1\.10.*'
      listener:
        filterChain:
          filter:
            name: "envoy.filters.network.http_connection_manager"
            subFilter:
              name: "istio.stats"
    patch:
      operation: INSERT_BEFORE
      value:
        name: istio.attributegen
        typed_config:
          "@type": type.googleapis.com/udpa.type.v1.TypedStruct
          type_url: type.googleapis.com/envoy.extensions.filters.http.wasm.v3.Wasm
          value:
            config:
              configuration:
                '@type': type.googleapis.com/google.protobuf.StringValue
                value: |
                  {
                    "attributes": [
                      {
                        "output_attribute": "istio_operationId",
                        "match": [
                          {
                            "value": "New",
                            "condition": "request.headers['user'] == 'new'"
                          },
                          {
                            "value": "Registered",
                            "condition": "request.headers['user'] != 'new'"
                          }
                        ]
                      }
                    ]
                  }
              vm_config:
                runtime: envoy.wasm.runtime.null
                code:
                  local: { inline_string: "envoy.wasm.attributegen" }
EOF
