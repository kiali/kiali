#/bin/bash

# This deploys the travel agency demo

: ${CLIENT_EXE:=oc}
: ${NAMESPACE_AGENCY:=travel-agency}
: ${NAMESPACE_PORTAL:=travel-portal}
: ${ENABLE_OPERATION_METRICS:=false}
: ${INSTALL_VERSION:=v1}
: ${DELETE_DEMO:=false}

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
    -eo|--enable-operation-metrics)
      ENABLE_OPERATION_METRICS="$2"
      shift;shift
      ;;
    -iv|--install-version)
      INSTALL_VERSION="$2"
      shift;shift
      ;;
    -na|--namespace-agency)
      NAMESPACE_AGENCY="$2"
      shift;shift
      ;;
    -np|--namespace-portal)
      NAMESPACE_PORTAL="$2"
      shift;shift
      ;;
    -h|--help)
      cat <<HELPMSG
Valid command line arguments:
  -c|--client: either 'oc' or 'kubectl'
  -d|--delete: either 'true' or 'false'. If 'true' the travel agency demo will be deleted, not installed.
  -eo|--enable-operation-metrics: either 'true' or 'false' (default is false). Only works on Istio 1.6 installed in istio-system.
  -na|--namespace-agency: where to install the travel agency demo resources
  -np|--namespace-portal: where to install the travel portal demo resources
  -iv|--install-version: either 'v1' or 'v2' (default is v1)
HELPMSG
      exit 1
      ;;
    *)
      echo "Unknown argument [$key]. Aborting."
      exit 1
      ;;
  esac
done

echo Will deploy Travel Agency using these settings:
echo CLIENT_EXE=${CLIENT_EXE}
echo NAMESPACE_AGENCY=${NAMESPACE_AGENCY}
echo NAMESPACE_PORTAL=${NAMESPACE_PORTAL}
echo ENABLE_OPERATION_METRICS=${ENABLE_OPERATION_METRICS}
echo INSTALL_VERSION=${INSTALL_VERSION}

if [ "${INSTALL_VERSION}" != "v1" -a "${INSTALL_VERSION}" != "v2" ]; then
  echo "Version must be one of 'v1' or 'v2'. Aborting."
  exit 1
fi

# If we are to delete, remove everything and exit immediately after
if [ "${DELETE_DEMO}" == "true" ]; then
  echo "Deleting Travel Agency Demo (the envoy filters, if previously created, will remain)"
  if [ "${CLIENT_EXE}" == "oc" ]; then
    ${CLIENT_EXE} adm policy remove-scc-from-group privileged system:serviceaccounts:${NAMESPACE_AGENCY}
    ${CLIENT_EXE} adm policy remove-scc-from-group anyuid system:serviceaccounts:${NAMESPACE_AGENCY}
    ${CLIENT_EXE} delete network-attachment-definition istio-cni -n ${NAMESPACE_AGENCY}

    ${CLIENT_EXE} adm policy remove-scc-from-group privileged system:serviceaccounts:${NAMESPACE_PORTAL}
    ${CLIENT_EXE} adm policy remove-scc-from-group anyuid system:serviceaccounts:${NAMESPACE_PORTAL}
    ${CLIENT_EXE} delete network-attachment-definition istio-cni -n ${NAMESPACE_PORTAL}
  fi
  ${CLIENT_EXE} delete namespace ${NAMESPACE_AGENCY}
  ${CLIENT_EXE} delete namespace ${NAMESPACE_PORTAL}
  exit 0
fi

# Create and prepare the demo namespaces

if ! ${CLIENT_EXE} get namespace ${NAMESPACE_AGENCY} 2>/dev/null; then
  ${CLIENT_EXE} create namespace ${NAMESPACE_AGENCY}
  ${CLIENT_EXE} label namespace ${NAMESPACE_AGENCY} istio-injection=enabled
  if [ "${CLIENT_EXE}" == "oc" ]; then
    ${CLIENT_EXE} adm policy add-scc-to-group privileged system:serviceaccounts:${NAMESPACE_AGENCY}
    ${CLIENT_EXE} adm policy add-scc-to-group anyuid system:serviceaccounts:${NAMESPACE_AGENCY}
    cat <<EOF | ${CLIENT_EXE} -n ${NAMESPACE_AGENCY} create -f -
apiVersion: "k8s.cni.cncf.io/v1"
kind: NetworkAttachmentDefinition
metadata:
  name: istio-cni
EOF
  fi
fi

if ! ${CLIENT_EXE} get namespace ${NAMESPACE_PORTAL} 2>/dev/null; then
  ${CLIENT_EXE} create namespace ${NAMESPACE_PORTAL}
  ${CLIENT_EXE} label namespace ${NAMESPACE_PORTAL} istio-injection=enabled
  if [ "${CLIENT_EXE}" == "oc" ]; then
    ${CLIENT_EXE} adm policy add-scc-to-group privileged system:serviceaccounts:${NAMESPACE_PORTAL}
    ${CLIENT_EXE} adm policy add-scc-to-group anyuid system:serviceaccounts:${NAMESPACE_PORTAL}
    cat <<EOF | ${CLIENT_EXE} -n ${NAMESPACE_PORTAL} create -f -
apiVersion: "k8s.cni.cncf.io/v1"
kind: NetworkAttachmentDefinition
metadata:
  name: istio-cni
EOF
  fi
fi

# Deploy the demo v1

if [ "${INSTALL_VERSION}" == "v1" ]; then
  ${CLIENT_EXE} apply -f <(curl -L https://raw.githubusercontent.com/lucasponce/travel-comparison-demo/master/travel_agency.yaml) -n ${NAMESPACE_AGENCY}
  ${CLIENT_EXE} apply -f <(curl -L https://raw.githubusercontent.com/lucasponce/travel-comparison-demo/master/travel_portal.yaml) -n ${NAMESPACE_PORTAL}
fi

# Deploy the demo v2

if [ "${INSTALL_VERSION}" == "v2" ]; then
  ${CLIENT_EXE} apply -f <(curl -L https://raw.githubusercontent.com/lucasponce/travel-comparison-demo/master/travel_agency_v2.yaml) -n ${NAMESPACE_AGENCY}
  ${CLIENT_EXE} apply -f <(curl -L https://raw.githubusercontent.com/lucasponce/travel-comparison-demo/master/travel_portal.yaml) -n ${NAMESPACE_PORTAL}
fi

# Set up metric classification

if [ "${ENABLE_OPERATION_METRICS}" != "true" ]; then
  # No need to keep going - we are done and the user doesn't want to do anything else.
  exit 0
fi

# This only works if you have Istio 1.6 installed, and it is in istio-system namespace.
${CLIENT_EXE} -n istio-system get envoyfilter stats-filter-1.6 -o yaml > stats-filter-1.6.yaml
cat <<EOF | patch -o - | ${CLIENT_EXE} -n istio-system apply -f - && rm stats-filter-1.6.yaml
--- stats-filter-1.6.yaml	2020-06-02 11:10:29.476537126 -0400
+++ stats-filter-1.6.yaml.new	2020-06-02 09:59:26.434300000 -0400
@@ -95,7 +95,14 @@
               configuration: |
                 {
                   "debug": "false",
-                  "stat_prefix": "istio"
+                  "stat_prefix": "istio",
+                  "metrics": [
+                   {
+                     "name": "requests_total",
+                     "dimensions": {
+                       "request_operation": "istio_operationId"
+                     }
+                   }]
                 }
               root_id: stats_inbound
               vm_config:
EOF

cat <<EOF | ${CLIENT_EXE} -n istio-system apply -f -
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
        proxyVersion: '1\.6.*'
      listener:
        filterChain:
          filter:
            name: "envoy.http_connection_manager"
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
              configuration: |
                {
                  "attributes": [
                    {
                      "output_attribute": "istio_operationId",
                      "match": [
                        {
                          "value": "ParisRental",
                          "condition": "request.url_path.matches('^/hotels/paris.*$') && request.method == 'GET'"
                        },
                        {
                          "value": "OtherHotel",
                          "condition": "request.url_path.matches('^/hotels/.*$')"
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
        proxyVersion: '1\.6.*'
      listener:
        filterChain:
          filter:
            name: "envoy.http_connection_manager"
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
              configuration: |
                {
                  "attributes": [
                    {
                      "output_attribute": "istio_operationId",
                      "match": [
                        {
                          "value": "ParisRental",
                          "condition": "request.url_path.matches('^/cars/paris.*$') && request.method == 'GET'"
                        },
                        {
                          "value": "OtherCar",
                          "condition": "request.url_path.matches('^/cars/.*$')"
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
  name: attribgen-travelagency-flights
spec:
  workloadSelector:
    labels:
      app: flights
  configPatches:
  - applyTo: HTTP_FILTER
    match:
      context: SIDECAR_INBOUND
      proxy:
        proxyVersion: '1\.6.*'
      listener:
        filterChain:
          filter:
            name: "envoy.http_connection_manager"
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
              configuration: |
                {
                  "attributes": [
                    {
                      "output_attribute": "istio_operationId",
                      "match": [
                        {
                          "value": "ParisFlight",
                          "condition": "request.url_path.matches('^/flights/paris.*$') && request.method == 'GET'"
                        },
                        {
                          "value": "OtherFlight",
                          "condition": "request.url_path.matches('^/flights/.*$')"
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
