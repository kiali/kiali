#!/bin/bash

###################################
# This script enables Istio and Kiali to use Prometheus that comes with OpenShift.
# For reference, see:
# * https://docs.openshift.com/container-platform/4.14/monitoring/configuring-the-monitoring-stack.html#preparing-to-configure-the-monitoring-stack
# * https://docs.openshift.com/container-platform/4.14/monitoring/enabling-monitoring-for-user-defined-projects.html
# * https://docs.openshift.com/container-platform/4.14/service_mesh/v2x/ossm-observability.html#ossm-integrating-with-user-workload-monitoring_observability
###################################

set -ue

DELETE="false"
ISTIO_NAMESPACE="istio-system"
KIALI_CR_NAMESPACE=""
MESH_LABEL="mymesh"
NAMESPACES=""
NETWORK_POLICIES="false"
OC="oc"

# process command line args
while [[ $# -gt 0 ]]; do
  key="$1"
  case $key in
    -d|--delete)                DELETE="$2"            ; shift;shift ;;
    -in|--istio-namespace)      ISTIO_NAMESPACE="$2"   ; shift;shift ;;
    -kcns|--kiali-cr-namespace) KIALI_CR_NAMESPACE="$2"; shift;shift ;;
    -ml|--mesh-label)           MESH_LABEL="$2"        ; shift;shift ;;
    -n|--namespaces)            NAMESPACES="$2"        ; shift;shift ;;
    -np|--network-policies)     NETWORK_POLICIES="$2"  ; shift;shift ;;
    -oc|--oc)                   OC="$2"                ; shift;shift ;;
    -h|--help)
      cat <<HELPMSG
Valid command line arguments:
  -d|--delete (true|false): If true, delete any existing resources that this script originally created (Default: false)
  -in|--istio-namespace <name>: The control plane namespace (Default: istio-system)
  -kcns|--kiali-cr-namespace <name>: A namespace containing Kiali CR which should be used. When specified, first found Kiali CR in the given namespace will be used. When empty, first found Kiali CR cluster wide will be used. (Default: "")
  -ml|--mesh-label <label>: The label that will be attached to the metrics to demarcate the telemetry for this mesh (Default: mymesh)
  -n|--namespaces <names>: Space-separated names of namespaces in the mesh (Default: empty)
  -np|--network-policies (true|false) If true, NetworkPolicies will be created (or deleted if --delete is true) to allow for all ingress traffic, including from OpenShift monitoring namespaces labeled with network.openshift.io/policy-group: monitoring (where Prometheus lives) (Default: false)
  -oc|--oc <path>: Cluster client executable name of 'oc' (Default: oc)
  -h|--help : this message
HELPMSG
      exit 1
      ;;
    *)
      echo "Unknown argument [$key]. Aborting."
      exit 1
      ;;
  esac
done

echo "=== SETTINGS ==="
echo "DELETE=$DELETE"
echo "ISTIO_NAMESPACE=$ISTIO_NAMESPACE"
echo "KIALI_CR_NAMESPACE=$KIALI_CR_NAMESPACE"
echo "MESH_LABEL=$MESH_LABEL"
echo "OC=$OC"
echo "NETWORK_POLICIES=$NETWORK_POLICIES"
if [ -z "${NAMESPACES}" ]; then
  echo "NAMESPACES: <empty>"
else
  echo "NAMESPACES:"
  echo $NAMESPACES | xargs -n 1 echo "-"
fi
echo "=== SETTINGS ==="

#
# Make sure the cluster is setup correctly. We need:
# * A valid "oc" client
# * The user logged into an OpenShift cluster
# * Istio installed in ISTIO_NAMESPACE
# * Kial Operator installed
# * A Kiali CR installed
# * A Kiali Server installed (we need the service account for it)
#
if ! ${OC} whoami &> /dev/null; then
  echo "Either you are not logged into OpenShift or [${OC}] is not a valid client executable"
  exit 1
fi

if ! ${OC} get ns ${ISTIO_NAMESPACE} &> /dev/null; then
  echo "[${ISTIO_NAMESPACE}] namespace does not exist. An Istio control plane needs to be installed there."
  exit 1
fi

if ! (${OC} get pods -n ${ISTIO_NAMESPACE} 2> /dev/null | grep -q istiod); then
  echo "Istiod does not appear to be installed in [${ISTIO_NAMESPACE}]. An Istio control plane needs to be installed there."
  exit 1
fi

if ! ${OC} get crd kialis.kiali.io &> /dev/null; then
  echo "Kiali Operator is not installed."
  exit 1
fi

# This is a label that will be put on all created resources so they are easily found and deleted later
RESOURCE_LABEL_NAME="hack"
RESOURCE_LABEL_VALUE="kiali"
RESOURCE_LABEL_EQUALS="${RESOURCE_LABEL_NAME}=${RESOURCE_LABEL_VALUE}"
RESOURCE_LABEL_COLON="${RESOURCE_LABEL_NAME}: ${RESOURCE_LABEL_VALUE}"

KIALI_CR_NAME=""
if [ -n "${KIALI_CR_NAMESPACE}" ]
then
  for cr in $(${OC} get kiali -n ${KIALI_CR_NAMESPACE} -o custom-columns=N:.metadata.name --no-headers); do
    KIALI_CR_NAME="${cr}"
    break
  done
  if [ -z "${KIALI_CR_NAME}" ]
  then
    echo "Couldn't find any Kiali CR in ${KIALI_CR_NAMESPACE} namespace. Exiting."
    exit 1
  fi
else
  for cr in $(${OC} get kiali --all-namespaces -o custom-columns=NS:.metadata.namespace,N:.metadata.name --no-headers | sed 's/  */:/g'); do
    KIALI_CR_NAMESPACE="$(echo $cr | cut -d: -f1)"
    KIALI_CR_NAME="$(echo $cr | cut -d: -f2)"
    break
  done
  if [ -z "${KIALI_CR_NAME}" ]; then
    echo "There are no Kiali CRs installed in the cluster."
    exit 1
  fi
fi

echo "Using following Kiali CR [${KIALI_CR_NAMESPACE}:${KIALI_CR_NAME}]"

# Get a Kiali server namespace, if not defined in .spec.deployment.namespace, use Kiali CR's namespace
KIALI_SA_NAMESPACE=$(${OC} get kiali ${KIALI_CR_NAME} -n ${KIALI_CR_NAMESPACE} -o jsonpath='{.spec.deployment.namespace}{"\n"}{.metadata.namespace}' | awk 'NF{print $1; exit}')
# Get a service account required to generate Kiali Cluster Role Binding for OpenShift Prometheus access
KIALI_SA_NAME=$(${OC} get sa ${KIALI_CR_NAME}-service-account -n ${KIALI_SA_NAMESPACE} -o custom-columns=N:.metadata.name --no-headers)
if [ -z "${KIALI_SA_NAME}" ]; then
  echo "There are no Kiali Servers installed in the ${KIALI_SA_NAMESPACE} namespace."
  exit 1
fi

########## DELETE

delete_resources() {
  echo "Disabling user workload monitoring"
  ${OC} delete cm -l ${RESOURCE_LABEL_EQUALS} --ignore-not-found=true -n openshift-monitoring

  echo "Deleting Kiali ClusterRoleBinding"
  ${OC} delete clusterrolebinding -l ${RESOURCE_LABEL_EQUALS} --ignore-not-found=true

  echo "Deleting NetworkPolicy resources"
  ${OC} delete NetworkPolicy -l ${RESOURCE_LABEL_EQUALS} --ignore-not-found=true --all-namespaces

  echo "Deleting Telemetry resource"
  ${OC} delete Telemetry -l ${RESOURCE_LABEL_EQUALS} --ignore-not-found=true --all-namespaces

  echo "Deleting ServiceMonitor resource"
  ${OC} delete ServiceMonitor -l ${RESOURCE_LABEL_EQUALS} --ignore-not-found=true --all-namespaces

  echo "Deleting PodMonitor resources"
  ${OC} delete PodMonitor -l ${RESOURCE_LABEL_EQUALS} --ignore-not-found=true --all-namespaces

  echo "Deleting spec.external_services.prometheus from Kiali CR [${KIALI_CR_NAME}] in namespace [${KIALI_CR_NAMESPACE}]"
  ${OC} patch kiali ${KIALI_CR_NAME} -n ${KIALI_CR_NAMESPACE} --type=json --patch '[{"op": "remove", "path": "/spec/external_services/prometheus"}]'
}

########## CREATE

create_resources() {
  echo "Enabling user workload monitoring in the OpenShift cluster"
  cat <<EOM | ${OC} apply -f -
apiVersion: v1
kind: ConfigMap
metadata:
  name: cluster-monitoring-config
  namespace: openshift-monitoring
  labels:
    ${RESOURCE_LABEL_COLON}
data:
  config.yaml: |
    enableUserWorkload: true
EOM

  crb=$(${OC} get clusterrolebinding -l ${RESOURCE_LABEL_EQUALS} -o name 2>/dev/null)
  if [ -n "${crb}" ]; then
    echo "Kiali Cluster Role Binding for OpenShift Prometheus access already exists. It will be re-used."
    ${OC} patch ${crb} --type='json' -p="[{'op': 'add', 'path': '/subjects/0', 'value': {'kind': 'ServiceAccount','name': '${KIALI_SA_NAME}','namespace': '${KIALI_SA_NAMESPACE}'}}]"
  else
    echo "Generating Kiali Cluster Role Binding for OpenShift Prometheus access"
    cat <<CRB | ${OC} apply -f -
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: kiali-openshift-user-workload-monitoring
  labels:
    ${RESOURCE_LABEL_COLON}
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: cluster-monitoring-view
subjects:
- kind: ServiceAccount
  name: ${KIALI_SA_NAME}
  namespace: ${KIALI_SA_NAMESPACE}
CRB
  fi

  if [ "${NETWORK_POLICIES}" == "true" ]; then
    echo "Apply a NetworkPolicy resource to all mesh namespaces to all ingress traffic (thus allowing OpenShift monitoring to access the mesh)"
    for n in ${NAMESPACES} ${ISTIO_NAMESPACE}; do
      echo "Applying NetworkPolicy resource to [${n}]"
      cat <<EOM | ${OC} apply -n ${n} -f -
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-all-ingress
  labels:
    ${RESOURCE_LABEL_COLON}
spec:
  ingress:
  - {}
  podSelector: {}
  policyTypes:
  - Ingress
EOM
    done
  else
    echo "Skipping the creation of NetworkPolicies. Ensure mesh namespaces can accept ingress traffic from namespaces labeled with 'network.openshift.io/policy-group: monitoring'"
  fi

  echo "Apply Telemetry resource to [${ISTIO_NAMESPACE}] to ensure Prometheus is a metrics provider"
  tel_name=$(${OC} get telemetry -n ${ISTIO_NAMESPACE} -o name)
  if [ ! -z "$tel_name" ]
  then
    echo "Found existing [${tel_name}] in [${ISTIO_NAMESPACE}], patching..."
    ${OC} patch ${tel_name} -n ${ISTIO_NAMESPACE} --type=merge -p '{"spec":{"metrics":[{"providers":[{"name":"prometheus"}]}]}}'
  else
    cat <<EOM | ${OC} apply -n ${ISTIO_NAMESPACE} -f -
apiVersion: telemetry.istio.io/v1
kind: Telemetry
metadata:
  name: enable-prometheus-metrics
  labels:
    ${RESOURCE_LABEL_COLON}
spec:
  metrics:
  - providers:
    - name: prometheus
EOM
  fi

  echo "Applying ServiceMonitor resource in [${ISTIO_NAMESPACE}] to collect istiod metrics"
  cat <<EOM | ${OC} apply -n ${ISTIO_NAMESPACE} -f -
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: istiod-monitor
  labels:
    ${RESOURCE_LABEL_COLON}
spec:
  targetLabels:
  - app
  selector:
    matchLabels:
      istio: pilot
  endpoints:
  - port: http-monitoring
    path: /metrics
    interval: 30s
    relabelings:
    - action: replace
      replacement: "${MESH_LABEL}"
      targetLabel: mesh_id
EOM

  echo "Apply a PodMonitor resource to all mesh namespaces in order to collect Istio telemetry from proxies"
  for n in ${NAMESPACES} ${ISTIO_NAMESPACE}; do
    echo "Applying PodMonitor resource to [${n}]"
    cat <<EOM | ${OC} apply -n ${n} -f -
apiVersion: monitoring.coreos.com/v1
kind: PodMonitor
metadata:
  name: istio-proxies-monitor
  labels:
    ${RESOURCE_LABEL_COLON}
spec:
  selector:
    matchExpressions:
    - key: istio-prometheus-ignore
      operator: DoesNotExist
  podMetricsEndpoints:
  - path: /stats/prometheus
    interval: 30s
    relabelings:
    - action: keep
      sourceLabels: [__meta_kubernetes_pod_container_name]
      regex: "istio-proxy"
    - action: keep
      sourceLabels: [__meta_kubernetes_pod_annotationpresent_prometheus_io_scrape]
    - action: replace
      regex: (\\d+);(([A-Fa-f0-9]{1,4}::?){1,7}[A-Fa-f0-9]{1,4})
      replacement: '[\$2]:\$1'
      sourceLabels: [__meta_kubernetes_pod_annotation_prometheus_io_port, __meta_kubernetes_pod_ip]
      targetLabel: __address__
    - action: replace
      regex: (\\d+);((([0-9]+?)(\.|$)){4})
      replacement: \$2:\$1
      sourceLabels: [__meta_kubernetes_pod_annotation_prometheus_io_port, __meta_kubernetes_pod_ip]
      targetLabel: __address__
    - action: labeldrop
      regex: "__meta_kubernetes_pod_label_(.+)"
    - sourceLabels: [__meta_kubernetes_namespace]
      action: replace
      targetLabel: namespace
    - sourceLabels: [__meta_kubernetes_pod_name]
      action: replace
      targetLabel: pod_name
    - action: replace
      replacement: "${MESH_LABEL}"
      targetLabel: mesh_id
EOM
  done

  echo "Adding this to the Kiali CR [${KIALI_CR_NAME}] found in namespace [${KIALI_CR_NAMESPACE}]"
  echo "---"
  cat <<EOM
spec:
  external_services:
    prometheus:
      auth:
        type: bearer
        use_kiali_token: true
      query_scope:
        mesh_id: "${MESH_LABEL}"
      thanos_proxy:
        enabled: true
      url: https://thanos-querier.openshift-monitoring.svc.cluster.local:9091
EOM
  echo "..."
  ${OC} patch kiali ${KIALI_CR_NAME} -n ${KIALI_CR_NAMESPACE} --type=merge --patch '{"spec":{"external_services":{"prometheus":{"auth":{"type":"bearer","use_kiali_token": true},"query_scope":{"mesh_id": "'${MESH_LABEL}'"},"thanos_proxy":{"enabled": true},"url":"https://thanos-querier.openshift-monitoring.svc.cluster.local:9091"}}}}'
}

########## MAIN

if [ "${DELETE}" == "false" ]; then
  echo "CREATING..."
  create_resources
else
  echo "DELETING..."
  delete_resources
fi
