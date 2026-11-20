#!/bin/bash

# Conditional Test Istio Version N run: only when upstream Istio tip is an RC.

set -euo pipefail

##############################################################################
# should-run-istioctl-ahead-of-sail.sh
#
# Runs determine-test-istio-version.sh --check-rc. When the newest Istio tip is
# an RC (no GA yet for that minor), prints that RC to stdout for the Test Istio
# Version cron to install with istioctl (sail=false).
# Exit 0 when applicable, exit 1 when skipped.
##############################################################################

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

exec "${SCRIPT_DIR}/determine-test-istio-version.sh" --check-rc "$@"
