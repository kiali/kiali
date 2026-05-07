// Adapted from https://github.com/istio-ecosystem/sail-operator/blob/main/tests/e2e/util/certs/certs.go
package certs

import (
	"bytes"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
)

func shell(command string) error {
	cmd := exec.Command("sh", "-c", command)
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("%s: %s", command, stderr.String())
	}
	return nil
}

// CreateIntermediateCA generates a root CA and intermediate certs for each zone.
func CreateIntermediateCA(certsDir string, zones []string) error {
	if err := os.MkdirAll(certsDir, 0o755); err != nil {
		return fmt.Errorf("creating certs directory: %w", err)
	}

	if err := writeRootCAConf(certsDir); err != nil {
		return err
	}

	rootKey := filepath.Join(certsDir, "root-key.pem")
	rootCSR := filepath.Join(certsDir, "root-cert.csr")
	rootConf := filepath.Join(certsDir, "root-ca.conf")
	rootCert := filepath.Join(certsDir, "root-cert.pem")

	if err := shell(fmt.Sprintf("openssl genrsa -out %s 4096", rootKey)); err != nil {
		return fmt.Errorf("generating root key: %w", err)
	}
	if err := shell(fmt.Sprintf("openssl req -sha256 -new -key %s -config %s -out %s", rootKey, rootConf, rootCSR)); err != nil {
		return fmt.Errorf("generating root CSR: %w", err)
	}
	if err := shell(fmt.Sprintf("openssl x509 -req -sha256 -days 3650 -signkey %s -extensions req_ext -extfile %s -in %s -out %s",
		rootKey, rootConf, rootCSR, rootCert)); err != nil {
		return fmt.Errorf("generating root cert: %w", err)
	}

	for _, zone := range zones {
		zoneDir := filepath.Join(certsDir, zone)
		if err := os.MkdirAll(zoneDir, 0o755); err != nil {
			return fmt.Errorf("creating %s directory: %w", zone, err)
		}
		if err := writeIntermediateCAConf(zoneDir); err != nil {
			return err
		}
		if err := generateIntermediateCerts(zoneDir, rootCert, rootKey); err != nil {
			return fmt.Errorf("generating %s intermediate certs: %w", zone, err)
		}
	}

	return nil
}

func generateIntermediateCerts(dir, rootCert, rootKey string) error {
	caKey := filepath.Join(dir, "ca-key.pem")
	caCSR := filepath.Join(dir, "ca-cert.csr")
	caConf := filepath.Join(dir, "ca.conf")
	caCert := filepath.Join(dir, "ca-cert.pem")
	certChain := filepath.Join(dir, "cert-chain.pem")

	if err := shell(fmt.Sprintf("openssl genrsa -out %s 4096", caKey)); err != nil {
		return fmt.Errorf("generating intermediate key: %w", err)
	}
	if err := shell(fmt.Sprintf("openssl req -sha256 -new -config %s -key %s -out %s", caConf, caKey, caCSR)); err != nil {
		return fmt.Errorf("generating intermediate CSR: %w", err)
	}
	if err := shell(fmt.Sprintf("openssl x509 -req -sha256 -days 3650 -CA %s -CAkey %s -CAcreateserial -extensions req_ext -extfile %s -in %s -out %s",
		rootCert, rootKey, caConf, caCSR, caCert)); err != nil {
		return fmt.Errorf("generating intermediate cert: %w", err)
	}
	if err := shell(fmt.Sprintf("cat %s %s > %s", caCert, rootCert, certChain)); err != nil {
		return fmt.Errorf("generating cert chain: %w", err)
	}

	return nil
}

// CreateKeycloakCA generates a root CA key and self-signed certificate for Keycloak OIDC.
func CreateKeycloakCA(certsDir string) error {
	if err := os.MkdirAll(certsDir, 0o755); err != nil {
		return fmt.Errorf("creating keycloak certs directory: %w", err)
	}

	rootKey := filepath.Join(certsDir, "root-ca-key.pem")
	rootCert := filepath.Join(certsDir, "root-ca.pem")

	if err := shell(fmt.Sprintf("openssl genrsa -out %s 2048", rootKey)); err != nil {
		return fmt.Errorf("generating keycloak root key: %w", err)
	}
	if err := shell(fmt.Sprintf("openssl req -x509 -new -nodes -key %s -days 3650 -sha256 -out %s -subj /CN=kube-ca",
		rootKey, rootCert)); err != nil {
		return fmt.Errorf("generating keycloak root cert: %w", err)
	}
	return nil
}

// CreateKeycloakTLSCert generates a TLS certificate for the Keycloak server,
// signed by the root CA in certsDir. The certificate includes keycloakIP as a SAN.
func CreateKeycloakTLSCert(certsDir string, keycloakIP string) error {
	reqCnf := filepath.Join(certsDir, "req.cnf")
	content := fmt.Sprintf(`[req]
req_extensions = v3_req
distinguished_name = req_distinguished_name

[req_distinguished_name]

[ v3_req ]
basicConstraints = CA:FALSE
keyUsage = nonRepudiation, digitalSignature, keyEncipherment
subjectAltName = @alt_names

[alt_names]
IP.1 = %s
`, keycloakIP)
	if err := os.WriteFile(reqCnf, []byte(content), 0o644); err != nil {
		return fmt.Errorf("writing keycloak req.cnf: %w", err)
	}

	key := filepath.Join(certsDir, "key.pem")
	csr := filepath.Join(certsDir, "csr.pem")
	cert := filepath.Join(certsDir, "cert.pem")
	rootCert := filepath.Join(certsDir, "root-ca.pem")
	rootKey := filepath.Join(certsDir, "root-ca-key.pem")

	if err := shell(fmt.Sprintf("openssl genrsa -out %s 2048", key)); err != nil {
		return fmt.Errorf("generating keycloak TLS key: %w", err)
	}
	if err := shell(fmt.Sprintf("openssl req -new -key %s -out %s -subj /CN=kube-ca -sha256 -config %s",
		key, csr, reqCnf)); err != nil {
		return fmt.Errorf("generating keycloak TLS CSR: %w", err)
	}
	if err := shell(fmt.Sprintf("openssl x509 -req -in %s -CA %s -CAkey %s -CAcreateserial -sha256 -out %s -days 3650 -extensions v3_req -extfile %s",
		csr, rootCert, rootKey, cert, reqCnf)); err != nil {
		return fmt.Errorf("generating keycloak TLS cert: %w", err)
	}
	return nil
}

func writeRootCAConf(certsDir string) error {
	content := `[ req ]
encrypt_key = no
prompt = no
utf8 = yes
default_md = sha256
default_bits = 4096
req_extensions = req_ext
x509_extensions = req_ext
distinguished_name = req_dn

[ req_ext ]
subjectKeyIdentifier = hash
basicConstraints = critical, CA:true
keyUsage = critical, digitalSignature, nonRepudiation, keyEncipherment, keyCertSign

[ req_dn ]
O = Istio
CN = Root CA
`
	return os.WriteFile(filepath.Join(certsDir, "root-ca.conf"), []byte(content), 0o644)
}

func writeIntermediateCAConf(zoneDir string) error {
	content := fmt.Sprintf(`[ req ]
encrypt_key = no
prompt = no
utf8 = yes
default_md = sha256
default_bits = 4096
req_extensions = req_ext
x509_extensions = req_ext
distinguished_name = req_dn

[ req_ext ]
subjectKeyIdentifier = hash
basicConstraints = critical, CA:true, pathlen:0
keyUsage = critical, digitalSignature, nonRepudiation, keyEncipherment, keyCertSign
subjectAltName=@san

[ san ]
DNS.1 = istiod.istio-system.svc

[ req_dn ]
O = Istio
CN = Intermediate CA
L = %s
`, filepath.Base(zoneDir))
	return os.WriteFile(filepath.Join(zoneDir, "ca.conf"), []byte(content), 0o644)
}
