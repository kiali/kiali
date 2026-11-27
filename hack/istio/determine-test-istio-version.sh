#!/bin/bash

set -euo pipefail

OFFSET=0
INCLUDE_RC=true
FORCE_ISTIOCTL=false
SAIL_GIT_REF=""
RETRIES=5
RETRY_INTERVAL_SECONDS=5
SAIL_HELM_REPO="${SAIL_OPERATOR_HELM_REPO:-https://istio-ecosystem.github.io/sail-operator}"
SAIL_VERSION_MANIFEST="https://raw.githubusercontent.com/istio-ecosystem/sail-operator"

helpmsg() {
  cat <<'HELP'
Determine the Istio version and installer for CI.

  --offset <0|1|2>             Select N, N-1, or N-2 (default: N).
                              Istio releases and RCs define the minor versions.
  --ga-only                   Ignore RCs (used for PR CI).
  --force-istioctl            Use istioctl for N even if Sail supports it.
  --sail-operator-git-ref REF Look up Sail support at this ref instead of a released chart.
  --retries N                 HTTP attempts per lookup (default: 5).
  --retry-interval-seconds N  Seconds between attempts (default: 5).

N uses the latest upstream release and prefers Sail when it supports that
exact version. N-1 and N-2 use the latest patch supported by the latest
released Sail chart for their minor. Missing Sail support for an older
target is an error.

Prints the selected Istio version. When GITHUB_OUTPUT is set, also writes
istio-version, sail, and sail-operator-source.
HELP
}

while (( $# > 0 )); do
  case "$1" in
    --offset) OFFSET="${2:?Missing offset}"; shift 2 ;;
    --ga-only) INCLUDE_RC=false; shift ;;
    --force-istioctl) FORCE_ISTIOCTL=true; shift ;;
    --sail-operator-git-ref) SAIL_GIT_REF="${2:?Missing Sail ref}"; shift 2 ;;
    --retries) RETRIES="${2:?Missing retry count}"; shift 2 ;;
    --retry-interval-seconds) RETRY_INTERVAL_SECONDS="${2:?Missing retry interval}"; shift 2 ;;
    -h|--help) helpmsg; exit 0 ;;
    *) echo "ERROR: Unknown option $1." >&2; helpmsg >&2; exit 1 ;;
  esac
done

OFFSET="${OFFSET#-}"
if [[ ! "${OFFSET}" =~ ^[012]$ ]]; then
  echo "ERROR: --offset must be 0, 1, or 2." >&2
  exit 1
fi
if [[ ! "${RETRIES}" =~ ^[1-9][0-9]*$ || ! "${RETRY_INTERVAL_SECONDS}" =~ ^[1-9][0-9]*$ ]]; then
  echo "ERROR: Retry count and interval must be positive integers." >&2
  exit 1
fi
if [[ "${FORCE_ISTIOCTL}" == true && "${OFFSET}" != 0 ]]; then
  echo "ERROR: N-1 and N-2 require Sail." >&2
  exit 1
fi

fetch() {
  local url="$1" label="$2" attempt response
  local headers=()
  if [[ "${url}" == https://api.github.com/* && -n "${GH_TOKEN:-}" ]]; then
    headers=(-H "Authorization: Bearer ${GH_TOKEN}")
  fi
  for ((attempt = 1; attempt <= RETRIES; attempt++)); do
    if response="$(curl -fsSL --max-time 15 "${headers[@]}" "${url}")" && [[ -n "${response}" ]]; then
      printf '%s' "${response}"
      return 0
    fi
    if (( attempt < RETRIES )); then
      echo "Could not fetch ${label} (attempt ${attempt}/${RETRIES}); retrying." >&2
      sleep "${RETRY_INTERVAL_SECONDS}"
    fi
  done
  echo "ERROR: Could not fetch ${label} after ${RETRIES} attempts." >&2
  return 1
}

resolve_upstream() {
  # Rank numeric components and RC numbers separately so GA wins over its own RCs.
  jq -r --argjson include_rc "${INCLUDE_RC}" --argjson offset "${OFFSET}" '
    if type != "array" then error("Expected a list of Istio releases") else . end
    | [
        .[]
        | select(.draft != true)
        | .tag_name | strings
        | capture("^(?<version>(?<major>[0-9]+)\\.(?<minor>[0-9]+)\\.(?<patch>[0-9]+)(?:-rc\\.(?<rc>[0-9]+))?)$")
        | select($include_rc or .rc == null)
        | .major |= tonumber | .minor |= tonumber | .patch |= tonumber
        | .rc |= (if . == null then null else tonumber end)
      ]
    | group_by([.major, .minor]) | reverse
    | .[$offset] // error("No Istio release for offset \($offset)")
    | max_by([.patch, (.rc == null), .rc]).version
  '
}

resolve_sail_chart() {
  local minor="$1" index rows
  index="$(fetch "${SAIL_HELM_REPO%/}/index.yaml" "Sail chart index")"
  rows="$(yq -o=json '.entries."sail-operator"' <<< "${index}" | jq -r --arg minor "${minor}" '
    if type != "array" or length == 0 then error("Missing Sail charts in Helm index") else . end
    | [
        .[]
        | select(.version | type == "string")
        | select(.version | startswith($minor + "."))
        | select(.version | test("^[0-9]+\\.[0-9]+\\.[0-9]+$"))
        | . + {patch: (.version | split(".") | last | tonumber)}
      ]
    | if length == 0 then empty else max_by(.patch) | [.version, .appVersion] | @tsv end
  ')"
  printf '%s' "${rows}"
}

resolve_sail_versions() {
  local ref="$1" minor="$2" manifest
  manifest="$(fetch "${SAIL_VERSION_MANIFEST}/${ref}/pkg/istioversion/versions.yaml" "Istio support for Sail ${ref}")"
  yq -o=json '.versions' <<< "${manifest}" | jq -r --arg minor "${minor}" '
    if type != "array" or length == 0 then error("Missing supported Istio versions in Sail manifest") else . end
    | .[]
    | select(.eol != true)
    | .version | strings
    | select(startswith($minor + "."))
    | select(test("^[0-9]+\\.[0-9]+\\.[0-9]+(-rc\\.[0-9]+)?$"))
  '
}

releases="$(fetch "https://api.github.com/repos/istio/istio/releases?per_page=100" "Istio releases")"
upstream_version="$(resolve_upstream <<< "${releases}")"
minor="$(cut -d. -f1-2 <<< "${upstream_version}")"
selected_version="${upstream_version}"
sail=false
sail_source=""

if [[ "${FORCE_ISTIOCTL}" == false ]]; then
  if [[ -n "${SAIL_GIT_REF}" ]]; then
    sail_ref="${SAIL_GIT_REF}"
    candidate_source="git:${SAIL_GIT_REF}"
  else
    chart_record="$(resolve_sail_chart "${minor}")"
    IFS=$'\t' read -r chart_version sail_ref <<< "${chart_record}"
    candidate_source="chart:${chart_version}"
    if [[ -n "${chart_version}" && ! "${sail_ref}" =~ ^v?[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
      echo "ERROR: Sail chart ${chart_version} has no valid appVersion." >&2
      exit 1
    fi
  fi

  sail_versions=""
  if [[ -n "${sail_ref}" ]]; then
    sail_versions="$(resolve_sail_versions "${sail_ref}" "${minor}")"
  fi
  if [[ "${OFFSET}" == 0 ]]; then
    if grep -Fxq "${upstream_version}" <<< "${sail_versions}"; then
      sail=true
    fi
  else
    selected_version="$(awk '!/-rc\./ && NF' <<< "${sail_versions}" | sort -V | tail -n 1)"
    if [[ -z "${selected_version}" ]]; then
      echo "ERROR: N-${OFFSET} targets Istio ${minor}, but the latest Sail release for that minor has no installable stable patch." >&2
      exit 1
    fi
    sail=true
  fi
  if [[ "${sail}" == true ]]; then
    sail_source="${candidate_source}"
  fi
fi

echo "Offset ${OFFSET} selects Istio ${selected_version} (upstream reference ${upstream_version}, Sail: ${sail_source:-disabled})." >&2
if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  {
    printf 'istio-version=%s\n' "${selected_version}"
    printf 'sail=%s\n' "${sail}"
    printf 'sail-operator-source=%s\n' "${sail_source}"
  } >> "${GITHUB_OUTPUT}"
fi
printf '%s\n' "${selected_version}"
