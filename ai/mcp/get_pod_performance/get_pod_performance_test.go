package get_pod_performance

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kiali/kiali/ai/mcputil"
	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/prometheus"
	"github.com/kiali/kiali/prometheus/prometheustest"
	"github.com/kiali/kiali/util"
)

func init() {
	util.Clock = util.RealClock{}
}

func mockPrometheusEmpty(promAPI *prometheustest.PromAPIMock) {
	emptyVec := model.Vector{}
	promAPI.On("Query", mock.Anything, mock.Anything, mock.AnythingOfType("time.Time")).Return(emptyVec, nil, nil)
}

func mockPrometheusWithMetrics(promAPI *prometheustest.PromAPIMock, cpuCores, memBytes float64) {
	promAPI.On("Query", mock.Anything, mock.MatchedBy(func(q string) bool {
		return strings.Contains(q, "sum(rate(container_cpu_usage_seconds_total")
	}), mock.AnythingOfType("time.Time")).Return(model.Vector{
		{Value: model.SampleValue(cpuCores)},
	}, nil, nil)

	promAPI.On("Query", mock.Anything, mock.MatchedBy(func(q string) bool {
		return strings.Contains(q, "sum(container_memory_working_set_bytes")
	}), mock.AnythingOfType("time.Time")).Return(model.Vector{
		{Value: model.SampleValue(memBytes)},
	}, nil, nil)

	promAPI.On("Query", mock.Anything, mock.MatchedBy(func(q string) bool {
		return strings.Contains(q, "sum by (container)")
	}), mock.AnythingOfType("time.Time")).Return(model.Vector{
		{Metric: model.Metric{"container": "app"}, Value: model.SampleValue(cpuCores)},
	}, nil, nil)
}

func newPromClient(t *testing.T, conf *config.Config, k8s *kubetest.FakeK8sClient, promAPI *prometheustest.PromAPIMock) prometheus.ClientInterface {
	promClient, err := prometheus.NewClient(*conf, k8s)
	require.NoError(t, err)
	promClient.Inject(promAPI)
	return promClient
}

func fakePod(name, namespace string, containers ...corev1.Container) *corev1.Pod {
	return &corev1.Pod{
		ObjectMeta: metav1.ObjectMeta{Name: name, Namespace: namespace},
		Spec:       corev1.PodSpec{Containers: containers},
	}
}

func containerWithResources(name, cpuReq, cpuLim, memReq, memLim string) corev1.Container {
	c := corev1.Container{Name: name}
	if cpuReq != "" || memReq != "" {
		c.Resources.Requests = corev1.ResourceList{}
		if cpuReq != "" {
			c.Resources.Requests[corev1.ResourceCPU] = resource.MustParse(cpuReq)
		}
		if memReq != "" {
			c.Resources.Requests[corev1.ResourceMemory] = resource.MustParse(memReq)
		}
	}
	if cpuLim != "" || memLim != "" {
		c.Resources.Limits = corev1.ResourceList{}
		if cpuLim != "" {
			c.Resources.Limits[corev1.ResourceCPU] = resource.MustParse(cpuLim)
		}
		if memLim != "" {
			c.Resources.Limits[corev1.ResourceMemory] = resource.MustParse(memLim)
		}
	}
	return c
}

func newKialiInterface(conf *config.Config, clientFactory *kubetest.K8SClientFactoryMock, prom prometheus.ClientInterface, businessLayer ...*business.Layer) *mcputil.KialiInterface {
	req := httptest.NewRequest(http.MethodPost, "http://kiali/api/chat/mcp/get_pod_performance", nil)
	ki := &mcputil.KialiInterface{
		Request:       req,
		Conf:          conf,
		ClientFactory: clientFactory,
		Prom:          prom,
	}
	if len(businessLayer) > 0 {
		ki.BusinessLayer = businessLayer[0]
	}
	return ki
}

// ========================================================================
// Input Validation Tests
// ========================================================================

func TestExecute_MissingNamespace_ReturnsBadRequest(t *testing.T) {
	conf := config.NewConfig()
	args := map[string]interface{}{
		"podName": "my-pod",
	}

	res, code := Execute(newKialiInterface(conf, nil, nil), args)
	require.Equal(t, http.StatusBadRequest, code)
	assert.Contains(t, res.(string), "namespace is required")
}

func TestExecute_MissingPodAndWorkload_ReturnsBadRequest(t *testing.T) {
	conf := config.NewConfig()
	args := map[string]interface{}{
		"namespace": "bookinfo",
	}

	res, code := Execute(newKialiInterface(conf, nil, nil), args)
	require.Equal(t, http.StatusBadRequest, code)
	assert.Contains(t, res.(string), "podName or workloadName is required")
}

func TestExecute_InvalidTimeRange_ReturnsBadRequest(t *testing.T) {
	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "Kubernetes"
	args := map[string]interface{}{
		"namespace": "bookinfo",
		"podName":   "my-pod",
		"timeRange": "invalid-duration",
	}

	res, code := Execute(newKialiInterface(conf, nil, nil), args)
	require.Equal(t, http.StatusBadRequest, code)
	assert.Contains(t, res.(string), "invalid timeRange")
}

func TestExecute_ValidTimeRanges_Accepted(t *testing.T) {
	tests := []struct {
		name      string
		timeRange string
	}{
		{"minutes", "5m"},
		{"hours", "1h"},
		{"days", "1d"},
		{"seconds", "30s"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			conf := config.NewConfig()
			conf.KubernetesConfig.ClusterName = "Kubernetes"
			config.Set(conf)

			pod := fakePod("my-pod", "bookinfo", containerWithResources("app", "100m", "500m", "128Mi", "256Mi"))
			k8s := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("bookinfo"), pod)
			clientFactory := kubetest.NewFakeClientFactoryWithClient(conf, k8s)

			promAPI := new(prometheustest.PromAPIMock)
			mockPrometheusEmpty(promAPI)
			prom := newPromClient(t, conf, k8s, promAPI)

			args := map[string]interface{}{
				"namespace": "bookinfo",
				"podName":   "my-pod",
				"timeRange": tt.timeRange,
			}

			_, code := Execute(newKialiInterface(conf, clientFactory, prom), args)
			assert.Equal(t, http.StatusOK, code)
		})
	}
}

// ========================================================================
// Parameter Combination Tests
// ========================================================================

func TestExecute_PodNameOnly_Works(t *testing.T) {
	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "Kubernetes"
	config.Set(conf)

	pod := fakePod("my-pod", "bookinfo", containerWithResources("app", "100m", "500m", "128Mi", "256Mi"))
	k8s := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("bookinfo"), pod)
	clientFactory := kubetest.NewFakeClientFactoryWithClient(conf, k8s)

	promAPI := new(prometheustest.PromAPIMock)
	mockPrometheusEmpty(promAPI)
	prom := newPromClient(t, conf, k8s, promAPI)

	args := map[string]interface{}{
		"namespace": "bookinfo",
		"podName":   "my-pod",
	}

	res, code := Execute(newKialiInterface(conf, clientFactory, prom), args)
	require.Equal(t, http.StatusOK, code)
	msg := res.(string)
	assert.Contains(t, msg, "my-pod")
	assert.Contains(t, msg, "resolved from: `pod`")
}

func TestExecute_WorkloadNameOnly_FallsBackToPod(t *testing.T) {
	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "Kubernetes"
	config.Set(conf)

	pod := fakePod("my-deploy", "bookinfo", containerWithResources("app", "100m", "500m", "128Mi", "256Mi"))
	k8s := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("bookinfo"), pod)
	clientFactory := kubetest.NewFakeClientFactoryWithClient(conf, k8s)

	promAPI := new(prometheustest.PromAPIMock)
	mockPrometheusEmpty(promAPI)
	prom := newPromClient(t, conf, k8s, promAPI)

	args := map[string]interface{}{
		"namespace":    "bookinfo",
		"workloadName": "my-deploy",
	}

	res, code := Execute(newKialiInterface(conf, clientFactory, prom), args)
	require.Equal(t, http.StatusOK, code)
	msg := res.(string)
	assert.Contains(t, msg, "my-deploy")
}

func TestExecute_BothPodAndWorkload_PodNameTakesPrecedence(t *testing.T) {
	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "Kubernetes"
	config.Set(conf)

	pod := fakePod("my-pod", "bookinfo", containerWithResources("app", "100m", "500m", "128Mi", "256Mi"))
	k8s := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("bookinfo"), pod)
	clientFactory := kubetest.NewFakeClientFactoryWithClient(conf, k8s)

	promAPI := new(prometheustest.PromAPIMock)
	mockPrometheusEmpty(promAPI)
	prom := newPromClient(t, conf, k8s, promAPI)

	args := map[string]interface{}{
		"namespace":    "bookinfo",
		"podName":      "my-pod",
		"workloadName": "some-workload",
	}

	res, code := Execute(newKialiInterface(conf, clientFactory, prom), args)
	require.Equal(t, http.StatusOK, code)
	msg := res.(string)
	assert.Contains(t, msg, "my-pod", "explicit podName should take precedence over workloadName")
}

func TestExecute_BothPodAndWorkload_NonexistentPod_ReturnsError(t *testing.T) {
	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "Kubernetes"
	config.Set(conf)

	k8s := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("bookinfo"))
	clientFactory := kubetest.NewFakeClientFactoryWithClient(conf, k8s)

	args := map[string]interface{}{
		"namespace":    "bookinfo",
		"podName":      "productpage-v1-xyz-abc",
		"workloadName": "productpage-v1",
	}

	res, code := Execute(newKialiInterface(conf, clientFactory, nil), args)
	require.Equal(t, http.StatusOK, code)
	msg := res.(string)
	assert.Contains(t, msg, "productpage-v1-xyz-abc")
	assert.Contains(t, msg, "not found")
}

func TestExecute_ArgKeyAliases_Accepted(t *testing.T) {
	tests := []struct {
		name string
		args map[string]interface{}
	}{
		{
			"pod_name alias",
			map[string]interface{}{"namespace": "bookinfo", "pod_name": "my-pod"},
		},
		{
			"pod alias",
			map[string]interface{}{"namespace": "bookinfo", "pod": "my-pod"},
		},
		{
			"workload_name alias",
			map[string]interface{}{"namespace": "bookinfo", "workload_name": "my-pod"},
		},
		{
			"workload alias",
			map[string]interface{}{"namespace": "bookinfo", "workload": "my-pod"},
		},
		{
			"cluster_name alias",
			map[string]interface{}{"namespace": "bookinfo", "podName": "my-pod", "cluster_name": "Kubernetes"},
		},
		{
			"cluster alias",
			map[string]interface{}{"namespace": "bookinfo", "podName": "my-pod", "cluster": "Kubernetes"},
		},
		{
			"time_range alias",
			map[string]interface{}{"namespace": "bookinfo", "podName": "my-pod", "time_range": "5m"},
		},
		{
			"duration alias",
			map[string]interface{}{"namespace": "bookinfo", "podName": "my-pod", "duration": "1h"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			conf := config.NewConfig()
			conf.KubernetesConfig.ClusterName = "Kubernetes"
			config.Set(conf)

			pod := fakePod("my-pod", "bookinfo", containerWithResources("app", "100m", "", "128Mi", ""))
			k8s := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("bookinfo"), pod)
			clientFactory := kubetest.NewFakeClientFactoryWithClient(conf, k8s)

			promAPI := new(prometheustest.PromAPIMock)
			mockPrometheusEmpty(promAPI)
			prom := newPromClient(t, conf, k8s, promAPI)

			_, code := Execute(newKialiInterface(conf, clientFactory, prom), tt.args)
			assert.Equal(t, http.StatusOK, code, "alias %q should be accepted", tt.name)
		})
	}
}

func TestExecute_AllParamsSpecified_Works(t *testing.T) {
	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "Kubernetes"
	config.Set(conf)

	pod := fakePod("my-pod", "bookinfo", containerWithResources("app", "100m", "500m", "128Mi", "256Mi"))
	k8s := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("bookinfo"), pod)
	clientFactory := kubetest.NewFakeClientFactoryWithClient(conf, k8s)

	promAPI := new(prometheustest.PromAPIMock)
	mockPrometheusWithMetrics(promAPI, 0.05, 64*1024*1024)
	prom := newPromClient(t, conf, k8s, promAPI)

	args := map[string]interface{}{
		"namespace":   "bookinfo",
		"podName":     "my-pod",
		"timeRange":   "1h",
		"clusterName": "Kubernetes",
		"queryTime":   "2026-01-15T10:00:00Z",
	}

	res, code := Execute(newKialiInterface(conf, clientFactory, prom), args)
	require.Equal(t, http.StatusOK, code)
	msg := res.(string)
	assert.Contains(t, msg, "my-pod")
	assert.Contains(t, msg, "1h")
	assert.Contains(t, msg, "2026-01-15")
}

func TestExecute_QueryTimeRFC3339_Parsed(t *testing.T) {
	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "Kubernetes"
	config.Set(conf)

	pod := fakePod("my-pod", "bookinfo", containerWithResources("app", "", "", "", ""))
	k8s := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("bookinfo"), pod)
	clientFactory := kubetest.NewFakeClientFactoryWithClient(conf, k8s)

	promAPI := new(prometheustest.PromAPIMock)
	mockPrometheusEmpty(promAPI)
	prom := newPromClient(t, conf, k8s, promAPI)

	args := map[string]interface{}{
		"namespace": "bookinfo",
		"podName":   "my-pod",
		"queryTime": "2026-03-25T12:30:00Z",
	}

	res, code := Execute(newKialiInterface(conf, clientFactory, prom), args)
	require.Equal(t, http.StatusOK, code)
	msg := res.(string)
	assert.Contains(t, msg, "2026-03-25")
}

func TestExecute_ExplicitClusterName_UsedInResponse(t *testing.T) {
	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "default-cluster"
	config.Set(conf)

	pod := fakePod("my-pod", "bookinfo", containerWithResources("app", "", "", "", ""))
	k8s := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("bookinfo"), pod)
	clientFactory := kubetest.NewFakeClientFactoryWithClient(conf, k8s)

	promAPI := new(prometheustest.PromAPIMock)
	mockPrometheusEmpty(promAPI)
	prom := newPromClient(t, conf, k8s, promAPI)

	args := map[string]interface{}{
		"namespace":   "bookinfo",
		"podName":     "my-pod",
		"clusterName": "default-cluster",
	}

	res, code := Execute(newKialiInterface(conf, clientFactory, prom), args)
	require.Equal(t, http.StatusOK, code)
	msg := res.(string)
	assert.Contains(t, msg, "default-cluster")
}

// ========================================================================
// Functional Tests — Happy Path
// ========================================================================

func TestExecute_PodWithMetrics_ReturnsOK(t *testing.T) {
	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "Kubernetes"
	config.Set(conf)

	pod := fakePod("my-pod", "bookinfo",
		containerWithResources("app", "100m", "500m", "128Mi", "256Mi"),
	)
	k8s := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("bookinfo"), pod)
	clientFactory := kubetest.NewFakeClientFactoryWithClient(conf, k8s)

	promAPI := new(prometheustest.PromAPIMock)
	mockPrometheusWithMetrics(promAPI, 0.05, 64*1024*1024)
	prom := newPromClient(t, conf, k8s, promAPI)

	args := map[string]interface{}{
		"namespace": "bookinfo",
		"podName":   "my-pod",
	}

	res, code := Execute(newKialiInterface(conf, clientFactory, prom), args)
	require.Equal(t, http.StatusOK, code)

	msg, ok := res.(string)
	require.True(t, ok, "expected string response")
	assert.Contains(t, msg, "my-pod")
	assert.Contains(t, msg, "bookinfo")
	assert.Contains(t, msg, "CPU")
	assert.Contains(t, msg, "Memory")
}

func TestExecute_PodWithRequestsAndLimits_ShowsCorrectValues(t *testing.T) {
	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "Kubernetes"
	config.Set(conf)

	pod := fakePod("my-pod", "bookinfo",
		containerWithResources("app", "100m", "500m", "128Mi", "256Mi"),
	)
	k8s := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("bookinfo"), pod)
	clientFactory := kubetest.NewFakeClientFactoryWithClient(conf, k8s)

	promAPI := new(prometheustest.PromAPIMock)
	mockPrometheusWithMetrics(promAPI, 0.05, 64*1024*1024)
	prom := newPromClient(t, conf, k8s, promAPI)

	args := map[string]interface{}{
		"namespace": "bookinfo",
		"podName":   "my-pod",
	}

	res, code := Execute(newKialiInterface(conf, clientFactory, prom), args)
	require.Equal(t, http.StatusOK, code)

	msg := res.(string)
	assert.Contains(t, msg, "100m", "should display CPU request")
	assert.Contains(t, msg, "500m", "should display CPU limit")
	assert.Contains(t, msg, "50m", "should display CPU usage of 0.05 cores as 50m")
}

func TestExecute_DefaultTimeRange_Applied(t *testing.T) {
	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "Kubernetes"
	config.Set(conf)

	pod := fakePod("my-pod", "bookinfo", containerWithResources("app", "", "", "", ""))
	k8s := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("bookinfo"), pod)
	clientFactory := kubetest.NewFakeClientFactoryWithClient(conf, k8s)

	promAPI := new(prometheustest.PromAPIMock)
	mockPrometheusEmpty(promAPI)
	prom := newPromClient(t, conf, k8s, promAPI)

	args := map[string]interface{}{
		"namespace": "bookinfo",
		"podName":   "my-pod",
	}

	res, code := Execute(newKialiInterface(conf, clientFactory, prom), args)
	require.Equal(t, http.StatusOK, code)

	msg := res.(string)
	assert.Contains(t, msg, "10m", "should display default time range")
}

func TestExecute_DefaultClusterName_UsesConfig(t *testing.T) {
	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "my-cluster"
	config.Set(conf)

	pod := fakePod("my-pod", "bookinfo", containerWithResources("app", "", "", "", ""))
	k8s := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("bookinfo"), pod)
	clientFactory := kubetest.NewFakeClientFactoryWithClient(conf, k8s)

	promAPI := new(prometheustest.PromAPIMock)
	mockPrometheusEmpty(promAPI)
	prom := newPromClient(t, conf, k8s, promAPI)

	args := map[string]interface{}{
		"namespace": "bookinfo",
		"podName":   "my-pod",
	}

	res, code := Execute(newKialiInterface(conf, clientFactory, prom), args)
	require.Equal(t, http.StatusOK, code)

	msg := res.(string)
	assert.Contains(t, msg, "my-cluster")
}

func TestExecute_MultipleContainers_AllReported(t *testing.T) {
	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "Kubernetes"
	config.Set(conf)

	pod := fakePod("my-pod", "bookinfo",
		containerWithResources("app", "100m", "500m", "128Mi", "256Mi"),
		containerWithResources("istio-proxy", "50m", "200m", "64Mi", "128Mi"),
	)
	k8s := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("bookinfo"), pod)
	clientFactory := kubetest.NewFakeClientFactoryWithClient(conf, k8s)

	promAPI := new(prometheustest.PromAPIMock)
	mockPrometheusEmpty(promAPI)
	prom := newPromClient(t, conf, k8s, promAPI)

	args := map[string]interface{}{
		"namespace": "bookinfo",
		"podName":   "my-pod",
	}

	res, code := Execute(newKialiInterface(conf, clientFactory, prom), args)
	require.Equal(t, http.StatusOK, code)

	msg := res.(string)
	assert.Contains(t, msg, "app")
	assert.Contains(t, msg, "istio-proxy")
	assert.Contains(t, msg, "TOTAL")
}

// ========================================================================
// Pod / Namespace Not Found — Gentle Messages (200)
// ========================================================================

func TestExecute_ClusterDoesNotExist_ReturnsOKWithFriendlyMessage(t *testing.T) {
	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "Kubernetes"
	config.Set(conf)

	k8s := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("bookinfo"))
	clientFactory := kubetest.NewFakeClientFactoryWithClient(conf, k8s)

	args := map[string]interface{}{
		"namespace":   "bookinfo",
		"podName":     "my-pod",
		"clusterName": "nonexistent-cluster",
	}

	res, code := Execute(newKialiInterface(conf, clientFactory, nil), args)
	require.Equal(t, http.StatusOK, code, "chatbot tools should return 200 with friendly messages")
	msg := res.(string)
	assert.Contains(t, msg, "nonexistent-cluster")
	assert.Contains(t, msg, "not known")
	assert.Contains(t, msg, "Kubernetes")
}

func TestExecute_ClusterExists_DoesNotBlockExecution(t *testing.T) {
	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "Kubernetes"
	config.Set(conf)

	pod := fakePod("my-pod", "bookinfo", containerWithResources("app", "100m", "500m", "128Mi", "256Mi"))
	k8s := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("bookinfo"), pod)
	clientFactory := kubetest.NewFakeClientFactoryWithClient(conf, k8s)

	promAPI := new(prometheustest.PromAPIMock)
	mockPrometheusEmpty(promAPI)
	prom := newPromClient(t, conf, k8s, promAPI)

	args := map[string]interface{}{
		"namespace":   "bookinfo",
		"podName":     "my-pod",
		"clusterName": "Kubernetes",
	}

	_, code := Execute(newKialiInterface(conf, clientFactory, prom), args)
	require.Equal(t, http.StatusOK, code)
}

func TestExecute_PodNotFound_ReturnsOKWithFriendlyMessage(t *testing.T) {
	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "Kubernetes"
	config.Set(conf)

	k8s := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("bookinfo"))
	clientFactory := kubetest.NewFakeClientFactoryWithClient(conf, k8s)

	args := map[string]interface{}{
		"namespace": "bookinfo",
		"podName":   "nonexistent-pod",
	}

	res, code := Execute(newKialiInterface(conf, clientFactory, nil), args)
	require.Equal(t, http.StatusOK, code, "chatbot tools should return 200 with friendly messages, not 404")
	msg := res.(string)
	assert.Contains(t, msg, "nonexistent-pod")
	assert.Contains(t, msg, "not found")
}

func TestExecute_NamespaceDoesNotExist_ReturnsOKWithFriendlyMessage(t *testing.T) {
	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "Kubernetes"
	config.Set(conf)

	k8s := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("bookinfo"))
	clientFactory := kubetest.NewFakeClientFactoryWithClient(conf, k8s)
	businessLayer := business.NewLayerBuilder(t, conf).WithClient(k8s).Build()

	args := map[string]interface{}{
		"namespace": "nonexistent-namespace",
		"podName":   "my-pod",
	}

	res, code := Execute(newKialiInterface(conf, clientFactory, nil, businessLayer), args)
	require.Equal(t, http.StatusOK, code, "chatbot tools should return 200 with friendly messages, not 404")
	msg := res.(string)
	assert.Contains(t, msg, "nonexistent-namespace")
	assert.Contains(t, msg, "does not exist")
}

func TestExecute_NamespaceDoesNotExist_WithWorkloadName_ReturnsOKWithFriendlyMessage(t *testing.T) {
	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "Kubernetes"
	config.Set(conf)

	k8s := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("bookinfo"))
	clientFactory := kubetest.NewFakeClientFactoryWithClient(conf, k8s)
	businessLayer := business.NewLayerBuilder(t, conf).WithClient(k8s).Build()

	args := map[string]interface{}{
		"namespace":    "nonexistent-namespace",
		"workloadName": "my-deployment",
	}

	res, code := Execute(newKialiInterface(conf, clientFactory, nil, businessLayer), args)
	require.Equal(t, http.StatusOK, code, "chatbot tools should return 200 with friendly messages, not 404")
	msg := res.(string)
	assert.Contains(t, msg, "nonexistent-namespace")
	assert.Contains(t, msg, "does not exist")
}

func TestExecute_NamespaceExists_DoesNotBlockExecution(t *testing.T) {
	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "Kubernetes"
	config.Set(conf)

	pod := fakePod("my-pod", "bookinfo", containerWithResources("app", "100m", "500m", "128Mi", "256Mi"))
	k8s := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("bookinfo"), pod)
	clientFactory := kubetest.NewFakeClientFactoryWithClient(conf, k8s)
	businessLayer := business.NewLayerBuilder(t, conf).WithClient(k8s).Build()

	promAPI := new(prometheustest.PromAPIMock)
	mockPrometheusEmpty(promAPI)
	prom := newPromClient(t, conf, k8s, promAPI)

	args := map[string]interface{}{
		"namespace": "bookinfo",
		"podName":   "my-pod",
	}

	res, code := Execute(newKialiInterface(conf, clientFactory, prom, businessLayer), args)
	require.Equal(t, http.StatusOK, code)
	msg := res.(string)
	assert.Contains(t, msg, "my-pod")
	assert.NotContains(t, msg, "does not exist")
}

// ========================================================================
// Corner Case: Prometheus Unreachable (nil client)
// ========================================================================

func TestExecute_NilPrometheus_ReturnsOKWithFriendlyMessage(t *testing.T) {
	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "Kubernetes"
	config.Set(conf)

	pod := fakePod("my-pod", "bookinfo", containerWithResources("app", "100m", "500m", "128Mi", "256Mi"))
	k8s := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("bookinfo"), pod)
	clientFactory := kubetest.NewFakeClientFactoryWithClient(conf, k8s)

	args := map[string]interface{}{
		"namespace": "bookinfo",
		"podName":   "my-pod",
	}

	res, code := Execute(newKialiInterface(conf, clientFactory, nil), args)
	require.Equal(t, http.StatusOK, code)

	msg := res.(string)
	assert.Contains(t, msg, "Prometheus is not accessible")
	assert.NotContains(t, msg, "connection refused", "should not leak technical error details")
	assert.NotContains(t, msg, "dial tcp", "should not leak technical error details")
}

// ========================================================================
// Corner Case: No Telemetry Data
// ========================================================================

func TestExecute_NoTelemetryData_ReturnsOKWithNoUsageErrors(t *testing.T) {
	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "Kubernetes"
	config.Set(conf)

	pod := fakePod("my-pod", "bookinfo", containerWithResources("app", "100m", "500m", "128Mi", "256Mi"))
	k8s := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("bookinfo"), pod)
	clientFactory := kubetest.NewFakeClientFactoryWithClient(conf, k8s)

	promAPI := new(prometheustest.PromAPIMock)
	mockPrometheusEmpty(promAPI)
	prom := newPromClient(t, conf, k8s, promAPI)

	args := map[string]interface{}{
		"namespace": "bookinfo",
		"podName":   "my-pod",
	}

	res, code := Execute(newKialiInterface(conf, clientFactory, prom), args)
	require.Equal(t, http.StatusOK, code)

	msg := res.(string)
	assert.Contains(t, msg, "no data", "should indicate no data from Prometheus")
}

// ========================================================================
// Corner Case: Incomplete Metric Series (only some metrics available)
// ========================================================================

func TestExecute_OnlyCPUMetricsAvailable_DoesNotPanic(t *testing.T) {
	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "Kubernetes"
	config.Set(conf)

	pod := fakePod("my-pod", "bookinfo", containerWithResources("app", "100m", "500m", "128Mi", "256Mi"))
	k8s := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("bookinfo"), pod)
	clientFactory := kubetest.NewFakeClientFactoryWithClient(conf, k8s)

	promAPI := new(prometheustest.PromAPIMock)
	promAPI.On("Query", mock.Anything, mock.MatchedBy(func(q string) bool {
		return strings.Contains(q, "cpu_usage_seconds_total")
	}), mock.AnythingOfType("time.Time")).Return(model.Vector{
		{Value: model.SampleValue(0.05)},
	}, nil, nil)
	promAPI.On("Query", mock.Anything, mock.MatchedBy(func(q string) bool {
		return strings.Contains(q, "memory_working_set_bytes")
	}), mock.AnythingOfType("time.Time")).Return(model.Vector{}, nil, nil)
	prom := newPromClient(t, conf, k8s, promAPI)

	args := map[string]interface{}{
		"namespace": "bookinfo",
		"podName":   "my-pod",
	}

	assert.NotPanics(t, func() {
		res, code := Execute(newKialiInterface(conf, clientFactory, prom), args)
		require.Equal(t, http.StatusOK, code)

		msg := res.(string)
		assert.Contains(t, msg, "CPU")
		assert.Contains(t, msg, "50m", "CPU usage should be reported")
	})
}

func TestExecute_OnlyMemoryMetricsAvailable_DoesNotPanic(t *testing.T) {
	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "Kubernetes"
	config.Set(conf)

	pod := fakePod("my-pod", "bookinfo", containerWithResources("app", "100m", "500m", "128Mi", "256Mi"))
	k8s := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("bookinfo"), pod)
	clientFactory := kubetest.NewFakeClientFactoryWithClient(conf, k8s)

	promAPI := new(prometheustest.PromAPIMock)
	promAPI.On("Query", mock.Anything, mock.MatchedBy(func(q string) bool {
		return strings.Contains(q, "cpu_usage_seconds_total")
	}), mock.AnythingOfType("time.Time")).Return(model.Vector{}, nil, nil)
	promAPI.On("Query", mock.Anything, mock.MatchedBy(func(q string) bool {
		return strings.Contains(q, "memory_working_set_bytes")
	}), mock.AnythingOfType("time.Time")).Return(model.Vector{
		{Value: model.SampleValue(64 * 1024 * 1024)},
	}, nil, nil)
	prom := newPromClient(t, conf, k8s, promAPI)

	args := map[string]interface{}{
		"namespace": "bookinfo",
		"podName":   "my-pod",
	}

	assert.NotPanics(t, func() {
		res, code := Execute(newKialiInterface(conf, clientFactory, prom), args)
		require.Equal(t, http.StatusOK, code)
		msg := res.(string)
		assert.Contains(t, msg, "Memory")
	})
}

// ========================================================================
// Corner Case: Pod with No Resource Requests or Limits
// ========================================================================

func TestExecute_NoRequestsOrLimits_ReturnsOK(t *testing.T) {
	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "Kubernetes"
	config.Set(conf)

	pod := fakePod("bare-pod", "bookinfo", corev1.Container{Name: "app"})
	k8s := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("bookinfo"), pod)
	clientFactory := kubetest.NewFakeClientFactoryWithClient(conf, k8s)

	promAPI := new(prometheustest.PromAPIMock)
	mockPrometheusWithMetrics(promAPI, 0.1, 128*1024*1024)
	prom := newPromClient(t, conf, k8s, promAPI)

	args := map[string]interface{}{
		"namespace": "bookinfo",
		"podName":   "bare-pod",
	}

	assert.NotPanics(t, func() {
		res, code := Execute(newKialiInterface(conf, clientFactory, prom), args)
		require.Equal(t, http.StatusOK, code)
		msg := res.(string)
		assert.Contains(t, msg, "bare-pod")
		assert.Contains(t, msg, "CPU")
		assert.Contains(t, msg, "Memory")
	})
}

// ========================================================================
// Corner Case: Null / Incomplete Metric Series — No Panic
// ========================================================================

func TestExecute_NilPromAPI_DoesNotPanic(t *testing.T) {
	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "Kubernetes"
	config.Set(conf)

	pod := fakePod("my-pod", "bookinfo", containerWithResources("app", "100m", "500m", "128Mi", "256Mi"))
	k8s := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("bookinfo"), pod)
	clientFactory := kubetest.NewFakeClientFactoryWithClient(conf, k8s)

	args := map[string]interface{}{
		"namespace": "bookinfo",
		"podName":   "my-pod",
	}

	assert.NotPanics(t, func() {
		_, code := Execute(newKialiInterface(conf, clientFactory, nil), args)
		require.Equal(t, http.StatusOK, code)
	})
}

// ========================================================================
// Unit Tests: isConnectionError / promErrorMessage
// ========================================================================

func TestIsConnectionError_DetectsCommonErrors(t *testing.T) {
	tests := []struct {
		name     string
		errMsg   string
		expected bool
	}{
		{"connection refused", `Post "http://localhost:19090/api/v1/query": dial tcp [::1]:19090: connect: connection refused`, true},
		{"no such host", `Post "http://prometheus:9090/api/v1/query": dial tcp: lookup prometheus: no such host`, true},
		{"i/o timeout", `Post "http://prometheus:9090/api/v1/query": dial tcp 10.0.0.1:9090: i/o timeout`, true},
		{"service unavailable", `the server is currently unable to handle the request (service unavailable)`, true},
		{"no data", "no data", false},
		{"normal error", "some random error", false},
		{"empty vector", "unexpected prometheus result type", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := fmt.Errorf("%s", tt.errMsg)
			assert.Equal(t, tt.expected, isConnectionError(err))
		})
	}
}

func TestPromErrorMessage_ConnectionError_ReturnsFriendly(t *testing.T) {
	err := fmt.Errorf(`Post "http://localhost:19090/api/v1/query": dial tcp [::1]:19090: connect: connection refused`)
	msg := promErrorMessage(err, "CPU")

	assert.Contains(t, msg, "Prometheus is not accessible")
	assert.NotContains(t, msg, "connection refused")
	assert.NotContains(t, msg, "dial tcp")
}

func TestPromErrorMessage_NoData_ReturnsNoDataMessage(t *testing.T) {
	msg := promErrorMessage(mcputil.ErrNoData, "CPU")
	assert.Equal(t, "no data returned by Prometheus", msg)
}

func TestPromErrorMessage_OtherError_ReturnsSanitized(t *testing.T) {
	err := fmt.Errorf("unexpected prometheus result type *model.Matrix")
	msg := promErrorMessage(err, "CPU")

	assert.Contains(t, msg, "unable to query CPU metrics")
	assert.NotContains(t, msg, "model.Matrix", "should not leak internal type names")
}

// ========================================================================
// Unit Tests: extractContainerRequestsLimits
// ========================================================================

func TestExtractContainerRequestsLimits_FullySpecified(t *testing.T) {
	pod := fakePod("p", "ns", containerWithResources("app", "100m", "500m", "128Mi", "256Mi"))
	result := extractContainerRequestsLimits(pod)

	require.Contains(t, result, "app")
	rl := result["app"]
	require.NotNil(t, rl.CPURequestCores)
	require.NotNil(t, rl.CPULimitCores)
	require.NotNil(t, rl.MemoryRequestBytes)
	require.NotNil(t, rl.MemoryLimitBytes)
	assert.InDelta(t, 0.1, *rl.CPURequestCores, 0.001)
	assert.InDelta(t, 0.5, *rl.CPULimitCores, 0.001)
	assert.InDelta(t, 128*1024*1024, *rl.MemoryRequestBytes, 1)
	assert.InDelta(t, 256*1024*1024, *rl.MemoryLimitBytes, 1)
}

func TestExtractContainerRequestsLimits_NoResources(t *testing.T) {
	pod := fakePod("p", "ns", corev1.Container{Name: "app"})
	result := extractContainerRequestsLimits(pod)

	require.Contains(t, result, "app")
	rl := result["app"]
	assert.Nil(t, rl.CPURequestCores)
	assert.Nil(t, rl.CPULimitCores)
	assert.Nil(t, rl.MemoryRequestBytes)
	assert.Nil(t, rl.MemoryLimitBytes)
}

func TestExtractContainerRequestsLimits_MultipleContainers(t *testing.T) {
	pod := fakePod("p", "ns",
		containerWithResources("app", "100m", "500m", "128Mi", "256Mi"),
		containerWithResources("sidecar", "50m", "", "64Mi", ""),
	)
	result := extractContainerRequestsLimits(pod)

	assert.Len(t, result, 2)
	require.Contains(t, result, "app")
	require.Contains(t, result, "sidecar")

	sidecar := result["sidecar"]
	require.NotNil(t, sidecar.CPURequestCores)
	assert.Nil(t, sidecar.CPULimitCores)
	require.NotNil(t, sidecar.MemoryRequestBytes)
	assert.Nil(t, sidecar.MemoryLimitBytes)
}

// ========================================================================
// Unit Tests: ratio
// ========================================================================

func TestRatio_BothPresent(t *testing.T) {
	n := &ScalarValue{Value: 50, Unit: "cores"}
	d := &ScalarValue{Value: 100, Unit: "cores"}
	r := ratio(n, d)

	require.NotNil(t, r)
	assert.InDelta(t, 0.5, *r, 0.001)
}

func TestRatio_NilNumerator(t *testing.T) {
	d := &ScalarValue{Value: 100, Unit: "cores"}
	assert.Nil(t, ratio(nil, d))
}

func TestRatio_NilDenominator(t *testing.T) {
	n := &ScalarValue{Value: 50, Unit: "cores"}
	assert.Nil(t, ratio(n, nil))
}

func TestRatio_ZeroDenominator(t *testing.T) {
	n := &ScalarValue{Value: 50, Unit: "cores"}
	d := &ScalarValue{Value: 0, Unit: "cores"}
	assert.Nil(t, ratio(n, d))
}

// ========================================================================
// Unit Tests: renderHumanSummary
// ========================================================================

func TestRenderHumanSummary_ContainsExpectedSections(t *testing.T) {
	usage := &ScalarValue{Value: 0.05, Unit: "cores"}
	req := &ScalarValue{Value: 0.1, Unit: "cores"}
	lim := &ScalarValue{Value: 0.5, Unit: "cores"}
	r1 := 0.5
	r2 := 0.1

	resp := PodPerformanceResponse{
		Cluster:   "Kubernetes",
		Namespace: "bookinfo",
		PodName:   "my-pod",
		Resolved:  "pod",
		TimeRange: "10m",
		CPU: UsageVsRequestsLimits{
			Usage:             usage,
			Request:           req,
			Limit:             lim,
			UsageRequestRatio: &r1,
			UsageLimitRatio:   &r2,
		},
		Containers: []ContainerPerformance{
			{Container: "app", CPU: UsageVsRequestsLimits{Usage: usage, Request: req}},
		},
	}

	output := renderHumanSummary(resp)
	assert.Contains(t, output, "Kubernetes")
	assert.Contains(t, output, "bookinfo")
	assert.Contains(t, output, "my-pod")
	assert.Contains(t, output, "CPU")
	assert.Contains(t, output, "Memory")
	assert.Contains(t, output, "TOTAL")
	assert.Contains(t, output, "SCOPE")
}

func TestRenderHumanSummary_WithErrors_ShowsNotes(t *testing.T) {
	resp := PodPerformanceResponse{
		Cluster:   "Kubernetes",
		Namespace: "ns",
		PodName:   "p",
		TimeRange: "10m",
		Errors:    map[string]string{"cpu_usage": "no data returned by Prometheus"},
	}

	output := renderHumanSummary(resp)
	assert.Contains(t, output, "Notes")
	assert.Contains(t, output, "cpu_usage")
	assert.Contains(t, output, "no data returned by Prometheus")
}

func TestRenderHumanSummary_NoErrors_OmitsNotesSection(t *testing.T) {
	resp := PodPerformanceResponse{
		Cluster:   "Kubernetes",
		Namespace: "ns",
		PodName:   "p",
		TimeRange: "10m",
	}

	output := renderHumanSummary(resp)
	assert.NotContains(t, output, "Notes")
}

// ========================================================================
// Unit Tests: floatFromScalar
// ========================================================================

func TestFloatFromScalar_Nil(t *testing.T) {
	assert.Nil(t, floatFromScalar(nil))
}

func TestFloatFromScalar_Value(t *testing.T) {
	v := &ScalarValue{Value: 42.5, Unit: "bytes"}
	result := floatFromScalar(v)
	require.NotNil(t, result)
	assert.InDelta(t, 42.5, *result, 0.001)
}
