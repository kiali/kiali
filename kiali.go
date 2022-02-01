// Kiali
//
// Kiali project, observability for the Istio service mesh
//
//     Schemes: http, https
//     BasePath: /api
//     Version: _
//
//     Consumes:
//     - application/json
//
//     Produces:
//     - application/json
//
// swagger:meta
package main

import (
	"flag"
	"fmt"
	"io/ioutil"
	"os"
	"os/signal"
	"regexp"
	"strings"

	_ "go.uber.org/automaxprocs"

	"github.com/kiali/kiali/business/authentication"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/prometheus/internalmetrics"
	"github.com/kiali/kiali/server"
	"github.com/kiali/kiali/status"
	"github.com/kiali/kiali/util"
)

// Identifies the build. These are set via ldflags during the build (see Makefile).
var (
	version    = "unknown"
	commitHash = "unknown"
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
	log.Infof("Kiali: Version: %v, Commit: %v\n", version, commitHash)
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
	log.Tracef("Kiali Configuration:\n%s", config.Get())

	if err := validateConfig(); err != nil {
		log.Fatal(err)
	}

	consoleVersion := determineConsoleVersion()
	log.Infof("Kiali: Console version: %v", consoleVersion)

	status.Put(status.ConsoleVersion, consoleVersion)
	status.Put(status.CoreVersion, version)
	status.Put(status.CoreCommitHash, commitHash)
	status.Put(status.ContainerVersion, determineContainerVersion(version))

	// check kiali version compatibility with mesh
	meshName, meshVersion, err := status.GetMeshInfo()

	ok := false
	if err != nil {
		log.Warningf("Failed to get mesh version, please check if url_service_version is configured correctly.")
		status.AddWarningMessages("Failed to get mesh version, please check if url_service_version is configured correctly.")
	} else if meshName == "Unknown" {
		log.Warningf("Unknown Istio Implementation")
		status.Put(status.MeshVersion, meshVersion)
		status.Put(status.MeshName, meshName)
		status.AddWarningMessages("Unknown Istio Implementation")
	} else {
		ok = status.CheckMeshVersion(meshName, meshVersion, version)
		if ok {
			log.Info("Mesh Name: %v Mesh Version: %v", meshName, meshVersion)
			status.Put(status.MeshVersion, meshVersion)
			status.Put(status.MeshName, meshName)
			status.Put(status.IsCompatible, "true")
		} else {
			log.Warningf("Kiali %v is not compatible with %v %v", version, meshName, meshVersion)
			status.AddWarningMessages(fmt.Sprintf("Kiali %v is not compatible with %v %v", version, meshName, meshVersion))
			status.Put(status.IsCompatible, "false")
		}
	}

	authentication.InitializeAuthenticationController(config.Get().Auth.Strategy)

	// prepare our internal metrics so Prometheus can scrape them
	internalmetrics.RegisterInternalMetrics()

	// Start listening to requests
	server := server.NewServer()
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
	var doneChan = make(chan bool)

	signalChan := make(chan os.Signal, 1)
	signal.Notify(signalChan, os.Interrupt)
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
		log.Warningf("Some validation errors will be ignored %v. If these errors do occur, they will still be logged. If you think the validation errors you see are incorrect, please report them to the Kiali team if you have not done so already and provide the details of your scenario. This will keep Kiali validations strong for the whole community.", cfg.KialiFeatureFlags.Validations.Ignore)
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

// determineConsoleVersion will return the version of the UI console the server will serve to clients.
// Note this method requires the configuration to be loaded and available via config.Get()
func determineConsoleVersion() string {
	consoleVersion := "unknown"
	filename := config.Get().Server.StaticContentRootDirectory + "/version.txt"
	fileContent, err := ioutil.ReadFile(filename)
	if err == nil {
		consoleVersion = string(fileContent)
		consoleVersion = strings.TrimSpace(consoleVersion) // also seems to kill off EOF
	} else {
		log.Errorf("Failed to determine console version from file [%v]. error=%v", filename, err)
	}
	return consoleVersion
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
