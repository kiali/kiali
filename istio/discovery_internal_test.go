package istio

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kiali/kiali/config"
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
		conf     *config.Config
		revision string
		expected string
	}{
		"ConfigMapName is empty and revision is default": {
			conf: &config.Config{
				ExternalServices: config.ExternalServices{
					Istio: config.IstioConfig{
						ConfigMapName: "",
					},
				},
			},
			revision: "default",
			expected: "istio",
		},
		"ConfigMapName is empty and revision is v1": {
			conf: &config.Config{
				ExternalServices: config.ExternalServices{
					Istio: config.IstioConfig{
						ConfigMapName: "",
					},
				},
			},
			revision: "v1",
			expected: "istio-v1",
		},
		"ConfigMapName is set and revision is default": {
			conf: &config.Config{
				ExternalServices: config.ExternalServices{
					Istio: config.IstioConfig{
						ConfigMapName: "my-istio-config",
					},
				},
			},
			revision: "default",
			expected: "my-istio-config",
		},
		"ConfigMapName is set and revision is v2": {
			conf: &config.Config{
				ExternalServices: config.ExternalServices{
					Istio: config.IstioConfig{
						ConfigMapName: "my-istio-config",
					},
				},
			},
			revision: "v2",
			expected: "my-istio-config",
		},
		"ConfigMapName is set and revision is empty": {
			conf: &config.Config{
				ExternalServices: config.ExternalServices{
					Istio: config.IstioConfig{
						ConfigMapName: "my-istio-config",
					},
				},
			},
			revision: "",
			expected: "my-istio-config",
		},
	}

	for desc, tc := range testCases {
		t.Run(desc, func(t *testing.T) {
			result := istioConfigMapName(tc.conf, tc.revision)
			assert.Equal(t, tc.expected, result)
		})
	}
}
