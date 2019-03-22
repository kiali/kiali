package policies

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tests/data"
)

// Describe the validation of a Policy that enables mTLS for one namespace. The validation is risen when there isn't any
// Destination Rule enabling clients start mTLS connections.

// Context: Policy enables mTLS for a namespace
// Context: There is one Destination Rule not enabling mTLS
// It returns a validation
func TestPolicymTLSEnabled(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	policy := data.CreateEmptyPolicy("default", "bar", data.CreateMTLSPeers("STRICT"))
	mTLSDetails := kubernetes.MTLSDetails{
		DestinationRules: []kubernetes.IstioObject{
			data.CreateEmptyDestinationRule("bar", "default", "*.bar.svc.cluster.local"),
		},
	}

	validations, valid := NamespaceMtlsChecker{
		Policy:      policy,
		MTLSDetails: mTLSDetails,
	}.Check()

	assert.NotEmpty(validations)
	assert.Equal(1, len(validations))
	assert.False(valid)

	validation := validations[0]
	assert.NotNil(validation)
	assert.Equal(models.ErrorSeverity, validation.Severity)
	assert.Equal("spec/peers/mtls", validation.Path)
	assert.Equal(models.CheckMessage("policies.mtls.destinationrulemissing"), validation.Message)
}

// Context: Policy enables mTLS for a namespace
// Context: There is one Destination Rule enabling mTLS for the namespace
// It returns doesn't return any validation
func TestPolicyEnabledDRmTLSEnabled(t *testing.T) {
	assert := assert.New(t)

	policy := data.CreateEmptyPolicy("default", "bar", data.CreateMTLSPeers("STRICT"))
	mTLSDetails := kubernetes.MTLSDetails{
		DestinationRules: []kubernetes.IstioObject{
			data.AddTrafficPolicyToDestinationRule(data.CreateMTLSTrafficPolicyForDestinationRules(),
				data.CreateEmptyDestinationRule("bar", "default", "*.bar.svc.cluster.local")),
		},
	}

	validations, valid := NamespaceMtlsChecker{
		Policy:      policy,
		MTLSDetails: mTLSDetails,
	}.Check()

	assert.Empty(validations)
	assert.True(valid)
}

// Context: Policy enables mTLS for a namespace
// Context: There is one Destination Rule enabling mTLS for the namespace
// Context: There is one Destination Rule enabling mTLS for the whole service-mesh
// It returns doesn't return any validation
func TestPolicyEnabledDRmTLSMeshWideEnabled(t *testing.T) {
	assert := assert.New(t)

	policy := data.CreateEmptyPolicy("default", "bar", data.CreateMTLSPeers("STRICT"))

	mTLSDetails := kubernetes.MTLSDetails{
		DestinationRules: []kubernetes.IstioObject{
			data.AddTrafficPolicyToDestinationRule(data.CreateMTLSTrafficPolicyForDestinationRules(),
				data.CreateEmptyDestinationRule("bar", "default", "*.local")),
		},
	}

	validations, valid := NamespaceMtlsChecker{
		Policy:      policy,
		MTLSDetails: mTLSDetails,
	}.Check()

	assert.Empty(validations)
	assert.True(valid)
}

// Context: Policy enables mTLS in PERMISSIVE mode
// Context: Any Destination Rule.
// It doesn't return any validation
func TestPolicyPermissive(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	policy := data.CreateEmptyPolicy("default", "bar", data.CreateMTLSPeers("PERMISSIVE"))
	mTLSDetails := kubernetes.MTLSDetails{
		DestinationRules: []kubernetes.IstioObject{
			data.CreateEmptyDestinationRule("bar", "default", "*.bar.svc.cluster.local"),
		},
	}

	validations, valid := NamespaceMtlsChecker{
		Policy:      policy,
		MTLSDetails: mTLSDetails,
	}.Check()

	assert.Empty(validations)
	assert.True(valid)
}
