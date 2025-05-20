package otel

import (
	"context"
	"io"
	"net/http"
)

func MakeRequest(ctx context.Context, client http.Client, endpoint string, body io.Reader) (responseBody []byte, status int, err error) {
	ctxCancel, cancel := context.WithCancel(ctx)
	defer cancel()

	responseBody = nil
	status = 0

	req, err := http.NewRequestWithContext(ctxCancel, http.MethodGet, endpoint, body)
	if err != nil {
		return
	}
	req.Header.Add("Accept", "application/json")
	req.Header.Add("Content-Type", "application/json")
	resp, err := client.Do(req)
	if err != nil {
		return
	}
	defer resp.Body.Close()
	responseBody, err = io.ReadAll(resp.Body)
	status = resp.StatusCode
	return
}
