#!/bin/bash

set -euo pipefail

##############################################################################
# supplement-must-gather.sh
#
# Fills gaps in istio/ossm must-gather output so Kiali offline mode and
# @offline Cypress tests have workloads, Istio config, pod logs, and Envoy
# config dumps. Used from hack/run-integration-tests.sh (offline suite).
##############################################################################

infomsg() {
  echo "[INFO] ${1}"
}

helpmsg() {
  cat <<'HELP'
Supplement an Istio must-gather directory for Kiali offline testing.

Usage:
  supplement-must-gather.sh <command> [options]

Commands:
  resolve-namespaces-dir
    Print the namespaces/ root under a must-gather tree (stdout).

  supplement
    kubectl-dump namespaces missing from must-gather (per-object YAML, logs, dumps).

  assert-workloads
    Exit 1 if a namespace dir lacks Deployment + Service YAML offline can load.

Options (supplement, assert-workloads):
  --dir <path>          Must-gather output root (required)
  --force <true|false>  Always refresh from cluster (default: false)
  --namespace <name>    For assert-workloads only

Options (supplement only):
  trailing arguments are namespace names to supplement

Examples:
  supplement-must-gather.sh resolve-namespaces-dir --dir /tmp/mg
  supplement-must-gather.sh supplement --dir /tmp/mg --force true bookinfo loggers
  supplement-must-gather.sh assert-workloads --dir /tmp/mg --namespace bookinfo
HELP
}

resolve_must_gather_namespaces_dir() {
  local must_gather_dir="${1}"
  local istio_system_dir namespaces_dir

  istio_system_dir="$(find "${must_gather_dir}" -type d -path '*/namespaces/istio-system' 2>/dev/null | head -n 1)"
  if [ -n "${istio_system_dir}" ]; then
    dirname "${istio_system_dir}"
    return 0
  fi

  namespaces_dir="$(find "${must_gather_dir}" -type d -name namespaces 2>/dev/null | head -n 1)"
  if [ -n "${namespaces_dir}" ]; then
    echo "${namespaces_dir}"
    return 0
  fi

  echo "${must_gather_dir}/namespaces"
}

# Returns 0 when the namespace dir already has K8s workloads and services Kiali needs offline.
# Only root-level kind: counts (single-object YAML). Indented kind inside a kubectl List does
# not — the offline client cannot load generic v1 Lists from "kubectl get -o yaml".
must_gather_namespace_usable_for_offline() {
  local ns_dir="${1}"
  local yaml_file has_workload=false has_service=false

  if [ ! -d "${ns_dir}" ]; then
    return 1
  fi

  while IFS= read -r -d '' yaml_file; do
    if grep -qE '^kind: (Deployment|ReplicaSet|StatefulSet|DaemonSet)$' "${yaml_file}" 2>/dev/null; then
      has_workload=true
    fi
    if grep -qE '^kind: Service$' "${yaml_file}" 2>/dev/null; then
      has_service=true
    fi
    if [ "${has_workload}" = true ] && [ "${has_service}" = true ]; then
      return 0
    fi
  done < <(find "${ns_dir}" -type f \( -name '*.yaml' -o -name '*.yml' \) -print0 2>/dev/null)

  return 1
}

assert_must_gather_namespace_has_workloads() {
  local ns_dir="${1}"
  local ns="${2}"

  if must_gather_namespace_usable_for_offline "${ns_dir}"; then
    return 0
  fi

  echo "ERROR: Namespace ${ns} is missing Deployment and Service data under ${ns_dir} after must-gather supplement." >&2
  echo "Deployments visible in cluster:" >&2
  kubectl get deployments -n "${ns}" 2>&1 | head -20 || true
  echo "Files under ${ns_dir}:" >&2
  find "${ns_dir}" -type f 2>/dev/null | head -30 || true
  return 1
}

supplement_must_gather_pod_runtime_data() {
  local ns="${1}"
  local ns_dir="${2}"
  local pod pod_dir cname containers_json

  if [ ! -d "${ns_dir}/pods" ]; then
    return 0
  fi

  while IFS= read -r pod; do
    [ -z "${pod}" ] && continue
    pod_dir="${ns_dir}/pods/${pod}"
    mkdir -p "${pod_dir}"

    while IFS= read -r cname; do
      [ -z "${cname}" ] && continue
      mkdir -p "${pod_dir}/${cname}/${cname}/logs"
      # --timestamps matches the k8s API Timestamps=true format Kiali's parseLogLine expects
      # (RFC3339Nano prefix). Plain kubectl logs are skipped as unparseable.
      kubectl logs -n "${ns}" "${pod}" -c "${cname}" --timestamps --tail=5000 \
        > "${pod_dir}/${cname}/${cname}/logs/current.log" 2>/dev/null \
        || : > "${pod_dir}/${cname}/${cname}/logs/current.log"
    done < <(kubectl get pod "${pod}" -n "${ns}" -o jsonpath='{range .spec.containers[*]}{.name}{"\n"}{end}' 2>/dev/null || true)

    containers_json="$(kubectl get pod "${pod}" -n "${ns}" -o jsonpath='{.spec.containers[*].name}' 2>/dev/null || true)"
    if printf '%s\n' ${containers_json} | grep -qx 'istio-proxy'; then
      if kubectl exec -n "${ns}" "${pod}" -c istio-proxy -- \
          pilot-agent request GET /config_dump \
          > "${pod_dir}/config_dump_proxy.json" 2>/dev/null; then
        if ! grep -q '{' "${pod_dir}/config_dump_proxy.json" 2>/dev/null; then
          rm -f "${pod_dir}/config_dump_proxy.json"
        fi
      else
        rm -f "${pod_dir}/config_dump_proxy.json"
      fi
    fi
  done < <(kubectl get pods -n "${ns}" -o jsonpath='{range .items[*]}{.metadata.name}{"\n"}{end}' 2>/dev/null || true)
}

# Sail/OSSM must-gather discovers mesh member namespaces; classic istioctl installs often only
# gather the control plane. Offline cypress needs bookinfo (and peers) in the dump either way.
supplement_must_gather_namespace() {
  local must_gather_dir="${1}"
  local ns="${2}"
  local force="${3:-false}"
  local ns_dir namespaces_dir

  if ! kubectl get namespace "${ns}" &>/dev/null; then
    infomsg "Skipping must-gather supplement for missing namespace: ${ns}"
    return 0
  fi

  namespaces_dir="$(resolve_must_gather_namespaces_dir "${must_gather_dir}")"
  ns_dir="${namespaces_dir}/${ns}"

  if [ "${force}" != "true" ] && must_gather_namespace_usable_for_offline "${ns_dir}"; then
    infomsg "must-gather already includes workloads and services for namespace ${ns}"
    return 0
  fi

  infomsg "Supplementing must-gather with namespace ${ns} (namespaces_dir=${namespaces_dir}, force=${force})"
  if ! mkdir -p "${ns_dir}"; then
    echo "ERROR: Cannot create ${ns_dir} (must-gather files may be owned by root)." >&2
    echo "Fix with: sudo chown -R \$(id -u):\$(id -g) \"$(dirname "${namespaces_dir}")\"" >&2
    return 1
  fi
  kubectl get namespace "${ns}" -o yaml > "${ns_dir}/namespace.yaml"
  # Dump each object as its own YAML (not a kubectl List). The offline client can
  # parse single-object files / --- streams, but not generic v1 List dumps.
  # Use fully-qualified resource names: short "gateways" resolves to
  # gateway.networking.k8s.io when both Gateway API and Istio CRDs are installed,
  # which drops networking.istio.io Gateways such as bookinfo-gateway.
  local res dirname name out_dir entry
  for entry in \
      "services:services" \
      "pods:pods" \
      "deployments:deployments" \
      "replicasets:replicasets" \
      "daemonsets:daemonsets" \
      "statefulsets:statefulsets" \
      "configmaps:configmaps" \
      "serviceaccounts:serviceaccounts" \
      "destinationrules.networking.istio.io:destinationrules" \
      "virtualservices.networking.istio.io:virtualservices" \
      "gateways.networking.istio.io:gateways" \
      "sidecars.networking.istio.io:sidecars" \
      "peerauthentications.security.istio.io:peerauthentications" \
      "authorizationpolicies.security.istio.io:authorizationpolicies" \
      "requestauthentications.security.istio.io:requestauthentications" \
      "serviceentries.networking.istio.io:serviceentries" \
      "workloadentries.networking.istio.io:workloadentries" \
      "telemetries.telemetry.istio.io:telemetries" \
      "httproutes.gateway.networking.k8s.io:httproutes" \
      "grpcroutes.gateway.networking.k8s.io:grpcroutes" \
      "gateways.gateway.networking.k8s.io:k8sgateways"; do
    res="${entry%%:*}"
    dirname="${entry##*:}"
    rm -f "${ns_dir}/${dirname}.yaml"
    out_dir="${ns_dir}/${dirname}"
    rm -rf "${out_dir}"
    mkdir -p "${out_dir}"
    while IFS= read -r name; do
      [ -z "${name}" ] && continue
      if [ "${dirname}" = "pods" ]; then
        mkdir -p "${out_dir}/${name}"
        kubectl get "${res}" "${name}" -n "${ns}" -o yaml > "${out_dir}/${name}/${name}.yaml" 2>/dev/null || true
      else
        kubectl get "${res}" "${name}" -n "${ns}" -o yaml > "${out_dir}/${name}.yaml" 2>/dev/null || true
      fi
    done < <(kubectl get "${res}" -n "${ns}" -o jsonpath='{range .items[*]}{.metadata.name}{"\n"}{end}' 2>/dev/null || true)
    if [ -z "$(find "${out_dir}" -type f -name '*.yaml' 2>/dev/null | head -n 1)" ]; then
      rm -rf "${out_dir}"
    fi
  done

  supplement_must_gather_pod_runtime_data "${ns}" "${ns_dir}"
}

COMMAND="${1:-}"
shift || true

MUST_GATHER_DIR=""
FORCE="false"
ASSERT_NS=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dir)
      MUST_GATHER_DIR="$2"
      shift 2
      ;;
    --force)
      FORCE="$2"
      shift 2
      ;;
    --namespace)
      ASSERT_NS="$2"
      shift 2
      ;;
    -h|--help)
      helpmsg
      exit 0
      ;;
    --*)
      echo "ERROR: Unknown option: $1" >&2
      exit 1
      ;;
    *)
      break
      ;;
  esac
done

case "${COMMAND}" in
  resolve-namespaces-dir)
    if [ -z "${MUST_GATHER_DIR}" ]; then
      echo "ERROR: --dir is required" >&2
      exit 1
    fi
    if [ $# -ne 0 ]; then
      echo "ERROR: unexpected arguments: $*" >&2
      exit 1
    fi
    resolve_must_gather_namespaces_dir "${MUST_GATHER_DIR}"
    ;;
  supplement)
    if [ -z "${MUST_GATHER_DIR}" ]; then
      echo "ERROR: --dir is required" >&2
      exit 1
    fi
    if [ $# -eq 0 ]; then
      echo "ERROR: at least one namespace name is required" >&2
      exit 1
    fi
    for ns in "$@"; do
      supplement_must_gather_namespace "${MUST_GATHER_DIR}" "${ns}" "${FORCE}"
    done
    ;;
  assert-workloads)
    if [ -z "${MUST_GATHER_DIR}" ] || [ -z "${ASSERT_NS}" ]; then
      echo "ERROR: --dir and --namespace are required" >&2
      exit 1
    fi
    if [ $# -ne 0 ]; then
      echo "ERROR: unexpected arguments: $*" >&2
      exit 1
    fi
    namespaces_dir="$(resolve_must_gather_namespaces_dir "${MUST_GATHER_DIR}")"
    assert_must_gather_namespace_has_workloads "${namespaces_dir}/${ASSERT_NS}" "${ASSERT_NS}"
    ;;
  ""|-h|--help|help)
    helpmsg
    ;;
  *)
    echo "ERROR: Unknown command: ${COMMAND}" >&2
    helpmsg >&2
    exit 1
    ;;
esac