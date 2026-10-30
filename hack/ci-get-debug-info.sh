#!/bin/bash

#
# This script is used to get debug info from the CI environment.
#

OUTPUT_DIRECTORY=""
KUBECTL_CONTEXT=""
INCLUDE_TRACING="false"

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
    --include-tracing)
      INCLUDE_TRACING="true"
      shift
      ;;
    -h|--help)
      cat <<HELPMSG
Valid command line arguments:
  -o|--output-directory <directory_path>
    Specify the output directory where the files will be written.
    If not provided, a temporary directory will be created.
  -c|--kubectl-context <context_name>
    Specify the kubectl context to use.
    If not provided, the current context is used.
  --include-tracing:
    Include Tempo, MinIO, and Tempo operator diagnostics.
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

# If OUTPUT_DIRECTORY is not provided, create a temporary directory
if [ -z "$OUTPUT_DIRECTORY" ]; then
  OUTPUT_DIRECTORY=$(mktemp -d)
  echo "INFO: Output directory not provided. Using temporary directory: $OUTPUT_DIRECTORY"
fi

context_flag=""
[ -n "${KUBECTL_CONTEXT}" ] && context_flag="--context ${KUBECTL_CONTEXT}"

# Get debug info and write to a separate file.
kubectl ${context_flag} logs -l app.kubernetes.io/name=kiali --tail=-1 --all-containers -n istio-system > "${OUTPUT_DIRECTORY}/kiali_logs.txt" || rm "${OUTPUT_DIRECTORY}/kiali_logs.txt"
kubectl ${context_flag} describe nodes > "${OUTPUT_DIRECTORY}/describe_nodes.txt" || rm "${OUTPUT_DIRECTORY}/describe_nodes.txt"
kubectl ${context_flag} get pods -l app.kubernetes.io/name=kiali -n istio-system -o yaml > "${OUTPUT_DIRECTORY}/kiali_pods.yaml" || rm "${OUTPUT_DIRECTORY}/kiali_pods.yaml"
kubectl ${context_flag} describe pods -n metallb-system > "${OUTPUT_DIRECTORY}/describe_metallb_pods.txt" || rm "${OUTPUT_DIRECTORY}/describe_metallb_pods.txt"
kubectl ${context_flag} logs -p deployments/controller -n metallb-system > "${OUTPUT_DIRECTORY}/metallb_controller_logs.txt" || rm "${OUTPUT_DIRECTORY}/metallb_controller_logs.txt"
kubectl ${context_flag} logs -p ds/speaker -n metallb-system > "${OUTPUT_DIRECTORY}/metallb_speaker_logs.txt" || rm "${OUTPUT_DIRECTORY}/metallb_speaker_logs.txt"
kubectl ${context_flag} logs deployments/controller -n metallb-system > "${OUTPUT_DIRECTORY}/metallb_controller_current_logs.txt" || rm "${OUTPUT_DIRECTORY}/metallb_controller_current_logs.txt"
kubectl ${context_flag} logs ds/speaker -n metallb-system > "${OUTPUT_DIRECTORY}/metallb_speaker_current_logs.txt" || rm "${OUTPUT_DIRECTORY}/metallb_speaker_current_logs.txt"

if [ "${INCLUDE_TRACING}" == "true" ]; then
  tracing_kubectl=(kubectl --request-timeout=15s)
  if [ -n "${KUBECTL_CONTEXT}" ]; then
    tracing_kubectl+=(--context "${KUBECTL_CONTEXT}")
  fi

  # Keep command errors as well as partial output: missing resources and failed
  # log requests help diagnose installations that never became ready.
  for namespace in tempo tempo-operator-system; do
    tracing_output="${OUTPUT_DIRECTORY}/tracing/${namespace}"
    mkdir -p "${tracing_output}" || continue
    if ! "${tracing_kubectl[@]}" get namespace "${namespace}" > "${tracing_output}/namespace.txt" 2>&1; then
      continue
    fi

    # Pod status includes image IDs, restart counts, and termination reasons.
    # Collect resources separately so a missing CRD does not hide other data.
    for resource in pods deployments statefulsets services endpointslices persistentvolumeclaims tempostacks configmaps; do
      "${tracing_kubectl[@]}" get "${resource}" -n "${namespace}" -o yaml > "${tracing_output}/${resource}.yaml" 2>&1 || true
    done
    "${tracing_kubectl[@]}" describe pods -n "${namespace}" > "${tracing_output}/describe_pods.txt" 2>&1 || true
    "${tracing_kubectl[@]}" get events -n "${namespace}" --sort-by=.metadata.creationTimestamp > "${tracing_output}/events.txt" 2>&1 || true

    # Include init containers and retrieve previous logs independently for every
    # container so one that has never restarted cannot hide a crashing sibling.
    "${tracing_kubectl[@]}" get pods -n "${namespace}" -o 'jsonpath={range .items[*]}{.metadata.name}{"\t"}{range .spec.initContainers[*]}{.name}{" "}{end}{range .spec.containers[*]}{.name}{" "}{end}{"\n"}{end}' > "${tracing_output}/containers.txt" 2> "${tracing_output}/containers_errors.txt" || true
    while IFS=$'\t' read -r pod containers; do
      for container in ${containers}; do
        for log_type in current previous; do
          log_flags=()
          if [ "${log_type}" == "previous" ]; then
            log_flags+=(--previous)
          fi
          "${tracing_kubectl[@]}" logs "${pod}" -n "${namespace}" -c "${container}" --timestamps --tail=2000 --limit-bytes=2097152 "${log_flags[@]}" > "${tracing_output}/${pod}_${container}_${log_type}.log" 2>&1 || true
        done
      done
    done < "${tracing_output}/containers.txt"
  done
fi
