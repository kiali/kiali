package httputil

import (
	"crypto/tls"
	"crypto/x509"
	"encoding/base64"
	"fmt"
	"io/ioutil"
	"net"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/kiali/kiali/config"
)

const DefaultTimeout = 10 * time.Second

func HttpMethods() []string {
	return []string{http.MethodGet, http.MethodHead, http.MethodPost, http.MethodPut, http.MethodPatch,
		http.MethodDelete, http.MethodConnect, http.MethodOptions, http.MethodTrace}
}

func HttpGet(url string, auth *config.Auth, timeout time.Duration) ([]byte, int, error) {
	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return nil, 0, err
	}

	transport, err := CreateTransport(auth, &http.Transport{}, timeout)
	if err != nil {
		return nil, 0, err
	}

	client := http.Client{Transport: transport, Timeout: timeout}

	resp, err := client.Do(req)
	if err != nil {
		return nil, 0, err
	}
	defer resp.Body.Close()
	body, err := ioutil.ReadAll(resp.Body)
	return body, resp.StatusCode, err
}

type authRoundTripper struct {
	auth       string
	originalRT http.RoundTripper
}

func (rt *authRoundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
	req.Header.Set("Authorization", rt.auth)
	return rt.originalRT.RoundTrip(req)
}

func newAuthRoundTripper(auth *config.Auth, rt http.RoundTripper) http.RoundTripper {
	switch auth.Type {
	case config.AuthTypeBearer:
		token := auth.Token
		return &authRoundTripper{auth: "Bearer " + token, originalRT: rt}
	case config.AuthTypeBasic:
		encoded := base64.StdEncoding.EncodeToString([]byte(auth.Username + ":" + auth.Password))
		return &authRoundTripper{auth: "Basic " + encoded, originalRT: rt}
	default:
		return rt
	}
}

// Creates a new HTTP Transport with TLS and Timeouts.
//
// Please remember that setting long timeouts is not recommended as it can make
// idle connections stay open for as long as 2 * timeout. This should only be
// done in cases where you know the request is very likely going to be reused at
// some point in the near future.
func CreateTransport(auth *config.Auth, transportConfig *http.Transport, timeout time.Duration) (http.RoundTripper, error) {
	// Limits the time spent establishing a TCP connection if a new one is
	// needed. If DialContext is not set, Dial is used, we only create a new one
	// if neither is defined.
	if transportConfig.DialContext == nil {
		transportConfig.DialContext = (&net.Dialer{
			Timeout: timeout,
		}).DialContext
	}

	transportConfig.IdleConnTimeout = timeout

	if auth == nil {
		return transportConfig, nil
	}

	tlscfg, err := GetTLSConfig(auth)
	if err != nil {
		return nil, err
	}
	if tlscfg != nil {
		transportConfig.TLSClientConfig = tlscfg
	}

	return newAuthRoundTripper(auth, transportConfig), nil
}

func GetTLSConfig(auth *config.Auth) (*tls.Config, error) {
	if auth.InsecureSkipVerify || auth.CAFile != "" {
		var certPool *x509.CertPool
		if auth.CAFile != "" {
			certPool = x509.NewCertPool()
			cert, err := ioutil.ReadFile(auth.CAFile)

			if err != nil {
				return nil, fmt.Errorf("failed to get root CA certificates: %s", err)
			}

			if ok := certPool.AppendCertsFromPEM(cert); !ok {
				return nil, fmt.Errorf("supplied CA file could not be parsed")
			}
		}
		return &tls.Config{
			InsecureSkipVerify: auth.InsecureSkipVerify,
			RootCAs:            certPool,
		}, nil
	}
	return nil, nil
}

func GuessKialiURL(r *http.Request) string {
	cfg := config.Get()

	// Take default values from configuration
	schema := cfg.Server.WebSchema
	port := strconv.Itoa(cfg.Server.Port)
	host := cfg.Server.WebFQDN

	// Guess the schema. If there is a value in configuration, it always takes priority.
	if len(schema) == 0 {
		if fwdSchema, ok := r.Header["X-Forwarded-Proto"]; ok && len(fwdSchema) == 1 {
			schema = fwdSchema[0]
		} else if len(r.URL.Scheme) > 0 {
			schema = r.URL.Scheme
		}
	}

	// Guess the public Kiali hostname. If there is a value in configuration, it always takes priority.
	if len(host) == 0 {
		if fwdHost, ok := r.Header["X-Forwarded-Host"]; ok && len(fwdHost) == 1 {
			host = fwdHost[0]
		} else if len(r.URL.Hostname()) != 0 {
			host = r.URL.Hostname()
		} else if len(r.Host) != 0 {
			// r.Host could be of the form host:port. Split it if this is the case.
			colon := strings.LastIndexByte(r.Host, ':')
			if colon != -1 {
				host, port = r.Host[:colon], r.Host[colon+1:]
			} else {
				host = r.Host
			}
		}
	}

	var isDefaultPort = false
	// Guess the port. In this case, the port in configuration doesn't take
	// priority, because this is the port where the pod is listening, which may
	// be mapped to another public port via the Service/Ingress. So, HTTP headers
	// take priority.
	if len(cfg.Server.WebPort) > 0 {
		port = cfg.Server.WebPort
	} else if fwdPort, ok := r.Header["X-Forwarded-Port"]; ok && len(fwdPort) == 1 {
		port = fwdPort[0]
	} else if len(r.URL.Host) != 0 {
		if len(r.URL.Port()) != 0 {
			port = r.URL.Port()
		} else {
			isDefaultPort = true
		}
	}

	// If using standard ports, don't specify the port component part on the URL
	var guessedKialiURL string
	if (schema == "http" && port == "80") || (schema == "https" && port == "443") {
		isDefaultPort = true
	}
	if isDefaultPort {
		guessedKialiURL = fmt.Sprintf("%s://%s%s", schema, host, cfg.Server.WebRoot)
	} else {
		guessedKialiURL = fmt.Sprintf("%s://%s:%s%s", schema, host, port, cfg.Server.WebRoot)
	}

	return strings.TrimRight(guessedKialiURL, "/")
}
