#!/bin/bash

set -euo pipefail

SOURCE="istio"
OFFSET="0"
RETRIES="120"
RETRY_INTERVAL_SECONDS="60"

helpmsg() {
  cat <<'HELP'
Determine test Istio version for CI/local runs.

Usage:
  determine-test-istio-version.sh [options]

Options:
  --source <istio|sail>
    Version source. "istio" reads istio/istio releases.
    "sail" reads istio-ecosystem/sail-operator releases and uses stable X.Y.Z only.
    Default: istio

  --offset <n>
    Minor-version offset from newest candidate set.
    0 = latest, 1 = previous minor, 2 = two minors back.
    Negative values are converted to absolute value.
    Default: 0

  --retries <n>
    Retry attempts when API fetch fails.
    Default: 120

  --retry-interval-seconds <n>
    Seconds to sleep between retries.
    Default: 60

  -h|--help
    Show this message.

Output:
  Prints the selected version to stdout.
HELP
}

while [[ $# -gt 0 ]]; do
  key="$1"
  case "${key}" in
    --source)
      SOURCE="$2"
      shift; shift
      ;;
    --offset)
      OFFSET="$2"
      shift; shift
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
    *)
      echo "ERROR: Unknown argument [${key}]." >&2
      helpmsg >&2
      exit 1
      ;;
  esac
done

if [[ "${SOURCE}" != "istio" && "${SOURCE}" != "sail" ]]; then
  echo "ERROR: --source must be one of: istio, sail" >&2
  exit 1
fi

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

determine_from_istio_releases() {
  local curl_result="$1"

  echo "${curl_result}" | jq -r '.[].tag_name' | sort -rV | awk -F'[-.]' '
    {
      minor = $1 "." $2
      is_rc = ($4 == "rc")
      z = $3
      rc_ver = is_rc ? $5 : ""

      if (!minor_ga[minor] && !minor_rc[minor]) {
        if (is_rc) { minor_rc[minor] = $0; minor_rc_z[minor] = z; minor_rc_rc[minor] = rc_ver }
        else { minor_ga[minor] = $0; minor_ga_z[minor] = z }
      } else if (!is_rc && minor_ga[minor]) {
        if (z > minor_ga_z[minor]) { minor_ga[minor] = $0; minor_ga_z[minor] = z }
      } else if (!is_rc && !minor_ga[minor]) {
        minor_ga[minor] = $0; minor_ga_z[minor] = z; delete minor_rc[minor]; delete minor_rc_z[minor]; delete minor_rc_rc[minor]
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
      # Historical behavior for Istio-based flow in this workflow.
      for (m in minor_ga) { split(minor_ga[m], version_parts, "."); print version_parts[1] "." version_parts[2] "-latest" }
      for (m in minor_rc) { split(minor_rc[m], version_parts, "."); print version_parts[1] "." version_parts[2] "-latest" }
    }' | sort -Vr | sed '/^$/d'
}

determine_from_sail_releases() {
  local curl_result="$1"

  # Keep only stable X.Y.Z tags and select the highest patch for each minor.
  echo "${curl_result}" | jq -r '.[].tag_name' | awk '
    /^[0-9]+\.[0-9]+\.[0-9]+$/ {
      split($0, parts, ".")
      minor = parts[1] "." parts[2]
      if (!(minor in best) || parts[3] > best_patch[minor]) {
        best[minor] = $0
        best_patch[minor] = parts[3]
      }
    }
    END {
      for (m in best) { print best[m] }
    }' | sort -Vr | sed '/^$/d'
}

if [ "${SOURCE}" = "sail" ]; then
  releases_json="$(fetch_releases_with_retry "https://api.github.com/repos/istio-ecosystem/sail-operator/releases" "Sail Operator")"
  candidates="$(determine_from_sail_releases "${releases_json}")"
else
  releases_json="$(fetch_releases_with_retry "https://api.github.com/repos/istio/istio/releases" "Istio")"
  candidates="$(determine_from_istio_releases "${releases_json}")"
fi

if [ -z "${candidates}" ]; then
  echo "ERROR: No candidate versions were found for source '${SOURCE}'." >&2
  exit 1
fi

selected_version="$(echo "${candidates}" | head -n $((OFFSET + 1)) | tail -n 1)"
if [ -z "${selected_version}" ]; then
  echo "ERROR: Unable to determine a version for offset ${OFFSET} from source '${SOURCE}'." >&2
  exit 1
fi

echo "Candidate versions for source '${SOURCE}':" >&2
echo "${candidates}" >&2
echo "Offset=${OFFSET}, selected version=${selected_version}" >&2
printf "%s\n" "${selected_version}"
