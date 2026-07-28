#!/bin/bash

#
# This script is used to get debug info from the CI environment.
# It auto-discovers KinD clusters and collects per-context output in
# subdirectories. Use --kubectl-context to override and pin to a single context.
#

OUTPUT_DIRECTORY=""
KUBECTL_CONTEXT=""
T=25  # per-command timeout seconds

# Process command line args
while [[ $# -gt 0 ]]; do
  key="$1"
  case $key in
    -o|--output-directory)
      OUTPUT_DIRECTORY="${2}"
      shift; shift
      ;;
    -c|--kubectl-context)
      KUBECTL_CONTEXT="${2}"
      shift; shift
      ;;
    -h|--help)
      cat <<HELPMSG
Valid command line arguments:
  -o|--output-directory <directory_path>
    Specify the output directory where the files will be written.
    If not provided, a temporary directory will be created.
  -c|--kubectl-context <context_name>
    Pin collection to this single context (suppresses auto-enumeration).
    Useful for manual debugging. If not provided, all KinD clusters are
    discovered automatically and each gets its own subdirectory.
  -h|--help:
    Display this help message
HELPMSG
      exit 0
      ;;
    *)
      echo "ERROR: Unknown argument [$key]. Aborting."
      exit 1
      ;;
  esac
done

if [ -z "$OUTPUT_DIRECTORY" ]; then
  OUTPUT_DIRECTORY=$(mktemp -d)
  echo "INFO: Output directory not provided. Using temporary directory: $OUTPUT_DIRECTORY"
fi

collect_context() {
  local ctx="$1"
  local d="$2"
  local ctx_flag=""
  [ -n "$ctx" ] && ctx_flag="--context $ctx"
  mkdir -p "$d"

  # Most-diagnostic-first so Kiali logs survive even if later commands hang
  timeout $((T*2)) kubectl $ctx_flag logs -l app.kubernetes.io/name=kiali --tail=-1 --all-containers -n istio-system > "$d/kiali_logs.txt" 2>&1 || rm -f "$d/kiali_logs.txt"
  timeout $T kubectl $ctx_flag get pods -l app.kubernetes.io/name=kiali -n istio-system -o yaml > "$d/kiali_pods.yaml" 2>&1 || rm -f "$d/kiali_pods.yaml"
  timeout $T kubectl $ctx_flag get events -A --sort-by=.lastTimestamp > "$d/events.txt" 2>&1 || rm -f "$d/events.txt"
  timeout $T kubectl $ctx_flag describe nodes > "$d/describe_nodes.txt" 2>&1 || rm -f "$d/describe_nodes.txt"
  timeout $T kubectl $ctx_flag get pods -A -o wide > "$d/all_pods.txt" 2>&1 || rm -f "$d/all_pods.txt"
  timeout $T bash -c "kubectl $ctx_flag describe pods -A 2>/dev/null | grep -E '^Name:|^Namespace:|Restart Count:|OOMKilled|Reason:'" > "$d/pods_restarts.txt" 2>&1 || rm -f "$d/pods_restarts.txt"
  timeout $T kubectl $ctx_flag describe pods -n metallb-system > "$d/describe_metallb_pods.txt" 2>&1 || rm -f "$d/describe_metallb_pods.txt"
  timeout $T kubectl $ctx_flag logs deployments/controller -n metallb-system > "$d/metallb_controller_current_logs.txt" 2>&1 || rm -f "$d/metallb_controller_current_logs.txt"
  timeout $T kubectl $ctx_flag logs ds/speaker -n metallb-system > "$d/metallb_speaker_current_logs.txt" 2>&1 || rm -f "$d/metallb_speaker_current_logs.txt"
  timeout $T kubectl $ctx_flag logs -p deployments/controller -n metallb-system > "$d/metallb_controller_logs.txt" 2>&1 || rm -f "$d/metallb_controller_logs.txt"
  timeout $T kubectl $ctx_flag logs -p ds/speaker -n metallb-system > "$d/metallb_speaker_logs.txt" 2>&1 || rm -f "$d/metallb_speaker_logs.txt"
}

# Host-level stats (collected once, not per context)
timeout $T docker stats --no-stream > "${OUTPUT_DIRECTORY}/docker_stats.txt" 2>&1 || rm -f "${OUTPUT_DIRECTORY}/docker_stats.txt"
timeout $T df -m > "${OUTPUT_DIRECTORY}/df.txt" 2>&1 || rm -f "${OUTPUT_DIRECTORY}/df.txt"

if [ -n "${KUBECTL_CONTEXT}" ]; then
  collect_context "${KUBECTL_CONTEXT}" "${OUTPUT_DIRECTORY}/${KUBECTL_CONTEXT}"
else
  clusters=$(timeout $T kind get clusters 2>/dev/null | grep -E '^[a-z0-9][a-z0-9.-]*$')
  if [ -z "$clusters" ]; then
    collect_context "" "${OUTPUT_DIRECTORY}/current-context"
  else
    for c in $clusters; do
      collect_context "kind-${c}" "${OUTPUT_DIRECTORY}/kind-${c}"
    done
  fi
fi
