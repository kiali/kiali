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

KIALI_CR_NAMESPACE_NAME="$(${CLIENT_EXE} get kiali --all-namespaces -o jsonpath='{.items[*].metadata.namespace}')"
KIALI_CR_NAMESPACE="$(echo ${KIALI_CR_NAMESPACE_NAME} | cut -d: -f1)"
KIALI_CR_NAME="$(echo ${KIALI_CR_NAMESPACE_NAME} | cut -d: -f2)"
ACCESSIBLE_NAMESPACES="$(${CLIENT_EXE} get kiali $KIALI_CR_NAME -n $KIALI_CR_NAMESPACE -o jsonpath='{.spec.deployment.accessible_namespaces}')"

# All namespaces are accessible, no need to add namespaces access to Kiali CR
if [ "${ACCESSIBLE_NAMESPACES}" != "**" ]; then
  # accessible_namespaces field is not defined in the Kiali CR, initializing value to empty array
  if [ "${ACCESSIBLE_NAMESPACES}" == "" ]; then
    ${CLIENT_EXE} patch kiali $KIALI_CR_NAME -n $KIALI_CR_NAMESPACE --type=merge -p '{"spec": {"deployment": {"accessible_namespaces": []}}}'
  fi

  for NAMESPACE in ${NAMESPACES[@]}; do
    ${CLIENT_EXE} patch kiali $KIALI_CR_NAME -n $KIALI_CR_NAMESPACE --type=json '-p=[{"op": "add", "path": "/spec/deployment/accessible_namespaces/-", "value":"'$NAMESPACE'"}]'
  done

  echo -n "Waiting for operator to finish reconciling the CR named [$KIALI_CR_NAME] located in namespace [$KIALI_CR_NAMESPACE]"
  while [ "$KIALI_CR_REASON" != "Successful" -o "$KIALI_CR_STATUS" != "True" ]; do
    sleep 1
    echo -n "."
    KIALI_CR_REASON="$(oc get kiali $KIALI_CR_NAME -n $KIALI_CR_NAMESPACE -o jsonpath='{.status.conditions[?(@.message=="Awaiting next reconciliation")].reason}')"
    KIALI_CR_STATUS="$(oc get kiali $KIALI_CR_NAME -n $KIALI_CR_NAMESPACE -o jsonpath='{.status.conditions[?(@.message=="Awaiting next reconciliation")].status}')"
  done
  echo
  echo "Done reconciling"
fi

for NAMESPACE in ${NAMESPACES[@]}; do
  ${CLIENT_EXE} wait --for=condition=Ready pods --all -n "$NAMESPACE" --timeout 60s || true
done

sleep 80
