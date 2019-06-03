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
	"time"

	"github.com/golang/glog"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/config/security"
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
	flag.Set("logtostderr", "true")

}

func main() {
	defer glog.Flush()
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
			glog.Fatal(err)
		}
		config.Set(c)
	} else {
		log.Infof("No configuration file specified. Will rely on environment for configuration.")
		config.Set(config.NewConfig())
	}
	log.Tracef("Kiali Configuration:\n%s", config.Get())

	if err := validateConfig(); err != nil {
		glog.Fatal(err)
	}

	consoleVersion := determineConsoleVersion()
	log.Infof("Kiali: Console version: %v", consoleVersion)

	status.Put(status.ConsoleVersion, consoleVersion)
	status.Put(status.CoreVersion, version)
	status.Put(status.CoreCommitHash, commitHash)

	if webRoot := config.Get().Server.WebRoot; webRoot != "/" {
		updateBaseURL(webRoot)
		configToJS()
	}

	// prepare our internal metrics so Prometheus can scrape them
	internalmetrics.RegisterInternalMetrics()

	// check if Jaeger is available
	// we need first discover Jaeger
	if config.Get().ExternalServices.Tracing.Enabled {
		status.DiscoverJaeger()
	}

	// Start listening to requests
	server := server.NewServer()
	server.Start()

	// wait for the secret when a secret is required
	if config.Get().Auth.Strategy == config.AuthStrategyLogin {
		waitForSecret()
	}

	// wait forever, or at least until we are told to exit
	waitForTermination()

	// Shutdown internal components
	log.Info("Shutting down internal components")
	server.Stop()
}

func waitForSecret() {
	foundSecretChan := make(chan security.Credentials)
	go func() {
		errs := 0
		for {
			username, uErr := ioutil.ReadFile(config.LoginSecretUsername)
			passphrase, pErr := ioutil.ReadFile(config.LoginSecretPassphrase)
			if uErr == nil && pErr == nil {
				if string(username) != "" && string(passphrase) != "" {
					log.Info("Secret is now available.")
					foundSecretChan <- security.Credentials{
						Username:   string(username),
						Passphrase: string(passphrase),
					}
					break
				}
			}
			errs++
			if (errs % 5) == 0 {
				log.Warning("Kiali is missing a secret that contains both 'username' and 'passphrase'")
			}
			time.Sleep(2 * time.Second)
		}
	}()
	secret := <-foundSecretChan
	cfg := config.Get()
	cfg.Server.Credentials.Username = secret.Username
	cfg.Server.Credentials.Passphrase = secret.Passphrase
	config.Set(cfg)
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

	if err := config.Get().Server.Credentials.ValidateCredentials(); err != nil {
		return fmt.Errorf("server credentials are invalid: %v", err)
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
	if auth.Strategy == config.AuthStrategyLogin {
		creds := config.Get().Server.Credentials
		if creds.Username == "" && creds.Passphrase == "" {
			// This won't cause Kiali to abort, but users won't be able to log in, so immediately log a warning
			log.Warningf("Credentials are missing. Create a proper secret. Please refer to the documentation for more details.")
		}
	} else if auth.Strategy == config.AuthStrategyAnonymous {
		log.Warningf("Kiali auth strategy is configured for anonymous access - users will not be authenticated.")
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

// configToJS generates env.js file from Kiali config
func configToJS() {
	log.Info("Generating env.js from config")
	path, _ := filepath.Abs("./console/env.js")

	content := "window.WEB_ROOT='" + config.Get().Server.WebRoot + "';"

	log.Debugf("The content of %v will be:\n%v", path, content)

	err := ioutil.WriteFile(path, []byte(content), 0)
	if isError(err) {
		return
	}
}

// updateBaseURL updates index.html base href with web root string
func updateBaseURL(webRootPath string) {
	if webRootPath == "/" {
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

	return (err != nil)
}
