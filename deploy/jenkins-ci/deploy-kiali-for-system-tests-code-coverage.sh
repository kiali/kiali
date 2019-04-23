#!/bin/bash

bash <(curl -L https://git.io/getLatestKialiOperator)

echo -n "Waiting for Kiali to start"
for run in {1..60}
do
  oc get pods -l app=kiali -n istio-system 2>/dev/null | grep "^kiali.*Running" > /dev/null && _STARTED=true && break
  echo -n "."
  sleep 5
done
echo

if [ -z ${_STARTED} ]; then
  echo "ERROR: Kiali is not running yet. Please make sure it was deployed successfully."
  exit 1
else
  echo "Kiali is running - will now update for system tests/code coverage"
fi

oc patch deployment kiali -n istio-system --type=json -p='[{"op":"replace","path":"/spec/template/spec/containers/0/command", "value":["/opt/kiali/kiali", "-config", "/kiali-configuration/config.yaml", "-v", "4", "-systemTest", "-test.coverprofile", "/opt/kiali/console/coverage.cov"]}]'

oc delete pods -n istio-system --selector=app=kiali

echo "Kiali is running with system tests/code coverage enabled."
