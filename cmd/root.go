//go:build !exclude_frontend

package cmd

import (
	"context"
	"fmt"
	"os"

	"github.com/spf13/cobra"
	"go.uber.org/automaxprocs/maxprocs"

	"github.com/kiali/kiali/config"
	istioconfig "github.com/kiali/kiali/config/istio"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/util"
)

// Identifies the build. These are set via ldflags during the build (see Makefile).
// TODO: Probably these should go in their own package.
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
	portForwardToPromFlag bool
)

func newRootCmd() *cobra.Command {
	cmd := &cobra.Command{
		// We don't really need completions.
		CompletionOptions: cobra.CompletionOptions{
			DisableDefaultCmd: true,
		},
		SilenceUsage: true,
		Use:          "kiali",
		Short:        "Kiali - the console for Istio service mesh",
		Long: `Kiali is the console for Istio service mesh.
                Complete documentation is available at http://kiali.io/docs/`,
		PersistentPreRun: func(cmd *cobra.Command, args []string) {
			log.InitializeLogger()
			util.Clock = util.RealClock{}

			// log startup information
			log.Infof("Kiali: Version: %v, Commit: %v, Go: %v", version, commitHash, goVersion)
		},
		RunE: func(cmd *cobra.Command, args []string) error {
			// Calling this explicitly here so that it's not set in local mode since that likely won't be running in a container.
			undo, err := maxprocs.Set()
			defer undo()
			if err != nil {
				return fmt.Errorf("failed to set maxprocs: %v", err)
			}

			conf, err := config.LoadConfig(argConfigFile)
			if err != nil {
				return fmt.Errorf("failed to load config: %v", err)
			}
			if err := config.Validate(*conf); err != nil {
				return fmt.Errorf("invalid configuration: %v", err)
			}
			log.Tracef("Kiali Configuration:\n%s", conf)

			// This is here because GetClientFactory needs the home cluster auto-detected.
			istioconfig.UpdateConfigWithIstioInfo(conf)

			clientFactory, err := kubernetes.GetClientFactory()
			if err != nil {
				return fmt.Errorf("failed to create client factory: %v", err)
			}

			ctx, cancel := context.WithCancel(context.Background())
			serverStopped := RunServer(ctx, conf, clientFactory)
			WaitForTermination(cancel)
			// This ensures that the Run process has fully cleaned itself up.
			<-serverStopped

			return nil
		},
	}
	cmd.PersistentFlags().FuncP("config", "c", "Path to the YAML configuration file. If not specified, environment variables will be used for configuration.", func(flagValue string) error {
		if _, err := os.Stat(flagValue); err != nil {
			if os.IsNotExist(err) {
				log.Debugf("Configuration file [%v] does not exist.", flagValue)
			}
		}
		argConfigFile = flagValue
		return nil
	})
	cmd.AddCommand(newLocalCmd())
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
