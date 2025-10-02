#!/bin/bash

# Installs Ory Hydra for KinD clusters

set -e

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Get the Kiali root directory (parent of hack directory)
KIALI_ROOT="$(dirname "${SCRIPT_DIR}")"

infomsg() {
  if [ -z "${1}" ]; then
    echo
  else
    if [ "${1}" == "-n" ]; then
      echo -n "[INFO] ${2}"
    else
      echo "[INFO] ${1}"
    fi
  fi
}

helpmsg() {
  cat <<HELP
This script installs Ory Hydra for OpenID Connect support in a KinD cluster.

Options:

-ke|--kind-exe <path to kind>
    The full path to the 'kind' command. If relative path, assumes it is in PATH.
    Default: kind

-kn|--kind-name <name>
    The name of the KinD cluster.
    Default: ci

-ce|--client-exe <path to kubectl>
    The full path to the 'kubectl' command. If relative path, assumes it is in PATH.
    Default: kubectl

-hv|--hydra-version <version>
    The version of Hydra to install.
    Default: v2.2.0

-cd|--certs-dir <path>
    Directory containing pre-generated Hydra certificates.
    If not provided, certificates will be generated.
    Default: <generate certificates>

-op|--output-path <path>
    Directory where Hydra certificates and configuration will be stored.
    Default: <kiali-root>/_output

-h|--help
    Show this help message.
HELP
}

# Process command line arguments
while [[ $# -gt 0 ]]; do
  key="$1"
  case $key in
    -ke|--kind-exe)       KIND_EXE="$2";       shift;shift; ;;
    -kn|--kind-name)      KIND_NAME="$2";      shift;shift; ;;
    -ce|--client-exe)     CLIENT_EXE="$2";     shift;shift; ;;
    -cd|--certs-dir)      CERTS_DIR="$2";      shift;shift; ;;
    -hv|--hydra-version)  HYDRA_VERSION="$2";  shift;shift; ;;
    -op|--output-path)    OUTPUT_PATH="$2";    shift;shift; ;;
    -h|--help)            helpmsg;              exit 1       ;;
    *) echo "Unknown argument: [$key]. Aborting."; helpmsg; exit 1 ;;
  esac
done

# Set defaults
KIND_EXE="${KIND_EXE:-kind}"
KIND_NAME="${KIND_NAME:-ci}"
CLIENT_EXE="${CLIENT_EXE:-kubectl}"
CERTS_DIR="${CERTS_DIR:-}"
HYDRA_VERSION="${HYDRA_VERSION:-v2.2.0}"
OUTPUT_PATH="${OUTPUT_PATH:-${KIALI_ROOT}/_output}"

# Validate executables
KIND_EXE="$(which ${KIND_EXE} 2>/dev/null || echo "invalid kind: ${KIND_EXE}")"
CLIENT_EXE="$(which ${CLIENT_EXE} 2>/dev/null || echo "invalid kubectl: ${CLIENT_EXE}")"

if [[ "${KIND_EXE}" == invalid* ]]; then
  infomsg "ERROR: ${KIND_EXE}"
  exit 1
fi

if [[ "${CLIENT_EXE}" == invalid* ]]; then
  infomsg "ERROR: ${CLIENT_EXE}"
  exit 1
fi

# Check if KinD cluster exists and is running
if ! ${KIND_EXE} get kubeconfig --name ${KIND_NAME} > /dev/null 2>&1; then
  infomsg "ERROR: KinD cluster '${KIND_NAME}' does not exist or is not running"
  exit 1
fi

infomsg "Installing Ory Hydra for OpenID Connect support in KinD cluster '${KIND_NAME}'..."
infomsg "Script directory: ${SCRIPT_DIR}"
infomsg "Kiali root directory: ${KIALI_ROOT}"
infomsg "Output path: ${OUTPUT_PATH}"

# Use provided certificates or generate new ones
if [ -n "${CERTS_DIR}" ]; then
  infomsg "Using pre-generated certificates from: ${CERTS_DIR}"
  if [ ! -d "${CERTS_DIR}" ]; then
    infomsg "ERROR: Provided certs directory does not exist: ${CERTS_DIR}"
    exit 1
  fi
  CERTS_PATH="${CERTS_DIR}"

  # Extract the IP from the certificate directory path (e.g., ssl_172-19-0-2.nip.io -> 172.19.0.2)
  CERT_DIR_BASENAME=$(basename $(dirname "${CERTS_DIR}"))
  KIND_CLUSTER_IP_DASHED=$(echo "${CERT_DIR_BASENAME}" | sed 's/ssl_\(.*\)\.nip\.io/\1/')
  KIND_CLUSTER_IP=$(echo "${KIND_CLUSTER_IP_DASHED}" | sed 's/-/./g')
  KUBE_HOSTNAME="${KIND_CLUSTER_IP_DASHED}.nip.io"

  infomsg "Extracted cluster IP from certificate path: ${KIND_CLUSTER_IP}"
  infomsg "Hostname from certificates: ${KUBE_HOSTNAME}"
else
  # Get KinD cluster information
  KIND_CLUSTER_IP=$(${CLIENT_EXE} get nodes -o jsonpath='{.items[0].status.addresses[?(@.type=="InternalIP")].address}')
  if [ -z "${KIND_CLUSTER_IP}" ]; then
    infomsg "ERROR: Could not determine KinD cluster IP address"
    exit 1
  fi

  infomsg "KinD cluster IP is ${KIND_CLUSTER_IP}"

  KIND_CLUSTER_IP_DASHED=$(echo -n ${KIND_CLUSTER_IP} | sed 's/\./-/g')
  KUBE_HOSTNAME="${KIND_CLUSTER_IP_DASHED}.nip.io"
  infomsg "Hostname will be ${KUBE_HOSTNAME}"

  infomsg "Generating TLS certificates for Hydra..."
  HYDRA_PATH="${OUTPUT_PATH}/hydra"
  mkdir -p ${HYDRA_PATH}
  CERTS_PATH="${HYDRA_PATH}/ssl_${KUBE_HOSTNAME}"

  if [ ! -d "${CERTS_PATH}" ]; then
    HYDRA_GENCERT_SCRIPT="${KIALI_ROOT}/hack/ory-hydra/scripts/gencert.sh"
    if [ ! -f "${HYDRA_GENCERT_SCRIPT}" ]; then
      infomsg "ERROR: Hydra gencert.sh script not found at ${HYDRA_GENCERT_SCRIPT}"
      exit 1
    fi

    mkdir -p ${CERTS_PATH}
    bash ${HYDRA_GENCERT_SCRIPT} --hostname "${KUBE_HOSTNAME}" --cluster-ip "${KIND_CLUSTER_IP}" --cert-dir "${CERTS_PATH}"
    [ "$?" != "0" ] && infomsg "ERROR: Failed to generate certificates for Hydra" && exit 1
  fi

  # Create hydra-ca.pem from cert.pem for OIDC validation
  if [ ! -f "${CERTS_PATH}/hydra-ca.pem" ]; then
    infomsg "Creating hydra-ca.pem from cert.pem for OIDC validation..."
    openssl x509 -in ${CERTS_PATH}/cert.pem -out ${CERTS_PATH}/hydra-ca.pem 2>/dev/null || cp ${CERTS_PATH}/cert.pem ${CERTS_PATH}/hydra-ca.pem
  fi

  # Copy certificates to KinD cluster nodes
  infomsg "Copying certificates to KinD cluster nodes..."
  KIND_NODES=$(${KIND_EXE} get nodes --name ${KIND_NAME})

  for node in ${KIND_NODES}; do
    infomsg "Copying certificates to node: ${node}"
    for cert_file in ${CERTS_PATH}/*; do
      if [ -f "${cert_file}" ]; then
        cert_filename=$(basename "${cert_file}")
        infomsg "Copying ${cert_filename} to ${node}"
        docker cp "${cert_file}" "${node}:/etc/kubernetes/pki/${cert_filename}"
      fi
    done
  done
fi

# Deploy Hydra using our existing install script
infomsg "Deploying Ory Hydra..."
HYDRA_INSTALL_SCRIPT="${KIALI_ROOT}/hack/ory-hydra/scripts/install-hydra.sh"
if [ ! -f "${HYDRA_INSTALL_SCRIPT}" ]; then
  infomsg "ERROR: Hydra install script not found at ${HYDRA_INSTALL_SCRIPT}"
  exit 1
fi

# Run Hydra installation with KinD context
# Note: API server OIDC configuration was already set during cluster creation by start-kind.sh
bash ${HYDRA_INSTALL_SCRIPT} \
  --namespace "ory" \
  --hostname "${KUBE_HOSTNAME}" \
  --release-name "hydra" \
  --cluster-ip "${KIND_CLUSTER_IP}" \
  --certs-dir "${CERTS_PATH}" \
  --client-exe "${CLIENT_EXE}" \
  --hydra-version "${HYDRA_VERSION}" \
  --cluster-type "kind"
[ "$?" != "0" ] && infomsg "ERROR: Failed to install Hydra" && exit 1

# Wait for Hydra to be ready
infomsg "Waiting for Hydra to be ready..."
for i in {1..60}; do
  if ${CLIENT_EXE} get pods -n ory -l app.kubernetes.io/name=hydra --no-headers 2>/dev/null | grep -q "1/1.*Running"; then
    break
  fi
  infomsg "Waiting for Hydra... (attempt $i/60)"
  sleep 5
done

if ${CLIENT_EXE} get pods -n ory -l app.kubernetes.io/name=hydra --no-headers 2>/dev/null | grep -q "1/1.*Running"; then
  infomsg "Hydra is ready and running"
else
  infomsg "WARNING: Hydra may not be fully ready yet. Check with: ${CLIENT_EXE} get pods -n ory"
fi

# Deploy OAuth2 Proxy for header authentication testing (KinD-specific)
infomsg "Deploying OAuth2 Proxy for header authentication testing..."
${CLIENT_EXE} create namespace istio-system --dry-run=client -o yaml | ${CLIENT_EXE} apply -f -

cat <<EOF | ${CLIENT_EXE} apply -f -
apiVersion: v1
kind: Namespace
metadata:
  name: oauth2-proxy
spec: {}
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: oauth2-proxy
  namespace: oauth2-proxy
data:
  oauth2-proxy.conf: |-
    http_address="0.0.0.0:4180"
    cookie_secret="secretxxsecretxx"
    provider="oidc"
    email_domains="example.com"
    oidc_issuer_url="https://${KUBE_HOSTNAME}:30967"
    client_id="kiali-app"
    cookie_secure="false"
    redirect_url="http://kiali-proxy.${KUBE_HOSTNAME}:30805/oauth2/callback"
    upstreams="http://kiali.istio-system.svc:20001"
    pass_authorization_header = true
    set_authorization_header = true
    ssl_insecure_skip_verify = true
    client_secret="doNotTell"
---
apiVersion: apps/v1
kind: Deployment
metadata:
  labels:
    k8s-app: oauth2-proxy
  name: oauth2-proxy
  namespace: oauth2-proxy
spec:
  replicas: 1
  selector:
    matchLabels:
      k8s-app: oauth2-proxy
  template:
    metadata:
      labels:
        k8s-app: oauth2-proxy
    spec:
      containers:
      - args:
        - --config
        - /etc/oauthproxy/oauth2-proxy.conf
        env: []
        image: quay.io/oauth2-proxy/oauth2-proxy:v7.6.0
        imagePullPolicy: Always
        livenessProbe:
          httpGet:
            path: /ping
            port: 4180
          initialDelaySeconds: 10
          periodSeconds: 20
        name: oauth2-proxy
        ports:
        - containerPort: 4180
          protocol: TCP
        volumeMounts:
        - mountPath: /etc/oauthproxy
          name: config
      volumes:
      - configMap:
          name: oauth2-proxy
        name: config
---
apiVersion: v1
kind: Service
metadata:
  labels:
    k8s-app: oauth2-proxy
  name: oauth2-proxy
  namespace: oauth2-proxy
spec:
  ports:
  - name: http
    port: 4180
    protocol: TCP
    targetPort: 4180
    nodePort: 30805
  type: NodePort
  selector:
    k8s-app: oauth2-proxy
EOF
[ "$?" != "0" ] && infomsg "ERROR: Failed to deploy OAuth2 Proxy" && exit 1

# Wait for OAuth2 Proxy to be ready
infomsg "Waiting for OAuth2 Proxy to be ready..."
if ${CLIENT_EXE} wait --for=condition=available deployment/oauth2-proxy -n oauth2-proxy --timeout=300s; then
  infomsg "OAuth2 Proxy is ready and running"
else
  infomsg "WARNING: OAuth2 Proxy may not be fully ready yet. Check with: ${CLIENT_EXE} get pods -n oauth2-proxy"
fi

infomsg "Ory Hydra installation for KinD cluster '${KIND_NAME}' completed successfully!"
infomsg ""
infomsg "Hydra endpoints:"
infomsg "  Public API:   https://${KUBE_HOSTNAME}:30967"
infomsg "  Admin API:    https://${KUBE_HOSTNAME}:30448"
infomsg "  UI:           https://${KUBE_HOSTNAME}:30800"
infomsg "  OAuth2 Proxy: http://kiali-proxy.${KUBE_HOSTNAME}:30805"
infomsg ""
infomsg "OIDC Configuration:"
infomsg "  Issuer URL:   https://${KUBE_HOSTNAME}:30967"
infomsg "  Client ID:    kiali-app"
infomsg ""
infomsg "To verify installation:"
infomsg "  ${CLIENT_EXE} get pods -n ory"
infomsg "  ${CLIENT_EXE} get svc -n ory"
infomsg "  ${CLIENT_EXE} get pods -n oauth2-proxy"
