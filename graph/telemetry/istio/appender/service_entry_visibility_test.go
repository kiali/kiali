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
		{name: "ambient honors ceiling without sidecar opt in", ambient: true, requester: "client", visibility: meshapi.ServiceEntryVisibility_NAMESPACE},
		{name: "local entry retains namespace-local representation", ambient: true, requester: "definitions", visibility: meshapi.ServiceEntryVisibility_NAMESPACE, visible: true},
		{name: "none prevents local attribution", ambient: true, requester: "definitions", visibility: meshapi.ServiceEntryVisibility_NONE},
		{name: "public does not widen private export", applySidecars: true, exportTo: []string{"."}, requester: "client", visibility: meshapi.ServiceEntryVisibility_PUBLIC},
		{
			name: "policy matches definition labels", ambient: true, requester: "client", visibility: meshapi.ServiceEntryVisibility_NAMESPACE, visible: true,
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
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mc := models.NewMeshConfig()
			mc.DefaultServiceExportTo = tt.meshExportTo
			mc.ServiceEntryVisibility = &meshapi.ServiceEntryVisibility{
				ApplyToSidecars: tt.applySidecars, DefaultVisibility: tt.visibility, Policies: tt.policies,
			}
			mc.PrepareServiceEntryVisibility()
			layer, _ := serviceEntryVisibilityLayer(t, mc, tt.exportTo)
			info := graph.NewGlobalInfo(layer, nil, config.Get(), nil, NewGlobalIstioInfo())
			a := ServiceEntryAppender{
				AccessibleNamespaces: graph.AccessibleNamespaces{
					graph.GetClusterSensitiveKey(config.DefaultClusterID, tt.requester): {
						Cluster: config.DefaultClusterID, IsAmbient: tt.ambient, Name: tt.requester,
					},
				},
				GraphType: graph.GraphTypeWorkload,
			}
			traffic, source, destination := serviceEntryVisibilityTraffic(t, tt.requester)
			a.AppendGraph(context.Background(), traffic, info, NewAppenderNamespaceInfo(tt.requester))

			require.Len(t, source.Edges, 1)
			assert.Equal(t, float64(7), source.Edges[0].Metadata[graph.MetadataKey(graph.HTTP.Name)])
			assert.Len(t, traffic, 2, "visibility must not remove observed traffic")
			if tt.visible {
				converted := source.Edges[0].Dest
				require.NotNil(t, converted.Metadata[graph.IsServiceEntry])
				assert.Equal(t, "external", converted.Service)
				assert.Equal(t, tt.requester, converted.Namespace)
				assert.Equal(t, tt.requester, converted.Metadata[graph.IsServiceEntry].(*graph.SEInfo).Namespace)
			} else {
				assert.Same(t, destination, source.Edges[0].Dest)
				assert.Nil(t, destination.Metadata[graph.IsServiceEntry])
			}
		})
	}
}

func TestServiceEntryVisibilityLookupPerRequestingNamespace(t *testing.T) {
	mc := models.NewMeshConfig()
	mc.ServiceEntryVisibility = &meshapi.ServiceEntryVisibility{DefaultVisibility: meshapi.ServiceEntryVisibility_NAMESPACE}
	mc.PrepareServiceEntryVisibility()
	layer, discovery := serviceEntryVisibilityLayer(t, mc, nil)
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
		traffic, source, _ := serviceEntryVisibilityTraffic(t, namespace)
		a.AppendGraph(context.Background(), traffic, info, NewAppenderNamespaceInfo(namespace))
		assert.Equal(t, namespace != "client", source.Edges[0].Dest.Metadata[graph.IsServiceEntry] != nil)
	}
	assert.Len(t, info.Vendor.ServiceEntryHosts, 3)

	// A new graph generation uses the refreshed mesh snapshot, rather than the previous
	// generation's negative host lookup.
	updated := models.NewMeshConfig()
	updated.ServiceEntryVisibility = &meshapi.ServiceEntryVisibility{DefaultVisibility: meshapi.ServiceEntryVisibility_PUBLIC}
	updated.PrepareServiceEntryVisibility()
	discovery.MeshReturn.ControlPlanes[0].MeshConfig = updated
	traffic, source, _ := serviceEntryVisibilityTraffic(t, "client")
	info = graph.NewGlobalInfo(layer, nil, config.Get(), nil, NewGlobalIstioInfo())
	a.AppendGraph(context.Background(), traffic, info, NewAppenderNamespaceInfo("client"))
	assert.NotNil(t, source.Edges[0].Dest.Metadata[graph.IsServiceEntry])
}

func serviceEntryVisibilityLayer(t *testing.T, mc *models.MeshConfig, exportTo []string) (*business.Layer, *istiotest.FakeDiscovery) {
	t.Helper()
	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = config.DefaultClusterID
	conf.ExternalServices.Istio.IstioAPIEnabled = false
	config.Set(conf)
	objects := []runtime.Object{
		&corev1.Namespace{ObjectMeta: metav1.ObjectMeta{Name: "definitions", Labels: map[string]string{"trusted": "true"}}},
		&corev1.Namespace{ObjectMeta: metav1.ObjectMeta{Name: "client", Labels: map[string]string{"trusted": "false"}}},
		&corev1.Namespace{ObjectMeta: metav1.ObjectMeta{Name: "sidecar"}},
		&networking.ServiceEntry{
			ObjectMeta: metav1.ObjectMeta{Name: "external", Namespace: "definitions"},
			Spec:       networkingapi.ServiceEntry{ExportTo: exportTo, Hosts: []string{"api.example.com"}},
		},
	}
	discovery := defaultSEDiscovery(config.DefaultClusterID, "definitions", "client", "sidecar")
	discovery.MeshReturn.ControlPlanes[0].MeshConfig = mc
	layer := business.NewLayerBuilder(t, conf).WithClient(kubetest.NewFakeK8sClient(objects...)).WithDiscovery(discovery).Build()
	return layer, discovery
}

func serviceEntryVisibilityTraffic(t *testing.T, namespace string) (graph.TrafficMap, *graph.Node, *graph.Node) {
	t.Helper()
	source, err := graph.NewNode(config.DefaultClusterID, namespace, "", namespace, "caller", "caller", "v1", graph.GraphTypeWorkload)
	require.NoError(t, err)
	destination, err := graph.NewNode(config.DefaultClusterID, graph.Unknown, "api.example.com", "", "", "", "", graph.GraphTypeWorkload)
	require.NoError(t, err)
	edge := source.AddEdge(destination)
	edge.Metadata[graph.ProtocolKey] = graph.HTTP.Name
	graph.AddToMetadata(graph.HTTP.Name, 7, "200", "", "api.example.com", source.Metadata, destination.Metadata, edge.Metadata)
	return graph.TrafficMap{source.ID: source, destination.ID: destination}, source, destination
}
