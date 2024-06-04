package peerauthentications

import (
	"testing"

	"github.com/stretchr/testify/assert"
	networking_v1 "istio.io/client-go/pkg/apis/networking/v1"
	security_v1 "istio.io/client-go/pkg/apis/security/v1"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tests/data"
	"github.com/kiali/kiali/tests/testutils/validations"
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
		DestinationRules: []*networking_v1.DestinationRule{
			data.CreateEmptyDestinationRule("bar", "default", "*.bar.svc.cluster.local"),
		},
	}

	vals, valid := NamespaceMtlsChecker{
		PeerAuthn:   policy,
		MTLSDetails: mTLSDetails,
	}.Check()

	assert.NotEmpty(vals)
	assert.Equal(1, len(vals))
	assert.False(valid)

	validation := vals[0]
	assert.NotNil(validation)
	assert.Equal(models.ErrorSeverity, validation.Severity)
	assert.Equal("spec/mtls", validation.Path)
	assert.NoError(validations.ConfirmIstioCheckMessage("peerauthentications.mtls.destinationrulemissing", validation))
}

// Context: PeerAuthn enables mTLS for a namespace
// Context: There is one Destination Rule enabling mTLS for the namespace
// It returns doesn't return any validation
func TestPolicyEnabledDRmTLSEnabled(t *testing.T) {
	peerAuthn := data.CreateEmptyPeerAuthentication("default", "bar", data.CreateMTLS("STRICT"))
	mTLSDetails := kubernetes.MTLSDetails{
		DestinationRules: []*networking_v1.DestinationRule{
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
		DestinationRules: []*networking_v1.DestinationRule{
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
		DestinationRules: []*networking_v1.DestinationRule{
			data.CreateEmptyDestinationRule("bar", "default", "*.bar.svc.cluster.local"),
		},
	}
	assertNoValidations(t, peerAuthn, mTLSDetails)
}

func assertNoValidations(t *testing.T, peerAuth *security_v1.PeerAuthentication, mTLSDetails kubernetes.MTLSDetails) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	vals, valid := NamespaceMtlsChecker{
		PeerAuthn:   peerAuth,
		MTLSDetails: mTLSDetails,
	}.Check()

	assert.Empty(vals)
	assert.True(valid)
}

func TestNoNamespaceWideValidationsAddedWhenStrictAndAutoMtlsEnabled(t *testing.T) {
	assert := assert.New(t)

	meshPolicy := data.CreateEmptyMeshPeerAuthentication("default", data.CreateMTLS("STRICT"))
	mTLSDetails := kubernetes.MTLSDetails{
		DestinationRules: []*networking_v1.DestinationRule{},
		EnabledAutoMtls:  true,
	}

	vals, valid := MeshMtlsChecker{
		MeshPolicy:  meshPolicy,
		MTLSDetails: mTLSDetails,
	}.Check()

	assert.Empty(vals)
	assert.True(valid)

}
