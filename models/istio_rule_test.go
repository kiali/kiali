package models

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/kiali/kiali/kubernetes"
)

func TestIstioRulesParsing(t *testing.T) {
	assert := assert.New(t)

	istioRules := CastIstioRulesCollection(fakeIstioRules())
	assert.Equal(2, len(istioRules))

	assert.Equal("checkfromcustomer", istioRules[0].Metadata.Name)
	assert.Equal("destination.labels[\"app\"] == \"preference\"", istioRules[0].Spec.Match)
	actions, ok := (istioRules[0].Spec.Actions).([]map[string]interface{})
	assert.True(ok)
	assert.Equal(1, len(actions))
	assert.Equal("preferencewhitelist.listchecker", actions[0]["handler"])
	instances, ok := (actions[0]["instances"]).([]string)
	assert.True(ok)
	assert.Equal(1, len(instances))
	assert.Equal("preferencesource.listentry", instances[0])

	assert.Equal("denycustomer", istioRules[1].Metadata.Name)
	assert.Equal("destination.labels[\"app\"] == \"preference\" && source.labels[\"app\"]==\"customer\"", istioRules[1].Spec.Match)
	actions, ok = (istioRules[1].Spec.Actions).([]map[string]interface{})
	assert.True(ok)
	assert.Equal(1, len(actions))
	assert.Equal("denycustomerhandler.denier", actions[0]["handler"])
	instances, ok = (actions[0]["instances"]).([]string)
	assert.True(ok)
	assert.Equal(1, len(instances))
	assert.Equal("denycustomerrequests.checknothing", instances[0])
}

func TestIstioRuleDetailsParsing(t *testing.T) {
	assert := assert.New(t)

	istioRule := CastIstioRule(fakeCheckFromCustomerRule())
	assert.Equal("checkfromcustomer", istioRule.Metadata.Name)
	assert.Equal("destination.labels[\"app\"] == \"preference\"", istioRule.Spec.Match)
	assert.NotNil(istioRule.Spec.Actions)

	istioAdapter := CastIstioAdapter(fakeListCheckerAdapter())
	assert.Equal("preferencewhitelist", istioAdapter.Metadata.Name)

	istioTemplate := CastIstioTemplate(fakeListEntryTemplate())
	assert.Equal("preferencesource", istioTemplate.Metadata.Name)
}

func fakeCheckFromCustomerRule() kubernetes.IstioObject {
	checkfromcustomerRule := kubernetes.GenericIstioObject{}
	checkfromcustomerRule.Name = "checkfromcustomer"
	checkfromcustomerRule.Spec = map[string]interface{}{
		"match": "destination.labels[\"app\"] == \"preference\"",
		"actions": []map[string]interface{}{
			{
				"handler": "preferencewhitelist.listchecker",
				"instances": []string{
					"preferencesource.listentry",
				},
			},
		},
	}
	return &checkfromcustomerRule
}

func fakeDenyCustomerRule() kubernetes.IstioObject {
	denycustomerRule := kubernetes.GenericIstioObject{}
	denycustomerRule.Name = "denycustomer"
	denycustomerRule.Spec = map[string]interface{}{
		"match": "destination.labels[\"app\"] == \"preference\" && source.labels[\"app\"]==\"customer\"",
		"actions": []map[string]interface{}{
			{
				"handler": "denycustomerhandler.denier",
				"instances": []string{
					"denycustomerrequests.checknothing",
				},
			},
		},
	}
	return &denycustomerRule
}

func fakeIstioRules() []kubernetes.IstioObject {
	return []kubernetes.IstioObject{
		fakeCheckFromCustomerRule(),
		fakeDenyCustomerRule(),
	}
}

func fakeListCheckerAdapter() kubernetes.IstioObject {
	handler := kubernetes.GenericIstioObject{}
	handler.Name = "preferencewhitelist"
	handler.Spec = map[string]interface{}{
		"overrides": []string{
			"recommendation",
		},
		"blacklist": false,
		"adapter":   "listchecker",
	}
	return handler.DeepCopyIstioObject()
}

func fakeListEntryTemplate() kubernetes.IstioObject {
	instance := kubernetes.GenericIstioObject{}
	instance.Name = "preferencesource"
	instance.Spec = map[string]interface{}{
		"value":    "source.labels[\"app\"]",
		"template": "listentry",
	}
	return instance.DeepCopyIstioObject()
}
