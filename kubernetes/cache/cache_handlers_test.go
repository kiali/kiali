package cache

import (
	"testing"

	"github.com/stretchr/testify/assert"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

type fakeRegistryStatus struct {
	statusRefreshed bool
}

func (f *fakeRegistryStatus) RefreshRegistryStatus() {
	f.statusRefreshed = true
}

func TestRegistryStatusUpdatedOnAdd(t *testing.T) {
	assert := assert.New(t)
	kialiCache := &fakeRegistryStatus{}
	handler := NewRegistryHandler(kialiCache.RefreshRegistryStatus)
	handler.OnAdd(&corev1.Service{})
	assert.True(kialiCache.statusRefreshed)
}

func TestRegistryStatusUpdatedOnDelete(t *testing.T) {
	assert := assert.New(t)
	kialiCache := &fakeRegistryStatus{}
	handler := NewRegistryHandler(kialiCache.RefreshRegistryStatus)
	handler.OnDelete(&corev1.Service{})
	assert.True(kialiCache.statusRefreshed)
}

func TestRegistryStatusUpdatedOnUpdate(t *testing.T) {
	cases := map[string]struct {
		old, new        interface{}
		expectedRefresh bool
	}{
		"Same revision": {
			old: &corev1.Service{
				ObjectMeta: metav1.ObjectMeta{
					ResourceVersion: "1",
				},
			},
			new: &corev1.Service{
				ObjectMeta: metav1.ObjectMeta{
					ResourceVersion: "1",
				},
			},
			expectedRefresh: false,
		},
		"Different revision": {
			old: &corev1.Service{
				ObjectMeta: metav1.ObjectMeta{
					ResourceVersion: "1",
				},
			},
			new: &corev1.Service{
				ObjectMeta: metav1.ObjectMeta{
					ResourceVersion: "2",
				},
			},
			expectedRefresh: true,
		},
		"old object not typemeta": {
			old:             &struct{}{},
			new:             &corev1.Service{},
			expectedRefresh: false,
		},
		"new object not typemeta": {
			old:             &corev1.Service{},
			new:             &struct{}{},
			expectedRefresh: false,
		},
	}

	for name, tc := range cases {
		t.Run(name, func(t *testing.T) {
			assert := assert.New(t)
			kialiCache := &fakeRegistryStatus{}
			handler := NewRegistryHandler(kialiCache.RefreshRegistryStatus)

			handler.OnUpdate(tc.old, tc.new)

			assert.Equal(tc.expectedRefresh, kialiCache.statusRefreshed)
		})
	}
}
