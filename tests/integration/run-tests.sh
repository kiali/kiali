#!/bin/bash

set -o nounset
set -o errexit
set -o pipefail

oc login --token=${TOKEN} --server=${OCP_API_URL} --insecure-skip-tls-verify
make test-integration -e URL="https://$(oc get route -n istio-system kiali -o 'jsonpath={.spec.host}')"
cat tests/integration/junit-rest-report.xml
