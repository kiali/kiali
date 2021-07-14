package business

import (
	"net/http/httptest"
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
	"gopkg.in/yaml.v2"
	apps_v1 "k8s.io/api/apps/v1"
	core_v1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/errors"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/rest"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
)

func TestGetClustersResolvesTheKialiCluster(t *testing.T) {
	check := assert.New(t)

	k8s := new(kubetest.K8SClientMock)
	conf := config.NewConfig()
	conf.InCluster = false
	conf.KubernetesConfig.CacheEnabled = false
	config.Set(conf)

	// As we are not interested in caches in this test, make sure
	// there are no cached values
	kialiControlPlaneClusterCached = false
	kialiControlPlaneCluster = nil
	isMeshConfiguredCached = false
	isMeshConfigured = false

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

	sidecarConfigMapMock := core_v1.ConfigMap{
		Data: map[string]string{
			"values": "{ \"global\": { \"network\": \"kialiNetwork\" } }",
		},
	}

	kialiNs := core_v1.Namespace{
		ObjectMeta: v1.ObjectMeta{Name: "foo"},
	}

	kialiSvc := []core_v1.Service{
		{
			ObjectMeta: v1.ObjectMeta{
				Annotations: map[string]string{
					"operator-sdk/primary-resource": "kiali-operator/myKialiCR",
				},
				Labels: map[string]string{
					"app.kubernetes.io/version": "v1.25",
				},
				Name:      "kiali-service",
				Namespace: "foo",
			},
		},
	}

	k8s.On("IsOpenShift").Return(false)
	k8s.On("GetSecrets", conf.IstioNamespace, "istio/multiCluster=true").Return([]core_v1.Secret{}, nil)
	k8s.On("GetDeployment", conf.IstioNamespace, conf.ExternalServices.Istio.IstiodDeploymentName).Return(&istioDeploymentMock, nil)
	k8s.On("GetConfigMap", conf.IstioNamespace, conf.ExternalServices.Istio.IstioSidecarInjectorConfigMapName).Return(&sidecarConfigMapMock, nil)

	k8s.On("GetNamespace", "foo").Return(&kialiNs, nil)
	k8s.On("GetServicesByLabels", "foo", "app.kubernetes.io/part-of=kiali").Return(kialiSvc, nil)

	os.Setenv("KUBERNETES_SERVICE_HOST", "127.0.0.2")
	os.Setenv("KUBERNETES_SERVICE_PORT", "9443")
	os.Setenv("ACTIVE_NAMESPACE", "foo")

	layer := NewWithBackends(k8s, nil, nil)
	meshSvc := layer.Mesh

	r := httptest.NewRequest("GET", "http://kiali.url.local/", nil)
	a, err := meshSvc.GetClusters(r)
	check.Nil(err, "GetClusters returned error: %v", err)

	check.NotNil(a, "GetClusters returned nil")
	check.Len(a, 1, "GetClusters didn't resolve the Kiali cluster")
	check.Equal("KialiCluster", a[0].Name, "Unexpected cluster name")
	check.True(a[0].IsKialiHome, "Kiali cluster not properly marked as such")
	check.Equal("http://127.0.0.2:9443", a[0].ApiEndpoint)
	check.Len(a[0].SecretName, 0)
	check.Equal("kialiNetwork", a[0].Network)

	check.Len(a[0].KialiInstances, 1, "GetClusters didn't resolve the local Kiali instance")
	check.Equal("foo", a[0].KialiInstances[0].Namespace, "GetClusters didn't set the right namespace of the Kiali instance")
	check.Equal("kiali-operator/myKialiCR", a[0].KialiInstances[0].OperatorResource, "GetClusters didn't set the right operator resource of the Kiali instance")
	check.Equal("http://kiali.url.local", a[0].KialiInstances[0].Url, "GetClusters didn't set the right URL of the Kiali instance")
	check.Equal("v1.25", a[0].KialiInstances[0].Version, "GetClusters didn't set the right version of the Kiali instance")
	check.Equal("kiali-service", a[0].KialiInstances[0].ServiceName, "GetClusters didn't set the right service name of the Kiali instance")
}

func TestGetClustersResolvesRemoteClusters(t *testing.T) {
	check := assert.New(t)

	k8s := new(kubetest.K8SClientMock)
	conf := config.NewConfig()
	conf.InCluster = false
	conf.KubernetesConfig.CacheEnabled = false
	config.Set(conf)

	// As we are not interested in caches in this test, make sure
	// there are no cached values
	kialiControlPlaneClusterCached = false
	kialiControlPlaneCluster = nil
	isMeshConfiguredCached = false
	isMeshConfigured = false

	remoteSecretData := kubernetes.RemoteSecret{
		Clusters: []kubernetes.RemoteSecretClusterListItem{
			{
				Name: "KialiCluster",
				Cluster: kubernetes.RemoteSecretCluster{
					CertificateAuthorityData: "eAo=",
					Server:                   "https://192.168.144.17:123",
				},
			},
		},
		Users: []kubernetes.RemoteSecretUser{
			{
				Name: "foo",
				User: kubernetes.RemoteSecretUserToken{
					Token: "bar",
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

	newRemoteClient := func(config *rest.Config) (kubernetes.ClientInterface, error) {
		remoteClient := new(kubetest.K8SClientMock)

		remoteNs := &core_v1.Namespace{
			ObjectMeta: v1.ObjectMeta{
				Labels: map[string]string{"topology.istio.io/network": "TheRemoteNetwork"},
				Name:   conf.IstioNamespace,
			},
		}

		kialiSvc := []core_v1.Service{
			{
				ObjectMeta: v1.ObjectMeta{
					Annotations: map[string]string{
						"operator-sdk/primary-resource": "kiali-operator/myKialiCR",
					},
					Labels: map[string]string{
						"app.kubernetes.io/version": "v1.25",
					},
					Name:      "kiali-service",
					Namespace: conf.IstioNamespace,
				},
			},
		}

		os.Setenv("ACTIVE_NAMESPACE", "foo")

		remoteClient.On("GetNamespace", conf.IstioNamespace).Return(remoteNs, nil)
		remoteClient.On("GetClusterServicesByLabels", "app.kubernetes.io/part-of=kiali").Return(kialiSvc, nil)

		return remoteClient, nil
	}

	layer := NewWithBackends(k8s, nil, nil)
	meshSvc := layer.Mesh
	meshSvc.newRemoteClient = newRemoteClient

	a, err := meshSvc.GetClusters(nil)
	check.Nil(err, "GetClusters returned error: %v", err)

	check.NotNil(a, "GetClusters returned nil")
	check.Len(a, 1, "GetClusters didn't resolve the remote clusters")
	check.Equal("KialiCluster", a[0].Name, "Unexpected cluster name")
	check.False(a[0].IsKialiHome, "Remote cluster mistakenly marked as the Kiali home")
	check.Equal("https://192.168.144.17:123", a[0].ApiEndpoint)
	check.Equal("TheRemoteSecret", a[0].SecretName)
	check.Equal("TheRemoteNetwork", a[0].Network)

	check.Len(a[0].KialiInstances, 1, "GetClusters didn't resolve the remote Kiali instance")
	check.Equal(conf.IstioNamespace, a[0].KialiInstances[0].Namespace, "GetClusters didn't set the right namespace of the Kiali instance")
	check.Equal("kiali-operator/myKialiCR", a[0].KialiInstances[0].OperatorResource, "GetClusters didn't set the right operator resource of the Kiali instance")
	check.Equal("", a[0].KialiInstances[0].Url, "GetClusters didn't set the right URL of the Kiali instance")
	check.Equal("v1.25", a[0].KialiInstances[0].Version, "GetClusters didn't set the right version of the Kiali instance")
	check.Equal("kiali-service", a[0].KialiInstances[0].ServiceName, "GetClusters didn't set the right service name of the Kiali instance")
}

// TestIsMeshConfiguredIsCached verifies that IsMeshConfigured is properly caching
// it's findings and the cached value is being returned.
func TestIsMeshConfiguredIsCached(t *testing.T) {
	check := assert.New(t)

	// Make sure cache is empty
	kialiControlPlaneClusterCached = false
	kialiControlPlaneCluster = nil
	isMeshConfiguredCached = false
	isMeshConfigured = false

	// Prepare mocks for first time call.
	k8s := new(kubetest.K8SClientMock)
	conf := config.NewConfig()
	conf.InCluster = false
	conf.IstioNamespace = "foo"
	conf.ExternalServices.Istio.ConfigMapName = "bar"
	conf.KubernetesConfig.CacheEnabled = false
	config.Set(conf)

	istioConfigMapMock := core_v1.ConfigMap{
		Data: map[string]string{
			"mesh": "{ \"defaultConfig\": { \"meshId\": \"kialiMesh\" } }",
		},
	}

	k8s.On("IsOpenShift").Return(false)
	k8s.On("GetConfigMap", "foo", "bar").Return(&istioConfigMapMock, nil)

	// Create a MeshService and invoke IsMeshConfigured
	layer := NewWithBackends(k8s, nil, nil)
	meshSvc := layer.Mesh
	result, err := meshSvc.IsMeshConfigured()
	check.Nil(err, "IsMeshConfigured failed: %s", err)
	check.True(result)

	// Create a new MeshService with an empty mock. If cached value is properly used, the
	// empty mock should never be called and we still should get a value.
	k8s = new(kubetest.K8SClientMock)
	k8s.On("IsOpenShift").Return(false)

	layer = NewWithBackends(k8s, nil, nil)
	meshSvc = layer.Mesh
	result, err = meshSvc.IsMeshConfigured()
	check.Nil(err, "IsMeshConfigured failed: %s", err)
	check.True(result)
}

// TestResolveKialiControlPlaneClusterIsCached verifies that ResolveKialiControlPlaneCluster
// is properly caching it's findings and the cached value is being returned.
func TestResolveKialiControlPlaneClusterIsCached(t *testing.T) {
	check := assert.New(t)

	// Make sure cache is empty
	kialiControlPlaneClusterCached = false
	kialiControlPlaneCluster = nil
	isMeshConfiguredCached = false
	isMeshConfigured = false

	// Prepare mocks for first time call.
	k8s := new(kubetest.K8SClientMock)
	conf := config.NewConfig()
	conf.InCluster = false
	conf.IstioNamespace = "foo"
	conf.ExternalServices.Istio.IstiodDeploymentName = "bar"
	conf.KubernetesConfig.CacheEnabled = false
	config.Set(conf)

	os.Setenv("ACTIVE_NAMESPACE", "foo")

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

	notFoundErr := errors.StatusError{
		ErrStatus: v1.Status{
			Reason: v1.StatusReasonNotFound,
		},
	}

	var nilConfigMap *core_v1.ConfigMap
	var nilNamespace *core_v1.Namespace

	k8s.On("IsOpenShift").Return(false)
	k8s.On("GetDeployment", "foo", "bar").Return(&istioDeploymentMock, nil)
	k8s.On("GetConfigMap", "foo", conf.ExternalServices.Istio.IstioSidecarInjectorConfigMapName).Return(nilConfigMap, &notFoundErr)
	k8s.On("GetNamespace", "foo").Return(nilNamespace, &notFoundErr)

	// Create a MeshService and invoke IsMeshConfigured
	layer := NewWithBackends(k8s, nil, nil)
	meshSvc := layer.Mesh
	result, err := meshSvc.ResolveKialiControlPlaneCluster(nil)
	check.Nil(err, "ResolveKialiControlPlaneCluster failed: %s", err)
	check.NotNil(result)
	check.Equal("KialiCluster", result.Name) // Sanity check. Rest of values are tested in TestGetClustersResolvesTheKialiCluster

	// Create a new MeshService with an empty mock. If cached value is properly used, the
	// empty mock should never be called and we still should get a value.
	k8s = new(kubetest.K8SClientMock)
	k8s.On("IsOpenShift").Return(false)

	layer = NewWithBackends(k8s, nil, nil)
	meshSvc = layer.Mesh
	result, err = meshSvc.ResolveKialiControlPlaneCluster(nil)
	check.Nil(err, "ResolveKialiControlPlaneCluster failed: %s", err)
	check.NotNil(result)
	check.Equal("KialiCluster", result.Name)
}
