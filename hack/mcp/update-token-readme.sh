#!/usr/bin/env bash
#
# Updates the token consumption sections in ai/mcp/README.md from mcpchecker
# result files (single-cluster and optional multicluster).
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOTDIR="${SCRIPT_DIR}/../.."

EVAL_OUT="${EVAL_OUT:-${ROOTDIR}/tests/evals/results/mcpchecker-gemini-eval-out.json}"
EVAL_MULTICLUSTER_OUT="${EVAL_MULTICLUSTER_OUT:-${ROOTDIR}/tests/evals/results/mcpchecker-gemini-multicluster-eval-out.json}"
README_FILE="${README_FILE:-${ROOTDIR}/ai/mcp/README.md}"

if [[ ! -f "${README_FILE}" ]]; then
  echo "Error: ${README_FILE} not found" >&2
  exit 1
fi

render_token_section() {
  local eval_file="$1"
  local tasks_tmp
  local token_file

  tasks_tmp="$(mktemp)"
  token_file="$(mktemp)"

  jq 'if type == "array" then . elif (type == "object" and (.results | type) == "array") then .results else [] end' "${eval_file}" > "${tasks_tmp}"

  local task_count
  task_count=$(jq 'length' "${tasks_tmp}")
  if (( task_count <= 0 )); then
    rm -f "${tasks_tmp}" "${token_file}"
    return 1
  fi

  local tasks_total="${task_count}"
  local tasks_passed
  local assertions_total
  local assertions_passed
  local total_tokens
  local mcp_schema_tokens
  local pass_pct
  local assert_pct

  tasks_passed=$(jq '[.[] | select(.taskPassed == true)] | length' "${tasks_tmp}")
  assertions_total=$(jq '[.[] | select(.allAssertionsPassed != null)] | length' "${tasks_tmp}")
  assertions_passed=$(jq '[.[] | select(.allAssertionsPassed == true)] | length' "${tasks_tmp}")
  total_tokens=$(jq '[.[] | (.tokenEstimate.totalTokens // 0) | floor] | add // 0' "${tasks_tmp}")
  mcp_schema_tokens=$(jq '[.[] | (.tokenEstimate.mcpSchemaTokens // 0) | floor] | add // 0' "${tasks_tmp}")

  pass_pct=$(awk "BEGIN {printf \"%.0f\", (${tasks_passed} / ${tasks_total}) * 100}")
  assert_pct=0
  if (( assertions_total > 0 )); then
    assert_pct=$(awk "BEGIN {printf \"%.0f\", (${assertions_passed} / ${assertions_total}) * 100}")
  fi

  {
    printf "### Evaluation Summary\n\n"
    printf "| Metric | Value |\n"
    printf "|--------|-------|\n"
    printf "| Tasks Passed | %s/%s (%s%%) |\n" "${tasks_passed}" "${tasks_total}" "${pass_pct}"
    printf "| Assertions Pass Rate | %s%% |\n" "${assert_pct}"
    printf "| Total Tokens Estimate | %s |\n" "${total_tokens}"
    printf "| MCP Schema Tokens | %s |\n" "${mcp_schema_tokens}"
    printf "\n"
    printf "### Per-Task Breakdown\n\n"
    printf "| Task | Tokens Estimate | MCP Schema Tokens | Passed |\n"
    printf "|------|----------------:|------------------:|--------|\n"

    while IFS= read -r row; do
      local name tokens schema passed status
      name=$(jq -r '.taskName // "unknown-task"' <<< "${row}" | sed 's/|/\\|/g')
      tokens=$(jq -r '(.tokenEstimate.totalTokens // 0) | floor' <<< "${row}")
      schema=$(jq -r '(.tokenEstimate.mcpSchemaTokens // 0) | floor' <<< "${row}")
      passed=$(jq -r '.taskPassed' <<< "${row}")
      if [[ "${passed}" == "true" ]]; then
        status="✅"
      else
        status="❌"
      fi
      printf "| %s | %s | %s | %s |\n" "${name}" "${tokens}" "${schema}" "${status}"
    done < <(jq -c '.[]' "${tasks_tmp}")
  } > "${token_file}"

  cat "${token_file}"
  rm -f "${tasks_tmp}" "${token_file}"
}

replace_readme_section() {
  local start_marker="$1"
  local end_marker="$2"
  local token_file="$3"
  local readme_tmp

  readme_tmp="$(mktemp)"
  awk -v start="${start_marker}" -v end="${end_marker}" -v token_file="${token_file}" '
    $0 ~ start {
      print
      print ""
      while ((getline line < token_file) > 0) { print line }
      skip=1; next
    }
    $0 ~ end { print; skip=0; next }
    !skip { print }
  ' "${README_FILE}" > "${readme_tmp}"
  mv "${readme_tmp}" "${README_FILE}"
}

SINGLE_TMP="$(mktemp)"
MULTI_TMP="$(mktemp)"
trap 'rm -f "${SINGLE_TMP}" "${MULTI_TMP}"' EXIT

if [[ ! -f "${EVAL_OUT}" ]]; then
  echo "Error: ${EVAL_OUT} not found" >&2
  exit 1
fi

render_token_section "${EVAL_OUT}" > "${SINGLE_TMP}"
replace_readme_section "<!-- TOKENS-CONSUMPTION-START -->" "<!-- TOKENS-CONSUMPTION-END -->" "${SINGLE_TMP}"
echo "Updated single-cluster token consumption section in ${README_FILE}"

if [[ -f "${EVAL_MULTICLUSTER_OUT}" ]]; then
  if render_token_section "${EVAL_MULTICLUSTER_OUT}" > "${MULTI_TMP}"; then
    replace_readme_section "<!-- TOKENS-CONSUMPTION-MULTICLUSTER-START -->" "<!-- TOKENS-CONSUMPTION-MULTICLUSTER-END -->" "${MULTI_TMP}"
    echo "Updated multicluster token consumption section in ${README_FILE}"
  else
    echo "Warning: ${EVAL_MULTICLUSTER_OUT} has no task results; skipping multicluster token section" >&2
  fi
else
  echo "No multicluster results at ${EVAL_MULTICLUSTER_OUT}; skipping multicluster token section"
fi
