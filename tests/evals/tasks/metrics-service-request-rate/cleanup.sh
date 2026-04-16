#!/usr/bin/env bash
set -euo pipefail
kubectl -n bookinfo delete job gevals-mcp-productpage-metrics --ignore-not-found
