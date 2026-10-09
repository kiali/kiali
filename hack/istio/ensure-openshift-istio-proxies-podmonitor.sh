#!/bin/bash
##############################################################################
# ensure-openshift-istio-proxies-podmonitor.sh
#
# On OpenShift clusters using user-workload monitoring (UWM), reapplies the
# istio-proxies-monitor PodMonitor (and user-monitoring namespace label) after
# a demo namespace is recreated — e.g. Cypress reinstalling bookinfo.
#
# Required when Kiali uses Thanos/UWM (see hack/use-openshift-prometheus.sh).
# Clusters that scrape mesh metrics only via platform monitoring or an in-mesh
# Prometheus addon do not need this; the script no-ops on plain Kubernetes.
#
# No-op when the PodMonitor CRD is absent.
##############################################################################

set -eu

CLIENT_EXE="oc"
MESH_LABEL=""
NAMESPACES=""
RESOURCE_LABEL_NAME="hack"
RESOURCE_LABEL_VALUE="kiali"
RESOURCE_LABEL_COLON="${RESOURCE_LABEL_NAME}: ${RESOURCE_LABEL_VALUE}"

while [[ $# -gt 0 ]]; do
  key="$1"
  case $key in
    -c|--client)
      CLIENT_EXE="$2"
      shift
      shift
      ;;
    -ml|--mesh-label)
      MESH_LABEL="$2"
      shift
      shift
      ;;
    -n|--namespaces)
      NAMESPACES="$2"
      shift
      shift
      ;;
    -h|--help)
      cat <<HELPMSG
Valid command line arguments:
  -c|--client <oc|kubectl>: Cluster client (default: oc)
  -ml|--mesh-label <label>: mesh_id relabel value (default: read from Kiali CR, else "mymesh")
  -n|--namespaces <names>: Space-separated namespace names (required)
  -h|--help: this message
HELPMSG
      exit 0
      ;;
    *)
      echo "Unknown argument [$key]. Aborting."
      exit 1
      ;;
  esac
done

if [ -z "${NAMESPACES}" ]; then
  echo "At least one namespace is required (-n|--namespaces)."
  exit 1
fi

if ! ${CLIENT_EXE} api-versions 2>/dev/null | grep -q 'route.openshift.io'; then
  echo "Not an OpenShift cluster — skipping Istio PodMonitor setup."
  exit 0
fi

if ! ${CLIENT_EXE} get crd podmonitors.monitoring.coreos.com &>/dev/null; then
  echo "PodMonitor CRD not found — skipping Istio PodMonitor setup."
  exit 0
fi

if [ -z "${MESH_LABEL}" ]; then
  MESH_LABEL=$(${CLIENT_EXE} get kiali -A -o jsonpath='{.items[0].spec.external_services.prometheus.query_scope.mesh_id}' 2>/dev/null || true)
fi
if [ -z "${MESH_LABEL}" ]; then
  MESH_LABEL="mymesh"
fi

for n in ${NAMESPACES}; do
  if ! ${CLIENT_EXE} get namespace "${n}" &>/dev/null; then
    echo "Namespace [${n}] does not exist — skipping."
    continue
  fi

  echo "Labeling namespace [${n}] for OpenShift user-workload monitoring"
  ${CLIENT_EXE} label namespace "${n}" openshift.io/user-monitoring=true --overwrite

  echo "Applying PodMonitor istio-proxies-monitor in [${n}] (mesh_id=${MESH_LABEL})"
  cat <<EOM | ${CLIENT_EXE} apply -n "${n}" -f -
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
    - sourceLabels: ["__meta_kubernetes_pod_label_app_kubernetes_io_name", "__meta_kubernetes_pod_label_app"]
      separator: ";"
      targetLabel: "app"
      action: replace
      regex: "(.+);.*|.*;(.+)"
      replacement: "\${1}\${2}"
    - sourceLabels: ["__meta_kubernetes_pod_label_app_kubernetes_io_version", "__meta_kubernetes_pod_label_version"]
      separator: ";"
      targetLabel: "version"
      action: replace
      regex: "(.+);.*|.*;(.+)"
      replacement: "\${1}\${2}"
    - action: replace
      regex: "(.+)"
      replacement: "\${1}"
      sourceLabels: [__meta_kubernetes_pod_label_app_kubernetes_io_name]
      targetLabel: app_kubernetes_io_name
    - action: replace
      regex: "(.+)"
      replacement: "\${1}"
      sourceLabels: [__meta_kubernetes_pod_label_app_kubernetes_io_version]
      targetLabel: app_kubernetes_io_version
    - sourceLabels: [__meta_kubernetes_namespace]
      action: replace
      targetLabel: namespace
    - action: replace
      replacement: "${MESH_LABEL}"
      targetLabel: mesh_id
EOM
done
