#!/bin/bash


# Determine where this script is and make it the cwd
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
cd "$SCRIPT_DIR"

# Default variables for the script
STOP="false"
LOGFILE=""

# Help
helpmsg() {
cat <<HELPMSG
This script controls stern loggin binary for istio (upstream) and service mesh (downstream) containers + demo apps .
    Valid command line arguments:
    -l|--logfile <filename.json>: Required logfile name (default: Cypress uses current .feature file name, i.e. 'apps.feature.json')
    -s|--stop <true|false>: If true, will stop any instances of the stern spawned by this script (default: false).
    -h|--help : this message
HELPMSG
}

# process command line args
while [[ $# -gt 0 ]]; do
  key="$1"
  case $key in
    -l|--logfile)
      LOGFILE="$2"
      shift;shift
      ;;
    -s|--stop)
      STOP="$2"
      shift;shift
      ;;
    -h|--help)
      helpmsg
      exit 1
      ;;
    *)
      echo "Unknown argument [$key]. Aborting."
      exit 1
      ;;
  esac
done

run_stern() {
  local resource="$1"
  local namespace="$2"
  bash -c "exec -a sternLogs \"$SCRIPT_DIR/stern\" $resource $namespace --tail 0 -o json --only-log-lines --max-log-requests 150 >> $LOGFILE 2>&1" &
}

if [[ "${STOP}" == "false" && "${LOGFILE}" != "" ]]; then
  echo '{"message":"---next scenario in the feature file---"}' >> $LOGFILE
  # core mesh containers
  run_stern "kiali" "-n istio-system"
  run_stern "kiali" "-n kiali-operator"
  run_stern "istiod" "-n istio-system"
  run_stern "istio-ingressgateway" "-n istio-system"

  # bookinfo application
  run_stern "details" "-n bookinfo"
  run_stern "kiali-traffic-generator" "-n bookinfo"
  run_stern "productpage" "-n bookinfo"
  run_stern "ratings" "-n bookinfo"
  run_stern "reviews" "-n bookinfo"

  # check if stern is running, otherwise return non zero exit code, so cypress will notice and 
  if ! pgrep -f "sternLogs" > /dev/null; then
    echo "stern is not running. Exiting with error."
    exit 1
  fi
elif [[ "${STOP}" == "true" ]]; then
    pkill -x stern
else
    helpmsg
fi




