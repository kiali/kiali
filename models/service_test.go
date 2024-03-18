package models

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"

	core_v1 "k8s.io/api/core/v1"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kiali/kiali/config"
)

func TestServiceDetailParsing(t *testing.T) {
	assert := assert.New(t)
	config.Set(config.NewConfig())

	service := ServiceDetails{}
	service.SetService(config.DefaultClusterID, fakeService())
	service.SetEndpoints(fakeEndpoints())
	service.SetPods(fakePods())
	service.SetIstioSidecar(fakeWorkloads())

	// Kubernetes Details

	assert.Equal(service.Service.Name, "Name")
	assert.Equal(service.Service.Namespace.Cluster, config.DefaultClusterID)
	assert.Equal(service.Service.Namespace.Name, "Namespace")
	assert.Equal(service.Service.CreatedAt, "2018-03-08T14:44:00Z")
	assert.Equal(service.Service.ResourceVersion, "1234")
	assert.Equal(service.Service.Type, "ClusterIP")
	assert.Equal(service.Service.Ip, "127.0.0.9")
	assert.Equal(service.Service.Labels, map[string]string{"label1": "labelName1", "label2": "labelName2"})
	assert.Equal(service.IstioSidecar, true)
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
}

func TestServiceParse(t *testing.T) {
	assert := assert.New(t)
	config.Set(config.NewConfig())

	service := Service{}
	service.Name = "service"
	service.Namespace = Namespace{Cluster: config.DefaultClusterID, Name: "namespace"}

	service.Parse(config.DefaultClusterID, fakeService())
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

func fakeService() *core_v1.Service {
	t1, _ := time.Parse(time.RFC822Z, "08 Mar 18 17:44 +0300")

	return &core_v1.Service{
		ObjectMeta: meta_v1.ObjectMeta{
			Name:              "Name",
			Namespace:         "Namespace",
			CreationTimestamp: meta_v1.NewTime(t1),
			ResourceVersion:   "1234",
			Labels: map[string]string{
				"label1": "labelName1",
				"label2": "labelName2"}},
		Spec: core_v1.ServiceSpec{
			ClusterIP: "127.0.0.9",
			Type:      "ClusterIP",
			Ports: []core_v1.ServicePort{
				{
					Name:     "http",
					Protocol: "TCP",
					Port:     3001},
				{
					Name:     "http",
					Protocol: "TCP",
					Port:     3000}}}}
}

func fakeEndpoints() *core_v1.Endpoints {
	return &core_v1.Endpoints{
		Subsets: []core_v1.EndpointSubset{
			{
				Addresses: []core_v1.EndpointAddress{
					{
						IP: "172.17.0.9",
						TargetRef: &core_v1.ObjectReference{
							Kind: "Pod",
							Name: "recommendation-v1"}},
					{
						IP: "172.17.0.8",
						TargetRef: &core_v1.ObjectReference{
							Kind: "Pod",
							Name: "recommendation-v2"}},
				},
				Ports: []core_v1.EndpointPort{
					{Name: "http", Protocol: "TCP", Port: 3001},
					{Name: "http", Protocol: "TCP", Port: 3000},
				}}}}
}

func fakePods() []core_v1.Pod {
	t1, _ := time.Parse(time.RFC822Z, "08 Mar 18 17:44 +0300")
	t2, _ := time.Parse(time.RFC822Z, "08 Mar 18 17:45 +0300")

	return []core_v1.Pod{
		{
			ObjectMeta: meta_v1.ObjectMeta{
				Name:              "reviews-v1-1234",
				CreationTimestamp: meta_v1.NewTime(t1),
				Labels:            map[string]string{"apps": "reviews", "version": "v1"}}},
		{
			ObjectMeta: meta_v1.ObjectMeta{
				Name:              "reviews-v2-1234",
				CreationTimestamp: meta_v1.NewTime(t2),
				Labels:            map[string]string{"apps": "reviews", "version": "v2"}}},
	}
}

func fakeWorkloads() WorkloadOverviews {
	wo := WorkloadOverviews{}
	w1 := &WorkloadListItem{IstioSidecar: false}
	w2 := &WorkloadListItem{IstioSidecar: true}
	wo = append(wo, w1)
	wo = append(wo, w2)
	return wo
}
