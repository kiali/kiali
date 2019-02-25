package meshpolicies

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tests/data"
)

// Describe the validation of a MeshPolicy that enables mTLS. The validation is risen when there isn't any
// Destination Rule enabling clients start mTLS connections.

// Context: MeshPolicy enables mTLS
// Context: There is one Destination Rule enabling mTLS mesh-wide
// It doesn't return any validation
func TestMeshPolicymTLSDisabled(t *testing.T) {
	meshPolicy := data.CreateEmptyMeshPolicy("default", data.CreateMTLSPeers("STRICT"))
	mTLSDetails := kubernetes.MTLSDetails{
		DestinationRules: []kubernetes.IstioObject{
			data.AddTrafficPolicyToDestinationRule(data.CreateMTLSTrafficPolicyForDestinationRules(),
				data.CreateEmptyDestinationRule("default", "default", "*.local")),
		},
	}

	testValidationsNotAdded(t, meshPolicy, mTLSDetails)
}

// Context: MeshPolicy enables mTLS
// Context: There is one Destination Rule enabling mTLS namespace-wide
// It returns a validation
func TestMeshPolicyEnabledDRNamespaceWide(t *testing.T) {
	meshPolicy := data.CreateEmptyMeshPolicy("default", data.CreateMTLSPeers("STRICT"))
	mTLSDetails := kubernetes.MTLSDetails{
		DestinationRules: []kubernetes.IstioObject{
			data.AddTrafficPolicyToDestinationRule(data.CreateMTLSTrafficPolicyForDestinationRules(),
				data.CreateEmptyDestinationRule("bookinfo", "default", "*.bookinfo.svc.cluster.local")),
		},
	}

	testValidationAdded(t, meshPolicy, mTLSDetails)
}

// Context: MeshPolicy enables mTLS
// Context: There is one Destination Rule not enabling any kind of mTLS
// It returns a validation
func TestMeshPolicyEnabledDRmTLSDisabled(t *testing.T) {
	meshPolicy := data.CreateEmptyMeshPolicy("default", data.CreateMTLSPeers("STRICT"))
	mTLSDetails := kubernetes.MTLSDetails{
		DestinationRules: []kubernetes.IstioObject{
			data.CreateEmptyDestinationRule("bar", "default", "*.bar.svc.cluster.local"),
		},
	}

	testValidationAdded(t, meshPolicy, mTLSDetails)
}

// Context: MeshPolicy enables mTLS
// Context: There isn't any Destination Rule
// It returns a validation
func TestMeshPolicymTLSEnabledDestinationRuleMissing(t *testing.T) {
	meshPolicy := data.CreateEmptyMeshPolicy("default", data.CreateMTLSPeers("STRICT"))
	mTLSDetails := kubernetes.MTLSDetails{
		DestinationRules: []kubernetes.IstioObject{},
	}

	testValidationAdded(t, meshPolicy, mTLSDetails)
}

// Context: MeshPolicy doesn't enable mTLS
// Context: There is one Destination Rule enabling mTLS mesh-wide
// It doesn't return any validation
func TestMeshPolicymTLSDisabledDestinationRulePresent(t *testing.T) {
	meshPolicy := data.CreateEmptyMeshPolicy("default", data.CreateMTLSPeers("PERMISSIVE"))
	mTLSDetails := kubernetes.MTLSDetails{
		DestinationRules: []kubernetes.IstioObject{
			data.AddTrafficPolicyToDestinationRule(data.CreateMTLSTrafficPolicyForDestinationRules(),
				data.CreateEmptyDestinationRule("default", "default", "*.local")),
		},
	}

	testValidationsNotAdded(t, meshPolicy, mTLSDetails)
}

// Context: MeshPolicy doesn't enable mTLS
// Context: There is one Destination Rule enabling mTLS namespace-wide
// It doesn't return any validation
func TestMeshPolicyDisabledDRNamespaceWide(t *testing.T) {
	meshPolicy := data.CreateEmptyMeshPolicy("default", data.CreateMTLSPeers("PERMISSIVE"))
	mTLSDetails := kubernetes.MTLSDetails{
		DestinationRules: []kubernetes.IstioObject{
			data.AddTrafficPolicyToDestinationRule(data.CreateMTLSTrafficPolicyForDestinationRules(),
				data.CreateEmptyDestinationRule("bookinfo", "default", "*.bookinfo.svc.cluster.local")),
		},
	}

	testValidationsNotAdded(t, meshPolicy, mTLSDetails)
}

// Context: MeshPolicy doesn't enable mTLS
// Context: There is one Destination Rule not enabling any kind of mTLS
// It doesn't return any validation
func TestMeshPolicyDisabledDRmTLSDisabled(t *testing.T) {
	meshPolicy := data.CreateEmptyMeshPolicy("default", data.CreateMTLSPeers("PERMISSIVE"))
	mTLSDetails := kubernetes.MTLSDetails{
		DestinationRules: []kubernetes.IstioObject{
			data.CreateEmptyDestinationRule("bar", "default", "*.bar.svc.cluster.local"),
		},
	}

	testValidationsNotAdded(t, meshPolicy, mTLSDetails)
}

// Context: MeshPolicy doesn't enable mTLS
// Context: There isn't any Destination Rule
// It doesn't return a validation
func TestMeshPolicymTLSDisabledDestinationRuleMissing(t *testing.T) {
	meshPolicy := data.CreateEmptyMeshPolicy("default", data.CreateMTLSPeers("PERMISSIVE"))
	mTLSDetails := kubernetes.MTLSDetails{
		DestinationRules: []kubernetes.IstioObject{},
	}

	testValidationsNotAdded(t, meshPolicy, mTLSDetails)
}

func testValidationAdded(t *testing.T, meshPolicy kubernetes.IstioObject, mTLSDetails kubernetes.MTLSDetails) {
	assert := assert.New(t)

	validations := MtlsChecker{
		MeshPolicy:  meshPolicy,
		MTLSDetails: mTLSDetails,
	}.Check()

	assert.NotEmpty(validations)
	assert.Equal(1, len(validations))

	validation, ok := validations[models.BuildKey(MeshPolicyCheckerType, "default")]
	assert.True(ok)
	assert.False(validation.Valid)

	assert.NotEmpty(validation.Checks)
	assert.Equal(models.ErrorSeverity, validation.Checks[0].Severity)
	assert.Equal("", validation.Checks[0].Path)
	assert.Equal(models.CheckMessage("meshpolicies.mtls.destinationrulemissing"), validation.Checks[0].Message)
}

func testValidationsNotAdded(t *testing.T, meshPolicy kubernetes.IstioObject, mTLSDetails kubernetes.MTLSDetails) {
	assert := assert.New(t)

	validations := MtlsChecker{
		MeshPolicy:  meshPolicy,
		MTLSDetails: mTLSDetails,
	}.Check()

	assert.Empty(validations)
	validation, ok := validations[models.BuildKey(MeshPolicyCheckerType, "default")]

	assert.False(ok)
	assert.Nil(validation)
}
