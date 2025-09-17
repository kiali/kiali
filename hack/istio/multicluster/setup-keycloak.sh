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
  kubectl --context "${CLUSTER1_CONTEXT}" delete deployment keycloak -n keycloak --ignore-not-found=true
  kubectl --context "${CLUSTER1_CONTEXT}" delete service keycloak-service -n keycloak --ignore-not-found=true
  kubectl --context "${CLUSTER1_CONTEXT}" delete statefulset postgres-db -n keycloak --ignore-not-found=true
  kubectl --context "${CLUSTER1_CONTEXT}" delete service postgres-db -n keycloak --ignore-not-found=true
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

# PostgreSQL is required for keycloak and it's easiest to set it up separately.
echo "Creating postgres deployment"
kubectl --context "${CLUSTER1_CONTEXT}" apply -n keycloak -f - <<EOF
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgres-db
  namespace: keycloak
spec:
  serviceName: postgres-db-service
  selector:
    matchLabels:
      app: postgres-db
  replicas: 1
  template:
    metadata:
      labels:
        app: postgres-db
    spec:
      securityContext:
        fsGroup: null
        seLinuxOptions:
          level: "${SE_LINUX_LEVEL}"
      containers:
        - name: postgres-db
          image: postgres:15
          securityContext:
            runAsUser: null
            seLinuxOptions:
              level: "${SE_LINUX_LEVEL}"
          ports:
            - containerPort: 5432
          env:
            - name: POSTGRES_USER
              value: keycloak
            - name: POSTGRES_PASSWORD
              value: "${KEYCLOAK_DB_PASSWORD}"
            - name: POSTGRES_DB
              value: keycloak
            - name: PGDATA
              value: /var/lib/postgresql/data/pgdata
          volumeMounts:
            - name: postgres-data
              mountPath: /var/lib/postgresql/data
  volumeClaimTemplates:
    - metadata:
        name: postgres-data
      spec:
        accessModes: ["ReadWriteOnce"]
        resources:
          requests:
            storage: 1Gi
---
apiVersion: v1
kind: Service
metadata:
  name: postgres-db
  namespace: keycloak
spec:
  selector:
    app: postgres-db
  ports:
    - port: 5432
      targetPort: 5432
  type: ClusterIP
EOF

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL to be ready..."
kubectl --context "${CLUSTER1_CONTEXT}" wait --for=condition=Ready pod -l app=postgres-db -n keycloak --timeout=300s

APPS_DOMAIN=$(echo "${CLUSTER1_OPENSHIFT_OAUTH_ROUTE}" | cut -d '.' -f2-)
KEYCLOAK_HOSTNAME="keycloak-keycloak.${APPS_DOMAIN}"

echo "Creating keycloak 26.3.2 deployment"
kubectl --context "${CLUSTER1_CONTEXT}" apply -n keycloak -f - <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: keycloak
  namespace: keycloak
spec:
  replicas: 1
  selector:
    matchLabels:
      app: keycloak
  template:
    metadata:
      labels:
        app: keycloak
    spec:
      securityContext:
        fsGroup: null
        seLinuxOptions:
          level: "${SE_LINUX_LEVEL}"
      containers:
        - name: keycloak
          image: quay.io/keycloak/keycloak:26.3.2
          args: ["start"]
          securityContext:
            runAsUser: null
            seLinuxOptions:
              level: "${SE_LINUX_LEVEL}"
          env:
            - name: KEYCLOAK_ADMIN
              value: admin
            - name: KEYCLOAK_ADMIN_PASSWORD
              value: admin
            - name: KC_DB
              value: postgres
            - name: KC_DB_URL
              value: jdbc:postgresql://postgres-db:5432/keycloak
            - name: KC_DB_USERNAME
              value: keycloak
            - name: KC_DB_PASSWORD
              value: "${KEYCLOAK_DB_PASSWORD}"
            - name: KC_HOSTNAME
              value: ${KEYCLOAK_HOSTNAME}
            - name: KC_PROXY
              value: edge
            - name: KC_HTTP_ENABLED
              value: "true"
          ports:
            - name: http
              containerPort: 8080
            - name: https
              containerPort: 8443
          readinessProbe:
            httpGet:
              path: /realms/master
              port: 8080
            initialDelaySeconds: 60
            periodSeconds: 10
          livenessProbe:
            httpGet:
              path: /realms/master
              port: 8080
            initialDelaySeconds: 120
            periodSeconds: 30
---
apiVersion: v1
kind: Service
metadata:
  name: keycloak-service
  namespace: keycloak
spec:
  selector:
    app: keycloak
  ports:
    - name: http
      port: 8080
      targetPort: 8080
    - name: https
      port: 8443
      targetPort: 8443
  type: ClusterIP
EOF

# Wait for Keycloak to be ready
echo "Waiting for Keycloak 26.3.2 to be ready..."
kubectl --context "${CLUSTER1_CONTEXT}" wait --for=condition=Available deployment/keycloak -n keycloak --timeout=600s

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

# There's not a great way to wait for the idp rollout to happen so we're going to get the current
# generation of the oauth deployment and make sure that it has been incremented indicating that
# the operator has picked up the change. From then we can use kubectl wait on the clusteroperators.
current_generation_cluster1="$(kubectl --context "${CLUSTER1_CONTEXT}" get deployments -n openshift-authentication -o jsonpath='{.metadata.generation}' oauth-openshift)"
current_generation_cluster2="$(kubectl --context "${CLUSTER2_CONTEXT}" get deployments -n openshift-authentication -o jsonpath='{.metadata.generation}' oauth-openshift)"
expected_generation_cluster1=$((current_generation_cluster1 + 1))
expected_generation_cluster2=$((current_generation_cluster2 + 1))

update_cluster_idp "${CLUSTER1_CONTEXT}"
update_cluster_idp "${CLUSTER2_CONTEXT}"

echo "Waiting for oauth deployments to be updated to the latest config change."
kubectl --context "${CLUSTER1_CONTEXT}" wait --for=jsonpath='{.metadata.generation}'="${expected_generation_cluster1}" -n openshift-authentication deployment/oauth-openshift --timeout=10m
kubectl --context "${CLUSTER2_CONTEXT}" wait --for=jsonpath='{.metadata.generation}'="${expected_generation_cluster2}" -n openshift-authentication deployment/oauth-openshift --timeout=10m

echo "Waiting for oauth config change to finish rolling out."
kubectl --context "${CLUSTER1_CONTEXT}" wait --for=condition=Progressing=false clusteroperators/authentication --timeout=5m
kubectl --context "${CLUSTER2_CONTEXT}" wait --for=condition=Progressing=false clusteroperators/authentication --timeout=5m
