#!/bin/bash

set -o nounset
set -o errexit
set -o pipefail

oc login --token=${TOKEN} --server=${OCP_API_URL} --insecure-skip-tls-verify
make test-integration -e URL=${KIALI_ROUTE}
cat tests/integration/junit-rest-report.xml
