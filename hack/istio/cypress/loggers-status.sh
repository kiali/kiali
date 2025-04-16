#!/bin/bash
##############################################################################
# loggers-status.sh
#
# Checks, if the loggers application is installed. This script is used by the
# Cypress loggers before hook (frontend/cypress/integration/common/hooks.ts).
# 
##############################################################################
set -e

kubectl wait pods -n sleep --for condition=Ready --timeout=60s --all
input=$(kubectl get pods -n loggers -o=custom-columns=NAME:.metadata.name,Status:.status.phase --no-headers=true)

count=$(echo "$input" | grep sleep | awk -F ' ' '{print $1}' | wc -l)
status=$(echo "$input" | grep sleep | awk -F ' ' '{print $2}')
if [ $count -ne 1 ] || [ $status != "Running" ]
then
  echo "Invalid number of pods in a Running state detected."
  exit 1
fi

echo "loggers app ready."
exit 0
