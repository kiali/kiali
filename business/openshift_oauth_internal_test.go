package business

import (
	"context"
	"crypto/x509"
	_ "embed"
	"encoding/json"
	"encoding/pem"
	"net/http"
	"net/http/httptest"
	"testing"

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
		conf             *config.Config
		restConfig       rest.Config
		pool             []*x509.Certificate
		expected         []*x509.Certificate
		expectedInsecure bool
	}{
		"cert in pool but not in rest config has just one cert": {
			pool:     []*x509.Certificate{caCert},
			expected: []*x509.Certificate{caCert},
		},
		"cert in rest config but not in pool has just one cert": {
			restConfig: rest.Config{TLSClientConfig: rest.TLSClientConfig{CAData: ca}},
			expected:   []*x509.Certificate{caCert},
		},
		"cert in both has two certs": {
			restConfig: rest.Config{TLSClientConfig: rest.TLSClientConfig{CAData: ca}},
			pool:       []*x509.Certificate{caCert2},
			expected:   []*x509.Certificate{caCert, caCert2},
		},
		"insecure setting has insecure set": {
			conf:             &config.Config{Auth: config.AuthConfig{OpenShift: config.OpenShiftConfig{InsecureSkipVerifyTLS: true}}},
			restConfig:       rest.Config{TLSClientConfig: rest.TLSClientConfig{CAData: ca}},
			pool:             []*x509.Certificate{caCert2},
			expected:         []*x509.Certificate{caCert}, // this will still get loaded from restconfig.
			expectedInsecure: true,
		},
	}
	for name, tc := range cases {
		t.Run(name, func(t *testing.T) {
			require := require.New(t)

			if tc.conf == nil {
				tc.conf = config.NewConfig()
			}

			expected := x509.NewCertPool()
			for _, cert := range tc.expected {
				expected.AddCert(cert)
			}

			pool := x509.NewCertPool()
			for _, cert := range tc.pool {
				pool.AddCert(cert)
			}

			httpClient, err := httpClientWithPool(tc.conf, tc.restConfig, pool)
			require.NoError(err)

			tr, ok := httpClient.Transport.(*http.Transport)
			require.True(ok, "Not a real http transport")
			require.NotNil(tr.TLSClientConfig)
			require.NotNil(tr.TLSClientConfig.RootCAs)
			require.True(tr.TLSClientConfig.RootCAs.Equal(expected), "cert pools not equal")
			require.Equal(tc.expectedInsecure, tr.TLSClientConfig.InsecureSkipVerify)
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
				certPool: x509.NewCertPool(),
			}
			if tc.systemPoolCert != nil {
				svc.certPool.AddCert(tc.systemPoolCert)
			}

			_, err := svc.Exchange(context.Background(), "anycode", "anyverify", conf.KubernetesConfig.ClusterName)
			require.NoError(err)
		})
	}
}
