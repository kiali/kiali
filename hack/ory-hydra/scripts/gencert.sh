#!/bin/bash

# Ory Hydra Certificate Generation Script
# Based on DEX gencert.sh pattern but adapted for Hydra with enhanced TLS support

set -e

# Parameters
HOSTNAME="${1:-hydra.example.com}"
MINIKUBE_IP="${2:-}"
CERT_DIR="${3:-ssl}"

echo "=== Ory Hydra Certificate Generation ==="
echo "Hostname: ${HOSTNAME}"
echo "Minikube IP: ${MINIKUBE_IP}"
echo "Certificate Directory: ${CERT_DIR}"
echo ""

# Create certificate directory
mkdir -p "${CERT_DIR}"

# Build Subject Alternative Names
SAN_ENTRIES="DNS.1 = ${HOSTNAME}"
SAN_COUNT=1

# Add minikube IP if provided
if [[ -n "${MINIKUBE_IP}" ]]; then
    SAN_COUNT=$((SAN_COUNT + 1))
    SAN_ENTRIES="${SAN_ENTRIES}
IP.1 = ${MINIKUBE_IP}"
    echo "Adding minikube IP ${MINIKUBE_IP} to certificate"

    # Add nip.io hostname for external access
    HOSTNAME_DASHED=$(echo "${MINIKUBE_IP}" | sed 's/\./-/g')
    SAN_COUNT=$((SAN_COUNT + 1))
    SAN_ENTRIES="${SAN_ENTRIES}
DNS.${SAN_COUNT} = ${HOSTNAME_DASHED}.nip.io"
    echo "Adding nip.io hostname ${HOSTNAME_DASHED}.nip.io to certificate"
fi

# Add localhost and common service names
SAN_COUNT=$((SAN_COUNT + 1))
SAN_ENTRIES="${SAN_ENTRIES}
DNS.${SAN_COUNT} = localhost"

SAN_COUNT=$((SAN_COUNT + 1))
SAN_ENTRIES="${SAN_ENTRIES}
DNS.${SAN_COUNT} = hydra"

SAN_COUNT=$((SAN_COUNT + 1))
SAN_ENTRIES="${SAN_ENTRIES}
DNS.${SAN_COUNT} = hydra.ory"

SAN_COUNT=$((SAN_COUNT + 1))
SAN_ENTRIES="${SAN_ENTRIES}
DNS.${SAN_COUNT} = hydra.ory.svc.cluster.local"

# Add localhost IP
SAN_ENTRIES="${SAN_ENTRIES}
IP.2 = 127.0.0.1"

echo "Certificate will include these Subject Alternative Names:"
echo "${SAN_ENTRIES}" | grep -E "^(DNS|IP)\." | sed 's/^/  /'
echo ""

# Create OpenSSL configuration
cat << EOF > "${CERT_DIR}/req.cnf"
[req]
req_extensions = v3_req
distinguished_name = req_distinguished_name
prompt = no

[req_distinguished_name]
CN = ${HOSTNAME}
O = Kiali Test Infrastructure
OU = Ory Hydra
L = Test
ST = Test
C = US

[ v3_req ]
basicConstraints = CA:FALSE
keyUsage = nonRepudiation, digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth, clientAuth
subjectAltName = @alt_names

[alt_names]
${SAN_ENTRIES}
EOF

# Generate CA private key
echo "Generating CA private key..."
openssl genrsa -out "${CERT_DIR}/ca-key.pem" 2048

# Generate CA certificate
echo "Generating CA certificate..."
openssl req -x509 -new -nodes \
    -key "${CERT_DIR}/ca-key.pem" \
    -days 30 \
    -out "${CERT_DIR}/ca.pem" \
    -subj "/CN=Kiali Test CA/O=Kiali Test Infrastructure/OU=Certificate Authority"

# Generate server private key
echo "Generating server private key..."
openssl genrsa -out "${CERT_DIR}/key.pem" 2048

# Generate certificate signing request
echo "Generating certificate signing request..."
openssl req -new \
    -key "${CERT_DIR}/key.pem" \
    -out "${CERT_DIR}/csr.pem" \
    -config "${CERT_DIR}/req.cnf"

# Generate server certificate signed by CA
echo "Generating server certificate..."
openssl x509 -req \
    -in "${CERT_DIR}/csr.pem" \
    -CA "${CERT_DIR}/ca.pem" \
    -CAkey "${CERT_DIR}/ca-key.pem" \
    -CAcreateserial \
    -out "${CERT_DIR}/cert.pem" \
    -days 30 \
    -extensions v3_req \
    -extfile "${CERT_DIR}/req.cnf"

# Verify certificate
echo "Verifying certificate..."
if openssl verify -CAfile "${CERT_DIR}/ca.pem" "${CERT_DIR}/cert.pem"; then
    echo "✅ Certificate verification successful"
else
    echo "❌ Certificate verification failed"
    exit 1
fi

echo ""
echo "🎉 Certificate generation complete!"
echo ""
echo "Files generated in ${CERT_DIR}/ directory:"
ls -la "${CERT_DIR}/"

echo ""
echo "📋 Certificate details:"
echo "Subject: $(openssl x509 -in "${CERT_DIR}/cert.pem" -noout -subject)"
echo "Issuer: $(openssl x509 -in "${CERT_DIR}/cert.pem" -noout -issuer)"
echo "Valid from: $(openssl x509 -in "${CERT_DIR}/cert.pem" -noout -startdate)"
echo "Valid to: $(openssl x509 -in "${CERT_DIR}/cert.pem" -noout -enddate)"

echo ""
echo "🔍 Subject Alternative Names:"
openssl x509 -in "${CERT_DIR}/cert.pem" -text -noout | grep -A 10 "Subject Alternative Name" || echo "No SAN found"

echo ""
echo "📁 Certificate files ready for Kubernetes secret creation"
