#!/bin/bash

#
# This script builds Kiali for multiple operating systems and architectures.
# It supports Windows, macOS (Darwin) ARM64 and AMD64, and Linux ARM64 and AMD64.
#
# Usage: ./build-cross-platform.sh [options]
#
# Options:
#   -o, --output-dir DIR    Output directory for binaries (default: _output/cross-platform)
#   -v, --verbose           Enable verbose output
#   -h, --help              Show this help message
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOTDIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

OUTPUT_DIR="${ROOTDIR}/_output/cross-platform"
VERBOSE=false

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Platform combinations we want to build for
# Format: "GOOS:GOARCH:suffix"
PLATFORMS=(
    "windows:amd64:windows-amd64.exe"
    "darwin:amd64:darwin-amd64"
    "darwin:arm64:darwin-arm64"
    "linux:amd64:linux-amd64"
    "linux:arm64:linux-arm64"
)

usage() {
    echo "Usage: $0 [options]"
    echo ""
    echo "Build Kiali for multiple operating systems and architectures."
    echo ""
    echo "Options:"
    echo "  -o, --output-dir DIR    Output directory for binaries (default: _output/cross-platform)"
    echo "  -v, --verbose           Enable verbose output"
    echo "  -h, --help              Show this help message"
    echo ""
    echo "Supported platforms:"
    echo "  - Windows AMD64"
    echo "  - macOS (Darwin) AMD64"
    echo "  - macOS (Darwin) ARM64"
    echo "  - Linux AMD64"
    echo "  - Linux ARM64"
    echo ""
}

log() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

verbose_log() {
    if [[ "${VERBOSE}" == "true" ]]; then
        echo -e "${BLUE}[VERBOSE]${NC} $1"
    fi
}

while [[ $# -gt 0 ]]; do
    case $1 in
        -o|--output-dir)
            OUTPUT_DIR="$2"
            shift 2
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            usage
            exit 1
            ;;
    esac
done

build_platform() {
    local goos="$1"
    local goarch="$2"
    local suffix="$3"
    local output_file="${OUTPUT_DIR}/kiali-${suffix}"
    
    log "Building for ${goos}/${goarch}..."
    
    local make_status
    if [[ "${VERBOSE}" == "true" ]]; then
        GO_BUILD_OUTPUT="${output_file}" GOOS="${goos}" GOARCH="${goarch}" make -C "${ROOTDIR}" build
        make_status=$?
    else
        GO_BUILD_OUTPUT="${output_file}" GOOS="${goos}" GOARCH="${goarch}" make -C "${ROOTDIR}" build > /dev/null 2>&1
        make_status=$?
    fi
    return "${make_status}"
}

main() {
    log "Starting cross-platform build for Kiali"
    
    local failed_builds=()
    local successful_builds=()
    
    for platform in "${PLATFORMS[@]}"; do
        IFS=':' read -r goos goarch suffix <<< "${platform}"
        
        if build_platform "${goos}" "${goarch}" "${suffix}"; then
            successful_builds+=("${goos}/${goarch}")
        else
            failed_builds+=("${goos}/${goarch}")
        fi
    done
    
    echo ""
    log "Build Summary:"
    echo "=============="
    
    if [[ ${#successful_builds[@]} -gt 0 ]]; then
        log_success "Successfully built for ${#successful_builds[@]} platform(s):"
        for platform in "${successful_builds[@]}"; do
            echo "  ✓ ${platform}"
        done
    fi
    
    if [[ ${#failed_builds[@]} -gt 0 ]]; then
        log_error "Failed to build for ${#failed_builds[@]} platform(s):"
        for platform in "${failed_builds[@]}"; do
            echo "  ✗ ${platform}"
        done
        echo ""
        log_error "Some builds failed. Check the output above for details."
        exit 1
    fi
    
    echo ""
    log_success "All cross-platform builds completed successfully!"
    log "Binaries are located in: ${OUTPUT_DIR}"
    
    echo ""
    log "Generated binaries:"
    ls -lh "${OUTPUT_DIR}"/kiali-* | awk '{print "  " $9 " (" $5 ")"}'
}

main "$@"
