package main

import (
	"fmt"
	"net/netip"
	"os"
	"path/filepath"
	"strings"

	"github.com/rs/zerolog"
	"github.com/spf13/cobra"
	"golang.org/x/sync/errgroup"

	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/tools/cmd/installer/bookinfo"
	"github.com/kiali/kiali/tools/cmd/installer/certs"
	installclient "github.com/kiali/kiali/tools/cmd/installer/client"
	"github.com/kiali/kiali/tools/cmd/installer/command"
	"github.com/kiali/kiali/tools/cmd/installer/istio"
	"github.com/kiali/kiali/tools/cmd/installer/keycloak"
	kialipkg "github.com/kiali/kiali/tools/cmd/installer/kiali"
	"github.com/kiali/kiali/tools/cmd/installer/kind"
	"github.com/kiali/kiali/tools/cmd/installer/metallb"
	pathutil "github.com/kiali/kiali/util/path"
)

var (
	dorp          string
	helmChartPath string
)

func main() {
	config := kind.NewConfig()

	rootCmd := &cobra.Command{
		Use:   "installer",
		Short: "KinD cluster installer for Kiali testing",
		Long: `This tool creates a KinD cluster with MetalLB load balancer for testing Kiali.
It's a Go implementation of the hack/start-kind.sh script.`,
		SilenceUsage: true,
		PersistentPreRun: func(cmd *cobra.Command, args []string) {
			config.DockerOrPodman = dorp
		},
		RunE: func(cmd *cobra.Command, args []string) error {
			log.InitializeLogger(log.WithColor())
			logger := log.Logger()

			cluster, err := kind.NewCluster(config, logger)
			if err != nil {
				return err
			}

			if err := cluster.Create(); err != nil {
				return err
			}

			kubeContext := "kind-" + config.Name
			return <-metallb.Deploy(kubeContext, config.LoadBalancerPrefix, config.DockerOrPodman, config.IPFamily, logger)
		},
	}

	rootCmd.PersistentFlags().StringVar(&dorp, "docker-or-podman", "docker", "Container runtime to use (docker|podman)")

	rootCmd.Flags().BoolVar(&config.EnableImageRegistry, "enable-image-registry", config.EnableImageRegistry, "If true, an external image registry will be started")
	rootCmd.Flags().StringVarP(&config.Image, "image", "i", config.Image, "Image of the kind cluster")
	rootCmd.Flags().StringVar(&config.IPFamily, "ip-family", config.IPFamily, "IP family: 'ipv4' or 'dual'")
	rootCmd.Flags().TextVar(&config.LoadBalancerPrefix, "load-balancer-prefix", config.LoadBalancerPrefix, "CIDR prefix for the metallb load balancer pool (e.g. 172.18.255.0/24)")
	rootCmd.Flags().StringVarP(&config.Name, "name", "n", config.Name, "Name of the kind cluster")

	multiPrimaryCmd := &cobra.Command{
		Use:   "multi-primary",
		Short: "Create two KinD clusters (east/west) for multi-primary testing",
		RunE:  runMultiPrimary,
	}
	multiPrimaryCmd.Flags().StringVar(&helmChartPath, "helm-chart", "", "Path to the kiali-server helm chart tarball (defaults to https://kiali.org/helm-charts)")

	rootCmd.AddCommand(multiPrimaryCmd)

	if err := rootCmd.Execute(); err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}
}

func runMultiPrimary(cmd *cobra.Command, _ []string) error {
	ctx := cmd.Context()

	log.InitializeLogger(log.WithColor())
	logger := log.Logger()

	root := pathutil.ProjectRoot

	zones := []string{"east", "west"}
	eastContext := "kind-" + zones[0]
	westContext := "kind-" + zones[1]

	// Step 0: Ensure the Docker "kind" network exists with a known subnet.
	// This must happen before cluster creation so the subnet is deterministic.
	network, err := kind.EnsureKindNetwork(dorp)
	if err != nil {
		return fmt.Errorf("ensuring kind network: %w", err)
	}
	logger.Info().Msgf("Kind network subnet prefix: %s", network.SubnetPrefix)

	lbPrefixes, err := kind.AllocateLoadBalancerPrefixes(network.SubnetPrefix, len(zones))
	if err != nil {
		return fmt.Errorf("allocating LB prefixes: %w", err)
	}
	// The first address in the first prefix is deterministic and reserved
	// for the Keycloak LoadBalancer service.
	keycloakIP := lbPrefixes[0].Addr()
	logger.Info().Msgf("Reserved Keycloak IP: %s", keycloakIP)

	// If any cluster doesn't exist, cached certs are stale because
	// the new cluster will get fresh mounts. Remove them so they are
	// regenerated below.
	keycloakCertsDir := filepath.Join("/tmp", "kiali", "keycloak-certs")
	certsDir := filepath.Join("/tmp", "kiali", "istio-multicluster-certs")

	allClustersExist := true
	for _, zone := range zones {
		exists, err := kind.ClusterExists(zone, dorp)
		if err != nil {
			return fmt.Errorf("checking cluster %s: %w", zone, err)
		}
		if !exists {
			allClustersExist = false
			break
		}
	}

	if !allClustersExist {
		logger.Info().Msg("Not all clusters exist, clearing cached certificates")
		os.RemoveAll(keycloakCertsDir)
		os.RemoveAll(certsDir)
	}

	// Step 1: Generate Keycloak CA and TLS certificates.
	// Use a stable directory so certs persist across runs — the kind
	// API server mounts the CA via hostPath at cluster creation time
	// and regenerating would break the OIDC trust chain.
	if _, err := os.Stat(filepath.Join(keycloakCertsDir, "root-ca.pem")); err != nil {
		logger.Info().Msg("Generating Keycloak certificates")
		if err := certs.CreateKeycloakCA(keycloakCertsDir); err != nil {
			return fmt.Errorf("generating keycloak CA: %w", err)
		}
		if err := certs.CreateKeycloakTLSCert(keycloakCertsDir, keycloakIP.String()); err != nil {
			return fmt.Errorf("generating keycloak TLS cert: %w", err)
		}
	} else {
		logger.Info().Msgf("Reusing existing Keycloak certificates from %s", keycloakCertsDir)
	}

	// Step 2: Create both kind clusters in parallel with Keycloak OIDC configured.
	logger.Info().Msg("Creating east and west kind clusters in parallel")

	keycloakIssuerURI := fmt.Sprintf("https://%s/realms/kube", keycloakIP)

	var clusters []*kind.Cluster
	for i, zone := range zones {
		config := kind.NewConfig()
		config.Name = zone
		config.DockerOrPodman = dorp
		config.LoadBalancerPrefix = lbPrefixes[i]
		config.KeycloakCertsDir = keycloakCertsDir
		config.KeycloakIssuerURI = keycloakIssuerURI

		cluster, err := kind.NewCluster(config, logger)
		if err != nil {
			return fmt.Errorf("%s cluster config: %w", zone, err)
		}
		clusters = append(clusters, cluster)
	}

	var g errgroup.Group
	for _, c := range clusters {
		g.Go(c.Create)
	}
	if err := g.Wait(); err != nil {
		return err
	}

	clients := make(map[string]installclient.KubeContextClient, len(zones))
	for _, zone := range zones {
		kubeContext := "kind-" + zone
		cl, err := installclient.ClientForContext(kubeContext)
		if err != nil {
			return fmt.Errorf("creating client for %s: %w", zone, err)
		}
		clients[kubeContext] = cl
	}

	kialiCfg := kialipkg.Config{
		EastContext:      eastContext,
		WestContext:      westContext,
		KeycloakIP:       keycloakIP.String(),
		KeycloakCertsDir: keycloakCertsDir,
		HelmChartPath:    helmChartPath,
		Dorp:             dorp,
	}

	if _, err := os.Stat(filepath.Join(certsDir, "root-cert.pem")); err != nil {
		logger.Info().Msg("Generating Istio CA certificates")
		if err := certs.CreateIntermediateCA(certsDir, zones); err != nil {
			return fmt.Errorf("generating CA certs: %w", err)
		}
	} else {
		logger.Info().Msgf("Reusing existing Istio CA certificates from %s", certsDir)
	}

	// Deploy MetalLB in the background on all clusters.
	// The east cluster gets a dedicated /32 pool for Keycloak to guarantee its IP.
	keycloakPool := metallb.Pool{
		Name:    "keycloak",
		Address: netip.PrefixFrom(keycloakIP, 32),
	}
	metallbDone := make([]<-chan error, len(zones))
	for i, zone := range zones {
		clusterLogger := logger.With().Str("cluster", zone).Logger()
		var extraPools []metallb.Pool
		if i == 0 {
			extraPools = append(extraPools, keycloakPool)
		}
		metallbDone[i] = metallb.Deploy("kind-"+zone, lbPrefixes[i], dorp, "ipv4", &clusterLogger, extraPools...)
	}

	// Deploy Keycloak in the background (east cluster only).
	// Keycloak waits for MetalLB east so the dedicated pool exists before the service is created.
	keycloakDone := keycloak.Deploy(ctx, clients[eastContext], eastContext, keycloakCertsDir, keycloakIP.String(), logger, metallbDone[0])

	// Per-zone setup: CA secrets, Istio install, and Istio readiness
	// run in parallel across zones. Each zone's steps are sequential internally
	// but independent of the other zone.
	g = errgroup.Group{}
	for _, zone := range zones {
		clusterLogger := logger.With().Str("cluster", zone).Logger()
		kubeContext := "kind-" + zone
		g.Go(func() error {
			if err := certs.ApplyCACertsSecret(ctx, clients[kubeContext], certsDir, zone); err != nil {
				return err
			}

			if _, err := istio.Install(ctx, kubeContext, zone, "mesh-hack", "network-"+zone, &clusterLogger); err != nil {
				return err
			}

			return istio.WaitReady(kubeContext, &clusterLogger)
		})
	}
	if err := g.Wait(); err != nil {
		return err
	}

	// Deploy gateways and enable endpoint discovery in parallel.
	// Gateways set up east-west network plumbing; remote secrets enable
	// cross-cluster service discovery — they are independent.
	logger.Info().Msg("Deploying gateways and enabling endpoint discovery")
	g = errgroup.Group{}
	g.Go(func() error {
		gatewayYAML := filepath.Join(root, "hack", "istio", "istio-gateway.yaml")
		if err := command.Command("kubectl", "--context", eastContext, "apply", "-n", "istio-system", "-f", gatewayYAML).Run(); err != nil {
			return fmt.Errorf("deploying ingress gateway: %w", err)
		}
		return deployEastWestGateways(zones, logger)
	})
	g.Go(func() error {
		return setupRemoteSecrets(zones, dorp, logger)
	})
	if err := g.Wait(); err != nil {
		return err
	}

	// metallbDone[0] (east) is already consumed by keycloak.Deploy.
	for _, ch := range metallbDone[1:] {
		if err := <-ch; err != nil {
			return fmt.Errorf("configuring metallb: %w", err)
		}
	}

	// Steps 10+11+12: Configure Prometheus federation, tracing, and bookinfo
	// in parallel. These operate on different resources and namespaces.
	logger.Info().Msg("Configuring Prometheus federation, tracing, and bookinfo")
	g = errgroup.Group{}
	g.Go(func() error {
		if err := configurePrometheusFederation(eastContext, westContext, root, logger); err != nil {
			return fmt.Errorf("configuring prometheus federation: %w", err)
		}
		return nil
	})
	g.Go(func() error {
		tracingScript := filepath.Join(root, "hack", "istio", "multicluster", "setup-tracing.sh")
		if err := command.Command(tracingScript, "--manage-kind", "true", "-dorp", dorp).Run(); err != nil {
			return fmt.Errorf("configuring tracing: %w", err)
		}
		return nil
	})
	g.Go(func() error {
		if err := bookinfo.Install(ctx, clients[eastContext], clients[westContext], logger); err != nil {
			return fmt.Errorf("installing bookinfo: %w", err)
		}
		return nil
	})
	if err := g.Wait(); err != nil {
		return err
	}

	// Build and push the Kiali dev image before deploying.
	if err := kialipkg.PushImage(kialiCfg, logger); err != nil {
		return fmt.Errorf("pushing kiali image: %w", err)
	}

	// Step 13: Deploy Kiali.
	logger.Info().Msg("Deploying Kiali")
	if err := kialipkg.Deploy(kialiCfg, logger); err != nil {
		return fmt.Errorf("deploying kiali: %w", err)
	}

	if err := <-keycloakDone; err != nil {
		return fmt.Errorf("deploying keycloak: %w", err)
	}

	// Configure Keycloak realm and test users.
	if err := kialipkg.ConfigureKeycloakRealm(kialiCfg, logger); err != nil {
		return fmt.Errorf("configuring keycloak realm: %w", err)
	}

	// Wait for the Kiali server to respond to external health checks.
	if err := kialipkg.WaitForHealthy(ctx, eastContext, logger); err != nil {
		return err
	}

	logger.Info().Msg("Multi-primary setup complete")
	return nil
}

// setupRemoteSecrets creates and exchanges remote secrets between the two clusters
// so that each cluster's Istio can discover services on the other.
// This replaces the `istioctl create-remote-secret` approach with direct kubectl operations.
func setupRemoteSecrets(zones []string, dorp string, logger *zerolog.Logger) error {
	type cluster struct {
		name    string
		context string
	}

	var clusters []cluster
	for _, zone := range zones {
		clusters = append(clusters, cluster{
			name:    zone,
			context: "kind-" + zone,
		})
	}

	for i, src := range clusters {
		dst := clusters[(i+1)%len(clusters)]
		logger.Info().Msgf("Creating remote secret for %s, applying to %s", src.name, dst.name)

		// Get the control-plane container's IP on the kind network.
		kindIP, err := command.Command(dorp, "inspect",
			src.name+"-control-plane",
			"--format", "{{ .NetworkSettings.Networks.kind.IPAddress }}",
		).Output()
		if err != nil {
			return fmt.Errorf("getting kind IP for %s: %w", src.name, err)
		}
		kindIP = strings.TrimSpace(kindIP)

		// Create a service account token for the remote reader.
		token, err := command.Command("kubectl", "--context", src.context,
			"create", "token", "istio-reader-service-account",
			"-n", "istio-system",
			"--duration", "87600h",
		).Output()
		if err != nil {
			return fmt.Errorf("creating token for %s: %w", src.name, err)
		}
		token = strings.TrimSpace(token)

		// Get the CA data from the kubeconfig.
		caData, err := command.Command("kubectl", "--context", src.context,
			"config", "view", "--raw",
			"-o", "jsonpath={.clusters[?(@.name==\"kind-"+src.name+"\")].cluster.certificate-authority-data}",
		).Output()
		if err != nil {
			return fmt.Errorf("getting CA data for %s: %w", src.name, err)
		}
		caData = strings.TrimSpace(caData)

		// Build the remote secret YAML.
		secret := fmt.Sprintf(`apiVersion: v1
kind: Secret
metadata:
  name: istio-remote-secret-%s
  namespace: istio-system
  annotations:
    networking.istio.io/cluster: %s
  labels:
    istio/multiCluster: "true"
type: Opaque
stringData:
  %s: |
    apiVersion: v1
    kind: Config
    clusters:
    - cluster:
        certificate-authority-data: %s
        server: https://%s:6443
      name: %s
    contexts:
    - context:
        cluster: %s
        user: %s
      name: %s
    current-context: %s
    users:
    - name: %s
      user:
        token: %s
`, src.name, src.name,
			src.name,
			caData, kindIP, src.name,
			src.name, src.name, src.name,
			src.name,
			src.name, token)

		// Apply the secret to the destination cluster.
		if err := command.Command("kubectl", "--context", dst.context, "apply", "-f", "-").
			WithInput(strings.NewReader(secret)).Run(); err != nil {
			return fmt.Errorf("applying remote secret for %s to %s: %w", src.name, dst.name, err)
		}
	}

	return nil
}

func configurePrometheusFederation(eastContext, westContext, root string, logger *zerolog.Logger) error {
	if err := command.Command("kubectl", "--context", westContext,
		"patch", "svc", "prometheus", "-n", "istio-system",
		"-p", `{"spec": {"type": "LoadBalancer"}}`).Run(); err != nil {
		return err
	}

	if err := command.Command("kubectl", "--context", westContext,
		"wait", "--for=jsonpath={.status.loadBalancer.ingress}", "-n", "istio-system", "service/prometheus").Run(); err != nil {
		return err
	}

	westPromIP, err := command.Command("kubectl", "--context", westContext,
		"-n", "istio-system",
		"get", "svc", "prometheus",
		"-o", "jsonpath={.status.loadBalancer.ingress[0].ip}").Output()
	if err != nil {
		return err
	}
	westPromIP = strings.TrimSpace(westPromIP)
	if westPromIP == "" {
		logger.Warn().Msg("Could not determine west prometheus LB IP, skipping federation")
		return nil
	}

	logger.Info().Msgf("West Prometheus address: %s", westPromIP)

	promYAML := filepath.Join(root, "hack", "istio", "multicluster", "prometheus.yaml")
	promContent, err := os.ReadFile(promYAML)
	if err != nil {
		return fmt.Errorf("reading prometheus.yaml: %w", err)
	}

	patched := strings.ReplaceAll(string(promContent), "WEST_PROMETHEUS_ADDRESS", westPromIP)

	return command.Command("kubectl", "--context", eastContext, "apply", "-n", "istio-system", "-f", "-").
		WithInput(strings.NewReader(patched)).
		Run()
}

func deployEastWestGateways(zones []string, logger *zerolog.Logger) error {
	exposeServicesYAML := filepath.Join(pathutil.ProjectRoot,
		"_output", "istio-1.29.2", "samples", "multicluster", "expose-services.yaml")

	var g errgroup.Group
	for _, zone := range zones {
		ctx := "kind-" + zone
		network := "network-" + zone
		g.Go(func() error {
			logger.Info().Msgf("Deploying east-west gateway on %s", zone)

			gwYAML := fmt.Sprintf(`apiVersion: v1
kind: ServiceAccount
metadata:
  name: istio-eastwestgateway
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: istio-eastwestgateway
  labels:
    app: istio-eastwestgateway
spec:
  selector:
    matchLabels:
      istio: eastwestgateway
  template:
    metadata:
      annotations:
        inject.istio.io/templates: gateway
      labels:
        app: istio-eastwestgateway
        istio: eastwestgateway
        sidecar.istio.io/inject: "true"
        topology.istio.io/network: %[1]s
    spec:
      containers:
      - name: istio-proxy
        image: auto
        env:
        - name: ISTIO_META_REQUESTED_NETWORK_VIEW
          value: %[1]s
      serviceAccountName: istio-eastwestgateway
---
apiVersion: v1
kind: Service
metadata:
  name: istio-eastwestgateway
  labels:
    app: istio-eastwestgateway
    topology.istio.io/network: %[1]s
spec:
  type: LoadBalancer
  selector:
    istio: eastwestgateway
  ports:
  - name: status-port
    port: 15021
    targetPort: 15021
  - name: tls
    port: 15443
    targetPort: 15443
  - name: tls-istiod
    port: 15012
    targetPort: 15012
  - name: tls-webhook
    port: 15017
    targetPort: 15017
`, network)

			if err := command.Command("kubectl", "--context", ctx,
				"apply", "-n", "istio-system", "-f", "-").
				WithInput(strings.NewReader(gwYAML)).Run(); err != nil {
				return fmt.Errorf("deploying east-west gateway on %s: %w", zone, err)
			}

			if err := command.Command("kubectl", "--context", ctx,
				"apply", "-n", "istio-system", "-f", exposeServicesYAML).Run(); err != nil {
				return fmt.Errorf("applying expose-services on %s: %w", zone, err)
			}

			return nil
		})
	}
	return g.Wait()
}
