//go:build !exclude_frontend

package cmd

import (
	"context"
	"errors"
	"fmt"
	"io/fs"
	"maps"
	"os"
	"slices"
	"time"

	"github.com/go-logr/zerologr"
	"github.com/rs/zerolog"
	"golang.org/x/sync/errgroup"
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
	"github.com/kiali/kiali/tlspolicy"
	"github.com/kiali/kiali/tracing"
)

func run(ctx context.Context, conf *config.Config, staticAssetFS fs.FS, clientFactory kubernetes.ClientFactory) <-chan struct{} {
	logger := log.Logger()
	// log startup information
	log.Infof("Kiali: Version: %v, Commit: %v, Go: %v", version, commitHash, goVersion)

	policy, err := tlspolicy.Resolve(ctx, conf, clientFactory.GetSAHomeClusterClient())
	if err != nil {
		log.Fatalf("Unable to resolve TLS policy: %s", err)
	}
	conf.ResolvedTLSPolicy = policy
	config.Set(conf)
	log.Infof("TLS policy source [%s] min_version [%s] max_version [%s] cipher_suites count=[%d] groups count=[%d]", policy.Source, policy.MinVersionName(), policy.MaxVersionName(), len(policy.CipherSuites), len(policy.Groups))

	clusterAccess := cache.NewClusterAccess(newAccessCheck(conf, clientFactory))
	go clusterAccess.Run(ctx, cache.DefaultAccessProbeInterval)

	mgr, kubeCaches, err := newManager(conf, logger, clientFactory, clusterAccess)
	if err != nil {
		log.Fatalf("Unable to setup manager: %s", err)
	}

	log.Info("Initializing Kiali Cache")
	cache, err := cache.NewKialiCache(ctx, clientFactory.GetSAClients(), asReaders(kubeCaches), *conf, cache.WithClusterAccess(clusterAccess))
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

	// Prefer the SA token file path over a static token snapshot so that the
	// CredentialManager can watch the file and pick up rotated tokens automatically
	// (e.g. projected service-account tokens rotated by the kubelet).
	homeClient := clientFactory.GetSAHomeClusterClient()
	kialiToken := kubernetes.GetServiceAccountTokenCredential(homeClient)
	business.SetKialiSAToken(kialiToken)

	// Create shared prometheus client shared by all prometheus requests in the business layer.
	// config.Validate() ensures that if Prometheus is enabled, a URL is always present,
	// so the only two cases here are disabled (NoopClient) or enabled with a URL (LazyClient).
	var prom prometheus.ClientInterface
	if !conf.ExternalServices.Prometheus.Enabled {
		log.Info("Prometheus is disabled")
		prom = prometheus.NewNoopClient()
	} else {
		prom = prometheus.NewLazyClient(ctx, *conf, kialiToken)
	}

	// Seed AI token statistics from Prometheus historical data so that the in-memory
	// usage charts and summary APIs survive a Kiali pod restart. The LazyClient
	// connects in the background, so we poll DisabledReason() and call the seeding
	// function only once the connection is confirmed. This mirrors the pattern used
	// for other kiali_* metrics that are stored in and read back from the same
	// Seed AI token statistics from Prometheus only when ChatAI is fully
	// enabled (both ChatAI.Enabled and Metrics.Enabled). Skipping seeding when
	// ChatAI is off avoids issuing expensive 7-day Prometheus range queries
	// against every CI cluster regardless of whether the feature is in use.
	if conf.AI.Enabled && conf.AI.Metrics && conf.ExternalServices.Prometheus.Enabled {
		go func() {
			const (
				connectTimeout = 5 * time.Minute
				pollInterval   = 15 * time.Second
				seedTimeout    = 3 * time.Minute
			)
			if lc, ok := prom.(*prometheus.LazyClient); ok {
				deadline := time.Now().Add(connectTimeout)
				for time.Now().Before(deadline) {
					if lc.DisabledReason() == "" {
						break
					}
					select {
					case <-ctx.Done():
						internalmetrics.MarkAITokensSeedingComplete()
						return
					case <-time.After(pollInterval):
					}
				}
				if lc.DisabledReason() != "" {
					log.Warning("Timed out waiting for Prometheus; AI token statistics will not be seeded from historical data")
					internalmetrics.MarkAITokensSeedingComplete()
					return
				}
			}
			// Bound the seeding with a hard timeout so that slow Prometheus
			// servers cannot delay the first API response indefinitely.
			seedCtx, seedCancel := context.WithTimeout(ctx, seedTimeout)
			defer seedCancel()
			internalmetrics.InitAITokensFromPrometheus(seedCtx, prom.API())
		}()
	} else {
		// No seeding will happen; mark immediately so the API reports dataReady: true.
		internalmetrics.MarkAITokensSeedingComplete()
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
			client, err := tracing.NewClient(ctx, conf, kialiToken, true)
			if err != nil {
				log.Fatalf("Error creating tracing client: %s", err)
				return
			}
			tracingClient = client
		}()
	} else {
		log.Debug("Tracing is disabled")
	}

	grafanaSvc, err := grafana.NewService(conf, clientFactory.GetSAHomeClusterClient())
	if err != nil {
		log.Fatalf("Error creating Grafana service: %v", err)
	}

	// Needs to be started after the server so that the cache is started because the controllers use the cache.
	// Passing nil here because the tracing client is not used for validations and that is all this layer is used for.
	// Passing the `tracingClient` above would be a race condition since it gets set in a goroutine.
	layer, err := business.NewLayerWithSAClients(conf, cache, prom, nil, cpm, grafanaSvc, discovery, clientFactory.GetSAClientsAsUserClientInterfaces())
	if err != nil {
		log.Fatalf("Error creating business layer: %s", err)
	}

	// Create health monitor for pre-computing health data, started below after cache initialization
	var hcm business.HealthMonitor
	if conf.KialiInternal.HealthCache.Enabled {
		hcm = business.NewHealthMonitor(cache, clientFactory, conf, discovery, prom)
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
	} else {
		log.Debug("Istio API is disabled; istiod will not be polled for proxy status")
		// When Istio API is disabled, PollIstiodForProxyStatus is never called, so
		// discovery.Mesh() (which populates the cluster list via Clusters()) never runs
		// at startup. The health monitor's first refresh uses cache.GetClusters(); if
		// it is nil, the refresh skips entirely ("No clusters found"), so the health
		// cache stays empty until the next interval and the overview shows cache misses.
		// Prime the cluster cache by resolving the mesh once so the health monitor
		// has a non-empty cluster list on its initial run.
		if hcm != nil {
			if _, err := discovery.Mesh(ctx); err != nil {
				log.Warningf("Failed to prime cluster cache for health monitor (Istio API disabled): %s", err)
			}
		}
	}

	// Start health monitor for pre-computing health data (if enabled)
	if hcm != nil {
		log.Infof("health cache is enabled (refresh interval: %s); starting health pre-computation.", conf.HealthConfig.Compute.RefreshInterval)
		hcm.Start(ctx)
	} else {
		log.Info("health cache is disabled; skipping health pre-computation.")
	}

	// Start listening to requests
	server, err := server.NewServer(ctx, cpm, clientFactory, cache, conf, grafanaSvc, prom, tracingLoader, discovery, staticAssetFS)
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

// cacheTransforms returns the per-type cache transforms shared across all clusters.
// These strip cached objects down to only the fields Kiali uses, significantly reducing
// memory consumption in large meshes.
func cacheTransforms() map[client.Object]ctrlcache.ByObject {
	return map[client.Object]ctrlcache.ByObject{
		&corev1.Pod{}:     {Transform: cache.TransformPod},
		&corev1.Service{}: {Transform: cache.TransformService},
	}
}

// makeWatchErrorHandler returns a DefaultWatchErrorHandler that tears down all informers
// when a Forbidden watch error is received (e.g. namespace deletion or access revocation).
// makeWatchErrorHandler tears down a cluster's informers on a Forbidden watch error. When
// clusterAccess is set, it only does so after a live check confirms the access was revoked.
func makeWatchErrorHandler(getCache func() ctrlcache.Cache, k8sClient kubernetes.ClientInterface, clusterAccess *cache.ClusterAccess) func(context.Context, *toolscache.Reflector, error) {
	return func(ctx context.Context, r *toolscache.Reflector, watchErr error) {
		if !apierrors.IsForbidden(watchErr) {
			return
		}
		if clusterAccess != nil {
			group, resource := forbiddenResource(watchErr)
			if !clusterAccess.ConfirmRevoked(ctx, k8sClient.ClusterInfo().Name, group, resource) {
				return
			}
		}
		log.Infof("A namespace appears to have been deleted or Kiali is forbidden from seeing it [err=%v]. Shutting down cache.", watchErr)
		objectsToRemove := []client.Object{
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
			&extentionsv1alpha1.TrafficExtension{},
			&extentionsv1alpha1.WasmPlugin{},
			&networkingv1alpha3.EnvoyFilter{},
			&securityv1.AuthorizationPolicy{},
			&securityv1.PeerAuthentication{},
			&securityv1.RequestAuthentication{},
			&telemetryv1.Telemetry{},
		}
		if k8sClient.IsGatewayAPI() {
			objectsToRemove = append(objectsToRemove, &k8snetworkingv1.Gateway{})
			objectsToRemove = append(objectsToRemove, &k8snetworkingv1.GatewayClass{})
			objectsToRemove = append(objectsToRemove, &k8snetworkingv1.HTTPRoute{})
			objectsToRemove = append(objectsToRemove, &k8snetworkingv1.GRPCRoute{})
			objectsToRemove = append(objectsToRemove, &k8snetworkingv1beta1.ReferenceGrant{})
			objectsToRemove = append(objectsToRemove, &k8snetworkingv1.TLSRoute{})
		}
		if k8sClient.HasTCPRouteInV1() {
			objectsToRemove = append(objectsToRemove, &k8snetworkingv1.TCPRoute{})
		}
		if k8sClient.HasUDPRouteInV1() {
			objectsToRemove = append(objectsToRemove, &k8snetworkingv1.UDPRoute{})
		}
		if k8sClient.IsInferenceAPI() {
			objectsToRemove = append(objectsToRemove, &k8sinferencev1.InferencePool{})
		}
		c := getCache()
		if c == nil {
			log.Warningf("Cache not yet available, cannot remove informers")
			return
		}
		for _, obj := range objectsToRemove {
			log.Debugf("Removing informer for: %T", obj)
			if err := c.RemoveInformer(ctx, obj); err != nil {
				log.Errorf("Unable to remove informer: %s", err)
			}
		}
	}
}

// forbiddenResource returns the group and resource named in a Forbidden error, if it has them.
func forbiddenResource(err error) (string, string) {
	var statusErr *apierrors.StatusError
	if !errors.As(err, &statusErr) || statusErr.ErrStatus.Details == nil {
		return "", ""
	}
	return statusErr.ErrStatus.Details.Group, statusErr.ErrStatus.Details.Kind
}

// accessCheckConcurrency bounds how many namespaces one access check queries at once. The
// check runs on the reflector's goroutine under a 5s budget, so a sequential sweep does not
// fit the budget on large non-cluster-wide installs.
const accessCheckConcurrency = 8

// errDenied reports that an SSAR definitively said the resource is not readable. It is
// internal to newAccessCheck: the sentinel lets the errgroup cancel the remaining namespace
// checks on first denial, preserving the fast-fail of the former sequential loop.
var errDenied = errors.New("access denied")

// namespaceConfigs turns a list of namespace names into the cache's DefaultNamespaces restriction.
// An empty list means no restriction (all namespaces).
func namespaceConfigs(namespaces []string) map[string]ctrlcache.Config {
	if len(namespaces) == 0 {
		return nil
	}
	configs := make(map[string]ctrlcache.Config, len(namespaces))
	for _, namespace := range namespaces {
		configs[namespace] = ctrlcache.Config{}
	}
	return configs
}

// accessibleNamespacesForCluster returns the namespaces that scope Kiali's access to the named cluster when
// not in cluster-wide access mode: the cluster's discovery selector override when one is defined, otherwise
// the default accessible namespaces. An override that cannot be resolved to a namespace list falls back to
// the default list with a warning, so a misconfigured override cannot silently break the access scope. This
// must stay in sync with the cache namespace restriction built in newManager - the access check must never
// evaluate a cluster against namespaces its cache was not scoped to.
func accessibleNamespacesForCluster(conf *config.Config, cluster string) []string {
	if conf.Deployment.ClusterWideAccess {
		return nil
	}
	// The home cluster's access scope is always the default accessible namespaces: the
	// operator creates its Roles from the default discovery selectors only, so a
	// home-cluster discovery selector override - a view filter - must not steer the
	// access check to namespaces the home cache is not scoped to and no Roles exist for.
	if cluster == conf.KubernetesConfig.ClusterName {
		return conf.Deployment.AccessibleNamespaces
	}
	namespaces, err := conf.AccessibleNamespacesForCluster(cluster)
	if err != nil {
		log.Warningf("The discovery selector override for cluster [%s] does not name accessible namespaces. Falling back to the default accessible namespaces. err=%s", cluster, err)
		return conf.Deployment.AccessibleNamespaces
	}
	if len(namespaces) == 0 {
		return conf.Deployment.AccessibleNamespaces
	}
	return namespaces
}

// newAccessCheck asks the cluster, through a SelfSubjectAccessReview, whether the Kiali service
// account can still list and watch a resource. Without cluster-wide access it checks every
// accessible namespace, concurrently.
func newAccessCheck(conf *config.Config, clientFactory kubernetes.ClientFactory) cache.AccessCheck {
	// Each cluster is verified against its own accessible namespaces so that per-cluster
	// discovery selector overrides are honored on the access path, not just in the views.
	clusterNamespaces := make(map[string][]string)
	if !conf.Deployment.ClusterWideAccess {
		for cluster := range clientFactory.GetSAClients() {
			clusterNamespaces[cluster] = accessibleNamespacesForCluster(conf, cluster)
		}
	}
	return func(ctx context.Context, cluster, group, resource string) (bool, error) {
		if resource == "" {
			return false, fmt.Errorf("the forbidden error does not name a resource")
		}
		client := clientFactory.GetSAClient(cluster)
		if client == nil {
			return false, fmt.Errorf("no client for cluster [%s]", cluster)
		}
		namespaces := []string{""}
		if !conf.Deployment.ClusterWideAccess {
			namespaces = clusterNamespaces[cluster]
			if namespaces == nil {
				// A cluster unknown to the client factory when the check was built is
				// still verified against the default accessible namespaces.
				namespaces = conf.Deployment.AccessibleNamespaces
			}
		}

		g, gctx := errgroup.WithContext(ctx)
		g.SetLimit(accessCheckConcurrency)
		for _, namespace := range namespaces {
			g.Go(func() error {
				reviews, err := client.GetSelfSubjectAccessReview(gctx, namespace, group, resource, []string{"list", "watch"})
				if err != nil {
					return err
				}
				for _, review := range reviews {
					if !review.Status.Allowed {
						return errDenied
					}
				}
				return nil
			})
		}
		if err := g.Wait(); err != nil {
			if errors.Is(err, errDenied) {
				return false, nil
			}
			return false, err
		}
		return true, nil
	}
}

func newManager(conf *config.Config, logger *zerolog.Logger, clientFactory kubernetes.ClientFactory, clusterAccess *cache.ClusterAccess) (manager.Manager, map[string]ctrlcache.Cache, error) {
	ctrl.SetLogger(zerologr.New(logger))

	// Combine the istio scheme and the kube scheme.
	scheme, err := kubernetes.NewScheme()
	if err != nil {
		return nil, nil, fmt.Errorf("error setting up manager when creating scheme: %s", err)
	}

	// In the future this could be any cluster and not just home cluster.
	homeClusterClient := clientFactory.GetSAHomeClusterClient()
	homeClusterInfo := homeClusterClient.ClusterInfo()
	var defaultNamespaces map[string]ctrlcache.Config
	if !conf.AllNamespacesAccessible() {
		defaultNamespaces = namespaceConfigs(conf.Deployment.AccessibleNamespaces)
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
		Cache: ctrlcache.Options{
			DefaultNamespaces: defaultNamespaces,
			DefaultWatchErrorHandler: makeWatchErrorHandler(func() ctrlcache.Cache {
				if mgr == nil {
					return nil
				}
				return mgr.GetCache()
			}, homeClusterClient, clusterAccess),
			DefaultTransform: ctrlcache.TransformStripManagedFields(),
			ByObject:         cacheTransforms(),
		},
		Metrics: metricsserver.Options{BindAddress: "0"},
		Scheme:  scheme,
	})
	if err != nil {
		return nil, nil, fmt.Errorf("error setting up ValidationsController when creating manager: %s", err)
	}

	kubeCaches := map[string]ctrlcache.Cache{}
	// We want one manager/reconciler for all clusters.
	for _, saClient := range clientFactory.GetSAClients() {
		if saClient.ClusterInfo().Name == homeClusterInfo.Name {
			kubeCaches[saClient.ClusterInfo().Name] = mgr.GetCache()
		} else {
			clusterName := saClient.ClusterInfo().Name
			var remoteCluster cluster.Cluster
			remoteCluster, err = cluster.New(saClient.ClusterInfo().ClientConfig, func(o *cluster.Options) {
				o.Scheme = scheme
				// Scope the remote cache the same way as the home cache: in non-cluster-wide
				// access mode the remote service account only holds per-namespace roles, so a
				// cluster-scoped informer is forbidden on every list and never syncs.
				o.Cache.DefaultNamespaces = namespaceConfigs(accessibleNamespacesForCluster(conf, clusterName))
				o.Cache.DefaultTransform = ctrlcache.TransformStripManagedFields()
				o.Cache.ByObject = cacheTransforms()
				o.Cache.DefaultWatchErrorHandler = makeWatchErrorHandler(
					func() ctrlcache.Cache {
						if remoteCluster == nil {
							return nil
						}
						return remoteCluster.GetCache()
					},
					saClient,
					clusterAccess,
				)
			})
			if err != nil {
				log.Fatal(err)
			}
			if err := mgr.Add(remoteCluster); err != nil {
				log.Fatal(err)
			}
			kubeCaches[saClient.ClusterInfo().Name] = remoteCluster.GetCache()
		}
	}

	return mgr, kubeCaches, nil
}
