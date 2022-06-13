#!/bin/bash

##############################################################################
# perf-ibmcloud-openshift.sh
#
# Setup a performance testing environment on Openshift in IBM Cloud.
#
# Pass --help for usage information.
#
##############################################################################

set -eu

errormsg() {
  echo -e "\U0001F6A8 ERROR: ${1}"
  exit 1
}

infomsg() {
  echo -e "\U0001F4C4 ${1}"
}

install_istio() {
	hack/istio/download-istio.sh -iv "1.13.0"
  hack/istio/install-istio-via-istioctl.sh -iee true -cp openshift
}

SCRIPT_DIR=$( dirname -- "$0"; )

DEFAULT_HELM_CHARTS_REPO="${SCRIPT_DIR}/../helm-charts"
DEFAULT_ISTIO_VERSION=""
DEFAULT_KIALI_VERSION="dev"
DEFAULT_NODE_FLAVOR="bx2.8x32"
DEFAULT_NODES="3"
DEFAULT_OPENSHIFT_VERSION="4.10_openshift"
DEFAULT_REGION="us-south"

while [[ $# -gt 0 ]]; do
  key="$1"
  case $key in
    # OPTIONS
    -akf|--api-key-file)      API_KEY_FILE="$2";       shift;shift ;;
    -hr|--helm-charts-repo)   HELM_CHARTS_REPO="$2";   shift;shift ;;
    -iv|--istio-version)      ISTIO_VERSION="$2";      shift;shift ;;
    -kv|--kiali-version)      KIALI_VERSION="$2";      shift;shift ;;
    -nf|--node-flavor)        NODE_FLAVOR="$2";        shift;shift ;;
    -n|--nodes)               NODES="$2";              shift;shift ;;
    -ov|--openshift-version)  OPENSHIFT_VERSION="$2";  shift;shift ;;
    -r|--region)              REGION="$2";             shift;shift ;;
    -h|--help )
      cat <<HELPMSG
Create a performance cluster on IBM Cloud and install istio, kiali, and the testing demos.

Usage:
$0 [option...]

Valid options:
  -ak|--api-key
    This is REQUIRED. The IBM Cloud api key used for creating the openshift cluster
    and other resources in IBM Cloud. Learn how to create an API Key here:
    https://www.ibm.com/docs/en/app-connect/containers_cd?topic=servers-creating-cloud-api-key.

  -hr|--helm-charts-repo
    The local dir where the helm charts repo is located.
  
  -iv|--istio-version
    The Istio Version to install. Only upstream Istio supported.

  -kv|--kiali-version
    The Kiali version to install.

  -nf|--node-flavor
    The node flavor to use for the openshift cluster worker nodes.
    Use 'ibmcloud ks flavors --zone <zone>' to see all available flavors in the region/zone.

  -n|--nodes
    The number of worker nodes in the openshift cluster's node pool.

  -ov|--openshift-version
    The version of openshift to install for the worker nodes.

  -r|--region
    The region to install the openshift worker nodes.

  -h|--help )
HELPMSG
      exit 1
      ;;
    *)
      echo "Unknown option: [$key]. Aborting. Use '$0 --help' for proper usage."
      exit 1
      ;;
  esac
done

# Set the config
: "${HELM_CHARTS_REPO:=${DEFAULT_HELM_CHARTS_REPO}}"
: "${ISTIO_VERSION:=${DEFAULT_ISTIO_VERSION}}"
: "${KIALI_VERSION:=${DEFAULT_KIALI_VERSION}}"
: "${NODE_FLAVOR:=${DEFAULT_NODE_FLAVOR}}"
: "${NODES:=${DEFAULT_NODES}}"
: "${OPENSHIFT_VERSION:=${DEFAULT_OPENSHIFT_VERSION}}"
: "${REGION:=${DEFAULT_REGION}}"

# Dump config
infomsg "==START CONFIG=="
cat<<EOM
API_KEY=<omitted>
HELM_CHARTS_REPO=${HELM_CHARTS_REPO}
ISTIO_VERSION=${ISTIO_VERSION}
KIALI_VERSION=${KIALI_VERSION}
NODE_FLAVOR=${NODE_FLAVOR}
NODES=${NODES}
OPENSHIFT_VERSION=${OPENSHIFT_VERSION}
REGION=${REGION}
EOM
infomsg "==END CONFIG=="

install_kiali() {
  infomsg "Installing kiali operator and kiali"

  # cluster-status will expose the cluster's internal image registry route that podman needs to push images to.
  make -C "${SCRIPT_DIR}/.." -e DORP=podman cluster-status
  local cluster_repo
  cluster_repo=$(oc get image.config.openshift.io/cluster -o custom-columns=EXT:.status.externalRegistryHostnames[0] --no-headers 2>/dev/null)
  local master_url
  master_url=$(ibmcloud oc cluster get -c kiali-perf-cluster --output json | jq -r '.masterURL')
    
  oc login -u apikey -p "${API_KEY}" --server "${master_url}"
  local token
  token=$(oc whoami -t)
  podman login --tls-verify=false -u iamapikey -p "${token}" "${cluster_repo}"

  local additional_set
  local image_pull_secrets_field=""
  local operator_image_repo
  operator_image_repo="quay.io/kiali/kiali-operator"
  local kiali_image_name_field=""
  local kiali_image_version_field=""
  local helm_chart
  helm_chart="kiali/kiali-operator"

  if [ "${KIALI_VERSION}" == "dev" ]; then
    local kiali_dir=""
    kiali_dir="${SCRIPT_DIR}/.."
    make -C "${kiali_dir}" -e HELM_CHARTS_REPO="${HELM_CHARTS_REPO}" .ensure-operator-helm-chart-exists
    make -C "${kiali_dir}" -e DORP=podman build build-ui cluster-push
    # Dev images need to be built and pushed to the registry.
    additional_set='--set allowAdHocKialiNamespace=true --set allowAdHocKialiImage=true --set image.pullSecrets={kiali-pull-creds}'
    # Need to provide a image pull secret for the kiali and operator pods.
    oc create secret docker-registry kiali-pull-creds --docker-username=iamapikey --docker-password="${token}" --docker-server="${cluster_repo}" -n istio-system
    oc get ns kiali-operator || oc create ns kiali-operator
    oc create secret docker-registry kiali-pull-creds --docker-username=iamapikey --docker-password="${token}" --docker-server="${cluster_repo}" -n kiali-operator
    image_pull_secrets_field='image_pull_secrets: ["kiali-pull-creds"]'
    operator_image_repo="${cluster_repo}/kiali/kiali-operator"
    kiali_image_name_field="image_name: ${cluster_repo}/kiali/kiali"
    kiali_image_version_field="image_version: ${KIALI_VERSION}"
    helm_chart=${HELM_CHARTS_REPO}/_output/charts/kiali-operator-*-SNAPSHOT.tgz
  else
    additional_set=""
    helm repo add kiali https://kiali.org/helm-charts
    helm repo update
  fi
    
  # Need to install operator for downstream bookinfo script to work.
  helm install \
      --create-namespace \
      --namespace kiali-operator \
      --set cr.create=false \
      --set image.tag=${KIALI_VERSION} \
      --set image.repo="${operator_image_repo}" \
      ${additional_set} \
      kiali-operator \
      ${helm_chart}
    
  oc apply -f - <<EOF
apiVersion: kiali.io/v1alpha1
kind: Kiali
metadata:
  name: kiali
  namespace: kiali-operator
spec:
  auth:
    strategy: openshift
  deployment:
    logger:
      log_level: trace
    ${kiali_image_version_field}
    image_pull_policy: Always
    ${image_pull_secrets_field}
    ${kiali_image_name_field}
    accessible_namespaces:
      - "**"
    namespace: istio-system
  external_services:
    grafana:
      url: "http://grafana.istio-system:3000"
      dashboards:
        - name: "Istio Mesh Dashboard"
    tracing:
      url: "http://tracing.istio-system:16685/jaeger"
  istio_namespace: istio-system
  server:
    observability:
      tracing:
        enabled: true
EOF

}

REGION="us-south"

install_openshift() {
  if hack/ibmcloud-openshift.sh status -np kiali-perf | grep -q 'Cluster is deployed'; then
    infomsg "Openshift cluster is already deployed. Waiting for it to be ready to use..."
    hack/ibmcloud-openshift.sh finish -r "${REGION}" -np kiali-perf
    infomsg "Openshift cluster is ready to use."
    return 0
  fi

  hack/ibmcloud-openshift.sh create \
    --name-prefix kiali-perf \
    --openshift-version "${OPENSHIFT_VERSION}" \
    --region "${REGION}" \
    --worker-flavor "${NODE_FLAVOR}" \
    --worker-nodes "${NODES}"
}

install_demo_apps() {
  "${SCRIPT_DIR}"/istio/install-testing-demos.sh
}

# Make sure we are logged in
if ! ibmcloud account show > /dev/null;  then
  infomsg "Will now attempt to perform SSO login. If you have another login mechanism, abort, log in yourself, and re-run this script."
  if ! ibmcloud login -r "${REGION}" --sso ; then
    errormsg "Failed to login. Cannot continue."
  fi
fi

install_openshift
install_istio
install_kiali
install_demo_apps
