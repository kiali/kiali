package controller

import (
	"context"
	"fmt"
	"time"

	networkingv1beta1 "istio.io/client-go/pkg/apis/networking/v1beta1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/controller"
	"sigs.k8s.io/controller-runtime/pkg/event"
	"sigs.k8s.io/controller-runtime/pkg/handler"
	ctrlsource "sigs.k8s.io/controller-runtime/pkg/source"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/kubernetes/cache"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
)

// newValidationsController creates and starts a new controller for the validations.
// It stops when the ctx is cancelled. It creates a single controller for all clusters.
// A single controller is needed if cross clusters validations are performed in the future.
func NewValidationsController(
	ctx context.Context,
	clusters []string,
	kialiCache cache.KialiCache,
	validationsService *business.IstioValidationsService,
	mgr ctrl.Manager,
	reconcileInterval *time.Duration,
) error {
	log.Infof("Kiali will validate Istio configuration every: %s", *reconcileInterval)
	reconciler := NewValidationsReconciler(clusters, kialiCache, validationsService, *reconcileInterval)

	validationsController, err := controller.New("validations-controller", mgr, controller.Options{
		Reconciler: reconciler,
	})
	if err != nil {
		return fmt.Errorf("error setting up ValidationsController when creating controller: %s", err)
	}

	events := make(chan event.GenericEvent)
	ticker := time.NewTicker(reconciler.reconcileInterval)
	// Dummy event object because the controller needs a real object.
	// Setting name/namespace here so that all work items are the same.
	// That way if validations are taking longer than the timer then we
	// won't try to re-validate until the existing work is done.
	emptyObject := &networkingv1beta1.VirtualService{ObjectMeta: metav1.ObjectMeta{Name: "queue", Namespace: "queue"}}
	go func() {
		// Prime the pump
		select {
		case <-ctx.Done():
			ticker.Stop()
			return
		default:
			events <- event.GenericEvent{Object: emptyObject}
		}

		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				events <- event.GenericEvent{Object: emptyObject}
			}
		}
	}()

	if err := validationsController.Watch(ctrlsource.Channel(events, &handler.EnqueueRequestForObject{})); err != nil {
		return fmt.Errorf("error setting up ValidationsController when creating controller watch: %s", err)
	}

	return nil
}

func NewValidationsReconciler(
	clusters []string,
	kialiCache cache.KialiCache,
	validationsService *business.IstioValidationsService,
	reconcileInterval time.Duration,
) *ValidationsReconciler {
	return &ValidationsReconciler{
		clusters:           clusters,
		kialiCache:         kialiCache,
		reconcileInterval:  reconcileInterval,
		validationsService: validationsService,
	}
}

// validationsReconciler fetches Istio VirtualService objects and prints their names
type ValidationsReconciler struct {
	clusters           []string
	kialiCache         cache.KialiCache
	reconcileInterval  time.Duration
	validationsService *business.IstioValidationsService
}

// Reconcile fetches the VirtualService and prints its name
func (r *ValidationsReconciler) Reconcile(ctx context.Context, req ctrl.Request) (ctrl.Result, error) {
	log.Debug("[ValidationsReconciler] Started reconciling ")
	startTime := time.Now()
	defer func() {
		totalReconcileTime := time.Since(startTime)
		log.Debugf("[ValidationsReconciler] Finished reconciling in %.2fs", totalReconcileTime.Seconds())
		if totalReconcileTime > r.reconcileInterval {
			const warningLog = "[ValidationsReconciler] Reconcile took longer than the reconcile interval of [%s]. " +
				"If this continues, validations will be increasingly stale. You can configure how often Kiali validates " +
				"istio configuration by setting the 'external_services.istio.validation_reconcile_interval' config option. " +
				"If the issue still persists, please open an issue at www.github.com/kiali/kiali"
			log.Warningf(warningLog, r.reconcileInterval)
		}
	}()

	// Check version before performing replace.
	version := r.kialiCache.Validations().Version()
	allClusterValidations := make(models.IstioValidations)
	for _, cluster := range r.clusters {
		clusterValidations, err := r.validationsService.CreateValidations(ctx, cluster)
		if err != nil {
			log.Errorf("[ValidationsReconciler] Error creating validations for cluster %s: %s", cluster, err)
			return ctrl.Result{}, err
		}

		allClusterValidations = allClusterValidations.MergeValidations(clusterValidations)
	}

	if r.kialiCache.Validations().Version() != version {
		return ctrl.Result{}, fmt.Errorf("validations have been updated since reconciling started. Requeing to revalidate")
	}

	r.kialiCache.Validations().Replace(allClusterValidations)

	return ctrl.Result{}, nil
}
