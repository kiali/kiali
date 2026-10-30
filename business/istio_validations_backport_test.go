package business

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apinetworkingv1 "istio.io/api/networking/v1"
	networking_v1 "istio.io/client-go/pkg/apis/networking/v1"
	core_v1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	inference "sigs.k8s.io/gateway-api-inference-extension/api/v1"
	gateway "sigs.k8s.io/gateway-api/apis/v1"

	"github.com/kiali/kiali/cache"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/grafana"
	"github.com/kiali/kiali/istio/istiotest"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/models"
)

func restrictedValidationLayer(t *testing.T, accessible []string, objects ...runtime.Object) (*Layer, string) {
	t.Helper()
	conf := config.NewConfig()
	config.Set(conf)
	cluster := conf.KubernetesConfig.ClusterName
	objects = append(objects, kubetest.FakeNamespace("bookinfo"), kubetest.FakeNamespace("sleep"), kubetest.FakeNamespace("istio-system"),
		&core_v1.ConfigMap{ObjectMeta: metav1.ObjectMeta{Name: "istio", Namespace: "istio-system"}})
	sa := kubetest.NewFakeK8sClient(objects...)
	sa.Token = "sa-token"
	sa.GatewayAPIEnabled = true
	sa.InferenceAPIEnabled = true
	userFake := kubetest.NewFakeK8sClient(objects...)
	userFake.GatewayAPIEnabled = true
	userFake.InferenceAPIEnabled = true
	user := kubetest.NewNamespaceRestrictedClient(userFake, "user-token", accessible)
	userClients := map[string]kubernetes.UserClientInterface{cluster: user}
	saClients := map[string]kubernetes.ClientInterface{cluster: sa}
	kialiCache := cache.NewTestingCacheWithClients(t, saClients, *conf)
	discovery := &istiotest.FakeDiscovery{MeshReturn: models.Mesh{ControlPlanes: []models.ControlPlane{{
		Cluster:           &models.KubeCluster{IsKialiHome: true},
		IstiodNamespace:   "istio-system",
		ManagedNamespaces: []models.Namespace{{Name: "bookinfo"}, {Name: "sleep"}, {Name: "istio-system"}},
		MeshConfig:        models.NewMeshConfig(),
		RootNamespace:     "istio-system",
	}}}}
	grafanaSvc, err := grafana.NewService(conf, user)
	require.NoError(t, err)
	return newLayer(userClients, saClients, nil, nil, kialiCache, conf, grafanaSvc, discovery, &FakeControlPlaneMonitor{}), cluster
}

func TestValidateIstioObjectReferenceOnlyPruning(t *testing.T) {
	kind := gateway.Kind(kubernetes.K8sInferencePoolsType)
	group := gateway.Group(kubernetes.K8sInferencePools.Group)
	poolNamespace := gateway.Namespace("bookinfo")
	objects := []runtime.Object{}
	for _, namespace := range []string{"bookinfo", "sleep"} {
		objects = append(objects,
			&inference.InferencePool{ObjectMeta: metav1.ObjectMeta{Name: "pool", Namespace: namespace}},
			&networking_v1.WorkloadEntry{ObjectMeta: metav1.ObjectMeta{Name: "entry", Namespace: namespace}, Spec: apinetworkingv1.WorkloadEntry{Labels: map[string]string{"app": "vm"}}},
			&networking_v1.WorkloadGroup{ObjectMeta: metav1.ObjectMeta{Name: "group", Namespace: namespace}, Spec: apinetworkingv1.WorkloadGroup{Metadata: &apinetworkingv1.WorkloadGroup_ObjectMeta{Labels: map[string]string{"app": "vm"}}}},
			&gateway.HTTPRoute{
				ObjectMeta: metav1.ObjectMeta{Name: namespace + "-route", Namespace: namespace},
				Spec: gateway.HTTPRouteSpec{Rules: []gateway.HTTPRouteRule{{BackendRefs: []gateway.HTTPBackendRef{{BackendRef: gateway.BackendRef{BackendObjectReference: gateway.BackendObjectReference{
					Group: &group, Kind: &kind, Name: "pool", Namespace: &poolNamespace,
				}}}}}}},
			})
	}
	layer, cluster := restrictedValidationLayer(t, []string{"bookinfo"}, objects...)
	_, err := layer.Namespace.GetClusterNamespace(context.Background(), "sleep", cluster)
	require.True(t, IsAccessibleError(err), "the referenced namespace must actually be denied")

	for name, tc := range map[string]struct {
		gvk       schema.GroupVersionKind
		object    string
		reference string
	}{
		"inference pool": {gvk: kubernetes.K8sInferencePools, object: "pool", reference: "bookinfo-route"},
		"workload entry": {gvk: kubernetes.WorkloadEntries, object: "entry", reference: "group"},
	} {
		t.Run(name, func(t *testing.T) {
			validations, refs, err := layer.Validations.ValidateIstioObject(context.Background(), cluster, "bookinfo", tc.gvk, tc.object)
			require.NoError(t, err)
			assert.Empty(t, validations)
			key := models.IstioReferenceKey{ObjectGVK: tc.gvk, Namespace: "bookinfo", Name: tc.object}
			require.Contains(t, refs, key)
			require.Len(t, refs, 1, "do not return same-named objects in other namespaces")
			require.Len(t, refs[key].ObjectReferences, 1, "keep accessible references and prune denied references")
			assert.Equal(t, "bookinfo", refs[key].ObjectReferences[0].Namespace)
			assert.Equal(t, tc.reference, refs[key].ObjectReferences[0].Name)
		})
	}
}

func TestValidateIstioObjectFromNamespaceKeepsObjectIdentity(t *testing.T) {
	objects := []runtime.Object{}
	for _, namespace := range []string{"bookinfo", "sleep"} {
		objects = append(objects, &networking_v1.ServiceEntry{
			ObjectMeta: metav1.ObjectMeta{Name: "exported", Namespace: namespace},
			Spec: apinetworkingv1.ServiceEntry{
				ExportTo: []string{"sleep"}, Hosts: []string{"external.example.com"},
				Ports: []*apinetworkingv1.ServicePort{{Name: "http", Number: 80, Protocol: "HTTP"}},
			},
		})
	}
	layer, cluster := restrictedValidationLayer(t, []string{"bookinfo", "sleep"}, objects...)
	otherKey := models.IstioValidationKey{ObjectGVK: kubernetes.ServiceEntries, Namespace: "sleep", Name: "exported", Cluster: cluster}
	cached := &models.IstioValidation{Name: "exported", Namespace: "sleep", Valid: false}
	layer.Validations.kialiCache.Validations().Set(otherKey, cached)

	validations, refs, err := layer.Validations.ValidateIstioObjectFromNamespace(context.Background(), cluster, "bookinfo", "sleep", kubernetes.ServiceEntries, "exported")
	require.NoError(t, err)
	key := models.IstioValidationKey{ObjectGVK: kubernetes.ServiceEntries, Namespace: "bookinfo", Name: "exported", Cluster: cluster}
	require.Contains(t, validations, key)
	require.Len(t, validations, 1)
	require.NotEmpty(t, validations[key].Checks, "the conflict visible in the exported-to namespace must survive")
	assert.Equal(t, "KIA1211", validations[key].Checks[0].Code)
	require.Len(t, refs, 1)
	assert.Contains(t, refs, models.IstioReferenceKey{ObjectGVK: kubernetes.ServiceEntries, Namespace: "bookinfo", Name: "exported"})
	unchanged, found := layer.Validations.kialiCache.Validations().Get(otherKey)
	require.True(t, found)
	assert.Same(t, cached, unchanged, "do not overwrite a same-named object's cached validation")
}

func TestValidateIstioObjectFromNamespaceRequiresBothNamespaces(t *testing.T) {
	layer, cluster := restrictedValidationLayer(t, []string{"bookinfo"})
	for name, tc := range map[string]struct {
		objectNamespace string
		viewpoint       string
	}{
		"denied owner":     {objectNamespace: "sleep", viewpoint: "bookinfo"},
		"denied viewpoint": {objectNamespace: "bookinfo", viewpoint: "sleep"},
	} {
		t.Run(name, func(t *testing.T) {
			_, _, err := layer.Validations.ValidateIstioObjectFromNamespace(context.Background(), cluster, tc.objectNamespace, tc.viewpoint, kubernetes.ServiceEntries, "exported")
			require.True(t, IsAccessibleError(err))
		})
	}
	_, _, err := layer.Validations.ValidateIstioObject(context.Background(), cluster, "bookinfo", schema.GroupVersionKind{Kind: "Unknown"}, "object")
	require.ErrorContains(t, err, "object type not found")
}
