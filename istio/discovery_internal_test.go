package istio

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/cache"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/models"
)

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
	data, err := parseIstioConfigMap(&cm)
	require.NoError(err, "Should not have got an error")
	require.Len(data.DiscoverySelectors, 2, "Should have had 2 discovery selectors: %+v", data)

	assert.Len(data.DiscoverySelectors[0].MatchExpressions, 0, "First selector should have no matchExpressions: %+v", data)
	assert.Len(data.DiscoverySelectors[1].MatchLabels, 0, "Second selector should have no matchLabels: %+v", data)

	assert.Len(data.DiscoverySelectors[0].MatchLabels, 2, "First selector should have matchLabels with 2 labels: %+v", data)
	assert.Equal("mazzvalue1", data.DiscoverySelectors[0].MatchLabels["mazzlabel1"])
	assert.Equal("mazzvalue2", data.DiscoverySelectors[0].MatchLabels["mazzlabel2"])

	assert.Len(data.DiscoverySelectors[1].MatchExpressions, 2, "Second selector should have 2 matchExpressions: %+v", data)
	assert.Equal("mazzkey1", data.DiscoverySelectors[1].MatchExpressions[0].Key)
	assert.Equal("mazzkey2", data.DiscoverySelectors[1].MatchExpressions[1].Key)
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
					Labels:    map[string]string{models.IstioRevisionLabel: "default"},
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
					Labels:    map[string]string{models.IstioRevisionLabel: "v1"},
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
					Labels:    map[string]string{models.IstioRevisionLabel: "default"},
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
					Labels:    map[string]string{models.IstioRevisionLabel: "v2"},
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
			)

			clients := map[string]kubernetes.ClientInterface{conf.KubernetesConfig.ClusterName: k8s}
			cache := cache.NewTestingCacheWithClients(t, clients, *conf)
			discovery := NewDiscovery(clients, cache, conf)
			kubeCache, err := cache.GetKubeCache(conf.KubernetesConfig.ClusterName)
			require.NoError(err)

			controlPlane := &models.ControlPlane{
				Cluster:         &models.KubeCluster{Name: conf.KubernetesConfig.ClusterName},
				IstiodNamespace: "istio-system",
				Revision:        tc.configMap.Labels[models.IstioRevisionLabel],
			}
			_, err = discovery.getControlPlaneConfiguration(kubeCache, controlPlane)
			if tc.expectErr {
				require.Error(err)
			} else {
				require.NoError(err)
			}
		})
	}
}
