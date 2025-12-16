package httputil

import (
	"crypto/tls"
	"crypto/x509"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/log"
)

const DefaultTimeout = 10 * time.Second

func HttpMethods() []string {
	return []string{
		http.MethodGet, http.MethodHead, http.MethodPost, http.MethodPut, http.MethodPatch,
		http.MethodDelete, http.MethodConnect, http.MethodOptions, http.MethodTrace,
	}
}

func HttpGet(url string, auth *config.Auth, timeout time.Duration, customHeaders map[string]string, cookies []*http.Cookie, conf *config.Config) ([]byte, int, []*http.Cookie, error) {
	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return nil, 0, nil, err
	}

	for _, c := range cookies {
		req.AddCookie(c)
	}

	transport, err := CreateTransport(conf, auth, &http.Transport{}, timeout, customHeaders)
	if err != nil {
		return nil, 0, nil, err
	}

	client := http.Client{Transport: transport, Timeout: timeout}

	resp, err := client.Do(req)
	if err != nil {
		return nil, 0, nil, err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	return body, resp.StatusCode, resp.Cookies(), err
}

// HttpPost sends an HTTP Post request to the given URL and returns the response body.
func HttpPost(url string, auth *config.Auth, body io.Reader, timeout time.Duration, customHeaders map[string]string, conf *config.Config) ([]byte, int, []*http.Cookie, error) {
	req, err := http.NewRequest(http.MethodPost, url, body)
	if err != nil {
		return nil, 0, nil, err
	}

	transport, err := CreateTransport(conf, auth, &http.Transport{}, timeout, customHeaders)
	if err != nil {
		return nil, 0, nil, err
	}

	client := http.Client{Transport: transport, Timeout: timeout}

	resp, err := client.Do(req)
	if err != nil {
		return nil, 0, nil, err
	}
	defer resp.Body.Close()
	respBody, err := io.ReadAll(resp.Body)
	return respBody, resp.StatusCode, resp.Cookies(), err
}

type authRoundTripper struct {
	auth       *config.Auth
	conf       *config.Config
	originalRT http.RoundTripper
}

type customHeadersRoundTripper struct {
	headers    map[string]string
	originalRT http.RoundTripper
}

func (rt *authRoundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
	// Build Authorization header dynamically on each request to support credential rotation
	if rt.auth != nil {
		switch rt.auth.Type {
		case config.AuthTypeBearer:
			if token, err := rt.conf.GetCredential(rt.auth.Token); err == nil && token != "" {
				req.Header.Set("Authorization", "Bearer "+token)
			} else if err != nil {
				log.Errorf("Failed to read token for bearer authentication: %v", err)
			}
		case config.AuthTypeBasic:
			username, uerr := rt.conf.GetCredential(rt.auth.Username)
			if uerr != nil {
				log.Errorf("Failed to read username for basic authentication: %v", uerr)
				break
			}
			password, perr := rt.conf.GetCredential(rt.auth.Password)
			if perr != nil {
				log.Errorf("Failed to read password for basic authentication: %v", perr)
				break
			}
			encoded := base64.StdEncoding.EncodeToString([]byte(username + ":" + password))
			req.Header.Set("Authorization", "Basic "+encoded)
		}
	}
	return rt.originalRT.RoundTrip(req)
}

func (rt *customHeadersRoundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
	// note: no need to check for nil or empty map - newCustomHeadersRoundTripper will assure us there will always be at least 1
	for k, v := range rt.headers {
		req.Header.Set(k, v)
	}
	return rt.originalRT.RoundTrip(req)
}

func newAuthRoundTripper(conf *config.Config, auth *config.Auth, rt http.RoundTripper) http.RoundTripper {
	// Always read credentials dynamically during RoundTrip
	return &authRoundTripper{auth: auth, conf: conf, originalRT: rt}
}

func newCustomHeadersRoundTripper(headers map[string]string, rt http.RoundTripper) http.RoundTripper {
	if len(headers) == 0 {
		// if there are no custom headers then there is no need for a special RoundTripper; therefore just return the original RoundTripper
		return rt
	}
	return &customHeadersRoundTripper{
		headers:    headers,
		originalRT: rt,
	}
}

// Creates a new HTTP Transport with TLS, Timeouts, and optional custom headers.
//
// The timeout parameter controls dial timeout only. IdleConnTimeout will use Go's
// default (90 seconds) when transportConfig.IdleConnTimeout is 0.
func CreateTransport(conf *config.Config, auth *config.Auth, transportConfig *http.Transport, timeout time.Duration, customHeaders map[string]string) (http.RoundTripper, error) {
	// Limits the time spent establishing a TCP connection if a new one is
	// needed. If DialContext is not set, Dial is used, we only create a new one
	// if neither is defined.
	if transportConfig.DialContext == nil {
		transportConfig.DialContext = (&net.Dialer{
			Timeout: timeout,
		}).DialContext
	}

	// We might need some custom RoundTrippers to manipulate the requests (for auth and other custom request headers).
	// Chain together the RoundTrippers that we need, retaining the outer-most round tripper so we can return it.
	outerRoundTripper := newCustomHeadersRoundTripper(customHeaders, transportConfig)

	// Part 1: Configure TLS if auth credentials OR custom CA bundle is present.
	// Custom CA bundles (via conf.CertPool()) are independent of authentication - services
	// may use self-signed certs or internal CAs without requiring auth credentials.
	//
	// We use TLSClientConfig with VerifyConnection callback instead of DialTLSContext because:
	// - Go manages ALPN/HTTP2, session cache, and connection pooling properly
	// - VerifyConnection allows dynamic CA pool lookup on each handshake (supports rotation)
	// - Future transport improvements from Go are automatically inherited
	hasCustomCA := conf.Credentials != nil && conf.Credentials.HasCustomCAs()
	if auth != nil || hasCustomCA {
		cfg, err := buildTLSConfigWithDynamicVerification(conf, auth, "")
		if err != nil {
			return nil, err
		}
		transportConfig.TLSClientConfig = cfg
	}

	// Part 2: Wrap with auth RoundTripper only if auth credentials are provided.
	// This is separate from TLS configuration because auth and TLS are orthogonal concerns.
	if auth != nil {
		outerRoundTripper = newAuthRoundTripper(conf, auth, outerRoundTripper)
	}

	return outerRoundTripper, nil
}

func GetTLSConfig(conf *config.Config, auth *config.Auth) (*tls.Config, error) {
	// Return TLS config if there's anything to configure: auth credentials OR custom CA bundle.
	// Custom CA bundles are independent of authentication credentials.
	hasCustomCA := conf.Credentials != nil && conf.Credentials.HasCustomCAs()

	if auth == nil {
		// No auth provided, but check if custom CA bundle is configured
		if hasCustomCA {
			return buildTLSConfigWithDynamicVerification(conf, nil, "")
		}
		return nil, nil
	}
	if auth.CertFile == "" && auth.KeyFile == "" && !auth.InsecureSkipVerify {
		// Auth object provided but contains no TLS-specific settings (no client certs or insecure skip).
		// Check if custom CA bundle is configured to determine if TLS config is needed.
		if hasCustomCA {
			return buildTLSConfigWithDynamicVerification(conf, auth, "")
		}
		return nil, nil
	}
	return buildTLSConfigWithDynamicVerification(conf, auth, "")
}

// GetTLSConfigForServer returns a tls.Config that is pre-configured for the provided server name.
// This should be preferred when the target hostname/IP is known ahead of time (e.g. for gRPC clients)
// so that certificate verification can enforce the correct SAN.
func GetTLSConfigForServer(conf *config.Config, auth *config.Auth, serverName string) (*tls.Config, error) {
	// Return TLS config if there's anything to configure: auth credentials OR custom CA bundle.
	// Custom CA bundles are independent of authentication credentials.
	hasCustomCA := conf.Credentials != nil && conf.Credentials.HasCustomCAs()

	if auth == nil {
		// No auth provided, but check if custom CA bundle is configured
		if hasCustomCA {
			return buildTLSConfigWithDynamicVerification(conf, nil, serverName)
		}
		return nil, nil
	}
	if auth.CertFile == "" && auth.KeyFile == "" && !auth.InsecureSkipVerify {
		// Auth object provided but contains no TLS-specific settings (no client certs or insecure skip).
		// Check if custom CA bundle is configured to determine if TLS config is needed.
		if hasCustomCA {
			return buildTLSConfigWithDynamicVerification(conf, auth, serverName)
		}
		return nil, nil
	}
	return buildTLSConfigWithDynamicVerification(conf, auth, serverName)
}

// buildTLSConfigWithDynamicVerification creates a TLS config that supports dynamic CA rotation.
// Instead of setting RootCAs statically, it uses VerifyConnection callback to fetch the current
// CA pool on each TLS handshake. This allows CA bundles to be rotated without restarting.
//
// This approach lets Go manage ALPN, HTTP/2, session cache, and connection pooling properly,
// while still supporting credential rotation via fsnotify.
//
// The serverName parameter, if provided, will be set in the TLS config for proper SAN validation.
// This is particularly important for gRPC clients where the target hostname is known ahead of time.
func buildTLSConfigWithDynamicVerification(conf *config.Config, auth *config.Auth, serverName string) (*tls.Config, error) {
	// Determine if verification should be skipped entirely
	skipVerify := auth != nil && auth.InsecureSkipVerify

	cfg := &tls.Config{
		MinVersion: tls.VersionTLS12,
		// Set baseline RootCAs for clarity and compatibility. While VerifyConnection
		// performs the actual verification using fresh CAs on each handshake, setting
		// RootCAs explicitly makes the config's intent clear and avoids edge cases where
		// TLS libraries check for nil RootCAs as a sanity check.
		RootCAs: conf.CertPool(),
		// Disable built-in verification - we perform it dynamically in VerifyConnection
		// to support CA rotation. This is NOT insecure; verification still happens, but
		// we fetch the current CA pool on each handshake to enable rotation without restart.
		InsecureSkipVerify: true,
		VerifyConnection: func(cs tls.ConnectionState) error {
			// If InsecureSkipVerify was explicitly requested, skip all verification
			if skipVerify {
				return nil
			}
			// Get current CA pool (may have been rotated via fsnotify)
			roots := conf.CertPool()
			return verifyServerCertificate(cs, roots)
		},
	}

	// Set ServerName if provided for proper SAN validation
	if serverName != "" {
		cfg.ServerName = serverName
	}

	// Set up client certificate callback (already supports rotation via GetCredential)
	if auth != nil && auth.CertFile != "" && auth.KeyFile != "" {
		certFile := auth.CertFile
		keyFile := auth.KeyFile
		cfg.GetClientCertificate = func(*tls.CertificateRequestInfo) (*tls.Certificate, error) {
			certContent, err := conf.GetCredential(certFile)
			if err != nil {
				return nil, fmt.Errorf("failed to load client certificate cert=[%s]: %w", certFile, err)
			}
			keyContent, err := conf.GetCredential(keyFile)
			if err != nil {
				return nil, fmt.Errorf("failed to load client certificate key=[%s]: %w", keyFile, err)
			}
			cert, err := tls.X509KeyPair([]byte(certContent), []byte(keyContent))
			if err != nil {
				return nil, fmt.Errorf("failed to parse client certificate cert=[%s], key=[%s]: %w", certFile, keyFile, err)
			}
			return &cert, nil
		}
	}

	return cfg, nil
}

// verifyServerCertificate performs manual server certificate verification using the provided
// CA pool. This is called from VerifyConnection callback to support dynamic CA rotation.
func verifyServerCertificate(cs tls.ConnectionState, roots *x509.CertPool) error {
	if len(cs.PeerCertificates) == 0 {
		return errors.New("server provided no certificates")
	}

	opts := x509.VerifyOptions{
		Roots:         roots,
		Intermediates: x509.NewCertPool(),
		DNSName:       cs.ServerName,
	}

	// Add intermediate certificates from the chain
	for _, cert := range cs.PeerCertificates[1:] {
		opts.Intermediates.AddCert(cert)
	}

	// Verify the leaf certificate
	_, err := cs.PeerCertificates[0].Verify(opts)
	return err
}

func GuessKialiURL(conf *config.Config, r *http.Request) string {
	// Take default values from configuration
	schema := conf.Server.WebSchema
	port := strconv.Itoa(conf.Server.Port)
	host := conf.Server.WebFQDN

	isDefaultPort := false
	if r != nil {
		// Guess the schema. If there is a value in configuration, it always takes priority.
		if schema == "" {
			if fwdSchema, ok := r.Header["X-Forwarded-Proto"]; ok && len(fwdSchema) == 1 {
				schema = fwdSchema[0]
			} else if len(r.URL.Scheme) > 0 {
				schema = r.URL.Scheme
			}
		}

		// Guess the public Kiali hostname. If there is a value in configuration, it always takes priority.
		if host == "" {
			if fwdHost, ok := r.Header["X-Forwarded-Host"]; ok && len(fwdHost) == 1 {
				host = fwdHost[0]
			} else if len(r.URL.Hostname()) != 0 {
				host = r.URL.Hostname()
			} else if len(r.Host) != 0 {
				host = r.Host
			}

			// host could be of the form host:port. Split it if this is the case.
			colon := strings.LastIndexByte(host, ':')
			if colon != -1 {
				host, port = host[:colon], host[colon+1:]
			}
		}

		// Guess the port. In this case, the port in configuration doesn't take
		// priority, because this is the port where the pod is listening, which may
		// be mapped to another public port via the Service/Ingress. So, HTTP headers
		// take priority.
		if conf.Server.WebPort != "" {
			port = conf.Server.WebPort
		} else if fwdPort, ok := r.Header["X-Forwarded-Port"]; ok && len(fwdPort) == 1 {
			port = fwdPort[0]
		} else if len(r.URL.Host) != 0 {
			if len(r.URL.Port()) != 0 {
				port = r.URL.Port()
			} else {
				isDefaultPort = true
			}
		}
	}

	// If we haven't already set the port and there's a WebPort in the config, use it.
	if isDefaultPort && conf.Server.WebPort != "" {
		port = conf.Server.WebPort
	}

	// If using standard ports, don't specify the port component part on the URL
	var guessedKialiURL string
	if (schema == "http" && port == "80") || (schema == "https" && port == "443") {
		isDefaultPort = true
	}
	if isDefaultPort {
		guessedKialiURL = fmt.Sprintf("%s://%s%s", schema, host, conf.Server.WebRoot)
	} else {
		guessedKialiURL = fmt.Sprintf("%s://%s:%s%s", schema, host, port, conf.Server.WebRoot)
	}

	guessedKialiURL = strings.TrimRight(guessedKialiURL, "/")
	log.Tracef("Guessed Kiali URL=%v", guessedKialiURL)

	return guessedKialiURL
}
