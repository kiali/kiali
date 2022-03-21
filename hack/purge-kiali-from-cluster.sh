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

msg "Deleting any and all Kiali resources that are found in the cluster..."

delete_namespace_resources() {
  local selector_expression="$1"
  msg "Deleting namespace-scoped resources with selector [${selector_expression}]..."
  for r in $(${CLIENT_EXE} get --ignore-not-found=true all,secrets,sa,configmaps,deployments,roles,rolebindings,ingresses,horizontalpodautoscalers --selector="${selector_expression}" --all-namespaces -o custom-columns=NS:.metadata.namespace,K:.kind,N:.metadata.name --no-headers | sed 's/  */:/g')
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
    openshift_resources=",oauthclients.oauth.openshift.io,consolelinks.console.openshift.io"
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

# purge using the k8s labels
delete_namespace_resources "app.kubernetes.io/name=kiali"
delete_cluster_resources "app.kubernetes.io/name=kiali"
delete_namespace_resources "app.kubernetes.io/name=kiali-operator"
delete_cluster_resources "app.kubernetes.io/name=kiali-operator"

# purge anything using the old labels
delete_namespace_resources "app=kiali"
delete_cluster_resources "app=kiali"
delete_namespace_resources "app=kiali-operator"
delete_cluster_resources "app=kiali-operator"

msg "Deleting Kiali CRDs..."
for c in $(${CLIENT_EXE} get crds --ignore-not-found=true monitoringdashboards.monitoring.kiali.io kialis.kiali.io -o custom-columns=N:.metadata.name --no-headers)
do
  msg "Deleting CRD [${c}]"
  if [ "${DRY_RUN}" == "false" ]; then
    ${CLIENT_EXE} delete --ignore-not-found=true crd ${c}
  fi
done

msg "Kiali has been completely purged from the cluster."
