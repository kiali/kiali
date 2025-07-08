//go:build !exclude_frontend

package cmd

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/url"
	"os"
	"os/exec"
	"runtime"
	"slices"
	"time"

	"github.com/spf13/cobra"
	"github.com/spf13/pflag"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/tools/clientcmd"
	"k8s.io/client-go/tools/clientcmd/api"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/cache"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/graph"
	graphistio "github.com/kiali/kiali/graph/telemetry/istio"
	"github.com/kiali/kiali/istio"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/prometheus"
	"github.com/kiali/kiali/util/httputil"
)

// human readable durations using mustParseDuration
var durations = []time.Duration{
	mustParseDuration("1m"),
	mustParseDuration("2m"),
	mustParseDuration("5m"),
	mustParseDuration("10m"),
	mustParseDuration("30m"),
	mustParseDuration("1h"),
	mustParseDuration("3h"),
	mustParseDuration("6h"),
	mustParseDuration("12h"),
	mustParseDuration("24h"),  // 1d
	mustParseDuration("168h"), // 7d
	mustParseDuration("720h"), // 30d
}

func newLocalCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:          "local",
		SilenceUsage: false,
		Short:        "Run Kiali in local mode",
		Long:         `Run Kiali in local mode with a local Kubernetes cluster.`,
		RunE: func(cmd *cobra.Command, args []string) error {
			cmd.Flags().VisitAll(func(f *pflag.Flag) {
				log.Infof("Flag: %s, Value: %s", f.Name, f.Value.String())
			})
			conf, err := config.LoadConfig(argConfigFile)
			if err != nil {
				return fmt.Errorf("failed to load config: %v", err)
			}

			// Override some settings in local mode.
			conf.RunMode = config.RunModeLocal
			conf.Auth.Strategy = config.AuthStrategyAnonymous
			conf.Deployment.RemoteSecretPath = kubeConfig
			config.Set(conf)
			if err := config.Validate(*conf); err != nil {
				return fmt.Errorf("invalid configuration: %v", err)
			}

			ctx, cancel := context.WithCancel(context.Background())
			defer cancel()
			serverStopped, err := RunLocal(ctx, conf)
			if err != nil {
				return fmt.Errorf("unable to run kiali locally: %s", err)
			}

			WaitForTermination(cancel)
			// This ensures that the Run process has fully cleaned itself up.
			<-serverStopped

			return nil
		},
	}
	cmd.Flags().StringVar(&homeClusterContext, "home-cluster-context", "", "Sets Kiali's home cluster context in local mode.")
	cmd.Flags().StringVar(&kubeConfig, "kubeconfig", kubernetes.KubeConfigDir(), "Path to the kubeconfig file for Kiali to use.")
	cmd.Flags().StringSliceVar(&remoteClusterContexts, "remote-cluster-contexts", []string{},
		"Comma separated list of remote cluster contexts.")
	cmd.Flags().BoolVar(&openBrowser, "open-browser", true, "If true, will open the default browser after startup.")
	cmd.Flags().BoolVar(&portForwardToPromFlag, "port-forward-to-prom", true,
		"If true, will port-forward to the Prometheus pod in the home cluster. Disable this if you want to use an external Prometheus URL.")
	return cmd
}

func newGatherCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:          "gather",
		SilenceUsage: false,
		Short:        "Run Kiali in gather mode to collect Prometheus queries",
		Long:         `Run Kiali in gather mode to collect and log all Prometheus queries to a file.`,
		RunE: func(cmd *cobra.Command, args []string) error {
			cmd.Flags().VisitAll(func(f *pflag.Flag) {
				log.Infof("Flag: %s, Value: %s", f.Name, f.Value.String())
			})
			conf, err := config.LoadConfig(argConfigFile)
			if err != nil {
				return fmt.Errorf("failed to load config: %v", err)
			}

			// Override some settings in gather mode.
			conf.RunMode = config.RunModeLocal
			conf.Auth.Strategy = config.AuthStrategyAnonymous
			conf.Deployment.RemoteSecretPath = kubeConfig
			config.Set(conf)
			if err := config.Validate(*conf); err != nil {
				return fmt.Errorf("invalid configuration: %v", err)
			}

			ctx, cancel := context.WithCancel(context.Background())
			defer cancel()

			clients, err := createKubernetesClients(conf, remoteClusterContexts, homeClusterContext)
			if err != nil {
				return fmt.Errorf("unable to create Kubernetes clients: %s", err)
			}

			cf, err := kubernetes.NewClientFactoryWithSAClients(ctx, *conf, clients)
			if err != nil {
				return fmt.Errorf("unable to create new client factory")
			}

			if cf.GetSAHomeClusterClient() == nil {
				log.Info("Home cluster client is nil. Not starting prom.")
			} else {
				// Need a separate "port-forward to prom option" because you can specify an external prometheus URL
				// in the config file and that should not be overridden by the port-forwarding.
				if conf.ExternalServices.Prometheus.Enabled && portForwardToPromFlag {
					if err := portForwardToProm(ctx, cf.GetSAHomeClusterClient(), conf); err != nil {
						log.Warningf("Unable to setup port forwarding to prom pods: %s\t Disabling prometheus.", err)
						conf.ExternalServices.Prometheus.Enabled = false
						config.Set(conf)
					}
				}
				// TODO: Probably need the same for tracing.
				if conf.ExternalServices.Tracing.Enabled {
					if err := portForwardToTracing(ctx, cf.GetSAHomeClusterClient(), conf); err != nil {
						log.Warningf("Unable to setup port forwarding to tracing pods: %s", err)
					}
				}
			}

			prom, err := prometheus.NewClientForConfig(*conf, "/tmp/kiali-prom-gather")
			if err != nil {
				return fmt.Errorf("unable to setup prometheus client: %s", err)
			}

			buildInfo, err := prom.GetBuildInfo(ctx)
			if err != nil {
				return fmt.Errorf("unable to get prometheus build info: %s", err)
			}

			// Write manifest file with cluster information
			// Do this after creating kubernetes clients because cluster is saved then.
			manifestPath := "/tmp/kiali-offline-manifest.json"
			manifest := config.OfflineManifest{
				Cluster:             conf.KubernetesConfig.ClusterName,
				PrometheusBuildInfo: *buildInfo,
			}
			manifestData, err := json.Marshal(manifest)
			if err != nil {
				return fmt.Errorf("failed to marshal manifest: %v", err)
			}
			if err := os.WriteFile(manifestPath, manifestData, 0o644); err != nil {
				return fmt.Errorf("failed to write manifest file: %v", err)
			}
			log.Infof("Written manifest file to: %s", manifestPath)

			mgr, kubeCaches, err := newManager(ctx, conf, log.Logger(), cf)
			if err != nil {
				return fmt.Errorf("unable to setup manager: %s", err)
			}

			// TODO: Do we need to start the manager?
			go func() {
				if err := mgr.Start(ctx); err != nil {
					log.Errorf("error starting manager: %s", err)
				}
				// log.Debug("Stopped Validations Controller")
			}()

			cache, err := cache.NewKialiCache(cf.GetSAClients(), asReaders(kubeCaches), *conf)
			if err != nil {
				return fmt.Errorf("unable to setup cache: %s", err)
			}

			discovery := istio.NewDiscovery(clients, cache, conf)

			layer, err := business.NewLayerWithSAClients(
				conf,
				cache,
				prom,
				nil, // tracing.ClientInterface
				nil, // business.ControlPlaneMonitor
				nil, // *grafana.Service
				discovery,
				cf.GetSAClientsAsUserClientInterfaces()) // map[string]kubernetes.UserClientInterface
			if err != nil {
				return fmt.Errorf("unable to setup business layer: %s", err)
			}

			namespaceMap := graph.NewNamespaceInfoMap()

			namespaces, err := layer.Namespace.GetNamespaces(ctx)
			if err != nil {
				return fmt.Errorf("unable to get namespaces: %s", err)
			}

			for _, duration := range durations {
				for _, namespace := range namespaces {
					namespaceMap[namespace.Name] = graph.NamespaceInfo{
						Name:      namespace.Name,
						Duration:  duration,
						IsAmbient: namespace.IsAmbient,
						IsIstio:   config.IsIstioNamespace(namespace.Name),
					}
				}

				accessibleNamespaces := graph.AccessibleNamespaces{}
				for _, namespace := range namespaces {
					accessibleNamespaces[graph.GetClusterSensitiveKey(namespace.Cluster, namespace.Name)] = &graph.AccessibleNamespace{
						Cluster:           namespace.Cluster,
						CreationTimestamp: namespace.CreationTimestamp,
						IsAmbient:         namespace.IsAmbient,
						Name:              namespace.Name,
					}
				}

				graphistio.BuildNamespacesTrafficMap(ctx, graph.TelemetryOptions{
					CommonOptions: graph.CommonOptions{
						QueryTime: time.Now().Unix(),
					},
					Rates: graph.RequestedRates{
						Http:    graph.RateRequests,
						Grpc:    graph.RateRequests,
						Tcp:     graph.RateRequests,
						Ambient: graph.AmbientTrafficNone,
					},
					AccessibleNamespaces: accessibleNamespaces,
					Appenders:            graph.RequestedAppenders{All: true},
					Namespaces:           namespaceMap,
				}, graph.NewGlobalInfo(layer, prom, conf))
			}

			return nil
		},
	}
	cmd.Flags().StringVar(&homeClusterContext, "home-cluster-context", "", "Sets Kiali's home cluster context in gather mode.")
	cmd.Flags().StringVar(&kubeConfig, "kubeconfig", kubernetes.KubeConfigDir(), "Path to the kubeconfig file for Kiali to use.")
	cmd.Flags().StringSliceVar(&remoteClusterContexts, "remote-cluster-contexts", []string{},
		"Comma separated list of remote cluster contexts.")
	cmd.Flags().BoolVar(&openBrowser, "open-browser", true, "If true, will open the default browser after startup.")
	cmd.Flags().BoolVar(&portForwardToPromFlag, "port-forward-to-prom", true,
		"If true, will port-forward to the Prometheus pod in the home cluster. Disable this if you want to use an external Prometheus URL.")
	return cmd
}

// Create a mustParseDuration function that parses a duration string and returns a time.Duration
func mustParseDuration(s string) time.Duration {
	d, err := time.ParseDuration(s)
	if err != nil {
		panic(err)
	}
	return d
}

func RunLocal(
	ctx context.Context,
	conf *config.Config,
) (<-chan struct{}, error) {
	log.Info("Running Kiali in local mode")
	log.Infof("Loading kubeconfig from file: %s", conf.Deployment.RemoteSecretPath)

	clients, err := createKubernetesClients(conf, remoteClusterContexts, homeClusterContext)
	if err != nil {
		return nil, fmt.Errorf("unable to create Kubernetes clients: %s", err)
	}

	cf, err := kubernetes.NewClientFactoryWithSAClients(ctx, *conf, clients)
	if err != nil {
		return nil, fmt.Errorf("unable to create new client factory")
	}

	if cf.GetSAHomeClusterClient() == nil {
		log.Info("Home cluster client is nil. Not starting prom.")
	} else {
		// Need a separate "port-forward to prom option" because you can specify an external prometheus URL
		// in the config file and that should not be overridden by the port-forwarding.
		if conf.ExternalServices.Prometheus.Enabled && portForwardToPromFlag {
			if err := portForwardToProm(ctx, cf.GetSAHomeClusterClient(), conf); err != nil {
				log.Warningf("Unable to setup port forwarding to prom pods: %s\t Disabling prometheus.", err)
				conf.ExternalServices.Prometheus.Enabled = false
				config.Set(conf)
			}
		}
		// TODO: Probably need the same for tracing.
		if conf.ExternalServices.Tracing.Enabled {
			if err := portForwardToTracing(ctx, cf.GetSAHomeClusterClient(), conf); err != nil {
				log.Warningf("Unable to setup port forwarding to tracing pods: %s", err)
			}
		}
	}
	log.Info("Running server")
	stopped := RunServer(ctx, conf, cf)
	log.Info("Server is ready.")
	if openBrowser {
		log.Info("Opening Kiali in default browser")
		if err := openDefaultBrowser(ctx, conf); err != nil {
			log.Errorf("Unable to open default browser: %s", err)
		}
	}

	return stopped, nil
}

func openDefaultBrowser(ctx context.Context, conf *config.Config) error {
	kialiURL := fmt.Sprintf("http://localhost:%d", conf.Server.Port)
	var cmd string
	switch runtime.GOOS {
	// TODO: handle windows and mac.
	default:
		cmd = "xdg-open"
	}
	return exec.CommandContext(ctx, cmd, kialiURL).Start()
}

func portForwardToTracing(ctx context.Context, localClient kubernetes.ClientInterface, conf *config.Config) error {
	localPort := httputil.Pool.GetFreePort()
	conf.ExternalServices.Tracing.InternalURL = fmt.Sprintf("http://127.0.0.1:%d", localPort)
	config.Set(conf)
	url, err := url.Parse(conf.ExternalServices.Tracing.InternalURL)
	if err != nil {
		return err
	}

	tracingPods, err := localClient.Kube().CoreV1().Pods("istio-system").List(ctx, metav1.ListOptions{LabelSelector: "app=jaeger"})
	if err != nil {
		return err
	}

	if len(tracingPods.Items) == 0 {
		return fmt.Errorf("no Tracing pod found in istio-system namespace")
	}

	log.Info("Port forwarding to tracing pods")
	pf, err := httputil.NewPortForwarder(
		localClient.Kube().CoreV1().RESTClient(),
		localClient.ClusterInfo().ClientConfig,
		"istio-system",
		tracingPods.Items[0].Name,
		"localhost",
		url.Port()+":16685",
		io.Discard,
	)
	if err != nil {
		return err
	}

	if err := pf.Start(); err != nil {
		return err
	}
	go func() {
		defer pf.Stop()
		<-ctx.Done()
	}()

	return nil
}

func portForwardToProm(ctx context.Context, localClient kubernetes.ClientInterface, conf *config.Config) error {
	localPort := httputil.Pool.GetFreePort()
	conf.ExternalServices.Prometheus.URL = fmt.Sprintf("http://127.0.0.1:%d", localPort)
	config.Set(conf)
	url, err := url.Parse(conf.ExternalServices.Prometheus.URL)
	if err != nil {
		return err
	}

	promPods, err := localClient.Kube().CoreV1().Pods("istio-system").List(ctx, metav1.ListOptions{LabelSelector: "app.kubernetes.io/name=prometheus"})
	if err != nil {
		return err
	}

	if len(promPods.Items) == 0 {
		return fmt.Errorf("no Prometheus pod found in istio-system namespace")
	}

	log.Info("Port forwarding to prom pods")
	pf, err := httputil.NewPortForwarder(
		localClient.Kube().CoreV1().RESTClient(),
		localClient.ClusterInfo().ClientConfig,
		"istio-system",
		promPods.Items[0].Name,
		"localhost",
		url.Port()+":9090",
		io.Discard,
	)
	if err != nil {
		return err
	}

	if err := pf.Start(); err != nil {
		return err
	}
	go func() {
		defer pf.Stop()
		<-ctx.Done()
	}()

	return nil
}

// createKubernetesClients creates kubernetes clients from kubeconfig contexts
func createKubernetesClients(conf *config.Config, remoteClusterContexts []string, homeClusterContext string) (map[string]kubernetes.ClientInterface, error) {
	kubeConfig, err := clientcmd.LoadFromFile(conf.Deployment.RemoteSecretPath)
	if err != nil {
		return nil, fmt.Errorf("unable to read kubeconfig from file: %s", conf.Deployment.RemoteSecretPath)
	}

	contextNames := slices.Clone(remoteClusterContexts)
	homeContext := kubeConfig.CurrentContext
	if homeClusterContext != "" {
		homeContext = homeClusterContext
	}
	contextNames = append(contextNames, homeContext)

	contexts := map[string]*api.Context{}
	for _, ctx := range contextNames {
		kubeContext := kubeConfig.Contexts[ctx]
		if kubeContext == nil {
			return nil, fmt.Errorf("current context not set in kubeconfig file: %s", conf.Deployment.RemoteSecretPath)
		}
		contexts[ctx] = kubeContext
	}

	clients := map[string]kubernetes.ClientInterface{}
	for context, clusterInfo := range contexts {
		clusterName := clusterInfo.Cluster
		if override := conf.Deployment.ClusterNameOverrides[clusterInfo.Cluster]; override != "" {
			clusterName = override
		}
		remoteClusterInfo := &kubernetes.RemoteClusterInfo{
			ClusterName: clusterName,
			Config:      clientcmd.NewDefaultClientConfig(*kubeConfig, &clientcmd.ConfigOverrides{CurrentContext: context}),
		}
		clientConfig, err := remoteClusterInfo.Config.ClientConfig()
		if err != nil {
			return nil, fmt.Errorf("unable to get client config for remote cluster [%s]. Err: %s", context, err)
		}

		client, err := kubernetes.NewClientWithRemoteClusterInfoWithClusterName(clientConfig, remoteClusterInfo)
		if err != nil {
			return nil, fmt.Errorf("unable to create remote Kiali Service Account client. Err: %s", err)
		}

		clients[clusterName] = client

		// TODO: Need to set the kube cluster name to the current context otherwise cache won't start.
		// TODO: Does the cache really need to fail on that condition?
		if context == homeContext {
			conf.KubernetesConfig.ClusterName = clusterName
			config.Set(conf)
		}
	}

	return clients, nil
}
