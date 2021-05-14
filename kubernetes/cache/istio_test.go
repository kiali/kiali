package cache

import (
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/tools/cache"

	"github.com/kiali/kiali/kubernetes"
)

type fakeInformer struct {
	cache.SharedIndexInformer
	Store *cache.FakeCustomStore
}

func (f *fakeInformer) GetStore() cache.Store {
	return f.Store
}

func TestGetIstioObjects(t *testing.T) {
	sidecar := &kubernetes.GenericIstioObject{
		TypeMeta: metav1.TypeMeta{}, // Testing with empty meta since this is empty in a real cache.
		ObjectMeta: metav1.ObjectMeta{
			Name:      "moto-sidecar",
			Namespace: "testing-ns",
			Labels: map[string]string{
				"app":     "bookinfo",
				"version": "v1",
			},
		},
		Spec: map[string]interface{}{
			"any": "any",
		},
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
				kubernetes.Sidecars: fakeInform,
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
		expectedObjects []kubernetes.IstioObject
	}{
		"With selector that matches": {
			selector:        "app=bookinfo",
			resourceType:    kubernetes.Sidecars,
			expectedErr:     nil,
			expectedObjects: []kubernetes.IstioObject{sidecar},
		},
		"With selector that doesn't match": {
			selector:        "app=anotherapp",
			resourceType:    kubernetes.Sidecars,
			expectedErr:     nil,
			expectedObjects: []kubernetes.IstioObject{},
		},
		"Without selector": {
			resourceType:    kubernetes.Sidecars,
			expectedErr:     nil,
			expectedObjects: []kubernetes.IstioObject{sidecar},
		},
		"With unparseable selector": {
			selector:        "unpar$ablestr!ng!",
			resourceType:    kubernetes.Sidecars,
			expectedErr:     fmt.Errorf("Any"),
			expectedObjects: []kubernetes.IstioObject{},
		},
		"With unknown type": {
			selector:        "unpar$ablestr!ng!",
			resourceType:    "unknowntype",
			expectedErr:     fmt.Errorf("Any"),
			expectedObjects: []kubernetes.IstioObject{},
		},
		"Uncached namespace returns empty": {
			namespace:       "uncachednamespace",
			resourceType:    kubernetes.Sidecars,
			expectedErr:     nil,
			expectedObjects: []kubernetes.IstioObject{},
		},
	}

	for name, tc := range cases {
		t.Run(name, func(t *testing.T) {
			assert := assert.New(t)

			namespace := sidecar.Namespace
			if tc.namespace != "" {
				namespace = tc.namespace
			}

			objects, err := kialiCacheImpl.GetIstioObjects(namespace, tc.resourceType, tc.selector)
			if tc.expectedErr != nil {
				assert.Error(err)
			} else {
				assert.NoError(err)
			}
			assert.Equal(len(tc.expectedObjects), len(objects))
			for _, obj := range objects {
				assert.Equal(kubernetes.SidecarType, obj.GetTypeMeta().Kind)
				assert.Equal(kubernetes.ApiNetworkingVersion, obj.GetTypeMeta().APIVersion)
			}
		})
	}
}
