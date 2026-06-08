#!/bin/bash
#
# Verifies that all expected artifacts were produced after a Kiali sprint release.
# This is the automated equivalent of RELEASE-CHECKLIST.md.
# This script is for minor/major releases only — do not use for patch releases.
#
# Usage:
#   ./hack/verify-github-release.sh -v 2.28 -d 1
#   ./hack/verify-github-release.sh --version 2.28.0 --day all
#   ./hack/verify-github-release.sh -v 2.28 -d 2
#   ./hack/verify-github-release.sh -v 2.28 -d 1 --previous-version 2.27

set -ue

VERSION=""
DAY=""
PREVIOUS_VERSION=""

PASS_COUNT=0
FAIL_COUNT=0

pass() {
  echo "[PASS] $1"
  PASS_COUNT=$((PASS_COUNT + 1))
}

fail() {
  echo "[FAIL] $1"
  FAIL_COUNT=$((FAIL_COUNT + 1))
}

warn() {
  echo "[WARN] $1"
}

check_prereqs() {
  local missing=()
  for cmd in skopeo jq git gh curl; do
    if ! command -v "${cmd}" &>/dev/null; then
      missing+=("${cmd}")
    fi
  done
  if [ ${#missing[@]} -gt 0 ]; then
    echo "ERROR: Missing required tools: ${missing[*]}"
    echo "Install them before running this script."
    exit 1
  fi
}

check_image() {
  local image="$1"
  local expected_archs=4
  local output
  if output=$(skopeo inspect --raw "docker://${image}" 2>/dev/null); then
    local arch_count
    arch_count=$(echo "${output}" | jq '[.manifests[].platform.architecture] | length')
    if [ "${arch_count}" -ge "${expected_archs}" ]; then
      pass "${image} (${arch_count} architectures)"
    else
      fail "${image} — only ${arch_count} architectures (expected ${expected_archs})"
    fi
  else
    fail "${image} — not found"
  fi
}

check_git_tag() {
  local repo="$1"
  local tag="$2"
  if git ls-remote --tags "https://github.com/kiali/${repo}.git" "${tag}" 2>/dev/null | grep -q "${tag}"; then
    pass "Git tag ${tag} on kiali/${repo}"
  else
    fail "Git tag ${tag} on kiali/${repo} — not found"
  fi
}

check_git_branch() {
  local repo="$1"
  local branch="$2"
  if git ls-remote --heads "https://github.com/kiali/${repo}.git" "${branch}" 2>/dev/null | grep -q "${branch}"; then
    pass "Git branch ${branch} on kiali/${repo}"
  else
    fail "Git branch ${branch} on kiali/${repo} — not found"
  fi
}

check_gh_release() {
  local repo="$1"
  local tag="$2"
  if gh release view "${tag}" --repo "kiali/${repo}" &>/dev/null; then
    pass "GitHub Release ${tag} on kiali/${repo}"
  else
    fail "GitHub Release ${tag} on kiali/${repo} — not found"
  fi
}

check_pr() {
  local repo="$1"
  local result
  result=$(gh pr list --repo "kiali/${repo}" --search "Prepare for next version" --state open --json title,number --limit 5 2>/dev/null)
  local count
  count=$(echo "${result}" | jq 'length')
  if [ "${count}" -gt 0 ]; then
    local title
    title=$(echo "${result}" | jq -r '.[0].title')
    local number
    number=$(echo "${result}" | jq -r '.[0].number')
    pass "PR #${number} on kiali/${repo}: \"${title}\""
    if echo "${title}" | grep -qi "DO NOT MERGE"; then
      warn "  Helm charts PR title contains 'DO NOT MERGE' — smoke test failed! Investigate before merging."
    fi
  else
    fail "No open 'Prepare for next version' PR on kiali/${repo}"
  fi
}

check_netlify() {
  local url="$1"
  local status
  status=$(curl -sI "${url}" 2>/dev/null | head -1)
  if echo "${status}" | grep -q "200\|301\|302"; then
    pass "Site reachable: ${url}"
  else
    fail "Site unreachable: ${url} — ${status}"
  fi
}

run_day1() {
  echo ""
  echo "=== Day 1 — Main Release (Monday) ==="
  echo ""

  echo "--- Container Images (Quay.io) ---"
  check_image "quay.io/kiali/kiali:v${VERSION_XYZ}"
  check_image "quay.io/kiali/kiali:v${VERSION_XYZ}-distro"
  check_image "quay.io/kiali/kiali:v${VERSION_XY}"
  check_image "quay.io/kiali/kiali-operator:v${VERSION_XYZ}"
  check_image "quay.io/kiali/kiali-operator:v${VERSION_XY}"
  echo ""

  echo "--- Git Tags ---"
  check_git_tag "kiali" "v${VERSION_XYZ}"
  check_git_tag "kiali-operator" "v${VERSION_XYZ}"
  check_git_tag "helm-charts" "v${VERSION_XYZ}"
  check_git_tag "helm-charts" "v${VERSION_XYZ}-master"
  echo ""

  echo "--- Git Branches ---"
  check_git_branch "kiali" "v${VERSION_XY}"
  check_git_branch "kiali-operator" "v${VERSION_XY}"
  check_git_branch "helm-charts" "v${VERSION_XY}"
  check_git_branch "kiali.io" "v${PREV_VERSION}"
  echo ""

  echo "--- kiali.io Staging ---"
  local config_content
  config_content=$(curl -s "https://raw.githubusercontent.com/kiali/kiali.io/staging/config.toml" 2>/dev/null)
  if echo "${config_content}" | grep -q "v${PREV_VERSION}"; then
    pass "kiali.io staging config.toml contains v${PREV_VERSION} (previous version entry)"
  else
    fail "kiali.io staging config.toml — v${PREV_VERSION} not found (expected previous version entry)"
  fi
  echo ""

  echo "--- GitHub Releases ---"
  check_gh_release "kiali" "v${VERSION_XYZ}"
  echo ""

  echo "--- Pull Requests ---"
  check_pr "kiali"
  check_pr "kiali-operator"
  check_pr "helm-charts"
  echo ""

  echo "--- Documentation Site ---"
  check_netlify "https://kiali.io"
  local prev_url_version
  prev_url_version=$(echo "${PREV_VERSION}" | tr '.' '-')
  check_netlify "https://v${prev_url_version}.kiali.io"
  echo ""
}

run_day2() {
  echo ""
  echo "=== Day 2 — OSSMC Plugin Release (Tuesday) ==="
  echo ""

  echo "--- Container Images (Quay.io) ---"
  check_image "quay.io/kiali/ossmconsole:v${VERSION_XYZ}"
  check_image "quay.io/kiali/ossmconsole:v${VERSION_XY}"
  echo ""

  echo "--- Git Tag ---"
  check_git_tag "openshift-servicemesh-plugin" "v${VERSION_XYZ}"
  echo ""

  echo "--- Git Branch ---"
  check_git_branch "openshift-servicemesh-plugin" "v${VERSION_XY}"
  echo ""

  echo "--- GitHub Release ---"
  check_gh_release "openshift-servicemesh-plugin" "v${VERSION_XYZ}"
  echo ""

  echo "--- Pull Request ---"
  check_pr "openshift-servicemesh-plugin"
  echo ""
}

# Process command line args
while [[ $# -gt 0 ]]; do
  key="$1"
  case $key in
    -v|--version)
      VERSION="$2"
      shift;shift
      ;;
    -d|--day)
      DAY="$2"
      if [ "${DAY}" != "1" ] && [ "${DAY}" != "2" ] && [ "${DAY}" != "all" ]; then
        echo "ERROR: --day must be '1', '2', or 'all'"
        exit 1
      fi
      shift;shift
      ;;
    -pv|--previous-version)
      PREVIOUS_VERSION="$2"
      shift;shift
      ;;
    -h|--help)
      cat <<HELPMSG
Verifies that all expected artifacts were produced after a Kiali sprint release.
This script is for minor/major releases only — do not use for patch releases.

Usage: $(basename "$0") -v <version> -d <day> [options]

Required arguments:
  -v|--version <version>:
       Release version (e.g. 2.28 or 2.28.0). The script derives both X.Y
       and X.Y.Z forms automatically.
  -d|--day <1|2|all>:
       Which release day to verify:
         1   - Day 1 (Monday): kiali, kiali-operator, helm-charts, kiali.io
         2   - Day 2 (Tuesday): openshift-servicemesh-plugin (OSSMC) only
         all - Both days

Optional arguments:
  -pv|--previous-version <version>:
       Previous release version for kiali.io docs branch check (e.g. 2.27).
       Default: automatically computed as X.(Y-1)
  -h|--help:
       This message
HELPMSG
      exit 0
      ;;
    *)
      echo "ERROR: Unknown argument [$key]. Aborting."
      exit 1
      ;;
  esac
done

if [ -z "${VERSION}" ]; then
  echo "ERROR: --version is required (e.g. -v 2.28)"
  echo "Run with --help for usage information."
  exit 1
fi

if [ -z "${DAY}" ]; then
  cat <<DAYMSG
ERROR: --day is required. Specify which release day to verify:

  -d 1     Day 1 (Monday): checks kiali, kiali-operator, helm-charts, and kiali.io
  -d 2     Day 2 (Tuesday): checks openshift-servicemesh-plugin (OSSMC) only
  -d all   Both days

Example: $(basename "$0") -v ${VERSION} -d 1
DAYMSG
  exit 1
fi

# Derive X.Y and X.Y.Z forms from the input version
if [[ "${VERSION}" =~ ^([0-9]+)\.([0-9]+)\.([0-9]+)$ ]]; then
  VERSION_XY="${BASH_REMATCH[1]}.${BASH_REMATCH[2]}"
  VERSION_XYZ="${VERSION}"
elif [[ "${VERSION}" =~ ^([0-9]+)\.([0-9]+)$ ]]; then
  VERSION_XY="${VERSION}"
  VERSION_XYZ="${VERSION}.0"
else
  echo "ERROR: Invalid version format '${VERSION}'. Expected X.Y or X.Y.Z (e.g. 2.28 or 2.28.0)"
  exit 1
fi

# Compute previous version if not provided
if [ -z "${PREVIOUS_VERSION}" ]; then
  local_major="${VERSION_XY%%.*}"
  local_minor="${VERSION_XY##*.}"
  if [ "${local_minor}" -gt 0 ]; then
    PREV_VERSION="${local_major}.$((local_minor - 1))"
  else
    echo "ERROR: Cannot auto-compute previous version from ${VERSION_XY}. Use --previous-version."
    exit 1
  fi
else
  PREV_VERSION="${PREVIOUS_VERSION}"
fi

check_prereqs

echo "Verifying Kiali release v${VERSION_XYZ} (branch v${VERSION_XY}, previous v${PREV_VERSION})"

if [ "${DAY}" = "1" ] || [ "${DAY}" = "all" ]; then
  run_day1
fi

if [ "${DAY}" = "2" ] || [ "${DAY}" = "all" ]; then
  run_day2
fi

TOTAL=$((PASS_COUNT + FAIL_COUNT))
echo "========================================="
echo "Summary: ${PASS_COUNT}/${TOTAL} checks passed, ${FAIL_COUNT} failed"
echo "========================================="

if [ "${FAIL_COUNT}" -gt 0 ]; then
  echo ""
  echo "Some checks failed. See RELEASE-CHECKLIST.md for troubleshooting and recovery steps."
  exit 1
fi
