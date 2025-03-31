package istio

import (
	"context"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	istiov1alpha1 "istio.io/api/mesh/v1alpha1"
	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/cache"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/models"
)

func FakeCertificateConfigMap(namespace string) *corev1.ConfigMap {
	return &corev1.ConfigMap{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "istio-ca-root-cert",
			Namespace: namespace,
		},
		Data: map[string]string{
			"root-cert.pem": `-----BEGIN CERTIFICATE-----
MIIC/DCCAeSgAwIBAgIQVv6mINjF1kQJS2O98zkkNzANBgkqhkiG9w0BAQsFADAY
MRYwFAYDVQQKEw1jbHVzdGVyLmxvY2FsMB4XDTIxMDcyNzE0MzcwMFoXDTMxMDcy
NTE0MzcwMFowGDEWMBQGA1UEChMNY2x1c3Rlci5sb2NhbDCCASIwDQYJKoZIhvcN
AQEBBQADggEPADCCAQoCggEBAMwHN+LAkWbC9qyAlXQ4Zwn+Yhgc4eCPuw9LQVjW
b9al44H5sV/1QIog8wOjDHx32k2lTXvdxRgOJd+ENXMQ9DmU6C9oeWhMZAmAvp4M
NBaYnY4BRcWAPqIhEb/26zRA9pXjPVJX+aN45R1EJWsJxP6ZPkmZZKILnYY6VwqU
wbbB3lp34HQruvkpePUo4Bux+N+DfQsu1g/C6UMbQlY/kl1d1KaTS4bYQAP1d4eT
sPxw5Rf9WRSQcGaAWiPbUxVBtA0LYCbHzOacAAwvYhJgvbinr73RiqKUMR5BV/p3
lyKyVDyrVXXbVNsQhsT/lM5e55DaQEJKyldgklSGseVYHy0CAwEAAaNCMEAwDgYD
VR0PAQH/BAQDAgIEMA8GA1UdEwEB/wQFMAMBAf8wHQYDVR0OBBYEFK7ZOPXlxd78
xUpOGYDaqgC/sdevMA0GCSqGSIb3DQEBCwUAA4IBAQACLa2gNuIxQWf4qiCxsbIj
qddqbjHBGOWVAcyFRk/k7ydmellkI5BcMJEhlPT7TBUutcjvX8lCsup+xGy47NpH
hRp4hxUYodGXLXQ2HfI+3CgAARBEIBXjh/73UDFcMtH/G6EtGfFEw8ZgbyaDQ9Ft
c10h5QnbMUBFWdmvwSFvbJwZoTlFM+skogwv+d55sujZS83jbZHs7lZlDy0hDYIm
tMAWt4FEJnLPrfFtCFJgddiXDYGtX/Apvqac2riSAFg8mQB5WRtxKH7TK9Qhvca7
V/InYncUvcXt0M4JJSUJi/u6VBKSYYDIHt3mk9Le2qlMQuHkOQ1ZcuEOM2CU/KtO
-----END CERTIFICATE-----`,
		},
	}
}

func TestGetIstioConfigMap(t *testing.T) {
	assert := assert.New(t)
	require := require.New(t)

	meshYaml := `
discoverySelectors:
- matchLabels:
    mazzlabel1: mazzvalue1
    mazzlabel2: mazzvalue2
- matchExpressions:
  - key: mazzkey1
    operator: In
    values:
    - mazz1a
    - mazz1b
  - key: mazzkey2
    operator: In
    values:
    - mazz2a
    - mazz2b
`
	cm := corev1.ConfigMap{
		ObjectMeta: metav1.ObjectMeta{
			Name: "istio",
		},
		Data: map[string]string{
			"mesh": meshYaml,
		},
	}
	// this tests that we can unmarshal the k8s objects successfully (GetIstioConfigMap had to use the k8s yaml marshaller to get it to work)
	data := &models.MeshConfigMap{}
	err := parseIstioConfigMap(&cm, data)
	require.NoError(err, "Should not have got an error")
	require.Len(data.Mesh.DiscoverySelectors, 2, "Should have had 2 discovery selectors: %+v", data)

	assert.Len(data.Mesh.DiscoverySelectors[0].MatchExpressions, 0, "First selector should have no matchExpressions: %+v", data)
	assert.Len(data.Mesh.DiscoverySelectors[1].MatchLabels, 0, "Second selector should have no matchLabels: %+v", data)

	assert.Len(data.Mesh.DiscoverySelectors[0].MatchLabels, 2, "First selector should have matchLabels with 2 labels: %+v", data)
	assert.Equal("mazzvalue1", data.Mesh.DiscoverySelectors[0].MatchLabels["mazzlabel1"])
	assert.Equal("mazzvalue2", data.Mesh.DiscoverySelectors[0].MatchLabels["mazzlabel2"])

	assert.Len(data.Mesh.DiscoverySelectors[1].MatchExpressions, 2, "Second selector should have 2 matchExpressions: %+v", data)
	assert.Equal("mazzkey1", data.Mesh.DiscoverySelectors[1].MatchExpressions[0].Key)
	assert.Equal("mazzkey2", data.Mesh.DiscoverySelectors[1].MatchExpressions[1].Key)
}

func TestIstioConfigMapName(t *testing.T) {
	testCases := map[string]struct {
		configMapName string
		configMap     *corev1.ConfigMap
		expectErr     bool
	}{
		"ConfigMapName is empty and revision is default": {
			configMapName: "",
			configMap: &corev1.ConfigMap{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "istio",
					Namespace: "istio-system",
					Labels:    map[string]string{config.IstioRevisionLabel: "default"},
				},
				Data: map[string]string{"mesh": ""},
			},
		},
		"ConfigMapName is empty and revision is v1": {
			configMapName: "",
			configMap: &corev1.ConfigMap{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "istio-v1",
					Namespace: "istio-system",
					Labels:    map[string]string{config.IstioRevisionLabel: "v1"},
				},
				Data: map[string]string{"mesh": ""},
			},
		},
		"ConfigMapName is set and revision is default": {
			configMapName: "my-istio-config",
			configMap: &corev1.ConfigMap{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "istio",
					Namespace: "istio-system",
					Labels:    map[string]string{config.IstioRevisionLabel: "default"},
				},
				Data: map[string]string{"mesh": ""},
			},
			// An error occurs because the configMapName setting takes precedence over the revision label
			expectErr: true,
		},
		"ConfigMapName is set and revision is v2": {
			configMapName: "my-istio-config",
			configMap: &corev1.ConfigMap{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "istio-v2",
					Namespace: "istio-system",
					Labels:    map[string]string{config.IstioRevisionLabel: "v2"},
				},
				Data: map[string]string{"mesh": ""},
			},
			// An error occurs because the configMapName setting takes precedence over the revision label
			expectErr: true,
		},
		"ConfigMapName is set and revision is empty": {
			configMapName: "my-istio-config",
			configMap: &corev1.ConfigMap{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "istio",
					Namespace: "istio-system",
				},
				Data: map[string]string{"mesh": ""},
			},
			// An error occurs because the configMapName setting takes precedence over the revision label
			expectErr: true,
		},
	}

	for desc, tc := range testCases {
		t.Run(desc, func(t *testing.T) {
			require := require.New(t)
			conf := config.NewConfig()
			conf.ExternalServices.Istio.ConfigMapName = tc.configMapName
			k8s := kubetest.NewFakeK8sClient(
				kubetest.FakeNamespace("istio-system"),
				tc.configMap,
				FakeCertificateConfigMap("istio-system"),
			)

			clients := map[string]kubernetes.ClientInterface{conf.KubernetesConfig.ClusterName: k8s}
			cache := cache.NewTestingCacheWithClients(t, clients, *conf)
			discovery := NewDiscovery(clients, cache, conf)
			kubeCache, err := cache.GetKubeCache(conf.KubernetesConfig.ClusterName)
			require.NoError(err)

			controlPlane := &models.ControlPlane{
				Cluster:         &models.KubeCluster{Name: conf.KubernetesConfig.ClusterName},
				IstiodNamespace: "istio-system",
				Revision:        tc.configMap.Labels[config.IstioRevisionLabel],
				MeshConfig:      &models.MeshConfig{MeshConfig: &istiov1alpha1.MeshConfig{}},
			}
			err = discovery.setControlPlaneConfig(kubeCache, controlPlane)
			if tc.expectErr {
				require.Error(err)
			} else {
				require.NoError(err)
			}
		})
	}
}

func TestHangingOnGetVersionStillReturnsControlPlane(t *testing.T) {
	istiodDeployment := &appsv1.Deployment{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "istiod",
			Namespace: "istio-system",
			Labels: map[string]string{
				"app":                     "istiod",
				config.IstioRevisionLabel: "default",
			},
		},
	}
	const configMapData = `accessLogFile: /dev/stdout
enableAutoMtls: true
rootNamespace: istio-system
trustDomain: cluster.local
`
	istioConfigMap := &corev1.ConfigMap{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "istio",
			Namespace: "istio-system",
			Labels:    map[string]string{config.IstioRevisionLabel: "default"},
		},
		Data: map[string]string{"mesh": configMapData},
	}
	sideCarConfigMap := &corev1.ConfigMap{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "istio-sidecar-injector",
			Namespace: "istio-system",
		},
		Data: map[string]string{
			"values": "{ \"global\": { \"network\": \"kialiNetwork\" } }",
		},
	}

	require := require.New(t)
	conf := config.NewConfig()
	k8s := kubetest.NewFakeK8sClient(
		kubetest.FakeNamespace("istio-system"),
		istiodDeployment,
		istioConfigMap,
		sideCarConfigMap,
		FakeCertificateConfigMap("istio-system"),
	)
	cache := cache.NewTestingCache(t, k8s, *conf)

	old := getVersionTimeout
	t.Cleanup(func() {
		getVersionTimeout = old
	})
	getVersionTimeout = time.Nanosecond

	clients := map[string]kubernetes.ClientInterface{conf.KubernetesConfig.ClusterName: k8s}
	discovery := NewDiscovery(clients, cache, conf)
	mesh, err := discovery.Mesh(context.Background())
	require.NoError(err)
	require.Len(mesh.ControlPlanes, 1)
	require.Empty(mesh.ControlPlanes[0].Version)
}

func TestConvertToDiscoverySelectors(t *testing.T) {
	cases := map[string]struct {
		Selectors []*istiov1alpha1.LabelSelector
		Expected  config.DiscoverySelectorsType
	}{
		"Empty selector": {},
		"Selectors with match expression": {
			Selectors: []*istiov1alpha1.LabelSelector{{
				MatchExpressions: []*istiov1alpha1.LabelSelectorRequirement{{
					Key:      "env",
					Operator: "in",
					Values:   []string{"prod", "test"},
				}},
			}},
			Expected: config.DiscoverySelectorsType{{
				MatchExpressions: []metav1.LabelSelectorRequirement{{
					Key:      "env",
					Operator: "in",
					Values:   []string{"prod", "test"},
				}},
			}},
		},
		"Selectors with match labels": {
			Selectors: []*istiov1alpha1.LabelSelector{{
				MatchLabels: map[string]string{
					"env": "prod",
				},
			}},
			Expected: config.DiscoverySelectorsType{{
				MatchLabels: map[string]string{
					"env": "prod",
				},
			}},
		},
		"Selectors with both": {
			Selectors: []*istiov1alpha1.LabelSelector{{
				MatchExpressions: []*istiov1alpha1.LabelSelectorRequirement{{
					Key:      "env",
					Operator: "in",
					Values:   []string{"prod", "test"},
				}},
				MatchLabels: map[string]string{
					"env": "prod",
				},
			}},
			Expected: config.DiscoverySelectorsType{{
				MatchExpressions: []metav1.LabelSelectorRequirement{{
					Key:      "env",
					Operator: "in",
					Values:   []string{"prod", "test"},
				}},
				MatchLabels: map[string]string{
					"env": "prod",
				},
			}},
		},
	}

	for name, tc := range cases {
		t.Run(name, func(t *testing.T) {
			actual := convertToDiscoverySelectors(tc.Selectors)
			if diff := cmp.Diff(tc.Expected, actual); diff != "" {
				t.Fatal(diff)
			}
		})
	}
}
