package models

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/swift-sunshine/swscore/kubernetes"

	"k8s.io/api/core/v1"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func TestServiceDetailParsing(t *testing.T) {
	assert := assert.New(t)

	service := Service{}
	service.Name = "service"
	service.Namespace = Namespace{"namespace"}
	service.SetServiceDetails(fakeServiceDetails(), fakeIstioDetails(), fakePrometheusDetails())

	// Kubernetes Details
	assert.Equal(service.Name, "service")
	assert.Equal(service.Namespace.Name, "namespace")
	assert.Equal(service.Type, "ClusterIP")
	assert.Equal(service.Ip, "fromservice")
	assert.Equal(service.Labels, map[string]string{"label1": "labelName1", "label2": "labelName2"})
	assert.Equal(service.Ports, Ports{
		Port{Name: "http", Protocol: "TCP", Port: 3001},
		Port{Name: "http", Protocol: "TCP", Port: 3000}})
	assert.Equal(service.Endpoints, Endpoints{
		Endpoint{
			Addresses: Addresses{
				Address{Kind: "Pod", Name: "recommendation-v1", IP: "172.17.0.9"},
				Address{Kind: "Pod", Name: "recommendation-v2", IP: "172.17.0.8"},
			},
			Ports: Ports{
				Port{Name: "http", Protocol: "TCP", Port: 3001},
				Port{Name: "http", Protocol: "TCP", Port: 3000},
			}}})
	assert.Equal(service.Pods, Pods{
		Pod{
			Name: "Pod1",
			Labels: map[string]string{
				"label1": "labelName1Pod1",
				"label2": "labelName2Pod1"}},
		Pod{
			Name: "Pod2",
			Labels: map[string]string{
				"label1": "labelName1Pod2",
				"label2": "labelName2Pod2"}}})

	// Istio Details
	assert.Equal(service.RouteRules, RouteRules{
		RouteRule{
			Destination: map[string]string{
				"name":      "reviews",
				"namespace": "tutorial"},
			Precedence: 1,
			Route: map[string]map[string]string{
				"labels": map[string]string{
					"name":      "version",
					"namespace": "v1"}}},
		RouteRule{
			Destination: map[string]string{
				"name":      "reviews",
				"namespace": "tutorial"},
			Precedence: 1,
			Route: map[string]map[string]string{
				"labels": map[string]string{
					"name":      "version",
					"namespace": "v3"}}}})

	// Prometheus Client
	assert.Equal(service.Dependencies, map[string][]string{
		"v1": []string{"unknown", "/products", "/reviews"},
		"v2": []string{"/catalog", "/shares"}})
}

func fakeServiceDetails() *kubernetes.ServiceDetails {
	service := &v1.Service{
		ObjectMeta: meta_v1.ObjectMeta{
			Name:      "Name",
			Namespace: "Namespace",
			Labels: map[string]string{
				"label1": "labelName1",
				"label2": "labelName2"}},
		Spec: v1.ServiceSpec{
			ClusterIP: "fromservice",
			Type:      "ClusterIP",
			Ports: []v1.ServicePort{
				v1.ServicePort{
					Name:     "http",
					Protocol: "TCP",
					Port:     3001},
				v1.ServicePort{
					Name:     "http",
					Protocol: "TCP",
					Port:     3000}}}}

	endpoints := &v1.Endpoints{
		Subsets: []v1.EndpointSubset{
			v1.EndpointSubset{
				Addresses: []v1.EndpointAddress{
					v1.EndpointAddress{
						IP: "172.17.0.9",
						TargetRef: &v1.ObjectReference{
							Kind: "Pod",
							Name: "recommendation-v1"}},
					v1.EndpointAddress{
						IP: "172.17.0.8",
						TargetRef: &v1.ObjectReference{
							Kind: "Pod",
							Name: "recommendation-v2"}},
				},
				Ports: []v1.EndpointPort{
					v1.EndpointPort{Name: "http", Protocol: "TCP", Port: 3001},
					v1.EndpointPort{Name: "http", Protocol: "TCP", Port: 3000},
				}}}}

	pods := []*v1.Pod{
		&v1.Pod{
			ObjectMeta: meta_v1.ObjectMeta{
				Name:      "Pod1",
				Namespace: "Namespace1",
				Labels: map[string]string{
					"label1": "labelName1Pod1",
					"label2": "labelName2Pod1"}}},
		&v1.Pod{
			ObjectMeta: meta_v1.ObjectMeta{
				Name:      "Pod2",
				Namespace: "Namespace2",
				Labels: map[string]string{
					"label1": "labelName1Pod2",
					"label2": "labelName2Pod2"}}}}

	return &kubernetes.ServiceDetails{service, endpoints, pods}
}

func fakeIstioDetails() *kubernetes.IstioDetails {
	routes := []*kubernetes.RouteRule{
		&kubernetes.RouteRule{
			Spec: map[string]interface{}{
				"destination": map[string]string{
					"name":      "reviews",
					"namespace": "tutorial"},
				"precedence": 1,
				"route": map[string]map[string]string{
					"labels": map[string]string{
						"name":      "version",
						"namespace": "v1"}}}},
		&kubernetes.RouteRule{
			Spec: map[string]interface{}{
				"destination": map[string]string{
					"name":      "reviews",
					"namespace": "tutorial"},
				"precedence": 1,
				"route": map[string]map[string]string{
					"labels": map[string]string{
						"name":      "version",
						"namespace": "v3"}}}}}

	return &kubernetes.IstioDetails{routes}
}

func fakePrometheusDetails() map[string][]string {
	return map[string][]string{
		"v1": []string{"unknown", "/products", "/reviews"},
		"v2": []string{"/catalog", "/shares"}}
}
