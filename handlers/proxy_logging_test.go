package handlers

import (
	"context"
	"fmt"
	"io/ioutil"
	"net"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gorilla/mux"
	"github.com/stretchr/testify/assert"
	"k8s.io/client-go/tools/clientcmd/api"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/util/httputil"
)

type fakeForwarder struct{}

func (f *fakeForwarder) Start() error { return nil }
func (f *fakeForwarder) Stop()        {}

func setupTestLoggingServer(t *testing.T, namespace, pod string) *httptest.Server {
	conf := config.NewConfig()
	conf.KubernetesConfig.CacheEnabled = false
	config.Set(conf)

	mr := mux.NewRouter()
	path := "/api/namespaces/{namespace}/pods/{pod}/logging"
	mr.HandleFunc(path, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx := context.WithValue(r.Context(), "authInfo", &api.AuthInfo{Token: "test"})
		LoggingUpdate(w, r.Clone(ctx))
	}))

	// Ensure that the next port is available for when the test runs.
	forwardingPort := httputil.Pool.LastBusyPort + 1
	localhostServer := httptest.NewUnstartedServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(200)
	}))
	listener, err := net.Listen("tcp", fmt.Sprintf("127.0.0.1:%d", forwardingPort))
	if err != nil {
		// Note(nrfox): This test is potentially flaky since it relies on binding to the same port as the random one
		// that was chosen. It's probably still worth keeping since it actually tests the port forwarding is working
		// when the URL is hit.
		t.Skipf("NOTICE: Skipping proxy logging test since listen failed with: %s. More than likely there's another service on your machine using the chosen port", err)
	}
	localhostServer.Listener = listener
	localhostServer.Start()
	t.Cleanup(localhostServer.Close)

	ts := httptest.NewServer(mr)
	t.Cleanup(ts.Close)

	k8s := new(kubetest.K8SClientMock)
	k8s.On("IsOpenShift").Return(false)
	k8s.On("ForwardPostRequest").Return(nil, nil)
	var forwarder httputil.PortForwarder = &fakeForwarder{}
	k8s.On("GetPodPortForwarder", namespace, pod, fmt.Sprintf("%d:15000", forwardingPort)).Return(&forwarder, nil)

	mockClientFactory := kubetest.NewK8SClientFactoryMock(k8s)
	business.SetWithBackends(mockClientFactory, nil)

	return ts
}

func TestProxyLoggingSucceeds(t *testing.T) {
	const (
		namespace = "bookinfo"
		pod       = "details-v1-79f774bdb9-hgcch"
	)
	assert := assert.New(t)
	ts := setupTestLoggingServer(t, namespace, pod)

	url := ts.URL + fmt.Sprintf("/api/namespaces/%s/pods/%s/logging?level=info", namespace, pod)
	resp, err := ts.Client().Post(url, "application/json", nil)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()

	body, _ := ioutil.ReadAll(resp.Body)
	assert.Equalf(200, resp.StatusCode, "response text: %s", string(body))
}

func TestMissingQueryParamFails(t *testing.T) {
	const (
		namespace = "bookinfo"
		pod       = "details-v1-79f774bdb9-hgcch"
	)
	assert := assert.New(t)
	ts := setupTestLoggingServer(t, namespace, pod)

	url := ts.URL + fmt.Sprintf("/api/namespaces/%s/pods/%s/logging", namespace, pod)
	resp, err := ts.Client().Post(url, "application/json", nil)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()

	body, _ := ioutil.ReadAll(resp.Body)
	assert.Equalf(400, resp.StatusCode, "response text: %s", string(body))
}

func TestIncorrectQueryParamFails(t *testing.T) {
	const (
		namespace = "bookinfo"
		pod       = "details-v1-79f774bdb9-hgcch"
	)
	assert := assert.New(t)
	ts := setupTestLoggingServer(t, namespace, pod)

	url := ts.URL + fmt.Sprintf("/api/namespaces/%s/pods/%s/logging?level=peasoup", namespace, pod)
	resp, err := ts.Client().Post(url, "application/json", nil)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()

	body, _ := ioutil.ReadAll(resp.Body)
	assert.Equalf(400, resp.StatusCode, "response text: %s", string(body))
}
