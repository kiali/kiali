package business

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	meshapi "istio.io/api/mesh/v1alpha1"
	networkingv1 "istio.io/client-go/pkg/apis/networking/v1"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kiali/kiali/cache"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/istio/istiotest"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tests/data"
)

func TestValidationServiceEntryVisibility(t *testing.T) {
	for _, tt := range []struct {
		ambient           bool
		applySidecars     bool
		definitionAmbient bool
		exportTo          []string
		local             bool
		meshExportTo      []string
		name              string
		noPolicy          bool
		policy            bool
		unmanaged         bool
		visibility        meshapi.ServiceEntryVisibility_Visibility
		visible           bool
	}{
		{ambient: true, exportTo: []string{"."}, name: "unmanaged ambient defaults public", unmanaged: true, visibility: meshapi.ServiceEntryVisibility_NONE, visible: true},
		{meshExportTo: []string{"."}, name: "unmanaged sidecar has public mesh default", unmanaged: true, visibility: meshapi.ServiceEntryVisibility_NONE, visible: true},
		{exportTo: []string{"."}, name: "unmanaged sidecar honors explicit export", unmanaged: true, visibility: meshapi.ServiceEntryVisibility_NONE},
		{ambient: true, name: "ambient defaults public", noPolicy: true, visible: true},
		{ambient: true, exportTo: []string{"."}, name: "ambient ignores export", noPolicy: true, visible: true},
		{ambient: true, meshExportTo: []string{"."}, name: "ambient ignores default export", noPolicy: true, visible: true},
		{ambient: true, name: "ambient namespace visibility", visibility: meshapi.ServiceEntryVisibility_NAMESPACE},
		{ambient: true, local: true, name: "ambient namespace visibility is local", visibility: meshapi.ServiceEntryVisibility_NAMESPACE, visible: true},
		{ambient: true, local: true, name: "none hides even locally", visibility: meshapi.ServiceEntryVisibility_NONE},
		{ambient: true, exportTo: []string{"."}, name: "policy matches definition labels", policy: true, visibility: meshapi.ServiceEntryVisibility_NONE, visible: true},
		{name: "sidecar ignores ceiling without opt in", visibility: meshapi.ServiceEntryVisibility_NONE, visible: true},
		{applySidecars: true, name: "sidecar ceiling", visibility: meshapi.ServiceEntryVisibility_NAMESPACE},
		{applySidecars: true, exportTo: []string{"."}, name: "sidecar public cannot widen export", visibility: meshapi.ServiceEntryVisibility_PUBLIC},
		{applySidecars: true, meshExportTo: []string{"."}, name: "sidecar public cannot widen default export", visibility: meshapi.ServiceEntryVisibility_PUBLIC},
		{definitionAmbient: true, name: "sidecar sees public entry from ambient definition", noPolicy: true, visible: true},
		{exportTo: []string{"missing"}, name: "invalid exports remain available to existing checks", noPolicy: true, visible: true},
	} {
		t.Run(tt.name, func(t *testing.T) {
			cluster := config.DefaultClusterID
			requester := "client"
			if tt.local {
				requester = "definitions"
			}
			namespaces := []models.Namespace{
				{Cluster: cluster, IsAmbient: tt.definitionAmbient, Labels: map[string]string{"trusted": "true"}, Name: "definitions"},
				{Cluster: cluster, IsAmbient: tt.ambient, Name: "client"},
			}
			if tt.local {
				namespaces[0].IsAmbient = tt.ambient
			}
			mc := models.NewMeshConfig()
			mc.DefaultServiceExportTo = tt.meshExportTo
			if !tt.noPolicy {
				mc.ServiceEntryVisibility = &meshapi.ServiceEntryVisibility{ApplyToSidecars: tt.applySidecars, DefaultVisibility: tt.visibility}
				if tt.policy {
					mc.ServiceEntryVisibility.Policies = []*meshapi.ServiceEntryVisibility_Policy{{
						MatchingRules: []*meshapi.ServiceEntryVisibility_MatchRule{{Matcher: &meshapi.ServiceEntryVisibility_MatchRule_NamespaceSelector{NamespaceSelector: &meshapi.LabelSelector{MatchLabels: map[string]string{"trusted": "true"}}}}},
						Visibility:    meshapi.ServiceEntryVisibility_PUBLIC,
					}}
				}
			}
			mc.PrepareServiceEntryVisibility()
			vInfo := validationInfo{
				clusterInfo: &validationClusterInfo{cluster: cluster},
				mesh:        &models.Mesh{ControlPlanes: []models.ControlPlane{{Cluster: &models.KubeCluster{Name: cluster}, ManagedNamespaces: namespaces, MeshConfig: mc}}},
				nsInfo:      &validationNamespaceInfo{namespace: &models.Namespace{IsAmbient: tt.ambient, Name: requester}},
				nsMap:       map[string][]models.Namespace{cluster: namespaces},
			}
			if tt.unmanaged {
				vInfo.mesh.ControlPlanes[0].ManagedNamespaces = []models.Namespace{{Name: "definitions"}}
			}
			entry := data.CreateEmptyMeshExternalServiceEntry("external", "definitions", []string{"api.example.com"})
			entry.Spec.ExportTo = tt.exportTo
			service := IstioValidationsService{}
			filtered := service.filterSEExportToNamespaces([]*networkingv1.ServiceEntry{entry}, &vInfo)
			assert.Equal(t, tt.visible, len(filtered) == 1)
		})
	}
}

func TestInvisibleServiceEntryDeclarationIsValidated(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)
	cluster := conf.KubernetesConfig.ClusterName
	mc := models.NewMeshConfig()
	mc.ServiceEntryVisibility = &meshapi.ServiceEntryVisibility{ApplyToSidecars: true, DefaultVisibility: meshapi.ServiceEntryVisibility_NONE}
	mc.PrepareServiceEntryVisibility()
	mesh := models.Mesh{ControlPlanes: []models.ControlPlane{{
		Cluster: &models.KubeCluster{IsKialiHome: true}, IstiodNamespace: "istio-system",
		ManagedNamespaces: []models.Namespace{{Name: "definitions"}, {Name: "istio-system"}},
		MeshConfig:        mc, RootNamespace: "istio-system",
	}}}
	first := data.AddPortDefinitionToServiceEntry(data.CreateEmptyServicePortDefinition(80, "http", "HTTP"), data.CreateEmptyMeshExternalServiceEntry("invalid", "definitions", []string{"api.example.com"}))
	first.Spec.ExportTo = []string{"missing"}
	second := data.AddPortDefinitionToServiceEntry(data.CreateEmptyServicePortDefinition(80, "http", "HTTP"), data.CreateEmptyMeshExternalServiceEntry("valid", "definitions", []string{"api.example.com"}))
	service := fakeValidationMeshServiceWithMesh(t, *conf, mesh,
		kubetest.FakeNamespace("definitions"), kubetest.FakeNamespace("istio-system"),
		&corev1.ConfigMap{ObjectMeta: metav1.ObjectMeta{Name: "istio", Namespace: "istio-system"}}, first, second)
	ctx := context.Background()
	vInfo, err := service.NewValidationInfo(ctx, []string{cluster}, nil)
	require.NoError(t, err)
	performed, full, err := service.Validate(ctx, cluster, vInfo)
	require.NoError(t, err)
	require.True(t, performed)
	for _, entry := range []*networkingv1.ServiceEntry{first, second} {
		key := models.BuildKey(kubernetes.ServiceEntries, entry.Name, entry.Namespace, cluster)
		single, _, err := service.ValidateIstioObject(ctx, cluster, entry.Namespace, kubernetes.ServiceEntries, entry.Name)
		require.NoError(t, err)
		require.Contains(t, full, key)
		require.Contains(t, single, key)
		assert.Equal(t, full[key], single[key])
		assert.Equal(t, entry.Name == "valid", full[key].Valid)
		for _, check := range full[key].Checks {
			assert.NotEqual(t, "KIA1211", check.Code, "invisible entries must not conflict")
		}
		if entry.Name == "invalid" {
			require.Len(t, full[key].Checks, 1)
			assert.Equal(t, "spec/exportTo[0]", full[key].Checks[0].Path)
		}
	}
}

func TestServiceEntryVisibilityRefreshTriggersValidation(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)
	cluster := conf.KubernetesConfig.ClusterName
	mc := models.NewMeshConfig()
	mc.PrepareServiceEntryVisibility()
	mesh := models.Mesh{ControlPlanes: []models.ControlPlane{{
		Cluster: &models.KubeCluster{IsKialiHome: true}, IstiodNamespace: "istio-system",
		ManagedNamespaces: []models.Namespace{{Name: "definitions"}, {Name: "client"}, {Name: "istio-system"}},
		MeshConfig:        mc, RootNamespace: "istio-system",
	}}}
	entry := data.CreateEmptyMeshExternalServiceEntry("external", "definitions", []string{"api.example.com"})
	vs := data.AddHttpRoutesToVirtualService(data.CreateHttpRouteDestination("api.example.com", "", 100), data.CreateEmptyVirtualService("client", "client", []string{"api.example.com"}))
	vs.Spec.ExportTo = []string{"."}
	k8s := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("definitions"), kubetest.FakeNamespace("client"), kubetest.FakeNamespace("istio-system"), entry, vs)
	kialiCache := cache.NewTestingCache(t, k8s, *conf)
	discovery := &istiotest.FakeDiscovery{MeshReturn: mesh}
	service := NewLayerBuilder(t, conf).WithClient(k8s).WithCache(kialiCache).WithDiscovery(discovery).Build().Validations
	changes := ValidationChangeMap{}
	ctx := context.Background()
	run := func(expectedPerformed bool) models.IstioValidations {
		info, err := service.NewValidationInfo(ctx, []string{cluster}, changes)
		require.NoError(t, err)
		performed, results, err := service.Validate(ctx, cluster, info)
		require.NoError(t, err)
		assert.Equal(t, expectedPerformed, performed)
		return results
	}
	key := models.BuildKey(kubernetes.VirtualServices, vs.Name, vs.Namespace, cluster)
	initial := run(true)
	require.Contains(t, initial, key)
	assert.True(t, initial[key].Valid)
	run(false)
	updated := models.NewMeshConfig()
	updated.ServiceEntryVisibility = &meshapi.ServiceEntryVisibility{ApplyToSidecars: true, DefaultVisibility: meshapi.ServiceEntryVisibility_NONE}
	updated.PrepareServiceEntryVisibility()
	discovery.MeshReturn.ControlPlanes = append([]models.ControlPlane(nil), mesh.ControlPlanes...)
	discovery.MeshReturn.ControlPlanes[0].MeshConfig = updated
	refreshed := run(true)
	require.Contains(t, refreshed, key)
	assert.False(t, refreshed[key].Valid)
	run(false)
	same := models.NewMeshConfig()
	same.ServiceEntryVisibility = &meshapi.ServiceEntryVisibility{ApplyToSidecars: true, DefaultVisibility: meshapi.ServiceEntryVisibility_NONE}
	same.PrepareServiceEntryVisibility()
	discovery.MeshReturn.ControlPlanes = append([]models.ControlPlane(nil), discovery.MeshReturn.ControlPlanes...)
	discovery.MeshReturn.ControlPlanes[0].MeshConfig = same
	run(false) // A refreshed snapshot with identical settings must not force checkers.

}

func TestValidationServiceEntryVisibilityUsesRequestingMesh(t *testing.T) {
	for _, requesterAllows := range []bool{false, true} {
		t.Run(fmt.Sprintf("requester_allows=%t", requesterAllows), func(t *testing.T) {
			cluster := config.DefaultClusterID
			definitionMesh, requesterMesh := models.NewMeshConfig(), models.NewMeshConfig()
			definitionVisibility, requesterVisibility := meshapi.ServiceEntryVisibility_PUBLIC, meshapi.ServiceEntryVisibility_NONE
			if requesterAllows {
				definitionVisibility, requesterVisibility = requesterVisibility, definitionVisibility
			}
			definitionMesh.ServiceEntryVisibility = &meshapi.ServiceEntryVisibility{ApplyToSidecars: true, DefaultVisibility: definitionVisibility}
			requesterMesh.ServiceEntryVisibility = &meshapi.ServiceEntryVisibility{ApplyToSidecars: true, DefaultVisibility: requesterVisibility}
			definitionMesh.PrepareServiceEntryVisibility()
			requesterMesh.PrepareServiceEntryVisibility()
			info := validationInfo{
				clusterInfo: &validationClusterInfo{cluster: cluster},
				mesh: &models.Mesh{ControlPlanes: []models.ControlPlane{
					{Cluster: &models.KubeCluster{Name: cluster}, ManagedNamespaces: []models.Namespace{{Name: "definitions"}}, MeshConfig: definitionMesh},
					{Cluster: &models.KubeCluster{Name: cluster}, ManagedNamespaces: []models.Namespace{{Name: "client"}}, MeshConfig: requesterMesh},
				}},
				nsInfo: &validationNamespaceInfo{namespace: &models.Namespace{Name: "client"}},
				nsMap:  map[string][]models.Namespace{cluster: {{Name: "definitions"}, {Name: "client"}}},
			}
			entry := data.CreateEmptyMeshExternalServiceEntry("external", "definitions", []string{"api.example.com"})
			service := IstioValidationsService{}
			assert.Equal(t, requesterAllows, len(service.filterSEExportToNamespaces([]*networkingv1.ServiceEntry{entry}, &info)) == 1)
		})
	}
}

func TestValidationServiceEntryVisibilityCacheLifetime(t *testing.T) {
	cluster := config.DefaultClusterID
	mc := models.NewMeshConfig()
	mc.ServiceEntryVisibility = &meshapi.ServiceEntryVisibility{
		DefaultVisibility: meshapi.ServiceEntryVisibility_NONE,
		Policies: []*meshapi.ServiceEntryVisibility_Policy{{
			MatchingRules: []*meshapi.ServiceEntryVisibility_MatchRule{{Matcher: &meshapi.ServiceEntryVisibility_MatchRule_NamespaceSelector{NamespaceSelector: &meshapi.LabelSelector{MatchLabels: map[string]string{"trusted": "true"}}}}},
			Visibility:    meshapi.ServiceEntryVisibility_PUBLIC,
		}},
	}
	mc.PrepareServiceEntryVisibility()
	labels := map[string]string{"trusted": "true"}
	namespaces := []models.Namespace{{Labels: labels, Name: "definitions"}, {IsAmbient: true, Name: "client"}, {IsAmbient: true, Name: "other"}}
	mesh := &models.Mesh{ControlPlanes: []models.ControlPlane{{Cluster: &models.KubeCluster{Name: cluster}, ManagedNamespaces: namespaces, MeshConfig: mc}}}
	info := validationInfo{clusterInfo: &validationClusterInfo{cluster: cluster}, mesh: mesh, nsMap: map[string][]models.Namespace{cluster: namespaces}}
	entry := data.CreateEmptyMeshExternalServiceEntry("external", "definitions", []string{"api.example.com"})
	view := info.serviceEntryVisibility()
	assert.True(t, view.isVisible(entry, "client"))
	labels["trusted"] = "false"
	assert.True(t, view.isVisible(entry, "other"), "reuse the definition policy across requesters sharing a mesh snapshot")
	assert.Len(t, view.policies, 1)
	assert.Len(t, view.resolved, 1)
	assert.Len(t, view.resolved[mc.ServiceEntryVisibilityPolicy()], 1)
	info.clusterInfo = &validationClusterInfo{cluster: cluster}
	assert.False(t, info.serviceEntryVisibility().isVisible(entry, "client"), "the next validation rebuilds derived state from refreshed namespace labels")
	assert.True(t, view.isVisible(entry, "client"), "a new pass cannot change the previous pass's resolved policy")
}
