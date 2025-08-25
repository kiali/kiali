package main

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"

	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/tools/cmd/installer/kind"
)

func main() {
	config := kind.NewConfig()

	rootCmd := &cobra.Command{
		Use:   "installer",
		Short: "KinD cluster installer for Kiali testing",
		Long: `This tool creates a KinD cluster with MetalLB load balancer for testing Kiali.
It's a Go implementation of the hack/start-kind.sh script.`,
		RunE: func(cmd *cobra.Command, args []string) error {
			log.InitializeLogger(log.WithColor())

			cluster, err := kind.NewCluster(config, log.Logger())
			if err != nil {
				return err
			}

			if err := cluster.Create(); err != nil {
				return err
			}

			return nil
		},
	}

	rootCmd.Flags().BoolVar(&config.EnableHydra, "enable-hydra", config.EnableHydra, "If true, the KinD cluster will be configured to use Hydra for authentication. Cannot be used with --enable-keycloak")
	rootCmd.Flags().StringVar(&config.HydraCertsDir, "hydra-certs-dir", config.HydraCertsDir, "Directory where the Hydra certificates are stored")
	rootCmd.Flags().StringVar(&config.HydraIssuerURI, "hydra-issuer-uri", config.HydraIssuerURI, "The Hydra issuer URI")
	rootCmd.Flags().StringVar(&config.DockerOrPodman, "docker-or-podman", config.DockerOrPodman, "What to use when running kind (docker|podman)")
	rootCmd.Flags().BoolVar(&config.EnableKeycloak, "enable-keycloak", config.EnableKeycloak, "If true, the KinD cluster will be configured to use Keycloak for authentication")
	rootCmd.Flags().BoolVar(&config.EnableImageRegistry, "enable-image-registry", config.EnableImageRegistry, "If true, an external image registry will be started")
	rootCmd.Flags().StringVarP(&config.Image, "image", "i", config.Image, "Image of the kind cluster")
	rootCmd.Flags().StringVar(&config.IPFamily, "ip-family", config.IPFamily, "IP family: 'ipv4' or 'dual'")
	rootCmd.Flags().StringVar(&config.KeycloakCertsDir, "keycloak-certs-dir", config.KeycloakCertsDir, "Directory where the keycloak certs are stored")
	rootCmd.Flags().StringVar(&config.KeycloakIssuerURI, "keycloak-issuer-uri", config.KeycloakIssuerURI, "The Keycloak issuer URI")
	rootCmd.Flags().StringVar(&config.LoadBalancerRange, "load-balancer-range", config.LoadBalancerRange, "Range for the metallb load balancer")
	rootCmd.Flags().StringVarP(&config.Name, "name", "n", config.Name, "Name of the kind cluster")

	if err := rootCmd.Execute(); err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}
}
