#!/bin/bash

# Generates TLS certificates for Hydra with cluster IP and nip.io support

set -e

# Default values
HOSTNAME="hydra.example.com"
CLUSTER_IP=""
CERT_DIR="ssl"
EXTRA_HOSTS=""

helpmsg() {
  cat <<HELP
This script generates TLS certificates for Ory Hydra.

Options:

-cd|--cert-dir <directory>
    Directory where certificates will be generated.
    Default: ssl

-ci|--cluster-ip <ip>
    Cluster IP address to include in certificate SAN.
    Default: <none>

-eh|--extra-hosts <hosts>
    Comma-separated list of additional hostnames to include in certificate SAN.
    Example: --extra-hosts "hydra-admin-ory.apps.example.com,hydra-ui-ory.apps.example.com"
    Default: <none>

-hn|--hostname <hostname>
    Hostname for the certificate.
    Default: hydra.example.com

-h|--help
    Show this help message.
HELP
}

# Process command line arguments
while [[ $# -gt 0 ]]; do
  key="$1"
  case $key in
    -cd|--cert-dir)   CERT_DIR="$2";    shift;shift; ;;
    -ci|--cluster-ip) CLUSTER_IP="$2";  shift;shift; ;;
    -eh|--extra-hosts) EXTRA_HOSTS="$2"; shift;shift; ;;
    -hn|--hostname)   HOSTNAME="$2";    shift;shift; ;;
    -h|--help)        helpmsg;           exit 0       ;;
    *) echo "Unknown argument: [$key]. Aborting."; helpmsg; exit 1 ;;
  esac
done

echo "=== Ory Hydra Certificate Generation ==="
echo "Hostname: ${HOSTNAME}"
echo "Cluster IP: ${CLUSTER_IP}"
echo "Extra Hosts: ${EXTRA_HOSTS}"
echo "Certificate Directory: ${CERT_DIR}"
echo ""

# Create certificate directory
mkdir -p "${CERT_DIR}"

# Build Subject Alternative Names
SAN_ENTRIES="DNS.1 = ${HOSTNAME}"
SAN_COUNT=1
IP_COUNT=0

# Add extra hosts if provided (comma-separated)
if [[ -n "${EXTRA_HOSTS}" ]]; then
    IFS=',' read -ra EXTRA_HOST_ARRAY <<< "${EXTRA_HOSTS}"
    for extra_host in "${EXTRA_HOST_ARRAY[@]}"; do
        extra_host=$(echo "${extra_host}" | xargs) # trim whitespace
        if [[ -n "${extra_host}" ]]; then
            SAN_COUNT=$((SAN_COUNT + 1))
            SAN_ENTRIES="${SAN_ENTRIES}
DNS.${SAN_COUNT} = ${extra_host}"
            echo "Adding extra host ${extra_host} to certificate"
        fi
    done
fi

# Add cluster IP if provided
if [[ -n "${CLUSTER_IP}" ]]; then
    IP_COUNT=$((IP_COUNT + 1))
    SAN_ENTRIES="${SAN_ENTRIES}
IP.${IP_COUNT} = ${CLUSTER_IP}"
    echo "Adding cluster IP ${CLUSTER_IP} to certificate"

    # Add nip.io hostname for external access
    HOSTNAME_DASHED=$(echo "${CLUSTER_IP}" | sed 's/\./-/g')
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

# Add internal Hydra service names for OpenShift passthrough TLS
SAN_COUNT=$((SAN_COUNT + 1))
SAN_ENTRIES="${SAN_ENTRIES}
DNS.${SAN_COUNT} = hydra-public"

SAN_COUNT=$((SAN_COUNT + 1))
SAN_ENTRIES="${SAN_ENTRIES}
DNS.${SAN_COUNT} = hydra-public.ory"

SAN_COUNT=$((SAN_COUNT + 1))
SAN_ENTRIES="${SAN_ENTRIES}
DNS.${SAN_COUNT} = hydra-public.ory.svc.cluster.local"

SAN_COUNT=$((SAN_COUNT + 1))
SAN_ENTRIES="${SAN_ENTRIES}
DNS.${SAN_COUNT} = hydra-admin"

SAN_COUNT=$((SAN_COUNT + 1))
SAN_ENTRIES="${SAN_ENTRIES}
DNS.${SAN_COUNT} = hydra-admin.ory"

SAN_COUNT=$((SAN_COUNT + 1))
SAN_ENTRIES="${SAN_ENTRIES}
DNS.${SAN_COUNT} = hydra-admin.ory.svc.cluster.local"

# Add localhost IP
IP_COUNT=$((IP_COUNT + 1))
SAN_ENTRIES="${SAN_ENTRIES}
IP.${IP_COUNT} = 127.0.0.1"

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
    echo "Certificate verification successful"
else
    echo "Certificate verification failed"
    exit 1
fi

echo ""
echo "Certificate generation complete!"
echo ""
echo "Files generated in ${CERT_DIR}/ directory:"
ls -la "${CERT_DIR}/"

echo ""
echo "Certificate details:"
echo "Subject: $(openssl x509 -in "${CERT_DIR}/cert.pem" -noout -subject)"
echo "Issuer: $(openssl x509 -in "${CERT_DIR}/cert.pem" -noout -issuer)"
echo "Valid from: $(openssl x509 -in "${CERT_DIR}/cert.pem" -noout -startdate)"
echo "Valid to: $(openssl x509 -in "${CERT_DIR}/cert.pem" -noout -enddate)"

echo ""
echo "Subject Alternative Names:"
openssl x509 -in "${CERT_DIR}/cert.pem" -text -noout | grep -A 10 "Subject Alternative Name" || echo "No SAN found"

echo ""
echo "Certificate files ready for Kubernetes secret creation"
