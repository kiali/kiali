package cache

import (
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	networking_v1alpha3 "istio.io/client-go/pkg/apis/networking/v1alpha3"
	"k8s.io/apimachinery/pkg/fields"
	"k8s.io/client-go/tools/cache"

	"github.com/kiali/kiali/kubernetes"
)

func TestGetSidecar(t *testing.T) {
	sidecar := &networking_v1alpha3.Sidecar{}
	sidecar.Name = "moto-sidecar"
	sidecar.Namespace = "testing-ns"
	sidecar.Labels = map[string]string{
		"app":     "bookinfo",
		"version": "v1",
	}

	fakeInform := &fakeInformer{
		SharedIndexInformer: createIstioIndexInformer(nil, kubernetes.Sidecars, time.Minute, "anyns"),
		Store: &cache.FakeCustomStore{
			ListFunc: func() []interface{} {
				return []interface{}{sidecar}
			},
		},
	}

	kialiCacheImpl := kialiCacheImpl{
		nsCache: map[string]typeCache{
			sidecar.Namespace: {
				kubernetes.SidecarType: fakeInform,
			},
		},
		cacheIstioTypes: map[string]bool{
			kubernetes.PluralType[kubernetes.Sidecars]: true,
		},
	}

	cases := map[string]struct {
		selector        string
		resourceType    string
		namespace       string
		expectedErr     error
		expectedObjects []networking_v1alpha3.Sidecar
	}{
		"With selector that matches": {
			selector:        "app=bookinfo",
			resourceType:    kubernetes.Sidecars,
			expectedErr:     nil,
			expectedObjects: []networking_v1alpha3.Sidecar{*sidecar},
		},
		"With selector that doesn't match": {
			selector:        "app=anotherapp",
			resourceType:    kubernetes.Sidecars,
			expectedErr:     nil,
			expectedObjects: []networking_v1alpha3.Sidecar{},
		},
		"Without selector": {
			resourceType:    kubernetes.Sidecars,
			expectedErr:     nil,
			expectedObjects: []networking_v1alpha3.Sidecar{*sidecar},
		},
		"With unparseable selector": {
			selector:        "unpar$ablestr!ng!",
			resourceType:    kubernetes.Sidecars,
			expectedErr:     fmt.Errorf("Any"),
			expectedObjects: []networking_v1alpha3.Sidecar{},
		},
		"With unknown type": {
			selector:        "unpar$ablestr!ng!",
			resourceType:    "unknowntype",
			expectedErr:     fmt.Errorf("Any"),
			expectedObjects: []networking_v1alpha3.Sidecar{},
		},
		"Uncached namespace returns empty": {
			namespace:       "uncachednamespace",
			resourceType:    kubernetes.Sidecars,
			expectedErr:     nil,
			expectedObjects: []networking_v1alpha3.Sidecar{},
		},
	}

	for name, tc := range cases {
		t.Run(name, func(t *testing.T) {
			assert := assert.New(t)

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

func createIstioIndexInformer(getter cache.Getter, resourceType string, refreshDuration time.Duration, namespace string) cache.SharedIndexInformer {
	return cache.NewSharedIndexInformer(cache.NewListWatchFromClient(getter, resourceType, namespace, fields.Everything()),
		&networking_v1alpha3.Sidecar{},
		refreshDuration,
		cache.Indexers{},
	)
}
