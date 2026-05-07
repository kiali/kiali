package keycloak

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/rs/zerolog"
	corev1 "k8s.io/api/core/v1"
	applycorev1 "k8s.io/client-go/applyconfigurations/core/v1"
	"sigs.k8s.io/controller-runtime/pkg/client"

	"github.com/kiali/kiali/tools/cmd/installer/command"
	pathutil "github.com/kiali/kiali/util/path"
)

const version = "26.3.4"

func kubectl(kubeContext string, args ...string) *command.Cmd {
	return command.Command("kubectl", append([]string{"--context", kubeContext}, args...)...)
}

// Deploy installs Keycloak and its dependencies (PostgreSQL, operator CRDs) into the
// target cluster, then waits for it to become ready. It returns immediately with a
// channel that receives nil and closes when Keycloak is fully ready, or receives an
// error if deployment or readiness checks fail.
// metallbReady must close (or send nil) before the Keycloak LoadBalancer service
// is created, so the dedicated MetalLB pool exists in time for IP assignment.
// certsDir must contain root-ca.pem, root-ca-key.pem, cert.pem, and key.pem.
func Deploy(ctx context.Context, cl client.Client, kubeContext, certsDir, keycloakIP string, logger *zerolog.Logger, metallbReady <-chan error) <-chan error {
	ch := make(chan error, 1)
	go func() {
		defer close(ch)
		if err := deploy(ctx, cl, kubeContext, certsDir, keycloakIP, logger, metallbReady); err != nil {
			ch <- err
			return
		}
		if err := waitForReady(kubeContext, logger); err != nil {
			ch <- err
		}
	}()
	return ch
}

func deploy(ctx context.Context, cl client.Client, kubeContext, certsDir, keycloakIP string, logger *zerolog.Logger, metallbReady <-chan error) error {
	logger.Info().Msgf("Deploying Keycloak to %s (IP: %s)", kubeContext, keycloakIP)

	fieldOwner := client.FieldOwner("kiali-installer")
	forceOwnership := client.ForceOwnership

	// Ensure the keycloak namespace exists.
	ns := applycorev1.Namespace("keycloak")
	if err := cl.Apply(ctx, ns, fieldOwner, forceOwnership); err != nil {
		return fmt.Errorf("applying keycloak namespace: %w", err)
	}

	// Create TLS secret from the generated certs.
	certData, err := os.ReadFile(filepath.Join(certsDir, "cert.pem"))
	if err != nil {
		return fmt.Errorf("reading keycloak TLS cert: %w", err)
	}
	keyData, err := os.ReadFile(filepath.Join(certsDir, "key.pem"))
	if err != nil {
		return fmt.Errorf("reading keycloak TLS key: %w", err)
	}
	tlsSecret := applycorev1.Secret("keycloak-tls", "keycloak").
		WithType(corev1.SecretTypeTLS).
		WithData(map[string][]byte{
			corev1.TLSCertKey:       certData,
			corev1.TLSPrivateKeyKey: keyData,
		})
	if err := cl.Apply(ctx, tlsSecret, fieldOwner, forceOwnership); err != nil {
		return fmt.Errorf("applying keycloak TLS secret: %w", err)
	}

	// Apply keycloak operator CRDs from upstream.
	crdURLs := []string{
		fmt.Sprintf("https://raw.githubusercontent.com/keycloak/keycloak-k8s-resources/%s/kubernetes/keycloaks.k8s.keycloak.org-v1.yml", version),
		fmt.Sprintf("https://raw.githubusercontent.com/keycloak/keycloak-k8s-resources/%s/kubernetes/keycloakrealmimports.k8s.keycloak.org-v1.yml", version),
		fmt.Sprintf("https://raw.githubusercontent.com/keycloak/keycloak-k8s-resources/%s/kubernetes/kubernetes.yml", version),
	}
	for _, url := range crdURLs {
		if err := kubectl(kubeContext, "apply", "-n", "keycloak", "-f", url).Run(); err != nil {
			return fmt.Errorf("applying keycloak CRD %s: %w", url, err)
		}
	}

	// Apply static resources. Wait for MetalLB before applying the service so
	// the dedicated keycloak pool exists for IP assignment.
	keycloakDir := filepath.Join(pathutil.ProjectRoot, "hack", "keycloak")
	for _, file := range []string{"postgresql.yaml", "keycloak-secrets.yaml"} {
		if err := kubectl(kubeContext, "apply", "-n", "keycloak", "-f", filepath.Join(keycloakDir, file)).Run(); err != nil {
			return fmt.Errorf("applying %s: %w", file, err)
		}
	}

	if err := <-metallbReady; err != nil {
		return fmt.Errorf("waiting for metallb: %w", err)
	}

	svcContent, err := os.ReadFile(filepath.Join(keycloakDir, "keycloak-service.yaml"))
	if err != nil {
		return fmt.Errorf("reading keycloak-service.yaml: %w", err)
	}
	patchedSvc := strings.Replace(string(svcContent),
		"metadata:\n  name: keycloak",
		"metadata:\n  name: keycloak\n  annotations:\n    metallb.universe.tf/address-pool: keycloak",
		1)
	if err := kubectl(kubeContext, "apply", "-n", "keycloak", "-f", "-").
		WithInput(strings.NewReader(patchedSvc)).Run(); err != nil {
		return fmt.Errorf("applying keycloak-service.yaml: %w", err)
	}

	// Apply the Keycloak CR with the hostname set to the external IP.
	crPath := filepath.Join(keycloakDir, "keycloak-cr.yaml")
	crContent, err := os.ReadFile(crPath)
	if err != nil {
		return fmt.Errorf("reading keycloak CR: %w", err)
	}
	patched := strings.ReplaceAll(string(crContent), "<Replace with the external IP of the keycloak service>", keycloakIP)

	if err := kubectl(kubeContext, "apply", "-n", "keycloak", "-f", "-").
		WithInput(strings.NewReader(patched)).Run(); err != nil {
		return fmt.Errorf("applying keycloak CR: %w", err)
	}

	logger.Info().Msg("Keycloak resources applied successfully")
	return nil
}

func waitForReady(kubeContext string, logger *zerolog.Logger) error {
	logger.Info().Msg("Waiting for Keycloak to be ready (timeout 600s)")
	if err := kubectl(kubeContext,
		"wait", "--for=condition=Ready", "keycloak/keycloak",
		"-n", "keycloak", "--timeout=600s",
	).Run(); err != nil {
		return fmt.Errorf("waiting for keycloak ready: %w", err)
	}

	logger.Info().Msg("Waiting for Keycloak LoadBalancer ingress")
	if err := kubectl(kubeContext,
		"wait", "--for=jsonpath={.status.loadBalancer.ingress}",
		"-n", "keycloak", "service/keycloak", "--timeout=300s",
	).Run(); err != nil {
		return fmt.Errorf("waiting for keycloak LB ingress: %w", err)
	}

	logger.Info().Msg("Keycloak is ready")
	return nil
}
