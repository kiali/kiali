package validation

import (
	"context"
	"fmt"

	"github.com/go-logr/logr"
	"k8s.io/apimachinery/pkg/api/errors"
	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/builder"
	ctrlcache "sigs.k8s.io/controller-runtime/pkg/cache"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/controller"
	"sigs.k8s.io/controller-runtime/pkg/log"
	"sigs.k8s.io/controller-runtime/pkg/reconcile"
	"sigs.k8s.io/controller-runtime/pkg/source"
	gatewayapiv1beta1 "sigs.k8s.io/gateway-api/apis/v1beta1"

	"github.com/kiali/kiali/business/checkers"
	"github.com/kiali/kiali/business/checkers/k8sreferencegrants"
	"github.com/kiali/kiali/config"
	kialictrl "github.com/kiali/kiali/controller"
	"github.com/kiali/kiali/kubernetes/cache"
)

type ReferenceGrantReconciler struct {
	caches     map[string]ctrlcache.Cache
	clients    map[string]client.Reader
	conf       *config.Config
	kialiCache cache.KialiCache
}

func NewReferenceGrantReconciler(caches map[string]ctrlcache.Cache, conf *config.Config, kialiCache cache.KialiCache) *ReferenceGrantReconciler {
	clients := map[string]client.Reader{}
	for cluster, cache := range caches {
		clients[cluster] = cache
	}

	return &ReferenceGrantReconciler{
		caches:     caches,
		clients:    clients,
		conf:       conf,
		kialiCache: kialiCache,
	}
}

func (r *ReferenceGrantReconciler) Reconcile(ctx context.Context, req kialictrl.Request) (reconcile.Result, error) {
	log := log.FromContext(ctx)

	log.Info("Getting Reference Grant")
	client, ok := r.clients[req.Cluster]
	if !ok {
		return reconcile.Result{}, fmt.Errorf("client for cluster: %s not found", req.Cluster)
	}

	rg := &gatewayapiv1beta1.ReferenceGrant{}
	if err := client.Get(ctx, req.NamespacedName, rg); err != nil {
		if errors.IsNotFound(err) {
			log.Info("ReferenceGrant no longer exists. Skipping validation...")
			return reconcile.Result{}, nil
		} else {
			return reconcile.Result{}, fmt.Errorf("unable to get ReferenceGrant from cache: %s", err)
		}
	}

	checker := k8sreferencegrants.SingleNamespaceChecker{
		Client:         client,
		ReferenceGrant: *rg,
	}

	key, validations := checkers.EmptyValidValidation(rg.Name, rg.Namespace, rg.GetObjectKind().GroupVersionKind(), req.Cluster)

	checks, validChecker := checker.Check()
	validations.Checks = append(validations.Checks, checks...)
	validations.Valid = validations.Valid && validChecker

	log.Info("Setting validation")
	r.kialiCache.Validations().Set(key, validations)

	return reconcile.Result{}, nil
}

// SetupWithManager sets up the controller with the Manager.
func (r *ReferenceGrantReconciler) SetupWithManager(mgr ctrl.Manager) error {
	logger := mgr.GetLogger().WithName("controller").WithName("validations-reference-grant")

	b := builder.TypedControllerManagedBy[kialictrl.Request](mgr).
		WithOptions(controller.TypedOptions[kialictrl.Request]{
			LogConstructor: func(req *kialictrl.Request) logr.Logger {
				log := logger
				if req != nil {
					log = log.WithValues("name", req.Name, "namespace", req.Namespace, "cluster", req.Cluster)
				}
				return log
			},
		}).Named("validations-k8s-reference-grant")
	for cluster, cache := range r.caches {
		b.WatchesRawSource(source.TypedKind(
			cache,
			&gatewayapiv1beta1.ReferenceGrant{},
			&kialictrl.EventHandler[*gatewayapiv1beta1.ReferenceGrant]{Cluster: cluster},
		))
	}

	if err := b.Complete(r); err != nil {
		return fmt.Errorf("unable to build ReferenceGrantReconciler: %s", err)
	}

	return nil
}
