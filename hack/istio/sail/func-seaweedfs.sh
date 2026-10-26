#!/bin/bash

##########################################################
#
# Functions for managing SeaweedFS. The SeaweedFS storage
# created here is assumed to be used for Tempo.
#
##########################################################

set -u

SEAWEEDFS_ACCESS_KEY_ID="seaweedfs"
SEAWEEDFS_ACCESS_KEY_SECRET="seaweedfs123"
SEAWEEDFS_ENDPOINT="http://seaweedfs:8333"
SEAWEEDFS_SECRET_NAME="tempostack-dev-seaweedfs"
SEAWEEDFS_BUCKET_NAME="tempo-data"
SEAWEEDFS_IMAGE="ghcr.io/chrislusf/seaweedfs:4.47"

install_seaweedfs() {
  SEAWEEDFS_NAMESPACE="${1}"
  infomsg "Will install SeaweedFS in namespace [${SEAWEEDFS_NAMESPACE}]"

  _define_seaweedfs_yaml

  ${OC} get namespace ${SEAWEEDFS_NAMESPACE} &> /dev/null || ${OC} create namespace ${SEAWEEDFS_NAMESPACE}

  echo "${SEAWEEDFS_YAML}" | ${OC} apply --namespace ${SEAWEEDFS_NAMESPACE} -f -

  ${OC} delete --ignore-not-found=true secret --namespace ${SEAWEEDFS_NAMESPACE} ${SEAWEEDFS_SECRET_NAME}
  ${OC} create secret generic --namespace ${SEAWEEDFS_NAMESPACE} ${SEAWEEDFS_SECRET_NAME} \
    --from-literal=bucket="${SEAWEEDFS_BUCKET_NAME}" \
    --from-literal=endpoint="${SEAWEEDFS_ENDPOINT}" \
    --from-literal=access_key_id="${SEAWEEDFS_ACCESS_KEY_ID}" \
    --from-literal=access_key_secret="${SEAWEEDFS_ACCESS_KEY_SECRET}"

  infomsg "Waiting for the SeaweedFS deployment to start"
  ${OC} rollout status deployment --timeout=5m --watch=true -l app=seaweedfs
}

delete_seaweedfs() {
  SEAWEEDFS_NAMESPACE="${1}"
  infomsg "Will delete SeaweedFS found in namespace [${SEAWEEDFS_NAMESPACE}]"

  _define_seaweedfs_yaml

  echo "${SEAWEEDFS_YAML}" | ${OC} delete --ignore-not-found=true --namespace ${SEAWEEDFS_NAMESPACE} -f -
  ${OC} delete --ignore-not-found=true secret --namespace ${SEAWEEDFS_NAMESPACE} ${SEAWEEDFS_SECRET_NAME}
}

_define_seaweedfs_yaml() {
  SEAWEEDFS_YAML="$(cat <<EOM
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: seaweedfs-pv-claim
  labels:
    app: seaweedfs
spec:
  accessModes:
  - ReadWriteOnce
  resources:
    requests:
      storage: 256Mi
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: seaweedfs
  labels:
    app: seaweedfs
spec:
  selector:
    matchLabels:
      app: seaweedfs
  strategy:
    type: Recreate
  template:
    metadata:
      labels:
        app: seaweedfs
    spec:
      volumes:
      - name: storage
        persistentVolumeClaim:
          claimName: seaweedfs-pv-claim
      containers:
      - name: seaweedfs
        image: ${SEAWEEDFS_IMAGE}
        args:
        - mini
        - -dir=/data
        - -admin.port=12646
        - -master.telemetry=false
        env:
        - name: AWS_ACCESS_KEY_ID
          value: "${SEAWEEDFS_ACCESS_KEY_ID}"
        - name: AWS_SECRET_ACCESS_KEY
          value: "${SEAWEEDFS_ACCESS_KEY_SECRET}"
        - name: S3_BUCKET
          value: "${SEAWEEDFS_BUCKET_NAME}"
        ports:
        - containerPort: 8333
          name: s3
        readinessProbe:
          tcpSocket:
            port: 8333
          initialDelaySeconds: 10
          periodSeconds: 5
        livenessProbe:
          tcpSocket:
            port: 8333
          initialDelaySeconds: 10
          periodSeconds: 5
        volumeMounts:
        - name: storage
          mountPath: /data
---
apiVersion: v1
kind: Service
metadata:
  name: seaweedfs
  labels:
    app: seaweedfs
spec:
  type: ClusterIP
  ports:
  - port: 8333
    targetPort: 8333
    protocol: TCP
    name: s3
  selector:
    app: seaweedfs
EOM
)"
}
