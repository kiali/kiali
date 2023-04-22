package kubernetes_test

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apps_v1 "k8s.io/api/apps/v1"
	core_v1 "k8s.io/api/core/v1"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
)

func TestGetIstioConfigMap(t *testing.T) {
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
	cm := core_v1.ConfigMap{
		ObjectMeta: meta_v1.ObjectMeta{
			Name: "istio",
		},
		Data: map[string]string{
			"mesh": meshYaml,
		},
	}
	// this tests that we can unmarshal the k8s objects successfully (GetIstioConfigMap had to use the k8s yaml marshaller to get it to work)
	data, err := kubernetes.GetIstioConfigMap(&cm)
	assert.Nil(t, err, "Should not have got an error")
	assert.Len(t, data.DiscoverySelectors, 2, "Should have had 2 discovery selectors: %+v", data)

	assert.Len(t, data.DiscoverySelectors[0].MatchExpressions, 0, "First selector should have no matchExpressions: %+v", data)
	assert.Len(t, data.DiscoverySelectors[1].MatchLabels, 0, "Second selector should have no matchLabels: %+v", data)

	assert.Len(t, data.DiscoverySelectors[0].MatchLabels, 2, "First selector should have matchLabels with 2 labels: %+v", data)
	assert.Equal(t, "mazzvalue1", data.DiscoverySelectors[0].MatchLabels["mazzlabel1"])
	assert.Equal(t, "mazzvalue2", data.DiscoverySelectors[0].MatchLabels["mazzlabel2"])

	assert.Len(t, data.DiscoverySelectors[1].MatchExpressions, 2, "Second selector should have 2 matchExpressions: %+v", data)
	assert.Equal(t, "mazzkey1", data.DiscoverySelectors[1].MatchExpressions[0].Key)
	assert.Equal(t, "mazzkey2", data.DiscoverySelectors[1].MatchExpressions[1].Key)
}

func TestGetClusterInfoFromIstiod(t *testing.T) {
	require := require.New(t)
	assert := assert.New(t)

	conf := config.NewConfig()
	k8s := kubetest.NewFakeK8sClient(
		&core_v1.Namespace{ObjectMeta: meta_v1.ObjectMeta{Name: "istio-system"}},
		&apps_v1.Deployment{
			ObjectMeta: meta_v1.ObjectMeta{
				Name:      "istiod",
				Namespace: "istio-system",
			},
			Spec: apps_v1.DeploymentSpec{
				Template: core_v1.PodTemplateSpec{
					Spec: core_v1.PodSpec{
						Containers: []core_v1.Container{
							{
								Name: "istiod",
								Env: []core_v1.EnvVar{
									{
										Name:  "CLUSTER_ID",
										Value: "east",
									},
									{
										Name:  "PILOT_SCOPE_GATEWAY_TO_NAMESPACE",
										Value: "true",
									},
								},
							},
						},
					},
				},
			},
		},
	)
	clusterID, pilotScope, err := kubernetes.ClusterInfoFromIstiod(*conf, k8s)
	require.NoError(err)

	assert.Equal("east", clusterID)
	assert.True(pilotScope)
}

func TestGetClusterInfoFromIstiodFails(t *testing.T) {
	require := require.New(t)

	conf := config.NewConfig()
	k8s := kubetest.NewFakeK8sClient(
		&core_v1.Namespace{ObjectMeta: meta_v1.ObjectMeta{Name: "istio-system"}},
		&apps_v1.Deployment{
			ObjectMeta: meta_v1.ObjectMeta{
				Name:      "istiod",
				Namespace: "istio-system",
			},
			Spec: apps_v1.DeploymentSpec{
				Template: core_v1.PodTemplateSpec{
					Spec: core_v1.PodSpec{
						Containers: []core_v1.Container{
							{
								Name: "istiod",
								Env:  []core_v1.EnvVar{},
							},
						},
					},
				},
			},
		},
	)
	_, _, err := kubernetes.ClusterInfoFromIstiod(*conf, k8s)
	require.Error(err)
}
