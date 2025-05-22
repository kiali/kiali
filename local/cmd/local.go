package local

import (
	"context"
	"fmt"
	"io"
	"io/fs"
	"net/url"
	"os/exec"
	"runtime"
	"slices"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/tools/clientcmd"
	"k8s.io/client-go/tools/clientcmd/api"

	servercmd "github.com/kiali/kiali/cmd"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/frontend"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/util/httputil"
	"github.com/rs/zerolog"
)

func Run(
	ctx context.Context,
	conf *config.Config,
	version string,
	commitHash string,
	goVersion string,
	homeClusterContext string,
	remoteClusterContexts []string,
	openBrowser bool,
	logger *zerolog.Logger,
) (<-chan struct{}, error) {
	log.Info("Running Kiali in local mode")
	staticAssetFS, err := fs.Sub(frontend.FrontendBuildAssets, "build")
	if err != nil {
		log.Fatalf("Error getting subfolder: %v", err)
	}

	log.Infof("Loading kubeconfig from file: %s", conf.Deployment.RemoteSecretPath)

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

	cf, err := kubernetes.NewClientFactoryWithSAClients(ctx, *conf, clients)
	if err != nil {
		return nil, fmt.Errorf("unable to create new client factory")
	}

	// TODO: pass prom url to port forward instead of setting here?

	log.Info("Port forwarding to Prometheus.")
	// TODO: Better predict prom
	if cf.GetSAHomeClusterClient() == nil {
		log.Info("Home cluster client is nil. Not starting prom.")
	} else {
		// if conf.ExternalServices.Prometheus.
		// Can we run Kiali without prom? Would be nice in some cases.
		if err := portForwardToProm(ctx, cf.GetSAHomeClusterClient(), conf); err != nil {
			log.Warningf("Unable to setup port forwarding to prom pods: %s\t Disabling prometheus.", err)
			conf.ExternalServices.Prometheus.Enabled = false
			config.Set(conf)
		}
		if conf.ExternalServices.Tracing.Enabled {
			if err := portForwardToTracing(ctx, cf.GetSAHomeClusterClient(), conf); err != nil {
				log.Warningf("Unable to setup port forwarding to tracing pods: %s", err)
			}
		}
	}
	log.Info("Running server")
	stopped := servercmd.Run(ctx, conf, version, commitHash, goVersion, staticAssetFS, cf, logger)
	log.Info("Server is ready.")
	if openBrowser {
		log.Info("Opening Kiali in default browser")
		if err := openDefaultBrowser(ctx); err != nil {
			log.Errorf("Unable to open default browser: %s", err)
		}
	}

	return stopped, nil
}

func openDefaultBrowser(ctx context.Context) error {
	// TODO: Choose port.
	const kialiURL = "http://localhost:20001"
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

	promPods, err := localClient.Kube().CoreV1().Pods("istio-system").List(context.TODO(), metav1.ListOptions{LabelSelector: "app.kubernetes.io/name=prometheus"})
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
