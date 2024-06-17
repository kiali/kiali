package peerauthentications

import (
	"testing"

	"github.com/stretchr/testify/assert"
	networking_v1 "istio.io/client-go/pkg/apis/networking/v1"
	security_v1 "istio.io/client-go/pkg/apis/security/v1"

	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tests/data"
	"github.com/kiali/kiali/tests/testutils/validations"
)

// Describe the validation of a MeshPolicy that enables mTLS. The validation is risen when there isn't any
// Destination Rule enabling clients start mTLS connections.

// Context: MeshPolicy enables mTLS
// Context: There is one Destination Rule enabling mTLS mesh-wide
// It doesn't return any validation
func TestMeshPolicymTLSEnabled(t *testing.T) {
	meshPolicy := data.CreateEmptyMeshPeerAuthentication("default", data.CreateMTLS("STRICT"))
	mTLSDetails := kubernetes.MTLSDetails{
		DestinationRules: []*networking_v1.DestinationRule{
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
	meshPolicy := data.CreateEmptyMeshPeerAuthentication("default", data.CreateMTLS("STRICT"))
	mTLSDetails := kubernetes.MTLSDetails{
		DestinationRules: []*networking_v1.DestinationRule{
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
	meshPolicy := data.CreateEmptyMeshPeerAuthentication("default", data.CreateMTLS("STRICT"))
	mTLSDetails := kubernetes.MTLSDetails{
		DestinationRules: []*networking_v1.DestinationRule{
			data.CreateEmptyDestinationRule("bar", "default", "*.bar.svc.cluster.local"),
		},
	}

	testValidationAdded(t, meshPolicy, mTLSDetails)
}

// Context: MeshPolicy enables mTLS
// Context: There isn't any Destination Rule
// It returns a validation
func TestMeshPolicymTLSEnabledDestinationRuleMissing(t *testing.T) {
	meshPolicy := data.CreateEmptyMeshPeerAuthentication("default", data.CreateMTLS("STRICT"))
	mTLSDetails := kubernetes.MTLSDetails{
		DestinationRules: []*networking_v1.DestinationRule{},
	}

	testValidationAdded(t, meshPolicy, mTLSDetails)
}

// Context: MeshPolicy doesn't enable mTLS
// Context: There is one Destination Rule enabling mTLS mesh-wide
// It doesn't return any validation
func TestMeshPolicymTLSDisabledDestinationRulePresent(t *testing.T) {
	meshPolicy := data.CreateEmptyMeshPeerAuthentication("default", data.CreateMTLS("PERMISSIVE"))
	mTLSDetails := kubernetes.MTLSDetails{
		DestinationRules: []*networking_v1.DestinationRule{
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
	meshPolicy := data.CreateEmptyMeshPeerAuthentication("default", data.CreateMTLS("PERMISSIVE"))
	mTLSDetails := kubernetes.MTLSDetails{
		DestinationRules: []*networking_v1.DestinationRule{
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
	meshPolicy := data.CreateEmptyMeshPeerAuthentication("default", data.CreateMTLS("PERMISSIVE"))
	mTLSDetails := kubernetes.MTLSDetails{
		DestinationRules: []*networking_v1.DestinationRule{
			data.CreateEmptyDestinationRule("bar", "default", "*.bar.svc.cluster.local"),
		},
	}

	testValidationsNotAdded(t, meshPolicy, mTLSDetails)
}

// Context: MeshPolicy doesn't enable mTLS
// Context: There isn't any Destination Rule
// It doesn't return a validation
func TestMeshPolicymTLSDisabledDestinationRuleMissing(t *testing.T) {
	meshPolicy := data.CreateEmptyMeshPeerAuthentication("default", data.CreateMTLS("PERMISSIVE"))
	mTLSDetails := kubernetes.MTLSDetails{
		DestinationRules: []*networking_v1.DestinationRule{},
	}

	testValidationsNotAdded(t, meshPolicy, mTLSDetails)
}

func testValidationAdded(t *testing.T, meshPolicy *security_v1.PeerAuthentication, mTLSDetails kubernetes.MTLSDetails) {
	assert := assert.New(t)

	vals, valid := MeshMtlsChecker{
		MeshPolicy:  meshPolicy,
		MTLSDetails: mTLSDetails,
	}.Check()

	assert.NotEmpty(vals)
	assert.Equal(1, len(vals))
	assert.False(valid)

	validation := vals[0]
	assert.NotNil(validation)
	assert.Equal(models.ErrorSeverity, validation.Severity)
	assert.Equal("spec/mtls", validation.Path)
	assert.NoError(validations.ConfirmIstioCheckMessage("peerauthentication.mtls.destinationrulemissing", validation))
}

func testValidationsNotAdded(t *testing.T, meshPolicy *security_v1.PeerAuthentication, mTLSDetails kubernetes.MTLSDetails) {
	assert := assert.New(t)

	vals, valid := MeshMtlsChecker{
		MeshPolicy:  meshPolicy,
		MTLSDetails: mTLSDetails,
	}.Check()

	assert.Empty(vals)
	assert.True(valid)
}

func TestNoValidationsAddedWhenStrictAndAutoMtlsEnabled(t *testing.T) {
	assert := assert.New(t)

	meshPolicy := data.CreateEmptyMeshPeerAuthentication("default", data.CreateMTLS("STRICT"))
	mTLSDetails := kubernetes.MTLSDetails{
		DestinationRules: []*networking_v1.DestinationRule{},
		EnabledAutoMtls:  true,
	}

	vals, valid := MeshMtlsChecker{
		MeshPolicy:    meshPolicy,
		MTLSDetails:   mTLSDetails,
		IsServiceMesh: true,
	}.Check()

	assert.Empty(vals)
	assert.True(valid)

}
