package kiali

import (
	"net/http"
	"time"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/util/httputil"
)

// withRetry does a function call with retries and returns the last error
// if it fails.
func withRetry(f func() error, retries int) error {
	var err error
	for i := 0; i < retries; i++ {
		err = f()
		if err == nil {
			return nil
		}
	}
	return err
}

// httpGETWithRetry wraps the httpGET function with retries.
func httpGETWithRetry(url string, auth *config.Auth, timeout time.Duration, customHeaders map[string]string, cookies []*http.Cookie, conf *config.Config) ([]byte, int, []*http.Cookie, error) {
	var body []byte
	var code int
	var err error
	err = withRetry(func() error {
		body, code, cookies, err = httputil.HttpGet(url, auth, timeout, customHeaders, cookies, conf)
		return err
	}, 3)
	return body, code, cookies, err
}
