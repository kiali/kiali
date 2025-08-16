//go:build !exclude_frontend

package cmd

import (
	"context"
	"fmt"
	"os"

	"github.com/spf13/cobra"
	"go.uber.org/automaxprocs/maxprocs"
	ctrl "sigs.k8s.io/controller-runtime"

	"github.com/kiali/kiali/config"
	istioconfig "github.com/kiali/kiali/config/istio"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/util"
)

// Identifies the build. These are set via ldflags during the build (see Makefile).
// TODO: Probably these should go in their own package.
var (
	commitHash = "unknown"
	goVersion  = "unknown"
	version    = "unknown"
)

func newRootCmd() *cobra.Command {
	// Command line arguments
	var (
		argConfigFile string
		conf          = config.NewConfig()
		logLevel      string
	)

	cmd := &cobra.Command{
		SilenceUsage: true,
		Use:          "kiali",
		Short:        "Kiali - the console for Istio service mesh",
		Long: `Kiali is the console for Istio service mesh.

Complete documentation is available at http://kiali.io/docs/.`,
		PersistentPreRunE: func(cmd *cobra.Command, args []string) error {
			var opts []log.Option
			// Set log level from flag if provided
			if logLevel != "" {
				opts = append(opts, log.WithLogLevel(logLevel))
			}

			// For offline and local colorize the log output.
			// TODO: Should this go in those commands PreRun?
			if cmd.Name() == "offline" || cmd.Name() == "run" {
				opts = append(opts, log.WithColor())
			}
			log.InitializeLogger(opts...)

			if log.IsDebug() || log.IsTrace() {
				outputFlags(cmd)
			}
			util.Clock = util.RealClock{}

			if argConfigFile != "" {
				c, err := config.LoadConfig(argConfigFile)
				if err != nil {
					return fmt.Errorf("failed to load config: %v", err)
				}
				*conf = *c
			}
			// Note we don't validate the config here because other commands can override specific values
			// and the config should be validated after this.

			return nil
		},
		RunE: func(cmd *cobra.Command, args []string) error {
			// Calling this explicitly here so that it's not set in local mode since that likely won't be running in a container.
			undo, err := maxprocs.Set()
			defer undo()
			if err != nil {
				return fmt.Errorf("failed to set maxprocs: %v", err)
			}

			if err := config.Validate(conf); err != nil {
				return fmt.Errorf("invalid configuration: %v", err)
			}
			log.Tracef("Kiali Configuration:\n%s", conf)

			restConf, err := ctrl.GetConfig()
			if err != nil {
				return fmt.Errorf("failed to get config: %v", err)
			}

			// This is here because GetClientFactory needs the home cluster auto-detected.
			if err := istioconfig.DetermineHomeClusterName(conf, restConf); err != nil {
				return fmt.Errorf("failed to determine home cluster name: %v", err)
			}

			ctx, cancel := context.WithCancel(cmd.Context())
			defer cancel()
			clientFactory, err := kubernetes.NewClientFactory(ctx, conf, restConf)
			if err != nil {
				return fmt.Errorf("failed to create client factory: %v", err)
			}

			serverStopped := RunServer(ctx, conf, clientFactory)
			WaitForTermination(cancel)
			// This ensures that the Run process has fully cleaned itself up.
			<-serverStopped

			return nil
		},
	}
	cmd.PersistentFlags().FuncP("config", "c", "Path to the YAML configuration file. If not specified, environment variables will be used for configuration.", FileNameFlag(&argConfigFile))
	cmd.PersistentFlags().StringVarP(&logLevel, "log-level", "l", "", "Log level (trace, debug, info, warn, error, fatal). If not specified, the LOG_LEVEL environment variable will be used.")
	cmd.AddCommand(newRunCmd(conf))
	return cmd
}

func Execute() {
	rootCmd := newRootCmd()
	// TODO: This is a hack because in the Kiali deployment template in the helm chart we specify
	// the config flag with a single dash `-config` which doesn't get parsed by Cobra. We should
	// update the helm chart to use `--config` instead.
	for i := range os.Args {
		if os.Args[i] == "-config" {
			os.Args[i] = "--config"
			break
		}
	}

	if err := rootCmd.Execute(); err != nil {
		fmt.Println(err)
		os.Exit(1)
	}
}
