#!/bin/bash

##############################################################################
# run-prometheus.sh
#
# Runs a local Prometheus and scrapes the Kiali server and operator.
# This lets you examine Kiali's own metric data in your dev environment.
# There must be exposed OpenShift routes for this to work. If you do not,
# this script will output the commands you need to perform.
#
# You must have docker or podman in your PATH as well as one of kubectl, oc.
#
##############################################################################

OPERATOR_NAMESPACE="${OPERATOR_NAMESPACE:-kiali-operator}"
KIALI_NAMESPACE="${KIALI_NAMESPACE:-istio-system}"

# Make sure we have everything we need

if [ -z "${DORP}" ]; then
  if ! which podman > /dev/null 2>&1; then
    if which docker > /dev/null 2>&1; then
      DORP="docker"
    else
      echo "You do not have 'docker' or 'podman' in PATH - aborting."
      exit 1
    fi
  else
    DORP="podman"
  fi
fi

for exe in oc kubectl ; do
  if which $exe > /dev/null ; then
    CLIENT_EXE=`which $exe`
    break
  fi
done

if [ "$CLIENT_EXE" == "" ]; then
  echo "You must have one of these in your PATH: kubectl, oc"
  exit 1
fi

# Find out where the metric routes are - this will be the scrape endpoints that Prometheus will use
# Here we assume all metric endpoints are not behind https - we assume "http" only.

KIALI_ROUTE=$(${CLIENT_EXE} get route kiali-metrics -n ${KIALI_NAMESPACE} -o jsonpath='{.spec.host}')
if [ "$?" == "0" ]; then
  echo "Kiali metrics route endpoint is found here: http://${KIALI_ROUTE}/metrics"
else
  _CMD1="$CLIENT_EXE expose service kiali -n ${KIALI_NAMESPACE} --name=kiali-metrics --port=http-metrics"
  _ABORT="true"
fi

KIALI_OPERATOR_ROUTE=$(${CLIENT_EXE} get route kiali-operator-metrics -n ${OPERATOR_NAMESPACE} -o jsonpath='{.spec.host}')
if [ "$?" == "0" ]; then
  echo "Kiali operator metrics route endpoint is found here: http://${KIALI_OPERATOR_ROUTE}/metrics"
else
  _CMD2="$CLIENT_EXE expose \$($CLIENT_EXE get pod -n ${OPERATOR_NAMESPACE} -l app=kiali-operator -o name) -n ${OPERATOR_NAMESPACE} --name=kiali-operator-metrics --target-port=http-metrics"
  _CMD2="${_CMD2} ; $CLIENT_EXE expose service kiali-operator-metrics -n ${OPERATOR_NAMESPACE} --name=kiali-operator-metrics --port=http-metrics"
  _CMD2="${_CMD2} ; $CLIENT_EXE patch service kiali-operator-metrics -n ${OPERATOR_NAMESPACE} -p '{\"spec\":{\"ports\":[{\"port\":8080,\"name\":\"http-metrics\"}]}}'"
  _ABORT="true"
fi

if [ ! -z "${_ABORT}" ]; then
  echo "You are missing some routes to the Kiali metric endpoints."
  echo "These are needed for the local Prometheus to be able to collect Kiali metrics."
  echo "Create the routes using these commands and re-run this script."
  echo "====="
  if [ ! -z "$_CMD1" ]; then echo ${_CMD1}; fi
  if [ ! -z "$_CMD2" ]; then echo ${_CMD2}; fi
  echo "====="
  exit 1
fi

# Create a simple Prometheus configuration file to tell it how to scrape Kiali server and operator

cat <<EOF > /tmp/prometheus-kiali.yaml
global:
  scrape_interval: 10s
scrape_configs:
- job_name: 'kiali'
  scheme: 'http'
  tls_config:
    insecure_skip_verify: true
  static_configs:
  - targets: ['${KIALI_ROUTE}', '${KIALI_OPERATOR_ROUTE}']
EOF

# Run Prometheus

KIALI_HOST_ENT="${KIALI_ROUTE}:$(getent hosts ${KIALI_ROUTE} | head -n1 | awk '{print $1}')"
KIALI_OPERATOR_HOST_ENT="${KIALI_OPERATOR_ROUTE}:$(getent hosts ${KIALI_OPERATOR_ROUTE} | head -n1 | awk '{print $1}')"

${DORP} run -p 9090:9090 --add-host="${KIALI_HOST_ENT}" --add-host="${KIALI_OPERATOR_HOST_ENT}" -v /tmp/prometheus-kiali.yaml:/etc/prometheus/prometheus.yml quay.io/prometheus/prometheus &
DOCKER_PID=$!

echo "Prometheus started in a container (pid: ${DOCKER_PID})"

# Point the user's browser to Prometheus

gio open http://localhost:9090

# Keep this script in foreground - killing this script will shutdown Prometheus

wait ${DOCKER_PID}
