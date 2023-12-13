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
	"flag"
	"fmt"
	"os"
	"os/signal"
	"regexp"
	"strings"
	"syscall"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/business/authentication"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/cache"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/observability"
	"github.com/kiali/kiali/prometheus"
	"github.com/kiali/kiali/prometheus/internalmetrics"
	"github.com/kiali/kiali/server"
	"github.com/kiali/kiali/status"
	"github.com/kiali/kiali/tracing"
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
	argConfigFile = flag.String("config", "", "Path to the YAML configuration file. If not specified, environment variables will be used for configuration.")
)

func init() {
	// log everything to stderr so that it can be easily gathered by logs, separate log files are problematic with containers
	_ = flag.Set("logtostderr", "true")
}

func main() {
	log.InitializeLogger()
	util.Clock = util.RealClock{}

	// process command line
	flag.Parse()
	validateFlags()

	// log startup information
	log.Infof("Kiali: Version: %v, Commit: %v, Go: %v", version, commitHash, goVersion)
	log.Debugf("Kiali: Command line: [%v]", strings.Join(os.Args, " "))

	// load config file if specified, otherwise, rely on environment variables to configure us
	if *argConfigFile != "" {
		c, err := config.LoadFromFile(*argConfigFile)
		if err != nil {
			log.Fatal(err)
		}
		config.Set(c)
	} else {
		log.Infof("No configuration file specified. Will rely on environment for configuration.")
		config.Set(config.NewConfig())
	}

	updateConfigWithIstioInfo()

	cfg := config.Get()
	log.Tracef("Kiali Configuration:\n%s", cfg)

	if err := validateConfig(); err != nil {
		log.Fatal(err)
	}

	status.Put(status.CoreVersion, version)
	status.Put(status.CoreCommitHash, commitHash)
	status.Put(status.ContainerVersion, determineContainerVersion(version))

	authentication.InitializeAuthenticationController(cfg.Auth.Strategy)

	// prepare our internal metrics so Prometheus can scrape them
	internalmetrics.RegisterInternalMetrics()

	// Create the business package dependencies.
	clientFactory, err := kubernetes.GetClientFactory()
	if err != nil {
		log.Fatalf("Failed to create client factory. Err: %s", err)
	}

	log.Info("Initializing Kiali Cache")
	cache, err := cache.NewKialiCache(clientFactory, *cfg)
	if err != nil {
		log.Fatalf("Error initializing Kiali Cache. Details: %s", err)
	}
	defer cache.Stop()

	namespaceService := business.NewNamespaceService(clientFactory.GetSAClients(), clientFactory.GetSAClients(), cache, *cfg)
	meshService := business.NewMeshService(clientFactory.GetSAClients(), cache, namespaceService, *cfg)
	cpm := business.NewControlPlaneMonitor(cache, clientFactory, *cfg, &meshService)

	if cfg.ExternalServices.Istio.IstioAPIEnabled {
		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()
		cpm.PollIstiodForProxyStatus(ctx)
	}

	// Create shared prometheus client shared by all prometheus requests in the business layer.
	prom, err := prometheus.NewClient()
	if err != nil {
		log.Fatalf("Error creating Prometheus client: %s", err)
	}

	// Create shared tracing client shared by all tracing requests in the business layer.
	var tracingClient tracing.ClientInterface
	if cfg.ExternalServices.Tracing.Enabled {
		tracingClient, err = tracing.NewClient(clientFactory.GetSAHomeClusterClient().GetToken())
		if err != nil {
			log.Fatalf("Error creating tracing client: %s", err)
		}
	} else {
		log.Debug("Tracing is disabled")
	}

	// Start listening to requests
	server := server.NewServer(cpm, clientFactory, cache, *cfg, prom, tracingClient)
	server.Start()

	// wait forever, or at least until we are told to exit
	waitForTermination()

	// Shutdown internal components
	log.Info("Shutting down internal components")
	server.Stop()
}

func waitForTermination() {
	// Channel that is notified when we are done and should exit
	// TODO: may want to make this a package variable - other things might want to tell us to exit
	doneChan := make(chan bool)

	signalChan := make(chan os.Signal, 1)
	signal.Notify(signalChan, syscall.SIGINT, syscall.SIGTERM)
	go func() {
		for range signalChan {
			log.Info("Termination Signal Received")
			doneChan <- true
		}
	}()

	<-doneChan
}

func validateConfig() error {
	cfg := config.Get()

	if cfg.Server.Port < 0 {
		return fmt.Errorf("server port is negative: %v", cfg.Server.Port)
	}

	if strings.Contains(cfg.Server.StaticContentRootDirectory, "..") {
		return fmt.Errorf("server static content root directory must not contain '..': %v", cfg.Server.StaticContentRootDirectory)
	}
	if _, err := os.Stat(cfg.Server.StaticContentRootDirectory); os.IsNotExist(err) {
		return fmt.Errorf("server static content root directory does not exist: %v", cfg.Server.StaticContentRootDirectory)
	}

	validPathRegEx := regexp.MustCompile(`^\/[a-zA-Z0-9\-\._~!\$&\'()\*\+\,;=:@%/]*$`)
	webRoot := cfg.Server.WebRoot
	if !validPathRegEx.MatchString(webRoot) {
		return fmt.Errorf("web root must begin with a / and contain valid URL path characters: %v", webRoot)
	}
	if webRoot != "/" && strings.HasSuffix(webRoot, "/") {
		return fmt.Errorf("web root must not contain a trailing /: %v", webRoot)
	}
	if strings.Contains(webRoot, "/../") {
		return fmt.Errorf("for security purposes, web root must not contain '/../': %v", webRoot)
	}

	// log some messages to let the administrator know when credentials are configured certain ways
	auth := cfg.Auth
	log.Infof("Using authentication strategy [%v]", auth.Strategy)
	if auth.Strategy == config.AuthStrategyAnonymous {
		log.Warningf("Kiali auth strategy is configured for anonymous access - users will not be authenticated.")
	} else if auth.Strategy != config.AuthStrategyOpenId &&
		auth.Strategy != config.AuthStrategyOpenshift &&
		auth.Strategy != config.AuthStrategyToken &&
		auth.Strategy != config.AuthStrategyHeader {
		return fmt.Errorf("Invalid authentication strategy [%v]", auth.Strategy)
	}

	// Check the ciphering key for sessions
	signingKey := cfg.LoginToken.SigningKey
	if err := config.ValidateSigningKey(signingKey, auth.Strategy); err != nil {
		return err
	}

	// log a warning if the user is ignoring some validations
	if len(cfg.KialiFeatureFlags.Validations.Ignore) > 0 {
		log.Infof("Some validation errors will be ignored %v. If these errors do occur, they will still be logged. If you think the validation errors you see are incorrect, please report them to the Kiali team if you have not done so already and provide the details of your scenario. This will keep Kiali validations strong for the whole community.", cfg.KialiFeatureFlags.Validations.Ignore)
	}

	// log a info message if the user is disabling some features
	if len(cfg.KialiFeatureFlags.DisabledFeatures) > 0 {
		log.Infof("Some features are disabled: [%v]", strings.Join(cfg.KialiFeatureFlags.DisabledFeatures, ","))
		for _, fn := range cfg.KialiFeatureFlags.DisabledFeatures {
			if err := config.FeatureName(fn).IsValid(); err != nil {
				return err
			}
		}
	}

	// Check the observability section
	cfgTracing := cfg.Server.Observability.Tracing
	if cfgTracing.Enabled && cfgTracing.CollectorType != observability.JAEGER && cfgTracing.CollectorType != observability.OTEL {
		return fmt.Errorf("error in configuration options getting the observability exporter. Invalid collector type [%s]", cfgTracing.CollectorType)
	}

	return nil
}

func validateFlags() {
	if *argConfigFile != "" {
		if _, err := os.Stat(*argConfigFile); err != nil {
			if os.IsNotExist(err) {
				log.Debugf("Configuration file [%v] does not exist.", *argConfigFile)
			}
		}
	}
}

// determineContainerVersion will return the version of the image container.
// It does this by looking at an ENV defined in the Dockerfile when the image is built.
// If the ENV is not defined, the version is assumed the same as the given default value.
func determineContainerVersion(defaultVersion string) string {
	v := os.Getenv("KIALI_CONTAINER_VERSION")
	if v == "" {
		return defaultVersion
	}
	return v
}

// This is used to update the config with information about istio that
// comes from the environment such as the cluster name.
func updateConfigWithIstioInfo() {
	conf := *config.Get()

	homeCluster := conf.KubernetesConfig.ClusterName
	if homeCluster != "" {
		// If the cluster name is already set, we don't need to do anything
		return
	}

	err := func() error {
		log.Debug("Cluster name is not set. Attempting to auto-detect the cluster name from the home cluster environment.")
		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()

		// Need to create a temporary client factory here so that we can create a client
		// to auto-detect the istio cluster name from the environment. There's a bit of a
		// chicken and egg problem with the client factory because the client factory
		// uses the cluster id to keep track of all the clients. But in order to create
		// a client to get the cluster id from the environment, you need to create a client factory.
		// To get around that we create a temporary client factory here and then set the kiali
		// config cluster name. We then create the global client factory later in the business
		// package and that global client factory has the cluster id set properly.
		cf, err := kubernetes.NewClientFactory(ctx, conf)
		if err != nil {
			return err
		}

		// Try to auto-detect the cluster name
		homeCluster, _, err = kubernetes.ClusterInfoFromIstiod(conf, cf.GetSAHomeClusterClient())
		if err != nil {
			return err
		}

		return nil
	}()
	if err != nil {
		log.Warningf("Cannot resolve local cluster name. Err: %s. Falling back to [%s]", err, config.DefaultClusterID)
		homeCluster = config.DefaultClusterID
	}

	log.Debugf("Auto-detected the istio cluster name to be [%s]. Updating the kiali config", homeCluster)
	conf.KubernetesConfig.ClusterName = homeCluster
	config.Set(&conf)
}
