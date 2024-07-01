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
				Labels:    map[string]string{"app": "istiod"},
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
								},
							},
						},
					},
				},
			},
		},
	)
	clusterID, err := kubernetes.ClusterNameFromIstiod(*conf, k8s)
	require.NoError(err)

	assert.Equal("east", clusterID)
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
	_, err := kubernetes.ClusterNameFromIstiod(*conf, k8s)
	require.Error(err)
}

func TestClusterNameFromIstiodUsesConfigWhenSet(t *testing.T) {
	require := require.New(t)

	conf := config.NewConfig()
	conf.ExternalServices.Istio.IstiodDeploymentName = "different-istiod"
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
								// In reality both should have the same cluster id but want to test that the config is used.
								Env: []core_v1.EnvVar{{Name: "CLUSTER_ID", Value: "east"}},
							},
						},
					},
				},
			},
		},
		&apps_v1.Deployment{
			ObjectMeta: meta_v1.ObjectMeta{
				Name:      "different-istiod",
				Namespace: "istio-system",
			},
			Spec: apps_v1.DeploymentSpec{
				Template: core_v1.PodTemplateSpec{
					Spec: core_v1.PodSpec{
						Containers: []core_v1.Container{
							{
								Name: "istiod",
								Env:  []core_v1.EnvVar{{Name: "CLUSTER_ID", Value: "west"}},
							},
						},
					},
				},
			},
		},
	)

	clusterName, err := kubernetes.ClusterNameFromIstiod(*conf, k8s)
	require.NoError(err)

	require.Equal("west", clusterName)
}

func TestClusterNameFromIstiodResolvesClusterWithoutConfig(t *testing.T) {
	require := require.New(t)

	conf := config.NewConfig()
	conf.ExternalServices.Istio.IstiodDeploymentName = ""
	k8s := kubetest.NewFakeK8sClient(
		&core_v1.Namespace{ObjectMeta: meta_v1.ObjectMeta{Name: "istio-system"}},
		&apps_v1.Deployment{
			ObjectMeta: meta_v1.ObjectMeta{
				Name:      "istiod",
				Namespace: "istio-system",
				Labels:    map[string]string{"app": "istiod"},
			},
			Spec: apps_v1.DeploymentSpec{
				Template: core_v1.PodTemplateSpec{
					Spec: core_v1.PodSpec{
						Containers: []core_v1.Container{
							{
								Name: "istiod",
								// In reality both should have the same cluster id but want to test that the config is used.
								Env: []core_v1.EnvVar{{Name: "CLUSTER_ID", Value: "east"}},
							},
						},
					},
				},
			},
		},
		&apps_v1.Deployment{
			ObjectMeta: meta_v1.ObjectMeta{
				Name:      "different-istiod",
				Namespace: "istio-system",
				Labels:    map[string]string{"app": "istiod"},
			},
			Spec: apps_v1.DeploymentSpec{
				Template: core_v1.PodTemplateSpec{
					Spec: core_v1.PodSpec{
						Containers: []core_v1.Container{
							{
								Name: "istiod",
								Env:  []core_v1.EnvVar{{Name: "CLUSTER_ID", Value: "west"}},
							},
						},
					},
				},
			},
		},
	)

	clusterName, err := kubernetes.ClusterNameFromIstiod(*conf, k8s)
	require.NoError(err)

	require.Equal("west", clusterName)
}
