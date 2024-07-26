//go:build !exclude_frontend

package cmd

import (
	"context"
	"fmt"
	"io"
	"net/url"
	"os/exec"
	"runtime"
	"slices"
	"strings"

	"github.com/spf13/cobra"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/tools/clientcmd"
	"k8s.io/client-go/tools/clientcmd/api"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/util/httputil"
)

func newLocalCmd(conf *config.Config) *cobra.Command {
	// Local flag variables for local command
	var (
		homeClusterContext    string
		kubeConfig            = kubernetes.KubeConfigDir() // Set default value
		remoteClusterContexts []string
		withoutBrowser        = false // Set default value
		portForwardToPromFlag = true  // Set default value
		clusterNameOverrides  []string
	)

	cmd := &cobra.Command{
		Use:          "local",
		SilenceUsage: false,
		Short:        "Run Kiali in local mode",
		Long:         `Run Kiali in local mode with a local Kubernetes cluster.`,
		RunE: func(cmd *cobra.Command, args []string) error {
			// Override some settings in local mode.
			conf.RunMode = config.RunModeLocal
			conf.Auth.Strategy = config.AuthStrategyAnonymous
			conf.Deployment.RemoteSecretPath = kubeConfig

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
			if err := config.Validate(*conf); err != nil {
				return fmt.Errorf("invalid configuration: %v", err)
			}

			ctx, cancel := context.WithCancel(context.Background())
			defer cancel()
			serverStopped, err := RunLocal(ctx, conf, remoteClusterContexts, homeClusterContext, portForwardToPromFlag, withoutBrowser)
			if err != nil {
				return fmt.Errorf("unable to run kiali locally: %s", err)
			}

			WaitForTermination(cancel)
			// This ensures that the Run process has fully cleaned itself up.
			<-serverStopped

			return nil
		},
	}
	cmd.Flags().StringVar(&homeClusterContext, "home-cluster-context", homeClusterContext, "Sets Kiali's home cluster context in local mode.")
	cmd.Flags().StringVar(&kubeConfig, "kubeconfig", kubeConfig, "Path to the kubeconfig file for Kiali to use.")
	cmd.Flags().StringSliceVar(&remoteClusterContexts, "remote-cluster-contexts", remoteClusterContexts,
		"Comma separated list of remote cluster contexts.")
	cmd.Flags().BoolVar(&withoutBrowser, "without-browser", withoutBrowser, "If true, will not open the default browser after startup.")
	cmd.Flags().BoolVar(&portForwardToPromFlag, "port-forward-to-prom", portForwardToPromFlag,
		"If true, will port-forward to the Prometheus pod in the home cluster. Disable this if you want to use an external Prometheus URL.")
	cmd.Flags().StringSliceVar(&clusterNameOverrides, "cluster-name-overrides", clusterNameOverrides,
		"Comma separated list of cluster name overrides in the format 'original-name=override-name'.")
	return cmd
}

// setupPortForwarding configures port forwarding for Prometheus and Tracing services
// when running in local mode. It checks if the home cluster client is available and
// sets up port forwarding based on the configuration flags.
func setupPortForwarding(ctx context.Context, cf kubernetes.ClientFactory, conf *config.Config, portForwardToPromFlag bool) error {
	if cf.GetSAHomeClusterClient() == nil {
		log.Info("Home cluster client is nil. Not starting prom.")
		return nil
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
	// TODO: Probably need the same for tracing.
	if conf.ExternalServices.Tracing.Enabled {
		if err := portForwardToTracing(ctx, cf.GetSAHomeClusterClient(), conf); err != nil {
			log.Warningf("Unable to setup port forwarding to tracing pods: %s", err)
		}
	}

	return nil
}

func RunLocal(
	ctx context.Context,
	conf *config.Config,
	remoteClusterContexts []string,
	homeClusterContext string,
	portForwardToPromFlag bool,
	withoutBrowser bool,
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

	if err := setupPortForwarding(ctx, cf, conf, portForwardToPromFlag); err != nil {
		return nil, fmt.Errorf("unable to setup port forwarding: %s", err)
	}

	log.Info("Running server")
	stopped := RunServer(ctx, conf, cf)
	log.Info("Server is ready.")
	if !withoutBrowser {
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
