//go:build !exclude_frontend

package cmd

import (
	"context"
	"encoding/json"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"time"

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
	"github.com/kiali/kiali/prometheus"
	"github.com/kiali/kiali/server"
	"github.com/kiali/kiali/tracing"
)

// result of calling time.Time.String()
const timeStringLayout = "2006-01-02 15:04:05.999999999 -0700 MST"

func readTimestampFile(offlineDataPath string) (string, error) {
	timestampPath := filepath.Join(offlineDataPath, "timestamp")
	b, err := os.ReadFile(timestampPath)
	if err != nil {
		return "", fmt.Errorf("could not read timestamp file %s: %v", timestampPath, err)
	}
	timestamp := string(b)

	// Strip off the monotonic clock reading.
	timestamp = strings.Split(timestamp, " m=")[0]

	ts, err := time.Parse(timeStringLayout, timestamp)
	if err != nil {
		return "", fmt.Errorf("could not parse timestamp %s: %v", timestamp, err)
	}

	return ts.Format(time.RFC3339), nil
}

// readOfflineManifest reads the manifest file and returns the cluster name
func readOfflineManifest(offlineDataPath string) config.OfflineManifest {
	manifestPath := filepath.Join(offlineDataPath, "offline-manifest.json")

	manifest := config.OfflineManifest{
		Cluster: "offline",
	}

	data, err := os.ReadFile(manifestPath)
	if err != nil {
		log.Debugf("Could not read manifest file %s: %v, using default cluster name", manifestPath, err)
		return manifest
	}

	if err := json.Unmarshal(data, &manifest); err != nil {
		log.Debugf("Could not unmarshal manifest file %s: %v, using default cluster name", manifestPath, err)
		return manifest
	}

	// If the timestamp is not set, look for a file called "timestamp" in the data directory.
	// Assume it's just a time.Time.String() result.
	if manifest.Timestamp == "" {
		timestamp, err := readTimestampFile(offlineDataPath)
		if err != nil {
			log.Debugf("Could not read timestamp from file: %v", err)
		} else {
			log.Debugf("Using timestamp from file: %s", timestamp)
			manifest.Timestamp = timestamp
		}
	}

	if manifest.Cluster == "" {
		log.Debug("Cluster name in manifest is empty, using default cluster name")
		return manifest
	}

	log.Infof("Read cluster name from manifest: %s", manifest.Cluster)
	return manifest
}

func newOfflineCmd(conf *config.Config) *cobra.Command {
	// Local flag variables for offline command
	var (
		offlineDataPath string
		withoutBrowser  bool
	)

	cmd := &cobra.Command{
		Use:          "offline",
		SilenceUsage: false,
		Short:        "Start Kiali in offline mode with local data",
		Long: `Start Kiali in offline mode using local data files instead of connecting to Kubernetes.
This mode allows you to analyze pre-collected data without requiring a live cluster connection.`,
		RunE: func(cmd *cobra.Command, args []string) error {
			log.Infof("Running Kiali in offline mode with data from: %s", offlineDataPath)

			// Read cluster name from manifest file
			manifest := readOfflineManifest(offlineDataPath)

			// Override settings for offline mode
			conf.RunMode = config.RunModeOffline
			conf.RunConfig = &manifest
			conf.Auth.Strategy = config.AuthStrategyAnonymous
			conf.Server.Observability.Metrics.Enabled = false
			conf.KubernetesConfig.ClusterName = manifest.Cluster
			conf.Deployment.ViewOnlyMode = true

			// Configure external services for offline mode
			conf.ExternalServices.Prometheus.URL = "http://localhost:9090" // Dummy URL that won't be used
			conf.ExternalServices.Tracing.Enabled = false
			conf.ExternalServices.Istio.IstioAPIEnabled = false
			conf.ExternalServices.Grafana.Enabled = false
			conf.ExternalServices.CustomDashboards.Enabled = false

			config.Set(conf)
			if err := config.Validate(conf); err != nil {
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

			ctx, cancel := context.WithCancel(context.Background())
			defer cancel()

			kialiCache, err := cache.NewKialiCache(ctx, clientFactory.GetSAClients(), readers, *conf)
			if err != nil {
				return fmt.Errorf("failed to create KialiCache: %w", err)
			}

			log.Infof("Successfully created KialiCache for offline mode")

			discovery := istio.NewDiscovery(clientFactory.GetSAClients(), kialiCache, conf)

			staticAssetFS, err := fs.Sub(frontend.FrontendBuildAssets, "build")
			if err != nil {
				log.Fatalf("Error getting subfolder: %v", err)
			}

			tracingLoader := func() tracing.ClientInterface {
				return nil
			}

			promClient := prometheus.NewOfflineClient(offlineDataPath, &manifest)

			kialiServer, err := server.NewServer(
				nil, // controlPlaneMonitor
				clientFactory,
				kialiCache,
				conf,
				promClient,    // prom
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

			stopped := make(chan struct{})
			go func() {
				defer close(stopped)
				<-ctx.Done()
				log.Info("Shutting down offline server")
				kialiServer.Stop()
			}()

			if !withoutBrowser {
				if err := openDefaultBrowser(ctx, conf); err != nil {
					log.Errorf("Unable to open default browser. You can still access Kiali at '%s'. Error: %s", fmt.Sprintf("http://%s:%d", conf.Server.Address, conf.Server.Port), err)
				}
			}

			WaitForTermination(cancel)
			<-stopped

			return nil
		},
	}

	cmd.Flags().FuncP("data-path", "d", "Path to directory containing offline data files", FileNameFlag(&offlineDataPath))
	cmd.MarkFlagRequired("data-path")
	cmd.Flags().BoolVarP(&withoutBrowser, "without-browser", "w", withoutBrowser, "If true, will not open the default browser after startup.")

	return cmd
}
