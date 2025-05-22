package main

import (
	"context"
	"flag"
	"os"
	"strings"

	servercmd "github.com/kiali/kiali/cmd"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	local "github.com/kiali/kiali/local/cmd"
	"github.com/kiali/kiali/log"
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
	argConfigFile         string
	homeClusterContext    string
	kubeConfig            string
	remoteClusterContexts []string
	openBrowser           bool
)

func init() {
	// Registering these flags here is only necessary because controller-runtime already registers the "kubeconfig" flag
	// and double registering causes a panic. Creating a new default FlagSet here drops the controller-runtime flag.
	// See this bug: https://github.com/kubernetes-sigs/controller-runtime/issues/878.
	flag.CommandLine = flag.NewFlagSet(os.Args[0], flag.ExitOnError)
	flag.StringVar(&argConfigFile, "config", "", "Path to the YAML configuration file. If not specified, environment variables will be used for configuration.")
	flag.StringVar(&homeClusterContext, "home-cluster-context", "", "Sets Kiali's home cluster context in local mode.")
	flag.StringVar(&kubeConfig, "kubeconfig", kubernetes.KubeConfigDir(), "Path to the kubeconfig file for Kiali to use.")
	flag.Func("remote-cluster-contexts", "Comma separated list of remote cluster contexts.", func(flagValue string) error {
		// Need to check for empty string because strings.Split on "" returns [""]
		if flagValue != "" {
			remoteClusterContexts = strings.Split(flagValue, ",")
		}
		return nil
	})
	flag.BoolVar(&openBrowser, "open-browser", true, "If true, will open the default browser after startup.")

	// log everything to stderr so that it can be easily gathered by logs, separate log files are problematic with containers
	_ = flag.Set("logtostderr", "true")
}

func main() {
	zl := log.InitializeLogger()
	util.Clock = util.RealClock{}

	flag.Parse()
	validateFlags()

	// log startup information
	log.Infof("Kiali: Version: %v, Commit: %v, Go: %v", version, commitHash, goVersion)

	ctx, cancel := context.WithCancel(context.Background())
	conf := config.MustLoadConfig(argConfigFile)

	var serverStopped <-chan struct{}

	// Override some settings in local mode.
	conf.RunMode = config.RunModeLocal
	conf.Auth.Strategy = config.AuthStrategyAnonymous
	conf.Deployment.RemoteSecretPath = kubeConfig
	config.Set(conf)
	if err := config.Validate(*conf); err != nil {
		log.Fatal(err)
	}

	serverStopped, err := local.Run(ctx, conf, version, commitHash, goVersion, homeClusterContext, remoteClusterContexts, openBrowser, &zl)
	if err != nil {
		log.Fatalf("Unable to run kiali locally: %s", err)
	}

	servercmd.WaitForTermination(cancel)
	// This ensures that the Run process has fully cleaned itself up.
	<-serverStopped
}

func validateFlags() {
	if argConfigFile != "" {
		if _, err := os.Stat(argConfigFile); err != nil {
			if os.IsNotExist(err) {
				log.Debugf("Configuration file [%v] does not exist.", argConfigFile)
			}
		}
	}
}
