package kiali

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/rs/zerolog"
	"k8s.io/apimachinery/pkg/util/wait"

	"github.com/kiali/kiali/tools/cmd/installer/command"
	pathutil "github.com/kiali/kiali/util/path"
)

func kubectl(ctx string, args ...string) *command.Cmd {
	return command.Command("kubectl", append([]string{"--context", ctx}, args...)...)
}

const defaultHelmRepo = "https://kiali.org/helm-charts"

// Config holds the parameters for deploying Kiali in a multi-primary setup.
type Config struct {
	EastContext      string
	WestContext      string
	KeycloakIP       string
	KeycloakCertsDir string
	HelmChartPath    string
	Dorp             string
}

// helmChartArgs returns the arguments to append to a helm command for
// referencing the chart. When HelmChartPath is set it returns the local
// path; otherwise it returns flags to pull from the default repo.
func (cfg Config) helmChartArgs() []string {
	if cfg.HelmChartPath != "" {
		return []string{cfg.HelmChartPath}
	}
	return []string{"--repo", defaultHelmRepo, "kiali-server"}
}

// PushImage builds the Kiali dev image and loads it into the east kind cluster.
// It only needs the cluster to exist and can run in parallel with other setup
// steps. The result must be collected before helmInstall.
func PushImage(cfg Config, logger *zerolog.Logger) error {
	logger.Info().Msg("Pushing Kiali dev image to east cluster")
	return command.Command("make",
		"-e", "DORP="+cfg.Dorp,
		"-e", "CLUSTER_TYPE=kind",
		"-e", "KIND_NAME=east",
		"cluster-push-kiali",
	).WithDir(pathutil.ProjectRoot).WithEnv("GOFLAGS=").Run()
}

// Deploy installs Kiali on the east cluster configured for multi-primary with
// openid auth against Keycloak. It creates the remote cluster secret so Kiali
// can access the west cluster and installs via Helm. Call PushImage before
// this to ensure the dev image is available.
func Deploy(cfg Config, logger *zerolog.Logger) error {
	// Create OIDC pre-requisites.
	logger.Info().Msg("Creating OIDC pre-requisites")
	if err := createOIDCPrereqs(cfg, logger); err != nil {
		return err
	}

	// Create the remote cluster secret so Kiali on east can access west.
	logger.Info().Msg("Creating Kiali remote cluster secret for west")
	if err := createRemoteClusterSecret(cfg, logger); err != nil {
		return fmt.Errorf("creating remote cluster secret: %w", err)
	}

	// Helm install.
	logger.Info().Msg("Installing Kiali via Helm")
	if err := helmInstall(cfg, logger); err != nil {
		return fmt.Errorf("helm install: %w", err)
	}

	// Wait for the LoadBalancer to get an external IP.
	if err := kubectl(cfg.EastContext,
		"wait", "--for=jsonpath={.status.loadBalancer.ingress}",
		"-n", "istio-system", "service/kiali",
	).Run(); err != nil {
		return fmt.Errorf("waiting for kiali LB: %w", err)
	}

	return nil
}

// WaitForHealthy polls Kiali's healthz endpoint until it responds with 200 OK
// or the timeout expires. On timeout it dumps the Kiali pod logs for debugging.
func WaitForHealthy(ctx context.Context, kubeContext string, logger *zerolog.Logger) error {
	kialiIP, err := command.Command("kubectl", "--context", kubeContext,
		"-n", "istio-system", "get", "svc", "kiali",
		"-o", "jsonpath={.status.loadBalancer.ingress[0].ip}",
	).Output()
	if err != nil {
		return fmt.Errorf("getting kiali LB IP: %w", err)
	}

	healthURL := fmt.Sprintf("http://%s/kiali/healthz", strings.TrimSpace(kialiIP))
	logger.Info().Msgf("Waiting for Kiali server to respond to health checks at %s", healthURL)

	httpClient := &http.Client{Timeout: 5 * time.Second}

	err = wait.PollUntilContextTimeout(ctx, time.Second, 60*time.Second, true, func(ctx context.Context) (bool, error) {
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, healthURL, nil)
		if err != nil {
			return false, err
		}
		resp, err := httpClient.Do(req)
		if err != nil {
			return false, nil
		}
		resp.Body.Close()
		return resp.StatusCode == http.StatusOK, nil
	})
	if err != nil {
		logger.Error().Msg("Timed out waiting for Kiali server health check, dumping pod logs")
		_ = kubectl(kubeContext, "logs", "-l", "app=kiali", "-n", "istio-system").Run()
		return fmt.Errorf("waiting for Kiali server at %s: %w", healthURL, err)
	}

	logger.Info().Msg("Kiali server is healthy")
	return nil
}

// ConfigureKeycloakRealm creates the Keycloak realm, test users, and RBAC
// bindings. Must be called after both Keycloak and Kiali are ready.
func ConfigureKeycloakRealm(cfg Config, logger *zerolog.Logger) error {
	logger.Info().Msg("Configuring Keycloak realm and test users")

	// Get the Kiali LB IP for the redirect URI.
	kialiIP, err := command.Command("kubectl", "--context", cfg.EastContext,
		"-n", "istio-system", "get", "svc", "kiali",
		"-o", "jsonpath={.status.loadBalancer.ingress[0].ip}",
	).Output()
	if err != nil {
		return fmt.Errorf("getting kiali LB IP: %w", err)
	}
	kialiIP = strings.TrimSpace(kialiIP)

	// Get an admin token from keycloak.
	token, err := getKeycloakAdminToken(cfg.KeycloakIP)
	if err != nil {
		return err
	}

	// Import the realm with the redirect URI pointing at Kiali.
	realmTemplate := filepath.Join(pathutil.ProjectRoot, "hack", "istio", "multicluster", "realm-export-template.json")
	realmJSON, err := os.ReadFile(realmTemplate)
	if err != nil {
		return fmt.Errorf("reading realm template: %w", err)
	}

	// Patch the redirect URI for the "kube" client.
	redirectURI := fmt.Sprintf("http://%s/kiali/*", kialiIP)
	patched, err := patchRedirectURI(string(realmJSON), redirectURI)
	if err != nil {
		return fmt.Errorf("patching realm redirect URI: %w", err)
	}

	if err := curlKeycloak(cfg.KeycloakIP, token, "POST", "/admin/realms", patched); err != nil {
		return fmt.Errorf("creating keycloak realm: %w", err)
	}

	// Create test users.
	for _, user := range []string{"kiali", "bookinfouser"} {
		userJSON := fmt.Sprintf(`{"username": %q, "enabled": true, "credentials": [{"type": "password", "value": "kiali"}]}`, user)
		if err := curlKeycloak(cfg.KeycloakIP, token, "POST", "/admin/realms/kube/users", userJSON); err != nil {
			return fmt.Errorf("creating user %s: %w", user, err)
		}
	}

	// Create testing RBAC on both clusters.
	if err := createTestingRBAC(cfg, logger); err != nil {
		return fmt.Errorf("creating testing RBAC: %w", err)
	}

	logger.Info().Msg("Keycloak realm and RBAC configured")
	return nil
}

func createOIDCPrereqs(cfg Config, logger *zerolog.Logger) error {
	rootCA := filepath.Join(cfg.KeycloakCertsDir, "root-ca.pem")

	// ConfigMap with the Keycloak CA cert.
	caCertData, err := os.ReadFile(rootCA)
	if err != nil {
		return fmt.Errorf("reading keycloak CA cert: %w", err)
	}
	indented := strings.ReplaceAll(strings.TrimRight(string(caCertData), "\n"), "\n", "\n    ")
	cmYAML := fmt.Sprintf(`apiVersion: v1
kind: ConfigMap
metadata:
  name: kiali-cabundle
  namespace: istio-system
data:
  openid-server-ca.crt: |
    %s`, indented)
	if err := command.ServerSideApply(cfg.EastContext, cmYAML); err != nil {
		return fmt.Errorf("applying kiali-cabundle configmap: %w", err)
	}

	// Secret with the OIDC client secret.
	secretYAML := `apiVersion: v1
kind: Secret
metadata:
  name: kiali
  namespace: istio-system
type: Opaque
stringData:
  oidc-secret: kube-client-secret`
	if err := command.ServerSideApply(cfg.EastContext, secretYAML); err != nil {
		return fmt.Errorf("applying kiali oidc secret: %w", err)
	}

	// ClusterRoleBinding for the kiali oidc user.
	crbYAML := `apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: kiali-user-viewer
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: kiali-viewer
subjects:
- apiGroup: rbac.authorization.k8s.io
  kind: User
  name: oidc:kiali`
	if err := command.ServerSideApply(cfg.EastContext, crbYAML); err != nil {
		return fmt.Errorf("applying kiali-user-viewer clusterrolebinding: %w", err)
	}

	return nil
}

func createRemoteClusterSecret(cfg Config, logger *zerolog.Logger) error {
	// Create SA, ClusterRole, and token on the west cluster using helm template.
	logger.Info().Msg("Creating remote access resources on west cluster")

	args := []string{"template",
		"--namespace", "istio-system",
		"--set", "deployment.remote_cluster_resources_only=true",
		"--set", "deployment.instance_name=kiali-remote-access",
		"--set", "deployment.cluster_wide_access=true",
		"--set", "deployment.view_only_mode=false",
		"--set", "auth.strategy=anonymous",
		"kiali-server",
	}
	args = append(args, cfg.helmChartArgs()...)
	helmOutput, err := command.Command("helm", args...).Output()
	if err != nil {
		return fmt.Errorf("helm template for remote resources: %w", err)
	}

	if err := kubectl(cfg.WestContext, "apply", "-f", "-").
		WithInput(strings.NewReader(helmOutput)).Run(); err != nil {
		return fmt.Errorf("applying remote resources on west: %w", err)
	}

	// Create SA token secret on west.
	tokenSecret := `apiVersion: v1
kind: Secret
metadata:
  name: kiali-remote-access
  namespace: istio-system
  annotations:
    kubernetes.io/service-account.name: kiali-remote-access
type: kubernetes.io/service-account-token`

	if err := kubectl(cfg.WestContext, "apply", "-f", "-").
		WithInput(strings.NewReader(tokenSecret)).Run(); err != nil {
		return fmt.Errorf("creating SA token secret on west: %w", err)
	}

	// Wait for the token to be populated.
	var encodedToken string
	for range 12 {
		out, _ := command.Command("kubectl", "--context", cfg.WestContext,
			"get", "secret", "kiali-remote-access",
			"-n", "istio-system",
			"-o", "jsonpath={.data.token}",
		).Output()
		out = strings.TrimSpace(out)
		if out != "" {
			encodedToken = out
			break
		}
		time.Sleep(5 * time.Second)
	}
	if encodedToken == "" {
		return fmt.Errorf("timed out waiting for SA token on west cluster")
	}

	tokenBytes, err := base64.StdEncoding.DecodeString(encodedToken)
	if err != nil {
		return fmt.Errorf("decoding SA token: %w", err)
	}
	token := string(tokenBytes)

	// Get the west control-plane IP and CA data.
	westIP, err := command.Command(cfg.Dorp, "inspect",
		"west-control-plane",
		"--format", "{{ .NetworkSettings.Networks.kind.IPAddress }}",
	).Output()
	if err != nil {
		return fmt.Errorf("getting west control-plane IP: %w", err)
	}
	westIP = strings.TrimSpace(westIP)

	caData, err := command.Command("kubectl", "--context", cfg.WestContext,
		"config", "view", "--raw",
		"-o", "jsonpath={.clusters[?(@.name==\"kind-west\")].cluster.certificate-authority-data}",
	).Output()
	if err != nil {
		return fmt.Errorf("getting west CA data: %w", err)
	}
	caData = strings.TrimSpace(caData)

	// Create the kiali remote cluster secret on east.
	secret := fmt.Sprintf(`apiVersion: v1
kind: Secret
metadata:
  name: kiali-remote-cluster-secret-west
  namespace: istio-system
  labels:
    kiali.io/multiCluster: "true"
  annotations:
    kiali.io/cluster: west
stringData:
  west: |
    apiVersion: v1
    kind: Config
    preferences: {}
    current-context: west
    contexts:
    - name: west
      context:
        cluster: west
        user: west
    users:
    - name: west
      user:
        token: %s
    clusters:
    - name: west
      cluster:
        server: https://%s:6443
        certificate-authority-data: %s
`, token, westIP, caData)

	return kubectl(cfg.EastContext, "apply", "-f", "-").
		WithInput(strings.NewReader(secret)).Run()
}

func helmInstall(cfg Config, logger *zerolog.Logger) error {
	issuerURI := fmt.Sprintf("https://%s/realms/kube", cfg.KeycloakIP)

	installArgs := []string{
		"upgrade", "--install",
		"--kube-context", cfg.EastContext,
		"--namespace", "istio-system",
		"--wait", "--timeout", "10m",
		// Auth
		"--set", "auth.strategy=openid",
		"--set", "auth.openid.client_id=kube",
		"--set-string", "auth.openid.issuer_uri=" + issuerURI,
		"--set", "auth.openid.insecure_skip_verify_tls=false",
		"--set", "auth.openid.username_claim=preferred_username",
		// Dev image
		"--set", "deployment.image_pull_policy=Never",
		"--set", "deployment.image_name=localhost/kiali/kiali",
		"--set", "deployment.image_version=dev",
		"--set", "deployment.logger.log_level=trace",
		"--set", "deployment.service_type=LoadBalancer",
		// Cluster identity
		"--set", "kubernetes_config.cluster_name=east",
		// External services
		"--set", "external_services.tracing.enabled=true",
		"--set", "external_services.grafana.external_url=http://grafana.istio-system:3000",
		"--set", "external_services.tracing.external_url=http://tracing.istio-system/jaeger",
		// CI config
		"--set", "external_services.grafana.dashboards[0].name=Istio Mesh Dashboard",
		"--set", "external_services.istio.validation_reconcile_interval=5s",
		"--set", "health_config.rate[0].kind=service",
		"--set", "health_config.rate[0].name=y-server",
		"--set", "health_config.rate[0].namespace=alpha",
		"--set", "health_config.rate[0].tolerance[0].code=5xx",
		"--set", "health_config.rate[0].tolerance[0].degraded=2",
		"--set", "health_config.rate[0].tolerance[0].failure=100",
		"--set", "kiali_internal.cache_expiration.gateway=2m",
		"--set", "kiali_internal.cache_expiration.istio_status=0",
		"--set", "kiali_internal.cache_expiration.mesh=10s",
		"--set", "kiali_internal.cache_expiration.waypoint=2m",
		"--set", "kiali_internal.graph_cache.enabled=false",
		// Service port
		"--set", "server.port=80",
		// Release name and chart
		"kiali-server",
	}
	installArgs = append(installArgs, cfg.helmChartArgs()...)

	return command.Command("helm", installArgs...).Run()
}

func getKeycloakAdminToken(keycloakIP string) (string, error) {
	out, err := command.Command("curl", "-sk",
		"-X", "POST",
		fmt.Sprintf("https://%s/realms/master/protocol/openid-connect/token", keycloakIP),
		"-d", "grant_type=password",
		"-d", "client_id=admin-cli",
		"-d", "username=admin",
		"-d", "password=admin",
		"-d", "scope=openid",
		"-d", "response_type=id_token",
	).Output()
	if err != nil {
		return "", fmt.Errorf("getting keycloak admin token: %w", err)
	}

	// Extract access_token from JSON — avoid jq dependency.
	// Response looks like: {"access_token":"...","...}
	const prefix = `"access_token":"`
	idx := strings.Index(out, prefix)
	if idx == -1 {
		return "", fmt.Errorf("access_token not found in keycloak response: %.200s", out)
	}
	start := idx + len(prefix)
	end := strings.Index(out[start:], `"`)
	if end == -1 {
		return "", fmt.Errorf("malformed keycloak token response")
	}
	return out[start : start+end], nil
}

func curlKeycloak(keycloakIP, token, method, path, body string) error {
	url := fmt.Sprintf("https://%s%s", keycloakIP, path)
	return command.Command("curl", "-sk",
		"-X", method,
		"-H", "Authorization: Bearer "+token,
		"-H", "Content-Type: application/json",
		"-d", body,
		url,
	).Run()
}

// patchRedirectURI sets the redirectUris for the "kube" client in the realm JSON.
func patchRedirectURI(realmJSON, redirectURI string) (string, error) {
	var realm map[string]any
	if err := json.Unmarshal([]byte(realmJSON), &realm); err != nil {
		return "", fmt.Errorf("parsing realm JSON: %w", err)
	}

	clients, _ := realm["clients"].([]any)
	for _, c := range clients {
		client, _ := c.(map[string]any)
		if client["clientId"] == "kube" {
			client["redirectUris"] = []string{redirectURI}
			break
		}
	}

	out, err := json.Marshal(realm)
	if err != nil {
		return "", fmt.Errorf("marshaling realm JSON: %w", err)
	}
	return string(out), nil
}

func createTestingRBAC(cfg Config, logger *zerolog.Logger) error {
	// Create a role with write permissions for the testing user using helm template.
	rbacArgs := []string{"template",
		"--show-only", "templates/role.yaml",
		"--set", "deployment.instance_name=kiali-testing-user",
		"--set", "auth.strategy=anonymous",
		"kiali-server",
	}
	rbacArgs = append(rbacArgs, cfg.helmChartArgs()...)
	roleYAML, err := command.Command("helm", rbacArgs...).Output()
	if err != nil {
		return fmt.Errorf("helm template for testing role: %w", err)
	}

	// Apply the role on both clusters.
	for _, ctx := range []string{cfg.EastContext, cfg.WestContext} {
		if err := kubectl(ctx, "apply", "-f", "-").
			WithInput(strings.NewReader(roleYAML)).Run(); err != nil {
			return fmt.Errorf("applying testing role on %s: %w", ctx, err)
		}
	}

	// Create ClusterRoleBindings for the oidc:kiali user on both clusters.
	binding := `apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: kiali-testing-user
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: kiali-testing-user
subjects:
- apiGroup: rbac.authorization.k8s.io
  kind: User
  name: oidc:kiali`

	for _, ctx := range []string{cfg.EastContext, cfg.WestContext} {
		if err := kubectl(ctx, "apply", "-f", "-").
			WithInput(strings.NewReader(binding)).Run(); err != nil {
			return fmt.Errorf("applying testing rolebinding on %s: %w", ctx, err)
		}
	}

	// Create bookinfo RoleBinding for bookinfouser on east (if bookinfo namespace exists).
	out, _ := command.Command("kubectl", "--context", cfg.EastContext,
		"get", "namespace", "bookinfo", "--no-headers",
	).Output()
	if strings.TrimSpace(out) != "" {
		roleBindingFile := filepath.Join(pathutil.ProjectRoot, "hack", "istio", "multicluster", "roleBookinfo.yaml")
		_ = kubectl(cfg.EastContext, "apply", "-f", roleBindingFile).Run()

		bookinfoBinding := `apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: kiali-bookinfo
  namespace: bookinfo
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: Role
  name: kiali-bookinfo
subjects:
- kind: User
  name: oidc:bookinfouser`

		_ = kubectl(cfg.EastContext, "apply", "-f", "-").
			WithInput(strings.NewReader(bookinfoBinding)).Run()
	}

	return nil
}
