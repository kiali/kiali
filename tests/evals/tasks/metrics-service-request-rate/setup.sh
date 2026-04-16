#!/usr/bin/env bash
set -euo pipefail
# Generate inbound traffic to productpage so request/error rate metrics are populated.
NS="bookinfo"
JOB="gevals-mcp-productpage-metrics"
kubectl -n "${NS}" delete job "${JOB}" --ignore-not-found
kubectl apply -f - <<EOF
apiVersion: batch/v1
kind: Job
metadata:
  labels:
    gevals.kiali.io/test: gevals-testing
  name: ${JOB}
  namespace: ${NS}
spec:
  backoffLimit: 0
  ttlSecondsAfterFinished: 600
  template:
    spec:
      containers:
      - command:
        - sh
        - -c
        - |
          set -e
          for i in \$(seq 1 90); do
            curl -sS -o /dev/null --connect-timeout 2 \
              http://productpage.bookinfo.svc.cluster.local:9080/productpage || true
            sleep 1
          done
        image: curlimages/curl:8.5.0
        name: curl
      restartPolicy: Never
EOF
sleep 15
