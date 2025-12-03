package httputil

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"encoding/base64"
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
// Please remember that setting long timeouts is not recommended as it can make
// idle connections stay open for as long as 2 * timeout. This should only be
// done in cases where you know the request is very likely going to be reused at
// some point in the near future.
func CreateTransport(conf *config.Config, auth *config.Auth, transportConfig *http.Transport, timeout time.Duration, customHeaders map[string]string) (http.RoundTripper, error) {
	// Limits the time spent establishing a TCP connection if a new one is
	// needed. If DialContext is not set, Dial is used, we only create a new one
	// if neither is defined.
	if transportConfig.DialContext == nil {
		transportConfig.DialContext = (&net.Dialer{
			Timeout: timeout,
		}).DialContext
	}

	transportConfig.IdleConnTimeout = timeout

	// We might need some custom RoundTrippers to manipulate the requests (for auth and other custom request headers).
	// Chain together the RoundTrippers that we need, retaining the outer-most round tripper so we can return it.
	outerRoundTripper := newCustomHeadersRoundTripper(customHeaders, transportConfig)

	if auth != nil {
		transportConfig.DialTLSContext = func(ctx context.Context, network, addr string) (net.Conn, error) {
			host, _, err := net.SplitHostPort(addr)
			if err != nil {
				host = addr
			}
			cfg, err := buildTLSConfig(conf, auth, host)
			if err != nil {
				return nil, err
			}
			dialer := tls.Dialer{Config: cfg}
			return dialer.DialContext(ctx, network, addr)
		}
		outerRoundTripper = newAuthRoundTripper(conf, auth, outerRoundTripper)
	}

	return outerRoundTripper, nil
}

func GetTLSConfig(conf *config.Config, auth *config.Auth) (*tls.Config, error) {
	if auth == nil {
		return nil, nil
	}
	if auth.CertFile == "" && auth.KeyFile == "" && !auth.InsecureSkipVerify {
		return nil, nil
	}
	return buildTLSConfig(conf, auth, "")
}

// GetTLSConfigForServer returns a tls.Config that is pre-configured for the provided server name.
// This should be preferred when the target hostname/IP is known ahead of time (e.g. for gRPC clients)
// so that certificate verification can enforce the correct SAN.
func GetTLSConfigForServer(conf *config.Config, auth *config.Auth, serverName string) (*tls.Config, error) {
	if auth == nil {
		return nil, nil
	}
	return buildTLSConfig(conf, auth, serverName)
}

func buildTLSConfig(conf *config.Config, auth *config.Auth, serverName string) (*tls.Config, error) {
	cfg := &tls.Config{
		MinVersion: tls.VersionTLS12,
	}

	if serverName != "" {
		cfg.ServerName = serverName
	}

	roots := conf.CertPool()

	// When no auth is provided we still honour the configured/system roots.
	if auth == nil {
		cfg.RootCAs = roots
		return cfg, nil
	}

	cfg.InsecureSkipVerify = auth.InsecureSkipVerify

	if auth.CertFile != "" && auth.KeyFile != "" {
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

	// Note: auth.CAFile is deprecated. Custom CA certificates should be configured
	// via the kiali-cabundle ConfigMap instead. The CAFile setting is now ignored.

	// When no custom verification is needed rely on the configured/system roots.
	if roots == nil && !cfg.InsecureSkipVerify {
		systemPool, err := x509.SystemCertPool()
		if err != nil {
			log.Debugf("Failed to load system cert pool: %v", err)
			systemPool = x509.NewCertPool()
		}
		roots = systemPool
	}

	cfg.RootCAs = roots

	return cfg, nil
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
