#!/bin/bash

# Ory Hydra Client Setup Script
# Creates OAuth2 clients required for Kiali molecule tests
# Supports minikube (nip.io URLs) and OpenShift (Route URLs)

set -e

HYDRA_ADMIN_URL="${1:-https://localhost:30448}"
HOSTNAME="${2:-hydra.example.com}"
CLUSTER_TYPE=""

# Parse optional flags
shift 2 2>/dev/null || true
while [[ $# -gt 0 ]]; do
    case "$1" in
        --cluster-type) CLUSTER_TYPE="$2"; shift 2 ;;
        *) shift ;;
    esac
done

echo "Setting up OAuth2 clients for Hydra at: ${HYDRA_ADMIN_URL}"
echo "Using hostname: ${HOSTNAME}"
echo "Cluster type: ${CLUSTER_TYPE:-auto}"

# For OpenShift, the hostname is already the Route host (no nip.io transformation needed)
# For minikube/kind, convert IP address to nip.io format (replace dots with dashes)
if [[ "${CLUSTER_TYPE}" == "openshift" ]]; then
    NIPIP_HOSTNAME="${HOSTNAME}"
    echo "Using OpenShift Route hostname: ${NIPIP_HOSTNAME}"
else
    NIPIP_HOSTNAME=$(echo "${HOSTNAME}" | sed 's/\./-/g')
    echo "Using nip.io hostname: ${NIPIP_HOSTNAME}.nip.io"
fi

# Wait for Hydra to be ready
echo "Waiting for Hydra Admin API to be ready..."
for i in {1..30}; do
    if curl -k -s "${HYDRA_ADMIN_URL}/health/ready" > /dev/null 2>&1; then
        echo "Hydra Admin API is ready!"
        break
    fi
    echo "Waiting for Hydra... (attempt $i/30)"
    sleep 2
done

# Check if Hydra is actually ready
if ! curl -k -s "${HYDRA_ADMIN_URL}/health/ready" > /dev/null 2>&1; then
    echo "ERROR: Hydra Admin API is not ready after 60 seconds"
    exit 1
fi

echo ""
echo "Creating OAuth2 clients..."

# Create kiali-app client (supports both single and multi-audience testing)
echo "Creating kiali-app client (confidential client with multi-audience support)..."

if [[ "${CLUSTER_TYPE}" == "openshift" ]]; then
    # OpenShift: Use Route-based URLs (the Kiali Route will be dynamically discovered)
    # We include wildcards and common patterns for Kiali Route URLs
    curl -k -X POST "${HYDRA_ADMIN_URL}/admin/clients" \
        -H "Content-Type: application/json" \
        -d '{
            "client_id": "kiali-app",
            "client_secret": "doNotTell",
            "client_name": "Kiali Application",
            "grant_types": ["authorization_code", "refresh_token", "client_credentials"],
            "response_types": ["code", "id_token"],
            "scope": "openid profile email groups",
            "redirect_uris": [
                "https://kiali-istio-system.'"${NIPIP_HOSTNAME#*-ory.}"'",
                "https://kiali-istio-system.'"${NIPIP_HOSTNAME#*-ory.}"'/kiali"
            ],
            "token_endpoint_auth_method": "client_secret_basic",
            "subject_type": "public",
            "audience": ["kiali-app", "additional-audience"]
        }' || echo "kiali-app client may already exist"
else
    # minikube/kind: Use nip.io URLs with NodePorts
    curl -k -X POST "${HYDRA_ADMIN_URL}/admin/clients" \
        -H "Content-Type: application/json" \
        -d '{
            "client_id": "kiali-app",
            "client_secret": "doNotTell",
            "client_name": "Kiali Application",
            "grant_types": ["authorization_code", "refresh_token", "client_credentials"],
            "response_types": ["code", "id_token"],
            "scope": "openid profile email groups",
            "redirect_uris": [
                "http://'"${NIPIP_HOSTNAME}"'.nip.io:32080/kiali",
                "https://'"${NIPIP_HOSTNAME}"'.nip.io:32080/kiali",
                "http://kiali-proxy.'"${NIPIP_HOSTNAME}"'.nip.io:30805/oauth2/callback"
            ],
            "token_endpoint_auth_method": "client_secret_basic",
            "subject_type": "public",
            "audience": ["kiali-app", "additional-audience"]
        }' || echo "kiali-app client may already exist"
fi

echo ""
echo "OAuth2 clients setup complete!"

# List all clients to verify
echo ""
echo "Verifying created clients:"
curl -k -s "${HYDRA_ADMIN_URL}/admin/clients" | jq -r '.[] | "Client ID: " + .client_id + " | Name: " + .client_name' 2>/dev/null || echo "jq not available, skipping client list verification"

echo ""
echo "OAuth2 client setup completed successfully!"