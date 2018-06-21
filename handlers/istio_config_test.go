package handlers

import (
	"github.com/stretchr/testify/assert"
	"testing"
)

func TestParseListParams(t *testing.T) {
	namespace := "bookinfo"
	objects := ""
	criteria := parseCriteria(namespace, objects)

	assert.Equal(t, "bookinfo", criteria.Namespace)
	assert.True(t, criteria.IncludeRouteRules)
	assert.True(t, criteria.IncludeDestinationPolicies)
	assert.True(t, criteria.IncludeVirtualServices)
	assert.True(t, criteria.IncludeDestinationRules)
	assert.True(t, criteria.IncludeServiceEntries)
	assert.True(t, criteria.IncludeRules)

	objects = "gateways"
	criteria = parseCriteria(namespace, objects)

	assert.True(t, criteria.IncludeGateways)
	assert.False(t, criteria.IncludeRouteRules)
	assert.False(t, criteria.IncludeDestinationPolicies)
	assert.False(t, criteria.IncludeVirtualServices)
	assert.False(t, criteria.IncludeDestinationRules)
	assert.False(t, criteria.IncludeServiceEntries)
	assert.False(t, criteria.IncludeRules)

	objects = "routerules"
	criteria = parseCriteria(namespace, objects)

	assert.False(t, criteria.IncludeGateways)
	assert.True(t, criteria.IncludeRouteRules)
	assert.False(t, criteria.IncludeDestinationPolicies)
	assert.False(t, criteria.IncludeVirtualServices)
	assert.False(t, criteria.IncludeDestinationRules)
	assert.False(t, criteria.IncludeServiceEntries)
	assert.False(t, criteria.IncludeRules)

	objects = "destinationpolicies"
	criteria = parseCriteria(namespace, objects)

	assert.False(t, criteria.IncludeGateways)
	assert.False(t, criteria.IncludeRouteRules)
	assert.True(t, criteria.IncludeDestinationPolicies)
	assert.False(t, criteria.IncludeVirtualServices)
	assert.False(t, criteria.IncludeDestinationRules)
	assert.False(t, criteria.IncludeServiceEntries)
	assert.False(t, criteria.IncludeRules)

	objects = "virtualservices"
	criteria = parseCriteria(namespace, objects)

	assert.False(t, criteria.IncludeGateways)
	assert.False(t, criteria.IncludeRouteRules)
	assert.False(t, criteria.IncludeDestinationPolicies)
	assert.True(t, criteria.IncludeVirtualServices)
	assert.False(t, criteria.IncludeDestinationRules)
	assert.False(t, criteria.IncludeServiceEntries)
	assert.False(t, criteria.IncludeRules)

	objects = "destinationrules"
	criteria = parseCriteria(namespace, objects)

	assert.False(t, criteria.IncludeGateways)
	assert.False(t, criteria.IncludeRouteRules)
	assert.False(t, criteria.IncludeDestinationPolicies)
	assert.False(t, criteria.IncludeVirtualServices)
	assert.True(t, criteria.IncludeDestinationRules)
	assert.False(t, criteria.IncludeServiceEntries)
	assert.False(t, criteria.IncludeRules)

	objects = "serviceentries"
	criteria = parseCriteria(namespace, objects)

	assert.False(t, criteria.IncludeGateways)
	assert.False(t, criteria.IncludeRouteRules)
	assert.False(t, criteria.IncludeDestinationPolicies)
	assert.False(t, criteria.IncludeVirtualServices)
	assert.False(t, criteria.IncludeDestinationRules)
	assert.True(t, criteria.IncludeServiceEntries)
	assert.False(t, criteria.IncludeRules)

	objects = "rules"
	criteria = parseCriteria(namespace, objects)

	assert.False(t, criteria.IncludeGateways)
	assert.False(t, criteria.IncludeRouteRules)
	assert.False(t, criteria.IncludeDestinationPolicies)
	assert.False(t, criteria.IncludeVirtualServices)
	assert.False(t, criteria.IncludeDestinationRules)
	assert.False(t, criteria.IncludeServiceEntries)
	assert.True(t, criteria.IncludeRules)

	objects = "virtualservices,rules"
	criteria = parseCriteria(namespace, objects)

	assert.False(t, criteria.IncludeGateways)
	assert.False(t, criteria.IncludeRouteRules)
	assert.False(t, criteria.IncludeDestinationPolicies)
	assert.True(t, criteria.IncludeVirtualServices)
	assert.False(t, criteria.IncludeDestinationRules)
	assert.False(t, criteria.IncludeServiceEntries)
	assert.True(t, criteria.IncludeRules)

	objects = "routerules,virtualservices"
	criteria = parseCriteria(namespace, objects)

	assert.False(t, criteria.IncludeGateways)
	assert.True(t, criteria.IncludeRouteRules)
	assert.False(t, criteria.IncludeDestinationPolicies)
	assert.True(t, criteria.IncludeVirtualServices)
	assert.False(t, criteria.IncludeDestinationRules)
	assert.False(t, criteria.IncludeServiceEntries)
	assert.False(t, criteria.IncludeRules)

	objects = "notsupported"
	criteria = parseCriteria(namespace, objects)

	assert.False(t, criteria.IncludeGateways)
	assert.False(t, criteria.IncludeRouteRules)
	assert.False(t, criteria.IncludeDestinationPolicies)
	assert.False(t, criteria.IncludeVirtualServices)
	assert.False(t, criteria.IncludeDestinationRules)
	assert.False(t, criteria.IncludeServiceEntries)
	assert.False(t, criteria.IncludeRules)

	objects = "notsupported,rules"
	criteria = parseCriteria(namespace, objects)

	assert.False(t, criteria.IncludeGateways)
	assert.False(t, criteria.IncludeRouteRules)
	assert.False(t, criteria.IncludeDestinationPolicies)
	assert.False(t, criteria.IncludeVirtualServices)
	assert.False(t, criteria.IncludeDestinationRules)
	assert.False(t, criteria.IncludeServiceEntries)
	assert.True(t, criteria.IncludeRules)
}
