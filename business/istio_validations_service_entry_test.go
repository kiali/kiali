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
			require.Len(t, full[firstKey].Checks, 2)
			assert.NoError(t, validations.ConfirmIstioCheckMessage(tt.checkID, full[firstKey].Checks[0]))
			assert.NoError(t, validations.ConfirmIstioCheckMessage("generic.exportto.namespacenotfound", full[firstKey].Checks[1]))
			assert.False(t, full[firstKey].Valid)
			assert.Equal(t, "spec/exportTo[0]", full[firstKey].Checks[1].Path)
			assert.Equal(t, []models.IstioValidationKey{secondKey}, full[firstKey].References)
			require.Len(t, full[secondKey].Checks, 1)
			assert.NoError(t, validations.ConfirmIstioCheckMessage(tt.checkID, full[secondKey].Checks[0]))
			assert.Equal(t, []models.IstioValidationKey{firstKey}, full[secondKey].References)
			assert.True(t, full[cleanKey].Valid)
			assert.Empty(t, full[cleanKey].Checks)
		})
	}
}
