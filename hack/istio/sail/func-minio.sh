#!/bin/bash

##########################################################
#
# Functions for managing Minio. The Minio persistent
# storage created here is assumed to be used for Tempo.
#
##########################################################

set -u

MINIO_ACCESS_KEY_ID="minio" # username
MINIO_ACCESS_KEY_SECRET="minio123" # password
MINIO_ENDPOINT="http://minio:9000"
MINIO_SECRET_NAME="tempostack-dev-minio"
MINIO_BUCKET_NAME="tempo-data"

install_minio() {
  MINIO_NAMESPACE="${1}"
  echo "Will install Minio in namespace [${MINIO_NAMESPACE}]"

  _define_minio_yaml

  # create the namespace if it does not exist yet
  ${OC} get namespace ${MINIO_NAMESPACE} &> /dev/null || ${OC} create namespace ${MINIO_NAMESPACE}

  # create all the resources
  echo "${MINIO_YAML}" | ${OC} apply --namespace ${MINIO_NAMESPACE} -f -

  # create the secret, deleting any old one that might be hanging around
  ${OC} delete --ignore-not-found=true secret --namespace ${MINIO_NAMESPACE} ${MINIO_SECRET_NAME}
  ${OC} create secret generic --namespace ${MINIO_NAMESPACE} ${MINIO_SECRET_NAME} \
    --from-literal=bucket="${MINIO_BUCKET_NAME}" \
    --from-literal=endpoint="${MINIO_ENDPOINT}" \
    --from-literal=access_key_id="${MINIO_ACCESS_KEY_ID}" \
    --from-literal=access_key_secret="${MINIO_ACCESS_KEY_SECRET}"

  echo "Waiting for the Minio deployment to start"
  ${OC} rollout status deployment --timeout=5m --watch=true -l app=minio
}

delete_minio() {
  MINIO_NAMESPACE="${1}"
  echo "Will delete Minio found in namespace [${MINIO_NAMESPACE}]"

  _define_minio_yaml

  # remove the resources but do not delete the namespace, it may be used by other Tempo related things
  echo "${MINIO_YAML}" | ${OC} delete --ignore-not-found=true --namespace ${MINIO_NAMESPACE} -f -
  ${OC} delete --ignore-not-found=true secret --namespace ${MINIO_NAMESPACE} ${MINIO_SECRET_NAME}
}

_define_minio_yaml() {
  MINIO_YAML="$(cat <<EOM
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  # This name uniquely identifies the PVC. Will be used in deployment below.
  name: minio-pv-claim
  labels:
    app: minio
spec:
  # Read more about access modes here: http://kubernetes.io/docs/user-guide/persistent-volumes/#access-modes
  accessModes:
  - ReadWriteOnce
  resources:
    # This is the request for storage. Should be available in the cluster.
    requests:
      storage: 256Mi
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: minio
  labels:
    app: minio
spec:
  selector:
    matchLabels:
      app: minio
  strategy:
    type: Recreate
  template:
    metadata:
      labels:
        # Label is used as selector in the service.
        app: minio
    spec:
      # Refer to the PVC created earlier
      volumes:
      - name: storage
        persistentVolumeClaim:
          # Name of the PVC created earlier
          claimName: minio-pv-claim
      initContainers:
      - name: create-buckets
        image: quay.io/official-images/busybox:1.28
        command:
          - "sh"
          - "-c"
          - "mkdir -p /storage/tempo-data"
        volumeMounts:
          - name: storage # must match the volume name, above
            mountPath: "/storage"
      containers:
      - name: minio
        # Pulls the latest Minio image from quay.io
        image: quay.io/minio/minio:latest
        args:
        - server
        - /storage
        - --console-address
        - ":9001"
        env:
        # Minio access key and secret key
        - name: MINIO_ROOT_USER
          value: "${MINIO_ACCESS_KEY_ID}"
        - name: MINIO_ROOT_PASSWORD
          value: "${MINIO_ACCESS_KEY_SECRET}"
        ports:
        - containerPort: 9000
        - containerPort: 9001
        volumeMounts:
        - name: storage # must match the volume name, above
          mountPath: "/storage"
---
apiVersion: v1
kind: Service
metadata:
  name: minio
  labels:
    app: minio
spec:
  type: ClusterIP
  ports:
  - port: 9000
    targetPort: 9000
    protocol: TCP
    name: api
  - port: 9001
    targetPort: 9001
    protocol: TCP
    name: console
  selector:
    app: minio
EOM
)"
}
