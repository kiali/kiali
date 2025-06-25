#!/bin/bash

set -ue

CLIENT_EXE="oc"
DRY_RUN="false"

# process command line args
while [[ $# -gt 0 ]]; do
  key="$1"
  case $key in
    -c|--client-exe)
      CLIENT_EXE="$2"
      shift;shift
      ;;
    -d|--dry-run)
      DRY_RUN="${2}"
      if [ "${DRY_RUN}" != "true" -a "${DRY_RUN}" != "false" ]; then
        echo "--dry-run option must be 'true' or 'false'"
        exit 1
      fi
      shift;shift
      ;;
    -h|--help)
      cat <<HELPMSG
Valid command line arguments:
  -c|--client-exe <name>:
       Cluster client executable name - valid values are "kubectl" or "oc".
       Default: oc
  -d|--dry-run <true|false>:
       If true, resources are not purged. Use this to see what Kiali resources are in your cluster.
       Default: false
  -h|--help:
       this message
HELPMSG
      exit 1
      ;;
    *)
      echo "ERROR: Unknown argument [$key]. Aborting."
      exit 1
      ;;
  esac
done

CLIENT_EXE=`which "${CLIENT_EXE}"`
if [ "$?" = "0" ]; then
  echo "The cluster client executable is found here: ${CLIENT_EXE}"
else
  echo "ERROR: You must install the cluster client ${CLIENT_EXE} in your PATH before you can continue."
  exit 1
fi

if [[ "$CLIENT_EXE" = *"oc" ]]; then
  if ! ${CLIENT_EXE} whoami &> /dev/null; then
    echo "ERROR: Using 'oc' but you are not logged in. Log in or pass in '-c kubectl' if using a non-OpenShift cluster."
    exit 1
  fi
fi

msg() {
  if [ "${DRY_RUN}" == "false" ]; then echo "$1"; else echo "DRY RUN: $1"; fi
}

msg "Deleting any and all Kiali and OSSMC resources that are found in the cluster..."

delete_namespace_resources() {
  local selector_expression="$1"
  msg "Deleting namespace-scoped resources with selector [${selector_expression}]..."
  for r in $(${CLIENT_EXE} get --ignore-not-found=true all,secrets,sa,configmaps,deployments,roles,rolebindings,ingresses,horizontalpodautoscalers,networkpolicies --selector="${selector_expression}" --all-namespaces -o custom-columns=NS:.metadata.namespace,K:.kind,N:.metadata.name --no-headers | sed 's/  */:/g')
  do
    local res_namespace=$(echo $r | cut -d: -f1)
    local res_kind=$(echo $r | cut -d: -f2)
    local res_name=$(echo $r | cut -d: -f3)
    msg "Namespaced resource [${res_name}] of kind [${res_kind}]"
    if [ "${DRY_RUN}" == "false" ]; then
      ${CLIENT_EXE} delete --ignore-not-found=true ${res_kind} ${res_name} -n ${res_namespace}
    fi
  done
}

delete_cluster_resources() {
  local selector_expression="$1"
  msg "Deleting cluster-scoped resources with selector [${selector_expression}]..."

  local openshift_resources=""
  if [[ "$CLIENT_EXE" = *"oc" ]]; then
    openshift_resources=",oauthclients.oauth.openshift.io,consolelinks.console.openshift.io,consoleplugins.console.openshift.io"
  fi

  for r in $(${CLIENT_EXE} get --ignore-not-found=true clusterroles,clusterrolebindings,customresourcedefinitions${openshift_resources} --selector="${selector_expression}" --all-namespaces -o custom-columns=K:.kind,N:.metadata.name --no-headers | sed 's/  */:/g')
  do
    local res_kind=$(echo $r | cut -d: -f1)
    local res_name=$(echo $r | cut -d: -f2)
    msg "Cluster resource [${res_name}] of kind [${res_kind}]"
    if [ "${DRY_RUN}" == "false" ]; then
      ${CLIENT_EXE} delete --ignore-not-found=true ${res_kind} ${res_name}
    fi
  done
}

msg "Deleting Kiali CRs..."
for k in $(${CLIENT_EXE} get kiali --ignore-not-found=true --all-namespaces -o custom-columns=NS:.metadata.namespace,N:.metadata.name --no-headers | sed 's/  */:/g')
do
  cr_namespace=$(echo $k | cut -d: -f1)
  cr_name=$(echo $k | cut -d: -f2)
  msg "Deleting Kiali CR [${cr_name}] in namespace [${cr_namespace}]"
  if [ "${DRY_RUN}" == "false" ]; then
    ${CLIENT_EXE} patch  kiali ${cr_name} -n ${cr_namespace} -p '{"metadata":{"finalizers": []}}' --type=merge
    ${CLIENT_EXE} delete kiali ${cr_name} -n ${cr_namespace}
  fi
done

msg "Deleting OSSMConsole CRs..."
for o in $(${CLIENT_EXE} get ossmconsole --ignore-not-found=true --all-namespaces -o custom-columns=NS:.metadata.namespace,N:.metadata.name --no-headers | sed 's/  */:/g')
do
  cr_namespace=$(echo $o | cut -d: -f1)
  cr_name=$(echo $o | cut -d: -f2)
  msg "Deleting OSSMConsole CR [${cr_name}] in namespace [${cr_namespace}]"
  if [ "${DRY_RUN}" == "false" ]; then
    ${CLIENT_EXE} patch ossmconsole ${cr_name} -n ${cr_namespace} -p '{"metadata":{"finalizers": []}}' --type=merge
    ${CLIENT_EXE} delete ossmconsole ${cr_name} -n ${cr_namespace}
  fi
done

# purge using the k8s labels
delete_namespace_resources "app.kubernetes.io/name=kiali"
delete_cluster_resources "app.kubernetes.io/name=kiali"
delete_namespace_resources "app.kubernetes.io/name=kiali-operator"
delete_cluster_resources "app.kubernetes.io/name=kiali-operator"
delete_namespace_resources "app.kubernetes.io/name=ossmconsole"
delete_cluster_resources "app.kubernetes.io/name=ossmconsole"

msg "Deleting Kiali and OSSMC CRDs..."
for c in $(${CLIENT_EXE} get crds --ignore-not-found=true kialis.kiali.io ossmconsoles.kiali.io -o custom-columns=N:.metadata.name --no-headers)
do
  msg "Deleting CRD [${c}]"
  if [ "${DRY_RUN}" == "false" ]; then
    ${CLIENT_EXE} delete --ignore-not-found=true crd ${c}
  fi
done

if [ "${DRY_RUN}" == "false" ]; then
  msg "Waiting for CRDs to be completely removed..."
  timeout=60
  elapsed=0
  while [ ${elapsed} -lt ${timeout} ]; do
    remaining_crds=$(${CLIENT_EXE} get crds --ignore-not-found=true kialis.kiali.io ossmconsoles.kiali.io -o custom-columns=N:.metadata.name --no-headers 2>/dev/null | wc -l)
    if [ "${remaining_crds}" -eq 0 ]; then
      msg "All Kiali and OSSMC CRDs have been removed."
      break
    fi
    msg "Still waiting for ${remaining_crds} CRD(s) to be removed... (${elapsed}s elapsed)"
    sleep 2
    elapsed=$((elapsed + 2))
  done

  if [ ${elapsed} -ge ${timeout} ]; then
    msg "WARNING: Timeout waiting for CRDs to be removed. Some CRDs may still be in deletion state."
    ${CLIENT_EXE} get crds --ignore-not-found=true kialis.kiali.io ossmconsoles.kiali.io 2>/dev/null || true
  fi
fi

msg "Kiali and OSSMC have been completely purged from the cluster."
