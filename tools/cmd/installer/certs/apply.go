package certs

import (
	"context"
	"fmt"
	"os"
	"path/filepath"

	applycorev1 "k8s.io/client-go/applyconfigurations/core/v1"
	"sigs.k8s.io/controller-runtime/pkg/client"
)

// ApplyCACertsSecret creates the istio-system namespace and applies the
// cacerts secret containing the intermediate CA certificates for the given
// zone. It uses server-side apply via the controller-runtime client.
func ApplyCACertsSecret(ctx context.Context, cl client.Client, certsDir, zone string) error {
	fieldOwner := client.FieldOwner("kiali-installer")
	forceOwnership := client.ForceOwnership

	ns := applycorev1.Namespace("istio-system")
	if err := cl.Apply(ctx, ns, fieldOwner, forceOwnership); err != nil {
		return fmt.Errorf("applying istio-system namespace on %s: %w", zone, err)
	}

	caCert, err := os.ReadFile(filepath.Join(certsDir, zone, "ca-cert.pem"))
	if err != nil {
		return fmt.Errorf("reading ca-cert.pem for %s: %w", zone, err)
	}
	caKey, err := os.ReadFile(filepath.Join(certsDir, zone, "ca-key.pem"))
	if err != nil {
		return fmt.Errorf("reading ca-key.pem for %s: %w", zone, err)
	}
	rootCert, err := os.ReadFile(filepath.Join(certsDir, "root-cert.pem"))
	if err != nil {
		return fmt.Errorf("reading root-cert.pem for %s: %w", zone, err)
	}
	certChain, err := os.ReadFile(filepath.Join(certsDir, zone, "cert-chain.pem"))
	if err != nil {
		return fmt.Errorf("reading cert-chain.pem for %s: %w", zone, err)
	}

	secret := applycorev1.Secret("cacerts", "istio-system").
		WithData(map[string][]byte{
			"ca-cert.pem":    caCert,
			"ca-key.pem":     caKey,
			"cert-chain.pem": certChain,
			"root-cert.pem":  rootCert,
		})
	if err := cl.Apply(ctx, secret, fieldOwner, forceOwnership); err != nil {
		return fmt.Errorf("applying cacerts secret on %s: %w", zone, err)
	}

	return nil
}
