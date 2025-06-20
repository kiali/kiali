#!/bin/bash
# this file will run stern on istio (upstream) or service mesh (downstream) containers + demo apps 


# Determine where this script is and make it the cwd
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
# source ${SCRIPT_DIR}/istio/functions.sh

# SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

bash -c "exec -a ./stern \"$SCRIPT_DIR/stern\" kiali -n istio-system --tail 1 >> log.log 2>&1" &
bash -c "exec -a ./stern \"$SCRIPT_DIR/stern\" bookinfo -n istio-system --tail 1 >> log.log 2>&1" &
bash -c "exec -a ./stern \"$SCRIPT_DIR/stern\" istio-ingressgateway -n istio-system --tail 1 >> log.log 2>&1" &
bash -c "exec -a ./stern \"$SCRIPT_DIR/stern\" istiod -n istio-system --tail 1 >> log.log 2>&1" &

echo "----------- end of the scenario ----------" >> log.log
