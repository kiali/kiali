package cache_test

import (
	"context"
	"encoding/json"
	"os"
	"sync"
	"testing"

	"github.com/stretchr/testify/require"
	apps_v1 "k8s.io/api/apps/v1"
	core_v1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	ctrlclient "sigs.k8s.io/controller-runtime/pkg/client"
	k8s_networking_v1 "sigs.k8s.io/gateway-api/apis/v1"

	"github.com/kiali/kiali/cache"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/models"
)

func TestNoHomeClusterReturnsError(t *testing.T) {
	require := require.New(t)
	conf := config.NewConfig()

	clients := map[string]kubernetes.ClientInterface{"nothomecluster": kubetest.NewFakeK8sClient()}
	readers := map[string]ctrlclient.Reader{"nothomecluster": kubetest.NewFakeK8sClient()}
	_, err := cache.NewKialiCache(clients, readers, *conf)
	require.Error(err, "no home cluster should return an error")
}

func TestKubeCacheCreatedPerClient(t *testing.T) {
	require := require.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	ns := kubetest.FakeNamespace("test")
	deploymentCluster1 := &apps_v1.Deployment{ObjectMeta: metav1.ObjectMeta{Name: "deployment1", Namespace: "test"}}
	deploymentCluster2 := &apps_v1.Deployment{ObjectMeta: metav1.ObjectMeta{Name: "deployment2", Namespace: "test"}}
	client := kubetest.NewFakeK8sClient(ns, deploymentCluster1)
	client2 := kubetest.NewFakeK8sClient(ns, deploymentCluster2)
	saClients := map[string]kubernetes.ClientInterface{
		conf.KubernetesConfig.ClusterName: client,
		"cluster2":                        client2,
	}
	readers := map[string]ctrlclient.Reader{
		conf.KubernetesConfig.ClusterName: client,
		"cluster2":                        client2,
	}

	kialiCache, _ := cache.NewKialiCache(saClients, readers, *conf)

	_, err := kialiCache.GetKubeCache(conf.KubernetesConfig.ClusterName)
	require.NoError(err)

	kubeCache1, err := kialiCache.GetKubeCache(conf.KubernetesConfig.ClusterName)
	require.NoError(err)

	dep := &apps_v1.Deployment{}
	err = kubeCache1.Get(context.Background(), ctrlclient.ObjectKey{Name: "deployment1", Namespace: "test"}, dep)
	require.NoError(err)

	kubeCache2, err := kialiCache.GetKubeCache("cluster2")
	require.NoError(err)

	dep = &apps_v1.Deployment{}
	err = kubeCache2.Get(context.Background(), ctrlclient.ObjectKey{Name: "deployment2", Namespace: "test"}, dep)
	require.NoError(err)

	_, err = kialiCache.GetKubeCache("cluster3")
	require.Error(err)
}

func ztunnelDaemonSet() *apps_v1.DaemonSet {
	return &apps_v1.DaemonSet{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "ztunnel",
			Namespace: "istio-system",
			Labels:    map[string]string{"app.kubernetes.io/name": "ztunnel"},
		},
		Spec: apps_v1.DaemonSetSpec{
			Selector: &metav1.LabelSelector{
				MatchLabels: map[string]string{"app": "ztunnel"},
			},
		},
	}
}

func k8sClientWithControlPlanePods(includeZtunnel bool) *kubetest.FakeK8sClient {
	istioNamespace := "istio-system"
	objs := []runtime.Object{}
	// ztunnel pod with no label: Should not be selected
	pod := &core_v1.Pod{ObjectMeta: metav1.ObjectMeta{Name: "ztunnel-khq59-123", Namespace: istioNamespace}}
	pod1 := &core_v1.Pod{ObjectMeta: metav1.ObjectMeta{Name: "istiod-864675749b-lpq8c", Namespace: istioNamespace}}
	pod2 := &core_v1.Pod{ObjectMeta: metav1.ObjectMeta{Name: "istio-cni-node-vd5sh", Namespace: istioNamespace}}
	pod3 := &core_v1.Pod{ObjectMeta: metav1.ObjectMeta{Name: "prometheus-65db697fd-bfq5v", Namespace: istioNamespace}}
	pod4 := &core_v1.Pod{ObjectMeta: metav1.ObjectMeta{Name: "istio-egressgateway-7bcb795b58-6jj6w", Namespace: istioNamespace}}
	pod5 := &core_v1.Pod{ObjectMeta: metav1.ObjectMeta{Name: "istio-ingressgateway-7d97cd5c49-qhpcp", Namespace: istioNamespace}}
	objs = append(objs, kubetest.FakeNamespace("istio-system"), ztunnelDaemonSet(), pod, pod1, pod2, pod3, pod4, pod5)

	if includeZtunnel {
		pod6 := &core_v1.Pod{ObjectMeta: metav1.ObjectMeta{Name: "ztunnel-khq59", Namespace: istioNamespace, Labels: map[string]string{"app": "ztunnel"}}}
		pod7 := &core_v1.Pod{ObjectMeta: metav1.ObjectMeta{Name: "i-khq59", Namespace: istioNamespace, Labels: map[string]string{"app": "ztunnel"}}}
		objs = append(objs, pod6, pod7)
	}
	return kubetest.NewFakeK8sClient(objs...)
}

func TestIsAmbientEnabled(t *testing.T) {
	require := require.New(t)
	conf := config.NewConfig()
	client := kubetest.NewFakeK8sClient(
		kubetest.FakeNamespace("istio-system"),
		ztunnelDaemonSet(),
	)
	cache := cache.NewTestingCache(t, client, *conf)

	require.True(cache.IsAmbientEnabled(conf.KubernetesConfig.ClusterName))
	// Call multiple times to ensure results are consistent.
	require.True(cache.IsAmbientEnabled(conf.KubernetesConfig.ClusterName))
}

func TestIsAmbientEnabledOutsideIstioSystem(t *testing.T) {
	require := require.New(t)
	conf := config.NewConfig()
	ztunnel := ztunnelDaemonSet()
	ztunnel.Namespace = "alternate-istio-namespace"
	client := kubetest.NewFakeK8sClient(
		kubetest.FakeNamespace("alternate-istio-namespace"),
		ztunnel,
	)
	cache := cache.NewTestingCache(t, client, *conf)

	require.True(cache.IsAmbientEnabled(conf.KubernetesConfig.ClusterName))
	// Call multiple times to ensure results are consistent.
	require.True(cache.IsAmbientEnabled(conf.KubernetesConfig.ClusterName))
}

func TestIsAmbientDisabled(t *testing.T) {
	require := require.New(t)
	conf := config.NewConfig()
	client := kubetest.NewFakeK8sClient(
		kubetest.FakeNamespace("istio-system"),
	)
	cache := cache.NewTestingCache(t, client, *conf)

	require.False(cache.IsAmbientEnabled(conf.KubernetesConfig.ClusterName))
	// Call multiple times to ensure results are consistent.
	require.False(cache.IsAmbientEnabled(conf.KubernetesConfig.ClusterName))
}

func TestIsAmbientMultiCluster(t *testing.T) {
	require := require.New(t)
	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "east"
	east := kubetest.NewFakeK8sClient(
		kubetest.FakeNamespace("istio-system"),
		ztunnelDaemonSet(),
	)
	west := kubetest.NewFakeK8sClient(
		kubetest.FakeNamespace("istio-system"),
	)
	clientFactory := kubetest.NewK8SClientFactoryMock(nil)
	clientFactory.SetClients(map[string]kubernetes.UserClientInterface{
		"east": east,
		"west": west,
	})
	cache := cache.NewTestingCacheWithFactory(t, clientFactory, *conf)

	require.True(cache.IsAmbientEnabled("east"))
	require.False(cache.IsAmbientEnabled("west"))
}

// This test only tests anything when the '-race' flag is passed to 'go test'.
func TestIsAmbientIsThreadSafe(t *testing.T) {
	conf := config.NewConfig()
	client := kubetest.NewFakeK8sClient(
		kubetest.FakeNamespace("istio-system"),
		ztunnelDaemonSet(),
	)
	cache := cache.NewTestingCache(t, client, *conf)

	wg := sync.WaitGroup{}
	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			cache.IsAmbientEnabled(conf.KubernetesConfig.ClusterName)
		}()
	}
	wg.Wait()
}

func TestSetNamespace(t *testing.T) {
	require := require.New(t)

	conf := config.NewConfig()
	conf.KubernetesConfig.CacheTokenNamespaceDuration = 10000
	conf.KubernetesConfig.ClusterName = "east"
	kubernetes.SetConfig(t, *conf)

	client := kubetest.NewFakeK8sClient()
	cache := cache.NewTestingCache(t, client, *conf)
	cache.SetNamespaces("token", []models.Namespace{{Name: "test", Cluster: "east"}})
	cache.SetNamespace("token", models.Namespace{Name: "test", Cluster: "east", Labels: map[string]string{"app": "test"}})

	ns, found := cache.GetNamespace("east", "token", "test")
	require.True(found)
	require.Equal(map[string]string{"app": "test"}, ns.Labels)
}

func TestSetNamespaceIsThreadSafe(t *testing.T) {
	conf := config.NewConfig()
	conf.KubernetesConfig.CacheTokenNamespaceDuration = 10000
	conf.KubernetesConfig.ClusterName = "east"
	kubernetes.SetConfig(t, *conf)

	client := kubetest.NewFakeK8sClient()
	cache := cache.NewTestingCache(t, client, *conf)

	wg := sync.WaitGroup{}
	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			cache.SetNamespace("token", models.Namespace{Name: "test", Cluster: "east", Labels: map[string]string{"app": "test"}})
		}()
	}
	wg.Wait()
}

func TestGetNamespaces(t *testing.T) {
	require := require.New(t)
	conf := config.NewConfig()
	conf.KubernetesConfig.CacheTokenNamespaceDuration = 10000
	conf.KubernetesConfig.ClusterName = "east"
	kubernetes.SetConfig(t, *conf)

	client := kubetest.NewFakeK8sClient()
	cache := cache.NewTestingCache(t, client, *conf)
	cache.SetNamespaces("token", []models.Namespace{{Name: "test", Cluster: "east"}})

	namespaces, found := cache.GetNamespaces("east", "token")
	require.True(found)
	require.Equal(1, len(namespaces))
	require.Equal("test", namespaces[0].Name)

	_, found = cache.GetNamespaces("west", "token")
	require.False(found)

	_, found = cache.GetNamespaces("east", "token2")
	require.False(found)
}

func TestRefreshTokenNamespaces(t *testing.T) {
	require := require.New(t)
	conf := config.NewConfig()
	conf.KubernetesConfig.CacheTokenNamespaceDuration = 10000
	conf.KubernetesConfig.ClusterName = "east"
	kubernetes.SetConfig(t, *conf)

	client := kubetest.NewFakeK8sClient()
	cache := cache.NewTestingCache(t, client, *conf)
	cache.SetNamespaces("token", []models.Namespace{{Name: "test", Cluster: "east"}})
	cache.RefreshTokenNamespaces("east")

	_, found := cache.GetNamespaces("east", "token")
	require.False(found)

	// Test refresh doesn't affect other clusters.
	cache.SetNamespaces("token", []models.Namespace{{Name: "test", Cluster: "east"}})
	cache.SetNamespaces("token", []models.Namespace{{Name: "test", Cluster: "west"}})
	cache.RefreshTokenNamespaces("east")

	namespaces, found := cache.GetNamespaces("west", "token")
	require.True(found)
	require.Equal(1, len(namespaces))
	require.Equal("test", namespaces[0].Name)
}

func TestValidationsSetByConstructor(t *testing.T) {
	require := require.New(t)
	conf := config.NewConfig()

	clients := map[string]kubernetes.ClientInterface{conf.KubernetesConfig.ClusterName: kubetest.NewFakeK8sClient()}
	readers := map[string]ctrlclient.Reader{conf.KubernetesConfig.ClusterName: kubetest.NewFakeK8sClient()}
	cache, err := cache.NewKialiCache(clients, readers, *conf)
	require.NoError(err)

	require.NotNil(cache.Validations())
}

func TestZtunnelDump(t *testing.T) {
	require := require.New(t)
	conf := config.NewConfig()

	clients := map[string]kubernetes.ClientInterface{conf.KubernetesConfig.ClusterName: kubetest.NewFakeK8sClient()}
	readers := map[string]ctrlclient.Reader{conf.KubernetesConfig.ClusterName: kubetest.NewFakeK8sClient()}
	cache, err := cache.NewKialiCache(clients, readers, *conf)
	require.NoError(err)

	initData := cache.GetZtunnelDump("cluster-default", "istio-system", "ztunnel-7hml8")
	require.Nil(initData)

	zTunnelData, err := os.Open("../kubernetes/testdata/ztunnel-config.json")
	require.NoError(err)
	defer zTunnelData.Close()

	configD := &kubernetes.ZtunnelConfigDump{}
	errD := json.NewDecoder(zTunnelData).Decode(&configD)
	require.NoError(errD)

	cache.SetZtunnelDump("cluster-defaultistio-systemztunnel-7hml8", configD)

	cacheData := cache.GetZtunnelDump("cluster-default", "istio-system", "ztunnel-7hml8")
	require.NotNil(cacheData)
	require.Equal(cacheData.Workloads[1].Name, "details-v1-7c5d957895-pwqdh")
	require.Equal(cacheData.Workloads[1].Protocol, "HBONE")
	require.Equal(cacheData.Workloads[1].Node, "ci-worker")

	require.Equal(cacheData.Services[36].Hostname, "waypoint.bookinfo.svc.cluster.local")
	require.Equal(cacheData.Services[36].Name, "waypoint")
	require.Equal(cacheData.Services[36].Namespace, "bookinfo")

	require.Equal(cacheData.Config.DNSResolverOpts.UseHostsFile, kubernetes.BoolOrString("Auto"))
}

func TestGetNoZtunnelPods(t *testing.T) {
	require := require.New(t)
	conf := config.NewConfig()
	client := k8sClientWithControlPlanePods(false)
	cache := cache.NewTestingCache(t, client, *conf)

	ztunnelPods := cache.GetZtunnelPods(client.ClusterInfo().Name)
	require.Equal(0, len(ztunnelPods))
}

// TestGetZtunnelPods: Just pods that are part of the
func TestGetZtunnelPods(t *testing.T) {
	require := require.New(t)
	conf := config.NewConfig()
	client := k8sClientWithControlPlanePods(true)
	cache := cache.NewTestingCache(t, client, *conf)

	ztunnelPods := cache.GetZtunnelPods(client.ClusterInfo().Name)
	require.Equal(2, len(ztunnelPods))
}

func TestGatewayAPIClasses(t *testing.T) {
	require := require.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	// Gateway API not configured
	t.Run("GatewayAPINotConfigured", func(t *testing.T) {
		client := kubetest.NewFakeK8sClient()
		client.GatewayAPIEnabled = false // Set Gateway API as disabled
		saClients := map[string]kubernetes.ClientInterface{
			conf.KubernetesConfig.ClusterName: client,
		}
		readers := map[string]ctrlclient.Reader{
			conf.KubernetesConfig.ClusterName: client,
		}

		kialiCache, err := cache.NewKialiCache(saClients, readers, *conf)
		require.NoError(err)

		result := kialiCache.GatewayAPIClasses(conf.KubernetesConfig.ClusterName)
		require.Empty(result)
	})

	// Configured classes in config
	t.Run("ConfiguredClassesInConfig", func(t *testing.T) {
		client := kubetest.NewFakeK8sClient()
		client.GatewayAPIEnabled = true // Enable Gateway API
		saClients := map[string]kubernetes.ClientInterface{
			conf.KubernetesConfig.ClusterName: client,
		}
		readers := map[string]ctrlclient.Reader{
			conf.KubernetesConfig.ClusterName: client,
		}

		// Set configured GatewayAPIClasses
		conf.ExternalServices.Istio.GatewayAPIClasses = []config.GatewayAPIClass{
			{Name: "custom-istio", ClassName: "custom-istio"},
			{Name: "custom-remote", ClassName: "custom-remote"},
		}

		kialiCache, err := cache.NewKialiCache(saClients, readers, *conf)
		require.NoError(err)

		result := kialiCache.GatewayAPIClasses(conf.KubernetesConfig.ClusterName)
		require.Len(result, 2)
		require.Equal("custom-istio", result[0].Name)
		require.Equal("custom-istio", result[0].ClassName)
		require.Equal("custom-remote", result[1].Name)
		require.Equal("custom-remote", result[1].ClassName)
	})

	// Invalid configured classes (missing name or classname)
	t.Run("InvalidConfiguredClasses", func(t *testing.T) {
		client := kubetest.NewFakeK8sClient()
		client.GatewayAPIEnabled = true // Enable Gateway API
		saClients := map[string]kubernetes.ClientInterface{
			conf.KubernetesConfig.ClusterName: client,
		}
		readers := map[string]ctrlclient.Reader{
			conf.KubernetesConfig.ClusterName: client,
		}

		// Set invalid configured GatewayAPIClasses
		conf.ExternalServices.Istio.GatewayAPIClasses = []config.GatewayAPIClass{
			{Name: "", ClassName: "valid-class"},          // Missing name
			{Name: "valid-name", ClassName: ""},           // Missing classname
			{Name: "valid-both", ClassName: "valid-both"}, // Valid
		}

		kialiCache, err := cache.NewKialiCache(saClients, readers, *conf)
		require.NoError(err)

		result := kialiCache.GatewayAPIClasses(conf.KubernetesConfig.ClusterName)
		require.Len(result, 1) // Only the valid one should be included
		require.Equal("valid-both", result[0].Name)
		require.Equal("valid-both", result[0].ClassName)
	})

	// Auto-discovery with label selector
	t.Run("AutoDiscoveryWithLabelSelector", func(t *testing.T) {
		// Add GatewayClass resources to the fake client
		gatewayClass1 := &k8s_networking_v1.GatewayClass{
			ObjectMeta: metav1.ObjectMeta{
				Name:   "istio",
				Labels: map[string]string{"app": "istio"},
			},
			Spec: k8s_networking_v1.GatewayClassSpec{
				ControllerName: "istio.io/gateway-controller",
			},
		}
		gatewayClass2 := &k8s_networking_v1.GatewayClass{
			ObjectMeta: metav1.ObjectMeta{
				Name:   "istio-remote",
				Labels: map[string]string{"app": "istio"},
			},
			Spec: k8s_networking_v1.GatewayClassSpec{
				ControllerName: "istio.io/gateway-controller",
			},
		}
		objs := []runtime.Object{}
		objs = append(objs, gatewayClass1, gatewayClass2)

		client := kubetest.NewFakeK8sClient(objs...)
		client.GatewayAPIEnabled = true // Enable Gateway API
		saClients := map[string]kubernetes.ClientInterface{
			conf.KubernetesConfig.ClusterName: client,
		}
		readers := map[string]ctrlclient.Reader{
			conf.KubernetesConfig.ClusterName: client,
		}

		// Enable cluster-wide access and set label selector
		conf.Deployment.ClusterWideAccess = true
		conf.ExternalServices.Istio.GatewayAPIClassesLabelSelector = "app=istio"
		conf.ExternalServices.Istio.GatewayAPIClasses = []config.GatewayAPIClass{} // Empty to trigger auto-discovery

		kialiCache, err := cache.NewKialiCache(saClients, readers, *conf)
		require.NoError(err)

		result := kialiCache.GatewayAPIClasses(conf.KubernetesConfig.ClusterName)
		require.Len(result, 2)
		require.Equal("istio", result[0].Name)
		require.Equal("istio", result[0].ClassName)
		require.Equal("istio-remote", result[1].Name)
		require.Equal("istio-remote", result[1].ClassName)
	})

	// Auto-discovery without label selector
	t.Run("AutoDiscoveryWithoutLabelSelector", func(t *testing.T) {
		// Add GatewayClass resources to the fake client
		gatewayClass1 := &k8s_networking_v1.GatewayClass{
			ObjectMeta: metav1.ObjectMeta{
				Name: "istio",
			},
			Spec: k8s_networking_v1.GatewayClassSpec{
				ControllerName: "istio.io/gateway-controller",
			},
		}
		gatewayClass2 := &k8s_networking_v1.GatewayClass{
			ObjectMeta: metav1.ObjectMeta{
				Name: "other-controller",
			},
			Spec: k8s_networking_v1.GatewayClassSpec{
				ControllerName: "other.io/gateway-controller",
			},
		}
		objs := []runtime.Object{}
		objs = append(objs, gatewayClass1, gatewayClass2)

		client := kubetest.NewFakeK8sClient(objs...)
		client.GatewayAPIEnabled = true // Enable Gateway API
		saClients := map[string]kubernetes.ClientInterface{
			conf.KubernetesConfig.ClusterName: client,
		}
		readers := map[string]ctrlclient.Reader{
			conf.KubernetesConfig.ClusterName: client,
		}

		// Enable cluster-wide access and no label selector
		conf.Deployment.ClusterWideAccess = true
		conf.ExternalServices.Istio.GatewayAPIClassesLabelSelector = ""
		conf.ExternalServices.Istio.GatewayAPIClasses = []config.GatewayAPIClass{} // Empty to trigger auto-discovery

		kialiCache, err := cache.NewKialiCache(saClients, readers, *conf)
		require.NoError(err)

		result := kialiCache.GatewayAPIClasses(conf.KubernetesConfig.ClusterName)
		require.Len(result, 1) // Only istio.io controller should be included
		require.Equal("istio", result[0].Name)
		require.Equal("istio", result[0].ClassName)
	})

	// Default values when no classes found
	t.Run("DefaultValuesWhenNoClassesFound", func(t *testing.T) {
		client := kubetest.NewFakeK8sClient()
		client.GatewayAPIEnabled = true // Enable Gateway API
		saClients := map[string]kubernetes.ClientInterface{
			conf.KubernetesConfig.ClusterName: client,
		}
		readers := map[string]ctrlclient.Reader{
			conf.KubernetesConfig.ClusterName: client,
		}

		// Enable cluster-wide access but no classes configured or discovered
		conf.Deployment.ClusterWideAccess = true
		conf.ExternalServices.Istio.GatewayAPIClasses = []config.GatewayAPIClass{}

		kialiCache, err := cache.NewKialiCache(saClients, readers, *conf)
		require.NoError(err)

		result := kialiCache.GatewayAPIClasses(conf.KubernetesConfig.ClusterName)
		require.Len(result, 2) // Default istio and istio-remote
		require.Equal("istio", result[0].Name)
		require.Equal("istio", result[0].ClassName)
		require.Equal("istio-remote", result[1].Name)
		require.Equal("istio-remote", result[1].ClassName)
	})

	// Default values with multi-cluster
	t.Run("DefaultValuesWithMultiCluster", func(t *testing.T) {
		client1 := kubetest.NewFakeK8sClient()
		client1.GatewayAPIEnabled = true // Enable Gateway API
		client2 := kubetest.NewFakeK8sClient()
		client2.GatewayAPIEnabled = true // Enable Gateway API
		saClients := map[string]kubernetes.ClientInterface{
			"cluster1": client1,
			"cluster2": client2,
		}
		readers := map[string]ctrlclient.Reader{
			"cluster1": client1,
			"cluster2": client2,
		}

		// Enable cluster-wide access but no classes configured or discovered
		conf.Deployment.ClusterWideAccess = true
		conf.KubernetesConfig.ClusterName = "cluster1"
		conf.ExternalServices.Istio.GatewayAPIClasses = []config.GatewayAPIClass{}

		kialiCache, err := cache.NewKialiCache(saClients, readers, *conf)
		require.NoError(err)

		result := kialiCache.GatewayAPIClasses("cluster1")
		require.Len(result, 3) // istio, istio-remote, istio-east-west (multi-cluster)
		require.Equal("istio", result[0].Name)
		require.Equal("istio-remote", result[1].Name)
		require.Equal("istio-east-west", result[2].Name)
	})

	// Default values with ambient enabled
	t.Run("DefaultValuesWithAmbientEnabled", func(t *testing.T) {
		client := kubetest.NewFakeK8sClient(
			kubetest.FakeNamespace("istio-system"),
			ztunnelDaemonSet(),
		)
		client.GatewayAPIEnabled = true // Enable Gateway API
		saClients := map[string]kubernetes.ClientInterface{
			conf.KubernetesConfig.ClusterName: client,
		}
		readers := map[string]ctrlclient.Reader{
			conf.KubernetesConfig.ClusterName: client,
		}

		// Enable cluster-wide access but no classes configured or discovered
		conf.Deployment.ClusterWideAccess = true
		conf.ExternalServices.Istio.GatewayAPIClasses = []config.GatewayAPIClass{}

		kialiCache, err := cache.NewKialiCache(saClients, readers, *conf)
		require.NoError(err)

		result := kialiCache.GatewayAPIClasses(conf.KubernetesConfig.ClusterName)
		require.Len(result, 3) // istio, istio-remote, istio-waypoint (ambient enabled)
		require.Equal("istio", result[0].Name)
		require.Equal("istio-remote", result[1].Name)
		require.Equal("istio-waypoint", result[2].Name)
	})

	// Bad label selector
	t.Run("BadLabelSelector", func(t *testing.T) {
		client := kubetest.NewFakeK8sClient()
		client.GatewayAPIEnabled = true // Enable Gateway API
		saClients := map[string]kubernetes.ClientInterface{
			conf.KubernetesConfig.ClusterName: client,
		}
		readers := map[string]ctrlclient.Reader{
			conf.KubernetesConfig.ClusterName: client,
		}

		// Enable cluster-wide access with bad label selector
		conf.Deployment.ClusterWideAccess = true
		conf.ExternalServices.Istio.GatewayAPIClassesLabelSelector = "invalid-label-selector["
		conf.ExternalServices.Istio.GatewayAPIClasses = []config.GatewayAPIClass{}

		kialiCache, err := cache.NewKialiCache(saClients, readers, *conf)
		require.NoError(err)

		result := kialiCache.GatewayAPIClasses(conf.KubernetesConfig.ClusterName)
		require.Len(result, 2) // Should fall back to default values
		require.Equal("istio", result[0].Name)
		require.Equal("istio-remote", result[1].Name)
	})

	// No cluster-wide access
	t.Run("NoClusterWideAccess", func(t *testing.T) {
		client := kubetest.NewFakeK8sClient()
		client.GatewayAPIEnabled = true // Enable Gateway API
		saClients := map[string]kubernetes.ClientInterface{
			conf.KubernetesConfig.ClusterName: client,
		}
		readers := map[string]ctrlclient.Reader{
			conf.KubernetesConfig.ClusterName: client,
		}

		// Disable cluster-wide access
		conf.Deployment.ClusterWideAccess = false
		conf.ExternalServices.Istio.GatewayAPIClasses = []config.GatewayAPIClass{}

		kialiCache, err := cache.NewKialiCache(saClients, readers, *conf)
		require.NoError(err)

		result := kialiCache.GatewayAPIClasses(conf.KubernetesConfig.ClusterName)
		require.Len(result, 2) // Should fall back to default values
		require.Equal("istio", result[0].Name)
		require.Equal("istio-remote", result[1].Name)
	})
}
