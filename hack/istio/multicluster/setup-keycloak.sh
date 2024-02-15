#!/bin/bash

##############################################################################
# setup-keycloak.sh
#
# Configures the keycloak as a common identity provider for both openshift clusters.
#
##############################################################################

SCRIPT_DIR="$(cd $(dirname "${BASH_SOURCE[0]}") && pwd)"
source ${SCRIPT_DIR}/env.sh $*

# backdoor delete functionality - set "DELETE_KEYCLOAK" to "true" to have this script delete things rather than install them
if [ "${DELETE_KEYCLOAK:-}" == "true" ]; then
  echo "DELETING KEYCLOAK / OIDC FROM CLUSTER 1"
  helm uninstall --kube-context "${CLUSTER1_CONTEXT}" -n keycloak postgresql
  kubectl --context "${CLUSTER1_CONTEXT}" delete --ignore-not-found=true namespace keycloak
  kubectl --context "${CLUSTER1_CONTEXT}" delete --ignore-not-found=true -n openshift-config secret openid-client-secret
  kubectl --context "${CLUSTER1_CONTEXT}" delete --ignore-not-found=true -n openshift-config cm keycloak-oidc-client-ca-cert
  OPENID_PROVIDER_INDEX=$(kubectl --context "${CLUSTER1_CONTEXT}" get oauth cluster -o json  | jq '.spec.identityProviders | map(.name == "openid") | index(true)')
  if [ "${OPENID_PROVIDER_INDEX}" != "null" -a "${OPENID_PROVIDER_INDEX}" != "" ]; then
    kubectl --context "${CLUSTER1_CONTEXT}" patch oauth cluster --type=json -p '[{"op": "remove", "path": "/spec/identityProviders/'${OPENID_PROVIDER_INDEX}'"}]'
    echo "Identity Provider removed from cluster 1"
  else
    echo "Identity Provider already gone from cluster 1"
  fi

  echo "DELETING KEYCLOAK / OIDC FROM CLUSTER 2"
  kubectl --context "${CLUSTER2_CONTEXT}" delete --ignore-not-found=true -n openshift-config secret openid-client-secret
  kubectl --context "${CLUSTER2_CONTEXT}" delete --ignore-not-found=true -n openshift-config cm keycloak-oidc-client-ca-cert
  OPENID_PROVIDER_INDEX=$(kubectl --context "${CLUSTER2_CONTEXT}" get oauth cluster -o json  | jq '.spec.identityProviders | map(.name == "openid") | index(true)')
  if [ "${OPENID_PROVIDER_INDEX}" != "null" -a "${OPENID_PROVIDER_INDEX}" != "" ]; then
    kubectl --context "${CLUSTER2_CONTEXT}" patch oauth cluster --type=json -p '[{"op": "remove", "path": "/spec/identityProviders/'${OPENID_PROVIDER_INDEX}'"}]'
    echo "Identity Provider removed from cluster 2"
  else
    echo "Identity Provider already gone from cluster 2"
  fi

  echo "KEYCLOAD / OIDC HAS BEEN DELETED"
  exit 0
fi

set -e

CLUSTER1_OPENSHIFT_OAUTH_ROUTE=https://$(kubectl get routes --context "${CLUSTER1_CONTEXT}" -n openshift-authentication oauth-openshift -o jsonpath='{.spec.host}')
CLUSTER2_OPENSHIFT_OAUTH_ROUTE=https://$(kubectl get routes --context "${CLUSTER2_CONTEXT}" -n openshift-authentication oauth-openshift -o jsonpath='{.spec.host}')

# Need to create the namespace first so we can apply the openshift scc magic numbers.
kubectl --context "${CLUSTER1_CONTEXT}" get ns keycloak || kubectl --context "${CLUSTER1_CONTEXT}" create ns keycloak
SE_LINUX_LEVEL="$(kubectl --context "${CLUSTER1_CONTEXT}" get ns keycloak -o jsonpath='{.metadata.annotations.openshift\.io/sa\.scc\.mcs}')"

# Postgres is required for keycloak and it's easiest to set it up separately.
echo "Creating postgres deployment"
helm upgrade --kube-context "${CLUSTER1_CONTEXT}" --install --wait \
  --repo https://charts.bitnami.com/bitnami postgresql postgresql \
  -n keycloak --reuse-values --values - <<EOF
primary:
  persistence:
    enabled: false
  containerSecurityContext:
    runAsUser: null
    seLinuxOptions:
      level: "${SE_LINUX_LEVEL}"
  podSecurityContext:
    fsGroup: null 
auth:
  username: keycloak
  password: "${KEYCLOAK_DB_PASSWORD}"
  database: keycloak
EOF

APPS_DOMAIN=$(echo "${CLUSTER1_OPENSHIFT_OAUTH_ROUTE}" | cut -d '.' -f2-)
KEYCLOAK_HOSTNAME="keycloak-keycloak.${APPS_DOMAIN}"

echo "Creating keycloak deployment"
helm upgrade --kube-context "${CLUSTER1_CONTEXT}" --install --wait --timeout 15m \
  --namespace keycloak \
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
    level: "${SE_LINUX_LEVEL}"
  runAsUser: null
podSecurityContext:
  fsGroup: null
externalDatabase:
  host: postgresql
  database: keycloak
  user: keycloak
  password: "${KEYCLOAK_DB_PASSWORD}"
postgresql:
  enabled: false
EOF

# Create keycloak route.
echo "Creating keycloak route"
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

# Create the configmap with the CA in it for cluster 1.
kubectl --context "${CLUSTER1_CONTEXT}" create configmap keycloak-oidc-client-ca-cert --from-file=ca.crt="${INGRESS_ROUTER_CA_FILE}" -n openshift-config

# Create the configmap with the CA in it for cluster 2.
kubectl --context "${CLUSTER2_CONTEXT}" create configmap keycloak-oidc-client-ca-cert --from-file=ca.crt="${INGRESS_ROUTER_CA_FILE}" -n openshift-config

function update_cluster_idp {
  local cluster_context=$1
  # Patch the OAuth config with the keycloak idp for the west cluster.
  if [ -z "$(kubectl --context "${cluster_context}" get oauths cluster -o jsonpath='{.spec.identityProviders[?(@.name == "openid")]}')" ]; then
    echo "openid provider doesn't exist on the cluster's oauth config. Adding it..."
    # Need to check if the spec.identityProviders exists and if it doesn't then ensure it does
    # before attempting to add an item to it with the patch below otherwise the patch will fail.
    if [ -z "$(kubectl --context "${cluster_context}" get oauths cluster -o jsonpath='{.spec.identityProviders}')" ]; then
      kubectl --context "${cluster_context}" patch oauth cluster --type=json -p "$(cat <<EOF
[{
  "op": "add", 
  "path": "/spec/identityProviders", 
  "value": []
}]
EOF
)"
    fi
    kubectl --context "${cluster_context}" patch oauth cluster --type=json -p "$(cat <<EOF
[{
  "op": "add", 
  "path": "/spec/identityProviders/-", 
  "value": {
    "mappingMethod": "add", 
    "name": "openid", 
    "openID": {
      "ca": {
        "name": "keycloak-oidc-client-ca-cert"
      },
      "claims": {
        "email": ["email"], 
        "name": ["name"], 
        "preferredUsername": ["preferred_username"]
      }, 
      "clientID": "kube", 
      "clientSecret": {
        "name": "openid-client-secret"
      }, 
      "extraScopes": [], 
      "issuer": "${KEYCLOAK_ISSUER_URI}/realms/kube"
    }, 
    "type": "OpenID"
  }
}]
EOF
)"
  fi
}

update_cluster_idp "${CLUSTER1_CONTEXT}"
update_cluster_idp "${CLUSTER2_CONTEXT}"

# Wait for the auth changes to rollout.
kubectl --context "${CLUSTER1_CONTEXT}" wait --for=condition=Progressing=false clusteroperators/authentication
kubectl --context "${CLUSTER2_CONTEXT}" wait --for=condition=Progressing=false clusteroperators/authentication
