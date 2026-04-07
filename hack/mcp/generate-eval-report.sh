#!/usr/bin/env bash
#
# Generates a markdown PR comment comparing PR evaluation results
# against the master baseline stored in TOKEN_RESULTS.json.
#
# Usage: generate-eval-report.sh <pr-results.json> <baseline.json> <context.json> <run-url>
#
# Outputs markdown to stdout.
#
set -euo pipefail

PR_RESULTS="${1:?Usage: $0 <pr-results.json> <baseline.json> <context.json> <run-url>}"
BASELINE="${2:?}"
CONTEXT="${3:?}"
RUN_URL="${4:?}"

PR_SHA=$(jq -r '.pr_sha' "${CONTEXT}")
TASKS_PASSED=$(jq -r '.tasks_passed' "${CONTEXT}")
TASKS_TOTAL=$(jq -r '.tasks_total' "${CONTEXT}")
TASK_PASS_RATE=$(jq -r '.task_pass_rate' "${CONTEXT}")
PASSED=$(jq -r '.passed' "${CONTEXT}")

PASS_RATE=$(awk "BEGIN {printf \"%.1f\", ${TASK_PASS_RATE} * 100}")

if [[ "${PASSED}" == "true" ]]; then
  OVERALL="✅ Passed"
else
  OVERALL="❌ Failed"
fi

if [[ "${TASKS_TOTAL}" != "${TASKS_PASSED}" ]]; then
  TASKS_ICON="❌"
else
  TASKS_ICON="✅"
fi

format_diff() {
  local diff=$1
  if [[ "${diff}" -gt 0 ]]; then
    echo "+${diff}"
  elif [[ "${diff}" -lt 0 ]]; then
    echo "${diff}"
  else
    echo "0"
  fi
}

cat <<HEADER
## mcpchecker MCP Evaluation Results

**Commit:** \`${PR_SHA:0:7}\`
**Overall:** ${OVERALL} — ${TASKS_ICON} ${TASKS_PASSED}/${TASKS_TOTAL} tasks passed (${PASS_RATE}%)

HEADER

HAS_BASELINE="false"
if [[ -f "${BASELINE}" ]]; then
  BASELINE_TOTAL=$(jq -r '.tasksTotal // 0' "${BASELINE}")
  if [[ "${BASELINE_TOTAL}" -gt 0 ]]; then
    HAS_BASELINE="true"
  fi
fi

if [[ "${HAS_BASELINE}" == "true" ]]; then
  PR_TOKENS=$(jq -r '.totalTokensEstimate // 0' "${PR_RESULTS}")
  PR_SCHEMA=$(jq -r '.totalMcpSchemaTokens // 0' "${PR_RESULTS}")
  BASE_TOKENS=$(jq -r '.totalTokensEstimate // 0' "${BASELINE}")
  BASE_SCHEMA=$(jq -r '.totalMcpSchemaTokens // 0' "${BASELINE}")

  DIFF_TOKENS=$((PR_TOKENS - BASE_TOKENS))
  DIFF_SCHEMA=$((PR_SCHEMA - BASE_SCHEMA))

  if [[ "${DIFF_TOKENS}" -ne 0 || "${DIFF_SCHEMA}" -ne 0 ]]; then
    cat <<TABLE
### Token Consumption

| Metric | Master | PR | Diff |
|--------|-------:|---:|-----:|
| Total Tokens Estimate | ${BASE_TOKENS} | ${PR_TOKENS} | $(format_diff ${DIFF_TOKENS}) |
| MCP Schema Tokens | ${BASE_SCHEMA} | ${PR_SCHEMA} | $(format_diff ${DIFF_SCHEMA}) |

TABLE
  else
    echo "### Token Consumption"
    echo ""
    echo "No token consumption changes detected."
    echo ""
  fi

  cat <<TASK_HEADER
### Per-Task Results

| Task | Status | Tokens (Master) | Tokens (PR) | Diff | Schema (Master) | Schema (PR) | Diff |
|------|--------|----------------:|------------:|-----:|----------------:|------------:|-----:|
TASK_HEADER

  PR_TASK_COUNT=$(jq '.tasks | length' "${PR_RESULTS}")
  for i in $(seq 0 $((PR_TASK_COUNT - 1))); do
    NAME=$(jq -r ".tasks[${i}].name" "${PR_RESULTS}")
    PR_T=$(jq -r ".tasks[${i}].tokensEstimated // 0" "${PR_RESULTS}")
    PR_S=$(jq -r ".tasks[${i}].mcpSchemaTokens // 0" "${PR_RESULTS}")
    PR_PASS=$(jq -r ".tasks[${i}].taskPassed" "${PR_RESULTS}")

    BASE_T=$(jq -r ".tasks[] | select(.name == \"${NAME}\") | .tokensEstimated // 0" "${BASELINE}" 2>/dev/null || echo "—")
    BASE_S=$(jq -r ".tasks[] | select(.name == \"${NAME}\") | .mcpSchemaTokens // 0" "${BASELINE}" 2>/dev/null || echo "—")

    if [[ "${PR_PASS}" == "true" ]]; then
      STATUS="✅"
    else
      STATUS="❌"
    fi

    if [[ "${BASE_T}" != "—" && "${BASE_T}" != "" ]]; then
      DIFF_T=$((PR_T - BASE_T))
      DIFF_T_FMT=$(format_diff ${DIFF_T})
    else
      BASE_T="—"
      DIFF_T_FMT="new"
    fi

    if [[ "${BASE_S}" != "—" && "${BASE_S}" != "" ]]; then
      DIFF_S=$((PR_S - BASE_S))
      DIFF_S_FMT=$(format_diff ${DIFF_S})
    else
      BASE_S="—"
      DIFF_S_FMT="new"
    fi

    echo "| ${NAME} | ${STATUS} | ${BASE_T} | ${PR_T} | ${DIFF_T_FMT} | ${BASE_S} | ${PR_S} | ${DIFF_S_FMT} |"
  done

  echo ""
else
  cat <<NO_BASELINE
### Task Results

> No master baseline found. Showing PR results only.

| Task | Status | Tokens Estimate | MCP Schema Tokens |
|------|--------|----------------:|------------------:|
NO_BASELINE

  PR_TASK_COUNT=$(jq '.tasks | length' "${PR_RESULTS}")
  for i in $(seq 0 $((PR_TASK_COUNT - 1))); do
    NAME=$(jq -r ".tasks[${i}].name" "${PR_RESULTS}")
    PR_T=$(jq -r ".tasks[${i}].tokensEstimated // 0" "${PR_RESULTS}")
    PR_S=$(jq -r ".tasks[${i}].mcpSchemaTokens // 0" "${PR_RESULTS}")
    PR_PASS=$(jq -r ".tasks[${i}].taskPassed" "${PR_RESULTS}")

    if [[ "${PR_PASS}" == "true" ]]; then
      STATUS="✅"
    else
      STATUS="❌"
    fi

    echo "| ${NAME} | ${STATUS} | ${PR_T} | ${PR_S} |"
  done

  echo ""
fi

echo "[View full results](${RUN_URL})"
