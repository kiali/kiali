package controller

import (
	"context"
	"fmt"
	"time"

	networkingv1 "istio.io/client-go/pkg/apis/networking/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/controller"
	"sigs.k8s.io/controller-runtime/pkg/event"
	"sigs.k8s.io/controller-runtime/pkg/handler"
	ctrlsource "sigs.k8s.io/controller-runtime/pkg/source"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/config"
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
	conf *config.Config,
	kialiCache cache.KialiCache,
	validationsService *business.IstioValidationsService,
	mgr ctrl.Manager,
) error {
	reconcileInterval := conf.ExternalServices.Istio.ValidationReconcileInterval

	if reconcileInterval == nil || *reconcileInterval <= 0 {
		log.Info("Validation reconcile interval is 0 or less; skipping periodic validations.")
		return nil
	}

	log.Infof("Kiali will validate Istio configuration every: %s", *reconcileInterval)
	reconciler := NewValidationsReconciler(clusters, conf, kialiCache, validationsService, *reconcileInterval)

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
	emptyObject := &networkingv1.VirtualService{ObjectMeta: metav1.ObjectMeta{Name: "queue", Namespace: "queue"}}
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
	conf *config.Config,
	kialiCache cache.KialiCache,
	validationsService *business.IstioValidationsService,
	reconcileInterval time.Duration,
) *ValidationsReconciler {
	return &ValidationsReconciler{
		clusters:           clusters,
		conf:               conf,
		kialiCache:         kialiCache,
		reconcileInterval:  reconcileInterval,
		validationsService: validationsService,
	}
}

// validationsReconciler fetches Istio VirtualService objects and prints their names
type ValidationsReconciler struct {
	clusters           []string
	conf               *config.Config
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
	newValidations := make(models.IstioValidations)
	prevValidations := r.kialiCache.Validations().Items()

	// If enabled, the same changeMap is used on each Reconcile. It holds the "resource version" of
	// each object used in the validation, and is then used to look for version changes (or a change in
	// the number of objects).  We keep it in the cache for sane access.
	var changeMap business.ValidationChangeMap
	if r.conf.ExternalServices.Istio.ValidationChangeDetectionEnabled {
		changeMap = r.kialiCache.ValidationConfig().Items()
	}

	// validation requires cross-cluster service account information.
	vInfo, err := r.validationsService.NewValidationInfo(ctx, r.clusters, changeMap)
	if err != nil {
		log.Errorf("[ValidationsReconciler] Error creating validation info: %s", err)
		return ctrl.Result{}, err
	}

	for _, cluster := range r.clusters {
		validationPerformed, clusterValidations, err := r.validationsService.Validate(ctx, cluster, vInfo)
		if err != nil {
			log.Errorf("[ValidationsReconciler] Error performing validation for cluster %s: %s", cluster, err)
			return ctrl.Result{}, err
		}

		// if there have been no config changes for the cluster, just re-use the prior validations
		if !validationPerformed {
			log.Tracef("validations: no changes for cluster [%s], re-using", cluster)
			clusterValidations = models.IstioValidations(prevValidations).FilterByCluster(cluster)
		} else {
			log.Tracef("validations: config changes found for cluster [%s], updating", cluster)
		}

		newValidations = newValidations.MergeValidations(clusterValidations)
	}

	if r.kialiCache.Validations().Version() != version {
		return ctrl.Result{}, fmt.Errorf("validations have been updated since reconciling started. Requeuing validation")
	}

	r.kialiCache.Validations().Replace(newValidations)
	r.kialiCache.ValidationConfig().Replace(changeMap)

	return ctrl.Result{}, nil
}
