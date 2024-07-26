//go:build !exclude_frontend

package cmd

import (
	"context"
	"fmt"
	"io"
	"os/exec"
	"runtime"
	"strings"

	"github.com/spf13/cobra"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/util/httputil"
)

func newRunCmd(conf *config.Config) *cobra.Command {
	var (
		clusterNameOverrides  []string
		homeClusterContext    string
		kubeConfig            = kubernetes.KubeConfigDir()
		remoteClusterContexts []string
		withoutBrowser        = false
	)

	portForwardingOpts := newPortForwardingOptions()

	cmd := &cobra.Command{
		Use:   "run",
		Short: "Run Kiali locally",
		Long: `Run Kiali locally using a local kubeconfig.

EXPERIMENTAL: This command and the flags are subject to change.`,
		RunE: func(cmd *cobra.Command, args []string) error {
			// Override some settings in local mode.
			conf.RunMode = config.RunModeLocal
			conf.Auth.Strategy = config.AuthStrategyAnonymous

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
			}

			config.Set(conf)
			if err := config.Validate(conf); err != nil {
				return fmt.Errorf("invalid configuration: %v", err)
			}

			ctx, cancel := context.WithCancel(cmd.Context())
			defer cancel()

			log.Info("Running Kiali in local mode")
			log.Infof("Loading kubeconfig from file: %s", kubeConfig)

			clients, err := kubernetes.NewClientsFromKubeConfig(conf, kubeConfig, remoteClusterContexts, homeClusterContext)
			if err != nil {
				return fmt.Errorf("unable to create Kubernetes clients: %s", err)
			}

			cf, err := kubernetes.NewClientFactoryWithSAClients(ctx, conf, clients)
			if err != nil {
				return fmt.Errorf("unable to create new client factory")
			}

			if err := setupPortForwarding(ctx, cf, conf, *portForwardingOpts); err != nil {
				return fmt.Errorf("unable to setup port forwarding: %s", err)
			}

			stopped := RunServer(ctx, conf, cf)
			if !withoutBrowser {
				log.Info("Opening Kiali in default browser")
				if err := openDefaultBrowser(ctx, conf); err != nil {
					log.Errorf("Unable to open default browser: %s", err)
				}
			}

			WaitForTermination(cancel)
			// This ensures that the Run process has fully cleaned itself up.
			<-stopped

			return nil
		},
	}
	cmd.Flags().StringVar(&homeClusterContext, "context", homeClusterContext, "The name of the kubeconfig context for Kiali to use. Defaults to current context.")
	cmd.Flags().StringVar(&kubeConfig, "kubeconfig", kubeConfig, "Path to the kubeconfig file for Kiali to use.")
	cmd.Flags().StringSliceVar(&remoteClusterContexts, "remote-cluster-contexts", remoteClusterContexts,
		"Comma separated list of remote cluster contexts.")
	cmd.Flags().BoolVar(&withoutBrowser, "no-browser", withoutBrowser, "Disables opening the default browser after startup.")
	cmd.Flags().StringSliceVar(&clusterNameOverrides, "cluster-name-overrides", clusterNameOverrides,
		"Comma separated list of cluster name overrides in the format 'original-name=override-name'.")

	// Add all port forwarding related flags
	portForwardingOpts.addFlags(cmd)

	cmd.AddCommand(newOfflineCmd(conf))

	return cmd
}

func setupPortForwarding(ctx context.Context, cf kubernetes.ClientFactory, conf *config.Config, opts portForwardingOptions) error {
	// Override tracing configuration if enableTracing flag is set
	if opts.enableTracing {
		conf.ExternalServices.Tracing.Enabled = true
		config.Set(conf)
	}

	// Override dashboards configuration if enableDashboards flag is set
	if opts.enableDashboards {
		conf.ExternalServices.Grafana.Enabled = true
		config.Set(conf)
	}

	// Need a separate "port-forward to prom option" because you can specify an external prometheus URL
	// in the config file and that should not be overridden by the port-forwarding.
	// TODO: Add an option to enable/disable prom.
	if opts.portForwardToPromFlag {
		if err := portForwardToProm(ctx, cf.GetSAHomeClusterClient(), conf, opts.metricsPort, opts.metricsSelector); err != nil {
			return fmt.Errorf("Unable to setup port forwarding to metrics store pods: %s", err)
		}
	}
	// Port forward to Tracing if enabled and flag is set
	if conf.ExternalServices.Tracing.Enabled && opts.portForwardToTracingFlag {
		if err := portForwardToTracing(ctx, cf.GetSAHomeClusterClient(), conf, opts.tracingPort, opts.tracingSelector); err != nil {
			return fmt.Errorf("Unable to setup port forwarding to tracing pods: %s", err)
		}
	}
	// Port forward to Grafana if enabled and flag is set
	if conf.ExternalServices.Grafana.Enabled && opts.portForwardToGrafanaFlag {
		if err := portForwardToGrafana(ctx, cf.GetSAHomeClusterClient(), conf, opts.dashboardsPort, opts.dashboardSelector); err != nil {
			return fmt.Errorf("Unable to setup port forwarding to grafana pods: %s", err)
		}
	}

	return nil
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

// portForwardToPod sets up port forwarding to a pod identified by namespace and labelSelector.
// It returns the allocated local port that was used for port forwarding.
func portForwardToPod(ctx context.Context, localClient kubernetes.ClientInterface, namespace string, labelSelector Selector, targetPort string) (int, error) {
	// TODO: Check if the address is already in use.
	localPort := httputil.Pool.GetFreePort()

	pods, err := localClient.Kube().CoreV1().Pods(namespace).List(ctx, metav1.ListOptions{LabelSelector: string(labelSelector)})
	if err != nil {
		return 0, err
	}

	if len(pods.Items) == 0 {
		return 0, fmt.Errorf("no pod found in %s namespace with label selector %s", namespace, labelSelector)
	}

	pod := pods.Items[0]
	log.Infof("Port forwarding to %s pod", pod.Name)
	pf, err := httputil.NewPortForwarder(
		localClient.Kube().CoreV1().RESTClient(),
		localClient.ClusterInfo().ClientConfig,
		pod.Namespace,
		pod.Name,
		"localhost",
		fmt.Sprintf("%d:%s", localPort, targetPort),
		io.Discard,
	)
	if err != nil {
		return 0, err
	}

	if err := pf.Start(); err != nil {
		return 0, err
	}
	go func() {
		defer pf.Stop()
		<-ctx.Done()
	}()

	return localPort, nil
}

func portForwardToTracing(ctx context.Context, localClient kubernetes.ClientInterface, conf *config.Config, tracingPort string, tracingSelector Selector) error {
	// go run kiali.go run --port-forward-prom --port-forward-tracing --enable-tracing --tracing-selector app.kubernetes.io/name=tempo,app.kubernetes.io/component=query-frontend --tracing-port 3200 --port-forward-grafana --config kiali-local.yaml --cluster-name-overrides=kind-ci=cluster-default
	localPort, err := portForwardToPod(ctx, localClient, "", tracingSelector, tracingPort)
	if err != nil {
		return err
	}
	conf.ExternalServices.Tracing.InternalURL = fmt.Sprintf("http://127.0.0.1:%d", localPort)
	// Apparently this setting doesn't work since the version check strips out the port.
	conf.ExternalServices.Tracing.UseGRPC = false
	config.Set(conf)

	return nil
}

func portForwardToGrafana(ctx context.Context, localClient kubernetes.ClientInterface, conf *config.Config, dashboardsPort string, dashboardSelector Selector) error {
	localPort, err := portForwardToPod(ctx, localClient, "", dashboardSelector, dashboardsPort)
	if err != nil {
		return err
	}
	conf.ExternalServices.Grafana.InternalURL = fmt.Sprintf("http://127.0.0.1:%d", localPort)
	config.Set(conf)

	return nil
}

func portForwardToProm(ctx context.Context, localClient kubernetes.ClientInterface, conf *config.Config, metricsPort string, metricsSelector Selector) error {
	localPort, err := portForwardToPod(ctx, localClient, "", metricsSelector, metricsPort)
	if err != nil {
		return err
	}
	conf.ExternalServices.Prometheus.URL = fmt.Sprintf("http://127.0.0.1:%d", localPort)
	config.Set(conf)

	return nil
}
