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

func newLocalCmd(conf *config.Config) *cobra.Command {
	var (
		homeClusterContext       string
		kubeConfig               = kubernetes.KubeConfigDir()
		remoteClusterContexts    []string
		withoutBrowser           = false
		portForwardToPromFlag    = false
		portForwardToGrafanaFlag = false
		portForwardToTracingFlag = false
		enableTracing            = false
		clusterNameOverrides     []string
	)

	cmd := &cobra.Command{
		Use:   "local",
		Short: "Run Kiali in local mode",
		Long:  `Run Kiali in local mode with a local Kubernetes cluster.`,
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

			if err := setupPortForwarding(ctx, cf, conf, portForwardToPromFlag, portForwardToGrafanaFlag, portForwardToTracingFlag, enableTracing); err != nil {
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
	cmd.Flags().BoolVar(&withoutBrowser, "without-browser", withoutBrowser, "If true, will not open the default browser after startup.")
	cmd.Flags().BoolVar(&portForwardToPromFlag, "port-forward-to-prom", portForwardToPromFlag,
		"If true, will port-forward to the Prometheus pod in the home cluster. Disable this if you want to use an external Prometheus URL.")
	cmd.Flags().BoolVar(&portForwardToGrafanaFlag, "port-forward-to-grafana", portForwardToGrafanaFlag,
		"If true, will port-forward to the Grafana pod in the home cluster. Disable this if you want to use an external Grafana URL.")
	cmd.Flags().BoolVar(&portForwardToTracingFlag, "port-forward-to-tracing", portForwardToTracingFlag,
		"If true, will port-forward to the Jaeger pod in the home cluster. Disable this if you want to use an external Jaeger URL.")
	cmd.Flags().BoolVar(&enableTracing, "enable-tracing", enableTracing, "If true, will enable tracing in the home cluster.")
	cmd.Flags().StringSliceVar(&clusterNameOverrides, "cluster-name-overrides", clusterNameOverrides,
		"Comma separated list of cluster name overrides in the format 'original-name=override-name'.")
	return cmd
}

// setupPortForwarding configures port forwarding for Prometheus and Tracing services
// when running in local mode.
func setupPortForwarding(ctx context.Context, cf kubernetes.ClientFactory, conf *config.Config, portForwardToPromFlag bool, portForwardToGrafanaFlag bool, portForwardToTracingFlag bool, enableTracing bool) error {
	// Override tracing configuration if enableTracing flag is set
	if enableTracing {
		conf.ExternalServices.Tracing.Enabled = true
		config.Set(conf)
	}

	// Need a separate "port-forward to prom option" because you can specify an external prometheus URL
	// in the config file and that should not be overridden by the port-forwarding.
	if conf.ExternalServices.Prometheus.Enabled && portForwardToPromFlag {
		if err := portForwardToProm(ctx, cf.GetSAHomeClusterClient(), conf); err != nil {
			log.Warningf("Unable to setup port forwarding to prom pods: %s\t Disabling prometheus.", err)
			conf.ExternalServices.Prometheus.Enabled = false
			config.Set(conf)
		}
	}
	// Port forward to Tracing if enabled and flag is set
	if conf.ExternalServices.Tracing.Enabled && portForwardToTracingFlag {
		if err := portForwardToTracing(ctx, cf.GetSAHomeClusterClient(), conf); err != nil {
			log.Warningf("Unable to setup port forwarding to tracing pods: %s", err)
		}
	}
	// Port forward to Grafana if enabled and flag is set
	if conf.ExternalServices.Grafana.Enabled && portForwardToGrafanaFlag {
		if err := portForwardToGrafana(ctx, cf.GetSAHomeClusterClient(), conf); err != nil {
			log.Warningf("Unable to setup port forwarding to grafana pods: %s", err)
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
func portForwardToPod(ctx context.Context, localClient kubernetes.ClientInterface, namespace, labelSelector string, targetPort string) (int, error) {
	localPort := httputil.Pool.GetFreePort()

	pods, err := localClient.Kube().CoreV1().Pods(namespace).List(ctx, metav1.ListOptions{LabelSelector: labelSelector})
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

func portForwardToTracing(ctx context.Context, localClient kubernetes.ClientInterface, conf *config.Config) error {
	localPort, err := portForwardToPod(ctx, localClient, "", "app=jaeger", "16686")
	if err != nil {
		return err
	}
	conf.ExternalServices.Tracing.InternalURL = fmt.Sprintf("http://127.0.0.1:%d", localPort)
	// Apparently this setting doesn't work since the version check strips out the port.
	conf.ExternalServices.Tracing.UseGRPC = false
	config.Set(conf)

	return nil
}

func portForwardToGrafana(ctx context.Context, localClient kubernetes.ClientInterface, conf *config.Config) error {
	localPort, err := portForwardToPod(ctx, localClient, "", "app.kubernetes.io/name=grafana", "3000")
	if err != nil {
		return err
	}
	conf.ExternalServices.Grafana.InternalURL = fmt.Sprintf("http://127.0.0.1:%d", localPort)
	config.Set(conf)

	return nil
}

func portForwardToProm(ctx context.Context, localClient kubernetes.ClientInterface, conf *config.Config) error {
	localPort, err := portForwardToPod(ctx, localClient, "", "app.kubernetes.io/name=prometheus", "9090")
	if err != nil {
		return err
	}
	conf.ExternalServices.Prometheus.URL = fmt.Sprintf("http://127.0.0.1:%d", localPort)
	config.Set(conf)

	return nil
}
