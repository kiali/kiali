package client

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestNew(t *testing.T) {
	c := New("https://ols.example.com")
	if c.baseURL != "https://ols.example.com" {
		t.Errorf("baseURL: got %q", c.baseURL)
	}
	if c.httpClient != http.DefaultClient {
		t.Errorf("expected default http client")
	}

	c2 := New("https://ols.example.com/")
	c2.SetAuthToken("token1")
	if c2.authToken != "token1" {
		t.Errorf("authToken: got %q", c2.authToken)
	}
	if c2.baseURL != "https://ols.example.com" {
		t.Errorf("baseURL with trailing slash: got %q", c2.baseURL)
	}
}

func TestAPIError(t *testing.T) {
	err := &APIError{StatusCode: 401, Body: []byte(`{"detail":"Unauthorized"}`)}
	if err.Error() == "" {
		t.Error("APIError.Error() should not be empty")
	}
}

func TestQuery_Validation(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Error("should not be called")
	}))
	defer srv.Close()

	ctx := context.Background()
	cl := New(srv.URL)

	_, code, err := cl.Query(ctx, nil, "")
	if code != http.StatusBadRequest {
		t.Errorf("got code %d", code)
	}
	if err == nil || err.Error() != "LLMRequest is required" {
		t.Errorf("Query(nil): got err %v", err)
	}

	_, code, err = cl.Query(ctx, &LLMRequest{}, "")
	if code != http.StatusBadRequest {
		t.Errorf("got code %d", code)
	}
	if err == nil || err.Error() != "query is required" {
		t.Errorf("Query(empty query): got err %v", err)
	}
}

func TestReadiness_Success(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != pathReadiness || r.Method != http.MethodGet {
			t.Errorf("unexpected %s %s", r.Method, r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"ready":true,"reason":"service is ready"}`))
	}))
	defer srv.Close()

	ctx := context.Background()
	cl := New(srv.URL)
	out, err := cl.Readiness(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if !out.Ready || out.Reason != "service is ready" {
		t.Errorf("got ready=%v reason=%q", out.Ready, out.Reason)
	}
}

func TestLiveness_Success(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != pathLiveness || r.Method != http.MethodGet {
			t.Errorf("unexpected %s %s", r.Method, r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"alive":true}`))
	}))
	defer srv.Close()

	ctx := context.Background()
	cl := New(srv.URL)
	out, err := cl.Liveness(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if !out.Alive {
		t.Errorf("got alive=%v", out.Alive)
	}
}

func TestAuthorized_Success(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != pathAuthorized || r.Method != http.MethodPost {
			t.Errorf("unexpected %s %s", r.Method, r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"user_id":"uid-1","username":"user1","skip_user_id_check":false}`))
	}))
	defer srv.Close()

	ctx := context.Background()
	cl := New(srv.URL)
	cl.SetAuthToken("bearer-token")
	out, code, err := cl.Authorized(ctx, "")
	if code != http.StatusOK {
		t.Errorf("got code %d", code)
	}
	if err != nil {
		t.Fatal(err)
	}
	if out.UserID != "uid-1" || out.Username != "user1" {
		t.Errorf("got user_id=%q username=%q", out.UserID, out.Username)
	}
}
