#!/bin/bash
#
# sync-dashboards.sh
#
# Regenerates dashboard.yaml from the community-dashboards repository.
# See README.md in this directory for details.
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
KIALI_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"

COMMUNITY_DASHBOARDS_DIR="${COMMUNITY_DASHBOARDS_DIR:-}"
OUTPUT_FILE="${SCRIPT_DIR}/dashboard.yaml"
BUILD_DIR=""
DRY_RUN="false"
PERSES_DATASOURCE="prometheus"
PERSES_PROJECT="istio"

usage() {
  cat <<EOF
Usage: $(basename "$0") [options]

Regenerate hack/istio/perses/dashboard.yaml from community-dashboards.

Options:
  -d, --community-dashboards-dir <path>
      Path to the community-dashboards repository.
      Default: \$COMMUNITY_DASHBOARDS_DIR, or ../community-dashboards relative to Kiali.
  -o, --output <path>
      Output ConfigMap file. Default: ${OUTPUT_FILE}
  -b, --build-dir <path>
      Temporary directory for generated JSON dashboards.
      Default: a directory under /tmp.
  -n, --dry-run
      Build dashboards but do not write dashboard.yaml.
  -h, --help
      Show this help message.

Environment:
  COMMUNITY_DASHBOARDS_DIR   Default source repository path.

Example:
  COMMUNITY_DASHBOARDS_DIR=~/dev/community-dashboards ${SCRIPT_DIR}/sync-dashboards.sh
EOF
}

errormsg() {
  echo "[ERROR] $*" >&2
}

infomsg() {
  echo "[INFO] $*"
}

resolve_community_dashboards_dir() {
  if [ -n "${COMMUNITY_DASHBOARDS_DIR}" ]; then
    COMMUNITY_DASHBOARDS_DIR="$(cd "${COMMUNITY_DASHBOARDS_DIR}" && pwd)"
    return 0
  fi

  local candidate="${KIALI_ROOT}/../community-dashboards"
  if [ -f "${candidate}/main.go" ]; then
    COMMUNITY_DASHBOARDS_DIR="$(cd "${candidate}" && pwd)"
    return 0
  fi

  errormsg "community-dashboards not found."
  errormsg "Set COMMUNITY_DASHBOARDS_DIR or pass --community-dashboards-dir."
  exit 1
}

while [ $# -gt 0 ]; do
  case "$1" in
    -d|--community-dashboards-dir)
      COMMUNITY_DASHBOARDS_DIR="$2"
      shift 2
      ;;
    -o|--output)
      OUTPUT_FILE="$2"
      shift 2
      ;;
    -b|--build-dir)
      BUILD_DIR="$2"
      shift 2
      ;;
    -n|--dry-run)
      DRY_RUN="true"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      errormsg "Unknown option: $1"
      usage
      exit 1
      ;;
  esac
done

resolve_community_dashboards_dir

if [ -z "${BUILD_DIR}" ]; then
  BUILD_DIR="$(mktemp -d /tmp/kiali-perses-dashboards.XXXXXX)"
  CLEANUP_BUILD_DIR="true"
else
  mkdir -p "${BUILD_DIR}"
  CLEANUP_BUILD_DIR="false"
fi

cleanup() {
  if [ "${CLEANUP_BUILD_DIR}" = "true" ] && [ -n "${BUILD_DIR}" ] && [ -d "${BUILD_DIR}" ]; then
    rm -rf "${BUILD_DIR}"
  fi
}
trap cleanup EXIT

infomsg "Using community-dashboards at ${COMMUNITY_DASHBOARDS_DIR}"
infomsg "Building Istio dashboards (project=${PERSES_PROJECT}, datasource=${PERSES_DATASOURCE})"

(
  cd "${COMMUNITY_DASHBOARDS_DIR}"
  go run main.go \
    --output=json \
    --output-dir="${BUILD_DIR}" \
    --project="${PERSES_PROJECT}" \
    --datasource="${PERSES_DATASOURCE}"
)

ISTIO_JSON_DIR="${BUILD_DIR}/istio"
if [ ! -d "${ISTIO_JSON_DIR}" ]; then
  errormsg "Expected dashboards in ${ISTIO_JSON_DIR}"
  exit 1
fi

infomsg "Writing ${OUTPUT_FILE}"

python3 - "${ISTIO_JSON_DIR}" "${OUTPUT_FILE}" "${DRY_RUN}" <<'PYEOF'
import json
import sys
from pathlib import Path

istio_json_dir = Path(sys.argv[1])
output_file = Path(sys.argv[2])
dry_run = sys.argv[3] == "true"

# ConfigMap data keys used by Kiali CI. Order is stable for readable diffs.
DASHBOARD_KEYS = {
    "istio-control-plane": "dashboard-control-plane",
    "istio-mesh": "dashboard-mesh",
    "istio-performance": "dashboard-performance",
    "istio-service-dashboard": "dashboard-service",
    "istio-workload-dashboard": "dashboard-workload",
    "istio-ztunnel-dashboard": "dashboard-ztunnel",
    "istio-extension-dashboard": "dashboard-extension",
}

# Kiali slugifies dashboard display names from config (e.g. "Istio Mesh Dashboard"
# -> "istio-mesh-dashboard"). community-dashboards uses "istio-mesh" for the mesh ID.
DASHBOARD_ID_OVERRIDES = {
    "istio-mesh": "istio-mesh-dashboard",
}

ORDER = list(DASHBOARD_KEYS.keys())

dashboards = {}
for path in sorted(istio_json_dir.glob("*.json")):
    with path.open(encoding="utf-8") as handle:
        dashboard = json.load(handle)
    name = dashboard.get("metadata", {}).get("name")
    if not name:
        raise SystemExit(f"Dashboard {path.name} is missing metadata.name")
    dashboards[name] = dashboard

missing = [name for name in ORDER if name not in dashboards]
if missing:
    raise SystemExit(
        "Missing expected Istio dashboards from community-dashboards: "
        + ", ".join(missing)
    )

unexpected = sorted(set(dashboards) - set(ORDER))
if unexpected:
    raise SystemExit(
        "Unexpected Istio dashboards from community-dashboards: "
        + ", ".join(unexpected)
        + ". Update DASHBOARD_KEYS in sync-dashboards.sh if a new dashboard was added."
    )

lines = [
    "apiVersion: v1",
    "kind: ConfigMap",
    "metadata:",
    "  name: perses-provisioning",
    "  namespace: istio-system",
    "  labels:",
    '    perses.dev/resource: "true"',
    "data:",
]

for name in ORDER:
    key = DASHBOARD_KEYS[name]
    dashboard = dashboards[name]
    provisioned_name = DASHBOARD_ID_OVERRIDES.get(name, name)
    if provisioned_name != name:
        dashboard = json.loads(json.dumps(dashboard))
        dashboard["metadata"]["name"] = provisioned_name
    compact = json.dumps(dashboard, separators=(",", ":"))
    lines.append(f"  {key}.json: |")
    lines.append(f"    {compact}")

content = "\n".join(lines) + "\n"

if dry_run:
    print(content)
else:
    output_file.write_text(content, encoding="utf-8")

for name in ORDER:
    suffix = f" (provisioned as {DASHBOARD_ID_OVERRIDES[name]})" if name in DASHBOARD_ID_OVERRIDES else ""
    print(f"  {DASHBOARD_KEYS[name]}.json <- {name}{suffix}")
PYEOF

if [ "${DRY_RUN}" = "true" ]; then
  infomsg "Dry run complete. dashboard.yaml was not written."
else
  infomsg "Done."
fi
