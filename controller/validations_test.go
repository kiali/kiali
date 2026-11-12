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
	ctrlclient "sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/reconcile"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/cache"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/controller"
	"github.com/kiali/kiali/kubernetes"
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
	clients := map[string]kubernetes.UserClientInterface{conf.KubernetesConfig.ClusterName: client}

	cache := newIncrementFirstVersionCache(cache.NewTestingCacheWithClients(t, kubernetes.ConvertFromUserClients(clients), *conf))
	layer := business.NewLayerBuilder(t, conf).WithClients(clients).WithCache(cache).Build()
	validations := business.NewValidationsService(conf, &layer.IstioConfig, cache, &layer.Mesh, &layer.Namespace, &layer.Svc, clients, &layer.Workload)
	reconciler := controller.NewValidationsReconciler([]string{conf.KubernetesConfig.ClusterName}, conf, cache, &validations, 0)

	// We want to test that the reconciler won't update the cache if the version has changed.
	// Going to test this by having an implementation of the store which increments the version
	// when you call it the first time. That way the next time it's called it will have a different
	// version and the reconciler should not update the cache.
	req := reconcile.Request{NamespacedName: types.NamespacedName{Name: "queue", Namespace: "queue"}}
	_, err := reconciler.Reconcile(context.Background(), req)
	require.Error(err)
}

// setupReconciler builds a two-cluster reconciler whose cache degrades the named cluster
// ("" degrades none), following the same recipe as the other degraded-cluster tests.
func setupReconciler(t *testing.T, degradedCluster string) *controller.ValidationsReconciler {
	t.Helper()
	require := require.New(t)
	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = config.DefaultClusterID
	conf.ExternalServices.Istio.IstioAPIEnabled = false
	home := conf.KubernetesConfig.ClusterName

	k8s := kubetest.NewFakeK8sClient(&corev1.Namespace{ObjectMeta: metav1.ObjectMeta{Name: "istio-system"}})
	remote := kubetest.NewFakeK8sClient(&corev1.Namespace{ObjectMeta: metav1.ObjectMeta{Name: "istio-system"}})
	clients := map[string]kubernetes.UserClientInterface{home: k8s, "remote-cluster": remote}

	access := cache.NewClusterAccess(func(context.Context, string, string, string) (bool, error) {
		return false, nil
	})
	if degradedCluster != "" {
		require.True(access.ConfirmRevoked(context.Background(), degradedCluster, "apps", "deployments"))
	}
	saClients := kubernetes.ConvertFromUserClients(clients)
	readers := map[string]ctrlclient.Reader{home: k8s, "remote-cluster": remote}
	kialiCache, err := cache.NewKialiCache(t.Context(), saClients, readers, *conf, cache.WithClusterAccess(access))
	require.NoError(err)

	layer := business.NewLayerBuilder(t, conf).WithClients(clients).WithCache(kialiCache).Build()
	validations := business.NewValidationsService(conf, &layer.IstioConfig, kialiCache, &layer.Mesh, &layer.Namespace, &layer.Svc, clients, &layer.Workload)
	return controller.NewValidationsReconciler([]string{home, "remote-cluster"}, conf, kialiCache, &validations, 0)
}

// TestValidationsReconcilerSkipsDegradedRemoteCluster pins the cluster filter's core
// contract: a degraded remote is skipped so the rest of the clusters' validations stay
// fresh. The assertion is discriminating because an unfiltered cluster list reaches
// GetAllWorkloads, which fails on the degraded remote's cache and errors the reconcile.
func TestValidationsReconcilerSkipsDegradedRemoteCluster(t *testing.T) {
	require := require.New(t)
	reconciler := setupReconciler(t, "remote-cluster")

	req := reconcile.Request{NamespacedName: types.NamespacedName{Name: "queue", Namespace: "queue"}}
	_, err := reconciler.Reconcile(context.Background(), req)
	require.NoError(err, "a degraded remote cluster is skipped, not fatal")
}

// TestValidationsReconcilerFailsOnDegradedHomeCluster pins the home-cluster contract:
// the home cluster is not skippable, so its cache being unavailable fails the reconcile.
func TestValidationsReconcilerFailsOnDegradedHomeCluster(t *testing.T) {
	require := require.New(t)
	reconciler := setupReconciler(t, config.DefaultClusterID)

	req := reconcile.Request{NamespacedName: types.NamespacedName{Name: "queue", Namespace: "queue"}}
	_, err := reconciler.Reconcile(context.Background(), req)
	require.Error(err, "the home cluster is still required")
}

// TestValidationsReconcilerWithHealthyClusters pins the pass-through: with every cache
// available the reconcile proceeds over the full cluster list.
func TestValidationsReconcilerWithHealthyClusters(t *testing.T) {
	require := require.New(t)
	reconciler := setupReconciler(t, "")

	req := reconcile.Request{NamespacedName: types.NamespacedName{Name: "queue", Namespace: "queue"}}
	_, err := reconciler.Reconcile(context.Background(), req)
	require.NoError(err)
}
