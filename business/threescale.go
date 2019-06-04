package business

import (
	"encoding/json"
	"fmt"
	"strings"
	"sync"

	"k8s.io/apimachinery/pkg/api/errors"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/prometheus/internalmetrics"
)

type ThreeScaleService struct {
	k8s kubernetes.IstioClientInterface
}

func (in *ThreeScaleService) GetThreeScaleInfo() (models.ThreeScaleInfo, error) {
	var err error
	promtimer := internalmetrics.GetGoFunctionMetric("business", "ThreeScaleService", "GetThreeScaleInfo")
	defer promtimer.ObserveNow(&err)

	conf := config.Get()
	_, err2 := in.k8s.GetAdapter(conf.IstioNamespace, "adapters", conf.ExternalServices.ThreeScale.AdapterName)
	if err2 != nil {
		if errors.IsNotFound(err2) {
			return models.ThreeScaleInfo{}, nil
		} else {
			return models.ThreeScaleInfo{}, err2
		}
	}
	canCreate, canUpdate, canDelete := getPermissions(in.k8s, conf.IstioNamespace, "adapters", "adapters")
	return models.ThreeScaleInfo{
		Enabled: true,
		Permissions: models.ResourcePermissions{
			Create: canCreate,
			Update: canUpdate,
			Delete: canDelete,
		}}, nil
}

func (in *ThreeScaleService) GetThreeScaleHandlers() (models.ThreeScaleHandlers, error) {
	var err error
	promtimer := internalmetrics.GetGoFunctionMetric("business", "ThreeScaleService", "GetThreeScaleHandlers")
	defer promtimer.ObserveNow(&err)

	return in.getThreeScaleHandlers()
}

func (in *ThreeScaleService) CreateThreeScaleHandler(body []byte) (models.ThreeScaleHandlers, error) {
	var err error
	promtimer := internalmetrics.GetGoFunctionMetric("business", "ThreeScaleService", "CreateThreeScaleHandler")
	defer promtimer.ObserveNow(&err)

	conf := config.Get()

	threeScaleHandler := &models.ThreeScaleHandler{}
	err2 := json.Unmarshal(body, threeScaleHandler)
	if err2 != nil {
		log.Errorf("JSON: %s shows error: %s", string(body), err2)
		err = fmt.Errorf(models.BadThreeScaleHandlerJson)
		return nil, err
	}

	jsonHandler, jsonInstance, err2 := generateJsonHandlerInstance(*threeScaleHandler)
	if err2 != nil {
		log.Error(err2)
		err = fmt.Errorf(models.BadThreeScaleHandlerJson)
		return nil, err
	}

	var wg sync.WaitGroup
	wg.Add(1)

	var errHandler, errInstance error

	go func() {
		defer wg.Done()
		_, errInstance = in.k8s.CreateIstioObject(resourceTypesToAPI["templates"], conf.IstioNamespace, "instances", jsonInstance)
	}()

	// Create handler on main goroutine
	_, errHandler = in.k8s.CreateIstioObject(resourceTypesToAPI["adapters"], conf.IstioNamespace, "handlers", jsonHandler)

	wg.Wait()

	if errHandler != nil {
		return nil, errHandler
	}
	if errInstance != nil {
		return nil, errHandler
	}

	return in.getThreeScaleHandlers()
}

// Private get 3scale handlers to be reused for several public methods
func (in *ThreeScaleService) getThreeScaleHandlers() (models.ThreeScaleHandlers, error) {
	conf := config.Get()
	// Istio config generated from Kiali will be labeled as kiali_wizard
	tsh, err2 := in.k8s.GetAdapters(conf.IstioNamespace, "kiali_wizard")
	if err2 != nil {
		return models.ThreeScaleHandlers{}, err2
	}
	return models.CastThreeScaleHandlers(tsh), nil
}

// It will generate the JSON representing the Handler and Instance that will be used for the ThreeScale Handler
func generateJsonHandlerInstance(handler models.ThreeScaleHandler) (string, string, error) {
	conf := config.Get()
	newHandler := kubernetes.GenericIstioObject{
		TypeMeta: meta_v1.TypeMeta{
			APIVersion: "config.istio.io/v1alpha2",
			Kind:       "handler",
		},
		ObjectMeta: meta_v1.ObjectMeta{
			Name:      handler.Name,
			Namespace: conf.IstioNamespace,
			Labels: map[string]string{
				"kiali_wizard": "threescale-handler",
			},
		},
		Spec: map[string]interface{}{
			"adapter": conf.ExternalServices.ThreeScale.AdapterName,
			"params": map[string]interface{}{
				"service_id":   handler.ServiceId,
				"system_url":   handler.SystemUrl,
				"access_token": handler.AccessToken,
			},
			"connection": map[string]interface{}{
				"address": conf.ExternalServices.ThreeScale.AdapterService + ":" + conf.ExternalServices.ThreeScale.AdapterPort,
			},
		},
	}

	newInstance := kubernetes.GenericIstioObject{
		TypeMeta: meta_v1.TypeMeta{
			APIVersion: "config.istio.io/v1alpha2",
			Kind:       "instance",
		},
		ObjectMeta: meta_v1.ObjectMeta{
			Name:      "threescale-authorization-" + handler.Name,
			Namespace: conf.IstioNamespace,
			Labels: map[string]string{
				"kiali_wizard": "threescale-handler",
			},
		},
		Spec: map[string]interface{}{
			"template": "threescale-authorization",
			"params": map[string]interface{}{
				"subject": map[string]interface{}{
					"user": "request.query_params[\"user_key\"] | request.headers[\"user-key\"] | \"\"",
					"properties": map[string]interface{}{
						"app_id":  "request.query_params[\"app_id\"] | request.headers[\"app-id\"] | \"\"",
						"app_key": "request.query_params[\"app_key\"] | request.headers[\"app-key\"] | \"\"",
					},
				},
				"action": map[string]interface{}{
					"path":   "request.url_path",
					"method": "request.method | \"get\"",
				},
			},
		},
	}

	bHandler, err := json.Marshal(newHandler)
	if err != nil {
		return "", "", err
	}
	bInstance, err := json.Marshal(newInstance)
	if err != nil {
		return "", "", err
	}
	return string(bHandler), string(bInstance), nil
}

func (in *ThreeScaleService) UpdateThreeScaleHandler(handlerName string, body []byte) (models.ThreeScaleHandlers, error) {
	var err error
	promtimer := internalmetrics.GetGoFunctionMetric("business", "ThreeScaleService", "UpdateThreeScaleHandler")
	defer promtimer.ObserveNow(&err)

	threeScaleHandler := &models.ThreeScaleHandler{}
	err2 := json.Unmarshal(body, threeScaleHandler)
	if err2 != nil {
		log.Errorf("JSON: %s shows error: %s", string(body), err2)
		err = fmt.Errorf(models.BadThreeScaleHandlerJson)
		return nil, err
	}

	// Be sure that name inside body is same as used as parameter
	(*threeScaleHandler).Name = handlerName

	// We need the handler structure generated from the ThreeScaleHandler to update it
	jsonUpdatedHandler, _, err2 := generateJsonHandlerInstance(*threeScaleHandler)
	if err2 != nil {
		return nil, err
	}

	conf := config.Get()

	_, err2 = in.k8s.UpdateIstioObject(resourceTypesToAPI["adapters"], conf.IstioNamespace, "handlers", handlerName, jsonUpdatedHandler)
	if err2 != nil {
		return nil, err2
	}

	return in.getThreeScaleHandlers()
}

func checkHandler(istioObject kubernetes.IstioObject, handlerName string) bool {
	conf := config.Get()
	fullHandlerName := handlerName + "." + conf.IstioNamespace
	if istioObject.GetSpec() != nil {
		if actions, actionsFound := istioObject.GetSpec()["actions"]; actionsFound {
			if actionArray, actionCast := actions.([]interface{}); actionCast {
				if len(actionArray) == 1 {
					action := actionArray[0]
					if actionMap, actionMapCast := action.(map[string]interface{}); actionMapCast {
						if handler, ok := actionMap["handler"]; ok {
							if handlerValue, handlerCast := handler.(string); handlerCast && handlerValue == fullHandlerName {
								return true
							}
						}
					}
				}
			}
		}
	}
	return false
}

func (in *ThreeScaleService) DeleteThreeScaleHandler(handlerName string) (models.ThreeScaleHandlers, error) {
	var err error
	promtimer := internalmetrics.GetGoFunctionMetric("business", "ThreeScaleService", "DeleteThreeScaleHandler")
	defer promtimer.ObserveNow(&err)

	conf := config.Get()

	err = in.k8s.DeleteIstioObject(resourceTypesToAPI["adapters"], conf.IstioNamespace, "handlers", handlerName)
	if err != nil {
		return nil, err
	}

	instanceName := "threescale-authorization-" + handlerName
	err = in.k8s.DeleteIstioObject(resourceTypesToAPI["templates"], conf.IstioNamespace, "instances", instanceName)
	if err != nil {
		return nil, err
	}

	// It should delete all Rules generated by Wizard that used the deleted handler
	rules, err := in.k8s.GetIstioRules(conf.IstioNamespace, "kiali_wizard")
	if err != nil {
		return nil, err
	}

	ruleNamesToDelete := make([]string, 0)
	for _, rule := range rules {
		if checkHandler(rule, handlerName) {
			ruleNamesToDelete = append(ruleNamesToDelete, rule.GetObjectMeta().Name)
		}
	}

	wg := sync.WaitGroup{}
	wg.Add(len(ruleNamesToDelete))
	errChan := make(chan error, 1)

	for _, ruleName := range ruleNamesToDelete {
		go func(ruleNameToDelete string) {
			defer wg.Done()
			if len(errChan) == 0 {
				err = in.k8s.DeleteIstioObject(resourceTypesToAPI["rules"], conf.IstioNamespace, "rules", ruleNameToDelete)
				if err != nil {
					errChan <- err
				}
			}
		}(ruleName)
	}

	wg.Wait()
	close(errChan)
	for e := range errChan {
		if e != nil {
			return nil, err
		}
	}
	return in.getThreeScaleHandlers()
}

func getThreeScaleRuleDetails(rule kubernetes.IstioObject) string {
	threeScaleHandlerName := ""
	if rule.GetSpec() != nil {
		if actions, actionsFound := rule.GetSpec()["actions"]; actionsFound {
			if actionsCast, actionInterface := actions.([]interface{}); actionInterface {
				if len(actionsCast) == 1 {
					action := actionsCast[0]
					if actionCast, actionInterface := action.(map[string]interface{}); actionInterface {
						if handler, handlerFound := actionCast["handler"]; handlerFound {
							if handlerCast, handlerString := handler.(string); handlerString {
								if i := strings.Index(handlerCast, "."); i > -1 {
									threeScaleHandlerName = handlerCast[:i]
								}
							}
						}
					}
				}
			}
		}
	}
	return threeScaleHandlerName
}

func (in *ThreeScaleService) GetThreeScaleRule(namespace, service string) (models.ThreeScaleServiceRule, error) {
	var err error
	promtimer := internalmetrics.GetGoFunctionMetric("business", "ThreeScaleService", "GetThreeScaleRule")
	defer promtimer.ObserveNow(&err)

	conf := config.Get()

	ruleName := "threescale-" + namespace + "-" + service
	rule, err := in.k8s.GetIstioRule(conf.IstioNamespace, ruleName)
	if err != nil {
		return models.ThreeScaleServiceRule{}, err
	}

	threeScaleHandlerName := getThreeScaleRuleDetails(rule)

	threeScaleServiceRule := models.ThreeScaleServiceRule{
		ServiceName:           service,
		ServiceNamespace:      namespace,
		ThreeScaleHandlerName: threeScaleHandlerName,
	}

	return threeScaleServiceRule, nil
}

func generateMatch(threeScaleServiceRule models.ThreeScaleServiceRule) string {
	// Match granularity is set at service level so no need to use versions labels
	match := "context.reporter.kind == \"inbound\" && "
	match += "destination.service.namespace == \"" + threeScaleServiceRule.ServiceNamespace + "\" && "
	match += "destination.service.name == \"" + threeScaleServiceRule.ServiceName + "\""
	return match
}

func generateJsonRule(threeScaleServiceRule models.ThreeScaleServiceRule) (string, error) {
	conf := config.Get()
	newRule := kubernetes.GenericIstioObject{
		TypeMeta: meta_v1.TypeMeta{
			APIVersion: "config.istio.io/v1alpha2",
			Kind:       "rule",
		},
		ObjectMeta: meta_v1.ObjectMeta{
			Name:      "threescale-" + threeScaleServiceRule.ServiceNamespace + "-" + threeScaleServiceRule.ServiceName,
			Namespace: conf.IstioNamespace,
			Labels: map[string]string{
				"kiali_wizard": threeScaleServiceRule.ServiceNamespace + "-" + threeScaleServiceRule.ServiceName,
			},
		},
		Spec: map[string]interface{}{
			"match": generateMatch(threeScaleServiceRule),
			"actions": []interface{}{
				map[string]interface{}{
					"handler": threeScaleServiceRule.ThreeScaleHandlerName + "." + conf.IstioNamespace,
					"instances": []interface{}{
						"threescale-authorization-" + threeScaleServiceRule.ThreeScaleHandlerName,
					},
				},
			},
		},
	}

	bRule, err := json.Marshal(newRule)
	if err != nil {
		return "", err
	}

	return string(bRule), nil
}

func (in *ThreeScaleService) CreateThreeScaleRule(namespace string, body []byte) (models.ThreeScaleServiceRule, error) {
	var err error
	promtimer := internalmetrics.GetGoFunctionMetric("business", "ThreeScaleService", "CreateThreeScaleRule")
	defer promtimer.ObserveNow(&err)

	threeScaleServiceRule := &models.ThreeScaleServiceRule{}
	err2 := json.Unmarshal(body, threeScaleServiceRule)
	if err2 != nil {
		log.Errorf("JSON: %s shows error: %s", string(body), err2)
		err = fmt.Errorf(models.BadThreeScaleRuleJson)
		return models.ThreeScaleServiceRule{}, err
	}

	jsonRule, err2 := generateJsonRule(*threeScaleServiceRule)
	if err2 != nil {
		log.Error(err2)
		err = fmt.Errorf(models.BadThreeScaleRuleJson)
		return models.ThreeScaleServiceRule{}, err
	}

	conf := config.Get()
	_, errRule := in.k8s.CreateIstioObject(resourceTypesToAPI["rules"], conf.IstioNamespace, "rules", jsonRule)
	if errRule != nil {
		return models.ThreeScaleServiceRule{}, errRule
	}

	return *threeScaleServiceRule, nil
}

func (in *ThreeScaleService) UpdateThreeScaleRule(namespace, service string, body []byte) (models.ThreeScaleServiceRule, error) {
	var err error
	promtimer := internalmetrics.GetGoFunctionMetric("business", "ThreeScaleService", "UpdateThreeScaleRule")
	defer promtimer.ObserveNow(&err)

	threeScaleServiceRule := &models.ThreeScaleServiceRule{}
	err2 := json.Unmarshal(body, threeScaleServiceRule)
	if err2 != nil {
		log.Errorf("JSON: %s shows error: %s", string(body), err2)
		err = fmt.Errorf(models.BadThreeScaleRuleJson)
		return models.ThreeScaleServiceRule{}, err
	}

	// Be sure that parameters are used in the rule
	(*threeScaleServiceRule).ServiceNamespace = namespace
	(*threeScaleServiceRule).ServiceName = service

	jsonRule, err2 := generateJsonRule(*threeScaleServiceRule)
	if err2 != nil {
		log.Error(err2)
		err = fmt.Errorf(models.BadThreeScaleRuleJson)
		return models.ThreeScaleServiceRule{}, err
	}

	ruleName := "threescale-" + namespace + "-" + service

	conf := config.Get()
	_, errRule := in.k8s.UpdateIstioObject(resourceTypesToAPI["rules"], conf.IstioNamespace, "rules", ruleName, jsonRule)
	if errRule != nil {
		return models.ThreeScaleServiceRule{}, errRule
	}

	return *threeScaleServiceRule, nil
}

func (in *ThreeScaleService) DeleteThreeScaleRule(namespace, service string) error {
	var err error
	promtimer := internalmetrics.GetGoFunctionMetric("business", "ThreeScaleService", "DeleteThreeScaleRule")
	defer promtimer.ObserveNow(&err)

	conf := config.Get()
	ruleName := "threescale-" + namespace + "-" + service
	err = in.k8s.DeleteIstioObject(resourceTypesToAPI["rules"], conf.IstioNamespace, "rules", ruleName)
	return err
}
