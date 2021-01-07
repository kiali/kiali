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
	"path/filepath"
	"regexp"
	"strings"

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

	updateBaseURL(config.Get().Server.WebRoot)
	configToJS()

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
	if config.Get().Server.Port < 0 {
		return fmt.Errorf("server port is negative: %v", config.Get().Server.Port)
	}

	if strings.Contains(config.Get().Server.StaticContentRootDirectory, "..") {
		return fmt.Errorf("server static content root directory must not contain '..': %v", config.Get().Server.StaticContentRootDirectory)
	}
	if _, err := os.Stat(config.Get().Server.StaticContentRootDirectory); os.IsNotExist(err) {
		return fmt.Errorf("server static content root directory does not exist: %v", config.Get().Server.StaticContentRootDirectory)
	}

	validPathRegEx := regexp.MustCompile(`^\/[a-zA-Z0-9\-\._~!\$&\'()\*\+\,;=:@%/]*$`)
	webRoot := config.Get().Server.WebRoot
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
	auth := config.Get().Auth
	log.Infof("Using authentication strategy [%v]", auth.Strategy)
	if auth.Strategy == config.AuthStrategyAnonymous {
		log.Warningf("Kiali auth strategy is configured for anonymous access - users will not be authenticated.")
	} else if auth.Strategy != config.AuthStrategyOpenId &&
		auth.Strategy != config.AuthStrategyOpenshift &&
		auth.Strategy != config.AuthStrategyToken &&
		auth.Strategy != config.AuthStrategyHeader {
		return fmt.Errorf("Invalid authentication strategy [%v]", auth.Strategy)
	}

	// Check the signing key for the JWT token is valid
	signingKey := config.Get().LoginToken.SigningKey
	if err := config.ValidateSigningKey(signingKey, auth.Strategy); err != nil {
		return err
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

// configToJS generates env.js file from Kiali config
func configToJS() {
	log.Info("Generating env.js from config")
	path, _ := filepath.Abs("./console/env.js")

	conf := config.Get()
	var content string
	if len(conf.Server.WebHistoryMode) > 0 {
		content += fmt.Sprintf("window.HISTORY_MODE='%s';\n", conf.Server.WebHistoryMode)
	}

	if webRoot := strings.TrimSuffix(config.Get().Server.WebRoot, "/"); len(webRoot) > 0 {
		content += fmt.Sprintf("window.WEB_ROOT='%s';\n", webRoot)
	}

	log.Debugf("The content of %v will be:\n%v", path, content)

	err := ioutil.WriteFile(path, []byte(content), 0)
	if isError(err) {
		return
	}
}

// updateBaseURL updates index.html base href with web root string
func updateBaseURL(webRootPath string) {
	webRootPath = strings.TrimSuffix(webRootPath, "/")
	if len(webRootPath) == 0 {
		return // nothing to do - our web root path is already /
	}

	log.Infof("Updating base URL in index.html with [%v]", webRootPath)
	path, _ := filepath.Abs("./console/index.html")
	b, err := ioutil.ReadFile(path)
	if isError(err) {
		return
	}

	html := string(b)

	searchStr := `<base href="/"`
	newStr := `<base href="` + webRootPath + `/"`
	newHTML := strings.Replace(html, searchStr, newStr, -1)
	if html != newHTML && strings.Contains(newHTML, newStr) {
		log.Debugf("Base URL has been updated to [%v]", newStr)
	} else {
		log.Warningf("Base URL was not updated [%v]! The custom context root is not in force", searchStr)
	}

	err = ioutil.WriteFile(path, []byte(newHTML), 0)
	if isError(err) {
		return
	}
}

func isError(err error) bool {
	if err != nil {
		log.Errorf("File I/O error [%v]", err.Error())
	}

	return err != nil
}
