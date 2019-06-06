package util

import (
	"crypto/tls"
	"io/ioutil"
	"net/http"
	"time"
)

func HttpGet(url, authorization string, insecureSkipVerify bool, timeout time.Duration) ([]byte, int, error) {
	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return nil, 0, err
	}
	if authorization != "" {
		req.Header.Add("Authorization", authorization)
	}
	transport := http.Transport{}
	if insecureSkipVerify {
		transport.TLSClientConfig = &tls.Config{
			InsecureSkipVerify: true,
		}
	}
	client := http.Client{Transport: &transport, Timeout: timeout}

	resp, err := client.Do(req)
	if err != nil {
		return nil, 0, err
	}
	defer resp.Body.Close()
	body, err := ioutil.ReadAll(resp.Body)
	return body, resp.StatusCode, err
}
