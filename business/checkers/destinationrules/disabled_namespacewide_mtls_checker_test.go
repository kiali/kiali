package destinationrules

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

// Context: DestinationRule ns-wide disabling mTLS connections
// Context: PeerAuthn ns-wide in permissive mode
// It doesn't return any validation
func TestDRNSWideDisablingTLSPolicyPermissive(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	destinationRule := data.AddTrafficPolicyToDestinationRule(data.CreateDisabledMTLSTrafficPolicyForDestinationRules(),
		data.CreateEmptyDestinationRule("bookinfo", "disable-mtls", "*.bookinfo.svc.cluster.local"))

	mTlsDetails := kubernetes.MTLSDetails{
		PeerAuthentications: []*security_v1.PeerAuthentication{
			data.CreateEmptyPeerAuthentication("default", "bookinfo", data.CreateMTLS("PERMISSIVE")),
		},
	}

	testNoDisabledMtlsValidationsFound(t, destinationRule, mTlsDetails, false)
	testNoDisabledMtlsValidationsFound(t, destinationRule, mTlsDetails, true)
}

// Context: DestinationRule ns-wide disabling mTLS connections
// Context: PeerAuthn ns-wide in disable mode
// It doesn't return any validation
func TestDRNSWideDisablingTLSPolicyDisable(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	destinationRule := data.AddTrafficPolicyToDestinationRule(data.CreateDisabledMTLSTrafficPolicyForDestinationRules(),
		data.CreateEmptyDestinationRule("bookinfo", "disable-mtls", "*.bookinfo.svc.cluster.local"))

	mTlsDetails := kubernetes.MTLSDetails{
		PeerAuthentications: []*security_v1.PeerAuthentication{
			data.CreateEmptyPeerAuthentication("default", "bookinfo", data.CreateMTLS("DISABLE")),
		},
	}

	testNoDisabledMtlsValidationsFound(t, destinationRule, mTlsDetails, false)
	testNoDisabledMtlsValidationsFound(t, destinationRule, mTlsDetails, true)
}

// Context: DestinationRule ns-wide disabling mTLS connections
// Context: PeerAuthn ns-wide in permissive mode
// Context: Does have a MeshPolicy in strict mode
// It doesn't return any validation
func TestDRNSWideDisablingTLSPolicyPermissiveMeshStrict(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	destinationRule := data.AddTrafficPolicyToDestinationRule(data.CreateDisabledMTLSTrafficPolicyForDestinationRules(),
		data.CreateEmptyDestinationRule("bookinfo", "disable-mtls", "*.bookinfo.svc.cluster.local"))

	mTlsDetails := kubernetes.MTLSDetails{
		PeerAuthentications: []*security_v1.PeerAuthentication{
			data.CreateEmptyPeerAuthentication("default", "bookinfo", data.CreateMTLS("PERMISSIVE")),
		},
		MeshPeerAuthentications: []*security_v1.PeerAuthentication{
			data.CreateEmptyMeshPeerAuthentication("default", data.CreateMTLS("STRICT")),
		},
	}

	testNoDisabledMtlsValidationsFound(t, destinationRule, mTlsDetails, false)
	testNoDisabledMtlsValidationsFound(t, destinationRule, mTlsDetails, true)
}

// Context: DestinationRule ns-wide disabling mTLS connections
// Context: PeerAuthn ns-wide in strict mode
// It returns a policymtlsenabled validation
func TestDRNSWideDisablingTLSPolicyStrict(t *testing.T) {
	destinationRule := data.AddTrafficPolicyToDestinationRule(data.CreateDisabledMTLSTrafficPolicyForDestinationRules(),
		data.CreateEmptyDestinationRule("bookinfo", "disable-mtls", "*.bookinfo.svc.cluster.local"))

	mTlsDetails := kubernetes.MTLSDetails{
		PeerAuthentications: []*security_v1.PeerAuthentication{
			data.CreateEmptyPeerAuthentication("default", "bookinfo", data.CreateMTLS("STRICT")),
		},
	}

	testDisabledMtlsValidationsFound(t, "destinationrules.mtls.policymtlsenabled", destinationRule, mTlsDetails, false)
	testDisabledMtlsValidationsFound(t, "destinationrules.mtls.policymtlsenabled", destinationRule, mTlsDetails, true)
}

// Context: DestinationRule ns-wide disabling mTLS connections
// Context: Doesn't have PeerAuthn ns-wide defining TLS settings
// Context: Does have a MeshPolicy in strict mode
// It returns a meshpolicymtlsenabled validation
func TestDRNSWideDisablingTLSMeshPolicyStrict(t *testing.T) {
	destinationRule := data.AddTrafficPolicyToDestinationRule(data.CreateDisabledMTLSTrafficPolicyForDestinationRules(),
		data.CreateEmptyDestinationRule("bookinfo", "disable-mtls", "*.bookinfo.svc.cluster.local"))

	mTlsDetails := kubernetes.MTLSDetails{
		MeshPeerAuthentications: []*security_v1.PeerAuthentication{
			data.CreateEmptyMeshPeerAuthentication("default", data.CreateMTLS("STRICT")),
		},
	}

	testDisabledMtlsValidationsFound(t, "destinationrules.mtls.meshpolicymtlsenabled", destinationRule, mTlsDetails, false)
	testDisabledMtlsValidationsFound(t, "destinationrules.mtls.meshpolicymtlsenabled", destinationRule, mTlsDetails, true)
}

// Context: DestinationRule ns-wide disabling mTLS connections
// Context: Doesn't have PeerAuthn ns-wide defining TLS settings
// Context: Does have a MeshPolicy in permissive mode
// It doesn't return any validation
func TestDRNSWideDisablingTLSMeshPolicyPermissive(t *testing.T) {
	destinationRule := data.AddTrafficPolicyToDestinationRule(data.CreateDisabledMTLSTrafficPolicyForDestinationRules(),
		data.CreateEmptyDestinationRule("bookinfo", "disable-mtls", "*.bookinfo.svc.cluster.local"))

	mTlsDetails := kubernetes.MTLSDetails{
		MeshPeerAuthentications: []*security_v1.PeerAuthentication{
			data.CreateEmptyMeshPeerAuthentication("default", data.CreateMTLS("PERMISSIVE")),
		},
	}

	testNoDisabledMtlsValidationsFound(t, destinationRule, mTlsDetails, false)
	testNoDisabledMtlsValidationsFound(t, destinationRule, mTlsDetails, true)
}

// Context: DestinationRule ns-wide disabling mTLS connections
// Context: Doesn't have PeerAuthn ns-wide defining TLS settings
// Context: Doesn't have a MeshPolicy defining TLS settings
// It doesn't return any validation
func TestDRNSWideDisablingTLSWithoutPolicy(t *testing.T) {
	destinationRule := data.AddTrafficPolicyToDestinationRule(data.CreateDisabledMTLSTrafficPolicyForDestinationRules(),
		data.CreateEmptyDestinationRule("bookinfo", "disable-mtls", "*.bookinfo.svc.cluster.local"))

	mTlsDetails := kubernetes.MTLSDetails{}

	testNoDisabledMtlsValidationsFound(t, destinationRule, mTlsDetails, false)
	testNoDisabledMtlsValidationsFound(t, destinationRule, mTlsDetails, true)
}

// Context: There isn't any ns-wide DestinationRule defining mTLS connections
// It doesn't return any validation
func TestDRNonTLSRelated(t *testing.T) {
	destinationRule := data.AddTrafficPolicyToDestinationRule(data.CreateDisabledMTLSTrafficPolicyForDestinationRules(),
		data.CreateEmptyDestinationRule("bookinfo", "dr-mtls", "*.local"))

	mTlsDetails := kubernetes.MTLSDetails{}

	testNoDisabledMtlsValidationsFound(t, destinationRule, mTlsDetails, false)
	testNoDisabledMtlsValidationsFound(t, destinationRule, mTlsDetails, true)
}

// Context: mTLS is strict at MESH-level
// Context: mTLS is disabled at namespace-level
// It doesn't return any validation
func TestMtlsStrictNsDisable(t *testing.T) {
	destinationRule := data.AddTrafficPolicyToDestinationRule(data.CreateDisabledMTLSTrafficPolicyForDestinationRules(), data.CreateEmptyDestinationRule("bookinfo", "dr-mtls-disabled", "*.bookinfo.svc.cluster.local"))

	mTlsDetails := kubernetes.MTLSDetails{
		MeshPeerAuthentications: []*security_v1.PeerAuthentication{
			data.CreateEmptyMeshPeerAuthentication("default", data.CreateMTLS("STRICT")),
		},
		PeerAuthentications: []*security_v1.PeerAuthentication{
			data.CreateEmptyPeerAuthentication("disable-bookinfo", "bookinfo", data.CreateMTLS("DISABLE")),
		},
		DestinationRules: []*networking_v1.DestinationRule{
			data.AddTrafficPolicyToDestinationRule(data.CreateMTLSTrafficPolicyForDestinationRules(), data.CreateEmptyDestinationRule("istio-system", "dr-mtls", "*.local")),
		},
	}

	testNoDisabledMtlsValidationsFound(t, destinationRule, mTlsDetails, false)
	testNoDisabledMtlsValidationsFound(t, destinationRule, mTlsDetails, true)
}

func testNoDisabledMtlsValidationsFound(t *testing.T, destinationRule *networking_v1.DestinationRule, mTLSDetails kubernetes.MTLSDetails, autoMtls bool) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	mTLSDetails.EnabledAutoMtls = autoMtls

	validations, valid := DisabledNamespaceWideMTLSChecker{
		DestinationRule: destinationRule,
		MTLSDetails:     mTLSDetails,
	}.Check()

	assert.Empty(validations)
	assert.True(valid)
}

func testDisabledMtlsValidationsFound(t *testing.T, validationId string, destinationRule *networking_v1.DestinationRule, mTLSDetails kubernetes.MTLSDetails, autoMtls bool) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	mTLSDetails.EnabledAutoMtls = autoMtls

	vals, valid := DisabledNamespaceWideMTLSChecker{
		DestinationRule: destinationRule,
		MTLSDetails:     mTLSDetails,
	}.Check()

	assert.NotEmpty(vals)
	assert.Equal(1, len(vals))
	assert.False(valid)

	validation := vals[0]
	assert.NotNil(validation)
	assert.Equal(models.ErrorSeverity, validation.Severity)
	assert.Equal("spec/trafficPolicy/tls/mode", validation.Path)
	assert.NoError(validations.ConfirmIstioCheckMessage(validationId, validation))
}
