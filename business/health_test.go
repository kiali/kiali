package business

import (
	"context"
	"testing"
	"time"

	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	apps_v1 "k8s.io/api/apps/v1"
	core_v1 "k8s.io/api/core/v1"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/prometheus/prometheustest"
)

var emptyResult = map[string]map[string]float64{}

func TestGetServiceHealth(t *testing.T) {
	assert := assert.New(t)

	conf := config.NewConfig()
	config.Set(conf)

	k8s := kubetest.NewFakeK8sClient(
		&core_v1.Namespace{ObjectMeta: meta_v1.ObjectMeta{Name: "ns"}},
		&core_v1.Service{ObjectMeta: meta_v1.ObjectMeta{Name: "httpbin", Namespace: "ns"}},
	)
	k8s.OpenShift = true

	prom := new(prometheustest.PromClientMock)

	queryTime := time.Date(2017, 1, 15, 0, 0, 0, 0, time.UTC)
	prom.MockServiceRequestRates(context.Background(), "ns", conf.KubernetesConfig.ClusterName, "httpbin", serviceRates)

	hs := NewLayerBuilder(t, conf).WithClient(k8s).WithProm(prom).Build().Health

	mockSvc := models.Service{}
	mockSvc.Name = "httpbin"

	health, _ := hs.GetServiceHealth(context.TODO(), "ns", conf.KubernetesConfig.ClusterName, "httpbin", "1m", queryTime, &mockSvc)

	prom.AssertNumberOfCalls(t, "GetServiceRequestRates", 1)
	result := map[string]map[string]float64{
		"http": {
			"200": 14,
			"404": 1.4,
		},
		"grpc": {
			"0": 14,
			"7": 1.4,
		},
	}
	assert.Equal(result, health.Requests.Inbound)
	assert.Equal(emptyResult, health.Requests.Outbound)
}

func TestGetAppHealth(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)
	objects := []runtime.Object{
		&core_v1.Namespace{ObjectMeta: meta_v1.ObjectMeta{Name: "ns"}},
		&core_v1.Service{ObjectMeta: meta_v1.ObjectMeta{Name: "httpbin", Namespace: "ns"}},
	}
	for _, obj := range fakeDeploymentsHealthReview() {
		o := obj
		objects = append(objects, &o)
	}
	for _, obj := range fakePodsHealthReview() {
		o := obj
		objects = append(objects, &o)
	}
	k8s := kubetest.NewFakeK8sClient(objects...)
	k8s.OpenShift = true
	prom := new(prometheustest.PromClientMock)

	hs := NewLayerBuilder(t, conf).WithClient(k8s).WithProm(prom).Build().Health

	queryTime := time.Date(2017, 1, 15, 0, 0, 0, 0, time.UTC)
	prom.MockAppRequestRates(context.Background(), "ns", conf.KubernetesConfig.ClusterName, "reviews", otherRatesIn, otherRatesOut)

	mockWkd := models.Workload{}
	mockWkd.Name = "reviews-v1"
	mockWkd.IstioSidecar = true

	mockApp := appDetails{
		Workloads: models.Workloads{&mockWkd},
	}

	health, _ := hs.GetAppHealth(context.TODO(), "ns", conf.KubernetesConfig.ClusterName, "reviews", "1m", queryTime, &mockApp)

	prom.AssertNumberOfCalls(t, "GetAppRequestRates", 1)
	result := map[string]map[string]float64{
		"http": {
			"500": 1.6,
		},
	}
	assert.Equal(result, health.Requests.Inbound)
	result = map[string]map[string]float64{
		"http": {
			"200": 5,
			"400": 3.5,
		},
		"grpc": {
			"0": 5,
			"7": 3.5,
		},
	}
	assert.Equal(result, health.Requests.Outbound)
}

func TestGetWorkloadHealth(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)
	objects := []runtime.Object{
		&core_v1.Namespace{ObjectMeta: meta_v1.ObjectMeta{Name: "ns"}},
		&core_v1.Service{ObjectMeta: meta_v1.ObjectMeta{Name: "httpbin", Namespace: "ns"}},
		&fakeDeploymentsHealthReview()[0],
	}
	for _, obj := range fakePodsHealthReview() {
		o := obj
		objects = append(objects, &o)
	}
	k8s := kubetest.NewFakeK8sClient(objects...)
	k8s.OpenShift = true
	prom := new(prometheustest.PromClientMock)

	queryTime := time.Date(2017, 1, 15, 0, 0, 0, 0, time.UTC)
	prom.MockWorkloadRequestRates(context.Background(), "ns", conf.KubernetesConfig.ClusterName, "reviews-v1", otherRatesIn, otherRatesOut)

	hs := NewLayerBuilder(t, conf).WithClient(k8s).WithProm(prom).Build().Health

	mockWorkload := models.Workload{}
	mockWorkload.Name = "reviews-v1"
	mockWorkload.IstioSidecar = true

	health, _ := hs.GetWorkloadHealth(context.TODO(), "ns", conf.KubernetesConfig.ClusterName, "reviews-v1", "1m", queryTime, &mockWorkload)

	prom.AssertNumberOfCalls(t, "GetWorkloadRequestRates", 1)
	result := map[string]map[string]float64{
		"http": {
			"500": 1.6,
		},
	}
	assert.Equal(result, health.Requests.Inbound)
	result = map[string]map[string]float64{
		"http": {
			"200": 5,
			"400": 3.5,
		},
		"grpc": {
			"0": 5,
			"7": 3.5,
		},
	}
	assert.Equal(result, health.Requests.Outbound)
}

func TestGetAppHealthWithoutIstio(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()

	objects := []runtime.Object{
		&core_v1.Namespace{ObjectMeta: meta_v1.ObjectMeta{Name: "ns"}},
		&core_v1.Service{ObjectMeta: meta_v1.ObjectMeta{Name: "httpbin", Namespace: "ns"}},
	}
	for _, obj := range fakeDeploymentsHealthReview() {
		o := obj
		objects = append(objects, &o)
	}
	for _, obj := range fakePodsHealthReviewWithoutIstio() {
		o := obj
		objects = append(objects, &o)
	}
	k8s := kubetest.NewFakeK8sClient(objects...)
	prom := new(prometheustest.PromClientMock)

	queryTime := time.Date(2017, 1, 15, 0, 0, 0, 0, time.UTC)
	prom.MockAppRequestRates(context.Background(), "ns", conf.KubernetesConfig.ClusterName, "reviews", otherRatesIn, otherRatesOut)

	hs := NewLayerBuilder(t, conf).WithClient(k8s).WithProm(prom).Build().Health

	mockApp := appDetails{}

	health, _ := hs.GetAppHealth(context.TODO(), "ns", conf.KubernetesConfig.ClusterName, "reviews", "1m", queryTime, &mockApp)

	prom.AssertNumberOfCalls(t, "GetAppRequestRates", 0)
	assert.Equal(emptyResult, health.Requests.Inbound)
	assert.Equal(emptyResult, health.Requests.Outbound)
}

func TestGetWorkloadHealthWithoutIstio(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)
	objects := []runtime.Object{
		&core_v1.Namespace{ObjectMeta: meta_v1.ObjectMeta{Name: "ns"}},
		&core_v1.Service{ObjectMeta: meta_v1.ObjectMeta{Name: "httpbin", Namespace: "ns"}},
		&fakeDeploymentsHealthReview()[0],
	}
	for _, obj := range fakePodsHealthReviewWithoutIstio() {
		o := obj
		objects = append(objects, &o)
	}
	k8s := kubetest.NewFakeK8sClient(objects...)
	k8s.OpenShift = true
	prom := new(prometheustest.PromClientMock)

	queryTime := time.Date(2017, 1, 15, 0, 0, 0, 0, time.UTC)
	prom.MockWorkloadRequestRates(context.Background(), "ns", conf.KubernetesConfig.ClusterName, "reviews-v1", otherRatesIn, otherRatesOut)

	hs := NewLayerBuilder(t, conf).WithClient(k8s).WithProm(prom).Build().Health

	mockWorkload := models.Workload{}
	mockWorkload.Name = "reviews-v1"

	health, _ := hs.GetWorkloadHealth(context.TODO(), "ns", conf.KubernetesConfig.ClusterName, "reviews-v1", "1m", queryTime, &mockWorkload)

	prom.AssertNumberOfCalls(t, "GetWorkloadRequestRates", 0)
	assert.Equal(emptyResult, health.Requests.Inbound)
	assert.Equal(emptyResult, health.Requests.Outbound)
}

func TestGetNamespaceAppHealthWithoutIstio(t *testing.T) {
	require := require.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	objects := []runtime.Object{
		&core_v1.Namespace{ObjectMeta: meta_v1.ObjectMeta{Name: "ns"}},
		&core_v1.Service{ObjectMeta: meta_v1.ObjectMeta{Name: "httpbin", Namespace: "ns"}},
	}
	for _, obj := range fakeDeploymentsHealthReview() {
		o := obj
		objects = append(objects, &o)
	}
	for _, obj := range fakePodsHealthReviewWithoutIstio() {
		o := obj
		objects = append(objects, &o)
	}
	k8s := kubetest.NewFakeK8sClient(objects...)
	k8s.OpenShift = true
	prom := new(prometheustest.PromClientMock)

	hs := NewLayerBuilder(t, conf).WithClient(k8s).WithProm(prom).Build().Health
	criteria := NamespaceHealthCriteria{Cluster: conf.KubernetesConfig.ClusterName, Namespace: "ns", RateInterval: "1m", QueryTime: time.Date(2017, 1, 15, 0, 0, 0, 0, time.UTC), IncludeMetrics: true}

	_, err := hs.GetNamespaceAppHealth(context.TODO(), criteria)
	require.NoError(err)

	// Make sure unnecessary call isn't performed
	prom.AssertNumberOfCalls(t, "GetAllRequestRates", 0)
}

func TestGetNamespaceServiceHealthWithNA(t *testing.T) {
	assert := assert.New(t)

	conf := config.NewConfig()
	config.Set(conf)
	reviews := kubetest.FakeService("tutorial", "reviews")
	httpbin := kubetest.FakeService("tutorial", "httpbin")
	k8s := kubetest.NewFakeK8sClient(
		&core_v1.Namespace{ObjectMeta: meta_v1.ObjectMeta{Name: "ns"}},
		&core_v1.Namespace{ObjectMeta: meta_v1.ObjectMeta{Name: "tutorial"}},
		&core_v1.Service{ObjectMeta: meta_v1.ObjectMeta{Name: "httpbin", Namespace: "ns"}},
		&reviews,
		&httpbin,
	)
	k8s.OpenShift = true
	prom := new(prometheustest.PromClientMock)

	prom.On("GetNamespaceServicesRequestRates", mock.Anything, "tutorial", conf.KubernetesConfig.ClusterName, mock.AnythingOfType("string"), mock.AnythingOfType("time.Time")).Return(serviceRates, nil)

	hs := NewLayerBuilder(t, conf).WithClient(k8s).WithProm(prom).Build().Health

	criteria := NamespaceHealthCriteria{Cluster: conf.KubernetesConfig.ClusterName, Namespace: "tutorial", RateInterval: "1m", QueryTime: time.Date(2017, 1, 15, 0, 0, 0, 0, time.UTC), IncludeMetrics: true}
	health, err := hs.GetNamespaceServiceHealth(context.TODO(), criteria)

	assert.Nil(err)
	// Make sure we get services with N/A health
	assert.Len(health, 2)
	assert.Equal(emptyResult, health["reviews"].Requests.Inbound)
	assert.Equal(emptyResult, health["reviews"].Requests.Outbound)
	result := map[string]map[string]float64{
		"http": {
			"200": 14,
			"404": 1.4,
		},
		"grpc": {
			"0": 14,
			"7": 1.4,
		},
	}
	assert.Equal(result, health["httpbin"].Requests.Inbound)
	assert.Equal(emptyResult, health["httpbin"].Requests.Outbound)
}

func TestGetNamespaceServicesHealthMultiCluster(t *testing.T) {
	assert := assert.New(t)

	conf := config.NewConfig()
	conf.ExternalServices.Istio.IstioAPIEnabled = false
	config.Set(conf)

	clients := map[string]kubernetes.UserClientInterface{
		conf.KubernetesConfig.ClusterName: kubetest.NewFakeK8sClient(
			kubetest.FakeNamespace("tutorial"),
			&core_v1.Service{ObjectMeta: meta_v1.ObjectMeta{Name: "httpbin", Namespace: "tutorial"}},
		),
		"west": kubetest.NewFakeK8sClient(
			kubetest.FakeNamespace("tutorial"),
			&core_v1.Service{ObjectMeta: meta_v1.ObjectMeta{Name: "httpbin", Namespace: "tutorial"}},
		),
	}
	prom := new(prometheustest.PromClientMock)
	prom.On("GetNamespaceServicesRequestRates", mock.Anything, "tutorial", conf.KubernetesConfig.ClusterName, mock.AnythingOfType("string"), mock.AnythingOfType("time.Time")).Return(serviceRates, nil)
	prom.On("GetNamespaceServicesRequestRates", mock.Anything, "tutorial", "west", mock.AnythingOfType("string"), mock.AnythingOfType("time.Time")).Return(serviceRates, nil)

	hs := NewLayerBuilder(t, conf).WithClients(clients).WithProm(prom).Build().Health

	criteria := NamespaceHealthCriteria{Cluster: conf.KubernetesConfig.ClusterName, Namespace: "tutorial", RateInterval: "1m", QueryTime: time.Date(2017, 1, 15, 0, 0, 0, 0, time.UTC), IncludeMetrics: true}

	servicesHealth, err := hs.GetNamespaceServiceHealth(context.TODO(), criteria)

	assert.Nil(err)
	assert.Len(servicesHealth, 1)
}

func TestGetNamespaceApplicationsHealthMultiCluster(t *testing.T) {
	assert := assert.New(t)

	conf := config.NewConfig()
	conf.ExternalServices.Istio.IstioAPIEnabled = false
	config.Set(conf)

	clients := map[string]kubernetes.UserClientInterface{
		conf.KubernetesConfig.ClusterName: kubetest.NewFakeK8sClient(
			kubetest.FakeNamespace("tutorial"),
			&core_v1.Service{ObjectMeta: meta_v1.ObjectMeta{Name: "httpbin", Namespace: "tutorial"}},
			&core_v1.Pod{ObjectMeta: meta_v1.ObjectMeta{Name: "httpbin", Namespace: "tutorial", Labels: map[string]string{"app": "httpbin", "version": "v1"}, Annotations: kubetest.FakeIstioAnnotations()}, Status: core_v1.PodStatus{Phase: core_v1.PodRunning}},
		),
		"west": kubetest.NewFakeK8sClient(
			kubetest.FakeNamespace("tutorial"),
			&core_v1.Service{ObjectMeta: meta_v1.ObjectMeta{Name: "httpbin", Namespace: "tutorial"}},
			&core_v1.Pod{ObjectMeta: meta_v1.ObjectMeta{Name: "httpbin", Namespace: "tutorial", Labels: map[string]string{"app": "httpbin", "version": "v1"}, Annotations: kubetest.FakeIstioAnnotations()}, Status: core_v1.PodStatus{Phase: core_v1.PodRunning}},
		),
	}
	prom := new(prometheustest.PromClientMock)
	prom.On("GetAllRequestRates", mock.Anything, "tutorial", conf.KubernetesConfig.ClusterName, "1m", mock.AnythingOfType("time.Time")).Return(serviceRates, nil)
	prom.On("GetAllRequestRates", mock.Anything, "tutorial", "west", "1m", mock.AnythingOfType("time.Time")).Return(serviceRates500, nil)

	hs := NewLayerBuilder(t, conf).WithClients(clients).WithProm(prom).Build().Health

	criteria := NamespaceHealthCriteria{Namespace: "tutorial", Cluster: conf.KubernetesConfig.ClusterName, RateInterval: "1m", QueryTime: time.Date(2017, 1, 15, 0, 0, 0, 0, time.UTC), IncludeMetrics: true}

	applicationsHealth, err := hs.GetNamespaceAppHealth(context.TODO(), criteria)

	assert.Nil(err)
	assert.Len(applicationsHealth, 1)
	// Validate that west health is not included
	assert.NotContains(applicationsHealth["httpbin"].Requests.Inbound["http"], "500")
}

func TestGetNamespaceWorkloadsHealthMultiCluster(t *testing.T) {
	assert := assert.New(t)

	conf := config.NewConfig()
	conf.ExternalServices.Istio.IstioAPIEnabled = false
	config.Set(conf)

	clients := map[string]kubernetes.UserClientInterface{
		conf.KubernetesConfig.ClusterName: kubetest.NewFakeK8sClient(
			kubetest.FakeNamespace("tutorial"),
			&core_v1.Pod{ObjectMeta: meta_v1.ObjectMeta{Name: "httpbin", Namespace: "tutorial", Labels: map[string]string{"app": "httpbin", "version": "v1"}, Annotations: kubetest.FakeIstioAnnotations()}, Status: core_v1.PodStatus{Phase: core_v1.PodRunning}},
		),
		"west": kubetest.NewFakeK8sClient(
			kubetest.FakeNamespace("tutorial"),
			&core_v1.Pod{ObjectMeta: meta_v1.ObjectMeta{Name: "httpbin", Namespace: "tutorial", Labels: map[string]string{"app": "httpbin", "version": "v1"}, Annotations: kubetest.FakeIstioAnnotations()}, Status: core_v1.PodStatus{Phase: core_v1.PodRunning}},
		),
	}
	prom := new(prometheustest.PromClientMock)
	prom.On("GetAllRequestRates", mock.Anything, "tutorial", conf.KubernetesConfig.ClusterName, "1m", mock.AnythingOfType("time.Time")).Return(serviceRates, nil)
	prom.On("GetAllRequestRates", mock.Anything, "tutorial", "west", "1m", mock.AnythingOfType("time.Time")).Return(serviceRates500, nil)

	hs := NewLayerBuilder(t, conf).WithClients(clients).WithProm(prom).Build().Health

	criteria := NamespaceHealthCriteria{Namespace: "tutorial", Cluster: conf.KubernetesConfig.ClusterName, RateInterval: "1m", QueryTime: time.Date(2017, 1, 15, 0, 0, 0, 0, time.UTC), IncludeMetrics: true}

	workloadsHealth, err := hs.GetNamespaceAppHealth(context.TODO(), criteria)

	assert.Nil(err)
	assert.Len(workloadsHealth, 1)
	assert.NotContains(workloadsHealth["httpbin"].Requests.Inbound["http"], "500")
}

var (
	sampleReviewsToHttpbin200 = model.Sample{
		Metric: model.Metric{
			"destination_canonical_service": "httpbin",
			"source_canonical_service":      "reviews",
			"source_service":                "reviews.tutorial.svc.cluster.local",
			"destination_service":           "httpbin.tutorial.svc.cluster.local",
			"request_protocol":              "http",
			"response_code":                 "200",
			"reporter":                      "source",
		},
		Value:     model.SampleValue(5),
		Timestamp: model.Now(),
	}
	sampleReviewsToHttpbin400 = model.Sample{
		Metric: model.Metric{
			"destination_canonical_service": "httpbin",
			"source_canonical_service":      "reviews",
			"source_service":                "reviews.tutorial.svc.cluster.local",
			"destination_service":           "httpbin.tutorial.svc.cluster.local",
			"request_protocol":              "http",
			"response_code":                 "400",
			"reporter":                      "source",
		},
		Value:     model.SampleValue(3.5),
		Timestamp: model.Now(),
	}
	sampleReviewsToHttpbinGrpc0 = model.Sample{
		Metric: model.Metric{
			"destination_canonical_service": "httpbin",
			"source_canonical_service":      "reviews",
			"source_service":                "reviews.tutorial.svc.cluster.local",
			"destination_service":           "httpbin.tutorial.svc.cluster.local",
			"request_protocol":              "grpc",
			"grpc_response_status":          "0",
			"reporter":                      "source",
		},
		Value:     model.SampleValue(5),
		Timestamp: model.Now(),
	}
	sampleReviewsToHttpbinGrpc7 = model.Sample{
		Metric: model.Metric{
			"destination_canonical_service": "httpbin",
			"source_canonical_service":      "reviews",
			"source_service":                "reviews.tutorial.svc.cluster.local",
			"destination_service":           "httpbin.tutorial.svc.cluster.local",
			"request_protocol":              "grpc",
			"grpc_response_status":          "7",
			"reporter":                      "source",
		},
		Value:     model.SampleValue(3.5),
		Timestamp: model.Now(),
	}
	sampleUnknownToHttpbin200 = model.Sample{
		Metric: model.Metric{
			"destination_canonical_service": "httpbin",
			"destination_service":           "httpbin.tutorial.svc.cluster.local",
			"destination_service_name":      "httpbin",
			"request_protocol":              "http",
			"source_canonical_service":      "unknown",
			"source_service":                "unknown",
			"response_code":                 "200",
		},
		Value:     model.SampleValue(14),
		Timestamp: model.Now(),
	}
	sampleUnknownToHttpbin404 = model.Sample{
		Metric: model.Metric{
			"destination_canonical_service": "httpbin",
			"destination_service":           "httpbin.tutorial.svc.cluster.local",
			"destination_service_name":      "httpbin",
			"request_protocol":              "http",
			"source_canonical_service":      "unknown",
			"source_service":                "unknown",
			"response_code":                 "404",
		},
		Value:     model.SampleValue(1.4),
		Timestamp: model.Now(),
	}
	sampleUnknownToHttpbinGrpc0 = model.Sample{
		Metric: model.Metric{
			"destination_canonical_service": "httpbin",
			"destination_service":           "httpbin.tutorial.svc.cluster.local",
			"destination_service_name":      "httpbin",
			"source_canonical_service":      "unknown",
			"source_service":                "unknown",
			"request_protocol":              "grpc",
			"grpc_response_status":          "0",
		},
		Value:     model.SampleValue(14),
		Timestamp: model.Now(),
	}
	sampleUnknownToHttpbinGrpc7 = model.Sample{
		Metric: model.Metric{
			"destination_canonical_service": "httpbin",
			"destination_service":           "httpbin.tutorial.svc.cluster.local",
			"destination_service_name":      "httpbin",
			"source_canonical_service":      "unknown",
			"source_service":                "unknown",
			"request_protocol":              "grpc",
			"grpc_response_status":          "7",
		},
		Value:     model.SampleValue(1.4),
		Timestamp: model.Now(),
	}
	sampleUnknownToHttpbin500 = model.Sample{
		Metric: model.Metric{
			"destination_canonical_service": "httpbin",
			"destination_service":           "httpbin.tutorial.svc.cluster.local",
			"destination_service_name":      "httpbin",
			"source_canonical_service":      "unknown",
			"source_service":                "unknown",
			"request_protocol":              "http",
			"response_code":                 "500",
		},
		Value:     model.SampleValue(1.6),
		Timestamp: model.Now(),
	}
	sampleUnknownToReviews500 = model.Sample{
		Metric: model.Metric{
			"destination_canonical_service": "reviews",
			"destination_service":           "reviews.tutorial.svc.cluster.local",
			"destination_service_name":      "reviews",
			"request_protocol":              "http",
			"source_canonical_service":      "unknown",
			"source_service":                "unknown",
			"response_code":                 "500",
			"reporter":                      "source",
		},
		Value:     model.SampleValue(1.6),
		Timestamp: model.Now(),
	}
	serviceRates = model.Vector{
		&sampleUnknownToHttpbin200,
		&sampleUnknownToHttpbin404,
		&sampleUnknownToHttpbinGrpc0,
		&sampleUnknownToHttpbinGrpc7,
	}
	serviceRates500 = model.Vector{
		&sampleUnknownToHttpbin500,
	}
	otherRatesIn = model.Vector{
		&sampleUnknownToReviews500,
	}
	otherRatesOut = model.Vector{
		&sampleReviewsToHttpbin200,
		&sampleReviewsToHttpbin400,
		&sampleReviewsToHttpbinGrpc0,
		&sampleReviewsToHttpbinGrpc7,
	}
)

// TestFillAppRequestRates_SourceHTTPOnly tests the fault injection scenario:
// source app has HTTP capability but destination is "unknown" (not HTTP-capable).
// The source's outbound traffic should still be counted.
func TestFillAppRequestRates_SourceHTTPOnly(t *testing.T) {
	assert := assert.New(t)

	srcApp := &models.AppHealth{
		WorkloadStatuses: []*models.WorkloadStatus{},
		Requests:         models.NewEmptyRequestHealth(),
	}
	destApp := &models.AppHealth{
		WorkloadStatuses: []*models.WorkloadStatus{},
		Requests:         models.NewEmptyRequestHealth(),
	}
	allHealth := models.NamespaceAppHealth{
		"productpage": srcApp,
		"unknown":     destApp,
	}
	// Only the source is HTTP-capable; destination ("unknown") is not
	appHTTPTraffic := map[string]bool{
		"productpage": true,
	}

	rates := model.Vector{
		&model.Sample{
			Metric: model.Metric{
				"destination_canonical_service": "unknown",
				"source_canonical_service":      "productpage",
				"request_protocol":              "http",
				"response_code":                 "500",
				"reporter":                      "source",
			},
			Value:     model.SampleValue(2.5),
			Timestamp: model.Now(),
		},
	}

	fillAppRequestRates(allHealth, rates, appHTTPTraffic)

	// Source (productpage) should have outbound traffic recorded
	assert.Equal(map[string]map[string]float64{
		"http": {"500": 2.5},
	}, srcApp.Requests.Outbound, "source app should have outbound traffic even when dest is not HTTP-capable")

	// Destination (unknown) should have NO inbound (not HTTP-capable)
	assert.Equal(map[string]map[string]float64{}, destApp.Requests.Inbound, "dest app should have no inbound when not HTTP-capable")
}

// TestFillAppRequestRates_DestHTTPOnly tests the reverse scenario:
// destination app has HTTP capability but source does not.
// The destination's inbound traffic should still be counted.
func TestFillAppRequestRates_DestHTTPOnly(t *testing.T) {
	assert := assert.New(t)

	srcApp := &models.AppHealth{
		WorkloadStatuses: []*models.WorkloadStatus{},
		Requests:         models.NewEmptyRequestHealth(),
	}
	destApp := &models.AppHealth{
		WorkloadStatuses: []*models.WorkloadStatus{},
		Requests:         models.NewEmptyRequestHealth(),
	}
	allHealth := models.NamespaceAppHealth{
		"external-src": srcApp,
		"reviews":      destApp,
	}
	// Only the destination is HTTP-capable
	appHTTPTraffic := map[string]bool{
		"reviews": true,
	}

	rates := model.Vector{
		&model.Sample{
			Metric: model.Metric{
				"destination_canonical_service": "reviews",
				"source_canonical_service":      "external-src",
				"request_protocol":              "http",
				"response_code":                 "200",
				"reporter":                      "destination",
			},
			Value:     model.SampleValue(10),
			Timestamp: model.Now(),
		},
	}

	fillAppRequestRates(allHealth, rates, appHTTPTraffic)

	// Destination (reviews) should have inbound traffic recorded
	assert.NotEmpty(destApp.Requests.Inbound, "dest app should have inbound traffic when it is HTTP-capable")

	// Source (external-src) should have NO outbound (not HTTP-capable)
	assert.Equal(map[string]map[string]float64{}, srcApp.Requests.Outbound, "source app should have no outbound when not HTTP-capable")
}

// TestFillAppRequestRates_BothHTTP tests that when both source and destination are
// HTTP-capable, both inbound and outbound are aggregated.
func TestFillAppRequestRates_BothHTTP(t *testing.T) {
	assert := assert.New(t)

	srcApp := &models.AppHealth{
		WorkloadStatuses: []*models.WorkloadStatus{},
		Requests:         models.NewEmptyRequestHealth(),
	}
	destApp := &models.AppHealth{
		WorkloadStatuses: []*models.WorkloadStatus{},
		Requests:         models.NewEmptyRequestHealth(),
	}
	allHealth := models.NamespaceAppHealth{
		"productpage": srcApp,
		"reviews":     destApp,
	}
	appHTTPTraffic := map[string]bool{
		"productpage": true,
		"reviews":     true,
	}

	rates := model.Vector{
		&model.Sample{
			Metric: model.Metric{
				"destination_canonical_service": "reviews",
				"source_canonical_service":      "productpage",
				"request_protocol":              "http",
				"response_code":                 "200",
				"reporter":                      "source",
			},
			Value:     model.SampleValue(7),
			Timestamp: model.Now(),
		},
	}

	fillAppRequestRates(allHealth, rates, appHTTPTraffic)

	// Source should have outbound
	assert.Equal(map[string]map[string]float64{
		"http": {"200": 7},
	}, srcApp.Requests.Outbound, "source app should have outbound when both are HTTP-capable")

	// Destination should have inbound (via CombineReporters which merges source/dest reporter data)
	assert.NotEmpty(destApp.Requests.Inbound, "dest app should have inbound when both are HTTP-capable")
}

// TestFillAppRequestRates_NeitherHTTP tests that when neither source nor destination is
// HTTP-capable, no traffic is aggregated.
func TestFillAppRequestRates_NeitherHTTP(t *testing.T) {
	assert := assert.New(t)

	srcApp := &models.AppHealth{
		WorkloadStatuses: []*models.WorkloadStatus{},
		Requests:         models.NewEmptyRequestHealth(),
	}
	destApp := &models.AppHealth{
		WorkloadStatuses: []*models.WorkloadStatus{},
		Requests:         models.NewEmptyRequestHealth(),
	}
	allHealth := models.NamespaceAppHealth{
		"src-app":  srcApp,
		"dest-app": destApp,
	}
	// Neither app is HTTP-capable
	appHTTPTraffic := map[string]bool{}

	rates := model.Vector{
		&model.Sample{
			Metric: model.Metric{
				"destination_canonical_service": "dest-app",
				"source_canonical_service":      "src-app",
				"request_protocol":              "http",
				"response_code":                 "200",
				"reporter":                      "source",
			},
			Value:     model.SampleValue(5),
			Timestamp: model.Now(),
		},
	}

	fillAppRequestRates(allHealth, rates, appHTTPTraffic)

	assert.Equal(map[string]map[string]float64{}, srcApp.Requests.Outbound, "source should have no outbound when neither is HTTP-capable")
	assert.Equal(map[string]map[string]float64{}, destApp.Requests.Inbound, "dest should have no inbound when neither is HTTP-capable")
}

// TestFillAppRequestRates_EmptyLabels tests that samples with empty/missing labels
// are handled gracefully.
func TestFillAppRequestRates_EmptyLabels(t *testing.T) {
	assert := assert.New(t)

	appHealth := &models.AppHealth{
		WorkloadStatuses: []*models.WorkloadStatus{},
		Requests:         models.NewEmptyRequestHealth(),
	}
	allHealth := models.NamespaceAppHealth{
		"myapp": appHealth,
	}
	appHTTPTraffic := map[string]bool{
		"myapp": true,
	}

	// Sample with empty source and destination labels
	rates := model.Vector{
		&model.Sample{
			Metric: model.Metric{
				"request_protocol": "http",
				"response_code":    "200",
				"reporter":         "source",
			},
			Value:     model.SampleValue(1),
			Timestamp: model.Now(),
		},
	}

	// Should not panic
	fillAppRequestRates(allHealth, rates, appHTTPTraffic)

	assert.Equal(map[string]map[string]float64{}, appHealth.Requests.Inbound)
	assert.Equal(map[string]map[string]float64{}, appHealth.Requests.Outbound)
}

// TestFillWorkloadRequestRates_SourceHTTPOnly tests the fault injection scenario for workloads:
// source workload has HTTP capability but destination is "unknown" (not HTTP-capable).
// The source's outbound traffic should still be counted.
func TestFillWorkloadRequestRates_SourceHTTPOnly(t *testing.T) {
	assert := assert.New(t)

	srcWkd := &models.WorkloadHealth{
		WorkloadStatus: &models.WorkloadStatus{Name: "productpage-v1"},
		Requests:       models.NewEmptyRequestHealth(),
	}
	destWkd := &models.WorkloadHealth{
		WorkloadStatus: &models.WorkloadStatus{Name: "unknown"},
		Requests:       models.NewEmptyRequestHealth(),
	}
	allHealth := models.NamespaceWorkloadHealth{
		"productpage-v1": srcWkd,
		"unknown":        destWkd,
	}
	// Only the source workload is HTTP-capable
	wlHTTPTraffic := map[string]bool{
		"productpage-v1": true,
	}

	rates := model.Vector{
		&model.Sample{
			Metric: model.Metric{
				"destination_workload": "unknown",
				"source_workload":      "productpage-v1",
				"request_protocol":     "http",
				"response_code":        "503",
				"reporter":             "source",
			},
			Value:     model.SampleValue(3),
			Timestamp: model.Now(),
		},
	}

	fillWorkloadRequestRates(allHealth, rates, wlHTTPTraffic)

	// Source (productpage-v1) should have outbound traffic
	assert.Equal(map[string]map[string]float64{
		"http": {"503": 3},
	}, srcWkd.Requests.Outbound, "source workload should have outbound traffic even when dest is not HTTP-capable")

	// Destination (unknown) should have NO inbound
	assert.Equal(map[string]map[string]float64{}, destWkd.Requests.Inbound, "dest workload should have no inbound when not HTTP-capable")
}

// TestFillWorkloadRequestRates_DestHTTPOnly tests the reverse scenario for workloads:
// destination workload has HTTP capability but source does not.
func TestFillWorkloadRequestRates_DestHTTPOnly(t *testing.T) {
	assert := assert.New(t)

	srcWkd := &models.WorkloadHealth{
		WorkloadStatus: &models.WorkloadStatus{Name: "external-v1"},
		Requests:       models.NewEmptyRequestHealth(),
	}
	destWkd := &models.WorkloadHealth{
		WorkloadStatus: &models.WorkloadStatus{Name: "reviews-v1"},
		Requests:       models.NewEmptyRequestHealth(),
	}
	allHealth := models.NamespaceWorkloadHealth{
		"external-v1": srcWkd,
		"reviews-v1":  destWkd,
	}
	// Only the destination workload is HTTP-capable
	wlHTTPTraffic := map[string]bool{
		"reviews-v1": true,
	}

	rates := model.Vector{
		&model.Sample{
			Metric: model.Metric{
				"destination_workload": "reviews-v1",
				"source_workload":      "external-v1",
				"request_protocol":     "http",
				"response_code":        "200",
				"reporter":             "destination",
			},
			Value:     model.SampleValue(8),
			Timestamp: model.Now(),
		},
	}

	fillWorkloadRequestRates(allHealth, rates, wlHTTPTraffic)

	// Destination should have inbound traffic
	assert.NotEmpty(destWkd.Requests.Inbound, "dest workload should have inbound traffic when HTTP-capable")

	// Source should have NO outbound (not HTTP-capable)
	assert.Equal(map[string]map[string]float64{}, srcWkd.Requests.Outbound, "source workload should have no outbound when not HTTP-capable")
}

// TestFillWorkloadRequestRates_BothHTTP tests that when both source and destination
// workloads are HTTP-capable, both inbound and outbound are aggregated.
func TestFillWorkloadRequestRates_BothHTTP(t *testing.T) {
	assert := assert.New(t)

	srcWkd := &models.WorkloadHealth{
		WorkloadStatus: &models.WorkloadStatus{Name: "productpage-v1"},
		Requests:       models.NewEmptyRequestHealth(),
	}
	destWkd := &models.WorkloadHealth{
		WorkloadStatus: &models.WorkloadStatus{Name: "reviews-v1"},
		Requests:       models.NewEmptyRequestHealth(),
	}
	allHealth := models.NamespaceWorkloadHealth{
		"productpage-v1": srcWkd,
		"reviews-v1":     destWkd,
	}
	wlHTTPTraffic := map[string]bool{
		"productpage-v1": true,
		"reviews-v1":     true,
	}

	rates := model.Vector{
		&model.Sample{
			Metric: model.Metric{
				"destination_workload": "reviews-v1",
				"source_workload":      "productpage-v1",
				"request_protocol":     "http",
				"response_code":        "200",
				"reporter":             "source",
			},
			Value:     model.SampleValue(10),
			Timestamp: model.Now(),
		},
	}

	fillWorkloadRequestRates(allHealth, rates, wlHTTPTraffic)

	// Source should have outbound
	assert.Equal(map[string]map[string]float64{
		"http": {"200": 10},
	}, srcWkd.Requests.Outbound, "source workload should have outbound when both are HTTP-capable")

	// Destination should have inbound
	assert.NotEmpty(destWkd.Requests.Inbound, "dest workload should have inbound when both are HTTP-capable")
}

// TestFillWorkloadRequestRates_NeitherHTTP tests that when neither workload is
// HTTP-capable, no traffic is aggregated.
func TestFillWorkloadRequestRates_NeitherHTTP(t *testing.T) {
	assert := assert.New(t)

	srcWkd := &models.WorkloadHealth{
		WorkloadStatus: &models.WorkloadStatus{Name: "src-v1"},
		Requests:       models.NewEmptyRequestHealth(),
	}
	destWkd := &models.WorkloadHealth{
		WorkloadStatus: &models.WorkloadStatus{Name: "dest-v1"},
		Requests:       models.NewEmptyRequestHealth(),
	}
	allHealth := models.NamespaceWorkloadHealth{
		"src-v1":  srcWkd,
		"dest-v1": destWkd,
	}
	wlHTTPTraffic := map[string]bool{}

	rates := model.Vector{
		&model.Sample{
			Metric: model.Metric{
				"destination_workload": "dest-v1",
				"source_workload":      "src-v1",
				"request_protocol":     "http",
				"response_code":        "200",
				"reporter":             "source",
			},
			Value:     model.SampleValue(5),
			Timestamp: model.Now(),
		},
	}

	fillWorkloadRequestRates(allHealth, rates, wlHTTPTraffic)

	assert.Equal(map[string]map[string]float64{}, srcWkd.Requests.Outbound, "source should have no outbound when neither is HTTP-capable")
	assert.Equal(map[string]map[string]float64{}, destWkd.Requests.Inbound, "dest should have no inbound when neither is HTTP-capable")
}

// TestFillWorkloadRequestRates_EmptyLabels tests that samples with empty/missing labels
// are handled gracefully for workloads.
func TestFillWorkloadRequestRates_EmptyLabels(t *testing.T) {
	assert := assert.New(t)

	wkdHealth := &models.WorkloadHealth{
		WorkloadStatus: &models.WorkloadStatus{Name: "myworkload"},
		Requests:       models.NewEmptyRequestHealth(),
	}
	allHealth := models.NamespaceWorkloadHealth{
		"myworkload": wkdHealth,
	}
	wlHTTPTraffic := map[string]bool{
		"myworkload": true,
	}

	// Sample with empty source and destination labels
	rates := model.Vector{
		&model.Sample{
			Metric: model.Metric{
				"request_protocol": "http",
				"response_code":    "200",
				"reporter":         "source",
			},
			Value:     model.SampleValue(1),
			Timestamp: model.Now(),
		},
	}

	// Should not panic
	fillWorkloadRequestRates(allHealth, rates, wlHTTPTraffic)

	assert.Equal(map[string]map[string]float64{}, wkdHealth.Requests.Inbound)
	assert.Equal(map[string]map[string]float64{}, wkdHealth.Requests.Outbound)
}

func fakePodsHealthReview() []core_v1.Pod {
	return []core_v1.Pod{
		{
			ObjectMeta: meta_v1.ObjectMeta{
				Name:        "reviews-v1",
				Namespace:   "ns",
				Labels:      map[string]string{"app": "reviews", "version": "v1"},
				Annotations: kubetest.FakeIstioAnnotations(),
			},
		},
		{
			ObjectMeta: meta_v1.ObjectMeta{
				Name:        "reviews-v2",
				Namespace:   "ns",
				Labels:      map[string]string{"app": "reviews", "version": "v2"},
				Annotations: kubetest.FakeIstioAnnotations(),
			},
		},
	}
}

func fakePodsHealthReviewWithoutIstio() []core_v1.Pod {
	return []core_v1.Pod{
		{
			ObjectMeta: meta_v1.ObjectMeta{
				Name:      "reviews-v1",
				Namespace: "ns",
				Labels:    map[string]string{"app": "reviews", "version": "v1"},
			},
		},
		{
			ObjectMeta: meta_v1.ObjectMeta{
				Name:      "reviews-v2",
				Namespace: "ns",
				Labels:    map[string]string{"app": "reviews", "version": "v2"},
			},
		},
	}
}

func fakeDeploymentsHealthReview() []apps_v1.Deployment {
	return []apps_v1.Deployment{
		{
			ObjectMeta: meta_v1.ObjectMeta{
				Name:      "reviews-v1",
				Namespace: "ns",
			},
			Status: apps_v1.DeploymentStatus{
				Replicas:            3,
				AvailableReplicas:   2,
				UnavailableReplicas: 1,
			},
			Spec: apps_v1.DeploymentSpec{
				Selector: &meta_v1.LabelSelector{
					MatchLabels: map[string]string{"app": "reviews", "version": "v1"},
				},
			},
		},
		{
			ObjectMeta: meta_v1.ObjectMeta{
				Name:      "reviews-v2",
				Namespace: "ns",
			},
			Status: apps_v1.DeploymentStatus{
				Replicas:            2,
				AvailableReplicas:   1,
				UnavailableReplicas: 1,
			},
			Spec: apps_v1.DeploymentSpec{
				Selector: &meta_v1.LabelSelector{
					MatchLabels: map[string]string{"app": "reviews", "version": "v2"},
				},
			},
		},
	}
}
