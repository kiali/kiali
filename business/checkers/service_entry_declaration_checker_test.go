package checkers

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	networking_v1 "istio.io/client-go/pkg/apis/networking/v1"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tests/data"
	"github.com/kiali/kiali/tests/testutils/validations"
)

func TestServiceEntryDeclarationChecker(t *testing.T) {
	for _, ambient := range []bool{false, true} {
		name := "sidecar"
		if ambient {
			name = "ambient"
		}
		t.Run(name, func(t *testing.T) {
			config.Set(config.NewConfig())
			const cluster = config.DefaultClusterID
			const namespace = "definitions"
			first := data.AddPortDefinitionToServiceEntry(
				data.CreateEmptyServicePortDefinition(80, "http", "HTTP"),
				data.CreateEmptyMeshExternalServiceEntry("first", namespace, []string{"example.com"}),
			)
			first.Spec.ExportTo = []string{"missing"}
			second := first.DeepCopy()
			second.Name = "second"
			second.Spec.ExportTo = []string{"*"}

			vals := ServiceEntryDeclarationChecker{
				Cluster: cluster,
				Namespaces: models.Namespaces{{
					Cluster: cluster, IsAmbient: ambient, Name: namespace,
				}},
				ServiceEntries: []*networking_v1.ServiceEntry{first, second},
			}.Check()

			require.Len(t, vals, 2, "every supplied declaration should have a validation result")
			firstKey := models.BuildKey(kubernetes.ServiceEntries, first.Name, namespace, cluster)
			firstVal := vals[firstKey]
			require.NotNil(t, firstVal)
			assert.Equal(t, ambient, firstVal.Valid, "preserve the existing ambient exception for exportTo checks")
			if ambient {
				assert.Empty(t, firstVal.Checks)
			} else {
				require.Len(t, firstVal.Checks, 1)
				assert.NoError(t, validations.ConfirmIstioCheckMessage("generic.exportto.namespacenotfound", firstVal.Checks[0]))
				assert.Equal(t, "spec/exportTo[0]", firstVal.Checks[0].Path)
			}
			secondKey := models.BuildKey(kubernetes.ServiceEntries, second.Name, namespace, cluster)
			require.NotNil(t, vals[secondKey])
			assert.True(t, vals[secondKey].Valid)
			assert.Empty(t, vals[secondKey].Checks, "declaration checks must not report host conflicts")
			assert.Empty(t, vals[firstKey].References)
			assert.Empty(t, vals[secondKey].References)
		})
	}
}
