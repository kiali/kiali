package destinationrules

import (
	"testing"

	"github.com/stretchr/testify/assert"
	networking_v1 "istio.io/client-go/pkg/apis/networking/v1"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tests/data"
	"github.com/kiali/kiali/tests/testutils/validations"
)

// Context: MeshPolicy Enabling mTLS
// Context: DestinationRule doesn't specify trafficPolicy
// It returns a validation
func TestMTLSMeshWideEnabledDRWithoutTrafficPolicy(t *testing.T) {
	mTLSDetails := kubernetes.MTLSDetails{
		DestinationRules: []*networking_v1.DestinationRule{
			// Mesh-wide DR enabling mTLS communication
			data.AddTrafficPolicyToDestinationRule(data.CreateMTLSTrafficPolicyForDestinationRules(),
				data.CreateEmptyDestinationRule("istio-system", "default", "*.local")),
			data.AddTrafficPolicyToDestinationRule(data.CreateMTLSTrafficPolicyForDestinationRules(),
				data.CreateEmptyDestinationRule("bookinfo", "default", "*.bookinfo.svc.cluster.local")),
			data.AddTrafficPolicyToDestinationRule(data.CreateMTLSTrafficPolicyForDestinationRules(),
				data.CreateEmptyDestinationRule("bookinfo", "reviews", "reviews")),
		},
	}

	destinationRules := []*networking_v1.DestinationRule{
		// Subject DR that doesn't specify any trafficPolicy
		data.CreateEmptyDestinationRule("bookinfo", "reviews", "reviews"),
	}

	validation := testValidationAdded(t, destinationRules, mTLSDetails)
	presentReferences(t, *validation, "istio-system", []string{"default"})
	presentReferences(t, *validation, "bookinfo", []string{"default"})
}

// Context: MeshPolicy Enabling mTLS
// Context: DestinationRule doesn't specify mTLS options
// It returns a validation
func TestMTLSMeshWideEnabledDRWithoutmTLSOptions(t *testing.T) {
	mTLSDetails := kubernetes.MTLSDetails{
		DestinationRules: []*networking_v1.DestinationRule{
			// Mesh-wide DR enabling mTLS communication
			data.AddTrafficPolicyToDestinationRule(data.CreateMTLSTrafficPolicyForDestinationRules(),
				data.CreateEmptyDestinationRule("bookinfo", "default", "*.local")),
			data.AddTrafficPolicyToDestinationRule(data.CreateMTLSTrafficPolicyForDestinationRules(),
				data.CreateEmptyDestinationRule("bookinfo", "reviews", "reviews")),
		},
	}

	destinationRules := []*networking_v1.DestinationRule{
		// Subject DR that specify trafficPolicy but no mTLS options
		data.AddTrafficPolicyToDestinationRule(data.CreateLoadBalancerTrafficPolicyForDestinationRules(),
			data.CreateEmptyDestinationRule("bookinfo", "reviews", "reviews")),
	}

	testValidationAdded(t, destinationRules, mTLSDetails)
}

// Context: MeshPolicy Enabling mTLS
// Context: DestinationRule doesn't specify port-level mTLS options
// It returns a validation
func TestMTLSMeshWideEnabledDRWithoutPortLevelmTLSOptions(t *testing.T) {
	mTLSDetails := kubernetes.MTLSDetails{
		DestinationRules: []*networking_v1.DestinationRule{
			// Mesh-wide DR enabling mTLS communication
			data.AddTrafficPolicyToDestinationRule(data.CreateMTLSTrafficPolicyForDestinationRules(),
				data.CreateEmptyDestinationRule("bookinfo", "default", "*.local")),
			data.AddTrafficPolicyToDestinationRule(data.CreateMTLSTrafficPolicyForDestinationRules(),
				data.CreateEmptyDestinationRule("bookinfo", "reviews", "reviews")),
		},
	}

	destinationRules := []*networking_v1.DestinationRule{
		// Subject DR that specify trafficPolicy but no mTLS options
		data.AddTrafficPolicyToDestinationRule(data.CreatePortLevelTrafficPolicyForDestinationRules(),
			data.CreateEmptyDestinationRule("bookinfo", "reviews", "reviews")),
	}

	testValidationAdded(t, destinationRules, mTLSDetails)
}

// Context: MeshPolicy Enabling mTLS
// Context: DestinationRule does specify trafficPolicy and mTLS options
// It doesn't return any validation
func TestMTLSMeshWideEnabledDRWithTrafficPolicy(t *testing.T) {
	mTLSDetails := kubernetes.MTLSDetails{
		DestinationRules: []*networking_v1.DestinationRule{
			// Mesh-wide DR enabling mTLS communication
			data.AddTrafficPolicyToDestinationRule(data.CreateMTLSTrafficPolicyForDestinationRules(),
				data.CreateEmptyDestinationRule("bookinfo", "default", "*.local")),
			data.AddTrafficPolicyToDestinationRule(data.CreateMTLSTrafficPolicyForDestinationRules(),
				data.CreateEmptyDestinationRule("bookinfo", "reviews", "reviews")),
		},
	}

	destinationRules := []*networking_v1.DestinationRule{
		// Subject DR that specify TrafficPolicy
		data.AddTrafficPolicyToDestinationRule(data.CreateMTLSTrafficPolicyForDestinationRules(),
			data.CreateEmptyDestinationRule("bookinfo", "reviews", "reviews")),
	}

	testValidationsNotAdded(t, destinationRules, mTLSDetails)
}

// Context: MeshPolicy Enabling mTLS
// Context: DestinationRule does specify trafficPolicy and TLS options
// It doesn't return any validation
func TestMTLSMeshWideEnabledDRWithPortLevelTLSTrafficPolicy(t *testing.T) {
	mTLSDetails := kubernetes.MTLSDetails{
		DestinationRules: []*networking_v1.DestinationRule{
			// Mesh-wide DR enabling mTLS communication
			data.AddTrafficPolicyToDestinationRule(data.CreateMTLSTrafficPolicyForDestinationRules(),
				data.CreateEmptyDestinationRule("bookinfo", "default", "*.local")),
			data.AddTrafficPolicyToDestinationRule(data.CreateMTLSTrafficPolicyForDestinationRules(),
				data.CreateEmptyDestinationRule("bookinfo", "reviews", "reviews")),
		},
	}

	destinationRules := []*networking_v1.DestinationRule{
		// Subject DR that specify TrafficPolicy
		data.AddTrafficPolicyToDestinationRule(data.CreateTLSPortLevelTrafficPolicyForDestinationRules(),
			data.CreateEmptyDestinationRule("bookinfo", "reviews", "reviews")),
	}

	testValidationsNotAdded(t, destinationRules, mTLSDetails)
}

// Context: Namespace-wide mTLS enabled
// Context: DestinationRule doesn't specify trafficPolicy
// It returns a validation
func TestNamespacemTLSEnabledDRWithoutTrafficPolicy(t *testing.T) {
	mTLSDetails := kubernetes.MTLSDetails{
		DestinationRules: []*networking_v1.DestinationRule{
			// Namespace-wide DR enabling mTLS communication
			data.AddTrafficPolicyToDestinationRule(data.CreateMTLSTrafficPolicyForDestinationRules(),
				data.CreateEmptyDestinationRule("bookinfo", "default", "*.bookinfo.svc.cluster.local")),
			data.AddTrafficPolicyToDestinationRule(data.CreateMTLSTrafficPolicyForDestinationRules(),
				data.CreateEmptyDestinationRule("bookinfo", "reviews", "reviews")),
		},
	}

	destinationRules := []*networking_v1.DestinationRule{
		// Subject DR that doesn't specify any trafficPolicy
		data.CreateEmptyDestinationRule("bookinfo", "reviews", "reviews"),
	}

	testValidationAdded(t, destinationRules, mTLSDetails)
}

// Context: Namespace-wide mTLS enabled
// Context: DestinationRule doesn't specify mTLS options
// It returns a validation
func TestNamespacemTLSEnabledDRWithoutmTLSOptions(t *testing.T) {
	mTLSDetails := kubernetes.MTLSDetails{
		DestinationRules: []*networking_v1.DestinationRule{
			// Namespace-wide DR enabling mTLS communication
			data.AddTrafficPolicyToDestinationRule(data.CreateMTLSTrafficPolicyForDestinationRules(),
				data.CreateEmptyDestinationRule("bookinfo", "default", "*.bookinfo.svc.cluster.local")),
			data.AddTrafficPolicyToDestinationRule(data.CreateMTLSTrafficPolicyForDestinationRules(),
				data.CreateEmptyDestinationRule("bookinfo", "reviews", "reviews")),
		},
	}

	destinationRules := []*networking_v1.DestinationRule{
		// Subject DR that specify trafficPolicy but no mTLS options
		data.AddTrafficPolicyToDestinationRule(data.CreateLoadBalancerTrafficPolicyForDestinationRules(),
			data.CreateEmptyDestinationRule("bookinfo", "reviews", "reviews")),
	}

	testValidationAdded(t, destinationRules, mTLSDetails)
}

// Context: Namespace-wide mTLS enabled
// Context: DestinationRule does specify trafficPolicy
// It doesn't return any validation
func TestNamespacemTLSEnabledDRWithTrafficPolicy(t *testing.T) {
	mTLSDetails := kubernetes.MTLSDetails{
		DestinationRules: []*networking_v1.DestinationRule{
			// Namespace-wide DR enabling mTLS communication
			data.AddTrafficPolicyToDestinationRule(data.CreateMTLSTrafficPolicyForDestinationRules(),
				data.CreateEmptyDestinationRule("bookinfo", "default", "*.local")),
			data.AddTrafficPolicyToDestinationRule(data.CreateMTLSTrafficPolicyForDestinationRules(),
				data.CreateEmptyDestinationRule("bookinfo", "reviews", "reviews")),
		},
	}

	destinationRules := []*networking_v1.DestinationRule{
		// Subject DR that specify trafficPolicy and mTLS options
		data.AddTrafficPolicyToDestinationRule(data.CreateMTLSTrafficPolicyForDestinationRules(),
			data.CreateEmptyDestinationRule("bookinfo", "reviews", "reviews")),
	}

	testValidationsNotAdded(t, destinationRules, mTLSDetails)
}

// Context: Namespace-wide mTLS enabled
// Context: DestinationRule doesn't specify trafficPolicy and host is from other namespace
// It doesn't return any validation
func TestCrossNamespaceProtection(t *testing.T) {
	mTLSDetails := kubernetes.MTLSDetails{
		DestinationRules: []*networking_v1.DestinationRule{
			// Namespace-wide DR enabling mTLS communication
			data.AddTrafficPolicyToDestinationRule(data.CreateMTLSTrafficPolicyForDestinationRules(),
				data.CreateEmptyDestinationRule("bookinfo", "default", "*.bookinfo.svc.cluster.local")),
		},
	}

	destinationRules := []*networking_v1.DestinationRule{
		data.AddTrafficPolicyToDestinationRule(data.CreateLoadBalancerTrafficPolicyForDestinationRules(),
			data.CreateEmptyDestinationRule("other", "reviews", "reviews.other.svc.cluster.local")),
	}

	testValidationsNotAdded(t, destinationRules, mTLSDetails)
}

// Context: Namespace-wide mTLS enabled
// Context: DestinationRule doesn't specify trafficPolicy and host is from a ServiceEntry
// It doesn't return any validation
func TestCrossNamespaceServiceEntryProtection(t *testing.T) {
	mTLSDetails := kubernetes.MTLSDetails{
		DestinationRules: []*networking_v1.DestinationRule{
			// Namespace-wide DR enabling mTLS communication
			data.AddTrafficPolicyToDestinationRule(data.CreateMTLSTrafficPolicyForDestinationRules(),
				data.CreateEmptyDestinationRule("bookinfo", "default", "*.bookinfo.svc.cluster.local")),
		},
	}

	destinationRules := []*networking_v1.DestinationRule{
		// Subject DR that specify trafficPolicy and mTLS options
		data.AddTrafficPolicyToDestinationRule(data.CreateLoadBalancerTrafficPolicyForDestinationRules(),
			data.CreateEmptyDestinationRule("other", "service-entry-dr", "wikipedia.org")),
	}

	testValidationsNotAdded(t, destinationRules, mTLSDetails)
}

func testValidationAdded(t *testing.T, destinationRules []*networking_v1.DestinationRule, mTLSDetails kubernetes.MTLSDetails) *models.IstioValidation {
	assert := assert.New(t)

	vals := TrafficPolicyChecker{
		Cluster:          config.DefaultClusterID,
		DestinationRules: destinationRules,
		MTLSDetails:      mTLSDetails,
	}.Check()

	assert.NotEmpty(vals)
	assert.Equal(1, len(vals))

	validation, ok := vals[models.BuildKey(kubernetes.DestinationRules.String(), "reviews", "bookinfo", config.DefaultClusterID)]
	assert.True(ok)
	assert.True(validation.Valid)

	assert.NotEmpty(validation.Checks)
	assert.Equal(models.WarningSeverity, validation.Checks[0].Severity)
	assert.Equal("spec/trafficPolicy", validation.Checks[0].Path)
	assert.NoError(validations.ConfirmIstioCheckMessage("destinationrules.trafficpolicy.notlssettings", validation.Checks[0]))

	assert.True(len(validation.References) > 0)
	return validation
}

func testValidationsNotAdded(t *testing.T, destinationRules []*networking_v1.DestinationRule, mTLSDetails kubernetes.MTLSDetails) {
	assert := assert.New(t)

	vals := TrafficPolicyChecker{
		Cluster:          config.DefaultClusterID,
		DestinationRules: destinationRules,
		MTLSDetails:      mTLSDetails,
	}.Check()

	assert.Empty(vals)
	validation, ok := vals[models.BuildKey(kubernetes.DestinationRules.String(), "reviews", "bookinfo", config.DefaultClusterID)]

	assert.False(ok)
	assert.Nil(validation)
}

func presentReferences(t *testing.T, validation models.IstioValidation, ns string, serviceNames []string) {
	assert := assert.New(t)
	assert.True(len(validation.References) > 0)

	for _, sn := range serviceNames {
		refKey := models.IstioValidationKey{ObjectType: kubernetes.DestinationRules.String(), Namespace: ns, Name: sn, Cluster: config.DefaultClusterID}
		assert.Contains(validation.References, refKey)
	}
}
