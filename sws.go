package main

import (
	"flag"
	"fmt"
	"os"
	"os/signal"
	"strings"

	"github.com/golang/glog"

	"github.com/swift-sunshine/swscore/config"
	"github.com/swift-sunshine/swscore/log"
	"github.com/swift-sunshine/swscore/server"
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

	// process command line
	flag.Parse()
	validateFlags()

	// log startup information
	log.Infof("SWS: Version: %v, Commit: %v\n", version, commitHash)
	log.Debugf("SWS: Command line: [%v]", strings.Join(os.Args, " "))

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
	log.Tracef("SWS Configuration:\n%s", config.Get())

	if err := validateConfig(); err != nil {
		glog.Fatal(err)
	}

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

	if err := config.Get().Server.Credentials.ValidateCredentials(); err != nil {
		return fmt.Errorf("server credentials are invalid: %v", err)
	}
	if strings.Contains(config.Get().Server.Static_Content_Root_Directory, "..") {
		return fmt.Errorf("server static content root directory must not contain '..': %v", config.Get().Server.Static_Content_Root_Directory)
	}
	if _, err := os.Stat(config.Get().Server.Static_Content_Root_Directory); os.IsNotExist(err) {
		return fmt.Errorf("server static content root directory does not exist: %v", config.Get().Server.Static_Content_Root_Directory)
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
