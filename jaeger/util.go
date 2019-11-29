package jaeger

import (
	"io"
	"io/ioutil"
	"net/http"
)

func makeRequest(client http.Client, endpoint string, body io.Reader) (response []byte, status int, err error) {
	response = nil
	status = 0

	req, err := http.NewRequest(http.MethodGet, endpoint, body)
	if err != nil {
		return
	}
	resp, err := client.Do(req)
	if err != nil {
		return
	}
	defer resp.Body.Close()
	response, err = ioutil.ReadAll(resp.Body)
	status = resp.StatusCode
	return
}
