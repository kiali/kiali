# Minikube Integration Support

This document describes the minikube integration support that has been added to Kiali's integration test framework.

## Overview

Minikube support has been added as an alternative to Kind clusters for running integration tests. Currently, minikube support is limited to the `BACKEND_EXTERNAL_CONTROLPLANE` test suite.

## Changes Made

### 1. Main Integration Test Script

**File:** `hack/run-integration-tests.sh`

- Added `--cluster-type` / `-ct` option to choose between `kind` (default) and `minikube`
- Added validation to ensure minikube is only used with supported test suites
- Updated help documentation to reflect the new option
- Modified the `BACKEND_EXTERNAL_CONTROLPLANE` test suite to use different setup scripts based on cluster type

### 2. Minikube Setup Script

**File:** `hack/setup-minikube-in-ci.sh`

- Created a new setup script specifically for minikube clusters
- Mirrors the functionality of `setup-kind-in-ci.sh` but adapted for minikube
- Currently only supports the external-controlplane multicluster configuration
- Includes helm charts management and Istio installation

### 3. Minikube External Controlplane Setup

**File:** `hack/istio/multicluster/setup-external-controlplane-minikube.sh`

- Created minikube-specific external controlplane setup
- Uses existing `hack/k8s-minikube.sh` script to create clusters instead of calling minikube directly
- Creates two minikube clusters: `controlplane` and `dataplane`
- Configures MetalLB for LoadBalancer services via k8s-minikube.sh
- Sets up Istio with Sail operator
- Configures Prometheus federation between clusters
- Uses kubectl to get cluster IPs instead of direct minikube calls

### 4. Minikube Kiali Deployment

**File:** `hack/istio/multicluster/deploy-kiali-minikube.sh`

- Created minikube-specific Kiali deployment script
- Handles building and loading Kiali images into minikube clusters
- Configures remote cluster secrets using minikube IP addresses
- Supports both anonymous and token authentication strategies

### 5. Makefile Updates

**File:** `make/Makefile.cluster.mk`

- Added minikube support to the `cluster-push-kiali` target
- Uses `minikube image load` to load container images into clusters
- Supports the `MINIKUBE_PROFILE` variable for targeting specific clusters

## Usage

To run the backend external controlplane tests with minikube:

```bash
./hack/run-integration-tests.sh --cluster-type minikube --test-suite backend-external-controlplane
```

Additional options can be used:
- `--setup-only true` - Only setup the environment without running tests
- `--tests-only true` - Only run tests without setup (requires prior setup)
- `--istio-version <version>` - Specify Istio version

## Requirements

- minikube must be installed and available in PATH
- kubectl must be installed and available in PATH
- Docker or Podman for container operations
- Sufficient system resources for running two minikube clusters

## Limitations

- Currently only supports the `BACKEND_EXTERNAL_CONTROLPLANE` test suite
- Does not support all authentication strategies (currently anonymous and token only)
- Requires manual cleanup of minikube clusters if tests are interrupted

## Future Enhancements

To extend minikube support to other test suites:

1. Add support for additional multicluster configurations (primary-remote, multi-primary, etc.)
2. Implement single-cluster configurations for frontend tests
3. Add support for ambient mesh configuration
4. Extend authentication strategy support (OpenID, etc.)

## Testing

The implementation has been tested with:
- Command line option validation
- Help documentation display
- Initial setup phase execution

Note: Full end-to-end testing requires a proper minikube environment with docker properly configured.
