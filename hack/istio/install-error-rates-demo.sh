#!/bin/bash

# This deploys the error rates demo

HACK_SCRIPT_DIR="$(cd $(dirname "${BASH_SOURCE[0]}") && pwd)"
source ${HACK_SCRIPT_DIR}/functions.sh


: ${CLIENT_EXE:=oc}
: ${AMBIENT_ENABLED:="false"}
: ${ARCH:=amd64}
: ${DELETE_DEMO:=false}
: ${ENABLE_INJECTION:=true}
: ${ISTIO_NAMESPACE:=istio-system}
: ${NAMESPACE_ALPHA:=alpha}
: ${NAMESPACE_BETA:=beta}
: ${NAMESPACE_GAMMA:=gamma}
: ${SOURCE:="https://raw.githubusercontent.com/kiali/demos/master"}
: ${DISTRIBUTE_DEMO:=false}
: ${CLUSTER1_CONTEXT=east}
: ${CLUSTER2_CONTEXT=west}
: ${WAYPOINT:="false"}

while [ $# -gt 0 ]; do
  key="$1"
  case $key in
    -a|--arch)
      ARCH="$2"
      shift;shift
      ;;
    -c|--client)
      CLIENT_EXE="$2"
      shift;shift
      ;;
    -d|--delete)
      DELETE_DEMO="$2"
      shift;shift
      ;;
    -ei|--enable-injection)
      ENABLE_INJECTION="$2"
      shift;shift
      ;;
    -in|--istio-namespace)
      ISTIO_NAMESPACE="$2"
      shift;shift
      ;;
    -dd|--distribute-demo)
      DISTRIBUTE_DEMO="$2"
      shift;shift
      ;;
    -c1|--cluster1)
      CLUSTER1_CONTEXT="$2"
      shift;shift
      ;;
    -c2|--cluster2)
      CLUSTER2_CONTEXT="$2"
      shift;shift
      ;;
    -h|--help)
      cat <<HELPMSG
Valid command line arguments:
  -a|--arch <amd64|ppc64le|s390x>: Images for given arch will be used (default: amd64).
  -c|--client: either 'oc' or 'kubectl'
  -d|--delete: either 'true' or 'false'. If 'true' the demo will be deleted, not installed.
  -ei|--enable-injection: either 'true' or 'false' (default is true). If 'true' auto-inject proxies for the workloads.
  -in|--istio-namespace <name>: Where the Istio control plane is installed (default: istio-system).
  -dd|--distribute-demo 'true' or 'false'. If 'true' alpha namespace will be created on east cluster, beta and gamma namespaces on west cluster.
  -c1|--cluster1: context name of the cluster 1. Doesn't do anything if --distribute-demo is set to false (default: east)
  -c2|--cluster2: context name of the cluster 2. Doesn't do anything if --distribute-demo is set to false (default: west)
  -h|--help: this text
  -s|--source: demo file source. For example: file:///home/me/demos Default: https://raw.githubusercontent.com/kiali/demos/master
HELPMSG
      exit 1
      ;;
    -s|--source)
      SOURCE="$2"
      shift;shift
      ;;
    *)
      echo "Unknown argument [$key]. Aborting."
      exit 1
      ;;
  esac
done

echo Will deploy Error Rates Demo using these settings:
echo ARCH=${ARCH}
echo CLIENT_EXE=${CLIENT_EXE}
echo CLUSTER1_CONTEXT=${CLUSTER1_CONTEXT}
echo CLUSTER2_CONTEXT=${CLUSTER2_CONTEXT}
echo DELETE_DEMO=${DELETE_DEMO}
echo DISTRIBUTE_DEMO=${DISTRIBUTE_DEMO}
echo ENABLE_INJECTION=${ENABLE_INJECTION}
echo ISTIO_NAMESPACE=${ISTIO_NAMESPACE}
echo NAMESPACE_ALPHA=${NAMESPACE_ALPHA}
echo NAMESPACE_BETA=${NAMESPACE_BETA}
echo NAMESPACE_GAMMA=${NAMESPACE_GAMMA}
echo SOURCE=${SOURCE}

# check arch values
if [ "${ARCH}" != "ppc64le" ] && [ "${ARCH}" != "s390x" ] && [ "${ARCH}" != "amd64" ] && [ "${ARCH}" != "arm64" ]; then
  echo "${ARCH} is not supported. Exiting."
  exit 1
fi

IS_OPENSHIFT="false"
if [[ "${CLIENT_EXE}" = *"oc" ]]; then
  IS_OPENSHIFT="true"
fi

if [ "${IS_OPENSHIFT}" == "true" ] && [ "${DISTRIBUTE_DEMO}" == "true" ]; then
  echo "Distribute demo is not supported on OpenShift. Exiting."
  exit 1
fi

echo "IS_OPENSHIFT=${IS_OPENSHIFT}"

# If we are to delete, remove everything and exit immediately after
if [ "${DELETE_DEMO}" == "true" ]; then
  echo "Deleting Error Rates Demo (the envoy filters, if previously created, will remain)"
  if [ "${IS_OPENSHIFT}" == "true" ]; then
    $CLIENT_EXE delete network-attachment-definition istio-cni -n ${NAMESPACE_ALPHA}
    $CLIENT_EXE delete network-attachment-definition istio-cni -n ${NAMESPACE_BETA}
    $CLIENT_EXE delete network-attachment-definition istio-cni -n ${NAMESPACE_GAMMA}
    $CLIENT_EXE delete scc error-rates-scc
  fi
  
  if [ "${DISTRIBUTE_DEMO}" == "true" ]; then
    ${CLIENT_EXE} delete namespace ${NAMESPACE_ALPHA} --context ${CLUSTER1_CONTEXT}
    ${CLIENT_EXE} delete namespace ${NAMESPACE_BETA}  --context ${CLUSTER2_CONTEXT}
    ${CLIENT_EXE} delete namespace ${NAMESPACE_GAMMA} --context ${CLUSTER2_CONTEXT}
  else
    ${CLIENT_EXE} delete namespace ${NAMESPACE_ALPHA}
    ${CLIENT_EXE} delete namespace ${NAMESPACE_BETA}
    ${CLIENT_EXE} delete namespace ${NAMESPACE_GAMMA}
  fi
  
  exit 0
fi

# Create and prepare the demo namespaces

if [ "${IS_OPENSHIFT}" == "true" ]; then
  $CLIENT_EXE new-project ${NAMESPACE_ALPHA}
  $CLIENT_EXE new-project ${NAMESPACE_BETA}
  $CLIENT_EXE new-project ${NAMESPACE_GAMMA}
else
  if [ "${DISTRIBUTE_DEMO}" == "true" ]; then
    $CLIENT_EXE create namespace ${NAMESPACE_ALPHA} --context ${CLUSTER1_CONTEXT}
    $CLIENT_EXE create namespace ${NAMESPACE_BETA} --context ${CLUSTER2_CONTEXT}
    $CLIENT_EXE create namespace ${NAMESPACE_GAMMA} --context ${CLUSTER2_CONTEXT}
  else
    $CLIENT_EXE create namespace ${NAMESPACE_ALPHA}
    $CLIENT_EXE create namespace ${NAMESPACE_BETA}
    $CLIENT_EXE create namespace ${NAMESPACE_GAMMA}
  fi
fi

if [ "${ENABLE_INJECTION}" == "false" ]; then
  for n in $(${CLIENT_EXE} get daemonset --all-namespaces -o jsonpath='{.items[*].metadata.name}')
  do
    if [ "${n}" == "ztunnel" ]; then
      AMBIENT_ENABLED="true"
      echo "AMBIENT_ENABLED=${AMBIENT_ENABLED}"
      break
    fi
  done
  if [ "${AMBIENT_ENABLED}" == "false" ] && [ "${WAYPOINT}" == "true" ]; then
   echo "Waypoint proxy cannot be installed as Ambient is not enabled."
   exit 1
  fi
fi

ISTIO_INJECTION=""
if [ "${AMBIENT_ENABLED}" == "true" ]; then
  ISTIO_INJECTION="istio.io/dataplane-mode=ambient"
  # It could also be applied to service account
  if [ "${WAYPOINT}" == "true" ]; then
    # Verify Gateway API
    echo "Verifying that Gateway API is installed; if it is not then it will be installed now."
    $CLIENT_EXE get crd gateways.gateway.networking.k8s.io &> /dev/null || \
      { $CLIENT_EXE kustomize "github.com/kubernetes-sigs/gateway-api/config/crd/experimental?ref=v1.0.0" | $CLIENT_EXE apply -f -; }
    # Create Waypoint proxy
    echo "Create Waypoint proxy"
    ${ISTIOCTL} x waypoint apply -n ${NAMESPACE}
    ${ISTIOCTL} x waypoint apply -n ${NAMESPACE}
    ${ISTIOCTL} x waypoint apply -n ${NAMESPACE}
  fi
else
  if [ "${ENABLE_INJECTION}" == "true" ]; then
    ISTIO_INJECTION="istio-injection=enabled"
  fi
fi

if [ "${DISTRIBUTE_DEMO}" == "true" ]; then
    ${CLIENT_EXE} label namespace ${NAMESPACE_ALPHA} ${ISTIO_INJECTION} --context ${CLUSTER1_CONTEXT}
    ${CLIENT_EXE} label namespace ${NAMESPACE_BETA} ${ISTIO_INJECTION}  --context ${CLUSTER2_CONTEXT}
    ${CLIENT_EXE} label namespace ${NAMESPACE_GAMMA} ${ISTIO_INJECTION}  --context ${CLUSTER2_CONTEXT}
  else
    ${CLIENT_EXE} label namespace ${NAMESPACE_ALPHA} ${ISTIO_INJECTION}
    ${CLIENT_EXE} label namespace ${NAMESPACE_BETA} ${ISTIO_INJECTION}
    ${CLIENT_EXE} label namespace ${NAMESPACE_GAMMA} ${ISTIO_INJECTION}
fi

# For OpenShift 4.11, adds default service account in the current ns to use as a user
if [ "${IS_OPENSHIFT}" == "true" ]; then
  $CLIENT_EXE adm policy add-scc-to-user anyuid -z default -n ${NAMESPACE_ALPHA}
  $CLIENT_EXE adm policy add-scc-to-user anyuid -z default -n ${NAMESPACE_BETA}
  $CLIENT_EXE adm policy add-scc-to-user anyuid -z default -n ${NAMESPACE_GAMMA}
fi

if [ "${IS_OPENSHIFT}" == "true" ]; then
  cat <<NAD | $CLIENT_EXE -n ${NAMESPACE_ALPHA} create -f -
apiVersion: "k8s.cni.cncf.io/v1"
kind: NetworkAttachmentDefinition
metadata:
  name: istio-cni
NAD
  cat <<NAD | $CLIENT_EXE -n ${NAMESPACE_BETA} create -f -
apiVersion: "k8s.cni.cncf.io/v1"
kind: NetworkAttachmentDefinition
metadata:
  name: istio-cni
NAD
  cat <<NAD | $CLIENT_EXE -n ${NAMESPACE_GAMMA} create -f -
apiVersion: "k8s.cni.cncf.io/v1"
kind: NetworkAttachmentDefinition
metadata:
  name: istio-cni
NAD
  cat <<SCC | $CLIENT_EXE apply -f -
apiVersion: security.openshift.io/v1
kind: SecurityContextConstraints
metadata:
  name: error-rates-scc
runAsUser:
  type: RunAsAny
seLinuxContext:
  type: RunAsAny
supplementalGroups:
  type: RunAsAny
priority: 9
users:
- "system:serviceaccount:${NAMESPACE_ALPHA}:default"
- "system:serviceaccount:${NAMESPACE_BETA}:default"
- "system:serviceaccount:${NAMESPACE_GAMMA}:default"
SCC
fi

# Deploy the demo
url_alpha="${SOURCE}/error-rates/alpha.yaml"
url_beta="${SOURCE}/error-rates/beta.yaml"
url_gamma="${SOURCE}/error-rates/gamma.yaml"
sed_client_p="s;kiali/demo_error_rates_client;maistra/demo_error_rates_client-p;g"
sed_server_p="s;kiali/demo_error_rates_server;maistra/demo_error_rates_server-p;g"
sed_client_z="s;kiali/demo_error_rates_client;maistra/demo_error_rates_client-z;g"
sed_server_z="s;kiali/demo_error_rates_server;maistra/demo_error_rates_server-z;g"

if [ "${DISTRIBUTE_DEMO}" == "true" ]; then
  if [ "${ARCH}" == "ppc64le" ]; then
    ${CLIENT_EXE} apply -f <(curl -L ${url_alpha} | sed "${sed_client_p}" | sed "${sed_server_p}") -n ${NAMESPACE_ALPHA} --context ${CLUSTER1_CONTEXT}
    ${CLIENT_EXE} apply -f <(curl -L "${url_beta}" | sed "${sed_client_p}" | sed "${sed_server_p}") -n ${NAMESPACE_BETA} --context ${CLUSTER2_CONTEXT}
    ${CLIENT_EXE} apply -f <(curl -L "${url_gamma}" | sed "${sed_client_p}" | sed "${sed_server_p}") -n ${NAMESPACE_GAMMA} --context ${CLUSTER2_CONTEXT}
  elif [ "${ARCH}" == "s390x" ]; then
    ${CLIENT_EXE} apply -f <(curl -L ${url_alpha} | sed "${sed_client_z}" | sed "${sed_server_z}") -n ${NAMESPACE_ALPHA} --context ${CLUSTER1_CONTEXT}
    ${CLIENT_EXE} apply -f <(curl -L "${url_beta}" | sed "${sed_client_z}" | sed "${sed_server_z}") -n ${NAMESPACE_BETA} --context ${CLUSTER2_CONTEXT}
    ${CLIENT_EXE} apply -f <(curl -L "${url_gamma}" | sed "${sed_client_z}" | sed "${sed_server_z}") -n ${NAMESPACE_GAMMA} --context ${CLUSTER2_CONTEXT}
  else
    ${CLIENT_EXE} apply -f <(curl -L ${url_alpha}) -n ${NAMESPACE_ALPHA} --context ${CLUSTER1_CONTEXT}
    ${CLIENT_EXE} apply -f <(curl -L "${url_beta}") -n ${NAMESPACE_BETA} --context ${CLUSTER2_CONTEXT}
    ${CLIENT_EXE} apply -f <(curl -L "${url_gamma}") -n ${NAMESPACE_GAMMA} --context ${CLUSTER2_CONTEXT}
  fi
else
  if [ "${ARCH}" == "ppc64le" ]; then
    ${CLIENT_EXE} apply -f <(curl -L ${url_alpha} | sed "${sed_client_p}" | sed "${sed_server_p}") -n ${NAMESPACE_ALPHA}
    ${CLIENT_EXE} apply -f <(curl -L "${url_beta}" | sed "${sed_client_p}" | sed "${sed_server_p}") -n ${NAMESPACE_BETA}
    ${CLIENT_EXE} apply -f <(curl -L "${url_gamma}" | sed "${sed_client_p}" | sed "${sed_server_p}") -n ${NAMESPACE_GAMMA}
  elif [ "${ARCH}" == "s390x" ]; then
    ${CLIENT_EXE} apply -f <(curl -L ${url_alpha} | sed "${sed_client_z}" | sed "${sed_server_z}") -n ${NAMESPACE_ALPHA}
    ${CLIENT_EXE} apply -f <(curl -L "${url_beta}" | sed "${sed_client_z}" | sed "${sed_server_z}") -n ${NAMESPACE_BETA}
    ${CLIENT_EXE} apply -f <(curl -L "${url_gamma}" | sed "${sed_client_z}" | sed "${sed_server_z}") -n ${NAMESPACE_GAMMA}
  else
    ${CLIENT_EXE} apply -f <(curl -L ${url_alpha}) -n ${NAMESPACE_ALPHA}
    ${CLIENT_EXE} apply -f <(curl -L "${url_beta}") -n ${NAMESPACE_BETA}
    ${CLIENT_EXE} apply -f <(curl -L "${url_gamma}") -n ${NAMESPACE_GAMMA}
  fi
fi
