package business

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	core_v1 "k8s.io/api/core/v1"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tests/data"
	"github.com/kiali/kiali/tests/testutils/validations"
)

func TestServiceEntryDeclarationAndConflictValidations(t *testing.T) {
	for _, tt := range []struct {
		checkID  string
		protocol string
	}{
		{checkID: "serviceentries.multimatch", protocol: "HTTP"},
		{checkID: "serviceentries.port.protocol.conflict", protocol: "HTTPS"},
	} {
		t.Run(tt.protocol, func(t *testing.T) {
			conf := config.NewConfig()
			config.Set(conf)
			cluster := conf.KubernetesConfig.ClusterName
			const namespace = "test"
			first := data.AddPortDefinitionToServiceEntry(
				data.CreateEmptyServicePortDefinition(80, "http", "HTTP"),
				data.CreateEmptyMeshExternalServiceEntry("first", namespace, []string{"example.com"}),
			)
			first.Spec.ExportTo = []string{"missing"}
			second := first.DeepCopy()
			second.Name = "second"
			second.Spec.ExportTo = []string{"*"}
			second.Spec.Ports[0].Protocol = tt.protocol
			clean := data.CreateEmptyMeshExternalServiceEntry("clean", namespace, []string{"other.example.com"})
			svc := fakeValidationMeshServiceWithDiscovery(t, *conf,
				kubetest.FakeNamespace(namespace),
				kubetest.FakeNamespace("istio-system"),
				&core_v1.ConfigMap{ObjectMeta: v1.ObjectMeta{Name: "istio", Namespace: "istio-system"}},
				first, second, clean,
			)
			ctx := context.Background()
			vInfo, err := svc.NewValidationInfo(ctx, []string{cluster}, nil)
			require.NoError(t, err)
			performed, full, err := svc.Validate(ctx, cluster, vInfo)
			require.NoError(t, err)
			require.True(t, performed)

			firstKey := models.BuildKey(kubernetes.ServiceEntries, first.Name, namespace, cluster)
			secondKey := models.BuildKey(kubernetes.ServiceEntries, second.Name, namespace, cluster)
			cleanKey := models.BuildKey(kubernetes.ServiceEntries, clean.Name, namespace, cluster)
			for _, key := range []models.IstioValidationKey{firstKey, secondKey, cleanKey} {
				require.Contains(t, full, key)
				// Both entry points must merge the two checkers without losing checks or references.
				single, _, err := svc.ValidateIstioObject(ctx, cluster, namespace, kubernetes.ServiceEntries, key.Name)
				require.NoError(t, err)
				require.Contains(t, single, key)
				assert.Equal(t, full[key], single[key])
			}
			conflictCheck := models.Build(tt.checkID, "spec/ports[0]")
			exportCheck := models.Build("generic.exportto.namespacenotfound", "spec/exportTo[0]")
			assert.ElementsMatch(t, []*models.IstioCheck{&conflictCheck, &exportCheck}, full[firstKey].Checks)
			assert.False(t, full[firstKey].Valid)
			assert.Equal(t, []models.IstioValidationKey{secondKey}, full[firstKey].References)
			require.Len(t, full[secondKey].Checks, 1)
			assert.NoError(t, validations.ConfirmIstioCheckMessage(tt.checkID, full[secondKey].Checks[0]))
			assert.Equal(t, []models.IstioValidationKey{firstKey}, full[secondKey].References)
			assert.True(t, full[cleanKey].Valid)
			assert.Empty(t, full[cleanKey].Checks)
		})
	}
}

// Full and single-object validation must agree across every namespace where an
// exported VirtualService applies, including namespaces that cannot see its destination.
func TestVirtualServiceServiceEntryNamespaceContext(t *testing.T) {
	for _, tt := range []struct {
		name                   string
		serviceEntryExportTo   []string
		valid                  bool
		virtualServiceExportTo []string
	}{
		{
			name:                   "omitted_virtual_service_export_with_restricted_service_entry",
			serviceEntryExportTo:   []string{".", "istio-system"},
			virtualServiceExportTo: nil,
		},
		{
			name:                   "public_virtual_service_with_local_service_entry",
			serviceEntryExportTo:   []string{"."},
			virtualServiceExportTo: []string{"*"},
		},
		{
			name:                   "local_virtual_service_with_local_service_entry",
			serviceEntryExportTo:   []string{"."},
			valid:                  true,
			virtualServiceExportTo: []string{"."},
		},
		{
			name:                   "public_virtual_service_with_public_service_entry",
			serviceEntryExportTo:   []string{"*"},
			valid:                  true,
			virtualServiceExportTo: []string{"*"},
		},
	} {
		t.Run(tt.name, func(t *testing.T) {
			conf := config.NewConfig()
			config.Set(conf)
			cluster := conf.KubernetesConfig.ClusterName
			const namespace = "test"
			const host = "api.example.com"
			virtualService := data.AddHttpRoutesToVirtualService(
				data.CreateHttpRouteDestination(host, "", 100),
				data.CreateEmptyVirtualService("external-api", namespace, []string{host}),
			)
			virtualService.Spec.ExportTo = tt.virtualServiceExportTo
			serviceEntry := data.AddPortDefinitionToServiceEntry(
				data.CreateEmptyServicePortDefinition(80, "http", "HTTP"),
				data.CreateEmptyMeshExternalServiceEntry("external-api", namespace, []string{host}),
			)
			serviceEntry.Spec.ExportTo = tt.serviceEntryExportTo
			svc := fakeValidationMeshServiceWithDiscovery(t, *conf,
				kubetest.FakeNamespace(namespace),
				kubetest.FakeNamespace("test2"),
				kubetest.FakeNamespace("istio-system"),
				&core_v1.ConfigMap{ObjectMeta: v1.ObjectMeta{Name: "istio", Namespace: "istio-system"}},
				virtualService, serviceEntry,
			)
			ctx := context.Background()
			key := models.BuildKey(kubernetes.VirtualServices, virtualService.Name, namespace, cluster)
			single, _, err := svc.ValidateIstioObject(ctx, cluster, namespace, kubernetes.VirtualServices, virtualService.Name)
			require.NoError(t, err)
			require.Contains(t, single, key)
			assert.Equal(t, tt.valid, single[key].Valid)
			if tt.valid {
				assert.Empty(t, single[key].Checks)
			} else {
				require.Len(t, single[key].Checks, 1)
				assert.NoError(t, validations.ConfirmIstioCheckMessage("virtualservices.nohost.hostnotfound", single[key].Checks[0]))
			}

			vInfo, err := svc.NewValidationInfo(ctx, []string{cluster}, nil)
			require.NoError(t, err)
			performed, full, err := svc.Validate(ctx, cluster, vInfo)
			require.NoError(t, err)
			require.True(t, performed)
			require.Contains(t, full, key)
			for _, check := range full[key].Checks {
				t.Logf("full validation: %s at %s: %s", check.Code, check.Path, check.Message)
			}
			assert.Equal(t, single[key].Valid, full[key].Valid,
				"full and single-object validation must aggregate the same namespace perspectives")
			assert.Equal(t, single[key].Checks, full[key].Checks,
				"full and single-object validation must agree on the destination host")
		})
	}
}
