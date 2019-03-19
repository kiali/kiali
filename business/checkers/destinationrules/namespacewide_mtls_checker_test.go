package destinationrules

import (
	"testing"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tests/data"
	"github.com/stretchr/testify/assert"
)

// Context: DestinationRule enables namespace-wide mTLS
// Context: There is one Policy not enabling mTLS
// It returns a validation
func TestMTLSNshWideDREnabledWithNsPolicyPermissive(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	destinationRule := data.AddTrafficPolicyToDestinationRule(data.CreateMTLSTrafficPolicyForDestinationRules(),
		data.CreateEmptyDestinationRule("bookinfo", "dr-mtls", "*.bookinfo.svc.cluster.local"))

	mTlsDetails := kubernetes.MTLSDetails{
		Policies: []kubernetes.IstioObject{
			data.CreateEmptyPolicy("default", "bookinfo", data.CreateMTLSPeers("PERMISSIVE")),
		},
	}

	validations, valid := NamespaceWideMTLSChecker{
		DestinationRule: destinationRule,
		MTLSDetails:     mTlsDetails,
	}.Check()

	assert.NotEmpty(validations)
	assert.Equal(1, len(validations))
	assert.False(valid)

	validation := validations[0]
	assert.NotNil(validation)
	assert.Equal(models.ErrorSeverity, validation.Severity)
	assert.Equal("spec/trafficPolicy/tls/mode", validation.Path)
	assert.Equal(models.CheckMessage("destinationrules.mtls.nspolicymissing"), validation.Message)
}

// Context: DestinationRule enables namespace-wide mTLS
// Context: There is one Policy enabling mTLS
// It doesn't return any validation
func TestMTLSNsWideDREnabledWithPolicy(t *testing.T) {
	destinationRule := data.AddTrafficPolicyToDestinationRule(data.CreateMTLSTrafficPolicyForDestinationRules(),
		data.CreateEmptyDestinationRule("bookinfo", "dr-mtls", "*.local"))

	mTlsDetails := kubernetes.MTLSDetails{
		Policies: []kubernetes.IstioObject{
			data.CreateEmptyPolicy("default", "bookinfo", data.CreateMTLSPeers("STRICT")),
		},
	}

	assert := assert.New(t)

	validations, valid := NamespaceWideMTLSChecker{
		DestinationRule: destinationRule,
		MTLSDetails:     mTlsDetails,
	}.Check()

	assert.Empty(validations)
	assert.True(valid)
}
