package controller

/*
	The controllers manage long running tasks in Kiali that take too long
	to be completed within a single request.

	As an example, the validations controller handles validations across namespaces or meshes.
	Namespace/mesh wide validations can take too long for a single request.
*/

import (
	"context"
	"fmt"

	networkingv1beta1 "istio.io/client-go/pkg/apis/networking/v1beta1"
	"k8s.io/apimachinery/pkg/runtime"
	clientgoscheme "k8s.io/client-go/kubernetes/scheme"
	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/log/zap"
	metricsserver "sigs.k8s.io/controller-runtime/pkg/metrics/server"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/cache"
	"github.com/kiali/kiali/log"
)

func NewScheme() (*runtime.Scheme, error) {
	scheme := runtime.NewScheme()
	addSchemeFuncs := []func(s *runtime.Scheme) error{
		clientgoscheme.AddToScheme,
		networkingv1beta1.AddToScheme,
	}

	for _, addToScheme := range addSchemeFuncs {
		if err := addToScheme(scheme); err != nil {
			return nil, err
		}
	}

	return scheme, nil
}

// Start creates and starts all the controllers. They'll get cancelled when the context is cancelled.
func Start(ctx context.Context, conf *config.Config, cf kubernetes.ClientFactory, kialiCache cache.KialiCache, validationsService *business.IstioValidationsService) error {
	// TODO: Replace with kiali logging but if this isn't set some errors are thrown.
	ctrl.SetLogger(zap.New())

	// Combine the istio scheme and the kube scheme.
	log.Debug("Setting up Validations Contoller")
	scheme, err := NewScheme()
	if err != nil {
		return fmt.Errorf("error setting up ValidationsController when creating scheme: %s", err)
	}

	// In the future this could be any cluster and not just home cluster.
	homeClusterInfo := cf.GetSAHomeClusterClient().ClusterInfo()

	// Create a new controller manager
	mgr, err := ctrl.NewManager(homeClusterInfo.ClientConfig, ctrl.Options{
		// Disable metrics server since Kiali has its own metrics server.
		Metrics: metricsserver.Options{BindAddress: "0"},
		Scheme:  scheme,
	})
	if err != nil {
		return fmt.Errorf("error setting up ValidationsController when creating manager: %s", err)
	}

	var clusters []string
	// We want one manager/reconciler for all clusters.
	for _, client := range cf.GetSAClients() {
		clusters = append(clusters, client.ClusterInfo().Name)
	}

	if err := NewValidationsController(ctx, clusters, kialiCache, validationsService, mgr, conf.ExternalServices.Istio.ValidationReconcileInterval); err != nil {
		return fmt.Errorf("error setting up ValidationsController: %s", err)
	}

	go func() {
		if err := mgr.Start(ctx); err != nil {
			log.Errorf("error starting Validations Controller: %s", err)
		}
		log.Debug("Stopped Validations Controller")
	}()

	return nil
}
