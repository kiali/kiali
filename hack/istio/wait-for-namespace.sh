#!/bin/bash
##############################################################################
# wait-for-namespace.sh
# 
##############################################################################
set -e

if [ $# -eq 0 ]
  then
    >&2 echo "No arguments supplied"
    exit 1
fi

# process command line args
while [[ $# -gt 0 ]]; do
  key="$1"
  case $key in
    -n|--namespace)
      shift;
      NAMESPACES=( "$@" )
      break;
      ;;
    -h|--help)
      cat <<HELPMSG
Valid command line arguments:
  -n|--namespaces <name>: all of the namespaces we want to patch operator and wait for
  -h|--help : this message
HELPMSG
      exit 1
      ;;
    *)
      echo "Unknown argument [$key]. Aborting."
      exit 1
      ;;
  esac
done

for NAMESPACE in ${NAMESPACES[@]}; do
  oc patch kiali kiali -n kiali-operator --type=json '-p=[{"op": "add", "path": "/spec/deployment/accessible_namespaces/0", "value":"'$NAMESPACE'"}]'
done

oc wait --for=condition=Successful kiali/kiali --timeout=120s -n kiali-operator

for NAMESPACE in ${NAMESPACES[@]}; do
  oc wait --for=condition=Ready pods --all -n "$NAMESPACE" --timeout 60s || true
  oc wait --for=condition=Ready pods --all -n "$NAMESPACE" --timeout 60s
done

sleep 80
