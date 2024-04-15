#!/bin/bash

METRICS_PORT="${METRICS_PORT:-9090}"
METRICS_FILE="${METRICS_FILE:-/tmp/metrics.txt}"

if [ ! -f "${METRICS_FILE}" ]; then
  echo "ERROR: Missing metrics file: ${METRICS_FILE}"
  exit 1
fi

# read in the metrics file and escape double quotes so they are retained in the output
METRICS="$(cat ${METRICS_FILE} | sed 's/"/\\"/g')"

echo "Metrics server will listen on port [${METRICS_PORT}]"

while true; do
  METRICS_RESPONSE=$(eval "echo -e \"${METRICS}\"")
  echo -e "HTTP/1.1 200 OK\nContent-Type: text/plain\n\n${METRICS_RESPONSE}" | nc -l -p ${METRICS_PORT}
done
