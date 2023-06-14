#!/bin/bash
##############################################################################
# bookinfo-status.sh
#
# Checks, if the Bookinfo application is installed. This script is used by the
# Cypress Bookinfo before hook (frontend/cypress/integration/common/hooks.ts).
# 
##############################################################################
set -e

input=$(kubectl get pods -n bookinfo -o=custom-columns=NAME:.metadata.name,Status:.status.phase --no-headers=true)

pods=("$(echo "$input" | grep details-v1 | awk -F ' ' '{print $1}' | wc -l )"
      "$(echo "$input" | grep productpage-v1 | awk -F ' ' '{print $1}' | wc -l )" 
      "$(echo "$input" | grep ratings-v1 | awk -F ' ' '{print $1}' | wc -l)"
      "$(echo "$input" | grep reviews-v1 | awk -F ' ' '{print $1}' | wc -l)"
      "$(echo "$input" | grep reviews-v2 | awk -F ' ' '{print $1}' | wc -l)"
      "$(echo "$input" | grep reviews-v3 | awk -F ' ' '{print $1}' | wc -l)"
      "$(echo "$input" | grep kiali-traffic-generator | awk -F ' ' '{print $1}' | wc -l)")

status=("$(echo "$input" | grep details-v1 | awk -F ' ' '{print $2}')"
      "$(echo "$input" | grep productpage-v1 | awk -F ' ' '{print $2}')" 
      "$(echo "$input" | grep ratings-v1 | awk -F ' ' '{print $2}')"
      "$(echo "$input" | grep reviews-v1 | awk -F ' ' '{print $2}')"
      "$(echo "$input" | grep reviews-v2 | awk -F ' ' '{print $2}')"
      "$(echo "$input" | grep reviews-v3 | awk -F ' ' '{print $2}')"
      "$(echo "$input" | grep kiali-traffic-generator | awk -F ' ' '{print $2}')")

for pod in ${!pods[@]}; do
  if [ ${pods[$pod]} -ne 1 ] || [ "${status[$pod]}" = "Running\n" ]
  then
    echo "Invalid number of pods in a Running state detected."
    exit 1
  fi
done

echo "Bookinfo app ready."
exit 0
