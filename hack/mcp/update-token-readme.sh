#!/usr/bin/env bash
#
# Updates the token consumption section in ai/mcp/README.md
# from the data in ai/mcp/TOKEN_RESULTS.json.
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOTDIR="${SCRIPT_DIR}/../.."

TOKEN_FILE="${ROOTDIR}/ai/mcp/TOKEN_RESULTS.json"
README_FILE="${ROOTDIR}/ai/mcp/README.md"

if [[ ! -f "${TOKEN_FILE}" ]]; then
  echo "Error: ${TOKEN_FILE} not found" >&2
  exit 1
fi

if [[ ! -f "${README_FILE}" ]]; then
  echo "Error: ${README_FILE} not found" >&2
  exit 1
fi

TASKS_TOTAL=$(jq -r '.tasksTotal' "${TOKEN_FILE}")
TASKS_PASSED=$(jq -r '.tasksPassed' "${TOKEN_FILE}")
TOTAL_TOKENS=$(jq -r '.totalTokensEstimate' "${TOKEN_FILE}")
MCP_SCHEMA_TOKENS=$(jq -r '.totalMcpSchemaTokens' "${TOKEN_FILE}")
TASK_PASS_RATE=$(jq -r '.taskPassRate' "${TOKEN_FILE}")
ASSERTION_PASS_RATE=$(jq -r '.assertionPassRate' "${TOKEN_FILE}")

PASS_PCT=$(awk "BEGIN {printf \"%.0f\", ${TASK_PASS_RATE} * 100}")
ASSERT_PCT=$(awk "BEGIN {printf \"%.0f\", ${ASSERTION_PASS_RATE} * 100}")

MARKDOWN="### Evaluation Summary\n"
MARKDOWN+="\n"
MARKDOWN+="| Metric | Value |\n"
MARKDOWN+="|--------|-------|\n"
MARKDOWN+="| Tasks Passed | ${TASKS_PASSED}/${TASKS_TOTAL} (${PASS_PCT}%) |\n"
MARKDOWN+="| Assertions Pass Rate | ${ASSERT_PCT}% |\n"
MARKDOWN+="| Total Tokens Estimate | ${TOTAL_TOKENS} |\n"
MARKDOWN+="| MCP Schema Tokens | ${MCP_SCHEMA_TOKENS} |\n"
MARKDOWN+="\n"
MARKDOWN+="### Per-Task Breakdown\n"
MARKDOWN+="\n"
MARKDOWN+="| Task | Tokens Estimate | MCP Schema Tokens | Passed |\n"
MARKDOWN+="|------|----------------:|------------------:|--------|\n"

TASK_COUNT=$(jq '.tasks | length' "${TOKEN_FILE}")
for i in $(seq 0 $((TASK_COUNT - 1))); do
  NAME=$(jq -r ".tasks[${i}].name" "${TOKEN_FILE}")
  TOKENS=$(jq -r ".tasks[${i}].tokensEstimated" "${TOKEN_FILE}")
  SCHEMA=$(jq -r ".tasks[${i}].mcpSchemaTokens" "${TOKEN_FILE}")
  PASSED=$(jq -r ".tasks[${i}].taskPassed" "${TOKEN_FILE}")
  if [[ "${PASSED}" == "true" ]]; then
    STATUS="✅"
  else
    STATUS="❌"
  fi
  MARKDOWN+="| ${NAME} | ${TOKENS} | ${SCHEMA} | ${STATUS} |\n"
done

START_MARKER="<!-- TOKENS-CONSUMPTION-START -->"
END_MARKER="<!-- TOKENS-CONSUMPTION-END -->"

REPLACEMENT="${START_MARKER}\n\n$(echo -e "${MARKDOWN}")\n${END_MARKER}"

awk -v start="${START_MARKER}" -v end="${END_MARKER}" -v replacement="${REPLACEMENT}" '
  $0 ~ start { print replacement; skip=1; next }
  $0 ~ end { skip=0; next }
  !skip { print }
' "${README_FILE}" > "${README_FILE}.tmp"

mv "${README_FILE}.tmp" "${README_FILE}"

echo "Updated token consumption section in ${README_FILE}"
