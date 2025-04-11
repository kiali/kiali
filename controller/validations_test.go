package controller_test

/*
	Unit tests for the validations controller.
	Integration tests using envtest can be found in the 'tests/integration/controller' directory.

	When should you write a unit test vs. writing an integration test? Favor integration tests over unit tests.
	Write unit tests only when there's some specific state you need to test that you can't easily setup in an integration test.
*/

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
	"sigs.k8s.io/controller-runtime/pkg/reconcile"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/controller"
	"github.com/kiali/kiali/istio"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/cache"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/store"
)

type incrementFirstVersionStore[K comparable, V any] struct {
	store.Store[K, V]
	version uint
}

func (s *incrementFirstVersionStore[K, V]) Version() uint {
	currentVersion := s.version
	if currentVersion == 0 {
		s.version++
	}
	return currentVersion
}

type incrementFirstVersionCache struct {
	cache.KialiCache
	validations *incrementFirstVersionStore[models.IstioValidationKey, *models.IstioValidation]
}

func (s *incrementFirstVersionCache) Validations() store.Store[models.IstioValidationKey, *models.IstioValidation] {
	return s.validations
}

func newIncrementFirstVersionCache(cache cache.KialiCache) *incrementFirstVersionCache {
	return &incrementFirstVersionCache{
		KialiCache:  cache,
		validations: &incrementFirstVersionStore[models.IstioValidationKey, *models.IstioValidation]{Store: cache.Validations()},
	}
}

func TestValidationsFailsToUpdateWithOldCache(t *testing.T) {
	require := require.New(t)
	conf := config.NewConfig()
	client := kubetest.NewFakeK8sClient(
		&corev1.Namespace{ObjectMeta: metav1.ObjectMeta{Name: "istio-system"}},
	)
	cache := newIncrementFirstVersionCache(business.SetupBusinessLayer(t, client, *conf))
	k8sclients := map[string]kubernetes.UserClientInterface{conf.KubernetesConfig.ClusterName: client}
	discovery := istio.NewDiscovery(kubernetes.ConvertFromUserClients(k8sclients), cache, conf)
	namespace := business.NewNamespaceService(cache, conf, discovery, kubernetes.ConvertFromUserClients(k8sclients), k8sclients)
	mesh := business.NewMeshService(conf, discovery, kubernetes.ConvertFromUserClients(k8sclients))
	layer := business.NewWithBackends(k8sclients, kubernetes.ConvertFromUserClients(k8sclients), nil, nil)
	validations := business.NewValidationsService(conf, &layer.IstioConfig, cache, &mesh, &namespace, &layer.Svc, k8sclients, &layer.Workload)
	reconciler := controller.NewValidationsReconciler([]string{conf.KubernetesConfig.ClusterName}, conf, cache, &validations, 0)

	// We want to test that the reconciler won't update the cache if the version has changed.
	// Going to test this by having an implementation of the store which increments the version
	// when you call it the first time. That way the next time it's called it will have a different
	// version and the reconciler should not update the cache.
	req := reconcile.Request{NamespacedName: types.NamespacedName{Name: "queue", Namespace: "queue"}}
	_, err := reconciler.Reconcile(context.Background(), req)
	require.Error(err)
}
