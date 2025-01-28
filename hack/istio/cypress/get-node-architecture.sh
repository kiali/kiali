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

# Selecting != control-plane to get worker node due to this: https://github.com/kubernetes-sigs/kind/issues/3846
arch=$(kubectl get nodes -l !node-role.kubernetes.io/control-plane -o jsonpath='{.items[0].metadata.labels.kubernetes\.io/arch}')
multiple=$(echo $arch | wc -l)

echo -n $arch

if [ $multiple -ne 1 ] 
then
  exit 1
fi

exit 0
