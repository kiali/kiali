//go:build !exclude_frontend

package cmd

import (
	"context"
	"fmt"
	"io/fs"

	"github.com/spf13/cobra"
	"sigs.k8s.io/controller-runtime/pkg/client"

	"github.com/kiali/kiali/cache"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/frontend"
	"github.com/kiali/kiali/istio"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/kubernetes/offline"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/server"
	"github.com/kiali/kiali/tracing"
)

// Command line arguments for offline mode
var offlineDataPath string

func newOfflineCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:          "offline",
		SilenceUsage: false,
		Short:        "Start Kiali in offline mode with local data",
		Long: `Start Kiali in offline mode using local data files instead of connecting to Kubernetes.
This mode allows you to analyze pre-collected data without requiring a live cluster connection.`,
		RunE: func(cmd *cobra.Command, args []string) error {
			log.Infof("Running Kiali in offline mode with data from: %s", offlineDataPath)

			conf := config.NewConfig()

			// Override settings for offline mode
			conf.RunMode = config.RunModeLocal
			conf.Auth.Strategy = config.AuthStrategyAnonymous
			conf.KubernetesConfig.ClusterName = "offline"

			// Disable external services for offline mode.
			// TODO: These should be added back later once
			// prom state can be loaded in somehow.
			conf.ExternalServices.Prometheus.Enabled = false
			conf.ExternalServices.Tracing.Enabled = false
			conf.ExternalServices.Istio.IstioAPIEnabled = false
			conf.ExternalServices.Grafana.Enabled = false

			config.Set(conf)
			if err := config.Validate(*conf); err != nil {
				return fmt.Errorf("invalid configuration: %w", err)
			}

			offlineClient, err := offline.NewOfflineClient(offlineDataPath)
			if err != nil {
				return fmt.Errorf("failed to create offline client: %w", err)
			}

			log.Infof("Successfully created offline client with data from: %s", offlineDataPath)

			k8sClients := make(map[string]kubernetes.UserClientInterface)
			k8sClients[conf.KubernetesConfig.ClusterName] = offlineClient
			clientFactory := kubetest.NewFakeClientFactory(conf, k8sClients)

			log.Infof("Successfully created fake client factory for offline mode")

			readers := make(map[string]client.Reader)
			for cluster, client := range clientFactory.GetSAClients() {
				readers[cluster] = client
			}

			kialiCache, err := cache.NewKialiCache(clientFactory.GetSAClients(), readers, *conf)
			if err != nil {
				return fmt.Errorf("failed to create KialiCache: %w", err)
			}
			defer kialiCache.Stop()

			log.Infof("Successfully created KialiCache for offline mode")

			discovery := istio.NewDiscovery(clientFactory.GetSAClients(), kialiCache, conf)

			staticAssetFS, err := fs.Sub(frontend.FrontendBuildAssets, "build")
			if err != nil {
				log.Fatalf("Error getting subfolder: %v", err)
			}

			tracingLoader := func() tracing.ClientInterface {
				return nil
			}

			kialiServer, err := server.NewServer(
				nil, // controlPlaneMonitor
				clientFactory,
				kialiCache,
				conf,
				nil,           // prom
				tracingLoader, // traceClientLoader
				discovery,
				staticAssetFS,
			)
			if err != nil {
				return fmt.Errorf("failed to create Kiali server: %w", err)
			}

			log.Infof("Successfully created Kiali server for offline mode")

			kialiServer.Start()
			log.Infof("Kiali server started in offline mode")

			ctx, cancel := context.WithCancel(context.Background())
			defer cancel()

			stopped := make(chan struct{})
			go func() {
				defer close(stopped)
				<-ctx.Done()
				log.Info("Shutting down offline server")
				kialiServer.Stop()
			}()

			WaitForTermination(cancel)
			<-stopped

			return nil
		},
	}

	cmd.Flags().StringVar(&offlineDataPath, "data-path", "", "Path to directory containing offline data files")
	cmd.MarkFlagRequired("data-path")

	return cmd
}
