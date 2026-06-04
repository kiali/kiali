#!/usr/bin/env bash
#
# Updates the token consumption section in ai/mcp/README.md from the raw
# tests/evals/results/mcpchecker-gemini-eval-out.json results.
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOTDIR="${SCRIPT_DIR}/../.."

EVAL_OUT="${ROOTDIR}/tests/evals/results/mcpchecker-gemini-eval-out.json"
README_FILE="${ROOTDIR}/ai/mcp/README.md"

if [[ ! -f "${EVAL_OUT}" ]]; then
  echo "Error: ${EVAL_OUT} not found" >&2
  exit 1
fi

if [[ ! -f "${README_FILE}" ]]; then
  echo "Error: ${README_FILE} not found" >&2
  exit 1
fi

python3 - "${EVAL_OUT}" "${README_FILE}" <<'PY'
import json
import re
import sys
from pathlib import Path

eval_path = Path(sys.argv[1])
readme_path = Path(sys.argv[2])

results = json.loads(eval_path.read_text(encoding="utf-8"))
if not isinstance(results, list) or not results:
    raise SystemExit(f"Error: {eval_path} does not contain any task results")


def to_int(value: object) -> int:
    if isinstance(value, bool):
        return int(value)
    if isinstance(value, (int, float)):
        return int(value)
    return 0


tasks_total = len(results)
tasks_passed = sum(1 for task in results if task.get("taskPassed") is True)
assertion_tasks = [task for task in results if task.get("allAssertionsPassed") is not None]
assertions_total = len(assertion_tasks)
assertions_passed = sum(1 for task in assertion_tasks if task.get("allAssertionsPassed") is True)
total_tokens = sum(to_int((task.get("tokenEstimate") or {}).get("totalTokens")) for task in results)
mcp_schema_tokens = sum(to_int((task.get("tokenEstimate") or {}).get("mcpSchemaTokens")) for task in results)

pass_pct = round((tasks_passed / tasks_total) * 100) if tasks_total else 0
assert_pct = round((assertions_passed / assertions_total) * 100) if assertions_total else 0

lines = [
    "### Evaluation Summary",
    "",
    "| Metric | Value |",
    "|--------|-------|",
    f"| Tasks Passed | {tasks_passed}/{tasks_total} ({pass_pct}%) |",
    f"| Assertions Pass Rate | {assert_pct}% |",
    f"| Total Tokens Estimate | {total_tokens} |",
    f"| MCP Schema Tokens | {mcp_schema_tokens} |",
    "",
    "### Per-Task Breakdown",
    "",
    "| Task | Tokens Estimate | MCP Schema Tokens | Passed |",
    "|------|----------------:|------------------:|--------|",
]

for task in results:
    token_estimate = task.get("tokenEstimate") or {}
    task_name = str(task.get("taskName") or "unknown-task").replace("|", "\\|")
    tokens = to_int(token_estimate.get("totalTokens"))
    schema_tokens = to_int(token_estimate.get("mcpSchemaTokens"))
    status = "✅" if task.get("taskPassed") is True else "❌"
    lines.append(f"| {task_name} | {tokens} | {schema_tokens} | {status} |")

markdown = "\n".join(lines)
start_marker = "<!-- TOKENS-CONSUMPTION-START -->"
end_marker = "<!-- TOKENS-CONSUMPTION-END -->"
replacement = f"{start_marker}\n\n{markdown}\n{end_marker}"

readme = readme_path.read_text(encoding="utf-8")
pattern = re.compile(re.escape(start_marker) + r".*?" + re.escape(end_marker), re.S)
updated_readme, replacements = pattern.subn(replacement, readme, count=1)
if replacements != 1:
    raise SystemExit(f"Error: could not replace token section in {readme_path}")

readme_path.write_text(updated_readme, encoding="utf-8")
PY

echo "Updated token consumption section in ${README_FILE}"
