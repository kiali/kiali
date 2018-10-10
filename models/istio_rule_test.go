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

	assert.Equal("checkfromcustomer", istioRules[0].Name)
	assert.Equal("destination.labels[\"app\"] == \"preference\"", istioRules[0].Match)
	actions, ok := (istioRules[0].Actions).([]map[string]interface{})
	assert.True(ok)
	assert.Equal(1, len(actions))
	assert.Equal("preferencewhitelist.listchecker", actions[0]["handler"])
	instances, ok := (actions[0]["instances"]).([]string)
	assert.True(ok)
	assert.Equal(1, len(instances))
	assert.Equal("preferencesource.listentry", instances[0])

	assert.Equal("denycustomer", istioRules[1].Name)
	assert.Equal("destination.labels[\"app\"] == \"preference\" && source.labels[\"app\"]==\"customer\"", istioRules[1].Match)
	actions, ok = (istioRules[1].Actions).([]map[string]interface{})
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

	istioDetails := CastIstioRuleDetails(fakeCheckFromCustomerDetails())
	assert.Equal(1, len(istioDetails.Actions))
	handler := istioDetails.Actions[0].Handler
	assert.Equal("preferencewhitelist", handler.Name)
	assert.Equal("listchecker", handler.Adapter)
	handlerSpec, ok := (handler.Spec).(map[string]interface{})
	assert.True(ok)
	overrides, ok := handlerSpec["overrides"]
	assert.True(ok)
	overridesList, ok := overrides.([]string)
	assert.True(ok)
	assert.Equal(1, len(overridesList))
	assert.Equal("recommendation", overridesList[0])
	blacklist, ok := handlerSpec["blacklist"]
	assert.True(ok)
	blackListValue, ok := blacklist.(bool)
	assert.True(ok)
	assert.Equal(false, blackListValue)
	_, ok = handlerSpec["adapter"]
	assert.False(ok)
	instances := istioDetails.Actions[0].Instances
	assert.Equal(1, len(instances))
	assert.Equal("preferencesource", instances[0].Name)
	assert.Equal("listentry", instances[0].Template)
	instanceSpec, ok := (instances[0].Spec).(map[string]interface{})
	assert.True(ok)
	value, ok := instanceSpec["value"]
	assert.True(ok)
	assert.Equal("source.labels[\"app\"]", value)
}

func TestIstioRuleWithNotSupportedHandlersOrInstances(t *testing.T) {
	assert := assert.New(t)
	istioDetails := CastIstioRuleDetails(fakeRuleNotSupportedHandlersDetails())
	assert.Equal(1, len(istioDetails.Actions))
	assert.Nil(istioDetails.Actions[0].Handler)
	instances := istioDetails.Actions[0].Instances
	assert.Equal(1, len(instances))
	assert.Nil(instances[0])
}

func fakeCheckFromCustomerRule() kubernetes.IstioObject {
	checkfromcustomerRule := kubernetes.MockIstioObject{}
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
	denycustomerRule := kubernetes.MockIstioObject{}
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

func fakeIstioRules() *kubernetes.IstioRules {
	fakeRules := kubernetes.IstioRules{}

	fakeRules.Rules = []kubernetes.IstioObject{
		fakeCheckFromCustomerRule(),
		fakeDenyCustomerRule(),
	}
	return &fakeRules
}

func fakeCheckFromCustomerActions() []*kubernetes.IstioRuleAction {
	actions := make([]*kubernetes.IstioRuleAction, 0)
	handler := kubernetes.MockIstioObject{}
	handler.Name = "preferencewhitelist"
	handler.Spec = map[string]interface{}{
		"overrides": []string{
			"recommendation",
		},
		"blacklist": false,
		"adapter":   "listchecker",
	}
	instance := kubernetes.MockIstioObject{}
	instance.Name = "preferencesource"
	instance.Spec = map[string]interface{}{
		"value":    "source.labels[\"app\"]",
		"template": "listentry",
	}

	actions = append(actions, &kubernetes.IstioRuleAction{
		Handler:   &handler,
		Instances: []kubernetes.IstioObject{&instance},
	})

	return actions
}

func fakeCheckFromCustomerDetails() *kubernetes.IstioRuleDetails {
	istioRulesDetails := kubernetes.IstioRuleDetails{}
	istioRulesDetails.Rule = fakeCheckFromCustomerRule()
	istioRulesDetails.Actions = fakeCheckFromCustomerActions()
	return &istioRulesDetails
}

func fakeStdioRule() kubernetes.IstioObject {
	stdioRule := kubernetes.MockIstioObject{}
	stdioRule.Name = "stdio"
	stdioRule.Spec = map[string]interface{}{
		"match": "true",
		"actions": []map[string]interface{}{
			{
				"handler": "handler.stdio",
				"instances": []string{
					"accesslog.logentry",
				},
			},
		},
	}
	return &stdioRule
}

func fakeSdtioUnsupportedHandlersInstances() []*kubernetes.IstioRuleAction {
	actions := make([]*kubernetes.IstioRuleAction, 0)
	actions = append(actions, &kubernetes.IstioRuleAction{
		Handler:   nil,
		Instances: []kubernetes.IstioObject{nil},
	})
	return actions
}

func fakeRuleNotSupportedHandlersDetails() *kubernetes.IstioRuleDetails {
	istioRuleDetails := kubernetes.IstioRuleDetails{}
	istioRuleDetails.Rule = fakeStdioRule()
	istioRuleDetails.Actions = fakeSdtioUnsupportedHandlersInstances()
	return &istioRuleDetails
}
