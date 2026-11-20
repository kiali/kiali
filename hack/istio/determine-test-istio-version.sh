#!/bin/bash

set -euo pipefail

OFFSET="0"
FORCE_SAIL="false"
FORCE_ISTIOCTL="false"
CHECK_RC="false"
RETRIES="120"
RETRY_INTERVAL_SECONDS="60"

helpmsg() {
  cat <<'HELP'
Determine test Istio version for CI/local runs.

Fetches the latest Istio and Sail Operator releases. Istio GA releases define
the reference minors (N, N-1, N-2). Sail is used to decide whether that version
is available via Sail. RCs are never selected as the reference N used by
general CI; use --check-rc for the conditional RC test path.

Usage:
  determine-test-istio-version.sh [options]

Options:
  --offset <n>
    Minor-version offset from the Istio GA reference set.
    0 = N (latest GA), 1 = N-1, 2 = N-2.
    Negative values are converted to absolute value.
    Default: 0

  --force-sail
    Always install with Sail when the reference minor exists in Sail
    (used by Test Istio Version for N-1 / N-2). Ignored with --check-rc.

  --force-istioctl
    Always install the Istio GA reference with istioctl (ignores Sail
    availability). Ignored with --check-rc. Mutually exclusive with --force-sail.

  --check-rc
    Exit 0 and print the newest Istio RC when the tip of upstream Istio is an
    RC for a minor that has no GA yet (conditional Test Istio Version N run).
    Exit 1 when there is no such RC.

  --retries <n>
    Retry attempts when API fetch fails.
    Default: 120

  --retry-interval-seconds <n>
    Seconds to sleep between retries.
    Default: 60

  -h|--help
    Show this message.

Output:
  Prints the version to install to stdout (or the RC version with --check-rc).
  Prints both latest Istio/Sail versions and "Using Sail" / "Using istioctl" to stderr.
  When GITHUB_OUTPUT is set, also writes istio-version, sail-version, sail, and install-method.
HELP
}

while [[ $# -gt 0 ]]; do
  key="$1"
  case "${key}" in
    --offset)
      OFFSET="$2"
      shift; shift
      ;;
    --force-sail)
      FORCE_SAIL="true"
      shift
      ;;
    --force-istioctl)
      FORCE_ISTIOCTL="true"
      shift
      ;;
    --check-rc)
      CHECK_RC="true"
      shift
      ;;
    --retries)
      RETRIES="$2"
      shift; shift
      ;;
    --retry-interval-seconds)
      RETRY_INTERVAL_SECONDS="$2"
      shift; shift
      ;;
    -h|--help)
      helpmsg
      exit 0
      ;;
    # Deprecated: kept so older callers fail with a clear message.
    --source)
      echo "ERROR: --source is no longer supported. Istio is always used for reference minors and Sail for availability." >&2
      echo "Use --offset / --force-sail / --check-rc instead." >&2
      exit 1
      ;;
    *)
      echo "ERROR: Unknown argument [${key}]." >&2
      helpmsg >&2
      exit 1
      ;;
  esac
done

if ! [[ "${OFFSET}" =~ ^-?[0-9]+$ ]]; then
  echo "ERROR: --offset must be an integer." >&2
  exit 1
fi
OFFSET=$(( OFFSET < 0 ? -OFFSET : OFFSET ))

if ! [[ "${RETRIES}" =~ ^[0-9]+$ ]] || [ "${RETRIES}" -lt 1 ]; then
  echo "ERROR: --retries must be a positive integer." >&2
  exit 1
fi

if ! [[ "${RETRY_INTERVAL_SECONDS}" =~ ^[0-9]+$ ]] || [ "${RETRY_INTERVAL_SECONDS}" -lt 1 ]; then
  echo "ERROR: --retry-interval-seconds must be a positive integer." >&2
  exit 1
fi

if [ "${FORCE_SAIL}" = "true" ] && [ "${FORCE_ISTIOCTL}" = "true" ]; then
  echo "ERROR: --force-sail and --force-istioctl are mutually exclusive." >&2
  exit 1
fi

fetch_releases_with_retry() {
  local url="$1"
  local label="$2"

  for retry in $(seq 1 "${RETRIES}"); do
    echo "Attempt ${retry}/${RETRIES}: Fetching ${label} release data..." >&2
    curl_result="$(curl -s "${url}" || true)"
    if [ -n "${curl_result}" ] && echo "${curl_result}" | jq -e '.[].tag_name' >/dev/null 2>&1; then
      echo "Successfully fetched ${label} release data." >&2
      printf "%s" "${curl_result}"
      return 0
    fi

    if [ "${retry}" -eq "${RETRIES}" ]; then
      echo "ERROR: Failed to fetch ${label} release data after ${RETRIES} retries. Giving up." >&2
      return 1
    fi
    echo "Failed to fetch valid ${label} release data. Retrying in ${RETRY_INTERVAL_SECONDS} seconds..." >&2
    sleep "${RETRY_INTERVAL_SECONDS}"
  done
}

# Stable X.Y.Z only, highest patch per minor, newest minor first.
ga_versions_from_releases() {
  local curl_result="$1"

  echo "${curl_result}" | jq -r '.[].tag_name' | awk '
    /^[0-9]+\.[0-9]+\.[0-9]+$/ {
      split($0, parts, ".")
      minor = parts[1] "." parts[2]
      if (!(minor in best) || parts[3] + 0 > best_patch[minor] + 0) {
        best[minor] = $0
        best_patch[minor] = parts[3]
      }
    }
    END {
      for (m in best) { print best[m] }
    }' | sort -Vr | sed '/^$/d'
}

# Per minor: GA if present, otherwise newest RC. Newest minors first.
istio_tip_versions_including_rc() {
  local curl_result="$1"

  echo "${curl_result}" | jq -r '.[].tag_name' | sort -rV | awk -F'[-.]' '
    {
      minor = $1 "." $2
      is_rc = ($4 == "rc")
      is_ga = ($0 ~ /^[0-9]+\.[0-9]+\.[0-9]+$/)
      z = $3
      rc_ver = is_rc ? $5 : ""

      if (!minor_ga[minor] && !minor_rc[minor]) {
        if (is_ga) { minor_ga[minor] = $0; minor_ga_z[minor] = z }
        else if (is_rc) { minor_rc[minor] = $0; minor_rc_z[minor] = z; minor_rc_rc[minor] = rc_ver }
      } else if (is_ga && minor_ga[minor]) {
        if (z > minor_ga_z[minor]) { minor_ga[minor] = $0; minor_ga_z[minor] = z }
      } else if (is_ga && !minor_ga[minor]) {
        minor_ga[minor] = $0; minor_ga_z[minor] = z
        delete minor_rc[minor]; delete minor_rc_z[minor]; delete minor_rc_rc[minor]
      } else if (is_rc && !minor_ga[minor]) {
        current_rc_stored = minor_rc[minor]
        split(current_rc_stored, current_rc_parts, "[-.]")
        current_rc_num_stored = current_rc_parts[5]

        if (!minor_rc[minor] || z > minor_rc_z[minor] || (z == minor_rc_z[minor] && rc_ver > current_rc_num_stored)) {
          minor_rc[minor] = $0; minor_rc_z[minor] = z; minor_rc_rc[minor] = rc_ver
        }
      }
    }
    END {
      for (m in minor_ga) { print minor_ga[m] }
      for (m in minor_rc) { print minor_rc[m] }
    }' | sort -Vr | sed '/^$/d'
}

version_minor() {
  printf '%s\n' "$1" | sed -E 's/^([0-9]+)\.([0-9]+).*/\1.\2/'
}

# True if $1 < $2 using version sort (handles X.Y.Z and X.Y.Z-rc.N).
version_lt() {
  local lower
  lower="$(printf '%s\n' "$1" "$2" | sort -V | head -n 1)"
  [ "${lower}" = "$1" ] && [ "$1" != "$2" ]
}

write_github_output() {
  local istio_version="$1"
  local sail_version="$2"
  local sail="$3"
  local install_method="$4"

  if [ -n "${GITHUB_OUTPUT:-}" ]; then
    {
      echo "istio-version=${istio_version}"
      echo "sail-version=${sail_version}"
      echo "sail=${sail}"
      echo "install-method=${install_method}"
    } >> "${GITHUB_OUTPUT}"
  fi
}

istio_json="$(fetch_releases_with_retry "https://api.github.com/repos/istio/istio/releases?per_page=100" "Istio")"
sail_json="$(fetch_releases_with_retry "https://api.github.com/repos/istio-ecosystem/sail-operator/releases?per_page=100" "Sail Operator")"

istio_ga_versions="$(ga_versions_from_releases "${istio_json}")"
sail_ga_versions="$(ga_versions_from_releases "${sail_json}")"
istio_tip_versions="$(istio_tip_versions_including_rc "${istio_json}")"

if [ -z "${istio_ga_versions}" ]; then
  echo "ERROR: No Istio GA versions were found." >&2
  exit 1
fi

if [ -z "${sail_ga_versions}" ]; then
  echo "ERROR: No Sail Operator GA versions were found." >&2
  exit 1
fi

latest_istio_ga="$(echo "${istio_ga_versions}" | head -n 1)"
latest_sail="$(echo "${sail_ga_versions}" | head -n 1)"
latest_istio_tip="$(echo "${istio_tip_versions}" | head -n 1)"

echo "Latest Istio GA (N): ${latest_istio_ga}" >&2
echo "Latest Sail: ${latest_sail}" >&2
echo "Latest Istio tip (GA or RC): ${latest_istio_tip}" >&2

if [ "${CHECK_RC}" = "true" ]; then
  if [[ "${latest_istio_tip}" == *-rc.* ]]; then
    echo "Newest Istio tip is an RC; conditional N test is applicable." >&2
    echo "Using istioctl" >&2
    echo "Istio version: ${latest_istio_tip}" >&2
    echo "Sail version: ${latest_sail}" >&2
    write_github_output "${latest_istio_tip}" "${latest_sail}" "false" "istioctl"
    printf "%s\n" "${latest_istio_tip}"
    exit 0
  fi
  echo "Newest Istio tip is not an RC; skipping conditional N test." >&2
  exit 1
fi

istio_ref="$(echo "${istio_ga_versions}" | head -n $((OFFSET + 1)) | tail -n 1)"
if [ -z "${istio_ref}" ]; then
  echo "ERROR: Unable to determine Istio GA reference for offset ${OFFSET}." >&2
  exit 1
fi

ref_minor="$(version_minor "${istio_ref}")"
sail_for_minor="$(echo "${sail_ga_versions}" | awk -v minor="${ref_minor}" '
  {
    split($0, parts, ".")
    if (parts[1] "." parts[2] == minor) { print; exit }
  }')"

echo "Offset=${OFFSET}, Istio reference (GA): ${istio_ref} (minor ${ref_minor})" >&2
if [ -n "${sail_for_minor}" ]; then
  echo "Sail version for minor ${ref_minor}: ${sail_for_minor}" >&2
else
  echo "Sail version for minor ${ref_minor}: not available (latest Sail ${latest_sail})" >&2
fi

selected_version=""
sail="false"
install_method="istioctl"

if [ "${FORCE_ISTIOCTL}" = "true" ]; then
  selected_version="${istio_ref}"
  sail="false"
  install_method="istioctl"
elif [ "${FORCE_SAIL}" = "true" ]; then
  if [ -z "${sail_for_minor}" ]; then
    echo "ERROR: --force-sail requested but Sail has no release for minor ${ref_minor}." >&2
    exit 1
  fi
  selected_version="${sail_for_minor}"
  sail="true"
  install_method="sail"
elif [ -n "${sail_for_minor}" ] && ! version_lt "${sail_for_minor}" "${istio_ref}"; then
  # Sail is available for this minor and is not behind Istio (patch included).
  selected_version="${sail_for_minor}"
  sail="true"
  install_method="sail"
else
  # Sail missing this minor, or Sail patch/minor is behind Istio → istioctl.
  selected_version="${istio_ref}"
  sail="false"
  install_method="istioctl"
fi

if [ "${install_method}" = "sail" ]; then
  echo "Using Sail" >&2
else
  echo "Using istioctl" >&2
fi
echo "Istio version: ${istio_ref}" >&2
echo "Sail version: ${latest_sail}" >&2
if [ -n "${sail_for_minor}" ] && [ "${sail_for_minor}" != "${latest_sail}" ]; then
  echo "Sail version for selected minor: ${sail_for_minor}" >&2
fi
echo "Selected version to install: ${selected_version}" >&2

write_github_output "${selected_version}" "${latest_sail}" "${sail}" "${install_method}"
printf "%s\n" "${selected_version}"
