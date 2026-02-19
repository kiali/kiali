#!/bin/bash

# Normalizes an Istio version string into "MAJOR.MINOR.PATCH".
# Accepts: "1.28.1", "v1.28.1", "1.28", "1.28-dev", "1.28.1-dev", "1.28.1+meta".
# Returns normalized version on stdout; returns non-zero on failure.
kiali_istio_normalize_version() {
  local raw="${1:-}"
  if [ -z "${raw}" ]; then
    return 1
  fi

  # Strip leading "v" and build metadata suffix.
  local v="${raw#v}"
  v="${v%%+*}"

  # Prefer a strict semver match first.
  if [[ "${v}" =~ ^([0-9]+)\.([0-9]+)\.([0-9]+) ]]; then
    printf "%s.%s.%s" "${BASH_REMATCH[1]}" "${BASH_REMATCH[2]}" "${BASH_REMATCH[3]}"
    return 0
  fi

  # Allow "MAJOR.MINOR" (including "MAJOR.MINOR-dev") and normalize to ".0" patch.
  if [[ "${v}" =~ ^([0-9]+)\.([0-9]+) ]]; then
    printf "%s.%s.0" "${BASH_REMATCH[1]}" "${BASH_REMATCH[2]}"
    return 0
  fi

  return 1
}

# Returns 0 if version A is strictly less than version B; 1 if not; 2 on parse error.
kiali_istio_version_lt() {
  local a b
  a="$(kiali_istio_normalize_version "${1:-}")" || return 2
  b="$(kiali_istio_normalize_version "${2:-}")" || return 2

  local a_major a_minor a_patch
  local b_major b_minor b_patch
  IFS='.' read -r a_major a_minor a_patch <<<"${a}"
  IFS='.' read -r b_major b_minor b_patch <<<"${b}"
  IFS=' '

  if (( a_major != b_major )); then
    (( a_major < b_major ))
    return
  fi
  if (( a_minor != b_minor )); then
    (( a_minor < b_minor ))
    return
  fi
  (( a_patch < b_patch ))
}

# Attempts to detect the installed Istio version in the cluster by inspecting the istiod deployment image.
# Prints normalized version (MAJOR.MINOR.PATCH) to stdout.
# Returns non-zero if the version cannot be detected.
kiali_istio_detect_installed_version_from_istiod() {
  local namespace="${1:-istio-system}"

  local image=""
  # Prefer the discovery container, but fall back to the first container.
  image="$(kubectl -n "${namespace}" get deploy istiod -o jsonpath='{.spec.template.spec.containers[?(@.name=="discovery")].image}' 2>/dev/null || true)"
  if [ -z "${image}" ]; then
    image="$(kubectl -n "${namespace}" get deploy istiod -o jsonpath='{.spec.template.spec.containers[0].image}' 2>/dev/null || true)"
  fi
  if [ -z "${image}" ]; then
    return 1
  fi

  # If the image is pinned by digest, we likely don't have a tag to parse.
  if [[ "${image}" == *@sha256:* ]]; then
    return 1
  fi

  # Extract tag (part after last ':'). If no tag, fail.
  local tag="${image##*:}"
  if [ "${tag}" = "${image}" ]; then
    return 1
  fi

  kiali_istio_normalize_version "${tag}"
}

_kiali_istio_assert_eq() {
  local got="${1}"
  local want="${2}"
  local msg="${3:-}"
  if [ "${got}" != "${want}" ]; then
    echo "ASSERT FAILED: ${msg} got='${got}' want='${want}'" >&2
    return 1
  fi
}

_kiali_istio_assert_true() {
  local rc="${1}"
  local msg="${2:-}"
  if [ "${rc}" -ne 0 ]; then
    echo "ASSERT FAILED: ${msg} (expected true)" >&2
    return 1
  fi
}

_kiali_istio_assert_false() {
  local rc="${1}"
  local msg="${2:-}"
  if [ "${rc}" -eq 0 ]; then
    echo "ASSERT FAILED: ${msg} (expected false)" >&2
    return 1
  fi
}

# Self-test when executed directly:
#   hack/istio/version-utils.sh
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  set -euo pipefail

  _kiali_istio_assert_eq "$(kiali_istio_normalize_version "v1.27.3")" "1.27.3" "normalize v-prefixed"
  _kiali_istio_assert_eq "$(kiali_istio_normalize_version "1.27-dev")" "1.27.0" "normalize dev minor"
  _kiali_istio_assert_eq "$(kiali_istio_normalize_version "1.28")" "1.28.0" "normalize major.minor"
  _kiali_istio_assert_eq "$(kiali_istio_normalize_version "1.28.1+meta")" "1.28.1" "normalize build metadata"

  kiali_istio_version_lt "1.27.9" "1.28.0"; _kiali_istio_assert_true "$?" "1.27.9 < 1.28.0"
  kiali_istio_version_lt "1.28.0" "1.28.0"; _kiali_istio_assert_false "$?" "1.28.0 < 1.28.0"
  kiali_istio_version_lt "1.29.0" "1.28.0"; _kiali_istio_assert_false "$?" "1.29.0 < 1.28.0"

  echo "OK"
fi

