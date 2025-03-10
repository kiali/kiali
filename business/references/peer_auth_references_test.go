package references

import (
	"testing"

	"github.com/stretchr/testify/assert"
	networking_v1 "istio.io/client-go/pkg/apis/networking/v1"
	security_v1 "istio.io/client-go/pkg/apis/security/v1"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tests/data"
)

func prepareTestForPeerAuth(pa *security_v1.PeerAuthentication, drs []*networking_v1.DestinationRule) models.IstioReferences {
	drReferences := PeerAuthReferences{
		MTLSDetails: kubernetes.MTLSDetails{
			PeerAuthentications: []*security_v1.PeerAuthentication{pa},
			DestinationRules:    drs,
			EnabledAutoMtls:     false,
		},
		WorkloadsPerNamespace: map[string]models.Workloads{
			"istio-system": {
				data.CreateWorkload("grafana", map[string]string{"app": "grafana"}),
			},
			"bookinfo": {
				data.CreateWorkload("details", map[string]string{"app": "details"}),
			},
		},
	}
	return *drReferences.References()[models.IstioReferenceKey{ObjectGVK: kubernetes.PeerAuthentications, Namespace: pa.Namespace, Name: pa.Name}]
}

func TestMeshPeerAuthDisabledReferences(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	// Setup mocks
	references := prepareTestForPeerAuth(getPeerAuth(t, "disable-mesh-mtls", "istio-system"),
		getPADestinationRules(t, "istio-system"))
	assert.Empty(references.ServiceReferences)

	// Check Workload references empty
	assert.Empty(references.WorkloadReferences)

	// Check DR and AuthPolicy references
	assert.Len(references.ObjectReferences, 1)
	assert.Equal(references.ObjectReferences[0].Name, "disable-mtls")
	assert.Equal(references.ObjectReferences[0].Namespace, "istio-system")
	assert.Equal(references.ObjectReferences[0].ObjectGVK.String(), kubernetes.DestinationRules.String())
}

func TestNamespacePeerAuthDisabledReferences(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	// Setup mocks
	references := prepareTestForPeerAuth(getPeerAuth(t, "disable-namespace-mtls", "bookinfo"),
		getPADestinationRules(t, "bookinfo"))
	assert.Empty(references.ServiceReferences)

	// Check Workload references empty
	assert.Empty(references.WorkloadReferences)

	// Check DR and AuthPolicy references
	assert.Len(references.ObjectReferences, 1)
	assert.Equal(references.ObjectReferences[0].Name, "disable-namespace")
	assert.Equal(references.ObjectReferences[0].Namespace, "bookinfo")
	assert.Equal(references.ObjectReferences[0].ObjectGVK.String(), kubernetes.DestinationRules.String())
}

func TestMeshNamespacePeerAuthDisabledReferences(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	// Setup mocks
	references := prepareTestForPeerAuth(getPeerAuth(t, "disable-namespace-mtls", "bookinfo"),
		getPADestinationRules(t, "istio-system"))
	assert.Empty(references.ServiceReferences)

	// Check Workload references empty
	assert.Empty(references.WorkloadReferences)

	// Check DR and AuthPolicy references
	assert.Equal(references.ObjectReferences[0].Name, "disable-mtls")
	assert.Equal(references.ObjectReferences[0].Namespace, "istio-system")
	assert.Equal(references.ObjectReferences[0].ObjectGVK.String(), kubernetes.DestinationRules.String())
}

func TestMeshPeerAuthEnabledReferences(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	// Setup mocks
	references := prepareTestForPeerAuth(getPeerAuth(t, "strict-mesh-mtls", "istio-system"),
		getPADestinationRules(t, "istio-system"))
	assert.Empty(references.ServiceReferences)

	// Check Workload references empty
	assert.Empty(references.WorkloadReferences)

	// Check DR and AuthPolicy references
	assert.Len(references.ObjectReferences, 1)
	assert.Equal(references.ObjectReferences[0].Name, "enable-mtls")
	assert.Equal(references.ObjectReferences[0].Namespace, "istio-system")
	assert.Equal(references.ObjectReferences[0].ObjectGVK.String(), kubernetes.DestinationRules.String())
}

func TestNamespacePeerAuthEnabledReferences(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	// Setup mocks
	references := prepareTestForPeerAuth(getPeerAuth(t, "strict-namespace-mtls", "bookinfo"),
		getPADestinationRules(t, "bookinfo"))
	assert.Empty(references.ServiceReferences)

	// Check Workload references empty
	assert.Empty(references.WorkloadReferences)

	// Check DR and AuthPolicy references
	assert.Len(references.ObjectReferences, 1)
	assert.Equal(references.ObjectReferences[0].Name, "enable-namespace")
	assert.Equal(references.ObjectReferences[0].Namespace, "bookinfo")
	assert.Equal(references.ObjectReferences[0].ObjectGVK.String(), kubernetes.DestinationRules.String())
}

func TestMeshNamespacePeerAuthEnabledReferences(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	// Setup mocks
	references := prepareTestForPeerAuth(getPeerAuth(t, "strict-namespace-mtls", "bookinfo"),
		getPADestinationRules(t, "istio-system"))
	assert.Empty(references.ServiceReferences)

	// Check Workload references empty
	assert.Empty(references.WorkloadReferences)

	// Check DR and AuthPolicy references
	assert.Len(references.ObjectReferences, 1)
	assert.Equal(references.ObjectReferences[0].Name, "enable-mtls")
	assert.Equal(references.ObjectReferences[0].Namespace, "istio-system")
	assert.Equal(references.ObjectReferences[0].ObjectGVK.String(), kubernetes.DestinationRules.String())
}

func TestMeshPeerAuthWorkloadReferences(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	// Setup mocks
	references := prepareTestForPeerAuth(getPeerAuth(t, "permissive-mesh-mtls", "istio-system"),
		getPADestinationRules(t, "istio-system"))
	assert.Empty(references.ServiceReferences)
	assert.Empty(references.ObjectReferences)

	// Check Workload references
	assert.Len(references.WorkloadReferences, 1)
	assert.Equal(references.WorkloadReferences[0].Name, "grafana")
	assert.Equal(references.WorkloadReferences[0].Namespace, "istio-system")
}

func TestNamespacePeerAuthWorkloadReferences(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	// Setup mocks
	references := prepareTestForPeerAuth(getPeerAuth(t, "permissive-namespace-mtls", "bookinfo"),
		getPADestinationRules(t, "bookinfo"))
	assert.Empty(references.ServiceReferences)
	assert.Empty(references.ObjectReferences)

	// Check Workload references
	assert.Len(references.WorkloadReferences, 1)
	assert.Equal(references.WorkloadReferences[0].Name, "details")
	assert.Equal(references.WorkloadReferences[0].Namespace, "bookinfo")
}

func getPADestinationRules(t *testing.T, namespace string) []*networking_v1.DestinationRule {
	loader := yamlFixtureLoader("peer-auth-drs.yaml")
	err := loader.Load()
	if err != nil {
		t.Error("Error loading test data.")
	}

	return loader.FindDestinationRuleIn(namespace)
}

func getPeerAuth(t *testing.T, name, namespace string) *security_v1.PeerAuthentication {
	loader := yamlFixtureLoader("peer-auth-drs.yaml")
	err := loader.Load()
	if err != nil {
		t.Error("Error loading test data.")
	}

	return loader.FindPeerAuthentication(name, namespace)
}
