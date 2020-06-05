package models

import (
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

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
	meta_v1.TypeMeta
	Metadata meta_v1.ObjectMeta `json:"metadata"`
	Spec     struct {
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
	meta_v1.TypeMeta
	Metadata meta_v1.ObjectMeta `json:"metadata"`
	Spec     interface{}        `json:"spec"`
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
	meta_v1.TypeMeta
	Metadata meta_v1.ObjectMeta `json:"metadata"`
	Spec     interface{}        `json:"spec"`
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
	meta_v1.TypeMeta
	Metadata meta_v1.ObjectMeta `json:"metadata"`
	Spec     interface{}        `json:"spec"`
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
	meta_v1.TypeMeta
	Metadata meta_v1.ObjectMeta `json:"metadata"`
	Spec     interface{}        `json:"spec"`
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
	istioRule.TypeMeta = rule.GetTypeMeta()
	istioRule.Metadata = rule.GetObjectMeta()
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
	istioAdapter.TypeMeta = adapter.GetTypeMeta()
	istioAdapter.Metadata = adapter.GetObjectMeta()
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
	istioTemplate.TypeMeta = template.GetTypeMeta()
	istioTemplate.Metadata = template.GetObjectMeta()
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
	istioHandler.TypeMeta = handler.GetTypeMeta()
	istioHandler.Metadata = handler.GetObjectMeta()
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
	istioInstance.TypeMeta = instance.GetTypeMeta()
	istioInstance.Metadata = instance.GetObjectMeta()
	istioInstance.Spec = instance.GetSpec()
	return istioInstance
}
