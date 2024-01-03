#!/bin/bash

#
# This script is used to get debug info from the CI environment.
#

OUTPUT_DIRECTORY=""
KUBECTL_CONTEXT=""

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
    Specify the kubectl context to use.
    If not provided, the current context is used.
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
