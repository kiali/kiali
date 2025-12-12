package business

import (
	"context"
	"crypto/x509"
	_ "embed"
	"encoding/json"
	"encoding/pem"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	osoauth_v1 "github.com/openshift/api/oauth/v1"
	"github.com/stretchr/testify/require"
	"golang.org/x/oauth2"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/rest"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
)

var (
	//go:embed testdata/ca.crt
	ca []byte
	//go:embed testdata/ca2.crt
	ca2 []byte
)

func TestSystemPoolAddedToClient(t *testing.T) {
	p, _ := pem.Decode(ca)
	caCert, err := x509.ParseCertificate(p.Bytes)
	require.NoError(t, err)
	p, _ = pem.Decode(ca2)
	caCert2, err := x509.ParseCertificate(p.Bytes)
	require.NoError(t, err)

	cases := map[string]struct {
		conf               *config.Config
		managedPoolCertPEM []byte // PEM-encoded cert to include in the managed pool via CA bundle file
		restConfig         rest.Config
		expected           []*x509.Certificate
		expectedInsecure   bool
	}{
		"cert in managed pool but not in rest config has just one cert": {
			managedPoolCertPEM: ca,
			expected:           []*x509.Certificate{caCert},
		},
		"cert in rest config but not in managed pool has just one cert": {
			restConfig: rest.Config{TLSClientConfig: rest.TLSClientConfig{CAData: ca}},
			expected:   []*x509.Certificate{caCert},
		},
		"cert in both has two certs": {
			restConfig:         rest.Config{TLSClientConfig: rest.TLSClientConfig{CAData: ca}},
			managedPoolCertPEM: ca2,
			expected:           []*x509.Certificate{caCert, caCert2},
		},
		"insecure setting has insecure set": {
			conf:               &config.Config{Auth: config.AuthConfig{OpenShift: config.OpenShiftConfig{InsecureSkipVerifyTLS: true}}},
			restConfig:         rest.Config{TLSClientConfig: rest.TLSClientConfig{CAData: ca}},
			managedPoolCertPEM: ca2,
			expected:           []*x509.Certificate{caCert}, // this will still get loaded from restconfig.
			expectedInsecure:   true,
		},
	}
	for name, tc := range cases {
		t.Run(name, func(t *testing.T) {
			require := require.New(t)

			if tc.conf == nil {
				tc.conf = config.NewConfig()
			}

			// Write the managed pool cert to a temporary file and initialize CredentialManager with it
			// This simulates the production path where CAs are loaded from kiali-cabundle ConfigMap
			var caBundlePaths []string
			if len(tc.managedPoolCertPEM) > 0 {
				tmpDir := t.TempDir()
				caFilePath := tmpDir + "/ca-bundle.pem"
				require.NoError(os.WriteFile(caFilePath, tc.managedPoolCertPEM, 0o644))
				caBundlePaths = []string{caFilePath}
			}

			// Initialize CredentialManager with the CA bundle file(s)
			tc.conf.Credentials, err = config.NewCredentialManager(caBundlePaths)
			require.NoError(err)
			t.Cleanup(tc.conf.Close)

			expected := x509.NewCertPool()
			for _, cert := range tc.expected {
				expected.AddCert(cert)
			}

			httpClient, err := httpClientWithPool(tc.conf, tc.restConfig)
			require.NoError(err)

			tr, ok := httpClient.Transport.(*http.Transport)
			require.True(ok, "Not a real http transport")
			require.NotNil(tr.TLSClientConfig)

			if tc.expectedInsecure {
				require.True(tr.TLSClientConfig.InsecureSkipVerify)
			} else {
				require.NotNil(tr.TLSClientConfig.RootCAs)
				// Verify that the expected certificates are present in the pool
				for _, cert := range tc.expected {
					subjects := tr.TLSClientConfig.RootCAs.Subjects()
					found := false
					for _, subject := range subjects {
						if string(subject) == string(cert.RawSubject) {
							found = true
							break
						}
					}
					require.True(found, "expected cert with subject %s not found in pool", cert.Subject)
				}
			}
		})
	}
}

func TestExchangeUsesSystemPoolAndRestTLS(t *testing.T) {
	require := require.New(t)
	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "Kubernetes"
	addr := ""
	server := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/.well-known/oauth-authorization-server":
			oAuthResponse := &OAuthAuthorizationServer{
				AuthorizationEndpoint: addr + "/oauth/authorize",
				Issuer:                addr,
				TokenEndpoint:         addr + "/oauth/token",
			}
			b, err := json.Marshal(oAuthResponse)
			if err != nil {
				panic("unable to marshal json response for fake oAuthMetadataServer")
			}
			_, _ = w.Write(b)
		case "/oauth/token":
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"access_token": "abc123", "expires_in": 3600, "token_type": "Bearer"}`))
		}
	}))

	addr = server.URL
	t.Cleanup(server.Close)
	oAuthClient := &osoauth_v1.OAuthClient{
		ObjectMeta: meta_v1.ObjectMeta{
			Name: "kiali-istio-system",
		},
		RedirectURIs: []string{"http://localhost:20001/kiali"},
	}
	client := kubetest.NewFakeK8sClient(oAuthClient)
	cases := map[string]struct {
		systemPoolCert *x509.Certificate
		restConfig     *rest.Config
	}{
		"system pool has server cert": {
			systemPoolCert: server.Certificate(),
		},
		"tls config has server cert": {
			restConfig: func() *rest.Config {
				server.Certificate()
				cert := pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: server.Certificate().Raw})
				return &rest.Config{TLSClientConfig: rest.TLSClientConfig{CAData: cert}}
			}(),
		},
	}
	for name, tc := range cases {
		t.Run(name, func(t *testing.T) {
			if tc.restConfig == nil {
				tc.restConfig = &rest.Config{}
			}
			tc.restConfig.Host = server.URL
			client.KubeClusterInfo = kubernetes.ClusterInfo{ClientConfig: tc.restConfig}
			clients := map[string]kubernetes.UserClientInterface{conf.KubernetesConfig.ClusterName: client}

			// Initialize CredentialManager with system pool cert if needed
			// Write the cert to a temp file and load it via CredentialManager
			var caBundlePaths []string
			if tc.systemPoolCert != nil {
				tmpDir := t.TempDir()
				caFilePath := tmpDir + "/server-ca.pem"
				certPEM := pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: tc.systemPoolCert.Raw})
				require.NoError(os.WriteFile(caFilePath, certPEM, 0o644))
				caBundlePaths = []string{caFilePath}
			}

			conf.Credentials, _ = config.NewCredentialManager(caBundlePaths)
			t.Cleanup(conf.Close)

			svc := &OpenshiftOAuthService{
				conf:           conf,
				clientFactory:  kubetest.NewFakeClientFactory(conf, clients),
				kialiSAClients: kubernetes.ConvertFromUserClients(clients),
				oAuthConfigs: map[string]*oAuthConfig{
					conf.KubernetesConfig.ClusterName: {Config: oauth2.Config{
						ClientID:    "kiali-istio-system",
						RedirectURL: oAuthClient.RedirectURIs[0],
						Scopes:      []string{userScopeFull},
						Endpoint: oauth2.Endpoint{
							AuthURL:  server.URL + "/oauth/authorize",
							TokenURL: server.URL + "/oauth/token",
						},
					}},
				},
			}

			_, err := svc.Exchange(context.Background(), "anycode", "anyverify", conf.KubernetesConfig.ClusterName)
			require.NoError(err)
		})
	}
}

// TestOpenshiftOAuth_CARotation verifies that CA rotation works during runtime
// for OpenShift OAuth. When the CA bundle file is updated, subsequent calls to
// httpClientWithPool should use the new CA.
func TestOpenshiftOAuth_CARotation(t *testing.T) {
	require := require.New(t)

	// Create temporary CA file
	tmpDir := t.TempDir()
	caFile := tmpDir + "/oauth-ca.pem"

	// Write initial CA
	p, _ := pem.Decode(ca)
	initialCACert, err := x509.ParseCertificate(p.Bytes)
	require.NoError(err)
	require.NoError(os.WriteFile(caFile, ca, 0o644))

	// Initialize config with initial CA
	conf := config.NewConfig()
	conf.Credentials, err = config.NewCredentialManager([]string{caFile})
	require.NoError(err)
	t.Cleanup(conf.Close)

	// Create first client - should use initial CA
	restConfig := rest.Config{}
	client1, err := httpClientWithPool(conf, restConfig)
	require.NoError(err)

	tr1 := client1.Transport.(*http.Transport)
	pool1 := tr1.TLSClientConfig.RootCAs

	// Verify initial CA is in the pool
	subjects1 := pool1.Subjects()
	foundInitialCA := false
	for _, subject := range subjects1 {
		if string(subject) == string(initialCACert.RawSubject) {
			foundInitialCA = true
			break
		}
	}
	require.True(foundInitialCA, "initial CA should be in pool")

	// Rotate CA by writing a different CA to the file
	p2, _ := pem.Decode(ca2)
	rotatedCACert, err := x509.ParseCertificate(p2.Bytes)
	require.NoError(err)
	require.NoError(os.WriteFile(caFile, ca2, 0o644))

	// Wait for the file watcher to detect the change and update the cache
	// Subsequent calls to httpClientWithPool should use the rotated CA
	require.Eventually(func() bool {
		client2, err := httpClientWithPool(conf, restConfig)
		if err != nil {
			return false
		}

		tr2 := client2.Transport.(*http.Transport)
		pool2 := tr2.TLSClientConfig.RootCAs

		// Check if the rotated CA is now in the pool
		subjects2 := pool2.Subjects()
		for _, subject := range subjects2 {
			if string(subject) == string(rotatedCACert.RawSubject) {
				return true
			}
		}
		return false
	}, 2*time.Second, 50*time.Millisecond, "rotated CA should be in pool after rotation")

	// Verify the pool has changed (not equal to the original pool)
	client3, err := httpClientWithPool(conf, restConfig)
	require.NoError(err)
	tr3 := client3.Transport.(*http.Transport)
	pool3 := tr3.TLSClientConfig.RootCAs

	// The new pool should be different from the initial pool
	require.False(pool1.Equal(pool3), "pool should be different after CA rotation")
}
