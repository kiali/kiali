#!/usr/bin/env bash
#
# Verify every MCP→Kiali endpoint declared in kubernetes-mcp-server has a
# matching integration test under tests/integration/mcp_tools/.
#
# Usage:
#   hack/mcp/check-mcp-endpoint-coverage.sh <path-to-kubernetes-mcp-server-checkout>
#   hack/mcp/check-mcp-endpoint-coverage.sh <path-to-mcp-checkout> <path-to-kiali-mcp_tools-dir>
#
set -euo pipefail

MCP_ROOT="${1:-}"
TOOLS_TEST_DIR="${2:-tests/integration/mcp_tools}"

if [[ -z "${MCP_ROOT}" || ! -d "${MCP_ROOT}" ]]; then
  echo "Usage: $0 <path-to-kubernetes-mcp-server-checkout> [mcp_tools-test-dir]" >&2
  exit 2
fi

ENDPOINTS_FILE="${MCP_ROOT}/pkg/toolsets/kiali/tools/endpoints.go"
if [[ ! -f "${ENDPOINTS_FILE}" ]]; then
  echo "ERROR: endpoints file not found: ${ENDPOINTS_FILE}" >&2
  exit 1
fi
if [[ ! -d "${TOOLS_TEST_DIR}" ]]; then
  echo "ERROR: mcp_tools test dir not found: ${TOOLS_TEST_DIR}" >&2
  exit 1
fi

mapfile -t ENDPOINTS < <(
  grep -E 'KialiMCPPath \+ "/[^"]+"' "${ENDPOINTS_FILE}" \
    | sed -E 's/.*"\/([^"]+)".*/\1/' \
    | sort -u
)

if [[ ${#ENDPOINTS[@]} -eq 0 ]]; then
  echo "ERROR: no MCP endpoints parsed from ${ENDPOINTS_FILE}" >&2
  exit 1
fi

missing=()
covered=()
for ep in "${ENDPOINTS[@]}"; do
  if [[ -f "${TOOLS_TEST_DIR}/${ep}_test.go" ]]; then
    covered+=("${ep}")
  else
    missing+=("${ep}")
  fi
done

{
  echo "### MCP endpoint coverage (Kiali mcp_tools)"
  echo ""
  echo "Endpoints in MCP \`endpoints.go\`: ${#ENDPOINTS[@]}"
  echo "Covered by \`*_test.go\` in \`${TOOLS_TEST_DIR}\`: ${#covered[@]}"
  echo "Missing: ${#missing[@]}"
  echo ""
  if [[ ${#covered[@]} -gt 0 ]]; then
    echo "**Covered**"
    for ep in "${covered[@]}"; do
      echo "- \`${ep}\` → \`${ep}_test.go\`"
    done
    echo ""
  fi
  if [[ ${#missing[@]} -gt 0 ]]; then
    echo "**Missing coverage**"
    for ep in "${missing[@]}"; do
      echo "- \`${ep}\` (expected \`${TOOLS_TEST_DIR}/${ep}_test.go\`)"
    done
    echo ""
  fi
} | tee /tmp/mcp-endpoint-coverage.md

if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  cat /tmp/mcp-endpoint-coverage.md >> "${GITHUB_STEP_SUMMARY}"
fi

if [[ ${#missing[@]} -gt 0 ]]; then
  echo "ERROR: missing mcp_tools integration tests for: ${missing[*]}" >&2
  exit 1
fi

echo "All ${#ENDPOINTS[@]} MCP endpoints have mcp_tools integration tests."
