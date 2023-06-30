#!/bin/bash
##############################################################################
# bookinfo-status.sh
#
# Checks, if the Bookinfo application is installed. This script is used by the
# Cypress Bookinfo before hook (frontend/cypress/integration/common/hooks.ts).
# 
##############################################################################
set -e

apps=("details-v1"
      "kiali-traffic-generator"
      "productpage-v1"
      "ratings-v1"
      "reviews-v1"
      "reviews-v2"
      "reviews-v3")

kubectl wait pods -n bookinfo --for condition=Ready --timeout=60s --all
input=$(kubectl get pods -n bookinfo -o=custom-columns=NAME:.metadata.name,Status:.status.phase --no-headers=true)

for pod in ${!apps[@]}; do
  count=$(echo "$input" | grep "${apps[$pod]}" | awk -F ' ' '{print $1}' | wc -l)
  status=$(echo "$input" | grep "${apps[$pod]}" | awk -F ' ' '{print $2}')
  if [ $count -ne 1 ] || [ $status != "Running" ]
  then
    echo "Invalid number of pods in a Running state detected."
    exit 1
  fi
done

echo "Bookinfo app ready."
exit 0
