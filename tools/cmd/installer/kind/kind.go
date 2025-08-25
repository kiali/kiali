package kind

import (
	"fmt"
	"net/netip"
	"os"
	"os/exec"
	"path/filepath"
	"slices"
	"strings"

	"github.com/rs/zerolog"
	"sigs.k8s.io/kind/pkg/apis/config/v1alpha4"
	"sigs.k8s.io/kind/pkg/cluster"
)

const (
	docker = "docker"
	podman = "podman"
)

// Config holds all configuration options for the kind cluster installer
type Config struct {
	registryName        string
	registryPort        string
	DockerOrPodman      string
	EnableImageRegistry bool
	Image               string
	IPFamily            string
	KeycloakCertsDir    string
	KeycloakIssuerURI   string
	LoadBalancerPrefix  netip.Prefix
	Name                string
}

func (c *Config) String() string {
	return fmt.Sprintf("DockerOrPodman: %s\nEnableImageRegistry: %t\nImage: %s\nIPFamily: %s\nKeycloakCertsDir: %s\nKeycloakIssuerURI: %s\nLoadBalancerPrefix: %s\nName: %s",
		c.DockerOrPodman, c.EnableImageRegistry, c.Image, c.IPFamily, c.KeycloakCertsDir, c.KeycloakIssuerURI, c.LoadBalancerPrefix, c.Name)
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

func (c *Cluster) kubeContext() string {
	return "kind-" + c.config.Name
}

func (c *Cluster) kubectl(args ...string) *exec.Cmd {
	return exec.Command("kubectl", append([]string{"--context", c.kubeContext()}, args...)...)
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
		EnableImageRegistry: false,
		Image:               "",
		IPFamily:            "ipv4",
		KeycloakCertsDir:    "",
		KeycloakIssuerURI:   "",
		LoadBalancerPrefix:  netip.Prefix{},
		Name:                "kiali-testing",
	}
}

func (c *Config) checkPodmanRootful() error {
	output, err := exec.Command(podman, "info", "--format", "{{.Host.Security.Rootless}}").Output()
	if err != nil {
		return fmt.Errorf("failed to check podman status: %w", err)
	}
	if strings.TrimSpace(string(output)) == "true" {
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

	if (c.KeycloakCertsDir == "") != (c.KeycloakIssuerURI == "") {
		return fmt.Errorf("keycloak-certs-dir and keycloak-issuer-uri must both be set or both be empty")
	}

	if c.KeycloakCertsDir != "" {
		if err := c.validateKeycloakCerts(); err != nil {
			return fmt.Errorf("keycloak certificate validation failed: %w", err)
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

// ClusterExists reports whether a KinD cluster with the given name exists.
func ClusterExists(name, dockerOrPodman string) (bool, error) {
	var providerOpts []cluster.ProviderOption
	if dockerOrPodman == podman {
		providerOpts = append(providerOpts, cluster.ProviderWithPodman())
	} else {
		providerOpts = append(providerOpts, cluster.ProviderWithDocker())
	}

	existing, err := cluster.NewProvider(providerOpts...).List()
	if err != nil {
		return false, fmt.Errorf("listing existing clusters: %w", err)
	}

	return slices.Contains(existing, name), nil
}

// Create creates a KinD cluster. If the cluster already exists it is left
// as-is and only the post-creation configuration (MetalLB, registry) is
// applied so the operation is idempotent.
func (c *Cluster) Create() error {
	c.log.Info().Msgf("Kind cluster to be created with config\n%s\n", c.config.String())

	var providerOpts []cluster.ProviderOption
	if c.config.DockerOrPodman == podman {
		providerOpts = append(providerOpts, cluster.ProviderWithPodman())
		c.log.Info().Msg("Configuring kind to use podman")
	} else {
		providerOpts = append(providerOpts, cluster.ProviderWithDocker())
	}

	provider := cluster.NewProvider(providerOpts...)

	existing, err := provider.List()
	if err != nil {
		return fmt.Errorf("listing existing clusters: %w", err)
	}

	alreadyExists := false
	for _, name := range existing {
		if name == c.config.Name {
			alreadyExists = true
			break
		}
	}

	if alreadyExists {
		c.log.Info().Msgf("Cluster '%s' already exists, skipping creation", c.config.Name)
	} else {
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

		if c.config.KeycloakCertsDir != "" {
			c.addKeycloakConfig(clusterConfig)
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
	}

	if c.config.EnableImageRegistry {
		if err := c.finishImageRegistryConfig(); err != nil {
			return fmt.Errorf("failed to finish image registry configuration: %w", err)
		}
	}

	c.log.Info().Msgf("Kind cluster '%s' created successfully", c.config.Name)
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

// addImageRegistryConfig adds image registry configuration to the cluster
func (c *Cluster) addImageRegistryConfig(clusterConfig *v1alpha4.Cluster) {
	containerdPatch := `[plugins."io.containerd.grpc.v1.cri".registry]
  config_path = "/etc/containerd/certs.d"`

	clusterConfig.ContainerdConfigPatches = append(clusterConfig.ContainerdConfigPatches, containerdPatch)
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

	c.log.Info().Msg("Removing existing running registry container")

	if output, err := exec.Command(c.config.DockerOrPodman, "kill", c.config.registryName).CombinedOutput(); err != nil {
		c.log.Warn().Msgf("failed to kill image registry daemon: %s: %s", err, output)
	}

	if output, err := exec.Command(c.config.DockerOrPodman, "rm", c.config.registryName).CombinedOutput(); err != nil {
		c.log.Warn().Msgf("failed to remove image registry daemon: %s: %s", err, output)
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

	cmd = c.kubectl("apply", "-f", "-")
	cmd.Stdin = strings.NewReader(configMapManifest)
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("failed to create registry ConfigMap: %w", err)
	}

	return nil
}
