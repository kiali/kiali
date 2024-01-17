package routing

import (
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/gorilla/mux"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/assert"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/prometheus/internalmetrics"
)

func TestDrawPathProperly(t *testing.T) {
	conf := new(config.Config)
	router := NewRouter(conf, nil, nil, nil, nil, nil)
	testRoute(router, "Root", "GET", t)
}

func testRoute(router *mux.Router, name string, method string, t *testing.T) {
	path := router.Get(name)

	if path == nil {
		t.Error("path is not registered into router")
	}

	methods, err := path.GetMethods()
	if err != nil {
		t.Error(err)
	}

	if len(methods) != 1 && methods[0] != method {
		t.Error("Root path is not registered with method")
	}
}

func TestWebRootRedirect(t *testing.T) {
	conf := new(config.Config)
	conf.Server.WebRoot = "/test"

	router := NewRouter(conf, nil, nil, nil, nil, nil)
	ts := httptest.NewServer(router)
	defer ts.Close()

	client := &http.Client{
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			return http.ErrUseLastResponse
		},
	}

	resp, err := client.Get(ts.URL + "/")
	if err != nil {
		t.Fatal(err)
	}
	// body, _ := ioutil.ReadAll(resp.Body)
	assert.Equal(t, 302, resp.StatusCode, "Response should redirect to the webroot")
	assert.Equal(t, "/test/", resp.Header.Get("Location"), "Response should redirect to the webroot")
}

func TestSimpleRoute(t *testing.T) {
	conf := new(config.Config)

	router := NewRouter(conf, nil, nil, nil, nil, nil)
	ts := httptest.NewServer(router)
	defer ts.Close()

	resp, err := http.Get(ts.URL + "/healthz")
	if err != nil {
		t.Fatal(err)
	}
	assert.Equal(t, 200, resp.StatusCode, "Response should be ok")

	body, _ := io.ReadAll(resp.Body)
	assert.Equal(t, "", string(body), "Response should be empty")
}

func TestRedirectWithSetWebRootKeepsParams(t *testing.T) {
	oldWd, _ := os.Getwd()
	defer func() { _ = os.Chdir(oldWd) }()
	_ = os.Chdir(os.TempDir())
	_ = os.MkdirAll("./console", 0o777)
	_, _ = os.Create("./console/index.html")

	conf := new(config.Config)
	conf.Server.WebRoot = "/test"

	router := NewRouter(conf, nil, nil, nil, nil, nil)
	ts := httptest.NewServer(router)
	defer ts.Close()

	client := &http.Client{
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			return http.ErrUseLastResponse
		},
	}

	resp, err := client.Get(ts.URL + "/test")
	if err != nil {
		t.Fatal(err)
	}
	body, _ := io.ReadAll(resp.Body)
	assert.Equal(t, 200, resp.StatusCode, "Response should not redirect")

	resp, err = client.Get(ts.URL + "/test/")
	if err != nil {
		t.Fatal(err)
	}
	body2, _ := io.ReadAll(resp.Body)
	assert.Equal(t, 200, resp.StatusCode, string(body2))

	assert.Equal(t, string(body), string(body2), "Response with and without the trailing slash on the webroot are not the same")
}

func TestMetricHandlerAPIFailures(t *testing.T) {
	errcodes := []struct {
		Name string
		Code int
	}{
		{Name: "InternalServerError", Code: http.StatusInternalServerError},
		{Name: "StatusServiceUnavailable", Code: http.StatusServiceUnavailable},
	}

	for _, errcode := range errcodes {
		t.Run(errcode.Name, func(t *testing.T) {
			req, err := http.NewRequest("GET", "/error", nil)
			if err != nil {
				t.Fatal(err)
			}

			rr := httptest.NewRecorder()
			handler := metricHandler(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(errcode.Code)
			}), Route{Name: "error"})

			handler.ServeHTTP(rr, req)

			if status := rr.Code; status != http.StatusInternalServerError && status != http.StatusServiceUnavailable {
				t.Errorf("handler returned wrong status code: got %v want %v",
					status, errcode.Code)
			}
		})
	}

	registry := prometheus.NewRegistry()
	prometheus.DefaultRegisterer = registry
	internalmetrics.RegisterInternalMetrics()

	metrics, err := registry.Gather()
	assert.Nil(t, err)

	for _, m := range metrics {
		if m.GetName() == "kiali_api_failures_total" {
			if m.GetMetric()[0].Counter.GetValue() != 2 {
				t.Errorf("Failure counter metric should have a value of 2: %+v", m)
			}
		}
	}
}
