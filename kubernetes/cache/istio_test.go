package cache

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	networking_v1beta1 "istio.io/client-go/pkg/apis/networking/v1beta1"
	istiofake "istio.io/client-go/pkg/clientset/versioned/fake"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	kubefake "k8s.io/client-go/kubernetes/fake"

	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
)

func TestGetSidecar(t *testing.T) {
	sidecar := &networking_v1beta1.Sidecar{}
	sidecar.Name = "moto-sidecar"
	sidecar.Namespace = "testing-ns"
	sidecar.Labels = map[string]string{
		"app":     "bookinfo",
		"version": "v1",
	}

	kialiCacheImpl := kialiCacheImpl{
		clusterScoped:         true,
		stopClusterScopedChan: make(chan struct{}),
		istioApi:              istiofake.NewSimpleClientset(sidecar),
		k8sApi:                kubefake.NewSimpleClientset(),
		cacheIstioTypes: map[string]bool{
			kubernetes.PluralType[kubernetes.Sidecars]: true,
		},
		clusterCacheLister: &cacheLister{},
	}
	kialiCacheImpl.registryRefreshHandler = NewRegistryHandler(kialiCacheImpl.RefreshRegistryStatus)

	cases := map[string]struct {
		selector        string
		resourceType    string
		namespace       string
		expectedErr     error
		expectedObjects []*networking_v1beta1.Sidecar
	}{
		"With selector that matches": {
			selector:        "app=bookinfo",
			resourceType:    kubernetes.Sidecars,
			expectedErr:     nil,
			expectedObjects: []*networking_v1beta1.Sidecar{sidecar},
		},
		"With selector that doesn't match": {
			selector:        "app=anotherapp",
			resourceType:    kubernetes.Sidecars,
			expectedErr:     nil,
			expectedObjects: []*networking_v1beta1.Sidecar{},
		},
		"Without selector": {
			resourceType:    kubernetes.Sidecars,
			expectedErr:     nil,
			expectedObjects: []*networking_v1beta1.Sidecar{sidecar},
		},
		"With unparseable selector": {
			selector:        "unpar$ablestr!ng!",
			resourceType:    kubernetes.Sidecars,
			expectedErr:     fmt.Errorf("Any"),
			expectedObjects: []*networking_v1beta1.Sidecar{},
		},
		"With unknown type": {
			selector:        "unpar$ablestr!ng!",
			resourceType:    "unknowntype",
			expectedErr:     fmt.Errorf("Any"),
			expectedObjects: []*networking_v1beta1.Sidecar{},
		},
		"Uncached namespace returns empty": {
			namespace:       "uncachednamespace",
			resourceType:    kubernetes.Sidecars,
			expectedErr:     nil,
			expectedObjects: []*networking_v1beta1.Sidecar{},
		},
	}

	for name, tc := range cases {
		t.Run(name, func(t *testing.T) {
			assert := assert.New(t)
			kialiCacheImpl.Refresh(tc.namespace)

			namespace := sidecar.Namespace
			if tc.namespace != "" {
				namespace = tc.namespace
			}

			objects, err := kialiCacheImpl.GetSidecars(namespace, tc.selector)
			if tc.expectedErr != nil {
				assert.Error(err)
			} else {
				assert.NoError(err)
			}
			assert.Equal(len(tc.expectedObjects), len(objects))
		})
	}
}

func TestGetNonCachedResource(t *testing.T) {
	assert := assert.New(t)
	sidecar := &networking_v1beta1.VirtualService{
		ObjectMeta: metav1.ObjectMeta{
			Name: "sidecar", Namespace: "test", Labels: map[string]string{"app": "bookinfo", "version": "v1"},
		},
	}
	kialiCache := newTestKialiCache(kubetest.NewFakeK8sClient(sidecar))
	kialiCache.cacheIstioTypes = nil
	_, err := kialiCache.GetVirtualServices("testing-ns", "app=bookinfo")
	assert.Error(err)
}

// Other parts of the codebase assume that this kind field is present so it's important
// that the cache sets it.
func TestGetAndListReturnKindInfo(t *testing.T) {
	assert := assert.New(t)
	vs := &networking_v1beta1.VirtualService{
		ObjectMeta: metav1.ObjectMeta{
			Name: "vs", Namespace: "test",
		},
	}
	kialiCache := newTestKialiCache(kubetest.NewFakeK8sClient(vs))
	kialiCache.cacheIstioTypes = map[string]bool{
		kubernetes.PluralType[kubernetes.VirtualServices]: true,
	}
	kialiCache.Refresh("test")

	vsFromCache, err := kialiCache.GetVirtualService("test", "vs")
	assert.NoError(err)
	assert.Equal(kubernetes.VirtualServiceType, vsFromCache.Kind)

	vsListFromCache, err := kialiCache.GetVirtualServices("test", "")
	assert.NoError(err)
	for _, vs := range vsListFromCache {
		assert.Equal(kubernetes.VirtualServiceType, vs.Kind)
	}
}
