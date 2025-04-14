package istio

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

	"github.com/stretchr/testify/require"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/cache"
	"github.com/kiali/kiali/kubernetes/kubetest"
)

func TestParseIstioRawVersion(t *testing.T) {
	type versionsToTestStruct struct {
		rawVersion string
		name       string
		version    string
	}

	// see config.go/IstioVersionSupported for what versions are supported
	versionsToTest := []versionsToTestStruct{
		{
			rawVersion: "redhat@redhat-docker.io/openshift-service-mesh-1.0.0-1-123454535353-unknown",
			name:       "OpenShift Service Mesh",
			version:    "1.0.0",
		},
		{
			rawVersion: "redhat@redhat-docker.io/openshift-service-mesh-0.9.0-1-123454535353-unknown",
			name:       "OpenShift Service Mesh",
			version:    "0.9.0",
		},
		{
			rawVersion: "OSSM_1.1.0-291c5419cf19d2b015e7e5dee970c458fb8f1982-Clean",
			name:       "OpenShift Service Mesh",
			version:    "1.1.0",
		},
		{
			rawVersion: "OSSM_1.1.99-291c5419cf19d2b015e7e5dee970c458fb8f1982-Clean",
			name:       "OpenShift Service Mesh",
			version:    "1.1.99",
		},
		{
			rawVersion: "OSSM_3.0.0-tp.1-ed90e14d3473bc3fe54f98298eb16664002d14d1-Clean",
			name:       "OpenShift Service Mesh",
			version:    "3.0.0-tp.1",
		},
		{
			rawVersion: "OSSM_3.3.3-tp.10-ed90e14d3473bc3fe54f98298eb16664002d14d1-Clean",
			name:       "OpenShift Service Mesh",
			version:    "3.3.3-tp.10",
		},
		{
			rawVersion: "OSSM_3.0.0-ed90e14d3473bc3fe54f98298eb16664002d14d1-Clean",
			name:       "OpenShift Service Mesh",
			version:    "3.0.0",
		},
		{
			rawVersion: "foo-istio-1.2.3-bar",
			name:       "Istio",
			version:    "1.2.3",
		},
		{
			rawVersion: "foo-istio-10.11.122-bar",
			name:       "Istio",
			version:    "10.11.122",
		},
		{
			rawVersion: "foo-istio-0.123.789-bar",
			name:       "Istio",
			version:    "0.123.789",
		},
		{
			rawVersion: "root@f72e3d3ef3c2-docker.io/istio-release-1.0-20180927-21-10-deadbeef-Clean",
			name:       "Istio Snapshot",
			version:    "1.0-20180927",
		},
		{
			rawVersion: "root@f72e3d3ef3c2-docker.io/istio-release-1.1-20190327-21-10-deadbeef-Clean",
			name:       "Istio Snapshot",
			version:    "1.1-20190327",
		},
		{
			rawVersion: "root@f72e3d3ef3c2-docker.io/istio-release-11.12-20180927-21-10-deadbeef-Clean",
			name:       "Istio Snapshot",
			version:    "11.12-20180927",
		},
		{
			rawVersion: "root@f72e3d3ef3c2-docker.io/istio-release-0.11-20180927-21-10-deadbeef-Clean",
			name:       "Istio Snapshot",
			version:    "0.11-20180927",
		},
		{
			rawVersion: "root@f72e3d3ef3c2-docker.io/1.5-alpha.5c882cd74304ec037d38cd3abdf147cf1c44a392-5c882cd74304ec037d38cd3abdf147cf1c44a392-Clean",
			name:       "Istio Dev",
			version:    "1.5 (dev 5c882cd74304ec037d38cd3abdf147cf1c44a392)",
		},
		{
			rawVersion: "1.10-dev-65a124dc2ab69f91331298fbf6d9b4335abcf0fd-Clean",
			name:       "Istio Dev",
			version:    "1.10 (dev 65a124dc2ab69f91331298fbf6d9b4335abcf0fd)",
		},
		{
			rawVersion: "root@f72e3d3ef3c2-docker.io/1.6.0-beta.0",
			name:       "Istio RC",
			version:    "1.6.0 (beta.0)",
		},
		{
			rawVersion: "root@f72e3d3ef3c2-docker.io/1.6.0-rc.0",
			name:       "Istio RC",
			version:    "1.6.0 (rc.0)",
		},
		{
			rawVersion: "some-unknown-version-string",
			name:       "Unknown Istio Implementation",
			version:    "some-unknown-version-string",
		},
		{
			rawVersion: "root@f72e3d3ef3c2-docker.io/1.7.0-alpha.1-cd46a166947eac363380c3aa3523b26a8c391f98-dirty-Modified",
			name:       "Istio RC",
			version:    "1.7.0 (alpha.1)",
		},
	}

	for _, versionToTest := range versionsToTest {
		p := parseRawIstioVersion(versionToTest.rawVersion)
		if p.Name != versionToTest.name {
			t.Errorf("Cannot validate [%+v] - name is incorrect: %+v", versionToTest, p)
		}
		if p.Version != versionToTest.version {
			t.Errorf("Cannot validate [%+v] - version is incorrect: %+v", versionToTest, p)
		}
	}
}

type fakeForwarder struct {
	kubernetes.ClientInterface
	testURL string
}

func (f *fakeForwarder) ForwardGetRequest(namespace, podName string, destinationPort int, path string) ([]byte, error) {
	url, _ := url.JoinPath(f.testURL, path)
	resp, err := http.Get(url)
	if err != nil {
		return nil, err
	}

	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	return body, nil
}

func istiodTestServer(t *testing.T) *httptest.Server {
	t.Helper()
	testServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if _, err := w.Write([]byte(`1.22.0-aaf597fbfae607adf4bb4e77538a7ea98995328a-Clean`)); err != nil {
			t.Fatalf("Error writing response: %s", err)
		}
	}))
	t.Cleanup(testServer.Close)
	return testServer
}

func runningIstiodPod() *corev1.Pod {
	return &corev1.Pod{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "istiod-123",
			Namespace: "istio-system",
			Labels: map[string]string{
				"app":          "istiod",
				"istio.io/rev": "default",
			},
		},
		Status: corev1.PodStatus{
			Phase: corev1.PodRunning,
		},
	}
}

func TestGetVersionRemoteCluster(t *testing.T) {
	require := require.New(t)

	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "test-cluster"

	testServer := istiodTestServer(t)

	clients := map[string]kubernetes.ClientInterface{
		"test-cluster": kubetest.NewFakeK8sClient(),
		"remote-cluster": kubetest.NewFakeK8sClient(
			runningIstiodPod(),
			&corev1.Service{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "istiod",
					Namespace: "istio-system",
					Labels: map[string]string{
						"app":          "istiod",
						"istio.io/rev": "default",
					},
				},
			},
			kubetest.FakeNamespace("istio-system"),
		),
	}

	clients["remote-cluster"] = &fakeForwarder{
		ClientInterface: clients["remote-cluster"],
		testURL:         testServer.URL,
	}
	cache := cache.NewTestingCacheWithClients(t, clients, *conf)
	kubeCache, err := cache.GetKubeCache("remote-cluster")
	require.NoError(err)

	version, err := GetVersion(context.Background(), conf, clients["remote-cluster"], kubeCache, "default", "istio-system")
	require.NoError(err)
	require.Equal("1.22.0", version.Version)
}
