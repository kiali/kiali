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
	"embed"
	"flag"
	"io/fs"
	"os"
	"os/signal"
	"path"
	"strings"
	"syscall"

	_ "go.uber.org/automaxprocs"

	"github.com/kiali/kiali/cmd/local"
	"github.com/kiali/kiali/cmd/server"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/util"
)

//go:embed frontend/build/*
var folder embed.FS

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

func kubeConfigDir() string {
	if kubeEnv, ok := os.LookupEnv("KUBECONFIG"); ok {
		return kubeEnv
	}
	if homedir, err := os.UserHomeDir(); err == nil {
		return path.Join(homedir, ".kube/config")
	}
	return ""
}

func init() {
	// Registering these flags here is only necessary because controller-runtime already registers the "kubeconfig" flag
	// and double registering causes a panic. Creating a new default FlagSet here drops the controller-runtime flag.
	// See this bug: https://github.com/kubernetes-sigs/controller-runtime/issues/878.
	flag.CommandLine = flag.NewFlagSet(os.Args[0], flag.ExitOnError)
	flag.StringVar(&argConfigFile, "config", "", "Path to the YAML configuration file. If not specified, environment variables will be used for configuration.")
	flag.StringVar(&homeClusterContext, "home-cluster-context", "", "Sets Kiali's home cluster context in local mode.")
	flag.StringVar(&kubeConfig, "kubeconfig", kubeConfigDir(), "Path to the kubeconfig file for Kiali to use.")
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
	log.InitializeLogger()
	util.Clock = util.RealClock{}

	flag.Parse()
	validateFlags()

	// log startup information
	log.Infof("Kiali: Version: %v, Commit: %v, Go: %v", version, commitHash, goVersion)

	// load config file if specified, otherwise, rely on environment variables to configure us
	if argConfigFile != "" {
		c, err := config.LoadFromFile(argConfigFile)
		if err != nil {
			log.Fatal(err)
		}
		config.Set(c)
	} else {
		log.Infof("No configuration file specified. Will rely on environment for configuration.")
		config.Set(config.NewConfig())
	}

	f, err := fs.Sub(folder, "frontend/build")
	if err != nil {
		log.Fatalf("Error getting subfolder: %v", err)
	}

	ctx, cancel := context.WithCancel(context.Background())
	conf := config.Get()

	var serverStopped <-chan struct{}

	switch flag.CommandLine.Arg(0) {
	case "open":
		// Override some settings in local mode.
		conf.RunMode = config.RunModeLocal
		conf.Auth.Strategy = config.AuthStrategyAnonymous
		conf.Deployment.RemoteSecretPath = kubeConfig
		config.Set(conf)
		if err := config.Validate(*conf); err != nil {
			log.Fatal(err)
		}
		serverStopped, err = local.Run(ctx, conf, version, commitHash, goVersion, f, homeClusterContext, remoteClusterContexts, openBrowser)
		if err != nil {
			log.Fatalf("Unable to run kiali locally: %s", err)
		}
	default:
		if err := config.Validate(*conf); err != nil {
			log.Fatal(err)
		}
		log.Tracef("Kiali Configuration:\n%s", conf)
		clientFactory, err := kubernetes.GetClientFactory()
		if err != nil {
			log.Fatalf("Failed to create client factory. Err: %s", err)
		}

		serverStopped = server.Run(ctx, conf, version, commitHash, goVersion, f, clientFactory)
	}
	waitForTermination(cancel)
	// This ensures that the Run process has fully cleaned itself up.
	<-serverStopped
}

func waitForTermination(cancel context.CancelFunc) {
	// Channel that is notified when we are done and should exit
	// TODO: may want to make this a package variable - other things might want to tell us to exit
	doneChan := make(chan bool)

	signalChan := make(chan os.Signal, 1)
	signal.Notify(signalChan, syscall.SIGINT, syscall.SIGTERM)
	go func() {
		for range signalChan {
			log.Info("Termination Signal Received")
			cancel()
			doneChan <- true
		}
	}()

	<-doneChan
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
