package models_test

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	extentions_v1alpha1 "istio.io/client-go/pkg/apis/extensions/v1alpha1"
	networking_v1 "istio.io/client-go/pkg/apis/networking/v1"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/kiali/kiali/models"
)

func TestMarshalJSON_IncludesTopLevelCluster(t *testing.T) {
	details := models.IstioConfigDetails{}
	details.Namespace = models.Namespace{Cluster: "east", Name: "bookinfo"}
	details.ObjectGVK = schema.GroupVersionKind{Group: "networking.istio.io", Version: "v1", Kind: "VirtualService"}
	details.VirtualService = &networking_v1.VirtualService{
		ObjectMeta: meta_v1.ObjectMeta{Name: "reviews", Namespace: "bookinfo"},
	}

	data, err := json.Marshal(details)
	require.NoError(t, err)

	var raw map[string]json.RawMessage
	require.NoError(t, json.Unmarshal(data, &raw))

	var cluster string
	require.NoError(t, json.Unmarshal(raw["cluster"], &cluster))
	assert.Equal(t, "east", cluster)

	var ns models.Namespace
	require.NoError(t, json.Unmarshal(raw["namespace"], &ns))
	assert.Equal(t, "east", ns.Cluster)
	assert.Equal(t, "bookinfo", ns.Name)
}

func TestUnmarshalJSON_ReadsTopLevelCluster(t *testing.T) {
	jsonData := `{
		"cluster": "west",
		"namespace": {"name": "bookinfo"},
		"gvk": {"Group": "networking.istio.io", "Version": "v1", "Kind": "VirtualService"},
		"permissions": {},
		"resource": {"metadata": {"name": "reviews", "namespace": "bookinfo"}, "kind": "VirtualService", "apiVersion": "networking.istio.io/v1"}
	}`

	var details models.IstioConfigDetails
	require.NoError(t, json.Unmarshal([]byte(jsonData), &details))

	assert.Equal(t, "west", details.Namespace.Cluster)
	assert.Equal(t, "bookinfo", details.Namespace.Name)
}

func TestUnmarshalJSON_PrefersNamespaceCluster(t *testing.T) {
	jsonData := `{
		"cluster": "west",
		"namespace": {"name": "bookinfo", "cluster": "east"},
		"gvk": {"Group": "networking.istio.io", "Version": "v1", "Kind": "VirtualService"},
		"permissions": {},
		"resource": {"metadata": {"name": "reviews", "namespace": "bookinfo"}, "kind": "VirtualService", "apiVersion": "networking.istio.io/v1"}
	}`

	var details models.IstioConfigDetails
	require.NoError(t, json.Unmarshal([]byte(jsonData), &details))

	assert.Equal(t, "east", details.Namespace.Cluster)
}

func TestMarshalJSON_TrafficExtensionDetails(t *testing.T) {
	details := models.IstioConfigDetails{}
	details.Namespace = models.Namespace{Cluster: "east", Name: "bookinfo"}
	details.ObjectGVK = schema.GroupVersionKind{Group: "extensions.istio.io", Version: "v1alpha1", Kind: "TrafficExtension"}
	details.TrafficExtension = &extentions_v1alpha1.TrafficExtension{
		ObjectMeta: meta_v1.ObjectMeta{Name: "my-filter", Namespace: "bookinfo"},
	}

	data, err := json.Marshal(details)
	require.NoError(t, err)

	var raw map[string]json.RawMessage
	require.NoError(t, json.Unmarshal(data, &raw))

	var cluster string
	require.NoError(t, json.Unmarshal(raw["cluster"], &cluster))
	assert.Equal(t, "east", cluster)

	_, hasResource := raw["resource"]
	assert.True(t, hasResource, "marshalled details should include 'resource' key")
}

func TestUnmarshalJSON_TrafficExtensionDetails(t *testing.T) {
	jsonData := `{
		"cluster": "east",
		"namespace": {"name": "bookinfo"},
		"gvk": {"Group": "extensions.istio.io", "Version": "v1alpha1", "Kind": "TrafficExtension"},
		"permissions": {},
		"resource": {"metadata": {"name": "my-filter", "namespace": "bookinfo"}, "kind": "TrafficExtension", "apiVersion": "extensions.istio.io/v1alpha1"}
	}`

	var details models.IstioConfigDetails
	require.NoError(t, json.Unmarshal([]byte(jsonData), &details))

	assert.Equal(t, "east", details.Namespace.Cluster)
	assert.Equal(t, "bookinfo", details.Namespace.Name)
	require.NotNil(t, details.TrafficExtension)
	assert.Equal(t, "my-filter", details.TrafficExtension.Name)
}

func TestMarshalUnmarshalJSON_TrafficExtensionList(t *testing.T) {
	original := models.IstioConfigList{}
	original.TrafficExtensions = []*extentions_v1alpha1.TrafficExtension{
		{ObjectMeta: meta_v1.ObjectMeta{Name: "filter-a", Namespace: "ns1"}},
		{ObjectMeta: meta_v1.ObjectMeta{Name: "filter-b", Namespace: "ns1"}},
	}

	data, err := json.Marshal(original)
	require.NoError(t, err)

	var roundTripped models.IstioConfigList
	require.NoError(t, json.Unmarshal(data, &roundTripped))

	require.Len(t, roundTripped.TrafficExtensions, 2)
	names := []string{roundTripped.TrafficExtensions[0].Name, roundTripped.TrafficExtensions[1].Name}
	assert.Contains(t, names, "filter-a")
	assert.Contains(t, names, "filter-b")
}

func TestFilterIstioConfigs_TrafficExtensions(t *testing.T) {
	configList := models.IstioConfigList{
		TrafficExtensions: []*extentions_v1alpha1.TrafficExtension{
			{ObjectMeta: meta_v1.ObjectMeta{Name: "filter-a", Namespace: "bookinfo"}},
			{ObjectMeta: meta_v1.ObjectMeta{Name: "filter-b", Namespace: "bookinfo"}},
			{ObjectMeta: meta_v1.ObjectMeta{Name: "filter-c", Namespace: "other"}},
		},
	}

	filtered := configList.FilterIstioConfigs([]string{"bookinfo"})
	require.NotNil(t, filtered)

	bookinfoConfigs := (*filtered)["bookinfo"]
	require.NotNil(t, bookinfoConfigs)
	require.Len(t, bookinfoConfigs.TrafficExtensions, 2)

	names := []string{bookinfoConfigs.TrafficExtensions[0].Name, bookinfoConfigs.TrafficExtensions[1].Name}
	assert.Contains(t, names, "filter-a")
	assert.Contains(t, names, "filter-b")

	_, hasOther := (*filtered)["other"]
	assert.False(t, hasOther)
}

func TestFilterIstioConfigs_TrafficExtensionsEmptyNamespace(t *testing.T) {
	configList := models.IstioConfigList{
		TrafficExtensions: []*extentions_v1alpha1.TrafficExtension{
			{ObjectMeta: meta_v1.ObjectMeta{Name: "filter-a", Namespace: "bookinfo"}},
		},
	}

	filtered := configList.FilterIstioConfigs([]string{"empty-ns"})
	require.NotNil(t, filtered)

	emptyConfigs := (*filtered)["empty-ns"]
	require.NotNil(t, emptyConfigs)
	assert.Empty(t, emptyConfigs.TrafficExtensions)
}

func TestMergeConfigs_TrafficExtensions(t *testing.T) {
	list1 := models.IstioConfigList{
		TrafficExtensions: []*extentions_v1alpha1.TrafficExtension{
			{ObjectMeta: meta_v1.ObjectMeta{Name: "filter-a", Namespace: "ns1"}},
		},
	}
	list2 := models.IstioConfigList{
		TrafficExtensions: []*extentions_v1alpha1.TrafficExtension{
			{ObjectMeta: meta_v1.ObjectMeta{Name: "filter-b", Namespace: "ns2"}},
			{ObjectMeta: meta_v1.ObjectMeta{Name: "filter-c", Namespace: "ns2"}},
		},
	}

	merged := list1.MergeConfigs(list2)
	require.Len(t, merged.TrafficExtensions, 3)

	names := []string{merged.TrafficExtensions[0].Name, merged.TrafficExtensions[1].Name, merged.TrafficExtensions[2].Name}
	assert.Contains(t, names, "filter-a")
	assert.Contains(t, names, "filter-b")
	assert.Contains(t, names, "filter-c")
}

func TestMergeConfigs_TrafficExtensionsWithEmpty(t *testing.T) {
	list1 := models.IstioConfigList{
		TrafficExtensions: []*extentions_v1alpha1.TrafficExtension{
			{ObjectMeta: meta_v1.ObjectMeta{Name: "filter-a", Namespace: "ns1"}},
		},
	}
	list2 := models.IstioConfigList{}

	merged := list1.MergeConfigs(list2)
	require.Len(t, merged.TrafficExtensions, 1)
	assert.Equal(t, "filter-a", merged.TrafficExtensions[0].Name)
}

func TestNamespaces(t *testing.T) {
	list := models.IstioConfigList{
		VirtualServices: []*networking_v1.VirtualService{
			{ObjectMeta: meta_v1.ObjectMeta{Name: "vs1", Namespace: "bookinfo"}},
			{ObjectMeta: meta_v1.ObjectMeta{Name: "vs2", Namespace: "default"}},
		},
		DestinationRules: []*networking_v1.DestinationRule{
			{ObjectMeta: meta_v1.ObjectMeta{Name: "dr1", Namespace: "bookinfo"}},
			{ObjectMeta: meta_v1.ObjectMeta{Name: "dr2", Namespace: "other-ns"}},
		},
	}

	namespaces := list.Namespaces()
	assert.Len(t, namespaces, 3)
	assert.Contains(t, namespaces, "bookinfo")
	assert.Contains(t, namespaces, "default")
	assert.Contains(t, namespaces, "other-ns")
}

func TestNamespacesEmpty(t *testing.T) {
	list := models.IstioConfigList{}
	namespaces := list.Namespaces()
	assert.Empty(t, namespaces)
}
