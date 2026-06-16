#!/usr/bin/env bash
#
# Updates the token consumption section in ai/mcp/README.md from the raw
# tests/evals/results/mcpchecker-gemini-eval-out.json results.
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOTDIR="${SCRIPT_DIR}/../.."

EVAL_OUT="${EVAL_OUT:-${ROOTDIR}/tests/evals/results/mcpchecker-gemini-eval-out.json}"
README_FILE="${README_FILE:-${ROOTDIR}/ai/mcp/README.md}"

if [[ ! -f "${EVAL_OUT}" ]]; then
  echo "Error: ${EVAL_OUT} not found" >&2
  exit 1
fi

if [[ ! -f "${README_FILE}" ]]; then
  echo "Error: ${README_FILE} not found" >&2
  exit 1
fi

# Normalize: support both a flat array (legacy format) and the current
# {results:[...], summary:{...}} object format produced by mcpchecker.
TASKS_TMP="$(mktemp)"
TOKEN_FILE="$(mktemp)"
trap 'rm -f "${TOKEN_FILE}" "${TASKS_TMP}"' EXIT

jq 'if type == "array" then . elif (type == "object" and (.results | type) == "array") then .results else [] end' "${EVAL_OUT}" > "${TASKS_TMP}"

TASK_COUNT=$(jq 'length' "${TASKS_TMP}")
if (( TASK_COUNT <= 0 )); then
  echo "Error: ${EVAL_OUT} does not contain any task results" >&2
  exit 1
fi

TASKS_TOTAL="${TASK_COUNT}"
TASKS_PASSED=$(jq '[.[] | select(.taskPassed == true)] | length' "${TASKS_TMP}")
ASSERTIONS_TOTAL=$(jq '[.[] | select(.allAssertionsPassed != null)] | length' "${TASKS_TMP}")
ASSERTIONS_PASSED=$(jq '[.[] | select(.allAssertionsPassed == true)] | length' "${TASKS_TMP}")
TOTAL_TOKENS=$(jq '[.[] | (.tokenEstimate.totalTokens // 0) | floor] | add // 0' "${TASKS_TMP}")
MCP_SCHEMA_TOKENS=$(jq '[.[] | (.tokenEstimate.mcpSchemaTokens // 0) | floor] | add // 0' "${TASKS_TMP}")

PASS_PCT=$(awk "BEGIN {printf \"%.0f\", (${TASKS_PASSED} / ${TASKS_TOTAL}) * 100}")
ASSERT_PCT=0
if (( ASSERTIONS_TOTAL > 0 )); then
  ASSERT_PCT=$(awk "BEGIN {printf \"%.0f\", (${ASSERTIONS_PASSED} / ${ASSERTIONS_TOTAL}) * 100}")
fi

{
  printf "### Evaluation Summary\n\n"
  printf "| Metric | Value |\n"
  printf "|--------|-------|\n"
  printf "| Tasks Passed | %s/%s (%s%%) |\n" "${TASKS_PASSED}" "${TASKS_TOTAL}" "${PASS_PCT}"
  printf "| Assertions Pass Rate | %s%% |\n" "${ASSERT_PCT}"
  printf "| Total Tokens Estimate | %s |\n" "${TOTAL_TOKENS}"
  printf "| MCP Schema Tokens | %s |\n" "${MCP_SCHEMA_TOKENS}"
  printf "\n"
  printf "### Per-Task Breakdown\n\n"
  printf "| Task | Tokens Estimate | MCP Schema Tokens | Passed |\n"
  printf "|------|----------------:|------------------:|--------|\n"

  while IFS= read -r row; do
    NAME=$(jq -r '.taskName // "unknown-task"' <<< "${row}" | sed 's/|/\\|/g')
    TOKENS=$(jq -r '(.tokenEstimate.totalTokens // 0) | floor' <<< "${row}")
    SCHEMA=$(jq -r '(.tokenEstimate.mcpSchemaTokens // 0) | floor' <<< "${row}")
    PASSED=$(jq -r '.taskPassed' <<< "${row}")
    if [[ "${PASSED}" == "true" ]]; then
      STATUS="✅"
    else
      STATUS="❌"
    fi
    printf "| %s | %s | %s | %s |\n" "${NAME}" "${TOKENS}" "${SCHEMA}" "${STATUS}"
  done < <(jq -c '.[]' "${TASKS_TMP}")
} > "${TOKEN_FILE}"

START_MARKER="<!-- TOKENS-CONSUMPTION-START -->"
END_MARKER="<!-- TOKENS-CONSUMPTION-END -->"

awk -v start="${START_MARKER}" -v end="${END_MARKER}" -v token_file="${TOKEN_FILE}" '
  $0 ~ start {
    print
    print ""
    while ((getline line < token_file) > 0) { print line }
    skip=1; next
  }
  $0 ~ end { print; skip=0; next }
  !skip { print }
' "${README_FILE}" > "${README_FILE}.tmp"

mv "${README_FILE}.tmp" "${README_FILE}"

echo "Updated token consumption section in ${README_FILE}"
