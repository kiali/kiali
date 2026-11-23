package generator

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apps_v1 "k8s.io/api/apps/v1"
	core_v1 "k8s.io/api/core/v1"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/cache"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/grafana"
	"github.com/kiali/kiali/istio/istiotest"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/mesh"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/perses"
	"github.com/kiali/kiali/prometheus"
	"github.com/kiali/kiali/status"
	"github.com/kiali/kiali/tests/data"
)

type fakeIstioStatusGetter struct{}

func (f *fakeIstioStatusGetter) GetStatus(_ context.Context) (kubernetes.IstioComponentStatus, error) {
	return kubernetes.IstioComponentStatus{}, nil
}

func newTestWaypointDeployment(name, namespace string, extraLabels map[string]string) *apps_v1.Deployment {
	labels := map[string]string{
		config.WaypointLabel: config.WaypointLabelValue,
		config.GatewayLabel:  name,
	}
	for k, v := range extraLabels {
		labels[k] = v
	}
	return &apps_v1.Deployment{
		ObjectMeta: v1.ObjectMeta{
			Name:      name,
			Namespace: namespace,
			Labels:    labels,
		},
		Spec: apps_v1.DeploymentSpec{
			Template: core_v1.PodTemplateSpec{
				ObjectMeta: v1.ObjectMeta{
					Labels: labels,
				},
			},
		},
	}
}

func setupBuildMeshMapTest(t *testing.T, cluster string, cp models.ControlPlane, objects ...runtime.Object) (*mesh.GlobalInfo, mesh.Options) {
	t.Helper()

	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = cluster
	config.Set(conf)

	k8s := kubetest.NewFakeK8sClient(objects...)
	k8s.GatewayAPIEnabled = true
	k8s.AllowAllSelfSubjectAccessReviews()
	clients := map[string]kubernetes.UserClientInterface{cluster: k8s}

	kialiCache := cache.NewTestingCacheWithClients(t, kubernetes.ConvertFromUserClients(clients), *conf)
	discovery := &istiotest.FakeDiscovery{
		MeshReturn: models.Mesh{
			ControlPlanes: []models.ControlPlane{cp},
		},
	}
	layer := business.NewLayerBuilder(t, conf).WithClients(clients).WithCache(kialiCache).WithDiscovery(discovery).Build()

	origStatusGetter := mesh.StatusGetter
	t.Cleanup(func() {
		mesh.StatusGetter = origStatusGetter
	})
	mesh.StatusGetter = func(context.Context, *config.Config, kubernetes.ClientFactory, cache.KialiCache, *grafana.Service, *perses.Service, prometheus.ClientInterface) status.StatusInfo {
		return status.StatusInfo{}
	}

	gi := mesh.NewGlobalInfo()
	gi.Business = layer
	gi.Conf = conf
	gi.Discovery = discovery
	gi.IstioStatusGetter = &fakeIstioStatusGetter{}
	gi.KialiCache = kialiCache

	opts := mesh.Options{
		AccessibleNamespaces: mesh.AccessibleNamespaces{
			mesh.GetClusterSensitiveKey(cluster, cp.IstiodNamespace): &mesh.AccessibleNamespace{
				Cluster: cluster,
				Name:    cp.IstiodNamespace,
			},
		},
		ConfigVendor: mesh.VendorCommon,
	}
	for _, ns := range cp.ManagedNamespaces {
		opts.AccessibleNamespaces[mesh.GetClusterSensitiveKey(cluster, ns.Name)] = &mesh.AccessibleNamespace{
			Cluster: cluster,
			Name:    ns.Name,
		}
	}

	return gi, opts
}

func findInfraNode(meshMap mesh.MeshMap, infraType, name string) *mesh.Node {
	for _, n := range meshMap {
		if n.InfraType == infraType && n.InfraName == name {
			return n
		}
	}
	return nil
}

func hasEdgeTo(source, dest *mesh.Node) bool {
	if source == nil || dest == nil {
		return false
	}
	for _, e := range source.Edges {
		if e.Dest == dest {
			return true
		}
	}
	return false
}

func TestFindManagingIstiod(t *testing.T) {
	cluster := "cluster-primary"
	ztunnelRevision := models.DefaultRevisionLabel

	newIstiod := func(namespace, name, tag, version string) *mesh.Node {
		cp := models.ControlPlane{
			IstiodName:      name,
			IstiodNamespace: namespace,
		}
		if tag != "" {
			cp.Tag = &models.Tag{Name: tag}
		}
		if version != "" {
			cp.Version = &models.ExternalServiceInfo{Version: version}
		}
		node := mesh.NewNode("id", mesh.NodeTypeInfra, mesh.InfraTypeIstiod, cluster, namespace, name)
		node.Metadata[mesh.InfraData] = cp
		return node
	}

	t.Run("returns nil when no istiod matches revision", func(t *testing.T) {
		meshMap := mesh.NewMeshMap()
		meshMap["a"] = newIstiod("istio-system", "istiod-canary", "canary", "1.24.0")

		assert.Nil(t, findManagingIstiod(meshMap, cluster, ztunnelRevision, "1.24.0"))
	})

	t.Run("returns single matching istiod", func(t *testing.T) {
		meshMap := mesh.NewMeshMap()
		istiod := newIstiod("istio-system", "istiod", models.DefaultRevisionLabel, "1.24.0")
		meshMap["a"] = istiod

		assert.Same(t, istiod, findManagingIstiod(meshMap, cluster, ztunnelRevision, "1.24.0"))
	})

	t.Run("filters by app.kubernetes.io/version tie-breaker", func(t *testing.T) {
		meshMap := mesh.NewMeshMap()
		istiod124 := newIstiod("istio-system", "istiod", models.DefaultRevisionLabel, "1.24.0")
		meshMap["a"] = istiod124
		meshMap["b"] = newIstiod("istio-system", "istiod-canary", models.DefaultRevisionLabel, "1.25.0")

		assert.Same(t, istiod124, findManagingIstiod(meshMap, cluster, ztunnelRevision, "1.24.0"))
	})

	t.Run("returns deterministic result when multiple istiods match", func(t *testing.T) {
		meshMap := mesh.NewMeshMap()
		istiodA := newIstiod("istio-a", "istiod", models.DefaultRevisionLabel, "")
		istiodB := newIstiod("istio-b", "istiod", models.DefaultRevisionLabel, "")
		meshMap["b"] = istiodB
		meshMap["a"] = istiodA

		result := findManagingIstiod(meshMap, cluster, ztunnelRevision, "")
		require.NotNil(t, result)
		assert.Equal(t, "istio-a", result.Namespace)
		assert.Same(t, istiodA, result)
	})

	// Assisted-by: Google Antigravity
	t.Run("matches custom Istio CR revision without tag when ztunnel has explicit rev", func(t *testing.T) {
		meshMap := mesh.NewMeshMap()
		customIstiod := newIstiod("istio-custom", "istiod-custom-mesh", "", "1.24.0")
		cp := customIstiod.Metadata[mesh.InfraData].(models.ControlPlane)
		cp.IsAmbient = true
		cp.Revision = "custom-mesh"
		customIstiod.Metadata[mesh.InfraData] = cp
		customIstiod.Metadata[mesh.IsAmbient] = true
		meshMap["custom"] = customIstiod

		assert.Same(t, customIstiod, findManagingIstiod(meshMap, cluster, "custom-mesh", "1.24.0"))
	})

	t.Run("connects unlabeled ztunnel to ambient istiod over sidecar istiod in hybrid multi-mesh", func(t *testing.T) {
		meshMap := mesh.NewMeshMap()
		// Sidecar istiod in istio-a sorts alphabetically before istio-z, so without ambient awareness it would win.
		sidecarIstiod := newIstiod("istio-a", "istiod-sidecar", "", "1.24.0")
		cpSidecar := sidecarIstiod.Metadata[mesh.InfraData].(models.ControlPlane)
		cpSidecar.Revision = "sidecar-mesh"
		sidecarIstiod.Metadata[mesh.InfraData] = cpSidecar
		meshMap["sidecar"] = sidecarIstiod

		ambientIstiod := newIstiod("istio-z", "istiod-custom-mesh", "", "1.24.0")
		cpAmbient := ambientIstiod.Metadata[mesh.InfraData].(models.ControlPlane)
		cpAmbient.IsAmbient = true
		cpAmbient.Revision = "custom-mesh"
		ambientIstiod.Metadata[mesh.InfraData] = cpAmbient
		ambientIstiod.Metadata[mesh.IsAmbient] = true
		meshMap["ambient"] = ambientIstiod

		result := findManagingIstiod(meshMap, cluster, models.DefaultRevisionLabel, "1.24.0")
		require.NotNil(t, result)
		assert.Same(t, ambientIstiod, result)
	})

	t.Run("matches underlying cp.Revision when Tag.Name differs and ztunnel carries cp.Revision", func(t *testing.T) {
		meshMap := mesh.NewMeshMap()
		taggedIstiod := newIstiod("istio-system", "istiod-1-28-0", "prod", "1.28.0")
		cp := taggedIstiod.Metadata[mesh.InfraData].(models.ControlPlane)
		cp.IsAmbient = true
		cp.Revision = "1-28-0"
		cp.Tag.Cluster = cluster
		cp.Tag.Revision = "1-28-0"
		taggedIstiod.Metadata[mesh.InfraData] = cp
		taggedIstiod.Metadata[mesh.IsAmbient] = true
		meshMap["tagged"] = taggedIstiod

		result := findManagingIstiod(meshMap, cluster, "1-28-0", "1.28.0")
		require.NotNil(t, result)
		assert.Same(t, taggedIstiod, result)
	})
}

// Assisted-by: Google Antigravity
func TestBuildMeshMapWaypointEdges(t *testing.T) {
	cluster := "cluster-primary"

	t.Run("attaches istiod->waypoint edge for custom Istio CR revision with Tag=nil", func(t *testing.T) {
		ambientLabels := map[string]string{config.IstioAmbientNamespaceLabel: config.IstioAmbientNamespaceLabelValue}
		cp := models.ControlPlane{
			Cluster:         &models.KubeCluster{Name: cluster},
			IsAmbient:       true,
			IstiodName:      "istiod-custom-mesh",
			IstiodNamespace: "istio-custom",
			ManagedClusters: []*models.KubeCluster{{Name: cluster}},
			ManagedNamespaces: []models.Namespace{{
				Cluster:   cluster,
				IsAmbient: true,
				Labels:    ambientLabels,
				Name:      "orders-ambient",
				Revision:  "custom-mesh",
			}},
			Revision: "custom-mesh",
		}

		// Explicit istio.io/rev matching cp.Revision ("custom-mesh") as well as unlabeled waypoint inheriting namespace revision.
		wpExplicit := newTestWaypointDeployment("orders-waypoint-explicit", "orders-ambient", map[string]string{
			config.IstioRevisionLabel: "custom-mesh",
		})
		wpInherited := newTestWaypointDeployment("orders-waypoint-inherited", "orders-ambient", nil)

		gi, opts := setupBuildMeshMapTest(t, cluster, cp,
			kubetest.FakeNamespace("istio-custom"),
			kubetest.FakeNamespaceWithLabels("orders-ambient", ambientLabels),
			wpExplicit,
			wpInherited,
		)
		opts.IncludeWaypoints = true

		meshMap, err := BuildMeshMap(context.Background(), opts, gi)
		require.NoError(t, err)

		istiodNode := findInfraNode(meshMap, mesh.InfraTypeIstiod, "istiod-custom-mesh")
		require.NotNil(t, istiodNode)

		wpExplicitNode := findInfraNode(meshMap, mesh.InfraTypeWaypoint, "orders-waypoint-explicit")
		require.NotNil(t, wpExplicitNode)
		assert.Equal(t, "custom-mesh", wpExplicitNode.Metadata[mesh.Version])
		assert.True(t, hasEdgeTo(istiodNode, wpExplicitNode), "expected istiod->waypoint edge for explicit custom revision")

		wpInheritedNode := findInfraNode(meshMap, mesh.InfraTypeWaypoint, "orders-waypoint-inherited")
		require.NotNil(t, wpInheritedNode)
		assert.Equal(t, "custom-mesh", wpInheritedNode.Metadata[mesh.Version])
		assert.True(t, hasEdgeTo(istiodNode, wpInheritedNode), "expected istiod->waypoint edge for inherited namespace custom revision")
	})

	t.Run("attaches istiod->waypoint edge when cp.Tag differs from cp.Revision and waypoint carries explicit cp.Revision", func(t *testing.T) {
		ambientLabels := map[string]string{config.IstioAmbientNamespaceLabel: config.IstioAmbientNamespaceLabelValue}
		cp := models.ControlPlane{
			Cluster:         &models.KubeCluster{Name: cluster},
			IsAmbient:       true,
			IstiodName:      "istiod-1-28-0",
			IstiodNamespace: "istio-system",
			ManagedClusters: []*models.KubeCluster{{Name: cluster}},
			ManagedNamespaces: []models.Namespace{{
				Cluster:   cluster,
				IsAmbient: true,
				Labels:    ambientLabels,
				Name:      "orders-ambient",
				Revision:  "prod",
			}},
			Revision: "1-28-0",
			Tag: &models.Tag{
				Cluster:  cluster,
				Name:     "prod",
				Revision: "1-28-0",
			},
		}

		wpWithUnderlyingRev := newTestWaypointDeployment("orders-waypoint-rev", "orders-ambient", map[string]string{
			config.IstioRevisionLabel: "1-28-0",
		})

		gi, opts := setupBuildMeshMapTest(t, cluster, cp,
			kubetest.FakeNamespace("istio-system"),
			kubetest.FakeNamespaceWithLabels("orders-ambient", ambientLabels),
			wpWithUnderlyingRev,
		)
		opts.IncludeWaypoints = true

		meshMap, err := BuildMeshMap(context.Background(), opts, gi)
		require.NoError(t, err)

		istiodNode := findInfraNode(meshMap, mesh.InfraTypeIstiod, "istiod-1-28-0")
		require.NotNil(t, istiodNode)

		wpNode := findInfraNode(meshMap, mesh.InfraTypeWaypoint, "orders-waypoint-rev")
		require.NotNil(t, wpNode)
		assert.Equal(t, "1-28-0", wpNode.Metadata[mesh.Version])
		assert.True(t, hasEdgeTo(istiodNode, wpNode), "expected istiod->waypoint edge when waypoint rev matches cp.Revision while cp.Tag is set")
	})
}

// Assisted-by: Google Antigravity
func TestBuildMeshMapIstioGatewayEdges(t *testing.T) {
	cluster := "cluster-primary"
	ambientLabels := map[string]string{config.IstioAmbientNamespaceLabel: config.IstioAmbientNamespaceLabelValue}
	cp := models.ControlPlane{
		Cluster:         &models.KubeCluster{Name: cluster},
		IsAmbient:       true,
		IstiodName:      "istiod-custom-mesh",
		IstiodNamespace: "istio-custom",
		ManagedClusters: []*models.KubeCluster{{Name: cluster}},
		ManagedNamespaces: []models.Namespace{{
			Cluster:   cluster,
			IsAmbient: true,
			Labels:    ambientLabels,
			Name:      "orders-ambient",
			Revision:  "custom-mesh",
		}},
		Revision: "custom-mesh",
	}

	classicGW := data.CreateEmptyGateway("orders-classic-gw", "orders-ambient", map[string]string{
		"istio": "ingressgateway",
	})

	gi, opts := setupBuildMeshMapTest(t, cluster, cp,
		kubetest.FakeNamespace("istio-custom"),
		kubetest.FakeNamespaceWithLabels("orders-ambient", ambientLabels),
		classicGW,
	)
	opts.IncludeGateways = true

	meshMap, err := BuildMeshMap(context.Background(), opts, gi)
	require.NoError(t, err)

	istiodNode := findInfraNode(meshMap, mesh.InfraTypeIstiod, "istiod-custom-mesh")
	require.NotNil(t, istiodNode)

	gwNode := findInfraNode(meshMap, mesh.InfraTypeGateway, "orders-classic-gw")
	require.NotNil(t, gwNode)
	assert.Equal(t, "custom-mesh", gwNode.Metadata[mesh.Version])
	assert.True(t, hasEdgeTo(istiodNode, gwNode), "expected istiod->gateway edge for classic Istio Gateway in custom-revision ambient namespace")

	t.Run("attaches istiod->gateway edge when cp.Tag differs from cp.Revision and classic Gateway carries explicit cp.Revision", func(t *testing.T) {
		taggedCP := cp
		taggedCP.IstiodName = "istiod-1-28-0"
		taggedCP.Revision = "1-28-0"
		taggedCP.Tag = &models.Tag{
			Cluster:  cluster,
			Name:     "prod",
			Revision: "1-28-0",
		}
		taggedCP.ManagedNamespaces = []models.Namespace{{
			Cluster:   cluster,
			IsAmbient: true,
			Labels:    ambientLabels,
			Name:      "orders-ambient",
			Revision:  "prod",
		}}

		classicGWRev := data.CreateEmptyGateway("orders-classic-gw-rev", "orders-ambient", map[string]string{
			"istio": "ingressgateway",
		})
		classicGWRev.Labels = map[string]string{
			config.IstioRevisionLabel: "1-28-0",
		}

		giTagged, optsTagged := setupBuildMeshMapTest(t, cluster, taggedCP,
			kubetest.FakeNamespace("istio-custom"),
			kubetest.FakeNamespaceWithLabels("orders-ambient", ambientLabels),
			classicGWRev,
		)
		optsTagged.IncludeGateways = true

		taggedMap, err := BuildMeshMap(context.Background(), optsTagged, giTagged)
		require.NoError(t, err)

		taggedIstiod := findInfraNode(taggedMap, mesh.InfraTypeIstiod, "istiod-1-28-0")
		require.NotNil(t, taggedIstiod)

		taggedGWNode := findInfraNode(taggedMap, mesh.InfraTypeGateway, "orders-classic-gw-rev")
		require.NotNil(t, taggedGWNode)
		assert.Equal(t, "1-28-0", taggedGWNode.Metadata[mesh.Version])
		assert.True(t, hasEdgeTo(taggedIstiod, taggedGWNode), "expected istiod->gateway edge when classic Gateway rev matches cp.Revision while cp.Tag is set")
	})
}

// Assisted-by: Google Antigravity
func TestBuildMeshMapK8sGatewayEdges(t *testing.T) {
	cluster := "cluster-primary"
	ambientLabels := map[string]string{config.IstioAmbientNamespaceLabel: config.IstioAmbientNamespaceLabelValue}
	cp := models.ControlPlane{
		Cluster:         &models.KubeCluster{Name: cluster},
		IsAmbient:       true,
		IstiodName:      "istiod-custom-mesh",
		IstiodNamespace: "istio-custom",
		ManagedClusters: []*models.KubeCluster{{Name: cluster}},
		ManagedNamespaces: []models.Namespace{{
			Cluster:   cluster,
			IsAmbient: true,
			Labels:    ambientLabels,
			Name:      "orders-ambient",
			Revision:  "custom-mesh",
		}},
		Revision: "custom-mesh",
	}

	k8sGW := data.CreateEmptyK8sGateway("orders-k8s-gw", "orders-ambient")

	gi, opts := setupBuildMeshMapTest(t, cluster, cp,
		kubetest.FakeNamespace("istio-custom"),
		kubetest.FakeNamespaceWithLabels("orders-ambient", ambientLabels),
		k8sGW,
	)
	opts.IncludeGateways = true

	meshMap, err := BuildMeshMap(context.Background(), opts, gi)
	require.NoError(t, err)

	istiodNode := findInfraNode(meshMap, mesh.InfraTypeIstiod, "istiod-custom-mesh")
	require.NotNil(t, istiodNode)

	gwNode := findInfraNode(meshMap, mesh.InfraTypeGateway, "orders-k8s-gw")
	require.NotNil(t, gwNode)
	assert.Equal(t, "custom-mesh", gwNode.Metadata[mesh.Version])
	assert.True(t, hasEdgeTo(istiodNode, gwNode), "expected istiod->gateway edge for K8s Gateway in custom-revision ambient namespace")

	t.Run("attaches istiod->gateway edge when cp.Tag differs from cp.Revision and K8s Gateway carries explicit cp.Revision", func(t *testing.T) {
		taggedCP := cp
		taggedCP.IstiodName = "istiod-1-28-0"
		taggedCP.Revision = "1-28-0"
		taggedCP.Tag = &models.Tag{
			Cluster:  cluster,
			Name:     "prod",
			Revision: "1-28-0",
		}
		taggedCP.ManagedNamespaces = []models.Namespace{{
			Cluster:   cluster,
			IsAmbient: true,
			Labels:    ambientLabels,
			Name:      "orders-ambient",
			Revision:  "prod",
		}}

		k8sGWRev := data.CreateEmptyK8sGateway("orders-k8s-gw-rev", "orders-ambient")
		k8sGWRev.Labels = map[string]string{
			config.IstioRevisionLabel: "1-28-0",
		}

		giTagged, optsTagged := setupBuildMeshMapTest(t, cluster, taggedCP,
			kubetest.FakeNamespace("istio-custom"),
			kubetest.FakeNamespaceWithLabels("orders-ambient", ambientLabels),
			k8sGWRev,
		)
		optsTagged.IncludeGateways = true

		taggedMap, err := BuildMeshMap(context.Background(), optsTagged, giTagged)
		require.NoError(t, err)

		taggedIstiod := findInfraNode(taggedMap, mesh.InfraTypeIstiod, "istiod-1-28-0")
		require.NotNil(t, taggedIstiod)

		taggedGWNode := findInfraNode(taggedMap, mesh.InfraTypeGateway, "orders-k8s-gw-rev")
		require.NotNil(t, taggedGWNode)
		assert.Equal(t, "1-28-0", taggedGWNode.Metadata[mesh.Version])
		assert.True(t, hasEdgeTo(taggedIstiod, taggedGWNode), "expected istiod->gateway edge when K8s Gateway rev matches cp.Revision while cp.Tag is set")
	})
}
