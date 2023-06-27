#!/bin/bash
##############################################################################
# error-rates-status.sh
#
# Checks, if the Error Rates application is installed. This script is used by the
# Cypress Error Rates before hook (frontend/cypress/integration/common/hooks.ts).
# 
##############################################################################
set -e

apps=("a-client" 
      "b-client"
      "c-client"
      "d-client"
      "e-client"
      "f-client"
      "v-server"
      "w-server"
      "x-server"
      "y-server"
      "z-server")

kubectl wait pods -n alpha --for condition=Ready --timeout=60s --all
alpha_input=$(kubectl get pods -n alpha -o=custom-columns=NAME:.metadata.name,Status:.status.phase --no-headers=true)
kubectl wait pods -n beta --for condition=Ready --timeout=60s --all
beta_input=$(kubectl get pods -n beta -o=custom-columns=NAME:.metadata.name,Status:.status.phase --no-headers=true)

for pod in ${!apps[@]}; do
  count=$(echo "$alpha_input" | grep "${apps[$pod]}" | awk -F ' ' '{print $1}' | wc -l)
  status=$(echo "$alpha_input" | grep "${apps[$pod]}" | awk -F ' ' '{print $2}')
  if [ $count -ne 1 ] || [ $status != "Running" ]
  then
    echo "Invalid number of pods in a Running state detected in the alpha namespace."
    exit 1
  fi
done

for pod in ${!apps[@]}; do
  count=$(echo "$beta_input" | grep "${apps[$pod]}" | awk -F ' ' '{print $1}' | wc -l)
  status=$(echo "$beta_input" | grep "${apps[$pod]}" | awk -F ' ' '{print $2}')
  if [ $count -ne 1 ] || [ $status != "Running" ]
  then
    echo "Invalid number of pods in a Running state detected in the beta namespace."
    exit 1
  fi
done

echo "Error rates ready."
exit 0
