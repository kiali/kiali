package sidecars

import (
	"testing"

	"github.com/stretchr/testify/assert"
	api_networking_v1 "istio.io/api/networking/v1"

	"github.com/kiali/kiali/tests/data"
)

func TestOutboundTrafficPolicyModeCheck(t *testing.T) {
	assert := assert.New(t)

	sc := data.CreateSidecar("testsidecar", "testns")

	// no OutboundTrafficPolicy is OK - all defaults are clear and unambiguous
	sc.Spec.OutboundTrafficPolicy = nil
	vals, valid := OutboundTrafficPolicyModeChecker{
		Sidecar: sc,
	}.Check()
	assert.Empty(vals)
	assert.True(valid)

	// OutboundTrafficPolicy with no mode defined is ambiguous (it is still valid though)
	sc.Spec.OutboundTrafficPolicy = &api_networking_v1.OutboundTrafficPolicy{}
	vals, valid = OutboundTrafficPolicyModeChecker{
		Sidecar: sc,
	}.Check()
	assert.Equal(1, len(vals))
	assert.Equal("KIA1007", vals[0].Code)
	assert.True(valid)

	// OutboundTrafficPolicy with mode defined with the default value is ambiguous (it is still valid though)
	sc.Spec.OutboundTrafficPolicy = &api_networking_v1.OutboundTrafficPolicy{
		Mode: api_networking_v1.OutboundTrafficPolicy_Mode(0),
	}
	vals, valid = OutboundTrafficPolicyModeChecker{
		Sidecar: sc,
	}.Check()
	assert.Equal(1, len(vals))
	assert.Equal("KIA1007", vals[0].Code)
	assert.True(valid)

	// OutboundTrafficPolicy with mode defined with a non-default value is clear and unambiguous.
	sc.Spec.OutboundTrafficPolicy = &api_networking_v1.OutboundTrafficPolicy{
		Mode: api_networking_v1.OutboundTrafficPolicy_Mode(1),
	}
	vals, valid = OutboundTrafficPolicyModeChecker{
		Sidecar: sc,
	}.Check()
	assert.Empty(vals)
	assert.True(valid)
}
