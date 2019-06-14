package httputil

import (
	"crypto/tls"
	"crypto/x509"
	"encoding/base64"
	"fmt"
	"io/ioutil"
	"net/http"
	"time"

	"github.com/kiali/kiali/config"
)

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
