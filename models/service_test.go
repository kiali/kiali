package models

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"k8s.io/api/core/v1"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/prometheus"
)

func TestServiceDetailParsing(t *testing.T) {
	assert := assert.New(t)
	config.Set(config.NewConfig())

	service := ServiceDetails{}
	service.SetService(fakeService())
	service.SetEndpoints(fakeEndpoints())
	service.SetPods(fakePods())
	service.SetVirtualServices(fakeVirtualService())
	service.SetDestinationRules(fakeDestinationRules())
	service.SetSourceWorkloads(fakeSourceWorkloads())

	// Kubernetes Details

	assert.Equal(service.Service.Name, "Name")
	assert.Equal(service.Service.Namespace.Name, "Namespace")
	assert.Equal(service.Service.CreatedAt, "2018-03-08T17:44:00+03:00")
	assert.Equal(service.Service.ResourceVersion, "1234")
	assert.Equal(service.Service.Type, "ClusterIP")
	assert.Equal(service.Service.Ip, "127.0.0.9")
	assert.Equal(service.Service.Labels, map[string]string{"label1": "labelName1", "label2": "labelName2"})
	assert.Equal(service.Service.Ports, Ports{
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

	assert.Equal(service.VirtualServices, VirtualServices{
		VirtualService{
			Name:            "reviews",
			CreatedAt:       "2018-03-08T17:47:00+03:00",
			ResourceVersion: "1234",
			Hosts: []interface{}{
				"reviews",
			},
			Http: []interface{}{
				map[string]interface{}{
					"route": []interface{}{
						map[string]interface{}{
							"destination": map[string]interface{}{
								"name":   "reviews",
								"subset": "v2",
							},
							"weight": 50,
						},
						map[string]interface{}{
							"destination": map[string]interface{}{
								"name":   "reviews",
								"subset": "v3",
							},
							"weight": 50,
						},
					},
				},
			},
		},
		VirtualService{
			Name:            "ratings",
			CreatedAt:       "2018-03-08T17:47:00+03:00",
			ResourceVersion: "1234",
			Hosts: []interface{}{
				"reviews",
			},
			Http: []interface{}{
				map[string]interface{}{
					"match": []interface{}{
						map[string]interface{}{
							"headers": map[string]interface{}{
								"cookie": map[string]interface{}{
									"regex": "^(.*?;)?(user=jason)(;.*)?$",
								},
							},
						},
					},
					"fault": map[string]interface{}{
						"delay": map[string]interface{}{
							"percent":    100,
							"fixedDelay": "7s",
						},
					},
					"route": []interface{}{
						map[string]interface{}{
							"destination": map[string]interface{}{
								"name":   "ratings",
								"subset": "v1",
							},
						},
					},
				},
				map[string]interface{}{
					"route": []interface{}{
						map[string]interface{}{
							"destination": map[string]interface{}{
								"name":   "ratings",
								"subset": "v1",
							},
						},
					},
				},
			},
		},
	})

	assert.Equal(service.DestinationRules, DestinationRules{
		DestinationRule{
			Name:            "reviews-destination",
			CreatedAt:       "2018-03-08T17:47:00+03:00",
			ResourceVersion: "1234",
			Host:            "reviews",
			Subsets: []interface{}{
				map[string]interface{}{
					"name": "v1",
					"labels": map[string]interface{}{
						"version": "v1",
					},
				},
				map[string]interface{}{
					"name": "v2",
					"labels": map[string]interface{}{
						"version": "v2",
					},
				},
			},
		},
		DestinationRule{
			Name:            "bookinfo-ratings",
			CreatedAt:       "2018-03-08T17:47:00+03:00",
			ResourceVersion: "1234",
			Host:            "ratings",
			TrafficPolicy: map[string]interface{}{
				"loadBalancer": map[string]interface{}{
					"simple": "LEAST_CONN",
				},
			},
			Subsets: []interface{}{
				map[string]interface{}{
					"name": "testversion",
					"labels": map[string]interface{}{
						"version": "v3",
					},
					"trafficPolicy": map[string]interface{}{
						"loadBalancer": map[string]interface{}{
							"simple": "ROUND_ROBIN",
						},
					},
				},
			},
		},
	})

	assert.Equal(service.Dependencies, map[string][]SourceWorkload{
		"v1": {SourceWorkload{Name: "unknown", Namespace: "ns"}, SourceWorkload{Name: "products-v1", Namespace: "ns"}, SourceWorkload{Name: "reviews-v2", Namespace: "ns"}},
		"v2": {SourceWorkload{Name: "catalog-v1", Namespace: "ns"}, SourceWorkload{Name: "shares-v2", Namespace: "ns"}},
	})
}

func TestServiceParse(t *testing.T) {
	assert := assert.New(t)
	config.Set(config.NewConfig())

	service := Service{}
	service.Name = "service"
	service.Namespace = Namespace{Name: "namespace"}

	service.Parse(fakeService())
	assert.Equal("labelName1", service.Labels["label1"])
	assert.Equal("labelName2", service.Labels["label2"])
	assert.Equal("ClusterIP", service.Type)
	assert.Equal("127.0.0.9", service.Ip)
	assert.Equal("1234", service.ResourceVersion)

	assert.Equal("http", service.Ports[0].Name)
	assert.Equal("TCP", service.Ports[0].Protocol)
	assert.Equal(int32(3001), service.Ports[0].Port)

	assert.Equal("http", service.Ports[1].Name)
	assert.Equal("TCP", service.Ports[1].Protocol)
	assert.Equal(int32(3000), service.Ports[1].Port)
}

func fakeService() *v1.Service {
	t1, _ := time.Parse(time.RFC822Z, "08 Mar 18 17:44 +0300")

	return &v1.Service{
		ObjectMeta: meta_v1.ObjectMeta{
			Name:              "Name",
			Namespace:         "Namespace",
			CreationTimestamp: meta_v1.NewTime(t1),
			ResourceVersion:   "1234",
			Labels: map[string]string{
				"label1": "labelName1",
				"label2": "labelName2"}},
		Spec: v1.ServiceSpec{
			ClusterIP: "127.0.0.9",
			Type:      "ClusterIP",
			Ports: []v1.ServicePort{
				{
					Name:     "http",
					Protocol: "TCP",
					Port:     3001},
				{
					Name:     "http",
					Protocol: "TCP",
					Port:     3000}}}}
}

func fakeEndpoints() *v1.Endpoints {
	return &v1.Endpoints{
		Subsets: []v1.EndpointSubset{
			{
				Addresses: []v1.EndpointAddress{
					{
						IP: "172.17.0.9",
						TargetRef: &v1.ObjectReference{
							Kind: "Pod",
							Name: "recommendation-v1"}},
					{
						IP: "172.17.0.8",
						TargetRef: &v1.ObjectReference{
							Kind: "Pod",
							Name: "recommendation-v2"}},
				},
				Ports: []v1.EndpointPort{
					{Name: "http", Protocol: "TCP", Port: 3001},
					{Name: "http", Protocol: "TCP", Port: 3000},
				}}}}
}

func fakePods() []v1.Pod {
	t1, _ := time.Parse(time.RFC822Z, "08 Mar 18 17:44 +0300")
	t2, _ := time.Parse(time.RFC822Z, "08 Mar 18 17:45 +0300")

	return []v1.Pod{
		v1.Pod{
			ObjectMeta: meta_v1.ObjectMeta{
				Name:              "reviews-v1-1234",
				CreationTimestamp: meta_v1.NewTime(t1),
				Labels:            map[string]string{"apps": "reviews", "version": "v1"}}},
		v1.Pod{
			ObjectMeta: meta_v1.ObjectMeta{
				Name:              "reviews-v2-1234",
				CreationTimestamp: meta_v1.NewTime(t2),
				Labels:            map[string]string{"apps": "reviews", "version": "v2"}}},
	}
}

func fakeVirtualService() []kubernetes.IstioObject {
	t2, _ := time.Parse(time.RFC822Z, "08 Mar 18 17:47 +0300")

	virtualService1 := kubernetes.MockIstioObject{
		ObjectMeta: meta_v1.ObjectMeta{
			Name:              "reviews",
			CreationTimestamp: meta_v1.NewTime(t2),
			ResourceVersion:   "1234",
		},
		Spec: map[string]interface{}{
			"hosts": []interface{}{
				"reviews",
			},
			"http": []interface{}{
				map[string]interface{}{
					"route": []interface{}{
						map[string]interface{}{
							"destination": map[string]interface{}{
								"name":   "reviews",
								"subset": "v2",
							},
							"weight": 50,
						},
						map[string]interface{}{
							"destination": map[string]interface{}{
								"name":   "reviews",
								"subset": "v3",
							},
							"weight": 50,
						},
					},
				},
			},
		},
	}
	virtualService2 := kubernetes.MockIstioObject{
		ObjectMeta: meta_v1.ObjectMeta{
			Name:              "ratings",
			CreationTimestamp: meta_v1.NewTime(t2),
			ResourceVersion:   "1234",
		},
		Spec: map[string]interface{}{
			"hosts": []interface{}{
				"reviews",
			},
			"http": []interface{}{
				map[string]interface{}{
					"match": []interface{}{
						map[string]interface{}{
							"headers": map[string]interface{}{
								"cookie": map[string]interface{}{
									"regex": "^(.*?;)?(user=jason)(;.*)?$",
								},
							},
						},
					},
					"fault": map[string]interface{}{
						"delay": map[string]interface{}{
							"percent":    100,
							"fixedDelay": "7s",
						},
					},
					"route": []interface{}{
						map[string]interface{}{
							"destination": map[string]interface{}{
								"name":   "ratings",
								"subset": "v1",
							},
						},
					},
				},
				map[string]interface{}{
					"route": []interface{}{
						map[string]interface{}{
							"destination": map[string]interface{}{
								"name":   "ratings",
								"subset": "v1",
							},
						},
					},
				},
			},
		},
	}
	return []kubernetes.IstioObject{&virtualService1, &virtualService2}
}

func fakeDestinationRules() []kubernetes.IstioObject {
	t2, _ := time.Parse(time.RFC822Z, "08 Mar 18 17:47 +0300")

	destinationRule1 := kubernetes.MockIstioObject{
		ObjectMeta: meta_v1.ObjectMeta{
			Name:              "reviews-destination",
			CreationTimestamp: meta_v1.NewTime(t2),
			ResourceVersion:   "1234",
		},
		Spec: map[string]interface{}{
			"host": "reviews",
			"subsets": []interface{}{
				map[string]interface{}{
					"name": "v1",
					"labels": map[string]interface{}{
						"version": "v1",
					},
				},
				map[string]interface{}{
					"name": "v2",
					"labels": map[string]interface{}{
						"version": "v2",
					},
				},
			},
		},
	}
	destinationRule2 := kubernetes.MockIstioObject{
		ObjectMeta: meta_v1.ObjectMeta{
			Name:              "bookinfo-ratings",
			CreationTimestamp: meta_v1.NewTime(t2),
			ResourceVersion:   "1234",
		},
		Spec: map[string]interface{}{
			"host": "ratings",
			"trafficPolicy": map[string]interface{}{
				"loadBalancer": map[string]interface{}{
					"simple": "LEAST_CONN",
				},
			},
			"subsets": []interface{}{
				map[string]interface{}{
					"name": "testversion",
					"labels": map[string]interface{}{
						"version": "v3",
					},
					"trafficPolicy": map[string]interface{}{
						"loadBalancer": map[string]interface{}{
							"simple": "ROUND_ROBIN",
						},
					},
				},
			},
		},
	}

	return []kubernetes.IstioObject{&destinationRule1, &destinationRule2}
}

func fakeSourceWorkloads() map[string][]prometheus.Workload {
	return map[string][]prometheus.Workload{
		"v1": {{App: "unknown", Version: "unknown", Namespace: "ns", Workload: "unknown"},
			{App: "products", Version: "v1", Namespace: "ns", Workload: "products-v1"},
			{App: "reviews", Version: "v2", Namespace: "ns", Workload: "reviews-v2"}},
		"v2": {{App: "catalog", Version: "v1", Namespace: "ns", Workload: "catalog-v1"},
			{App: "shares", Version: "v2", Namespace: "ns", Workload: "shares-v2"}}}
}
