package models

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	api_networking_v1 "istio.io/api/networking/v1"
	networking_v1 "istio.io/client-go/pkg/apis/networking/v1"
	core_v1 "k8s.io/api/core/v1"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kiali/kiali/config"
)

func TestParseServiceEntryService(t *testing.T) {
	assert := assert.New(t)

	se := fakeServiceEntry("external-api.example.com", "bookinfo",
		map[string]string{"app": "external-api"},
		[]fakePort{{Name: "http", Number: 80, Protocol: "HTTP"}, {Name: "https", Number: 443, Protocol: "HTTPS"}},
	)

	svc := Service{}
	svc.ParseServiceEntryService("east", se, "external-api.example.com")

	assert.Equal("east", svc.Cluster)
	assert.Equal("external-api.example.com", svc.Name)
	assert.Equal("bookinfo", svc.Namespace)
	assert.Equal("External", svc.Type)
	assert.Equal(map[string]string{"app": "external-api"}, svc.Labels)
	assert.Equal(map[string]string{}, svc.HealthAnnotations)
	assert.Len(svc.Ports, 2)
	assert.Equal("http", svc.Ports[0].Name)
	assert.Equal(int32(80), svc.Ports[0].Port)
	assert.Equal("HTTP", svc.Ports[0].Protocol)
	assert.Equal("https", svc.Ports[1].Name)
	assert.Equal(int32(443), svc.Ports[1].Port)
	assert.Equal("HTTPS", svc.Ports[1].Protocol)
}

func TestParseServiceEntryServiceMultiHost(t *testing.T) {
	assert := assert.New(t)

	se := fakeServiceEntry("api-v1.example.com", "bookinfo",
		map[string]string{"app": "api"},
		[]fakePort{{Name: "http", Number: 80, Protocol: "HTTP"}},
	)
	se.Spec.Hosts = append(se.Spec.Hosts, "api-v2.example.com", "api-v3.example.com")

	svc := Service{}
	svc.ParseServiceEntryService("west", se, "api-v2.example.com")

	assert.Equal("api-v2.example.com", svc.Name)
	assert.Equal("bookinfo", svc.Namespace)
}

func TestParseServiceEntryServiceNilSE(t *testing.T) {
	svc := Service{Name: "untouched"}
	svc.ParseServiceEntryService("east", nil, "anything")

	assert.Equal(t, "untouched", svc.Name)
}

func TestParseServiceEntryServiceNoPorts(t *testing.T) {
	assert := assert.New(t)

	se := fakeServiceEntry("external-api.example.com", "bookinfo", nil, nil)

	svc := Service{}
	svc.ParseServiceEntryService("east", se, "external-api.example.com")

	assert.Equal("external-api.example.com", svc.Name)
	assert.Empty(svc.Ports)
	assert.Equal("External", svc.Type)
}

func TestServiceDetailParsing(t *testing.T) {
	assert := assert.New(t)
	config.Set(config.NewConfig())

	service := ServiceDetails{}
	service.SetService(config.DefaultClusterID, fakeService(), config.Get())
	service.SetPods(fakePods(), fakeIsControlPlane)
	service.SetIstioSidecar(fakeWorkloads())

	// Kubernetes Details

	assert.Equal(service.Service.Name, "Name")
	assert.Equal(service.Service.Cluster, config.DefaultClusterID)
	assert.Equal(service.Service.Namespace, "Namespace")
	assert.Equal(service.Service.CreatedAt, "2018-03-08T14:44:00Z")
	assert.Equal(service.Service.ResourceVersion, "1234")
	assert.Equal(service.Service.Type, "ClusterIP")
	assert.Equal(service.Service.Ip, "127.0.0.9")
	assert.Equal(service.Service.Labels, map[string]string{"label1": "labelName1", "label2": "labelName2"})
	assert.Equal(service.IstioSidecar, true)
	assert.Equal(service.Service.Ports, Ports{
		Port{Name: "http", Protocol: "TCP", Port: 3001},
		Port{Name: "http", Protocol: "TCP", Port: 3000}})
}

func TestServiceParse(t *testing.T) {
	assert := assert.New(t)
	config.Set(config.NewConfig())

	service := Service{}
	service.Cluster = config.DefaultClusterID
	service.Name = "service"
	service.Namespace = "namespace"

	service.Parse(config.DefaultClusterID, fakeService(), config.Get())
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

type fakePort struct {
	Name     string
	Number   uint32
	Protocol string
}

func fakeServiceEntry(host, namespace string, labels map[string]string, ports []fakePort) *networking_v1.ServiceEntry {
	sePorts := make([]*api_networking_v1.ServicePort, 0, len(ports))
	for _, p := range ports {
		sePorts = append(sePorts, &api_networking_v1.ServicePort{
			Name:     p.Name,
			Number:   p.Number,
			Protocol: p.Protocol,
		})
	}
	return &networking_v1.ServiceEntry{
		ObjectMeta: meta_v1.ObjectMeta{
			Name:      host,
			Namespace: namespace,
			Labels:    labels,
		},
		Spec: api_networking_v1.ServiceEntry{
			Hosts: []string{host},
			Ports: sePorts,
		},
	}
}
