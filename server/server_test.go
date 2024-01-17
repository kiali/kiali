package server

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"fmt"
	"io"
	"math/big"
	rnd "math/rand"
	"net"
	"net/http"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/config/security"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/cache"
	"github.com/kiali/kiali/util"
)

const (
	testHostname = "127.0.0.1"
)

var tmpDir = os.TempDir()

func TestRootContextPath(t *testing.T) {
	oldWd, _ := os.Getwd()
	defer func() { _ = os.Chdir(oldWd) }()
	_ = os.Chdir(os.TempDir())
	_ = os.MkdirAll("./console", 0o777)
	_, _ = os.Create("./console/index.html")

	testPort, err := getFreePort(testHostname)
	if err != nil {
		t.Fatalf("Cannot get a free port to run tests on host [%v], err [%s]", testHostname, err)
	} else {
		t.Logf("Will use free port [%v] on host [%v] for tests", testPort, testHostname)
	}

	testServerHostPort := fmt.Sprintf("%v:%v", testHostname, testPort)
	testCustomRoot := "/customroot"

	rnd.New(rnd.NewSource(time.Now().UnixNano()))
	conf := new(config.Config)
	conf.LoginToken.SigningKey = util.RandomString(10)
	conf.Server.WebRoot = testCustomRoot
	conf.Server.Address = testHostname
	conf.Server.Port = testPort
	conf.Server.StaticContentRootDirectory = tmpDir
	conf.Auth.Strategy = "anonymous"

	serverURL := fmt.Sprintf("http://%v", testServerHostPort)

	config.Set(conf)

	cf := kubernetes.NewTestingClientFactory(t)
	cpm := &business.FakeControlPlaneMonitor{}
	cache := cache.NewTestingCacheWithFactory(t, cf, *conf)
	server := NewServer(cpm, cf, cache, conf, nil, nil)
	server.Start()
	t.Logf("Started test http server: %v", serverURL)
	defer func() {
		server.Stop()
		t.Logf("Stopped test server: %v", serverURL)
	}()

	// the client
	httpConfig := httpClientConfig{}
	httpClient, err := httpConfig.buildHTTPClient()
	if err != nil {
		t.Fatalf("Failed to create http client")
	}

	// no credentials
	noCredentials := &security.Credentials{}

	// wait for our test http server to come up
	checkHTTPReady(httpClient, serverURL)

	// we should be able to get to our custom web root
	if _, err = getRequestResults(t, httpClient, serverURL+testCustomRoot, noCredentials); err != nil {
		t.Fatalf("Failed: Shouldn't have failed going to the web root: %v", err)
	}

	// we should be able to get to "/" root - this just forwards to our custom web root
	if _, err = getRequestResults(t, httpClient, serverURL, noCredentials); err != nil {
		t.Fatalf("Failed: Shouldn't have failed going to / root: %v", err)
	}

	// sanity check - make sure we cannot get to a bogus context path
	if _, err = getRequestResults(t, httpClient, serverURL+"/badroot", noCredentials); err == nil {
		t.Fatalf("Failed: Should have failed going to /badroot")
	}
}

func TestAnonymousMode(t *testing.T) {
	testPort, err := getFreePort(testHostname)
	if err != nil {
		t.Fatalf("Cannot get a free port to run tests on host [%v]", testHostname)
	} else {
		t.Logf("Will use free port [%v] on host [%v] for tests", testPort, testHostname)
	}

	testServerHostPort := fmt.Sprintf("%v:%v", testHostname, testPort)

	conf := new(config.Config)
	conf.Server.Address = testHostname
	conf.Server.Port = testPort
	conf.Server.StaticContentRootDirectory = tmpDir
	conf.Auth.Strategy = "anonymous"

	serverURL := fmt.Sprintf("http://%v", testServerHostPort)
	apiURLWithAuthentication := serverURL + "/api/authenticate"
	apiURL := serverURL + "/api"

	assert.False(t, conf.IsServerHTTPS())

	config.Set(conf)

	cf := kubernetes.NewTestingClientFactory(t)
	cpm := &business.FakeControlPlaneMonitor{}
	cache := cache.NewTestingCacheWithFactory(t, cf, *conf)
	server := NewServer(cpm, cf, cache, conf, nil, nil)
	server.Start()
	t.Logf("Started test http server: %v", serverURL)
	defer func() {
		server.Stop()
		t.Logf("Stopped test server: %v", serverURL)
	}()

	// the client
	httpConfig := httpClientConfig{}
	httpClient, err := httpConfig.buildHTTPClient()
	if err != nil {
		t.Fatalf("Failed to create http client")
	}

	// no credentials
	noCredentials := &security.Credentials{}

	// wait for our test http server to come up
	checkHTTPReady(httpClient, serverURL+"/status")

	// TEST WITH NO USER

	if _, err = getRequestResults(t, httpClient, apiURLWithAuthentication, noCredentials); err != nil {
		t.Fatalf("Failed: Basic Auth API URL shouldn't have failed with no credentials: %v", err)
	}

	if _, err = getRequestResults(t, httpClient, apiURL, noCredentials); err != nil {
		t.Fatalf("Failed: Basic API URL shouldn't have failed with no credentials: %v", err)
	}
}

func TestSecureComm(t *testing.T) {
	testPort, err := getFreePort(testHostname)
	if err != nil {
		t.Fatalf("Cannot get a free port to run tests on host [%v]", testHostname)
	} else {
		t.Logf("Will use free port [%v] on host [%v] for tests", testPort, testHostname)
	}
	testMetricsPort, err := getFreePort(testHostname)
	if err != nil {
		t.Fatalf("Cannot get a free metrics port to run tests on host [%v]", testHostname)
	} else {
		t.Logf("Will use free metrics port [%v] on host [%v] for tests", testMetricsPort, testHostname)
	}

	testServerCertFile := tmpDir + "/server-test-server.cert"
	testServerKeyFile := tmpDir + "/server-test-server.key"
	testServerHostPort := fmt.Sprintf("%v:%v", testHostname, testPort)
	err = generateCertificate(t, testServerCertFile, testServerKeyFile, testServerHostPort)
	if err != nil {
		t.Fatalf("Failed to create server cert/key files: %v", err)
	}
	defer os.Remove(testServerCertFile)
	defer os.Remove(testServerKeyFile)

	testClientCertFile := tmpDir + "/server-test-client.cert"
	testClientKeyFile := tmpDir + "/server-test-client.key"
	testClientHost := testHostname
	err = generateCertificate(t, testClientCertFile, testClientKeyFile, testClientHost)
	if err != nil {
		t.Fatalf("Failed to create client cert/key files: %v", err)
	}
	defer os.Remove(testClientCertFile)
	defer os.Remove(testClientKeyFile)

	rnd.New(rnd.NewSource(time.Now().UnixNano()))
	conf := new(config.Config)
	conf.Identity.CertFile = testServerCertFile
	conf.Identity.PrivateKeyFile = testServerKeyFile
	conf.LoginToken.SigningKey = util.RandomString(10)
	conf.Server.Address = testHostname
	conf.Server.Port = testPort
	conf.Server.StaticContentRootDirectory = tmpDir
	conf.Server.Observability.Metrics.Enabled = true
	conf.Server.Observability.Metrics.Port = testMetricsPort
	conf.Auth.Strategy = "anonymous"
	util.Clock = util.RealClock{}

	serverURL := fmt.Sprintf("https://%v", testServerHostPort)
	apiURLWithAuthentication := serverURL + "/api/authenticate"
	apiURL := serverURL + "/api"
	metricsURL := fmt.Sprintf("http://%v:%v/", testHostname, testMetricsPort)

	assert.True(t, conf.IsServerHTTPS())

	config.Set(conf)

	cf := kubernetes.NewTestingClientFactory(t)
	cpm := &business.FakeControlPlaneMonitor{}
	cache := cache.NewTestingCacheWithFactory(t, cf, *conf)
	server := NewServer(cpm, cf, cache, conf, nil, nil)
	server.Start()
	t.Logf("Started test http server: %v", serverURL)
	defer func() {
		server.Stop()
		t.Logf("Stopped test server: %v", serverURL)
	}()

	// the client
	httpConfig := httpClientConfig{
		Identity: &security.Identity{
			CertFile:       testClientCertFile,
			PrivateKeyFile: testClientKeyFile,
		},
		TLSConfig: &tls.Config{
			InsecureSkipVerify: true,
		},
	}
	httpClient, err := httpConfig.buildHTTPClient()
	if err != nil {
		t.Fatalf("Failed to create http client")
	}

	// no credentials
	noCredentials := &security.Credentials{}

	// wait for our test http server to come up
	checkHTTPReady(httpClient, serverURL+"/status")

	// TEST WITH NO USER

	if _, err = getRequestResults(t, httpClient, apiURLWithAuthentication, noCredentials); err != nil {
		t.Fatalf("Failed: Basic Auth API URL shouldn't have failed with no credentials: %v", err)
	}

	if _, err = getRequestResults(t, httpClient, apiURL, noCredentials); err != nil {
		t.Fatalf("Failed: Basic API URL shouldn't have failed with no credentials: %v", err)
	}

	// this makes sure the Prometheus metrics endpoint can start (we made an API call above; there should be metrics)
	if s, err := getRequestResults(t, httpClient, metricsURL, noCredentials); err != nil {
		t.Fatalf("Failed: Metrics URL: %v", err)
	} else {
		// makes sure we did get the metrics endpoint
		if !strings.Contains(s, "HELP go_") || !strings.Contains(s, "TYPE go_") {
			t.Fatalf("Failed: Metrics URL returned bad results - there are no kial metrics:\n%s", s)
		}
	}

	// Make sure the server rejects anything trying to use TLS 1.1 or under
	httpConfigTLS11 := httpClientConfig{
		Identity: &security.Identity{
			CertFile:       testClientCertFile,
			PrivateKeyFile: testClientKeyFile,
		},
		TLSConfig: &tls.Config{
			InsecureSkipVerify: true,
			MinVersion:         tls.VersionTLS10,
			MaxVersion:         tls.VersionTLS11,
		},
	}
	httpClientTLS11, err := httpConfigTLS11.buildHTTPClient()
	if err != nil {
		t.Fatalf("Failed to create http client with TLS 1.1")
	}
	if _, err = getRequestResults(t, httpClientTLS11, apiURL, noCredentials); err == nil {
		t.Fatalf("Failed: Should not have been able to use TLS 1.1")
	}
}

func TestTracingConfigured(t *testing.T) {
	testPort, err := getFreePort(testHostname)
	if err != nil {
		t.Fatalf("Cannot get a free port to run tests on host [%v]", testHostname)
	} else {
		t.Logf("Will use free port [%v] on host [%v] for tests", testPort, testHostname)
	}

	testServerHostPort := fmt.Sprintf("%v:%v", testHostname, testPort)

	conf := new(config.Config)
	conf.Server.Address = testHostname
	conf.Server.Port = testPort
	conf.Server.StaticContentRootDirectory = tmpDir
	conf.Server.Observability.Tracing.Enabled = true
	conf.Server.Observability.Tracing.CollectorType = "otel"
	conf.Auth.Strategy = "anonymous"

	// Set the global client factory.
	cf := kubernetes.NewTestingClientFactory(t)
	serverURL := fmt.Sprintf("http://%v", testServerHostPort)

	config.Set(conf)

	cpm := &business.FakeControlPlaneMonitor{}
	cache := cache.NewTestingCacheWithFactory(t, cf, *conf)
	server := NewServer(cpm, cf, cache, conf, nil, nil)
	server.Start()
	t.Logf("Started test http server: %v", serverURL)
	defer func() {
		server.Stop()
		t.Logf("Stopped test server: %v", serverURL)
	}()
}

func TestConfigureGzipHandler(t *testing.T) {
	defer func() {
		err := recover()
		if err != nil {
			t.Errorf("Failed to create Gzip handler [%v]", err)
		}
	}()
	configureGzipHandler(nil)
}

func getRequestResults(t *testing.T, httpClient *http.Client, url string, credentials *security.Credentials) (string, error) {
	r, err := http.NewRequest("GET", url, nil)
	if err != nil {
		t.Fatal(err)
		return "", err
	}
	if headerName, headerValue, err := credentials.GetHTTPAuthHeader(); err != nil {
		t.Fatal(err)
		return "", err
	} else if headerName != "" {
		r.Header.Add(headerName, headerValue)
	}

	if resp, err := httpClient.Do(r); err != nil {
		return "", err
	} else {
		defer resp.Body.Close()
		if resp.StatusCode == http.StatusOK {
			bodyBytes, err2 := io.ReadAll(resp.Body)
			if err2 != nil {
				return "", err2
			}
			bodyString := string(bodyBytes)
			return bodyString, nil
		} else {
			return "", fmt.Errorf("Bad status: %v", resp.StatusCode)
		}
	}
}

func generateCertificate(t *testing.T, certPath string, keyPath string, host string) error {
	priv, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		return err
	}

	serialNumber, err := rand.Int(rand.Reader, new(big.Int).Lsh(big.NewInt(1), 128))
	if err != nil {
		return err
	}

	notBefore := time.Now()
	notAfter := notBefore.Add(365 * 24 * time.Hour)

	template := x509.Certificate{
		SerialNumber:          serialNumber,
		NotBefore:             notBefore,
		NotAfter:              notAfter,
		KeyUsage:              x509.KeyUsageKeyEncipherment | x509.KeyUsageDigitalSignature,
		ExtKeyUsage:           []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth},
		BasicConstraintsValid: true,
		Subject: pkix.Name{
			Organization: []string{"ABC Corp."},
		},
	}

	hosts := strings.Split(host, ",")
	for _, h := range hosts {
		if ip := net.ParseIP(h); ip != nil {
			template.IPAddresses = append(template.IPAddresses, ip)
		} else {
			template.DNSNames = append(template.DNSNames, h)
		}
	}

	template.IsCA = true
	template.KeyUsage |= x509.KeyUsageCertSign

	derBytes, err := x509.CreateCertificate(rand.Reader, &template, &template, &priv.PublicKey, priv)
	if err != nil {
		return err
	}

	certOut, err := os.Create(certPath)
	if err != nil {
		return err
	}
	_ = pem.Encode(certOut, &pem.Block{Type: "CERTIFICATE", Bytes: derBytes})
	certOut.Close()

	keyOut, err := os.OpenFile(keyPath, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0o600)
	if err != nil {
		return err
	}

	pemBlockForKey := &pem.Block{Type: "RSA PRIVATE KEY", Bytes: x509.MarshalPKCS1PrivateKey(priv)}
	_ = pem.Encode(keyOut, pemBlockForKey)
	keyOut.Close()

	t.Logf("Generated security data: %v|%v|%v", certPath, keyPath, host)
	return nil
}

func getFreePort(host string) (int, error) {
	addr, err := net.ResolveTCPAddr("tcp", host+":0")
	if err != nil {
		return 0, err
	}

	l, err := net.ListenTCP("tcp", addr)
	if err != nil {
		return 0, err
	}
	defer l.Close()
	return l.Addr().(*net.TCPAddr).Port, nil
}

func checkHTTPReady(httpClient *http.Client, url string) {
	for i := 0; i < 60; i++ {
		if r, err := httpClient.Get(url); err == nil {
			r.Body.Close()
			break
		} else {
			time.Sleep(time.Second)
		}
	}
}

// A generic HTTP client used to test accessing the server
type httpClientConfig struct {
	Identity      *security.Identity
	TLSConfig     *tls.Config
	HTTPTransport *http.Transport
}

func (conf *httpClientConfig) buildHTTPClient() (*http.Client, error) {
	// make our own copy of TLS config
	tlsConfig := &tls.Config{}
	if conf.TLSConfig != nil {
		tlsConfig = conf.TLSConfig
	}

	if conf.Identity != nil && conf.Identity.CertFile != "" {
		cert, err := tls.LoadX509KeyPair(conf.Identity.CertFile, conf.Identity.PrivateKeyFile)
		if err != nil {
			return nil, fmt.Errorf("Error loading the client certificates: %v", err)
		}
		tlsConfig.Certificates = append(tlsConfig.Certificates, cert)
	}

	// make our own copy of HTTP transport
	transport := &http.Transport{}
	if conf.HTTPTransport != nil {
		transport = conf.HTTPTransport
	}

	// make sure the transport has some things we know we need
	transport.TLSClientConfig = tlsConfig

	if transport.IdleConnTimeout == 0 {
		transport.IdleConnTimeout = time.Second * 600
	}
	if transport.ResponseHeaderTimeout == 0 {
		transport.ResponseHeaderTimeout = time.Second * 600
	}

	// build the http client
	httpClient := http.Client{Transport: transport}

	return &httpClient, nil
}
