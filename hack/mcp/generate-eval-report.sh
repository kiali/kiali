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

  # Classify tasks: common (in both), new (PR only), removed (baseline only)
  PR_TASK_NAMES=$(jq -r '.tasks[].name' "${PR_RESULTS}")
  BASE_TASK_NAMES=$(jq -r '.tasks[].name' "${BASELINE}")

  COMMON_TASKS=()
  NEW_TASKS=()
  REMOVED_TASKS=()

  while IFS= read -r name; do
    if echo "${BASE_TASK_NAMES}" | grep -qxF "${name}"; then
      COMMON_TASKS+=("${name}")
    else
      NEW_TASKS+=("${name}")
    fi
  done <<< "${PR_TASK_NAMES}"

  while IFS= read -r name; do
    if ! echo "${PR_TASK_NAMES}" | grep -qxF "${name}"; then
      REMOVED_TASKS+=("${name}")
    fi
  done <<< "${BASE_TASK_NAMES}"

  # Common tasks: show diff table
  if [[ ${#COMMON_TASKS[@]} -gt 0 ]]; then
    cat <<TASK_HEADER
### Per-Task Results

| Task | Status | Tokens (Master) | Tokens (PR) | Diff | Schema (Master) | Schema (PR) | Diff |
|------|--------|----------------:|------------:|-----:|----------------:|------------:|-----:|
TASK_HEADER

    for NAME in "${COMMON_TASKS[@]}"; do
      PR_T=$(jq -r ".tasks[] | select(.name == \"${NAME}\") | .tokensEstimated // 0" "${PR_RESULTS}")
      PR_S=$(jq -r ".tasks[] | select(.name == \"${NAME}\") | .mcpSchemaTokens // 0" "${PR_RESULTS}")
      PR_PASS=$(jq -r ".tasks[] | select(.name == \"${NAME}\") | .taskPassed" "${PR_RESULTS}")
      BASE_T=$(jq -r ".tasks[] | select(.name == \"${NAME}\") | .tokensEstimated // 0" "${BASELINE}")
      BASE_S=$(jq -r ".tasks[] | select(.name == \"${NAME}\") | .mcpSchemaTokens // 0" "${BASELINE}")

      if [[ "${PR_PASS}" == "true" ]]; then
        STATUS="✅"
      else
        STATUS="❌"
      fi

      DIFF_T=$((PR_T - BASE_T))
      DIFF_S=$((PR_S - BASE_S))

      echo "| ${NAME} | ${STATUS} | ${BASE_T} | ${PR_T} | $(format_diff ${DIFF_T}) | ${BASE_S} | ${PR_S} | $(format_diff ${DIFF_S}) |"
    done

    echo ""
  fi

  # New tasks (PR only)
  if [[ ${#NEW_TASKS[@]} -gt 0 ]]; then
    cat <<NEW_HEADER
### New Tasks

| Task | Status | Tokens Estimate | MCP Schema Tokens |
|------|--------|----------------:|------------------:|
NEW_HEADER

    for NAME in "${NEW_TASKS[@]}"; do
      PR_T=$(jq -r ".tasks[] | select(.name == \"${NAME}\") | .tokensEstimated // 0" "${PR_RESULTS}")
      PR_S=$(jq -r ".tasks[] | select(.name == \"${NAME}\") | .mcpSchemaTokens // 0" "${PR_RESULTS}")
      PR_PASS=$(jq -r ".tasks[] | select(.name == \"${NAME}\") | .taskPassed" "${PR_RESULTS}")

      if [[ "${PR_PASS}" == "true" ]]; then
        STATUS="✅"
      else
        STATUS="❌"
      fi

      echo "| ${NAME} | ${STATUS} | ${PR_T} | ${PR_S} |"
    done

    echo ""
  fi

  # Removed tasks (baseline only)
  if [[ ${#REMOVED_TASKS[@]} -gt 0 ]]; then
    cat <<REMOVED_HEADER
### Removed Tasks

| Task | Tokens Estimate | MCP Schema Tokens |
|------|----------------:|------------------:|
REMOVED_HEADER

    for NAME in "${REMOVED_TASKS[@]}"; do
      BASE_T=$(jq -r ".tasks[] | select(.name == \"${NAME}\") | .tokensEstimated // 0" "${BASELINE}")
      BASE_S=$(jq -r ".tasks[] | select(.name == \"${NAME}\") | .mcpSchemaTokens // 0" "${BASELINE}")

      echo "| ${NAME} | ${BASE_T} | ${BASE_S} |"
    done

    echo ""
  fi

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
