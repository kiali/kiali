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
	assert.True(t, criteria.IncludeVirtualServices)
	assert.True(t, criteria.IncludeDestinationRules)
	assert.True(t, criteria.IncludeServiceEntries)
	assert.True(t, criteria.IncludeRules)
	assert.True(t, criteria.IncludeQuotaSpecs)
	assert.True(t, criteria.IncludeQuotaSpecBindings)
	assert.True(t, criteria.IncludeMeshPolicies)

	objects = "gateways"
	criteria = parseCriteria(namespace, objects)

	assert.True(t, criteria.IncludeGateways)
	assert.False(t, criteria.IncludeVirtualServices)
	assert.False(t, criteria.IncludeDestinationRules)
	assert.False(t, criteria.IncludeServiceEntries)
	assert.False(t, criteria.IncludeRules)
	assert.False(t, criteria.IncludeQuotaSpecs)
	assert.False(t, criteria.IncludeQuotaSpecBindings)
	assert.False(t, criteria.IncludeMeshPolicies)

	objects = "virtualservices"
	criteria = parseCriteria(namespace, objects)

	assert.False(t, criteria.IncludeGateways)
	assert.True(t, criteria.IncludeVirtualServices)
	assert.False(t, criteria.IncludeDestinationRules)
	assert.False(t, criteria.IncludeServiceEntries)
	assert.False(t, criteria.IncludeRules)
	assert.False(t, criteria.IncludeQuotaSpecs)
	assert.False(t, criteria.IncludeQuotaSpecBindings)
	assert.False(t, criteria.IncludeMeshPolicies)

	objects = "destinationrules"
	criteria = parseCriteria(namespace, objects)

	assert.False(t, criteria.IncludeGateways)
	assert.False(t, criteria.IncludeVirtualServices)
	assert.True(t, criteria.IncludeDestinationRules)
	assert.False(t, criteria.IncludeServiceEntries)
	assert.False(t, criteria.IncludeRules)
	assert.False(t, criteria.IncludeQuotaSpecs)
	assert.False(t, criteria.IncludeQuotaSpecBindings)
	assert.False(t, criteria.IncludeMeshPolicies)

	objects = "serviceentries"
	criteria = parseCriteria(namespace, objects)

	assert.False(t, criteria.IncludeGateways)
	assert.False(t, criteria.IncludeVirtualServices)
	assert.False(t, criteria.IncludeDestinationRules)
	assert.True(t, criteria.IncludeServiceEntries)
	assert.False(t, criteria.IncludeRules)
	assert.False(t, criteria.IncludeQuotaSpecs)
	assert.False(t, criteria.IncludeQuotaSpecBindings)
	assert.False(t, criteria.IncludeMeshPolicies)

	objects = "rules"
	criteria = parseCriteria(namespace, objects)

	assert.False(t, criteria.IncludeGateways)
	assert.False(t, criteria.IncludeVirtualServices)
	assert.False(t, criteria.IncludeDestinationRules)
	assert.False(t, criteria.IncludeServiceEntries)
	assert.True(t, criteria.IncludeRules)
	assert.False(t, criteria.IncludeQuotaSpecs)
	assert.False(t, criteria.IncludeQuotaSpecBindings)
	assert.False(t, criteria.IncludeMeshPolicies)

	objects = "quotaspecs"
	criteria = parseCriteria(namespace, objects)

	assert.False(t, criteria.IncludeGateways)
	assert.False(t, criteria.IncludeVirtualServices)
	assert.False(t, criteria.IncludeDestinationRules)
	assert.False(t, criteria.IncludeServiceEntries)
	assert.False(t, criteria.IncludeRules)
	assert.True(t, criteria.IncludeQuotaSpecs)
	assert.False(t, criteria.IncludeQuotaSpecBindings)
	assert.False(t, criteria.IncludeMeshPolicies)

	objects = "quotaspecbindings"
	criteria = parseCriteria(namespace, objects)

	assert.False(t, criteria.IncludeGateways)
	assert.False(t, criteria.IncludeVirtualServices)
	assert.False(t, criteria.IncludeDestinationRules)
	assert.False(t, criteria.IncludeServiceEntries)
	assert.False(t, criteria.IncludeRules)
	assert.False(t, criteria.IncludeQuotaSpecs)
	assert.True(t, criteria.IncludeQuotaSpecBindings)
	assert.False(t, criteria.IncludeMeshPolicies)

	objects = "virtualservices,rules"
	criteria = parseCriteria(namespace, objects)

	assert.False(t, criteria.IncludeGateways)
	assert.True(t, criteria.IncludeVirtualServices)
	assert.False(t, criteria.IncludeDestinationRules)
	assert.False(t, criteria.IncludeServiceEntries)
	assert.True(t, criteria.IncludeRules)
	assert.False(t, criteria.IncludeQuotaSpecs)
	assert.False(t, criteria.IncludeQuotaSpecBindings)
	assert.False(t, criteria.IncludeMeshPolicies)

	objects = "destinationrules,virtualservices"
	criteria = parseCriteria(namespace, objects)

	assert.False(t, criteria.IncludeGateways)
	assert.True(t, criteria.IncludeVirtualServices)
	assert.True(t, criteria.IncludeDestinationRules)
	assert.False(t, criteria.IncludeServiceEntries)
	assert.False(t, criteria.IncludeRules)
	assert.False(t, criteria.IncludeQuotaSpecs)
	assert.False(t, criteria.IncludeQuotaSpecBindings)
	assert.False(t, criteria.IncludeMeshPolicies)

	objects = "meshpolicies"
	criteria = parseCriteria(namespace, objects)

	assert.True(t, criteria.IncludeMeshPolicies)
	assert.False(t, criteria.IncludeGateways)
	assert.False(t, criteria.IncludeVirtualServices)
	assert.False(t, criteria.IncludeDestinationRules)
	assert.False(t, criteria.IncludeServiceEntries)
	assert.False(t, criteria.IncludeRules)
	assert.False(t, criteria.IncludeQuotaSpecs)
	assert.False(t, criteria.IncludeQuotaSpecBindings)

	objects = "notsupported"
	criteria = parseCriteria(namespace, objects)

	assert.False(t, criteria.IncludeGateways)
	assert.False(t, criteria.IncludeVirtualServices)
	assert.False(t, criteria.IncludeDestinationRules)
	assert.False(t, criteria.IncludeServiceEntries)
	assert.False(t, criteria.IncludeRules)
	assert.False(t, criteria.IncludeQuotaSpecs)
	assert.False(t, criteria.IncludeQuotaSpecBindings)
	assert.False(t, criteria.IncludeMeshPolicies)

	objects = "notsupported,rules"
	criteria = parseCriteria(namespace, objects)

	assert.False(t, criteria.IncludeGateways)
	assert.False(t, criteria.IncludeVirtualServices)
	assert.False(t, criteria.IncludeDestinationRules)
	assert.False(t, criteria.IncludeServiceEntries)
	assert.True(t, criteria.IncludeRules)
	assert.False(t, criteria.IncludeQuotaSpecs)
	assert.False(t, criteria.IncludeQuotaSpecBindings)
	assert.False(t, criteria.IncludeMeshPolicies)
}
