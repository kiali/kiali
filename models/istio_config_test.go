package models_test

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
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
