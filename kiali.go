//go:build !exclude_frontend

// Kiali
//
// # Kiali Project, The Console for Istio Service Mesh
//
// NOTE! The Kiali API is not for public use and is not supported for any use outside of the Kiali UI itself.
// The API can and will change from version to version with no guarantee of backwards compatibility.
//
// To generate this API document:
// ```
//
//	> alias swagger='docker run --rm -it  --user $(id -u):$(id -g) -e GOCACHE=/tmp -e GOPATH=$(go env GOPATH):/go -v $HOME:$HOME -w $(pwd) quay.io/goswagger/swagger'
//	> swagger generate spec -o ./swagger.json
//	> swagger generate markdown --quiet --spec ./swagger.json --output ./kiali_internal_api.md
//
// ```
//
//	Schemes: http, https
//	BasePath: /api
//	Version: _
//
//	Consumes:
//	- application/json
//
//	Produces:
//	- application/json
//
// swagger:meta
package main

import (
	"context"
	"flag"
	"fmt"
	"io/fs"
	"maps"
	"os"
	"os/signal"
	"slices"
	"strings"
	"syscall"

	"github.com/go-logr/zerologr"
	"github.com/rs/zerolog"
	_ "go.uber.org/automaxprocs"
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
	k8sinferencev1alpha2 "sigs.k8s.io/gateway-api-inference-extension/api/v1alpha2"
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
	"github.com/kiali/kiali/util"
)

// Identifies the build. These are set via ldflags during the build (see Makefile).
var (
	version    = "unknown"
	commitHash = "unknown"
	goVersion  = "unknown"
)

// Command line arguments
var (
	argConfigFile = flag.String("config", "", "Path to the YAML configuration file. If not specified, environment variables will be used for configuration.")
)

func init() {
	// log everything to stderr so that it can be easily gathered by logs, separate log files are problematic with containers
	_ = flag.Set("logtostderr", "true")
}

func main() {
	zl := log.InitializeLogger()
	util.Clock = util.RealClock{}

	// process command line
	flag.Parse()
	validateFlags()

	// log startup information
	log.Infof("Kiali: Version: %v, Commit: %v, Go: %v", version, commitHash, goVersion)
	log.Debugf("Kiali: Command line: [%v]", strings.Join(os.Args, " "))

	// load config file if specified, otherwise, rely on environment variables to configure us
	if *argConfigFile != "" {
		c, err := config.LoadFromFile(*argConfigFile)
		if err != nil {
			log.Fatal(err)
		}
		config.Set(c)
	} else {
		log.Infof("No configuration file specified. Will rely on environment for configuration.")
		config.Set(config.NewConfig())
	}

	if err := config.Validate(config.Get()); err != nil {
		log.Debugf("Kiali Configuration before auto-discovery:\n%s", config.Get())
		log.Fatal(err)
	}

	// prepare our internal metrics so Prometheus can scrape them
	internalmetrics.RegisterInternalMetrics()

	// determine the Kiali home cluster name. If necessary, this will try to autodiscover the Istiod cluster name
	if err := determineHomeClusterName(); err != nil {
		log.Fatalf("Failed to determine Kiali home cluster name. Err: %s", err)
	}

	// create the business package dependencies.
	clientFactory, err := kubernetes.GetClientFactory()
	if err != nil {
		log.Fatalf("Failed to create client factory. Err: %s", err)
	}

	// This context is used for polling and for creating some high level clients like tracing.
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// fetch a fresh config here, it could have been updated during auto-discovery
	conf := config.Get()

	// ensure the config is set to Kiali's home cluster name. Note that this may not be accessed via a remote secret
	if clientFactory.GetSAHomeClusterClient().ClusterInfo().Name != conf.KubernetesConfig.ClusterName {
		conf.KubernetesConfig.ClusterName = clientFactory.GetSAHomeClusterClient().ClusterInfo().Name
		config.Set(conf)
	}

	log.Tracef("Kiali Configuration after auto-discovery:\n%s", conf)

	mgr, kubeCaches, err := newManager(ctx, conf, &zl, clientFactory)
	if err != nil {
		log.Fatalf("Unable to setup manager: %s", err)
	}

	log.Info("Initializing Kiali Cache")
	cache, err := cache.NewKialiCache(clientFactory.GetSAClients(), asReaders(kubeCaches), *conf)
	if err != nil {
		log.Fatalf("Error initializing Kiali Cache. Details: %s", err)
	}
	defer cache.Stop()

	cache.SetBuildInfo(models.BuildInfo{
		CommitHash:       commitHash,
		ContainerVersion: determineContainerVersion(version),
		GoVersion:        goVersion,
		Version:          version,
	})

	discovery := istio.NewDiscovery(clientFactory.GetSAClients(), cache, conf)
	cpm := business.NewControlPlaneMonitor(cache, clientFactory, conf, discovery)

	// Create shared prometheus client shared by all prometheus requests in the business layer.
	prom, err := prometheus.NewClient()
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

	go func() {
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

		// Controller-runtime lazily adds informers when they are first accessed.
		// Normally you'd have controllers that do this but we don't have any controllers
		// that setup watches for workloads or Istio config yet so we need to manually
		// fetch these resources in order to ensure that the informers are created
		// before the server starts serving requests. Otherwise, the first request
		// that tries to access these resources will block until the informer is synced
		// which can take a long time.
		if _, err := layer.Workload.GetAllWorkloads(ctx, cluster, ""); err != nil {
			log.Warningf("Unable to get workloads to sync cache for cluster %s. First request that accesses workloads may take awhile: %v", cluster, err)
		}

		include := cluster != conf.KubernetesConfig.ClusterName || !conf.Clustering.IgnoreLocalCluster
		if _, err := layer.IstioConfig.GetIstioConfigList(ctx, cluster, business.IstioConfigCriteria{
			IncludeGateways:               include,
			IncludeK8sGateways:            include,
			IncludeK8sGRPCRoutes:          include,
			IncludeK8sHTTPRoutes:          include,
			IncludeK8sInferencePools:      include,
			IncludeK8sTCPRoutes:           include,
			IncludeK8sTLSRoutes:           include,
			IncludeVirtualServices:        include,
			IncludeDestinationRules:       include,
			IncludeSidecars:               include,
			IncludeServiceEntries:         include,
			IncludeWorkloadEntries:        include,
			IncludeWorkloadGroups:         include,
			IncludeEnvoyFilters:           include,
			IncludeWasmPlugins:            include,
			IncludeAuthorizationPolicies:  include,
			IncludePeerAuthentications:    include,
			IncludeRequestAuthentications: include,
			IncludeTelemetry:              include,
			IncludeK8sReferenceGrants:     include,
		}); err != nil {
			log.Warningf("Unable to get Istio config to sync cache for cluster %s. First request that accesses Istio config may take awhile: %v", cluster, err)
		}
	}
	log.Info("All caches synced")

	if conf.ExternalServices.Istio.IstioAPIEnabled {
		cpm.PollIstiodForProxyStatus(ctx)
	}

	staticAssetFS, err := fs.Sub(frontend.FrontendBuildAssets, "build")
	if err != nil {
		log.Fatalf("Error getting subfolder: %v", err)
	}

	// Start listening to requests
	server, err := server.NewServer(cpm, clientFactory, cache, conf, prom, tracingLoader, discovery, staticAssetFS)
	if err != nil {
		log.Fatal(err)
	}
	server.Start()

	// wait forever, or at least until we are told to exit
	waitForTermination()

	// Shutdown internal components
	log.Info("Shutting down internal components")
	server.Stop()
}

func waitForTermination() {
	// Channel that is notified when we are done and should exit
	// TODO: may want to make this a package variable - other things might want to tell us to exit
	doneChan := make(chan bool)

	signalChan := make(chan os.Signal, 1)
	signal.Notify(signalChan, syscall.SIGINT, syscall.SIGTERM)
	go func() {
		for range signalChan {
			log.Info("Termination Signal Received")
			doneChan <- true
		}
	}()

	<-doneChan
}

func validateFlags() {
	if *argConfigFile != "" {
		if _, err := os.Stat(*argConfigFile); err != nil {
			if os.IsNotExist(err) {
				log.Debugf("Configuration file [%v] does not exist.", *argConfigFile)
			}
		}
	}
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

// This is used to update the config with information about istio that
// comes from the environment such as the cluster name.
func determineHomeClusterName() error {
	conf := config.Get()

	// If the home cluster name is already set, we don't need to do anything
	homeCluster := conf.KubernetesConfig.ClusterName
	if homeCluster != "" {
		return nil
	}

	// If the cluster name is not set and we don't have a co-located control plane, it's an error
	if conf.Clustering.IgnoreLocalCluster {
		return fmt.Errorf("Could not determine Kiali home cluster name. You must set kubernetes_config.cluster_name when clustering.ignore_local_cluster=true")
	}

	// use the control plane's configured cluster name, or the default
	err := func() error {
		log.Debug("Cluster name is not set. Attempting to auto-detect the cluster name from the Istio control plane environment.")
		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()

		// Need to create a temporary client factory here so that we can create a client
		// to auto-detect the istio cluster name from the environment. There's a bit of a
		// chicken and egg problem with the client factory because the client factory
		// uses the cluster id to keep track of all the clients. But in order to create
		// a client to get the cluster id from the environment, you need to create a client factory.
		// To get around that we create a temporary client factory here and then set the kiali
		// config cluster name. We then create the global client factory later in the business
		// package and that global client factory has the cluster id set properly.
		cf, err := kubernetes.NewClientFactory(ctx, conf)
		if err != nil {
			return err
		}

		// Try to auto-detect the cluster name
		homeCluster, err = kubernetes.ClusterNameFromIstiod(conf, cf.GetSAHomeClusterClient())
		if err != nil {
			return err
		}

		return nil
	}()
	if err != nil {
		log.Warningf("Cannot resolve local cluster name. Err: %s. Falling back to [%s]", err, config.DefaultClusterID)
		homeCluster = config.DefaultClusterID
	}

	log.Debugf("Auto-detected the istio cluster name to be [%s]. Updating the kiali config", homeCluster)
	conf.KubernetesConfig.ClusterName = homeCluster
	config.Set(conf)

	return nil
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

	// This could be any cluster and not just the local cluster.
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
						&k8sinferencev1alpha2.InferencePool{},
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
