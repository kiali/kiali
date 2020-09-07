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
	IstioBase
	Spec struct {
		Match   interface{} `json:"match"`
		Actions interface{} `json:"actions"`
	} `json:"spec"`
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
	IstioBase
	Spec interface{} `json:"spec"`
}

// IstioTemplates istioTemplates
//
// This type type is used for returning an array of IstioTemplates
//
// swagger:model istioTemplates
// An array of istioTemplate
// swagger:allOf
type IstioTemplates []IstioTemplate

// IstioTemplate istioTemplate
//
// This type type is used for returning a IstioTemplate
//
// swagger:model istioTemplate
type IstioTemplate struct {
	IstioBase
	Spec interface{} `json:"spec"`
}

// IstioHandlers istioHandlers
//
// This type type is used for returning an array of IstioHandlers
//
// swagger:model istioHandlers
// An array of istioHandler
// swagger:allOf
type IstioHandlers []IstioHandler

// IstioHandler istioHandler
//
// This type type is used for returning a IstioHandler
//
// swagger:model istioHandler
type IstioHandler struct {
	IstioBase
	Spec interface{} `json:"spec"`
}

// IstioInstances istioInstances
//
// This type type is used for returning an array of IstioInstances
//
// swagger:model istioInstances
// An array of istioIstance
// swagger:allOf
type IstioInstances []IstioInstance

// IstioInstance istioInstance
//
// This type type is used for returning a IstioInstance
//
// swagger:model istioInstance
type IstioInstance struct {
	IstioBase
	Spec interface{} `json:"spec"`
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
	istioRule.IstioBase.Parse(rule)
	istioRule.Spec.Match = rule.GetSpec()["match"]
	istioRule.Spec.Actions = rule.GetSpec()["actions"]
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
	istioAdapter.IstioBase.Parse(adapter)
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
	istioTemplate.IstioBase.Parse(template)
	istioTemplate.Spec = template.GetSpec()
	return istioTemplate
}

func CastIstioHandlersCollection(handlers []kubernetes.IstioObject) IstioHandlers {
	istioHandlers := make([]IstioHandler, len(handlers))
	for i, handler := range handlers {
		istioHandlers[i] = CastIstioHandler(handler)
	}
	return istioHandlers
}

func CastIstioHandler(handler kubernetes.IstioObject) IstioHandler {
	istioHandler := IstioHandler{}
	istioHandler.IstioBase.Parse(handler)
	istioHandler.Spec = handler.GetSpec()
	return istioHandler
}

func CastIstioInstancesCollection(instances []kubernetes.IstioObject) IstioInstances {
	istioInstances := make([]IstioInstance, len(instances))
	for i, instance := range instances {
		istioInstances[i] = CastIstioInstance(instance)
	}
	return istioInstances
}

func CastIstioInstance(instance kubernetes.IstioObject) IstioInstance {
	istioInstance := IstioInstance{}
	istioInstance.IstioBase.Parse(instance)
	istioInstance.Spec = instance.GetSpec()
	return istioInstance
}
