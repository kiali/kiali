package models

import (
	"github.com/kiali/kiali/kubernetes"
)

type IstioRuleList struct {
	Namespace Namespace   `json:"namespace"`
	Rules     []IstioRule `json:"rules"`
}

// IstioRules istioRules
//
// This type type is used for returning an array of IstioRules
//
// swagger:model istioRules
// An array of istioRule
// swagger:allOf
type IstioRules []IstioRule

// IstioRule istioRule
//
// This type type is used for returning a IstioRule
//
// swagger:model istioRule
type IstioRule struct {
	// The name of the istioRule
	//
	// required: true
	Name    string      `json:"name"`
	Match   interface{} `json:"match"`
	Actions interface{} `json:"actions"`
}

// IstioAdapters istioAdapters
//
// This type type is used for returning an array of IstioAdapters
//
// swagger:model istioAdapters
// An array of istioAdapter
// swagger:allOf
type IstioAdapters []IstioAdapter

// IstioAdapter istioAdapter
//
// This type type is used for returning a IstioAdapter
//
// swagger:model istioAdapter
type IstioAdapter struct {
	Name    string      `json:"name"`
	Adapter string      `json:"adapter"`
	Spec    interface{} `json:"spec"`
}

// IstioTemplates istioTemplates
//
// This type type is used for returning an array of IstioTemplates
//
// swagger:model istioTemplates
// An array of istioTemplates
// swagger:allOf
type IstioTemplates []IstioTemplate

// IstioTemplate istioTemplate
//
// This type type is used for returning a IstioTemplate
//
// swagger:model istioTemplate
type IstioTemplate struct {
	Name     string      `json:"name"`
	Template string      `json:"template"`
	Spec     interface{} `json:"spec"`
}

func CastIstioRulesCollection(rules []kubernetes.IstioObject) IstioRules {
	istioRules := make([]IstioRule, len(rules))
	for i, rule := range rules {
		istioRules[i] = CastIstioRule(rule)
	}
	return istioRules
}

func CastIstioRule(rule kubernetes.IstioObject) IstioRule {
	istioRule := IstioRule{}
	istioRule.Name = rule.GetObjectMeta().Name
	istioRule.Match = rule.GetSpec()["match"]
	istioRule.Actions = rule.GetSpec()["actions"]
	return istioRule
}

func CastIstioAdaptersCollection(adapters []kubernetes.IstioObject) IstioAdapters {
	istioAdapters := make([]IstioAdapter, len(adapters))
	for i, adapter := range adapters {
		istioAdapters[i] = CastIstioAdapter(adapter)
	}
	return istioAdapters
}

func CastIstioAdapter(adapter kubernetes.IstioObject) IstioAdapter {
	istioAdapter := IstioAdapter{}
	istioAdapter.Name = adapter.GetObjectMeta().Name
	istioAdapter.Adapter = adapter.GetObjectMeta().Labels["adapter"]
	istioAdapter.Spec = adapter.GetSpec()
	return istioAdapter
}

func CastIstioTemplatesCollection(templates []kubernetes.IstioObject) IstioTemplates {
	istioTemplates := make([]IstioTemplate, len(templates))
	for i, template := range templates {
		istioTemplates[i] = CastIstioTemplate(template)
	}
	return istioTemplates
}

func CastIstioTemplate(template kubernetes.IstioObject) IstioTemplate {
	istioTemplate := IstioTemplate{}
	istioTemplate.Name = template.GetObjectMeta().Name
	istioTemplate.Template = template.GetObjectMeta().Labels["template"]
	istioTemplate.Spec = template.GetSpec()
	return istioTemplate
}
