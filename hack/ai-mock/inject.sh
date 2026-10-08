#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}"

usage() {
  cat <<'EOF'
Usage: ./inject.sh [options]

Builds and runs inject_metrics.go to push mock Kiali AI metrics into Prometheus
via the Remote Write API (/api/v1/write).

Options:
  -h, --help
      Show this help message and exit.

  -port <number>
      Local Prometheus port. Builds the URL http://localhost:<port>.
      Default Prometheus target when neither -port nor -url is set: 9090.

  -url <base-url>
      Full Prometheus base URL (e.g. http://prometheus-istio-system.apps-crc.testing).
      Takes precedence over -port when both are provided.

  -history-hours <hours>
      How many recent hours of cumulative counter history to inject.
      Default: 720 (30 days).

      Set to 0 to inject only at the current time (single snapshot).
      Prometheus may reject timestamps that are too far in the past.

  -history-step <duration>
      Interval between cumulative counter samples when -history-hours > 0.
      Default: 30m.
      Examples: 5m, 15m, 30m, 1h

  -clean
      Delete all Kiali AI metrics from Prometheus and exit.
      Requires Prometheus to be started with --web.enable-admin-api.

  -force
      Inject metrics even if they already exist for a provider/model/user.
      By default, existing providers are skipped.

Examples:
  ./inject.sh -h
  ./inject.sh -port 14000
  ./inject.sh -port 14000 -history-hours 0
  ./inject.sh -port 14000 -history-hours 720 -history-step 30m
  ./inject.sh -url http://localhost:9090 -force
  ./inject.sh -clean

Notes:
  - Prometheus must be started with --web.enable-remote-write-receiver.
  - To use -clean, Prometheus must be started with --web.enable-admin-api.
  - Weekly/monthly metrics are per-period counters. Each week/month starts at
    zero and records only that period's usage (not a lifetime running total).
    The current period is scaled by elapsed time since the period started.
EOF
}

for arg in "$@"; do
  case "${arg}" in
    -h|--help)
      usage
      exit 0
      ;;
  esac
done

echo "Building the metric injection tool..."
go build -o inject_metrics inject_metrics.go

echo "Running the metric injection tool with args: $*"
./inject_metrics "$@"
