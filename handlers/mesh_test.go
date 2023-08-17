package handlers_test

import (
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/tools/clientcmd/api"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/handlers"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
)

// Fails if resp status is non-200
func checkStatus(t *testing.T, expectedCode int, resp *http.Response) {
	if resp.StatusCode != expectedCode {
		// Attempt to read body to get more info.
		body, err := io.ReadAll(resp.Body)
		if err != nil {
			t.Logf("Unable to read response body: %s", err)
		}
		t.Fatalf("Expected status code 200, got %d. Body: %s", resp.StatusCode, string(body))
	}
}

func TestGetMesh(t *testing.T) {
	require := require.New(t)

	conf := config.NewConfig()
	kubernetes.SetConfig(t, *conf)

	k8s := kubetest.NewFakeK8sClient(
		&corev1.Namespace{ObjectMeta: metav1.ObjectMeta{Name: conf.IstioNamespace}},
	)
	business.SetupBusinessLayer(t, k8s, *conf)

	authInfo := &api.AuthInfo{Token: "test"}
	server := httptest.NewServer(handlers.WithAuthInfo(authInfo, handlers.GetMesh))
	t.Cleanup(server.Close)

	resp, err := http.Get(server.URL + "/api/mesh")
	require.NoError(err)
	checkStatus(t, http.StatusOK, resp)
}

type forbiddenFake struct{ kubernetes.ClientInterface }

func (f *forbiddenFake) GetNamespace(namespace string) (*corev1.Namespace, error) {
	return nil, fmt.Errorf("forbidden")
}

func TestGetMeshWithoutAccess(t *testing.T) {
	require := require.New(t)

	conf := config.NewConfig()
	kubernetes.SetConfig(t, *conf)

	k8s := kubetest.NewFakeK8sClient(
		&corev1.Namespace{ObjectMeta: metav1.ObjectMeta{Name: conf.IstioNamespace}},
	)
	business.SetupBusinessLayer(t, &forbiddenFake{k8s}, *conf)

	authInfo := &api.AuthInfo{Token: "test"}
	server := httptest.NewServer(handlers.WithAuthInfo(authInfo, handlers.GetMesh))
	t.Cleanup(server.Close)

	resp, err := http.Get(server.URL + "/api/mesh")
	require.NoError(err)
	checkStatus(t, http.StatusForbidden, resp)
}
