package destinationrules

import (
	"testing"

	"github.com/stretchr/testify/assert"
	security_v1 "istio.io/client-go/pkg/apis/security/v1"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tests/data"
	"github.com/kiali/kiali/tests/testutils/validations"
)

// Context: DestinationRule enables namespace-wide mTLS
// Context: There is one PeerAuthn enabling PERMISSIVE mTLS
// It doesn't return any validation
func TestMTLSNshWideDREnabledWithNsPolicyPermissive(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	destinationRule := data.AddTrafficPolicyToDestinationRule(data.CreateMTLSTrafficPolicyForDestinationRules(),
		data.CreateEmptyDestinationRule("bookinfo", "dr-mtls", "*.bookinfo.svc.cluster.local"))

	mTlsDetails := kubernetes.MTLSDetails{
		PeerAuthentications: []*security_v1.PeerAuthentication{
			data.CreateEmptyPeerAuthentication("default", "bookinfo", data.CreateMTLS("PERMISSIVE")),
		},
	}

	validations, valid := NamespaceWideMTLSChecker{
		Conf:            config.Get(),
		DestinationRule: destinationRule,
		MTLSDetails:     mTlsDetails,
	}.Check()

	assert.Empty(validations)
	assert.True(valid)
}

// Context: DestinationRule enables namespace-wide mTLS
// Context: There is one PeerAuthn enabling STRICT mTLS
// It doesn't return any validation
func TestMTLSNsWideDREnabledWithPolicy(t *testing.T) {
	destinationRule := data.AddTrafficPolicyToDestinationRule(data.CreateMTLSTrafficPolicyForDestinationRules(),
		data.CreateEmptyDestinationRule("bookinfo", "dr-mtls", "*.bookinfo.svc.cluster.local"))

	mTlsDetails := kubernetes.MTLSDetails{
		PeerAuthentications: []*security_v1.PeerAuthentication{
			data.CreateEmptyPeerAuthentication("default", "bookinfo", data.CreateMTLS("STRICT")),
		},
	}

	assert := assert.New(t)

	validations, valid := NamespaceWideMTLSChecker{
		Conf:            config.Get(),
		DestinationRule: destinationRule,
		MTLSDetails:     mTlsDetails,
	}.Check()

	assert.Empty(validations)
	assert.True(valid)
}

// Context: DestinationRule enables namespace-wide mTLS
// Context: There is one MeshPolicy enabling mTLS
// It doesn't return any validation
func TestMTLSNsWideDREnabledWithMeshPolicy(t *testing.T) {
	destinationRule := data.AddTrafficPolicyToDestinationRule(data.CreateMTLSTrafficPolicyForDestinationRules(),
		data.CreateEmptyDestinationRule("bookinfo", "dr-mtls", "*.bookinfo.svc.cluster.local"))

	mTlsDetails := kubernetes.MTLSDetails{
		MeshPeerAuthentications: []*security_v1.PeerAuthentication{
			data.CreateEmptyMeshPeerAuthentication("default", data.CreateMTLS("STRICT")),
		},
	}

	assert := assert.New(t)

	validations, valid := NamespaceWideMTLSChecker{
		Conf:            config.Get(),
		DestinationRule: destinationRule,
		MTLSDetails:     mTlsDetails,
	}.Check()

	assert.Empty(validations)
	assert.True(valid)
}

// Context: DestinationRule enables namespace-wide mTLS
// Context: There isn't any policy enabling mTLS
// It doesn't return any validation
func TestMTLSNsWideDREnabledWithoutPolicy(t *testing.T) {
	destinationRule := data.AddTrafficPolicyToDestinationRule(data.CreateMTLSTrafficPolicyForDestinationRules(),
		data.CreateEmptyDestinationRule("bookinfo", "dr-mtls", "*.bookinfo.svc.cluster.local"))

	mTlsDetails := kubernetes.MTLSDetails{}

	assert := assert.New(t)

	vals, valid := NamespaceWideMTLSChecker{
		Conf:            config.Get(),
		DestinationRule: destinationRule,
		MTLSDetails:     mTlsDetails,
	}.Check()

	assert.NotEmpty(vals)
	assert.Equal(1, len(vals))
	assert.False(valid)

	validation := vals[0]
	assert.NotNil(validation)
	assert.Equal(models.ErrorSeverity, validation.Severity)
	assert.Equal("spec/trafficPolicy/tls/mode", validation.Path)
	assert.NoError(validations.ConfirmIstioCheckMessage("destinationrules.mtls.nspolicymissing", validation))
}
