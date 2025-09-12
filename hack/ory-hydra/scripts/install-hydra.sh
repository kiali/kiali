#!/bin/bash

# Ory Hydra Installation Script using Official Helm Chart
# This script follows Kiali patterns and avoids Bitnami charts per requirements

set -e

# Get the absolute path to the script directory at the start
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

NAMESPACE="${1:-ory}"
HOSTNAME="${2:-hydra.example.com}"
HELM_RELEASE_NAME="${3:-hydra}"
MINIKUBE_IP="${4:-}"

# Use provided kubectl command or default
KUBECTL_CMD="${KUBECTL_CMD:-kubectl}"

# Use provided Hydra version or default
HYDRA_VERSION="${HYDRA_VERSION:-v2.2.0}"

# Use provided minikube profile or default
MINIKUBE_PROFILE="${MINIKUBE_PROFILE:-minikube}"

# Auto-detect minikube IP if not provided
if [[ -z "${MINIKUBE_IP}" ]]; then
    if command -v minikube &> /dev/null; then
        MINIKUBE_IP=$(minikube ip -p "${MINIKUBE_PROFILE}" 2>/dev/null || minikube ip 2>/dev/null || echo "")
        if [[ -n "${MINIKUBE_IP}" ]]; then
            echo "Auto-detected minikube IP: ${MINIKUBE_IP}"
            HOSTNAME="${MINIKUBE_IP}"
        fi
    fi
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

# Generate certificates with enhanced TLS support
echo "Generating TLS certificates..."
CERTS_DIR="/tmp/hydra-certs-$$"
mkdir -p "${CERTS_DIR}"
cd "${CERTS_DIR}"
rm -rf ssl 2>/dev/null || true

# Generate certificates with minikube IP support
GENCERT_SCRIPT="${SCRIPT_DIR}/gencert.sh"
if [[ -n "${MINIKUBE_IP}" ]]; then
    echo "Generating certificates for hostname ${HOSTNAME} with minikube IP ${MINIKUBE_IP}"
    bash "${GENCERT_SCRIPT}" "${HOSTNAME}" "${MINIKUBE_IP}" "ssl"
else
    echo "Generating certificates for hostname ${HOSTNAME}"
    bash "${GENCERT_SCRIPT}" "${HOSTNAME}" "" "ssl"
fi

# Create TLS secret with correct key names for Hydra
echo "Creating TLS secret..."
${KUBECTL_CMD} create secret generic hydra-tls \
    --from-file=cert.pem=ssl/cert.pem \
    --from-file=key.pem=ssl/key.pem \
    -n ${NAMESPACE} \
    --dry-run=client -o yaml | ${KUBECTL_CMD} apply -f -

# Copy Hydra CA certificate to minikube for API server OIDC validation
echo "Copying Hydra CA certificate to minikube for OIDC validation..."
if command -v minikube >/dev/null 2>&1; then
    # Extract CA certificate from the generated certificate
    openssl x509 -in ssl/cert.pem -out /tmp/hydra-ca.pem 2>/dev/null || cp ssl/cert.pem /tmp/hydra-ca.pem

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

# Service configuration - will be patched to NodePort after installation
# Note: Ory Helm chart doesn't support nodePort in values, so we patch after install
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

# Install Hydra using Helm (without waiting since we need to patch first)
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

# Ensure fixed NodePorts are applied (fix for dynamic port assignment issue)
echo "Ensuring fixed NodePorts are applied..."
# Wait for services to be fully created by Helm
echo "Waiting for services to be created..."
sleep 10

# Get actual service names from Helm chart
PUBLIC_SVC=$(${KUBECTL_CMD} get svc -n ${NAMESPACE} -l app.kubernetes.io/name=hydra,app.kubernetes.io/component=public -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "${HELM_RELEASE_NAME}-public")
ADMIN_SVC=$(${KUBECTL_CMD} get svc -n ${NAMESPACE} -l app.kubernetes.io/name=hydra,app.kubernetes.io/component=admin -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "${HELM_RELEASE_NAME}-admin")

echo "Found services: Public=${PUBLIC_SVC}, Admin=${ADMIN_SVC}"

# Patch services to use fixed NodePorts with correct targetPort references
echo "Patching ${PUBLIC_SVC} to use NodePort 30967..."
${KUBECTL_CMD} patch svc ${PUBLIC_SVC} -n ${NAMESPACE} -p '{"spec":{"type":"NodePort","ports":[{"port":4444,"targetPort":"http-public","nodePort":30967,"name":"http","protocol":"TCP"}]}}'
if [ $? -ne 0 ]; then
    echo "ERROR: Failed to patch public service to use NodePort 30967"
    exit 1
fi

echo "Patching ${ADMIN_SVC} to use NodePort 30448..."
${KUBECTL_CMD} patch svc ${ADMIN_SVC} -n ${NAMESPACE} -p '{"spec":{"type":"NodePort","ports":[{"port":4445,"targetPort":"http-admin","nodePort":30448,"name":"http","protocol":"TCP"}]}}'
if [ $? -ne 0 ]; then
    echo "ERROR: Failed to patch admin service to use NodePort 30448"
    exit 1
fi

# Verify the correct ports are assigned
echo "Verifying NodePort assignments..."
PUBLIC_PORT=$(${KUBECTL_CMD} get svc ${PUBLIC_SVC} -n ${NAMESPACE} -o jsonpath='{.spec.ports[0].nodePort}' 2>/dev/null || echo "unknown")
ADMIN_PORT=$(${KUBECTL_CMD} get svc ${ADMIN_SVC} -n ${NAMESPACE} -o jsonpath='{.spec.ports[0].nodePort}' 2>/dev/null || echo "unknown")
echo "Public API NodePort: ${PUBLIC_PORT} (expected: 30967)"
echo "Admin API NodePort: ${ADMIN_PORT} (expected: 30448)"

if [ "${PUBLIC_PORT}" != "30967" ] || [ "${ADMIN_PORT}" != "30448" ]; then
    echo "ERROR: NodePorts do not match expected values (Public: ${PUBLIC_PORT}, Admin: ${ADMIN_PORT})."
    echo "This will cause issues with k8s-minikube.sh integration. Please check service configuration."
    exit 1
fi

# Setup OAuth2 clients
echo "Setting up OAuth2 clients..."
sleep 10  # Give Hydra a moment to fully initialize

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
rm -rf "${CERTS_DIR}"
