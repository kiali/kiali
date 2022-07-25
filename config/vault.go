package config

import (
	"context"
	"fmt"
	"os"

	vault "github.com/hashicorp/vault/api"
	auth "github.com/hashicorp/vault/api/auth/kubernetes"
)

func getenv(key, fallback string) string {
	value := os.Getenv(key)
	if len(value) == 0 {
		return fallback
	}
	return value
}

// Fetches a key-value secret (kv-v2) after authenticating to Vault with a Kubernetes service account.
func getSecretFromVault(mountPath string, secretPath string) (*map[string]interface{}, error) {
	// If set, the VAULT_ADDR environment variable will be the address that
	// your pod uses to communicate with Vault.
	config := vault.DefaultConfig() // modify for more granular configuration

	client, err := vault.NewClient(config)
	if err != nil {
		return &map[string]interface{}{}, fmt.Errorf("unable to initialize Vault client: %w", err)
	}

	// The service-account token will be read from the path where the token's
	// Kubernetes Secret is mounted. By default, Kubernetes will mount it to
	// /var/run/secrets/kubernetes.io/serviceaccount/token, but an administrator
	// may have configured it to be mounted elsewhere.
	// In that case, we'll use the option WithServiceAccountTokenPath to look
	// for the token there.
	mount := getenv("MOUNT_POINT", "cai")

	k8sAuth, err := auth.NewKubernetesAuth(
		"caiobservability",
		auth.WithMountPath(mount),
		auth.WithServiceAccountTokenPath("/var/run/secrets/kubernetes.io/serviceaccount/token"),
	)

	if err != nil {
		return &map[string]interface{}{}, fmt.Errorf("unable to initialize Kubernetes auth method: %w", err)
	}

	authInfo, err := client.Auth().Login(context.Background(), k8sAuth)
	if err != nil {
		return &map[string]interface{}{}, fmt.Errorf("unable to log in with Kubernetes auth: %w", err)
	}
	if authInfo == nil {
		return &map[string]interface{}{}, fmt.Errorf("no auth info was returned after login")
	}

	// get secret from Vault, from the default mount path for KV v2 in dev mode, "secret"
	secret, err := client.KVv2(mountPath).Get(context.Background(), secretPath)
	if err != nil {
		return &map[string]interface{}{}, fmt.Errorf("unable to read secret: %w", err)
	}

	return &secret.Data, nil
}

// Fetches OIDC secret stored in Vault
func getOIDCSecretFromVault() (string, error) {

	// get data from Vault
	data, err := getSecretFromVault("isc-minerva-swb-dscw-oss-caiobservability", "oidc")
	if err != nil {
		return "", err
	}

	// data map can contain more than one key-value pair,
	// in this case we're just grabbing one of them
	value, ok := (*data)["client_id"].(string)
	if !ok {
		return "", fmt.Errorf("value type assertion failed: %T %#v", (*data)["client_id"], (*data)["client_id"])
	}

	return value, nil
}

// Fetches Prometheus Auth secret stored in Vault
func getPrometheusAuthSecretFromVault() (map[string]string, error) {

	data, err := getSecretFromVault("isc-minerva-swb-dscw-oss-prometheus", "credentials")
	if err != nil {
		return map[string]string{}, err
	}

	username, ok := (*data)["username"].(string)
	if !ok {
		return map[string]string{}, fmt.Errorf("value type assertion failed: %T %#v", (*data)["username"], (*data)["username"])
	}

	password, ok := (*data)["password"].(string)
	if !ok {
		return map[string]string{}, fmt.Errorf("value type assertion failed: %T %#v", (*data)["password"], (*data)["password"])
	}

	return map[string]string{
		"username": username,
		"password": password,
	}, nil
}
