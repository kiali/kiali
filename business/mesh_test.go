package business

import (
	"fmt"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gopkg.in/yaml.v2"
	apps_v1 "k8s.io/api/apps/v1"
	core_v1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/api/resource"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/rest"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/models"
)

// Setup Mesh cache to avoid duplicate mesh_test.go logic into other business/*_test.go
func setupGlobalMeshConfig() {
	SetKialiControlPlaneCluster(&Cluster{
		Name: DefaultClusterID,
	})
}

func TestGetClustersResolvesTheKialiCluster(t *testing.T) {
	check := assert.New(t)

	k8s := new(kubetest.K8SClientMock)
	conf := config.NewConfig()
	conf.InCluster = false
	conf.KubernetesConfig.CacheEnabled = false
	conf.KubernetesConfig.ClusterName = "KialiCluster"
	kialiCache = nil
	config.Set(conf)

	// As we are not interested in caches in this test, make sure
	// there are no cached values
	kialiControlPlaneClusterCached = false
	kialiControlPlaneCluster = nil
	isMeshConfiguredCached = false
	isMeshConfigured = false

	// If this folder is present in your local environment, it will cause the test to fail.
	// Setting this to a tmp folder to avoid that.
	remoteSecretsDir := kubernetes.RemoteClusterSecretsDir
	t.Cleanup(func() {
		kubernetes.RemoteClusterSecretsDir = remoteSecretsDir
	})
	kubernetes.RemoteClusterSecretsDir = t.TempDir()

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
	k8s.On("IsGatewayAPI").Return(false)
	k8s.On("GetSecrets", conf.IstioNamespace, "istio/multiCluster=true").Return([]core_v1.Secret{}, nil)
	k8s.On("GetDeployment", conf.IstioNamespace, conf.ExternalServices.Istio.IstiodDeploymentName).Return(&istioDeploymentMock, nil)
	k8s.On("GetConfigMap", conf.IstioNamespace, conf.ExternalServices.Istio.IstioSidecarInjectorConfigMapName).Return(&sidecarConfigMapMock, nil)

	k8s.On("GetNamespace", "foo").Return(&kialiNs, nil)
	k8s.On("GetServicesByLabels").Return(kialiSvc, nil)
	k8s.On("GetServicesByLabels", "foo", "app.kubernetes.io/part-of=kiali").Return(kialiSvc, nil)

	t.Setenv("KUBERNETES_SERVICE_HOST", "127.0.0.2")
	t.Setenv("KUBERNETES_SERVICE_PORT", "9443")
	t.Setenv("ACTIVE_NAMESPACE", "foo")
	mockClientFactory := kubetest.NewK8SClientFactoryMock(k8s)
	SetWithBackends(mockClientFactory, nil)

	layer := NewWithBackends(mockClientFactory.Clients, mockClientFactory.Clients, nil, nil)
	meshSvc := layer.Mesh

	r := httptest.NewRequest("GET", "http://kiali.url.local/", nil)
	a, err := meshSvc.GetClusters(r)
	check.Nil(err, "GetClusters returned error: %v", err)

	check.NotNil(a, "GetClusters returned nil")
	check.Len(a, 1, "GetClusters didn't resolve the Kiali cluster")
	check.Equal("KialiCluster", a[0].Name, "Unexpected cluster name")
	check.True(a[0].IsKialiHome, "Kiali cluster not properly marked as such")
	check.True(a[0].IsGatewayToNamespace, "Kiali GatewayToNamespace not properly marked as such")
	check.Equal("http://127.0.0.2:9443", a[0].ApiEndpoint)
	check.Equal("kialiNetwork", a[0].Network)

	check.Len(a[0].KialiInstances, 1, "GetClusters didn't resolve the local Kiali instance")
	check.Equal("foo", a[0].KialiInstances[0].Namespace, "GetClusters didn't set the right namespace of the Kiali instance")
	check.Equal("kiali-operator/myKialiCR", a[0].KialiInstances[0].OperatorResource, "GetClusters didn't set the right operator resource of the Kiali instance")
	check.Equal("http://kiali.url.local", a[0].KialiInstances[0].Url, "GetClusters didn't set the right URL of the Kiali instance")
	check.Equal("v1.25", a[0].KialiInstances[0].Version, "GetClusters didn't set the right version of the Kiali instance")
	check.Equal("kiali-service", a[0].KialiInstances[0].ServiceName, "GetClusters didn't set the right service name of the Kiali instance")
}

func TestGetClustersResolvesRemoteClusters(t *testing.T) {
	// create a mock volume mount directory where the test remote cluster secret content will go
	originalRemoteClusterSecretsDir := kubernetes.RemoteClusterSecretsDir
	defer func(dir string) {
		kubernetes.RemoteClusterSecretsDir = dir
	}(originalRemoteClusterSecretsDir)
	kubernetes.RemoteClusterSecretsDir = t.TempDir()

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
	createTestRemoteClusterSecretFile(t, kubernetes.RemoteClusterSecretsDir, "KialiCluster", string(marshalledRemoteSecretData))

	var nilDeployment *apps_v1.Deployment
	k8s.On("IsOpenShift").Return(false)
	k8s.On("IsGatewayAPI").Return(false)
	k8s.On("GetDeployment", conf.IstioNamespace, "istiod").Return(nilDeployment, errors.NewNotFound(schema.GroupResource{Group: "apps", Resource: "deployments"}, "istiod"))

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

		t.Setenv("ACTIVE_NAMESPACE", "foo")

		remoteClient.On("GetNamespace", conf.IstioNamespace).Return(remoteNs, nil)
		remoteClient.On("GetClusterServicesByLabels", "app.kubernetes.io/part-of=kiali").Return(kialiSvc, nil)

		return remoteClient, nil
	}

	clients := make(map[string]kubernetes.ClientInterface)
	clients[kubernetes.HomeClusterName] = k8s
	layer := NewWithBackends(clients, clients, nil, nil)
	meshSvc := layer.Mesh
	meshSvc.newRemoteClient = newRemoteClient

	a, err := meshSvc.GetClusters(nil)
	check.Nil(err, "GetClusters returned error: %v", err)

	check.NotNil(a, "GetClusters returned nil")
	check.Len(a, 1, "GetClusters didn't resolve the remote clusters")
	check.Equal("KialiCluster", a[0].Name, "Unexpected cluster name")
	check.False(a[0].IsKialiHome, "Remote cluster mistakenly marked as the Kiali home")
	check.Equal("https://192.168.144.17:123", a[0].ApiEndpoint)
	check.Equal("TheRemoteNetwork", a[0].Network)

	check.Len(a[0].KialiInstances, 1, "GetClusters didn't resolve the remote Kiali instance")
	check.Equal(conf.IstioNamespace, a[0].KialiInstances[0].Namespace, "GetClusters didn't set the right namespace of the Kiali instance")
	check.Equal("kiali-operator/myKialiCR", a[0].KialiInstances[0].OperatorResource, "GetClusters didn't set the right operator resource of the Kiali instance")
	check.Equal("", a[0].KialiInstances[0].Url, "GetClusters didn't set the right URL of the Kiali instance")
	check.Equal("v1.25", a[0].KialiInstances[0].Version, "GetClusters didn't set the right version of the Kiali instance")
	check.Equal("kiali-service", a[0].KialiInstances[0].ServiceName, "GetClusters didn't set the right service name of the Kiali instance")
}

func createTestRemoteClusterSecretFile(t *testing.T, parentDir string, name string, content string) {
	childDir := fmt.Sprintf("%s/%s", parentDir, name)
	filename := fmt.Sprintf("%s/%s", childDir, name)
	if err := os.MkdirAll(childDir, 0o777); err != nil {
		t.Fatalf("Failed to create tmp remote cluster secret dir [%v]: %v", childDir, err)
	}
	f, err := os.Create(filename)
	if err != nil {
		t.Fatalf("Failed to create tmp remote cluster secret file [%v]: %v", filename, err)
	}
	defer f.Close()
	if _, err2 := f.WriteString(content); err2 != nil {
		t.Fatalf("Failed to write tmp remote cluster secret file [%v]: %v", filename, err2)
	}
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
	k8s.On("IsGatewayAPI").Return(false)
	k8s.On("GetConfigMap", "foo", "bar").Return(&istioConfigMapMock, nil)

	clients := make(map[string]kubernetes.ClientInterface)
	clients[kubernetes.HomeClusterName] = k8s
	// Create a MeshService and invoke IsMeshConfigured
	layer := NewWithBackends(clients, clients, nil, nil)
	meshSvc := layer.Mesh
	result, err := meshSvc.IsMeshConfigured()
	check.Nil(err, "IsMeshConfigured failed: %s", err)
	check.True(result)

	// Create a new MeshService with an empty mock. If cached value is properly used, the
	// empty mock should never be called and we still should get a value.
	k8s = new(kubetest.K8SClientMock)
	k8s.On("IsOpenShift").Return(false)
	k8s.On("IsGatewayAPI").Return(false)

	k8sclients := make(map[string]kubernetes.ClientInterface)
	k8sclients[kubernetes.HomeClusterName] = k8s
	layer = NewWithBackends(k8sclients, k8sclients, nil, nil)
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

	t.Setenv("KUBERNETES_SERVICE_HOST", "127.0.0.2")
	t.Setenv("KUBERNETES_SERVICE_PORT", "9443")
	t.Setenv("ACTIVE_NAMESPACE", "foo")

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
								{
									Name:  "PILOT_SCOPE_GATEWAY_TO_NAMESPACE",
									Value: "false",
								},
							},
						},
					},
				},
			},
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
				Namespace: "foo",
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
	k8s.On("IsGatewayAPI").Return(false)
	k8s.On("GetDeployment", "foo", "bar").Return(&istioDeploymentMock, nil)
	k8s.On("GetConfigMap", "foo", conf.ExternalServices.Istio.IstioSidecarInjectorConfigMapName).Return(nilConfigMap, &notFoundErr)
	k8s.On("GetNamespace", "foo").Return(nilNamespace, &notFoundErr)
	k8s.On("GetServicesByLabels", "foo", "app.kubernetes.io/part-of=kiali").Return(kialiSvc, nil)

	// Create a MeshService and invoke IsMeshConfigured
	clients := make(map[string]kubernetes.ClientInterface)
	clients[kubernetes.HomeClusterName] = k8s
	clients["KialiCluster"] = k8s
	layer := NewWithBackends(clients, clients, nil, nil)
	meshSvc := layer.Mesh
	result, err := meshSvc.ResolveKialiControlPlaneCluster(nil)
	check.Nil(err, "ResolveKialiControlPlaneCluster failed: %s", err)
	check.NotNil(result)
	check.Equal("KialiCluster", result.Name) // Sanity check. Rest of values are tested in TestGetClustersResolvesTheKialiCluster
	check.False(result.IsGatewayToNamespace, "Kiali GatewayToNamespace not properly marked as such")

	// Create a new MeshService with an empty mock. If cached value is properly used, the
	// empty mock should never be called and we still should get a value.
	k8s = new(kubetest.K8SClientMock)
	k8s.On("IsOpenShift").Return(false)
	k8s.On("IsGatewayAPI").Return(false)

	k8sclients := make(map[string]kubernetes.ClientInterface)
	k8sclients[kubernetes.HomeClusterName] = k8s
	layer = NewWithBackends(k8sclients, k8sclients, nil, nil)
	meshSvc = layer.Mesh
	result, err = meshSvc.ResolveKialiControlPlaneCluster(nil)
	check.Nil(err, "ResolveKialiControlPlaneCluster failed: %s", err)
	check.NotNil(result)
	check.Equal("KialiCluster", result.Name)
}

// TestCanaryUpgradeNotConfigured verifies that when there is no canary upgrade configured, both the migrated and pending namespace lists are empty
func TestCanaryUpgradeNotConfigured(t *testing.T) {
	check := assert.New(t)

	k8s := new(kubetest.K8SClientMock)
	conf := config.NewConfig()
	conf.ExternalServices.Istio.IstioCanaryRevision.Current = "default"
	conf.ExternalServices.Istio.IstioCanaryRevision.Upgrade = "canary"

	config.Set(conf)

	k8s.On("IsOpenShift").Return(false)
	k8s.On("IsGatewayAPI").Return(false)
	k8s.On("GetNamespaces", "istio-injection=enabled").Return([]core_v1.Namespace{}, nil)
	k8s.On("GetNamespaces", "istio.io/rev=default").Return([]core_v1.Namespace{}, nil)
	k8s.On("GetNamespaces", "istio.io/rev=canary").Return([]core_v1.Namespace{}, nil)

	// Create a MeshService and invoke IsMeshConfigured
	k8sclients := make(map[string]kubernetes.ClientInterface)
	k8sclients[kubernetes.HomeClusterName] = k8s
	layer := NewWithBackends(k8sclients, k8sclients, nil, nil)
	meshSvc := layer.Mesh

	canaryUpgradeStatus, err := meshSvc.CanaryUpgradeStatus()

	check.Nil(err, "IstiodCanariesStatus failed: %s", err)
	check.NotNil(canaryUpgradeStatus)
}

// TestCanaryUpgradeConfigured verifies that when there is a canary upgrade in place, the migrated and pending namespaces should have namespaces
func TestCanaryUpgradeConfigured(t *testing.T) {
	check := assert.New(t)

	k8s := new(kubetest.K8SClientMock)
	conf := config.NewConfig()
	conf.ExternalServices.Istio.IstioCanaryRevision.Current = "default"
	conf.ExternalServices.Istio.IstioCanaryRevision.Upgrade = "canary"

	config.Set(conf)

	k8s.On("IsOpenShift").Return(false)
	k8s.On("IsGatewayAPI").Return(false)

	migratedNamespace := core_v1.Namespace{
		ObjectMeta: v1.ObjectMeta{Name: "travel-agency"},
	}
	migratedNamespaces := []core_v1.Namespace{migratedNamespace}

	pendingNamespace := core_v1.Namespace{
		ObjectMeta: v1.ObjectMeta{Name: "travel-portal"},
	}
	pendingNamespaces := []core_v1.Namespace{pendingNamespace}

	k8s.On("GetNamespaces", "istio-injection=enabled").Return(pendingNamespaces, nil)
	k8s.On("GetNamespaces", "istio.io/rev=default").Return([]core_v1.Namespace{}, nil)
	k8s.On("GetNamespaces", "istio.io/rev=canary").Return(migratedNamespaces, nil)

	// Create a MeshService and invoke IsMeshConfigured
	k8sclients := make(map[string]kubernetes.ClientInterface)
	k8sclients[kubernetes.HomeClusterName] = k8s
	layer := NewWithBackends(k8sclients, k8sclients, nil, nil)
	meshSvc := layer.Mesh

	canaryUpgradeStatus, err := meshSvc.CanaryUpgradeStatus()

	check.Nil(err, "IstiodCanariesStatus failed: %s", err)
	check.Contains(canaryUpgradeStatus.MigratedNamespaces, "travel-agency")
	check.Equal(1, len(canaryUpgradeStatus.MigratedNamespaces))
	check.Contains(canaryUpgradeStatus.PendingNamespaces, "travel-portal")
	check.Equal(1, len(canaryUpgradeStatus.PendingNamespaces))
}

func TestIstiodResourceThresholds(t *testing.T) {
	config.Set(config.NewConfig())

	testCases := map[string]struct {
		istiodConatiner core_v1.Container
		istiodMeta      v1.ObjectMeta
		expected        *models.IstiodThresholds
		expectedErr     error
	}{
		"istiod with no limits": {
			istiodMeta: v1.ObjectMeta{
				Name:      "istiod",
				Namespace: "istio-system",
			},
			istiodConatiner: core_v1.Container{
				Name: "istiod",
			},
			expected: &models.IstiodThresholds{
				CPU:    0,
				Memory: 0,
			},
		},
		"istiod with limits": {
			istiodMeta: v1.ObjectMeta{
				Name:      "istiod",
				Namespace: "istio-system",
			},
			istiodConatiner: core_v1.Container{
				Name: "istiod",
				Resources: core_v1.ResourceRequirements{
					Limits: core_v1.ResourceList{
						core_v1.ResourceCPU:    resource.MustParse("1000m"),
						core_v1.ResourceMemory: resource.MustParse("1G"),
					},
				},
			},
			expected: &models.IstiodThresholds{
				CPU:    1,
				Memory: 1000,
			},
		},
		"istiod with binary limits": {
			istiodMeta: v1.ObjectMeta{
				Name:      "istiod",
				Namespace: "istio-system",
			},
			istiodConatiner: core_v1.Container{
				Name: "istiod",
				Resources: core_v1.ResourceRequirements{
					Limits: core_v1.ResourceList{
						core_v1.ResourceCPU:    resource.MustParse("14m"),
						core_v1.ResourceMemory: resource.MustParse("1Gi"),
					},
				},
			},
			expected: &models.IstiodThresholds{
				CPU: 0.014,
				// Rounded
				Memory: 1074,
			},
		},
		"istiod with cpu numeral": {
			istiodMeta: v1.ObjectMeta{
				Name:      "istiod",
				Namespace: "istio-system",
			},
			istiodConatiner: core_v1.Container{
				Name: "istiod",
				Resources: core_v1.ResourceRequirements{
					Limits: core_v1.ResourceList{
						core_v1.ResourceCPU: resource.MustParse("1.5"),
					},
				},
			},
			expected: &models.IstiodThresholds{
				CPU: 1.5,
			},
		},
		"istiod with only cpu limits": {
			istiodMeta: v1.ObjectMeta{
				Name:      "istiod",
				Namespace: "istio-system",
			},
			istiodConatiner: core_v1.Container{
				Name: "istiod",
				Resources: core_v1.ResourceRequirements{
					Limits: core_v1.ResourceList{
						core_v1.ResourceCPU: resource.MustParse("1000m"),
					},
				},
			},
			expected: &models.IstiodThresholds{
				CPU: 1,
			},
		},
		"istiod with only memory limits": {
			istiodMeta: v1.ObjectMeta{
				Name:      "istiod",
				Namespace: "istio-system",
			},
			istiodConatiner: core_v1.Container{
				Name: "istiod",
				Resources: core_v1.ResourceRequirements{
					Limits: core_v1.ResourceList{
						core_v1.ResourceMemory: resource.MustParse("1G"),
					},
				},
			},
			expected: &models.IstiodThresholds{
				Memory: 1000,
			},
		},
		"istiod with different name": {
			istiodMeta: v1.ObjectMeta{
				Name:      "istiod-rev-1",
				Namespace: "istio-system",
			},
			istiodConatiner: core_v1.Container{
				Name: "istiod",
				Resources: core_v1.ResourceRequirements{
					Limits: core_v1.ResourceList{
						core_v1.ResourceMemory: resource.MustParse("1G"),
					},
				},
			},
			expectedErr: fmt.Errorf("istiod deployment not found"),
		},
		"istiod in a different namespace": {
			istiodMeta: v1.ObjectMeta{
				Name:      "istiod",
				Namespace: "istio-system-2",
			},
			istiodConatiner: core_v1.Container{
				Name: "istiod",
				Resources: core_v1.ResourceRequirements{
					Limits: core_v1.ResourceList{
						core_v1.ResourceMemory: resource.MustParse("1G"),
					},
				},
			},
			expectedErr: fmt.Errorf("istiod deployment not found"),
		},
		"Missing limits": {
			istiodMeta: v1.ObjectMeta{
				Name:      "istiod",
				Namespace: "istio-system",
			},
			istiodConatiner: core_v1.Container{
				Name:      "istiod",
				Resources: core_v1.ResourceRequirements{},
			},
			expected: &models.IstiodThresholds{},
		},
		"Missing resources": {
			istiodMeta: v1.ObjectMeta{
				Name:      "istiod",
				Namespace: "istio-system",
			},
			istiodConatiner: core_v1.Container{
				Name: "istiod",
			},
			expected: &models.IstiodThresholds{},
		},
	}

	for name, testCase := range testCases {
		t.Run(name, func(t *testing.T) {
			require := require.New(t)
			istiodDeployment := &apps_v1.Deployment{
				ObjectMeta: testCase.istiodMeta,
				Spec: apps_v1.DeploymentSpec{
					Template: core_v1.PodTemplateSpec{
						Spec: core_v1.PodSpec{
							Containers: []core_v1.Container{
								testCase.istiodConatiner,
							},
						},
					},
				},
			}
			k8s := kubetest.NewFakeK8sClient(
				&core_v1.Namespace{ObjectMeta: v1.ObjectMeta{Name: "istio-system"}},
				istiodDeployment,
			)

			ms := MeshService{k8s: k8s}
			actual, err := ms.IstiodResourceThresholds()

			if testCase.expectedErr != nil {
				require.Error(err)
				// End the test early if we expect an error.
				return
			}

			require.NoError(err)
			require.Equal(testCase.expected, actual)
		})
	}
}
