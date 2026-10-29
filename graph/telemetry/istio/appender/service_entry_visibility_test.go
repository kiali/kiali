package appender

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	meshapi "istio.io/api/mesh/v1alpha1"
	networkingapi "istio.io/api/networking/v1"
	networking "istio.io/client-go/pkg/apis/networking/v1"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/graph"
	"github.com/kiali/kiali/istio/istiotest"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/models"
)

func TestServiceEntryVisibilityGraph(t *testing.T) {
	tests := []struct {
		ambient       bool
		applySidecars bool
		exportTo      []string
		meshExportTo  []string
		name          string
		noPolicy      bool
		policies      []*meshapi.ServiceEntryVisibility_Policy
		requester     string
		visibility    meshapi.ServiceEntryVisibility_Visibility
		visible       bool
	}{
		{name: "sidecar opt in caps public export", applySidecars: true, exportTo: []string{"*"}, requester: "client", visibility: meshapi.ServiceEntryVisibility_NAMESPACE},
		{name: "sidecar without opt in keeps public export", requester: "client", visibility: meshapi.ServiceEntryVisibility_NAMESPACE, visible: true},
		{name: "sidecar without opt in preserves explicit export", exportTo: []string{"."}, requester: "client", visibility: meshapi.ServiceEntryVisibility_NONE},
		{name: "sidecar without opt in preserves mesh export default", meshExportTo: []string{"."}, requester: "client", visibility: meshapi.ServiceEntryVisibility_NONE},
		{
			name: "sidecar without opt in skips restrictive policies", requester: "client", visibility: meshapi.ServiceEntryVisibility_NAMESPACE, visible: true,
			policies: []*meshapi.ServiceEntryVisibility_Policy{{Visibility: meshapi.ServiceEntryVisibility_NONE}},
		},
		{name: "ambient without policy ignores private export", ambient: true, exportTo: []string{"."}, noPolicy: true, requester: "client", visible: true},
		{name: "ambient without policy ignores mesh export default", ambient: true, meshExportTo: []string{"."}, noPolicy: true, requester: "client", visible: true},
		{name: "sidecar without policy preserves private export", exportTo: []string{"."}, noPolicy: true, requester: "client"},
		{name: "sidecar without policy preserves mesh export default", meshExportTo: []string{"."}, noPolicy: true, requester: "client"},
		{name: "ambient public ignores private export", ambient: true, exportTo: []string{"."}, requester: "client", visibility: meshapi.ServiceEntryVisibility_PUBLIC, visible: true},
		{name: "ambient public ignores no export", ambient: true, exportTo: []string{"~"}, requester: "client", visibility: meshapi.ServiceEntryVisibility_PUBLIC, visible: true},
		{name: "ambient public ignores mesh export default", ambient: true, meshExportTo: []string{"."}, requester: "client", visibility: meshapi.ServiceEntryVisibility_PUBLIC, visible: true},
		{name: "ambient namespace visibility ignores local export restriction", ambient: true, exportTo: []string{"client"}, requester: "definitions", visibility: meshapi.ServiceEntryVisibility_NAMESPACE, visible: true},
		{name: "ambient honors visibility without sidecar opt in", ambient: true, requester: "client", visibility: meshapi.ServiceEntryVisibility_NAMESPACE},
		{name: "sidecar public does not widen mesh export default", applySidecars: true, meshExportTo: []string{"."}, requester: "client", visibility: meshapi.ServiceEntryVisibility_PUBLIC},
		{name: "local entry retains namespace-local representation", ambient: true, requester: "definitions", visibility: meshapi.ServiceEntryVisibility_NAMESPACE, visible: true},
		{name: "none prevents local attribution", ambient: true, requester: "definitions", visibility: meshapi.ServiceEntryVisibility_NONE},
		{name: "public does not widen private export", applySidecars: true, exportTo: []string{"."}, requester: "client", visibility: meshapi.ServiceEntryVisibility_PUBLIC},
		{
			name: "policy matches definition labels despite private export", ambient: true, exportTo: []string{"."}, requester: "client", visibility: meshapi.ServiceEntryVisibility_NAMESPACE, visible: true,
			policies: []*meshapi.ServiceEntryVisibility_Policy{{
				MatchingRules: []*meshapi.ServiceEntryVisibility_MatchRule{{Matcher: &meshapi.ServiceEntryVisibility_MatchRule_NamespaceSelector{
					NamespaceSelector: &meshapi.LabelSelector{MatchLabels: map[string]string{"trusted": "true"}},
				}}},
				Visibility: meshapi.ServiceEntryVisibility_PUBLIC,
			}},
		},
		{
			name: "requester labels cannot grant visibility", ambient: true, requester: "client", visibility: meshapi.ServiceEntryVisibility_NAMESPACE,
			policies: []*meshapi.ServiceEntryVisibility_Policy{{
				MatchingRules: []*meshapi.ServiceEntryVisibility_MatchRule{{Matcher: &meshapi.ServiceEntryVisibility_MatchRule_NamespaceSelector{
					NamespaceSelector: &meshapi.LabelSelector{MatchLabels: map[string]string{"trusted": "false"}},
				}}},
				Visibility: meshapi.ServiceEntryVisibility_PUBLIC,
			}},
		},
	}
	for _, location := range []networkingapi.ServiceEntry_Location{networkingapi.ServiceEntry_MESH_EXTERNAL, networkingapi.ServiceEntry_MESH_INTERNAL} {
		t.Run(location.String(), func(t *testing.T) {
			for _, tt := range tests {
				t.Run(tt.name, func(t *testing.T) {
					mc := models.NewMeshConfig()
					mc.DefaultServiceExportTo = tt.meshExportTo
					if !tt.noPolicy {
						mc.ServiceEntryVisibility = &meshapi.ServiceEntryVisibility{
							ApplyToSidecars: tt.applySidecars, DefaultVisibility: tt.visibility, Policies: tt.policies,
						}
					}
					mc.PrepareServiceEntryVisibility()
					layer, _ := serviceEntryVisibilityLayer(t, mc, tt.exportTo, location)
					info := graph.NewGlobalInfo(layer, nil, config.Get(), nil, NewGlobalIstioInfo())
					a := ServiceEntryAppender{
						AccessibleNamespaces: graph.AccessibleNamespaces{
							graph.GetClusterSensitiveKey(config.DefaultClusterID, tt.requester): {
								Cluster: config.DefaultClusterID, IsAmbient: tt.ambient, Name: tt.requester,
							},
						},
						GraphType: graph.GraphTypeWorkload,
					}
					traffic, source, destination := serviceEntryVisibilityTraffic(t, tt.requester, location)
					a.AppendGraph(context.Background(), traffic, info, NewAppenderNamespaceInfo(tt.requester))

					require.Len(t, source.Edges, 1)
					assert.Equal(t, float64(7), source.Edges[0].Metadata[graph.MetadataKey(graph.HTTP.Name)])
					assert.Len(t, traffic, 2, "visibility must not remove observed traffic")
					if tt.visible {
						converted := source.Edges[0].Dest
						require.NotNil(t, converted.Metadata[graph.IsServiceEntry])
						assert.Equal(t, "entry", converted.Service)
						assert.Equal(t, tt.requester, converted.Namespace)
						assert.Equal(t, tt.requester, converted.Metadata[graph.IsServiceEntry].(*graph.SEInfo).Namespace)
						assert.Equal(t, location.String(), converted.Metadata[graph.IsServiceEntry].(*graph.SEInfo).Location)
					} else {
						assert.Same(t, destination, source.Edges[0].Dest)
						assert.Nil(t, destination.Metadata[graph.IsServiceEntry])
					}
				})
			}
		})
	}
}

func TestServiceEntryVisibilityUsesRequestingControlPlane(t *testing.T) {
	for _, tt := range []struct {
		definitionVisibility meshapi.ServiceEntryVisibility_Visibility
		name                 string
		requesterVisibility  meshapi.ServiceEntryVisibility_Visibility
		visible              bool
	}{
		{
			definitionVisibility: meshapi.ServiceEntryVisibility_NONE,
			name:                 "requester permits entry despite definition control plane restriction",
			requesterVisibility:  meshapi.ServiceEntryVisibility_PUBLIC,
			visible:              true,
		},
		{
			definitionVisibility: meshapi.ServiceEntryVisibility_PUBLIC,
			name:                 "requester restricts entry despite definition control plane permission",
			requesterVisibility:  meshapi.ServiceEntryVisibility_NONE,
		},
	} {
		t.Run(tt.name, func(t *testing.T) {
			requesterMesh := models.NewMeshConfig()
			requesterMesh.ServiceEntryVisibility = &meshapi.ServiceEntryVisibility{
				ApplyToSidecars:   true,
				DefaultVisibility: meshapi.ServiceEntryVisibility_NAMESPACE,
				Policies: []*meshapi.ServiceEntryVisibility_Policy{{
					MatchingRules: []*meshapi.ServiceEntryVisibility_MatchRule{{
						Matcher: &meshapi.ServiceEntryVisibility_MatchRule_NamespaceSelector{
							NamespaceSelector: &meshapi.LabelSelector{MatchLabels: map[string]string{"trusted": "true"}},
						},
					}},
					Visibility: tt.requesterVisibility,
				}},
			}
			requesterMesh.PrepareServiceEntryVisibility()
			definitionMesh := models.NewMeshConfig()
			definitionMesh.ServiceEntryVisibility = &meshapi.ServiceEntryVisibility{
				ApplyToSidecars: true, DefaultVisibility: tt.definitionVisibility,
			}
			definitionMesh.PrepareServiceEntryVisibility()
			layer, discovery := serviceEntryVisibilityLayer(t, requesterMesh, []string{"*"}, networkingapi.ServiceEntry_MESH_EXTERNAL)
			definitionCP := discovery.MeshReturn.ControlPlanes[0]
			definitionCP.ManagedNamespaces = []models.Namespace{{Name: "definitions"}}
			definitionCP.MeshConfig = definitionMesh
			requesterCP := discovery.MeshReturn.ControlPlanes[0]
			requesterCP.ManagedNamespaces = []models.Namespace{{Name: "client"}, {Name: "sidecar"}}
			discovery.MeshReturn.ControlPlanes = []models.ControlPlane{definitionCP, requesterCP}

			info := graph.NewGlobalInfo(layer, nil, config.Get(), nil, NewGlobalIstioInfo())
			a := ServiceEntryAppender{
				AccessibleNamespaces: graph.AccessibleNamespaces{
					graph.GetClusterSensitiveKey(config.DefaultClusterID, "client"): {},
				},
				GraphType: graph.GraphTypeWorkload,
			}
			traffic, source, destination := serviceEntryVisibilityTraffic(t, "client", networkingapi.ServiceEntry_MESH_EXTERNAL)
			a.AppendGraph(context.Background(), traffic, info, NewAppenderNamespaceInfo("client"))
			require.Len(t, source.Edges, 1)
			assert.Len(t, traffic, 2, "visibility must not remove observed traffic")
			assert.Equal(t, float64(7), source.Edges[0].Metadata[graph.MetadataKey(graph.HTTP.Name)])
			if tt.visible {
				require.NotNil(t, source.Edges[0].Dest.Metadata[graph.IsServiceEntry])
				assert.Equal(t, "entry", source.Edges[0].Dest.Service)
				assert.Equal(t, "client", source.Edges[0].Dest.Namespace)
			} else {
				assert.Same(t, destination, source.Edges[0].Dest)
				assert.Nil(t, destination.Metadata[graph.IsServiceEntry])
			}
		})
	}
}

func TestServiceEntryVisibilityLookupPerRequestingNamespace(t *testing.T) {
	mc := models.NewMeshConfig()
	mc.ServiceEntryVisibility = &meshapi.ServiceEntryVisibility{
		DefaultVisibility: meshapi.ServiceEntryVisibility_PUBLIC,
		Policies:          []*meshapi.ServiceEntryVisibility_Policy{trustedNamespaceVisibility(meshapi.ServiceEntryVisibility_NAMESPACE)},
	}
	mc.PrepareServiceEntryVisibility()
	layer, discovery := serviceEntryVisibilityLayer(t, mc, nil, networkingapi.ServiceEntry_MESH_EXTERNAL)
	info := graph.NewGlobalInfo(layer, nil, config.Get(), nil, NewGlobalIstioInfo())
	a := ServiceEntryAppender{
		AccessibleNamespaces: graph.AccessibleNamespaces{
			graph.GetClusterSensitiveKey(config.DefaultClusterID, "client"):      {IsAmbient: true},
			graph.GetClusterSensitiveKey(config.DefaultClusterID, "definitions"): {IsAmbient: true},
			graph.GetClusterSensitiveKey(config.DefaultClusterID, "sidecar"):     {},
		},
		GraphType: graph.GraphTypeWorkload,
	}
	for _, namespace := range []string{"client", "sidecar", "definitions", "client"} {
		traffic, source, _ := serviceEntryVisibilityTraffic(t, namespace, networkingapi.ServiceEntry_MESH_EXTERNAL)
		a.AppendGraph(context.Background(), traffic, info, NewAppenderNamespaceInfo(namespace))
		require.Len(t, source.Edges, 1)
		assert.Equal(t, namespace != "client", source.Edges[0].Dest.Metadata[graph.IsServiceEntry] != nil)
	}
	assert.Len(t, info.Vendor.ServiceEntryHosts, 3)
	require.Contains(t, info.Vendor.ServiceEntryNamespaces, config.DefaultClusterID)
	cachedNamespaces := info.Vendor.ServiceEntryNamespaces[config.DefaultClusterID]
	require.Contains(t, cachedNamespaces, "definitions")
	assert.Equal(t, "true", cachedNamespaces["definitions"].Labels["trusted"])

	// Cached positive/negative host lookups and namespace labels must not query business
	// services again. Making them unavailable avoids confusing this cache with lower caches.
	info.Business = nil
	require.NotPanics(t, func() {
		for _, namespace := range []string{"client", "sidecar", "definitions"} {
			assert.Equal(t, namespace != "client", a.loadServiceEntryHosts(context.Background(), config.DefaultClusterID, namespace, mc, info))
		}
		assert.Equal(t, cachedNamespaces, getServiceEntryNamespaces(context.Background(), config.DefaultClusterID, info))
	})
	previousInfo := info

	// A new graph generation uses the refreshed mesh snapshot, rather than the previous
	// generation's negative host lookup.
	updated := models.NewMeshConfig()
	updated.ServiceEntryVisibility = &meshapi.ServiceEntryVisibility{DefaultVisibility: meshapi.ServiceEntryVisibility_PUBLIC}
	updated.PrepareServiceEntryVisibility()
	discovery.MeshReturn.ControlPlanes[0].MeshConfig = updated
	traffic, source, _ := serviceEntryVisibilityTraffic(t, "client", networkingapi.ServiceEntry_MESH_EXTERNAL)
	info = graph.NewGlobalInfo(layer, nil, config.Get(), nil, NewGlobalIstioInfo())
	a.AppendGraph(context.Background(), traffic, info, NewAppenderNamespaceInfo("client"))
	require.Len(t, source.Edges, 1)
	require.NotNil(t, source.Edges[0].Dest.Metadata[graph.IsServiceEntry])
	assert.Equal(t, "entry", source.Edges[0].Dest.Service)
	assert.Equal(t, "client", source.Edges[0].Dest.Namespace)
	_, previouslyVisible := a.getServiceEntry(config.DefaultClusterID, "client", "api.example.com", previousInfo)
	assert.False(t, previouslyVisible, "refreshing the mesh must not change the previous graph's lookup")
}

func TestServiceEntryVisibilityUnmanagedRequester(t *testing.T) {
	for name, tt := range map[string]struct {
		ambient  bool
		exportTo []string
		visible  bool
	}{
		"ambient omitted export remains public": {ambient: true, visible: true},
		"ambient public export remains public":  {ambient: true, exportTo: []string{"*"}, visible: true},
		"ambient ignores private export":        {ambient: true, exportTo: []string{"."}, visible: true},
		"sidecar omitted export remains public": {visible: true},
		"sidecar public export remains public":  {exportTo: []string{"*"}, visible: true},
		"sidecar private export stays private":  {exportTo: []string{"."}},
	} {
		t.Run(name, func(t *testing.T) {
			mc := models.NewMeshConfig()
			mc.DefaultServiceExportTo = []string{"."}
			mc.ServiceEntryVisibility = &meshapi.ServiceEntryVisibility{
				ApplyToSidecars: true, DefaultVisibility: meshapi.ServiceEntryVisibility_NONE,
			}
			mc.PrepareServiceEntryVisibility()
			layer, discovery := serviceEntryVisibilityLayer(t, mc, tt.exportTo, networkingapi.ServiceEntry_MESH_EXTERNAL)
			// The definition is managed, but the requesting namespace has no MeshConfig.
			discovery.MeshReturn.ControlPlanes[0].ManagedNamespaces = []models.Namespace{{Name: "definitions"}}
			info := graph.NewGlobalInfo(layer, nil, config.Get(), nil, NewGlobalIstioInfo())
			a := ServiceEntryAppender{
				AccessibleNamespaces: graph.AccessibleNamespaces{
					graph.GetClusterSensitiveKey(config.DefaultClusterID, "client"): {IsAmbient: tt.ambient},
				},
				GraphType: graph.GraphTypeWorkload,
			}
			traffic, source, destination := serviceEntryVisibilityTraffic(t, "client", networkingapi.ServiceEntry_MESH_EXTERNAL)
			a.AppendGraph(context.Background(), traffic, info, NewAppenderNamespaceInfo("client"))
			require.Len(t, source.Edges, 1)
			assert.Len(t, traffic, 2)
			assert.Equal(t, float64(7), source.Edges[0].Metadata[graph.MetadataKey(graph.HTTP.Name)])
			if tt.visible {
				require.NotNil(t, source.Edges[0].Dest.Metadata[graph.IsServiceEntry])
				assert.Equal(t, "entry", source.Edges[0].Dest.Service)
			} else {
				assert.Same(t, destination, source.Edges[0].Dest)
				assert.Nil(t, destination.Metadata[graph.IsServiceEntry])
			}
		})
	}
}

func TestServiceEntryVisibilityMultipleDefinitions(t *testing.T) {
	mc := models.NewMeshConfig()
	mc.ServiceEntryVisibility = &meshapi.ServiceEntryVisibility{
		DefaultVisibility: meshapi.ServiceEntryVisibility_NAMESPACE,
		Policies:          []*meshapi.ServiceEntryVisibility_Policy{trustedNamespaceVisibility(meshapi.ServiceEntryVisibility_PUBLIC)},
	}
	mc.PrepareServiceEntryVisibility()
	layer, discovery := serviceEntryVisibilityLayer(t, mc, []string{"*"}, networkingapi.ServiceEntry_MESH_EXTERNAL,
		&corev1.Namespace{ObjectMeta: metav1.ObjectMeta{Name: "untrusted", Labels: map[string]string{"trusted": "false"}}},
		&networking.ServiceEntry{
			ObjectMeta: metav1.ObjectMeta{Name: "second", Namespace: "definitions"},
			Spec:       networkingapi.ServiceEntry{ExportTo: []string{"*"}, Hosts: []string{"second.example.com"}},
		},
		&networking.ServiceEntry{
			ObjectMeta: metav1.ObjectMeta{Name: "third", Namespace: "untrusted"},
			Spec:       networkingapi.ServiceEntry{ExportTo: []string{"*"}, Hosts: []string{"third.example.com"}},
		},
	)
	discovery.MeshReturn.ControlPlanes[0].ManagedNamespaces = append(discovery.MeshReturn.ControlPlanes[0].ManagedNamespaces, models.Namespace{Name: "untrusted"})
	info := graph.NewGlobalInfo(layer, nil, config.Get(), nil, NewGlobalIstioInfo())
	a := ServiceEntryAppender{
		AccessibleNamespaces: graph.AccessibleNamespaces{
			graph.GetClusterSensitiveKey(config.DefaultClusterID, "client"): {IsAmbient: true},
		},
		GraphType: graph.GraphTypeWorkload,
	}
	traffic, source, _ := serviceEntryVisibilityTraffic(t, "client", networkingapi.ServiceEntry_MESH_EXTERNAL)
	var untrustedDestination *graph.Node
	for _, host := range []string{"second.example.com", "third.example.com"} {
		destination, err := graph.NewNode(config.DefaultClusterID, graph.Unknown, host, "", "", "", "", graph.GraphTypeWorkload)
		require.NoError(t, err)
		edge := source.AddEdge(destination)
		edge.Metadata[graph.ProtocolKey] = graph.HTTP.Name
		graph.AddToMetadata(graph.HTTP.Name, 7, "200", "", host, source.Metadata, destination.Metadata, edge.Metadata)
		traffic[destination.ID] = destination
		if host == "third.example.com" {
			untrustedDestination = destination
		}
	}
	a.AppendGraph(context.Background(), traffic, info, NewAppenderNamespaceInfo("client"))
	require.Len(t, source.Edges, 3)
	assert.Len(t, traffic, 4, "visibility must preserve traffic to all three hosts")
	var attributedEntries []string
	for _, edge := range source.Edges {
		assert.Equal(t, float64(7), edge.Metadata[graph.MetadataKey(graph.HTTP.Name)])
		if edge.Dest.Metadata[graph.IsServiceEntry] != nil {
			attributedEntries = append(attributedEntries, edge.Dest.Service)
			assert.Equal(t, "client", edge.Dest.Namespace)
		}
	}
	assert.ElementsMatch(t, []string{"entry", "second"}, attributedEntries)
	require.NotNil(t, untrustedDestination)
	assert.Same(t, untrustedDestination, traffic[untrustedDestination.ID])
	assert.Nil(t, untrustedDestination.Metadata[graph.IsServiceEntry])
}

func trustedNamespaceVisibility(visibility meshapi.ServiceEntryVisibility_Visibility) *meshapi.ServiceEntryVisibility_Policy {
	return &meshapi.ServiceEntryVisibility_Policy{
		MatchingRules: []*meshapi.ServiceEntryVisibility_MatchRule{{
			Matcher: &meshapi.ServiceEntryVisibility_MatchRule_NamespaceSelector{
				NamespaceSelector: &meshapi.LabelSelector{MatchLabels: map[string]string{"trusted": "true"}},
			},
		}},
		Visibility: visibility,
	}
}

func serviceEntryVisibilityLayer(t *testing.T, mc *models.MeshConfig, exportTo []string, location networkingapi.ServiceEntry_Location, extraObjects ...runtime.Object) (*business.Layer, *istiotest.FakeDiscovery) {
	t.Helper()
	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = config.DefaultClusterID
	conf.ExternalServices.Istio.IstioAPIEnabled = false
	config.Set(conf)
	host := "api.example.com"
	if location == networkingapi.ServiceEntry_MESH_INTERNAL {
		host = "internal.definitions.svc.cluster.local"
	}
	objects := []runtime.Object{
		&corev1.Namespace{ObjectMeta: metav1.ObjectMeta{Name: "definitions", Labels: map[string]string{"trusted": "true"}}},
		&corev1.Namespace{ObjectMeta: metav1.ObjectMeta{Name: "client", Labels: map[string]string{"trusted": "false"}}},
		&corev1.Namespace{ObjectMeta: metav1.ObjectMeta{Name: "sidecar"}},
		&networking.ServiceEntry{
			ObjectMeta: metav1.ObjectMeta{Name: "entry", Namespace: "definitions"},
			Spec:       networkingapi.ServiceEntry{ExportTo: exportTo, Hosts: []string{host}, Location: location},
		},
	}
	objects = append(objects, extraObjects...)
	discovery := defaultSEDiscovery(config.DefaultClusterID, "definitions", "client", "sidecar")
	discovery.MeshReturn.ControlPlanes[0].MeshConfig = mc
	layer := business.NewLayerBuilder(t, conf).WithClient(kubetest.NewFakeK8sClient(objects...)).WithDiscovery(discovery).Build()
	return layer, discovery
}

func serviceEntryVisibilityTraffic(t *testing.T, namespace string, location networkingapi.ServiceEntry_Location) (graph.TrafficMap, *graph.Node, *graph.Node) {
	t.Helper()
	source, err := graph.NewNode(config.DefaultClusterID, namespace, "", namespace, "caller", "caller", "v1", graph.GraphTypeWorkload)
	require.NoError(t, err)
	destinationNamespace, destinationService, host := graph.Unknown, "api.example.com", "api.example.com"
	if location == networkingapi.ServiceEntry_MESH_INTERNAL {
		// Internal ServiceEntry telemetry carries a namespace and may use a short service name.
		// This also exercises the internal-only prefix matching against the declared FQDN.
		destinationNamespace, destinationService, host = namespace, "internal", "internal.definitions.svc.cluster.local"
	}
	destination, err := graph.NewNode(config.DefaultClusterID, destinationNamespace, destinationService, "", "", "", "", graph.GraphTypeWorkload)
	require.NoError(t, err)
	edge := source.AddEdge(destination)
	edge.Metadata[graph.ProtocolKey] = graph.HTTP.Name
	graph.AddToMetadata(graph.HTTP.Name, 7, "200", "", host, source.Metadata, destination.Metadata, edge.Metadata)
	return graph.TrafficMap{source.ID: source, destination.ID: destination}, source, destination
}
