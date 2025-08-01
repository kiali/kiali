#!/bin/bash

# This script contains utilties for setting up keycloak in a kiali dev environment.

set -e

KEYCLOAK_CERTS_DIR=""
KEYCLOAK_EXTERNAL_IP=""
SET_LIMIT_MEMORY=""
SET_REQUESTS_MEMORY=""

infomsg() {
  echo "[INFO] ${1}"
}

_CMD=""
while [[ $# -gt 0 ]]; do
  key="$1"
  case $key in
    create-ca) _CMD="create-ca"; shift ;;
    deploy) _CMD="deploy"; shift ;;
    -kcd|--keycloak-certs-dir)    KEYCLOAK_CERTS_DIR="$2";    shift;shift; ;;
    -kip|--keycloak-external-ip)    KEYCLOAK_EXTERNAL_IP="$2";    shift;shift; ;;
    -slm|--set-limit-memory)
      SET_LIMIT_MEMORY="$2"; shift; shift ;;
    -srm|--set-requests-memory)
      SET_REQUESTS_MEMORY="$2"; shift; shift ;;
    -h|--help)
      cat <<HELPMSG

$0 [option...] command

Valid options:
  -kcd|--keycloak-certs-dir
      Directory where the keycloak certs will be stored.
      Required for all commands.
  -kip|--keycloak-external-ip
      External IP address for the keycloak service.
      Required for the 'deploy' command.
  -slm|--set-limit-memory
      Add --set resources.limits.memory <value> to the helm command. Ex. resources.limits.memory=1Gi
  -srm|--set-requests-memory
      Add --set resources.requests.memory <valor>  to the helm command. Ex. resources.requests.memory=1Gi

The command must be one of:
  create-ca:        create the root CA for keycloak.
  deploy:           deploy keycloak.
HELPMSG
      exit 1
      ;;
    *)
      echo "Unknown argument [$key]. Aborting."
      exit 1
      ;;
  esac
done

# Fail if the keycloak certs dir is not set.
if [ -z "${KEYCLOAK_CERTS_DIR}" ]; then
  echo "KEYCLOAK_CERTS_DIR must be set. Aborting."
  exit 1
fi

if [ "$_CMD" = "create-ca" ]; then
  echo "Creating CA for keycloak. Files will be stored at '${KEYCLOAK_CERTS_DIR}'"

  # Generate root CA for keycloak/oidc.
  openssl genrsa -out "${KEYCLOAK_CERTS_DIR}"/root-ca-key.pem 2048

  openssl req -x509 -new -nodes -key "${KEYCLOAK_CERTS_DIR}"/root-ca-key.pem \
    -days 3650 -sha256 -out "${KEYCLOAK_CERTS_DIR}"/root-ca.pem -subj "/CN=kube-ca"
elif [ "$_CMD" = "deploy" ]; then
  echo "Deploying keycloak..."

  # Check that either ip or hostname is set and abort if not
  if [ -z "${KEYCLOAK_EXTERNAL_IP}" ]; then
    echo "KEYCLOAK_EXTERNAL_IP must be set. Aborting."
    exit 1
  fi

  KEYCLOAK_EXTERNAL_ADDRESS="${KEYCLOAK_EXTERNAL_IP}"
  
  # create the namespace first 
  kubectl get ns keycloak || kubectl create ns keycloak

  # TODO: IP vs. hostname

  cat <<EOF > "${KEYCLOAK_CERTS_DIR}"/req.cnf
[req]
req_extensions = v3_req
distinguished_name = req_distinguished_name

[req_distinguished_name]

[ v3_req ]
basicConstraints = CA:FALSE
keyUsage = nonRepudiation, digitalSignature, keyEncipherment
subjectAltName = @alt_names

[alt_names]
IP.1 = ${KEYCLOAK_EXTERNAL_ADDRESS}
EOF

  # generate private key
  openssl genrsa -out "${KEYCLOAK_CERTS_DIR}"/key.pem 2048

  # create certificate signing request
  openssl req -new -key "${KEYCLOAK_CERTS_DIR}"/key.pem -out "${KEYCLOAK_CERTS_DIR}"/csr.pem \
    -subj "/CN=kube-ca" \
    -sha256 -config "${KEYCLOAK_CERTS_DIR}"/req.cnf

  # create certificate
  openssl x509 -req -in "${KEYCLOAK_CERTS_DIR}"/csr.pem \
    -CA "${KEYCLOAK_CERTS_DIR}"/root-ca.pem -CAkey "${KEYCLOAK_CERTS_DIR}"/root-ca-key.pem \
    -CAcreateserial -sha256 -out "${KEYCLOAK_CERTS_DIR}"/cert.pem -days 3650 \
    -extensions v3_req -extfile "${KEYCLOAK_CERTS_DIR}"/req.cnf
  
  # create kube secret from the certs
  kubectl create secret tls keycloak-tls --cert="${KEYCLOAK_CERTS_DIR}"/cert.pem --key="${KEYCLOAK_CERTS_DIR}"/key.pem -n keycloak

  HELM_MEMORY_ARGS=""
  if [ -n "$SET_LIMIT_MEMORY" ]; then
    HELM_MEMORY_ARGS="$HELM_MEMORY_ARGS --set resources.limits.memory=$SET_LIMIT_MEMORY"
  fi
  if [ -n "$SET_REQUESTS_MEMORY" ]; then
    HELM_MEMORY_ARGS="$HELM_MEMORY_ARGS --set resources.requests.memory=$SET_REQUESTS_MEMORY"
  fi
  helm upgrade --install --wait --timeout 15m \
  --namespace keycloak \
  keycloak oci://registry-1.docker.io/bitnamicharts/keycloak --version 24.3.2 \
  $HELM_MEMORY_ARGS \
  --reuse-values --values - <<EOF
auth:
  createAdminUser: true
  adminUser: admin
  adminPassword: admin
  managementUser: manager
  managementPassword: manager
proxyAddressForwarding: true
postgresql:
  enabled: true
tls:
  enabled: true
  usePem: true
  existingSecret: keycloak-tls
service:
  type: LoadBalancer
EOF

  echo "Keycloak deployed. Waiting for the keycloak ingress to be ready..."
  kubectl wait --for=jsonpath='{.status.loadBalancer.ingress}' -n keycloak service/keycloak
fi
