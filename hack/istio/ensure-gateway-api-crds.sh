#!/bin/bash
##############################################################################
# ensure-gateway-api-crds.sh
#
# Standalone script to install Gateway API CRDs if not already present.
# Can be called directly (e.g. from Cypress) or use ensure_gateway_api_crds
# from functions.sh when sourcing from other hack scripts.
#
# Usage: ensure-gateway-api-crds.sh [version]
#   version: optional, e.g. v1.5.0 (default: v1.5.0 or K8S_GATEWAY_API_VERSION)
#
##############################################################################

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/functions.sh"

CLIENT_EXE="${CLIENT_EXE:-kubectl}"
ensure_gateway_api_crds "${1:-${K8S_GATEWAY_API_VERSION}}"
