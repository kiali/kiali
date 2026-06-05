#!/bin/bash
# shellcheck disable=SC2155

##############################################################################
# install-ambient-external-kiali.sh
#
# Installs two clusters in the "external Kiali" topology, but with Istio
# Ambient on the mesh cluster instead of sidecar:
#
#   cluster-1 ("mgmt") - Kiali only, no Istio
#   cluster-2 ("mesh") - Istio in ambient mode (ztunnel)
#
# Run with clustering.ignore_home_cluster=true so Kiali on the management
# cluster watches the remote mesh cluster only. This is the topology where
# Kiali historically reported ambientEnabled=false even when the remote
# mesh was ambient, because the public config handler only checked the
# home cluster.
#
# Use this script to manually reproduce the bug and verify the fix that
# aggregates ambient detection across all clusters the user can access.
#
# Auth strategy convention matches install-external-kiali.sh and
# install-multi-primary.sh: defaults to openid, falls back to anonymous
# only when Keycloak is not reachable and MANAGE_MINIKUBE is true. Pass
# -kas anonymous on the CLI to force anonymous for a fast manual repro.
#
# See --help for more details on options to this script.
#
##############################################################################

infomsg() {
  echo "[INFO] ${1}"
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Pre-pull the Kiali Server helm chart to a local tarball when the user did
# not supply one. Two callers downstream use the chart with incompatible
# conventions:
#   - deploy-kiali.sh runs `helm upgrade --install ... kiali-server $CHART`
#     with no --repo flag, which requires a repo-prefixed name like
#     "kiali/kiali-server" OR a local path.
#   - kiali-prepare-remote-cluster.sh runs `helm template --repo URL kiali-server
#     $CHART`, which treats $CHART as a bare name within --repo and rejects
#     the "kiali/" prefix.
# A local tarball satisfies both without touching either downstream script.
# Mirrors install-external-kiali-openshift.sh:347-353. The CLI flag -kshc still
# overrides this since env.sh parses arguments after this block runs.
if [ -z "${KIALI_SERVER_HELM_CHARTS:-}" ]; then
  if ! command -v helm >/dev/null 2>&1; then
    echo "ERROR: helm is required on PATH to pre-pull the Kiali Server chart. Install helm or pass --kiali-server-helm-charts."
    exit 1
  fi
  helm repo add kiali https://kiali.org/helm-charts >/dev/null 2>&1 || true
  helm repo update kiali >/dev/null
  _kiali_chart_tmp="$(mktemp -d)"
  helm pull kiali/kiali-server --destination "${_kiali_chart_tmp}" >/dev/null
  KIALI_SERVER_HELM_CHARTS="$(ls -1 "${_kiali_chart_tmp}"/kiali-server-*.tgz | sort -V | tail -n1)"
  echo "Pre-pulled Kiali Server helm chart to: ${KIALI_SERVER_HELM_CHARTS}"
  export KIALI_SERVER_HELM_CHARTS
fi

source ${SCRIPT_DIR}/env.sh "$@"
source ${SCRIPT_DIR}/install-ambient-multicluster.sh "$@"

# The names of each cluster
if [ "${CLUSTER1_NAME}" == "east" ]; then
  CLUSTER1_NAME="mgmt"
fi
if [ "${CLUSTER2_NAME}" == "west" ]; then
  CLUSTER2_NAME="mesh"
fi

if [ "${MANAGE_KIND}" == "true" ]; then
  CLUSTER1_CONTEXT="kind-${CLUSTER1_NAME}"
  CLUSTER2_CONTEXT="kind-${CLUSTER2_NAME}"
else
  CLUSTER1_CONTEXT="${CLUSTER1_NAME}"
  CLUSTER2_CONTEXT="${CLUSTER2_NAME}"
fi

# Only install Kiali on cluster-1
# shellcheck disable=SC2034
IGNORE_HOME_CLUSTER="true"

# Force AMBIENT=true for this script. Downstream sourced scripts may key off
# this flag.
# shellcheck disable=SC2034
AMBIENT="true"

# Use Sail operator by default for ambient install (matches the default in
# install-ambient-multicluster.sh).
SAIL="${SAIL:-true}"

# Start up two minikube instances if requested
if [ "${MANAGE_MINIKUBE}" == "true" ]; then
  echo "Starting minikube instances"
  source ${SCRIPT_DIR}/start-minikube.sh
fi

# Start up two kind instances if requested
if [ "${MANAGE_KIND}" == "true" ]; then
  echo "Starting kind instances"

  if [ "${KIALI_AUTH_STRATEGY}" == "openid" ]; then
    "${SCRIPT_DIR}/../../keycloak.sh" -kcd "${KEYCLOAK_CERTS_DIR}" create-ca

    docker network create kind || true

    # Given: 172.18.0.0/16 this should return 172.18
    subnet=""

    # we always use docker today, but we'll leave this here just in case in the future Kind and podman play nice
    if [ "${DORP}" == "docker" ]; then
      # loop through all known subnets in the kind network and pick out the IPv4 subnet, ignoring any IPv6 that might be in the list
      subnets_count="$(docker network inspect kind | jq '.[0].IPAM.Config | length')"
      infomsg "There are [$subnets_count] subnets in the kind network"
      for ((i=0; i<subnets_count; i++)); do
        subnet=$(docker network inspect kind --format '{{(index .IPAM.Config '$i').Subnet}}' 2> /dev/null)
        if [[ -n $subnet && $subnet != *:* && $subnet == *\.* ]]; then
          infomsg "Using subnet [$subnet]"
          break
        else
          infomsg "Ignoring subnet [$subnet]"
          subnet=""
        fi
      done
      if [ -z "$subnet" ]; then
        infomsg "No subnets found in the expected docker network list. Maybe this is a podman network - let's check"
        subnet=$(docker network inspect kind | jq -r '.[0].subnets[] | select(.subnet | test("^[0-9]+\\.[0-9]+\\.[0-9]+\\.[0-9]+/")) | .subnet' 2>/dev/null)
      fi
    else
      subnet=$(podman network inspect kind | jq -r '.[0].subnets[] | select(.subnet | test("^[0-9]+\\.[0-9]+\\.[0-9]+\\.[0-9]+/")) | .subnet' 2>/dev/null)
    fi

    if [ -z "$subnet" ]; then
      infomsg "There does not appear to be any IPv4 subnets configured"
      exit 1
    fi

    beginning_subnet_octets=$(echo $subnet | cut -d'.' -f1,2 2>/dev/null)
    lb_range_start="255.70"
    lb_range_end="255.84"

    KEYCLOAK_ADDRESS="${beginning_subnet_octets}.${lb_range_start}"

    echo "==== START KIND FOR CLUSTER #1 [${CLUSTER1_NAME}] - ${CLUSTER1_CONTEXT}"
    "${SCRIPT_DIR}"/../../start-kind.sh \
      --name "${CLUSTER1_NAME}" \
      --load-balancer-range "${lb_range_start}-${lb_range_end}" \
      --enable-keycloak true \
      --keycloak-certs-dir "${KEYCLOAK_CERTS_DIR}" \
      --keycloak-issuer-uri https://"${KEYCLOAK_ADDRESS}"/realms/kube \
      --image "${KIND_NODE_IMAGE}"

    # Optional: keycloak memory limits
    KEYCLOAK_LIMIT_MEMORY="${KEYCLOAK_LIMIT_MEMORY:-}"
    KEYCLOAK_REQUESTS_MEMORY="${KEYCLOAK_REQUESTS_MEMORY:-}"
    if [ -n "$KEYCLOAK_LIMIT_MEMORY" ]; then
      MEMORY_LIMIT_ARG="-slm $KEYCLOAK_LIMIT_MEMORY"
    else
      MEMORY_LIMIT_ARG=""
    fi
    if [ -n "$KEYCLOAK_REQUESTS_MEMORY" ]; then
      MEMORY_REQUEST_ARG="-srm $KEYCLOAK_REQUESTS_MEMORY"
    else
      MEMORY_REQUEST_ARG=""
    fi
    "${SCRIPT_DIR}/../../keycloak.sh" -kcd "${KEYCLOAK_CERTS_DIR}" -kip "${KEYCLOAK_ADDRESS}" $MEMORY_LIMIT_ARG $MEMORY_REQUEST_ARG deploy

    echo "==== START KIND FOR CLUSTER #2 [${CLUSTER2_NAME}] - ${CLUSTER2_CONTEXT}"
    "${SCRIPT_DIR}"/../../start-kind.sh \
      --name "${CLUSTER2_NAME}" \
      --load-balancer-range "255.85-255.98" \
      --enable-keycloak true \
      --keycloak-certs-dir "${KEYCLOAK_CERTS_DIR}" \
      --keycloak-issuer-uri https://"${KEYCLOAK_ADDRESS}"/realms/kube \
      --image "${KIND_NODE_IMAGE}"
  else
    echo "==== START KIND FOR CLUSTER #1 [${CLUSTER1_NAME}] - ${CLUSTER1_CONTEXT}"
    "${SCRIPT_DIR}"/../../start-kind.sh \
      --name "${CLUSTER1_NAME}" \
      --load-balancer-range "255.70-255.84" \
      --image "${KIND_NODE_IMAGE}"

    echo "==== START KIND FOR CLUSTER #2 [${CLUSTER2_NAME}] - ${CLUSTER2_CONTEXT}"
    "${SCRIPT_DIR}"/../../start-kind.sh \
      --name "${CLUSTER2_NAME}" \
      --load-balancer-range "255.85-255.98" \
      --image "${KIND_NODE_IMAGE}"
  fi
fi

# Setup the certificates
source ${SCRIPT_DIR}/setup-ca.sh

# Ambient requires Gateway API CRDs on the mesh cluster (waypoint support).
echo "==== ENSURE GATEWAY API CRDs ON CLUSTER #2 [${CLUSTER2_NAME}] - ${CLUSTER2_CONTEXT}"
ensure_gateway_api_crds "" "--context=${CLUSTER2_CONTEXT}"

echo "==== INSTALL ISTIO AMBIENT ON CLUSTER #2 [${CLUSTER2_NAME}] - ${CLUSTER2_CONTEXT}"
install_ambient_on_cluster "${CLUSTER2_CONTEXT}" "${CLUSTER2_USER}" "${CLUSTER2_PASS}" "${CLUSTER2_NAME}" "${NETWORK2_ID}" "${SAIL}"

echo "==== INSTALL ADDONS ON CLUSTER #1 [${CLUSTER1_NAME}] - ${CLUSTER1_CONTEXT}"
ADDONS="prometheus grafana jaeger"
for addon in ${ADDONS}; do
    istio_version=$(${CLIENT_EXE} --context="${CLUSTER2_CONTEXT}" -n "${ISTIO_NAMESPACE}" get istios -l kiali.io/testing -o jsonpath='{.items[0].spec.version}')
    # Verison comes in the form v1.23.0 but we want 1.23
    # Remove the 'v' and remove the .0 from 1.23.0 and we should be left with 1.23
    addon_version="${istio_version:1:4}"
    curl -s "https://raw.githubusercontent.com/istio/istio/refs/heads/release-$addon_version/samples/addons/$addon.yaml" | \
      yq "select(.metadata) | .metadata.namespace = \"${ISTIO_NAMESPACE}\"" - | \
      kubectl --context="${CLUSTER1_CONTEXT}" apply -n "${ISTIO_NAMESPACE}" -f -
done

# Configure Prometheus federation
${CLIENT_EXE} patch svc prometheus -n ${ISTIO_NAMESPACE} --context ${CLUSTER2_CONTEXT} -p "{\"spec\": {\"type\": \"LoadBalancer\"}}"

WEST_PROMETHEUS_ADDRESS=$(${CLIENT_EXE} --context=${CLUSTER2_CONTEXT} -n ${ISTIO_NAMESPACE} get svc prometheus -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
if [ -z "${WEST_PROMETHEUS_ADDRESS}" ]; then
  echo "WARNING! Prometheus not updated - cannot determine the west prometheus load balancer ingress IP"
else
  ## TODO: prometheus.yaml has CLUSTER_NAME in it that should also be searched-replaced, but that is not done here
  cat ${SCRIPT_DIR}/prometheus.yaml | sed -e "s/WEST_PROMETHEUS_ADDRESS/$WEST_PROMETHEUS_ADDRESS/g" | ${CLIENT_EXE} apply -n ${ISTIO_NAMESPACE} --context ${CLUSTER1_CONTEXT} -f -
fi

# Install Kiali if enabled
if [ "${KIALI_ENABLED}" == "true" ]; then
  if [ -z "${KEYCLOAK_ADDRESS}" ] && [ "${MANAGE_MINIKUBE}" == "true" ]; then
    echo "Keycloak is not available for this cluster setup. Switching Kiali to 'anonymous' mode."
    export KIALI_AUTH_STRATEGY="anonymous"
  fi

  # deploy-kiali.sh in AMBIENT mode probes the *current* kubectl context for
  # istiod to discover the Istio version. In this topology cluster-1 (mgmt)
  # has no istiod, so the probe fails. Resolve the version from cluster-2's
  # Istio CR (Sail) up-front and export it; deploy-kiali.sh honors
  # ISTIO_VERSION and skips the probe.
  if [ -z "${ISTIO_VERSION:-}" ]; then
    detected_istio_version=$(${CLIENT_EXE} --context="${CLUSTER2_CONTEXT}" -n "${ISTIO_NAMESPACE}" get istios -l kiali.io/testing -o jsonpath='{.items[0].spec.version}' 2>/dev/null)
    if [ -n "${detected_istio_version}" ]; then
      # Sail reports as "v1.23.0"; deploy-kiali.sh wants "1.23.0".
      export ISTIO_VERSION="${detected_istio_version#v}"
      echo "Detected Istio version on [${CLUSTER2_CONTEXT}]: ${ISTIO_VERSION} (exporting for deploy-kiali.sh)"
    else
      echo "WARNING: could not detect Istio version on [${CLUSTER2_CONTEXT}]; deploy-kiali.sh may fail. Pass --istio-version explicitly to override."
    fi
  fi

  source ${SCRIPT_DIR}/deploy-kiali.sh
fi

if [ "${BOOKINFO_ENABLED}" == "true" ]; then
  switch_cluster "${CLUSTER2_CONTEXT}" "${CLUSTER2_USER}" "${CLUSTER2_PASS}"
  echo "Installing bookinfo demo in namespace [${BOOKINFO_NAMESPACE}] on [${CLUSTER2_CONTEXT}]"
  # Pass -ai false so install-bookinfo-demo.sh skips sidecar injection and
  # applies the `istio.io/dataplane-mode=ambient` label itself. The demo
  # script also handles namespace creation, so no extra setup is needed.
  source ${SCRIPT_DIR}/../install-bookinfo-demo.sh --client-exe "${CLIENT_EXE}" --istio-dir "${ISTIO_DIR}" --istio-namespace "${ISTIO_NAMESPACE}" --namespace "${BOOKINFO_NAMESPACE}" --kube-context "${CLUSTER2_CONTEXT}" -ai false -tg --mongo
fi
