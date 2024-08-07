package cache

import (
	"fmt"
	"reflect"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	networking_v1 "istio.io/client-go/pkg/apis/networking/v1"
	apps_v1 "k8s.io/api/apps/v1"
	core_v1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
)

const IstioAPIEnabled = true

func newTestingKubeCache(t *testing.T, cfg *config.Config, objects ...runtime.Object) *kubeCache {
	t.Helper()

	kubeCache, err := NewKubeCache(kubetest.NewFakeK8sClient(objects...), *cfg)
	if err != nil {
		t.Fatalf("Unable to create kube cache for testing. Err: %s", err)
	}
	return kubeCache
}

func TestNewKialiCache_isCached(t *testing.T) {
	assert := assert.New(t)

	conf := config.NewConfig()
	conf.Deployment.ClusterWideAccess = false
	conf.Deployment.AccessibleNamespaces = []string{"bookinfo", "a", "abcdefghi", "galicia"}
	kubeCache := newTestingKubeCache(t, conf)
	kubeCache.refreshDuration = 0

	assert.True(kubeCache.isCached("bookinfo"))
	assert.True(kubeCache.isCached("a"))
	assert.True(kubeCache.isCached("abcdefghi"))
	assert.False(kubeCache.isCached("b"))
	assert.False(kubeCache.isCached("bbcdefghi"))
	assert.True(kubeCache.isCached("galicia"))
	assert.False(kubeCache.isCached(""))
}

func TestClusterScopedCacheStopped(t *testing.T) {
	assert := assert.New(t)

	kubeCache := newTestingKubeCache(t, config.NewConfig())

	kubeCache.Stop()
	select {
	case <-time.After(300 * time.Millisecond):
		assert.Fail("Cache should have been stopped")
	case <-kubeCache.stopClusterScopedChan:
	}
}

func TestNSScopedCacheStopped(t *testing.T) {
	assert := assert.New(t)

	cfg := config.NewConfig()
	cfg.Deployment.ClusterWideAccess = false
	cfg.Deployment.AccessibleNamespaces = []string{"ns1", "ns1"}
	kubeCache := newTestingKubeCache(t, cfg)

	kubeCache.Stop()
	for ns, stopCh := range kubeCache.stopNSChans {
		select {
		case <-time.After(300 * time.Millisecond):
			assert.Failf("Cache for namespace: %s should have been stopped", ns)
		case <-stopCh:
		}
	}

	assert.Empty(kubeCache.nsCacheLister)
}

func TestRefreshClusterScoped(t *testing.T) {
	assert := assert.New(t)

	svc := &core_v1.Service{ObjectMeta: metav1.ObjectMeta{Name: "svc1", Namespace: "ns1"}}
	kialiCache := newTestingKubeCache(t, config.NewConfig(), svc)
	kialiCache.clusterCacheLister = &cacheLister{}
	oldLister := kialiCache.clusterCacheLister
	kialiCache.Refresh("")
	assert.NotEqual(kialiCache.clusterCacheLister, oldLister)
}

func TestRefreshMultipleTimesClusterScoped(t *testing.T) {
	assert := assert.New(t)

	kialiCache := newTestingKubeCache(t, config.NewConfig())
	kialiCache.clusterCacheLister = &cacheLister{}
	oldLister := kialiCache.clusterCacheLister

	kialiCache.Refresh("")
	kialiCache.Refresh("")
	assert.NotEqual(kialiCache.clusterCacheLister, oldLister)
}

func TestRefreshNSScoped(t *testing.T) {
	assert := assert.New(t)

	cfg := config.NewConfig()
	cfg.Deployment.ClusterWideAccess = false
	cfg.Deployment.AccessibleNamespaces = []string{"ns1", "ns1"}
	kialiCache := newTestingKubeCache(t, cfg)
	kialiCache.nsCacheLister = map[string]*cacheLister{}

	kialiCache.Refresh("ns1")
	assert.NotEqual(kialiCache.nsCacheLister, map[string]*cacheLister{})
	assert.Contains(kialiCache.nsCacheLister, "ns1")
}

// Other parts of the codebase assume that this kind field is present so it's important
// that the cache sets it.
func TestKubeGetAndListReturnKindInfo(t *testing.T) {
	assert := assert.New(t)
	ns := kubetest.FakeNamespace("test")
	d := &apps_v1.Deployment{
		ObjectMeta: metav1.ObjectMeta{
			Name: "deployment", Namespace: "test",
		},
	}
	kialiCache := newTestingKubeCache(t, config.NewConfig(), ns, d)
	kialiCache.Refresh("test")

	deploymentFromCache, err := kialiCache.GetDeployment("test", "deployment")
	assert.NoError(err)
	assert.Equal(kubernetes.DeploymentType, deploymentFromCache.Kind)

	deploymentListFromCache, err := kialiCache.GetDeployments("test")
	assert.NoError(err)
	for _, deployment := range deploymentListFromCache {
		assert.Equal(kubernetes.DeploymentType, deployment.Kind)
	}
}

// Tests that when a refresh happens, the new cache must fully load before the
// new object is returned.
func TestConcurrentAccessDuringRefresh(t *testing.T) {
	require := require.New(t)
	d := &apps_v1.Deployment{
		ObjectMeta: metav1.ObjectMeta{
			Name: "deployment", Namespace: "test",
		},
	}

	kialiCache := newTestingKubeCache(t, config.NewConfig(), d)
	// Prime the pump with a first Refresh.
	kialiCache.Refresh("test")

	stop := make(chan bool)
	go func() {
		for {
			select {
			case <-stop:
				return
			default:
				_, err := kialiCache.GetDeployment(d.Namespace, d.Name)
				require.NoError(err)
			}
		}
	}()

	kialiCache.Refresh("test")
	close(stop)
}

func TestGetSidecar(t *testing.T) {
	ns := kubetest.FakeNamespace("testing-ns")
	sidecar := &networking_v1.Sidecar{}
	sidecar.Name = "moto-sidecar"
	sidecar.Namespace = "testing-ns"
	sidecar.Labels = map[string]string{
		"app":     "bookinfo",
		"version": "v1",
	}

	cfg := config.NewConfig()

	kubeCache := newTestingKubeCache(t, cfg, ns, sidecar)

	cases := map[string]struct {
		selector        string
		resourceType    string
		namespace       string
		expectedErr     error
		expectedObjects []*networking_v1.Sidecar
	}{
		"With selector that matches": {
			selector:        "app=bookinfo",
			resourceType:    kubernetes.Sidecars,
			expectedErr:     nil,
			expectedObjects: []*networking_v1.Sidecar{sidecar},
		},
		"With selector that doesn't match": {
			selector:        "app=anotherapp",
			resourceType:    kubernetes.Sidecars,
			expectedErr:     nil,
			expectedObjects: []*networking_v1.Sidecar{},
		},
		"Without selector": {
			resourceType:    kubernetes.Sidecars,
			expectedErr:     nil,
			expectedObjects: []*networking_v1.Sidecar{sidecar},
		},
		"With unparseable selector": {
			selector:        "unpar$ablestr!ng!",
			resourceType:    kubernetes.Sidecars,
			expectedErr:     fmt.Errorf("Any"),
			expectedObjects: []*networking_v1.Sidecar{},
		},
		"With unknown type": {
			selector:        "unpar$ablestr!ng!",
			resourceType:    "unknowntype",
			expectedErr:     fmt.Errorf("Any"),
			expectedObjects: []*networking_v1.Sidecar{},
		},
		"Uncached namespace returns empty": {
			namespace:       "uncachednamespace",
			resourceType:    kubernetes.Sidecars,
			expectedErr:     nil,
			expectedObjects: []*networking_v1.Sidecar{},
		},
	}

	for name, tc := range cases {
		t.Run(name, func(t *testing.T) {
			assert := assert.New(t)

			namespace := sidecar.Namespace
			if tc.namespace != "" {
				namespace = tc.namespace
			}

			objects, err := kubeCache.GetSidecars(namespace, tc.selector)
			if tc.expectedErr != nil {
				assert.Error(err)
			} else {
				assert.NoError(err)
			}
			assert.Equal(len(tc.expectedObjects), len(objects))
		})
	}
}

// Other parts of the codebase assume that this kind field is present so it's important
// that the cache sets it.
func TestGetAndListReturnKindInfo(t *testing.T) {
	assert := assert.New(t)
	require := require.New(t)
	ns := kubetest.FakeNamespace("test")
	vs := &networking_v1.VirtualService{
		ObjectMeta: metav1.ObjectMeta{
			Name: "vs", Namespace: "test",
		},
	}

	cfg := config.NewConfig()
	kialiCache := newTestingKubeCache(t, cfg, ns, vs)

	vsFromCache, err := kialiCache.GetVirtualService("test", "vs")
	require.NoError(err)
	assert.Equal(kubernetes.VirtualServiceType, vsFromCache.Kind)

	vsListFromCache, err := kialiCache.GetVirtualServices("test", "")
	require.NoError(err)
	for _, vs := range vsListFromCache {
		assert.Equal(kubernetes.VirtualServiceType, vs.Kind)
	}
}

func TestUpdatingClientRefreshesCache(t *testing.T) {
	assert := assert.New(t)
	require := require.New(t)

	ns := kubetest.FakeNamespace("test")
	pod := &core_v1.Pod{ObjectMeta: metav1.ObjectMeta{Name: "pod", Namespace: "test"}}

	cfg := config.NewConfig()
	kialiCache := newTestingKubeCache(t, cfg, ns, pod)
	kialiCache.clusterCacheLister = &cacheLister{}

	err := kialiCache.UpdateClient(kubetest.NewFakeK8sClient(ns, pod))
	require.NoError(err)

	assert.NotEqual(kialiCache.clusterCacheLister, &cacheLister{})

	pods, err := kialiCache.GetPods("test", "")
	require.NoError(err)
	require.Len(pods, 1)
}

func TestIstioAPIDisabled(t *testing.T) {
	assert := assert.New(t)
	ns := kubetest.FakeNamespace("test")

	cfg := config.NewConfig()
	fakeClient := kubetest.NewFakeK8sClient(ns)
	fakeClient.IstioAPIEnabled = false
	kubeCache, err := NewKubeCache(fakeClient, *cfg)
	if err != nil {
		t.Fatalf("Unable to create kube cache for testing. Err: %s", err)
	}

	_, err = kubeCache.GetVirtualServices("test", "app=bookinfo")

	assert.Error(err)
}

func ListingIstioObjectsWorksAcrossNamespacesWhenNamespaceScoped(t *testing.T) {
	assert := assert.New(t)
	require := require.New(t)

	nsAlpha := kubetest.FakeNamespace("alpha")
	nsBeta := kubetest.FakeNamespace("beta")
	vsAlpha := &networking_v1.VirtualService{
		ObjectMeta: metav1.ObjectMeta{
			Name: "test-alpha", Namespace: "alpha",
		},
	}
	vsBeta := &networking_v1.VirtualService{
		ObjectMeta: metav1.ObjectMeta{
			Name: "test-beta", Namespace: "beta",
		},
	}

	cfg := config.NewConfig()
	cfg.Deployment.ClusterWideAccess = false
	cfg.Deployment.AccessibleNamespaces = []string{"alpha", "beta"}
	kubeCache := newTestingKubeCache(t, cfg, nsAlpha, nsBeta, vsAlpha, vsBeta)

	vsList, err := kubeCache.GetVirtualServices("", "")
	require.NoError(err)
	assert.Len(vsList, 2)
}

func TestStripUnusedFields(t *testing.T) {
	tests := []struct {
		name string
		obj  any
		want any
	}{
		{
			name: "transform pods",
			obj: &core_v1.Pod{
				ObjectMeta: metav1.ObjectMeta{
					Namespace:   "foo",
					Name:        "bar",
					Labels:      map[string]string{"a": "b"},
					Annotations: map[string]string{"c": "d"},
					ManagedFields: []metav1.ManagedFieldsEntry{
						{
							Manager: "whatever",
						},
					},
				},
			},
			want: &core_v1.Pod{
				ObjectMeta: metav1.ObjectMeta{
					Namespace:   "foo",
					Name:        "bar",
					Labels:      map[string]string{"a": "b"},
					Annotations: map[string]string{"c": "d"},
				},
			},
		},
		{
			name: "transform endpoints",
			obj: &core_v1.Endpoints{
				ObjectMeta: metav1.ObjectMeta{
					Namespace:   "foo",
					Name:        "bar",
					Labels:      map[string]string{"a": "b"},
					Annotations: map[string]string{"c": "d"},
					ManagedFields: []metav1.ManagedFieldsEntry{
						{
							Manager: "whatever",
						},
					},
				},
			},
			want: &core_v1.Endpoints{
				ObjectMeta: metav1.ObjectMeta{
					Namespace:   "foo",
					Name:        "bar",
					Labels:      map[string]string{"a": "b"},
					Annotations: map[string]string{"c": "d"},
				},
			},
		},
		{
			name: "transform virtual services",
			obj: &networking_v1.VirtualService{
				ObjectMeta: metav1.ObjectMeta{
					Namespace:   "foo",
					Name:        "bar",
					Labels:      map[string]string{"a": "b"},
					Annotations: map[string]string{"c": "d"},
					ManagedFields: []metav1.ManagedFieldsEntry{
						{
							Manager: "whatever",
						},
					},
				},
			},
			want: &networking_v1.VirtualService{
				ObjectMeta: metav1.ObjectMeta{
					Namespace:   "foo",
					Name:        "bar",
					Labels:      map[string]string{"a": "b"},
					Annotations: map[string]string{"c": "d"},
				},
			},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, _ := StripUnusedFields(tt.obj)
			if !reflect.DeepEqual(got, tt.want) {
				t.Errorf("StripUnusedFields: got %v, want %v", got, tt.want)
			}
		})
	}
}

func TestGetPodTrimmed(t *testing.T) {
	assert := assert.New(t)
	require := require.New(t)
	ns := &core_v1.Namespace{ObjectMeta: metav1.ObjectMeta{Name: "test"}}
	obj := &core_v1.Pod{
		ObjectMeta: metav1.ObjectMeta{
			Name:        "foo",
			Namespace:   "test",
			Labels:      map[string]string{"a": "b"},
			Annotations: map[string]string{"c": "d"},
			OwnerReferences: []metav1.OwnerReference{
				{
					Name: "o",
				},
			},
			ManagedFields: []metav1.ManagedFieldsEntry{
				{
					Manager: "whatever",
				},
			},
		},
		Spec: core_v1.PodSpec{
			Containers: []core_v1.Container{
				{
					Name: "test",
				},
			},
			InitContainers: []core_v1.Container{
				{
					Name: "test",
				},
			},
			ServiceAccountName: "testsa",
			Hostname:           "host.com",
		},
		Status: core_v1.PodStatus{
			Phase:   "testphase",
			Message: "testmessage",
			Reason:  "reason",
			InitContainerStatuses: []core_v1.ContainerStatus{
				{
					Name: "initstatus",
				},
			},
			ContainerStatuses: []core_v1.ContainerStatus{
				{
					Name: "status",
				},
			},
		},
	}
	want := core_v1.Pod{
		TypeMeta: metav1.TypeMeta{
			Kind: "Pod",
		},
		ObjectMeta: metav1.ObjectMeta{
			Name:        "foo",
			Namespace:   "test",
			Labels:      map[string]string{"a": "b"},
			Annotations: map[string]string{"c": "d"},
			OwnerReferences: []metav1.OwnerReference{
				{
					Name: "o",
				},
			},
		},
		Spec: core_v1.PodSpec{
			Containers: []core_v1.Container{
				{
					Name: "test",
				},
			},
			InitContainers: []core_v1.Container{
				{
					Name: "test",
				},
			},
			ServiceAccountName: "testsa",
			Hostname:           "host.com",
		},
		Status: core_v1.PodStatus{
			Phase:   "testphase",
			Message: "testmessage",
			Reason:  "reason",
			InitContainerStatuses: []core_v1.ContainerStatus{
				{
					Name: "initstatus",
				},
			},
			ContainerStatuses: []core_v1.ContainerStatus{
				{
					Name: "status",
				},
			},
		},
	}

	cfg := config.NewConfig()
	kialiCache := newTestingKubeCache(t, cfg, ns, obj)
	kialiCache.Refresh("test")

	pods, err := kialiCache.GetPods("test", "a=b")
	require.NoError(err)
	assert.Equal(1, len(pods))
	if !reflect.DeepEqual(pods[0], want) {
		t.Errorf("StripUnusedFields: got %v, want %v", pods[0], want)
	}
}

func TestGetServiceTrimmed(t *testing.T) {
	assert := assert.New(t)
	require := require.New(t)
	ns := &core_v1.Namespace{ObjectMeta: metav1.ObjectMeta{Name: "test"}}
	obj := &core_v1.Service{
		ObjectMeta: metav1.ObjectMeta{
			Name:            "foo",
			Namespace:       "test",
			Labels:          map[string]string{"a": "b"},
			Annotations:     map[string]string{"c": "d"},
			ResourceVersion: "v1",
			OwnerReferences: []metav1.OwnerReference{
				{
					Name: "o",
				},
			},
			ManagedFields: []metav1.ManagedFieldsEntry{
				{
					Manager: "whatever",
				},
			},
		},
		Spec: core_v1.ServiceSpec{
			Selector: map[string]string{"a": "b"},
			Ports: []core_v1.ServicePort{
				{
					Name: "test",
					Port: 8080,
				},
			},
			Type:         kubernetes.ServiceType,
			ExternalName: "test",
			ClusterIP:    "127.0.0.1",
		},
	}
	want := core_v1.Service{
		TypeMeta: metav1.TypeMeta{
			Kind: "Service",
		},
		ObjectMeta: metav1.ObjectMeta{
			Name:            "foo",
			Namespace:       "test",
			Labels:          map[string]string{"a": "b"},
			Annotations:     map[string]string{"c": "d"},
			ResourceVersion: "v1",
			OwnerReferences: []metav1.OwnerReference{
				{
					Name: "o",
				},
			},
		},
		Spec: core_v1.ServiceSpec{
			Selector: map[string]string{"a": "b"},
			Ports: []core_v1.ServicePort{
				{
					Name: "test",
					Port: 8080,
				},
			},
			Type:         kubernetes.ServiceType,
			ExternalName: "test",
			ClusterIP:    "127.0.0.1",
		},
	}

	cfg := config.NewConfig()
	kialiCache := newTestingKubeCache(t, cfg, ns, obj)
	kialiCache.Refresh("test")

	services, err := kialiCache.GetServices("test", "a=b")
	require.NoError(err)
	assert.Equal(1, len(services))
	if !reflect.DeepEqual(services[0], want) {
		t.Errorf("StripUnusedFields: got %v, want %v", services[0], want)
	}
}
