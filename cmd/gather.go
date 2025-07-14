//go:build !exclude_frontend

package cmd

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	prom_v1 "github.com/prometheus/client_golang/api/prometheus/v1"
	"github.com/spf13/cobra"
	"github.com/spf13/pflag"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/cache"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/graph"
	graphistio "github.com/kiali/kiali/graph/telemetry/istio"
	"github.com/kiali/kiali/istio"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/prometheus"
)

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

func mustParseDuration(s string) time.Duration {
	d, err := time.ParseDuration(s)
	if err != nil {
		panic(err)
	}
	return d
}

// writeOfflineManifest writes the offline manifest file to the specified directory
func writeOfflineManifest(outputDir string, conf *config.Config, buildInfo *prom_v1.BuildinfoResult) error {
	manifestPath := filepath.Join(outputDir, "offline-manifest.json")
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
	return nil
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

			// Set cluster name overrides from flag
			if len(clusterNameOverrides) > 0 {
				if conf.Deployment.ClusterNameOverrides == nil {
					conf.Deployment.ClusterNameOverrides = make(map[string]string)
				}
				for _, override := range clusterNameOverrides {
					parts := strings.Split(override, "=")
					if len(parts) != 2 {
						return fmt.Errorf("invalid cluster name override format: %s (expected 'original-name=override-name')", override)
					}
					conf.Deployment.ClusterNameOverrides[parts[0]] = parts[1]
				}
				config.Set(conf)
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

			if err := setupPortForwarding(ctx, cf, conf, portForwardToPromFlag); err != nil {
				return fmt.Errorf("unable to setup port forwarding: %s", err)
			}

			prom, err := prometheus.NewClientForConfig(*conf)
			if err != nil {
				return fmt.Errorf("unable to setup prometheus client: %s", err)
			}

			log.Info("Using QueryRecorder for gather mode")
			prom.Inject(prometheus.NewQueryRecorder(prom.API(), filepath.Join(gatherOutputDir, "prom-graph-gather.log")))

			buildInfo, err := prom.GetBuildInfo(ctx)
			if err != nil {
				return fmt.Errorf("unable to get prometheus build info: %s", err)
			}

			// Write manifest file with cluster information
			// Do this after creating kubernetes clients because cluster is saved then.
			if err := os.MkdirAll(gatherOutputDir, 0o755); err != nil {
				return fmt.Errorf("failed to create output directory: %v", err)
			}

			if err := writeOfflineManifest(gatherOutputDir, conf, buildInfo); err != nil {
				return fmt.Errorf("failed to write manifest: %v", err)
			}

			mgr, kubeCaches, err := newManager(ctx, conf, log.Logger(), cf)
			if err != nil {
				return fmt.Errorf("unable to setup manager: %s", err)
			}

			go func() {
				if err := mgr.Start(ctx); err != nil {
					log.Errorf("error starting manager: %s", err)
				}
			}()

			cache, err := cache.NewKialiCache(context.Background(), cf.GetSAClients(), asReaders(kubeCaches), *conf)
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
				cf.GetSAClientsAsUserClientInterfaces())
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
	cmd.Flags().StringVar(&gatherOutputDir, "output-dir", "/tmp/kiali", "Directory where gather mode output files will be written.")
	cmd.Flags().StringSliceVar(&clusterNameOverrides, "cluster-name-overrides", []string{},
		"Comma separated list of cluster name overrides in the format 'original-name=override-name'.")
	return cmd
}
