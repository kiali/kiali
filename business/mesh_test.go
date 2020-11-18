package business

import (
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
	"gopkg.in/yaml.v2"
	apps_v1 "k8s.io/api/apps/v1"
	core_v1 "k8s.io/api/core/v1"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
)

func TestGetClustersResolvesTheKialiCluster(t *testing.T) {
	check := assert.New(t)

	k8s := new(kubetest.K8SClientMock)
	conf := config.NewConfig()
	conf.InCluster = false
	config.Set(conf)

	istioDeploymentMock := apps_v1.Deployment{
		Spec: apps_v1.DeploymentSpec{
			Template: core_v1.PodTemplateSpec{
				Spec: core_v1.PodSpec{
					Containers: []core_v1.Container{
						{
							Env: []core_v1.EnvVar{
								{
									Name:  "CLUSTER_ID",
									Value: "KialiCluster",
								},
							},
						},
					},
				},
			},
		},
	}

	k8s.On("IsOpenShift").Return(false)
	k8s.On("GetSecrets", conf.IstioNamespace, "istio/multiCluster=true").Return([]core_v1.Secret{}, nil)
	k8s.On("GetDeployment", conf.IstioNamespace, "istiod").Return(&istioDeploymentMock, nil)

	os.Setenv("KUBERNETES_SERVICE_HOST", "127.0.0.2")
	os.Setenv("KUBERNETES_SERVICE_PORT", "9443")

	bsLayer := NewWithBackends(k8s, nil, nil)
	meshSvc := MeshService{k8s: k8s, businessLayer: bsLayer}

	a, err := meshSvc.GetClusters()
	check.Nil(err, "GetClusters returned error: %v", err)

	check.NotNil(a, "GetClusters returned nil")
	check.Len(a, 1, "GetClusters didn't resolve the Kiali cluster")
	check.Equal("KialiCluster", a[0].Name, "Unexpected cluster name")
	check.True(a[0].IsKialiHome, "Kiali cluster not properly marked as such")
	check.Equal("http://127.0.0.2:9443", a[0].ApiEndpoint)
	check.Len(a[0].SecretName, 0)
}

func TestGetClustersResolvesRemoteClusters(t *testing.T) {
	check := assert.New(t)

	k8s := new(kubetest.K8SClientMock)
	conf := config.NewConfig()
	conf.InCluster = false
	config.Set(conf)

	remoteSecretData := kubernetes.RemoteSecret{
		Clusters: []kubernetes.RemoteSecretClusterListItem{
			{
				Name: "KialiCluster",
				Cluster: kubernetes.RemoteSecretCluster{
					CertificateAuthorityData: "foo",
					Server:                   "https://192.168.144.17:123",
				},
			},
		},
	}
	marshalledRemoteSecretData, _ := yaml.Marshal(remoteSecretData)

	secretMock := core_v1.Secret{
		ObjectMeta: v1.ObjectMeta{
			Name: "TheRemoteSecret",
			Annotations: map[string]string{
				"networking.istio.io/cluster": "KialiCluster",
			},
		},
		Data: map[string][]byte{
			"KialiCluster": marshalledRemoteSecretData,
		},
	}

	var nilDeployment *apps_v1.Deployment
	k8s.On("IsOpenShift").Return(false)
	k8s.On("GetSecrets", conf.IstioNamespace, "istio/multiCluster=true").Return([]core_v1.Secret{secretMock}, nil)
	k8s.On("GetDeployment", conf.IstioNamespace, "istiod").Return(nilDeployment, nil)

	bsLayer := NewWithBackends(k8s, nil, nil)
	meshSvc := MeshService{k8s: k8s, businessLayer: bsLayer}

	a, err := meshSvc.GetClusters()
	check.Nil(err, "GetClusters returned error: %v", err)

	check.NotNil(a, "GetClusters returned nil")
	check.Len(a, 1, "GetClusters didn't resolve the remote clusters")
	check.Equal("KialiCluster", a[0].Name, "Unexpected cluster name")
	check.False(a[0].IsKialiHome, "Remote cluster mistakenly marked as the Kiali home")
	check.Equal("https://192.168.144.17:123", a[0].ApiEndpoint)
	check.Equal("TheRemoteSecret", a[0].SecretName)
}
