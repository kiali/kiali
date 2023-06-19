#!/bin/bash
##############################################################################
# get-node-architecture.sh
#
# Checks which architecture of the worker nodes to choose the installation
# version of the specific demoapp. Returns 1 when multiple architecture types
# are detected.
#
# 
##############################################################################

set -e

arch=$(kubectl describe nodes --selector='node-role.kubernetes.io/worker' | grep "Architecture:" | awk -F ' ' '{print $2}' | uniq)
multiple=$(echo $arch | wc -l)

echo -n $arch

if [ $multiple -ne 1 ] 
then
  exit 1
fi

exit 0
