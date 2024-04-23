package handlers

import (
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gorilla/mux"
	"github.com/stretchr/testify/assert"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/client-go/tools/clientcmd/api"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes/kubetest"
)

func setupTestLoggingServer(t *testing.T, namespace, pod string) *httptest.Server {
	mr := mux.NewRouter()
	path := "/api/namespaces/{namespace}/pods/{pod}/logging"
	authInfo := map[string]*api.AuthInfo{config.Get().KubernetesConfig.ClusterName: {Token: "test"}}
	mr.HandleFunc(path, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		WithAuthInfo(authInfo, LoggingUpdate)(w, r)
	}))

	ts := httptest.NewServer(mr)
	t.Cleanup(ts.Close)

	k8s := new(kubetest.K8SClientMock)
	k8s.On("IsOpenShift").Return(false)
	k8s.On("IsGatewayAPI").Return(false)
	k8s.On("SetProxyLogLevel").Return(nil)
	var fakePod *corev1.Pod
	k8s.On("GetPod", namespace, pod).Return(fakePod, nil)

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

	body, _ := io.ReadAll(resp.Body)
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

	body, _ := io.ReadAll(resp.Body)
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

	body, _ := io.ReadAll(resp.Body)
	assert.Equalf(400, resp.StatusCode, "response text: %s", string(body))
}
