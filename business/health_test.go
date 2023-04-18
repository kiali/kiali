package business

import (
	"context"
	"testing"
	"time"

	osproject_v1 "github.com/openshift/api/project/v1"
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

	k8s := kubetest.NewFakeK8sClient(
		&osproject_v1.Project{ObjectMeta: meta_v1.ObjectMeta{Name: "ns"}},
		&core_v1.Service{ObjectMeta: meta_v1.ObjectMeta{Name: "httpbin", Namespace: "ns"}},
	)
	k8s.OpenShift = true
	clients := make(map[string]kubernetes.ClientInterface)
	clients[kubernetes.HomeClusterName] = k8s

	prom := new(prometheustest.PromClientMock)

	queryTime := time.Date(2017, 1, 15, 0, 0, 0, 0, time.UTC)
	prom.MockServiceRequestRates("ns", "httpbin", serviceRates)

	setupGlobalMeshConfig()
	hs := HealthService{prom: prom, businessLayer: NewWithBackends(clients, clients, prom, nil)}

	mockSvc := models.Service{}
	mockSvc.Name = "httpbin"

	health, _ := hs.GetServiceHealth(context.TODO(), "ns", "httpbin", "1m", queryTime, &mockSvc)

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

	objects := []runtime.Object{
		&osproject_v1.Project{ObjectMeta: meta_v1.ObjectMeta{Name: "ns"}},
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

	clients := make(map[string]kubernetes.ClientInterface)
	clients[kubernetes.HomeClusterName] = k8s

	hs := HealthService{prom: prom, businessLayer: NewWithBackends(clients, clients, prom, nil)}

	queryTime := time.Date(2017, 1, 15, 0, 0, 0, 0, time.UTC)
	prom.MockAppRequestRates("ns", "reviews", otherRatesIn, otherRatesOut)

	mockWkd := models.Workload{}
	mockWkd.Name = "reviews-v1"
	mockWkd.IstioSidecar = true

	mockApp := appDetails{
		Workloads: models.Workloads{&mockWkd},
	}

	health, _ := hs.GetAppHealth(context.TODO(), "ns", "reviews", "1m", queryTime, &mockApp)

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

	objects := []runtime.Object{
		&osproject_v1.Project{ObjectMeta: meta_v1.ObjectMeta{Name: "ns"}},
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
	prom.MockWorkloadRequestRates("ns", "reviews-v1", otherRatesIn, otherRatesOut)

	clients := make(map[string]kubernetes.ClientInterface)
	clients[kubernetes.HomeClusterName] = k8s
	hs := HealthService{prom: prom, businessLayer: NewWithBackends(clients, clients, prom, nil)}

	mockWorkload := models.Workload{}
	mockWorkload.Name = "reviews-v1"
	mockWorkload.IstioSidecar = true

	health, _ := hs.GetWorkloadHealth(context.TODO(), "ns", "reviews-v1", "1m", queryTime, &mockWorkload)

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

	objects := []runtime.Object{
		&osproject_v1.Project{ObjectMeta: meta_v1.ObjectMeta{Name: "ns"}},
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
	prom.MockAppRequestRates("ns", "reviews", otherRatesIn, otherRatesOut)

	clients := make(map[string]kubernetes.ClientInterface)
	clients[kubernetes.HomeClusterName] = k8s
	hs := HealthService{prom: prom, businessLayer: NewWithBackends(clients, clients, prom, nil)}

	mockApp := appDetails{}

	health, _ := hs.GetAppHealth(context.TODO(), "ns", "reviews", "1m", queryTime, &mockApp)

	prom.AssertNumberOfCalls(t, "GetAppRequestRates", 0)
	assert.Equal(emptyResult, health.Requests.Inbound)
	assert.Equal(emptyResult, health.Requests.Outbound)
}

func TestGetWorkloadHealthWithoutIstio(t *testing.T) {
	assert := assert.New(t)

	objects := []runtime.Object{
		&osproject_v1.Project{ObjectMeta: meta_v1.ObjectMeta{Name: "ns"}},
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
	prom.MockWorkloadRequestRates("ns", "reviews-v1", otherRatesIn, otherRatesOut)

	clients := make(map[string]kubernetes.ClientInterface)
	clients[kubernetes.HomeClusterName] = k8s
	hs := HealthService{prom: prom, businessLayer: NewWithBackends(clients, clients, prom, nil)}

	mockWorkload := models.Workload{}
	mockWorkload.Name = "reviews-v1"

	health, _ := hs.GetWorkloadHealth(context.TODO(), "ns", "reviews-v1", "1m", queryTime, &mockWorkload)

	prom.AssertNumberOfCalls(t, "GetWorkloadRequestRates", 0)
	assert.Equal(emptyResult, health.Requests.Inbound)
	assert.Equal(emptyResult, health.Requests.Outbound)
}

func TestGetNamespaceAppHealthWithoutIstio(t *testing.T) {
	require := require.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	objects := []runtime.Object{
		&osproject_v1.Project{ObjectMeta: meta_v1.ObjectMeta{Name: "ns"}},
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
	SetupBusinessLayer(t, k8s, *conf)

	clients := make(map[string]kubernetes.ClientInterface)
	clients[kubernetes.HomeClusterName] = k8s
	hs := HealthService{prom: prom, businessLayer: NewWithBackends(clients, clients, prom, nil)}
	criteria := NamespaceHealthCriteria{Namespace: "ns", RateInterval: "1m", QueryTime: time.Date(2017, 1, 15, 0, 0, 0, 0, time.UTC), IncludeMetrics: true}
	_, err := hs.GetNamespaceAppHealth(context.TODO(), criteria)
	require.NoError(err)

	// Make sure unnecessary call isn't performed
	prom.AssertNumberOfCalls(t, "GetAllRequestRates", 0)
}

func TestGetNamespaceServiceHealthWithNA(t *testing.T) {
	assert := assert.New(t)

	reviews := kubetest.FakeService("tutorial", "reviews")
	httpbin := kubetest.FakeService("tutorial", "httpbin")
	k8s := kubetest.NewFakeK8sClient(
		&core_v1.Namespace{ObjectMeta: meta_v1.ObjectMeta{Name: "ns"}},
		&core_v1.Namespace{ObjectMeta: meta_v1.ObjectMeta{Name: "tutorial"}},
		&core_v1.Service{ObjectMeta: meta_v1.ObjectMeta{Name: "httpbin", Namespace: "ns"}},
		&reviews,
		&httpbin,
	)
	k8s.OpenShift = false
	prom := new(prometheustest.PromClientMock)
	conf := config.NewConfig()
	config.Set(conf)
	setupGlobalMeshConfig()
	SetupBusinessLayer(t, k8s, *conf)

	prom.On("GetNamespaceServicesRequestRates", "tutorial", kubernetes.HomeClusterName, mock.AnythingOfType("string"), mock.AnythingOfType("time.Time")).Return(serviceRates, nil)

	clients := make(map[string]kubernetes.ClientInterface)
	clients[kubernetes.HomeClusterName] = k8s
	hs := HealthService{prom: prom, businessLayer: NewWithBackends(clients, clients, prom, nil), userClients: clients}

	criteria := NamespaceHealthCriteria{Namespace: "tutorial", RateInterval: "1m", QueryTime: time.Date(2017, 1, 15, 0, 0, 0, 0, time.UTC), IncludeMetrics: true}
	health, err := hs.GetNamespaceServiceHealth(context.TODO(), criteria)

	assert.Nil(err)
	// Make sure we get services with N/A health
	assert.Len(health, 2)
	for _, reviewsHealth := range health {
		if reviewsHealth.Name == "reviews" {
			assert.Equal(emptyResult, reviewsHealth.Health.Requests.Inbound)
			assert.Equal(emptyResult, reviewsHealth.Health.Requests.Outbound)
		}
	}

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
	for _, reviewsHealth := range health {
		if reviewsHealth.Name == "httpbin" {
			assert.Equal(result, reviewsHealth.Health.Requests.Inbound)
			assert.Equal(emptyResult, reviewsHealth.Health.Requests.Outbound)
		}
	}
}

var (
	sampleReviewsToHttpbin200 = model.Sample{
		Metric: model.Metric{
			"source_service":      "reviews.tutorial.svc.cluster.local",
			"destination_service": "httpbin.tutorial.svc.cluster.local",
			"request_protocol":    "http",
			"response_code":       "200",
			"reporter":            "source",
		},
		Value:     model.SampleValue(5),
		Timestamp: model.Now(),
	}
	sampleReviewsToHttpbin400 = model.Sample{
		Metric: model.Metric{
			"source_service":      "reviews.tutorial.svc.cluster.local",
			"destination_service": "httpbin.tutorial.svc.cluster.local",
			"request_protocol":    "http",
			"response_code":       "400",
			"reporter":            "source",
		},
		Value:     model.SampleValue(3.5),
		Timestamp: model.Now(),
	}
	sampleReviewsToHttpbinGrpc0 = model.Sample{
		Metric: model.Metric{
			"source_service":       "reviews.tutorial.svc.cluster.local",
			"destination_service":  "httpbin.tutorial.svc.cluster.local",
			"request_protocol":     "grpc",
			"grpc_response_status": "0",
			"reporter":             "source",
		},
		Value:     model.SampleValue(5),
		Timestamp: model.Now(),
	}
	sampleReviewsToHttpbinGrpc7 = model.Sample{
		Metric: model.Metric{
			"source_service":       "reviews.tutorial.svc.cluster.local",
			"destination_service":  "httpbin.tutorial.svc.cluster.local",
			"request_protocol":     "grpc",
			"grpc_response_status": "7",
			"reporter":             "source",
		},
		Value:     model.SampleValue(3.5),
		Timestamp: model.Now(),
	}
	sampleUnknownToHttpbin200 = model.Sample{
		Metric: model.Metric{
			"destination_service":      "httpbin.tutorial.svc.cluster.local",
			"destination_service_name": "httpbin",
			"request_protocol":         "http",
			"source_service":           "unknown",
			"response_code":            "200",
		},
		Value:     model.SampleValue(14),
		Timestamp: model.Now(),
	}
	sampleUnknownToHttpbin404 = model.Sample{
		Metric: model.Metric{
			"destination_service":      "httpbin.tutorial.svc.cluster.local",
			"destination_service_name": "httpbin",
			"request_protocol":         "http",
			"source_service":           "unknown",
			"response_code":            "404",
		},
		Value:     model.SampleValue(1.4),
		Timestamp: model.Now(),
	}
	sampleUnknownToHttpbinGrpc0 = model.Sample{
		Metric: model.Metric{
			"destination_service":      "httpbin.tutorial.svc.cluster.local",
			"destination_service_name": "httpbin",
			"source_service":           "unknown",
			"request_protocol":         "grpc",
			"grpc_response_status":     "0",
		},
		Value:     model.SampleValue(14),
		Timestamp: model.Now(),
	}
	sampleUnknownToHttpbinGrpc7 = model.Sample{
		Metric: model.Metric{
			"destination_service":      "httpbin.tutorial.svc.cluster.local",
			"destination_service_name": "httpbin",
			"source_service":           "unknown",
			"request_protocol":         "grpc",
			"grpc_response_status":     "7",
		},
		Value:     model.SampleValue(1.4),
		Timestamp: model.Now(),
	}
	sampleUnknownToReviews500 = model.Sample{
		Metric: model.Metric{
			"destination_service":      "reviews.tutorial.svc.cluster.local",
			"destination_service_name": "reviews",
			"request_protocol":         "http",
			"source_service":           "unknown",
			"response_code":            "500",
			"reporter":                 "source",
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
