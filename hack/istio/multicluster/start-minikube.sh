#!/bin/bash

##############################################################################
# start-minikube.sh
#
# Starts up minikube instances for each of the 2 clusters.
#
##############################################################################

SCRIPT_DIR="$(cd $(dirname "${BASH_SOURCE[0]}") && pwd)"
source ${SCRIPT_DIR}/env.sh $*

# Remove old certs and recreate
rm -rf "${KEYCLOAK_CERTS_DIR}"
mkdir -p "${KEYCLOAK_CERTS_DIR}"

start_minikube() {
  local profile="${1}"
  local lb_addrs="${2}"
  local extra_config="${3:-}"

  if [ "${MINIKUBE_CPU}" != "" ]; then local cpu="--kubernetes-cpu ${MINIKUBE_CPU}"; fi
  if [ "${MINIKUBE_DISK}" != "" ]; then local disk="--kubernetes-disk ${MINIKUBE_DISK}"; fi
  if [ "${MINIKUBE_MEMORY}" != "" ]; then local mem="--kubernetes-memory ${MINIKUBE_MEMORY}"; fi

  "${K8S_MINIKUBE_SCRIPT}"                   \
    --minikube-profile "${profile}"          \
    --load-balancer-addrs "${lb_addrs}"      \
    --kubernetes-driver "${MINIKUBE_DRIVER}" \
    -mf "${extra_config}"                    \
    ${cpu:-} ${disk:-} ${mem:-}              \
    start

  if [ "$?" != "0" ]; then
    echo "Failed to start minikube for cluster [${profile}]"
    exit 1
  fi
}

# Find the hack script to be used to start minikube
K8S_MINIKUBE_SCRIPT=${SCRIPT_DIR}/../../k8s-minikube.sh
if [  -x "${K8S_MINIKUBE_SCRIPT}" ]; then
  echo "Minikube start script: ${K8S_MINIKUBE_SCRIPT}"
else
  echo "Cannot find the minikube start script at: ${K8S_MINIKUBE_SCRIPT}"
  exit 1
fi

# Generate root CA for keycloak/oidc.
"${SCRIPT_DIR}"/../../keycloak.sh create-ca --keycloak-certs-dir "${KEYCLOAK_CERTS_DIR}"

# First start a minikube cluster without kubernetes to both copy over the certs and get the IP
echo "==== START MINIKUBE FOR CLUSTER #1 [${CLUSTER1_NAME}] - ${CLUSTER1_CONTEXT} without kubernetes"
start_minikube "${CLUSTER1_NAME}" "70-84" "--no-kubernetes=true"

MINIKUBE_KEYCLOAK_CERTS_DIR=/var/lib/minikube/certs/keycloak
# Copy certs
minikube ssh -p "${CLUSTER1_NAME}" sudo mkdir "${MINIKUBE_KEYCLOAK_CERTS_DIR}"
for f in "${KEYCLOAK_CERTS_DIR}"/*
do
  echo "Copying ${f} to minikube"
  minikube cp "${f}" "${MINIKUBE_KEYCLOAK_CERTS_DIR}/$(basename "${f}")" -p "${CLUSTER1_NAME}"
done

# Then get the IP
MINIKUBE_IP_DASHED=$(minikube ip -p "${CLUSTER1_NAME}" | sed 's/\./-/g')
KEYCLOAK_HOSTNAME="keycloak-${MINIKUBE_IP_DASHED}.nip.io"

# Now generate the oidc server cert from the root CA
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
DNS.1 = ${KEYCLOAK_HOSTNAME}
EOF

# generate private key
openssl genrsa -out "${KEYCLOAK_CERTS_DIR}"/key.pem 2048

# create certificate signing request
openssl req -new -key "${KEYCLOAK_CERTS_DIR}"/key.pem -out "${KEYCLOAK_CERTS_DIR}"/csr.pem \
  -subj "/CN=kube-ca" \
  -addext "subjectAltName = DNS:${KEYCLOAK_HOSTNAME}" \
  -sha256 -config "${KEYCLOAK_CERTS_DIR}"/req.cnf

# create certificate
openssl x509 -req -in "${KEYCLOAK_CERTS_DIR}"/csr.pem \
  -CA "${KEYCLOAK_CERTS_DIR}"/root-ca.pem -CAkey "${KEYCLOAK_CERTS_DIR}"/root-ca-key.pem \
  -CAcreateserial -sha256 -out "${KEYCLOAK_CERTS_DIR}"/cert.pem -days 3650 \
  -extensions v3_req -extfile "${KEYCLOAK_CERTS_DIR}"/req.cnf

# Restart with kubernetes
minikube stop -p "${CLUSTER1_NAME}"
echo "==== START MINIKUBE FOR CLUSTER #1 [${CLUSTER1_NAME}] - ${CLUSTER1_CONTEXT}"
start_minikube "${CLUSTER1_NAME}" "70-84" "--extra-config=apiserver.oidc-issuer-url=https://${KEYCLOAK_HOSTNAME}/realms/kube --extra-config=apiserver.oidc-ca-file=${MINIKUBE_KEYCLOAK_CERTS_DIR}/root-ca.pem --extra-config=apiserver.oidc-client-id=kube --extra-config=apiserver.oidc-groups-claim=groups --extra-config=apiserver.oidc-username-prefix=oidc: --extra-config=apiserver.oidc-groups-prefix=oidc: --extra-config=apiserver.oidc-username-claim=preferred_username"

# Wait for ingress to become ready before deploying keycloak since keycloak relies on it.
${CLIENT_EXE} rollout status deployment/ingress-nginx-controller -n ingress-nginx

# Note the specific image for keycloak. There are issues with 22+ that are not yet resolved.
# See: https://github.com/kiali/kiali/issues/6455.
helm upgrade --install --wait --timeout 15m \
  --namespace keycloak --create-namespace \
  --repo https://charts.bitnami.com/bitnami keycloak keycloak \
  --reuse-values --values - <<EOF
auth:
  createAdminUser: true
  adminUser: admin
  adminPassword: admin
  managementUser: manager
  managementPassword: manager
image:
  tag: 21.1.2-debian-11-r4
proxyAddressForwarding: true
ingress:
  enabled: true
  hostname: ${KEYCLOAK_HOSTNAME}
  annotations:
    kubernetes.io/ingress.class: nginx
  tls: true
  extraTls:
  - hosts:
    - ${KEYCLOAK_HOSTNAME}
    secretName: keycloak.kind.cluster-tls
postgresql:
  enabled: true
  postgresqlPassword: password
EOF

# create secret used by keycloak ingress
${CLIENT_EXE} create secret tls -n keycloak keycloak.kind.cluster-tls \
  --cert="${KEYCLOAK_CERTS_DIR}"/cert.pem \
  --key="${KEYCLOAK_CERTS_DIR}"/key.pem

# Before proceeding with the rest of the keycloak setup, we need to start the second cluster so that we can get the IP
# and add it to the redirect URI of the kube client in keycloak.

CLUSTER1_IP=$(minikube ip -p "${CLUSTER1_NAME}")

# Now start the west cluster, copy over certs, restart with certs and options.
# First start a minikube cluster without kubernetes to both copy over the certs and get the IP
echo "==== START MINIKUBE FOR CLUSTER #2 [${CLUSTER2_NAME}] - ${CLUSTER2_CONTEXT} without kubernetes"
start_minikube "${CLUSTER2_NAME}" "85-98" "--no-kubernetes=true --network=mk-${CLUSTER1_NAME}"

# Copy certs
minikube ssh -p "${CLUSTER2_NAME}" sudo mkdir "${MINIKUBE_KEYCLOAK_CERTS_DIR}"
for f in "${KEYCLOAK_CERTS_DIR}"/*
do
  echo "Copying ${f} to minikube"
  minikube cp "${f}" "${MINIKUBE_KEYCLOAK_CERTS_DIR}/$(basename "${f}")" -p "${CLUSTER2_NAME}"
done

CLUSTER2_IP=$(minikube ip -p "${CLUSTER2_NAME}")

# Give the ingress some time to be ready
${CLIENT_EXE} wait ingress/keycloak -n keycloak --context "${CLUSTER1_CONTEXT}" --for=jsonpath='{.status.loadBalancer.ingress[*].ip}'="${CLUSTER1_IP}"

# Get a token from keycloak to use the admin api
TOKEN_KEY=$(curl -k -X POST https://"${KEYCLOAK_HOSTNAME}"/realms/master/protocol/openid-connect/token \
            -d grant_type=password \
            -d client_id=admin-cli \
            -d username=admin \
            -d password=admin \
            -d scope=openid \
            -d response_type=id_token | jq -r '.access_token')

# Replace the redirect URI with the minikube ip. Create the realm.
jq ".clients[] |= if .clientId == \"kube\" then .redirectUris = [\"https://${CLUSTER1_IP}/kiali/*\", \"https://${CLUSTER2_IP}/kiali/*\"] else . end" < "${SCRIPT_DIR}"/realm-export-template.json | curl -k -L https://"${KEYCLOAK_HOSTNAME}"/admin/realms -H "Authorization: Bearer $TOKEN_KEY" -H "Content-Type: application/json" -X POST -d @-

# Create the kiali user
curl -k -L https://"${KEYCLOAK_HOSTNAME}"/admin/realms/kube/users -H "Authorization: Bearer $TOKEN_KEY" -d '{"username": "kiali", "enabled": true, "credentials": [{"type": "password", "value": "kiali"}]}' -H 'Content-Type: application/json'

# Restart with kubernetes
minikube stop -p "${CLUSTER2_NAME}"
echo "==== START MINIKUBE FOR CLUSTER #2 [${CLUSTER2_NAME}] - ${CLUSTER2_CONTEXT}"
start_minikube "${CLUSTER2_NAME}" "85-98" "--network=mk-${CLUSTER1_NAME} --extra-config=apiserver.oidc-issuer-url=https://${KEYCLOAK_HOSTNAME}/realms/kube --extra-config=apiserver.oidc-ca-file=${MINIKUBE_KEYCLOAK_CERTS_DIR}/root-ca.pem --extra-config=apiserver.oidc-client-id=kube --extra-config=apiserver.oidc-groups-claim=groups --extra-config=apiserver.oidc-username-prefix=oidc: --extra-config=apiserver.oidc-groups-prefix=oidc: --extra-config=apiserver.oidc-username-claim=preferred_username"
