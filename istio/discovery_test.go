package istio_test

import (
	"context"
	"slices"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apps_v1 "k8s.io/api/apps/v1"
	core_v1 "k8s.io/api/core/v1"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/client-go/rest"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/istio"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/cache"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/util/slicetest"
)

func fakeIstiodDeployment(cluster string, manageExternal bool) *apps_v1.Deployment {
	deployment := &apps_v1.Deployment{
		ObjectMeta: v1.ObjectMeta{
			Name:      "istiod",
			Namespace: "istio-system",
			Labels: map[string]string{
				"app":                     "istiod",
				models.IstioRevisionLabel: "default",
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
	conf.InCluster = false
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

	kialiNs := core_v1.Namespace{
		ObjectMeta: v1.ObjectMeta{Name: "foo"},
	}

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
		&kialiNs,
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
	conf.InCluster = false

	remoteNs := &core_v1.Namespace{
		ObjectMeta: v1.ObjectMeta{
			Labels: map[string]string{"topology.istio.io/network": "TheRemoteNetwork"},
			Name:   conf.IstioNamespace,
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
			Namespace: conf.IstioNamespace,
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
	check.Equal(conf.IstioNamespace, remoteCluster.KialiInstances[0].Namespace, "GetClusters didn't set the right namespace of the Kiali instance")
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
	conf.IstioNamespace = "foo"
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
		&core_v1.Namespace{ObjectMeta: v1.ObjectMeta{Name: "foo"}},
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

func TestGetMesh(t *testing.T) {
	istiodDeployment := &apps_v1.Deployment{
		ObjectMeta: v1.ObjectMeta{
			Name:      "istiod",
			Namespace: "istio-system",
			Labels: map[string]string{
				"app":                     "istiod",
				models.IstioRevisionLabel: "default",
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
			Labels:    map[string]string{models.IstioRevisionLabel: "default"},
		},
		Data: map[string]string{"mesh": configMapData},
	}

	require := require.New(t)
	conf := config.NewConfig()
	k8s := kubetest.NewFakeK8sClient(
		&core_v1.Namespace{ObjectMeta: v1.ObjectMeta{Name: "istio-system"}},
		istiodDeployment,
		istioConfigMap,
	)
	cache := cache.NewTestingCache(t, k8s, *conf)

	clients := map[string]kubernetes.ClientInterface{conf.KubernetesConfig.ClusterName: k8s}
	discovery := istio.NewDiscovery(clients, cache, conf)
	mesh, err := discovery.Mesh(context.TODO())
	require.NoError(err)
	require.Len(mesh.ControlPlanes, 1)
	require.True(*mesh.ControlPlanes[0].Config.EnableAutoMtls)
	require.Len(mesh.ControlPlanes[0].ManagedClusters, 1)
}

func TestGetMeshMultipleRevisions(t *testing.T) {
	istiod_1_18_Deployment := &apps_v1.Deployment{
		ObjectMeta: v1.ObjectMeta{
			Name:      "istiod-1-18",
			Namespace: "istio-system",
			Labels: map[string]string{
				"app":                     "istiod",
				models.IstioRevisionLabel: "1-18-0",
			},
		},
	}
	istiod_1_19_Deployment := &apps_v1.Deployment{
		ObjectMeta: v1.ObjectMeta{
			Name:      "istiod-1-19",
			Namespace: "istio-system",
			Labels: map[string]string{
				"app":                     "istiod",
				models.IstioRevisionLabel: "1-19-0",
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
				models.IstioRevisionLabel: "1-18-0",
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
				models.IstioRevisionLabel: "1-19-0",
			},
		},
		Data: map[string]string{"mesh": configMap_1_19_Data},
	}
	require := require.New(t)
	conf := config.NewConfig()
	k8s := kubetest.NewFakeK8sClient(
		&core_v1.Namespace{ObjectMeta: v1.ObjectMeta{Name: "istio-system"}},
		istiod_1_18_Deployment,
		istio_1_18_ConfigMap,
		istiod_1_19_Deployment,
		istio_1_19_ConfigMap,
	)

	clients := map[string]kubernetes.ClientInterface{conf.KubernetesConfig.ClusterName: k8s}
	discovery := istio.NewDiscovery(clients, cache.NewTestingCache(t, k8s, *conf), conf)
	mesh, err := discovery.Mesh(context.TODO())
	require.NoError(err)
	require.Len(mesh.ControlPlanes, 2)

	controlPlane_1_18 := slicetest.FindOrFail(t, mesh.ControlPlanes, func(c models.ControlPlane) bool {
		return c.Revision == "1-18-0"
	})
	require.False(*controlPlane_1_18.Config.EnableAutoMtls)
	require.Len(controlPlane_1_18.ManagedClusters, 1)

	controlPlane_1_19 := slicetest.FindOrFail(t, mesh.ControlPlanes, func(c models.ControlPlane) bool {
		return c.Revision == "1-19-0"
	})
	require.True(*controlPlane_1_19.Config.EnableAutoMtls)
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
	require.True(*mesh.ControlPlanes[0].Config.EnableAutoMtls)
	require.True(*mesh.ControlPlanes[1].Config.EnableAutoMtls)
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
			Labels:    map[string]string{models.IstioRevisionLabel: "default"},
		},
		Data: map[string]string{"mesh": configMapData},
	}
	k8s := kubetest.NewFakeK8sClient(
		&core_v1.Namespace{ObjectMeta: v1.ObjectMeta{Name: "istio-system"}},
		istiodDeployment,
		istioConfigMap,
	)
	remoteClient := kubetest.NewFakeK8sClient(
		&core_v1.Namespace{ObjectMeta: v1.ObjectMeta{
			Name:        "istio-system",
			Annotations: map[string]string{business.IstioControlPlaneClustersLabel: conf.KubernetesConfig.ClusterName},
		}},
		&core_v1.Namespace{ObjectMeta: v1.ObjectMeta{Name: "bookinfo"}},
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
			Labels:    map[string]string{models.IstioRevisionLabel: "default"},
		},
		Data: map[string]string{"mesh": configMapData},
	}
	eastClient := kubetest.NewFakeK8sClient(
		&core_v1.Namespace{ObjectMeta: v1.ObjectMeta{Name: "istio-system"}},
		istiodDeployment,
		istioConfigMap,
	)
	remoteClient := kubetest.NewFakeK8sClient(
		&core_v1.Namespace{ObjectMeta: v1.ObjectMeta{
			Name:        "istio-system",
			Annotations: map[string]string{business.IstioControlPlaneClustersLabel: "*"},
		}},
		&core_v1.Namespace{ObjectMeta: v1.ObjectMeta{Name: "bookinfo"}},
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
			Labels:    map[string]string{models.IstioRevisionLabel: "default"},
		},
		Data: map[string]string{"mesh": configMapData},
	}
	eastClient := kubetest.NewFakeK8sClient(
		&core_v1.Namespace{ObjectMeta: v1.ObjectMeta{Name: "istio-system"}},
		istiodDeployment,
		istioConfigMap,
	)
	remoteClient := kubetest.NewFakeK8sClient(
		&core_v1.Namespace{ObjectMeta: v1.ObjectMeta{
			Name:        "istio-system",
			Annotations: map[string]string{business.IstioControlPlaneClustersLabel: conf.KubernetesConfig.ClusterName},
		}},
		&core_v1.Namespace{ObjectMeta: v1.ObjectMeta{Name: "bookinfo"}},
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
			Labels:    map[string]string{models.IstioRevisionLabel: "default"},
		},
		Data: map[string]string{"mesh": configMapData},
	}
	eastClient := kubetest.NewFakeK8sClient(
		&core_v1.Namespace{ObjectMeta: v1.ObjectMeta{Name: "istio-system"}},
		&core_v1.Namespace{ObjectMeta: v1.ObjectMeta{Name: "bookinfo"}},
		fakeIstiodDeployment("east", false),
		istioConfigMap,
	)
	westClient := kubetest.NewFakeK8sClient(
		&core_v1.Namespace{ObjectMeta: v1.ObjectMeta{Name: "istio-system"}},
		&core_v1.Namespace{ObjectMeta: v1.ObjectMeta{Name: "bookinfo"}},
		fakeIstiodDeployment("west", false),
		istioConfigMap,
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
			Labels:    map[string]string{models.IstioRevisionLabel: "default"},
		},
		Data: map[string]string{"mesh": configMapData},
	}
	eastClient := kubetest.NewFakeK8sClient(
		&core_v1.Namespace{ObjectMeta: v1.ObjectMeta{Name: "istio-system"}},
		&core_v1.Namespace{ObjectMeta: v1.ObjectMeta{Name: "bookinfo"}},
		fakeIstiodDeployment("east", true),
		istioConfigMap,
	)
	eastRemoteClient := kubetest.NewFakeK8sClient(
		&core_v1.Namespace{ObjectMeta: v1.ObjectMeta{
			Name:        "istio-system",
			Annotations: map[string]string{business.IstioControlPlaneClustersLabel: "east"},
		}},
		&core_v1.Namespace{ObjectMeta: v1.ObjectMeta{Name: "bookinfo"}},
	)
	westClient := kubetest.NewFakeK8sClient(
		&core_v1.Namespace{ObjectMeta: v1.ObjectMeta{Name: "istio-system"}},
		&core_v1.Namespace{ObjectMeta: v1.ObjectMeta{Name: "bookinfo"}},
		fakeIstiodDeployment("west", true),
		istioConfigMap,
	)
	westRemoteClient := kubetest.NewFakeK8sClient(
		&core_v1.Namespace{ObjectMeta: v1.ObjectMeta{
			Name:        "istio-system",
			Annotations: map[string]string{business.IstioControlPlaneClustersLabel: "west"},
		}},
		&core_v1.Namespace{ObjectMeta: v1.ObjectMeta{Name: "bookinfo"}},
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
			Labels:    map[string]string{models.IstioRevisionLabel: "default"},
		},
		Data: map[string]string{"mesh": configMapData},
	}
	istioConfigMapExternalControlPlane := &core_v1.ConfigMap{
		ObjectMeta: v1.ObjectMeta{
			Name:      "istio",
			Namespace: "external-istiod",
			Labels:    map[string]string{models.IstioRevisionLabel: "default"},
		},
		Data: map[string]string{"mesh": configMapData},
	}
	externalControlPlane := fakeIstiodDeployment("dataplane", true)
	externalControlPlane.Namespace = "external-istiod"
	externalControlPlane.Name = "istiod"

	controlPlaneClient := kubetest.NewFakeK8sClient(
		&core_v1.Namespace{ObjectMeta: v1.ObjectMeta{Name: "istio-system"}},
		&core_v1.Namespace{ObjectMeta: v1.ObjectMeta{Name: "external-istiod"}},
		fakeIstiodDeployment("controlplane", false),
		externalControlPlane,
		istioConfigMap,
		istioConfigMapExternalControlPlane,
	)

	dataPlaneClient := kubetest.NewFakeK8sClient(
		&core_v1.Namespace{ObjectMeta: v1.ObjectMeta{Name: "external-istiod"}},
		&core_v1.Namespace{ObjectMeta: v1.ObjectMeta{Name: "bookinfo"}},
	)

	dataPlaneRemoteClient := kubetest.NewFakeK8sClient(
		&core_v1.Namespace{ObjectMeta: v1.ObjectMeta{
			Name:        "external-istiod",
			Annotations: map[string]string{business.IstioControlPlaneClustersLabel: "dataplane"},
		}},
		&core_v1.Namespace{ObjectMeta: v1.ObjectMeta{Name: "bookinfo"}},
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
	conf := config.NewConfig()
	conf.Deployment.ClusterWideAccess = false
	conf.Deployment.AccessibleNamespaces = []string{"istio-system"}

	kialiService := &core_v1.Service{
		ObjectMeta: v1.ObjectMeta{
			Name:      "kiali",
			Namespace: "istio-system",
			Labels:    map[string]string{"app.kubernetes.io/part-of": "kiali"},
		},
	}
	k8s := kubetest.NewFakeK8sClient(
		&core_v1.Namespace{ObjectMeta: v1.ObjectMeta{Name: "istio-system"}},
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
			Labels:    map[string]string{models.IstioRevisionLabel: "default"},
		},
		Data: map[string]string{"mesh": configMapData},
	}
	k8s := kubetest.NewFakeK8sClient(
		&core_v1.Namespace{ObjectMeta: v1.ObjectMeta{Name: "istio-system"}},
		istiodDeployment,
		istioConfigMap,
	)
	remoteClient := kubetest.NewFakeK8sClient(
		&core_v1.Namespace{ObjectMeta: v1.ObjectMeta{
			Name:        "istio-system",
			Annotations: map[string]string{business.IstioControlPlaneClustersLabel: conf.KubernetesConfig.ClusterName},
		}},
		&core_v1.Namespace{ObjectMeta: v1.ObjectMeta{Name: "bookinfo"}},
	)

	clients := map[string]kubernetes.ClientInterface{conf.KubernetesConfig.ClusterName: k8s, "remote": remoteClient}
	cache := cache.NewTestingCacheWithClients(t, clients, *conf)
	discovery := istio.NewDiscovery(clients, cache, conf)

	require.True(discovery.IsRemoteCluster(context.Background(), "remote"))
	require.False(discovery.IsRemoteCluster(context.Background(), "east"))
	require.True(discovery.IsRemoteCluster(context.Background(), "non-existant"))
}
