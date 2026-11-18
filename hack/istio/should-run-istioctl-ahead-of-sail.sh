#!/bin/bash

# Compare Sail vs upstream Istio test versions for optional istioctl CI (see test-istio-version.yml).

set -euo pipefail

##############################################################################
# should-run-istioctl-ahead-of-sail.sh
#
# Compares the newest testable Istio minor from Sail Operator releases with
# upstream istio/istio (offset 0). When upstream's minor is greater than Sail's
# (patch level is ignored), prints the upstream Istio version to stdout for an
# extra CI run using istioctl. Exit 0 when applicable, exit 1 when skipped.
##############################################################################

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

SAIL_VER="$("${SCRIPT_DIR}/determine-test-istio-version.sh" --source sail --offset 0)"
ISTIO_VER="$("${SCRIPT_DIR}/determine-test-istio-version.sh" --source istio --offset 0)"

istio_minor() {
  printf '%s\n' "$1" | sed -E 's/^([0-9]+)\.([0-9]+).*/\1.\2/'
}

SAIL_MINOR="$(istio_minor "${SAIL_VER}")"
ISTIO_MINOR="$(istio_minor "${ISTIO_VER}")"

echo "Sail operator version (source=sail, offset=0): ${SAIL_VER} (minor ${SAIL_MINOR})" >&2
echo "Upstream Istio version (source=istio, offset=0): ${ISTIO_VER} (minor ${ISTIO_MINOR})" >&2

LOWER_MINOR="$(printf '%s\n' "${SAIL_MINOR}" "${ISTIO_MINOR}" | sort -V | head -n 1)"
if [ "${LOWER_MINOR}" = "${SAIL_MINOR}" ] && [ "${SAIL_MINOR}" != "${ISTIO_MINOR}" ]; then
  echo "Upstream Istio minor is ahead of Sail; istioctl test run is applicable." >&2
  printf '%s\n' "${ISTIO_VER}"
  exit 0
fi

echo "Sail minor is not behind upstream Istio; skipping istioctl-ahead run." >&2
exit 1