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
      Set memory limits for Keycloak. Ex. 1Gi
  -srm|--set-requests-memory
      Set memory requests for Keycloak. Ex. 1Gi

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

  # Deploy PostgreSQL database first
  echo "Deploying PostgreSQL database..."
  kubectl apply -n keycloak -f - <<EOF
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
      containers:
        - name: postgres-db
          image: postgres:15
          ports:
            - containerPort: 5432
          env:
            - name: POSTGRES_USER
              value: keycloak
            - name: POSTGRES_PASSWORD
              value: keycloak
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
  kubectl wait --for=condition=Ready pod -l app=postgres-db -n keycloak --timeout=300s

  # Build memory resource specifications
  MEMORY_LIMITS=""
  MEMORY_REQUESTS=""
  if [ -n "$SET_LIMIT_MEMORY" ]; then
    MEMORY_LIMITS="            limits:
              memory: $SET_LIMIT_MEMORY"
  fi
  if [ -n "$SET_REQUESTS_MEMORY" ]; then
    MEMORY_REQUESTS="            requests:
              memory: $SET_REQUESTS_MEMORY"
  fi

  # Deploy Keycloak using official image version 26.3.2
  echo "Deploying Keycloak 26.3.2..."
  kubectl apply -n keycloak -f - <<EOF
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
      containers:
        - name: keycloak
          image: quay.io/keycloak/keycloak:26.3.2
          args: ["start"]
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
              value: keycloak
            - name: KC_HOSTNAME
              value: ${KEYCLOAK_EXTERNAL_ADDRESS}
            - name: KC_PROXY
              value: edge
            - name: KC_HTTP_ENABLED
              value: "true"
            - name: KC_HTTPS_CERTIFICATE_FILE
              value: /opt/keycloak/conf/tls.crt
            - name: KC_HTTPS_CERTIFICATE_KEY_FILE
              value: /opt/keycloak/conf/tls.key
          ports:
            - name: http
              containerPort: 8080
            - name: https
              containerPort: 8443
          volumeMounts:
            - name: keycloak-tls-certs
              mountPath: /opt/keycloak/conf
              readOnly: true
          resources:
$MEMORY_LIMITS
$MEMORY_REQUESTS
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
      volumes:
        - name: keycloak-tls-certs
          secret:
            secretName: keycloak-tls
---
apiVersion: v1
kind: Service
metadata:
  name: keycloak
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
  type: LoadBalancer
EOF

  echo "Keycloak 26.3.2 deployed. Waiting for Keycloak to be ready..."
  kubectl wait --for=condition=Available deployment/keycloak -n keycloak --timeout=600s
  
  echo "Waiting for Keycloak service to get LoadBalancer IP..."
  kubectl wait --for=jsonpath='{.status.loadBalancer.ingress}' -n keycloak service/keycloak --timeout=300s
fi
