package business

import (
	"testing"
	"time"

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
	"github.com/prometheus/common/model"
)

func TestServiceListParsing(t *testing.T) {
	assert := assert.New(t)

	// Setup mocks
	k8s := new(kubetest.K8SClientMock)
	prom := new(prometheustest.PromClientMock)
	k8s.On("GetServices", mock.AnythingOfType("string")).Return(fakeServiceList(), nil)
	prom.On("GetServiceHealth", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return(1, 1, nil)
	prom.On("GetNamespaceServicesRequestCounters", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return(fakeRequestCounters(), nil)
	svc := setupServices(k8s, prom)

	serviceList, _ := svc.GetServiceList("namespace", "1m")

	assert.Equal("namespace", serviceList.Namespace.Name)
	assert.Len(serviceList.Services, 2)
	reviewsOverview := serviceList.Services[0]
	httpbinOverview := serviceList.Services[1]

	assert.Equal("reviews", reviewsOverview.Name)
	assert.Equal(1, reviewsOverview.Health.Envoy.Total)
	assert.Equal(1, reviewsOverview.Health.Envoy.Healthy)
	assert.Equal(int32(2), reviewsOverview.Health.DeploymentStatuses[0].AvailableReplicas)
	assert.Equal(int32(3), reviewsOverview.Health.DeploymentStatuses[0].Replicas)
	assert.Equal(int32(1), reviewsOverview.Health.DeploymentStatuses[1].AvailableReplicas)
	assert.Equal(int32(2), reviewsOverview.Health.DeploymentStatuses[1].Replicas)
	assert.Equal(model.SampleValue(6.5), reviewsOverview.RequestCount)
	assert.Equal(model.SampleValue(1.5), reviewsOverview.RequestErrorCount)
	assert.Equal(model.SampleValue(1.5/6.5), reviewsOverview.ErrorRate)

	assert.Equal("httpbin", httpbinOverview.Name)
	assert.Equal(1, httpbinOverview.Health.Envoy.Total)
	assert.Equal(1, httpbinOverview.Health.Envoy.Healthy)
	assert.Equal(int32(1), httpbinOverview.Health.DeploymentStatuses[0].AvailableReplicas)
	assert.Equal(int32(1), httpbinOverview.Health.DeploymentStatuses[0].Replicas)
	assert.Equal(model.SampleValue(20.5), httpbinOverview.RequestCount)
	assert.Equal(model.SampleValue(1.5), httpbinOverview.RequestErrorCount)
	assert.Equal(model.SampleValue(1.5/20.5), httpbinOverview.ErrorRate)
}

func setupServices(k8s *kubetest.K8SClientMock, prom *prometheustest.PromClientMock) SvcService {
	conf := config.NewConfig()
	config.Set(conf)
	health := HealthService{k8s: k8s, prom: prom}
	svc := SvcService{k8s: k8s, prom: prom, health: &health}
	return svc
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
		Deployments: &v1beta1.DeploymentList{
			Items: []v1beta1.Deployment{
				v1beta1.Deployment{
					ObjectMeta: meta_v1.ObjectMeta{
						Name:              "reviews-v1",
						CreationTimestamp: meta_v1.NewTime(t1),
						Labels:            map[string]string{"app": "reviews", "version": "v1"}},
					Status: v1beta1.DeploymentStatus{
						Replicas:            3,
						AvailableReplicas:   2,
						UnavailableReplicas: 1}},
				v1beta1.Deployment{
					ObjectMeta: meta_v1.ObjectMeta{
						Name:              "reviews-v2",
						CreationTimestamp: meta_v1.NewTime(t1),
						Labels:            map[string]string{"app": "reviews", "version": "v2"}},
					Status: v1beta1.DeploymentStatus{
						Replicas:            2,
						AvailableReplicas:   1,
						UnavailableReplicas: 1}},
				v1beta1.Deployment{
					ObjectMeta: meta_v1.ObjectMeta{
						Name:              "httpbin-v1",
						CreationTimestamp: meta_v1.NewTime(t2),
						Labels:            map[string]string{"app": "httpbin", "version": "v1"}},
					Status: v1beta1.DeploymentStatus{
						Replicas:            1,
						AvailableReplicas:   1,
						UnavailableReplicas: 0}}}}}
}

func fakeRequestCounters() prometheus.MetricsVector {
	t1 := model.Now()

	return prometheus.MetricsVector{
		Vector: model.Vector{
			&model.Sample{
				Metric: model.Metric{
					"destination_service": "reviews.tutorial.svc.cluster.local",
					"source_service":      "httpbin.tutorial.svc.cluster.local",
					"response_code":       "200",
				},
				Value:     model.SampleValue(5),
				Timestamp: t1,
			},
			&model.Sample{
				Metric: model.Metric{
					"destination_service": "httpbin.tutorial.svc.cluster.local",
					"source_service":      "unknown",
					"response_code":       "200",
				},
				Value:     model.SampleValue(14),
				Timestamp: t1,
			},
			&model.Sample{
				Metric: model.Metric{
					"source_service":      "httpbin.tutorial.svc.cluster.local",
					"destination_service": "unknown",
					"response_code":       "400",
				},
				Value:     model.SampleValue(1.5),
				Timestamp: t1,
			},
			&model.Sample{
				Metric: model.Metric{
					"source_service":      "reviews.tutorial.svc.cluster.local",
					"destination_service": "unknown",
					"response_code":       "500",
				},
				Value:     model.SampleValue(1.5),
				Timestamp: t1,
			},
		},
	}
}
