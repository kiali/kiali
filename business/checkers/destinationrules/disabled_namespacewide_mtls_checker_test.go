package destinationrules

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tests/data"
)

// Context: DestinationRule ns-wide disabling mTLS connections
// Context: Policy ns-wide in permissive mode
// It doesn't return any validation
func TestDRNSWideDisablingTLSPolicyPermissive(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	destinationRule := data.AddTrafficPolicyToDestinationRule(data.CreateDisabledMTLSTrafficPolicyForDestinationRules(),
		data.CreateEmptyDestinationRule("bookinfo", "disable-mtls", "*.bookinfo.svc.cluster.local"))

	mTlsDetails := kubernetes.MTLSDetails{
		Policies: []kubernetes.IstioObject{
			data.CreateEmptyPolicy("default", "bookinfo", data.CreateMTLSPeers("PERMISSIVE")),
		},
	}

	testNoDisabledMtlsValidationsFound(t, destinationRule, mTlsDetails)
}

// Context: DestinationRule ns-wide disabling mTLS connections
// Context: Policy ns-wide in permissive mode
// Context: Does have a MeshPolicy in strict mode
// It doesn't return any validation
func TestDRNSWideDisablingTLSPolicyPermissiveMeshStrict(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	destinationRule := data.AddTrafficPolicyToDestinationRule(data.CreateDisabledMTLSTrafficPolicyForDestinationRules(),
		data.CreateEmptyDestinationRule("bookinfo", "disable-mtls", "*.bookinfo.svc.cluster.local"))

	mTlsDetails := kubernetes.MTLSDetails{
		Policies: []kubernetes.IstioObject{
			data.CreateEmptyPolicy("default", "bookinfo", data.CreateMTLSPeers("PERMISSIVE")),
		},
		MeshPolicies: []kubernetes.IstioObject{
			data.CreateEmptyMeshPolicy("default", data.CreateMTLSPeers("STRICT")),
		},
	}

	testNoDisabledMtlsValidationsFound(t, destinationRule, mTlsDetails)
}

// Context: DestinationRule ns-wide disabling mTLS connections
// Context: Policy ns-wide in strict mode
// It returns a policymtlsenabled validation
func TestDRNSWideDisablingTLSPolicyStrict(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	destinationRule := data.AddTrafficPolicyToDestinationRule(data.CreateDisabledMTLSTrafficPolicyForDestinationRules(),
		data.CreateEmptyDestinationRule("bookinfo", "disable-mtls", "*.bookinfo.svc.cluster.local"))

	mTlsDetails := kubernetes.MTLSDetails{
		Policies: []kubernetes.IstioObject{
			data.CreateEmptyPolicy("default", "bookinfo", data.CreateMTLSPeers("STRICT")),
		},
	}

	testDisabledMtlsValidationsFound(t, "destinationrules.mtls.policymtlsenabled", destinationRule, mTlsDetails)
}

// Context: DestinationRule ns-wide disabling mTLS connections
// Context: Doesn't have Policy ns-wide defining TLS settings
// Context: Does have a MeshPolicy in strict mode
// It returns a meshpolicymtlsenabled validation
func TestDRNSWideDisablingTLSMeshPolicyStrict(t *testing.T) {
	destinationRule := data.AddTrafficPolicyToDestinationRule(data.CreateDisabledMTLSTrafficPolicyForDestinationRules(),
		data.CreateEmptyDestinationRule("bookinfo", "disable-mtls", "*.bookinfo.svc.cluster.local"))

	mTlsDetails := kubernetes.MTLSDetails{
		MeshPolicies: []kubernetes.IstioObject{
			data.CreateEmptyMeshPolicy("default", data.CreateMTLSPeers("STRICT")),
		},
	}

	testDisabledMtlsValidationsFound(t, "destinationrules.mtls.meshpolicymtlsenabled", destinationRule, mTlsDetails)
}

// Context: DestinationRule ns-wide disabling mTLS connections
// Context: Doesn't have Policy ns-wide defining TLS settings
// Context: Does have a MeshPolicy in permissive mode
// It doesn't return any validation
func TestDRNSWideDisablingTLSMeshPolicyPermissive(t *testing.T) {
	destinationRule := data.AddTrafficPolicyToDestinationRule(data.CreateDisabledMTLSTrafficPolicyForDestinationRules(),
		data.CreateEmptyDestinationRule("bookinfo", "disable-mtls", "*.bookinfo.svc.cluster.local"))

	mTlsDetails := kubernetes.MTLSDetails{
		MeshPolicies: []kubernetes.IstioObject{
			data.CreateEmptyMeshPolicy("default", data.CreateMTLSPeers("PERMISSIVE")),
		},
	}

	testNoDisabledMtlsValidationsFound(t, destinationRule, mTlsDetails)
}

// Context: DestinationRule ns-wide disabling mTLS connections
// Context: Doesn't have Policy ns-wide defining TLS settings
// Context: Doesn't have a MeshPolicy defining TLS settings
// It doesn't return any validation
func TestDRNSWideDisablingTLSWithoutPolicy(t *testing.T) {
	destinationRule := data.AddTrafficPolicyToDestinationRule(data.CreateDisabledMTLSTrafficPolicyForDestinationRules(),
		data.CreateEmptyDestinationRule("bookinfo", "disable-mtls", "*.bookinfo.svc.cluster.local"))

	mTlsDetails := kubernetes.MTLSDetails{}

	testNoDisabledMtlsValidationsFound(t, destinationRule, mTlsDetails)
}

// Context: There isn't any ns-wide DestinationRule defining mTLS connections
// It doesn't return any validation
func TestDRNonTLSRelated(t *testing.T) {
	destinationRule := data.AddTrafficPolicyToDestinationRule(data.CreateDisabledMTLSTrafficPolicyForDestinationRules(),
		data.CreateEmptyDestinationRule("bookinfo", "dr-mtls", "*.local"))

	mTlsDetails := kubernetes.MTLSDetails{}

	testNoDisabledMtlsValidationsFound(t, destinationRule, mTlsDetails)
}

func testNoDisabledMtlsValidationsFound(t *testing.T, destinationRule kubernetes.IstioObject, mTLSDetails kubernetes.MTLSDetails) {
	assert := assert.New(t)

	validations, valid := DisabledNamespaceWideMTLSChecker{
		DestinationRule: destinationRule,
		MTLSDetails:     mTLSDetails,
	}.Check()

	assert.Empty(validations)
	assert.True(valid)
}

func testDisabledMtlsValidationsFound(t *testing.T, validationId string, destinationRule kubernetes.IstioObject, mTLSDetails kubernetes.MTLSDetails) {
	assert := assert.New(t)

	validations, valid := DisabledNamespaceWideMTLSChecker{
		DestinationRule: destinationRule,
		MTLSDetails:     mTLSDetails,
	}.Check()

	assert.NotEmpty(validations)
	assert.Equal(1, len(validations))
	assert.False(valid)

	validation := validations[0]
	assert.NotNil(validation)
	assert.Equal(models.ErrorSeverity, validation.Severity)
	assert.Equal("spec/trafficPolicy/tls/mode", validation.Path)
	assert.Equal(models.CheckMessage(validationId), validation.Message)
}
