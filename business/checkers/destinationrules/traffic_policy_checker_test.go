package destinationrules

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tests/data"
)

// Context: MeshPolicy Enabling mTLS
// Context: DestinationRule doesn't specify trafficPolicy
// It returns a validation
func TestMTLSMeshWideEnabledDRWithoutTrafficPolicy(t *testing.T) {
	assert := assert.New(t)

	destinationRules := []kubernetes.IstioObject{
		// Mesh-wide DR enabling mTLS communication
		data.AddTrafficPolicyToDestinationRule(data.CreateMTLSTrafficPolicyForDestinationRules(),
			data.CreateEmptyDestinationRule("bookinfo", "default", "*.local")),
		// Subject DR that doesn't specify any trafficPolicy
		data.CreateEmptyDestinationRule("bookinfo", "reviews", "reviews"),
	}

	validations := TrafficPolicyChecker{
		DestinationRules: destinationRules,
	}.Check()

	assert.NotEmpty(validations)
	assert.Equal(1, len(validations))

	validation, ok := validations[models.BuildKey(DestinationRulesCheckerType, "reviews")]
	assert.True(ok)
	assert.True(validation.Valid)

	assert.NotEmpty(validation.Checks)
	assert.Equal(models.WarningSeverity, validation.Checks[0].Severity)
	assert.Equal(models.CheckMessage("destinationrules.trafficpolicy.meshmtls"), validation.Checks[0].Message)
}

// Context: MeshPolicy Enabling mTLS
// Context: DestinationRule doesn't specify mTLS options
// It returns a validation
func TestMTLSMeshWideEnabledDRWithoutmTLSOptions(t *testing.T) {
	assert := assert.New(t)

	destinationRules := []kubernetes.IstioObject{
		// Mesh-wide DR enabling mTLS communication
		data.AddTrafficPolicyToDestinationRule(data.CreateMTLSTrafficPolicyForDestinationRules(),
			data.CreateEmptyDestinationRule("bookinfo", "default", "*.local")),
		// Subject DR that specify trafficPolicy but no mTLS options
		data.AddTrafficPolicyToDestinationRule(data.CreateLoadBalancerTrafficPolicyForDestinationRules(),
			data.CreateEmptyDestinationRule("bookinfo", "reviews", "reviews")),
	}

	validations := TrafficPolicyChecker{
		DestinationRules: destinationRules,
	}.Check()

	assert.NotEmpty(validations)
	assert.Equal(1, len(validations))

	validation, ok := validations[models.BuildKey(DestinationRulesCheckerType, "reviews")]
	assert.True(ok)
	assert.True(validation.Valid)

	assert.NotEmpty(validation.Checks)
	assert.Equal(models.WarningSeverity, validation.Checks[0].Severity)
	assert.Equal(models.CheckMessage("destinationrules.trafficpolicy.meshmtls"), validation.Checks[0].Message)
}

// Context: MeshPolicy Enabling mTLS
// Context: DestinationRule does specify trafficPolicy and mTLS options
// It doesn't return any validation
func TestMTLSMeshWideEnabledDRWithTrafficPolicy(t *testing.T) {
	assert := assert.New(t)

	destinationRules := []kubernetes.IstioObject{
		// Mesh-wide DR enabling mTLS communication
		data.AddTrafficPolicyToDestinationRule(data.CreateMTLSTrafficPolicyForDestinationRules(),
			data.CreateEmptyDestinationRule("bookinfo", "default", "*.local")),
		// Subject DR that specify TrafficPolicy
		data.AddTrafficPolicyToDestinationRule(data.CreateMTLSTrafficPolicyForDestinationRules(),
			data.CreateEmptyDestinationRule("bookinfo", "reviews", "reviews")),
	}

	validations := TrafficPolicyChecker{
		DestinationRules: destinationRules,
	}.Check()

	assert.Empty(validations)
	validation, ok := validations[models.BuildKey(DestinationRulesCheckerType, "reviews")]

	assert.False(ok)
	assert.Nil(validation)
}

// Context: Namespace-wide mTLS enabled
// Context: DestinationRule doesn't specify trafficPolicy
// It returns a validation
func TestNamespacemTLSEnabledDRWithoutTrafficPolicy(t *testing.T) {
	assert := assert.New(t)

	destinationRules := []kubernetes.IstioObject{
		// Namespace-wide DR enabling mTLS communication
		data.AddTrafficPolicyToDestinationRule(data.CreateMTLSTrafficPolicyForDestinationRules(),
			data.CreateEmptyDestinationRule("bookinfo", "default", "*.bookinfo.svc.cluster.local")),
		// Subject DR that doesn't specify any trafficPolicy
		data.CreateEmptyDestinationRule("bookinfo", "reviews", "reviews"),
	}

	validations := TrafficPolicyChecker{
		DestinationRules: destinationRules,
	}.Check()

	assert.NotEmpty(validations)
	assert.Equal(1, len(validations))

	validation, ok := validations[models.BuildKey(DestinationRulesCheckerType, "reviews")]
	assert.True(ok)
	assert.True(validation.Valid)

	assert.NotEmpty(validation.Checks)
	assert.Equal(models.WarningSeverity, validation.Checks[0].Severity)
	assert.Equal(models.CheckMessage("destinationrules.trafficpolicy.meshmtls"), validation.Checks[0].Message)
}

// Context: Namespace-wide mTLS enabled
// Context: DestinationRule doesn't specify mTLS options
// It returns a validation
func TestNamespacemTLSEnabledDRWithoutmTLSOptions(t *testing.T) {
	assert := assert.New(t)

	destinationRules := []kubernetes.IstioObject{
		// Namespace-wide DR enabling mTLS communication
		data.AddTrafficPolicyToDestinationRule(data.CreateMTLSTrafficPolicyForDestinationRules(),
			data.CreateEmptyDestinationRule("bookinfo", "default", "*.bookinfo.svc.cluster.local")),
		// Subject DR that specify trafficPolicy but no mTLS options
		data.AddTrafficPolicyToDestinationRule(data.CreateLoadBalancerTrafficPolicyForDestinationRules(),
			data.CreateEmptyDestinationRule("bookinfo", "reviews", "reviews")),
	}

	validations := TrafficPolicyChecker{
		DestinationRules: destinationRules,
	}.Check()

	assert.NotEmpty(validations)
	assert.Equal(1, len(validations))

	validation, ok := validations[models.BuildKey(DestinationRulesCheckerType, "reviews")]
	assert.True(ok)
	assert.True(validation.Valid)

	assert.NotEmpty(validation.Checks)
	assert.Equal(models.WarningSeverity, validation.Checks[0].Severity)
	assert.Equal(models.CheckMessage("destinationrules.trafficpolicy.meshmtls"), validation.Checks[0].Message)
}

// Context: Namespace-wide mTLS enabled
// Context: DestinationRule does specify trafficPolicy
// It doesn't return any validation
func TestNamespacemTLSEnabledDRWithTrafficPolicy(t *testing.T) {
	assert := assert.New(t)

	destinationRules := []kubernetes.IstioObject{
		// Namespace-wide DR enabling mTLS communication
		data.AddTrafficPolicyToDestinationRule(data.CreateMTLSTrafficPolicyForDestinationRules(),
			data.CreateEmptyDestinationRule("bookinfo", "default", "*.local")),
		// Subject DR that specify trafficPolicy and mTLS options
		data.AddTrafficPolicyToDestinationRule(data.CreateMTLSTrafficPolicyForDestinationRules(),
			data.CreateEmptyDestinationRule("bookinfo", "reviews", "reviews")),
	}

	validations := TrafficPolicyChecker{
		DestinationRules: destinationRules,
	}.Check()

	assert.Empty(validations)
	validation, ok := validations[models.BuildKey(DestinationRulesCheckerType, "reviews")]
	assert.False(ok)
	assert.Nil(validation)
}
