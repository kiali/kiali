#!/bin/bash

set -euo pipefail

# Simple BDD test runner script
# This is a minimal version for bootstrapping - will be enhanced later

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

echo "Starting Kiali BDD Integration Tests"
echo "Project Root: ${PROJECT_ROOT}"
echo "Test Directory: ${SCRIPT_DIR}"

# Change to project root for proper module resolution
cd "${PROJECT_ROOT}"

# Set default environment variables if not provided
export KIALI_URL="${KIALI_URL:-http://localhost:20001/kiali}"
export KIALI_TOKEN="${KIALI_TOKEN:-}"

echo "Kiali URL: ${KIALI_URL}"

# Run the BDD tests using Ginkgo
echo "Running BDD tests..."
cd tests/integration_bdd

# Basic Ginkgo run with verbose output
ginkgo -v --fail-fast ./features/api/

echo "BDD tests completed" 