package models

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	core_v1 "k8s.io/api/core/v1"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kiali/kiali/config"
)

func fakeIsControlPlane(c, n string) bool { return false }

func TestPodFullyParsing(t *testing.T) {
	assert := assert.New(t)
	config.Set(config.NewConfig())
	t1, _ := time.Parse(time.RFC822Z, "08 Mar 18 17:44 +0300")
	k8sPod := core_v1.Pod{
		ObjectMeta: meta_v1.ObjectMeta{
			Name:              "details-v1-3618568057-dnkjp",
			CreationTimestamp: meta_v1.NewTime(t1),
			Labels:            map[string]string{"apps": "details", "version": "v1"},
			OwnerReferences: []meta_v1.OwnerReference{{
				Kind: "ReplicaSet",
				Name: "details-v1-3618568057",
			}},
			Annotations: map[string]string{"sidecar.istio.io/status": "{\"version\":\"\",\"initContainers\":[\"istio-init\",\"enable-core-dump\"],\"containers\":[\"istio-proxy\"],\"volumes\":[\"istio-envoy\",\"istio-certs\"]}"}},
		Spec: core_v1.PodSpec{
			Containers: []core_v1.Container{
				{Name: "details", Image: "whatever"},
				{Name: "istio-proxy", Image: "docker.io/istio/proxy:0.7.1"},
			},
			InitContainers: []core_v1.Container{
				{Name: "istio-init", Image: "docker.io/istio/proxy_init:0.7.1"},
				{Name: "enable-core-dump", Image: "alpine"},
			},
		}}

	pod := Pod{}
	pod.Parse(&k8sPod, fakeIsControlPlane)
	assert.Equal("details-v1-3618568057-dnkjp", pod.Name)
	assert.Equal("2018-03-08T14:44:00Z", pod.CreatedAt)
	assert.Equal(map[string]string{"apps": "details", "version": "v1"}, pod.Labels)
	assert.Equal([]Reference{{Name: "details-v1-3618568057", Kind: "ReplicaSet"}}, pod.CreatedBy)
	assert.Len(pod.IstioContainers, 1)
	assert.Equal("istio-proxy", pod.IstioContainers[0].Name)
	assert.Equal("docker.io/istio/proxy:0.7.1", pod.IstioContainers[0].Image)
	assert.Len(pod.IstioInitContainers, 2)
	assert.Equal("istio-init", pod.IstioInitContainers[0].Name)
	assert.Equal("docker.io/istio/proxy_init:0.7.1", pod.IstioInitContainers[0].Image)
	assert.Equal("enable-core-dump", pod.IstioInitContainers[1].Name)
	assert.Equal("alpine", pod.IstioInitContainers[1].Image)
}

func TestPodParsingMissingImage(t *testing.T) {
	assert := assert.New(t)
	config.Set(config.NewConfig())
	t1, _ := time.Parse(time.RFC822Z, "08 Mar 18 17:44 +0300")
	k8sPod := core_v1.Pod{
		ObjectMeta: meta_v1.ObjectMeta{
			Name:              "details-v1-3618568057-dnkjp",
			CreationTimestamp: meta_v1.NewTime(t1),
			Labels:            map[string]string{"apps": "details", "version": "v1"},
			OwnerReferences: []meta_v1.OwnerReference{{
				Kind: "ReplicaSet",
				Name: "details-v1-3618568057",
			}},
			Annotations: map[string]string{"sidecar.istio.io/status": "{\"version\":\"\",\"initContainers\":[\"istio-init\",\"enable-core-dump\"],\"containers\":[\"istio-proxy\"],\"volumes\":[\"istio-envoy\",\"istio-certs\"]}"}},
	}

	pod := Pod{}
	pod.Parse(&k8sPod, fakeIsControlPlane)
	assert.Equal("details-v1-3618568057-dnkjp", pod.Name)
	assert.Equal("2018-03-08T14:44:00Z", pod.CreatedAt)
	assert.Equal(map[string]string{"apps": "details", "version": "v1"}, pod.Labels)
	assert.Equal([]Reference{{Name: "details-v1-3618568057", Kind: "ReplicaSet"}}, pod.CreatedBy)
	assert.Len(pod.IstioContainers, 1)
	assert.Equal("istio-proxy", pod.IstioContainers[0].Name)
	assert.Equal("", pod.IstioContainers[0].Image)
	assert.Len(pod.IstioInitContainers, 2)
	assert.Equal("istio-init", pod.IstioInitContainers[0].Name)
	assert.Equal("", pod.IstioInitContainers[0].Image)
	assert.Equal("enable-core-dump", pod.IstioInitContainers[1].Name)
	assert.Equal("", pod.IstioInitContainers[1].Image)
}

func TestPodParsingMissingAnnotations(t *testing.T) {
	assert := assert.New(t)
	config.Set(config.NewConfig())
	t1, _ := time.Parse(time.RFC822Z, "08 Mar 18 17:44 +0300")
	k8sPod := core_v1.Pod{
		ObjectMeta: meta_v1.ObjectMeta{
			Name:              "details-v1-3618568057-dnkjp",
			CreationTimestamp: meta_v1.NewTime(t1),
			Labels:            map[string]string{"apps": "details", "version": "v1"},
		}}

	pod := Pod{}
	pod.Parse(&k8sPod, fakeIsControlPlane)
	assert.Equal("details-v1-3618568057-dnkjp", pod.Name)
	assert.Equal("2018-03-08T14:44:00Z", pod.CreatedAt)
	assert.Equal(map[string]string{"apps": "details", "version": "v1"}, pod.Labels)
	assert.Empty(pod.CreatedBy)
	assert.Len(pod.IstioContainers, 0)
	assert.Len(pod.IstioInitContainers, 0)
}

func TestPodParsingInvalidAnnotations(t *testing.T) {
	assert := assert.New(t)
	config.Set(config.NewConfig())
	t1, _ := time.Parse(time.RFC822Z, "08 Mar 18 17:44 +0300")
	k8sPod := core_v1.Pod{
		ObjectMeta: meta_v1.ObjectMeta{
			Name:              "details-v1-3618568057-dnkjp",
			CreationTimestamp: meta_v1.NewTime(t1),
			Labels:            map[string]string{"apps": "details", "version": "v1"},
			Annotations:       map[string]string{"sidecar.istio.io/status": "{\"version\":\"\",\"initContainers\":[{\"badkey\": \"Ooops! Not expected!\"}]}"}},
	}

	pod := Pod{}
	pod.Parse(&k8sPod, fakeIsControlPlane)
	assert.Equal("details-v1-3618568057-dnkjp", pod.Name)
	assert.Equal("2018-03-08T14:44:00Z", pod.CreatedAt)
	assert.Equal(map[string]string{"apps": "details", "version": "v1"}, pod.Labels)
	assert.Empty(pod.CreatedBy)
	assert.Len(pod.IstioContainers, 0)
	assert.Len(pod.IstioInitContainers, 0)
}

func TestSyncedPodProxiesCount(t *testing.T) {
	assert := assert.New(t)
	config.Set(config.NewConfig())

	t1, _ := time.Parse(time.RFC822Z, "08 Mar 18 17:44 +0300")
	k8sPod := core_v1.Pod{
		ObjectMeta: meta_v1.ObjectMeta{
			Name:              "details-v1-3618568057-dnkjp",
			CreationTimestamp: meta_v1.NewTime(t1),
			Labels:            map[string]string{"apps": "details", "version": "v1"},
			OwnerReferences: []meta_v1.OwnerReference{{
				Kind: "ReplicaSet",
				Name: "details-v1-3618568057",
			}},
			Annotations: map[string]string{"sidecar.istio.io/status": "{\"version\":\"\",\"initContainers\":[\"istio-init\",\"enable-core-dump\"],\"containers\":[\"istio-proxy\"],\"volumes\":[\"istio-envoy\",\"istio-certs\"]}"}},
		Spec: core_v1.PodSpec{
			Containers: []core_v1.Container{
				{Name: "details", Image: "whatever"},
				{Name: "istio-proxy", Image: "docker.io/istio/proxy:0.7.1"},
			},
			InitContainers: []core_v1.Container{
				{Name: "istio-init", Image: "docker.io/istio/proxy_init:0.7.1"},
				{Name: "enable-core-dump", Image: "alpine"},
			},
		}}

	pods := make(Pods, 0, 2)
	pod := &Pod{}
	pod.Parse(&k8sPod, fakeIsControlPlane)
	pod.ProxyStatus = &ProxyStatus{
		CDS: "Synced",
		EDS: "Synced",
		LDS: "Synced",
		RDS: "Synced",
	}
	pods = append(pods, pod)
	pods = append(pods, pod)

	assert.Equal(int32(2), pods.SyncedPodProxiesCount())

	k8sPod = core_v1.Pod{
		ObjectMeta: meta_v1.ObjectMeta{
			Name:              "details-v1-3618568057-dnkjp",
			CreationTimestamp: meta_v1.NewTime(t1),
			Labels:            map[string]string{"apps": "details", "version": "v1"},
			Annotations:       map[string]string{"sidecar.istio.io/status": "{\"version\":\"\",\"initContainers\":[{\"badkey\": \"Ooops! Not expected!\"}]}"}},
	}

	pods = make(Pods, 0, 2)
	pod = &Pod{}
	pod.Parse(&k8sPod, fakeIsControlPlane)
	pods = append(pods, pod)
	pods = append(pods, pod)
	assert.Equal(int32(-1), pods.SyncedPodProxiesCount())
}

func TestServiceNames(t *testing.T) {
	pods := Pods{
		{
			Name:               "details-1282912-shgf",
			ServiceAccountName: "bookinfo-details",
		},
		{
			Name:               "details-1282912-hsua8",
			ServiceAccountName: "bookinfo-details",
		},
		{
			Name:               "rating-1282912-2abj",
			ServiceAccountName: "bookinfo-rating",
		},
		{
			Name:               "rating-1282912-acnd",
			ServiceAccountName: "bookinfo-rating",
		},
		{
			Name:               "productpage-1282912-acnd",
			ServiceAccountName: "bookinfo-productpage",
		},
	}

	a := assert.New(t)
	a.ElementsMatch([]string{"bookinfo-details", "bookinfo-productpage", "bookinfo-rating"}, pods.ServiceAccounts())
}
