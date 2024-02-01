#!/bin/bash

##############################################################################
# setup-keycloak.sh
#
# Configures the keycloak as a common identity provider for both openshift clusters.
#
##############################################################################

SCRIPT_DIR="$(cd $(dirname "${BASH_SOURCE[0]}") && pwd)"
source ${SCRIPT_DIR}/env.sh $*

set -e

CLUSTER1_OPENSHIFT_OAUTH_ROUTE=https://$(kubectl get routes --context "${CLUSTER1_CONTEXT}" -n openshift-authentication oauth-openshift -o jsonpath='{.spec.host}')
CLUSTER2_OPENSHIFT_OAUTH_ROUTE=https://$(kubectl get routes --context "${CLUSTER2_CONTEXT}" -n openshift-authentication oauth-openshift -o jsonpath='{.spec.host}')

# Postgres is required for keycloak and it's easiest to set it up separately.
helm upgrade --kube-context "${CLUSTER1_CONTEXT}" --create-namespace --install --wait keycloak-postgresql oci://registry-1.docker.io/bitnamicharts/postgresql -n keycloak --reuse-values --values - <<EOF
primary:
  persistence:
    enabled: false
  containerSecurityContext:
    runAsUser: null
    seLinuxOptions:
      level: "s0:c26,c15"
  podSecurityContext:
    fsGroup: null 
auth:
  username: keycloak
  password: "${KEYCLOAK_DB_PASSWORD}"
  database: keycloak
EOF

APPS_DOMAIN=$(echo "${CLUSTER1_OPENSHIFT_OAUTH_ROUTE}" | cut -d '.' -f2-)
KEYCLOAK_HOSTNAME="keycloak-keycloak.${APPS_DOMAIN}"

helm upgrade --kube-context "${CLUSTER1_CONTEXT}" --install --wait --timeout 15m \
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
containerSecurityContext:
  seLinuxOptions:
    level: s0:c26,c15
  runAsUser: null
podSecurityContext:
  fsGroup: null
externalDatabase:
  host: keycloak-postgresql
  database: keycloak
  user: keycloak
  password: "${KEYCLOAK_DB_PASSWORD}"
postgresql:
  enabled: false
EOF

# Create keycloak route.
kubectl --context "${CLUSTER1_CONTEXT}" apply -f - <<EOF
apiVersion: route.openshift.io/v1
kind: Route
metadata:
  name: keycloak
  namespace: keycloak
spec:
  tls:
    insecureEdgeTerminationPolicy: Redirect
    termination: edge
  to:
    kind: Service
    name: keycloak
EOF

ADMIN_USERNAME="admin"
ADMIN_PASSWORD=$(kubectl get secret --context "${CLUSTER1_CONTEXT}" --namespace keycloak keycloak -o jsonpath="{.data.admin-password}" | base64 -d)

# Create user and realm in keycloak
# Get a token from keycloak to use the admin api
echo "Getting token from keycloak"
TOKEN_KEY=$(curl -k -X POST https://"${KEYCLOAK_HOSTNAME}"/realms/master/protocol/openid-connect/token \
            -d grant_type=password \
            -d client_id=admin-cli \
            -d username="${ADMIN_USERNAME}" \
            -d password="${ADMIN_PASSWORD}" \
            -d scope=openid \
            -d response_type=id_token | jq -r '.access_token')

# Replace the redirect URI with both clusters' oauth servers. Create the realm.
echo "Creating kube realm"
jq ".clients[] |= if .clientId == \"kube\" then .redirectUris = [\"${CLUSTER1_OPENSHIFT_OAUTH_ROUTE}/*\", \"${CLUSTER2_OPENSHIFT_OAUTH_ROUTE}/*\"] else . end" < "${SCRIPT_DIR}"/realm-export-template.json | curl -k -L https://"${KEYCLOAK_HOSTNAME}"/admin/realms -H "Authorization: Bearer $TOKEN_KEY" -H "Content-Type: application/json" -X POST -d @-

# Create the kiali user
curl -k -L https://"${KEYCLOAK_HOSTNAME}"/admin/realms/kube/users -H "Authorization: Bearer $TOKEN_KEY" -d "{\"username\": \"kiali\", \"enabled\": true, \"credentials\": [{\"type\": \"password\", \"value\": \"${KIALI_USER_PASSWORD}\"}]}" -H 'Content-Type: application/json'

# Get the openshift router CA for the cluster that keycloak is running on.
INGRESS_ROUTER_CA_FILE=$(mktemp)
kubectl get secrets --context "${CLUSTER1_CONTEXT}" -n openshift-ingress-operator router-ca -o jsonpath='{.data.tls\.crt}' | base64 --decode > "${INGRESS_ROUTER_CA_FILE}"

# Create the keycloak kube client secret on the clusters in openshift-config.
kubectl --context "${CLUSTER1_CONTEXT}" apply -f - <<EOF
apiVersion: v1
stringData:
  clientSecret: "${KEYCLOAK_KUBE_CLIENT_SECRET}"
kind: Secret
metadata:
  name: openid-client-secret
  namespace: openshift-config
type: Opaque
EOF

kubectl --context "${CLUSTER2_CONTEXT}" apply -f - <<EOF
apiVersion: v1
stringData:
  clientSecret: "${KEYCLOAK_KUBE_CLIENT_SECRET}"
kind: Secret
metadata:
  name: openid-client-secret
  namespace: openshift-config
type: Opaque
EOF

KEYCLOAK_ISSUER_URI="https://keycloak-keycloak.${APPS_DOMAIN}"

# Create the configmap with the CA in it for the east cluster.
kubectl --context "${CLUSTER1_CONTEXT}" create configmap keycloak-oidc-client-ca-cert --from-file=ca.crt="${INGRESS_ROUTER_CA_FILE}" -n openshift-config
# Patch the OAuth config with the keycloak idp for the east cluster.
kubectl --context "${CLUSTER1_CONTEXT}" patch oauth cluster --type=json -p="[{\"op\": \"replace\", \"path\": \"/spec/identityProviders\", \"value\": [{\"mappingMethod\": \"claim\", \"name\": \"openid\", \"openID\": {\"ca\": {\"name\": \"keycloak-oidc-client-ca-cert\"}, \"claims\": {\"email\": [\"email\"], \"name\": [\"name\"], \"preferredUsername\": [\"preferred_username\"]}, \"clientID\": \"kube\", \"clientSecret\": {\"name\": \"openid-client-secret\"}, \"extraScopes\": [], \"issuer\": \"${KEYCLOAK_ISSUER_URI}/realms/kube\"}, \"type\": \"OpenID\"}]}]"

# Create the configmap with the CA in it for the west cluster.
kubectl --context "${CLUSTER2_CONTEXT}" create configmap keycloak-oidc-client-ca-cert --from-file=ca.crt="${INGRESS_ROUTER_CA_FILE}" -n openshift-config

# Patch the OAuth config with the keycloak idp for the west cluster.
kubectl --context "${CLUSTER2_CONTEXT}" patch oauth cluster --type=json -p="[{\"op\": \"replace\", \"path\": \"/spec/identityProviders\", \"value\": [{\"mappingMethod\": \"claim\", \"name\": \"openid\", \"openID\": {\"ca\": {\"name\": \"keycloak-oidc-client-ca-cert\"}, \"claims\": {\"email\": [\"email\"], \"name\": [\"name\"], \"preferredUsername\": [\"preferred_username\"]}, \"clientID\": \"kube\", \"clientSecret\": {\"name\": \"openid-client-secret\"}, \"extraScopes\": [], \"issuer\": \"${KEYCLOAK_ISSUER_URI}/realms/kube\"}, \"type\": \"OpenID\"}]}]"
