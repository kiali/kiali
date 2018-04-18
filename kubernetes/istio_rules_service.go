package kubernetes

import (
	"fmt"
	"strings"

	"github.com/kiali/kiali/log"
)

// GetIstioRules returns a list of mixer rules for a given namespace.
func (in *IstioClient) GetIstioRules(namespace string) (*IstioRules, error) {
	result, err := in.istioConfigApi.Get().Namespace(namespace).Resource(rules).Do().Get()
	if err != nil {
		return nil, err
	}
	ruleList, ok := result.(*ruleList)
	if !ok {
		return nil, fmt.Errorf("%s doesn't return a rules list", namespace)
	}

	istioRules := IstioRules{}
	istioRules.Rules = make([]IstioObject, 0)
	for _, rule := range ruleList.Items {
		istioRules.Rules = append(istioRules.Rules, rule.DeepCopyIstioObject())
	}

	return &istioRules, nil
}

// GetIstioRuleDetails returns the handlers and instances details for a given mixer rule.
// On this version, the following handlers and instances are supported:
// 		- listchecker
// 		- listentry
//		- denier
// 		- checknothing
func (in *IstioClient) GetIstioRuleDetails(namespace string, istiorule string) (*IstioRuleDetails, error) {
	result, err := in.istioConfigApi.Get().Namespace(namespace).Resource(rules).SubResource(istiorule).Do().Get()
	if err != nil {
		return nil, err
	}
	mRule, ok := result.(*rule)
	if !ok {
		return nil, fmt.Errorf("%s/%s doesn't return a Rule", namespace, istiorule)
	}

	istioRuleDetails := IstioRuleDetails{}
	istioRuleDetails.Rule = mRule.DeepCopyIstioObject()

	actions, ok := istioRuleDetails.Rule.GetSpec()["actions"].(actionsType)
	if !ok {
		return nil, fmt.Errorf("%s/%s doesn't return an Action", namespace, istiorule)
	}

	istioRuleDetails.Actions = make([]*IstioRuleAction, 0)
	for _, rawAction := range actions {
		action, ok := rawAction.(actionType)
		if !ok {
			return nil, fmt.Errorf("%s doesn't follow a map format", action)
		}
		actionDetails, err := in.getActionDetails(namespace, istiorule, action)
		if err != nil {
			return nil, err
		}
		istioRuleDetails.Actions = append(istioRuleDetails.Actions, actionDetails)
	}

	return &istioRuleDetails, nil
}

func (in *IstioClient) getActionDetails(namespace string, istiorule string, action actionType) (*IstioRuleAction, error) {
	handler := action["handler"]
	hName, hType, hNamespace := parseFQN(handler.(string))
	if hNamespace != "" && hNamespace != namespace {
		return nil, fmt.Errorf("Istio Rule %s/%s has a handler for a different namespace", namespace, istiorule)
	}

	handlerChan, instancesChan := make(chan istioResponse), make(chan istioResponse)

	go in.getActionHandler(namespace, hType, hName, handlerChan)

	instances := action["instances"]
	for _, instance := range instances.(instancesType) {
		iName, iType, iNamespace := parseFQN(instance.(string))
		go in.getActionInstance(namespace, istiorule, iNamespace, iType, iName, instancesChan)
	}

	istioRuleAction := IstioRuleAction{}

	handlerResponse := <-handlerChan
	if handlerResponse.err != nil {
		return nil, handlerResponse.err
	}
	istioRuleAction.Handler = handlerResponse.result

	istioRuleAction.Instances = make([]IstioObject, 0)
	for i := 0; i < len(instances.(instancesType)); i++ {
		instanceResponse := <-instancesChan
		if instanceResponse.err != nil {
			return nil, instanceResponse.err
		}
		istioRuleAction.Instances = append(istioRuleAction.Instances, instanceResponse.result)
	}

	return &istioRuleAction, nil
}

func (in *IstioClient) getActionHandler(namespace string, handlerType string, handlerName string, handlerChan chan<- istioResponse) {
	handlerTypePlural, ok := istioTypePlurals[handlerType]
	if !ok {
		log.Warningf("Handler type %s is not supported", handlerType)
		handlerChan <- istioResponse{}
		return
	}
	result, err := in.istioConfigApi.Get().Namespace(namespace).Resource(handlerTypePlural).SubResource(handlerName).Do().Get()
	istioObject, ok := result.(IstioObject)
	if !ok {
		istioObject = nil
		if err == nil {
			err = fmt.Errorf("%s/%s doesn't return a valid IstioObject", handlerType, handlerName)
		}
	}
	if istioObject != nil {
		if istioObject.GetSpec() != nil {
			istioObject.GetSpec()["adapter"] = handlerType
		} else {
			istioObject.SetSpec(map[string]interface{}{
				"adapter": handlerType,
			})
		}
	}
	handlerChan <- istioResponse{result: istioObject, err: err}
}

func (in *IstioClient) getActionInstance(namespace string, istiorule string, instanceNamespace string, instanceType string, instanceName string, instancesChan chan<- istioResponse) {
	if instanceNamespace != "" && instanceNamespace != namespace {
		err := fmt.Errorf("Istio Rule %s/%s has an instance for a different namespace", namespace, istiorule)
		instancesChan <- istioResponse{err: err}
		return
	}
	istioTypePlural, ok := istioTypePlurals[instanceType]
	if !ok {
		log.Warningf("Instance type %s is not supported", instanceType)
		instancesChan <- istioResponse{}
		return
	}
	result, err := in.istioConfigApi.Get().Namespace(namespace).Resource(istioTypePlural).SubResource(instanceName).Do().Get()
	istioObject, ok := result.(IstioObject)
	if !ok {
		istioObject = nil
		if err == nil {
			err = fmt.Errorf("%s/%s doesn't return a valid IstioObject", instanceType, instanceName)
		}
	}
	if istioObject != nil {
		if istioObject.GetSpec() != nil {
			istioObject.GetSpec()["template"] = instanceType
		} else {
			istioObject.SetSpec(map[string]interface{}{
				"template": instanceType,
			})
		}
	}
	instancesChan <- istioResponse{result: istioObject, err: err}
}

func parseFQN(fqn string) (fqnName string, fqnType string, fqnNamespace string) {
	if fqn == "" {
		return "", "", ""
	}

	iName := strings.Index(fqn, ".")
	if iName == -1 {
		return fqn, "", ""
	}

	runesHandler := []rune(fqn)
	fName := string(runesHandler[0:iName])
	fType := string(runesHandler[iName+1:])
	fNamespace := ""

	iNamespace := strings.Index(fType, ".")
	if iNamespace != -1 {
		runesType := []rune(fType)
		fType = string(runesType[0:iNamespace])
		fNamespace = string(runesType[iNamespace+1:])
	}

	return fName, fType, fNamespace
}
