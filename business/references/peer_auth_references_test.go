package references

import (
	"testing"

	"github.com/stretchr/testify/assert"
	networking_v1alpha3 "istio.io/client-go/pkg/apis/networking/v1alpha3"
	security_v1beta "istio.io/client-go/pkg/apis/security/v1beta1"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tests/data"
)

func prepareTestForPeerAuth(pa *security_v1beta.PeerAuthentication, dr *networking_v1alpha3.DestinationRule) models.IstioReferences {
	drReferences := PeerAuthReferences{
		MTLSDetails: kubernetes.MTLSDetails{
			PeerAuthentications: []security_v1beta.PeerAuthentication{*pa},
			DestinationRules:    []networking_v1alpha3.DestinationRule{*dr},
		},
		WorkloadsPerNamespace: map[string]models.WorkloadList{
			"test": data.CreateWorkloadList("istio-system",
				data.CreateWorkloadListItem("istio-ingressgateway", map[string]string{"istio": "ingressgateway"})),
		},
	}
	return *drReferences.References()[models.IstioReferenceKey{ObjectType: "peerauthentication", Namespace: pa.Namespace, Name: pa.Name}]
}

func TestPeerAuthReferences(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	// Setup mocks
	references := prepareTestForPeerAuth(getPeerAuth(t), getPADestinationRule(t))
	assert.Empty(references.ServiceReferences)

	// Check Workload references empty
	assert.Empty(references.WorkloadReferences)

	// Check DR and AuthPolicy references
	assert.Len(references.ObjectReferences, 3)
	assert.Equal(references.ObjectReferences[0].Name, "foo-dev")
	assert.Equal(references.ObjectReferences[0].Namespace, "istio-system")
	assert.Equal(references.ObjectReferences[0].ObjectType, "destinationrule")

	assert.Equal(references.ObjectReferences[1].Name, "foo-sidecar")
	assert.Equal(references.ObjectReferences[1].Namespace, "istio-system")
	assert.Equal(references.ObjectReferences[1].ObjectType, "sidecar")

	assert.Equal(references.ObjectReferences[2].Name, "allow-foo")
	assert.Equal(references.ObjectReferences[2].Namespace, "istio-system")
	assert.Equal(references.ObjectReferences[2].ObjectType, "authorizationpolicy")
}

func TestPeerAuthNoReferences(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	// Setup mocks
	references := prepareTestForPeerAuth(data.CreateEmptyPeerAuthentication(""), getPADestinationRule(t))
	assert.Empty(references.ServiceReferences)
	assert.Empty(references.WorkloadReferences)
	assert.Empty(references.ObjectReferences)
}

func getPADestinationRule(t *testing.T) *networking_v1alpha3.DestinationRule {
	loader := yamlFixtureLoader("peer-auth-disabled-meshwide.yaml")
	err := loader.Load()
	if err != nil {
		t.Error("Error loading test data.")
	}

	return loader.FindDestinationRule("foo-dev", "istio-system")
}

func getPeerAuth(t *testing.T) *security_v1beta.PeerAuthentication {
	loader := yamlFixtureLoader("peer-auth-disabled-meshwide.yaml")
	err := loader.Load()
	if err != nil {
		t.Error("Error loading test data.")
	}

	return &loader.FindPeerAuthenticationIn("istio-system")[0]
}
