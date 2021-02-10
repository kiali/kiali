package business

import (
	"testing"
	"time"

	osproject_v1 "github.com/openshift/api/project/v1"
	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	apps_v1 "k8s.io/api/apps/v1"
	core_v1 "k8s.io/api/core/v1"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/prometheus/prometheustest"
)

var emptyResult = map[string]map[string]float64{}

func TestGetServiceHealth(t *testing.T) {
	assert := assert.New(t)

	// Setup mocks
	k8s := new(kubetest.K8SClientMock)
	prom := new(prometheustest.PromClientMock)
	conf := config.NewConfig()
	config.Set(conf)

	queryTime := time.Date(2017, 01, 15, 0, 0, 0, 0, time.UTC)
	prom.MockServiceRequestRates("ns", "httpbin", serviceRates)
	k8s.On("IsOpenShift").Return(true)
	k8s.On("GetProject", mock.AnythingOfType("string")).Return(&osproject_v1.Project{}, nil)
	k8s.On("GetService", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return(&core_v1.Service{}, nil)

	hs := HealthService{k8s: k8s, prom: prom, businessLayer: NewWithBackends(k8s, prom, nil)}

	health, _ := hs.GetServiceHealth("ns", "httpbin", "1m", queryTime)

	prom.AssertNumberOfCalls(t, "GetServiceRequestRates", 1)
	var result = map[string]map[string]float64{
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

	// Setup mocks
	k8s := new(kubetest.K8SClientMock)
	prom := new(prometheustest.PromClientMock)
	conf := config.NewConfig()
	config.Set(conf)

	k8s.On("IsOpenShift").Return(true)
	k8s.MockEmptyWorkloads("ns")
	k8s.On("GetProject", mock.AnythingOfType("string")).Return(&osproject_v1.Project{}, nil)
	k8s.On("GetDeployments", "ns").Return(fakeDeploymentsHealthReview(), nil)
	k8s.On("GetPods", "ns", "app=reviews").Return(fakePodsHealthReview(), nil)
	k8s.On("GetProxyStatus").Return([]*kubernetes.ProxyStatus{}, nil)

	hs := HealthService{k8s: k8s, prom: prom, businessLayer: NewWithBackends(k8s, prom, nil)}

	queryTime := time.Date(2017, 01, 15, 0, 0, 0, 0, time.UTC)
	prom.MockAppRequestRates("ns", "reviews", otherRatesIn, otherRatesOut)

	health, _ := hs.GetAppHealth("ns", "reviews", "1m", queryTime)

	prom.AssertNumberOfCalls(t, "GetAppRequestRates", 1)
	var result = map[string]map[string]float64{
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

	// Setup mocks
	k8s := new(kubetest.K8SClientMock)
	prom := new(prometheustest.PromClientMock)
	conf := config.NewConfig()
	config.Set(conf)

	k8s.On("IsOpenShift").Return(true)
	k8s.MockEmptyWorkload("ns", "reviews-v1")
	k8s.On("GetProject", mock.AnythingOfType("string")).Return(&osproject_v1.Project{}, nil)
	k8s.On("GetDeployment", "ns", "reviews-v1").Return(&fakeDeploymentsHealthReview()[0], nil)
	k8s.On("GetPods", "ns", "").Return(fakePodsHealthReview(), nil)
	k8s.On("GetProxyStatus").Return([]*kubernetes.ProxyStatus{}, nil)

	queryTime := time.Date(2017, 01, 15, 0, 0, 0, 0, time.UTC)
	prom.MockWorkloadRequestRates("ns", "reviews-v1", otherRatesIn, otherRatesOut)

	hs := HealthService{k8s: k8s, prom: prom, businessLayer: NewWithBackends(k8s, prom, nil)}

	health, _ := hs.GetWorkloadHealth("ns", "reviews-v1", "", "1m", queryTime)

	k8s.AssertNumberOfCalls(t, "GetDeployment", 2)
	prom.AssertNumberOfCalls(t, "GetWorkloadRequestRates", 1)
	var result = map[string]map[string]float64{
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

	// Setup mocks
	k8s := new(kubetest.K8SClientMock)
	prom := new(prometheustest.PromClientMock)
	conf := config.NewConfig()
	config.Set(conf)

	k8s.On("IsOpenShift").Return(true)
	k8s.MockEmptyWorkloads("ns")
	k8s.On("GetProject", mock.AnythingOfType("string")).Return(&osproject_v1.Project{}, nil)
	k8s.On("GetDeployments", "ns").Return(fakeDeploymentsHealthReview(), nil)
	k8s.On("GetPods", "ns", "app=reviews").Return(fakePodsHealthReviewWithoutIstio(), nil)

	queryTime := time.Date(2017, 01, 15, 0, 0, 0, 0, time.UTC)
	prom.MockAppRequestRates("ns", "reviews", otherRatesIn, otherRatesOut)

	hs := HealthService{k8s: k8s, prom: prom, businessLayer: NewWithBackends(k8s, prom, nil)}

	health, _ := hs.GetAppHealth("ns", "reviews", "1m", queryTime)

	prom.AssertNumberOfCalls(t, "GetAppRequestRates", 0)
	assert.Equal(emptyResult, health.Requests.Inbound)
	assert.Equal(emptyResult, health.Requests.Outbound)
}

func TestGetWorkloadHealthWithoutIstio(t *testing.T) {
	assert := assert.New(t)

	// Setup mocks
	k8s := new(kubetest.K8SClientMock)
	prom := new(prometheustest.PromClientMock)
	conf := config.NewConfig()
	config.Set(conf)

	k8s.On("IsOpenShift").Return(true)
	k8s.MockEmptyWorkload("ns", "reviews-v1")
	k8s.On("GetProject", mock.AnythingOfType("string")).Return(&osproject_v1.Project{}, nil)
	k8s.On("GetDeployment", "ns", "reviews-v1").Return(&fakeDeploymentsHealthReview()[0], nil)
	k8s.On("GetPods", "ns", "").Return(fakePodsHealthReviewWithoutIstio(), nil)
	k8s.On("GetWorkload", "ns", "wk", "", false).Return(&models.Workload{}, nil)

	queryTime := time.Date(2017, 01, 15, 0, 0, 0, 0, time.UTC)
	prom.MockWorkloadRequestRates("ns", "reviews-v1", otherRatesIn, otherRatesOut)

	hs := HealthService{k8s: k8s, prom: prom, businessLayer: NewWithBackends(k8s, prom, nil)}

	health, _ := hs.GetWorkloadHealth("ns", "reviews-v1", "", "1m", queryTime)

	prom.AssertNumberOfCalls(t, "GetWorkloadRequestRates", 0)
	assert.Equal(emptyResult, health.Requests.Inbound)
	assert.Equal(emptyResult, health.Requests.Outbound)
}

func TestGetNamespaceAppHealthWithoutIstio(t *testing.T) {
	// Setup mocks
	k8s := new(kubetest.K8SClientMock)
	prom := new(prometheustest.PromClientMock)
	conf := config.NewConfig()
	config.Set(conf)

	k8s.On("IsOpenShift").Return(true)
	k8s.MockEmptyWorkloads("ns")
	k8s.On("GetProject", mock.AnythingOfType("string")).Return(&osproject_v1.Project{}, nil)
	k8s.On("GetServices", "ns", mock.AnythingOfType("map[string]string")).Return([]core_v1.Service{}, nil)
	k8s.On("GetDeployments", "ns").Return(fakeDeploymentsHealthReview(), nil)
	k8s.On("GetPods", "ns", "app").Return(fakePodsHealthReviewWithoutIstio(), nil)

	hs := HealthService{k8s: k8s, prom: prom, businessLayer: NewWithBackends(k8s, prom, nil)}

	_, _ = hs.GetNamespaceAppHealth("ns", "1m", time.Date(2017, 01, 15, 0, 0, 0, 0, time.UTC))

	// Make sure unnecessary call isn't performed
	prom.AssertNumberOfCalls(t, "GetAllRequestRates", 0)
}

func TestGetNamespaceServiceHealthWithNA(t *testing.T) {
	assert := assert.New(t)

	// Setup mocks
	k8s := new(kubetest.K8SClientMock)
	prom := new(prometheustest.PromClientMock)
	conf := config.NewConfig()
	config.Set(conf)

	k8s.On("IsOpenShift").Return(true)
	k8s.On("GetProject", mock.AnythingOfType("string")).Return(&osproject_v1.Project{}, nil)
	k8s.MockServices("tutorial", []string{"reviews", "httpbin"})
	prom.On("GetNamespaceServicesRequestRates", "tutorial", mock.AnythingOfType("string"), mock.AnythingOfType("time.Time")).Return(serviceRates, nil)

	hs := HealthService{k8s: k8s, prom: prom, businessLayer: NewWithBackends(k8s, prom, nil)}

	health, err := hs.GetNamespaceServiceHealth("tutorial", "1m", time.Date(2017, 01, 15, 0, 0, 0, 0, time.UTC))

	assert.Nil(err)
	// Make sure we get services with N/A health
	assert.Len(health, 2)
	assert.Equal(emptyResult, health["reviews"].Requests.Inbound)
	assert.Equal(emptyResult, health["reviews"].Requests.Outbound)
	var result = map[string]map[string]float64{
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

/*
 * fakeServicesHealthReview is dead code
 */
//func fakeServicesHealthReview() []core_v1.Service {
//	return []core_v1.Service{
//		{
//			ObjectMeta: meta_v1.ObjectMeta{
//				Name:      "reviews",
//				Namespace: "tutorial",
//				Labels: map[string]string{
//					"app":     "reviews",
//					"version": "v1"}},
//			Spec: core_v1.ServiceSpec{
//				ClusterIP: "fromservice",
//				Type:      "ClusterIP",
//				Selector:  map[string]string{"app": "reviews"},
//				Ports: []core_v1.ServicePort{
//					{
//						Name:     "http",
//						Protocol: "TCP",
//						Port:     3001},
//					{
//						Name:     "http",
//						Protocol: "TCP",
//						Port:     3000}}}}}
//}

func fakePodsHealthReview() []core_v1.Pod {
	return []core_v1.Pod{
		{
			ObjectMeta: meta_v1.ObjectMeta{
				Name:        "reviews-v1",
				Labels:      map[string]string{"app": "reviews", "version": "v1"},
				Annotations: kubetest.FakeIstioAnnotations(),
			},
		},
		{
			ObjectMeta: meta_v1.ObjectMeta{
				Name:        "reviews-v2",
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
				Name:   "reviews-v1",
				Labels: map[string]string{"app": "reviews", "version": "v1"},
			},
		},
		{
			ObjectMeta: meta_v1.ObjectMeta{
				Name:   "reviews-v2",
				Labels: map[string]string{"app": "reviews", "version": "v2"},
			},
		},
	}
}

func fakeDeploymentsHealthReview() []apps_v1.Deployment {
	return []apps_v1.Deployment{
		{
			ObjectMeta: meta_v1.ObjectMeta{
				Name: "reviews-v1"},
			Status: apps_v1.DeploymentStatus{
				Replicas:            3,
				AvailableReplicas:   2,
				UnavailableReplicas: 1},
			Spec: apps_v1.DeploymentSpec{
				Selector: &meta_v1.LabelSelector{
					MatchLabels: map[string]string{"app": "reviews", "version": "v1"}}}},
		{
			ObjectMeta: meta_v1.ObjectMeta{
				Name: "reviews-v2"},
			Status: apps_v1.DeploymentStatus{
				Replicas:            2,
				AvailableReplicas:   1,
				UnavailableReplicas: 1},
			Spec: apps_v1.DeploymentSpec{
				Selector: &meta_v1.LabelSelector{
					MatchLabels: map[string]string{"app": "reviews", "version": "v2"}}}}}
}
