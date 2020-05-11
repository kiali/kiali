package peerauthentications

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tests/data"
)

// Describe the validation of a PeerAuthn that enables mTLS for one namespace. The validation is risen when there isn't any
// Destination Rule enabling clients start mTLS connections.

// Context: PeerAuthn enables mTLS for a namespace
// Context: There is one Destination Rule not enabling mTLS
// It returns a validation
func TestPeerAuthnmTLSEnabled(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	policy := data.CreateEmptyPeerAuthentication("default", "bar", data.CreateMTLS("STRICT"))
	mTLSDetails := kubernetes.MTLSDetails{
		DestinationRules: []kubernetes.IstioObject{
			data.CreateEmptyDestinationRule("bar", "default", "*.bar.svc.cluster.local"),
		},
	}

	validations, valid := NamespaceMtlsChecker{
		PeerAuthn:   policy,
		MTLSDetails: mTLSDetails,
	}.Check()

	assert.NotEmpty(validations)
	assert.Equal(1, len(validations))
	assert.False(valid)

	validation := validations[0]
	assert.NotNil(validation)
	assert.Equal(models.ErrorSeverity, validation.Severity)
	assert.Equal("spec/mtls", validation.Path)
	assert.Equal(models.CheckMessage("peerauthentications.mtls.destinationrulemissing"), validation.Message)
}

// Context: PeerAuthn enables mTLS for a namespace
// Context: There is one Destination Rule enabling mTLS for the namespace
// It returns doesn't return any validation
func TestPolicyEnabledDRmTLSEnabled(t *testing.T) {
	peerAuthn := data.CreateEmptyPeerAuthentication("default", "bar", data.CreateMTLS("STRICT"))
	mTLSDetails := kubernetes.MTLSDetails{
		DestinationRules: []kubernetes.IstioObject{
			data.AddTrafficPolicyToDestinationRule(data.CreateMTLSTrafficPolicyForDestinationRules(),
				data.CreateEmptyDestinationRule("bar", "default", "*.bar.svc.cluster.local")),
		},
	}

	assertNoValidations(t, peerAuthn, mTLSDetails)
}

// Context: PeerAuthn enables mTLS for a namespace
// Context: There is one Destination Rule enabling mTLS for the namespace
// Context: There is one Destination Rule enabling mTLS for the whole service-mesh
// It returns doesn't return any validation
func TestPolicyEnabledDRmTLSMeshWideEnabled(t *testing.T) {
	peerAuthn := data.CreateEmptyPeerAuthentication("default", "bar", data.CreateMTLS("STRICT"))

	mTLSDetails := kubernetes.MTLSDetails{
		DestinationRules: []kubernetes.IstioObject{
			data.AddTrafficPolicyToDestinationRule(data.CreateMTLSTrafficPolicyForDestinationRules(),
				data.CreateEmptyDestinationRule("bar", "default", "*.local")),
		},
	}

	assertNoValidations(t, peerAuthn, mTLSDetails)

}

// Context: PeerAuthn enables mTLS in PERMISSIVE mode
// Context: Any Destination Rule.
// It doesn't return any validation
func TestPolicyPermissive(t *testing.T) {
	peerAuthn := data.CreateEmptyPeerAuthentication("default", "bar", data.CreateMTLS("PERMISSIVE"))
	mTLSDetails := kubernetes.MTLSDetails{
		DestinationRules: []kubernetes.IstioObject{
			data.CreateEmptyDestinationRule("bar", "default", "*.bar.svc.cluster.local"),
		},
	}
	assertNoValidations(t, peerAuthn, mTLSDetails)
}

func assertNoValidations(t *testing.T, peerAuth kubernetes.IstioObject, mTLSDetails kubernetes.MTLSDetails) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	validations, valid := NamespaceMtlsChecker{
		PeerAuthn:   peerAuth,
		MTLSDetails: mTLSDetails,
	}.Check()

	assert.Empty(validations)
	assert.True(valid)
}