package kubernetes_test

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apps_v1 "k8s.io/api/apps/v1"
	core_v1 "k8s.io/api/core/v1"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
)

func TestKubeServiceHostsSingleService(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()

	services := []core_v1.Service{
		{
			ObjectMeta: meta_v1.ObjectMeta{Name: "reviews", Namespace: "bookinfo"},
			Spec: core_v1.ServiceSpec{
				Ports: []core_v1.ServicePort{
					{Name: "http", Protocol: core_v1.ProtocolTCP, Port: 9080},
				},
			},
		},
	}

	hosts := kubernetes.NewKubeServiceHosts(services, conf, nil)

	assert.True(hosts.HasHost("reviews.bookinfo.svc.cluster.local"))
	assert.True(hosts.HasHost("reviews.bookinfo.svc"))
	assert.True(hosts.HasHost("reviews.bookinfo"))
	assert.False(hosts.HasHost("reviews.other-ns.svc.cluster.local"))
}

func TestKubeServiceHostsMultipleServices(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()

	services := []core_v1.Service{
		{
			ObjectMeta: meta_v1.ObjectMeta{Name: "reviews", Namespace: "bookinfo"},
			Spec: core_v1.ServiceSpec{
				Ports: []core_v1.ServicePort{{Name: "http", Protocol: core_v1.ProtocolTCP, Port: 9080}},
			},
		},
		{
			ObjectMeta: meta_v1.ObjectMeta{Name: "ratings", Namespace: "bookinfo"},
			Spec: core_v1.ServiceSpec{
				Ports: []core_v1.ServicePort{
					{Name: "http", Protocol: core_v1.ProtocolTCP, Port: 9080},
					{Name: "grpc", Protocol: core_v1.ProtocolTCP, Port: 9081},
				},
			},
		},
		{
			ObjectMeta: meta_v1.ObjectMeta{Name: "details", Namespace: "other-ns"},
			Spec: core_v1.ServiceSpec{
				Ports: []core_v1.ServicePort{{Name: "http", Protocol: core_v1.ProtocolTCP, Port: 8080}},
			},
		},
	}

	hosts := kubernetes.NewKubeServiceHosts(services, conf, nil)

	assert.True(hosts.HasHost("reviews.bookinfo.svc.cluster.local"))
	assert.True(hosts.HasHost("ratings.bookinfo.svc.cluster.local"))
	assert.True(hosts.HasHost("details.other-ns.svc.cluster.local"))
	assert.False(hosts.HasHost("nonexistent.bookinfo.svc.cluster.local"))
}

func TestKubeServiceHostsEmptyInput(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()

	hosts := kubernetes.NewKubeServiceHosts([]core_v1.Service{}, conf, nil)

	assert.False(hosts.HasHost("anything"))
}

func TestKubeServiceHostsNoPorts(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()

	services := []core_v1.Service{
		{
			ObjectMeta: meta_v1.ObjectMeta{Name: "headless", Namespace: "bookinfo"},
			Spec:       core_v1.ServiceSpec{},
		},
	}

	hosts := kubernetes.NewKubeServiceHosts(services, conf, nil)

	assert.True(hosts.HasHost("headless.bookinfo.svc.cluster.local"))
}

func TestKubeServiceHostsCustomClusterDomain(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	conf.ExternalServices.Istio.IstioIdentityDomain = "svc.my-custom.domain"

	services := []core_v1.Service{
		{
			ObjectMeta: meta_v1.ObjectMeta{Name: "reviews", Namespace: "bookinfo"},
			Spec: core_v1.ServiceSpec{
				Ports: []core_v1.ServicePort{{Name: "http", Protocol: core_v1.ProtocolTCP, Port: 9080}},
			},
		},
	}

	hosts := kubernetes.NewKubeServiceHosts(services, conf, nil)

	assert.True(hosts.HasHost("reviews.bookinfo.svc.my-custom.domain"))
	assert.True(hosts.HasHost("reviews.bookinfo.svc"))
	assert.True(hosts.HasHost("reviews.bookinfo"))
	assert.False(hosts.HasHost("reviews.bookinfo.svc.cluster.local"))
}

func TestKubeServiceHostsNoExportToVisibleEverywhere(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()

	services := []core_v1.Service{
		{
			ObjectMeta: meta_v1.ObjectMeta{Name: "reviews", Namespace: "bookinfo"},
			Spec: core_v1.ServiceSpec{
				Ports: []core_v1.ServicePort{{Name: "http", Protocol: core_v1.ProtocolTCP, Port: 9080}},
			},
		},
	}

	hosts := kubernetes.NewKubeServiceHosts(services, conf, nil)

	assert.True(hosts.IsValidForNamespace("reviews.bookinfo.svc.cluster.local", "bookinfo"))
	assert.True(hosts.IsValidForNamespace("reviews.bookinfo.svc.cluster.local", "other-ns"))
	assert.True(hosts.IsValidForNamespace("reviews.bookinfo.svc.cluster.local", "istio-system"))
}

func TestKubeServiceHostsExportToStar(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()

	services := []core_v1.Service{
		{
			ObjectMeta: meta_v1.ObjectMeta{
				Name:        "reviews",
				Namespace:   "bookinfo",
				Annotations: map[string]string{kubernetes.ExportToAnnotation: "*"},
			},
			Spec: core_v1.ServiceSpec{
				Ports: []core_v1.ServicePort{{Name: "http", Protocol: core_v1.ProtocolTCP, Port: 9080}},
			},
		},
	}

	hosts := kubernetes.NewKubeServiceHosts(services, conf, nil)

	assert.True(hosts.IsValidForNamespace("reviews.bookinfo.svc.cluster.local", "bookinfo"))
	assert.True(hosts.IsValidForNamespace("reviews.bookinfo.svc.cluster.local", "other-ns"))
}

func TestKubeServiceHostsExportToDot(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()

	services := []core_v1.Service{
		{
			ObjectMeta: meta_v1.ObjectMeta{
				Name:        "reviews",
				Namespace:   "bookinfo",
				Annotations: map[string]string{kubernetes.ExportToAnnotation: "."},
			},
			Spec: core_v1.ServiceSpec{
				Ports: []core_v1.ServicePort{{Name: "http", Protocol: core_v1.ProtocolTCP, Port: 9080}},
			},
		},
	}

	hosts := kubernetes.NewKubeServiceHosts(services, conf, nil)

	assert.True(hosts.IsValidForNamespace("reviews.bookinfo.svc.cluster.local", "bookinfo"))
	assert.False(hosts.IsValidForNamespace("reviews.bookinfo.svc.cluster.local", "other-ns"))
	assert.True(hosts.IsValidForNamespace("reviews.bookinfo.svc", "bookinfo"))
	assert.False(hosts.IsValidForNamespace("reviews.bookinfo.svc", "other-ns"))
	assert.True(hosts.IsValidForNamespace("reviews.bookinfo", "bookinfo"))
	assert.False(hosts.IsValidForNamespace("reviews.bookinfo", "other-ns"))
}

func TestKubeServiceHostsExportToTilde(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()

	services := []core_v1.Service{
		{
			ObjectMeta: meta_v1.ObjectMeta{
				Name:        "reviews",
				Namespace:   "bookinfo",
				Annotations: map[string]string{kubernetes.ExportToAnnotation: "~"},
			},
			Spec: core_v1.ServiceSpec{
				Ports: []core_v1.ServicePort{{Name: "http", Protocol: core_v1.ProtocolTCP, Port: 9080}},
			},
		},
	}

	hosts := kubernetes.NewKubeServiceHosts(services, conf, nil)

	assert.True(hosts.HasHost("reviews.bookinfo.svc.cluster.local"))
	assert.False(hosts.IsValidForNamespace("reviews.bookinfo.svc.cluster.local", "bookinfo"))
	assert.False(hosts.IsValidForNamespace("reviews.bookinfo.svc.cluster.local", "other-ns"))
}

func TestKubeServiceHostsExportToSpecificNamespaces(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()

	services := []core_v1.Service{
		{
			ObjectMeta: meta_v1.ObjectMeta{
				Name:        "reviews",
				Namespace:   "bookinfo",
				Annotations: map[string]string{kubernetes.ExportToAnnotation: "bookinfo,istio-system"},
			},
			Spec: core_v1.ServiceSpec{
				Ports: []core_v1.ServicePort{{Name: "http", Protocol: core_v1.ProtocolTCP, Port: 9080}},
			},
		},
	}

	hosts := kubernetes.NewKubeServiceHosts(services, conf, nil)

	assert.True(hosts.IsValidForNamespace("reviews.bookinfo.svc.cluster.local", "bookinfo"))
	assert.True(hosts.IsValidForNamespace("reviews.bookinfo.svc.cluster.local", "istio-system"))
	assert.False(hosts.IsValidForNamespace("reviews.bookinfo.svc.cluster.local", "other-ns"))
}

func TestKubeServiceHostsExportToDotAndNamespace(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()

	services := []core_v1.Service{
		{
			ObjectMeta: meta_v1.ObjectMeta{
				Name:        "reviews",
				Namespace:   "bookinfo",
				Annotations: map[string]string{kubernetes.ExportToAnnotation: ".,istio-system"},
			},
			Spec: core_v1.ServiceSpec{
				Ports: []core_v1.ServicePort{{Name: "http", Protocol: core_v1.ProtocolTCP, Port: 9080}},
			},
		},
	}

	hosts := kubernetes.NewKubeServiceHosts(services, conf, nil)

	assert.True(hosts.IsValidForNamespace("reviews.bookinfo.svc.cluster.local", "bookinfo"))
	assert.True(hosts.IsValidForNamespace("reviews.bookinfo.svc.cluster.local", "istio-system"))
	assert.False(hosts.IsValidForNamespace("reviews.bookinfo.svc.cluster.local", "other-ns"))
}

func TestKubeServiceHostsExportToNonexistentHost(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()

	hosts := kubernetes.NewKubeServiceHosts([]core_v1.Service{}, conf, nil)

	assert.False(hosts.IsValidForNamespace("nonexistent.bookinfo.svc.cluster.local", "bookinfo"))
}

func TestKubeServiceHostsExportToWhitespaceHandling(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()

	services := []core_v1.Service{
		{
			ObjectMeta: meta_v1.ObjectMeta{
				Name:        "reviews",
				Namespace:   "bookinfo",
				Annotations: map[string]string{kubernetes.ExportToAnnotation: " . , istio-system "},
			},
			Spec: core_v1.ServiceSpec{
				Ports: []core_v1.ServicePort{{Name: "http", Protocol: core_v1.ProtocolTCP, Port: 9080}},
			},
		},
	}

	hosts := kubernetes.NewKubeServiceHosts(services, conf, nil)

	assert.True(hosts.IsValidForNamespace("reviews.bookinfo.svc.cluster.local", "bookinfo"))
	assert.True(hosts.IsValidForNamespace("reviews.bookinfo.svc.cluster.local", "istio-system"))
	assert.False(hosts.IsValidForNamespace("reviews.bookinfo.svc.cluster.local", "other-ns"))
}

func TestKubeServiceHostsMeshDefaultDotRestrictsToOwnNamespace(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()

	services := []core_v1.Service{
		{
			ObjectMeta: meta_v1.ObjectMeta{Name: "reviews", Namespace: "bookinfo"},
			Spec: core_v1.ServiceSpec{
				Ports: []core_v1.ServicePort{{Name: "http", Protocol: core_v1.ProtocolTCP, Port: 9080}},
			},
		},
	}

	hosts := kubernetes.NewKubeServiceHosts(services, conf, []string{"."})

	assert.True(hosts.IsValidForNamespace("reviews.bookinfo.svc.cluster.local", "bookinfo"))
	assert.False(hosts.IsValidForNamespace("reviews.bookinfo.svc.cluster.local", "other-ns"))
	assert.False(hosts.IsValidForNamespace("reviews.bookinfo.svc.cluster.local", "istio-system"))
}

func TestKubeServiceHostsMeshDefaultStarVisibleEverywhere(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()

	services := []core_v1.Service{
		{
			ObjectMeta: meta_v1.ObjectMeta{Name: "reviews", Namespace: "bookinfo"},
			Spec: core_v1.ServiceSpec{
				Ports: []core_v1.ServicePort{{Name: "http", Protocol: core_v1.ProtocolTCP, Port: 9080}},
			},
		},
	}

	hosts := kubernetes.NewKubeServiceHosts(services, conf, []string{"*"})

	assert.True(hosts.IsValidForNamespace("reviews.bookinfo.svc.cluster.local", "bookinfo"))
	assert.True(hosts.IsValidForNamespace("reviews.bookinfo.svc.cluster.local", "other-ns"))
}

func TestKubeServiceHostsAnnotationOverridesMeshDefault(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()

	services := []core_v1.Service{
		{
			ObjectMeta: meta_v1.ObjectMeta{
				Name:        "reviews",
				Namespace:   "bookinfo",
				Annotations: map[string]string{kubernetes.ExportToAnnotation: "*"},
			},
			Spec: core_v1.ServiceSpec{
				Ports: []core_v1.ServicePort{{Name: "http", Protocol: core_v1.ProtocolTCP, Port: 9080}},
			},
		},
	}

	hosts := kubernetes.NewKubeServiceHosts(services, conf, []string{"."})

	assert.True(hosts.IsValidForNamespace("reviews.bookinfo.svc.cluster.local", "bookinfo"))
	assert.True(hosts.IsValidForNamespace("reviews.bookinfo.svc.cluster.local", "other-ns"))
}

func TestKubeServiceHostsNilMeshDefaultVisibleEverywhere(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()

	services := []core_v1.Service{
		{
			ObjectMeta: meta_v1.ObjectMeta{Name: "reviews", Namespace: "bookinfo"},
			Spec: core_v1.ServiceSpec{
				Ports: []core_v1.ServicePort{{Name: "http", Protocol: core_v1.ProtocolTCP, Port: 9080}},
			},
		},
	}

	hosts := kubernetes.NewKubeServiceHosts(services, conf, nil)

	assert.True(hosts.IsValidForNamespace("reviews.bookinfo.svc.cluster.local", "bookinfo"))
	assert.True(hosts.IsValidForNamespace("reviews.bookinfo.svc.cluster.local", "other-ns"))
	assert.True(hosts.IsValidForNamespace("reviews.bookinfo.svc.cluster.local", "istio-system"))
}

func TestGetClusterInfoFromIstiod(t *testing.T) {
	require := require.New(t)
	assert := assert.New(t)

	conf := config.NewConfig()
	k8s := kubetest.NewFakeK8sClient(
		kubetest.FakeNamespace("istio-system"),
		&apps_v1.Deployment{
			ObjectMeta: meta_v1.ObjectMeta{
				Name:      "istiod",
				Namespace: "istio-system",
				Labels:    map[string]string{"app": "istiod"},
			},
			Spec: apps_v1.DeploymentSpec{
				Template: core_v1.PodTemplateSpec{
					Spec: core_v1.PodSpec{
						Containers: []core_v1.Container{
							{
								Name: "istiod",
								Env: []core_v1.EnvVar{
									{
										Name:  "CLUSTER_ID",
										Value: "east",
									},
								},
							},
						},
					},
				},
			},
		},
	)
	clusterID, err := kubernetes.ClusterNameFromIstiod(conf, k8s)
	require.NoError(err)

	assert.Equal("east", clusterID)
}

func TestGetClusterInfoFromIstiodFails(t *testing.T) {
	require := require.New(t)

	conf := config.NewConfig()
	k8s := kubetest.NewFakeK8sClient(
		kubetest.FakeNamespace("istio-system"),
		&apps_v1.Deployment{
			ObjectMeta: meta_v1.ObjectMeta{
				Name:      "istiod",
				Namespace: "istio-system",
				Labels:    map[string]string{"app": "istiod"},
			},
			Spec: apps_v1.DeploymentSpec{
				Template: core_v1.PodTemplateSpec{
					Spec: core_v1.PodSpec{
						Containers: []core_v1.Container{
							{
								Name: "istiod",
								Env:  []core_v1.EnvVar{},
							},
						},
					},
				},
			},
		},
	)
	_, err := kubernetes.ClusterNameFromIstiod(conf, k8s)
	require.Error(err)
}
