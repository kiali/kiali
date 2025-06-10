package istio_test

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"slices"
	"strings"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"golang.org/x/exp/maps"
	admissionregistrationv1 "k8s.io/api/admissionregistration/v1"
	apps_v1 "k8s.io/api/apps/v1"
	authv1 "k8s.io/api/authorization/v1"
	core_v1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/client-go/rest"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/cache"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/istio"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tests/testutils"
	"github.com/kiali/kiali/util/slicetest"
)

func FakeCertificateConfigMap(namespace string) *core_v1.ConfigMap {
	return &core_v1.ConfigMap{
		ObjectMeta: v1.ObjectMeta{
			Name:      "istio-ca-root-cert",
			Namespace: namespace,
		},
		Data: map[string]string{
			"root-cert.pem": `-----BEGIN CERTIFICATE-----
MIIC/DCCAeSgAwIBAgIQVv6mINjF1kQJS2O98zkkNzANBgkqhkiG9w0BAQsFADAY
MRYwFAYDVQQKEw1jbHVzdGVyLmxvY2FsMB4XDTIxMDcyNzE0MzcwMFoXDTMxMDcy
NTE0MzcwMFowGDEWMBQGA1UEChMNY2x1c3Rlci5sb2NhbDCCASIwDQYJKoZIhvcN
AQEBBQADggEPADCCAQoCggEBAMwHN+LAkWbC9qyAlXQ4Zwn+Yhgc4eCPuw9LQVjW
b9al44H5sV/1QIog8wOjDHx32k2lTXvdxRgOJd+ENXMQ9DmU6C9oeWhMZAmAvp4M
NBaYnY4BRcWAPqIhEb/26zRA9pXjPVJX+aN45R1EJWsJxP6ZPkmZZKILnYY6VwqU
wbbB3lp34HQruvkpePUo4Bux+N+DfQsu1g/C6UMbQlY/kl1d1KaTS4bYQAP1d4eT
sPxw5Rf9WRSQcGaAWiPbUxVBtA0LYCbHzOacAAwvYhJgvbinr73RiqKUMR5BV/p3
lyKyVDyrVXXbVNsQhsT/lM5e55DaQEJKyldgklSGseVYHy0CAwEAAaNCMEAwDgYD
VR0PAQH/BAQDAgIEMA8GA1UdEwEB/wQFMAMBAf8wHQYDVR0OBBYEFK7ZOPXlxd78
xUpOGYDaqgC/sdevMA0GCSqGSIb3DQEBCwUAA4IBAQACLa2gNuIxQWf4qiCxsbIj
qddqbjHBGOWVAcyFRk/k7ydmellkI5BcMJEhlPT7TBUutcjvX8lCsup+xGy47NpH
hRp4hxUYodGXLXQ2HfI+3CgAARBEIBXjh/73UDFcMtH/G6EtGfFEw8ZgbyaDQ9Ft
c10h5QnbMUBFWdmvwSFvbJwZoTlFM+skogwv+d55sujZS83jbZHs7lZlDy0hDYIm
tMAWt4FEJnLPrfFtCFJgddiXDYGtX/Apvqac2riSAFg8mQB5WRtxKH7TK9Qhvca7
V/InYncUvcXt0M4JJSUJi/u6VBKSYYDIHt3mk9Le2qlMQuHkOQ1ZcuEOM2CU/KtO
-----END CERTIFICATE-----`,
		},
	}
}

func fakeIstiodDeployment(cluster string, manageExternal bool) *apps_v1.Deployment {
	deployment := &apps_v1.Deployment{
		ObjectMeta: v1.ObjectMeta{
			Name:      "istiod",
			Namespace: "istio-system",
			Labels: map[string]string{
				"app":                     "istiod",
				config.IstioRevisionLabel: "default",
			},
		},
		Spec: apps_v1.DeploymentSpec{
			Template: core_v1.PodTemplateSpec{
				Spec: core_v1.PodSpec{
					Containers: []core_v1.Container{
						{
							Name: "discovery",
							Env: []core_v1.EnvVar{
								{
									Name:  "CLUSTER_ID",
									Value: cluster,
								},
							},
						},
					},
				},
			},
		},
	}
	if manageExternal {
		deployment.Spec.Template.Spec.Containers[0].Env = append(deployment.Spec.Template.Spec.Containers[0].Env, core_v1.EnvVar{
			Name:  "EXTERNAL_ISTIOD",
			Value: "true",
		})
	}
	return deployment
}

func TestGetClustersResolvesTheKialiCluster(t *testing.T) {
	assert := assert.New(t)
	require := require.New(t)

	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "KialiCluster"

	istioDeploymentMock := apps_v1.Deployment{
		ObjectMeta: v1.ObjectMeta{
			Name:      "istiod",
			Namespace: "istio-system",
		},
		Spec: apps_v1.DeploymentSpec{
			Template: core_v1.PodTemplateSpec{
				Spec: core_v1.PodSpec{
					Containers: []core_v1.Container{
						{
							Env: []core_v1.EnvVar{
								{
									Name:  "CLUSTER_ID",
									Value: "KialiCluster",
								},
								{
									Name:  "PILOT_SCOPE_GATEWAY_TO_NAMESPACE",
									Value: "true",
								},
							},
						},
					},
				},
			},
		},
	}

	sidecarConfigMapMock := core_v1.ConfigMap{
		ObjectMeta: v1.ObjectMeta{
			Name:      "istio-sidecar-injector",
			Namespace: "istio-system",
		},
		Data: map[string]string{
			"values": "{ \"global\": { \"network\": \"kialiNetwork\" } }",
		},
	}

	kialiNs := kubetest.FakeNamespace("foo")

	kialiSvc := []core_v1.Service{
		{
			ObjectMeta: v1.ObjectMeta{
				Annotations: map[string]string{
					"operator-sdk/primary-resource": "kiali-operator/myKialiCR",
					"kiali.io/external-url":         "http://kiali.url.local",
				},
				Labels: map[string]string{
					"app.kubernetes.io/part-of": "kiali",
					"app.kubernetes.io/version": "v1.25",
				},
				Name:      "kiali-service",
				Namespace: "foo",
			},
			Spec: core_v1.ServiceSpec{
				Selector: map[string]string{
					"app.kubernetes.io/part-of": "kiali",
				},
			},
		},
	}

	objects := []runtime.Object{
		&istioDeploymentMock,
		&sidecarConfigMapMock,
		FakeCertificateConfigMap("istio-system"),
		kialiNs,
	}

	for _, obj := range kialiSvc {
		o := obj
		objects = append(objects, &o)
	}

	k8s := kubetest.NewFakeK8sClient(objects...)
	k8s.KubeClusterInfo = kubernetes.ClusterInfo{
		ClientConfig: &rest.Config{
			Host: "http://127.0.0.2:9443",
		},
	}

	clients := map[string]kubernetes.ClientInterface{conf.KubernetesConfig.ClusterName: k8s}
	cache := cache.NewTestingCache(t, k8s, *conf)
	discovery := istio.NewDiscovery(clients, cache, conf)

	a, err := discovery.Clusters()
	require.Nil(err, "GetClusters returned error: %v", err)

	require.NotNil(a, "GetClusters returned nil")
	require.Len(a, 1, "GetClusters didn't resolve the Kiali cluster")
	assert.Equal("KialiCluster", a[0].Name, "Unexpected cluster name")
	assert.True(a[0].IsKialiHome, "Kiali cluster not properly marked as such")
	assert.Equal("http://127.0.0.2:9443", a[0].ApiEndpoint)

	require.Len(a[0].KialiInstances, 1, "GetClusters didn't resolve the local Kiali instance")
	assert.Equal("foo", a[0].KialiInstances[0].Namespace, "GetClusters didn't set the right namespace of the Kiali instance")
	assert.Equal("kiali-operator/myKialiCR", a[0].KialiInstances[0].OperatorResource, "GetClusters didn't set the right operator resource of the Kiali instance")
	assert.Equal("http://kiali.url.local", a[0].KialiInstances[0].Url, "GetClusters didn't set the right URL of the Kiali instance")
	assert.Equal("v1.25", a[0].KialiInstances[0].Version, "GetClusters didn't set the right version of the Kiali instance")
	assert.Equal("kiali-service", a[0].KialiInstances[0].ServiceName, "GetClusters didn't set the right service name of the Kiali instance")
}

func TestGetClustersResolvesRemoteClusters(t *testing.T) {
	check := require.New(t)

	conf := config.NewConfig()

	remoteNs := kubetest.FakeNamespaceWithLabels(config.IstioNamespaceDefault, map[string]string{"topology.istio.io/network": "TheRemoteNetwork"})

	kialiSvc := &core_v1.Service{
		ObjectMeta: v1.ObjectMeta{
			Annotations: map[string]string{
				"operator-sdk/primary-resource": "kiali-operator/myKialiCR",
			},
			Labels: map[string]string{
				"app.kubernetes.io/version": "v1.25",
				"app.kubernetes.io/part-of": "kiali",
			},
			Name:      "kiali-service",
			Namespace: config.IstioNamespaceDefault,
		},
		Spec: core_v1.ServiceSpec{
			Selector: map[string]string{
				"app.kubernetes.io/part-of": "kiali",
			},
		},
	}

	remoteClient := kubetest.NewFakeK8sClient(remoteNs, kialiSvc)
	remoteClient.KubeClusterInfo = kubernetes.ClusterInfo{
		Name: "KialiCluster",
		ClientConfig: &rest.Config{
			Host: "https://192.168.144.17:123",
			TLSClientConfig: rest.TLSClientConfig{
				CAData: []byte("eAo="),
			},
		},
	}
	clients := map[string]kubernetes.ClientInterface{
		"KialiCluster":                    remoteClient,
		conf.KubernetesConfig.ClusterName: kubetest.NewFakeK8sClient(),
	}
	cache := cache.NewTestingCacheWithClients(t, clients, *conf)
	discovery := istio.NewDiscovery(clients, cache, conf)

	a, err := discovery.Clusters()
	check.Nil(err, "GetClusters returned error: %v", err)

	remoteCluster := slicetest.FindOrFail(t, a, func(c models.KubeCluster) bool { return c.Name == "KialiCluster" })

	check.NotNil(a, "GetClusters returned nil")
	check.Len(a, 2, "GetClusters didn't resolve the remote clusters")
	check.Equal("KialiCluster", remoteCluster.Name, "Unexpected cluster name")
	check.False(remoteCluster.IsKialiHome, "Remote cluster mistakenly marked as the Kiali home")
	check.Equal("https://192.168.144.17:123", remoteCluster.ApiEndpoint)

	check.Len(remoteCluster.KialiInstances, 1, "GetClusters didn't resolve the remote Kiali instance")
	check.Equal(config.IstioNamespaceDefault, remoteCluster.KialiInstances[0].Namespace, "GetClusters didn't set the right namespace of the Kiali instance")
	check.Equal("kiali-operator/myKialiCR", remoteCluster.KialiInstances[0].OperatorResource, "GetClusters didn't set the right operator resource of the Kiali instance")
	check.Equal("", remoteCluster.KialiInstances[0].Url, "GetClusters didn't set the right URL of the Kiali instance")
	check.Equal("v1.25", remoteCluster.KialiInstances[0].Version, "GetClusters didn't set the right version of the Kiali instance")
	check.Equal("kiali-service", remoteCluster.KialiInstances[0].ServiceName, "GetClusters didn't set the right service name of the Kiali instance")
}

type fakeClusterCache struct {
	cache.KialiCache
	clusters []models.KubeCluster
}

func (f *fakeClusterCache) GetClusters() []models.KubeCluster {
	return f.clusters
}

func (f *fakeClusterCache) SetClusters(clusters []models.KubeCluster) {
	f.clusters = clusters
}

// TestGetClusters verifies that GetClusters is properly caching it's findings and the cached value is being returned.
func TestResolveKialiControlPlaneClusterIsCached(t *testing.T) {
	check := assert.New(t)
	require := require.New(t)

	// Prepare mocks for first time call.
	conf := config.NewConfig()
	conf.ExternalServices.Istio.IstiodDeploymentName = "bar"
	conf.KubernetesConfig.ClusterName = "KialiCluster"

	istioDeploymentMock := &apps_v1.Deployment{
		ObjectMeta: v1.ObjectMeta{
			Name:      "bar",
			Namespace: "foo",
		},
		Spec: apps_v1.DeploymentSpec{
			Template: core_v1.PodTemplateSpec{
				Spec: core_v1.PodSpec{
					Containers: []core_v1.Container{
						{
							Env: []core_v1.EnvVar{
								{
									Name:  "CLUSTER_ID",
									Value: "KialiCluster",
								},
								{
									Name:  "PILOT_SCOPE_GATEWAY_TO_NAMESPACE",
									Value: "false",
								},
							},
						},
					},
				},
			},
		},
	}

	kialiSvc := &core_v1.Service{
		ObjectMeta: v1.ObjectMeta{
			Annotations: map[string]string{
				"operator-sdk/primary-resource": "kiali-operator/myKialiCR",
			},
			Labels: map[string]string{
				"app.kubernetes.io/version": "v1.25",
				"app.kubernetes.io/part-of": "kiali",
			},
			Name:      "kiali-service",
			Namespace: "foo",
		},
		Spec: core_v1.ServiceSpec{
			Selector: map[string]string{
				"app.kubernetes.io/part-of": "kiali",
			},
		},
	}

	// Create a MeshService and invoke GetClusters. This should cache the result.
	k8s := kubetest.NewFakeK8sClient(
		kubetest.FakeNamespace("foo"),
		FakeCertificateConfigMap("istio-system"),
		istioDeploymentMock,
		kialiSvc,
	)
	cache := cache.NewTestingCache(t, k8s, *conf)
	getClustersCache := &fakeClusterCache{KialiCache: cache}
	discovery := istio.NewDiscovery(map[string]kubernetes.ClientInterface{conf.KubernetesConfig.ClusterName: k8s}, getClustersCache, conf)
	result, err := discovery.Clusters()
	require.NoError(err)
	require.NotNil(result)
	require.Len(result, 1)
	check.Equal("KialiCluster", result[0].Name) // Sanity check. Rest of values are tested in TestGetClustersResolvesTheKialiCluster
	// Check that the cache now has clusters populated.
	check.Len(getClustersCache.clusters, 1)

	result, err = discovery.Clusters()
	require.NoError(err)
	require.NotNil(result)
	require.Len(result, 1)
	check.Equal("KialiCluster", result[0].Name)
}

func TestMesh(t *testing.T) {
	istiodDeployment := &apps_v1.Deployment{
		ObjectMeta: v1.ObjectMeta{
			Name:      "istiod",
			Namespace: "istio-system",
			Labels: map[string]string{
				"app":                     "istiod",
				config.IstioRevisionLabel: "default",
			},
		},
	}
	const configMapData = `accessLogFile: /dev/stdout
enableAutoMtls: true
rootNamespace: istio-system
trustDomain: cluster.local
`
	istioConfigMap := &core_v1.ConfigMap{
		ObjectMeta: v1.ObjectMeta{
			Name:      "istio",
			Namespace: "istio-system",
			Labels:    map[string]string{config.IstioRevisionLabel: "default"},
		},
		Data: map[string]string{"mesh": configMapData},
	}
	sideCarConfigMap := &core_v1.ConfigMap{
		ObjectMeta: v1.ObjectMeta{
			Name:      "istio-sidecar-injector",
			Namespace: "istio-system",
		},
		Data: map[string]string{
			"values": "{ \"global\": { \"network\": \"kialiNetwork\" } }",
		},
	}

	require := require.New(t)
	conf := config.NewConfig()
	k8s := kubetest.NewFakeK8sClient(
		kubetest.FakeNamespace("istio-system"),
		istiodDeployment,
		istioConfigMap,
		sideCarConfigMap,
		FakeCertificateConfigMap("istio-system"),
	)
	cache := cache.NewTestingCache(t, k8s, *conf)

	clients := map[string]kubernetes.ClientInterface{conf.KubernetesConfig.ClusterName: k8s}
	discovery := istio.NewDiscovery(clients, cache, conf)
	mesh, err := discovery.Mesh(context.TODO())
	require.NoError(err)
	require.Len(mesh.ControlPlanes, 1)
	require.True(mesh.ControlPlanes[0].MeshConfig.EnableAutoMtls.Value)
	require.Len(mesh.ControlPlanes[0].ManagedClusters, 1)
	require.Equal("kialiNetwork", mesh.ControlPlanes[0].Config.Network)
}

func TestControlPlaneCertificate(t *testing.T) {
	istiodDeployment := &apps_v1.Deployment{
		ObjectMeta: v1.ObjectMeta{
			Name:      "istiod",
			Namespace: "istio-system",
			Labels: map[string]string{
				"app":                     "istiod",
				config.IstioRevisionLabel: "default",
			},
		},
	}
	const configMapData = `accessLogFile: /dev/stdout
enableAutoMtls: true
rootNamespace: istio-system
trustDomain: cluster.local
`
	istioConfigMap := &core_v1.ConfigMap{
		ObjectMeta: v1.ObjectMeta{
			Name:      "istio",
			Namespace: "istio-system",
			Labels:    map[string]string{config.IstioRevisionLabel: "default"},
		},
		Data: map[string]string{"mesh": configMapData},
	}
	sideCarConfigMap := &core_v1.ConfigMap{
		ObjectMeta: v1.ObjectMeta{
			Name:      "istio-sidecar-injector",
			Namespace: "istio-system",
		},
		Data: map[string]string{
			"values": "{ \"global\": { \"network\": \"kialiNetwork\" } }",
		},
	}

	require := require.New(t)
	conf := config.NewConfig()
	k8s := kubetest.NewFakeK8sClient(
		kubetest.FakeNamespace("istio-system"),
		istiodDeployment,
		istioConfigMap,
		sideCarConfigMap,
		FakeCertificateConfigMap("istio-system"),
	)
	cache := cache.NewTestingCache(t, k8s, *conf)

	clients := map[string]kubernetes.ClientInterface{conf.KubernetesConfig.ClusterName: k8s}
	discovery := istio.NewDiscovery(clients, cache, conf)
	mesh, err := discovery.Mesh(context.TODO())
	require.NoError(err)
	require.Len(mesh.ControlPlanes, 1)
	require.Len(mesh.ControlPlanes[0].Config.Certificates, 1)
	require.Equal("O=cluster.local", mesh.ControlPlanes[0].Config.Certificates[0].Issuer)
	require.Equal("2021-07-27 14:37:00 +0000 UTC", mesh.ControlPlanes[0].Config.Certificates[0].NotBefore.String())
	require.Equal("2031-07-25 14:37:00 +0000 UTC", mesh.ControlPlanes[0].Config.Certificates[0].NotAfter.String())
}

func TestMeshResolvesNetwork(t *testing.T) {
	cases := map[string]struct {
		expectedNetwork              string
		objects                      []runtime.Object
		sideCarInjectorConfigMap     *core_v1.ConfigMap
		sideCarInjectorConfigMapName string
		sideCarConfigMapYAML         string
	}{
		"Network from sidecar injector configmap": {
			expectedNetwork: "kialiNetwork",
			sideCarInjectorConfigMap: &core_v1.ConfigMap{
				ObjectMeta: v1.ObjectMeta{
					Name:      "istio-sidecar-injector",
					Namespace: "istio-system",
				},
				Data: map[string]string{
					"values": `{"global": {"network": "kialiNetwork"}}`,
				},
			},
		},
		"Sidecar injector configmap set in kiali config": {
			expectedNetwork: "kialiNetwork",
			sideCarInjectorConfigMap: &core_v1.ConfigMap{
				ObjectMeta: v1.ObjectMeta{
					Name:      "istio-sidecar-injector",
					Namespace: "istio-system",
				},
				Data: map[string]string{
					"values": `{"global": {"network": "kialiNetwork"}}`,
				},
			},
			sideCarInjectorConfigMapName: "istio-sidecar-injector",
		},
		"bad sidecar injector configmap json returns empty string": {
			expectedNetwork: "",
			sideCarInjectorConfigMap: &core_v1.ConfigMap{
				ObjectMeta: v1.ObjectMeta{
					Name:      "istio-sidecar-injector",
					Namespace: "istio-system",
				},
				Data: map[string]string{
					"values": "bad json",
				},
			},
		},
		"bad sidecar injector configmap global json returns empty string": {
			expectedNetwork: "",
			sideCarInjectorConfigMap: &core_v1.ConfigMap{
				ObjectMeta: v1.ObjectMeta{
					Name:      "istio-sidecar-injector",
					Namespace: "istio-system",
				},
				Data: map[string]string{
					"values": `{"global": "bad json"}`,
				},
			},
		},
		"sidecar injector configmap without global key returns empty string": {
			expectedNetwork: "",
			sideCarInjectorConfigMap: &core_v1.ConfigMap{
				ObjectMeta: v1.ObjectMeta{
					Name:      "istio-sidecar-injector",
					Namespace: "istio-system",
				},
				Data: map[string]string{
					"values": `{}`,
				},
			},
		},
		"sidecar injector configmap without global.network key returns empty string": {
			expectedNetwork: "",
			sideCarInjectorConfigMap: &core_v1.ConfigMap{
				ObjectMeta: v1.ObjectMeta{
					Name:      "istio-sidecar-injector",
					Namespace: "istio-system",
				},
				Data: map[string]string{
					"values": `{"global": {}}`,
				},
			},
		},
		"sidecar injector configmap with bad network key returns empty string": {
			expectedNetwork: "",
			sideCarInjectorConfigMap: &core_v1.ConfigMap{
				ObjectMeta: v1.ObjectMeta{
					Name:      "istio-sidecar-injector",
					Namespace: "istio-system",
				},
				Data: map[string]string{
					"values": `{"global": {"network": 1}}`,
				},
			},
		},
	}

	for name, tc := range cases {
		t.Run(name, func(t *testing.T) {
			require := require.New(t)
			conf := config.NewConfig()
			conf.ExternalServices.Istio.IstioSidecarInjectorConfigMapName = tc.sideCarInjectorConfigMapName

			istiodDeployment := &apps_v1.Deployment{
				ObjectMeta: v1.ObjectMeta{
					Name:      "istiod",
					Namespace: "istio-system",
					Labels: map[string]string{
						"app":                     "istiod",
						config.IstioRevisionLabel: "default",
					},
				},
			}
			istioConfigMap := &core_v1.ConfigMap{
				ObjectMeta: v1.ObjectMeta{
					Name:      "istio",
					Namespace: "istio-system",
					Labels:    map[string]string{config.IstioRevisionLabel: "default"},
				},
				Data: map[string]string{"mesh": ""},
			}

			k8s := kubetest.NewFakeK8sClient(
				kubetest.FakeNamespace("istio-system"),
				istiodDeployment,
				istioConfigMap,
				FakeCertificateConfigMap("istio-system"),
				tc.sideCarInjectorConfigMap,
			)
			cache := cache.NewTestingCache(t, k8s, *conf)

			clients := map[string]kubernetes.ClientInterface{conf.KubernetesConfig.ClusterName: k8s}
			discovery := istio.NewDiscovery(clients, cache, conf)
			mesh, err := discovery.Mesh(context.TODO())
			require.NoError(err)
			require.Len(mesh.ControlPlanes, 1)
			require.Len(mesh.ControlPlanes[0].ManagedClusters, 1)
			require.Equal(tc.expectedNetwork, mesh.ControlPlanes[0].Config.Network)
		})
	}
}

func TestGetMeshMultipleRevisions(t *testing.T) {
	istiod_1_18_Deployment := &apps_v1.Deployment{
		ObjectMeta: v1.ObjectMeta{
			Name:      "istiod-1-18",
			Namespace: "istio-system",
			Labels: map[string]string{
				"app":                     "istiod",
				config.IstioRevisionLabel: "1-18-0",
			},
		},
	}
	istiod_1_19_Deployment := &apps_v1.Deployment{
		ObjectMeta: v1.ObjectMeta{
			Name:      "istiod-1-19",
			Namespace: "istio-system",
			Labels: map[string]string{
				"app":                     "istiod",
				config.IstioRevisionLabel: "1-19-0",
			},
		},
	}
	const configMap_1_18_Data = `accessLogFile: /dev/stdout
enableAutoMtls: false
rootNamespace: istio-system
trustDomain: cluster.local
`
	istio_1_18_ConfigMap := &core_v1.ConfigMap{
		ObjectMeta: v1.ObjectMeta{
			Name:      "istio-1-18-0",
			Namespace: "istio-system",
			Labels: map[string]string{
				config.IstioRevisionLabel: "1-18-0",
			},
		},
		Data: map[string]string{"mesh": configMap_1_18_Data},
	}
	const configMap_1_19_Data = `accessLogFile: /dev/stdout
enableAutoMtls: true
rootNamespace: istio-system
trustDomain: cluster.local
`
	istio_1_19_ConfigMap := &core_v1.ConfigMap{
		ObjectMeta: v1.ObjectMeta{
			Name:      "istio-1-19-0",
			Namespace: "istio-system",
			Labels: map[string]string{
				config.IstioRevisionLabel: "1-19-0",
			},
		},
		Data: map[string]string{"mesh": configMap_1_19_Data},
	}

	require := require.New(t)
	conf := config.NewConfig()
	k8s := kubetest.NewFakeK8sClient(
		kubetest.FakeNamespace("istio-system"),
		istiod_1_18_Deployment,
		istio_1_18_ConfigMap,
		istiod_1_19_Deployment,
		istio_1_19_ConfigMap,
		FakeCertificateConfigMap("istio-system"),
	)

	clients := map[string]kubernetes.ClientInterface{conf.KubernetesConfig.ClusterName: k8s}
	discovery := istio.NewDiscovery(clients, cache.NewTestingCache(t, k8s, *conf), conf)
	mesh, err := discovery.Mesh(context.TODO())
	require.NoError(err)
	require.Len(mesh.ControlPlanes, 2)

	controlPlane_1_18 := slicetest.FindOrFail(t, mesh.ControlPlanes, func(c models.ControlPlane) bool {
		return c.Revision == "1-18-0"
	})
	require.False(controlPlane_1_18.MeshConfig.EnableAutoMtls.Value)
	require.Len(controlPlane_1_18.ManagedClusters, 1)

	controlPlane_1_19 := slicetest.FindOrFail(t, mesh.ControlPlanes, func(c models.ControlPlane) bool {
		return c.Revision == "1-19-0"
	})
	require.True(controlPlane_1_19.MeshConfig.EnableAutoMtls.Value)
	require.Len(controlPlane_1_19.ManagedClusters, 1)

	// Neeed to call Setup again to clear the cached mesh object.
	// business.SetupBusinessLayer(t, k8s, *conf)
	// Test for setting the configmap name explicitly due to regression: https://github.com/kiali/kiali/issues/6669
	conf.ExternalServices.Istio.ConfigMapName = istio_1_19_ConfigMap.Name
	// config.Set(conf)
	// Create a new cache to clear the old mesh object.
	cache := cache.NewTestingCache(t, k8s, *conf)
	discovery = istio.NewDiscovery(clients, cache, conf)
	mesh, err = discovery.Mesh(context.TODO())
	require.NoError(err)

	require.Len(mesh.ControlPlanes, 2)
	// Both controlplanes should set this to true since both will use the 1.19 configmap.
	require.True(mesh.ControlPlanes[0].MeshConfig.EnableAutoMtls.Value)
	require.True(mesh.ControlPlanes[1].MeshConfig.EnableAutoMtls.Value)
}

func TestGetMeshRemoteClusters(t *testing.T) {
	require := require.New(t)
	conf := config.NewConfig()
	// Set to east because the default is "" which causes the check for
	// cluster name env var to fail even though it is set.
	conf.KubernetesConfig.ClusterName = "east"

	istiodDeployment := fakeIstiodDeployment(conf.KubernetesConfig.ClusterName, true)
	const configMapData = `accessLogFile: /dev/stdout
enableAutoMtls: true
rootNamespace: istio-system
trustDomain: cluster.local
`
	istioConfigMap := &core_v1.ConfigMap{
		ObjectMeta: v1.ObjectMeta{
			Name:      "istio",
			Namespace: "istio-system",
			Labels:    map[string]string{config.IstioRevisionLabel: "default"},
		},
		Data: map[string]string{"mesh": configMapData},
	}
	k8s := kubetest.NewFakeK8sClient(
		kubetest.FakeNamespace("istio-system"),
		istiodDeployment,
		istioConfigMap,
		FakeCertificateConfigMap("istio-system"),
	)
	remoteClient := kubetest.NewFakeK8sClient(
		&core_v1.Namespace{ObjectMeta: v1.ObjectMeta{
			Name:        "istio-system",
			Annotations: map[string]string{business.IstioControlPlaneClustersLabel: conf.KubernetesConfig.ClusterName},
			Labels:      map[string]string{"kubernetes.io/metadata.name": "istio-system"},
		}},
		kubetest.FakeNamespace("bookinfo"),
	)

	clients := map[string]kubernetes.ClientInterface{conf.KubernetesConfig.ClusterName: k8s, "remote": remoteClient}
	cache := cache.NewTestingCacheWithClients(t, clients, *conf)
	discovery := istio.NewDiscovery(clients, cache, conf)
	mesh, err := discovery.Mesh(context.TODO())
	require.NoError(err)
	require.Len(mesh.ControlPlanes, 1)
	require.Len(mesh.ControlPlanes[0].ManagedClusters, 2)

	controlPlane := mesh.ControlPlanes[0]

	require.Equal(conf.KubernetesConfig.ClusterName, controlPlane.Cluster.Name)
	slicetest.FindOrFail(t, controlPlane.ManagedClusters, func(c *models.KubeCluster) bool {
		return c.Name == "remote"
	})
}

func TestGetMeshRemoteWithWildcardAnnotation(t *testing.T) {
	require := require.New(t)
	conf := config.NewConfig()
	// Set to east because the default is "" which causes the check for
	// cluster name env var to fail even though it is set.
	conf.KubernetesConfig.ClusterName = "east"

	istiodDeployment := fakeIstiodDeployment(conf.KubernetesConfig.ClusterName, true)
	const configMapData = `accessLogFile: /dev/stdout
enableAutoMtls: true
rootNamespace: istio-system
trustDomain: cluster.local
`
	istioConfigMap := &core_v1.ConfigMap{
		ObjectMeta: v1.ObjectMeta{
			Name:      "istio",
			Namespace: "istio-system",
			Labels:    map[string]string{config.IstioRevisionLabel: "default"},
		},
		Data: map[string]string{"mesh": configMapData},
	}
	eastClient := kubetest.NewFakeK8sClient(
		kubetest.FakeNamespace("istio-system"),
		istiodDeployment,
		istioConfigMap,
		FakeCertificateConfigMap("istio-system"),
	)
	remoteClient := kubetest.NewFakeK8sClient(
		&core_v1.Namespace{ObjectMeta: v1.ObjectMeta{
			Name:        "istio-system",
			Annotations: map[string]string{business.IstioControlPlaneClustersLabel: "*"},
			Labels:      map[string]string{"kubernetes.io/metadata.name": "istio-system"},
		}},
		kubetest.FakeNamespace("bookinfo"),
		FakeCertificateConfigMap("istio-system"),
	)

	clients := map[string]kubernetes.ClientInterface{"east": eastClient, "remote": remoteClient}
	cache := cache.NewTestingCacheWithClients(t, clients, *conf)
	discovery := istio.NewDiscovery(clients, cache, conf)
	mesh, err := discovery.Mesh(context.TODO())
	require.NoError(err)
	require.Len(mesh.ControlPlanes, 1)
	require.Len(mesh.ControlPlanes[0].ManagedClusters, 2)

	controlPlane := mesh.ControlPlanes[0]

	require.Equal(conf.KubernetesConfig.ClusterName, controlPlane.Cluster.Name)
	slicetest.FindOrFail(t, controlPlane.ManagedClusters, func(c *models.KubeCluster) bool {
		return c.Name == "remote"
	})
}

func TestGetMeshPrimaryWithoutExternalEnvVar(t *testing.T) {
	require := require.New(t)
	conf := config.NewConfig()
	// Set to east because the default is "" which causes the check for
	// cluster name env var to fail even though it is set.
	conf.KubernetesConfig.ClusterName = "east"

	istiodDeployment := fakeIstiodDeployment(conf.KubernetesConfig.ClusterName, false)
	const configMapData = `accessLogFile: /dev/stdout
enableAutoMtls: true
rootNamespace: istio-system
trustDomain: cluster.local
`

	istioConfigMap := &core_v1.ConfigMap{
		ObjectMeta: v1.ObjectMeta{
			Name:      "istio",
			Namespace: "istio-system",
			Labels:    map[string]string{config.IstioRevisionLabel: "default"},
		},
		Data: map[string]string{"mesh": configMapData},
	}
	eastClient := kubetest.NewFakeK8sClient(
		kubetest.FakeNamespace("istio-system"),
		istiodDeployment,
		istioConfigMap,
		FakeCertificateConfigMap("istio-system"),
	)
	remoteClient := kubetest.NewFakeK8sClient(
		&core_v1.Namespace{ObjectMeta: v1.ObjectMeta{
			Name:        "istio-system",
			Annotations: map[string]string{business.IstioControlPlaneClustersLabel: conf.KubernetesConfig.ClusterName},
			Labels:      map[string]string{"kubernetes.io/metadata.name": "istio-system"},
		}},
		kubetest.FakeNamespace("bookinfo"),
		FakeCertificateConfigMap("istio-system"),
	)

	clients := map[string]kubernetes.ClientInterface{"east": eastClient, "remote": remoteClient}
	cache := cache.NewTestingCacheWithClients(t, clients, *conf)
	discovery := istio.NewDiscovery(clients, cache, conf)
	mesh, err := discovery.Mesh(context.TODO())
	require.NoError(err)
	require.Len(mesh.ControlPlanes, 1)
	require.Len(mesh.ControlPlanes[0].ManagedClusters, 1)
}

func TestGetMeshMultiplePrimaries(t *testing.T) {
	require := require.New(t)
	conf := config.NewConfig()
	// Set to east because the default is "" which causes the check for
	// cluster name env var to fail even though it is set.
	conf.KubernetesConfig.ClusterName = "east"

	const configMapData = `accessLogFile: /dev/stdout
enableAutoMtls: true
rootNamespace: istio-system
trustDomain: cluster.local
`
	istioConfigMap := &core_v1.ConfigMap{
		ObjectMeta: v1.ObjectMeta{
			Name:      "istio",
			Namespace: "istio-system",
			Labels:    map[string]string{config.IstioRevisionLabel: "default"},
		},
		Data: map[string]string{"mesh": configMapData},
	}

	eastClient := kubetest.NewFakeK8sClient(
		kubetest.FakeNamespace("istio-system"),
		kubetest.FakeNamespace("bookinfo"),
		fakeIstiodDeployment("east", false),
		istioConfigMap,
		FakeCertificateConfigMap("istio-system"),
	)
	westClient := kubetest.NewFakeK8sClient(
		kubetest.FakeNamespace("istio-system"),
		kubetest.FakeNamespace("bookinfo"),
		fakeIstiodDeployment("west", false),
		istioConfigMap,
		FakeCertificateConfigMap("istio-system"),
	)

	clients := map[string]kubernetes.ClientInterface{conf.KubernetesConfig.ClusterName: eastClient, "west": westClient}
	cache := cache.NewTestingCacheWithClients(t, clients, *conf)
	discovery := istio.NewDiscovery(clients, cache, conf)
	mesh, err := discovery.Mesh(context.TODO())
	require.NoError(err)
	require.Len(mesh.ControlPlanes, 2)
	require.Len(mesh.ControlPlanes[0].ManagedClusters, 1)
	require.Len(mesh.ControlPlanes[1].ManagedClusters, 1)

	eastControlPlane := slicetest.FindOrFail(t, mesh.ControlPlanes, func(c models.ControlPlane) bool {
		return c.Cluster.Name == "east"
	})
	westControlPlane := slicetest.FindOrFail(t, mesh.ControlPlanes, func(c models.ControlPlane) bool {
		return c.Cluster.Name == "west"
	})

	require.Equal("east", eastControlPlane.ManagedClusters[0].Name)
	require.Equal("west", westControlPlane.ManagedClusters[0].Name)
}

func TestGetMeshMultiplePrimariesWithRemotes(t *testing.T) {
	require := require.New(t)
	conf := config.NewConfig()
	// Set to east because the default is "" which causes the check for
	// cluster name env var to fail even though it is set.
	conf.KubernetesConfig.ClusterName = "east"

	const configMapData = `accessLogFile: /dev/stdout
enableAutoMtls: true
rootNamespace: istio-system
trustDomain: cluster.local
`
	istioConfigMap := &core_v1.ConfigMap{
		ObjectMeta: v1.ObjectMeta{
			Name:      "istio",
			Namespace: "istio-system",
			Labels:    map[string]string{config.IstioRevisionLabel: "default"},
		},
		Data: map[string]string{"mesh": configMapData},
	}
	eastClient := kubetest.NewFakeK8sClient(
		kubetest.FakeNamespace("istio-system"),
		kubetest.FakeNamespace("bookinfo"),
		fakeIstiodDeployment("east", true),
		istioConfigMap,
		FakeCertificateConfigMap("istio-system"),
	)
	eastRemoteClient := kubetest.NewFakeK8sClient(
		&core_v1.Namespace{ObjectMeta: v1.ObjectMeta{
			Name:        "istio-system",
			Annotations: map[string]string{business.IstioControlPlaneClustersLabel: "east"},
			Labels:      map[string]string{"kubernetes.io/metadata.name": "istio-system"},
		}},
		kubetest.FakeNamespace("bookinfo"),
	)
	westClient := kubetest.NewFakeK8sClient(
		kubetest.FakeNamespace("istio-system"),
		kubetest.FakeNamespace("bookinfo"),
		fakeIstiodDeployment("west", true),
		istioConfigMap,
		FakeCertificateConfigMap("istio-system"),
	)
	westRemoteClient := kubetest.NewFakeK8sClient(
		&core_v1.Namespace{ObjectMeta: v1.ObjectMeta{
			Name:        "istio-system",
			Annotations: map[string]string{business.IstioControlPlaneClustersLabel: "west"},
			Labels:      map[string]string{"kubernetes.io/metadata.name": "istio-system"},
		}},
		kubetest.FakeNamespace("bookinfo"),
	)

	clients := map[string]kubernetes.ClientInterface{
		"east":        eastClient,
		"east-remote": eastRemoteClient,
		"west":        westClient,
		"west-remote": westRemoteClient,
	}
	cache := cache.NewTestingCacheWithClients(t, clients, *conf)
	discovery := istio.NewDiscovery(clients, cache, conf)
	mesh, err := discovery.Mesh(context.TODO())
	require.NoError(err)
	require.Len(mesh.ControlPlanes, 2)
	require.Len(mesh.ControlPlanes[0].ManagedClusters, 2)
	require.Len(mesh.ControlPlanes[1].ManagedClusters, 2)

	eastControlPlane := slicetest.FindOrFail(t, mesh.ControlPlanes, func(c models.ControlPlane) bool {
		return c.Cluster.Name == "east"
	})
	westControlPlane := slicetest.FindOrFail(t, mesh.ControlPlanes, func(c models.ControlPlane) bool {
		return c.Cluster.Name == "west"
	})

	// Sort to get consistent ordering before doing assertions.
	sortClustersByName := func(a *models.KubeCluster, b *models.KubeCluster) int {
		return strings.Compare(a.Name, b.Name)
	}
	slices.SortFunc(eastControlPlane.ManagedClusters, sortClustersByName)
	slices.SortFunc(westControlPlane.ManagedClusters, sortClustersByName)

	require.Equal(eastControlPlane.ManagedClusters[0].Name, "east")
	require.Equal(eastControlPlane.ManagedClusters[1].Name, "east-remote")
	require.Equal(westControlPlane.ManagedClusters[0].Name, "west")
	require.Equal(westControlPlane.ManagedClusters[1].Name, "west-remote")
}

func TestGetMeshWithExternalControlPlaneAndRemote(t *testing.T) {
	require := require.New(t)
	conf := config.NewConfig()
	// Set to east because the default is "" which causes the check for
	// cluster name env var to fail even though it is set.
	conf.KubernetesConfig.ClusterName = "controlplane"

	const configMapData = `accessLogFile: /dev/stdout
enableAutoMtls: true
rootNamespace: istio-system
trustDomain: cluster.local
`
	istioConfigMap := &core_v1.ConfigMap{
		ObjectMeta: v1.ObjectMeta{
			Name:      "istio",
			Namespace: "istio-system",
			Labels:    map[string]string{config.IstioRevisionLabel: "default"},
		},
		Data: map[string]string{"mesh": configMapData},
	}
	istioConfigMapExternalControlPlane := &core_v1.ConfigMap{
		ObjectMeta: v1.ObjectMeta{
			Name:      "istio",
			Namespace: "external-istiod",
			Labels:    map[string]string{config.IstioRevisionLabel: "default"},
		},
		Data: map[string]string{"mesh": configMapData},
	}
	externalControlPlane := fakeIstiodDeployment("dataplane", true)
	externalControlPlane.Namespace = "external-istiod"
	externalControlPlane.Name = "istiod"

	controlPlaneClient := kubetest.NewFakeK8sClient(
		kubetest.FakeNamespace("istio-system"),
		kubetest.FakeNamespace("external-istiod"),
		fakeIstiodDeployment("controlplane", false),
		externalControlPlane,
		istioConfigMap,
		istioConfigMapExternalControlPlane,
		istio.FakeCertificateConfigMap("external-istiod"),
		istio.FakeCertificateConfigMap("istio-system"),
	)

	dataPlaneClient := kubetest.NewFakeK8sClient(
		kubetest.FakeNamespace("external-istiod"),
		kubetest.FakeNamespace("bookinfo"),
	)

	dataPlaneRemoteClient := kubetest.NewFakeK8sClient(
		&core_v1.Namespace{ObjectMeta: v1.ObjectMeta{
			Name:        "external-istiod",
			Annotations: map[string]string{business.IstioControlPlaneClustersLabel: "dataplane"},
			Labels:      map[string]string{"kubernetes.io/metadata.name": "external-istiod"},
		}},
		kubetest.FakeNamespace("bookinfo"),
	)

	clients := map[string]kubernetes.ClientInterface{
		"controlplane":     controlPlaneClient,
		"dataplane":        dataPlaneClient,
		"dataplane-remote": dataPlaneRemoteClient,
	}

	cache := cache.NewTestingCacheWithClients(t, clients, *conf)
	discovery := istio.NewDiscovery(clients, cache, conf)
	mesh, err := discovery.Mesh(context.TODO())
	require.NoError(err)
	require.Len(mesh.ControlPlanes, 2)

	controlPlane := slicetest.FindOrFail(t, mesh.ControlPlanes, func(c models.ControlPlane) bool {
		return c.Cluster.Name == "controlplane" && c.ID == "controlplane"
	})
	extControlPlane := slicetest.FindOrFail(t, mesh.ControlPlanes, func(c models.ControlPlane) bool {
		return c.Cluster.Name == "controlplane" && c.ID == "dataplane"
	})
	require.Len(controlPlane.ManagedClusters, 1)
	require.Len(extControlPlane.ManagedClusters, 2)

	require.Equal(controlPlane.ManagedClusters[0].Name, "controlplane")

	// Sort to get consistent ordering before doing assertions.
	sortClustersByName := func(a *models.KubeCluster, b *models.KubeCluster) int {
		return strings.Compare(a.Name, b.Name)
	}
	slices.SortFunc(extControlPlane.ManagedClusters, sortClustersByName)
	require.Equal(extControlPlane.ManagedClusters[0].Name, "dataplane")
	require.Equal(extControlPlane.ManagedClusters[1].Name, "dataplane-remote")
}

func TestGetClustersShowsConfiguredKialiInstances(t *testing.T) {
	require := require.New(t)
	assert := assert.New(t)
	conf := config.NewConfig()
	conf.Clustering.Clusters = []config.Cluster{{
		Name: "west",
	}}
	conf.Clustering.KialiURLs = []config.KialiURL{{
		InstanceName: "kiali",
		Namespace:    "istio-system",
		ClusterName:  "west",
		URL:          "kiali.istio-system.west",
	}}

	clients := map[string]kubernetes.ClientInterface{conf.KubernetesConfig.ClusterName: kubetest.NewFakeK8sClient()}
	cache := cache.NewTestingCacheWithClients(t, clients, *conf)
	discovery := istio.NewDiscovery(clients, cache, conf)

	clusters, err := discovery.Clusters()

	require.NoError(err)
	require.Len(clusters, 2)
	homeIndex := slices.IndexFunc(clusters, func(c models.KubeCluster) bool {
		return c.Name == conf.KubernetesConfig.ClusterName
	})
	westIndex := slices.IndexFunc(clusters, func(c models.KubeCluster) bool {
		return c.Name == "west"
	})
	require.True(westIndex >= 0)
	require.True(homeIndex >= 0)

	westCluster := clusters[westIndex]
	require.Len(westCluster.KialiInstances, 1)
	assert.False(westCluster.Accessible)
	kialiInstance := westCluster.KialiInstances[0]
	assert.Equal("kiali", kialiInstance.ServiceName)
	assert.Equal("istio-system", kialiInstance.Namespace)
	assert.Equal("kiali.istio-system.west", kialiInstance.Url)

	homeCluster := clusters[homeIndex]
	require.Len(homeCluster.KialiInstances, 0)
	assert.True(homeCluster.Accessible)
}

func TestGetClustersWorksWithNamespacedScope(t *testing.T) {
	require := require.New(t)
	assert := assert.New(t)

	conf := testutils.GetConfigFromYaml(t, `
deployment:
  cluster_wide_access: false
  discovery_selectors:
    default:
    - matchLabels: {"kubernetes.io/metadata.name": "istio-system" }
`)

	kialiService := &core_v1.Service{
		ObjectMeta: v1.ObjectMeta{
			Name:      "kiali",
			Namespace: "istio-system",
			Labels:    map[string]string{"app.kubernetes.io/part-of": "kiali"},
		},
	}
	k8s := kubetest.NewFakeK8sClient(
		kubetest.FakeNamespace("istio-system"),
		kialiService,
	)
	clients := map[string]kubernetes.ClientInterface{conf.KubernetesConfig.ClusterName: k8s}
	cache := cache.NewTestingCacheWithClients(t, clients, *conf)
	discovery := istio.NewDiscovery(clients, cache, conf)
	clusters, err := discovery.Clusters()

	require.NoError(err)
	require.Len(clusters, 1)
	require.Len(clusters[0].KialiInstances, 1)
	kialiInstance := clusters[0].KialiInstances[0]
	assert.Equal("kiali", kialiInstance.ServiceName)
	assert.Equal("istio-system", kialiInstance.Namespace)
}

func TestAddingKialiInstanceToExistingClusterDoesntAddNewCluster(t *testing.T) {
	require := require.New(t)
	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "Kubernetes"
	conf.Clustering.KialiURLs = []config.KialiURL{{
		InstanceName: "kiali",
		Namespace:    "istio-system",
		ClusterName:  conf.KubernetesConfig.ClusterName,
		URL:          "kiali.istio-system.west",
	}}

	k8s := kubetest.NewFakeK8sClient()
	clients := map[string]kubernetes.ClientInterface{conf.KubernetesConfig.ClusterName: k8s}
	cache := cache.NewTestingCacheWithClients(t, clients, *conf)
	discovery := istio.NewDiscovery(clients, cache, conf)
	clusters, err := discovery.Clusters()

	require.NoError(err)
	require.Len(clusters, 1)
}

func TestIsRemoteCluster(t *testing.T) {
	require := require.New(t)
	conf := config.NewConfig()
	// Set to east because the default is "" which causes the check for
	// cluster name env var to fail even though it is set.
	conf.KubernetesConfig.ClusterName = "east"

	istiodDeployment := fakeIstiodDeployment(conf.KubernetesConfig.ClusterName, true)
	const configMapData = `accessLogFile: /dev/stdout
enableAutoMtls: true
rootNamespace: istio-system
trustDomain: cluster.local
`
	istioConfigMap := &core_v1.ConfigMap{
		ObjectMeta: v1.ObjectMeta{
			Name:      "istio",
			Namespace: "istio-system",
			Labels:    map[string]string{config.IstioRevisionLabel: "default"},
		},
		Data: map[string]string{"mesh": configMapData},
	}
	k8s := kubetest.NewFakeK8sClient(
		kubetest.FakeNamespace("istio-system"),
		istiodDeployment,
		istioConfigMap,
		istio.FakeCertificateConfigMap("istio-system"),
	)
	remoteClient := kubetest.NewFakeK8sClient(
		&core_v1.Namespace{ObjectMeta: v1.ObjectMeta{
			Name:        "istio-system",
			Annotations: map[string]string{business.IstioControlPlaneClustersLabel: conf.KubernetesConfig.ClusterName},
			Labels:      map[string]string{"kubernetes.io/metadata.name": "istio-system"},
		}},
		kubetest.FakeNamespace("bookinfo"),
	)

	clients := map[string]kubernetes.ClientInterface{conf.KubernetesConfig.ClusterName: k8s, "remote": remoteClient}
	cache := cache.NewTestingCacheWithClients(t, clients, *conf)
	discovery := istio.NewDiscovery(clients, cache, conf)

	require.True(discovery.IsRemoteCluster(context.Background(), "remote"))
	require.False(discovery.IsRemoteCluster(context.Background(), "east"))
	require.True(discovery.IsRemoteCluster(context.Background(), "non-existant"))
}

func TestIstiodResourceThresholds(t *testing.T) {
	conf := config.NewConfig()
	istiodAppLabels := map[string]string{
		"app":                     "istiod",
		config.IstioRevisionLabel: "default",
	}

	testCases := map[string]struct {
		istiodConatiner core_v1.Container
		istiodMeta      v1.ObjectMeta
		expected        *models.IstiodThresholds
	}{
		"istiod with no limits": {
			istiodMeta: v1.ObjectMeta{
				Name:      "istiod",
				Namespace: "istio-system",
				Labels:    istiodAppLabels,
			},
			istiodConatiner: core_v1.Container{
				Name: "istiod",
			},
			expected: &models.IstiodThresholds{
				CPU:    0,
				Memory: 0,
			},
		},
		"istiod with limits": {
			istiodMeta: v1.ObjectMeta{
				Name:      "istiod",
				Namespace: "istio-system",
				Labels:    istiodAppLabels,
			},
			istiodConatiner: core_v1.Container{
				Name: "istiod",
				Resources: core_v1.ResourceRequirements{
					Limits: core_v1.ResourceList{
						core_v1.ResourceCPU:    resource.MustParse("1000m"),
						core_v1.ResourceMemory: resource.MustParse("1G"),
					},
				},
			},
			expected: &models.IstiodThresholds{
				CPU:    1,
				Memory: 1000,
			},
		},
		"istiod with binary limits": {
			istiodMeta: v1.ObjectMeta{
				Name:      "istiod",
				Namespace: "istio-system",
				Labels:    istiodAppLabels,
			},
			istiodConatiner: core_v1.Container{
				Name: "istiod",
				Resources: core_v1.ResourceRequirements{
					Limits: core_v1.ResourceList{
						core_v1.ResourceCPU:    resource.MustParse("14m"),
						core_v1.ResourceMemory: resource.MustParse("1Gi"),
					},
				},
			},
			expected: &models.IstiodThresholds{
				CPU: 0.014,
				// Rounded
				Memory: 1074,
			},
		},
		"istiod with cpu numeral": {
			istiodMeta: v1.ObjectMeta{
				Name:      "istiod",
				Namespace: "istio-system",
				Labels:    istiodAppLabels,
			},
			istiodConatiner: core_v1.Container{
				Name: "istiod",
				Resources: core_v1.ResourceRequirements{
					Limits: core_v1.ResourceList{
						core_v1.ResourceCPU: resource.MustParse("1.5"),
					},
				},
			},
			expected: &models.IstiodThresholds{
				CPU: 1.5,
			},
		},
		"istiod with only cpu limits": {
			istiodMeta: v1.ObjectMeta{
				Name:      "istiod",
				Namespace: "istio-system",
				Labels:    istiodAppLabels,
			},
			istiodConatiner: core_v1.Container{
				Name: "istiod",
				Resources: core_v1.ResourceRequirements{
					Limits: core_v1.ResourceList{
						core_v1.ResourceCPU: resource.MustParse("1000m"),
					},
				},
			},
			expected: &models.IstiodThresholds{
				CPU: 1,
			},
		},
		"istiod with only memory limits": {
			istiodMeta: v1.ObjectMeta{
				Name:      "istiod",
				Namespace: "istio-system",
				Labels:    istiodAppLabels,
			},
			istiodConatiner: core_v1.Container{
				Name: "istiod",
				Resources: core_v1.ResourceRequirements{
					Limits: core_v1.ResourceList{
						core_v1.ResourceMemory: resource.MustParse("1G"),
					},
				},
			},
			expected: &models.IstiodThresholds{
				Memory: 1000,
			},
		},
		"istiod in a different namespace": {
			istiodMeta: v1.ObjectMeta{
				Name:      "istiod",
				Namespace: "istio-system-2",
				Labels:    istiodAppLabels,
			},
			istiodConatiner: core_v1.Container{
				Name: "istiod",
				Resources: core_v1.ResourceRequirements{
					Limits: core_v1.ResourceList{
						core_v1.ResourceMemory: resource.MustParse("1G"),
					},
				},
			},
			expected: &models.IstiodThresholds{
				Memory: 1000,
			},
		},
		"Missing limits": {
			istiodMeta: v1.ObjectMeta{
				Name:      "istiod",
				Namespace: "istio-system",
				Labels:    istiodAppLabels,
			},
			istiodConatiner: core_v1.Container{
				Name:      "istiod",
				Resources: core_v1.ResourceRequirements{},
			},
			expected: &models.IstiodThresholds{},
		},
		"Missing resources": {
			istiodMeta: v1.ObjectMeta{
				Name:      "istiod",
				Namespace: "istio-system",
				Labels:    istiodAppLabels,
			},
			istiodConatiner: core_v1.Container{
				Name: "istiod",
			},
			expected: &models.IstiodThresholds{},
		},
	}

	for name, testCase := range testCases {
		t.Run(name, func(t *testing.T) {
			require := require.New(t)
			istiodDeployment := &apps_v1.Deployment{
				ObjectMeta: testCase.istiodMeta,
				Spec: apps_v1.DeploymentSpec{
					Template: core_v1.PodTemplateSpec{
						Spec: core_v1.PodSpec{
							Containers: []core_v1.Container{
								testCase.istiodConatiner,
							},
						},
					},
				},
			}
			k8s := kubetest.NewFakeK8sClient(
				kubetest.FakeNamespace("istio-system"),
				istiodDeployment,
				FakeCertificateConfigMap("istio-system"),
				&core_v1.ConfigMap{
					ObjectMeta: v1.ObjectMeta{
						Name:      "istio",
						Namespace: "istio-system",
						Labels:    map[string]string{config.IstioRevisionLabel: "default"},
					},
					Data: map[string]string{"mesh": ""},
				},
			)

			clients := map[string]kubernetes.ClientInterface{conf.KubernetesConfig.ClusterName: k8s}
			cache := cache.NewTestingCacheWithClients(t, clients, *conf)
			discovery := istio.NewDiscovery(clients, cache, conf)

			mesh, err := discovery.Mesh(context.Background())
			require.NoError(err)
			require.Len(mesh.ControlPlanes, 1)
			require.Equal(testCase.expected, mesh.ControlPlanes[0].Thresholds)
		})
	}
}

func istiodTestServer(t *testing.T) *httptest.Server {
	t.Helper()
	testServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var file string
		switch r.URL.Path {
		case "/debug/registryz":
			file = "../tests/data/registry/registry-registryz.json"
		case "/debug/syncz":
			file = "../tests/data/registry/registry-syncz.json"
		case "/debug":
			w.WriteHeader(http.StatusOK)
			return
		case "/ready":
			w.WriteHeader(http.StatusOK)
			return
		default:
			w.WriteHeader(http.StatusInternalServerError)
			t.Fatalf("Unexpected request path: %s", r.URL.Path)
			return
		}
		if _, err := w.Write(kubernetes.ReadFile(t, file)); err != nil {
			t.Fatalf("Error writing response: %s", err)
		}
	}))
	t.Cleanup(testServer.Close)
	return testServer
}

func fakeIstioConfigMap(revision string) *core_v1.ConfigMap {
	const configMapData = `accessLogFile: /dev/stdout
enableAutoMtls: true
rootNamespace: istio-system
trustDomain: cluster.local
`
	configMapName := "istio"
	if revision != "default" {
		configMapName = "istio-" + revision
	}
	return &core_v1.ConfigMap{
		ObjectMeta: v1.ObjectMeta{
			Name:      configMapName,
			Namespace: "istio-system",
			Labels:    map[string]string{config.IstioRevisionLabel: revision},
		},
		Data: map[string]string{"mesh": configMapData},
	}
}

type fakeForwarder struct {
	kubernetes.ClientInterface
	testURL string
}

func (f *fakeForwarder) ForwardGetRequest(namespace, podName string, destinationPort int, path string) ([]byte, error) {
	url, _ := url.JoinPath(f.testURL, path)
	resp, err := http.Get(url)
	if err != nil {
		return nil, err
	}

	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	return body, nil
}

func runningIstiodPod(revision string) *core_v1.Pod {
	return &core_v1.Pod{
		ObjectMeta: v1.ObjectMeta{
			Name:      "istiod-123" + "-" + revision,
			Namespace: "istio-system",
			Labels: map[string]string{
				"app":                     "istiod",
				config.IstioRevisionLabel: revision,
			},
		},
		Status: core_v1.PodStatus{
			Phase: core_v1.PodRunning,
		},
	}
}

func TestCanConnectToIstiod(t *testing.T) {
	assert := assert.New(t)
	require := require.New(t)

	conf := config.NewConfig()

	testServer := istiodTestServer(t)
	fakeForwarder := &fakeForwarder{
		ClientInterface: kubetest.NewFakeK8sClient(
			runningIstiodPod("default"),
			fakeIstiodDeployment(conf.KubernetesConfig.ClusterName, false),
			fakeIstioConfigMap("default"),
			FakeCertificateConfigMap("istio-system"),
			kubetest.FakeNamespace("istio-system"),
		),
		testURL: testServer.URL,
	}

	k8sclients := make(map[string]kubernetes.ClientInterface)
	k8sclients[conf.KubernetesConfig.ClusterName] = fakeForwarder
	cache := cache.NewTestingCacheWithClients(t, k8sclients, *conf)
	discovery := istio.NewDiscovery(k8sclients, cache, conf)

	mesh, err := discovery.Mesh(context.Background())
	require.NoError(err)
	require.Len(mesh.ControlPlanes, 1)
	assert.Equal(kubernetes.ComponentHealthy, mesh.ControlPlanes[0].Status)
}

type badForwarder struct {
	kubernetes.ClientInterface
}

func (f *badForwarder) ForwardGetRequest(namespace, podName string, destinationPort int, path string) ([]byte, error) {
	return nil, fmt.Errorf("unable to forward request")
}

func TestCanConnectToUnreachableIstiod(t *testing.T) {
	assert := assert.New(t)
	require := require.New(t)

	conf := config.NewConfig()

	fakeForwarder := &badForwarder{
		ClientInterface: kubetest.NewFakeK8sClient(
			runningIstiodPod("default"),
			fakeIstiodDeployment(conf.KubernetesConfig.ClusterName, false),
			fakeIstioConfigMap("default"),
			FakeCertificateConfigMap("istio-system"),
			kubetest.FakeNamespace("istio-system"),
		),
	}

	k8sclients := make(map[string]kubernetes.ClientInterface)
	k8sclients[conf.KubernetesConfig.ClusterName] = fakeForwarder
	cache := cache.NewTestingCacheWithClients(t, k8sclients, *conf)
	discovery := istio.NewDiscovery(k8sclients, cache, conf)

	mesh, err := discovery.Mesh(context.Background())
	require.NoError(err)
	require.Len(mesh.ControlPlanes, 1)
	assert.Equal(kubernetes.ComponentUnreachable, mesh.ControlPlanes[0].Status)
}

func fakeIstiodWithRevision(cluster string, revision string, manageExternal bool) *apps_v1.Deployment {
	deployment := fakeIstiodDeployment(cluster, manageExternal)
	deployment.Labels[config.IstioRevisionLabel] = revision
	deployment.Name = "istiod-" + revision
	return deployment
}

func TestUpdateStatusMultipleRevsWithoutHealthyPods(t *testing.T) {
	require := require.New(t)

	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "Kubernetes"

	defaultIstiod := fakeIstiodDeployment(conf.KubernetesConfig.ClusterName, false)
	istiod_1_19 := fakeIstiodWithRevision(conf.KubernetesConfig.ClusterName, "1-19-0", false)

	k8s := kubetest.NewFakeK8sClient(
		kubetest.FakeNamespace("istio-system"),
		defaultIstiod,
		istiod_1_19,
		fakeIstioConfigMap("default"),
		fakeIstioConfigMap("1-19-0"),
		FakeCertificateConfigMap("istio-system"),
	)
	// RefreshIstioCache relies on this being set.
	k8s.KubeClusterInfo.Name = conf.KubernetesConfig.ClusterName

	testServer := istiodTestServer(t)
	fakeForwarder := &fakeForwarder{
		ClientInterface: k8s,
		testURL:         testServer.URL,
	}

	k8sclients := make(map[string]kubernetes.ClientInterface)
	k8sclients[conf.KubernetesConfig.ClusterName] = fakeForwarder
	cache := cache.NewTestingCacheWithClients(t, k8sclients, *conf)
	discovery := istio.NewDiscovery(k8sclients, cache, conf)

	mesh, err := discovery.Mesh(context.Background())
	require.NoError(err)
	require.Len(mesh.ControlPlanes, 2)

	require.Equal(kubernetes.ComponentNotReady, mesh.ControlPlanes[0].Status)
	require.Equal(kubernetes.ComponentNotReady, mesh.ControlPlanes[1].Status)
}

func TestUpdateStatusMultipleHealthyRevs(t *testing.T) {
	require := require.New(t)

	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "Kubernetes"

	defaultIstiod := fakeIstiodDeployment(conf.KubernetesConfig.ClusterName, false)
	istiod_1_19 := fakeIstiodWithRevision(conf.KubernetesConfig.ClusterName, "1-19-0", false)
	defaultPod := runningIstiodPod("default")
	defaultPod.Labels[config.IstioRevisionLabel] = "default"
	istiod_1_19_pod := runningIstiodPod("1-19-0")
	istiod_1_19_pod.Labels[config.IstioRevisionLabel] = "1-19-0"

	k8s := kubetest.NewFakeK8sClient(
		kubetest.FakeNamespace("istio-system"),
		defaultIstiod,
		istiod_1_19,
		fakeIstioConfigMap("default"),
		fakeIstioConfigMap("1-19-0"),
		defaultPod,
		istiod_1_19_pod,
		FakeCertificateConfigMap("istio-system"),
	)
	// RefreshIstioCache relies on this being set.
	k8s.KubeClusterInfo.Name = conf.KubernetesConfig.ClusterName

	testServer := istiodTestServer(t)
	fakeForwarder := &fakeForwarder{
		ClientInterface: k8s,
		testURL:         testServer.URL,
	}

	k8sclients := make(map[string]kubernetes.ClientInterface)
	k8sclients[conf.KubernetesConfig.ClusterName] = fakeForwarder
	cache := cache.NewTestingCacheWithClients(t, k8sclients, *conf)
	discovery := istio.NewDiscovery(k8sclients, cache, conf)

	mesh, err := discovery.Mesh(context.Background())
	require.NoError(err)
	require.Len(mesh.ControlPlanes, 2)

	require.Equal(kubernetes.ComponentHealthy, mesh.ControlPlanes[0].Status)
	require.Equal(kubernetes.ComponentHealthy, mesh.ControlPlanes[1].Status)
}

type accessReviewClient struct {
	kubernetes.ClientInterface
	AccessReview []*authv1.SelfSubjectAccessReview
}

func (a *accessReviewClient) GetSelfSubjectAccessReview(ctx context.Context, namespace, api, resourceType string, verbs []string) ([]*authv1.SelfSubjectAccessReview, error) {
	return a.AccessReview, nil
}

type clusterRevisionKey struct {
	Cluster              string
	ControlPlaneRevision string
}

func TestDiscoverWithTags(t *testing.T) {
	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "Kubernetes"

	defaultIstiod := fakeIstiodDeployment(conf.KubernetesConfig.ClusterName, false)
	defaultWebhook := &admissionregistrationv1.MutatingWebhookConfiguration{
		ObjectMeta: v1.ObjectMeta{
			Name: "istio-revision-tag-default",
			Labels: map[string]string{
				config.IstioRevisionLabel: "default",
				models.IstioTagLabel:      "default",
			},
		},
	}

	allowedToListWebhookReview := &authv1.SelfSubjectAccessReview{
		Spec: authv1.SelfSubjectAccessReviewSpec{
			ResourceAttributes: &authv1.ResourceAttributes{
				Verb:     "list",
				Resource: "mutatingwebhookconfigurations",
				Group:    "admissionregistration.k8s.io",
			},
		},
		Status: authv1.SubjectAccessReviewStatus{
			Allowed: true,
		},
	}

	cases := map[string]struct {
		conf                    *config.Config
		setup                   func() map[string][]runtime.Object
		expectedNamespacesByRev map[clusterRevisionKey][]string
	}{
		"bookinfo with no label should not be managed": {
			setup: func() map[string][]runtime.Object {
				return map[string][]runtime.Object{
					conf.KubernetesConfig.ClusterName: {
						&core_v1.Namespace{ObjectMeta: v1.ObjectMeta{Name: "bookinfo"}},
						defaultWebhook,
						defaultIstiod,
						&core_v1.Namespace{ObjectMeta: v1.ObjectMeta{Name: "istio-system"}},
						fakeIstioConfigMap("default"),
						FakeCertificateConfigMap("istio-system"),
					},
				}
			},
			expectedNamespacesByRev: map[clusterRevisionKey][]string{
				{Cluster: conf.KubernetesConfig.ClusterName, ControlPlaneRevision: "default"}: nil,
			},
		},
		"bookinfo with ambient should be managed by the default controlplane": {
			setup: func() map[string][]runtime.Object {
				return map[string][]runtime.Object{
					conf.KubernetesConfig.ClusterName: {
						&core_v1.Namespace{ObjectMeta: v1.ObjectMeta{Name: "bookinfo", Labels: map[string]string{istio.IstioDataplaneModeLabelKey: istio.AmbientDataplaneModeLabelValue}}},
						defaultWebhook,
						defaultIstiod,
						&core_v1.Namespace{ObjectMeta: v1.ObjectMeta{Name: "istio-system"}},
						fakeIstioConfigMap("default"),
						FakeCertificateConfigMap("istio-system"),
					},
				}
			},
			expectedNamespacesByRev: map[clusterRevisionKey][]string{
				{Cluster: conf.KubernetesConfig.ClusterName, ControlPlaneRevision: "default"}: nil,
			},
		},
		"bookinfo with default tag should manage one namespace": {
			setup: func() map[string][]runtime.Object {
				return map[string][]runtime.Object{
					conf.KubernetesConfig.ClusterName: {
						&core_v1.Namespace{ObjectMeta: v1.ObjectMeta{Name: "bookinfo", Labels: map[string]string{config.IstioRevisionLabel: "default"}}},
						defaultWebhook,
						defaultIstiod,
						&core_v1.Namespace{ObjectMeta: v1.ObjectMeta{Name: "istio-system"}},
						fakeIstioConfigMap("default"),
						FakeCertificateConfigMap("istio-system"),
					},
				}
			},
			expectedNamespacesByRev: map[clusterRevisionKey][]string{
				{Cluster: conf.KubernetesConfig.ClusterName, ControlPlaneRevision: "default"}: {"bookinfo"},
			},
		},
		"bookinfo with injection-enabled label and default tag should manage one namespace": {
			setup: func() map[string][]runtime.Object {
				return map[string][]runtime.Object{
					conf.KubernetesConfig.ClusterName: {
						&core_v1.Namespace{ObjectMeta: v1.ObjectMeta{Name: "bookinfo", Labels: map[string]string{models.IstioInjectionLabel: "enabled"}}},
						defaultWebhook,
						defaultIstiod,
						&core_v1.Namespace{ObjectMeta: v1.ObjectMeta{Name: "istio-system"}},
						fakeIstioConfigMap("default"),
						FakeCertificateConfigMap("istio-system"),
					},
				}
			},
			expectedNamespacesByRev: map[clusterRevisionKey][]string{
				{Cluster: conf.KubernetesConfig.ClusterName, ControlPlaneRevision: "default"}: {"bookinfo"},
			},
		},
		"bookinfo with rev label and default tag should manage 0 namespaces": {
			setup: func() map[string][]runtime.Object {
				return map[string][]runtime.Object{
					conf.KubernetesConfig.ClusterName: {
						&core_v1.Namespace{ObjectMeta: v1.ObjectMeta{Name: "bookinfo", Labels: map[string]string{config.IstioRevisionLabel: "1.23.0"}}},
						defaultWebhook,
						defaultIstiod,
						&core_v1.Namespace{ObjectMeta: v1.ObjectMeta{Name: "istio-system"}},
						fakeIstioConfigMap("default"),
						FakeCertificateConfigMap("istio-system"),
					},
				}
			},
			expectedNamespacesByRev: map[clusterRevisionKey][]string{
				{Cluster: conf.KubernetesConfig.ClusterName, ControlPlaneRevision: "default"}: nil,
			},
		},
		"bookinfo with rev prod and tag default should manage 0 namespaces": {
			setup: func() map[string][]runtime.Object {
				return map[string][]runtime.Object{
					conf.KubernetesConfig.ClusterName: {
						&core_v1.Namespace{ObjectMeta: v1.ObjectMeta{Name: "bookinfo", Labels: map[string]string{config.IstioRevisionLabel: "prod"}}},
						defaultWebhook,
						defaultIstiod,
						&core_v1.Namespace{ObjectMeta: v1.ObjectMeta{Name: "istio-system"}},
						fakeIstioConfigMap("default"),
						FakeCertificateConfigMap("istio-system"),
					},
				}
			},
			expectedNamespacesByRev: map[clusterRevisionKey][]string{
				{Cluster: conf.KubernetesConfig.ClusterName, ControlPlaneRevision: "default"}: nil,
			},
		},
		"bookinfo namespace has rev prod and tag prod with istio rev 1.23.0": {
			setup: func() map[string][]runtime.Object {
				tagProd := &admissionregistrationv1.MutatingWebhookConfiguration{
					ObjectMeta: v1.ObjectMeta{
						Name: "istio-revision-tag-prod",
						Labels: map[string]string{
							config.IstioRevisionLabel: "1.23.0",
							models.IstioTagLabel:      "prod",
						},
					},
				}
				// Add in another tag to add noise and ensure the proper tag gets picked up.
				tagDev := &admissionregistrationv1.MutatingWebhookConfiguration{
					ObjectMeta: v1.ObjectMeta{
						Name: "istio-revision-tag-dev",
						Labels: map[string]string{
							config.IstioRevisionLabel: "1.22.0",
							models.IstioTagLabel:      "dev",
						},
					},
				}
				istiod_1_22 := fakeIstiodDeployment(conf.KubernetesConfig.ClusterName, false)
				istiod_1_22.Name = "istiod-1-22-0"
				istiod_1_22.Labels[config.IstioRevisionLabel] = "1.22.0"
				istiod_1_23 := fakeIstiodDeployment(conf.KubernetesConfig.ClusterName, false)
				istiod_1_23.Name = "istiod-1-23-0"
				istiod_1_23.Labels[config.IstioRevisionLabel] = "1.23.0"
				return map[string][]runtime.Object{
					conf.KubernetesConfig.ClusterName: {
						defaultWebhook,
						&core_v1.Namespace{ObjectMeta: v1.ObjectMeta{Name: "bookinfo", Labels: map[string]string{config.IstioRevisionLabel: "prod"}}},
						tagProd,
						tagDev,
						istiod_1_23,
						istiod_1_22,
						fakeIstioConfigMap("1.22.0"),
						&core_v1.Namespace{ObjectMeta: v1.ObjectMeta{Name: "istio-system"}},
						fakeIstioConfigMap("1.23.0"),
						FakeCertificateConfigMap("istio-system"),
					},
				}
			},
			expectedNamespacesByRev: map[clusterRevisionKey][]string{
				{Cluster: conf.KubernetesConfig.ClusterName, ControlPlaneRevision: "1.23.0"}: {"bookinfo"},
				{Cluster: conf.KubernetesConfig.ClusterName, ControlPlaneRevision: "1.22.0"}: nil,
			},
		},
		"bookinfo namespace not selected by discovery selectors": {
			setup: func() map[string][]runtime.Object {
				istioConfigMap := fakeIstioConfigMap("default")
				istioConfigMap.Data["mesh"] = `discoverySelectors:
  - matchLabels:
      include: "true"
`
				return map[string][]runtime.Object{
					conf.KubernetesConfig.ClusterName: {
						fakeIstiodDeployment(conf.KubernetesConfig.ClusterName, false),
						defaultWebhook,
						&core_v1.Namespace{ObjectMeta: v1.ObjectMeta{Name: "bookinfo", Labels: map[string]string{config.IstioRevisionLabel: "default"}}},
						&core_v1.Namespace{ObjectMeta: v1.ObjectMeta{Name: "istio-system"}},
						istioConfigMap,
						FakeCertificateConfigMap("istio-system"),
					},
				}
			},
			expectedNamespacesByRev: map[clusterRevisionKey][]string{
				{Cluster: conf.KubernetesConfig.ClusterName, ControlPlaneRevision: "default"}: nil,
			},
		},
		"bookinfo namespace is selected by discovery selectors": {
			setup: func() map[string][]runtime.Object {
				istioConfigMap := fakeIstioConfigMap("default")
				istioConfigMap.Data["mesh"] = `discoverySelectors:
  - matchLabels:
      include: "true"
`
				return map[string][]runtime.Object{
					conf.KubernetesConfig.ClusterName: {
						fakeIstiodDeployment(conf.KubernetesConfig.ClusterName, false),
						defaultWebhook,
						&core_v1.Namespace{
							ObjectMeta: v1.ObjectMeta{
								Name: "bookinfo",
								Labels: map[string]string{
									config.IstioRevisionLabel: "default",
									"include":                 "true",
								},
							},
						},
						&core_v1.Namespace{ObjectMeta: v1.ObjectMeta{Name: "istio-system"}},
						istioConfigMap,
						FakeCertificateConfigMap("istio-system"),
					},
				}
			},
			expectedNamespacesByRev: map[clusterRevisionKey][]string{
				{Cluster: conf.KubernetesConfig.ClusterName, ControlPlaneRevision: "default"}: {"bookinfo"},
			},
		},
		"accessible namespaces specified and bookinfo included": {
			conf: func() *config.Config {
				conf := *conf
				conf.Deployment.AccessibleNamespaces = []string{"bookinfo", "istio-system"}
				conf.Deployment.ClusterWideAccess = false
				return &conf
			}(),
			setup: func() map[string][]runtime.Object {
				return map[string][]runtime.Object{
					conf.KubernetesConfig.ClusterName: {
						fakeIstiodDeployment(conf.KubernetesConfig.ClusterName, false),
						defaultWebhook,
						&core_v1.Namespace{ObjectMeta: v1.ObjectMeta{Name: "bookinfo", Labels: map[string]string{config.IstioRevisionLabel: "default"}}},
						&core_v1.Namespace{ObjectMeta: v1.ObjectMeta{Name: "istio-system"}},
						fakeIstioConfigMap("default"),
						FakeCertificateConfigMap("istio-system"),
					},
				}
			},
			expectedNamespacesByRev: map[clusterRevisionKey][]string{
				{Cluster: conf.KubernetesConfig.ClusterName, ControlPlaneRevision: "default"}: {"bookinfo"},
			},
		},
		"accessible namespaces specified and bookinfo not included": {
			conf: func() *config.Config {
				conf := *conf
				conf.Deployment.AccessibleNamespaces = []string{"istio-system"}
				conf.Deployment.ClusterWideAccess = false
				return &conf
			}(),
			setup: func() map[string][]runtime.Object {
				return map[string][]runtime.Object{
					conf.KubernetesConfig.ClusterName: {
						fakeIstiodDeployment(conf.KubernetesConfig.ClusterName, false),
						defaultWebhook,
						&core_v1.Namespace{ObjectMeta: v1.ObjectMeta{Name: "bookinfo", Labels: map[string]string{config.IstioRevisionLabel: "default"}}},
						&core_v1.Namespace{ObjectMeta: v1.ObjectMeta{Name: "istio-system"}},
						fakeIstioConfigMap("default"),
						FakeCertificateConfigMap("istio-system"),
					},
				}
			},
			expectedNamespacesByRev: map[clusterRevisionKey][]string{
				{Cluster: conf.KubernetesConfig.ClusterName, ControlPlaneRevision: "default"}: nil,
			},
		},
		"namespaces with different tags and multiple istio revs each should manage 1 namespace": {
			setup: func() map[string][]runtime.Object {
				tagProd := &admissionregistrationv1.MutatingWebhookConfiguration{
					ObjectMeta: v1.ObjectMeta{
						Name: "istio-revision-tag-prod",
						Labels: map[string]string{
							config.IstioRevisionLabel: "1-23-0",
							models.IstioTagLabel:      "prod",
						},
					},
				}
				tagCanary := &admissionregistrationv1.MutatingWebhookConfiguration{
					ObjectMeta: v1.ObjectMeta{
						Name: "istio-revision-tag-canary",
						Labels: map[string]string{
							config.IstioRevisionLabel: "1-24-0",
							models.IstioTagLabel:      "canary",
						},
					},
				}
				istiod_1_23 := fakeIstiodDeployment(conf.KubernetesConfig.ClusterName, false)
				istiod_1_23.Labels[config.IstioRevisionLabel] = "1-23-0"
				istiod_1_23.Name = "istiod-1-23-0"
				istiod_1_24 := fakeIstiodDeployment(conf.KubernetesConfig.ClusterName, false)
				istiod_1_24.Labels[config.IstioRevisionLabel] = "1-24-0"
				istiod_1_23.Name = "istiod-1-24-0"
				return map[string][]runtime.Object{
					conf.KubernetesConfig.ClusterName: {
						defaultWebhook,
						tagProd,
						tagCanary,
						&core_v1.Namespace{ObjectMeta: v1.ObjectMeta{Name: "bookinfo", Labels: map[string]string{config.IstioRevisionLabel: "prod"}}},
						&core_v1.Namespace{ObjectMeta: v1.ObjectMeta{Name: "travels", Labels: map[string]string{config.IstioRevisionLabel: "canary"}}},
						istiod_1_23,
						istiod_1_24,
						&core_v1.Namespace{ObjectMeta: v1.ObjectMeta{Name: "istio-system"}},
						fakeIstioConfigMap("1-23-0"),
						fakeIstioConfigMap("1-24-0"),
						FakeCertificateConfigMap("istio-system"),
					},
				}
			},
			expectedNamespacesByRev: map[clusterRevisionKey][]string{
				{Cluster: conf.KubernetesConfig.ClusterName, ControlPlaneRevision: "1-23-0"}: {"bookinfo"},
				{Cluster: conf.KubernetesConfig.ClusterName, ControlPlaneRevision: "1-24-0"}: {"travels"},
			},
		},
		"primary-remote with default tag should manage bookinfo on primary cluster": {
			conf: func() *config.Config {
				conf := *conf
				conf.KubernetesConfig.ClusterName = "primary"
				return &conf
			}(),
			setup: func() map[string][]runtime.Object {
				primary := fakeIstiodDeployment("primary", true)
				return map[string][]runtime.Object{
					"primary": {
						&core_v1.Namespace{ObjectMeta: v1.ObjectMeta{Name: "bookinfo", Labels: map[string]string{config.IstioRevisionLabel: "default"}}},
						defaultWebhook,
						primary,
						&core_v1.Namespace{ObjectMeta: v1.ObjectMeta{Name: "istio-system"}},
						fakeIstioConfigMap("default"),
						FakeCertificateConfigMap("istio-system"),
					},
					"remote": {
						&core_v1.Namespace{ObjectMeta: v1.ObjectMeta{Name: "bookinfo", Labels: map[string]string{config.IstioRevisionLabel: "default"}}},
						defaultWebhook,
						&core_v1.Namespace{ObjectMeta: v1.ObjectMeta{Name: "istio-system", Annotations: map[string]string{"topology.istio.io/controlPlaneClusters": "primary"}}},
						FakeCertificateConfigMap("istio-system"),
					},
				}
			},
			expectedNamespacesByRev: map[clusterRevisionKey][]string{
				{Cluster: "primary", ControlPlaneRevision: "default"}: {"bookinfo", "bookinfo"},
			},
		},
		"primary-remote with tag should manage bookinfo on primary cluster": {
			conf: func() *config.Config {
				conf := *conf
				conf.KubernetesConfig.ClusterName = "primary"
				return &conf
			}(),
			setup: func() map[string][]runtime.Object {
				tagProd := &admissionregistrationv1.MutatingWebhookConfiguration{
					ObjectMeta: v1.ObjectMeta{
						Name: "istio-revision-tag-prod",
						Labels: map[string]string{
							config.IstioRevisionLabel: "1-23-0",
							models.IstioTagLabel:      "prod",
						},
					},
				}
				primary := fakeIstiodDeployment("primary", true)
				primary.Labels[config.IstioRevisionLabel] = "1-23-0"
				primary.Name = "istiod-1-23-0"
				return map[string][]runtime.Object{
					"primary": {
						&core_v1.Namespace{ObjectMeta: v1.ObjectMeta{Name: "bookinfo", Labels: map[string]string{config.IstioRevisionLabel: "prod"}}},
						defaultWebhook,
						tagProd,
						primary,
						&core_v1.Namespace{ObjectMeta: v1.ObjectMeta{Name: "istio-system"}},
						fakeIstioConfigMap("1-23-0"),
						FakeCertificateConfigMap("istio-system"),
					},
					"remote": {
						&core_v1.Namespace{ObjectMeta: v1.ObjectMeta{Name: "bookinfo", Labels: map[string]string{config.IstioRevisionLabel: "prod"}}},
						tagProd,
						&core_v1.Namespace{ObjectMeta: v1.ObjectMeta{Name: "istio-system", Annotations: map[string]string{"topology.istio.io/controlPlaneClusters": "primary"}}},
						FakeCertificateConfigMap("istio-system"),
					},
				}
			},
			expectedNamespacesByRev: map[clusterRevisionKey][]string{
				{Cluster: "primary", ControlPlaneRevision: "1-23-0"}: {"bookinfo"},
			},
		},
		"multi-primary with tag should only manage bookinfo on their own cluster": {
			conf: func() *config.Config {
				conf := *conf
				conf.KubernetesConfig.ClusterName = "east"
				return &conf
			}(),
			setup: func() map[string][]runtime.Object {
				tagProdEast := &admissionregistrationv1.MutatingWebhookConfiguration{
					ObjectMeta: v1.ObjectMeta{
						Name: "istio-revision-tag-prod",
						Labels: map[string]string{
							config.IstioRevisionLabel: "1-23-0",
							models.IstioTagLabel:      "prod",
						},
					},
				}
				east := fakeIstiodDeployment("east", true)
				east.Labels[config.IstioRevisionLabel] = "1-23-0"
				east.Name = "istiod-1-23-0"
				tagProdWest := &admissionregistrationv1.MutatingWebhookConfiguration{
					ObjectMeta: v1.ObjectMeta{
						Name: "istio-revision-tag-prod",
						Labels: map[string]string{
							config.IstioRevisionLabel: "1-23-0",
							models.IstioTagLabel:      "prod",
						},
					},
				}
				west := fakeIstiodDeployment("west", true)
				west.Labels[config.IstioRevisionLabel] = "1-23-0"
				west.Name = "istiod-1-23-0"
				return map[string][]runtime.Object{
					"east": {
						&core_v1.Namespace{ObjectMeta: v1.ObjectMeta{Name: "bookinfo", Labels: map[string]string{config.IstioRevisionLabel: "prod"}}},
						defaultWebhook,
						tagProdEast,
						east,
						&core_v1.Namespace{ObjectMeta: v1.ObjectMeta{Name: "istio-system"}},
						fakeIstioConfigMap("1-23-0"),
						FakeCertificateConfigMap("istio-system"),
					},
					"west": {
						&core_v1.Namespace{ObjectMeta: v1.ObjectMeta{Name: "bookinfo", Labels: map[string]string{config.IstioRevisionLabel: "prod"}}},
						defaultWebhook,
						tagProdWest,
						west,
						&core_v1.Namespace{ObjectMeta: v1.ObjectMeta{Name: "istio-system"}},
						fakeIstioConfigMap("1-23-0"),
						FakeCertificateConfigMap("istio-system"),
					},
				}
			},
			expectedNamespacesByRev: map[clusterRevisionKey][]string{
				{Cluster: "east", ControlPlaneRevision: "1-23-0"}: {"bookinfo"},
				{Cluster: "west", ControlPlaneRevision: "1-23-0"}: {"bookinfo"},
			},
		},
	}
	for name, tc := range cases {
		t.Run(name, func(t *testing.T) {
			require := require.New(t)
			conf := *conf
			if tc.conf != nil {
				conf = *tc.conf
			}

			clients := make(map[string]kubernetes.ClientInterface)
			for cluster, objects := range tc.setup() {
				k8s := kubetest.NewFakeK8sClient(objects...)
				client := &accessReviewClient{
					ClientInterface: k8s,
					AccessReview:    []*authv1.SelfSubjectAccessReview{allowedToListWebhookReview},
				}
				clients[cluster] = client
			}
			cache := cache.NewTestingCacheWithClients(t, clients, conf)
			discovery := istio.NewDiscovery(clients, cache, &conf)

			mesh, err := discovery.Mesh(context.Background())
			require.NoError(err)
			require.Len(mesh.ControlPlanes, len(maps.Keys(tc.expectedNamespacesByRev)))
			for _, cp := range mesh.ControlPlanes {
				require.NotNil(cp.Tag)
				require.Equal(cp.Revision, cp.Tag.Revision)
			}
			for clusterRev, expectedNamespaces := range tc.expectedNamespacesByRev {
				controlPlane := slicetest.FindOrFail(t, mesh.ControlPlanes, func(cp models.ControlPlane) bool {
					return cp.Revision == clusterRev.ControlPlaneRevision && cp.Cluster.Name == clusterRev.Cluster
				})
				require.Len(controlPlane.ManagedNamespaces, len(expectedNamespaces))
				for _, ns := range expectedNamespaces {
					require.True(slices.ContainsFunc(controlPlane.ManagedNamespaces, func(n models.Namespace) bool {
						return n.Name == ns
					}), "expected namespace %s to be managed by control plane %s", ns, clusterRev)
				}
			}
		})
	}
}

func TestDiscoverTagsWithoutWebhookPermissions(t *testing.T) {
	require := require.New(t)

	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "Kubernetes"
	istiodDeployment := fakeIstiodDeployment("Kubernetes", false)
	istioConfigMap := fakeIstioConfigMap("default")

	defaultWebhook := &admissionregistrationv1.MutatingWebhookConfiguration{
		ObjectMeta: v1.ObjectMeta{
			Name: "istio-revision-tag-default",
			Labels: map[string]string{
				config.IstioRevisionLabel: "default",
				models.IstioTagLabel:      "default",
			},
		},
	}

	allowedToListWebhookReview := &authv1.SelfSubjectAccessReview{
		Spec: authv1.SelfSubjectAccessReviewSpec{
			ResourceAttributes: &authv1.ResourceAttributes{
				Verb:     "list",
				Resource: "mutatingwebhookconfigurations",
				Group:    "admissionregistration.k8s.io",
			},
		},
		Status: authv1.SubjectAccessReviewStatus{
			Allowed: false,
		},
	}
	k8s := kubetest.NewFakeK8sClient(
		defaultWebhook,
		&core_v1.Namespace{ObjectMeta: v1.ObjectMeta{Name: "istio-system"}},
		&core_v1.Namespace{ObjectMeta: v1.ObjectMeta{Name: "bookinfo", Labels: map[string]string{config.IstioRevisionLabel: "default"}}},
		istiodDeployment,
		istioConfigMap,
		FakeCertificateConfigMap("istio-system"),
	)
	client := &accessReviewClient{
		ClientInterface: k8s,
		AccessReview:    []*authv1.SelfSubjectAccessReview{allowedToListWebhookReview},
	}
	clients := map[string]kubernetes.ClientInterface{conf.KubernetesConfig.ClusterName: client}
	cache := cache.NewTestingCacheWithClients(t, clients, *conf)
	discovery := istio.NewDiscovery(clients, cache, conf)
	require.False(cache.CanListWebhooks(conf.KubernetesConfig.ClusterName))

	mesh, err := discovery.Mesh(context.TODO())
	require.NoError(err)
	require.Len(mesh.ControlPlanes, 1)
	require.Nil(mesh.ControlPlanes[0].Tag)
}

func approvingClient(client kubernetes.ClientInterface) *accessReviewClient {
	return &accessReviewClient{
		ClientInterface: client,
		AccessReview: []*authv1.SelfSubjectAccessReview{
			{
				Spec: authv1.SelfSubjectAccessReviewSpec{
					ResourceAttributes: &authv1.ResourceAttributes{
						Verb:     "list",
						Resource: "mutatingwebhookconfigurations",
						Group:    "admissionregistration.k8s.io",
					},
				},
				Status: authv1.SubjectAccessReviewStatus{
					Allowed: true,
				},
			},
		},
	}
}

func fakeDefaultWebhook() *admissionregistrationv1.MutatingWebhookConfiguration {
	return &admissionregistrationv1.MutatingWebhookConfiguration{
		ObjectMeta: v1.ObjectMeta{
			Name: "istio-revision-tag-default",
			Labels: map[string]string{
				config.IstioRevisionLabel: "default",
				models.IstioTagLabel:      "default",
			},
		},
	}
}

func TestDiscoverTagsWithExternalCluster(t *testing.T) {
	require := require.New(t)

	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "external"
	t.Cleanup(func() { config.Set(config.NewConfig()) })
	config.Set(conf)

	external := fakeIstiodDeployment("remote", true)
	external.Labels[config.IstioRevisionLabel] = "1-23-0"
	external.Name = "istiod-1-23-0"
	external.Namespace = "external"
	externalConfigMap := fakeIstioConfigMap("1-23-0")
	externalConfigMap.Namespace = "external"
	tagProdRemote := fakeDefaultWebhook()
	tagProdRemote.Labels[config.IstioRevisionLabel] = "1-23-0"
	tagProdRemote.Labels[models.IstioTagLabel] = "prod"
	clients := map[string]kubernetes.ClientInterface{
		"external": approvingClient(kubetest.NewFakeK8sClient(
			fakeDefaultWebhook(),
			&core_v1.Namespace{ObjectMeta: v1.ObjectMeta{Name: "istio-system"}},
			&core_v1.Namespace{ObjectMeta: v1.ObjectMeta{Name: "external"}},
			external,
			externalConfigMap,
			fakeIstioConfigMap("default"),
			fakeIstiodDeployment("external", false),
			FakeCertificateConfigMap("istio-system"),
			FakeCertificateConfigMap("external"),
		)),
		"remote": approvingClient(kubetest.NewFakeK8sClient(
			&core_v1.Namespace{ObjectMeta: v1.ObjectMeta{Name: "bookinfo", Labels: map[string]string{config.IstioRevisionLabel: "prod"}}},
			tagProdRemote,
			&core_v1.Namespace{ObjectMeta: v1.ObjectMeta{Name: "external"}},
		)),
	}

	cache := cache.NewTestingCacheWithClients(t, clients, *conf)
	discovery := istio.NewDiscovery(clients, cache, conf)

	mesh, err := discovery.Mesh(context.TODO())
	require.NoError(err)
	require.Len(mesh.ControlPlanes, 2)

	externalIstioSystem := slicetest.FindOrFail(t, mesh.ControlPlanes, func(cp models.ControlPlane) bool {
		return cp.ID == "external"
	})
	externalControlPlane := slicetest.FindOrFail(t, mesh.ControlPlanes, func(cp models.ControlPlane) bool {
		return cp.ID == "remote"
	})
	require.NotNil(externalIstioSystem.Tag)
	require.NotNil(externalControlPlane.Tag)

	require.Equal(externalIstioSystem.Tag.Revision, externalIstioSystem.Revision)
	require.Equal(externalIstioSystem.Tag.Cluster, externalIstioSystem.Cluster.Name)
	require.Equal(externalControlPlane.Tag.Revision, externalControlPlane.Revision)
	require.NotEqual(externalControlPlane.Tag.Cluster, externalControlPlane.Cluster.Name)
	require.Equal(externalControlPlane.Tag.Cluster, externalControlPlane.ID)

	expectedNamespaces := []models.Namespace{{Name: "bookinfo", Cluster: "remote", Labels: map[string]string{config.IstioRevisionLabel: "prod"}, Revision: "prod"}}
	require.Equal(expectedNamespaces, externalControlPlane.ManagedNamespaces)
}

func TestDiscoverWithMaistra(t *testing.T) {
	conf := config.NewConfig()

	defaultIstiod := fakeIstiodDeployment(conf.KubernetesConfig.ClusterName, false)

	maistraIstiod := defaultIstiod.DeepCopy()
	maistraIstiod.Name = "istiod-basic"
	maistraIstiod.Labels["maistra.io/owner"] = "basic"
	maistraIstiod.Labels["istio.io/rev"] = "basic"

	cases := map[string]struct {
		BookinfoLabels            map[string]string
		ExpectedMaistraNamespaces []string
		ExpectedIstioNamespaces   []string
	}{
		"maistra manages bookinfo": {
			BookinfoLabels:            map[string]string{"maistra.io/member-of": "istio-system", "istio.io/rev": "default"},
			ExpectedMaistraNamespaces: []string{"bookinfo"},
		},
		"istiod manages bookinfo": {
			BookinfoLabels:          map[string]string{"istio.io/rev": "default"},
			ExpectedIstioNamespaces: []string{"bookinfo"},
		},
		"maistra ignore label - istiod manages bookinfo": {
			BookinfoLabels: map[string]string{
				"maistra.io/member-of":        "istio-system",
				"maistra.io/ignore-namespace": "true",
				"istio.io/rev":                "default",
			},
			ExpectedIstioNamespaces: []string{"bookinfo"},
		},
		"no maistra label - no istiod label": {
			BookinfoLabels: map[string]string{},
		},
	}
	for name, tc := range cases {
		t.Run(name, func(t *testing.T) {
			require := require.New(t)
			bookinfo := &core_v1.Namespace{
				ObjectMeta: v1.ObjectMeta{
					Name:   "bookinfo",
					Labels: tc.BookinfoLabels,
				},
			}

			client := kubetest.NewFakeK8sClient(
				bookinfo,
				defaultIstiod,
				maistraIstiod,
				&core_v1.Namespace{ObjectMeta: v1.ObjectMeta{Name: "istio-system"}},
				fakeIstioConfigMap("default"),
				fakeIstioConfigMap("basic"),
				FakeCertificateConfigMap("istio-system"),
			)
			cache := cache.NewTestingCache(t, client, *conf)
			discovery := istio.NewDiscovery(map[string]kubernetes.ClientInterface{conf.KubernetesConfig.ClusterName: client}, cache, conf)

			mesh, err := discovery.Mesh(context.TODO())
			require.NoError(err)
			require.Len(mesh.ControlPlanes, 2)

			istiod := slicetest.FindOrFail(t, mesh.ControlPlanes, func(cp models.ControlPlane) bool {
				return cp.IstiodName == "istiod"
			})
			maistra := slicetest.FindOrFail(t, mesh.ControlPlanes, func(cp models.ControlPlane) bool {
				return cp.IstiodName == "istiod-basic"
			})

			require.False(istiod.IsMaistra())
			require.True(maistra.IsMaistra())

			require.Len(istiod.ManagedNamespaces, len(tc.ExpectedIstioNamespaces))
			require.Len(maistra.ManagedNamespaces, len(tc.ExpectedMaistraNamespaces))
			if len(tc.ExpectedIstioNamespaces) > 0 {
				require.Equal("bookinfo", istiod.ManagedNamespaces[0].Name)
			} else if len(tc.ExpectedMaistraNamespaces) > 0 {
				require.Equal("bookinfo", maistra.ManagedNamespaces[0].Name)
			}
		})
	}
}

func TestSharedMeshConfig(t *testing.T) {
	conf := config.NewConfig()

	cases := map[string]struct {
		IstiodPodSpec      *core_v1.PodSpec
		SharedMeshConfig   *core_v1.ConfigMap
		StandardMeshConfig *core_v1.ConfigMap
		ExpectedMeshConfig *models.MeshConfig
	}{
		"outbound traffic policy added by default": {
			StandardMeshConfig: &core_v1.ConfigMap{
				ObjectMeta: v1.ObjectMeta{
					Name:      "istio",
					Namespace: "istio-system",
				},
				Data: map[string]string{
					"mesh": ``,
				},
			},
			ExpectedMeshConfig: models.NewMeshConfig(),
		},
		"standard mesh config": {
			StandardMeshConfig: &core_v1.ConfigMap{
				ObjectMeta: v1.ObjectMeta{
					Name:      "istio",
					Namespace: "istio-system",
				},
				Data: map[string]string{
					"mesh": `trustDomain: cluster.local`,
				},
			},
			ExpectedMeshConfig: func() *models.MeshConfig {
				mesh := models.NewMeshConfig()
				mesh.TrustDomain = "cluster.local"
				return mesh
			}(),
		},
		"shared mesh config sets trust domain. standard mesh config does not.": {
			IstiodPodSpec: &core_v1.PodSpec{
				Containers: []core_v1.Container{
					{
						Name: "discovery",
						Env: []core_v1.EnvVar{
							{
								Name:  "SHARED_MESH_CONFIG",
								Value: "istio-user-shared",
							},
						},
					},
				},
			},
			SharedMeshConfig: &core_v1.ConfigMap{
				ObjectMeta: v1.ObjectMeta{
					Name:      "istio-user-shared",
					Namespace: "istio-system",
				},
				Data: map[string]string{
					"mesh": `trustDomain: cluster.shared`,
				},
			},
			StandardMeshConfig: &core_v1.ConfigMap{
				ObjectMeta: v1.ObjectMeta{
					Name:      "istio",
					Namespace: "istio-system",
				},
				Data: map[string]string{
					"mesh": ``,
				},
			},
			ExpectedMeshConfig: func() *models.MeshConfig {
				mesh := models.NewMeshConfig()
				mesh.TrustDomain = "cluster.shared"
				return mesh
			}(),
		},
		"both standard and shared mesh config set trust domain. standard wins.": {
			IstiodPodSpec: &core_v1.PodSpec{
				Containers: []core_v1.Container{
					{
						Name: "discovery",
						Env: []core_v1.EnvVar{
							{
								Name:  "SHARED_MESH_CONFIG",
								Value: "istio-user-shared",
							},
						},
					},
				},
			},
			SharedMeshConfig: &core_v1.ConfigMap{
				ObjectMeta: v1.ObjectMeta{
					Name:      "istio-user-shared",
					Namespace: "istio-system",
				},
				Data: map[string]string{
					"mesh": `trustDomain: cluster.shared`,
				},
			},
			StandardMeshConfig: &core_v1.ConfigMap{
				ObjectMeta: v1.ObjectMeta{
					Name:      "istio",
					Namespace: "istio-system",
				},
				Data: map[string]string{
					"mesh": `trustDomain: cluster.local`,
				},
			},
			ExpectedMeshConfig: func() *models.MeshConfig {
				mesh := models.NewMeshConfig()
				mesh.TrustDomain = "cluster.local"
				return mesh
			}(),
		},
	}
	for name, tc := range cases {
		t.Run(name, func(t *testing.T) {
			require := require.New(t)

			istiod := fakeIstiodDeployment(conf.KubernetesConfig.ClusterName, false)
			if tc.IstiodPodSpec != nil {
				istiod.Spec.Template.Spec = *tc.IstiodPodSpec
			}

			objs := []runtime.Object{istiod}
			if tc.SharedMeshConfig != nil {
				objs = append(objs, tc.SharedMeshConfig)
			}
			if tc.StandardMeshConfig != nil {
				objs = append(objs, tc.StandardMeshConfig)
			}

			client := kubetest.NewFakeK8sClient(objs...)
			cache := cache.NewTestingCache(t, client, *conf)
			discovery := istio.NewDiscovery(map[string]kubernetes.ClientInterface{conf.KubernetesConfig.ClusterName: client}, cache, conf)

			mesh, err := discovery.Mesh(context.Background())
			require.NoError(err)
			require.Len(mesh.ControlPlanes, 1)

			controlPlane := mesh.ControlPlanes[0]
			var sharedMesh string
			if slices.ContainsFunc(istiod.Spec.Template.Spec.Containers[0].Env, func(e core_v1.EnvVar) bool {
				if e.Name == "SHARED_MESH_CONFIG" {
					sharedMesh = e.Value
					return true
				}
				return false
			}) {
				require.Equal(sharedMesh, controlPlane.SharedMeshConfig)
			}

			if diff := cmp.Diff(tc.ExpectedMeshConfig.String(), controlPlane.MeshConfig.String()); diff != "" {
				t.Fatal(diff)
			}
		})
	}
}
