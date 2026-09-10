#!/usr/bin/env bash

# Configure ACM multicluster observability add-on (MCOA) for Kiali metrics.
# (requires ACM 2.17 or later)
#
# Metrics flow on each managed cluster:
#   1. UWM scrapes raw istio_* series from ServiceMonitor/PodMonitor targets.
#   2. A propagated PrometheusRule in each target namespace aggregates that
#      namespace's traffic into workload:istio_*.
#   3. MCOA's user-workload collector federates selected UWM series via /federate,
#      relabels workload:istio_* back to istio_*, and remote-writes to hub Thanos.
#   4. Per-target-namespace platform federation jobs collect container CPU/memory
#      for Kiali's control-plane overview from platform monitoring.
#
# This script only creates hub-side source objects and placement references. MCOA
# propagates them to selected managed clusters. Install and uninstall are safe to
# repeat with the same arguments.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RULES_DIR="${SCRIPT_DIR}/istio/metric-rules"

COMMAND=""
HUB_CONTEXT=""
OBSERVABILITY_NAMESPACE="open-cluster-management-observability"
TARGET_NAMESPACES=""
RULE_NAMESPACE=""
WITH_DASHBOARDS=false
PLACEMENT_NAME=""
PLACEMENT_NAMESPACE=""
WAIT_TIMEOUT=600

usage() {
  cat <<'EOF'
Usage:
  configure-acm-mcoa.sh install --hub-context CONTEXT --target-namespaces NS[,NS...]
  configure-acm-mcoa.sh verify --hub-context CONTEXT --target-namespaces NS[,NS...]
  configure-acm-mcoa.sh uninstall --hub-context CONTEXT --target-namespaces NS[,NS...]

Options:
  --hub-context CONTEXT          Kubeconfig context for the ACM hub.
  --target-namespaces NS[,NS...] Namespaces for platform container CPU/memory
                                 federation jobs and namespace-scoped edge
                                 recording rules. Must include --rule-namespace.
  --rule-namespace NS            Compatibility/default namespace that must be
                                 included in the target set (default: first).
  --observability-namespace NS   ACM observability namespace.
  --placement-name NAME          Existing MCOA placement to update. Optional only
                                 when the add-on has exactly one placement.
  --placement-namespace NS       Namespace of --placement-name when names are ambiguous.
  --with-dashboards              Also federate the Istio dashboard metric tier.
  --timeout SECONDS              Wait for MCOA resources (default: 600).

The script never changes the current kubeconfig context.
Install and uninstall are idempotent with the same options.
EOF
}

die() {
  echo "[ERROR] $*" >&2
  exit 1
}

oc_hub() {
  command oc --context="${HUB_CONTEXT}" "$@"
}

parse_args() {
  [ "$#" -gt 0 ] || { usage; exit 1; }
  if [ "$1" = "-h" ] || [ "$1" = "--help" ]; then
    usage
    exit 0
  fi
  COMMAND="$1"
  shift

  while [ "$#" -gt 0 ]; do
    case "$1" in
      --hub-context) HUB_CONTEXT="$2"; shift 2 ;;
      --observability-namespace) OBSERVABILITY_NAMESPACE="$2"; shift 2 ;;
      --placement-name) PLACEMENT_NAME="$2"; shift 2 ;;
      --placement-namespace) PLACEMENT_NAMESPACE="$2"; shift 2 ;;
      --rule-namespace) RULE_NAMESPACE="$2"; shift 2 ;;
      --target-namespaces) TARGET_NAMESPACES="$2"; shift 2 ;;
      --timeout) WAIT_TIMEOUT="$2"; shift 2 ;;
      --with-dashboards) WITH_DASHBOARDS=true; shift ;;
      -h|--help) usage; exit 0 ;;
      *) die "Unknown argument: $1" ;;
    esac
  done

  case "${COMMAND}" in install|uninstall|verify) ;; *) die "Unknown command: ${COMMAND}" ;; esac
  [ -n "${HUB_CONTEXT}" ] || die "--hub-context is required"
  [ -n "${TARGET_NAMESPACES}" ] || die "--target-namespaces is required"
  [ -z "${PLACEMENT_NAMESPACE}" ] || [ -n "${PLACEMENT_NAME}" ] || die "--placement-namespace requires --placement-name"
  [[ "${WAIT_TIMEOUT}" =~ ^[0-9]+$ ]] || die "--timeout must be a non-negative integer"
}

ADDON_JSON=""

load_and_select_placement() {
  local count matches choices
  ADDON_JSON=$(oc_hub get clustermanagementaddon multicluster-observability-addon -o json) \
    || die "multicluster-observability-addon was not found"
  count=$(printf '%s' "${ADDON_JSON}" | jq '(.spec.installStrategy.placements // []) | length')
  [ "${count}" -gt 0 ] || die "MCOA has no populated placements"

  if [ -z "${PLACEMENT_NAME}" ]; then
    if [ "${count}" -ne 1 ]; then
      choices=$(printf '%s' "${ADDON_JSON}" | jq -r \
        '(.spec.installStrategy.placements // [])[] | "  --placement-name \(.name) --placement-namespace \(.namespace)"')
      die "MCOA has ${count} placements; select one explicitly:\n${choices}"
    fi
    PLACEMENT_NAME=$(printf '%s' "${ADDON_JSON}" | jq -r '.spec.installStrategy.placements[0].name')
    PLACEMENT_NAMESPACE=$(printf '%s' "${ADDON_JSON}" | jq -r '.spec.installStrategy.placements[0].namespace')
    echo "Using the only MCOA placement: ${PLACEMENT_NAMESPACE}/${PLACEMENT_NAME}" >&2
    return 0
  fi

  matches=$(printf '%s' "${ADDON_JSON}" | jq \
    --arg name "${PLACEMENT_NAME}" --arg namespace "${PLACEMENT_NAMESPACE}" \
    '[.spec.installStrategy.placements[]? |
      select(.name == $name and ($namespace == "" or .namespace == $namespace))] | length')
  [ "${matches}" -gt 0 ] || die "MCOA placement not found: ${PLACEMENT_NAMESPACE:+${PLACEMENT_NAMESPACE}/}${PLACEMENT_NAME}"
  [ "${matches}" -eq 1 ] || die "Placement name '${PLACEMENT_NAME}' is ambiguous; also pass --placement-namespace"
  if [ -z "${PLACEMENT_NAMESPACE}" ]; then
    PLACEMENT_NAMESPACE=$(printf '%s' "${ADDON_JSON}" | jq -r \
      --arg name "${PLACEMENT_NAME}" '.spec.installStrategy.placements[] | select(.name == $name) | .namespace')
  fi
}

selected_placement_indices() {
  printf '%s' "${ADDON_JSON}" | jq -r \
    --arg name "${PLACEMENT_NAME}" --arg namespace "${PLACEMENT_NAMESPACE}" \
    '.spec.installStrategy.placements | to_entries[] |
     select(.value.name == $name and .value.namespace == $namespace) | .key'
}

add_resource_ref() {
  local group=$1 resource=$2 name=$3
  local i configs exists
  while read -r i; do
    exists=$(printf '%s' "${ADDON_JSON}" | jq -r \
      --argjson index "${i}" --arg group "${group}" --arg resource "${resource}" --arg name "${name}" \
      --arg namespace "${OBSERVABILITY_NAMESPACE}" \
      '[.spec.installStrategy.placements[$index].configs[]? |
        select(.group == $group and .resource == $resource and .name == $name and .namespace == $namespace)] | length')
    [ "${exists}" -eq 0 ] || continue
    configs=$(printf '%s' "${ADDON_JSON}" | jq -r ".spec.installStrategy.placements[${i}].configs | type == \"array\"")
    if [ "${configs}" = true ]; then
      oc_hub patch clustermanagementaddon multicluster-observability-addon --type=json -p="[{
        \"op\": \"add\", \"path\": \"/spec/installStrategy/placements/${i}/configs/-\",
        \"value\": {\"group\": \"${group}\", \"resource\": \"${resource}\", \"name\": \"${name}\", \"namespace\": \"${OBSERVABILITY_NAMESPACE}\"}
      }]"
    else
      oc_hub patch clustermanagementaddon multicluster-observability-addon --type=json -p="[{
        \"op\": \"add\", \"path\": \"/spec/installStrategy/placements/${i}/configs\",
        \"value\": [{\"group\": \"${group}\", \"resource\": \"${resource}\", \"name\": \"${name}\", \"namespace\": \"${OBSERVABILITY_NAMESPACE}\"}]
      }]"
    fi
  done < <(selected_placement_indices)
  ADDON_JSON=$(oc_hub get clustermanagementaddon multicluster-observability-addon -o json)
}

remove_resource_ref() {
  local group=$1 resource=$2 name=$3
  local addon_json patch
  addon_json=$(oc_hub get clustermanagementaddon multicluster-observability-addon -o json 2>/dev/null) || return 0
  patch=$(printf '%s' "${addon_json}" | jq -c \
    --arg group "${group}" --arg resource "${resource}" --arg name "${name}" \
    --arg configNamespace "${OBSERVABILITY_NAMESPACE}" \
    --arg placement "${PLACEMENT_NAME}" --arg placementNamespace "${PLACEMENT_NAMESPACE}" '
      [(.spec.installStrategy.placements // []) | to_entries[] as $p |
       select($placement == "" or $p.value.name == $placement) |
       select($placementNamespace == "" or $p.value.namespace == $placementNamespace) |
       ($p.value.configs // []) | to_entries[] |
       select(.value.group == $group and .value.resource == $resource and
              .value.name == $name and .value.namespace == $configNamespace) |
       {configIndex:.key, placementIndex:$p.key,
        op:"remove", path:("/spec/installStrategy/placements/" + ($p.key|tostring) + "/configs/" + (.key|tostring))}]
      | sort_by(.placementIndex, .configIndex) | reverse
      | map(del(.configIndex, .placementIndex))')
  [ "${patch}" = "[]" ] || oc_hub patch clustermanagementaddon multicluster-observability-addon --type=json -p="${patch}"
}

resource_ref_count() {
  local group=$1 resource=$2 name=$3
  local addon_json
  addon_json=$(oc_hub get clustermanagementaddon multicluster-observability-addon -o json 2>/dev/null) || {
    echo 0
    return 0
  }
  printf '%s' "${addon_json}" | jq -r \
    --arg group "${group}" --arg resource "${resource}" --arg name "${name}" \
    --arg namespace "${OBSERVABILITY_NAMESPACE}" \
    '[(.spec.installStrategy.placements // [])[].configs[]? |
      select(.group == $group and .resource == $resource and
             .name == $name and .namespace == $namespace)] | length'
}

hub_has_crd() {
  oc_hub get crd "$1" >/dev/null 2>&1
}

enable_mcoa() {
  local started=${SECONDS}
  oc_hub patch mco observability --type=merge -p \
    '{"spec":{"capabilities":{"platform":{"metrics":{"default":{"enabled":true}}},"userWorkloads":{"metrics":{"default":{"enabled":true}}}}}}'

  until oc_hub get crd scrapeconfigs.monitoring.rhobs >/dev/null 2>&1 && \
    [ "$(oc_hub get clustermanagementaddon multicluster-observability-addon -o json 2>/dev/null | \
      jq '(.spec.installStrategy.placements // []) | length' 2>/dev/null || echo 0)" -gt 0 ]; do
    [ $((SECONDS - started)) -lt "${WAIT_TIMEOUT}" ] || \
      die "Timed out waiting for the ScrapeConfig CRD and a populated MCOA placement"
    echo "Waiting for the ScrapeConfig CRD and a populated MCOA placement..."
    sleep 10
  done
}

scrape_matches() {
  sed -n \
    -e '/container_cpu_usage_seconds_total/d' \
    -e '/container_memory_working_set_bytes/d' \
    -e 's/^- /        - /p' \
    "${RULES_DIR}/core-federation-match.yml"
  if [ "${WITH_DASHBOARDS}" = true ]; then
    sed -n 's/^- /        - /p' "${RULES_DIR}/istio-dashboard-federation-match.yml"
  fi
}

namespace_regex() {
  local namespace separator=""
  local -a namespaces
  IFS=',' read -ra namespaces <<< "${TARGET_NAMESPACES}"
  for namespace in "${namespaces[@]}"; do
    namespace="${namespace// /}"
    [ -n "${namespace}" ] || continue
    [[ "${namespace}" =~ ^[a-z0-9]([-a-z0-9]*[a-z0-9])?$ ]] || die "Invalid Kubernetes namespace: ${namespace}"
    printf '%s%s' "${separator}" "${namespace}"
    separator="|"
  done
}

install_scrape_config() {
  cat <<EOF | oc_hub apply -f -
apiVersion: monitoring.rhobs/v1alpha1
kind: ScrapeConfig
metadata:
  labels:
    app.kubernetes.io/component: user-workload-metrics-collector
    app.kubernetes.io/managed-by: kiali-mcoa-federation
  name: kiali-istio-federation
  namespace: ${OBSERVABILITY_NAMESPACE}
spec:
  honorLabels: true
  jobName: kiali-istio-federation
  metricRelabelings:
  - action: replace
    regex: 'workload:(.*)'
    replacement: '\${1}'
    sourceLabels: [__name__]
    targetLabel: __name__
  metricsPath: /federate
  params:
    match[]:
$(scrape_matches)
EOF
  add_resource_ref monitoring.rhobs scrapeconfigs kiali-istio-federation
}

platform_scrape_name_for_namespace() {
  printf 'kiali-istio-platform-federation-%s' "$1" | tr -c 'a-z0-9-' '-'
}

install_platform_scrape_config() {
  local namespace=$1 name
  [[ "${namespace}" =~ ^[a-z0-9]([-a-z0-9]*[a-z0-9])?$ ]] || die "Invalid Kubernetes namespace: ${namespace}"
  name=$(platform_scrape_name_for_namespace "${namespace}")
  cat <<EOF | oc_hub apply -f -
apiVersion: monitoring.rhobs/v1alpha1
kind: ScrapeConfig
metadata:
  labels:
    app.kubernetes.io/component: platform-metrics-collector
    app.kubernetes.io/managed-by: kiali-mcoa-federation
  name: ${name}
  namespace: ${OBSERVABILITY_NAMESPACE}
spec:
  jobName: ${name}
  metricsPath: /federate
  params:
    match[]:
    - '{__name__=~"container_cpu_usage_seconds_total|container_memory_working_set_bytes",namespace="${namespace}"}'
EOF
  add_resource_ref monitoring.rhobs scrapeconfigs "${name}"
}

rule_name_for_namespace() {
  printf 'kiali-istio-aggregation-%s' "$1" | tr -c 'a-z0-9-' '-'
}

target_namespace_list_contains() {
  local needle=$1 namespace
  local -a namespaces
  IFS=',' read -ra namespaces <<< "${TARGET_NAMESPACES}"
  for namespace in "${namespaces[@]}"; do
    namespace="${namespace// /}"
    [ "${namespace}" = "${needle}" ] && return 0
  done
  return 1
}

install_rule() {
  local namespace=$1 name
  [[ "${namespace}" =~ ^[a-z0-9]([-a-z0-9]*[a-z0-9])?$ ]] || die "Invalid Kubernetes namespace: ${namespace}"
  name=$(rule_name_for_namespace "${namespace}")
  {
    cat <<EOF
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  annotations:
    observability.open-cluster-management.io/target-namespace: ${namespace}
  labels:
    app.kubernetes.io/component: user-workload-metrics-collector
    app.kubernetes.io/managed-by: kiali-mcoa-federation
    openshift.io/prometheus-rule-evaluation-scope: leaf-prometheus
  name: ${name}
  namespace: ${OBSERVABILITY_NAMESPACE}
spec:
EOF
    sed 's/^/  /' "${RULES_DIR}/core-recording-rules.yml"
  } | oc_hub apply -f -
  add_resource_ref monitoring.coreos.com prometheusrules "${name}"
}

install_all() {
  command -v jq >/dev/null || die "jq is required"
  [ -f "${RULES_DIR}/core-recording-rules.yml" ] || die "Metric rule references not found in ${RULES_DIR}"
  [ -n "$(namespace_regex)" ] || die "--target-namespaces must contain at least one namespace"
  if [ -z "${RULE_NAMESPACE}" ]; then
    RULE_NAMESPACE="${TARGET_NAMESPACES%%,*}"
    RULE_NAMESPACE="${RULE_NAMESPACE// /}"
  fi
  [[ "${RULE_NAMESPACE}" =~ ^[a-z0-9]([-a-z0-9]*[a-z0-9])?$ ]] || die "Invalid rule namespace: ${RULE_NAMESPACE}"
  target_namespace_list_contains "${RULE_NAMESPACE}" || \
    die "--rule-namespace (${RULE_NAMESPACE}) must appear in --target-namespaces so the platform federation job for istiod CPU/memory is created"
  enable_mcoa
  load_and_select_placement
  install_scrape_config

  local namespace
  local -a namespaces
  IFS=',' read -ra namespaces <<< "${TARGET_NAMESPACES}"
  for namespace in "${namespaces[@]}"; do
    namespace="${namespace// /}"
    if [ -n "${namespace}" ]; then
      install_platform_scrape_config "${namespace}"
    fi
  done
  # OpenShift enforces user-workload rule tenancy by injecting the rule object's
  # target namespace into every selector and recorded series. Each namespace
  # therefore needs its own rule; the enforced matchers prevent duplicates.
  for namespace in "${namespaces[@]}"; do
    namespace="${namespace// /}"
    [ -n "${namespace}" ] || continue
    install_rule "${namespace}"
  done
}

verify_resource_ref() {
  local group=$1 resource=$2 name=$3 count
  count=$(printf '%s' "${ADDON_JSON}" | jq -r \
    --arg group "${group}" --arg resource "${resource}" --arg name "${name}" \
    --arg namespace "${OBSERVABILITY_NAMESPACE}" --arg placement "${PLACEMENT_NAME}" \
    --arg placementNamespace "${PLACEMENT_NAMESPACE}" \
    '[.spec.installStrategy.placements[] |
      select(.name == $placement and .namespace == $placementNamespace) |
      .configs[]? | select(.group == $group and .resource == $resource and
        .name == $name and .namespace == $namespace)] | length')
  [ "${count}" -eq 1 ] || {
    echo "[ERROR] Expected one ${group}/${resource}/${name} reference in ${PLACEMENT_NAMESPACE}/${PLACEMENT_NAME}; found ${count}" >&2
    return 1
  }
}

verify_all() {
  command -v jq >/dev/null || die "jq is required"
  local failed=0 namespace name rule_name rule_target capabilities
  [ -n "$(namespace_regex)" ] || die "--target-namespaces must contain at least one namespace"
  if [ -z "${RULE_NAMESPACE}" ]; then
    RULE_NAMESPACE="${TARGET_NAMESPACES%%,*}"
    RULE_NAMESPACE="${RULE_NAMESPACE// /}"
  fi
  target_namespace_list_contains "${RULE_NAMESPACE}" || \
    die "--rule-namespace (${RULE_NAMESPACE}) must appear in --target-namespaces"

  capabilities=$(oc_hub get mco observability -o json 2>/dev/null | jq -r \
    '[.spec.capabilities.platform.metrics.default.enabled,
      .spec.capabilities.userWorkloads.metrics.default.enabled] | @tsv' 2>/dev/null || true)
  if [ "${capabilities}" != $'true\ttrue' ]; then
    echo "[ERROR] MCOA platform and user-workload metrics capabilities are not both enabled" >&2
    failed=1
  fi
  if ! oc_hub get crd scrapeconfigs.monitoring.rhobs >/dev/null 2>&1; then
    echo "[ERROR] CRD scrapeconfigs.monitoring.rhobs is not installed" >&2
    failed=1
  fi
  load_and_select_placement

  if ! oc_hub get scrapeconfig kiali-istio-federation -n "${OBSERVABILITY_NAMESPACE}" >/dev/null 2>&1; then
    echo "[ERROR] ScrapeConfig/kiali-istio-federation is missing" >&2
    failed=1
  elif ! verify_resource_ref monitoring.rhobs scrapeconfigs kiali-istio-federation; then
    failed=1
  fi

  local -a namespaces
  IFS=',' read -ra namespaces <<< "${TARGET_NAMESPACES}"
  for namespace in "${namespaces[@]}"; do
    namespace="${namespace// /}"
    [ -n "${namespace}" ] || continue
    name=$(platform_scrape_name_for_namespace "${namespace}")
    if ! oc_hub get scrapeconfig "${name}" -n "${OBSERVABILITY_NAMESPACE}" >/dev/null 2>&1; then
      echo "[ERROR] ScrapeConfig/${name} is missing" >&2
      failed=1
    elif ! verify_resource_ref monitoring.rhobs scrapeconfigs "${name}"; then
      failed=1
    fi

    rule_name=$(rule_name_for_namespace "${namespace}")
    if ! oc_hub get prometheusrule "${rule_name}" -n "${OBSERVABILITY_NAMESPACE}" >/dev/null 2>&1; then
      echo "[ERROR] PrometheusRule/${rule_name} is missing" >&2
      failed=1
    else
      rule_target=$(oc_hub get prometheusrule "${rule_name}" -n "${OBSERVABILITY_NAMESPACE}" \
        -o jsonpath='{.metadata.annotations.observability\.open-cluster-management\.io/target-namespace}' 2>/dev/null || true)
      [ "${rule_target}" = "${namespace}" ] || {
        echo "[ERROR] PrometheusRule/${rule_name} targets '${rule_target}', expected '${namespace}'" >&2
        failed=1
      }
      verify_resource_ref monitoring.coreos.com prometheusrules "${rule_name}" || failed=1
    fi
  done

  [ "${failed}" -eq 0 ] || die "MCOA federation verification failed"
  echo "MCOA federation resources are configured for ${PLACEMENT_NAMESPACE}/${PLACEMENT_NAME}"
}

uninstall_all() {
  command -v jq >/dev/null || die "jq is required"
  if [ "$(oc_hub get clustermanagementaddon multicluster-observability-addon -o json 2>/dev/null | \
    jq '(.spec.installStrategy.placements // []) | length' 2>/dev/null || echo 0)" -gt 0 ]; then
    load_and_select_placement
  fi
  if [ -z "${RULE_NAMESPACE}" ]; then
    RULE_NAMESPACE="${TARGET_NAMESPACES%%,*}"
    RULE_NAMESPACE="${RULE_NAMESPACE// /}"
  fi
  local namespace name platform_name rule_name
  local -a namespaces
  IFS=',' read -ra namespaces <<< "${TARGET_NAMESPACES}"
  for namespace in "${namespaces[@]}"; do
    namespace="${namespace// /}"
    [ -n "${namespace}" ] || continue
    platform_name=$(platform_scrape_name_for_namespace "${namespace}")
    remove_resource_ref monitoring.rhobs scrapeconfigs "${platform_name}"
    if hub_has_crd scrapeconfigs.monitoring.rhobs && \
      [ "$(resource_ref_count monitoring.rhobs scrapeconfigs "${platform_name}")" -eq 0 ]; then
      oc_hub delete scrapeconfig "${platform_name}" -n "${OBSERVABILITY_NAMESPACE}" --ignore-not-found
    fi

    rule_name=$(rule_name_for_namespace "${namespace}")
    remove_resource_ref monitoring.coreos.com prometheusrules "${rule_name}"
    if hub_has_crd prometheusrules.monitoring.coreos.com && \
      [ "$(resource_ref_count monitoring.coreos.com prometheusrules "${rule_name}")" -eq 0 ]; then
      oc_hub delete prometheusrule "${rule_name}" -n "${OBSERVABILITY_NAMESPACE}" --ignore-not-found
    fi
  done

  # The user-workload ScrapeConfig is shared by every target namespace. Keep it
  # registered until the final Kiali-managed aggregation rule has been removed.
  if ! hub_has_crd prometheusrules.monitoring.coreos.com || \
    ! oc_hub get prometheusrule -n "${OBSERVABILITY_NAMESPACE}" \
      -l app.kubernetes.io/managed-by=kiali-mcoa-federation -o name 2>/dev/null | grep -q .; then
    remove_resource_ref monitoring.rhobs scrapeconfigs kiali-istio-federation
    if hub_has_crd scrapeconfigs.monitoring.rhobs && \
      [ "$(resource_ref_count monitoring.rhobs scrapeconfigs kiali-istio-federation)" -eq 0 ]; then
      oc_hub delete scrapeconfig kiali-istio-federation -n "${OBSERVABILITY_NAMESPACE}" --ignore-not-found
    fi
  fi
}

parse_args "$@"
case "${COMMAND}" in
  install) install_all ;;
  uninstall) uninstall_all ;;
  verify) verify_all ;;
esac
