package kind

import (
	"encoding/json"
	"fmt"
	"net/netip"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/rs/zerolog"
	"sigs.k8s.io/kind/pkg/apis/config/v1alpha4"
	"sigs.k8s.io/kind/pkg/cluster"
)

const (
	docker = "docker"
	podman = "podman"
)

// Subnet represents a network subnet with its CIDR and gateway information
type Subnet struct {
	CIDR    netip.Prefix
	Gateway netip.Addr
}

// Config holds all configuration options for the kind cluster installer
type Config struct {
	registryName        string
	registryPort        string
	DockerOrPodman      string
	EnableHydra         bool
	EnableKeycloak      bool
	EnableImageRegistry bool
	HydraCertsDir       string
	HydraIssuerURI      string
	Image               string
	IPFamily            string
	KeycloakCertsDir    string
	KeycloakIssuerURI   string
	LoadBalancerRange   string
	Name                string
}

func (c *Config) String() string {
	// Each field separate by a new line
	return fmt.Sprintf("DockerOrPodman: %s\nEnableHydra: %t\nEnableKeycloak: %t\nEnableImageRegistry: %t\nHydraCertsDir: %s\nHydraIssuerURI: %s\nImage: %s\nIPFamily: %s\nKeycloakCertsDir: %s\nKeycloakIssuerURI: %s\nLoadBalancerRange: %s\nName: %s",
		c.DockerOrPodman, c.EnableHydra, c.EnableKeycloak, c.EnableImageRegistry, c.HydraCertsDir, c.HydraIssuerURI, c.Image, c.IPFamily, c.KeycloakCertsDir, c.KeycloakIssuerURI, c.LoadBalancerRange, c.Name)
}

// Cluster represents a kind cluster with its configuration and operations
type Cluster struct {
	config *Config
	log    *zerolog.Logger
}

// NewCluster creates a new Cluster with the given configuration
func NewCluster(config *Config, logger *zerolog.Logger) (*Cluster, error) {
	log := logger.With().Str("cluster", config.Name).Logger()

	if err := config.Validate(); err != nil {
		return nil, err
	}

	return &Cluster{
		config: config,
		log:    &log,
	}, nil
}

// NewConfig creates a new configuration with default values
func NewConfig() *Config {
	registryName := os.Getenv("KIND_IMAGE_REGISTRY_NAME")
	if registryName == "" {
		registryName = "kind-registry"
	}
	registryPort := os.Getenv("KIND_IMAGE_REGISTRY_PORT")
	if registryPort == "" {
		registryPort = "5000"
	}
	return &Config{
		registryName:        registryName,
		registryPort:        registryPort,
		DockerOrPodman:      docker,
		EnableHydra:         false,
		EnableKeycloak:      false,
		EnableImageRegistry: false,
		HydraCertsDir:       "",
		HydraIssuerURI:      "",
		Image:               "",
		IPFamily:            "ipv4",
		KeycloakCertsDir:    "",
		KeycloakIssuerURI:   "",
		LoadBalancerRange:   "255.70-255.84",
		Name:                "kiali-testing",
	}
}

// checkPodmanRootful verifies that podman is running in rootful mode
func (c *Config) checkPodmanRootful() error {
	cmd := exec.Command(podman, "info", "--format", "{{.Host.Security.Rootless}}")
	output, err := cmd.Output()
	if err != nil {
		return fmt.Errorf("failed to check podman status: %w", err)
	}

	rootless := strings.TrimSpace(string(output))
	if rootless == "true" {
		return fmt.Errorf("podman is running in rootless mode, but rootful mode is required for kind clusters. Please run as root/sudo or configure rootful podman")
	}

	return nil
}

// Validate checks the configuration for consistency and required values
func (c *Config) Validate() error {
	if c.DockerOrPodman != docker && c.DockerOrPodman != podman {
		return fmt.Errorf("docker-or-podman must be 'docker' or 'podman', got: %s", c.DockerOrPodman)
	}

	if c.DockerOrPodman == podman {
		if err := c.checkPodmanRootful(); err != nil {
			return err
		}
	}

	if c.IPFamily != "ipv4" && c.IPFamily != "dual" {
		return fmt.Errorf("ip-family must be 'ipv4' or 'dual', got: %s", c.IPFamily)
	}

	if c.EnableKeycloak && c.EnableHydra {
		return fmt.Errorf("cannot enable both Keycloak and Hydra. Please choose only one")
	}

	if c.EnableKeycloak {
		if c.KeycloakCertsDir == "" {
			return fmt.Errorf("you must specify the directory where the Keycloak certs are stored with the --keycloak-certs-dir option when keycloak is enabled")
		}
		if c.KeycloakIssuerURI == "" {
			return fmt.Errorf("you must specify the Keycloak issuer URI with the --keycloak-issuer-uri option when keycloak is enabled")
		}

		// Validate that the certificate directory exists and contains required files
		if err := c.validateKeycloakCerts(); err != nil {
			return fmt.Errorf("keycloak certificate validation failed: %w", err)
		}
	}

	if c.EnableHydra {
		if c.HydraCertsDir == "" {
			return fmt.Errorf("you must specify the directory where the Hydra certs are stored with the --hydra-certs-dir option when Hydra is enabled")
		}
		if c.HydraIssuerURI == "" {
			return fmt.Errorf("you must specify the Hydra issuer URI with the --hydra-issuer-uri option when Hydra is enabled")
		}

		// Validate that the certificate directory exists and contains required files
		if err := c.validateHydraCerts(); err != nil {
			return fmt.Errorf("hydra certificate validation failed: %w", err)
		}
	}

	return nil
}

// validateKeycloakCerts validates that required Keycloak certificates exist
func (c *Config) validateKeycloakCerts() error {
	if _, err := os.Stat(c.KeycloakCertsDir); os.IsNotExist(err) {
		return fmt.Errorf("keycloak certificates directory does not exist: %s", c.KeycloakCertsDir)
	}

	rootCAPath := filepath.Join(c.KeycloakCertsDir, "root-ca.pem")
	if _, err := os.Stat(rootCAPath); os.IsNotExist(err) {
		return fmt.Errorf("required root-ca.pem certificate not found in: %s", c.KeycloakCertsDir)
	}

	return nil
}

// validateHydraCerts validates that required Hydra certificates exist
func (c *Config) validateHydraCerts() error {
	if _, err := os.Stat(c.HydraCertsDir); os.IsNotExist(err) {
		return fmt.Errorf("hydra certificates directory does not exist: %s", c.HydraCertsDir)
	}

	hydraCAPath := filepath.Join(c.HydraCertsDir, "hydra-ca.pem")
	if _, err := os.Stat(hydraCAPath); os.IsNotExist(err) {
		return fmt.Errorf("required hydra-ca.pem certificate not found in: %s", c.HydraCertsDir)
	}

	return nil
}

// Create creates a KinD cluster.
func (c *Cluster) Create() error {
	c.log.Info().Msgf("Kind cluster to be created with config\n%s\n", c.config.String())

	var providerOpts []cluster.ProviderOption
	if c.config.DockerOrPodman == podman {
		providerOpts = append(providerOpts, cluster.ProviderWithPodman())
		c.log.Info().Msg("Configuring kind to use rootful podman")
	} else {
		providerOpts = append(providerOpts, cluster.ProviderWithDocker())
	}

	provider := cluster.NewProvider(providerOpts...)

	clusterConfig := &v1alpha4.Cluster{
		TypeMeta: v1alpha4.TypeMeta{
			Kind:       "Cluster",
			APIVersion: "kind.x-k8s.io/v1alpha4",
		},
		Networking: v1alpha4.Networking{
			IPFamily: v1alpha4.ClusterIPFamily(c.config.IPFamily),
		},
		Nodes: []v1alpha4.Node{
			{
				Image: c.config.Image,
				Role:  v1alpha4.ControlPlaneRole,
			},
			{
				Image: c.config.Image,
				Role:  v1alpha4.WorkerRole,
			},
		},
	}

	if c.config.EnableKeycloak {
		c.addKeycloakConfig(clusterConfig)
	}

	if c.config.EnableHydra {
		c.addHydraConfig(clusterConfig)
	}

	if c.config.EnableImageRegistry {
		c.addImageRegistryConfig(clusterConfig)
	}

	if c.config.EnableImageRegistry {
		if err := c.startImageRegistryDaemon(); err != nil {
			return fmt.Errorf("failed to start image registry daemon: %w", err)
		}
	} else {
		c.killImageRegistryDaemon()
	}

	createOpts := []cluster.CreateOption{
		cluster.CreateWithV1Alpha4Config(clusterConfig),
	}

	c.log.Info().Msg("Creating cluster...")
	if err := provider.Create(c.config.Name, createOpts...); err != nil {
		return fmt.Errorf("failed to create cluster: %w", err)
	}

	c.log.Info().Msgf("Cluster '%s' created successfully", c.config.Name)

	if err := c.configureMetalLB(); err != nil {
		return fmt.Errorf("failed to configure MetalLB: %w", err)
	}

	if c.config.EnableImageRegistry {
		if err := c.finishImageRegistryConfig(); err != nil {
			return fmt.Errorf("failed to finish image registry configuration: %w", err)
		}
	}

	c.log.Info().Msgf("Kind cluster '%s' created successfully with MetalLB load balancer", c.config.Name)
	if c.config.EnableImageRegistry {
		c.log.Info().Msgf("The Kind cluster's image registry is named [%s] and is accessible at [localhost:%s]", c.config.registryName, c.config.registryPort)
	}

	return nil
}

// addKeycloakConfig adds Keycloak OIDC configuration to the cluster
func (c *Cluster) addKeycloakConfig(clusterConfig *v1alpha4.Cluster) {
	c.log.Info().Msg("Configuring Keycloak OIDC authentication")
	c.log.Info().Msgf("Keycloak issuer URI: %s", c.config.KeycloakIssuerURI)

	kubeadmPatch := `kind: ClusterConfiguration
apiServer:
  extraArgs:
    oidc-client-id: kube
    oidc-issuer-url: ` + c.config.KeycloakIssuerURI + `
    oidc-groups-claim: groups
    oidc-username-prefix: "oidc:"
    oidc-groups-prefix: "oidc:"
    oidc-username-claim: preferred_username
    oidc-ca-file: /etc/ca-certificates/keycloak/root-ca.pem`

	clusterConfig.KubeadmConfigPatches = append(clusterConfig.KubeadmConfigPatches, kubeadmPatch)

	certPath := filepath.Join(c.config.KeycloakCertsDir, "root-ca.pem")
	mount := v1alpha4.Mount{
		HostPath:      certPath,
		ContainerPath: "/etc/ca-certificates/keycloak/root-ca.pem",
		Readonly:      true,
	}

	if len(clusterConfig.Nodes) > 0 {
		clusterConfig.Nodes[0].ExtraMounts = append(clusterConfig.Nodes[0].ExtraMounts, mount)
		c.log.Info().Msgf("Mounting Keycloak CA certificate: %s -> /etc/ca-certificates/keycloak/root-ca.pem", certPath)
	}
}

// addHydraConfig adds Hydra OIDC configuration to the cluster
func (c *Cluster) addHydraConfig(clusterConfig *v1alpha4.Cluster) {
	c.log.Info().Msg("Configuring Hydra OIDC authentication")
	c.log.Info().Msgf("Hydra issuer URI: %s", c.config.HydraIssuerURI)

	kubeadmPatch := `kind: ClusterConfiguration
apiServer:
  extraArgs:
    oidc-client-id: kiali-app
    oidc-issuer-url: ` + c.config.HydraIssuerURI + `
    oidc-groups-claim: groups
    oidc-username-claim: email
    oidc-ca-file: /etc/ca-certificates/hydra/hydra-ca.pem`

	clusterConfig.KubeadmConfigPatches = append(clusterConfig.KubeadmConfigPatches, kubeadmPatch)

	certPath := filepath.Join(c.config.HydraCertsDir, "hydra-ca.pem")
	mount := v1alpha4.Mount{
		HostPath:      certPath,
		ContainerPath: "/etc/ca-certificates/hydra/hydra-ca.pem",
		Readonly:      true,
	}

	if len(clusterConfig.Nodes) > 0 {
		clusterConfig.Nodes[0].ExtraMounts = append(clusterConfig.Nodes[0].ExtraMounts, mount)
		c.log.Info().Msgf("Mounting Hydra CA certificate: %s -> /etc/ca-certificates/hydra/hydra-ca.pem", certPath)
	}
}

// addImageRegistryConfig adds image registry configuration to the cluster
func (c *Cluster) addImageRegistryConfig(clusterConfig *v1alpha4.Cluster) {
	containerdPatch := `[plugins."io.containerd.grpc.v1.cri".registry]
  config_path = "/etc/containerd/certs.d"`

	clusterConfig.ContainerdConfigPatches = append(clusterConfig.ContainerdConfigPatches, containerdPatch)
}

// configureMetalLB installs and configures MetalLB load balancer
func (c *Cluster) configureMetalLB() error {
	c.log.Info().Msg("Creating Kind LoadBalancer via MetalLB")

	cmd := exec.Command("kubectl", "apply", "-f", "https://raw.githubusercontent.com/metallb/metallb/v0.13.10/config/manifests/metallb-native.yaml")
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("failed to apply MetalLB manifests: %w", err)
	}

	subnets, err := c.detectNetworkSubnets()
	if err != nil {
		return fmt.Errorf("failed to detect network subnets: %w", err)
	}

	var subnet *Subnet
	for _, sub := range subnets {
		if c.config.IPFamily == "ipv4" {
			if sub.CIDR.Addr().Is4() {
				subnet = &sub
				break
			}
		} else {
			if sub.CIDR.Addr().Is6() {
				subnet = &sub
				break
			}
		}
	}

	if subnet == nil {
		return fmt.Errorf("no subnet found for MetalLB configuration")
	}

	c.log.Info().Msg("Wait for MetalLB controller to be ready")

	cmd = exec.Command("kubectl", "rollout", "status", "deployment", "controller", "-n", "metallb-system")
	if output, err := cmd.CombinedOutput(); err != nil {
		c.log.Error().Msgf("MetalLB controller rollout failed: %s", string(output))
		return err
	}

	cmd = exec.Command("kubectl", "rollout", "status", "daemonset", "speaker", "-n", "metallb-system")
	if output, err := cmd.CombinedOutput(); err != nil {
		c.log.Error().Msgf("MetalLB speaker rollout failed: %s", string(output))
		return err
	}

	if err := c.configureMetalLBPool(subnet.CIDR.String()); err != nil {
		return fmt.Errorf("failed to configure MetalLB pool: %w", err)
	}

	return nil
}

// detectNetworkSubnets detects the Docker/Podman network subnets for MetalLB configuration
func (c *Cluster) detectNetworkSubnets() ([]Subnet, error) {
	c.log.Info().Msg("Detecting network subnets")
	var (
		output  []byte
		err     error
		subnets []Subnet
	)

	switch c.config.DockerOrPodman {
	case docker:
		output, err = exec.Command("docker", "network", "inspect", "kind").Output()
		if err != nil {
			return nil, fmt.Errorf("failed to inspect docker network: %w", err)
		}

		var dockerNetworks []struct {
			IPAM struct {
				Config []struct {
					Subnet  string `json:"Subnet"`
					Gateway string `json:"Gateway"`
				} `json:"Config"`
			} `json:"IPAM"`
		}

		if err := json.Unmarshal(output, &dockerNetworks); err != nil {
			return nil, fmt.Errorf("failed to parse docker network JSON: %w", err)
		}

		if len(dockerNetworks) == 0 {
			return nil, fmt.Errorf("no docker network found")
		}

		for _, config := range dockerNetworks[0].IPAM.Config {
			cidr, err := netip.ParsePrefix(config.Subnet)
			if err != nil {
				c.log.Warn().Msgf("Failed to parse subnet %s: %v", config.Subnet, err)
				continue
			}

			gateway, err := netip.ParseAddr(config.Gateway)
			if err != nil {
				c.log.Warn().Msgf("Failed to parse gateway %s: %v", config.Gateway, err)
				continue
			}

			subnets = append(subnets, Subnet{
				CIDR:    cidr,
				Gateway: gateway,
			})
		}

	case podman:
		output, err = exec.Command("podman", "network", "inspect", "kind").Output()
		if err != nil {
			return nil, fmt.Errorf("failed to inspect podman network: %w", err)
		}

		var podmanNetworks []struct {
			Subnets []struct {
				Subnet  string `json:"subnet"`
				Gateway string `json:"gateway"`
			} `json:"subnets"`
		}

		if err := json.Unmarshal(output, &podmanNetworks); err != nil {
			return nil, fmt.Errorf("failed to parse podman network JSON: %w", err)
		}

		if len(podmanNetworks) == 0 {
			return nil, fmt.Errorf("no podman network found")
		}

		for _, subnetInfo := range podmanNetworks[0].Subnets {
			cidr, err := netip.ParsePrefix(subnetInfo.Subnet)
			if err != nil {
				c.log.Warn().Msgf("Failed to parse subnet %s: %v", subnetInfo.Subnet, err)
				continue
			}

			gateway, err := netip.ParseAddr(subnetInfo.Gateway)
			if err != nil {
				c.log.Warn().Msgf("Failed to parse gateway %s: %v", subnetInfo.Gateway, err)
				continue
			}

			subnets = append(subnets, Subnet{
				CIDR:    cidr,
				Gateway: gateway,
			})
		}
	}

	if len(subnets) == 0 {
		return nil, fmt.Errorf("no valid subnets found")
	}

	for i, subnet := range subnets {
		c.log.Info().Msgf("Detected subnet %d: %s (gateway: %s)", i+1, subnet.CIDR.String(), subnet.Gateway.String())
	}

	return subnets, nil
}

// configureMetalLBPool creates the MetalLB IP address pool and L2Advertisement
func (c *Cluster) configureMetalLBPool(subnet string) error {
	// Extract network prefix from subnet (e.g., "172.18.0.0/16" -> "172.18")
	parts := strings.Split(subnet, ".")
	if len(parts) < 2 {
		return fmt.Errorf("invalid subnet format: %s", subnet)
	}
	subnetTrimmed := parts[0] + "." + parts[1]

	// Parse load balancer range
	rangeParts := strings.Split(c.config.LoadBalancerRange, "-")
	if len(rangeParts) != 2 {
		return fmt.Errorf("invalid load balancer range format: %s", c.config.LoadBalancerRange)
	}

	firstIP := subnetTrimmed + "." + rangeParts[0]
	lastIP := subnetTrimmed + "." + rangeParts[1]

	c.log.Info().Msgf("LoadBalancer IP Address pool: %s-%s", firstIP, lastIP)

	poolManifest := fmt.Sprintf(`apiVersion: metallb.io/v1beta1
kind: IPAddressPool
metadata:
  namespace: metallb-system
  name: config
spec:
  addresses:
  - %s-%s`, firstIP, lastIP)

	cmd := exec.Command("kubectl", "apply", "-f", "-")
	cmd.Stdin = strings.NewReader(poolManifest)
	if output, err := cmd.CombinedOutput(); err != nil {
		c.log.Error().Msgf("failed to create IPAddressPool: %s", string(output))
		return err
	}

	l2Manifest := `apiVersion: metallb.io/v1beta1
kind: L2Advertisement
metadata:
  namespace: metallb-system
  name: l2config
spec:
  ipAddressPools:
  - config`

	cmd = exec.Command("kubectl", "apply", "-f", "-")
	cmd.Stdin = strings.NewReader(l2Manifest)
	if output, err := cmd.CombinedOutput(); err != nil {
		c.log.Error().Msgf("failed to create L2Advertisement: %s", string(output))
		return err
	}

	return nil
}

// killImageRegistryDaemon kills the image registry daemon container
func (c *Cluster) killImageRegistryDaemon() {
	// err is set if the container is not running
	// so assume that if output is returned then the container is running
	output, _ := exec.Command(c.config.DockerOrPodman, "inspect", "-f", "{{.State.Running}}", c.config.registryName).Output()
	if strings.TrimSpace(string(output)) != "true" {
		c.log.Info().Msg("An image registry daemon is not running")
		return
	}

	c.log.Info().Msg("Removing existing stopped registry container")

	if output, err := exec.Command(c.config.DockerOrPodman, "kill", c.config.registryName).CombinedOutput(); err != nil {
		c.log.Info().Msgf("failed to kill image registry daemon: %s: %s", err, output)
	}

	if output, err := exec.Command(c.config.DockerOrPodman, "rm", c.config.registryName).CombinedOutput(); err != nil {
		c.log.Info().Msgf("failed to remove image registry daemon: %s: %s", err, output)
	}
}

// startImageRegistryDaemon starts the image registry daemon container
func (c *Cluster) startImageRegistryDaemon() error {
	c.log.Info().Msg("Starting image registry daemon")

	// err is set if the container is not running
	// so assume that if output is returned then the container is running
	output, _ := exec.Command(c.config.DockerOrPodman, "inspect", "-f", "{{.State.Running}}", c.config.registryName).Output()
	if strings.TrimSpace(string(output)) == "true" {
		c.log.Info().Msg("An image registry daemon appears to already be running; this existing daemon will be used.")
		return nil
	}

	// Kill and remove existing registry if it exists but not running
	c.killImageRegistryDaemon()

	disableIPv6 := "1"
	if c.config.IPFamily == "dual" {
		disableIPv6 = "0"
	}

	args := []string{
		"run",
		"--sysctl=net.ipv6.conf.all.disable_ipv6=" + disableIPv6,
		"-d",
		"--restart=always",
		"-p", "127.0.0.1:" + c.config.registryPort + ":5000",
		"--name", c.config.registryName,
		"--network", "bridge",
		"registry:2",
	}

	cmd := exec.Command(c.config.DockerOrPodman, args...)
	if output, err := cmd.CombinedOutput(); err != nil {
		c.log.Error().Msgf("failed to start registry container: %s", string(output))
		return err
	}

	c.log.Info().Msg("An image registry daemon has started.")
	c.log.Info().Msgf("To kill this image registry daemon, run: %s kill %s && %s rm %s",
		c.config.DockerOrPodman, c.config.registryName, c.config.DockerOrPodman, c.config.registryName)

	return nil
}

// finishImageRegistryConfig completes the image registry setup
func (c *Cluster) finishImageRegistryConfig() error {
	regDir := fmt.Sprintf("/etc/containerd/certs.d/localhost:%s", c.config.registryPort)

	cmd := exec.Command("kind", "get", "nodes", "--name", c.config.Name)
	output, err := cmd.Output()
	if err != nil {
		return fmt.Errorf("failed to get cluster nodes: %w", err)
	}

	nodes := strings.Fields(strings.TrimSpace(string(output)))
	for _, node := range nodes {
		cmd = exec.Command(c.config.DockerOrPodman, "exec", node, "mkdir", "-p", regDir)
		if err := cmd.Run(); err != nil {
			return fmt.Errorf("failed to create registry dir in node %s: %w", node, err)
		}

		hostsConfig := fmt.Sprintf(`[host."http://%s:5000"]`, c.config.registryName)
		cmd = exec.Command(c.config.DockerOrPodman, "exec", "-i", node, "cp", "/dev/stdin", regDir+"/hosts.toml")
		cmd.Stdin = strings.NewReader(hostsConfig)
		if err := cmd.Run(); err != nil {
			return fmt.Errorf("failed to create hosts.toml in node %s: %w", node, err)
		}
	}

	cmd = exec.Command(c.config.DockerOrPodman, "inspect", "-f", "{{json .NetworkSettings.Networks.kind}}", c.config.registryName)
	output, err = cmd.Output()
	if err != nil {
		return fmt.Errorf("failed to inspect registry container: %w", err)
	}

	if strings.TrimSpace(string(output)) == "null" {
		cmd = exec.Command(c.config.DockerOrPodman, "network", "connect", "kind", c.config.registryName)
		if err := cmd.Run(); err != nil {
			return fmt.Errorf("failed to connect registry to kind network: %w", err)
		}
	}

	configMapManifest := fmt.Sprintf(`apiVersion: v1
kind: ConfigMap
metadata:
  name: local-registry-hosting
  namespace: kube-public
data:
  localRegistryHosting.v1: |
    host: "localhost:%s"
    help: "https://kind.sigs.k8s.io/docs/user/local-registry/"`, c.config.registryPort)

	cmd = exec.Command("kubectl", "apply", "-f", "-")
	cmd.Stdin = strings.NewReader(configMapManifest)
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("failed to create registry ConfigMap: %w", err)
	}

	return nil
}
