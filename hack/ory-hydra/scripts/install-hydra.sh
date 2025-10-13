#!/bin/bash

# Ory Hydra Installation Script using Official Helm Chart
# Installs Ory Hydra for OpenID Connect authentication on minikube and KinD clusters
# - For KinD: Requires cluster IP to be provided via --cluster-ip

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Default values
NAMESPACE="ory"
HOSTNAME="hydra.example.com"
HELM_RELEASE_NAME="hydra"
CLUSTER_IP=""
KUBECTL_CMD="kubectl"
HYDRA_VERSION="v2.2.0"
MINIKUBE_PROFILE="minikube"
CLUSTER_TYPE=""
CERTS_DIR=""

helpmsg() {
  cat <<HELP
This script installs Ory Hydra for OpenID Connect support.

Options:

-n|--namespace <namespace>
    Kubernetes namespace to install Hydra in.
    Default: ory

-hn|--hostname <hostname>
    Hostname for Hydra (will be overridden by cluster IP if provided).
    Default: hydra.example.com

-r|--release-name <name>
    Helm release name.
    Default: hydra

-ci|--cluster-ip <ip>
    Cluster IP address (for certificate generation and nip.io hostname).
    If not provided, will attempt to auto-detect for minikube.
    Default: <auto-detect for minikube>

-cd|--certs-dir <directory>
    Directory containing pre-generated certificates to use.
    If provided, certificate generation will be skipped.
    Default: <generate new certificates>

-ce|--client-exe <path>
    The full path to the 'kubectl' command.
    Default: kubectl

-ct|--cluster-type <type>
    Cluster type: 'minikube' or 'kind'.
    Default: <auto-detect>

-hv|--hydra-version <version>
    The version of Hydra to install.
    Default: v2.2.0

-mp|--minikube-profile <profile>
    Minikube profile name (only used for auto-detection in minikube).
    Default: minikube

-h|--help
    Show this help message.
HELP
}

# Process command line arguments
while [[ $# -gt 0 ]]; do
  key="$1"
  case $key in
    -n|--namespace)         NAMESPACE="$2";        shift;shift; ;;
    -hn|--hostname)         HOSTNAME="$2";         shift;shift; ;;
    -r|--release-name)      HELM_RELEASE_NAME="$2"; shift;shift; ;;
    -ci|--cluster-ip)       CLUSTER_IP="$2";       shift;shift; ;;
    -cd|--certs-dir)        CERTS_DIR="$2";        shift;shift; ;;
    -ce|--client-exe)       KUBECTL_CMD="$2";      shift;shift; ;;
    -ct|--cluster-type)     CLUSTER_TYPE="$2";     shift;shift; ;;
    -hv|--hydra-version)    HYDRA_VERSION="$2";    shift;shift; ;;
    -mp|--minikube-profile) MINIKUBE_PROFILE="$2"; shift;shift; ;;
    -h|--help)              helpmsg;                exit 0       ;;
    *) echo "Unknown argument: [$key]. Aborting."; helpmsg; exit 1 ;;
  esac
done

# Auto-detect minikube IP if cluster IP not provided
if [[ -z "${CLUSTER_IP}" ]] && [[ "${CLUSTER_TYPE}" != "kind" ]]; then
    if command -v minikube &> /dev/null; then
        CLUSTER_IP=$(minikube ip -p "${MINIKUBE_PROFILE}" 2>/dev/null || minikube ip 2>/dev/null || echo "")
        if [[ -n "${CLUSTER_IP}" ]]; then
            echo "Auto-detected minikube cluster IP: ${CLUSTER_IP}"
            HOSTNAME="${CLUSTER_IP}"
        fi
    fi
fi

# Use CLUSTER_IP for HOSTNAME if provided
if [[ -n "${CLUSTER_IP}" ]]; then
    HOSTNAME="${CLUSTER_IP}"
fi

echo "=== Installing Ory Hydra via Official Helm Chart ==="
echo "Namespace: ${NAMESPACE}"
echo "Hostname: ${HOSTNAME}"
echo "Release Name: ${HELM_RELEASE_NAME}"
echo "Hydra Version: ${HYDRA_VERSION}"
echo ""

# Check if helm is available
if ! command -v helm &> /dev/null; then
    echo "ERROR: helm is required but not found in PATH"
    exit 1
fi

# Add Ory Helm repository
echo "Adding Ory Helm repository..."
helm repo add ory https://k8s.ory.sh/helm/charts
helm repo update

# Create namespace if it doesn't exist
echo "Creating namespace ${NAMESPACE}..."
${KUBECTL_CMD} create namespace ${NAMESPACE} --dry-run=client -o yaml | ${KUBECTL_CMD} apply -f -

# Install PostgreSQL and UI (using our custom manifests)
echo "Installing PostgreSQL database..."
${KUBECTL_CMD} apply -f "$(dirname "$0")/../manifests/postgresql.yaml"

echo "Installing Hydra UI..."
${KUBECTL_CMD} apply -f "$(dirname "$0")/../manifests/hydra-ui-simple.yaml"

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL to be ready..."
${KUBECTL_CMD} wait --for=condition=ready pod -l app=postgresql -n ${NAMESPACE} --timeout=120s

# Use provided certificates or generate new ones
if [[ -n "${CERTS_DIR}" ]]; then
    echo "Using pre-generated certificates from: ${CERTS_DIR}"
    if [ ! -d "${CERTS_DIR}" ]; then
        echo "ERROR: Provided certs directory does not exist: ${CERTS_DIR}"
        exit 1
    fi
    if [ ! -f "${CERTS_DIR}/cert.pem" ] || [ ! -f "${CERTS_DIR}/key.pem" ]; then
        echo "ERROR: Required certificate files (cert.pem, key.pem) not found in: ${CERTS_DIR}"
        exit 1
    fi
    # Use the provided directory directly
    CLEANUP_CERTS_DIR=false
else
    echo "Generating TLS certificates..."
    CERTS_DIR="/tmp/hydra-certs-$$"
    mkdir -p "${CERTS_DIR}"
    cd "${CERTS_DIR}"
    rm -rf ssl 2>/dev/null || true

    # Generate certificates with cluster IP support
    GENCERT_SCRIPT="${SCRIPT_DIR}/gencert.sh"
    if [[ -n "${CLUSTER_IP}" ]]; then
        echo "Generating certificates for hostname ${HOSTNAME} with cluster IP ${CLUSTER_IP}"
        bash "${GENCERT_SCRIPT}" --hostname "${HOSTNAME}" --cluster-ip "${CLUSTER_IP}" --cert-dir "ssl"
    else
        echo "Generating certificates for hostname ${HOSTNAME}"
        bash "${GENCERT_SCRIPT}" --hostname "${HOSTNAME}" --cert-dir "ssl"
    fi
    CERTS_DIR="${CERTS_DIR}/ssl"
    CLEANUP_CERTS_DIR=true
fi

# Create TLS secret
echo "Creating TLS secret..."
${KUBECTL_CMD} create secret generic hydra-tls \
    --from-file=cert.pem=${CERTS_DIR}/cert.pem \
    --from-file=key.pem=${CERTS_DIR}/key.pem \
    -n ${NAMESPACE} \
    --dry-run=client -o yaml | ${KUBECTL_CMD} apply -f -

# Copy Hydra CA certificate for API server OIDC validation (skip for KinD)
if [ "${CLUSTER_TYPE:-}" != "kind" ]; then
    echo "Copying Hydra CA certificate to minikube for OIDC validation..."
    if command -v minikube >/dev/null 2>&1; then
        openssl x509 -in ${CERTS_DIR}/cert.pem -out /tmp/hydra-ca.pem 2>/dev/null || cp ${CERTS_DIR}/cert.pem /tmp/hydra-ca.pem

        # Copy to minikube node
        if [ -n "${MINIKUBE_PROFILE}" ]; then
            minikube cp -p "${MINIKUBE_PROFILE}" /tmp/hydra-ca.pem /var/lib/minikube/certs/hydra-ca.pem
        else
            minikube cp /tmp/hydra-ca.pem /var/lib/minikube/certs/hydra-ca.pem
        fi

        # Clean up temporary file
        rm -f /tmp/hydra-ca.pem
        echo "Hydra CA certificate copied to minikube successfully"
    else
        echo "WARNING: minikube command not found. Hydra CA certificate not copied."
        echo "API server OIDC validation may fail without the CA certificate."
    fi
else
    echo "Skipping certificate copy for KinD cluster (handled by install-hydra-kind.sh)"
fi

# Create Hydra values file
echo "Creating Hydra configuration..."

# Convert IP address to nip.io format (replace dots with dashes)
NIPIP_HOSTNAME=$(echo "${HOSTNAME}" | sed 's/\./-/g')
ISSUER_URL="https://${NIPIP_HOSTNAME}.nip.io:30967"
echo "Using issuer URL: ${ISSUER_URL}"

cat > /tmp/hydra-values.yaml << EOF
# Ory Hydra Configuration for Kiali Testing
# Uses official Ory Helm chart (non-Bitnami per requirements)

replicaCount: 1

image:
  repository: oryd/hydra
  tag: ${HYDRA_VERSION}
  pullPolicy: IfNotPresent

# Service configuration - ClusterIP initially, converted to NodePort after install
service:
  public:
    enabled: true
    type: ClusterIP
    port: 4444
  admin:
    enabled: true
    type: ClusterIP
    port: 4445

# Database configuration (PostgreSQL)
hydra:
  config:
    dsn: postgres://hydra:hydra_password@postgresql:5432/hydra?sslmode=disable

    urls:
      self:
        issuer: ${ISSUER_URL}
        public: ${ISSUER_URL}
      login: https://${NIPIP_HOSTNAME}.nip.io:30800/login
      consent: https://${NIPIP_HOSTNAME}.nip.io:30800/consent
      logout: https://${NIPIP_HOSTNAME}.nip.io:30800/logout

    secrets:
      system:
        - "this-is-a-test-secret-change-me-in-production"
      cookie:
        - "this-is-another-test-secret-change-me-too"

    serve:
      tls:
        enabled: true
        cert:
          path: /etc/hydra/certs/cert.pem
        key:
          path: /etc/hydra/certs/key.pem
      public:
        tls:
          enabled: true
          cert:
            path: /etc/hydra/certs/cert.pem
          key:
            path: /etc/hydra/certs/key.pem
      admin:
        tls:
          enabled: true
          cert:
            path: /etc/hydra/certs/cert.pem
          key:
            path: /etc/hydra/certs/key.pem

    oauth2:
      expose_internal_errors: true

    log:
      level: debug
      format: text

  # Enable automatic database migrations
  automigration:
    enabled: true

# Resource limits for minikube
resources:
  requests:
    memory: "128Mi"
    cpu: "100m"
  limits:
    memory: "256Mi"
    cpu: "200m"

# Deployment configuration with TLS certificates and HTTPS health checks
deployment:
  extraVolumes:
    - name: hydra-certs
      secret:
        secretName: hydra-tls
        defaultMode: 0644

  extraVolumeMounts:
    - name: hydra-certs
      mountPath: /etc/hydra/certs
      readOnly: true

  livenessProbe:
    httpGet:
      path: /health/alive
      port: 4445
      scheme: HTTPS
    initialDelaySeconds: 30
    periodSeconds: 10

  readinessProbe:
    httpGet:
      path: /health/ready
      port: 4445
      scheme: HTTPS
    initialDelaySeconds: 15
    periodSeconds: 5

  startupProbe:
    httpGet:
      path: /health/ready
      port: 4445
      scheme: HTTPS
    initialDelaySeconds: 5
    periodSeconds: 5
    failureThreshold: 30
EOF

# Install Hydra using Helm chart
echo "Installing Ory Hydra..."
helm upgrade --install ${HELM_RELEASE_NAME} ory/hydra \
    --namespace ${NAMESPACE} \
    --values /tmp/hydra-values.yaml \
    --timeout=300s

# Wait for deployment to be created before patching
echo "Waiting for deployment to be created..."
${KUBECTL_CMD} wait --for=condition=available deployment/hydra -n ${NAMESPACE} --timeout=60s || true

# Add critical environment variables for login/consent URLs
echo "Adding login/consent URL environment variables..."
NIPIP_HOSTNAME=$(echo "${HOSTNAME}" | sed 's/\./-/g')
${KUBECTL_CMD} patch deployment hydra -n ${NAMESPACE} -p '{
    "spec": {
        "template": {
            "spec": {
                "containers": [{
                    "name": "hydra",
                    "args": ["serve", "all", "--dev", "--config", "/etc/config/hydra.yaml"],
                    "env": [
                        {"name": "URLS_LOGIN", "value": "https://'"${NIPIP_HOSTNAME}"'.nip.io:30800/login"},
                        {"name": "URLS_CONSENT", "value": "https://'"${NIPIP_HOSTNAME}"'.nip.io:30800/consent"},
                        {"name": "URLS_SELF_PUBLIC", "value": "https://'"${NIPIP_HOSTNAME}"'.nip.io:30967"},
                        {"name": "URLS_SELF_ADMIN", "value": "https://'"${NIPIP_HOSTNAME}"'.nip.io:30448"}
                    ]
                }]
            }
        }
    }
}'

# Update Hydra UI configuration with dynamic IP
echo "Updating Hydra UI configuration..."
${KUBECTL_CMD} patch deployment hydra-ui -n ${NAMESPACE} --type='json' -p='[
    {"op": "replace", "path": "/spec/template/spec/containers/0/env/0/value", "value": "https://'"${NIPIP_HOSTNAME}"'.nip.io:30448"}
]'

# Wait for Hydra UI to restart and be ready
echo "Waiting for Hydra UI to restart..."
${KUBECTL_CMD} rollout status deployment/hydra-ui -n ${NAMESPACE} --timeout=120s


# Wait for Hydra to be ready (more robust check)
echo "Waiting for Hydra to be ready..."
for i in {1..24}; do
    if ${KUBECTL_CMD} get pods -n ${NAMESPACE} -l app.kubernetes.io/name=hydra --no-headers | grep -q "1/1.*Running"; then
        echo "Hydra pod is running!"
        break
    fi
    echo "Waiting for Hydra pod... (attempt $i/24)"
    sleep 5
done

# Check Hydra readiness status
if ! ${KUBECTL_CMD} get pods -n ${NAMESPACE} -l app.kubernetes.io/name=hydra --no-headers | grep -q "1/1.*Running"; then
    echo "INFO: Hydra pod is still starting up, proceeding with NodePort configuration..."
fi

# Convert ClusterIP services to NodePort with fixed ports for external access
echo "Converting services to NodePort with fixed ports..."
sleep 10

PUBLIC_SVC=$(${KUBECTL_CMD} get svc -n ${NAMESPACE} -l app.kubernetes.io/name=hydra,app.kubernetes.io/component=public -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "${HELM_RELEASE_NAME}-public")
ADMIN_SVC=$(${KUBECTL_CMD} get svc -n ${NAMESPACE} -l app.kubernetes.io/name=hydra,app.kubernetes.io/component=admin -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "${HELM_RELEASE_NAME}-admin")

echo "Found services: Public=${PUBLIC_SVC}, Admin=${ADMIN_SVC}"

CURRENT_PUBLIC_PORT=$(${KUBECTL_CMD} get svc ${PUBLIC_SVC} -n ${NAMESPACE} -o jsonpath='{.spec.ports[0].nodePort}' 2>/dev/null || echo "")
CURRENT_ADMIN_PORT=$(${KUBECTL_CMD} get svc ${ADMIN_SVC} -n ${NAMESPACE} -o jsonpath='{.spec.ports[0].nodePort}' 2>/dev/null || echo "")

echo "Current NodePorts - Public: ${CURRENT_PUBLIC_PORT:-none}, Admin: ${CURRENT_ADMIN_PORT:-none}"

# Recreate services with fixed NodePorts (30967 for public, 30448 for admin)
echo "Recreating services with fixed NodePorts..."
${KUBECTL_CMD} delete svc ${PUBLIC_SVC} ${ADMIN_SVC} -n ${NAMESPACE} --ignore-not-found=true

# Recreate public service with NodePort 30967
cat <<EOF | ${KUBECTL_CMD} apply -f -
apiVersion: v1
kind: Service
metadata:
  name: ${PUBLIC_SVC}
  namespace: ${NAMESPACE}
  labels:
    app.kubernetes.io/name: hydra
    app.kubernetes.io/component: public
spec:
  type: NodePort
  selector:
    app.kubernetes.io/name: hydra
  ports:
  - port: 4444
    targetPort: 4444
    nodePort: 30967
    protocol: TCP
    name: http
EOF

# Recreate admin service with NodePort 30448
cat <<EOF | ${KUBECTL_CMD} apply -f -
apiVersion: v1
kind: Service
metadata:
  name: ${ADMIN_SVC}
  namespace: ${NAMESPACE}
  labels:
    app.kubernetes.io/name: hydra
    app.kubernetes.io/component: admin
spec:
  type: NodePort
  selector:
    app.kubernetes.io/name: hydra
  ports:
  - port: 4445
    targetPort: 4445
    nodePort: 30448
    protocol: TCP
    name: http
EOF

# Verify the correct ports are assigned
echo "Verifying NodePort assignments..."
PUBLIC_PORT=$(${KUBECTL_CMD} get svc ${PUBLIC_SVC} -n ${NAMESPACE} -o jsonpath='{.spec.ports[0].nodePort}' 2>/dev/null || echo "unknown")
ADMIN_PORT=$(${KUBECTL_CMD} get svc ${ADMIN_SVC} -n ${NAMESPACE} -o jsonpath='{.spec.ports[0].nodePort}' 2>/dev/null || echo "unknown")
echo "Public API NodePort: ${PUBLIC_PORT} (expected: 30967)"
echo "Admin API NodePort: ${ADMIN_PORT} (expected: 30448)"

if [ "${PUBLIC_PORT}" != "30967" ] || [ "${ADMIN_PORT}" != "30448" ]; then
    echo "ERROR: NodePorts do not match expected values (Public: ${PUBLIC_PORT}, Admin: ${ADMIN_PORT})."
    echo "This will cause issues with molecule test integration. Please check service configuration."
    exit 1
fi

# Configure OAuth2 clients for Kiali integration
echo "Setting up OAuth2 clients..."
sleep 10

"${SCRIPT_DIR}/setup-clients.sh" "https://${HOSTNAME}:30448" "${HOSTNAME}"

echo ""
echo "🎉 Ory Hydra installation complete!"
echo ""
echo "Services:"
echo "  Public API:  https://${HOSTNAME}:30967"
echo "  Admin API:   https://${HOSTNAME}:30448"
echo ""
echo "OAuth2 Clients configured:"
echo "  - kiali-app (confidential client for Kiali authentication)"
echo ""
echo "Next steps:"
echo "1. Verify all pods are running: kubectl get pods -n ory"
echo "2. Test with molecule tests"

# Cleanup
rm -f /tmp/hydra-values.yaml
if [ "${CLEANUP_CERTS_DIR:-false}" == "true" ]; then
    rm -rf "$(dirname "${CERTS_DIR}")"
fi
