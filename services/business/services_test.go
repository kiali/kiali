package business

import (
	"testing"
	"time"

	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"k8s.io/api/apps/v1beta1"
	"k8s.io/api/core/v1"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/prometheus"
	"github.com/kiali/kiali/prometheus/prometheustest"
)

func TestServiceListParsing(t *testing.T) {
	assert := assert.New(t)

	// Setup mocks
	k8s := new(kubetest.K8SClientMock)
	prom := new(prometheustest.PromClientMock)
	k8s.On("GetServices", mock.AnythingOfType("string")).Return(fakeServiceList(), nil)
	prom.On("GetServiceHealth", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return(prometheus.EnvoyHealth{Inbound: prometheus.EnvoyRatio{Healthy: 1, Total: 1}}, nil)
	prom.On("GetNamespaceServicesRequestRates", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return(fakeRequestCounters())
	svc := setupServices(k8s, prom)

	serviceList, _ := svc.GetServiceList("Namespace", "1m")

	assert.Equal("Namespace", serviceList.Namespace.Name)
	assert.Len(serviceList.Services, 2)
	reviewsOverview := serviceList.Services[0]
	httpbinOverview := serviceList.Services[1]

	assert.Equal("reviews", reviewsOverview.Name)
	assert.Equal(1, reviewsOverview.Health.Envoy.Inbound.Total)
	assert.Equal(1, reviewsOverview.Health.Envoy.Inbound.Healthy)
	assert.Equal(int32(2), reviewsOverview.Health.DeploymentStatuses[0].AvailableReplicas)
	assert.Equal(int32(3), reviewsOverview.Health.DeploymentStatuses[0].Replicas)
	assert.Equal(int32(1), reviewsOverview.Health.DeploymentStatuses[1].AvailableReplicas)
	assert.Equal(int32(2), reviewsOverview.Health.DeploymentStatuses[1].Replicas)
	assert.Equal(float64(6.6), reviewsOverview.Health.Requests.RequestCount)
	assert.Equal(float64(1.6), reviewsOverview.Health.Requests.RequestErrorCount)

	assert.Equal("httpbin", httpbinOverview.Name)
	assert.Equal(1, httpbinOverview.Health.Envoy.Inbound.Total)
	assert.Equal(1, httpbinOverview.Health.Envoy.Inbound.Healthy)
	assert.Equal(int32(1), httpbinOverview.Health.DeploymentStatuses[0].AvailableReplicas)
	assert.Equal(int32(1), httpbinOverview.Health.DeploymentStatuses[0].Replicas)
	assert.Equal(float64(20.4), httpbinOverview.Health.Requests.RequestCount)
	assert.Equal(float64(1.4), httpbinOverview.Health.Requests.RequestErrorCount)
}

func TestSingleServiceHealthParsing(t *testing.T) {
	assert := assert.New(t)

	// Setup mocks
	k8s := new(kubetest.K8SClientMock)
	prom := new(prometheustest.PromClientMock)
	k8s.On("GetServiceDetails", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return(fakeServiceDetails(), nil)
	k8s.On("GetIstioDetails", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return(fakeIstioDetails(), nil)
	prom.On("GetSourceServices", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return(make(map[string][]string), nil)
	prom.On("GetServiceHealth", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return(prometheus.EnvoyHealth{Inbound: prometheus.EnvoyRatio{Healthy: 1, Total: 1}}, nil)
	prom.On("GetServiceRequestRates", mock.AnythingOfType("string"), mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return(fakeServiceRequestCounters())
	svc := setupServices(k8s, prom)

	service, _ := svc.GetService("Namespace", "httpbin", "1m")

	assert.Equal("Namespace", service.Namespace.Name)
	assert.Equal("httpbin", service.Name)
	assert.Equal(1, service.Health.Envoy.Inbound.Total)
	assert.Equal(1, service.Health.Envoy.Inbound.Healthy)
	assert.Equal(int32(1), service.Health.DeploymentStatuses[0].AvailableReplicas)
	assert.Equal(int32(1), service.Health.DeploymentStatuses[0].Replicas)
	assert.Equal(float64(20.4), service.Health.Requests.RequestCount)
	assert.Equal(float64(1.4), service.Health.Requests.RequestErrorCount)
}

func setupServices(k8s *kubetest.K8SClientMock, prom *prometheustest.PromClientMock) SvcService {
	conf := config.NewConfig()
	config.Set(conf)
	health := HealthService{k8s: k8s, prom: prom}
	svc := SvcService{k8s: k8s, prom: prom, health: &health}
	return svc
}

func fakeIstioDetails() *kubernetes.IstioDetails {
	return &kubernetes.IstioDetails{}
}

func fakeServiceDetails() *kubernetes.ServiceDetails {
	t1, _ := time.Parse(time.RFC822Z, "08 Mar 18 17:44 +0300")

	return &kubernetes.ServiceDetails{
		Service: &v1.Service{
			ObjectMeta: meta_v1.ObjectMeta{
				Name:      "httpbin",
				Namespace: "tutorial",
				Labels: map[string]string{
					"app":     "httpbin",
					"version": "v1"}},
			Spec: v1.ServiceSpec{
				ClusterIP: "fromservice",
				Type:      "ClusterIP",
				Selector:  map[string]string{"app": "httpbin"},
				Ports: []v1.ServicePort{
					{
						Name:     "http",
						Protocol: "TCP",
						Port:     3001},
					{
						Name:     "http",
						Protocol: "TCP",
						Port:     3000}}}},
		Deployments: &v1beta1.DeploymentList{
			Items: []v1beta1.Deployment{
				v1beta1.Deployment{
					ObjectMeta: meta_v1.ObjectMeta{
						Name:              "httpbin-v1",
						CreationTimestamp: meta_v1.NewTime(t1),
						Labels:            map[string]string{"app": "httpbin", "version": "v1"}},
					Status: v1beta1.DeploymentStatus{
						Replicas:            1,
						AvailableReplicas:   1,
						UnavailableReplicas: 0}}}}}
}

func fakeServiceList() *kubernetes.ServiceList {
	t1, _ := time.Parse(time.RFC822Z, "08 Mar 18 17:44 +0300")
	t2, _ := time.Parse(time.RFC822Z, "08 Mar 18 17:45 +0300")

	return &kubernetes.ServiceList{
		Services: &v1.ServiceList{
			Items: []v1.Service{
				v1.Service{
					ObjectMeta: meta_v1.ObjectMeta{
						Name:      "reviews",
						Namespace: "tutorial",
						Labels: map[string]string{
							"app":     "reviews",
							"version": "v1"}},
					Spec: v1.ServiceSpec{
						ClusterIP: "fromservice",
						Type:      "ClusterIP",
						Selector:  map[string]string{"app": "reviews"},
						Ports: []v1.ServicePort{
							{
								Name:     "http",
								Protocol: "TCP",
								Port:     3001},
							{
								Name:     "http",
								Protocol: "TCP",
								Port:     3000}}}},
				v1.Service{
					ObjectMeta: meta_v1.ObjectMeta{
						Name:      "httpbin",
						Namespace: "tutorial",
						Labels: map[string]string{
							"app":     "httpbin",
							"version": "v1"}},
					Spec: v1.ServiceSpec{
						ClusterIP: "fromservice",
						Type:      "ClusterIP",
						Selector:  map[string]string{"app": "httpbin"},
						Ports: []v1.ServicePort{
							{
								Name:     "http",
								Protocol: "TCP",
								Port:     3001},
							{
								Name:     "http",
								Protocol: "TCP",
								Port:     3000}}}},
			}},
		Pods: &v1.PodList{
			Items: []v1.Pod{
				v1.Pod{
					ObjectMeta: meta_v1.ObjectMeta{
						Name:   "reviews-v1",
						Labels: map[string]string{"app": "reviews", "version": "v1"}}},
				v1.Pod{
					ObjectMeta: meta_v1.ObjectMeta{
						Name:   "reviews-v2",
						Labels: map[string]string{"app": "reviews", "version": "v2"}}},
				v1.Pod{
					ObjectMeta: meta_v1.ObjectMeta{
						Name:   "httpbin-v1",
						Labels: map[string]string{"app": "httpbin", "version": "v1"}}},
			}},
		Deployments: &v1beta1.DeploymentList{
			Items: []v1beta1.Deployment{
				v1beta1.Deployment{
					ObjectMeta: meta_v1.ObjectMeta{
						Name:              "reviews-v1",
						CreationTimestamp: meta_v1.NewTime(t1)},
					Status: v1beta1.DeploymentStatus{
						Replicas:            3,
						AvailableReplicas:   2,
						UnavailableReplicas: 1},
					Spec: v1beta1.DeploymentSpec{
						Selector: &meta_v1.LabelSelector{
							MatchLabels: map[string]string{"app": "reviews", "version": "v1"}}}},
				v1beta1.Deployment{
					ObjectMeta: meta_v1.ObjectMeta{
						Name:              "reviews-v2",
						CreationTimestamp: meta_v1.NewTime(t1)},
					Status: v1beta1.DeploymentStatus{
						Replicas:            2,
						AvailableReplicas:   1,
						UnavailableReplicas: 1},
					Spec: v1beta1.DeploymentSpec{
						Selector: &meta_v1.LabelSelector{
							MatchLabels: map[string]string{"app": "reviews", "version": "v2"}}}},
				v1beta1.Deployment{
					ObjectMeta: meta_v1.ObjectMeta{
						Name:              "httpbin-v1",
						CreationTimestamp: meta_v1.NewTime(t2)},
					Status: v1beta1.DeploymentStatus{
						Replicas:            1,
						AvailableReplicas:   1,
						UnavailableReplicas: 0},
					Spec: v1beta1.DeploymentSpec{
						Selector: &meta_v1.LabelSelector{
							MatchLabels: map[string]string{"app": "httpbin", "version": "v1"}}}},
			}}}
}

var t1 = model.Now()
var sampleHttpbinToReviews200 = model.Sample{
	Metric: model.Metric{
		"destination_service": "reviews.tutorial.svc.cluster.local",
		"source_service":      "httpbin.tutorial.svc.cluster.local",
		"response_code":       "200",
	},
	Value:     model.SampleValue(5),
	Timestamp: t1,
}
var sampleUnknownToHttpbin200 = model.Sample{
	Metric: model.Metric{
		"destination_service": "httpbin.tutorial.svc.cluster.local",
		"source_service":      "unknown",
		"response_code":       "200",
	},
	Value:     model.SampleValue(14),
	Timestamp: t1,
}
var sampleUnknownToHttpbin404 = model.Sample{
	Metric: model.Metric{
		"destination_service": "httpbin.tutorial.svc.cluster.local",
		"source_service":      "unknown",
		"response_code":       "404",
	},
	Value:     model.SampleValue(1.4),
	Timestamp: t1,
}
var sampleUnknownToReviews500 = model.Sample{
	Metric: model.Metric{
		"destination_service": "reviews.tutorial.svc.cluster.local",
		"source_service":      "unknown",
		"response_code":       "500",
	},
	Value:     model.SampleValue(1.6),
	Timestamp: t1,
}

func fakeRequestCounters() (model.Vector, model.Vector, error) {
	in := model.Vector{
		&sampleHttpbinToReviews200,
		&sampleUnknownToHttpbin200,
		&sampleUnknownToHttpbin404,
		&sampleUnknownToReviews500,
	}
	out := model.Vector{
		&sampleHttpbinToReviews200,
	}
	return in, out, nil
}

func fakeServiceRequestCounters() (model.Vector, model.Vector, error) {
	in := model.Vector{
		&sampleUnknownToHttpbin200,
		&sampleUnknownToHttpbin404,
	}
	out := model.Vector{
		&sampleHttpbinToReviews200,
	}
	return in, out, nil
}
