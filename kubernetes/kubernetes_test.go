package kubernetes_test

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
	networkingv1 "istio.io/client-go/pkg/apis/networking/v1"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/api/meta"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"sigs.k8s.io/controller-runtime/pkg/client"

	"github.com/kiali/kiali/kubernetes"
)

type fakeReader struct {
	Do     func() error
	Object client.Object
	reads  int
}

func (f *fakeReader) Get(ctx context.Context, key client.ObjectKey, obj client.Object, opts ...client.GetOption) error {
	f.reads++
	if f.reads > 1 {
		if err := f.Do(); err != nil {
			return err
		}
	}

	if f.Object == nil {
		return errors.NewNotFound(schema.GroupResource{}, key.Name)
	}

	// Setting this via reflection wasn't working so just marshal json.
	b, err := json.Marshal(f.Object)
	if err != nil {
		panic(err)
	}
	if err := json.Unmarshal(b, obj); err != nil {
		panic(err)
	}

	return nil
}

func (f *fakeReader) List(ctx context.Context, list client.ObjectList, opts ...client.ListOption) error {
	return nil
}

func TestWaitForObjUpdate(t *testing.T) {
	require := require.New(t)
	pod := &corev1.Pod{
		ObjectMeta: metav1.ObjectMeta{
			ResourceVersion: "1",
		},
	}
	r := &fakeReader{
		Object: pod.DeepCopy(),
	}
	r.Do = func() error {
		r.Object.SetResourceVersion("2")
		return nil
	}
	// bump the RV to 2 to simulate an update
	pod.ResourceVersion = "2"
	require.NoError(kubernetes.WaitForObjectUpdateInCache(context.Background(), r, pod))
}

func TestWaitForObjDelete(t *testing.T) {
	require := require.New(t)
	pod := &corev1.Pod{
		ObjectMeta: metav1.ObjectMeta{
			ResourceVersion: "1",
		},
	}
	r := &fakeReader{
		Object: pod,
	}
	r.Do = func() error {
		r.Object = nil
		return errors.NewNotFound(schema.GroupResource{}, pod.Name)
	}
	require.NoError(kubernetes.WaitForObjectDeleteInCache(context.Background(), r, pod.DeepCopy()))
}

func TestWaitForObjCreate(t *testing.T) {
	require := require.New(t)
	pod := &corev1.Pod{
		ObjectMeta: metav1.ObjectMeta{
			ResourceVersion: "1",
		},
	}
	r := &fakeReader{}
	r.Do = func() error {
		r.Object = pod
		return nil
	}
	require.NoError(kubernetes.WaitForObjectCreateInCache(context.Background(), r, pod.DeepCopy()))
}

type unknownObject struct {
	metav1.TypeMeta
	metav1.ObjectMeta
}

func (u *unknownObject) DeepCopyObject() runtime.Object {
	return &unknownObject{
		TypeMeta:   u.TypeMeta,
		ObjectMeta: *u.DeepCopy(),
	}
}

func TestEnsureTypeMeta(t *testing.T) {
	testCases := map[string]struct {
		obj         runtime.Object
		expected    metav1.TypeMeta
		expectError bool
	}{
		"single object without TypeMeta": {
			obj: &networkingv1.VirtualService{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "test-vs",
					Namespace: "default",
				},
			},
			expected: metav1.TypeMeta{
				Kind:       "VirtualService",
				APIVersion: "networking.istio.io/v1",
			},
		},
		"single object with TypeMeta already set": {
			obj: &networkingv1.VirtualService{
				TypeMeta: metav1.TypeMeta{
					Kind:       "VirtualService",
					APIVersion: "networking.istio.io/v1",
				},
				ObjectMeta: metav1.ObjectMeta{
					Name:      "test-vs",
					Namespace: "default",
				},
			},
			expected: metav1.TypeMeta{
				Kind:       "VirtualService",
				APIVersion: "networking.istio.io/v1",
			},
		},
		"unknown object type returns error": {
			obj: &unknownObject{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "test-unknown",
					Namespace: "default",
				},
			},
			expectError: true,
		},
	}

	for name, tc := range testCases {
		t.Run(name, func(t *testing.T) {
			require := require.New(t)

			err := kubernetes.EnsureTypeMeta(tc.obj)
			if tc.expectError {
				require.Error(err)
				return
			}
			require.NoError(err)

			accessor, err := meta.TypeAccessor(tc.obj)
			require.NoError(err)

			require.Equal(tc.expected.APIVersion, accessor.GetAPIVersion())
			require.Equal(tc.expected.Kind, accessor.GetKind())
		})
	}
}

func TestEnsureTypeMetaList(t *testing.T) {
	testCases := map[string]struct {
		obj      runtime.Object
		expected metav1.TypeMeta
	}{
		"list without TypeMeta on items": {
			obj: &networkingv1.VirtualServiceList{
				Items: []*networkingv1.VirtualService{
					{
						ObjectMeta: metav1.ObjectMeta{
							Name:      "vs-1",
							Namespace: "default",
						},
					},
					{
						ObjectMeta: metav1.ObjectMeta{
							Name:      "vs-2",
							Namespace: "default",
						},
					},
				},
			},
			expected: metav1.TypeMeta{
				Kind:       "VirtualService",
				APIVersion: "networking.istio.io/v1",
			},
		},
		"list with TypeMeta on items on list but not items": {
			obj: &networkingv1.VirtualServiceList{
				TypeMeta: metav1.TypeMeta{
					Kind:       "VirtualServiceList",
					APIVersion: "networking.istio.io/v1",
				},
				Items: []*networkingv1.VirtualService{
					{
						ObjectMeta: metav1.ObjectMeta{
							Name:      "vs-1",
							Namespace: "default",
						},
					},
					{
						ObjectMeta: metav1.ObjectMeta{
							Name:      "vs-2",
							Namespace: "default",
						},
					},
				},
			},
			expected: metav1.TypeMeta{
				Kind:       "VirtualService",
				APIVersion: "networking.istio.io/v1",
			},
		},
		"list with TypeMeta on items but not list": {
			obj: &networkingv1.VirtualServiceList{
				Items: []*networkingv1.VirtualService{
					{
						TypeMeta: metav1.TypeMeta{
							Kind:       "VirtualService",
							APIVersion: "networking.istio.io/v1",
						},
						ObjectMeta: metav1.ObjectMeta{
							Name:      "vs-1",
							Namespace: "default",
						},
					},
					{
						TypeMeta: metav1.TypeMeta{
							Kind:       "VirtualService",
							APIVersion: "networking.istio.io/v1",
						},
						ObjectMeta: metav1.ObjectMeta{
							Name:      "vs-2",
							Namespace: "default",
						},
					},
				},
			},
			expected: metav1.TypeMeta{
				Kind:       "VirtualService",
				APIVersion: "networking.istio.io/v1",
			},
		},
		"empty list": {
			obj: &networkingv1.VirtualServiceList{
				Items: []*networkingv1.VirtualService{},
			},
		},
	}

	for name, tc := range testCases {
		t.Run(name, func(t *testing.T) {
			require := require.New(t)

			initialLen := len(tc.obj.(*networkingv1.VirtualServiceList).Items)

			err := kubernetes.EnsureTypeMeta(tc.obj)
			require.NoError(err)

			list := tc.obj.(*networkingv1.VirtualServiceList)
			require.Len(list.Items, initialLen)
			for _, item := range list.Items {
				require.Equal(tc.expected.Kind, item.Kind)
				require.Equal(tc.expected.APIVersion, item.APIVersion)
			}
		})
	}
}
