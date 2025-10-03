//go:build !exclude_frontend

package cmd

import (
	"context"
	"fmt"
	"io/fs"
	"maps"
	"os"
	"slices"

	"github.com/go-logr/zerologr"
	"github.com/rs/zerolog"
	extentionsv1alpha1 "istio.io/client-go/pkg/apis/extensions/v1alpha1"
	networkingv1 "istio.io/client-go/pkg/apis/networking/v1"
	networkingv1alpha3 "istio.io/client-go/pkg/apis/networking/v1alpha3"
	securityv1 "istio.io/client-go/pkg/apis/security/v1"
	telemetryv1 "istio.io/client-go/pkg/apis/telemetry/v1"
	appsv1 "k8s.io/api/apps/v1"
	batchv1 "k8s.io/api/batch/v1"
	corev1 "k8s.io/api/core/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	toolscache "k8s.io/client-go/tools/cache"
	ctrl "sigs.k8s.io/controller-runtime"
	ctrlcache "sigs.k8s.io/controller-runtime/pkg/cache"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/cluster"
	"sigs.k8s.io/controller-runtime/pkg/manager"
	metricsserver "sigs.k8s.io/controller-runtime/pkg/metrics/server"
	k8sinferencev1 "sigs.k8s.io/gateway-api-inference-extension/api/v1"
	k8snetworkingv1 "sigs.k8s.io/gateway-api/apis/v1"
	k8snetworkingv1alpha2 "sigs.k8s.io/gateway-api/apis/v1alpha2"
	k8snetworkingv1beta1 "sigs.k8s.io/gateway-api/apis/v1beta1"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/cache"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/controller"
	"github.com/kiali/kiali/frontend"
	"github.com/kiali/kiali/grafana"
	"github.com/kiali/kiali/istio"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/prometheus"
	"github.com/kiali/kiali/prometheus/internalmetrics"
	"github.com/kiali/kiali/server"
	"github.com/kiali/kiali/tracing"
)

func run(ctx context.Context, conf *config.Config, staticAssetFS fs.FS, clientFactory kubernetes.ClientFactory) <-chan struct{} {
	logger := log.Logger()
	// log startup information
	log.Infof("Kiali: Version: %v, Commit: %v, Go: %v", version, commitHash, goVersion)

	mgr, kubeCaches, err := newManager(ctx, conf, logger, clientFactory)
	if err != nil {
		log.Fatalf("Unable to setup manager: %s", err)
	}

	log.Info("Initializing Kiali Cache")
	cache, err := cache.NewKialiCache(ctx, clientFactory.GetSAClients(), asReaders(kubeCaches), *conf)
	if err != nil {
		log.Fatalf("Error initializing Kiali Cache. Details: %s", err)
	}

	cache.SetBuildInfo(models.BuildInfo{
		CommitHash:       commitHash,
		ContainerVersion: determineContainerVersion(version),
		GoVersion:        goVersion,
		Version:          version,
	})

	discovery := istio.NewDiscovery(clientFactory.GetSAClients(), cache, conf)
	cpm := business.NewControlPlaneMonitor(cache, clientFactory, conf, discovery)

	// Create shared prometheus client shared by all prometheus requests in the business layer.
	prom, err := prometheus.NewClient(*conf, clientFactory.GetSAHomeClusterClient().GetToken())
	if err != nil {
		log.Fatalf("Error creating Prometheus client: %s", err)
	}

	// Create shared tracing client shared by all tracing requests in the business layer.
	// Because tracing is not an essential component, we don't want to block startup
	// of the server if the tracing client fails to initialize. tracing.NewClient will
	// continue to retry until the client is initialized or the context is cancelled.
	// Passing in a loader function allows the tracing client to be used once it is
	// finally initialized.
	var tracingClient tracing.ClientInterface
	tracingLoader := func() tracing.ClientInterface {
		return tracingClient
	}
	if conf.ExternalServices.Tracing.Enabled {
		go func() {
			client, err := tracing.NewClient(ctx, conf, clientFactory.GetSAHomeClusterClient().GetToken(), true)
			if err != nil {
				log.Fatalf("Error creating tracing client: %s", err)
				return
			}
			tracingClient = client
		}()
	} else {
		log.Debug("Tracing is disabled")
	}

	grafana := grafana.NewService(conf, clientFactory.GetSAHomeClusterClient())

	// Needs to be started after the server so that the cache is started because the controllers use the cache.
	// Passing nil here because the tracing client is not used for validations and that is all this layer is used for.
	// Passing the `tracingClient` above would be a race condition since it gets set in a goroutine.
	layer, err := business.NewLayerWithSAClients(conf, cache, prom, nil, cpm, grafana, discovery, clientFactory.GetSAClientsAsUserClientInterfaces())
	if err != nil {
		log.Fatalf("Error creating business layer: %s", err)
	}

	if conf.IsValidationsEnabled() {
		if err := controller.NewValidationsController(ctx, slices.Collect(maps.Keys(kubeCaches)), conf, cache, &layer.Validations, mgr); err != nil {
			log.Fatal(err)
		}
	} else {
		log.Info("Validation reconcile interval is 0 or less; skipping periodic validations.")
	}

	controllerStopped := make(chan struct{})
	go func() {
		defer close(controllerStopped)
		if err := mgr.Start(ctx); err != nil {
			log.Errorf("error starting Validations Controller: %s", err)
		}
		log.Debug("Stopped Validations Controller")
	}()

	// Not totally sure we need to call this for all clusters but better to be safe.
	for cluster, cache := range kubeCaches {
		log.Infof("Waiting for cluster: %s cache to sync", cluster)

		if !cache.WaitForCacheSync(ctx) {
			log.Fatal("Timed out waiting for cache to sync")
		}
	}
	log.Info("All caches synced")

	if conf.ExternalServices.Istio.IstioAPIEnabled {
		cpm.PollIstiodForProxyStatus(ctx)
	}

	// Start listening to requests
	server, err := server.NewServer(cpm, clientFactory, cache, conf, prom, tracingLoader, discovery, staticAssetFS)
	if err != nil {
		log.Fatal(err)
	}
	server.Start()

	stopped := make(chan struct{})
	go func() {
		// Shutdown internal components
		<-ctx.Done()
		log.Info("Shutting down internal components")
		server.Stop()
		// Wait for controller and cache to stop.
		<-controllerStopped
		close(stopped)
	}()
	return stopped
}

func RunServer(ctx context.Context, conf *config.Config, clientFactory kubernetes.ClientFactory) <-chan struct{} {
	staticAssetFS, err := fs.Sub(frontend.FrontendBuildAssets, "build")
	if err != nil {
		log.Fatalf("Error getting subfolder: %v", err)
	}

	// prepare our internal metrics so Prometheus can scrape them
	internalmetrics.RegisterInternalMetrics()

	return run(ctx, conf, staticAssetFS, clientFactory)
}

// determineContainerVersion will return the version of the image container.
// It does this by looking at an ENV defined in the Dockerfile when the image is built.
// If the ENV is not defined, the version is assumed the same as the given default value.
func determineContainerVersion(defaultVersion string) string {
	v := os.Getenv("KIALI_CONTAINER_VERSION")
	if v == "" {
		return defaultVersion
	}
	return v
}

func asReaders(caches map[string]ctrlcache.Cache) map[string]client.Reader {
	if caches == nil {
		return nil
	}

	readers := map[string]client.Reader{}
	for cluster, c := range caches {
		readers[cluster] = c
	}
	return readers
}

func newManager(ctx context.Context, conf *config.Config, logger *zerolog.Logger, clientFactory kubernetes.ClientFactory) (manager.Manager, map[string]ctrlcache.Cache, error) {
	ctrl.SetLogger(zerologr.New(logger))

	// Combine the istio scheme and the kube scheme.
	scheme, err := kubernetes.NewScheme()
	if err != nil {
		return nil, nil, fmt.Errorf("error setting up manager when creating scheme: %s", err)
	}

	// In the future this could be any cluster and not just home cluster.
	homeClusterInfo := clientFactory.GetSAHomeClusterClient().ClusterInfo()
	var defaultNamespaces map[string]ctrlcache.Config
	if !conf.AllNamespacesAccessible() {
		defaultNamespaces = make(map[string]ctrlcache.Config)
		for _, namespace := range conf.Deployment.AccessibleNamespaces {
			defaultNamespaces[namespace] = ctrlcache.Config{}
		}
	}

	var mgr manager.Manager
	mgr, err = ctrl.NewManager(homeClusterInfo.ClientConfig, ctrl.Options{
		// Disabling caching for ConfigMaps, as in large clusters it can take a lot of unnecessary memory.
		Client: client.Options{
			Cache: &client.CacheOptions{
				DisableFor: []client.Object{
					&corev1.ConfigMap{},
				},
			},
		},
		// Disable metrics server since Kiali has its own metrics server.
		Cache: ctrlcache.Options{
			DefaultNamespaces: defaultNamespaces,
			DefaultWatchErrorHandler: func(ctx context.Context, r *toolscache.Reflector, err error) {
				if apierrors.IsForbidden(err) {
					log.Infof("A namespace appears to have been deleted or Kiali is forbidden from seeing it [err=%v]. Shutting down cache.", err)
					// These are all the types that Kiali caches.
					for _, obj := range []client.Object{
						&corev1.Pod{},
						&corev1.Service{},
						&appsv1.StatefulSet{},
						&appsv1.DaemonSet{},
						&corev1.ConfigMap{},
						&batchv1.CronJob{},
						&batchv1.Job{},
						&appsv1.Deployment{},
						&appsv1.ReplicaSet{},
						&networkingv1.Gateway{},
						&networkingv1.DestinationRule{},
						&networkingv1.Sidecar{},
						&networkingv1.ServiceEntry{},
						&networkingv1.VirtualService{},
						&networkingv1.WorkloadEntry{},
						&networkingv1.WorkloadGroup{},
						&extentionsv1alpha1.WasmPlugin{},
						&networkingv1alpha3.EnvoyFilter{},
						&securityv1.AuthorizationPolicy{},
						&securityv1.PeerAuthentication{},
						&securityv1.RequestAuthentication{},
						&telemetryv1.Telemetry{},
						&k8snetworkingv1.Gateway{},
						&k8snetworkingv1.GatewayClass{},
						&k8snetworkingv1.HTTPRoute{},
						&k8snetworkingv1.GRPCRoute{},
						&k8sinferencev1.InferencePool{},
						&k8snetworkingv1beta1.ReferenceGrant{},
						&k8snetworkingv1alpha2.TCPRoute{},
						&k8snetworkingv1alpha2.TLSRoute{},
					} {
						log.Debugf("Removing informer for: %T", obj)
						if err := mgr.GetCache().RemoveInformer(ctx, obj); err != nil {
							log.Errorf("Unable to remove informer: %s", err)
						}
					}
				}
			},
			DefaultTransform: ctrlcache.TransformStripManagedFields(),
			ByObject: map[client.Object]ctrlcache.ByObject{
				&corev1.Pod{}: {
					Transform: cache.TransformPod,
				},
				&corev1.Service{}: {
					Transform: cache.TransformService,
				},
			},
		},
		Metrics: metricsserver.Options{BindAddress: "0"},
		Scheme:  scheme,
	})
	if err != nil {
		return nil, nil, fmt.Errorf("error setting up ValidationsController when creating manager: %s", err)
	}

	kubeCaches := map[string]ctrlcache.Cache{}
	// We want one manager/reconciler for all clusters.
	for _, client := range clientFactory.GetSAClients() {
		if client.ClusterInfo().Name == homeClusterInfo.Name {
			kubeCaches[client.ClusterInfo().Name] = mgr.GetCache()
		} else {
			cluster, err := cluster.New(client.ClusterInfo().ClientConfig, func(o *cluster.Options) {
				o.Scheme = scheme
			})
			if err != nil {
				log.Fatal(err)
			}
			if err := mgr.Add(cluster); err != nil {
				log.Fatal(err)
			}
			kubeCaches[client.ClusterInfo().Name] = cluster.GetCache()
		}
	}

	return mgr, kubeCaches, nil
}
