package models

import (
	"github.com/kiali/kiali/kubernetes"
)

type IstioRuleList struct {
	Namespace Namespace   `json:"namespace"`
	Rules     []IstioRule `json:"rules"`
}

type IstioRules []IstioRule
type IstioRule struct {
	Name    string      `json:"name"`
	Match   interface{} `json:"match"`
	Actions interface{} `json:"actions"`
}

type IstioRuleDetails struct {
	Name      string             `json:"name"`
	Namespace Namespace          `json:"namespace"`
	Match     interface{}        `json:"match"`
	Actions   []*IstioRuleAction `json:"actions"`
}

type IstioRuleAction struct {
	Handler   *IstioHandler    `json:"handler"`
	Instances []*IstioInstance `json:"instances"`
}

type IstioHandler struct {
	Name    string      `json:"name"`
	Adapter string      `json:"adapter"`
	Spec    interface{} `json:"spec"`
}

type IstioInstance struct {
	Name     string      `json:"name"`
	Template string      `json:"template"`
	Spec     interface{} `json:"spec"`
}

func GetIstioRulesByNamespace(namespaceName string) ([]IstioRule, error) {
	istioClient, err := kubernetes.NewClient()
	if err != nil {
		return nil, err
	}

	rules, err := istioClient.GetIstioRules(namespaceName)
	if err != nil {
		return nil, err
	}

	return CastIstioRulesCollection(rules), nil
}

func GetIstioRuleDetails(namespaceName string, istiorule string) (*IstioRuleDetails, error) {
	istioClient, err := kubernetes.NewClient()
	if err != nil {
		return nil, err
	}

	istioRuleDetails, err := istioClient.GetIstioRuleDetails(namespaceName, istiorule)
	if err != nil {
		return nil, err
	}

	return CastIstioRuleDetails(istioRuleDetails), nil
}

func CastIstioRulesCollection(rules *kubernetes.IstioRules) IstioRules {
	istioRules := make([]IstioRule, len(rules.Rules))
	for i, rule := range rules.Rules {
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

func CastIstioRuleDetails(rule *kubernetes.IstioRuleDetails) *IstioRuleDetails {
	istioRuleDetails := IstioRuleDetails{}
	istioRuleDetails.Name = rule.Rule.GetObjectMeta().Name
	istioRuleDetails.Match = rule.Rule.GetSpec()["match"]
	istioRuleDetails.Actions = CastIstioRuleActions(rule.Actions)

	return &istioRuleDetails
}

func CastIstioRuleActions(actions []*kubernetes.IstioRuleAction) []*IstioRuleAction {
	istioActions := make([]*IstioRuleAction, len(actions))
	for i, action := range actions {
		istioActions[i] = CastIstioRuleAction(action)
	}
	return istioActions
}

func CastIstioRuleAction(action *kubernetes.IstioRuleAction) *IstioRuleAction {
	istioAction := IstioRuleAction{}
	if action == nil {
		return &istioAction
	}
	istioAction.Handler = CastIstioHandler(action.Handler)
	istioAction.Instances = make([]*IstioInstance, len(action.Instances))
	for i, instance := range action.Instances {
		istioAction.Instances[i] = CastIstioInstance(instance)
	}
	return &istioAction
}

func CastIstioHandler(handler kubernetes.IstioObject) *IstioHandler {
	istioHandler := IstioHandler{}
	if handler == nil {
		return nil
	}
	istioHandler.Name = handler.GetObjectMeta().Name
	istioHandler.Adapter = handler.GetSpec()["adapter"].(string)
	delete(handler.GetSpec(), "adapter")
	istioHandler.Spec = handler.GetSpec()
	return &istioHandler
}

func CastIstioInstance(instance kubernetes.IstioObject) *IstioInstance {
	istioInstance := IstioInstance{}
	if instance == nil {
		return nil
	}
	istioInstance.Name = instance.GetObjectMeta().Name
	istioInstance.Template = instance.GetSpec()["template"].(string)
	delete(instance.GetSpec(), "template")
	istioInstance.Spec = instance.GetSpec()
	return &istioInstance
}
