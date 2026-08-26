package istio

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	istiov1alpha1 "istio.io/api/mesh/v1alpha1"
	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	ctrlclient "sigs.k8s.io/controller-runtime/pkg/client"

	"github.com/kiali/kiali/cache"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/util/certtest"
)

type kubeCacheError struct {
	cache.KialiCache
}

func (c *kubeCacheError) GetKubeCache(cluster string) (ctrlclient.Reader, error) {
	return nil, errors.New("cluster unreachable")
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
		configMap *corev1.ConfigMap
		expectErr bool
	}{
		"Revision is default": {
			configMap: &corev1.ConfigMap{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "istio",
					Namespace: "istio-system",
					Labels:    map[string]string{config.IstioRevisionLabel: "default"},
				},
				Data: map[string]string{"mesh": ""},
			},
		},
		"Revision is v1": {
			configMap: &corev1.ConfigMap{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "istio-v1",
					Namespace: "istio-system",
					Labels:    map[string]string{config.IstioRevisionLabel: "v1"},
				},
				Data: map[string]string{"mesh": ""},
			},
		},
		"Revision is v2": {
			configMap: &corev1.ConfigMap{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "istio-v2",
					Namespace: "istio-system",
					Labels:    map[string]string{config.IstioRevisionLabel: "v2"},
				},
				Data: map[string]string{"mesh": ""},
			},
		},
		"Revision is empty": {
			configMap: &corev1.ConfigMap{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "istio",
					Namespace: "istio-system",
				},
				Data: map[string]string{"mesh": ""},
			},
		},
	}

	for desc, tc := range testCases {
		t.Run(desc, func(t *testing.T) {
			require := require.New(t)
			conf := config.NewConfig()
			k8s := kubetest.NewFakeK8sClient(
				kubetest.FakeNamespace("istio-system"),
				tc.configMap,
				certtest.FakeIstioCertificateConfigMap("istio-system"),
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
		certtest.FakeIstioCertificateConfigMap("istio-system"),
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

func TestParseArgsInto(t *testing.T) {
	tests := map[string]struct {
		args                     []string
		expectedMeshNetworksPath string
		expectedMeshPath         string
		expectedMonPort          int
	}{
		"Valid monitoring addr with custom port (space-separated)": {
			args:             []string{"pilot-discovery", "--monitoringAddr", ":8080", "discovery"},
			expectedMeshPath: defaultMeshConfigPath,
			expectedMonPort:  8080,
		},
		"Valid monitoring addr with custom port (equals format)": {
			args:             []string{"pilot-discovery", "--monitoringAddr=:9090", "discovery"},
			expectedMeshPath: defaultMeshConfigPath,
			expectedMonPort:  9090,
		},
		"Valid monitoring addr with host:port format": {
			args:             []string{"pilot-discovery", "--monitoringAddr=localhost:7777", "discovery"},
			expectedMeshPath: defaultMeshConfigPath,
			expectedMonPort:  7777,
		},
		"Invalid format - missing colon": {
			args:             []string{"pilot-discovery", "--monitoringAddr=8080", "discovery"},
			expectedMeshPath: defaultMeshConfigPath,
			expectedMonPort:  defaultMonitoringPort,
		},
		"No monitoring addr argument": {
			args:             []string{"pilot-discovery", "discovery"},
			expectedMeshPath: defaultMeshConfigPath,
			expectedMonPort:  defaultMonitoringPort,
		},
		"Empty args": {
			args:             []string{},
			expectedMeshPath: defaultMeshConfigPath,
			expectedMonPort:  defaultMonitoringPort,
		},
		"Unknown flags should not break parsing": {
			args:             []string{"pilot-discovery", "--unknown-flag=value", "--monitoringAddr=:3333", "--another-unknown", "test"},
			expectedMeshPath: defaultMeshConfigPath,
			expectedMonPort:  3333,
		},
		"Custom mesh config path": {
			args:             []string{"--meshConfig=./custom/mesh.yaml"},
			expectedMeshPath: "/custom/mesh.yaml",
			expectedMonPort:  defaultMonitoringPort,
		},
		"Custom mesh networks config path": {
			args:                     []string{"--networksConfigFile=/custom/mesh-networks.yaml"},
			expectedMeshNetworksPath: "/custom/mesh-networks.yaml",
			expectedMeshPath:         defaultMeshConfigPath,
			expectedMonPort:          defaultMonitoringPort,
		},
		"Parent traversal mesh config path is rejected": {
			args:             []string{"--meshConfig=../../../../etc/passwd"},
			expectedMeshPath: defaultMeshConfigPath,
			expectedMonPort:  defaultMonitoringPort,
		},
		"Relative mesh config path is rejected": {
			args:             []string{"--meshConfig=custom/mesh.yaml"},
			expectedMeshPath: defaultMeshConfigPath,
			expectedMonPort:  defaultMonitoringPort,
		},
	}

	for name, tt := range tests {
		t.Run(name, func(t *testing.T) {
			assert := assert.New(t)
			controlPlane := &models.ControlPlane{
				MonitoringPort: defaultMonitoringPort,
			}

			parseArgsInto(tt.args, controlPlane)

			assert.Equal(tt.expectedMeshPath, controlPlane.MeshConfigFilePath)
			expectedMeshNetworksPath := tt.expectedMeshNetworksPath
			if expectedMeshNetworksPath == "" {
				expectedMeshNetworksPath = defaultMeshNetworksConfigPath
			}
			assert.Equal(expectedMeshNetworksPath, controlPlane.MeshNetworksConfigFilePath)
			assert.Equal(tt.expectedMonPort, controlPlane.MonitoringPort, "Expected MonitoringPort to be %d, got %d for args %v", tt.expectedMonPort, controlPlane.MonitoringPort, tt.args)
		})
	}
}

func TestFindMeshConfigFile(t *testing.T) {
	tests := map[string]struct {
		container corev1.Container
		expected  *models.MeshConfigFileReference
		path      string
		volumes   []corev1.Volume
	}{
		"directory mount": {
			container: corev1.Container{VolumeMounts: []corev1.VolumeMount{{MountPath: "/etc/istio/config", Name: "config"}}},
			expected: &models.MeshConfigFileReference{
				ConfigMapKey:  "mesh",
				ConfigMapName: "istio-local",
				Path:          defaultMeshConfigPath,
			},
			path: defaultMeshConfigPath,
			volumes: []corev1.Volume{{
				Name: "config",
				VolumeSource: corev1.VolumeSource{ConfigMap: &corev1.ConfigMapVolumeSource{
					LocalObjectReference: corev1.LocalObjectReference{Name: "istio-local"},
				}},
			}},
		},
		"mapped key and custom path": {
			container: corev1.Container{VolumeMounts: []corev1.VolumeMount{{MountPath: "/var/lib/istio", Name: "config"}}},
			expected: &models.MeshConfigFileReference{
				ConfigMapKey:  "mesh-config.yaml",
				ConfigMapName: "custom-config",
				Path:          "/var/lib/istio/config/mesh.yaml",
			},
			path: "/var/lib/istio/config/mesh.yaml",
			volumes: []corev1.Volume{{
				Name: "config",
				VolumeSource: corev1.VolumeSource{ConfigMap: &corev1.ConfigMapVolumeSource{
					Items:                []corev1.KeyToPath{{Key: "mesh-config.yaml", Path: "config/mesh.yaml"}},
					LocalObjectReference: corev1.LocalObjectReference{Name: "custom-config"},
				}},
			}},
		},
		"subPath mount": {
			container: corev1.Container{VolumeMounts: []corev1.VolumeMount{{
				MountPath: "/etc/istio/config/mesh",
				Name:      "config",
				SubPath:   "mesh.yaml",
			}}},
			expected: &models.MeshConfigFileReference{
				ConfigMapKey:  "mesh",
				ConfigMapName: "istio-local",
				Path:          defaultMeshConfigPath,
			},
			path: defaultMeshConfigPath,
			volumes: []corev1.Volume{{
				Name: "config",
				VolumeSource: corev1.VolumeSource{ConfigMap: &corev1.ConfigMapVolumeSource{
					Items:                []corev1.KeyToPath{{Key: "mesh", Path: "mesh.yaml"}},
					LocalObjectReference: corev1.LocalObjectReference{Name: "istio-local"},
				}},
			}},
		},
		"unrelated mount": {
			container: corev1.Container{VolumeMounts: []corev1.VolumeMount{{MountPath: "/var/run/secrets", Name: "config"}}},
			path:      defaultMeshConfigPath,
			volumes: []corev1.Volume{{
				Name: "config",
				VolumeSource: corev1.VolumeSource{ConfigMap: &corev1.ConfigMapVolumeSource{
					LocalObjectReference: corev1.LocalObjectReference{Name: "unrelated"},
				}},
			}},
		},
		"unmatched projected item": {
			container: corev1.Container{VolumeMounts: []corev1.VolumeMount{{MountPath: "/etc/istio/config", Name: "config"}}},
			path:      defaultMeshConfigPath,
			volumes: []corev1.Volume{{
				Name: "config",
				VolumeSource: corev1.VolumeSource{ConfigMap: &corev1.ConfigMapVolumeSource{
					Items:                []corev1.KeyToPath{{Key: "other", Path: "other"}},
					LocalObjectReference: corev1.LocalObjectReference{Name: "istio-local"},
				}},
			}},
		},
		"most specific mount wins": {
			// As with route matching, the longer and more specific mount path takes precedence.
			container: corev1.Container{VolumeMounts: []corev1.VolumeMount{
				{MountPath: "/", Name: "root-config"},
				{MountPath: "/etc/istio/config", Name: "istio-config"},
			}},
			expected: &models.MeshConfigFileReference{
				ConfigMapKey:  "mesh",
				ConfigMapName: "istio-local",
				Path:          defaultMeshConfigPath,
			},
			path: defaultMeshConfigPath,
			volumes: []corev1.Volume{
				{
					Name: "root-config",
					VolumeSource: corev1.VolumeSource{ConfigMap: &corev1.ConfigMapVolumeSource{
						LocalObjectReference: corev1.LocalObjectReference{Name: "root"},
					}},
				},
				{
					Name: "istio-config",
					VolumeSource: corev1.VolumeSource{ConfigMap: &corev1.ConfigMapVolumeSource{
						LocalObjectReference: corev1.LocalObjectReference{Name: "istio-local"},
					}},
				},
			},
		},
		"parent path traversal is rejected": {
			container: corev1.Container{VolumeMounts: []corev1.VolumeMount{{MountPath: "/", Name: "root-config"}}},
			path:      "../../../../etc/passwd",
			volumes: []corev1.Volume{{
				Name: "root-config",
				VolumeSource: corev1.VolumeSource{ConfigMap: &corev1.ConfigMapVolumeSource{
					LocalObjectReference: corev1.LocalObjectReference{Name: "root"},
				}},
			}},
		},
	}

	for name, tt := range tests {
		t.Run(name, func(t *testing.T) {
			assert.Equal(t, tt.expected, findMeshConfigFile(tt.container, tt.volumes, tt.path))
		})
	}
}

func TestShouldLoadMeshConfigFile(t *testing.T) {
	tests := map[string]struct {
		controlPlane *models.ControlPlane
		expected     bool
	}{
		"external control plane": {
			controlPlane: &models.ControlPlane{
				Cluster:         &models.KubeCluster{Name: "external"},
				ID:              "remote",
				ManagesExternal: true,
				MeshConfigFile:  &models.MeshConfigFileReference{ConfigMapKey: "mesh", ConfigMapName: "istio-custom"},
			},
			expected: true,
		},
		"external control plane with standard mounted config": {
			controlPlane: &models.ControlPlane{
				Cluster:         &models.KubeCluster{Name: "external"},
				ID:              "remote",
				ManagesExternal: true,
				MeshConfigFile:  &models.MeshConfigFileReference{ConfigMapKey: "mesh", ConfigMapName: "istio"},
			},
			expected: true,
		},
		"non-standard ConfigMap key": {
			controlPlane: &models.ControlPlane{
				Cluster:        &models.KubeCluster{Name: "cluster"},
				ID:             "cluster",
				MeshConfigFile: &models.MeshConfigFileReference{ConfigMapKey: "mesh.yaml", ConfigMapName: "istio"},
			},
			expected: true,
		},
		"non-standard ConfigMap name": {
			controlPlane: &models.ControlPlane{
				Cluster:        &models.KubeCluster{Name: "cluster"},
				ID:             "cluster",
				MeshConfigFile: &models.MeshConfigFileReference{ConfigMapKey: "mesh", ConfigMapName: "istio-custom"},
			},
			expected: true,
		},
		"standard mounted config": {
			controlPlane: &models.ControlPlane{
				Cluster:        &models.KubeCluster{Name: "cluster"},
				ID:             "cluster",
				MeshConfigFile: &models.MeshConfigFileReference{ConfigMapKey: "mesh", ConfigMapName: "istio"},
			},
		},
	}

	for name, tt := range tests {
		t.Run(name, func(t *testing.T) {
			assert.Equal(t, tt.expected, shouldLoadMeshConfigFile(tt.controlPlane, "istio"))
		})
	}
}

func TestCleanContainerPath(t *testing.T) {
	tests := map[string]struct {
		input    string
		expected string
	}{
		"absolute path": {
			input:    "/etc/istio/config",
			expected: "/etc/istio/config",
		},
		"relative path": {
			input:    "etc/istio/config",
			expected: "/etc/istio/config",
		},
		"path with dot prefix": {
			input:    "./etc/istio/config",
			expected: "/etc/istio/config",
		},
		"path with redundant slashes": {
			input:    "/etc//istio///config",
			expected: "/etc/istio/config",
		},
		"path with traversal - should reject": {
			input:    "/etc/istio/../../../etc/passwd",
			expected: "", // Rejected due to .. in cleaned path
		},
		"path that cleans to root": {
			input:    "/",
			expected: "/",
		},
		"path with dot segments": {
			input:    "/etc/./istio/./config",
			expected: "/etc/istio/config",
		},
	}

	for name, tt := range tests {
		t.Run(name, func(t *testing.T) {
			result := cleanContainerPath(tt.input)
			assert.Equal(t, tt.expected, result, "cleanContainerPath(%q) = %q, expected %q", tt.input, result, tt.expected)
		})
	}
}

func TestSetControlPlaneConfigWarnsWhenSharedClusterIsUnreachable(t *testing.T) {
	require := require.New(t)
	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "external"
	client := kubetest.NewFakeK8sClient(
		&corev1.ConfigMap{
			ObjectMeta: metav1.ObjectMeta{Name: "istio-custom", Namespace: "external-istiod"},
			Data:       map[string]string{"mesh": "trustDomain: external.local"},
		},
		certtest.FakeIstioCertificateConfigMap("external-istiod"),
	)
	clients := map[string]kubernetes.ClientInterface{"external": client}
	kialiCache := cache.NewTestingCache(t, client, *conf)
	discovery := NewDiscovery(clients, &kubeCacheError{KialiCache: kialiCache}, conf)
	kubeCache, err := kialiCache.GetKubeCache("external")
	require.NoError(err)

	controlPlane := &models.ControlPlane{
		Cluster:          &models.KubeCluster{Name: "external"},
		ID:               "remote",
		IstiodNamespace:  "external-istiod",
		ManagesExternal:  true,
		MeshConfig:       &models.MeshConfig{MeshConfig: &istiov1alpha1.MeshConfig{}},
		MeshConfigFile:   &models.MeshConfigFileReference{ConfigMapKey: "mesh", ConfigMapName: "istio-custom", Path: defaultMeshConfigPath},
		SharedMeshConfig: "istio",
	}

	require.NoError(discovery.setControlPlaneConfig(kubeCache, controlPlane))
	require.Contains(controlPlane.ConfigWarning, "Unable to load shared mesh configuration from cluster [remote]: cluster unreachable")
	require.NotNil(controlPlane.Config.FileConfig)
	require.Equal("external.local", controlPlane.Config.EffectiveConfig.ConfigMap.Mesh.TrustDomain)
}

func TestSetControlPlaneConfigWarnsWhenSharedConfigMapIsMissing(t *testing.T) {
	require := require.New(t)
	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "external"
	localClient := kubetest.NewFakeK8sClient(
		&corev1.ConfigMap{
			ObjectMeta: metav1.ObjectMeta{Name: "istio-custom", Namespace: "external-istiod"},
			Data:       map[string]string{"mesh": "trustDomain: external.local"},
		},
		certtest.FakeIstioCertificateConfigMap("external-istiod"),
	)
	remoteClient := kubetest.NewFakeK8sClient()
	clients := map[string]kubernetes.ClientInterface{
		"external": localClient,
		"remote":   remoteClient,
	}
	kialiCache := cache.NewTestingCacheWithClients(t, clients, *conf)
	discovery := NewDiscovery(clients, kialiCache, conf)
	kubeCache, err := kialiCache.GetKubeCache("external")
	require.NoError(err)

	controlPlane := &models.ControlPlane{
		Cluster:          &models.KubeCluster{Name: "external"},
		ID:               "remote",
		IstiodNamespace:  "external-istiod",
		ManagesExternal:  true,
		MeshConfig:       &models.MeshConfig{MeshConfig: &istiov1alpha1.MeshConfig{}},
		MeshConfigFile:   &models.MeshConfigFileReference{ConfigMapKey: "mesh", ConfigMapName: "istio-custom", Path: defaultMeshConfigPath},
		SharedMeshConfig: "istio",
	}

	require.NoError(discovery.setControlPlaneConfig(kubeCache, controlPlane))
	require.Contains(controlPlane.ConfigWarning, "Unable to load shared mesh configuration: unable to get Shared User ConfigMap [istio]")
	require.NotNil(controlPlane.Config.FileConfig)
	require.Equal("external.local", controlPlane.Config.EffectiveConfig.ConfigMap.Mesh.TrustDomain)
}

func TestSetControlPlaneConfigUsesLocalSharedConfigForMismatchedClusterID(t *testing.T) {
	require := require.New(t)
	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "cluster"
	client := kubetest.NewFakeK8sClient(
		&corev1.ConfigMap{
			ObjectMeta: metav1.ObjectMeta{Name: "istio", Namespace: "istio-system"},
			Data:       map[string]string{"mesh": "trustDomain: cluster.local"},
		},
		&corev1.ConfigMap{
			ObjectMeta: metav1.ObjectMeta{Name: "shared", Namespace: "istio-system"},
			Data:       map[string]string{"mesh": "enableTracing: true"},
		},
		certtest.FakeIstioCertificateConfigMap("istio-system"),
	)
	clients := map[string]kubernetes.ClientInterface{"cluster": client}
	kialiCache := cache.NewTestingCache(t, client, *conf)
	discovery := NewDiscovery(clients, kialiCache, conf)
	kubeCache, err := kialiCache.GetKubeCache("cluster")
	require.NoError(err)

	controlPlane := &models.ControlPlane{
		Cluster:          &models.KubeCluster{Name: "cluster"},
		ID:               "mismatched",
		IstiodNamespace:  "istio-system",
		MeshConfig:       &models.MeshConfig{MeshConfig: &istiov1alpha1.MeshConfig{}},
		SharedMeshConfig: "shared",
	}

	require.NoError(discovery.setControlPlaneConfig(kubeCache, controlPlane))
	require.Empty(controlPlane.ConfigWarning)
	require.Equal("cluster", controlPlane.Config.SharedConfig.Cluster)
	require.True(controlPlane.Config.EffectiveConfig.ConfigMap.Mesh.EnableTracing)
	require.Equal("cluster.local", controlPlane.Config.EffectiveConfig.ConfigMap.Mesh.TrustDomain)
}

func TestSetFileConfigLoadsSeparateMeshNetworksConfigMap(t *testing.T) {
	require := require.New(t)
	conf := config.NewConfig()
	client := kubetest.NewFakeK8sClient(
		&corev1.ConfigMap{
			ObjectMeta: metav1.ObjectMeta{Name: "mesh-config", Namespace: "istio-system"},
			Data:       map[string]string{"mesh": "trustDomain: cluster.local"},
		},
		&corev1.ConfigMap{
			ObjectMeta: metav1.ObjectMeta{Name: "networks-config", Namespace: "istio-system"},
			Data: map[string]string{"networks.yaml": `
networks:
  network1:
    endpoints:
    - fromRegistry: cluster
`},
		},
	)
	kialiCache := cache.NewTestingCache(t, client, *conf)
	kubeCache, err := kialiCache.GetKubeCache(conf.KubernetesConfig.ClusterName)
	require.NoError(err)

	controlPlane := &models.ControlPlane{
		Cluster:         &models.KubeCluster{Name: conf.KubernetesConfig.ClusterName},
		IstiodNamespace: "istio-system",
		MeshConfigFile: &models.MeshConfigFileReference{
			ConfigMapKey:  "mesh",
			ConfigMapName: "mesh-config",
			Path:          "/etc/istio/custom/mesh",
		},
		MeshNetworksConfigFile: &models.MeshConfigFileReference{
			ConfigMapKey:  "networks.yaml",
			ConfigMapName: "networks-config",
			Path:          "/etc/istio/networks/meshNetworks",
		},
	}
	controlPlaneConf := &models.ControlPlaneConfiguration{
		EffectiveConfig: &models.MeshConfigSource{ConfigMap: &models.MeshConfigMap{}},
		StandardConfig:  &models.MeshConfigSource{ConfigMap: &models.MeshConfigMap{}},
	}

	require.NoError(setFileConfig(controlPlane, controlPlaneConf, kubeCache))
	require.Equal("cluster.local", controlPlaneConf.FileConfig.ConfigMap.Mesh.TrustDomain)
	require.Contains(controlPlaneConf.FileConfig.ConfigMap.MeshNetworks.Networks, "network1")
	require.Contains(controlPlaneConf.EffectiveConfig.ConfigMap.MeshNetworks.Networks, "network1")
}

func TestParseArgsInto_NilControlPlane(t *testing.T) {
	require := require.New(t)
	require.NotPanics(func() {
		parseArgsInto([]string{"pilot-discovery", "--monitoringAddr=:8080"}, nil)
	})
}
