package kubernetes_test

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
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
