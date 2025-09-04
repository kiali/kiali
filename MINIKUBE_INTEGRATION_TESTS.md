# Minikube Integration Tests

This document explains how to run Kiali integration tests using minikube instead of KinD.

## Overview

The `run-integration-tests.sh` script now supports both KinD and minikube cluster types for the `backend-external-controlplane` test suite. This allows you to test Kiali's external control plane functionality using minikube clusters.

## Prerequisites

- minikube installed and available in PATH
- docker installed and running
- kubectl installed and available in PATH
- Sufficient system resources (recommended: 8GB+ RAM, 4+ CPU cores)

## Usage

To run the backend-external-controlplane integration tests with minikube:

```bash
./hack/run-integration-tests.sh --cluster-type minikube --test-suite backend-external-controlplane --setup-only true --helm-charts-dir ../helm-charts
```

### Parameters

- `--cluster-type minikube`: Specifies to use minikube instead of the default KinD
- `--test-suite backend-external-controlplane`: Runs the external control plane test suite
- `--setup-only true`: Only sets up the environment without running the tests
- `--helm-charts-dir ../helm-charts`: Path to the Helm charts directory

## How It Works

### Cluster Setup

1. **Two minikube clusters**: The script creates two minikube profiles:
   - `controlplane`: Hosts the Istio control plane and Kiali
   - `dataplane`: Hosts the application workloads

2. **Network connectivity**: The clusters are connected using minikube's network sharing feature:
   - The `controlplane` cluster is created first
   - The `dataplane` cluster is created with `--network=mk-controlplane` to share the network

3. **Load balancer configuration**: Each cluster gets its own MetalLB IP range:
   - `controlplane`: 192.168.49.70-192.168.49.84  
   - `dataplane`: 192.168.49.85-192.168.49.98

### Istio Configuration

The script sets up an external control plane configuration where:
- The control plane runs in the `controlplane` cluster
- The data plane runs in the `dataplane` cluster  
- Communication happens via LoadBalancer services and ingress gateways

### Key Files

- `hack/setup-minikube-in-ci.sh`: Main minikube setup script (similar to setup-kind-in-ci.sh)
- `hack/istio/multicluster/setup-minikube-external-controlplane.sh`: Minikube-specific external control plane setup
- `hack/run-integration-tests.sh`: Modified to support --cluster-type parameter

## Troubleshooting

### Common Issues

1. **Context already exists error**: If you see "cannot rename the context 'controlplane', the context 'controlplane' already exists", this is fixed in the latest version. The script now properly handles existing contexts by updating them instead of trying to rename them.

2. **Network connectivity**: If clusters can't communicate, ensure:
   - Both clusters are using the same docker network
   - MetalLB is properly configured with non-overlapping IP ranges
   - No firewall rules blocking communication

3. **Certificate authority errors**: The script automatically configures the correct certificate paths. Minikube stores the CA certificate in `~/.minikube/ca.crt` (not in profile-specific directories).

4. **Resource constraints**: Minikube clusters require significant resources:
   - Increase memory/CPU allocation if needed
   - Monitor system resources during setup

5. **Context switching**: The script manages kubectl contexts automatically:
   - `controlplane` context for the control plane cluster
   - `dataplane` context for the data plane cluster

### Debugging

To debug issues:

1. Check minikube status: `minikube profile list`
2. Verify network connectivity: `docker network ls` and `docker network inspect mk-controlplane`
3. Check kubectl contexts: `kubectl config get-contexts`
4. Verify LoadBalancer IPs: `kubectl get svc --all-namespaces`

## Comparison with KinD

| Feature | KinD | Minikube |
|---------|------|----------|
| Network setup | Docker bridge networks | Minikube network sharing |
| Load balancer | MetalLB on kind network | MetalLB with minikube IPs |
| Context names | kind-controlplane, kind-dataplane | controlplane, dataplane |
| Resource usage | Lower | Higher |
| Setup complexity | Lower | Higher |

## Future Improvements

- Support for other test suites beyond backend-external-controlplane
- Automated cleanup of minikube profiles
- Better resource management and configuration
- Integration with CI/CD pipelines
