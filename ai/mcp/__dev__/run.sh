#!/usr/bin/env bash
#
# Launch MCP Inspector against a thin stdio shim that proxies to a running Kiali.
#
# Usage:
#   ./run.sh
#   KIALI_URL=http://localhost:20001/kiali KIALI_TOKEN=... ./run.sh
#   ./run.sh --cli --method tools/list
#
# Defaults (overridable via env):
#   KIALI_URL   http://localhost:20001
#   KIALI_TOKEN from `oc whoami -t` when unset
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}"

infomsg() { echo "[INFO] $*" >&2; }
errormsg() { echo "[ERROR] $*" >&2; }

# --- defaults (user env wins) -------------------------------------------------

: "${KIALI_URL:=http://localhost:20001}"
KIALI_URL="${KIALI_URL%/}"

if [[ -z "${KIALI_TOKEN:-}" ]]; then
  if ! command -v oc >/dev/null 2>&1; then
    errormsg "KIALI_TOKEN is not set and 'oc' was not found in PATH."
    errormsg "Export KIALI_TOKEN (Bearer token) or install/login with oc."
    exit 1
  fi
  if ! KIALI_TOKEN="$(oc whoami -t 2>/dev/null)"; then
    errormsg "Failed to get a token via 'oc whoami -t'."
    errormsg "Log in with oc, or export KIALI_TOKEN yourself."
    exit 1
  fi
  if [[ -z "${KIALI_TOKEN}" ]]; then
    errormsg "'oc whoami -t' returned an empty token."
    exit 1
  fi
  infomsg "KIALI_TOKEN sourced from 'oc whoami -t'"
else
  infomsg "KIALI_TOKEN taken from environment"
fi

export KIALI_URL KIALI_TOKEN
: "${KIALI_MCP_TOOLSET:=mcp}"
export KIALI_MCP_TOOLSET

# Optional: skip TLS verify for self-signed routes (OpenShift)
: "${KIALI_INSECURE:=false}"
export KIALI_INSECURE

# --- prerequisites ------------------------------------------------------------

if ! command -v go >/dev/null 2>&1; then
  errormsg "Go is required (go run .)."
  exit 1
fi

if ! command -v npx >/dev/null 2>&1; then
  errormsg "npx is required (Node.js). Install Node 22+ and retry."
  exit 1
fi

# Ensure module deps are present (quiet after first run).
go mod tidy >/dev/null

# Quick reachability check (non-fatal warning).
if command -v curl >/dev/null 2>&1; then
  if ! curl -sk --connect-timeout 2 -o /dev/null -w '' "${KIALI_URL}/api" 2>/dev/null \
    && ! curl -sk --connect-timeout 2 -o /dev/null -w '' "${KIALI_URL}/" 2>/dev/null; then
    infomsg "Warning: could not reach ${KIALI_URL} — is Kiali running / port-forwarded?"
  fi
fi

infomsg "KIALI_URL=${KIALI_URL}"
infomsg "KIALI_MCP_TOOLSET=${KIALI_MCP_TOOLSET}"
infomsg "Starting MCP Inspector (stdio → go run . → Kiali)..."
infomsg "Extra args are passed to the Inspector: $*"

# Inspector spawns: go run . (stdio MCP server in this directory).
# Any extra CLI args (e.g. --cli --method tools/list) go to the Inspector.
exec npx --yes @modelcontextprotocol/inspector \
  -e "KIALI_URL=${KIALI_URL}" \
  -e "KIALI_MCP_TOOLSET=${KIALI_MCP_TOOLSET}" \
  -e "KIALI_INSECURE=${KIALI_INSECURE}" \
  ${KIALI_TOKEN:+-e "KIALI_TOKEN=${KIALI_TOKEN}"} \
  --cwd "${SCRIPT_DIR}" \
  go run . "$@"
