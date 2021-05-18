package routing

import (
	"io/ioutil"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gorilla/mux"
	"github.com/stretchr/testify/assert"

	"github.com/kiali/kiali/config"
)

func TestDrawPathProperly(t *testing.T) {
	conf := new(config.Config)
	config.Set(conf)
	router := NewRouter()
	testRoute(router, "Root", "GET", t)
}

func testRoute(router *mux.Router, name string, method string, t *testing.T) {
	var path = router.Get(name)

	if path == nil {
		t.Error("path is not registered into router")
	}

	var methods, err = path.GetMethods()
	if err != nil {
		t.Error(err)
	}

	if len(methods) != 1 && methods[0] != method {
		t.Error("Root path is not registered with method")
	}
}

func TestWebRootRedirect(t *testing.T) {
	oldConfig := config.Get()
	defer config.Set(oldConfig)

	conf := new(config.Config)
	conf.Server.WebRoot = "/test"
	config.Set(conf)

	router := NewRouter()
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
	config.Set(conf)

	router := NewRouter()
	ts := httptest.NewServer(router)
	defer ts.Close()

	resp, err := http.Get(ts.URL + "/healthz")
	if err != nil {
		t.Fatal(err)
	}
	assert.Equal(t, 200, resp.StatusCode, "Response should be ok")

	body, _ := ioutil.ReadAll(resp.Body)
	assert.Equal(t, "", string(body), "Response should be empty")
}

func TestRedirectWithSetWebRootKeepsParams(t *testing.T) {
	oldConfig := config.Get()
	defer config.Set(oldConfig)

	conf := new(config.Config)
	conf.Server.WebRoot = "/test"
	config.Set(conf)

	router := NewRouter()
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
	body, _ := ioutil.ReadAll(resp.Body)
	assert.Equal(t, 200, resp.StatusCode, "Response should not redirect")

	resp, err = client.Get(ts.URL + "/test/")
	if err != nil {
		t.Fatal(err)
	}
	body2, _ := ioutil.ReadAll(resp.Body)
	assert.Equal(t, 200, resp.StatusCode, string(body2))

	assert.Equal(t, string(body), string(body2), "Response with and without the trailing slash on the webroot are not the same")
}
