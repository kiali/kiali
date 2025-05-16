package models_test

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
	istiov1alpha1 "istio.io/api/mesh/v1alpha1"

	"github.com/kiali/kiali/models"
)

func TestMeshConfigJSONMarshal(t *testing.T) {
	cases := map[string]struct {
		OutboundTrafficPolicy *istiov1alpha1.MeshConfig_OutboundTrafficPolicy
		Expected              string
	}{
		"outboundTrafficPolicy with REGISTRY_ONLY keeps REGISTRY_ONLY": {
			OutboundTrafficPolicy: &istiov1alpha1.MeshConfig_OutboundTrafficPolicy{
				Mode: istiov1alpha1.MeshConfig_OutboundTrafficPolicy_REGISTRY_ONLY,
			},
			Expected: "{\"outboundTrafficPolicy\":{\"mode\":\"REGISTRY_ONLY\"}}",
		},
		"outboundTrafficPolicy with ALLOW_ANY keeps ALLOW_ANY": {
			OutboundTrafficPolicy: &istiov1alpha1.MeshConfig_OutboundTrafficPolicy{
				Mode: istiov1alpha1.MeshConfig_OutboundTrafficPolicy_ALLOW_ANY,
			},
			Expected: "{\"outboundTrafficPolicy\":{\"mode\":\"ALLOW_ANY\"}}",
		},
		"nil outboundTrafficPolicy empty": {
			OutboundTrafficPolicy: nil,
			Expected:              "{}",
		},
		// Since the default is actually ALLOW_ANY this doesn't make much sense.
		"empty outboundTrafficPolicy keeps REGISTRY_ONLY": {
			OutboundTrafficPolicy: &istiov1alpha1.MeshConfig_OutboundTrafficPolicy{},
			Expected:              "{\"outboundTrafficPolicy\":{\"mode\":\"REGISTRY_ONLY\"}}",
		},
	}
	for name, tc := range cases {
		t.Run(name, func(t *testing.T) {
			require := require.New(t)
			b, err := json.Marshal(models.MeshConfig{&istiov1alpha1.MeshConfig{OutboundTrafficPolicy: tc.OutboundTrafficPolicy}})
			require.NoError(err)

			require.Equal(string(b), tc.Expected)
		})
	}
}
