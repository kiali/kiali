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

helpmsg() {
  cat <<HELP
Valid command line arguments:
   -ce|--client-exe <path to kubectl> The 'kubectl' or 'oc' command, if not in PATH then must be a full path. Default: oc
   -n|--namespaces <name>: all of the namespaces we want to patch operator and wait for
   -h|--help : this message
HELP
}

while [[ $# -gt 0 ]]; do
  key="$1"
  case $key in
    -ce|--client-exe)             CLIENT_EXE="$2";            shift;shift; ;;
    -n|--namespace)               NAMESPACES="$2";            shift;shift; ;;
    -h|--help)                    helpmsg;                    exit 1       ;;
    *) echo "Unknown argument: [$key]. Aborting."; helpmsg; exit 1 ;;
  esac
done

# set up some of our defaults
CLIENT_EXE=${CLIENT_EXE:-kubectl}
CLIENT_EXE="$(which ${CLIENT_EXE} 2>/dev/null || echo "invalid kubectl: ${CLIENT_EXE}")"
echo "Using CLIENT_EXE: $CLIENT_EXE"

for NAMESPACE in ${NAMESPACES[@]}; do
  ${CLIENT_EXE} patch kiali kiali -n kiali-operator --type=json '-p=[{"op": "add", "path": "/spec/deployment/accessible_namespaces/0", "value":"'$NAMESPACE'"}]'
done

${CLIENT_EXE} wait --for=condition=Successful kiali/kiali --timeout=120s -n kiali-operator

for NAMESPACE in ${NAMESPACES[@]}; do
  ${CLIENT_EXE} wait --for=condition=Ready pods --all -n "$NAMESPACE" --timeout 60s || true
  ${CLIENT_EXE} wait --for=condition=Ready pods --all -n "$NAMESPACE" --timeout 60s
done

sleep 80
