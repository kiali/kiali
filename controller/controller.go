package controller

/*
	The controllers manage long running tasks in Kiali that take too long
	to be completed within a single request.

	As an example, the validations controller handles validations across namespaces or meshes.
	Namespace/mesh wide validations can take too long for a single request.
*/

import (
	"context"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/client-go/util/workqueue"

	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/event"
	"sigs.k8s.io/controller-runtime/pkg/predicate"
)

type Request struct {
	types.NamespacedName
	Cluster string
}

type EventHandler[T client.Object] struct {
	Cluster string
}

func (h EventHandler[T]) Create(ctx context.Context, e event.TypedCreateEvent[T], q workqueue.TypedRateLimitingInterface[Request]) {
	q.Add(Request{
		NamespacedName: types.NamespacedName{
			Name:      e.Object.GetName(),
			Namespace: e.Object.GetNamespace(),
		},
		Cluster: h.Cluster,
	})
}

func (h EventHandler[T]) Update(ctx context.Context, e event.TypedUpdateEvent[T], q workqueue.TypedRateLimitingInterface[Request]) {
	q.Add(Request{
		NamespacedName: types.NamespacedName{
			Name:      e.ObjectNew.GetName(),
			Namespace: e.ObjectNew.GetNamespace(),
		},
		Cluster: h.Cluster,
	})
}

func (h EventHandler[T]) Delete(ctx context.Context, e event.TypedDeleteEvent[T], q workqueue.TypedRateLimitingInterface[Request]) {
	q.Add(Request{
		NamespacedName: types.NamespacedName{
			Name:      e.Object.GetName(),
			Namespace: e.Object.GetNamespace(),
		},
		Cluster: h.Cluster,
	})
}

func (h EventHandler[T]) Generic(ctx context.Context, e event.TypedGenericEvent[T], q workqueue.TypedRateLimitingInterface[Request]) {
	q.Add(Request{
		NamespacedName: types.NamespacedName{
			Name:      e.Object.GetName(),
			Namespace: e.Object.GetNamespace(),
		},
		Cluster: h.Cluster,
	})
}

// TypedLabelSelectorPredicate constructs a Predicate from a LabelSelector.
// Only objects matching the LabelSelector will be admitted.
func TypedLabelSelectorPredicate[T client.Object](s metav1.LabelSelector) (predicate.TypedPredicate[T], error) {
	selector, err := metav1.LabelSelectorAsSelector(&s)
	if err != nil {
		return predicate.TypedFuncs[T]{}, err
	}

	return predicate.NewTypedPredicateFuncs(func(o T) bool {
		return selector.Matches(labels.Set(o.GetLabels()))
	}), nil
}
