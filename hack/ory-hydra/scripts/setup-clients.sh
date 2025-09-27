#!/bin/bash

# Ory Hydra Client Setup Script
# Creates OAuth2 clients required for Kiali molecule tests

set -e

HYDRA_ADMIN_URL="${1:-https://localhost:30448}"
HOSTNAME="${2:-hydra.example.com}"

# Convert IP address to nip.io format (replace dots with dashes)
NIPIP_HOSTNAME=$(echo "${HOSTNAME}" | sed 's/\./-/g')

echo "Setting up OAuth2 clients for Hydra at: ${HYDRA_ADMIN_URL}"
echo "Using hostname: ${HOSTNAME}"
echo "Using nip.io hostname: ${NIPIP_HOSTNAME}.nip.io"

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

echo ""
echo "OAuth2 clients setup complete!"

# List all clients to verify
echo ""
echo "Verifying created clients:"
curl -k -s "${HYDRA_ADMIN_URL}/admin/clients" | jq -r '.[] | "Client ID: " + .client_id + " | Name: " + .client_name' 2>/dev/null || echo "jq not available, skipping client list verification"

echo ""
echo "OAuth2 client setup completed successfully!"