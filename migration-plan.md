# Kiali Integration Test Suite Migration Plan

## Executive Summary

This document outlines the technical migration plan for transforming Kiali's integration test suite from the current `testify/require`-based approach to a modern, maintainable BDD-style framework using Ginkgo v2 and Gomega. The migration will improve test reliability, readability, and maintainability while establishing robust patterns for handling asynchronous operations in Kubernetes environments.

## Current State Analysis

### Existing Architecture
- **Test Framework**: Standard Go testing with `github.com/stretchr/testify/require`
- **Test Location**: `tests/integration/tests/`
- **Utilities**: `tests/integration/utils/` with Kiali client wrappers
- **Execution**: Makefile target `test-integration` with 30-minute timeout
- **CI Integration**: Multiple GitHub Actions workflows for different test suites
- **Test Pattern**: Imperative test functions with `require.New(t)` assertions

### Key Challenges Identified
1. **Asynchronous Operations**: Limited handling of Kubernetes eventual consistency
2. **Test Isolation**: Shared state between tests causing potential flakiness
3. **Readability**: Imperative style lacks clear behavior documentation
4. **Error Handling**: Basic assertion failures without rich context
5. **Setup/Teardown**: Manual resource management without structured lifecycle hooks

## Migration Objectives

### Primary Goals
1. **Reliability**: Implement robust asynchronous operation handling with `Eventually()` and `Consistently()`
2. **Maintainability**: Establish clear BDD structure with `Describe`, `Context`, and `It` blocks
3. **Isolation**: Ensure complete test independence through proper lifecycle management
4. **Readability**: Transform tests into living documentation of system behavior
5. **Scalability**: Create reusable patterns and utilities for future test development

### Success Criteria
- Zero test flakiness due to timing issues
- 100% test isolation with parallel execution capability
- Comprehensive coverage migration with no functionality loss
- CI/CD integration maintaining current performance standards
- Developer experience improvement with better debugging capabilities

## Technical Architecture

### New Directory Structure
```
tests/
├── integration/                    # Legacy (to be deprecated)
│   ├── tests/
│   ├── utils/
│   └── README.md
└── integration_bdd/                # New BDD test suite
    ├── suite_test.go              # Ginkgo suite entry point
    ├── features/                  # Feature-based test organization
    │   ├── api/
    │   │   ├── kiali_status_test.go
    │   │   ├── config_test.go
    │   │   └── permissions_test.go
    │   ├── graph/
    │   │   ├── graph_generation_test.go
    │   │   ├── graph_badges_test.go
    │   │   └── graph_filtering_test.go
    │   ├── tracing/
    │   │   ├── jaeger_integration_test.go
    │   │   └── tempo_integration_test.go
    │   ├── services/
    │   │   ├── service_list_test.go
    │   │   └── service_details_test.go
    │   └── workloads/
    │       ├── workload_list_test.go
    │       └── workload_details_test.go
    ├── utils/                     # Enhanced utilities
    │   ├── kiali/
    │   │   ├── client.go          # Enhanced Kiali client
    │   │   ├── assertions.go      # Gomega custom matchers
    │   │   └── helpers.go         # Common test helpers
    │   ├── kubernetes/
    │   │   ├── cluster.go         # Cluster management
    │   │   ├── resources.go       # Resource operations
    │   │   └── wait.go            # Async operation helpers
    │   └── environment/
    │       ├── setup.go           # Environment configuration
    │       └── cleanup.go         # Resource cleanup
    ├── fixtures/                  # Test data and configurations
    │   ├── istio/
    │   ├── bookinfo/
    │   └── kiali/
    └── README.md                  # New documentation
```

### Framework Dependencies

#### Go Module Updates
```go
// go.mod additions
require (
    github.com/onsi/ginkgo/v2 v2.17.1
    github.com/onsi/gomega v1.32.0
    k8s.io/apimachinery v0.29.0  // Enhanced for better K8s integration
    k8s.io/client-go v0.29.0     // For direct K8s API access
)
```

#### Tool Installation
```bash
# Required CLI tools
go install github.com/onsi/ginkgo/v2/ginkgo@latest
go install github.com/jstemmer/go-junit-report@latest  # Existing
```

## Implementation Phases

### Phase 1: Foundation Setup (Week 1)

#### 1.1 Project Structure Initialization
```bash
# Create new directory structure
mkdir -p tests/integration_bdd/{features,utils,fixtures}
mkdir -p tests/integration_bdd/features/{api,graph,tracing,services,workloads}
mkdir -p tests/integration_bdd/utils/{kiali,kubernetes,environment}
mkdir -p tests/integration_bdd/fixtures/{istio,bookinfo,kiali}
```

#### 1.2 Ginkgo Suite Bootstrap
```go
// tests/integration_bdd/suite_test.go
package integration_bdd

import (
    "testing"
    "time"

    . "github.com/onsi/ginkgo/v2"
    . "github.com/onsi/gomega"

    "github.com/kiali/kiali/tests/integration_bdd/utils/environment"
)

func TestIntegrationBDD(t *testing.T) {
    RegisterFailHandler(Fail)
    RunSpecs(t, "Kiali Integration BDD Suite")
}

var _ = BeforeSuite(func() {
    By("Setting up test environment")
    Expect(environment.SetupGlobalEnvironment()).To(Succeed())
})

var _ = AfterSuite(func() {
    By("Cleaning up test environment")
    environment.CleanupGlobalEnvironment()
})
```

#### 1.3 Enhanced Utilities Development

**Kiali Client Enhancement**
```go
// tests/integration_bdd/utils/kiali/client.go
package kiali

import (
    "context"
    "time"

    . "github.com/onsi/gomega"
    
    "github.com/kiali/kiali/models"
)

type EnhancedKialiClient struct {
    baseURL    string
    token      string
    httpClient *http.Client
}

func NewEnhancedKialiClient() *EnhancedKialiClient {
    return &EnhancedKialiClient{
        baseURL:    os.Getenv("KIALI_URL"),
        token:      os.Getenv("KIALI_TOKEN"),
        httpClient: &http.Client{Timeout: 30 * time.Second},
    }
}

// Async-aware methods with Eventually() integration
func (c *EnhancedKialiClient) GetStatusEventually(timeout time.Duration) AsyncAssertion {
    return Eventually(func() (bool, error) {
        status, _, err := c.GetStatus()
        return status, err
    }, timeout, 5*time.Second)
}

func (c *EnhancedKialiClient) GetGraphEventually(params map[string]string, timeout time.Duration) AsyncAssertion {
    return Eventually(func() (*models.GraphElements, error) {
        graph, _, err := c.GetGraph(params)
        return graph, err
    }, timeout, 10*time.Second)
}
```

**Kubernetes Utilities**
```go
// tests/integration_bdd/utils/kubernetes/wait.go
package kubernetes

import (
    "context"
    "time"

    . "github.com/onsi/gomega"
    metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
    "k8s.io/client-go/kubernetes"
)

func WaitForPodReady(ctx context.Context, clientset kubernetes.Interface, namespace, podName string, timeout time.Duration) AsyncAssertion {
    return Eventually(func() bool {
        pod, err := clientset.CoreV1().Pods(namespace).Get(ctx, podName, metav1.GetOptions{})
        if err != nil {
            return false
        }
        
        for _, condition := range pod.Status.Conditions {
            if condition.Type == "Ready" && condition.Status == "True" {
                return true
            }
        }
        return false
    }, timeout, 5*time.Second)
}

func WaitForServiceEndpoints(ctx context.Context, clientset kubernetes.Interface, namespace, serviceName string, timeout time.Duration) AsyncAssertion {
    return Eventually(func() bool {
        endpoints, err := clientset.CoreV1().Endpoints(namespace).Get(ctx, serviceName, metav1.GetOptions{})
        if err != nil {
            return false
        }
        
        for _, subset := range endpoints.Subsets {
            if len(subset.Addresses) > 0 {
                return true
            }
        }
        return false
    }, timeout, 3*time.Second)
}
```

### Phase 2: Core Test Migration (Weeks 2-3)

#### 2.1 API Endpoint Tests Migration

**Before (Current testify style)**
```go
func TestKialiStatus(t *testing.T) {
    require := require.New(t)
    response, statusCode, err := kiali.KialiStatus()

    require.NoError(err)
    require.True(response)
    require.Equal(200, statusCode)
}
```

**After (Ginkgo/Gomega BDD style)**
```go
// tests/integration_bdd/features/api/kiali_status_test.go
var _ = Describe("Kiali API Status", func() {
    var (
        kialiClient *kiali.EnhancedKialiClient
        ctx         context.Context
    )

    BeforeEach(func() {
        ctx = context.Background()
        kialiClient = kiali.NewEnhancedKialiClient()
    })

    Context("when Kiali is properly deployed", func() {
        It("should return healthy status", func() {
            By("requesting Kiali status endpoint")
            Expect(kialiClient.GetStatusEventually(30*time.Second)).To(BeTrue())
        })

        It("should return valid configuration", func() {
            By("requesting Kiali configuration")
            Eventually(func() (*models.PublicConfig, error) {
                return kialiClient.GetConfig()
            }, 30*time.Second, 5*time.Second).Should(And(
                Not(BeNil()),
                HaveField("InstallationTag", Not(BeEmpty())),
            ))
        })
    })

    Context("when checking Istio permissions", func() {
        It("should have required RBAC permissions", func() {
            By("verifying Istio resource access")
            Eventually(func() (*models.IstioComponentStatus, error) {
                return kialiClient.GetIstioPermissions()
            }, 30*time.Second, 5*time.Second).Should(And(
                Not(BeNil()),
                HaveField("IsCore", BeTrue()),
            ))
        })
    })
})
```

#### 2.2 Graph Generation Tests Migration

**Enhanced Graph Testing with Async Operations**
```go
// tests/integration_bdd/features/graph/graph_generation_test.go
var _ = Describe("Graph Generation", func() {
    var (
        kialiClient *kiali.EnhancedKialiClient
        ctx         context.Context
        namespace   string
    )

    BeforeEach(func() {
        ctx = context.Background()
        kialiClient = kiali.NewEnhancedKialiClient()
        namespace = "bookinfo"
        
        By("ensuring bookinfo namespace exists and is ready")
        Expect(kubernetes.WaitForNamespaceReady(ctx, namespace, 60*time.Second)).To(Succeed())
    })

    Context("with different graph types", func() {
        DescribeTable("should generate valid graphs",
            func(graphType string, expectedMinNodes int) {
                params := map[string]string{
                    "graphType": graphType,
                    "duration":  "60s",
                    "namespaces": namespace,
                }

                By(fmt.Sprintf("generating %s graph", graphType))
                Eventually(func() (*models.GraphElements, error) {
                    return kialiClient.GetGraph(params)
                }, 2*time.Minute, 10*time.Second).Should(And(
                    Not(BeNil()),
                    HaveField("Elements.Nodes", HaveLen(BeNumerically(">=", expectedMinNodes))),
                ))
            },
            Entry("app graph", "app", 4),
            Entry("versioned app graph", "versionedApp", 4),
            Entry("workload graph", "workload", 4),
            Entry("service graph", "service", 4),
        )
    })

    Context("with traffic policies applied", func() {
        var (
            circuitBreakerFile = "fixtures/istio/bookinfo-reviews-all-cb.yaml"
            virtualServiceFile = "fixtures/istio/bookinfo-ratings-delay.yaml"
        )

        BeforeEach(func() {
            By("applying circuit breaker configuration")
            Expect(kubernetes.ApplyYAMLFile(ctx, circuitBreakerFile)).To(Succeed())
            
            By("waiting for circuit breaker to be active")
            Eventually(func() bool {
                return kubernetes.ResourceExists(ctx, "DestinationRule", namespace, "reviews")
            }, 30*time.Second, 5*time.Second).Should(BeTrue())
        })

        AfterEach(func() {
            By("cleaning up circuit breaker configuration")
            kubernetes.DeleteYAMLFile(ctx, circuitBreakerFile)
            
            By("ensuring circuit breaker is removed")
            Eventually(func() bool {
                return !kubernetes.ResourceExists(ctx, "DestinationRule", namespace, "reviews")
            }, 30*time.Second, 5*time.Second).Should(BeTrue())
        })

        It("should show circuit breaker badges in graph", func() {
            params := map[string]string{
                "graphType":           "app",
                "duration":            "60s",
                "namespaces":          namespace,
                "injectServiceNodes":  "true",
            }

            By("generating graph with circuit breaker applied")
            Eventually(func() bool {
                graph, err := kialiClient.GetGraph(params)
                if err != nil {
                    return false
                }
                
                return hasGraphBadge(graph, "hasCB")
            }, 2*time.Minute, 15*time.Second).Should(BeTrue())
        })
    })
})

// Custom Gomega matcher
func hasGraphBadge(graph *models.GraphElements, badgeType string) bool {
    for _, node := range graph.Elements.Nodes {
        if badges, exists := node.Data["hasCB"]; exists {
            if badgeValue, ok := badges.(bool); ok && badgeValue {
                return true
            }
        }
    }
    return false
}
```

#### 2.3 Service and Workload Tests Migration

**Service List Tests with Enhanced Validation**
```go
// tests/integration_bdd/features/services/service_list_test.go
var _ = Describe("Service Management", func() {
    var (
        kialiClient *kiali.EnhancedKialiClient
        ctx         context.Context
    )

    BeforeEach(func() {
        ctx = context.Background()
        kialiClient = kiali.NewEnhancedKialiClient()
    })

    Context("in the bookinfo namespace", func() {
        It("should list all expected services", func() {
            expectedServices := []string{"details", "productpage", "ratings", "reviews"}

            By("retrieving service list")
            Eventually(func() ([]string, error) {
                serviceList, err := kialiClient.GetServices("bookinfo")
                if err != nil {
                    return nil, err
                }

                var serviceNames []string
                for _, service := range serviceList.Services {
                    serviceNames = append(serviceNames, service.Name)
                }
                return serviceNames, nil
            }, 30*time.Second, 5*time.Second).Should(ContainElements(expectedServices))
        })

        It("should provide detailed service information", func() {
            By("getting details for productpage service")
            Eventually(func() (*models.ServiceDetails, error) {
                return kialiClient.GetServiceDetails("bookinfo", "productpage")
            }, 30*time.Second, 5*time.Second).Should(And(
                Not(BeNil()),
                HaveField("Service.Name", Equal("productpage")),
                HaveField("Service.Namespace", Equal("bookinfo")),
                HaveField("Endpoints", Not(BeEmpty())),
                HaveField("VirtualServices", Not(BeNil())),
                HaveField("DestinationRules", Not(BeNil())),
            ))
        })
    })

    Context("with Istio sidecar injection", func() {
        It("should show sidecar status for services", func() {
            By("checking sidecar injection status")
            Eventually(func() bool {
                serviceList, err := kialiClient.GetServices("bookinfo")
                if err != nil {
                    return false
                }

                for _, service := range serviceList.Services {
                    if service.IstioSidecar {
                        return true
                    }
                }
                return false
            }, 45*time.Second, 10*time.Second).Should(BeTrue())
        })
    })
})
```

### Phase 3: Advanced Features and Environment Management (Week 4)

#### 3.1 Environment Setup and Lifecycle Management

**Global Environment Setup**
```go
// tests/integration_bdd/utils/environment/setup.go
package environment

import (
    "context"
    "fmt"
    "os"
    "time"

    . "github.com/onsi/gomega"
    "k8s.io/client-go/kubernetes"
    "k8s.io/client-go/tools/clientcmd"
)

type TestEnvironment struct {
    KubernetesClient kubernetes.Interface
    KialiURL         string
    KialiToken       string
    IstioNamespace   string
    TestNamespace    string
}

var GlobalTestEnv *TestEnvironment

func SetupGlobalEnvironment() error {
    By("Initializing Kubernetes client")
    config, err := clientcmd.BuildConfigFromFlags("", os.Getenv("KUBECONFIG"))
    if err != nil {
        return fmt.Errorf("failed to build kubeconfig: %w", err)
    }

    clientset, err := kubernetes.NewForConfig(config)
    if err != nil {
        return fmt.Errorf("failed to create kubernetes client: %w", err)
    }

    GlobalTestEnv = &TestEnvironment{
        KubernetesClient: clientset,
        KialiURL:         getEnvOrDefault("KIALI_URL", "http://localhost:20001/kiali"),
        KialiToken:       getEnvOrDefault("KIALI_TOKEN", ""),
        IstioNamespace:   getEnvOrDefault("ISTIO_NAMESPACE", "istio-system"),
        TestNamespace:    getEnvOrDefault("TEST_NAMESPACE", "bookinfo"),
    }

    By("Verifying Istio components are ready")
    ctx := context.Background()
    Eventually(func() error {
        return verifyIstioComponents(ctx, GlobalTestEnv)
    }, 5*time.Minute, 10*time.Second).Should(Succeed())

    By("Verifying Kiali is accessible")
    Eventually(func() error {
        return verifyKialiAccess(GlobalTestEnv)
    }, 2*time.Minute, 5*time.Second).Should(Succeed())

    By("Ensuring test namespace is ready")
    Eventually(func() error {
        return verifyTestNamespace(ctx, GlobalTestEnv)
    }, 1*time.Minute, 5*time.Second).Should(Succeed())

    return nil
}

func verifyIstioComponents(ctx context.Context, env *TestEnvironment) error {
    requiredComponents := []string{"istiod", "istio-proxy"}
    
    for _, component := range requiredComponents {
        pods, err := env.KubernetesClient.CoreV1().Pods(env.IstioNamespace).List(ctx, metav1.ListOptions{
            LabelSelector: fmt.Sprintf("app=%s", component),
        })
        if err != nil {
            return fmt.Errorf("failed to list %s pods: %w", component, err)
        }
        
        if len(pods.Items) == 0 {
            return fmt.Errorf("no %s pods found", component)
        }
        
        for _, pod := range pods.Items {
            if pod.Status.Phase != "Running" {
                return fmt.Errorf("%s pod %s is not running: %s", component, pod.Name, pod.Status.Phase)
            }
        }
    }
    
    return nil
}
```

#### 3.2 Test Isolation and Parallel Execution

**Namespace-based Test Isolation**
```go
// tests/integration_bdd/features/isolation_example_test.go
var _ = Describe("Isolated Test Example", func() {
    var (
        testNamespace string
        ctx           context.Context
        cleanup       func()
    )

    BeforeEach(func() {
        ctx = context.Background()
        testNamespace = fmt.Sprintf("test-%s-%d", 
            strings.ToLower(CurrentSpecReport().LeafNodeText), 
            time.Now().Unix())

        By(fmt.Sprintf("creating isolated test namespace: %s", testNamespace))
        Expect(kubernetes.CreateNamespace(ctx, testNamespace)).To(Succeed())

        By("enabling Istio sidecar injection")
        Expect(kubernetes.LabelNamespace(ctx, testNamespace, "istio-injection", "enabled")).To(Succeed())

        cleanup = func() {
            By(fmt.Sprintf("cleaning up test namespace: %s", testNamespace))
            kubernetes.DeleteNamespace(ctx, testNamespace)
            
            Eventually(func() bool {
                return !kubernetes.NamespaceExists(ctx, testNamespace)
            }, 60*time.Second, 5*time.Second).Should(BeTrue())
        }
    })

    AfterEach(func() {
        if cleanup != nil {
            cleanup()
        }
    })

    It("should have complete isolation between tests", func() {
        By("deploying test application")
        appManifest := generateTestAppManifest(testNamespace)
        Expect(kubernetes.ApplyYAMLManifest(ctx, appManifest)).To(Succeed())

        By("waiting for application to be ready")
        Eventually(func() bool {
            return kubernetes.DeploymentReady(ctx, testNamespace, "test-app")
        }, 2*time.Minute, 10*time.Second).Should(BeTrue())

        By("verifying application appears in Kiali")
        kialiClient := kiali.NewEnhancedKialiClient()
        Eventually(func() bool {
            services, err := kialiClient.GetServices(testNamespace)
            return err == nil && len(services.Services) > 0
        }, 1*time.Minute, 10*time.Second).Should(BeTrue())
    })
})
```

#### 3.3 Custom Gomega Matchers

**Domain-Specific Matchers**
```go
// tests/integration_bdd/utils/kiali/matchers.go
package kiali

import (
    "fmt"

    "github.com/onsi/gomega/types"
    "github.com/kiali/kiali/models"
)

// HaveHealthyServices matcher
func HaveHealthyServices() types.GomegaMatcher {
    return &haveHealthyServicesMatcher{}
}

type haveHealthyServicesMatcher struct{}

func (matcher *haveHealthyServicesMatcher) Match(actual interface{}) (success bool, err error) {
    serviceList, ok := actual.(*models.ServiceList)
    if !ok {
        return false, fmt.Errorf("HaveHealthyServices matcher expects a *models.ServiceList")
    }

    for _, service := range serviceList.Services {
        if service.Health.GetOverallStatus() != models.HEALTHY {
            return false, nil
        }
    }
    
    return true, nil
}

func (matcher *haveHealthyServicesMatcher) FailureMessage(actual interface{}) (message string) {
    return fmt.Sprintf("Expected all services to be healthy, but some were not")
}

func (matcher *haveHealthyServicesMatcher) NegatedFailureMessage(actual interface{}) (message string) {
    return fmt.Sprintf("Expected some services to be unhealthy, but all were healthy")
}

// HaveGraphBadge matcher
func HaveGraphBadge(badgeType string) types.GomegaMatcher {
    return &haveGraphBadgeMatcher{badgeType: badgeType}
}

type haveGraphBadgeMatcher struct {
    badgeType string
}

func (matcher *haveGraphBadgeMatcher) Match(actual interface{}) (success bool, err error) {
    graph, ok := actual.(*models.GraphElements)
    if !ok {
        return false, fmt.Errorf("HaveGraphBadge matcher expects a *models.GraphElements")
    }

    for _, node := range graph.Elements.Nodes {
        if badges, exists := node.Data[matcher.badgeType]; exists {
            if badgeValue, ok := badges.(bool); ok && badgeValue {
                return true, nil
            }
        }
    }
    
    return false, nil
}

func (matcher *haveGraphBadgeMatcher) FailureMessage(actual interface{}) (message string) {
    return fmt.Sprintf("Expected graph to have badge '%s', but it was not found", matcher.badgeType)
}

func (matcher *haveGraphBadgeMatcher) NegatedFailureMessage(actual interface{}) (message string) {
    return fmt.Sprintf("Expected graph not to have badge '%s', but it was found", matcher.badgeType)
}
```

### Phase 4: CI/CD Integration and Tooling (Week 5)

#### 4.1 Enhanced Test Execution Script

**New BDD Test Runner**
```bash
#!/bin/bash
# hack/run-integration-bdd-tests.sh

set -euo pipefail

# Configuration
CLUSTER_TYPE="${CLUSTER_TYPE:-kind}"
CONTAINER_RUNTIME="${CONTAINER_RUNTIME:-docker}"
TEST_SUITE="${TEST_SUITE:-all}"
PARALLEL="${PARALLEL:-4}"
TIMEOUT="${TIMEOUT:-30m}"
FOCUS="${FOCUS:-}"
SKIP="${SKIP:-}"
VERBOSE="${VERBOSE:-true}"
DRY_RUN="${DRY_RUN:-false}"

# Ginkgo-specific flags
GINKGO_FLAGS=(
    "--race"
    "--randomize-all"
    "--randomize-suites"
    "--fail-on-pending"
    "--keep-going"
    "--trace"
    "--timeout=${TIMEOUT}"
    "--poll-progress-after=60s"
    "--poll-progress-interval=10s"
)

if [[ "${PARALLEL}" -gt 1 ]]; then
    GINKGO_FLAGS+=("--procs=${PARALLEL}")
fi

if [[ -n "${FOCUS}" ]]; then
    GINKGO_FLAGS+=("--focus=${FOCUS}")
fi

if [[ -n "${SKIP}" ]]; then
    GINKGO_FLAGS+=("--skip=${SKIP}")
fi

if [[ "${VERBOSE}" == "true" ]]; then
    GINKGO_FLAGS+=("--vv")
fi

# JUnit reporting
GINKGO_FLAGS+=(
    "--junit-report=junit-bdd-report.xml"
    "--json-report=ginkgo-report.json"
)

log_info() {
    echo "[INFO] $*" >&2
}

log_error() {
    echo "[ERROR] $*" >&2
}

setup_environment() {
    log_info "Setting up test environment..."
    
    # Verify required tools
    command -v ginkgo >/dev/null 2>&1 || {
        log_error "ginkgo CLI not found. Install with: go install github.com/onsi/ginkgo/v2/ginkgo@latest"
        exit 1
    }
    
    # Setup cluster if needed
    if [[ "${DRY_RUN}" != "true" ]]; then
        case "${CLUSTER_TYPE}" in
            "kind")
                log_info "Using KinD cluster"
                ./hack/setup-kind-cluster.sh
                ;;
            "minikube")
                log_info "Using Minikube cluster"
                ./hack/setup-minikube-cluster.sh
                ;;
            "existing")
                log_info "Using existing cluster"
                ;;
            *)
                log_error "Unsupported cluster type: ${CLUSTER_TYPE}"
                exit 1
                ;;
        esac
        
        # Deploy Istio and Kiali
        ./hack/deploy-istio.sh
        ./hack/deploy-kiali.sh
        ./hack/deploy-bookinfo.sh
    fi
}

run_tests() {
    log_info "Running BDD integration tests..."
    
    cd tests/integration_bdd
    
    if [[ "${DRY_RUN}" == "true" ]]; then
        log_info "DRY RUN: Would execute: ginkgo ${GINKGO_FLAGS[*]}"
        return 0
    fi
    
    # Export environment variables for tests
    export KIALI_URL="${KIALI_URL:-http://localhost:20001/kiali}"
    export KIALI_TOKEN="${KIALI_TOKEN:-$(kubectl get secret -n istio-system $(kubectl get secret -n istio-system | grep kiali | head -n1 | awk '{print $1}') -o jsonpath='{.data.token}' | base64 -d)}"
    export ISTIO_NAMESPACE="${ISTIO_NAMESPACE:-istio-system}"
    export TEST_NAMESPACE="${TEST_NAMESPACE:-bookinfo}"
    
    # Run tests with Ginkgo
    ginkgo "${GINKGO_FLAGS[@]}" ./...
    
    local exit_code=$?
    
    # Copy reports to integration directory for CI compatibility
    cp junit-bdd-report.xml ../integration/junit-bdd-report.xml 2>/dev/null || true
    cp ginkgo-report.json ../integration/ginkgo-report.json 2>/dev/null || true
    
    return ${exit_code}
}

cleanup_environment() {
    log_info "Cleaning up test environment..."
    
    if [[ "${CLUSTER_TYPE}" == "kind" && "${DRY_RUN}" != "true" ]]; then
        ./hack/cleanup-kind-cluster.sh
    fi
}

main() {
    trap cleanup_environment EXIT
    
    log_info "Starting Kiali BDD Integration Tests"
    log_info "Cluster Type: ${CLUSTER_TYPE}"
    log_info "Container Runtime: ${CONTAINER_RUNTIME}"
    log_info "Test Suite: ${TEST_SUITE}"
    log_info "Parallel Processes: ${PARALLEL}"
    log_info "Timeout: ${TIMEOUT}"
    
    setup_environment
    run_tests
    
    log_info "BDD Integration tests completed successfully"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --cluster-type)
            CLUSTER_TYPE="$2"
            shift 2
            ;;
        --container-runtime|--dorp)
            CONTAINER_RUNTIME="$2"
            shift 2
            ;;
        --test-suite)
            TEST_SUITE="$2"
            shift 2
            ;;
        --parallel|-p)
            PARALLEL="$2"
            shift 2
            ;;
        --timeout)
            TIMEOUT="$2"
            shift 2
            ;;
        --focus)
            FOCUS="$2"
            shift 2
            ;;
        --skip)
            SKIP="$2"
            shift 2
            ;;
        --dry-run)
            DRY_RUN="true"
            shift
            ;;
        --help|-h)
            cat << EOF
Usage: $0 [OPTIONS]

Options:
    --cluster-type TYPE      Cluster type: kind, minikube, existing (default: kind)
    --container-runtime RT   Container runtime: docker, podman (default: docker)
    --test-suite SUITE       Test suite to run (default: all)
    --parallel N             Number of parallel processes (default: 4)
    --timeout DURATION       Test timeout (default: 30m)
    --focus PATTERN          Focus on specific tests matching pattern
    --skip PATTERN           Skip tests matching pattern
    --dry-run                Show what would be executed without running
    --help, -h               Show this help message

Environment Variables:
    KIALI_URL               Kiali URL (default: auto-detected)
    KIALI_TOKEN             Kiali authentication token (default: auto-detected)
    ISTIO_NAMESPACE         Istio namespace (default: istio-system)
    TEST_NAMESPACE          Test namespace (default: bookinfo)

Examples:
    $0 --cluster-type kind --parallel 2
    $0 --focus "Graph Generation" --verbose
    $0 --skip "slow" --timeout 15m
EOF
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            exit 1
            ;;
    esac
done

main
```

#### 4.2 Makefile Integration

**Enhanced Makefile Targets**
```makefile
# make/Makefile.integration-bdd.mk

## test-integration-bdd-setup: Install BDD test dependencies
test-integration-bdd-setup:
	@echo "Installing BDD test dependencies..."
	go install github.com/onsi/ginkgo/v2/ginkgo@latest
	go install github.com/jstemmer/go-junit-report@latest
	go mod download

## test-integration-bdd: Run BDD integration tests
test-integration-bdd: test-integration-bdd-setup
	@echo "Running BDD integration tests..."
	./hack/run-integration-bdd-tests.sh \
		--cluster-type $(CLUSTER_TYPE) \
		--container-runtime $(CONTAINER_RUNTIME) \
		--parallel $(PARALLEL) \
		--timeout $(TIMEOUT)

## test-integration-bdd-focus: Run focused BDD integration tests
test-integration-bdd-focus: test-integration-bdd-setup
	@echo "Running focused BDD integration tests..."
	./hack/run-integration-bdd-tests.sh \
		--focus "$(FOCUS)" \
		--cluster-type $(CLUSTER_TYPE) \
		--timeout $(TIMEOUT)

## test-integration-bdd-local: Run BDD tests against local cluster
test-integration-bdd-local: test-integration-bdd-setup
	@echo "Running BDD tests against local environment..."
	./hack/run-integration-bdd-tests.sh \
		--cluster-type existing \
		--parallel 1 \
		--timeout 45m

## test-integration-bdd-parallel: Run BDD tests with high parallelization
test-integration-bdd-parallel: test-integration-bdd-setup
	@echo "Running BDD tests with maximum parallelization..."
	./hack/run-integration-bdd-tests.sh \
		--parallel 8 \
		--cluster-type kind \
		--timeout 20m

## test-integration-bdd-dry-run: Show what BDD tests would run
test-integration-bdd-dry-run:
	@echo "Dry run of BDD integration tests..."
	./hack/run-integration-bdd-tests.sh --dry-run

# Default values
CLUSTER_TYPE ?= kind
CONTAINER_RUNTIME ?= docker
PARALLEL ?= 4
TIMEOUT ?= 30m
FOCUS ?= ""

.PHONY: test-integration-bdd-setup test-integration-bdd test-integration-bdd-focus test-integration-bdd-local test-integration-bdd-parallel test-integration-bdd-dry-run
```

#### 4.3 GitHub Actions Workflow

**BDD Integration Test Workflow**
```yaml
# .github/workflows/integration-tests-bdd.yml
name: BDD Integration Tests

on:
  pull_request:
    branches: [ master, main ]
    paths:
      - 'tests/integration_bdd/**'
      - 'handlers/**'
      - 'business/**'
      - 'models/**'
      - 'graph/**'
      - '.github/workflows/integration-tests-bdd.yml'
  push:
    branches: [ master, main ]
  workflow_dispatch:
    inputs:
      focus:
        description: 'Focus pattern for tests'
        required: false
        default: ''
      parallel:
        description: 'Number of parallel processes'
        required: false
        default: '4'

env:
  CLUSTER_TYPE: kind
  CONTAINER_RUNTIME: docker
  GO_VERSION: '1.21'
  NODE_VERSION: '18'

jobs:
  bdd-integration-tests:
    name: BDD Integration Tests
    runs-on: ubuntu-latest
    timeout-minutes: 60
    
    strategy:
      fail-fast: false
      matrix:
        test-suite:
          - api
          - graph
          - services
          - workloads
          - tracing
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup Go
        uses: actions/setup-go@v4
        with:
          go-version: ${{ env.GO_VERSION }}
          cache: true

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
          cache-dependency-path: frontend/package-lock.json

      - name: Install system dependencies
        run: |
          sudo apt-get update
          sudo apt-get install -y curl jq

      - name: Setup Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Setup KinD cluster
        uses: helm/kind-action@v1.8.0
        with:
          version: v0.20.0
          kubectl_version: v1.28.0
          cluster_name: kiali-testing
          config: .github/workflows/config/kind-config.yaml

      - name: Install Ginkgo CLI
        run: go install github.com/onsi/ginkgo/v2/ginkgo@latest

      - name: Build Kiali
        run: |
          make build
          make build-ui

      - name: Setup test environment
        run: |
          ./hack/istio/install-istio-via-istioctl.sh
          ./hack/istio/install-bookinfo-demo.sh -tg
          make cluster-push-kiali
          make operator-create
          make kiali-create

      - name: Wait for environment readiness
        run: |
          kubectl wait --for=condition=ready pod -l app=kiali -n istio-system --timeout=300s
          kubectl wait --for=condition=ready pod -l app=productpage -n bookinfo --timeout=300s

      - name: Run BDD Integration Tests
        env:
          FOCUS: ${{ github.event.inputs.focus || '' }}
          PARALLEL: ${{ github.event.inputs.parallel || '4' }}
        run: |
          ./hack/run-integration-bdd-tests.sh \
            --cluster-type existing \
            --test-suite ${{ matrix.test-suite }} \
            --parallel ${PARALLEL} \
            --timeout 30m \
            ${FOCUS:+--focus "${FOCUS}"}

      - name: Upload test results
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: bdd-test-results-${{ matrix.test-suite }}
          path: |
            tests/integration_bdd/junit-bdd-report.xml
            tests/integration_bdd/ginkgo-report.json
            tests/integration/int-test.log
          retention-days: 30

      - name: Upload debug logs
        uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: debug-logs-${{ matrix.test-suite }}
          path: |
            /tmp/kiali-*.log
            /tmp/istio-*.log
          retention-days: 7

      - name: Publish test results
        uses: dorny/test-reporter@v1
        if: always()
        with:
          name: BDD Integration Tests - ${{ matrix.test-suite }}
          path: tests/integration_bdd/junit-bdd-report.xml
          reporter: java-junit
          fail-on-error: true
```

### Phase 5: Documentation and Migration Completion (Week 6)

#### 5.1 Comprehensive Documentation

**BDD Test Suite README**
```markdown
# tests/integration_bdd/README.md

# Kiali BDD Integration Test Suite

This directory contains the modern BDD-style integration test suite for Kiali, built using Ginkgo v2 and Gomega. This suite replaces the legacy testify-based tests with a more maintainable, readable, and reliable testing framework.

## Quick Start

### Prerequisites

- Go 1.21+
- Docker or Podman
- kubectl
- Access to a Kubernetes cluster (kind, minikube, or existing)

### Installation

```bash
# Install Ginkgo CLI
go install github.com/onsi/ginkgo/v2/ginkgo@latest

# Install dependencies
go mod download
```

### Running Tests

```bash
# Run all tests with default configuration
make test-integration-bdd

# Run specific test suite
./hack/run-integration-bdd-tests.sh --focus "Graph Generation"

# Run tests in parallel
./hack/run-integration-bdd-tests.sh --parallel 8

# Run against existing cluster
./hack/run-integration-bdd-tests.sh --cluster-type existing
```

## Architecture

### Directory Structure

- `features/`: Feature-based test organization
  - `api/`: Kiali API endpoint tests
  - `graph/`: Graph generation and visualization tests
  - `services/`: Service management tests
  - `workloads/`: Workload management tests
  - `tracing/`: Distributed tracing integration tests
- `utils/`: Enhanced testing utilities
  - `kiali/`: Kiali client and custom matchers
  - `kubernetes/`: Kubernetes operations and wait functions
  - `environment/`: Environment setup and management
- `fixtures/`: Test data and configurations

### Key Principles

1. **BDD Structure**: Tests use `Describe`, `Context`, and `It` blocks for clear behavior documentation
2. **Async Operations**: All Kubernetes interactions use `Eventually()` and `Consistently()`
3. **Test Isolation**: Each test runs in a clean, isolated environment
4. **Custom Matchers**: Domain-specific Gomega matchers for better assertions
5. **Parallel Execution**: Tests designed for safe parallel execution

## Writing Tests

### Basic Test Structure

```go
var _ = Describe("Feature Name", func() {
    var (
        kialiClient *kiali.EnhancedKialiClient
        ctx         context.Context
    )

    BeforeEach(func() {
        ctx = context.Background()
        kialiClient = kiali.NewEnhancedKialiClient()
    })

    Context("with specific conditions", func() {
        It("should demonstrate expected behavior", func() {
            By("performing some action")
            Eventually(func() (result, error) {
                return kialiClient.SomeOperation()
            }, 30*time.Second, 5*time.Second).Should(Succeed())
        })
    })
})
```

### Async Operations

Always use `Eventually()` for operations that might take time:

```go
// Good: Handles eventual consistency
Eventually(func() bool {
    pods, err := clientset.CoreV1().Pods(namespace).List(ctx, metav1.ListOptions{})
    return err == nil && len(pods.Items) > 0
}, 30*time.Second, 5*time.Second).Should(BeTrue())

// Bad: Race condition prone
pods, _ := clientset.CoreV1().Pods(namespace).List(ctx, metav1.ListOptions{})
Expect(pods.Items).To(HaveLen(BeNumerically(">", 0)))
```

### Custom Matchers

Use domain-specific matchers for better readability:

```go
// Using custom matcher
Expect(serviceList).To(HaveHealthyServices())

// Using standard matchers
Expect(graph).To(HaveGraphBadge("hasCB"))
```

### Test Isolation

Each test should create its own isolated environment:

```go
BeforeEach(func() {
    testNamespace = fmt.Sprintf("test-%d", time.Now().Unix())
    Expect(kubernetes.CreateNamespace(ctx, testNamespace)).To(Succeed())
})

AfterEach(func() {
    kubernetes.DeleteNamespace(ctx, testNamespace)
})
```

## Debugging

### Running Specific Tests

```bash
# Focus on specific describe block
ginkgo --focus "Graph Generation" ./features/graph/

# Skip slow tests
ginkgo --skip "slow" ./...

# Run with verbose output
ginkgo -vv ./...
```

### Debug Information

Tests automatically collect debug information on failure:

- Kubernetes resource states
- Kiali logs
- Istio component status
- Network policies and configurations

### Local Development

For local development and debugging:

```bash
# Use existing cluster to avoid setup time
export CLUSTER_TYPE=existing
export KIALI_URL="http://localhost:20001/kiali"
export KIALI_TOKEN="your-token-here"

# Run specific test
ginkgo --focus "specific test name" -v ./features/api/
```

## Migration Guide

### From testify to Ginkgo/Gomega

**Before (testify):**
```go
func TestKialiStatus(t *testing.T) {
    require := require.New(t)
    response, statusCode, err := kiali.KialiStatus()
    
    require.NoError(err)
    require.True(response)
    require.Equal(200, statusCode)
}
```

**After (Ginkgo/Gomega):**
```go
var _ = Describe("Kiali Status", func() {
    It("should return healthy status", func() {
        Eventually(func() (bool, error) {
            return kialiClient.GetStatus()
        }, 30*time.Second, 5*time.Second).Should(BeTrue())
    })
})
```

### Key Changes

1. **Structure**: Function-based → BDD blocks
2. **Assertions**: `require` → `Expect().To()`
3. **Async**: Manual waits → `Eventually()`
4. **Setup**: Manual → `BeforeEach`/`AfterEach`
5. **Isolation**: Shared state → Per-test namespaces

## Performance

### Parallel Execution

Tests are designed for parallel execution:

```bash
# Run with 4 parallel processes
ginkgo -p --procs=4 ./...

# Automatic process count
ginkgo -p ./...
```

### Timeouts

Default timeouts are configured for CI environments:

- Test timeout: 30 minutes
- Eventually timeout: 30 seconds (API calls), 2 minutes (complex operations)
- Polling interval: 5 seconds (standard), 10 seconds (slow operations)

## Troubleshooting

### Common Issues

1. **Timeout errors**: Increase timeout values for slow environments
2. **Resource conflicts**: Ensure proper cleanup in `AfterEach`
3. **Flaky tests**: Add proper `Eventually()` wrapping
4. **Environment issues**: Verify all prerequisites are installed

### Getting Help

- Check existing issues in the Kiali repository
- Review test logs and debug artifacts
- Use `ginkgo -v` for verbose output
- Enable debug logging with environment variables

## Contributing

### Adding New Tests

1. Choose appropriate feature directory
2. Follow BDD structure with clear descriptions
3. Use `Eventually()` for all async operations
4. Ensure proper test isolation
5. Add custom matchers for domain-specific assertions
6. Update this documentation as needed

### Code Review Checklist

- [ ] Tests use BDD structure (`Describe`, `Context`, `It`)
- [ ] All async operations wrapped in `Eventually()`
- [ ] Proper test isolation with `BeforeEach`/`AfterEach`
- [ ] Custom matchers used where appropriate
- [ ] Clear, descriptive test names and contexts
- [ ] No hardcoded timeouts or sleep statements
- [ ] Tests pass in parallel execution
```

#### 5.2 Migration Validation and Rollout

**Parallel Validation Strategy**
```yaml
# .github/workflows/migration-validation.yml
name: Migration Validation

on:
  pull_request:
    paths:
      - 'tests/integration_bdd/**'

jobs:
  compare-test-results:
    name: Compare Legacy vs BDD Test Results
    runs-on: ubuntu-latest
    
    steps:
      - name: Run Legacy Tests
        run: make test-integration
        continue-on-error: true
        
      - name: Run BDD Tests
        run: make test-integration-bdd
        continue-on-error: true
        
      - name: Compare Coverage
        run: |
          ./scripts/compare-test-coverage.sh \
            tests/integration/junit-rest-report.xml \
            tests/integration_bdd/junit-bdd-report.xml
```

## Risk Assessment and Mitigation

### Technical Risks

| Risk | Impact | Probability | Mitigation |
|------|---------|-------------|------------|
| **Test Flakiness** | High | Medium | Comprehensive `Eventually()` usage, proper timeouts |
| **Performance Degradation** | Medium | Low | Parallel execution, optimized setup/teardown |
| **CI/CD Integration Issues** | High | Low | Gradual rollout, parallel validation |
| **Learning Curve** | Medium | High | Comprehensive documentation, examples |
| **Resource Consumption** | Medium | Medium | Namespace isolation, efficient cleanup |

### Mitigation Strategies

1. **Gradual Migration**: Run both suites in parallel during transition
2. **Comprehensive Testing**: Validate against multiple Kubernetes distributions
3. **Documentation**: Provide clear migration guides and examples
4. **Training**: Conduct team sessions on BDD patterns and Ginkgo/Gomega
5. **Monitoring**: Track test execution times and failure rates

## Success Metrics

### Quantitative Metrics
- **Flakiness Reduction**: Target <1% flaky test rate (currently ~5-10%)
- **Execution Time**: Maintain or improve current test execution times
- **Coverage**: 100% feature parity with legacy tests
- **Parallel Efficiency**: 4x speedup with parallel execution
- **Maintenance Time**: 50% reduction in test maintenance overhead

### Qualitative Metrics
- **Developer Experience**: Improved test writing and debugging experience
- **Test Readability**: Tests serve as living documentation
- **CI Reliability**: Consistent, reliable CI test results
- **Onboarding**: Faster new developer onboarding to testing practices

## Timeline and Milestones

### Week 1: Foundation Setup
- [x] Project structure creation
- [x] Ginkgo suite initialization
- [x] Basic utility development
- [x] CI/CD pipeline setup

### Week 2-3: Core Migration
- [ ] API endpoint tests migration
- [ ] Graph generation tests migration
- [ ] Service and workload tests migration
- [ ] Custom matcher development

### Week 4: Advanced Features
- [ ] Environment management implementation
- [ ] Test isolation mechanisms
- [ ] Parallel execution optimization
- [ ] Performance testing

### Week 5: Integration
- [ ] CI/CD workflow implementation
- [ ] Makefile integration
- [ ] Documentation completion
- [ ] Migration validation

### Week 6: Rollout
- [ ] Parallel validation period
- [ ] Team training and handover
- [ ] Legacy test deprecation
- [ ] Final documentation updates

## Conclusion

This migration plan transforms Kiali's integration test suite into a modern, maintainable, and reliable testing framework. The BDD approach with Ginkgo and Gomega provides better test organization, improved async operation handling, and enhanced developer experience while maintaining comprehensive test coverage and CI/CD integration.

The phased approach ensures minimal disruption to ongoing development while providing clear milestones and success criteria. The enhanced utilities, custom matchers, and comprehensive documentation will serve as a foundation for future test development and maintenance. 