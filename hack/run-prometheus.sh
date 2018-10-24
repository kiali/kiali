#!/bin/bash

##############################################################################
# run-prometheus.sh
#
# Runs a local Prometheus in docker and scrapes the Kiali server.
# Kiali must have an exposed OpenShift route for this to work.
# You must have "docker" in your PATH as well as one of kubectl, oc, istiooc.
#
##############################################################################

# Make sure we have everything we need

if ! which docker > /dev/null ; then
  echo "You must have docker in your PATH"
  exit 1
fi

for exe in kubectl oc istiooc ; do
  if which $exe > /dev/null ; then
    CLIENT_EXE=`which $exe`
    break
  fi
done

if [ "$CLIENT_EXE" == "" ]; then
  echo "You must have one of these in your PATH: kubectl, oc, istiooc"
  exit 1
fi

# Find out where Kiali is - this will be the scrape endpoint that Prometheus will use

KIALI_ROUTE=$(${CLIENT_EXE} -n istio-system get route kiali -o jsonpath='{.spec.host}')
if [ "$?" == "0" ]; then
   echo "Kiali route endpoint is found here: $KIALI_ROUTE"
else
   echo "Kiali does not have a route - Prometheus will not be able to see it. Aborting."
   exit 1
fi

# Create a simple Prometheus configuration file to tell it how to scrape Kiali

cat <<EOF > /tmp/prometheus-kiali.yaml
global:
  scrape_interval: 10s
scrape_configs:
- job_name: 'kiali'
  scheme: 'https'
  tls_config:
    insecure_skip_verify: true
  static_configs:
  - targets: ['${KIALI_ROUTE}']
EOF

# Run Prometheus

docker run -p 9090:9090 -v /tmp/prometheus-kiali.yaml:/etc/prometheus/prometheus.yml prom/prometheus &
DOCKER_PID=$!
echo "Docker started (pid: ${DOCKER_PID})"

# Point the user's browser to Prometheus

xdg-open http://localhost:9090

# Keep this script in foreground - killing this script will shutdown Prometheus

wait ${DOCKER_PID}
