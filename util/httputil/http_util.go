package httputil

import (
	"crypto/tls"
	"crypto/x509"
	"encoding/base64"
	"fmt"
	"io/ioutil"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/log"
)

func HttpMethods() []string {
	return []string{http.MethodGet, http.MethodHead, http.MethodPost, http.MethodPut, http.MethodPatch,
		http.MethodDelete, http.MethodConnect, http.MethodOptions, http.MethodTrace}
}

func HttpGet(url string, auth *config.Auth, timeout time.Duration) ([]byte, int, error) {
	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return nil, 0, err
	}
	transport, err := AuthTransport(auth, &http.Transport{})
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

func AuthTransport(auth *config.Auth, transportConfig *http.Transport) (http.RoundTripper, error) {
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

		transportConfig.TLSClientConfig = &tls.Config{
			InsecureSkipVerify: auth.InsecureSkipVerify,
			RootCAs:            certPool,
		}
	}

	return newAuthRoundTripper(auth, transportConfig), nil
}

func GuessKialiURL(r *http.Request) string {
	cfg := config.Get()

	// Take "default" values from where we are listening within the pod
	schema := r.URL.Scheme
	port := strconv.Itoa(cfg.Server.Port)
	host := "" // Blank host. If "guessing" fails, it's unknown.

	log.Debugf("GuessKialiURL defaults: schema=%s port=%s", schema, port)

	// Guess the schema
	if fwdSchema, ok := r.Header["X-Forwarded-Proto"]; ok && len(fwdSchema) == 1 {
		schema = fwdSchema[0]
	}

	// Guess the public Kiali hostname
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

	// Guess the port
	if fwdPort, ok := r.Header["X-Forwarded-Port"]; ok && len(fwdPort) == 1 {
		port = fwdPort[0]
	} else if len(r.URL.Port()) != 0 {
		port = r.URL.Port()
	}

	log.Debugf("GuessKialiURL: %s://%s:%s%s", schema, host, port, cfg.Server.WebRoot)

	return fmt.Sprintf("%s://%s:%s%s", schema, host, port, cfg.Server.WebRoot)
}